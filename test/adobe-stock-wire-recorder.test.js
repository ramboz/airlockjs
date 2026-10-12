import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

// RED reaches behavioral assertions, not a failed module import.
const { startStockWireRecorder = async () => ({
  stop: () => Promise.resolve({ report: { counts: {}, errors: [], claims: {} },
    capture: { requests: [], errors: [] } }),
}) } = await import("../probes/adobe-compatibility/stock-wire-recorder.mjs").catch(() => ({}));
const ORIGIN = "https://edge.adobedc.net";
const ID = "12345678-1234-4234-8234-123456789abc";
const URL = `${ORIGIN}/ee/v1/interact?configId=invented-stream&requestId=${ID}`;
const CLAIMS = Object.fromEntries(["sdk_execution_verified", "host_render_verified",
  "chamber_compatibility_verified", "downstream_receipt_verified",
  "full_wire_conformance_verified"].map(k => [k, false]));
const RECORD_KEYS = ["ordinal", "url", "method", "content_type", "request_body",
  "request_observed_at", "response_status", "response_body", "response_observed_at", "error"];
const ERRORS = ["routing_mismatch", "redirect_observed", "request_limit", "byte_limit",
  "invalid_request", "invalid_response", "request_read_failed", "response_read_failed",
  "transport_failed", "incomplete_response", "settle_timeout", "observer_failure"];
const secret = "PRIVATE-SENTINEL";
class Page extends EventEmitter {
  route = vi.fn(() => { throw Error(secret); });
  goto = vi.fn(() => { throw Error(secret); });
}
function request(overrides = {}) {
  return {
    url: vi.fn(() => URL), method: vi.fn(() => "POST"),
    headerValue: vi.fn(async key => { expect(key).toBe("content-type"); return "application/json"; }),
    postDataBuffer: vi.fn(() => Buffer.from('{ "unicode": "雪🙂" }\n')),
    postData: vi.fn(() => { throw Error("lossy fallback forbidden"); }),
    allHeaders: vi.fn(() => { throw Error(secret); }),
    redirectedFrom: vi.fn(() => null), ...overrides,
  };
}
function response(req, overrides = {}) {
  return {
    request: vi.fn(() => req), status: vi.fn(() => 200),
    fromServiceWorker: vi.fn(() => false),
    body: vi.fn(async () => Buffer.from('{"warnings":[{"message":"invented"}],"ok":"雪"}\n')),
    allHeaders: vi.fn(() => { throw Error(secret); }), ...overrides,
  };
}
async function start(options = {}, page = new Page()) {
  return { page, handle: await startStockWireRecorder(page, { datastreamId: "invented-stream", ...options }) };
}
function emitPair(page, req = request(), res = response(req)) {
  page.emit("request", req); page.emit("response", res);
  return { req, res };
}
function frozen(v) {
  if (v && typeof v === "object") {
    expect(Object.isFrozen(v)).toBe(true);
    Object.values(v).forEach(frozen);
  }
}
function result(value, category) {
  const { report: r, capture: c } = value;
  expect(Object.keys(value)).toEqual(["report", "capture"]);
  expect(Object.keys(r)).toEqual(["kind", "schema_version", "source", "overall",
    "exit_code", "counts", "errors", "claims"]);
  expect(r.kind).toBe("airlock.adobe-stock.network-report");
  expect(r.schema_version).toBe(1);
  expect(r.claims).toEqual(CLAIMS);
  expect(Object.keys(r.counts)).toEqual(["observed_requests", "stored_requests",
    "completed_responses", "request_bytes", "response_bytes"]);
  expect(r.overall).toBe(category ? "recording_failed" : "recording_complete");
  expect(r.exit_code).toBe(category ? 1 : 0);
  if (category) expect(r.errors).toContain(category);
  else expect(r.errors).toEqual([]);
  expect(new Set(r.errors).size).toBe(r.errors.length);
  expect(r.errors.every(e => ERRORS.includes(e))).toBe(true);
  expect(Object.keys(c)).toEqual(["kind", "schema_version", "source", "started_at",
    "stopped_at", "requests", "errors"]);
  expect(c.kind).toBe("airlock.adobe-stock.network-capture");
  expect(c.schema_version).toBe(1);
  expect(c.errors).toEqual(r.errors);
  expect(c.source).toBe(r.source);
  expect(["adobe_origin", "loopback_sink"]).toContain(c.source);
  expect(Number.isFinite(Date.parse(c.started_at))).toBe(true);
  expect(Number.isFinite(Date.parse(c.stopped_at))).toBe(true);
  c.requests.forEach(q => expect(Object.keys(q)).toEqual(RECORD_KEYS));
  frozen(value);
  for (const s of [secret, URL, "invented-stream", "雪", "warnings", "Error:"])
    expect(JSON.stringify(r)).not.toContain(s);
  return c.requests;
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};

