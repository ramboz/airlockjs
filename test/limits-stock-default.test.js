// Spec 067-06 (ADR-0062 point 6): no cap, queue limit, ring size or byte budget
// drops or delays stock output by default. Tighter limits are opt-in. The
// consent-hold ring cap (067-02) is untouched.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";
import { createCriticalDispatcher, KEEPALIVE_BUDGET_BYTES } from "../core/egress.js";

class FakeWorker {
  constructor() {
    FakeWorker.last = this;
    this.messages = [];
    this.onmessage = null;
  }
  postMessage(m) { this.messages.push(m); }
  terminate() {}
}

const GA4 = "https://www.google-analytics.com/mp/collect";
const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };
const BURST = 600; // > 200 (hold cap), > 50 (drain chunk)

let fetchMock;
let listeners;
let idle;
beforeEach(() => {
  FakeWorker.last = null;
  listeners = {};
  idle = [];
  fetchMock = vi.fn(() => Promise.resolve());
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("addEventListener", (type, fn) => { listeners[type] = fn; });
  vi.stubGlobal("removeEventListener", () => {});
  vi.stubGlobal("requestIdleCallback", (cb) => { idle.push(cb); return 1; });
});
afterEach(() => vi.unstubAllGlobals());

const make = (opts = {}) => {
  const onDiagnostic = vi.fn();
  const airlock = createAirlock({
    trackers: 1, workFactor: 0, ctx, endpoints: [GA4], unloadCritical: [], consentHold: false, onDiagnostic, ...opts,
  });
  return { airlock, onDiagnostic };
};
const runIdle = () => { while (idle.length) idle.shift()({ didTimeout: false, timeRemaining: () => 0 }); };
const big = "x".repeat(300);

describe("AC1/AC4/AC7 — stock default path: a burst past every former cap loses nothing", () => {
  it("steady state: the ring drains in chunks, every event reaches the worker in order", () => {
    const { airlock } = make();
    for (let i = 0; i < BURST; i++) airlock.push({ event: "e", i });
    runIdle();

    const batches = FakeWorker.last.messages.filter((m) => m.type === "events").map((m) => m.batch);
    expect(batches.length).toBeGreaterThan(1); // chunked, not capped
    expect(batches.flat().map((d) => d.params.i)).toEqual(Array.from({ length: BURST }, (_, i) => i));
  });

  it("steady state: a worker reply of any size is dispatched in full and in order", () => {
    make();
    const ready = Array.from({ length: BURST }, (_, i) => ({ url: GA4, method: "POST", body: `{"i":${i}}` }));
    FakeWorker.last.onmessage({ data: { ready, dropped: [] } });

    expect(fetchMock).toHaveBeenCalledTimes(BURST);
    expect(fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).i)).toEqual(ready.map((_, i) => i));
  });

  it("unload: a ring tail far past 64 KiB is sent in full, in order, with nothing dropped", () => {
    const { airlock } = make();
    for (let i = 0; i < BURST; i++) airlock.push({ event: "e", i, pad: big });
    listeners.pagehide();

    expect(fetchMock).toHaveBeenCalledTimes(BURST);
    const bodies = fetchMock.mock.calls.map((c) => c[1].body);
    expect(bodies.reduce((n, b) => n + b.length, 0)).toBeGreaterThan(KEEPALIVE_BUDGET_BYTES);
    expect(bodies.map((b) => JSON.parse(b).events[0].params.i)).toEqual(Array.from({ length: BURST }, (_, i) => i));
    expect(airlock.stats().fastDropped).toBe(0);
  });
});

describe("AC2 — the keepalive budget no longer discards what stock would send", () => {
  const events = Array.from({ length: 5 }, () => ({ type: "page_view", params: { pad: big } }));

  it("past the browser's keepalive limit the send falls back to plain fetch instead of dropping", () => {
    const sendFetch = vi.fn(() => Promise.resolve());
    const d = createCriticalDispatcher({
      ctx, endpoints: [GA4], trackers: 1, fetchImpl: sendFetch, encode: () => KEEPALIVE_BUDGET_BYTES / 2 + 1,
    });
    for (const e of events) d.dispatch(e);

    expect(sendFetch).toHaveBeenCalledTimes(5);
    expect(sendFetch.mock.calls[0][1].keepalive).toBe(true);
    expect(sendFetch.mock.calls[1][1].keepalive).toBeUndefined(); // would exceed the browser limit
    expect(d.stats().fastDropped).toBe(0);
    expect(d.stats().fastOverKeepaliveLimit).toBe(4);
    expect(d.bytesUsed()).toBeLessThanOrEqual(KEEPALIVE_BUDGET_BYTES);
  });
});

