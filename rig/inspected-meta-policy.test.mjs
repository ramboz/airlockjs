import hpack from "hpack.js";
import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { createInspectedHttpWire } from "./inspected-http-wire.mjs";

// Declared metadata only: no vendor source bytes or actual owned selectors.
const documentUrl = "https://owned.example/declared-meta";
const metaUrl = "https://www.facebook.com/tr/?id=999999999999999&ev=PageView&dl="
  + encodeURIComponent(documentUrl);
const profile = () => ({
  schema_version: 1, profile: "meta-pageview", case_name: "meta-stock",
  document_url: documentUrl, owned: { pixel_id: "999999999999999" },
  resources: [
    { role: "runtime", url: "https://connect.facebook.net/en_US/fbevents.js",
      sha256: "9e4b581a7483e88873ad835a840ffaaff1c85b3be28951e12e8207a318e7776b" },
    { role: "configuration",
      url: "https://connect.facebook.net/signals/config/999999999999999?v=2.9.0&r=stable&domain=owned.example&hme=synthetic&ex_m=one",
      sha256: "807a33e31707b75434ac6aeda5aa8fc9073d6795ca8a9671ff6535edc308d921" },
  ],
  companion_authorized: false,
});
const observation = (url = metaUrl, extra = {}) => ({
  network_id: "synthetic-network-1", url, method: "GET", resource_type: "Image", ...extra,
});
const options = (resolveObservation = () => [observation()]) => ({
  mode: "DECLARED-META-PROFILE", profile: profile(), resolveObservation,
});
const h1 = (url = metaUrl, extra = "", method = "GET") => {
  const parsed = new URL(url);
  return Buffer.from(`${method} ${parsed.pathname + parsed.search} HTTP/1.1\r\nHost: ${parsed.host}\r\n${extra}\r\n`);
};
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
const pairs = (url = metaUrl) => {
  const parsed = new URL(url);
  return [[":method", "GET"], [":scheme", "https"], [":authority", parsed.host], [":path", parsed.pathname + parsed.search]];
};
function headersFrames(fields, stream = 1, encode = encoder()) {
  const block = encode(fields), frames = [];
  for (let at = 0; at < block.length; at += 16000)
    frames.push(frame(at ? 9 : 1, (at ? 0 : 1) | (at + 16000 >= block.length ? 4 : 0),
      stream, block.subarray(at, at + 16000)));
  return Buffer.concat(frames);
}

