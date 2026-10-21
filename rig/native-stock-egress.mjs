import { createHash, randomBytes, X509Certificate } from "node:crypto";
import { createServer as httpServer } from "node:http";
import { createSecureServer } from "node:http2";
import { createServer as httpsServer } from "node:https";
import { connect } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { constants, closeSync, fstatSync, lstatSync, openSync, readFileSync } from "node:fs";
import { release } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { LIMITS } from "./native-stock-policy.mjs";

const AUTHORITY = "collector.test.invalid:443";
const ORIGIN = "https://collector.test.invalid";
const FIXTURE = ORIGIN + "/fixture";
const BODY = Buffer.from([0, 255, 128, 65]);
// Synthetic receiving-sink input, never a recorded response original.
const EXPANDED = Buffer.alloc(LIMITS.response_bytes + 1, 65);
for (let i = 0; i < EXPANDED.length; i++) EXPANDED[i] = i % 251;
const COMPRESSED = gzipSync(EXPANDED);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const launcher = fileURLToPath(new URL("./qualification-loopback-chrome", import.meta.url));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export function elideProxyAuthorization(headers) {
  if (Array.isArray(headers)) {
    if (headers.some(entry => typeof entry?.name !== "string")) throw new Error("invalid_header_observation");
    const clean = headers.filter(entry => entry.name.toLowerCase() !== "proxy-authorization");
    if (clean.some(entry => typeof entry.value !== "string")) throw new Error("invalid_header_observation");
    return clean.map(({ name, value }) => ({ name, value }));
  }
  if (!headers || ![Object.prototype, null].includes(Object.getPrototypeOf(headers)))
    throw new Error("invalid_header_observation");
  const clean = Object.entries(headers).filter(([key]) => key.toLowerCase() !== "proxy-authorization");
  if (clean.some(([, value]) => typeof value !== "string"
    && !(Array.isArray(value) && value.every(part => typeof part === "string"))))
    throw new Error("invalid_header_observation");
  return Object.fromEntries(clean);
}
const safeHeaders = elideProxyAuthorization;

// Same representation at Fetch pause, ExtraInfo, and the actual HTTP receiver.
// This measures retained header fields, not TLS framing or HPACK bytes.
const canonicalHeaders = headers => {
  const clean = safeHeaders(headers);
  const fields = Array.isArray(clean) ? clean.map(({ name, value }) => [name, value]) : Object.entries(clean);
  return JSON.stringify(fields.map(([key, value]) => [key.toLowerCase(), value])
    .sort(([a], [b]) => a.localeCompare(b)));
};
export const headerBytes = headers => Buffer.byteLength(canonicalHeaders(headers));

// The caller must close its opaque outgoing byte gate BEFORE stage/continuation.
// This object grants no CONNECT, URL, ownership or native-execution authority.
export function createFinalHeaderHold() {
  let staged = null;
  const seen = new Set();
  const validHeaders = headers => headers && Object.getPrototypeOf(headers) === Object.prototype
    && Object.entries(headers).every(([name, value]) => name.length && typeof value === "string");
  return {
    stage(entry) {
      if (staged) return { accepted: false, reason: "stage_busy" };
      if (!entry || !["caseId", "networkId", "requestId"].every(key =>
        typeof entry[key] === "string" && entry[key].length > 0)
        || seen.has(entry.networkId) || !validHeaders(entry.headers)
        || !Number.isSafeInteger(entry.bodyBytes) || entry.bodyBytes < 0)
        return { accepted: false, reason: "invalid_stage" };
      const bytes = headerBytes(entry.headers) + entry.bodyBytes;
      if (bytes > LIMITS.request_bytes) return { accepted: false, reason: "staged_request_overflow", bytes };
      staged = { caseId: entry.caseId, networkId: entry.networkId,
        requestId: entry.requestId, bodyBytes: entry.bodyBytes };
      seen.add(entry.networkId);
      return { accepted: true, bytes };
    },
    final(event) {
      if (!staged || event?.caseId !== staged.caseId || event?.networkId !== staged.networkId)
        return { accepted: false, reason: "unmatched_final_headers" };
      if (!validHeaders(event.headers)) return { accepted: false, reason: "invalid_final_headers" };
      const bytes = headerBytes(event.headers) + staged.bodyBytes;
      const { requestId, networkId } = staged;
      staged = null;
      return { accepted: bytes <= LIMITS.request_bytes,
        reason: bytes <= LIMITS.request_bytes ? "final_headers_accepted" : "final_request_overflow",
        requestId, networkId, bytes };
    },
  };
}

function decodedBase64Length(text) {
  if (typeof text !== "string" || text.length % 4) return null;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  for (let i = 0; i < text.length - padding; i++) if (!alphabet.includes(text[i])) return null;
  if (padding && (alphabet.indexOf(text[text.length - padding - 1]) & (padding === 2 ? 15 : 3))) return null;
  return text.length / 4 * 3 - padding;
}

// CDP's incoming JSON strings are observations, not accepted originals. Size
// them before Buffer.from; on failure drop every incomplete retained part.
// Both retained response-header observations and the decoded body share the
// response ceiling. All URL/request/response observations share the aggregate.
// Chrome's own internal buffering is explicitly outside this retention claim.
export function createDecodedRetention(cancel) {
  if (typeof cancel !== "function") throw new Error("invalid_cancel_callback");
  const responses = new Map();
  let stopped = false, reason = null, retained = 0, peak = 0, peakResponse = 0, cancelFailed = false;
  const stop = category => {
    if (stopped) return false;
    stopped = true; reason = category;
    for (const row of responses.values()) if (row.state !== "complete") {
      retained -= row.bytes + row.headerBytes; row.bytes = 0; row.headerBytes = 0; row.channels.clear();
      row.buffered = null; row.tail = []; row.state = "inconclusive";
    }
    try { cancel(category); } catch { cancelFailed = true; }
    return false;
  };
  const reserve = bytes => {
    if (stopped) return false;
    if (!Number.isSafeInteger(bytes) || bytes < 0) return stop("invalid_retention_size");
    if (retained + bytes > LIMITS.aggregate_bytes) return stop("aggregate_overflow");
    retained += bytes; peak = Math.max(peak, retained);
    return true;
  };
  const append = (row, base64, buffered) => {
    const bytes = decodedBase64Length(base64);
    if (bytes === null) return stop("invalid_original_base64");
    if (row.headerBytes + row.bytes + bytes > LIMITS.response_bytes) return stop("response_overflow");
    if (!reserve(bytes)) return false;
    // No oversized decoded Buffer is ever constructed on the rejection path.
    const original = Buffer.from(base64, "base64");
    row.bytes += bytes; peakResponse = Math.max(peakResponse, row.headerBytes + row.bytes);
    if (buffered) row.buffered = original;
    else if (bytes) row.tail.push(original);
    return true;
  };
  const finish = row => {
    if (!row.enabled || !row.finished || row.channels.size !== 2 || stopped) return;
    if (row.bytes !== row.observed) { stop("truncated_original_stream"); return; }
    row.state = "complete";
  };
  return {
    begin(id) {
      if (stopped) return false;
      if (typeof id !== "string" || !id || responses.has(id)) return stop("invalid_response_id");
      if (responses.size >= LIMITS.observations) return stop("observation_overflow");
      responses.set(id, { id, state: "enabling", bytes: 0, observed: 0,
        headerBytes: 0, channels: new Map(),
        unstreamed: 0, enabled: false, finished: false, buffered: null, tail: [] });
      return true;
    },
    headers(id, channel, originalHeaders) {
      if (stopped) return false;
      const row = responses.get(id);
      if (!row || !["response", "extra"].includes(channel) || row.channels.has(channel))
        return stop("invalid_response_header_observation");
      let bytes;
      try { bytes = headerBytes(originalHeaders); } catch { return stop("original_response_headers_unavailable"); }
      if (row.headerBytes + Math.max(row.bytes, row.observed) + bytes > LIMITS.response_bytes)
        return stop("response_overflow");
      if (!reserve(bytes)) return false;
      row.headerBytes += bytes; row.channels.set(channel, bytes);
      peakResponse = Math.max(peakResponse, row.headerBytes + row.bytes);
      finish(row);
      return true;
    },
    data(id, event) {
      if (stopped) return false;
      const row = responses.get(id);
      if (!row || row.finished || !Number.isSafeInteger(event?.dataLength) || event.dataLength < 0)
        return stop("invalid_data_event");
      row.observed += event.dataLength;
      if (!Number.isSafeInteger(row.observed)) return stop("invalid_data_event");
      if (row.headerBytes + row.observed > LIMITS.response_bytes) return stop("response_overflow");
      if (event.data === undefined) {
        if (row.enabled && event.dataLength) return stop("missing_original_stream_data");
        row.unstreamed += event.dataLength;
        return true;
      }
      const bytes = decodedBase64Length(event.data);
      if (bytes === null || bytes !== event.dataLength) return stop("original_chunk_length_mismatch");
      return append(row, event.data, false);
    },
    enabled(id, result) {
      if (stopped) return false;
      const row = responses.get(id);
      if (!row || row.enabled || typeof result?.bufferedData !== "string")
        return stop("original_stream_unavailable");
      const bytes = decodedBase64Length(result.bufferedData);
      if (bytes === null) return stop("invalid_original_base64");
      if (row.headerBytes + row.bytes + bytes > LIMITS.response_bytes) return stop("response_overflow");
      if (bytes !== row.unstreamed) return stop("buffered_original_length_mismatch");
      if (!append(row, result.bufferedData, true)) return false;
      row.enabled = true; row.state = "streaming"; finish(row);
      return !stopped;
    },
    finish(id) {
      if (stopped) return false;
      const row = responses.get(id);
      if (!row || row.finished) return stop("invalid_stream_completion");
      row.finished = true; finish(row);
      return !stopped;
    },
    unavailable() { return stop("original_stream_unavailable"); },
    failed() { return stop("original_stream_failed"); },
    canReadCompleted(id) {
      const row = responses.get(id);
      return !stopped && !!row?.finished && !row.enabled && row.channels.size === 2
        && row.headerBytes + row.observed <= LIMITS.response_bytes;
    },
    stop,
    reserve,
    parts(id) {
      const row = responses.get(id);
      return row?.state === "complete" ? [row.buffered, ...row.tail].filter(part => part?.length) : [];
    },
    snapshot() {
      return { stopped, reason, cancel_failed: cancelFailed, retained_bytes: retained,
        peak_retained_bytes: peak, peak_response_bytes: peakResponse,
        responses: [...responses.values()].map(row => ({ id: row.id, state: row.state,
          retained_bytes: row.headerBytes + row.bytes, retained_body_bytes: row.bytes, retained_header_bytes: row.headerBytes,
          header_observations: [...row.channels.keys()], observed_decoded_bytes: row.observed, stream_enabled: row.enabled,
          loading_finished: row.finished })) };
    },
  };
}