describe("AC2 — settled keepalive requests free their bytes", () => {
  it("a later send is keepalive again once earlier ones settle", async () => {
    const sendFetch = vi.fn(() => Promise.resolve());
    const d = createCriticalDispatcher({
      ctx, endpoints: [GA4], trackers: 1, fetchImpl: sendFetch, encode: () => KEEPALIVE_BUDGET_BYTES,
    });
    d.dispatch({ type: "page_view", params: {} });
    d.dispatch({ type: "page_view", params: {} });
    expect(sendFetch.mock.calls[1][1].keepalive).toBeUndefined();
    await Promise.resolve();
    await Promise.resolve();
    d.dispatch({ type: "page_view", params: {} });
    expect(sendFetch.mock.calls[2][1].keepalive).toBe(true);
  });
});

describe("AC2 — steady-state and consent-flush sends share the in-flight keepalive accounting", () => {
  const half = "y".repeat(KEEPALIVE_BUDGET_BYTES / 2 + 100);
  const reqs = [0, 1, 2].map((i) => ({ url: GA4, method: "POST", body: JSON.stringify({ i, half }) }));

  it("steady-state dispatch: the send that would pass the limit goes out plain, one fetch each, in order", () => {
    fetchMock.mockImplementation(() => new Promise(() => {})); // stay in flight
    make();
    FakeWorker.last.onmessage({ data: { ready: reqs, dropped: [] } });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map((c) => c[1].keepalive)).toEqual([true, undefined, undefined]);
    expect(fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).i)).toEqual([0, 1, 2]);
  });

  it("steady-state dispatch: a settled request frees its bytes", async () => {
    make();
    FakeWorker.last.onmessage({ data: { ready: [reqs[0]], dropped: [] } });
    await Promise.resolve();
    await Promise.resolve();
    FakeWorker.last.onmessage({ data: { ready: [reqs[1]], dropped: [] } });

    expect(fetchMock.mock.calls.map((c) => c[1].keepalive)).toEqual([true, true]);
  });

  it("consent-grant flush: the same accounting applies", () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const { airlock } = make({ consentHold: true, consent: { analytics_storage: "pending" }, egressPurposes: ["analytics_storage"] });
    FakeWorker.last.onmessage({ data: { ready: reqs, dropped: [] } });
    expect(fetchMock).not.toHaveBeenCalled();
    airlock.setConsent({ analytics_storage: "granted" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map((c) => c[1].keepalive)).toEqual([true, undefined, undefined]);
  });
});

describe("AC3/AC7 — a tighter keepalive budget is opt-in and its drop is its own state", () => {
  it("dispatcher: past an explicit budgetBytes, sends are dropped, counted and reported", () => {
    const sendFetch = vi.fn(() => Promise.resolve());
    const onBudgetDrop = vi.fn();
    const d = createCriticalDispatcher({
      ctx, endpoints: [GA4], trackers: 1, fetchImpl: sendFetch, budgetBytes: 100, encode: () => 60, onBudgetDrop,
    });
    d.dispatch({ type: "page_view", params: {} });
    d.dispatch({ type: "page_view", params: {} });

    expect(sendFetch).toHaveBeenCalledTimes(1);
    expect(d.stats().fastDropped).toBe(1);
    expect(onBudgetDrop).toHaveBeenCalledTimes(1);
  });

  it("createAirlock keepaliveBudgetBytes: an unload tail past it drops with a diagnostic", () => {
    const { airlock, onDiagnostic } = make({ keepaliveBudgetBytes: 2000 });
    for (let i = 0; i < 20; i++) airlock.push({ event: "e", i, pad: big });
    listeners.pagehide();

    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.length).toBeLessThan(20);
    const drops = onDiagnostic.mock.calls.map((c) => c[0]).filter((d) => d.kind === "keepalive-budget");
    expect(drops).toHaveLength(20 - fetchMock.mock.calls.length);
    expect(airlock.stats().fastDropped).toBe(drops.length);
  });
});

describe("AC5 — what remains is batching, not dropping", () => {
  it("the 50-event drain chunk delays nothing: flushNow sends the whole ring", () => {
    const { airlock } = make();
    for (let i = 0; i < 120; i++) airlock.push({ event: "e", i });
    airlock.flushNow();

    const sent = FakeWorker.last.messages.filter((m) => m.type === "events").flatMap((m) => m.batch);
    expect(sent).toHaveLength(120);
  });
});

describe("AC6 — the consent-hold ring cap is unchanged (067-02)", () => {
  it("still drops the oldest past 200 with a cap-200 diagnostic", () => {
    const { onDiagnostic } = make({ consentHold: true, consent: { analytics_storage: "pending" }, egressPurposes: ["analytics_storage"] });
    const ready = Array.from({ length: 201 }, (_, i) => ({ url: GA4, method: "POST", body: `{"i":${i}}` }));
    FakeWorker.last.onmessage({ data: { ready, dropped: [] } });

    const dropped = onDiagnostic.mock.calls.map((c) => c[0]).filter((x) => x.disposition === "dropped");
    expect(dropped).toHaveLength(1);
    expect(dropped[0].reason).toMatch(/cap 200/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