describe("declared Meta profile binding to actual inspected bytes (no native execution)", () => {
  it("admits an observed owned-shaped GET/Image through the compiled policy, not the synthetic route", () => {
    const resolveObservation = vi.fn(() => [observation()]);
    const wire = createInspectedHttpWire(options(resolveObservation)), connection = wire.connection("h1");
    const bytes = h1(metaUrl, "Accept: image/*\r\n");
    expect(connection.request(bytes.subarray(0, -1))).toEqual(Buffer.alloc(0));
    expect(resolveObservation).not.toHaveBeenCalled();
    expect(connection.request(bytes.subarray(-1))).toEqual(bytes);
    expect(resolveObservation).toHaveBeenCalledWith({
      ordinal: 1, connection: 1, stream: null, url: metaUrl, method: "GET",
    });
    expect(wire.originals().requests[0]).toMatchObject({
      ordinal: 1, policy_ordinal: 0, logical_network_id: "synthetic-network-1",
      resource_type: "Image", url: metaUrl, authority: "www.facebook.com",
      headers: [["Host", "www.facebook.com"], ["Accept", "image/*"]],
      policy_decision: { disposition: "eligible", route: "meta_pageview", dispatch_authorized: false,
        source_bytes_verified: false, independent_ownership_authentication: false },
    });
    expect(wire.snapshot().policy).toMatchObject({ registered: 1, primary: 1, dispatch_authorized: false,
      source_bytes_verified: false, independent_ownership_authentication: false,
      full_native_guard_qualified: false, execution_authority: false, native_tls_parity: false });
  });

  it.each(["h1", "h2"])("registers only the complete %s decoded original, preserving compressed wire and duplicate cookies", async protocol => {
    const wire = createInspectedHttpWire(options()), connection = wire.connection(protocol);
    const request = protocol === "h1" ? h1() : Buffer.concat([preface, frame(1, 5, 1, encoder()(pairs()))]);
    expect(connection.request(request)).toEqual(request);
    const original = Buffer.from([0, 255, 128, 13, 10]), compressed = gzipSync(original);
    const responsePairs = [["set-cookie", "first=1"], ["set-cookie", "second=2"],
      ["content-encoding", "gzip"], ["content-length", String(compressed.length)]];
    const head = protocol === "h1"
      ? Buffer.from("HTTP/1.1 200 OK\r\n" + responsePairs.map(pair => pair.join(": ") + "\r\n").join("") + "\r\n")
      : frame(1, 4, 1, encoder()([[":status", "200"], ...responsePairs]));
    const first = Buffer.concat([head, protocol === "h1" ? compressed.subarray(0, 5) : frame(0, 0, 1, compressed.subarray(0, 5))]);
    const last = protocol === "h1" ? compressed.subarray(5) : frame(0, 1, 1, compressed.subarray(5));
    expect(await connection.response(first)).toEqual(first);
    expect(wire.snapshot().policy.responses).toBe(0);
    expect(await connection.response(last)).toEqual(last);
    await connection.endResponse();
    const row = wire.originals().responses[0];
    expect(row).toMatchObject({ ordinal: 1, policy_ordinal: 0, logical_network_id: "synthetic-network-1",
      status: 200, state: "complete",
      policy_response: { evidence: "caller_attested_complete_original_not_independent_network_proof" } });
    expect(row.headers).toEqual(protocol === "h1" ? responsePairs : [[":status", "200"], ...responsePairs]);
    expect(Buffer.concat(row.body)).toEqual(original);
    expect(wire.snapshot().policy).toMatchObject({ responses: 1, response_links: 0, dispatch_authorized: false });
    const raw = wire.originals().wire[0];
    expect(raw).toMatchObject({ connection: 1, protocol });
    expect(Buffer.concat(raw.request)).toEqual(request);
    expect(Buffer.concat(raw.response)).toEqual(Buffer.concat([first, last]));
  });

  it.each(["h1", "h2"])("maps a no-HTTP %s abort and cross-connection hidden retry to separate physical admissions", async protocol => {
    const resolver = vi.fn(() => [observation()]), wire = createInspectedHttpWire(options(resolver));
    const first = wire.connection(protocol), request = protocol === "h1" ? h1()
      : Buffer.concat([preface, frame(1, 5, 1, encoder()(pairs()))]);
    expect(first.request(request)).toEqual(request);
    if (protocol === "h1") await first.endResponse("upstream_connection_reset");
    else await first.response(frame(3, 0, 1, Buffer.from([0, 0, 0, 7])));
    expect(wire.originals().responses[0]).toMatchObject({ ordinal: 1, policy_ordinal: 0,
      logical_network_id: "synthetic-network-1", connection: 1, status: null, state: "transport-aborted", body: [] });
    expect(wire.snapshot().policy.responses).toBe(0);
    const second = wire.connection(protocol);
    expect(second.request(request)).toEqual(request);
    expect(wire.originals().requests.map(row => [row.ordinal, row.policy_ordinal, row.connection, row.stream, row.logical_network_id]))
      .toEqual([[1, 0, 1, protocol === "h1" ? null : 1, "synthetic-network-1"],
        [2, 1, 2, protocol === "h1" ? null : 1, "synthetic-network-1"]]);
    expect(resolver).toHaveBeenCalledTimes(2);
    expect(wire.snapshot()).toMatchObject({ observed: 2, forwarded: 2, policy: { registered: 2, responses: 0 } });
    await second.response(protocol === "h1" ? Buffer.from("HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n")
      : frame(1, 5, 1, encoder()([[":status", "200"]])));
    await second.endResponse();
    expect(wire.originals().responses[1]).toMatchObject({ ordinal: 2, policy_ordinal: 1,
      logical_network_id: "synthetic-network-1", connection: 2, state: "complete", status: 200 });
    expect(wire.snapshot().policy.responses).toBe(1);
  });

  it("poisons a failing logical resolver with a fixed category, without leaking its error text or later forwarding", () => {
    const resolve = vi.fn(() => { throw new Error(metaUrl); });
    const wire = createInspectedHttpWire(options(resolve)), connection = wire.connection("h1");
    expect(connection.request(h1())).toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ stopped: true, reason: "logical_observation_resolver_failed",
      forwarded: 0, policy: { registered: 0, responses: 0 } });
    expect(wire.connection("h1").request(h1())).toEqual(Buffer.alloc(0));
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("discards an incomplete native redirect and never treats a socket reset as clean EOF", async () => {
    const child = metaUrl + "&r=child", wire = createInspectedHttpWire(options(({ url }) => [
      observation(url, url === child ? { network_id: "child", redirect_from: 1 } : {}),
    ])), connection = wire.connection("h1");
    connection.request(h1());
    await connection.response(Buffer.from(`HTTP/1.1 302 Found\r\nLocation: ${child}\r\nConnection: close\r\n\r\nprefix`));
    await connection.endResponse("upstream_connection_reset");
    expect(wire.originals().responses[0]).toMatchObject({ state: "inconclusive", headers: [], body: [], redirect_url: null });
    expect(wire.snapshot()).toMatchObject({ stopped: true, reason: "upstream_connection_reset",
      policy: { responses: 0, response_links: 0 } });
    expect(Buffer.concat(wire.originals().wire[0].response).toString()).toContain("Location: " + child);
    expect(wire.connection("h1").request(h1(child))).toEqual(Buffer.alloc(0));
  });

  it("preserves continuation frames and dynamic HPACK state while checking each physical retry independently", async () => {
    const resolve = vi.fn(() => [observation()]), wire = createInspectedHttpWire(options(resolve));
    const connection = wire.connection("h2"), encode = encoder();
    connection.request(preface);
    for (const stream of [1, 3]) {
      const fields = [...pairs(), ["x-state", "stable"], ["x-order", "first"], ["x-order", "second"]];
      const block = encode(fields), first = frame(1, 1, stream, block.subarray(0, 3));
      const last = frame(9, 4, stream, block.subarray(3));
      expect(connection.request(first)).toEqual(Buffer.alloc(0));
      for (let at = 0; at < last.length - 1; at++)
        expect(connection.request(last.subarray(at, at + 1))).toEqual(Buffer.alloc(0));
      expect(connection.request(last.subarray(-1))).toEqual(Buffer.concat([first, last]));
      expect(wire.originals().requests.at(-1)).toMatchObject({ stream, headers: fields,
        header_view: "classification_only_first_occurrence", duplicate_header_names: ["x-order"] });
    }
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(wire.originals().requests.map(row => [row.ordinal, row.policy_ordinal, row.stream]))
      .toEqual([[1, 0, 1], [2, 1, 3]]);
    expect(wire.snapshot().policy).toMatchObject({ registered: 2, primary: 2 });
    wire.stop("pure_fixture_end");
    await connection.endResponse();
  });

  it.each(["h1", "h2"])("limits repeated %s logical IDs across connections to eight physical requests", async protocol => {
    const resolve = vi.fn(() => [observation()]), wire = createInspectedHttpWire(options(resolve));
    for (let ordinal = 1; ordinal <= 9; ordinal++) {
      const connection = wire.connection(protocol);
      if (protocol === "h2") connection.request(preface);
      const bytes = protocol === "h1" ? h1() : headersFrames(pairs());
      expect(connection.request(bytes)).toEqual(ordinal <= 8 ? bytes : Buffer.alloc(0));
    }
    expect(resolve).toHaveBeenCalledTimes(8);
    expect(wire.snapshot()).toMatchObject({ observed: 9, forwarded: 8, stopped: true,
      reason: "physical_request_limit", policy: { registered: 8, vendor_registered: 8 } });
    expect(wire.originals().requests.map(row => row.policy_ordinal)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it.each([
    ["foreign selector", metaUrl.replace("id=999999999999999", "id=888")],
    ["foreign document", metaUrl.replace("owned.example", "foreign.example")],
    ["wrong event", metaUrl.replace("PageView", "Purchase")],
    ["missing marker", metaUrl.replace("id=999999999999999&", "")],
    ["duplicate selector", metaUrl + "&id=999999999999999"],
    ["unknown field", metaUrl + "&unqualified=yes"],
    ["duplicate known field", metaUrl + "&sw=100&sw=100"],
    ["foreign authority", metaUrl.replace("www.facebook.com", "foreign.example")],
    ["foreign path", metaUrl.replace("/tr/", "/pixel")],
    ["synthetic default path", "https://collector.test.invalid/pixel?fake=true"],
    ["malformed encoding", metaUrl + "&r=%FF"],
  ])("denies %s on a reused connection even with a fresh logical binding", (_name, url) => {
    const wire = createInspectedHttpWire(options(({ url, ordinal }) => [
      observation(url, { network_id: "synthetic-" + ordinal }),
    ])), connection = wire.connection("h1");
    expect(connection.request(h1())).toEqual(h1());
    expect(connection.request(h1(url))).toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ stopped: true, observed: 2, forwarded: 1,
      policy: { registered: 1, primary: 1, dispatch_authorized: false } });
  });

  it.each([["POST", "Image"], ["GET", "Fetch"], ["GET", "Script"], ["GET", "XHR"]])(
    "uses the actual logical %s/%s observation, never the profile's expected resource", (method, resource_type) => {
      const wire = createInspectedHttpWire(options(() => [observation(metaUrl, { method, resource_type })]));
      const connection = wire.connection("h1");
      expect(connection.request(h1(metaUrl, "", method))).toEqual(Buffer.alloc(0));
      expect(wire.snapshot()).toMatchObject({ stopped: true, reason: "unqualified_route_or_field",
        policy: { registered: 0 } });
    });

  it.each([
    ["missing", () => []],
    ["ambiguous", () => [observation(), observation(metaUrl, { network_id: "other" })]],
    ["changed URL", () => [observation(metaUrl + "&r=other")]],
    ["changed method", () => [observation(metaUrl, { method: "POST" })]],
    ["invented parent", () => [observation(metaUrl, { redirect_from: 0 })]],
    ["unknown key", () => [observation(metaUrl, { trusted: true })]],
  ])("poisons %s logical binding before forwarding", (_kind, resolve) => {
    const wire = createInspectedHttpWire(options(resolve)), connection = wire.connection("h1");
    expect(connection.request(h1())).toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ stopped: true, forwarded: 0, policy: { registered: 0 } });
    expect(wire.connection("h1").request(h1())).toEqual(Buffer.alloc(0));
  });

  it("does not repurpose an earlier logical ID for a different URL even when the new URL passes route policy", () => {
    const wire = createInspectedHttpWire(options(({ url }) => [observation(url)])), connection = wire.connection("h1");
    connection.request(h1());
    expect(connection.request(h1(metaUrl + "&r=changed"))).toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ reason: "changed_logical_observation", forwarded: 1 });
  });

  it.each(["h1", "h2"])("checks every ordered %s pair, including duplicate padding, at the exact header and URL caps", protocol => {
    for (const extra of [0, 1]) {
      const wire = createInspectedHttpWire(options()), connection = wire.connection(protocol);
      const fields = protocol === "h1" ? [["Host", "www.facebook.com"]] : pairs();
      fields.push(["x-pad", "first"], ["x-pad", ""]);
      const size = Buffer.byteLength(JSON.stringify(fields));
      fields.at(-1)[1] = "a".repeat(65536 - size + extra);
      const bytes = protocol === "h1" ? h1(metaUrl, fields.slice(1).map(pair => pair.join(": ") + "\r\n").join(""))
        : headersFrames(fields);
      if (protocol === "h2") connection.request(preface);
      expect(connection.request(bytes)).toEqual(extra ? Buffer.alloc(0) : bytes);
      expect(wire.snapshot()).toMatchObject({ reason: extra ? "semantic_header_limit" : null, forwarded: extra ? 0 : 1 });
      if (!extra) expect(wire.originals().requests[0]).toMatchObject({ header_bytes: 65536, headers: fields,
        duplicate_header_names: ["x-pad"] });
    }
    for (const extra of [0, 1]) {
      const url = metaUrl + "&r=" + "a".repeat(2048 - Buffer.byteLength(metaUrl + "&r=") + extra);
      const wire = createInspectedHttpWire(options(() => [observation(url)])), connection = wire.connection(protocol);
      if (protocol === "h2") connection.request(preface);
      const bytes = protocol === "h1" ? h1(url) : headersFrames(pairs(url));
      expect(connection.request(bytes)).toEqual(extra ? Buffer.alloc(0) : bytes);
      expect(wire.snapshot()).toMatchObject({ reason: extra ? "invalid_request_url" : null, forwarded: extra ? 0 : 1 });
    }
  });

  it.each(["h1", "h2"])("does not hide the %s field count in a duplicate-flattened classification object", protocol => {
    for (const extra of [0, 1]) {
      const wire = createInspectedHttpWire(options()), connection = wire.connection(protocol);
      const fields = protocol === "h1" ? [["Host", "www.facebook.com"]] : pairs();
      fields.push(...Array.from({ length: 128 - fields.length + extra }, () => ["x-repeat", "v"]));
      if (protocol === "h2") connection.request(preface);
      const bytes = protocol === "h1" ? h1(metaUrl, fields.slice(1).map(pair => pair.join(": ") + "\r\n").join(""))
        : headersFrames(fields);
      expect(connection.request(bytes)).toEqual(extra ? Buffer.alloc(0) : bytes);
      expect(wire.snapshot().reason).toBe(extra ? "meta_header_field_limit" : null);
    }
  });

  it.each(["Authorization", "pRoXy-AuThOrIzAtIoN"])("checks %s on all actual fields before calling the logical resolver", name => {
    const resolve = vi.fn(() => [observation()]), wire = createInspectedHttpWire(options(resolve));
    expect(wire.connection("h1").request(h1(metaUrl, `${name}: not-a-secret\r\n${name}: not-a-secret\r\n`)))
      .toEqual(Buffer.alloc(0));
    expect(wire.snapshot().reason).toBe("private_header_not_permitted");
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each([1, 65536, 65537])("rejects a declared %i-byte H1 body before forwarding its headers", size => {
    const wire = createInspectedHttpWire(options()), connection = wire.connection("h1");
    expect(connection.request(Buffer.concat([h1(metaUrl, `Content-Length: ${size}\r\n`), Buffer.alloc(size)])))
      .toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ stopped: true, reason: "unsupported_h1_request", forwarded: 0 });
  });

  it("rejects body-bearing H2 headers before admission, not after sending an unexpected DATA body", () => {
    const wire = createInspectedHttpWire(options()), connection = wire.connection("h2");
    connection.request(preface);
    const bytes = Buffer.concat([frame(1, 4, 1, encoder()(pairs())), frame(0, 1, 1, Buffer.from("x"))]);
    expect(connection.request(bytes)).toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ reason: "unsupported_h2_request", policy: { registered: 0 } });
  });

  it("resolves a relative Location only from a complete original and an explicitly bound physical redirect parent", async () => {
    const child = metaUrl + "&r=child", wire = createInspectedHttpWire(options(({ url }) => [
      observation(url, url === child ? { network_id: "child", redirect_from: 1 } : {}),
    ])), connection = wire.connection("h1"), location = new URL(child).pathname + new URL(child).search;
    connection.request(h1());
    const response = Buffer.from(`HTTP/1.1 302 Found\r\nLocation: ${location}\r\nContent-Length: 3\r\n\r\nold`);
    expect(await connection.response(response)).toEqual(response);
    expect(wire.snapshot().policy).toMatchObject({ responses: 1, response_links: 1 });
    const next = wire.connection("h2");
    next.request(preface);
    const bytes = headersFrames(pairs(child));
    expect(next.request(bytes)).toEqual(bytes);
    expect(wire.originals().requests[1]).toMatchObject({ ordinal: 2, policy_ordinal: 1,
      connection: 2, stream: 1, logical_network_id: "child", redirect_from: 1, response_parent: null });
    expect(wire.originals().responses[0]).toMatchObject({ policy_ordinal: 0, redirect_url: child,
      policy_response: { redirect: true, urls: 0 } });
  });

  it("refuses to infer an actual logical redirect from a URL match alone", async () => {
    const child = metaUrl + "&r=child", wire = createInspectedHttpWire(options(({ url, ordinal }) => [
      observation(url, { network_id: "synthetic-" + ordinal }),
    ])), connection = wire.connection("h1");
    connection.request(h1());
    await connection.response(Buffer.from(`HTTP/1.1 302 Found\r\nLocation: ${child}\r\nContent-Length: 0\r\n\r\n`));
    expect(connection.request(h1(child))).toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ stopped: true, reason: "missing_actual_redirect_parent", forwarded: 1 });
  });

  it("permits a reused Network ID only as a separately identified, completed redirect leg", async () => {
    const child = metaUrl + "&r=redirected", wire = createInspectedHttpWire(options(({ url }) => [
      observation(url, { fetch_id: url === child ? "synthetic-interception.1" : "synthetic-interception.0",
        ...(url === child ? { redirect_from: 1 } : {}) }),
    ])), connection = wire.connection("h1");
    expect(connection.request(h1())).toEqual(h1());
    await connection.response(Buffer.from(`HTTP/1.1 302 Found\r\nLocation: ${child}\r\nContent-Length: 3\r\n\r\nold`));
    expect(connection.request(h1(child))).toEqual(h1(child));
    expect(wire.originals().requests.map(row => [row.ordinal, row.policy_ordinal, row.logical_network_id, row.logical_fetch_id, row.redirect_from]))
      .toEqual([[1, 0, "synthetic-network-1", "synthetic-interception.0", null],
        [2, 1, "synthetic-network-1", "synthetic-interception.1", 1]]);
  });

  it.each(["no parent", "bad parent", "same Fetch ID", "missing Fetch ID", "changed resource", "changed method"])(
    "does not excuse arbitrary same-Network-ID mutation with %s", async kind => {
      const child = metaUrl + "&r=redirected", wire = createInspectedHttpWire(options(({ url }) => {
        const extra = { fetch_id: "synthetic-interception.0" };
        if (url === child) {
          extra.fetch_id = "synthetic-interception.1"; extra.redirect_from = 1;
          if (kind === "no parent") delete extra.redirect_from;
          if (kind === "bad parent") extra.redirect_from = 0;
          if (kind === "same Fetch ID") extra.fetch_id = "synthetic-interception.0";
          if (kind === "missing Fetch ID") delete extra.fetch_id;
          if (kind === "changed resource") extra.resource_type = "Fetch";
          if (kind === "changed method") extra.method = "POST";
        }
        return [observation(url, extra)];
      })), connection = wire.connection("h1");
      connection.request(h1());
      await connection.response(Buffer.from(`HTTP/1.1 302 Found\r\nLocation: ${child}\r\nContent-Length: 0\r\n\r\n`));
      expect(connection.request(h1(child, "", kind === "changed method" ? "POST" : "GET"))).toEqual(Buffer.alloc(0));
      expect(wire.snapshot()).toMatchObject({ stopped: true, reason: "changed_logical_observation", forwarded: 1,
        policy: { registered: 1, dispatch_authorized: false } });
    });

  it.each([1, 2])("uses the completed physical retry, not its aborted predecessor, as redirect parent %i", async parent => {
    const child = metaUrl + "&r=child", wire = createInspectedHttpWire(options(({ url }) => [
      observation(url, url === child ? { network_id: "child", redirect_from: parent } : {}),
    ])), first = wire.connection("h1");
    first.request(h1());
    await first.endResponse("upstream_connection_reset");
    const retry = wire.connection("h2");
    retry.request(Buffer.concat([preface, headersFrames(pairs())]));
    await retry.response(frame(1, 5, 1, encoder()([[":status", "302"], ["location", child], ["content-length", "0"]])));
    await retry.endResponse();
    const third = wire.connection("h1"), bytes = h1(child);
    expect(third.request(bytes)).toEqual(parent === 2 ? bytes : Buffer.alloc(0));
    expect(wire.originals().responses.map(row => [row.ordinal, row.policy_ordinal, row.state]))
      .toEqual([[1, 0, "transport-aborted"], [2, 1, "complete"]]);
    expect(wire.snapshot().policy).toMatchObject({ registered: parent === 2 ? 3 : 2, responses: 1, response_links: 1 });
    if (parent === 2) expect(wire.originals().requests[2]).toMatchObject({
      ordinal: 3, policy_ordinal: 2, connection: 3, redirect_from: 2,
    });
    else expect(wire.snapshot().reason).toBe("missing_actual_redirect_parent");
  });

  it.each(["early target", "truncated body", "unsupported redirect", "reset H2"])(
    "never registers a redirect parent on %s", async kind => {
      const child = metaUrl + "&r=child", wire = createInspectedHttpWire(options(({ url }) => [
        observation(url, url === child ? { network_id: "child", redirect_from: 1 } : {}),
      ])), connection = wire.connection(kind === "reset H2" ? "h2" : "h1");
      if (kind === "reset H2") {
        connection.request(Buffer.concat([preface, headersFrames(pairs())]));
        await connection.response(frame(3, 0, 1, Buffer.from([0, 0, 0, 7])));
      } else {
        connection.request(h1());
        await connection.response(Buffer.from(`HTTP/1.1 ${kind === "unsupported redirect" ? 305 : 302} Found\r\nLocation: ${child}\r\nContent-Length: 4\r\n\r\nabc`));
        if (kind === "truncated body") await connection.endResponse();
      }
      const next = wire.connection("h1");
      expect(next.request(h1(child))).toEqual(Buffer.alloc(0));
      expect(wire.snapshot()).toMatchObject({ stopped: true, forwarded: 1, policy: { responses: 0, response_links: 0 } });
      expect(wire.originals().responses.every(row => row.state !== "complete")).toBe(true);
    });

  it.each([true, false])("requires the actual completed response-supplied URL relationship (present=%s)", async present => {
    const child = metaUrl + "&r=from-response", wire = createInspectedHttpWire(options(({ url }) => [
      observation(url, url === child ? { network_id: "child", response_parent: 1 } : {}),
    ])), connection = wire.connection("h2");
    connection.request(Buffer.concat([preface, headersFrames(pairs())]));
    const original = Buffer.from(JSON.stringify({ next: present ? child : metaUrl + "&r=other" }));
    const response = Buffer.concat([frame(1, 4, 1, encoder()([[":status", "200"], ["content-type", "application/json"],
      ["content-length", String(original.length)]])), frame(0, 1, 1, original)]);
    expect(await connection.response(response)).toEqual(response);
    expect(Buffer.concat(wire.originals().responses[0].body)).toEqual(original);
    const next = wire.connection("h1"), bytes = h1(child);
    expect(next.request(bytes)).toEqual(present ? bytes : Buffer.alloc(0));
    expect(wire.snapshot().policy).toMatchObject({ responses: 1, response_links: 1, registered: present ? 2 : 1 });
    if (present) expect(wire.originals().requests[1]).toMatchObject({
      policy_ordinal: 1, response_parent: 1, redirect_from: null,
    });
    else expect(wire.snapshot().reason).toBe("unverified_parent_url");
  });

  it.each([
    ["unsupported encoding", "Content-Encoding: unsupported\r\n", Buffer.alloc(0), "unsupported_content_encoding"],
    ["invalid JSON original", "Content-Type: application/json\r\n", Buffer.from("{bad}"), "invalid_policy_response"],
    ["duplicate Location", `Location: ${metaUrl}\r\nLocation: ${metaUrl}\r\n`, Buffer.alloc(0), "invalid_policy_response"],
  ])("stops %s instead of silently using synthetic response handling", async (_name, headers, body, reason) => {
    const wire = createInspectedHttpWire(options()), connection = wire.connection("h1");
    connection.request(h1());
    const bytes = Buffer.concat([Buffer.from(`HTTP/1.1 200 OK\r\n${headers}Content-Length: ${body.length}\r\n\r\n`), body]);
    expect(await connection.response(bytes)).toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ stopped: true, reason, policy: { responses: 0 } });
    expect(wire.originals().responses[0]).toMatchObject({ state: "inconclusive", body: [], headers: [] });
  });

  it.each(["upstream_transport_error", "upstream_unexpected_close"])("does not complete a decoded compressed prefix on %s", async termination => {
    const wire = createInspectedHttpWire(options()), connection = wire.connection("h1"), compressed = gzipSync(Buffer.from("observed original"));
    connection.request(h1());
    await connection.response(Buffer.concat([Buffer.from("HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nConnection: close\r\n\r\n"), compressed.subarray(0, -1)]));
    await connection.endResponse(termination);
    expect(wire.snapshot()).toMatchObject({ stopped: true, reason: termination, policy: { responses: 0 } });
    expect(wire.originals().responses[0]).toMatchObject({ state: "inconclusive", body: [], headers: [] });
    expect(wire.snapshot().decompressors).toBe(0);
  });

  it("maps out-of-order H2 responses through continued and dynamically indexed original header blocks", async () => {
    const wire = createInspectedHttpWire(options()), connection = wire.connection("h2"), requestEncode = encoder(), responseEncode = encoder();
    connection.request(Buffer.concat([preface, headersFrames(pairs(), 1, requestEncode), headersFrames(pairs(), 3, requestEncode)]));
    const responseFields = [[":status", "200"], ["set-cookie", "a=1"], ["set-cookie", "b=2"]];
    const original = Buffer.from([0, 255, 128]), all = [];
    for (const stream of [3, 1]) {
      const block = responseEncode(responseFields);
      const bytes = Buffer.concat([frame(1, 0, stream, block.subarray(0, 1)),
        frame(9, 4, stream, block.subarray(1)), frame(0, 1, stream, original)]);
      expect(await connection.response(bytes)).toEqual(bytes);
      all.push(bytes);
    }
    await connection.endResponse();
    expect(wire.originals().responses.map(row => [row.ordinal, row.policy_ordinal, row.stream, row.state]))
      .toEqual([[2, 1, 3, "complete"], [1, 0, 1, "complete"]]);
    for (const row of wire.originals().responses) {
      expect(row.headers).toEqual(responseFields);
      expect(Buffer.concat(row.body)).toEqual(original);
    }
    expect(Buffer.concat(wire.originals().wire[0].response)).toEqual(Buffer.concat(all));
    expect(wire.snapshot().policy.responses).toBe(2);
  });

  it("checks the compiled response cap at exactly 2 MiB and one byte over, before accepting decoded originals", async () => {
    for (const extra of [0, 1]) {
      const wire = createInspectedHttpWire(options()), connection = wire.connection("h1");
      connection.request(h1());
      const headers = [["Content-Encoding", "gzip"], ["Connection", "close"]];
      const original = Buffer.alloc(2097152 - Buffer.byteLength(JSON.stringify(headers)) + extra, 65);
      const bytes = Buffer.concat([Buffer.from("HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nConnection: close\r\n\r\n"), gzipSync(original)]);
      await connection.response(bytes);
      expect(wire.snapshot().policy.responses).toBe(0);
      await connection.endResponse();
      expect(wire.snapshot()).toMatchObject({ stopped: Boolean(extra), reason: extra ? "response_overflow" : null,
        decompressors: 0, policy: { responses: extra ? 0 : 1 } });
      const row = wire.originals().responses[0];
      expect(row.state).toBe(extra ? "inconclusive" : "complete");
      if (!extra) {
        expect(row.header_bytes + row.decoded_body_bytes).toBe(2097152);
        expect(Buffer.concat(row.body)).toEqual(original);
      }
      expect(Buffer.concat(wire.originals().wire[0].response)).toEqual(bytes);
    }
  });

  it("charges retained original Meta wire as well as ordered observations against the same aggregate ceiling", () => {
    const wire = createInspectedHttpWire(options()), first = wire.connection("h1"), bytes = h1();
    first.request(bytes);
    const requestCost = bytes.length + Buffer.byteLength(JSON.stringify([["Host", "www.facebook.com"]]))
      + Buffer.byteLength(metaUrl) + 3;
    expect(wire.snapshot().retained_bytes).toBe(requestCost);
    expect(wire.reserveObservation(8388608 - requestCost * 2)).toBe(true);
    const second = wire.connection("h1");
    expect(second.request(bytes)).toEqual(bytes);
    expect(wire.snapshot()).toMatchObject({ retained_bytes: 8388608, stopped: false, forwarded: 2 });
    expect(second.request(bytes)).toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ stopped: true, reason: "aggregate_overflow", forwarded: 2,
      policy: { registered: 2, whole_case_byte_budget_verified: false } });
  });

  it("also caps actual H1 field octets when optional whitespace is absent from the classification view", () => {
    let accepted, physicalBytes;
    for (const extra of [0, 1]) {
      const wire = createInspectedHttpWire(options()), connection = wire.connection("h1");
      const empty = "Host: www.facebook.com\r\nX-Pad:\r\n\r\n";
      const padding = " ".repeat(65536 - Buffer.byteLength(empty) + extra);
      const bytes = h1(metaUrl, `X-Pad:${padding}\r\n`);
      const forwarded = connection.request(bytes);
      expect(forwarded.length).toBe(extra ? 0 : bytes.length);
      if (!extra) expect(forwarded).toEqual(bytes);
      expect(wire.snapshot()).toMatchObject({ stopped: Boolean(extra),
        reason: extra ? "raw_request_field_limit" : null, forwarded: extra ? 0 : 1 });
      if (!extra) { accepted = wire.originals().requests[0]; physicalBytes = bytes.length; }
    }
    expect(accepted).toMatchObject({ physical_header_bytes: physicalBytes, raw_field_bytes: 65536 });
  });

  it.each(["fixture", "declared script"])("never turns a %s declaration into inspected source-fetch authority", kind => {
    const config = profile(), url = kind === "fixture" ? documentUrl : config.resources[0].url;
    const input = options(() => [observation(url, { resource_type: kind === "fixture" ? "Document" : "Script" })]);
    const wire = createInspectedHttpWire(input), connection = wire.connection("h1");
    expect(connection.request(h1(url))).toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ reason: "unsupported_inspected_meta_route",
      policy: { registered: 0, source_bytes_verified: false } });
  });

  it.each([
    ["wrong scheme", fields => { fields[1][1] = "http"; }],
    ["duplicate authority", fields => { fields.splice(3, 0, [":authority", "www.facebook.com"]); }],
    ["conflicting Host", fields => { fields.push(["host", "foreign.example"]); }],
    ["duplicate zero lengths", fields => { fields.push(["content-length", "0"], ["content-length", "0"]); }],
    ["changed actual method", fields => { fields[0][1] = "POST"; }],
    ["changed actual path", fields => { fields[3][1] = "/not-the-bound-url"; }],
  ])("denies H2 %s without treating a staged logical observation as final bytes", (_name, change) => {
    const wire = createInspectedHttpWire(options()), connection = wire.connection("h2"), fields = pairs();
    change(fields); connection.request(preface);
    expect(connection.request(headersFrames(fields))).toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ stopped: true, forwarded: 0, policy: { registered: 0 } });
  });
});

