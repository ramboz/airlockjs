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