describe("051-08 AC1 passive original-byte observation and identity pairing", () => {
  it("attaches only three events, preserves serialized Unicode and real API selections", async () => {
    const { page, handle } = await start();
    expect(Object.keys(handle)).toEqual(["stop"]);
    expect(page.eventNames().sort()).toEqual(["request", "requestfailed", "response"]);
    const { req, res } = emitPair(page);
    const value = await handle.stop();
    const [q] = result(value);
    expect(value.report.source).toBe("adobe_origin");
    expect(q).toMatchObject({ ordinal: 1, url: URL, method: "POST",
      content_type: "application/json", request_body: '{ "unicode": "雪🙂" }\n',
      response_status: 200, response_body: '{"warnings":[{"message":"invented"}],"ok":"雪"}\n',
      error: null });
    expect(Number.isFinite(Date.parse(q.request_observed_at))).toBe(true);
    expect(Number.isFinite(Date.parse(q.response_observed_at))).toBe(true);
    expect(value.report.counts).toEqual({ observed_requests: 1, stored_requests: 1,
      completed_responses: 1, request_bytes: Buffer.byteLength(q.request_body),
      response_bytes: Buffer.byteLength(q.response_body) });
    expect(req.headerValue.mock.calls).toEqual([["content-type"]]);
    expect(req.postDataBuffer).toHaveBeenCalledTimes(1);
    for (const f of [req.postData, req.allHeaders, res.allHeaders, page.route, page.goto])
      expect(f).not.toHaveBeenCalled();
    expect(res.body).toHaveBeenCalledTimes(1);
  });
  it("registers synchronously and keeps same-URL identities in observation order despite reverse reads", async () => {
    const { page, handle } = await start();
    const header = deferred(), body = deferred();
    const first = request({ headerValue: vi.fn(() => header.promise),
      postDataBuffer: () => Buffer.from('{"first":1}') });
    const second = request({ postDataBuffer: () => Buffer.from('{"second":2}') });
    page.emit("request", first); page.emit("request", second);
    page.emit("response", response(second, { body: async () => Buffer.from('{"second":2}') }));
    page.emit("response", response(first, { body: () => body.promise }));
    const stopped = handle.stop();
    body.resolve(Buffer.from('{"first":1}')); header.resolve("application/json");
    const records = result(await stopped);
    expect(records.map(q => [q.ordinal, q.request_body, q.response_body])).toEqual([
      [1, '{"first":1}', '{"first":1}'], [2, '{"second":2}', '{"second":2}'],
    ]);
  });
  it("does not cross-pair a same-URL response belonging to a different Request instance", async () => {
    const { page, handle } = await start(), req = request();
    page.emit("request", req);
    const untracked = response(request());
    page.emit("response", untracked);
    expect(result(await handle.stop(), "incomplete_response")[0].response_body).toBeNull();
    expect(untracked.body).not.toHaveBeenCalled();
  });
  it("never calls an invented fromCache API", async () => {
    const { page, handle } = await start(), req = request();
    const getter = vi.fn(() => { throw Error(secret); });
    const res = Object.defineProperty(response(req), "fromCache", { get: getter });
    emitPair(page, req, res);
    result(await handle.stop());
    expect(getter).not.toHaveBeenCalled();
  });
});

