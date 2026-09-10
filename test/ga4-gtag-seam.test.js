// The gtag connector-selection seam — spec 041-01 AC3. Mirrors
// test/pixel-seam.test.js's own AC3 section (the SAME hermetic FakeWorker
// harness test/dom-connector-seam.test.js / test/helix-rum-seam.test.js
// already use — no real Worker, avoids the stale-worktree hang risk).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";

class FakeWorker {
  constructor(url, opts) {
    FakeWorker.last = this;
    FakeWorker.instances.push(this);
    this.url = String(url);
    this.opts = opts;
    this.messages = [];
    this.onmessage = null;
    this.onerror = null;
    this.terminated = 0;
  }
  postMessage(m) { this.messages.push(m); }
  terminate() { this.terminated++; }
}

// Mirrors test/pixel-seam.test.js's AC10 listener-registry harness (the SAME
// global-listener-registry harness test/airlock-dispose.test.js uses).
function makeListenerRegistry() {
  const map = new Map();
  return {
    addEventListener: (type, fn) => {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
    },
    removeEventListener: (type, fn) => {
      const set = map.get(type);
      if (set) set.delete(fn);
    },
    fire(type, ev) {
      for (const fn of [...(map.get(type) || [])]) fn(ev);
    },
    count(type) {
      return map.has(type) ? map.get(type).size : 0;
    },
  };
}

