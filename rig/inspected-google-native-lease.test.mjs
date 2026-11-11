import { describe, expect, it } from "vitest";
import { startNativeGoogleInspectedTransport } from "./inspected-transport.mjs";
import { consumeNativeAdditionalGoogle } from "./inspected-google-additional.mjs";
import { reserveNativeAdditionalGoogleSlot } from "./native-stock-capture.mjs";
import { EventEmitter } from "node:events";
import { spawnSync } from "node:child_process";
import * as admission from "./inspected-google-admission.mjs";
import { createInspectedHttpWire } from "./inspected-http-wire.mjs";

const primary = "https://www.googleadservices.com/pagead/conversion/000000000/"
  + "?label=synthetic&value=1&currency_code=USD&oid=synthetic-transaction"
  + "&url=https%3A%2F%2Fowned.example%2Finspection&auid=synthetic-auid";
const companion = "https://ad.doubleclick.net/ccm/s/collect?auid=synthetic-auid";
const profile = { schema_version: 1, profile: "google-ads-conversion", case_name: "google-stock",
  document_url: "https://owned.example/inspection",
  owned: { conversion_id: "AW-000000000", conversion_label: "synthetic",
    value: 1, currency: "USD", transaction_id: "synthetic-transaction" },
  resources: [{ role: "runtime", url: "https://www.googletagmanager.com/gtag/js?id=AW-000000000",
    sha256: "318a26b825f07b60faec698d5e771434c36e3f7f248640988c1c0be5220c3e50" }],
  companion_authorized: true };
const requestBytes = url => {
  const parsed = new URL(url);
  return Buffer.from(`GET ${parsed.pathname + parsed.search} HTTP/1.1\r\nHost: ${parsed.host}\r\n\r\n`);
};
async function browserFixture() {
  const logical = [], cdp = new EventEmitter(), calls = [], stops = [];
  let expired = false;
  cdp.send = async (method, params) => { calls.push({ method, params }); };
  const observer = createInspectedHttpWire({ mode: "DECLARED-GOOGLE-PROFILE", profile,
    resolveObservation: ({ url, method }) => logical.filter(row => row.url === url && row.method === method) });
  const bridge = admission.createGoogleBrowserObservation({ cdp, profile, observer, logical,
    document: { bytes: Buffer.from("<!doctype html>"), headers: [{ name: "Content-Type", value: "text/html" }] },
    source: Buffer.from("/* sdk-free fixture */"),
    check() { if (expired) throw Error("case_window_inactive"); },
    wait: promise => promise, stop: reason => stops.push(reason) });
  await bridge.start();
  const dispatch = async (url, id, type, fetchType = type) => {
    cdp.emit("Network.requestWillBeSent", { requestId: id, type, request: { url, method: "GET" } });
    cdp.emit("Fetch.requestPaused", { requestId: `fetch-${id}`, networkId: id,
      resourceType: fetchType, request: { url, method: "GET", headers: {} } });
    await bridge.settle();
  };
  return { cdp, calls, stops, observer, bridge, logical, dispatch, expire() { expired = true; } };
}

