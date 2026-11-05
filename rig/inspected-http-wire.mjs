import { createInspectedHeaderBlockDecoder } from "./inspected-header-block.mjs";
import { createInspectedMetaPolicy } from "./inspected-meta-policy.mjs";
import { createInspectedGooglePolicy } from "./inspected-google-policy.mjs";
import { createGunzip, createInflate, createBrotliDecompress } from "node:zlib";
import { isProxy, isUint8Array } from "node:util/types";

const PREFACE = Buffer.from("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");
const HEADER = 65536, RESPONSE = 2097152, AGGREGATE = 8388608;
const ORIGIN = "https://collector.test.invalid", DOCUMENT = "https://owned.example/inspection";
const EMPTY = Buffer.alloc(0), jsonBytes = value => Buffer.byteLength(JSON.stringify(value));
const error = reason => { throw new Error(reason); };
const token = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const value = /^[\t\x20-\x7e\x80-\xff]*$/;
const bufferLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength").get;

function h1Fields(raw, request) {
  const lines = raw.toString("latin1").split("\r\n").slice(0, -2), line = lines.shift();
  const match = request ? /^([A-Z]+) ([\x21-\x7e]+) HTTP\/1\.1$/.exec(line) : /^HTTP\/1\.[01] ([0-9]{3})(?: [\x20-\x7e]*)?$/.exec(line);
  if (!match) error(request ? "unsupported_h1_request" : "malformed_h1_response");
  const pairs = lines.map(line => {
    const at = line.indexOf(":"), name = line.slice(0, at), text = line.slice(at + 1);
    if (at < 1 || !token.test(name) || !value.test(text)) error("malformed_http_fields");
    return [name, text.replace(/^[\t ]+|[\t ]+$/g, "")];
  });
  return { pairs, method: request ? match[1] : null, target: request ? match[2] : null,
    status: request ? null : Number(match[1]) };
}
const fields = (pairs, name) => pairs.filter(([key]) => key.toLowerCase() === name).map(([, value]) => value);

function headerBlock(frames) {
  const first = frames[0], flags = first[4], payload = first.subarray(9);
  let offset = flags & 8 ? 1 : 0, padding = flags & 8 ? payload[0] : 0;
  if (flags & 32) offset += 5;
  if (padding === undefined || payload.length < offset + padding) error("malformed_h2_padding");
  if ((flags & 32) && (payload.readUInt32BE(flags & 8 ? 1 : 0) & 0x7fffffff) === (first.readUInt32BE(5) & 0x7fffffff))
    error("malformed_h2_priority");
  return Buffer.concat([payload.subarray(offset, payload.length - padding), ...frames.slice(1).map(part => part.subarray(9))]);
}