// Diagnostic alternative, NOT a qualified TLS handshake/application separator.
// An opaque TLS 1.3 type-23 record may be Finished, client authentication,
// application data, or coalesced messages. None is forwarded by this fence.
export function createTls13HandshakeFence() {
  let pending = Buffer.alloc(0), helloSeen = false, blocked = false, reason = null, held = 0, forwarded = 0;
  const reject = category => { blocked = true; reason = category; held += pending.length; pending = Buffer.alloc(0); };
  const clientHello = record => {
    const body = record.subarray(5);
    if (body.length < 45 || body[0] !== 1 || body.readUIntBE(1, 3) !== body.length - 4)
      return "fragmented_or_unknown_handshake";
    if (body.readUInt16BE(4) !== 0x0303) return "unknown_tls_version";
    let offset = 38;
    const skip = size => {
      if (offset + size > body.length) throw new Error("invalid");
      offset += size;
    };
    try {
      const session = body[offset++]; if (session > 32) return "invalid_client_hello"; skip(session);
      const ciphers = body.readUInt16BE(offset); skip(2);
      if (!ciphers || ciphers % 2) return "invalid_client_hello"; skip(ciphers);
      const compression = body[offset++]; if (compression !== 1 || body[offset++] !== 0) return "invalid_client_hello";
      const extensionBytes = body.readUInt16BE(offset); skip(2);
      if (offset + extensionBytes !== body.length) return "invalid_client_hello";
      let tls13 = false;
      const seen = new Set();
      while (offset < body.length) {
        const type = body.readUInt16BE(offset), length = body.readUInt16BE(offset + 2); skip(4);
        if (seen.has(type)) return "duplicate_tls_extension"; seen.add(type);
        if (type === 41) return "tls_resumption_ambiguous";
        if (type === 42) return "tls_early_data_present";
        if (type === 49) return "tls_post_handshake_authentication";
        if (type === 65037) return "tls_ech_ambiguous";
        if (type === 43) {
          if (!length || body[offset] !== length - 1 || body[offset] % 2) return "invalid_client_hello";
          for (let i = offset + 1; i < offset + length; i += 2)
            if (body.readUInt16BE(i) === 0x0304) tls13 = true;
        }
        skip(length);
      }
      return tls13 ? null : "tls13_not_offered";
    } catch { return "invalid_client_hello"; }
  };
  return {
    push(bytes) {
      if (!Buffer.isBuffer(bytes)) { reject("invalid_tls_bytes"); return []; }
      if (blocked) { held += bytes.length; return []; }
      if (pending.length + bytes.length > 2 * LIMITS.request_bytes) {
        held += bytes.length; reject("tls_buffer_overflow"); return [];
      }
      pending = Buffer.concat([pending, bytes]);
      const allowed = [];
      while (pending.length >= 5) {
        const type = pending[0], size = pending.readUInt16BE(3);
        if (![0x0301, 0x0303].includes(pending.readUInt16BE(1)) || size > 18432 || !size) {
          reject("invalid_tls_record"); break;
        }
        if (type === 23) { reject("encrypted_handshake_or_application"); break; }
        if (pending.length < size + 5) break;
        const record = pending.subarray(0, size + 5);
        if (!helloSeen && type === 22) {
          const category = clientHello(record);
          if (category) { reject(category); break; }
          helloSeen = true;
        } else if (!(helloSeen && type === 20 && size === 1 && record[5] === 1)) {
          reject("unknown_handshake_or_record"); break;
        }
        allowed.push(record); forwarded += record.length; pending = pending.subarray(record.length);
      }
      return allowed;
    },
    snapshot() {
      return { blocked, reason, client_hello_qualified: helloSeen, held_bytes: held,
        forwarded_bytes: forwarded, pending_bytes: pending.length,
        encrypted_client_authentication_inspectable: false, native_handshake_boundary_qualified: false };
    },
  };
}

// Historical, pre-clarification diagnostic. Its response-precontinuation label
// does not override the owner's subsequent recorder-retention clarification.
export function classifyProbe(rows) {
  if (!Array.isArray(rows) || rows.length !== 2 || !rows.some(row => row?.protocol === "h1")
    || !rows.some(row => row?.protocol === "h2") || rows.some(row => !row?.complete))
    return { witnessed: false, blockers: [], errors: ["incomplete_probe"] };
  const required = {
    positive: 1, enforced: 0, bypass: 1,
    unauthenticated: "proxy_auth_required", wrong_auth: "proxy_auth_required",
    wrong_authority: "authority_denied", no_ticket: "ticket_required",
    same_tunnel_unknown_denied: 0, same_tunnel_unknown_bypass: 1,
    same_tunnel_marker_denied: 0, same_tunnel_marker_bypass: 1,
    redirect_denied: 0, redirect_bypass: 1, same_tunnel_reused: true,
    proxy_auth_at_sink: false, original_positive_matches: true, cookie_effect_observed: true,
    intended_scope_denials: true,
  };
  if (!rows.every(row => Object.entries(required).every(([key, value]) => row.controls?.[key] === value)))
    return { witnessed: false, blockers: [], errors: ["unmatched_controls"] };
  const headers = rows.every(({ headers: h }) => h?.staged_bytes <= LIMITS.request_bytes
    && h.final_bytes > LIMITS.request_bytes && h.sink_bytes === h.final_bytes && h.arrivals === 1);
  const responses = rows.every(({ response: r }) => r?.paused_original_matches
    && r.paused_original_bytes > LIMITS.response_bytes && r.paused_renderer_denied
    && r.stream_renderer_completed_bytes > LIMITS.response_bytes);
  const blockers = [
    ...(headers ? ["staged_headers_not_final"] : []),
    ...(responses ? ["response_precontinuation_bound_unqualified"] : []),
  ];
  return { witnessed: headers && responses, blockers,
    errors: headers && responses ? [] : ["prerequisite_not_witnessed"] };
}

function privateRead(path) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const s = fstatSync(fd);
    if (!s.isFile() || s.nlink !== 1 || s.uid !== process.getuid() || (s.mode & 0o7777) !== 0o600)
      throw new Error("unsafe_test_certificate");
    return readFileSync(fd);
  } finally { closeSync(fd); }
}