describe("051-08 AC2 closed routing, request and response policy", () => {
  it.each(["/ee/v1/interact", "/ee/v1/collect", "/ee/v1/privacy/set-consent",
    ...["or2", "va6", "irl1", "ind1", "jpn3", "sgp3", "aus3"].map(r => `/ee/${r}/v1/interact`),
  ])("accepts known exact action %s with a JSON media type", async path => {
    const { page, handle } = await start();
    emitPair(page, request({ url: () => URL.replace("/ee/v1/interact", path),
      headerValue: async () => "application/json; charset=utf-8" }));
    result(await handle.stop());
  });
  it.each([
    URL.replace("/interact?", "/unknown?"), URL.replace("/v1/", "/xx/v1/"),
    URL.replace("/interact", "/%69nteract"), URL.replace("https:", "http:"),
    URL.replace("edge.adobedc.net", "other.adobedc.net"), URL.replace("edge.adobedc.net", "x.demdex.net"),
    URL.replace("invented-stream", "wrong"), URL.replace("configId=", "%63onfigId="),
    URL.replace(ID, "not-uuid"), `${URL}&extra=1`, `${URL}&configId=invented-stream`,
    `${URL}&requestId=${ID}`, `${URL}#fragment`,
    URL.replace("edge.adobedc.net", "user@edge.adobedc.net"),
    URL.replace("/ee/", "/ee/a/../"),
  ])("records rather than silently ignoring routing drift %s", async url => {
    const { page, handle } = await start();
    emitPair(page, request({ url: () => url }));
    const value = await handle.stop();
    expect(result(value, "routing_mismatch")[0].url).toBe(url);
    expect(value.report.counts.observed_requests).toBe(1);
  });
  it.each(["edge.adobedc.net.", "other.adobedc.net.", "adobedc.net.", "x.demdex.net.", "demdex.net."])(
    "observes terminal DNS dot host %s as routing drift without normalizing raw private data", async host => {
      const url = URL.replace("edge.adobedc.net", host);
      const requestBody = '{ "request": "PRIVATE-SENTINEL" }\n';
      const responseBody = '{ "response": "PRIVATE-SENTINEL" }\n';
      const { page, handle } = await start();
      const req = request({ url: () => url, postDataBuffer: vi.fn(() => Buffer.from(requestBody)) });
      const res = response(req, { body: vi.fn(async () => Buffer.from(responseBody)) });
      emitPair(page, req, res);
      const value = await handle.stop();
      const [q] = result(value, "routing_mismatch");
      expect(q).toMatchObject({ url, request_body: requestBody, response_body: responseBody,
        method: "POST", content_type: "application/json", response_status: 200, error: "routing_mismatch" });
      expect(value.report.errors).toEqual(["routing_mismatch"]);
      expect(value.report.counts).toEqual({ observed_requests: 1, stored_requests: 1,
        completed_responses: 1, request_bytes: Buffer.byteLength(requestBody),
        response_bytes: Buffer.byteLength(responseBody) });
      expect(JSON.stringify(value.report)).not.toContain(host);
      expect(req.headerValue.mock.calls).toEqual([["content-type"]]);
      expect(req.postDataBuffer).toHaveBeenCalledTimes(1);
      expect(res.body).toHaveBeenCalledTimes(1);
      for (const f of [req.allHeaders, req.postData, res.allHeaders, page.route, page.goto])
        expect(f).not.toHaveBeenCalled();
    });
  it.each(["edge.adobedc.net.unrelated.invalid.", "notadobedc.net."])(
    "ignores unrelated terminal DNS dot host %s without reading headers or bodies", async host => {
      const { page, handle } = await start();
      const req = request({ url: () => URL.replace("edge.adobedc.net", host) }), res = response(req);
      emitPair(page, req, res);
      page.emit("requestfailed", req);
      const value = await handle.stop();
      expect(result(value)).toEqual([]);
      expect(value.report.counts).toEqual({ observed_requests: 0, stored_requests: 0,
        completed_responses: 0, request_bytes: 0, response_bytes: 0 });
      for (const f of [req.method, req.headerValue, req.postDataBuffer, req.postData, req.allHeaders,
        res.status, res.fromServiceWorker, res.body, res.allHeaders]) expect(f).not.toHaveBeenCalled();
    });
  it("rejects a terminal DNS dot selected origin before installation, despite classification-only normalization", async () => {
    const page = new Page();
    await expect(startStockWireRecorder(page, { datastreamId: "invented-stream",
      edgeOrigin: "https://edge.adobedc.net." })).rejects.toMatchObject({ reason: "invalid_input" });
    expect(page.eventNames()).toEqual([]);
  });
  it.each([
    ["wrong method", { method: () => "GET" }],
    ["wrong content type", { headerValue: async () => "text/plain" }],
    ["missing body", { postDataBuffer: () => null }],
    ["invalid UTF8", { postDataBuffer: () => Buffer.from([123, 34, 120, 34, 58, 34, 128, 34, 125]) }],
    ...["[]", '{"x":1,"\\u0078":2}', '{"constructor":1}', '{"x":1e999}',
      '{"x":'.repeat(17) + "0" + "}".repeat(17), '{"x":'].map(s =>
      [s, { postDataBuffer: () => Buffer.from(s) }]),
  ])("fails request %s without lossy fallback", async (_label, overrides) => {
    const { page, handle } = await start();
    const { req } = emitPair(page, request(overrides));
    const [q] = result(await handle.stop(), "invalid_request");
    if (_label === "invalid UTF8" || _label === "missing body") expect(q.request_body).toBeNull();
    expect(req.postData).not.toHaveBeenCalled();
  });
  it.each([
    ["512", { status: () => 512 }],
    ["missing status", { status: () => null }],
    ["204 with body", { status: () => 204 }],
    ["service worker", { fromServiceWorker: () => true }],
    ...["[]", "not JSON", '{"x":1,"x":2}', '{"prototype":{}}',
      '{"errors":[{"message":"PRIVATE-SENTINEL"}]}', '{"errorCode":"PRIVATE-SENTINEL"}',
      '{"error":{"message":"PRIVATE-SENTINEL"}}', '{"x":1e999}'].map(s =>
      [s, { body: async () => Buffer.from(s) }]),
    ["invalid UTF8", { body: async () => Buffer.from([128]) }],
  ])("fails response %s with fixed public categories", async (_label, overrides) => {
    const { page, handle } = await start();
    const req = request(); emitPair(page, req, response(req, overrides));
    result(await handle.stop(), "invalid_response");
  });
  it("accepts genuine empty 204 and empty error containers but does not claim processing", async () => {
    const { page, handle } = await start();
    const req = request();
    emitPair(page, req, response(req, { status: () => 204, body: async () => Buffer.alloc(0) }));
    const second = request();
    emitPair(page, second, response(second, { body: async () => Buffer.from('{"errors":[],"error":null}') }));
    expect(result(await handle.stop())[0]).toMatchObject({ response_status: 204, response_body: "" });
  });
  it("redirects and subsequent valid requests cannot repair the recording", async () => {
    const { page, handle } = await start();
    emitPair(page, request({ redirectedFrom: () => request() }));
    emitPair(page);
    expect(result(await handle.stop(), "redirect_observed")).toHaveLength(2);
  });
});