// Shared physical framing for the old count-only diagnostic and the composed
// observer. Callbacks are trusted internal wiring, never CLI/program inputs.
export function createInspectedRequestFramer(protocol, hooks) {
  if (!["h1", "h2"].includes(protocol)) error("unsupported_inspected_protocol");
  const rawLimit = hooks.rawHeaderLimit ?? HEADER;
  let pending = EMPTY, preface = protocol === "h1", lastStream = 0, held = [], heldBytes = 0, ordinal;
  const push = bytes => {
    if (!Buffer.isBuffer(bytes)) error("invalid_inspected_bytes");
    if (hooks.stopped()) return EMPTY;
    const output = [];
    // Bound parser copies even if a caller delivers several requests at once.
    for (let at = 0; at < bytes.length && !hooks.stopped(); at += 16384) {
      pending = Buffer.concat([pending, bytes.subarray(at, at + 16384)]);
      if (!preface) {
        const length = Math.min(pending.length, PREFACE.length);
        if (!pending.subarray(0, length).equals(PREFACE.subarray(0, length))) { hooks.stop("invalid_h2_preface"); break; }
        if (length !== PREFACE.length) continue;
        output.push(pending.subarray(0, length)); pending = pending.subarray(length); preface = true;
      }
      while (pending.length && !hooks.stopped()) {
        if (protocol === "h1") {
          const end = pending.indexOf("\r\n\r\n"), length = end + 4;
          if (end < 0) { if (pending.length > rawLimit) hooks.stop("raw_header_limit"); break; }
          if (length > rawLimit) { hooks.stop("raw_header_limit"); break; }
          const original = pending.subarray(0, length);
          try {
            const decoded = h1Fields(original, true);
            const lengths = fields(decoded.pairs, "content-length");
            if (fields(decoded.pairs, "transfer-encoding").length || lengths.length > 1
              || lengths.some(value => value !== "0")) error("unsupported_h1_request");
            ordinal = hooks.begin(null);
            if (ordinal !== false && hooks.header({ ...decoded, original, ordinal, stream: null })) output.push(original);
          } catch (caught) { hooks.stop(caught.message); }
          pending = pending.subarray(length); continue;
        }
        if (pending.length < 9) break;
        const length = pending.readUIntBE(0, 3), type = pending[3], flags = pending[4], stream = pending.readUInt32BE(5) & 0x7fffffff;
        if (length > HEADER) { hooks.stop("raw_header_limit"); break; }
        if (length > (hooks.frameLimit ?? HEADER)) { hooks.stop("unsupported_h2_frame_size"); break; }
        if (pending.length < length + 9) break;
        const original = pending.subarray(0, length + 9); pending = pending.subarray(length + 9);
        try {
          if (held.length && (type !== 9 || stream !== (held[0].readUInt32BE(5) & 0x7fffffff)))
            error("invalid_h2_continuation");
          if (type === 1) {
            if (!stream || !(stream & 1) || stream <= lastStream) error("unsupported_h2_request");
            lastStream = stream; ordinal = hooks.begin(stream);
            if (ordinal === false) break;
            if (!(flags & 1) || flags & ~45) error("unsupported_h2_request");
            held = [original]; heldBytes = original.length;
          } else if (type === 9) {
            if (!held.length || flags & ~4) error("invalid_h2_continuation");
            held.push(original); heldBytes += original.length;
          } else {
            if (type === 0 || ![2, 3, 4, 6, 7, 8, 16].includes(type)) error("unsupported_h2_frame");
            if (hooks.control?.(original) !== false) output.push(original);
            continue;
          }
          if (heldBytes > HEADER) error("raw_header_limit");
          if (flags & 4) {
            const original = Buffer.concat(held), block = headerBlock(held);
            if (hooks.header({ original, block, stream, ordinal })) output.push(original);
            held = []; heldBytes = 0;
          }
        } catch (caught) { hooks.stop(caught.message); }
      }
    }
    if (hooks.stopped()) { pending = EMPTY; held = []; }
    return Buffer.concat(output);
  };
  return Object.freeze({ push, end() {
    if (pending.length || held.length || !preface) hooks.stop("incomplete_request");
    pending = EMPTY; held = [];
  } });
}

function syntheticRequest(url, method, authority) {
  if (Buffer.byteLength(url) > 2048) error("url_limit");
  if (method !== "GET") error("synthetic_method");
  if (!["collector.test.invalid", "collector.test.invalid:443"].includes(authority)) error("synthetic_authority");
  let parsed;
  try { parsed = new URL(url); } catch { error("synthetic_url"); }
  if (parsed.origin !== ORIGIN || parsed.href !== url || parsed.hash || parsed.username || parsed.password
    || parsed.pathname !== "/pixel") error("synthetic_url");
  try {
    for (const part of parsed.search.slice(1).split("&")) {
      const [name, text, ...extra] = part.split("=");
      if (extra.length || text === undefined) error("synthetic_query");
      decodeURIComponent(name.replaceAll("+", " ")); decodeURIComponent(text.replaceAll("+", " "));
    }
  } catch { error("synthetic_query"); }
  const pairs = [...parsed.searchParams];
  const expected = [["id", "999999999999999"], ["ev", "PageView"], ["dl", DOCUMENT], ["item", "/"], ["item", "/"]];
  if (pairs.length < 6 || pairs.length > 7 || expected.some(([key, text], n) => pairs[n]?.[0] !== key || pairs[n]?.[1] !== text)
    || pairs[5][0] !== "r" || !/^[0-7]$/.test(pairs[5][1])
    || (pairs.length === 7 && (pairs[6][0] !== "p" || !/^a*$/.test(pairs[6][1]))))
    error("synthetic_marker_or_query");
}