describe("closed Google native transport lease", () => {
  it("uses the native issuer and one-use transport handoff in an isolated module graph", () => {
    const result = spawnSync(process.execPath, ["--experimental-vm-modules",
      "rig/inspected-google-native-lease-isolated.mjs"], { encoding: "utf8", timeout: 15000 });
    expect({ status: result.status, stderr: result.status === 0 ? "" : result.stderr })
      .toEqual({ status: 0, stderr: "" });
    expect(result.stdout).toContain("no owner permission");
  });
  it.each([null, {}, Object.freeze({}), new Proxy({}, {})])(
    "rejects an unissued lease before opening a listener or upstream connection", async lease => {
      await expect(startNativeGoogleInspectedTransport(lease)).rejects.toThrow("invalid_native_google_transport_lease");
    },
  );
  it("requires a case-owned native engine handoff before consuming a reservation", async () => {
    await expect(consumeNativeAdditionalGoogle({}, {}, {})).rejects.toThrow("invalid_google_native_engine");
  });

  it("connects browser observations to the physical Google request gate", async () => {
    const url = "https://www.googleadservices.com/pagead/conversion/000000000/"
      + "?label=synthetic&value=1&currency_code=USD&oid=synthetic-transaction"
      + "&url=https%3A%2F%2Fowned.example%2Finspection&auid=synthetic-auid";
    const profile = { schema_version: 1, profile: "google-ads-conversion", case_name: "google-stock",
      document_url: "https://owned.example/inspection",
      owned: { conversion_id: "AW-000000000", conversion_label: "synthetic",
        value: 1, currency: "USD", transaction_id: "synthetic-transaction" },
      resources: [{ role: "runtime", url: "https://www.googletagmanager.com/gtag/js?id=AW-000000000",
        sha256: "318a26b825f07b60faec698d5e771434c36e3f7f248640988c1c0be5220c3e50" }],
      companion_authorized: true };
    const logical = [], cdp = new EventEmitter(), calls = [];
    cdp.send = async (method, params) => { calls.push({ method, params }); };
    const observer = createInspectedHttpWire({ mode: "DECLARED-GOOGLE-PROFILE", profile,
      resolveObservation: ({ url, method }) => logical.filter(row => row.url === url && row.method === method) });
    const bridge = admission.createGoogleBrowserObservation?.({ cdp, profile, observer, logical,
      check() {}, wait: promise => promise, stop() {} });
    if (bridge) await bridge.start();
    cdp.emit("Network.requestWillBeSent", { requestId: "network-1", type: "XHR",
      request: { url, method: "GET" } });
    cdp.emit("Fetch.requestPaused", { requestId: "fetch-1", networkId: "network-1",
      resourceType: "XHR", request: { url, method: "GET", headers: {} } });
    if (bridge) await bridge.settle();
    const parsed = new URL(url), bytes = Buffer.from(
      `GET ${parsed.pathname + parsed.search} HTTP/1.1\r\nHost: ${parsed.host}\r\n\r\n`);
    const wire = observer.connection("h1");
    expect(wire.request(bytes)).toEqual(bytes);
    expect(calls).toContainEqual({ method: "Fetch.continueRequest", params: { requestId: "fetch-1" } });
    bridge.stop("test_stop");
    expect(wire.request(bytes)).toEqual(Buffer.alloc(0));
  });
  it("requires a case-owned native admission ticket before reserving", async () => {
    await expect(reserveNativeAdditionalGoogleSlot({}, {})).rejects.toThrow("invalid_google_native_reservation_permit");
  });
});