describe("051-08 AC3 bounded storage, draining and quarantined completion", () => {
  it.each([
    ["request", { maxRequestBytes: 2 }, "request_bytes"],
    ["response", { maxResponseBytes: 2 }, "response_bytes"],
    ["aggregate", { maxTotalBytes: 2 }, "request_bytes"],
  ])("rejects %s byte overflow and accounts original bytes", async (_label, options, count) => {
    const { page, handle } = await start(options);
    emitPair(page);
    const value = await handle.stop();
    result(value, "byte_limit");
    expect(value.report.counts[count]).toBeGreaterThan(2);
    if (_label === "request") expect(value.capture.requests[0].request_body).toBeNull();
    if (_label === "response") expect(value.capture.requests[0].response_body).toBeNull();
  });
  it("uses UTF8 byte lengths, not Unicode code-unit length, and allows exact per-body boundaries", async () => {
    const req = request(), bytes = req.postDataBuffer();
    const { page, handle } = await start({ maxRequestBytes: bytes.length - 1 });
    emitPair(page, req);
    const failed = await handle.stop();
    result(failed, "byte_limit");
    expect(failed.report.counts.request_bytes).toBe(bytes.length);
    const exact = await start({ maxRequestBytes: bytes.length });
    emitPair(exact.page);
    result(await exact.handle.stop());
  });
  it("bounds summed body bytes across requests without charging URL/header metadata", async () => {
    const requestBytes = request().postDataBuffer().length;
    const responseBytes = (await response(request()).body()).length;
    const budget = 2 * (requestBytes + responseBytes);
    const { page, handle } = await start({ maxTotalBytes: budget });
    for (let i = 0; i < 3; i++) emitPair(page);
    const value = await handle.stop();
    const records = result(value, "byte_limit");
    const retained = records.reduce((sum, q) => sum
      + Buffer.byteLength(q.request_body ?? "") + Buffer.byteLength(q.response_body ?? ""), 0);
    expect(retained).toBe(budget);
    expect(records.every(q => q.url === URL && q.content_type === "application/json")).toBe(true);
    expect(value.report.counts).toMatchObject({ observed_requests: 3, request_bytes: 3 * requestBytes,
      response_bytes: 3 * responseBytes });
  });
  it.each([8, 2])("counts extra events beyond lowered cap %s without retaining or reading them", async cap => {
    const { page, handle } = await start({ maxRequests: cap });
    for (let i = 0; i < cap; i++) emitPair(page);
    const extra = emitPair(page);
    const value = await handle.stop();
    expect(result(value, "request_limit")).toHaveLength(cap);
    expect(value.report.counts).toMatchObject({ observed_requests: cap + 1,
      stored_requests: cap, completed_responses: cap });
    expect(extra.req.headerValue).not.toHaveBeenCalled();
    expect(extra.req.postDataBuffer).not.toHaveBeenCalled();
    expect(extra.res.body).not.toHaveBeenCalled();
  });
  it("missing response is incomplete, not an invented empty success", async () => {
    const { page, handle } = await start();
    page.emit("request", request());
    const [q] = result(await handle.stop(), "incomplete_response");
    expect(q).toMatchObject({ response_status: null, response_body: null, response_observed_at: null });
  });
  it.each(["request", "response"])("stalled %s reads time out; late settlement and rejection are quarantined", async side => {
    const { page, handle } = await start({ settleTimeoutMs: 20 });
    const stall = deferred();
    const req = request(side === "request" ? { headerValue: () => stall.promise } : {});
    const res = response(req, side === "response" ? { body: () => stall.promise } : {});
    emitPair(page, req, res);
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      const value = await handle.stop();
      result(value, "settle_timeout");
      const before = JSON.stringify(value);
      if (side === "request") stall.resolve("application/json");
      else stall.reject(Error(secret));
      await new Promise(r => setTimeout(r, 30));
      expect(JSON.stringify(value)).toBe(before);
      expect(unhandled).not.toHaveBeenCalled();
      if (side === "request") expect(req.postDataBuffer).not.toHaveBeenCalled();
    } finally { process.off("unhandledRejection", unhandled); }
  });
  it("an incomplete response body is not a successful zero-byte response", async () => {
    const { page, handle } = await start(), req = request();
    emitPair(page, req, response(req, { body: async () => undefined }));
    const value = await handle.stop();
    const [q] = result(value, "response_read_failed");
    expect(q.response_body).toBeNull();
    expect(value.report.counts.completed_responses).toBe(0);
  });
  it("late successful response bytes cannot repair a timeout or mutate either frozen snapshot", async () => {
    const { page, handle } = await start({ settleTimeoutMs: 10 }), req = request(), gate = deferred();
    emitPair(page, req, response(req, { body: () => gate.promise }));
    const value = await handle.stop(), before = JSON.stringify(value);
    const [q] = result(value, "settle_timeout");
    expect(q.response_body).toBeNull();
    expect(value.report.counts.completed_responses).toBe(0);
    gate.resolve(Buffer.from('{"late":"PRIVATE-SENTINEL"}'));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(JSON.stringify(value)).toBe(before);
    expect(await handle.stop()).toBe(value);
  });
  it("stop detaches only owned exact listeners before reads drain and returns the same promise/result", async () => {
    const page = new Page(), caller = vi.fn(), off = vi.spyOn(page, "off");
    for (const name of ["request", "response", "requestfailed"]) page.on(name, caller);
    const { handle } = await start({}, page);
    const gate = deferred(), req = request({ headerValue: () => gate.promise });
    emitPair(page, req);
    const p = handle.stop();
    expect(handle.stop()).toBe(p);
    for (const name of ["request", "response", "requestfailed"]) expect(page.listeners(name)).toEqual([caller]);
    page.emit("request", request());
    gate.resolve("application/json");
    const value = await p;
    result(value);
    expect(value.report.counts.observed_requests).toBe(1);
    expect(await handle.stop()).toBe(value);
    expect(off).toHaveBeenCalledTimes(3);
  });
  it.each(["header", "request body", "response body", "event"])("contains %s exceptions without raw error escape", async side => {
    const { page, handle } = await start();
    const reject = () => { throw Error(secret); };
    if (side === "event") page.emit("request", { url: reject });
    else {
      const req = request(side === "header" ? { headerValue: reject }
        : side === "request body" ? { postDataBuffer: reject } : {});
      emitPair(page, req, response(req, side === "response body" ? { body: reject } : {}));
    }
    result(await handle.stop(), side === "event" ? "observer_failure"
      : side === "response body" ? "response_read_failed" : "request_read_failed");
  });
  it("canceled HTTP remains a transport failure despite a later response", async () => {
    const { page, handle } = await start(), req = request();
    page.emit("request", req); page.emit("requestfailed", req);
    page.emit("response", response(req));
    result(await handle.stop(), "transport_failed");
  });
});