function validPairs(pairs, h2, request) {
  const pseudo = new Set();
  let ordinary = false;
  for (const [name, text] of pairs) {
    if (!value.test(text)) error("malformed_http_fields");
    if (name.startsWith(":")) {
      if (!h2 || ordinary || pseudo.has(name) || !(request
        ? [":method", ":scheme", ":authority", ":path"] : [":status"]).includes(name)) error("malformed_pseudoheaders");
      pseudo.add(name);
    } else {
      ordinary = true;
      if (!token.test(name) || (h2 && name.toLowerCase() !== name)) error("malformed_http_fields");
      if (["proxy-authorization", "authorization"].includes(name.toLowerCase())) error("private_header_not_permitted");
      if (h2 && ["connection", "upgrade", "keep-alive", "proxy-connection", "transfer-encoding"].includes(name))
        error("unsupported_h2_connection_header");
    }
  }
  if (h2 && (request ? pseudo.size !== 4 : pseudo.size !== 1)) error("malformed_pseudoheaders");
}

/**
 * Fixed generated fixture by default; optional DECLARED-META-PROFILE binds
 * caller-observed logical requests to the compiled eligibility policy. Neither
 * mode supplies ownership authentication or live permission.
 * Original wire and decoded observations share one conservative
 * retention ledger. Unlike CDP's dual-channel retention helper, these fields
 * come directly from plaintext and have exactly one ordered header channel.
 * Declared mode additionally retains original Buffer chunks per connection in
 * originals().wire (including compression/framing), charged to that same 8 MiB
 * ledger. A caller retaining another copy must budget that copy too. Request
 * header_bytes is ordered-pair JSON size; raw_field_bytes additionally bounds
 * untrimmed H1 fields, excluding the separately bounded request line.
 */
