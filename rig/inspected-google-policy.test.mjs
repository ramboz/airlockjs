import { describe, expect, it } from "vitest";
import hpack from "hpack.js";
import { createInspectedHttpWire } from "./inspected-http-wire.mjs";

const documentUrl = "https://owned.example/inspection";
const primary = "https://www.googleadservices.com/pagead/conversion/000000000/"
  + "?label=synthetic&value=1&currency_code=USD&oid=synthetic-transaction"
  + "&url=https%3A%2F%2Fowned.example%2Finspection&auid=synthetic-auid";
const companion = "https://ad.doubleclick.net/ccm/s/collect?auid=synthetic-auid";
const profile = () => ({
  schema_version: 1, profile: "google-ads-conversion", case_name: "google-stock",
  document_url: documentUrl,
  owned: { conversion_id: "AW-000000000", conversion_label: "synthetic",
    value: 1, currency: "USD", transaction_id: "synthetic-transaction" },
  resources: [{ role: "runtime", url: "https://www.googletagmanager.com/gtag/js?id=AW-000000000",
    sha256: "318a26b825f07b60faec698d5e771434c36e3f7f248640988c1c0be5220c3e50" }],
  companion_authorized: true,
});
const options = (resolveObservation = ({ url, method, ordinal }) => [{
  network_id: `logical-${ordinal}`, url, method,
  resource_type: url.startsWith("https://www.googleadservices.com/") ? "XHR" : "Image",
}]) => ({ mode: "DECLARED-GOOGLE-PROFILE", profile: profile(), resolveObservation });
const h1 = url => {
  const parsed = new URL(url);
  return Buffer.from(`GET ${parsed.pathname + parsed.search} HTTP/1.1\r\nHost: ${parsed.host}\r\n\r\n`);
};
const frame = (type, flags, stream, body = Buffer.alloc(0)) => {
  const header = Buffer.alloc(9);
  header.writeUIntBE(body.length, 0, 3); header[3] = type; header[4] = flags; header.writeUInt32BE(stream, 5);
  return Buffer.concat([header, body]);
};
const encoded = pairs => {
  const encoder = hpack.compressor.create({ table: { maxSize: 4096 } });
  encoder.write(pairs.map(([name, value]) => ({ name, value })));
  const chunks = [];
  for (let part; (part = encoder.read()) !== null;) chunks.push(part);
  return Buffer.concat(chunks);
};
const h2 = (url, stream = 1) => {
  const parsed = new URL(url);
  return frame(1, 5, stream, encoded([[":method", "GET"], [":scheme", "https"],
    [":authority", parsed.host], [":path", parsed.pathname + parsed.search]]));
};