describe("051-08 clarified body-only aggregate and fixed UTF8 scalar ceilings", () => {
  it("passes exactly four body bytes with full metadata and fails one byte below that boundary", async () => {
    for (const budget of [4, 3]) {
      const { page, handle } = await start({
        maxRequestBytes: 2, maxResponseBytes: 2, maxTotalBytes: budget,
      });
      const req = request({ postDataBuffer: () => Buffer.from("{}") });
      emitPair(page, req, response(req, { body: async () => Buffer.from("{}") }));
      const value = await handle.stop();
      const [q] = result(value, budget === 3 ? "byte_limit" : undefined);
      expect(q).toMatchObject({ url: URL, method: "POST", content_type: "application/json" });
      expect(value.report.counts).toMatchObject({ request_bytes: 2, response_bytes: 2 });
      if (budget === 4) expect(q).toMatchObject({ request_body: "{}", response_body: "{}" });
      else expect([q.request_body, q.response_body].filter(v => v !== null)).toEqual(["{}"]);
    }
  });
  it("sums only original body bytes across multiple requests at an exact aggregate boundary", async () => {
    const { page, handle } = await start({ maxTotalBytes: 8 });
    for (let i = 0; i < 2; i++) {
      const req = request({ postDataBuffer: () => Buffer.from("{}") });
      emitPair(page, req, response(req, { body: async () => Buffer.from("{}") }));
    }
    const value = await handle.stop();
    const records = result(value);
    expect(records.map(q => [q.request_body, q.response_body])).toEqual([["{}", "{}"], ["{}", "{}"]]);
    expect(value.report.counts).toMatchObject({ request_bytes: 4, response_bytes: 4 });
    expect(records.every(q => q.url === URL && q.content_type === "application/json")).toBe(true);
  });
  it.each(["adobe_origin", "loopback_sink"])("retains at most 2048 URL bytes for %s, even on routing failures", async source => {
    const origin = source === "adobe_origin" ? "https://other.adobedc.net" : "http://127.0.0.1";
    const prefix = `${origin}/ee/v1/interact?x=`;
    for (const bytes of [2048, 2049]) {
      const url = prefix + "x".repeat(bytes - Buffer.byteLength(prefix));
      const { page, handle } = await start(source === "loopback_sink" ? { edgeOrigin: origin } : {});
      emitPair(page, request({ url: () => url }));
      const value = await handle.stop();
      const [q] = result(value, "routing_mismatch");
      expect(q.url).toBe(bytes === 2048 ? url : null);
      expect(value.report.errors.includes("byte_limit")).toBe(bytes > 2048);
      expect(value.report.counts.request_bytes).toBe(Buffer.byteLength('{ "unicode": "雪🙂" }\n'));
    }
  });
  it("uses UTF8 bytes rather than code units when bounding a malformed selected URL", async () => {
    const prefix = `${ORIGIN}/ee/v1/`, url = prefix + "雪".repeat(700);
    expect(url.length).toBeLessThan(2048);
    expect(Buffer.byteLength(url)).toBeGreaterThan(2048);
    const { page, handle } = await start();
    emitPair(page, request({ url: () => url }));
    const [q] = result(await handle.stop(), "byte_limit");
    expect(q.url).toBeNull();
  });
  it("retains a wrong method at 32 bytes but refuses 33-byte and multibyte-overflow methods", async () => {
    for (const method of ["x".repeat(32), "x".repeat(33), "雪".repeat(11)]) {
      const bytes = Buffer.byteLength(method);
      const { page, handle } = await start();
      emitPair(page, request({ method: () => method }));
      const value = await handle.stop();
      const [q] = result(value, "invalid_request");
      expect(q.method).toBe(bytes <= 32 ? method : null);
      expect(value.report.errors.includes("byte_limit")).toBe(bytes > 32);
    }
  });
  it("retains Content-Type at 1024 UTF8 bytes and refuses 1025 without truncating or changing body counts", async () => {
    const prefix = "application/json; invented=";
    for (const bytes of [1024, 1025]) {
      const contentType = prefix + "雪".repeat(332) + "x".repeat(bytes - Buffer.byteLength(prefix) - 996);
      expect(Buffer.byteLength(contentType)).toBe(bytes);
      const { page, handle } = await start({ maxRequestBytes: 2, maxResponseBytes: 2, maxTotalBytes: 4 });
      const req = request({ headerValue: async () => contentType, postDataBuffer: () => Buffer.from("{}") });
      emitPair(page, req, response(req, { body: async () => Buffer.from("{}") }));
      const value = await handle.stop();
      const [q] = result(value, bytes > 1024 ? "byte_limit" : undefined);
      expect(q.content_type).toBe(bytes === 1024 ? contentType : null);
      expect(q).toMatchObject({ url: URL, method: "POST", request_body: "{}", response_body: "{}" });
      expect(value.report.counts).toMatchObject({ request_bytes: 2, response_bytes: 2 });
    }
  });
  it("accepts a 250-byte Unicode datastream but rejects 251 bytes before installing listeners", async () => {
    for (const bytes of [250, 251]) {
      const datastreamId = "雪".repeat(83) + "x".repeat(bytes - 249), page = new Page();
      expect(datastreamId.length).toBeLessThan(250);
      expect(Buffer.byteLength(datastreamId)).toBe(bytes);
      if (bytes === 251) {
        await expect(startStockWireRecorder(page, { datastreamId })).rejects.toMatchObject({ reason: "invalid_input" });
        expect(page.eventNames()).toEqual([]);
      } else {
        const handle = await startStockWireRecorder(page, { datastreamId });
        emitPair(page, request({ url: () => URL.replace("invented-stream", encodeURIComponent(datastreamId)) }));
        result(await handle.stop());
      }
    }
  });
});