describe("browser observation guard", () => {
  it("binds a framed response-linked request only to the complete physical parent", async () => {
    const f = await browserFixture();
    await f.dispatch(primary, "one", "XHR");
    const wire = f.observer.connection("h1");
    expect(wire.request(requestBytes(primary))).toEqual(requestBytes(primary));
    const body = `event: message\ndata: ${JSON.stringify({ fetch: [companion] })}\n\n`;
    await wire.response(Buffer.from(`HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n`
      + `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`));
    await f.dispatch(companion, "two", "Image");
    expect(f.logical.at(-1)).toMatchObject({ response_parent: 1 });
    expect(f.observer.connection("h1").request(requestBytes(companion))).toEqual(requestBytes(companion));
    expect(f.observer.originals().requests[1]).toMatchObject({ response_parent: 1 });
    f.bridge.stop("test_stop");
  });

  it("stops an observation when its physical parent is incomplete", async () => {
    const f = await browserFixture();
    await f.dispatch(primary, "one", "XHR");
    const wire = f.observer.connection("h1");
    expect(wire.request(requestBytes(primary))).toEqual(requestBytes(primary));
    const body = JSON.stringify({ url: companion });
    await wire.response(Buffer.from(`HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n`
      + `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body.slice(0, -1)}`));
    await f.dispatch(companion, "two", "Image");
    expect(f.stops).toContain("google_prior_response_incomplete");
    expect(f.calls).not.toContainEqual({ method: "Fetch.continueRequest", params: { requestId: "fetch-two" } });
    expect(f.observer.connection("h1").request(requestBytes(companion))).toEqual(Buffer.alloc(0));
    f.bridge.stop("test_stop");
  });

  it("stops and does not forward after an ambiguous framed physical response", async () => {
    const f = await browserFixture();
    await f.dispatch(primary, "one", "XHR");
    const wire = f.observer.connection("h1");
    expect(wire.request(requestBytes(primary))).toEqual(requestBytes(primary));
    const body = `event: message\ndata: {"fetch":[${JSON.stringify(companion)}],"fetch":[]}\n\n`;
    await wire.response(Buffer.from(`HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n`
      + `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`));
    expect(f.observer.snapshot()).toMatchObject({ stopped: true, reason: "invalid_policy_response" });
    await f.dispatch(companion, "two", "Image");
    expect(f.calls).not.toContainEqual({ method: "Fetch.continueRequest", params: { requestId: "fetch-two" } });
    expect(f.observer.connection("h1").request(requestBytes(companion))).toEqual(Buffer.alloc(0));
    f.bridge.stop("test_stop");
  });

  it("binds a redirect to the completed physical response and original network identity", async () => {
    const f = await browserFixture();
    await f.dispatch(primary, "one", "XHR");
    const wire = f.observer.connection("h1"), child = `${primary}&random=1`;
    expect(wire.request(requestBytes(primary))).toEqual(requestBytes(primary));
    await wire.response(Buffer.from(`HTTP/1.1 302 Found\r\nLocation: ${child}\r\nContent-Length: 3\r\n\r\nabc`));
    f.cdp.emit("Network.requestWillBeSent", { requestId: "one", type: "XHR",
      request: { url: child, method: "GET" }, redirectResponse: { url: primary, status: 302 } });
    f.cdp.emit("Fetch.requestPaused", { requestId: "fetch-two", networkId: "one", resourceType: "XHR",
      request: { url: child, method: "GET", headers: {} } });
    await f.bridge.settle();
    expect(f.logical).toEqual([expect.objectContaining({ network_id: "one", redirect_from: 1 })]);
    expect(f.observer.connection("h1").request(requestBytes(child))).toEqual(requestBytes(child));
    expect(f.observer.originals().requests[1]).toMatchObject({ redirect_from: 1 });
    f.bridge.stop("test_stop");
  });

  it("fails closed on a resource-type mismatch and on expiry", async () => {
    const mismatch = await browserFixture();
    await mismatch.dispatch(primary, "one", "XHR", "Image");
    expect(mismatch.stops).toContain("missing_or_ambiguous_network_observation");
    expect(mismatch.observer.connection("h1").request(requestBytes(primary))).toEqual(Buffer.alloc(0));
    mismatch.bridge.stop("test_stop");
    const expired = await browserFixture();
    expired.expire();
    await expired.dispatch(primary, "one", "XHR");
    expect(expired.stops).toContain("case_window_inactive");
    expect(expired.observer.connection("h1").request(requestBytes(primary))).toEqual(Buffer.alloc(0));
    expired.bridge.stop("test_stop");
  });

  it("stops oversized URLs and the sixty-fifth network observation", async () => {
    const oversized = await browserFixture();
    oversized.cdp.emit("Network.requestWillBeSent", { requestId: "long", type: "XHR",
      request: { url: primary + "a".repeat(2048), method: "GET" } });
    expect(oversized.stops).toContain("google_observation_invalid");
    oversized.bridge.stop("test_stop");
    const overflow = await browserFixture();
    for (let n = 0; n < 65; n++) overflow.cdp.emit("Network.requestWillBeSent", {
      requestId: `n-${n}`, type: "XHR", request: { url: primary, method: "GET" } });
    expect(overflow.stops).toContain("google_observation_invalid");
    overflow.bridge.stop("test_stop");
  });

  it("stops ambiguous network bindings and over-limit request headers", async () => {
    const ambiguous = await browserFixture();
    const event = { requestId: "one", type: "XHR", request: { url: primary, method: "GET" } };
    ambiguous.cdp.emit("Network.requestWillBeSent", event);
    ambiguous.cdp.emit("Network.requestWillBeSent", event);
    ambiguous.cdp.emit("Fetch.requestPaused", { requestId: "fetch-one", networkId: "one", resourceType: "XHR",
      request: { url: primary, method: "GET", headers: {} } });
    await ambiguous.bridge.settle();
    expect(ambiguous.stops).toContain("missing_or_ambiguous_network_observation");
    expect(ambiguous.observer.connection("h1").request(requestBytes(primary))).toEqual(Buffer.alloc(0));
    ambiguous.bridge.stop("test_stop");
    const oversized = await browserFixture();
    oversized.cdp.emit("Network.requestWillBeSent", event);
    oversized.cdp.emit("Fetch.requestPaused", { requestId: "fetch-one", networkId: "one", resourceType: "XHR",
      request: { url: primary, method: "GET", headers: { a: "x".repeat(40000), b: "x".repeat(40000) } } });
    await oversized.bridge.settle();
    expect(oversized.stops).toContain("google_request_header_limit");
    expect(oversized.observer.connection("h1").request(requestBytes(primary))).toEqual(Buffer.alloc(0));
    oversized.bridge.stop("test_stop");
  });

  it("fulfills the bound document and local source once and stops a repeated document", async () => {
    const f = await browserFixture();
    await f.dispatch(profile.document_url, "document", "Document");
    await f.dispatch(profile.resources[0].url, "source", "Script");
    expect(f.calls.filter(call => call.method === "Fetch.fulfillRequest")).toHaveLength(2);
    await f.dispatch(profile.document_url, "repeat", "Document");
    expect(f.stops).toContain("repeated_google_local_source");
    expect(f.calls.filter(call => call.method === "Fetch.fulfillRequest")).toHaveLength(2);
    f.bridge.stop("test_stop");
  });
});
