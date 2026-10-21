import hpack from "hpack.js";
import { gzipSync, deflateSync, brotliCompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const load = () => import("./inspected-http-wire.mjs");
const origin = "https://collector.test.invalid";
const target = n => "/pixel?id=999999999999999&ev=PageView&dl=https%3A%2F%2Fowned.example%2Finspection&item=%2f&item=%2F&r=" + n;
const preface = Buffer.from("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");
function frame(type, flags, stream, body = Buffer.alloc(0)) {
  const header = Buffer.alloc(9);
  header.writeUIntBE(body.length, 0, 3); header[3] = type; header[4] = flags; header.writeUInt32BE(stream, 5);
  return Buffer.concat([header, body]);
}
const encoder = () => {
  const compressor = hpack.compressor.create({ table: { maxSize: 4096 } });
  return pairs => {
    compressor.write(pairs.map(([name, value]) => ({ name, value })));
    const parts = [];
    for (let part; (part = compressor.read()) !== null;) parts.push(part);
    return Buffer.concat(parts);
  };
};
const update = size => {
  const encoder = hpack.encoder.create(); encoder.encodeBits(1, 3); encoder.encodeInt(size);
  return Buffer.concat(encoder.render());
};
const pairs = n => [[":method", "GET"], [":scheme", "https"], [":authority", "collector.test.invalid"], [":path", target(n)]];
const h1 = (n, extra = "") => Buffer.from(`GET ${target(n)} HTTP/1.1\r\nHost: collector.test.invalid\r\n${extra}\r\n`);

describe("fixed synthetic inspected HTTP observations", () => {
  it("validates final physical H1 fields before forwarding and preserves ordered duplicate originals", async () => {
    const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h1");
    const bytes = h1(0, "X-Example: one\r\nX-Example: two\r\n");
    expect(connection.request(bytes.subarray(0, -1))).toEqual(Buffer.alloc(0));
    expect(connection.request(bytes.subarray(-1))).toEqual(bytes);
    expect(wire.snapshot()).toMatchObject({ stopped: false, observed: 1, forwarded: 1 });
    expect(wire.originals().requests[0]).toMatchObject({ ordinal: 1, url: origin + target(0),
      method: "GET", headers: [["Host", "collector.test.invalid"], ["X-Example", "one"], ["X-Example", "two"]] });
  });

  it.each(["marker", "path", "method", "authority", "query"])("blocks final %s mismatch on a reused H1 connection", async kind => {
    const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h1");
    expect(connection.request(h1(0))).toEqual(h1(0));
    const bad = {
      marker: h1(1).toString().replace("999999999999999", "999999999999998"),
      path: h1(1).toString().replace("/pixel?", "/unknown?"),
      method: h1(1).toString().replace("GET ", "POST "),
      authority: h1(1).toString().replace("Host: collector.test.invalid", "Host: unknown.test.invalid"),
      query: h1(1).toString().replace("ev=PageView", "ev=PageView&ev=PageView"),
    }[kind];
    expect(connection.request(Buffer.from(bad))).toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ stopped: true, observed: 2, forwarded: 1 });
  });

  it("decodes fragmented H2 continuations with one persistent decoder per connection and direction", async () => {
    const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h2"), encode = encoder();
    expect(connection.request(preface)).toEqual(preface);
    for (const [n, stream] of [[0, 1], [1, 3]]) {
      const block = encode([...pairs(n), ["x-duplicate", "one"], ["x-duplicate", "two"]]);
      const first = frame(1, 1, stream, block.subarray(0, 3)), last = frame(9, 4, stream, block.subarray(3));
      expect(connection.request(first)).toEqual(Buffer.alloc(0));
      expect(connection.request(last)).toEqual(Buffer.concat([first, last]));
    }
    expect(wire.originals().requests.map(row => row.stream)).toEqual([1, 3]);
    expect(wire.originals().requests[1].headers.slice(-2)).toEqual([["x-duplicate", "one"], ["x-duplicate", "two"]]);
    expect(wire.snapshot()).toMatchObject({ stopped: false, observed: 2, forwarded: 2 });
  });

  it.each(["length", "chunked", "close"])("observes original H1 %s framing, binary bodies and duplicate Set-Cookie", async mode => {
    const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h1");
    connection.request(h1(0));
    const body = Buffer.from([0, 255, 128, 13, 10]);
    const head = Buffer.from("HTTP/1.1 201 Created\r\nSet-Cookie: a=1\r\nSet-Cookie: b=2\r\n"
      + (mode === "length" ? "Content-Length: 5\r\n" : mode === "chunked" ? "Transfer-Encoding: chunked\r\n" : "Connection: close\r\n") + "\r\n");
    const bytes = Buffer.concat([head, mode === "chunked" ? Buffer.concat([Buffer.from("5\r\n"), body, Buffer.from("\r\n0\r\n\r\n")]) : body]);
    const forwarded = [];
    for (let n = 0; n < bytes.length; n++) forwarded.push(await connection.response(bytes.subarray(n, n + 1)));
    await connection.endResponse();
    expect(Buffer.concat(forwarded)).toEqual(bytes);
    const row = wire.originals().responses[0];
    expect(row).toMatchObject({ status: 201, state: "complete", ordinal: 1, decoded_body_bytes: 5 });
    expect(row.headers.slice(0, 2)).toEqual([["Set-Cookie", "a=1"], ["Set-Cookie", "b=2"]]);
    expect(Buffer.concat(row.body)).toEqual(body);
    expect(wire.snapshot().stopped).toBe(false);
  });

  it("discards incomplete response originals and stops admissions on truncated Content-Length", async () => {
    const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h1");
    connection.request(h1(0));
    await connection.response(Buffer.from("HTTP/1.1 200 OK\r\nContent-Length: 6\r\n\r\nabc"));
    await connection.endResponse();
    expect(wire.snapshot()).toMatchObject({ stopped: true, reason: "truncated_response" });
    expect(wire.originals().responses[0]).toMatchObject({ state: "inconclusive", body: [], headers: [] });
    expect(connection.request(h1(1))).toEqual(Buffer.alloc(0));
  });

  it.each([["gzip", gzipSync], ["deflate", deflateSync], ["br", brotliCompressSync]])(
    "bounds streaming %s decoded bodies plus original headers at exactly 2 MiB", async (coding, compress) => {
      for (const extra of [0, 1]) {
        const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h1");
        connection.request(h1(0));
        const headers = [["Content-Encoding", coding], ["Connection", "close"]];
        const body = Buffer.alloc(2097152 - Buffer.byteLength(JSON.stringify(headers)) + extra, 65);
        const head = Buffer.from(`HTTP/1.1 200 OK\r\nContent-Encoding: ${coding}\r\nConnection: close\r\n\r\n`);
        const bytes = Buffer.concat([head, compress(body)]);
        await connection.response(bytes);
        await connection.endResponse();
        expect(wire.snapshot()).toMatchObject({ stopped: Boolean(extra), reason: extra ? "response_overflow" : null });
        const row = wire.originals().responses[0];
        expect(row.state).toBe(extra ? "inconclusive" : "complete");
        expect(row.decoded_body_bytes + row.header_bytes).toBe(extra ? 0 : 2097152);
        if (!extra) expect(Buffer.concat(row.body)).toEqual(body);
      }
    });

  it("uses independent directional HPACK contexts and retains H2 binary DATA and end-stream status", async () => {
    const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h2");
    connection.request(Buffer.concat([preface, frame(1, 5, 1, encoder()(pairs(0)))]));
    const responsePairs = [[":status", "200"], ["set-cookie", "a=1"], ["set-cookie", "b=2"], ["content-length", "4"]];
    const raw = Buffer.concat([frame(1, 4, 1, encoder()(responsePairs)), frame(0, 1, 1, Buffer.from([0, 255, 128, 65]))]);
    expect(await connection.response(raw)).toEqual(raw);
    await connection.endResponse();
    expect(wire.originals().responses[0]).toMatchObject({ stream: 1, status: 200, state: "complete", headers: responsePairs });
    expect(Buffer.concat(wire.originals().responses[0].body)).toEqual(Buffer.from([0, 255, 128, 65]));
    expect(wire.snapshot().stopped).toBe(false);
  });

  it("binds HEADER_TABLE_SIZE to the actual opposite SETTINGS acknowledgement, not receipt", async () => {
    const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h2"), encode = encoder();
    const setting = Buffer.from([0, 1, 0, 0, 0, 0]);
    connection.request(preface);
    await connection.response(frame(4, 0, 0, setting)); // Server constrains request encoder after its ACK.
    expect(connection.request(frame(1, 5, 1, encode(pairs(0))))).not.toEqual(Buffer.alloc(0));
    expect(connection.request(frame(4, 1, 0))).toEqual(frame(4, 1, 0));
    // A reduction must appear at the next encoded header boundary.
    expect(connection.request(frame(1, 5, 3, encode(pairs(1))))).toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ stopped: true, reason: "hpack_table_size_update_required", forwarded: 1 });
  });

  it.each([
    ["informational", "HTTP/1.1 103 Early Hints\r\nLink: </x>\r\n\r\n"],
    ["trailers", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n0\r\nX-Trailer: nope\r\n\r\n"],
    ["coding", "HTTP/1.1 200 OK\r\nContent-Encoding: unknown\r\nContent-Length: 0\r\n\r\n"],
    ["ambiguity", "HTTP/1.1 200 OK\r\nContent-Length: 0\r\nTransfer-Encoding: chunked\r\n\r\n"],
  ])("visibly stops unsupported %s rather than accepting empty originals", async (_kind, text) => {
    const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h1");
    connection.request(h1(0)); await connection.response(Buffer.from(text));
    expect(wire.snapshot().stopped).toBe(true);
    expect(wire.originals().responses.every(row => row.state !== "complete")).toBe(true);
  });

  it("records redirects only from completed original responses and the exact next wire URL", async () => {
    const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h1");
    connection.request(h1(0));
    await connection.response(Buffer.from(`HTTP/1.1 302 Found\r\nLocation: ${origin + target(1)}\r\nContent-Length: 3\r\n\r\nold`));
    expect(connection.request(h1(1))).toEqual(h1(1));
    expect(wire.originals().requests[1].redirect_from).toBe(1);
    expect(wire.originals().responses[0].redirect_url).toBe(origin + target(1));
    expect(Buffer.concat(wire.originals().responses[0].body)).toEqual(Buffer.from("old"));
  });

  it("accepts exact final H1 semantic header and URL ceilings, separately from raw framing overhead", async () => {
    for (const extra of [0, 1]) {
      const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h1");
      const size = Buffer.byteLength(JSON.stringify([["Host", "collector.test.invalid"], ["X-Pad", ""]]));
      const bytes = h1(0, "X-Pad: " + "a".repeat(65536 - size + extra) + "\r\n");
      expect(connection.request(bytes).length).toBe(extra ? 0 : bytes.length);
      expect(wire.snapshot()).toMatchObject({ stopped: Boolean(extra), reason: extra ? "semantic_header_limit" : null });
    }
    for (const extra of [0, 1]) {
      const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h1");
      const url = origin + target(0) + "&p=";
      const raw = h1(0).toString().replace(target(0), target(0) + "&p=" + "a".repeat(2048 - url.length + extra));
      expect(connection.request(Buffer.from(raw)).length > 0).toBe(!extra);
      expect(wire.snapshot()).toMatchObject({ reason: extra ? "url_limit" : null });
    }
  });

  it("accounts every retained raw-wire copy with observations and stops exactly at 8 MiB", async () => {
    const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h1");
    connection.request(h1(0));
    const remaining = 8388608 - wire.snapshot().retained_bytes;
    expect(wire.retain(Buffer.alloc(remaining))).toHaveLength(remaining);
    expect(wire.snapshot()).toMatchObject({ stopped: false, retained_bytes: 8388608, peak_retained_bytes: 8388608 });
    expect(wire.retain(Buffer.from("x"))).toBe(null);
    expect(wire.snapshot()).toMatchObject({ stopped: true, reason: "aggregate_overflow", retained_bytes: 8388608 });
    expect(connection.request(h1(1))).toEqual(Buffer.alloc(0));
  });

  it("applies table-size increases only after their FIFO ACK and honors an acknowledged reduction followed by increase", async () => {
    const setting = size => { const bytes = Buffer.alloc(6); bytes.writeUInt16BE(1); bytes.writeUInt32BE(size, 2); return frame(4, 0, 0, bytes); };
    for (const acknowledged of [false, true]) {
      const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h2");
      connection.request(preface);
      await connection.response(setting(8192));
      if (acknowledged) connection.request(frame(4, 1, 0));
      const request = frame(1, 5, 1, Buffer.concat([update(8192), encoder()(pairs(0))]));
      expect(connection.request(request).length > 0).toBe(acknowledged);
      expect(wire.snapshot().reason).toBe(acknowledged ? null : "hpack_table_size_exceeded");
    }
    const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h2");
    connection.request(preface);
    await connection.response(Buffer.concat([setting(0), setting(4096)]));
    connection.request(Buffer.concat([frame(4, 1, 0), frame(4, 1, 0)]));
    const bytes = frame(1, 5, 1, Buffer.concat([update(0), update(4096), encoder()(pairs(0))]));
    expect(connection.request(bytes)).toEqual(bytes);
    expect(wire.snapshot().stopped).toBe(false);
  });

  it("binds the response table to client SETTINGS and never borrows the request decoder's dynamic table", async () => {
    const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h2");
    connection.request(Buffer.concat([preface, frame(4, 0, 0, Buffer.from([0, 1, 0, 0, 0, 0])),
      frame(1, 5, 1, encoder()(pairs(0)))]));
    await connection.response(frame(4, 1, 0));
    await connection.response(frame(1, 5, 1, encoder()([[":status", "200"]])));
    expect(wire.snapshot()).toMatchObject({ stopped: true, reason: "hpack_table_size_update_required" });
    const other = (await load()).createInspectedHttpWire(), conn = other.connection("h2");
    conn.request(Buffer.concat([preface, frame(1, 5, 1, encoder()([...pairs(0), ["x-state", "request-only"]]))]));
    await conn.response(frame(1, 5, 1, Buffer.from([0x88, 0xbe])));
    expect(other.snapshot()).toMatchObject({ stopped: true, reason: "malformed_hpack_block" });
  });

  it("holds full H2 continuation originals at the final semantic cap and stops Huffman expansion during decode", async () => {
    for (const extra of [0, 1]) {
      const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h2");
      const empty = [...pairs(0), ["x-padding", ""]], size = Buffer.byteLength(JSON.stringify(empty));
      empty.at(-1)[1] = "a".repeat(65536 - size + extra);
      const block = encoder()(empty), frames = [];
      for (let n = 0; n < block.length; n += 16000)
        frames.push(frame(n ? 9 : 1, (n ? 0 : 1) | (n + 16000 >= block.length ? 4 : 0), 1, block.subarray(n, n + 16000)));
      const bytes = Buffer.concat(frames);
      connection.request(preface);
      expect(connection.request(bytes)).toEqual(extra ? Buffer.alloc(0) : bytes);
      expect(wire.snapshot()).toMatchObject({ stopped: Boolean(extra), forwarded: extra ? 0 : 1,
        reason: extra ? "semantic_header_limit" : null });
    }
  });

  it("rejects unknown HEADERS flags and oversized individual H2 frames before forwarding them", async () => {
    for (const bytes of [
      frame(1, 7, 1, encoder()(pairs(0))),
      frame(1, 5, 1, Buffer.alloc(16385, 0x82)),
    ]) {
      const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h2");
      connection.request(preface);
      expect(connection.request(bytes)).toEqual(Buffer.alloc(0));
      expect(wire.snapshot().stopped).toBe(true);
    }
  });

  it("does not admit a redirect target while its original parent body is incomplete", async () => {
    const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h1");
    connection.request(h1(0));
    await connection.response(Buffer.from(`HTTP/1.1 302 Found\r\nLocation: ${origin + target(1)}\r\nContent-Length: 4\r\n\r\nabc`));
    expect(connection.request(h1(1))).toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ stopped: true, reason: "uncompleted_redirect_parent", forwarded: 1 });
    expect(wire.originals().responses[0]).toMatchObject({ state: "inconclusive", body: [], headers: [] });
  });

  it.each([
    ["push", frame(5, 4, 1, Buffer.from([0, 0, 0, 2]))],
    ["incomplete continuation", frame(1, 0, 1, Buffer.from([0x88]))],
    ["truncated DATA", Buffer.concat([frame(1, 4, 1, encoder()([[":status", "200"], ["content-length", "2"]])),
      frame(0, 1, 1, Buffer.from("a"))])],
    ["DATA without response", frame(0, 1, 1, Buffer.from("x"))],
    ["bad padding", frame(1, 13, 1, Buffer.from([5, 0x88]))],
  ])("stops %s without manufacturing a complete H2 original", async (_label, response) => {
    const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h2");
    connection.request(Buffer.concat([preface, frame(1, 5, 1, encoder()(pairs(0)))]));
    await connection.response(response); await connection.endResponse();
    expect(wire.snapshot().stopped).toBe(true);
    expect(wire.originals().responses.every(row => row.state !== "complete")).toBe(true);
  });

  it.each([["gzip", gzipSync], ["deflate", deflateSync], ["br", brotliCompressSync]])(
    "drops malformed and truncated %s streams, never accepting a decoded prefix", async (coding, compress) => {
      for (const body of [Buffer.from("not-a-compressed-stream"), compress(Buffer.from("original")).subarray(0, -1)]) {
        const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h1");
        connection.request(h1(0));
        await connection.response(Buffer.concat([Buffer.from(`HTTP/1.1 200 OK\r\nContent-Encoding: ${coding}\r\nContent-Length: ${body.length}\r\n\r\n`), body]));
        await connection.endResponse();
        expect(wire.snapshot()).toMatchObject({ stopped: true, reason: "malformed_compressed_response" });
        expect(wire.originals().responses[0]).toMatchObject({ state: "inconclusive", body: [], headers: [] });
      }
    });

  it.each(["Upgrade: websocket\r\nConnection: Upgrade\r\n", "Expect: 100-continue\r\n", "Trailer: unsupported\r\n"])(
    "stops unsupported request surfaces before any header forwarding", async extra => {
      const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h1");
      expect(connection.request(h1(0, extra))).toEqual(Buffer.alloc(0));
      expect(wire.snapshot().stopped).toBe(true);
    });

  it("does not ASCII-fold malformed chunk framing and marks every missing response inconclusive", async () => {
    const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h1");
    connection.request(h1(0));
    const bytes = Buffer.concat([Buffer.from("HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n"),
      Buffer.from([0xb1]), Buffer.from("\r\nx\r\n0\r\n\r\n")]);
    await connection.response(bytes);
    expect(wire.snapshot().stopped).toBe(true);
    expect(wire.originals().requests[0].response_state).toBe("inconclusive");
    const other = (await load()).createInspectedHttpWire(), conn = other.connection("h1");
    conn.request(h1(0)); other.stop("diagnostic_deadline");
    expect(other.originals().requests[0].response_state).toBe("inconclusive");
  });

  it.each([200, 302])("never completes a close-delimited %s prefix on an upstream reset or grants its redirect", async status => {
    const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h1");
    connection.request(h1(0));
    const location = status === 302 ? `Location: ${origin + target(1)}\r\n` : "";
    await connection.response(Buffer.from(`HTTP/1.1 ${status} Response\r\nConnection: close\r\n${location}\r\nprefix`));
    await connection.endResponse("upstream_connection_reset");
    expect(wire.snapshot()).toMatchObject({ stopped: true, reason: "upstream_connection_reset", forwarded: 1 });
    expect(wire.originals().responses[0]).toMatchObject({
      state: "inconclusive", body: [], headers: [], transport_error: "upstream_connection_reset",
    });
    expect(wire.connection("h1").request(h1(1))).toEqual(Buffer.alloc(0));
    expect(wire.originals().requests[0].response_state).toBe("inconclusive");
  });

  it("retains a clean close-delimited redirect only after clean EOF, not a bare socket close", async () => {
    for (const termination of ["clean_eof", "upstream_unexpected_close"]) {
      const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h1");
      connection.request(h1(0));
      await connection.response(Buffer.from(`HTTP/1.1 302 Response\r\nConnection: close\r\nLocation: ${origin + target(1)}\r\n\r\noriginal`));
      await connection.endResponse(termination);
      expect(wire.originals().responses[0].state).toBe(termination === "clean_eof" ? "complete" : "inconclusive");
      expect(connection.request(h1(1))).toEqual(termination === "clean_eof" ? h1(1) : Buffer.alloc(0));
      if (termination === "clean_eof") expect(wire.originals().requests[1].redirect_from).toBe(1);
    }
  });

  it("keeps completed H2 originals but discards a different stream's prefix on transport error", async () => {
    const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h2"), requestEncoder = encoder(), responseEncoder = encoder();
    connection.request(Buffer.concat([preface, frame(1, 5, 1, requestEncoder(pairs(0))), frame(1, 5, 3, requestEncoder(pairs(1)))]));
    await connection.response(Buffer.concat([frame(1, 4, 1, responseEncoder([[":status", "200"]])),
      frame(0, 1, 1, Buffer.from("complete")), frame(1, 4, 3, responseEncoder([[":status", "200"]])),
      frame(0, 0, 3, Buffer.from("prefix"))]));
    await connection.endResponse("upstream_transport_error");
    expect(wire.originals().responses[0].state).toBe("complete");
    expect(Buffer.concat(wire.originals().responses[0].body)).toEqual(Buffer.from("complete"));
    expect(wire.originals().responses[1]).toMatchObject({ state: "inconclusive", body: [], transport_error: "upstream_transport_error" });
    expect(wire.snapshot()).toMatchObject({ stopped: true, reason: "upstream_transport_error" });
  });

  it("records a no-response transport abort without fabricating a body or suppressing a separately checked retry", async () => {
    const wire = (await load()).createInspectedHttpWire(), connection = wire.connection("h1");
    connection.request(h1(0)); await connection.endResponse("upstream_connection_reset");
    expect(wire.originals().responses[0]).toMatchObject({ state: "transport-aborted", status: null, body: [],
      transport_error: "upstream_connection_reset" });
    expect(wire.connection("h1").request(h1(0))).toEqual(h1(0));
    expect(wire.snapshot()).toMatchObject({ observed: 2, forwarded: 2, stopped: false });
  });
});