// Fixed SYNTHETIC diagnostic only. No supplied URL, upstream, proxy, browser,
// program, official source, selector or authority can be passed to this runner.
// Its broker deliberately does NOT claim final-header or response enforcement.
export async function probeFirstParty(options) {
  if (!options || Object.getPrototypeOf(options) !== Object.prototype
    || Reflect.ownKeys(options).join() !== "outputDir" || typeof options.outputDir !== "string")
    throw new Error("invalid_probe_options");
  const dir = lstatSync(options.outputDir);
  if (!dir.isDirectory() || dir.isSymbolicLink() || (dir.mode & 0o7777) !== 0o700
    || dir.uid !== process.getuid()) throw new Error("unsafe_probe_directory");
  if (process.version !== "v24.10.0" || process.platform !== "darwin" || release() !== "27.0.0")
    throw new Error("cohort_mismatch");
  const key = privateRead(join(options.outputDir, "key.pem"));
  const cert = privateRead(join(options.outputDir, "certificate.pem"));
  const pin = createHash("sha256").update(new X509Certificate(cert).publicKey
    .export({ type: "spki", format: "der" })).digest("base64");
  const { chromium } = await import("playwright");
  const sockets = new Set(), sessions = new Set(), contexts = new Set(), hooks = new Map(), observers = new Set();
  const username = randomBytes(16).toString("hex"), password = randomBytes(24).toString("hex");
  const authorization = "Basic " + Buffer.from(username + ":" + password).toString("base64");
  let proxy, upstream, upstreamPort, browserServer, browser, active, tickets = 0, expired = false;
  const raw = { protocols: [] }, protocols = [], errors = [];
  const own = socket => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.once("close", () => sockets.delete(socket));
    return socket;
  };
  const stopSockets = () => {
    for (const session of sessions) session.destroy();
    for (const socket of sockets) socket.destroy();
  };
  const kill = () => {
    const child = browserServer?.process();
    if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  };
  const watchdog = setTimeout(() => { expired = true; stopSockets(); kill(); }, 45000);
  const listen = server => new Promise((resolve, reject) => {
    server.once("error", reject); server.listen(0, "127.0.0.1", resolve);
  });
  const waitFor = async (condition, category, ms = 4000) => {
    const end = performance.now() + ms;
    while (!condition()) {
      if (expired || performance.now() >= end) throw new Error(category);
      await sleep(5);
    }
  };
  const closeServer = server => !server?.listening ? Promise.resolve()
    : new Promise(resolve => server.close(resolve));
  const closeContext = async context => {
    // Never remove the guard before successful owned-context closure.
    await context.close();
    contexts.delete(context);
    for (const [emitter, event, handler] of hooks.get(context) ?? []) emitter.off(event, handler);
    hooks.delete(context);
  };
  try {
    proxy = httpServer((_req, res) => res.writeHead(403).end());
    proxy.on("connection", own);
    proxy.on("connect", (req, client, head) => {
      // Never retain req headers: they contain ephemeral proxy credentials.
      const deny = (code, reason) => {
        client.end(`HTTP/1.1 ${code} Denied\r\n${code === 407
          ? 'Proxy-Authenticate: Basic realm="synthetic-only"\r\n' : ""}`
          + `X-Probe-Reason: ${reason}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`);
      };
      if (req.headers["proxy-authorization"] !== authorization) return deny(407, "proxy_auth_required");
      if (req.url !== AUTHORITY) return deny(403, "authority_denied");
      if (!active || !upstreamPort || tickets < 1) return deny(403, "ticket_required");
      tickets--;
      active.tunnels++;
      // Literal fixed local mapping; this broker has NO DNS/public path.
      const remote = own(connect({ host: "127.0.0.1", port: upstreamPort }));
      remote.once("connect", () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) remote.write(head);
        client.pipe(remote); remote.pipe(client);
      });
      remote.on("error", () => client.destroy());
      client.on("error", () => remote.destroy());
      client.once("close", () => remote.destroy());
      remote.once("close", () => client.destroy());
    });
    await listen(proxy);
    browserServer = await chromium.launchServer({
      executablePath: launcher, host: "127.0.0.1", headless: true, timeout: 10000,
      proxy: { server: `http://127.0.0.1:${proxy.address().port}`, username, password },
      // Exact generated SPKI only; no ignoreHTTPSErrors, native mode or trust-store edit.
      args: ["--disable-background-networking", "--dns-prefetch-disable",
        `--ignore-certificate-errors-spki-list=${pin}`],
    });
    browser = await chromium.connect(browserServer.wsEndpoint());
    if (browser.version() !== "155.0.8059.80") throw new Error("cohort_mismatch");
    for (const protocol of ["h1", "h2"]) {
      const socketIds = new Map();
      // Receiving sinks must deliberately accept the synthetic over-cap header
      // so a 431/parser rejection cannot masquerade as controller enforcement.
      upstream = protocol === "h2" ? createSecureServer({ key, cert, allowHTTP1: false,
        settings: { maxHeaderListSize: 131072 } })
        : httpsServer({ key, cert, maxHeaderSize: 131072, ALPNProtocols: ["http/1.1"] });
      upstream.on("connection", own);
      upstream.on("session", session => {
        sessions.add(session); session.once("close", () => sessions.delete(session));
        session.on("error", () => {});
      });
      upstream.on("request", (req, res) => {
        const current = active;
        if (!current) { res.writeHead(403).end(); return; }
        const connection = req.stream?.session ?? req.socket;
        if (!socketIds.has(connection)) socketIds.set(connection, socketIds.size + 1);
        const row = { url: req.url, method: req.method, http_version: req.httpVersion,
          connection: socketIds.get(connection), headers: safeHeaders(req.headers),
          proxy_auth_at_sink: Object.hasOwn(req.headers, "proxy-authorization"), body_base64: "" };
        current.arrivals.push(row);
        req.resume();
        const redirect = req.url === "/redirect?owned=probe";
        const compressed = ["/compressed?owned=probe", "/compressed-paused?owned=probe"].includes(req.url);
        const bytes = compressed ? COMPRESSED : redirect ? Buffer.alloc(0) : BODY;
        row.response_status = redirect ? 307 : 200;
        row.response_body_sha256 = hash(bytes);
        row.response_headers = {
          "content-type": "application/octet-stream", "cache-control": "no-store",
          ...(redirect ? { location: ORIGIN + "/unknown?owned=probe" } : {}),
          ...(compressed ? { "content-encoding": "gzip" } : { "content-length": String(bytes.length) }),
          "set-cookie": ["first=one; Secure; SameSite=None", "second=two; Secure; SameSite=None"],
        };
        res.writeHead(row.response_status, row.response_headers);
        // Force unknown-length framing, even for HTTP/1.1.
        res.flushHeaders();
        res.end(bytes);
      });
      await listen(upstream);
      upstreamPort = upstream.address().port;
      const controls = {};
      // These controls use real CONNECT sockets and never expose their auth bytes.
      for (const [name, authority, auth] of [
        ["unauthenticated", AUTHORITY, null], ["wrong_auth", AUTHORITY, "Basic invalid"],
        ["wrong_authority", "not-allowed.test.invalid:443", authorization],
        ["no_ticket", AUTHORITY, authorization],
      ]) {
        active = null; tickets = 0;
        controls[name] = await new Promise((resolve, reject) => {
          const socket = own(connect({ host: "127.0.0.1", port: proxy.address().port }));
          let text = "";
          socket.setTimeout(1000, () => { socket.destroy(); reject(new Error("connect_control_deadline")); });
          socket.once("connect", () => socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n`
            + (auth ? `Proxy-Authorization: ${auth}\r\n` : "") + "\r\n"));
          socket.on("data", chunk => {
            text += chunk.toString("ascii");
            if (text.length > 2048) { socket.destroy(); reject(new Error("connect_control_overflow")); }
          });
          socket.once("end", () => resolve(/X-Probe-Reason: ([a-z_]+)/.exec(text)?.[1] ?? "missing_reason"));
          socket.once("error", () => reject(new Error("connect_control_socket")));
        });
      }
      const protocolRaw = { protocol, cases: [] };
      raw.protocols.push(protocolRaw);
      let calibratedPadding;
      for (const kind of ["positive", "enforced", "bypass", "unknown-denied", "unknown-bypass",
        "marker-denied", "marker-bypass", "redirect-denied", "redirect-bypass", "headers", "response",
        "response-paused"]) {
        const context = await browser.newContext({ serviceWorkers: "block" });
        contexts.add(context);
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        const row = { kind, arrivals: [], requests: [], tunnels: 0, response_parts: [], buffered: Buffer.alloc(0),
          stream_errors: [], failures: [], completed: false };
        protocolRaw.cases.push(row);
        active = row; tickets = 0;
        const handlers = [], tasks = new Set(), byNetwork = new Map(), pending = new Map();
        hooks.set(context, handlers);
        let stopped = false;
        const on = (object, event, fn) => { object.on(event, fn); handlers.push([object, event, fn]); };
        const task = promise => {
          tasks.add(promise); observers.add(promise);
          promise.catch(() => row.failures.push("observer_failed")).finally(() => {
            tasks.delete(promise); observers.delete(promise);
          });
        };
        const unsupported = () => { stopped = true; row.failures.push("unsupported_surface"); };
        on(context, "page", unsupported);
        on(context, "serviceworker", unsupported);
        for (const event of ["worker", "frameattached", "websocket"]) on(page, event, unsupported);
        await cdp.send("Network.enable");
        on(cdp, "Network.requestWillBeSentExtraInfo", event => {
          const entry = byNetwork.get(event.requestId);
          const headers = safeHeaders(event.headers);
          if (entry && !entry.final_headers) entry.final_headers = headers;
          else pending.set(event.requestId, headers);
        });
        const append = base64 => {
          const bytes = Buffer.from(base64 ?? "", "base64");
          row.response_parts.push(bytes);
          if (row.response_parts.reduce((sum, part) => sum + part.length, 0) > LIMITS.response_bytes)
            stopped = true; // Immediate no-new-admissions. Never relabel this as a safe byte cap.
        };
        on(cdp, "Network.responseReceived", event => {
          if (event.response.url !== ORIGIN + "/compressed?owned=probe") return;
          row.response_headers = safeHeaders(event.response.headers);
          row.response_network_id = event.requestId;
          task(cdp.send("Network.streamResourceContent", { requestId: event.requestId })
            .then(result => { row.buffered = Buffer.from(result.bufferedData, "base64");
              row.buffered_delivery_bytes = row.buffered.length;
              if (row.buffered.length + row.response_parts.reduce((sum, part) => sum + part.length, 0)
                > LIMITS.response_bytes) stopped = true; },
            () => row.stream_errors.push("original_stream_unavailable")));
        });
        on(cdp, "Network.dataReceived", event => {
          if (event.requestId === row.response_network_id && event.data) append(event.data);
        });
        on(cdp, "Network.loadingFinished", event => {
          if (event.requestId === row.response_network_id) row.stream_finished = true;
        });
        on(cdp, "Fetch.requestPaused", event => task((async () => {
          if (event.responseStatusCode) {
            // Observe ORIGINAL bytes without takeResponseBodyAsStream, replay,
            // fulfillment, header edits or native-response replacement.
            const result = await cdp.send("Fetch.getResponseBody", { requestId: event.requestId });
            const original = Buffer.from(result.body, result.base64Encoded ? "base64" : "utf8");
            row.paused_original_bytes = original.length;
            row.paused_original_matches = original.equals(EXPANDED);
            // Lossless private storage; accounting above uses decoded originals,
            // never the much smaller compressed storage representation.
            row.paused_original_gzip_base64 = gzipSync(original).toString("base64");
            row.paused_response_headers = safeHeaders(event.responseHeaders);
            stopped = true;
            await cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" });
            row.paused_renderer_denied = true;
            return;
          }
          if (event.request.url === FIXTURE && event.resourceType === "Document") {
            await cdp.send("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: 200,
              responseHeaders: [{ name: "Content-Type", value: "text/html" },
                { name: "Content-Security-Policy", value: "default-src 'none'; connect-src https://collector.test.invalid; frame-src 'none'; worker-src 'none'" }],
              body: Buffer.from('<!doctype html><link rel="icon" href="data:,"><p>first-party synthetic TLS probe</p>').toString("base64") });
            return;
          }
          const url = event.request.url;
          const allowed = ["/known?owned=probe", "/calibrate?owned=probe", "/stage?owned=probe",
            "/redirect?owned=probe", "/compressed?owned=probe", "/compressed-paused?owned=probe"]
            .some(path => url === ORIGIN + path);
          const entry = { url, method: event.request.method, resource: event.resourceType,
            staged_headers: safeHeaders(event.request.headers), staged_bytes: headerBytes(event.request.headers),
            final_headers: pending.get(event.networkId) ?? null };
          pending.delete(event.networkId);
          row.requests.push(entry); byNetwork.set(event.networkId, entry);
          const bypass = kind.endsWith("bypass");
          const deny = stopped || event.request.method !== "GET" || !["XHR", "Fetch"].includes(event.resourceType)
            || entry.staged_bytes > LIMITS.request_bytes || (!allowed && !bypass) || kind === "enforced";
          entry.continued = !deny;
          if (deny) {
            entry.reason = stopped ? "stopped" : !allowed ? "exact_scope_denied" : "enforced_denial";
            await cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" });
          } else {
            tickets++;
            await cdp.send("Fetch.continueRequest", { requestId: event.requestId });
          }
        })()));
        await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" },
          { urlPattern: ORIGIN + "/compressed-paused?*", requestStage: "Response" }] });
        await page.goto(FIXTURE, { waitUntil: "load", timeout: 4000 });
        const fetchPath = async (path, padding) => page.evaluate(async ({ path, padding }) => {
          try {
            const response = await fetch(path, padding === undefined ? {} : { headers: { "x-padding": "a".repeat(padding) } });
            const bytes = new Uint8Array(await response.arrayBuffer());
            return { ok: true, length: bytes.length, bytes: bytes.length < 100 ? [...bytes] : null };
          } catch { return { ok: false }; }
        }, { path, padding });
        if (["unknown", "marker", "redirect"].some(prefix => kind.startsWith(prefix)))
          row.first = await fetchPath("/known?owned=probe");
        if (kind === "headers") {
          await fetchPath("/known?owned=probe"); // Seed the same cookies BEFORE calibration.
          await fetchPath("/calibrate?owned=probe", 0);
          const calibration = row.requests.find(r => r.url.endsWith("/calibrate?owned=probe"));
          // Derive test INPUT before the next request; never override native headers.
          calibratedPadding = LIMITS.request_bytes - calibration.staged_bytes - 8;
          row.renderer = await fetchPath("/stage?owned=probe", calibratedPadding);
        } else {
          const path = kind.startsWith("unknown") ? "/unknown?owned=probe"
            : kind.startsWith("marker") ? "/known?owned=lost"
              : kind.startsWith("redirect") ? "/redirect?owned=probe"
                : kind === "response" ? "/compressed?owned=probe"
                  : kind === "response-paused" ? "/compressed-paused?owned=probe" : "/known?owned=probe";
          row.renderer = await fetchPath(path);
        }
        await waitFor(() => tasks.size === 0, "observer_settlement");
        if (kind === "response") await waitFor(() => row.stream_finished, "stream_completion");
        await closeContext(context);
        await waitFor(() => tasks.size === 0, "observer_settlement");
        row.completed = row.failures.length === 0;
        stopSockets();
        await waitFor(() => sockets.size === 0 && sessions.size === 0, "case_socket_cleanup");
      }
      const cases = protocolRaw.cases;
      const find = kind => cases.find(row => row.kind === kind);
      const targetCount = (kind, url) => find(kind).arrivals.filter(r => r.url === url).length;
      for (const kind of ["positive", "enforced", "bypass"]) controls[kind] = find(kind).arrivals.length;
      for (const [name, prefix, url] of [
        ["unknown", "unknown", "/unknown?owned=probe"], ["marker", "marker", "/known?owned=lost"],
      ]) for (const leg of ["denied", "bypass"])
        controls[`same_tunnel_${name}_${leg}`] = targetCount(`${prefix}-${leg}`, url);
      for (const leg of ["denied", "bypass"])
        controls[`redirect_${leg}`] = targetCount(`redirect-${leg}`, "/unknown?owned=probe");
      controls.same_tunnel_reused = ["unknown-bypass", "marker-bypass", "redirect-bypass"]
        .every(kind => new Set(find(kind).arrivals.map(r => r.connection)).size === 1 && find(kind).tunnels === 1);
      controls.proxy_auth_at_sink = cases.some(row => row.arrivals.some(hit => hit.proxy_auth_at_sink));
      controls.original_positive_matches = ["positive", "bypass", "unknown-bypass", "marker-bypass", "redirect-bypass"]
        .every(kind => JSON.stringify(find(kind).renderer.bytes) === JSON.stringify([...BODY]));
      controls.cookie_effect_observed = find("unknown-bypass").arrivals.at(-1).headers.cookie
        === "first=one; second=two";
      controls.intended_scope_denials = ["unknown-denied", "marker-denied", "redirect-denied"]
        .every(kind => find(kind).requests.some(r => r.reason === "exact_scope_denied"));
      const headerCase = find("headers");
      const staged = headerCase.requests.find(r => r.url.endsWith("/stage?owned=probe"));
      const received = headerCase.arrivals.filter(r => r.url === "/stage?owned=probe");
      const responseCase = find("response");
      const pausedCase = find("response-paused");
      const original = Buffer.concat([responseCase.buffered, ...responseCase.response_parts]);
      const summary = {
        protocol, complete: cases.every(row => row.completed),
        controls, headers: { staged_bytes: staged.staged_bytes,
          final_bytes: staged.final_headers ? headerBytes(staged.final_headers) : null,
          sink_bytes: received[0] ? headerBytes(received[0].headers) : null, arrivals: received.length },
        response: { content_length_absent: !Object.keys(responseCase.response_headers ?? {})
          .some(name => name.toLowerCase() === "content-length"),
        encoded_bytes: COMPRESSED.length, decoded_bytes: original.length,
        buffered_delivery_bytes: responseCase.buffered_delivery_bytes ?? null,
        largest_delivery_bytes: Math.max(0, ...responseCase.response_parts.map(p => p.length)),
        original_matches: original.equals(EXPANDED), original_sha256: hash(original),
        stream_errors: responseCase.stream_errors,
        stream_renderer_completed_bytes: responseCase.renderer.length ?? null,
        paused_original_bytes: pausedCase.paused_original_bytes ?? null,
        paused_original_matches: pausedCase.paused_original_matches ?? false,
        paused_renderer_denied: pausedCase.paused_renderer_denied === true && !pausedCase.renderer.ok },
      };
      for (const row of cases) {
        const bytes = Buffer.concat([row.buffered, ...row.response_parts]);
        if (bytes.length) row.original_gzip_base64 = gzipSync(bytes).toString("base64");
        delete row.buffered;
        delete row.response_parts;
      }
      protocols.push(summary);
      upstreamPort = null; active = null; tickets = 0;
      await closeServer(upstream);
    }
  } catch (caught) {
    // Fixed categories only: never serialize browser launch options/errors (auth).
    errors.push(["cohort_mismatch", "observer_settlement", "stream_completion",
      "case_socket_cleanup"].includes(caught.message) ? caught.message : "probe_failed");
  } finally {
    for (const context of contexts) {
      try { await closeContext(context); } catch { errors.push("context_close_failed"); }
    }
    try { await browser?.close(); } catch { errors.push("browser_close_failed"); kill(); }
    try { await browserServer?.close(); } catch { errors.push("browser_server_close_failed"); kill(); }
    await Promise.allSettled([...observers]);
    stopSockets();
    await closeServer(upstream);
    await closeServer(proxy);
    await waitFor(() => sockets.size === 0 && sessions.size === 0, "socket_cleanup").catch(() => errors.push("socket_cleanup"));
    clearTimeout(watchdog);
  }
  return { raw, protocols, errors, cleanup: {
    contexts_closed: contexts.size === 0, guards_removed_after_close: hooks.size === 0,
    proxy_closed: !!proxy && !proxy.listening, sinks_closed: !!upstream && !upstream.listening,
    sockets_closed: sockets.size === 0 && sessions.size === 0,
    observers_settled: observers.size === 0,
    browser_process_exited: !!browserServer && (browserServer.process().exitCode !== null
      || browserServer.process().signalCode !== null),
    deadline_met: !expired,
  } };
}

// Follow-up only. probeFirstParty above deliberately remains the historical
// naive-postcheck counterexample; this entry never calls the stock executor.
export async function qualifyFirstParty(options) {
  const started = performance.now();
  if (!options || Object.getPrototypeOf(options) !== Object.prototype
    || Reflect.ownKeys(options).join() !== "outputDir" || typeof options.outputDir !== "string")
    throw new Error("invalid_qualification_options");
  const dir = lstatSync(options.outputDir);
  if (!dir.isDirectory() || dir.isSymbolicLink() || (dir.mode & 0o7777) !== 0o700
    || dir.uid !== process.getuid()) throw new Error("unsafe_probe_directory");
  if (process.version !== "v24.10.0" || process.platform !== "darwin" || release() !== "27.0.0")
    throw new Error("cohort_mismatch");
  const key = privateRead(join(options.outputDir, "key.pem"));
  const cert = privateRead(join(options.outputDir, "certificate.pem"));
  const pin = createHash("sha256").update(new X509Certificate(cert).publicKey
    .export({ type: "spki", format: "der" })).digest("base64");
  const { chromium } = await import("playwright");
  const sockets = new Set(), contexts = new Set(), sessions = new Set(), tasks = new Set(), timers = new Set();
  const errors = [], protocols = [];
  const username = randomBytes(16).toString("hex"), password = randomBytes(24).toString("hex");
  const authorization = "Basic " + Buffer.from(username + ":" + password).toString("base64");
  let proxy, upstream, browser, browserServer, active, upstreamPort, expired = false;
  const own = socket => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.once("close", () => sockets.delete(socket));
    return socket;
  };
  const stopSockets = () => {
    for (const session of sessions) session.destroy();
    for (const socket of sockets) socket.destroy();
  };
  const kill = () => {
    const child = browserServer?.process();
    if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  };
  const deadline = async (promise, ms, category) => {
    let timer;
    try {
      return await Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(category)), ms);
      })]);
    } finally { clearTimeout(timer); }
  };
  const wait = async (condition, category, ms = 2000) => {
    const until = performance.now() + ms;
    while (!condition()) {
      if (expired || performance.now() >= until) throw new Error(category);
      await sleep(5);
    }

  };
  const closeServer = server => !server?.listening ? Promise.resolve()
    : deadline(new Promise(resolve => server.close(resolve)), 2000, "server_close_deadline");
  const listen = server => deadline(new Promise((resolve, reject) => {
    server.once("error", reject); server.listen(0, "127.0.0.1", resolve);
  }), 2000, "listen_deadline");
  const watchdog = setTimeout(() => { expired = true; stopSockets(); kill(); },
    Math.max(1, LIMITS.duration_ms - (performance.now() - started)));
  try {
    proxy = httpServer((_req, res) => res.writeHead(403).end());
    proxy.on("connection", own);
    proxy.on("connect", (req, client, head) => {
      const deny = (code, reason) => {
        client.end(`HTTP/1.1 ${code} Denied\r\n${code === 407
          ? 'Proxy-Authenticate: Basic realm="synthetic-only"\r\n' : ""}`
          + `X-Probe-Reason: ${reason}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`);
      };
      if (req.headers["proxy-authorization"] !== authorization) return deny(407, "proxy_auth_required");
      if (req.url !== AUTHORITY) return deny(403, "authority_denied");
      const current = active;
      if (!current?.waitingForConnect || !upstreamPort || head.length) return deny(403, "ticket_required");
      current.authenticated_connects++;
      let opened = false;
      const timer = setTimeout(() => {
        if (opened) return;
        current.connect_wait_expired = true;
        current.connect_release = null;
        deny(403, "final_headers_deadline");
      }, 750);
      client.once("close", () => { clearTimeout(timer); current.connect_release = null; });
      const open = () => {
        if (opened || client.destroyed || !current.ticket) return;
        opened = true; clearTimeout(timer); current.ticket = false; current.waitingForConnect = false;
        current.tunnels++;
        const remote = own(connect({ host: "127.0.0.1", port: upstreamPort }));
        current.upstream_sockets++;
        const tunnel = { held: [], heldBytes: 0, remote };
        current.transports.add(tunnel);
        const forward = bytes => {
          current.transport_forwarded += bytes.length;
          remote.write(bytes);
        };
        remote.once("connect", () => {
          client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
          client.on("data", bytes => {
            if (current.tlsFence) {
              for (const record of current.tlsFence.push(bytes)) forward(record);
              return;
            }
            if (current.transportHold) {
              // A finite opaque TCP queue, not guessed native-header headroom
              // or an enlargement of the exact final-headers/body acceptance cap.
              if (tunnel.heldBytes + bytes.length > 2 * LIMITS.request_bytes) {
                current.stopped = true; current.transport_overflow = true;
                tunnel.held = []; tunnel.heldBytes = 0; client.destroy(); remote.destroy(); return;
              }
              tunnel.held.push(bytes); tunnel.heldBytes += bytes.length;
              current.transport_held += bytes.length;
              current.peak_transport_held = Math.max(current.peak_transport_held, tunnel.heldBytes);
            } else forward(bytes);
          });
          tunnel.release = () => {
            for (const bytes of tunnel.held) forward(bytes);
            tunnel.held = []; tunnel.heldBytes = 0;
          };
          remote.pipe(client);
        });
        remote.once("close", () => { current.transports.delete(tunnel); client.destroy(); });
        client.once("close", () => remote.destroy());
      };
      current.connect_release = open;
      if (current.ticket) open();
    });
    await listen(proxy);
    browserServer = await chromium.launchServer({
      executablePath: launcher, host: "127.0.0.1", headless: true, timeout: 10000,
      proxy: { server: `http://127.0.0.1:${proxy.address().port}`, username, password },
      args: ["--disable-background-networking", "--dns-prefetch-disable",
        `--ignore-certificate-errors-spki-list=${pin}`],
    });
    browser = await chromium.connect(browserServer.wsEndpoint());
    if (browser.version() !== "155.0.8059.80") throw new Error("cohort_mismatch");
    for (const protocol of ["h1", "h2"]) {
      upstream = protocol === "h2" ? createSecureServer({ key, cert, allowHTTP1: false,
        settings: { maxHeaderListSize: 131072 } })
        : httpsServer({ key, cert, maxHeaderSize: 131072, ALPNProtocols: ["http/1.1"] });
      upstream.on("connection", own);
      upstream.on("session", session => {
        sessions.add(session);
        session.on("error", () => {});
        session.once("close", () => sessions.delete(session));
      });
      upstream.on("request", (req, res) => {
        const current = active;
        if (!current) return res.writeHead(403).end();
        const arrival = { url: req.url, method: req.method, headers: safeHeaders(req.headers),
          connection: req.stream?.session ? 1 : req.socket.remotePort,
          proxy_auth_at_sink: Object.hasOwn(req.headers, "proxy-authorization"),
          body_base64: "", body_bytes: 0 };
        arrival.tls_protocol = req.socket.getProtocol();
        current.arrivals.push(arrival);
        const bodyParts = [];
        req.on("data", bytes => {
          arrival.body_bytes += bytes.length;
          if (arrival.body_bytes <= LIMITS.request_bytes) bodyParts.push(bytes);
          else { req.destroy(); current.sink_request_overflow = true; }
        });
        req.on("end", () => {
          arrival.body_base64 = Buffer.concat(bodyParts).toString("base64");
          const compressed = ["/response-exact?owned=probe", "/response-overflow?owned=probe",
            "/response-calibrate?owned=probe", "/response-inclusive-one-over?owned=probe",
            "/response-body-at-cap?owned=probe"].includes(req.url);
          const original = req.url === "/response-exact?owned=probe"
            ? EXPANDED.subarray(0, current.exact_response_body_bytes)
            : req.url === "/response-inclusive-one-over?owned=probe"
              ? EXPANDED.subarray(0, current.exact_response_body_bytes + 1)
              : req.url === "/response-body-at-cap?owned=probe" ? EXPANDED.subarray(0, LIMITS.response_bytes)
                : req.url === "/response-overflow?owned=probe" ? EXPANDED : BODY;
          const bytes = compressed ? gzipSync(original) : original;
          arrival.response_status = 200;
          arrival.response_encoded_bytes = bytes.length;
          arrival.response_original_bytes = original.length;
          arrival.response_original_sha256 = hash(original);
          const headers = { "content-type": "application/octet-stream", "cache-control": "no-store",
            ...(compressed ? { "content-encoding": "gzip" } : { "content-length": String(bytes.length) }),
            "set-cookie": ["first=one; Secure; SameSite=None", "second=two; Secure; SameSite=None"] };
          arrival.response_headers = headers;
          res.writeHead(200, headers); res.flushHeaders();
          if (req.url === "/slow?owned=probe") {
            res.write(bytes.subarray(0, 1));
            const timer = setTimeout(() => {
              timers.delete(timer); arrival.response_finished = true; res.end(bytes.subarray(1));
            }, 350);
            timers.add(timer);
          } else {
            if (req.url === "/second?owned=probe") current.concurrent_second_before_first_complete =
              current.arrivals.some(hit => hit.url === "/slow?owned=probe" && !hit.response_finished);
            if (compressed) {
              const timer = setTimeout(() => {
                timers.delete(timer); arrival.response_finished = true; res.end(bytes);
              }, 30);
              timers.add(timer);
            } else { arrival.response_finished = true; res.end(bytes); }
          }
        });
      });
      await listen(upstream); upstreamPort = upstream.address().port;
      const result = { protocol, cases: [] };
      protocols.push(result);
      for (const kind of ["cold-connect-wait", "cold-connect-bypass", "cold-tls-record-fence", "warm-positive", "warm-enforced",
        "warm-header-overflow", "warm-header-bypass", "warm-header-exact",
        "warm-body-exact", "warm-body-overflow",
        "warm-unknown-denied", "warm-unknown-bypass", "warm-marker-denied", "warm-marker-bypass",
        "warm-wrongcase", "warm-wrong-network", ...(protocol === "h2" ? ["warm-concurrent"] : []),
        "response-exact", "response-buffered-race", "response-overflow", "response-overflow-bypass", "response-aggregate",
        "response-inclusive-one-over", "response-body-at-cap",
        "response-missing-api", "response-missing-data", "response-truncated"]) {
        const context = await browser.newContext({ serviceWorkers: "block" });
        contexts.add(context);
        const page = await context.newPage(), cdp = await context.newCDPSession(page);
        const row = { kind, arrivals: [], authenticated_connects: 0, upstream_sockets: 0,
          tunnels: 0, staged: [], finals: [], denied: [], response_headers: [], response_extra: [],
          response_observation_facts: [], originals: [],
          waitingForConnect: false, ticket: false, transports: new Set(), transportHold: false,
          transport_forwarded: 0, transport_held: 0, peak_transport_held: 0, stopped: false };
        if (kind === "cold-tls-record-fence") row.tlsFence = createTls13HandshakeFence();
        result.cases.push(row); active = row;
        const hold = createFinalHeaderHold();
        const byNetwork = new Map(), captured = new Set();
        let staging = Promise.resolve(), pendingFinal = null, bootstrapping = false;
        const task = promise => {
          tasks.add(promise);
          promise.catch(() => { row.observer_failed = true; }).finally(() => tasks.delete(promise));
        };
        const release = () => {
          row.transportHold = false;
          for (const transport of row.transports) transport.release?.();
        };
        const cancel = () => {
          row.stopped = true;
          // Latch before issuing cancellation, including a follow-up scheduled
          // by a fixture/native-like promise rejection in the same renderer.
          for (const transport of row.transports) {
            transport.held = []; transport.heldBytes = 0; transport.remote.destroy();
          }
          task(cdp.send("Page.stopLoading").catch(() => { row.cancel_failed = true; }));
        };
        const recorder = createDecodedRetention(reason => {
          row.cancel_reason = reason;
          const incomplete = new Set(recorder.snapshot().responses.filter(response => response.state !== "complete")
            .map(response => response.id));
          row.response_headers = row.response_headers.filter(response => !incomplete.has(response.networkId));
          row.response_extra = row.response_extra.filter(response => !incomplete.has(response.networkId));
          if (kind !== "response-overflow-bypass") cancel();
        });
        const ensureResponse = id => {
          if (captured.has(id)) return true;
          if (!recorder.begin(id)) return false;
          captured.add(id); return true;
        };
        const noteDenial = (url, reason) => {
          const bytes = Buffer.byteLength(url);
          const retain = !recorder.snapshot().stopped && recorder.reserve(bytes);
          row.denied.push(retain ? { url, reason }
            : { reason, url_capture_available: false, observed_url_bytes: bytes });
        };
        const unsupported = () => { row.unsupported_surface = true; recorder.stop("unsupported_surface"); };
        context.on("page", unsupported); context.on("serviceworker", unsupported);
        for (const event of ["worker", "frameattached", "websocket"]) page.on(event, unsupported);
        await cdp.send("Network.enable");
        cdp.on("Network.requestWillBeSentExtraInfo", event => {
          const entry = byNetwork.get(event.requestId);
          if (!entry) return;
          const headers = safeHeaders(event.headers);
          const corrupt = !entry.bootstrap && ["warm-wrongcase", "warm-wrong-network"].includes(kind);
          const final = hold.final({ caseId: corrupt && kind === "warm-wrongcase" ? "foreign-case" : kind,
            networkId: corrupt && kind === "warm-wrong-network" ? "foreign-network" : event.requestId, headers });
          const retainHeaders = !recorder.snapshot().stopped && recorder.reserve(headerBytes(headers));
          entry.final = { ...final, headers: retainHeaders ? headers : null,
            capture_availability: retainHeaders ? "original_final_headers" : "inconclusive_retention_stopped",
            transport_held_at_validation: row.transport_held,
            forwarded_since_stage: row.transport_forwarded - entry.forwarded_at_stage,
            arrivals_since_stage: row.arrivals.length - entry.arrivals_at_stage };
          row.finals.push({ networkId: event.requestId, ...entry.final });
          if (corrupt) return; // Deliberate invalid evidence must not release.
          if (final.accepted && !row.stopped) {
            if (row.waitingForConnect) { row.ticket = true; row.connect_release?.(); }
            release();
          } else if (!entry.bypass) {
            row.header_denial = final.reason; cancel();
          }
          pendingFinal?.resolve(); pendingFinal = null;
        });
        cdp.on("Network.responseReceived", event => {
          const entry = byNetwork.get(event.requestId);
          if (!entry || row.stopped) return;
          const headers = safeHeaders(event.response.headers);
          if (!ensureResponse(event.requestId) || !recorder.headers(event.requestId, "response", headers)) return;
          row.response_headers.push({ networkId: event.requestId, status: event.response.status, headers });
          row.response_observation_facts.push({ networkId: event.requestId,
            has_content_length: Object.keys(headers).some(name => name.toLowerCase() === "content-length"),
            gzip: Object.entries(headers).some(([name, value]) => name.toLowerCase() === "content-encoding" && value === "gzip") });
          const target = !entry.bootstrap && !entry.response_calibration;
          if (kind === "response-missing-api" && target) { recorder.unavailable(); return; }
          task((async () => {
            let result;
            const declaredLength = Object.entries(headers).find(([name]) => name.toLowerCase() === "content-length")?.[1];
            const completedRead = async () => {
              // A tiny resource can finish before streamResourceContent is
              // processed. Only read its original AFTER all decoded lengths
              // and completion are observed within the cap; never active or
              // oversized response getResponseBody followed by a postcheck.
              await wait(() => recorder.snapshot().stopped || recorder.canReadCompleted(event.requestId),
                "completed_body_deadline", 1000);
              if (!recorder.canReadCompleted(event.requestId)) return null;
              const body = await cdp.send("Network.getResponseBody", { requestId: event.requestId });
              if (!body.base64Encoded) return null;
              row.bounded_completed_body_fallbacks = (row.bounded_completed_body_fallbacks ?? 0) + 1;
              return { bufferedData: body.body };
            };
            try {
              if (typeof declaredLength === "string" && /^[0-9]+$/.test(declaredLength)
                && Number(declaredLength) <= 4096) result = await completedRead();
              else {
                try { result = await cdp.send("Network.streamResourceContent", { requestId: event.requestId }); }
                catch {
                  row.stream_enable_failures = (row.stream_enable_failures ?? 0) + 1;
                  result = await completedRead();
                }
              }
            } catch { recorder.unavailable(); return; }
            if (!result) { if (!recorder.snapshot().stopped) recorder.unavailable(); return; }
            if (kind === "response-buffered-race" && target) await sleep(60);
            if (kind === "response-truncated" && target && result.bufferedData.length)
              result = { bufferedData: result.bufferedData.slice(4) };
            recorder.enabled(event.requestId, result);
          })());
        });
        cdp.on("Network.responseReceivedExtraInfo", event => {
          if (!byNetwork.has(event.requestId)) return;
          const headers = safeHeaders(event.headers);
          if (recorder.snapshot().stopped || !ensureResponse(event.requestId)
            || !recorder.headers(event.requestId, "extra", headers)) return;
          row.response_extra.push({ networkId: event.requestId, status: event.statusCode, headers });
        });
        cdp.on("Network.dataReceived", event => {
          if (!captured.has(event.requestId)) return;
          const entry = byNetwork.get(event.requestId);
          const target = !entry.bootstrap && !entry.response_calibration;
          if (target && kind === "response-missing-data" && event.data)
            recorder.data(event.requestId, { dataLength: event.dataLength });
          else if (target && kind === "response-truncated" && event.data)
            recorder.data(event.requestId, { dataLength: event.dataLength,
              data: event.data.length ? event.data.slice(4) : event.data });
          else recorder.data(event.requestId, event);
        });
        cdp.on("Network.loadingFinished", event => {
          if (captured.has(event.requestId)) recorder.finish(event.requestId);
        });
        cdp.on("Network.loadingFailed", event => {
          if (captured.has(event.requestId) && !recorder.snapshot().stopped) {
            (row.loading_failures ??= []).push({ networkId: event.requestId,
              error: /^net::ERR_[A-Z_]+$/.test(event.errorText) ? event.errorText : "other" });
            recorder.failed();
          }
        });
        cdp.on("Fetch.requestPaused", event => task((async () => {
          if (event.request.url === FIXTURE && event.resourceType === "Document") {
            await cdp.send("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: 200,
              responseHeaders: [{ name: "Content-Type", value: "text/html" },
                { name: "Content-Security-Policy", value: "default-src 'none'; connect-src https://collector.test.invalid; frame-src 'none'; worker-src 'none'" }],
              body: Buffer.from('<!doctype html><link rel="icon" href="data:,"><p>fixed synthetic qualification</p>').toString("base64") });
            return;
          }
          const path = event.request.url.startsWith(ORIGIN) ? event.request.url.slice(ORIGIN.length) : "";
          const allowed = ["/bootstrap?owned=probe", "/known?owned=probe", "/stage?owned=probe",
            "/response-exact?owned=probe", "/response-overflow?owned=probe", "/followup?owned=probe",
            "/response-calibrate?owned=probe", "/response-inclusive-one-over?owned=probe", "/response-body-at-cap?owned=probe",
            "/slow?owned=probe", "/second?owned=probe"].includes(path);
          const bypassScope = ["warm-unknown-bypass", "warm-marker-bypass"].includes(kind);
          const deny = row.stopped || (!allowed && !bypassScope) || !["GET", "POST"].includes(event.request.method)
            || !["XHR", "Fetch"].includes(event.resourceType)
            || (kind === "warm-enforced" && !bootstrapping);
          if (deny) {
            noteDenial(event.request.url, row.stopped ? "stopped" : !allowed ? "exact_scope_denied" : "enforced_denial");
            await cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" });
            return;
          }
          staging = staging.then(async () => {
            if (row.stopped) {
              noteDenial(event.request.url, "stopped");
              await cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" });
              return;
            }
            let body = Buffer.alloc(0);
            if (event.request.method === "POST") {
              const entries = event.request.postDataEntries;
              if (!Array.isArray(entries) || !entries.length || entries.some(entry => typeof entry.bytes !== "string")) {
                row.missing_request_original = true; cancel(); return;
              }
              const sizes = entries.map(entry => decodedBase64Length(entry.bytes));
              if (sizes.some(size => size === null) || sizes.reduce((sum, size) => sum + size, 0) > LIMITS.request_bytes) {
                row.request_body_overflow = true; cancel(); return;
              }
              body = Buffer.concat(entries.map(entry => Buffer.from(entry.bytes, "base64")));
            }
            const entry = { caseId: kind, networkId: event.networkId, requestId: event.requestId,
              url: event.request.url, headers: safeHeaders(event.request.headers), bodyBytes: body.length,
              body_base64: body.toString("base64"), bootstrap: bootstrapping,
              response_calibration: path === "/response-calibrate?owned=probe",
              bypass: bootstrapping || ["cold-connect-bypass", "cold-tls-record-fence", "warm-header-bypass"].includes(kind),
              forwarded_at_stage: row.transport_forwarded, arrivals_at_stage: row.arrivals.length };
            entry.bytes = headerBytes(entry.headers) + body.length;
            if (!recorder.reserve(entry.bytes + Buffer.byteLength(entry.url)) && kind !== "response-overflow-bypass") {
              noteDenial(entry.url, "stopped");
              await cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" });
              return;
            }
            row.staged.push(entry); byNetwork.set(event.networkId, entry);
            const staged = hold.stage(entry);
            if (!staged.accepted) { row.header_denial = staged.reason; cancel(); return; }
            row.waitingForConnect = row.transports.size === 0;
            row.transportHold = !entry.bypass;
            if (entry.bypass) { row.ticket = true; release(); }
            const final = new Promise(resolve => { pendingFinal = { resolve }; });
            await cdp.send("Fetch.continueRequest", { requestId: event.requestId });
            try { await deadline(final, 1000, "final_headers_deadline"); }
            catch {
              row.final_headers_deadline = true; pendingFinal = null; cancel();
            }
          });
          await staging;
        })()));
        await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
        await page.goto(FIXTURE, { waitUntil: "load", timeout: 3000 });
        const fetchPath = (path, padding, method = "GET", followup = false) => deadline(page.evaluate(
          async ({ path, padding, method, followup }) => {
            let result;
            try {
              const response = await fetch(path, { method,
                ...(padding === undefined ? {} : { headers: { "x-padding": "a".repeat(padding) } }),
                ...(method === "POST" ? { body: new Uint8Array([0, 255, 128, 65]) } : {}) });
              const bytes = new Uint8Array(await response.arrayBuffer());
              result = { ok: true, length: bytes.length, bytes: bytes.length <= 100 ? [...bytes] : null };
            } catch { result = { ok: false }; }
            if (followup) {
              try { const response = await fetch("/followup?owned=probe", { signal: AbortSignal.timeout(1000) });
                await response.arrayBuffer(); result.followup = true; } catch { result.followup = false; }
            }
            return result;
          }, { path, padding, method, followup }), 4000, "renderer_deadline");
        if (!kind.startsWith("cold-")) {
          bootstrapping = true;
          row.bootstrap = await fetchPath("/bootstrap?owned=probe");
          await wait(() => tasks.size === 0, "observer_deadline");
          bootstrapping = false;
          row.bootstrap_is_deliberately_unqualified_cold_start = true;
        }
        if (kind.startsWith("response-")) {
          row.response_header_calibration = await fetchPath("/response-calibrate?owned=probe");
          await wait(() => tasks.size === 0, "observer_deadline");
          await wait(() => recorder.snapshot().stopped
            || recorder.snapshot().responses.every(response => response.state === "complete"), "original_completion", 1500);
          const calibration = recorder.snapshot().responses.at(-1);
          if (recorder.snapshot().stopped || calibration.state !== "complete") throw new Error("response_header_calibration_failed");
          row.response_header_calibration_bytes = calibration.retained_header_bytes;
          // Derived fixture input from actual original header observations,
          // never guessed headroom, a native header override or response replay.
          row.exact_response_body_bytes = LIMITS.response_bytes - calibration.retained_header_bytes;
        }
        if (kind.startsWith("warm-header-") || kind.startsWith("warm-body-")) {
          const method = kind.startsWith("warm-body-") ? "POST" : "GET";
          row.calibration = await fetchPath("/stage?owned=probe", 0, method);
          await wait(() => tasks.size === 0, "observer_deadline");
          const calibration = row.staged.at(-1);
          const padding = kind.endsWith("exact") ? LIMITS.request_bytes - calibration.final.bytes
            : kind === "warm-body-overflow" ? LIMITS.request_bytes + 1 - calibration.final.bytes
              : LIMITS.request_bytes - calibration.bytes - 8;
          row.renderer = await fetchPath("/stage?owned=probe", padding, method);
        } else if (kind === "response-aggregate") {
          for (let i = 0; i < 4 && !row.stopped; i++) {
            row.renderer = await fetchPath("/response-exact?owned=probe");
            await wait(() => tasks.size === 0, "observer_deadline");
            await wait(() => recorder.snapshot().stopped
              || recorder.snapshot().responses.every(response => response.state === "complete"), "original_completion", 1500);
          }
          row.followup_renderer = await fetchPath("/followup?owned=probe");
        } else if (kind === "warm-concurrent") {
          row.renderer = await deadline(page.evaluate(async () => {
            const first = await fetch("/slow?owned=probe", { signal: AbortSignal.timeout(2000) });
            const second = await fetch("/second?owned=probe", { signal: AbortSignal.timeout(2000) });
            return { first: (await first.arrayBuffer()).byteLength, second: (await second.arrayBuffer()).byteLength };
          }), 3000, "renderer_deadline");
        } else {
          const path = kind.startsWith("warm-unknown") ? "/unknown?owned=probe"
            : kind.startsWith("warm-marker") ? "/known?owned=lost"
              : ["response-exact", "response-buffered-race", "response-missing-api", "response-missing-data",
                "response-truncated"].includes(kind) ? "/response-exact?owned=probe"
                : kind === "response-inclusive-one-over" ? "/response-inclusive-one-over?owned=probe"
                  : kind === "response-body-at-cap" ? "/response-body-at-cap?owned=probe"
                : kind.startsWith("response-overflow") ? "/response-overflow?owned=probe" : "/known?owned=probe";
          row.renderer = await fetchPath(path, undefined, kind === "warm-positive" ? "POST" : "GET",
            kind.startsWith("response-overflow") || ["response-inclusive-one-over", "response-body-at-cap"].includes(kind));
        }
        await wait(() => tasks.size === 0, "observer_deadline");
        await wait(() => recorder.snapshot().stopped
          || recorder.snapshot().responses.every(response => response.state === "complete"), "original_completion", 1500);
        if (row.tlsFence) row.tls_fence = row.tlsFence.snapshot();
        row.retention = recorder.snapshot();
        row.capture_availability = row.stopped || row.retention.stopped
          ? "inconclusive" : "completed_original_observations";
        for (const response of row.retention.responses) {
          const parts = recorder.parts(response.id);
          if (response.state !== "complete") continue;
          const originalHash = createHash("sha256");
          for (const part of parts) originalHash.update(part);
          const entry = byNetwork.get(response.id);
          const arrival = row.arrivals.find(hit => ORIGIN + hit.url === entry.url
            && hit.body_base64 === entry.body_base64);
          row.originals.push({ networkId: response.id, url: entry.url, bytes: response.retained_body_bytes,
            header_bytes: response.retained_header_bytes, response_bytes: response.retained_bytes,
            sha256: originalHash.digest("hex"), original_parts_base64: parts.map(part => part.toString("base64")),
            sink_sha256: arrival?.response_original_sha256 ?? null,
            sink_bytes: arrival?.response_original_bytes ?? null });
        }
        row.retained_originals_match_sink = row.originals.every(original =>
          original.sha256 === original.sink_sha256 && original.bytes === original.sink_bytes);
        const occurrences = new Map(), matched = [];
        row.final_headers_match_sink = row.arrivals.every(arrival => {
          const index = occurrences.get(arrival.url) ?? 0; occurrences.set(arrival.url, index + 1);
          const entry = row.staged.filter(entry => entry.url === ORIGIN + arrival.url)[index];
          matched.push([arrival, entry]);
          return !!entry?.final?.headers && canonicalHeaders(arrival.headers) === canonicalHeaders(entry.final.headers)
            && arrival.body_base64 === entry.body_base64
            && headerBytes(arrival.headers) + arrival.body_bytes === entry.final.bytes;
        });
        row.response_headers_match_sink = matched.every(([arrival, entry]) => {
          const extra = row.response_extra.find(extra => extra.networkId === entry?.networkId);
          const observed = Object.fromEntries(Object.entries(extra?.headers ?? {})
            .map(([name, value]) => [name.toLowerCase(), value]));
          return extra?.status === arrival.response_status && Object.entries(arrival.response_headers)
            .every(([name, value]) => observed[name] === (Array.isArray(value) ? value.join("\n") : value));
        });
        const cookies = await context.cookies(ORIGIN);
        row.cookie_effect_observed = [["first", "one"], ["second", "two"]]
          .every(([name, value]) => cookies.some(cookie => cookie.name === name && cookie.value === value));
        await deadline(context.close(), 2000, "context_close_deadline"); contexts.delete(context);
        context.off("page", unsupported); context.off("serviceworker", unsupported);
        for (const event of ["worker", "frameattached", "websocket"]) page.off(event, unsupported);
        row.guards_removed_after_context_close = true;
        delete row.connect_release; delete row.ticket; delete row.waitingForConnect;
        stopSockets();
        await wait(() => sockets.size === 0 && sessions.size === 0, "socket_cleanup");
        delete row.transports; delete row.transportHold; delete row.tlsFence;
      }
      upstreamPort = null; active = null; await closeServer(upstream);
    }
  } catch (caught) {
    errors.push(["cohort_mismatch", "renderer_deadline", "observer_deadline", "context_close_deadline", "original_completion",
      "socket_cleanup", "listen_deadline", "server_close_deadline"].includes(caught.message)
      ? caught.message : "qualification_failed");
  } finally {
    for (const context of contexts) {
      try { await deadline(context.close(), 2000, "context_close_deadline"); contexts.delete(context); }
      catch { errors.push("context_close_failed"); }
    }
    try { await deadline(browser?.close(), 3000, "browser_close_deadline"); } catch { errors.push("browser_close_failed"); kill(); }
    try { await deadline(browserServer?.close(), 3000, "browser_close_deadline"); } catch { errors.push("browser_close_failed"); kill(); }
    await deadline(Promise.allSettled([...tasks]), 2000, "observer_deadline").catch(() => errors.push("observer_deadline"));
    stopSockets();
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    await closeServer(upstream).catch(() => errors.push("sink_close_failed"));
    await closeServer(proxy).catch(() => errors.push("proxy_close_failed"));
    await wait(() => sockets.size === 0 && sessions.size === 0, "socket_cleanup")
      .catch(() => errors.push("socket_cleanup"));
    clearTimeout(watchdog);
  }
  const cold = protocols.map(protocol => {
    const wait = protocol.cases.find(row => row.kind === "cold-connect-wait");
    const bypass = protocol.cases.find(row => row.kind === "cold-connect-bypass");
    const tls = protocol.cases.find(row => row.kind === "cold-tls-record-fence");
    return { protocol: protocol.protocol,
      held_connect_no_final_headers_witnessed: wait?.connect_wait_expired === true
        && wait.upstream_sockets === 0 && wait.finals.length === 0 && wait.arrivals.length === 0
        && bypass?.arrivals.length === 1 && bypass.finals.length === 1,
      conservative_tls_alternative: tls?.tls_fence ?? null,
      cold_request_boundary_qualified: false };
  });
  const blockers = [...new Set([
    ...(cold.length === 2 && cold.every(row => row.held_connect_no_final_headers_witnessed)
      ? ["cold_final_extra_info_unavailable_without_upstream_tls"] : ["cold_connect_probe_incomplete"]),
    ...cold.flatMap(row => row.conservative_tls_alternative?.reason
      ? ["cold_" + row.conservative_tls_alternative.reason] : []),
  ])];
  return { kind: "fixed_first_party_follow_up", protocols, errors,
    cold_boundaries: cold, blockers, duration_ms: Math.ceil(performance.now() - started),
    unsupported_boundaries: ["cold_native_tls_handshake_application_separator",
      "opaque_tls13_encrypted_client_authentication", "unobserved_native_targets_and_transports",
      "non_base64_completed_body_fallback", "nonempty_redirect_originals"],
    bootstrap_warmups_are_deliberate_cold_boundary_bypasses: true,
    byte_accounting: { response_cap_includes: ["retained_response_headers", "retained_response_extra_headers", "decoded_body"],
      aggregate_cap_includes: ["retained_original_urls", "staged_request_headers", "original_request_bodies",
        "final_request_headers", "response_headers_and_bodies"],
      proxy_authorization_elided_before_retention: true },
    native_header_overrides: false, response_reconstruction: false, native_tls_exceptions: false,
    local_generated_spki_exception_only: true,
    native_execution_qualified: false, official_sdk_executions: 0, live_cases_spent: 0,
    cleanup: { contexts_closed: contexts.size === 0, sockets_closed: sockets.size === 0 && sessions.size === 0,
      observers_settled: tasks.size === 0, proxy_closed: !!proxy && !proxy.listening,
      sinks_closed: !!upstream && !upstream.listening, timers_cleared: timers.size === 0,
      deadline_met: !expired && performance.now() - started < LIMITS.duration_ms,
      browser_process_exited: !!browserServer && (browserServer.process().exitCode !== null
        || browserServer.process().signalCode !== null) } };
}