describe("declared Google policy on physical HTTP bytes", () => {
  it("counts twenty physical attempts globally across authorities, then blocks the twenty-first", () => {
    const wire = createInspectedHttpWire(options());
    for (let n = 0; n < 21; n++) {
      const request = h1(n % 2 ? companion : primary);
      expect(wire.connection("h1").request(request)).toEqual(n < 20 ? request : Buffer.alloc(0));
    }
    expect(wire.snapshot()).toMatchObject({ observed: 21, forwarded: 20,
      stopped: true, reason: "physical_request_limit",
      policy: { registered: 20, vendor_registered: 20, execution_authority: false } });
  });

  it.each([
    ["missing marker", primary.replace("label=synthetic&", "")],
    ["foreign input", primary.replace("oid=synthetic-transaction", "oid=other")],
    ["foreign authority", primary.replace("www.googleadservices.com", "foreign.example")],
    ["unsupported path", primary.replace("/pagead/conversion/", "/other/conversion/")],
  ])("rejects %s before forwarding", (_name, url) => {
    const wire = createInspectedHttpWire(options());
    expect(wire.connection("h1").request(h1(url))).toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ stopped: true, forwarded: 0 });
  });

  it("requires a same-case admitted primary and its identity for the companion", () => {
    const first = createInspectedHttpWire(options());
    expect(first.connection("h1").request(h1(companion))).toEqual(Buffer.alloc(0));
    const second = createInspectedHttpWire(options());
    expect(second.connection("h1").request(h1(primary))).toEqual(h1(primary));
    expect(second.connection("h1").request(h1(companion.replace("synthetic-auid", "other"))))
      .toEqual(Buffer.alloc(0));
    expect(second.snapshot()).toMatchObject({ forwarded: 1, stopped: true });
  });

  it("rejects ambiguous logical observations", () => {
    const wire = createInspectedHttpWire(options(() => []));
    expect(wire.connection("h1").request(h1(primary))).toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ forwarded: 0, stopped: true,
      reason: "missing_or_ambiguous_logical_observation" });
  });

  it("enforces the same global physical budget on H2 and mixed-authority tunnels", () => {
    const wire = createInspectedHttpWire(options());
    for (let n = 0; n < 21; n++) {
      const connection = wire.connection("h2");
      const preface = Buffer.from("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");
      expect(connection.request(preface)).toEqual(preface);
      const request = h2(n % 2 ? companion : primary);
      expect(connection.request(request)).toEqual(n < 20 ? request : Buffer.alloc(0));
    }
    expect(wire.snapshot()).toMatchObject({ observed: 21, forwarded: 20,
      stopped: true, reason: "physical_request_limit" });
  });

  it("requires a complete original redirect and exact physical parent", async () => {
    const child = primary + "&random=1";
    const resolver = ({ url, method }) => [{
      network_id: "same", fetch_id: url === primary ? "first" : "second", url, method, resource_type: "XHR",
      ...(url === child ? { redirect_from: 1 } : {}),
    }];
    const wire = createInspectedHttpWire(options(resolver)), connection = wire.connection("h1");
    expect(connection.request(h1(primary))).toEqual(h1(primary));
    const response = Buffer.from(`HTTP/1.1 302 Found\r\nLocation: ${child}\r\nContent-Length: 3\r\n\r\nabc`);
    expect(await connection.response(response)).toEqual(response);
    expect(connection.request(h1(child))).toEqual(h1(child));
    expect(wire.originals().requests[1]).toMatchObject({ redirect_from: 1, policy_ordinal: 1 });
    expect(Buffer.concat(wire.originals().responses[0].body).toString()).toBe("abc");

    const truncated = createInspectedHttpWire(options(resolver)), first = truncated.connection("h1");
    first.request(h1(primary));
    await first.response(Buffer.from(`HTTP/1.1 302 Found\r\nLocation: ${child}\r\nContent-Length: 3\r\n\r\na`));
    expect(first.request(h1(child))).toEqual(Buffer.alloc(0));
    expect(truncated.snapshot()).toMatchObject({ stopped: true, reason: "uncompleted_redirect_parent", forwarded: 1 });
  });

  it("accepts a response-linked request only from its complete matching original", async () => {
    const resolver = ({ url, method, ordinal }) => [{
      network_id: `logical-${ordinal}`, url, method,
      resource_type: url === primary ? "XHR" : "Image",
      ...(url === companion ? { response_parent: 1 } : {}),
    }];
    const body = JSON.stringify({ url: companion });
    const response = text => Buffer.from(`HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${text}`);
    const complete = createInspectedHttpWire(options(resolver));
    const first = complete.connection("h1");
    expect(first.request(h1(primary))).toEqual(h1(primary));
    await first.response(response(body));
    expect(complete.connection("h1").request(h1(companion))).toEqual(h1(companion));
    expect(complete.originals().requests[1]).toMatchObject({ response_parent: 1 });

    const incomplete = createInspectedHttpWire(options(resolver));
    const partial = incomplete.connection("h1");
    partial.request(h1(primary));
    await partial.response(response(body.slice(0, -1)));
    expect(incomplete.connection("h1").request(h1(companion))).toEqual(Buffer.alloc(0));
    expect(incomplete.snapshot()).toMatchObject({ stopped: true, reason: "unverified_parent_url", forwarded: 1 });
  });

  it("rejects getters without invoking them", () => {
    let invoked = false;
    const input = options();
    Object.defineProperty(input.profile.owned, "conversion_id", {
      get() { invoked = true; return "AW-000000000"; }, enumerable: true,
    });
    expect(() => createInspectedHttpWire(input)).toThrow("invalid_google_binding_input");
    expect(invoked).toBe(false);
  });

  it("binds a physical connection to its exact authenticated CONNECT authority", () => {
    const wire = createInspectedHttpWire(options());
    const connection = wire.connection("h1", "www.googleadservices.com:443");
    expect(connection.request(h1(primary))).toEqual(h1(primary));
    expect(connection.request(h1(companion))).toEqual(Buffer.alloc(0));
    expect(wire.snapshot()).toMatchObject({ stopped: true, reason: "inspected_authority_mismatch", forwarded: 1 });
  });
});
