// Connector-generic unload dispatcher — spec 030-01. Generalizes core/egress.js's
// createCriticalDispatcher to take a connector's own main-thread mapper (DI, default
// GA4 mapToMp = byte-unchanged), so a worker-mapped connector (helix-rum) egresses its
// unload-critical events (INP/late-CLS at page-hide) via mapToRum instead of being
// GA4-mis-mapped/dropped. Synthetic identifiers only.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCriticalDispatcher } from "../core/egress.js";
import { createAirlock } from "../core/airlock.js";
import { mapToRum } from "../connectors/helix-rum/map.js";

const GA4_CTX = { sessionId: "1724668790", clientId: "1234567890.1700000000" };
const RUM_CTX = { referer: "https://site.example/page" };
const RUM_SAMPLING = { weight: 100, id: "synth-id-0" }; // synthetic per-page sampling
const RUM_ENDPOINT = "https://ot.aem.live/.rum/100";

describe("createCriticalDispatcher — the mapper DI (030-01)", () => {
  it("AC1 — DEFAULT is GA4 mapToMp (byte-unchanged): the body carries the MP session fields", () => {
    const sent = [];
    const d = createCriticalDispatcher({
      ctx: GA4_CTX,
      endpoints: ["https://t0.example/collect"],
      fetchImpl: (url, init) => { sent.push({ url, body: JSON.parse(init.body), method: init.method }); return Promise.resolve({}); },
    });
    d.dispatch({ type: "page_view", params: { page_location: "https://site.example/" } });
    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe("POST");
    expect(sent[0].body.events[0].params.session_id).toBe("1724668790"); // GA4 MP shape (mapToMp)
    expect(sent[0].body).not.toHaveProperty("checkpoint"); // NOT the RUM shape
  });

  it("AC2 — a mapToRum-closure mapper egresses the RUM shape to ot.aem.live, NOT the GA4 shape", () => {
    const sent = [];
    const d = createCriticalDispatcher({
      ctx: RUM_CTX,
      endpoints: [RUM_ENDPOINT],
      mapper: (event, ctx) => mapToRum(event, ctx, RUM_SAMPLING),
      fetchImpl: (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return Promise.resolve({}); },
    });
    d.dispatch({ type: "cwv", ts: 123, params: { name: "INP", value: 8 } });
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe(RUM_ENDPOINT);
    // RUM base shape (mapToRum), NOT GA4 (no session_id/engagement_time_msec):
    expect(sent[0].body).toMatchObject({ weight: 100, id: "synth-id-0", referer: "https://site.example/page", checkpoint: "cwv", t: 123 });
    expect(sent[0].body).not.toHaveProperty("session_id");
  });

  it("AC5 — the keepalive budget + drop-count survive the generalization", () => {
    let n = 0;
    const d = createCriticalDispatcher({
      ctx: RUM_CTX,
      endpoints: [RUM_ENDPOINT],
      mapper: (e, c) => mapToRum(e, c, RUM_SAMPLING),
      budgetBytes: 10, // tiny — the first send exceeds it
      fetchImpl: () => { n++; return Promise.resolve({}); },
    });
    d.dispatch({ type: "top", ts: 1, params: {} });
    expect(n).toBe(0); // over budget -> dropped, not sent
    expect(d.stats().fastDropped).toBe(1);
  });
});

// FakeWorker (mirrors test/pixel-seam.test.js) — createAirlock constructs a Worker;
// the unload/pushCritical path is MAIN-THREAD, so the worker is inert here.
class FakeWorker {
  constructor() { FakeWorker.last = this; this.onmessage = null; this.onerror = null; }
  postMessage() {}
  terminate() {}
}

describe("createAirlock — a helix-rum instance's critical dispatch is RUM-shaped (030-01 AC3/AC4 witness)", () => {
  beforeEach(() => {
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
  });
  afterEach(() => vi.unstubAllGlobals());

  const bodyOf = (call) => JSON.parse(call[1].body);

  it("AC3/AC4 — pushCritical('cwv') on a helix-rum instance egresses the RUM shape to ot.aem.live (never GA4-mis-mapped)", () => {
    const handle = createAirlock({
      connector: "helix-rum",
      connectorConfig: { sampling: RUM_SAMPLING },
      endpoints: [RUM_ENDPOINT],
      ctx: RUM_CTX,
      trackers: 1,
      unloadCritical: [],
    });
    handle.pushCritical({ event: "cwv", name: "INP", value: 8 });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe(RUM_ENDPOINT);
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ weight: 100, id: "synth-id-0", checkpoint: "cwv" }); // RUM shape (mapToRum)
    expect(body).not.toHaveProperty("client_id"); // NOT GA4 — the witness: under the old GA4-hardcoded mapper this would be {client_id, events:[…]}
    expect(body).not.toHaveProperty("events");
  });

  it("AC3/AC4 — the REAL ring-tail unload path (visibilitychange→hidden) egresses a RUM cwv with a NON-ZERO t", () => {
    const listeners = {};
    vi.stubGlobal("addEventListener", (type, fn) => { listeners[type] = fn; });
    vi.stubGlobal("removeEventListener", () => {});
    vi.stubGlobal("document", { visibilityState: "hidden" });
    vi.stubGlobal("requestIdleCallback", () => {}); // no-op -> the pushed event stays in the ring (not drained)

    const handle = createAirlock({
      connector: "helix-rum",
      connectorConfig: { sampling: RUM_SAMPLING },
      endpoints: [RUM_ENDPOINT],
      ctx: RUM_CTX,
      trackers: 1,
      unloadCritical: [],
    });
    handle.push({ event: "cwv", name: "INP", value: 8 }); // steady-state push -> ring (rIC no-op, so undrained)
    expect(globalThis.fetch).not.toHaveBeenCalled(); // not sent yet

    listeners.visibilitychange(); // fire the REAL unload path -> unloadFlush -> mapToRum
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.checkpoint).toBe("cwv");
    expect(typeof body.t).toBe("number");
    expect(body.t).toBeGreaterThan(0); // the ts-forwarding fix — NOT t:0 (which the dropped-ts bug produced)
  });

  it("AC (fail-loud) — a helix-rum instance WITHOUT connectorConfig.sampling is surfaced loudly (never silently GA4-degraded)", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    createAirlock({ connector: "helix-rum", endpoints: [RUM_ENDPOINT], ctx: RUM_CTX, trackers: 1, unloadCritical: [] });
    expect(errSpy).toHaveBeenCalledWith(expect.stringMatching(/helix-rum.*without connectorConfig\.sampling/i));
    errSpy.mockRestore();
  });

  it("AC1 (regression) — a GA4 instance's pushCritical stays GA4 MP-shaped (byte-unchanged; no mapper passed)", () => {
    const handle = createAirlock({
      trackers: 1,
      endpoints: ["https://t0.example/collect"],
      ctx: GA4_CTX,
      unloadCritical: [],
    });
    handle.pushCritical({ event: "page_view", page_location: "https://site.example/" });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.events[0].params.session_id).toBe("1724668790"); // GA4 MP shape (mapToMp default) — unchanged
    expect(body).not.toHaveProperty("checkpoint");
  });
});