export function createPreconnectLatch() {
  let phase = "priming";
  const tunnels = new Set();
  return {
    register(id) {
      if (phase !== "priming" || typeof id !== "string" || !id || tunnels.has(id)) return false;
      tunnels.add(id); return true;
    },
    seal(evidence) {
      if (phase !== "priming") return false;
      phase = evidence?.httpRequests === 0 && evidence?.cookies === 0 ? "sealed" : "stopped";
      return phase === "sealed";
    },
    stop() { phase = "stopped"; },
    snapshot() { return { phase, primed_tunnel_ids: [...tunnels] }; },
  };
}

// A distinct, declared transport cohort. No HTTP warmup, SDK, native execution
// authority, cold fallback, TLS record guess or native security override exists.
export async function qualifyPreconnectedFirstParty(options) {
  const started = performance.now();
  if (!options || Object.getPrototypeOf(options) !== Object.prototype
    || Reflect.ownKeys(options).join() !== "outputDir" || typeof options.outputDir !== "string")
    throw new Error("invalid_preconnect_options");
  const dir = lstatSync(options.outputDir);
  if (!dir.isDirectory() || dir.isSymbolicLink() || (dir.mode & 0o7777) !== 0o700
    || dir.uid !== process.getuid()) throw new Error("unsafe_probe_directory");
  if (process.version !== "v24.10.0" || process.platform !== "darwin" || release() !== "27.0.0")
    throw new Error("cohort_mismatch");
  const key = privateRead(join(options.outputDir, "key.pem"));
  const cert = privateRead(join(options.outputDir, "certificate.pem"));
  const pin = createHash("sha256").update(new X509Certificate(cert).publicKey
    .export({ type: "spki", format: "der" })).digest("base64");
  const topOrigin = "https://owned-top.test.invalid", fixture = topOrigin + "/fixture";
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const { chromium } = await import("playwright");
  const sockets = new Set(), sessions = new Set(), contexts = new Set(), tasks = new Set();
  const rows = [], errors = [], tlsBrokerControls = [];
  const username = randomBytes(16).toString("hex"), password = randomBytes(24).toString("hex");
  const authorization = "Basic " + Buffer.from(username + ":" + password).toString("base64");
  let browser, browserServer, proxy, upstream, port, active, expired = false, tunnelSequence = 0, sessionSequence = 0;
  const own = socket => {
    sockets.add(socket); socket.on("error", () => {});
    socket.once("close", () => sockets.delete(socket)); return socket;
  };
  const stopSockets = () => {
    for (const session of sessions) session.destroy();
    for (const socket of sockets) socket.destroy();
  };
  const kill = () => {
    const child = browserServer?.process();
    if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  };
  const deadline = async (promise, ms, category) => {
    let timer;
    try {
      return await Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(category)), ms);
      })]);
    } finally { clearTimeout(timer); }
  };
  const wait = async (condition, category, ms = 2000) => {
    const until = performance.now() + ms;
    while (!condition()) {
      if (expired || performance.now() >= until) throw new Error(category);
      await sleep(5);
    }
  };
  const listen = server => deadline(new Promise((resolve, reject) => {
    server.once("error", reject); server.listen(0, "127.0.0.1", resolve);
  }), 2000, "listen_deadline");
  const closeServer = server => !server?.listening ? Promise.resolve()
    : deadline(new Promise(resolve => server.close(resolve)), 2000, "server_close_deadline");
  const watchdog = setTimeout(() => { expired = true; stopSockets(); kill(); },
    Math.max(1, LIMITS.duration_ms - (performance.now() - started)));
  try {
    proxy = httpServer((_req, res) => res.writeHead(403).end());
    proxy.on("connection", own);
    proxy.on("connect", (req, client, head) => {
      const current = active;
      const deny = code => client.end(`HTTP/1.1 ${code} Denied\r\n${code === 407
        ? 'Proxy-Authenticate: Basic realm="synthetic-preconnect"\r\n' : ""}`
        + "Content-Length: 0\r\nConnection: close\r\n\r\n");
      if (req.headers["proxy-authorization"] !== authorization) {
        if (current?.latch) {
          current.proxy_auth_challenges++;
          if (current.latch.snapshot().phase === "priming") current.proxy_auth_challenges_during_prime++;
        }
        return deny(407);
      }
      if (req.url !== AUTHORITY || head.length || !current?.latch || !port) return deny(403);
      const id = "t" + ++tunnelSequence;
      if (!current.latch.register(id)) { current.new_tunnels_denied_after_seal++; return deny(403); }
      const remote = own(connect({ host: "127.0.0.1", port }));
      const tunnel = { id, client, remote, held: [], heldBytes: 0 };
      current.transports.set(id, tunnel);
      current.primed_tunnels.push({ id });
      const forward = bytes => { current.outgoing_forwarded += bytes.length; remote.write(bytes); };
      remote.once("connect", () => {
        tunnel.port = remote.localPort;
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        client.on("data", bytes => {
          if (current.latch.snapshot().phase === "priming") { forward(bytes); return; }
          if (current.gateOpen && current.latch.snapshot().phase === "sealed") { forward(bytes); return; }
          if (tunnel.heldBytes + bytes.length > 2 * LIMITS.request_bytes) {
            current.transport_overflow = true; current.latch.stop(); client.destroy(); remote.destroy(); return;
          }
          tunnel.held.push(bytes); tunnel.heldBytes += bytes.length;
          current.opaque_held += bytes.length;
        });
        tunnel.release = () => {
          for (const bytes of tunnel.held) forward(bytes);
          tunnel.held = []; tunnel.heldBytes = 0;
        };
        remote.pipe(client);
      });
      remote.once("close", () => { current.transports.delete(id); client.destroy(); });
      client.once("close", () => remote.destroy());
    });
    await listen(proxy);
    browserServer = await chromium.launchServer({
      executablePath: launcher, host: "127.0.0.1", headless: true, timeout: 10000,
      proxy: { server: `http://127.0.0.1:${proxy.address().port}`, username, password },
      args: ["--disable-background-networking", "--dns-prefetch-disable",
        `--ignore-certificate-errors-spki-list=${pin}`],
    });
    browser = await chromium.connect(browserServer.wsEndpoint());
    if (browser.version() !== "155.0.8059.80") throw new Error("cohort_mismatch");
    for (const protocol of ["h1", "h2"]) {
      const sessionIds = new Map(), tlsIds = new Map();
      upstream = protocol === "h2" ? createSecureServer({ key, cert, allowHTTP1: false,
        settings: { maxHeaderListSize: 131072 } })
        : httpsServer({ key, cert, maxHeaderSize: 131072, ALPNProtocols: ["http/1.1"] });
      upstream.on("connection", own);
      const findTunnel = socket => [...(active?.transports.values() ?? [])].find(tunnel => tunnel.port === socket.remotePort);
      upstream.on("secureConnection", socket => {
        const tunnel = findTunnel(socket);
        if (!active || !tunnel) return;
        const id = "tls-" + tunnel.id; tlsIds.set(socket, id);
        active.handshakes.push({ id, tunnel_id: tunnel.id, phase: active.latch.snapshot().phase,
          protocol: socket.getProtocol(), alpn: socket.alpnProtocol });
      });
      upstream.on("session", session => {
        sessions.add(session); session.on("error", () => {});
        session.once("close", () => sessions.delete(session));
        const id = "h2-" + ++sessionSequence; sessionIds.set(session, id);
        const tunnel = findTunnel(session.socket);
        if (active && tunnel) active.h2_sessions.push({ id, tunnel_id: tunnel.id, phase: active.latch.snapshot().phase });
      });
      upstream.on("request", (req, res) => {
        const current = active;
        if (!current) return res.writeHead(403).end();
        const tunnel = findTunnel(req.socket);
        current.arrivals.push({ url: req.url, method: req.method, headers: safeHeaders(req.headers),
          phase: current.latch.snapshot().phase, tunnel_id: tunnel?.id ?? null,
          tls_id: tlsIds.get(req.socket) ?? null, h2_session_id: req.stream ? sessionIds.get(req.stream.session) : null });
        req.resume();
        if (current.latch.snapshot().phase === "priming") {
          current.priming_http_violation = true; current.latch.stop();
        }
        res.writeHead(200, { "content-type": "image/png", "content-length": String(image.length), "cache-control": "no-store" });
        res.end(image);
      });
      await listen(upstream); port = upstream.address().port;
      // Independent positive for the authenticated broker and TLS receiver.
      // This Node socket is closed before Chrome hints run and cannot prime
      // Chrome's pool. It writes ZERO collector HTTP application bytes.
      const control = { latch: createPreconnectLatch(), transports: new Map(), primed_tunnels: [],
        handshakes: [], h2_sessions: [], arrivals: [], outgoing_forwarded: 0, opaque_held: 0,
        proxy_auth_challenges: 0, proxy_auth_challenges_during_prime: 0, new_tunnels_denied_after_seal: 0 };
      active = control;
      const client = own(connect({ host: "127.0.0.1", port: proxy.address().port }));
      await deadline(new Promise((resolve, reject) => {
        let response = "";
        const data = bytes => {
          response += bytes.toString("ascii");
          if (response.length > 2048) { reject(new Error("tls_broker_control_failed")); return; }
          if (!response.includes("\r\n\r\n")) return;
          client.off("data", data);
          if (!response.startsWith("HTTP/1.1 200 ") || !response.endsWith("\r\n\r\n"))
            reject(new Error("tls_broker_control_failed"));
          else resolve();
        };
        client.once("error", () => reject(new Error("tls_broker_control_failed")));
        client.on("data", data);
        client.once("connect", () => client.write(`CONNECT ${AUTHORITY} HTTP/1.1\r\nHost: ${AUTHORITY}\r\n`
          + `Proxy-Authorization: ${authorization}\r\n\r\n`));
      }), 1500, "tls_broker_control_failed");
      const tls = own(tlsConnect({ socket: client, servername: "collector.test.invalid", ca: cert,
        ALPNProtocols: [protocol === "h2" ? "h2" : "http/1.1"] }));
      await deadline(new Promise((resolve, reject) => {
        tls.once("secureConnect", resolve);
        tls.once("error", () => reject(new Error("tls_broker_control_failed")));
      }), 1500, "tls_broker_control_failed");
      await wait(() => control.handshakes.length === 1, "tls_broker_control_failed");
      tlsBrokerControls.push({ protocol, runtime: "node_tls_only_not_browser", authenticated_tls: tls.authorized,
        tls_protocol: tls.getProtocol(), http_arrivals: control.arrivals.length,
        browser_connection_pool_primed: false, handshakes: control.handshakes });
      control.latch.stop(); active = null; tls.destroy(); stopSockets();
      await wait(() => sockets.size === 0 && sessions.size === 0, "socket_cleanup");
      for (const mode of ["unset", "use-credentials", "anonymous"]) {
        for (const kind of ["image-positive", "priming-http-denial"]) {
          const context = await browser.newContext({ serviceWorkers: "block" }); contexts.add(context);
          const page = await context.newPage(), cdp = await context.newCDPSession(page);
          const row = { protocol, mode, kind, settle_ms: 400, primed_tunnels: [], handshakes: [], h2_sessions: [],
            arrivals: [], staged: [], finals: [], denials: [], proxy_auth_challenges: 0,
            proxy_auth_challenges_during_prime: 0, proxy_auth_callbacks_during_prime: 0,
            new_tunnels_denied_after_seal: 0, outgoing_forwarded: 0, opaque_held: 0,
            gateOpen: false, transports: new Map(), latch: createPreconnectLatch() };
          rows.push(row); active = row;
          const headerHold = createFinalHeaderHold();
          let pendingFinal = null;
          const task = promise => {
            tasks.add(promise);
            promise.catch(() => { row.observer_failed = true; row.latch.stop(); })
              .finally(() => tasks.delete(promise));
          };
          const unsupported = () => { row.unsupported_surface = true; row.latch.stop(); stopSockets(); };
          context.on("page", unsupported); context.on("serviceworker", unsupported);
          for (const event of ["worker", "frameattached", "websocket"]) page.on(event, unsupported);
          await cdp.send("Network.enable");
          cdp.on("Fetch.authRequired", event => task((async () => {
            const duringPrime = row.latch.snapshot().phase === "priming";
            if (duringPrime) row.proxy_auth_callbacks_during_prime++;
            const expectedProxy = `http://127.0.0.1:${proxy.address().port}`;
            const allowed = duringPrime && event.authChallenge.source === "Proxy"
              && event.authChallenge.origin === expectedProxy;
            await cdp.send("Fetch.continueWithAuth", { requestId: event.requestId, authChallengeResponse: allowed
              ? { response: "ProvideCredentials", username, password } : { response: "CancelAuth" } });
          })()));
          cdp.on("Network.requestWillBeSentExtraInfo", event => {
            const entry = row.staged.find(entry => entry.networkId === event.requestId);
            if (!entry) return;
            const headers = safeHeaders(event.headers);
            const final = headerHold.final({ caseId: protocol + ":" + mode + ":" + kind,
              networkId: event.requestId, headers });
            entry.final = { ...final, headers, forwarded_since_stage: row.outgoing_forwarded - entry.forwarded_at_stage,
              arrivals_at_validation: row.arrivals.length };
            row.finals.push(entry.final);
            if (final.accepted && row.latch.snapshot().phase === "sealed") {
              row.gateOpen = true;
              for (const tunnel of row.transports.values()) tunnel.release?.();
            } else { row.latch.stop(); stopSockets(); }
            pendingFinal?.(); pendingFinal = null;
          });
          cdp.on("Fetch.requestPaused", event => task((async () => {
            if (event.request.url === fixture && event.resourceType === "Document") {
              await cdp.send("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: 200,
                responseHeaders: [{ name: "Content-Type", value: "text/html" },
                  { name: "Content-Security-Policy", value: `default-src 'none'; img-src ${ORIGIN} data:; connect-src ${ORIGIN}; frame-src 'none'; worker-src 'none'` }],
                body: Buffer.from('<!doctype html><link rel="icon" href="data:,"><p>trusted first-party TLS-only setup</p>').toString("base64") });
              return;
            }
            if (row.latch.snapshot().phase !== "sealed" || event.request.url !== ORIGIN + "/measurement?owned=preconnect"
              || event.request.method !== "GET" || event.resourceType !== "Image") {
              row.denials.push({ phase: row.latch.snapshot().phase, reason: row.latch.snapshot().phase === "priming"
                ? "http_during_priming" : "exact_scope_denied" });
              await cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" }); return;
            }
            row.gateOpen = false;
            const entry = { caseId: protocol + ":" + mode + ":" + kind, networkId: event.networkId, requestId: event.requestId,
              headers: safeHeaders(event.request.headers), bodyBytes: 0, forwarded_at_stage: row.outgoing_forwarded };
            row.staged.push(entry);
            const staged = headerHold.stage(entry);
            if (!staged.accepted) { row.latch.stop(); stopSockets(); return; }
            const final = new Promise(resolve => { pendingFinal = resolve; });
            await cdp.send("Fetch.continueRequest", { requestId: event.requestId });
            try { await deadline(final, 1000, "preconnected_final_headers_deadline"); }
            catch { row.final_headers_unavailable = true; row.latch.stop(); stopSockets(); }
          })()));
          await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }], handleAuthRequests: true });
          await page.goto(fixture, { waitUntil: "load", timeout: 3000 });
          await page.evaluate(({ origin, mode }) => {
            const hint = document.createElement("link"); hint.rel = "preconnect"; hint.href = origin;
            if (mode !== "unset") hint.crossOrigin = mode;
            document.head.append(hint);
          }, { origin: ORIGIN, mode });
          if (kind === "priming-http-denial") row.priming_attempt = await deadline(page.evaluate(origin => new Promise(resolve => {
            const request = new Image(); request.onload = () => resolve(true); request.onerror = () => resolve(false);
            request.src = origin + "/forbidden-during-prime?owned=preconnect";
          }), ORIGIN), 2000, "priming_http_deadline");
          await sleep(row.settle_ms);
          await wait(() => tasks.size === 0, "observer_deadline");
          try {
            const certificate = await deadline(cdp.send("Network.getCertificate", { origin: ORIGIN }), 500, "certificate_deadline");
            row.certificate_chain_entries = certificate.tableNames?.length ?? 0;
          } catch { row.certificate_probe_unavailable = true; }
          row.before_seal = { http_arrivals: row.arrivals.length, cookies: (await context.cookies()).length,
            handshakes: row.handshakes.map(handshake => handshake.id), h2_sessions: row.h2_sessions.map(session => session.id),
            tunnel_ids: row.primed_tunnels.map(tunnel => tunnel.id),
            proxy_auth_challenges: row.proxy_auth_challenges_during_prime,
            proxy_auth_callbacks: row.proxy_auth_callbacks_during_prime };
          row.gateOpen = false;
          row.sealed = row.latch.seal({ httpRequests: row.before_seal.http_arrivals, cookies: row.before_seal.cookies });
          row.first_measurement = await deadline(page.evaluate(origin => new Promise(resolve => {
            const request = new Image(); request.onload = () => resolve({ loaded: true }); request.onerror = () => resolve({ loaded: false });
            request.src = origin + "/measurement?owned=preconnect";
          }), ORIGIN), 3000, "measurement_deadline");
          await wait(() => tasks.size === 0, "observer_deadline");
          row.same_primed_tunnel_reused = row.arrivals.length === 1
            && row.before_seal.tunnel_ids.includes(row.arrivals[0].tunnel_id);
          row.same_primed_h2_session_reused = protocol !== "h2" ? null : row.arrivals.length === 1
            && row.before_seal.h2_sessions.includes(row.arrivals[0].h2_session_id);
          row.tls_only_reuse_witnessed = row.sealed && row.before_seal.http_arrivals === 0 && row.before_seal.cookies === 0
            && row.same_primed_tunnel_reused && (protocol !== "h2" || row.same_primed_h2_session_reused)
            && row.first_measurement.loaded && row.finals.length === 1 && row.finals[0].accepted
            && row.finals[0].forwarded_since_stage === 0 && row.finals[0].arrivals_at_validation === 0;
          row.phase_final = row.latch.snapshot().phase;
          row.latch.stop();
          await deadline(context.close(), 2000, "context_close_deadline"); contexts.delete(context);
          active = null;
          context.off("page", unsupported); context.off("serviceworker", unsupported);
          for (const event of ["worker", "frameattached", "websocket"]) page.off(event, unsupported);
          row.guards_removed_after_context_close = true;
          stopSockets(); await wait(() => sockets.size === 0 && sessions.size === 0, "socket_cleanup");
        }
      }
      active = null; port = null; await closeServer(upstream);
    }
  } catch (caught) {
    errors.push(["cohort_mismatch", "listen_deadline", "server_close_deadline", "observer_deadline",
      "priming_http_deadline", "measurement_deadline", "context_close_deadline", "socket_cleanup", "tls_broker_control_failed"]
      .includes(caught.message) ? caught.message : "preconnect_qualification_failed");
  } finally {
    for (const context of contexts) {
      try { await deadline(context.close(), 2000, "context_close_deadline"); contexts.delete(context); }
      catch { errors.push("context_close_failed"); }
    }
    try { await deadline(browser?.close(), 3000, "browser_close_deadline"); } catch { errors.push("browser_close_failed"); kill(); }
    try { await deadline(browserServer?.close(), 3000, "browser_close_deadline"); } catch { errors.push("browser_close_failed"); kill(); }
    await deadline(Promise.allSettled([...tasks]), 2000, "observer_deadline").catch(() => errors.push("observer_deadline"));
    stopSockets();
    await closeServer(upstream).catch(() => errors.push("sink_close_failed"));
    await closeServer(proxy).catch(() => errors.push("proxy_close_failed"));
    await wait(() => sockets.size === 0 && sessions.size === 0, "socket_cleanup").catch(() => errors.push("socket_cleanup"));
    clearTimeout(watchdog);
  }
  for (const row of rows) { delete row.transports; delete row.latch; delete row.gateOpen; }
  const authBoundary = rows.length === 12 && rows.every(row => row.before_seal?.proxy_auth_challenges > 0
    && row.before_seal.proxy_auth_callbacks === 0 && row.before_seal.tunnel_ids.length === 0
    && row.before_seal.handshakes.length === 0 && row.arrivals.length === 0);
  return { kind: "declared_preconnected_first_party_cohort", top_origin: topOrigin, collector_origin: ORIGIN,
    rows, errors, tls_broker_controls: tlsBrokerControls,
    blockers: authBoundary ? ["preconnect_proxy_auth_challenge_without_callback"]
      : ["preconnect_reuse_and_matched_limit_controls_unqualified"],
    preconnected_cohort_qualified: false,
    matched_limit_control_status: "not_qualified_without_authenticated_browser_preconnect_positive",
    settle_interval_is_not_readiness_proof: true, http_warmups: 0, cookie_or_identity_seeds: 0,
    general_cold_qualified: false, default_native_qualified: false, native_execution_qualified: false,
    official_sdk_executions: 0, live_cases_reserved: 0, live_cases_spent: 0,
    local_generated_spki_exception_only: true, native_header_overrides: false, response_reconstruction: false,
    duration_ms: Math.ceil(performance.now() - started),
    cleanup: { contexts_closed: contexts.size === 0, sockets_closed: sockets.size === 0 && sessions.size === 0,
      observers_settled: tasks.size === 0, proxy_closed: !!proxy && !proxy.listening, sinks_closed: !!upstream && !upstream.listening,
      deadline_met: !expired && performance.now() - started < LIMITS.duration_ms,
      browser_process_exited: !!browserServer && (browserServer.process().exitCode !== null || browserServer.process().signalCode !== null) } };
}