describe("051-08 AC4 privacy, independent snapshots and closed inputs", () => {
  it("ignores unrelated request/response objects without inspecting headers, methods or bodies", async () => {
    const { page, handle } = await start();
    const req = request({ url: () => "https://unrelated.invalid/private" }), res = response(req);
    emitPair(page, req, res); page.emit("requestfailed", req);
    const value = await handle.stop(); result(value);
    expect(value.report.counts.observed_requests).toBe(0);
    for (const f of [req.method, req.headerValue, req.postDataBuffer, req.allHeaders,
      res.status, res.body, res.fromServiceWorker]) expect(f).not.toHaveBeenCalled();
  });
  it("snapshots primitive values and freezes no caller-owned references", async () => {
    const opts = { datastreamId: "invented-stream" }, page = new Page();
    const handle = await startStockWireRecorder(page, opts);
    opts.datastreamId = "changed";
    const { req } = emitPair(page);
    const value = await handle.stop(); result(value);
    req.url = () => secret;
    expect(value.capture.requests[0].url).toBe(URL);
    expect(Object.isFrozen(opts)).toBe(false);
    expect(Object.isFrozen(page)).toBe(false);
  });
  it.each(["http://localhost", "http://localhost:12345", "http://127.0.0.1"])(
    "classifies canonical local receiving origin %s, not an authenticated SDK", async origin => {
      const { page, handle } = await start({ edgeOrigin: origin });
      emitPair(page, request({ url: () => URL.replace(ORIGIN, origin) }));
      const value = await handle.stop(); result(value);
      expect(value.report.source).toBe("loopback_sink");
    });
  const invalid = [
    {}, null, [], { datastreamId: "" }, { datastreamId: "has space" },
    { datastreamId: "x\n" }, { datastreamId: "x".repeat(251) },
    ...["https://other.adobedc.net", "https://localhost", "http://127.1",
      "http://localhost/", "http://LOCALHOST", "http://localhost:0", "http://localhost:65536",
      "http://user@localhost", "http://localhost#x", "http://localhost:080",
      "https://edge.adobedc.net:443"].map(edgeOrigin => ({ datastreamId: "x", edgeOrigin })),
    ...[NaN, Infinity, 0, -1, 1.5, "2", 9].map(maxRequests => ({ datastreamId: "x", maxRequests })),
    ...["maxRequestBytes", "maxResponseBytes", "maxTotalBytes", "settleTimeoutMs"]
      .map(k => ({ datastreamId: "x", [k]: Number.MAX_SAFE_INTEGER })),
    { datastreamId: "x", force: true }, { datastreamId: "x", [Symbol("private")]: 1 },
    Object.assign(Object.create({ force: true }), { datastreamId: "x" }),
  ];
  it.each(invalid.map(v => [v]))("refuses invalid closed options without partial listeners or echoes", async options => {
    const page = new Page();
    await expect(startStockWireRecorder(page, options)).rejects.toMatchObject({
      name: "Error", message: "invalid_input", reason: "invalid_input" });
    expect(page.eventNames()).toEqual([]);
  });
  it("rejects option proxies and getters and Page accessors without invoking them", async () => {
    const getter = vi.fn(() => { throw Error(secret); });
    const proxy = new Proxy({}, { get: getter, ownKeys: getter, getPrototypeOf: getter });
    const options = Object.defineProperty({ datastreamId: "x" }, "edgeOrigin", { get: getter });
    for (const value of [proxy, options])
      await expect(startStockWireRecorder(new Page(), value)).rejects.toMatchObject({ reason: "invalid_input" });
    const page = Object.defineProperty({}, "on", { get: getter });
    await expect(startStockWireRecorder(page, { datastreamId: "x" })).rejects.toMatchObject({ reason: "invalid_input" });
    expect(getter).not.toHaveBeenCalled();
  });
  it.each([null, {}, { on() {} }, { on: 1, off() {} }])("rejects missing Page methods before installation", async page => {
    await expect(startStockWireRecorder(page, { datastreamId: "x" })).rejects.toMatchObject({ reason: "invalid_input" });
  });
  it("rolls back a throwing listener installation without disturbing caller listeners", async () => {
    const page = new Page(), caller = vi.fn(), original = page.on;
    page.on("response", caller);
    page.on = function (name, listener) {
      original.call(this, name, listener);
      if (name === "response") throw Error(secret);
      return this;
    };
    await expect(startStockWireRecorder(page, { datastreamId: "x" })).rejects.toMatchObject({
      reason: "invalid_input", message: "invalid_input" });
    expect(page.listeners("response")).toEqual([caller]);
    expect(page.listeners("request")).toEqual([]);
    expect(page.listeners("requestfailed")).toEqual([]);
  });
  it("import exports only the passive API and performs no automatic file/network/browser work", () => {
    const boot = `
      import fs from "node:fs"; import fsp from "node:fs/promises";
      import http from "node:http"; import https from "node:https";
      import net from "node:net"; import dns from "node:dns";
      import { syncBuiltinESMExports } from "node:module";
      let violations = 0;
      const refuse = () => { violations++; throw Error("PRIVATE-SENTINEL"); };
      process.on("exit", () => { if (violations) process.exitCode = 99; });
      const read = fsp.readFile;
      fsp.readFile = (...args) => {
        if (new Error().stack.includes("at getSource (node:internal/modules/esm/load:") &&
          /\\/(stock-wire-recorder|contract)\\.mjs$/.test(String(args[0]))) return read(...args);
        return refuse();
      };
      for (const key of ["open", "lstat", "writeFile", "appendFile"]) fsp[key] = refuse;
      for (const key of ["open", "openSync", "readFileSync", "writeFile", "writeFileSync"]) fs[key] = refuse;
      for (const mod of [http, https]) { mod.request = refuse; mod.get = refuse; }
      net.connect = refuse; net.createConnection = refuse; dns.lookup = refuse;
      globalThis.fetch = refuse;
      globalThis.window = new Proxy({}, { get: refuse });
      syncBuiltinESMExports();
      process.argv = [process.execPath, "/PRIVATE-SENTINEL", "--input", "/PRIVATE-SENTINEL"];
      const m = await import("./probes/adobe-compatibility/stock-wire-recorder.mjs");
      if (typeof m.startStockWireRecorder !== "function") throw Error("missing export");
      console.log(JSON.stringify(Object.keys(m)));
    `;
    const child = spawnSync(process.execPath, ["--input-type=module", "--eval", boot],
      { encoding: "utf8", env: {}, timeout: 5000 });
    expect(child.status, child.stderr).toBe(0);
    expect(child.stderr).toBe("");
    expect(JSON.parse(child.stdout)).toEqual(["startStockWireRecorder"]);
  });
});