describe("closed declared Meta inputs, not a new executor or grant", () => {
  it("rejects a null profile with a fixed category before observation effects", () => {
    const resolve = vi.fn(() => [observation()]);
    expect(() => createInspectedHttpWire({ ...options(resolve), profile: null }))
      .toThrow("invalid_meta_binding_input");
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown mode", input => { input.mode = "native-live"; }],
    ["Google profile", input => { input.profile.profile = "google-ads-conversion"; input.profile.case_name = "google-stock"; }],
    ["candidate case", input => { input.profile.case_name = "meta-chamber"; }],
    ["unknown program key", input => { input.upstream = "https://foreign.example"; }],
    ["policy bypass key", input => { input.bypass = true; }],
    ["unknown declared key", input => { input.profile.authorized = true; }],
    ["unknown owned key", input => { input.profile.owned.other = true; }],
    ["unknown pin key", input => { input.profile.resources[0].verified = true; }],
    ["wrong declared pin", input => { input.profile.resources[0].sha256 = "a".repeat(64); }],
    ["missing resolver", input => { delete input.resolveObservation; }],
  ])("rejects %s before any observation effects", (_name, change) => {
    const resolve = vi.fn(() => [observation()]), input = options(resolve);
    change(input);
    expect(() => createInspectedHttpWire(input)).toThrow();
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each(["options", "profile", "owned", "resource", "resolver"])("rejects a %s proxy without invoking any trap", kind => {
    const trap = vi.fn(() => { throw new Error("must not run"); });
    const proxy = item => new Proxy(item, { get: trap, ownKeys: trap, getPrototypeOf: trap });
    const input = options();
    let actual = input;
    if (kind === "options") actual = proxy(input);
    if (kind === "profile") input.profile = proxy(input.profile);
    if (kind === "owned") input.profile.owned = proxy(input.profile.owned);
    if (kind === "resource") input.profile.resources[0] = proxy(input.profile.resources[0]);
    if (kind === "resolver") input.resolveObservation = proxy(input.resolveObservation);
    expect(() => createInspectedHttpWire(actual)).toThrow("invalid_meta_binding_input");
    expect(trap).not.toHaveBeenCalled();
  });

  it.each(["mode", "profile", "owned", "pin", "array entry"])("rejects a %s accessor without invoking it", kind => {
    const get = vi.fn(() => { throw new Error("must not run"); }), input = options();
    const [object, key] = ({
      mode: [input, "mode"], profile: [input, "profile"], owned: [input.profile.owned, "pixel_id"],
      pin: [input.profile.resources[0], "sha256"], "array entry": [input.profile.resources, "0"],
    })[kind];
    Object.defineProperty(object, key, { get, enumerable: true });
    expect(() => createInspectedHttpWire(input)).toThrow("invalid_meta_binding_input");
    expect(get).not.toHaveBeenCalled();
  });

  it("snapshots declarations before later mutation without treating metadata as source-byte proof", () => {
    const input = options(), wire = createInspectedHttpWire(input);
    input.profile.owned.pixel_id = "888"; input.profile.document_url = "https://foreign.example/";
    input.profile.resources[0].sha256 = "a".repeat(64);
    input.resolveObservation = () => [];
    expect(wire.connection("h1").request(h1())).toEqual(h1());
    expect(wire.snapshot().policy).toMatchObject({ registered: 1, source_bytes_verified: false,
      independent_ownership_authentication: false, whole_case_byte_budget_verified: false });
  });

  it.each(["proxy", "accessor", "array accessor"])("poisons an unsafe %s logical observation without invoking it", kind => {
    const trap = vi.fn(() => { throw new Error("must not run"); });
    let values = [observation()];
    if (kind === "proxy") values[0] = new Proxy(values[0], { get: trap, ownKeys: trap, getPrototypeOf: trap });
    if (kind === "accessor") Object.defineProperty(values[0], "resource_type", { get: trap });
    if (kind === "array accessor") Object.defineProperty(values, "0", { get: trap });
    const wire = createInspectedHttpWire(options(() => values));
    expect(wire.connection("h1").request(h1())).toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ stopped: true, reason: "invalid_meta_binding_input", forwarded: 0 });
    expect(trap).not.toHaveBeenCalled();
  });

  it.each(["request", "response"])("poisons an invalid native %s Buffer and cannot reopen forwarding", async direction => {
    const wire = createInspectedHttpWire(options()), connection = wire.connection("h1");
    if (direction === "response") connection.request(h1());
    const trap = vi.fn(() => { throw new Error("must not run"); }), bytes = new Proxy(Buffer.from("x"), { get: trap });
    expect(await connection[direction](bytes)).toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ stopped: true, reason: "invalid_inspected_bytes" });
    expect(wire.connection("h1").request(h1())).toEqual(Buffer.alloc(0));
    expect(trap).not.toHaveBeenCalled();
  });
});
