import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { createCriticalDispatcher, KEEPALIVE_BUDGET_BYTES } from "../core/egress.js";

// The OQ10 unload fast path maps SYNCHRONOUSLY on the main thread. It must produce
// the SAME contract-conformant MP body the worker produces — so we validate its
// output against the pinned schema too (the ga4_mp_conformance link holds on the
// unload path, not only the worker path).
const schema = JSON.parse(
  readFileSync(new URL("../contracts/ga4-mp-request.schema.json", import.meta.url)),
);
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };
const endpoints = ["https://t0.example/collect", "https://t1.example/collect", "https://t2.example/collect"];

describe("critical dispatcher (OQ10 unload fast path)", () => {
  it("maps synchronously and issues one keepalive POST per tracker", () => {
    const fetchImpl = vi.fn(() => Promise.resolve());
    const d = createCriticalDispatcher({ ctx, endpoints, trackers: 3, fetchImpl });

    d.dispatch({ type: "page_view", params: { page_location: "https://spike.example/pricing" } });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    for (const [url, init] of fetchImpl.mock.calls) {
      expect(endpoints).toContain(url);
      expect(init).toMatchObject({ method: "POST", keepalive: true });
    }
    expect(d.stats().fastDispatched).toBe(3);
  });

  it("produces a payload that passes the PINNED GA4 MP contract", () => {
    const fetchImpl = vi.fn(() => Promise.resolve());
    const d = createCriticalDispatcher({ ctx, endpoints, trackers: 1, fetchImpl });

    d.dispatch({ type: "page_view", params: { page_location: "https://spike.example/x" } });

    const sent = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(validate(sent)).toBe(true); // byte-identical to the worker's mapToMp output
    expect(sent.client_id).toBe("1234567890.1700000000");
    expect(sent.events[0].params.session_id).toBe("1724668790");
  });

  it("issues every send BEFORE dispatch() returns (no awaiting — the point at teardown)", () => {
    let issuedDuringCall = 0;
    const fetchImpl = vi.fn(() => { issuedDuringCall++; return Promise.resolve(); });
    const d = createCriticalDispatcher({ ctx, endpoints, trackers: 3, fetchImpl });

    d.dispatch({ type: "click", params: { link_url: "https://out.example" } });

    expect(issuedDuringCall).toBe(3); // all synchronous — nothing deferred to a microtask
  });

  it("enforces the aggregate keepalive budget — drops and counts once exhausted", () => {
    const fetchImpl = vi.fn(() => Promise.resolve());
    // 50 bytes/body, budget 80 → only the first tracker fits; the other two drop.
    const d = createCriticalDispatcher({
      ctx, endpoints, trackers: 3, fetchImpl, budgetBytes: 80, encode: () => 50,
    });

    d.dispatch({ type: "page_view", params: {} });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(d.stats().fastDispatched).toBe(1);
    expect(d.stats().fastDropped).toBe(2);
    expect(d.bytesUsed()).toBe(50);
  });

  it("swallows fetch failure without throwing (fire-and-forget at teardown)", () => {
    const fetchImpl = vi.fn(() => { throw new Error("network down"); });
    const d = createCriticalDispatcher({ ctx, endpoints, trackers: 2, fetchImpl });

    expect(() => d.dispatch({ type: "page_view", params: {} })).not.toThrow();
    expect(d.stats().fastDropped).toBe(2);
    expect(d.stats().fastDispatched).toBe(0);
  });

  it("defaults the budget to Chrome's 64 KiB aggregate keepalive cap", () => {
    expect(KEEPALIVE_BUDGET_BYTES).toBe(64 * 1024);
  });
});

// spec 042-01 — a connector-generic GET requestMapper path, additive to the
// POST-only dispatcher above. Present -> dispatch(event) issues one fetch per
// EgressRequest the mapper returns, GET/POST-aware via the SAME fetchInit
// shape the steady-state worker seam uses (core/airlock.js). Absent -> the
// POST per-tracker path above runs byte-unchanged (AC1's default clause).
describe("createCriticalDispatcher — requestMapper GET path (spec 042-01)", () => {
  it("AC1/AC2 — a requestMapper returning one GET request issues ONE bodyless keepalive GET; bytesUsed() stays 0 (A2)", () => {
    const fetchImpl = vi.fn(() => Promise.resolve());
    const requestMapper = () => [
      { url: "https://www.google-analytics.com/g/collect?v=2&tid=G-XXXX", method: "GET" },
    ];
    const d = createCriticalDispatcher({ requestMapper, fetchImpl });

    d.dispatch({ type: "page_view", params: {} });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://www.google-analytics.com/g/collect?v=2&tid=G-XXXX");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined(); // a real fetch(url, {method:"GET", body}) throws — must be omitted
    expect(init.keepalive).toBe(true);
    expect(d.bytesUsed()).toBe(0); // a GET carries no body -> no budget consumed
    expect(d.stats().fastDispatched).toBe(1);
  });

  it("AC2 — a requestMapper returning [] is a clean no-op: no fetch, no fastDropped, no throw", () => {
    const fetchImpl = vi.fn(() => Promise.resolve());
    const requestMapper = () => [];
    // endpoints/trackers ALSO supplied (unlike a requestMapper-only construction) so
    // this is a genuine discriminator: if `requestMapper` were ever ignored, dispatch
    // would silently fall through to the legacy per-tracker POST path below and issue
    // an UNWANTED POST to this endpoint instead of staying a no-op.
    const d = createCriticalDispatcher({
      requestMapper, fetchImpl, endpoints: ["https://should-not-be-hit.example/collect"], trackers: 1,
    });

    expect(() => d.dispatch({ type: "unmapped", params: {} })).not.toThrow();

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(d.stats().fastDropped).toBe(0);
    expect(d.stats().fastDispatched).toBe(0);
  });

  it("AC1 — multiple requests from one requestMapper call are each dispatched", () => {
    const fetchImpl = vi.fn(() => Promise.resolve());
    const requestMapper = () => [
      { url: "https://a.example/collect?x=1", method: "GET" },
      { url: "https://a.example/collect?x=2", method: "GET" },
      { url: "https://a.example/collect?x=3", method: "GET" },
    ];
    const d = createCriticalDispatcher({ requestMapper, fetchImpl });

    d.dispatch({ type: "page_view", params: {} });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(d.stats().fastDispatched).toBe(3);
  });

  it("AC1 — a thrown fetchImpl on the requestMapper path counts fastDropped (fire-and-forget, never throws out of dispatch())", () => {
    const fetchImpl = vi.fn(() => { throw new Error("network down"); });
    const requestMapper = () => [{ url: "https://a.example/collect", method: "GET" }];
    const d = createCriticalDispatcher({ requestMapper, fetchImpl });

    expect(() => d.dispatch({ type: "page_view", params: {} })).not.toThrow();

    expect(d.stats().fastDropped).toBe(1);
    expect(d.stats().fastDispatched).toBe(0);
  });

  it("AC1 REGRESSION — with NO requestMapper, the default POST per-tracker path runs byte-unchanged", () => {
    const fetchImpl = vi.fn(() => Promise.resolve());
    const d = createCriticalDispatcher({ ctx, endpoints, trackers: 1, fetchImpl }); // no requestMapper

    d.dispatch({ type: "page_view", params: { page_location: "https://spike.example/" } });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(endpoints).toContain(url);
    expect(init.method).toBe("POST"); // the default is POST, never GET, absent a requestMapper
    expect(typeof init.body).toBe("string");
    expect(init.keepalive).toBe(true);
  });
});