describe("051-08 AC5 real Chromium / ephemeral HTTP receiving sink (not SDK proof)", () => {
  it("matches native POST bytes and real JSON response, including malformed-byte rejection and actual oversize", async () => {
    const received = [];
    const replies = ['{ "reply": "雪🙂" }\n', '{"ok":true}', `{"large":"${"x".repeat(100)}"}`];
    const server = createServer(async (req, res) => {
      if (req.method === "GET") { res.end("<!doctype html><title>Invented local sink</title>"); return; }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      received.push({ url: req.url, method: req.method, contentType: req.headers["content-type"],
        bytes: Buffer.concat(chunks) });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(replies[received.length - 1]);
    });
    let browser;
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const origin = `http://127.0.0.1:${server.address().port}`;
      browser = await chromium.launch({ headless: true, args: [
        "--disable-background-networking", "--disable-component-update",
        "--disable-domain-reliability", "--disable-sync", "--no-first-run",
      ] });
      const context = await browser.newContext({ serviceWorkers: "block" });
      const page = await context.newPage();
      await page.goto(origin); // Bootstrap occurs before attaching; never an SDK POST.
      const valid = Buffer.from('{ "invented": "雪🙂" }\n');
      const malformed = Buffer.from([123, 34, 120, 34, 58, 34, 128, 34, 125]);
      const bodies = [valid, malformed, Buffer.from('{"oversize":true}')];
      for (let i = 0; i < bodies.length; i++) {
        const handle = await startStockWireRecorder(page, { datastreamId: "invented-stream",
          edgeOrigin: origin, ...(i === 2 ? { maxResponseBytes: 10 } : {}) });
        const path = `/ee/v1/interact?configId=invented-stream&requestId=${ID}`;
        const actual = await page.evaluate(async ({ path, bytes }) => {
          const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" },
            body: new Uint8Array(bytes) });
          return { status: res.status, text: await res.text() };
        }, { path, bytes: [...bodies[i]] });
        const value = await handle.stop();
        const [q] = result(value, i === 1 ? "invalid_request" : i === 2 ? "byte_limit" : undefined);
        expect(value.report.source).toBe("loopback_sink");
        expect(value.report.claims).toEqual(CLAIMS);
        expect(received[i]).toEqual({ url: path, method: "POST",
          contentType: "application/json", bytes: bodies[i] });
        expect(q).toMatchObject({ url: `${origin}${path}`, method: received[i].method,
          content_type: received[i].contentType, response_status: actual.status });
        expect(value.report.counts.request_bytes).toBe(bodies[i].length);
        if (i === 1) expect(q.request_body).toBeNull();
        else expect(Buffer.from(q.request_body)).toEqual(received[i].bytes);
        if (i === 2) expect(q.response_body).toBeNull();
        else expect(q.response_body).toBe(actual.text);
        expect(actual.text).toBe(replies[i]);
      }
    } finally {
      if (browser) await browser.close();
      await new Promise(resolve => server.close(resolve));
    }
  }, 20000);
});