export function createInspectedHttpWire(options) {
  const mode = options && !isProxy(options) && Object.getOwnPropertyDescriptor(options, "mode")?.value;
  const google = mode === "DECLARED-GOOGLE-PROFILE";
  const meta = options === undefined ? null : google ? createInspectedGooglePolicy(options) : createInspectedMetaPolicy(options);
  const requests = [], responses = [], connections = new Set();
  const wireOriginals = [];
  const decompressors = new Set(), redirects = new Map(), pendingRedirects = new Map();
  let observed = 0, forwarded = 0, stopped = false, reason = null, retained = 0, peak = 0, peakResponse = 0, lateOverflow = false;
  const stop = category => {
    if (stopped) return;
    stopped = true; reason = category;
    for (const request of requests) if (["awaiting", "streaming"].includes(request.response_state)) request.response_state = "inconclusive";
    for (const row of responses) if (row.state === "streaming") {
      retained -= row.header_bytes + row.decoded_body_bytes;
      row.headers = []; row.body = []; row.header_bytes = 0; row.decoded_body_bytes = 0; row.state = "inconclusive";
      if (meta) row.redirect_url = null;
    }
    if (meta) { redirects.clear(); pendingRedirects.clear(); }
    for (const decoder of decompressors) decoder.destroy();
  };
  const reserve = bytes => {
    if (stopped) return false;
    if (retained + bytes > AGGREGATE) { stop("aggregate_overflow"); return false; }
    retained += bytes; peak = Math.max(peak, retained); return true;
  };
  const settleDecompressors = () => Promise.all([...decompressors]
    .filter(stream => stream.destroyed || stream.readableEnded)
    .map(stream => new Promise(resolve => stream.once("close", resolve))));
  return Object.freeze({
    snapshot: () => ({ observed, forwarded, stopped, reason, retained_bytes: retained, peak_retained_bytes: peak,
      peak_response_bytes: peakResponse, decompressors: decompressors.size, late_wire_overflow: lateOverflow,
      ...(meta ? { policy: meta.summary() } : {}) }),
    originals: () => ({ requests, responses, ...(meta ? { wire: wireOriginals } : {}) }),
    reserveObservation(bytes) {
      if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > AGGREGATE) error("invalid_retention_size");
      return reserve(bytes);
    },
    retain(bytes) {
      if (!Buffer.isBuffer(bytes)) error("invalid_inspected_bytes");
      // Continue bounded forensic wire observation through a denied request's
      // close. This never reopens semantic admission or completes a response.
      if (retained + bytes.length > AGGREGATE) {
        lateOverflow = true; stop("aggregate_overflow"); return null;
      }
      retained += bytes.length; peak = Math.max(peak, retained);
      return Buffer.from(bytes);
    },
    stop,
    connection(protocol, boundAuthority = null) {
      if (boundAuthority !== null && (typeof boundAuthority !== "string"
        || !/^[a-z0-9.-]+:443$/.test(boundAuthority))) error("invalid_inspected_authority");
      const id = connections.size + 1, decoder = protocol === "h2" ? createInspectedHeaderBlockDecoder() : null;
      const responseDecoder = decoder ? createInspectedHeaderBlockDecoder() : null;
      const raw = meta ? { connection: id, protocol, request: [], response: [] } : null;
      if (raw) wireOriginals.push(raw);
      const capture = (bytes, direction) => {
        if (isProxy(bytes) || !isUint8Array(bytes) || !Buffer.isBuffer(bytes)) error("invalid_inspected_bytes");
        const length = bufferLength.call(bytes);
        if (!reserve(length)) return EMPTY;
        const copy = Buffer.alloc(length);
        Uint8Array.prototype.set.call(copy, bytes);
        raw[direction].push(copy);
        return copy;
      };
      const streamRequests = new Map(), streamResponses = new Map(), pendingSettings = { request: [], response: [] };
      let responsePending = EMPTY, held = [], heldBytes = 0, current = null, chunkState = "size", remaining = 0, h1Index = 0;
      connections.add(id);
      const control = (original, direction) => {
        const type = original[3], flags = original[4], stream = original.readUInt32BE(5) & 0x7fffffff;
        const body = original.subarray(9), opposite = direction === "request" ? "response" : "request";
        if (type === 4) {
          if (stream || flags & ~1 || (flags & 1 ? body.length !== 0 : body.length % 6 !== 0)) error("malformed_h2_settings");
          if (flags & 1) {
            const setting = pendingSettings[opposite].shift();
            if (!setting) error("unmatched_h2_settings_ack");
            for (const size of setting) (direction === "request" ? decoder : responseDecoder).setMaxTableSize(size);
          } else {
            if (pendingSettings[direction].length >= 64) error("h2_settings_work_limit");
            const sizes = [];
            for (let n = 0; n < body.length; n += 6) {
              const key = body.readUInt16BE(n), size = body.readUInt32BE(n + 2);
              if (key === 1) {
                if (size > HEADER) error("unsupported_hpack_table_size");
                sizes.push(size);
              } else if (key === 2) {
                if (direction !== "request" || size !== 0) error("unsupported_server_push");
              } else if (key === 4) {
                if (size > 0x7fffffff) error("malformed_h2_settings");
              } else if (key === 5) {
                if (size !== 16384) error("unsupported_h2_frame_size_settings");
              } else if (![3, 6, 8, 9].includes(key) || ([8, 9].includes(key) && size > 1)) error("unsupported_h2_settings");
            }
            pendingSettings[direction].push(sizes);
          }
        } else if (type === 3) {
          if (!stream || body.length !== 4 || flags || !streamRequests.has(stream)) error("malformed_h2_reset");
          const row = streamResponses.get(stream);
          if (row?.state === "streaming") error("truncated_response");
          if (!row) {
            const request = streamRequests.get(stream);
            request.response_state = "transport-aborted";
            streamResponses.set(stream, { state: "transport-aborted" });
            responses.push({ ordinal: request.ordinal, connection: id, stream, status: null,
              state: "transport-aborted", headers: [], body: [], header_bytes: 0, decoded_body_bytes: 0,
              transport_error: body.readUInt32BE(0),
              ...(meta ? { policy_ordinal: request.policy_ordinal, logical_network_id: request.logical_network_id } : {}) });
          }
        } else if (type === 6) {
          if (stream || body.length !== 8 || flags & ~1) error("malformed_h2_ping");
        } else if (type === 7) {
          if (stream || body.length < 8 || flags) error("malformed_h2_goaway");
        } else if (type === 8) {
          if (body.length !== 4 || flags || !(body.readUInt32BE(0) & 0x7fffffff)) error("malformed_h2_window");
        } else if (type === 2) {
          if (!stream || body.length !== 5 || flags) error("malformed_h2_priority");
        } else if (type === 16) {
          if (stream || body.length < 4 || flags) error("malformed_h2_priority");
        } else error(type === 5 ? "unsupported_server_push" : "unsupported_h2_frame");
        return true;
      };
      const append = (row, bytes) => {
        if (stopped) return;
        if (row.header_bytes + row.decoded_body_bytes + bytes.length > RESPONSE) { stop("response_overflow"); return; }
        if (!reserve(bytes.length)) return;
        row.body.push(Buffer.from(bytes)); row.decoded_body_bytes += bytes.length;
        peakResponse = Math.max(peakResponse, row.header_bytes + row.decoded_body_bytes);
      };
      const compressedOperation = (row, bytes, finish = false) => new Promise(resolve => {
        const stream = row.decoder;
        let done = false;
        const settle = () => {
          if (done) return;
          done = true; stream.removeListener("close", settle); stream.removeListener("error", settle); stream.removeListener("end", settle);
          resolve();
        };
        stream.once("close", settle); stream.once("error", settle);
        if (finish) { stream.once("end", settle); stream.end(); }
        else stream.write(bytes, settle);
      });
      const beginResponse = (request, pairs, status) => {
        if (!request || streamResponses.has(request.stream ?? request.ordinal)) error("unmatched_response");
        validPairs(pairs, Boolean(decoder), false);
        if (!Number.isInteger(status) || status < 200 || status > 599) error("unsupported_informational_response");
        const headerBytes = jsonBytes(pairs);
        const row = { ordinal: request.ordinal, connection: id, stream: request.stream, status, headers: [],
          body: [], header_bytes: 0, decoded_body_bytes: 0, encoded_body_bytes: 0, state: "streaming",
          redirect_url: null, expected_length: null, coding: "identity", decoder: null,
          ...(meta ? { policy_ordinal: request.policy_ordinal, logical_network_id: request.logical_network_id } : {}) };
        responses.push(row); streamResponses.set(request.stream ?? request.ordinal, row);
        request.response_state = "streaming";
        if (responses.length > 64) error("observation_overflow");
        if (headerBytes > RESPONSE) error("response_overflow");
        if (!reserve(headerBytes + 3)) return row;
        row.headers = pairs; row.header_bytes = headerBytes;
        peakResponse = Math.max(peakResponse, headerBytes);
        const lengths = fields(pairs, "content-length"), transfer = fields(pairs, "transfer-encoding"), coding = fields(pairs, "content-encoding");
        if (lengths.length > 1 || lengths.some(text => !/^(0|[1-9][0-9]*)$/.test(text) || !Number.isSafeInteger(Number(text)))
          || (lengths.length && transfer.length) || transfer.length > 1
          || transfer.some(text => text.toLowerCase() !== "chunked")) error("ambiguous_response_framing");
        if (lengths.length) row.expected_length = Number(lengths[0]);
        if (coding.length > 1 || (coding.length && !["identity", "gzip", "deflate", "br"].includes(coding[0])))
          error("unsupported_content_encoding");
        row.coding = coding[0] ?? "identity";
        if ([204, 304].includes(status) && (transfer.length || (row.expected_length !== null && status === 204 && row.expected_length !== 0)))
          error("unsupported_bodyless_response");
        row.framing = [204, 304].includes(status) ? "none" : decoder ? "h2" : transfer.length ? "chunked"
          : lengths.length ? "length" : "close";
        const locations = fields(pairs, "location");
        if (status >= 300 && status <= 399 && status !== 304) {
          if (locations.length !== 1) error("unsupported_redirect_destination");
          if (meta) {
            if (![301, 302, 303, 307, 308].includes(status)) error("unsupported_meta_response");
            try { row.redirect_url = new URL(locations[0], request.url).href; }
            catch { error("unsupported_redirect_destination"); }
          } else {
            syntheticRequest(locations[0], "GET", "collector.test.invalid");
            row.redirect_url = locations[0];
          }
          if (pendingRedirects.has(row.redirect_url)) error("ambiguous_redirect_edge");
          pendingRedirects.set(row.redirect_url, row.ordinal);
        }
        if (row.coding !== "identity" && row.framing !== "none") {
          row.decoder = ({ gzip: createGunzip, deflate: createInflate, br: createBrotliDecompress })[row.coding]({ chunkSize: 16384 });
          decompressors.add(row.decoder);
          row.decoder.on("data", bytes => append(row, bytes));
          row.decoder.on("error", () => stop("malformed_compressed_response"));
          const stream = row.decoder;
          stream.once("close", () => decompressors.delete(stream));
        }
        return row;
      };
      const body = async (row, bytes) => {
        if (stopped) return;
        row.encoded_body_bytes += bytes.length;
        if (row.encoded_body_bytes > AGGREGATE || (row.expected_length !== null && row.encoded_body_bytes > row.expected_length))
          error("response_length_mismatch");
        if (row.decoder) await compressedOperation(row, bytes);
        else append(row, bytes);
      };
      const finish = async row => {
        if (stopped) return;
        if (row.framing !== "none" && row.expected_length !== null && row.expected_length !== row.encoded_body_bytes)
          error("truncated_response");
        if (row.decoder) await compressedOperation(row, EMPTY, true);
        if (stopped) return;
        if (meta) row.policy_response = meta.recordResponse(row);
        row.state = "complete"; row.decoder = null;
        streamRequests.get(row.stream ?? row.ordinal).response_state = "complete";
        if (row.redirect_url) {
          if (redirects.has(row.redirect_url)) error("ambiguous_redirect_edge");
          pendingRedirects.delete(row.redirect_url);
          redirects.set(row.redirect_url, row.ordinal);
        }
      };
      const framer = createInspectedRequestFramer(protocol, {
        // Request-line URL bytes have their own 2048-byte ceiling; they are
        // not header fields. The 65536-byte semantic header cap is unchanged.
        rawHeaderLimit: HEADER + 2048 + 32,
        frameLimit: 16384,
        stopped: () => stopped, stop,
        begin() { observed++; if (observed > (google ? 20 : 8)) { stop("physical_request_limit"); return false; } return observed; },
        header(entry) {
          let pairs = entry.pairs;
          if (decoder) pairs = decoder.decode(entry.block).pairs;
          validPairs(pairs, Boolean(decoder), true);
          if (["upgrade", "expect", "trailer", "http2-settings"].some(name => fields(pairs, name).length)
            || (!decoder && fields(pairs, "connection").some(text => !/^(keep-alive|close)$/i.test(text)))
            || (decoder && fields(pairs, "te").length)) error("unsupported_request_surface");
          const headerBytes = jsonBytes(pairs);
          if (headerBytes > HEADER) error("semantic_header_limit");
          const rawFieldBytes = meta && !decoder ? entry.original.length - entry.original.indexOf("\r\n") - 2 : null;
          if (rawFieldBytes > HEADER) error("raw_request_field_limit");
          const one = name => { const values = fields(pairs, name);
            if (values.length !== 1) error(meta ? "invalid_inspected_authority" : "synthetic_authority");
            return values[0]; };
          const authority = one(decoder ? ":authority" : "host"), method = decoder ? one(":method") : entry.method;
          if (boundAuthority !== null && authority !== boundAuthority
            && authority + ":443" !== boundAuthority) error("inspected_authority_mismatch");
          const target = decoder ? one(":path") : entry.target;
          if (decoder && one(":scheme") !== "https") error(meta ? "invalid_inspected_url" : "synthetic_url");
          if (decoder && (fields(pairs, "host").some(host => host !== authority)
            || fields(pairs, "content-length").some(length => length !== "0")
            || fields(pairs, "content-length").length > 1)) error("unsupported_h2_request");
          if (!target.startsWith("/") || target.startsWith("//")) error(meta ? "invalid_inspected_url" : "synthetic_url");
          const url = (meta ? "https://" + authority : ORIGIN) + target;
          if (!meta) syntheticRequest(url, method, authority);
          if (pendingRedirects.has(url)) error("uncompleted_redirect_parent");
          const binding = meta?.inspect({ ordinal: entry.ordinal, connection: id, stream: entry.stream,
            url, method, headers: pairs }, redirects.get(url) ?? null);
          if (!reserve(headerBytes + Buffer.byteLength(url) + Buffer.byteLength(method))) return false;
          const admission = binding ? meta.register(binding) : null;
          const row = { ordinal: entry.ordinal, connection: id, stream: entry.stream, url, method,
            headers: pairs, header_bytes: headerBytes, body_bytes: 0, response_state: "awaiting",
            redirect_from: redirects.get(url) ?? null,
            ...(admission ? { ...admission, authority, target, scheme: "https",
              physical_header_bytes: entry.original.length, raw_field_bytes: rawFieldBytes } : {}) };
          redirects.delete(url);
          requests.push(row); streamRequests.set(entry.stream ?? entry.ordinal, row); forwarded++;
          return true;
        },
        control: original => control(original, "request"),
      });
      const processH1 = async () => {
        while (responsePending.length && !stopped) {
          if (!current) {
            const end = responsePending.indexOf("\r\n\r\n");
            if (end < 0) { if (responsePending.length > HEADER) error("raw_response_header_limit"); break; }
            if (end + 4 > HEADER) error("raw_response_header_limit");
            const decoded = h1Fields(responsePending.subarray(0, end + 4), false);
            current = beginResponse([...streamRequests.values()][h1Index++], decoded.pairs, decoded.status);
            responsePending = responsePending.subarray(end + 4); chunkState = "size"; remaining = 0;
            if (stopped) break;
            if (current.framing === "none" || current.expected_length === 0) {
              await finish(current); current = null; continue;
            }
          }
          if (current.framing === "length") {
            const length = Math.min(responsePending.length, current.expected_length - current.encoded_body_bytes);
            await body(current, responsePending.subarray(0, length)); responsePending = responsePending.subarray(length);
            if (current.encoded_body_bytes === current.expected_length) { await finish(current); current = null; }
          } else if (current.framing === "close") {
            await body(current, responsePending); responsePending = EMPTY;
          } else if (chunkState === "size") {
            const end = responsePending.indexOf("\r\n");
            if (end < 0) { if (responsePending.length > 128) error("unsupported_chunk_extension"); break; }
            const text = responsePending.subarray(0, end).toString("latin1");
            if (!/^[0-9a-fA-F]{1,8}$/.test(text)) error("unsupported_chunk_extension");
            remaining = parseInt(text, 16); responsePending = responsePending.subarray(end + 2);
            chunkState = remaining ? "data" : "last";
          } else if (chunkState === "data") {
            const length = Math.min(remaining, responsePending.length);
            await body(current, responsePending.subarray(0, length)); responsePending = responsePending.subarray(length); remaining -= length;
            if (!remaining) chunkState = "crlf";
          } else {
            if (responsePending.length < 2) break;
            if (!responsePending.subarray(0, 2).equals(Buffer.from("\r\n"))) error(chunkState === "last" ? "unsupported_response_trailers" : "malformed_chunk");
            responsePending = responsePending.subarray(2);
            if (chunkState === "last") { await finish(current); current = null; }
            else chunkState = "size";
          }
        }
      };
      const processH2 = async () => {
        while (responsePending.length >= 9 && !stopped) {
          const length = responsePending.readUIntBE(0, 3);
          if (length > 16384) error("unsupported_h2_frame_size");
          if (responsePending.length < length + 9) break;
          const original = responsePending.subarray(0, length + 9), type = original[3], flags = original[4];
          const stream = original.readUInt32BE(5) & 0x7fffffff;
          responsePending = responsePending.subarray(length + 9);
          if (held.length && (type !== 9 || stream !== (held[0].readUInt32BE(5) & 0x7fffffff))) error("invalid_h2_continuation");
          if (type === 1 || type === 9) {
            if (type === 1) {
              if (!stream || !(stream & 1) || !streamRequests.has(stream) || flags & ~45) error("unmatched_response");
              if (streamResponses.has(stream)) error("unsupported_response_trailers");
              held = [original]; heldBytes = original.length;
            } else {
              if (!held.length || flags & ~4) error("invalid_h2_continuation");
              held.push(original); heldBytes += original.length;
            }
            if (heldBytes > HEADER) error("raw_response_header_limit");
            if (flags & 4) {
              const decoded = responseDecoder.decode(headerBlock(held)), statuses = fields(decoded.pairs, ":status");
              if (statuses.length !== 1 || !/^\d{3}$/.test(statuses[0])) error("malformed_response_status");
              const row = beginResponse(streamRequests.get(stream), decoded.pairs, Number(statuses[0])), end = held[0][4] & 1;
              held = []; heldBytes = 0;
              if (end) await finish(row);
            }
          } else if (type === 0) {
            const row = streamResponses.get(stream);
            if (!row || row.state !== "streaming" || flags & ~9 || row.framing === "none") error("unmatched_response_data");
            const payload = original.subarray(9), offset = flags & 8 ? 1 : 0, padding = flags & 8 ? payload[0] : 0;
            if (padding === undefined || payload.length < offset + padding) error("malformed_h2_padding");
            await body(row, payload.subarray(offset, payload.length - padding));
            if (flags & 1) await finish(row);
          } else control(original, "response");
        }
      };
      return Object.freeze({
        request: meta ? bytes => {
          if (stopped) return EMPTY;
          try { return framer.push(capture(bytes, "request")); }
          catch (caught) { stop(caught.message); return EMPTY; }
        } : framer.push,
        endRequest: framer.end,
        async response(bytes) {
          if (!meta && !Buffer.isBuffer(bytes)) error("invalid_inspected_bytes");
          if (stopped) return EMPTY;
          try {
            if (meta) bytes = capture(bytes, "response");
            for (let n = 0; n < bytes.length && !stopped; n += 16384) {
              responsePending = Buffer.concat([responsePending, bytes.subarray(n, n + 16384)]);
              await (decoder ? processH2() : processH1());
            }
          } catch (caught) { stop(caught.message); }
          if (stopped) { responsePending = EMPTY; held = []; }
          return stopped ? EMPTY : bytes;
        },
        async endResponse(termination = "clean_eof") {
          if (stopped) { if (meta) await settleDecompressors(); return; }
          try {
            if (!["clean_eof", "upstream_connection_reset", "upstream_transport_error", "upstream_unexpected_close"].includes(termination))
              error("invalid_response_termination");
            const incomplete = responsePending.length || held.length || current
              || [...streamResponses.values()].some(row => row.state === "streaming");
            if (termination !== "clean_eof" && incomplete) {
              for (const row of streamResponses.values()) if (row.state === "streaming") row.transport_error = termination;
              responsePending = EMPTY; held = []; current = null;
              error(termination);
            }
            if (!decoder && current?.framing === "close") { await finish(current); current = null; }
            if (responsePending.length || held.length || current
              || [...streamResponses.values()].some(row => row.state === "streaming")) error("truncated_response");
            for (const [stream, request] of streamRequests) if (!streamResponses.has(stream)) {
              request.response_state = "transport-aborted";
              responses.push({ ordinal: request.ordinal, connection: id, stream: request.stream, status: null,
                state: "transport-aborted", headers: [], body: [], header_bytes: 0, decoded_body_bytes: 0,
                transport_error: termination === "clean_eof" ? null : termination,
                ...(meta ? { policy_ordinal: request.policy_ordinal, logical_network_id: request.logical_network_id } : {}) });
            }
          } catch (caught) { stop(caught.message); }
          if (meta) await settleDecompressors();
        },
      });
    },
  });
}