beforeEach(() => {
  FakeWorker.last = null;
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(() => vi.unstubAllGlobals());

const ga4Endpoints = ["https://t0.example/collect"];
const ga4Ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };

const makeGa4 = (opts) =>
  createAirlock({ trackers: 1, workFactor: 0, endpoints: ga4Endpoints, ctx: ga4Ctx, unloadCritical: [], ...opts });

const makeGtag = (opts) => {
  const connectorConfig = { measurementId: "G-XXXX", ctx: ga4Ctx, endpoint: "https://www.google-analytics.com/g/collect" };
  return createAirlock({
    endpoints: [connectorConfig.endpoint],
    ctx: ga4Ctx,
    connector: "ga4-gtag",
    connectorConfig,
    ...opts,
  });
};

describe("AC3 — the gtag connector-selection seam", () => {
  it("a ga4-gtag-configured airlock constructs the GA4-GTAG chamber worker + posts a generalized init message ({type:'init', ...connectorConfig})", () => {
    const connectorConfig = { measurementId: "G-XXXX", ctx: ga4Ctx, endpoint: "https://www.google-analytics.com/g/collect" };
    makeGtag({ connectorConfig });

    expect(FakeWorker.last.url.endsWith("ga4-gtag-chamber.worker.js")).toBe(true);
    expect(FakeWorker.last.opts).toEqual({ type: "module" });
    expect(FakeWorker.last.messages[0]).toEqual({ type: "init", ...connectorConfig });
  });

  it("REGRESSION — no `connector` option still constructs the GA4 chamber worker + posts the OLD GA4-shaped init message, byte-unchanged", () => {
    makeGa4();

    expect(FakeWorker.last.url.endsWith("ga4-gtag-chamber.worker.js")).toBe(false);
    expect(FakeWorker.last.url.endsWith("chamber.worker.js")).toBe(true);
    expect(FakeWorker.last.messages[0]).toEqual({
      type: "init",
      trackers: 1,
      workFactor: 0,
      endpoints: ga4Endpoints,
      ctx: ga4Ctx,
    });
  });

  it("REGRESSION — connector:'pixel' still constructs the pixel chamber worker, unaffected by the new ga4-gtag branch", () => {
    const connectorConfig = { endpoint: "https://facebook.example/tr", pixelId: "PIXEL123", eventMap: {}, paramMap: {} };
    createAirlock({
      trackers: 1, workFactor: 0, endpoints: [connectorConfig.endpoint], ctx: {},
      connector: "pixel", connectorConfig,
    });

    expect(FakeWorker.last.url.endsWith("pixel-chamber.worker.js")).toBe(true);
    expect(FakeWorker.last.url.endsWith("ga4-gtag-chamber.worker.js")).toBe(false);
    expect(FakeWorker.last.messages[0]).toEqual({ type: "init", ...connectorConfig });
  });

  it("the returned handle does NOT expose the raw `worker` for connector:'ga4-gtag' (only the dom branch does)", () => {
    const gtag = makeGtag();
    expect(gtag.worker).toBeUndefined();
  });
});

// Mirrors test/pixel-seam.test.js's "AC10 — no GA4 mis-map at unload" section,
// for the ga4-gtag connector: it is the SAME class as pixel (worker-mapped,
// GET-egress, NO main-thread critical mapper), so it needs the SAME
// neutralization at the SAME two gates (core/airlock.js's unload-wiring gate
// and pushCritical gate) — a residual the 041-01 pass disclosed but deferred.
describe("AC10 (041-01 follow-up) — no GA4 mis-map at unload for connector:'ga4-gtag'", () => {
  let registry;
  beforeEach(() => {
    registry = makeListenerRegistry();
    vi.stubGlobal("addEventListener", registry.addEventListener);
    vi.stubGlobal("removeEventListener", registry.removeEventListener);
    vi.stubGlobal("requestIdleCallback", () => 1);
  });

  // Consent granted on the connector's own declared purpose (ga4-gtag-connector.test.js:
  // manifest.purposes.egress === ["analytics_storage"]) so the counterfactual is real —
  // WITHOUT the gate, the (then-wired) pagehide listener -> unloadFlush ->
  // criticalDispatchGated -> the unconditionally-constructed GA4 `critical` dispatcher
  // (mapToMp) WOULD map+POST to `/mp/collect`-shaped output, mis-mapping the GET-only
  // /g/collect connector.
  const grantedOpts = { egressPurposes: ["analytics_storage"], consent: { analytics_storage: "granted" } };

  it("a ga4-gtag instance registers NO visibilitychange/pagehide listener at all", () => {
    makeGtag(grantedOpts);

    expect(registry.count("visibilitychange")).toBe(0);
    expect(registry.count("pagehide")).toBe(0);
  });

  it("a ga4-gtag event still ring-resident at pagehide is NOT mapped-and-POSTed — dropped, not GA4-mis-mapped", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeGtag(grantedOpts);

    airlock.push({ event: "page_view" }); // enqueued into the ring, never drained
    registry.fire("pagehide"); // the ga4-gtag instance wired NO pagehide listener, so nothing runs

    expect(fetchMock).not.toHaveBeenCalled(); // no GA4-mis-mapped POST, no beacon at all — dropped
  });

  it("pushCritical on a ga4-gtag instance DROPS + emits a diagnose warn, never GA4-maps+POSTs", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    const airlock = makeGtag({ ...grantedOpts, onDiagnostic });

    airlock.pushCritical({ event: "page_view" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warn", kind: "dropped" }),
    );
  });

  it("REGRESSION — pushCritical on a GA4 instance is UNCHANGED: it still maps+POSTs (the gtag guard is connector-scoped)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeGa4({ unloadCritical: [] });

    airlock.pushCritical({ event: "page_view", page_location: "https://spike.example/" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(ga4Endpoints[0]);
    expect(init.method).toBe("POST");
  });

  it("REGRESSION — a GA4 instance's unload path is UNCHANGED: it still wires visibilitychange/pagehide and still flushes the ring tail as a POST", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeGa4({ unloadCritical: [] });

    expect(registry.count("visibilitychange")).toBe(1);
    expect(registry.count("pagehide")).toBe(1);

    airlock.push({ event: "page_view", page_location: "https://spike.example/" });
    registry.fire("pagehide");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(ga4Endpoints[0]);
    expect(init.method).toBe("POST");
  });
});
