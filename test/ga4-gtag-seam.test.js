// The gtag connector-selection seam — spec 041-01 AC3. Mirrors
// test/pixel-seam.test.js's own AC3 section (the SAME hermetic FakeWorker
// harness test/dom-connector-seam.test.js / test/helix-rum-seam.test.js
// already use — no real Worker, avoids the stale-worktree hang risk).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";
import { createGa4GtagConnector } from "../connectors/ga4/gtag.js";
import { createConnectorHost } from "../core/connector-host.js";

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
// for the ga4-gtag connector: it was the SAME class as pixel (worker-mapped,
// GET-egress, NO main-thread critical mapper) — 041-01 neutralized the mis-map
// by dropping (gating the unload wiring out + dropping pushCritical). Spec
// 042-01 resolves the drop half of that residual for gtag: the unload/
// pushCritical paths now flush via a `requestMapper` (gtag's own `handle`,
// the SAME EgressRequest[]-returning function the worker chamber hosts) wired
// into the SAME `critical` dispatcher (core/egress.js's createCriticalDispatcher).
// So the three drop assertions below are FLIPPED to GET-flush assertions.
// Pixel stays gated/dropped until 042-02.
describe("AC10/042-01 — a ga4-gtag instance flushes at unload via its OWN GET requestMapper (was: dropped, to avoid a GA4 mis-map)", () => {
  let registry;
  beforeEach(() => {
    registry = makeListenerRegistry();
    vi.stubGlobal("addEventListener", registry.addEventListener);
    vi.stubGlobal("removeEventListener", registry.removeEventListener);
    vi.stubGlobal("requestIdleCallback", () => 1);
  });

  // Consent granted on the connector's own declared purpose (ga4-gtag-connector.test.js:
  // manifest.purposes.egress === ["analytics_storage"]) so the counterfactual is real —
  // WITHOUT 042-01's requestMapper wiring, the (now-wired) pagehide listener ->
  // unloadFlush -> criticalDispatchGated -> the unconditionally-constructed GA4
  // `critical` dispatcher (mapToMp) WOULD map+POST to `/mp/collect`-shaped output,
  // mis-mapping the GET-only /g/collect connector. 042-01 closes that counterfactual
  // by correct GET dispatch, not by dropping.
  const grantedOpts = { egressPurposes: ["analytics_storage"], consent: { analytics_storage: "granted" } };
  const gtagConnectorConfig = { measurementId: "G-XXXX", ctx: ga4Ctx, endpoint: "https://www.google-analytics.com/g/collect" };

  it("a ga4-gtag instance registers exactly one visibilitychange and one pagehide listener (unload wiring is no longer gated)", () => {
    makeGtag(grantedOpts);

    expect(registry.count("visibilitychange")).toBe(1);
    expect(registry.count("pagehide")).toBe(1);
  });

  it("a ga4-gtag event still ring-resident at pagehide flushes as a /g/collect GET — not GA4-mis-mapped, no longer dropped", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeGtag(grantedOpts);

    airlock.push({ event: "page_view" }); // enqueued into the ring, never drained
    registry.fire("pagehide"); // now wired -> unloadFlush -> criticalDispatchGated -> the gtag requestMapper

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.startsWith("https://www.google-analytics.com/g/collect")).toBe(true);
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined(); // a GET carries no body (A2)
    expect(init.keepalive).toBe(true);
  });

  it("pushCritical on a ga4-gtag instance maps + issues a /g/collect GET, no longer drops", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    const airlock = makeGtag({ ...grantedOpts, onDiagnostic });

    airlock.pushCritical({ event: "page_view" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.startsWith("https://www.google-analytics.com/g/collect")).toBe(true);
    expect(init.method).toBe("GET");
    expect(onDiagnostic).not.toHaveBeenCalledWith(
      expect.objectContaining({ level: "warn", kind: "dropped" }),
    );
  });

  it("AC5 witnessed hazard — a page_view pushed then flushed at a REAL visibilitychange->hidden egresses a /g/collect GET (before 042-01: silently dropped)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { visibilityState: "hidden" });
    const airlock = makeGtag(grantedOpts);

    airlock.push({ event: "page_view" }); // ring-resident; the stubbed requestIdleCallback never drains it
    registry.fire("visibilitychange"); // the REAL unload path: onVisibilityChange -> unloadFlush

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.startsWith("https://www.google-analytics.com/g/collect")).toBe(true);
    expect(init.method).toBe("GET");
  });

  it("AC5 cross-path parity — the flushed unload GET URL equals the URL the WORKER path (createConnectorHost.routeBatch) produces for the SAME governed descriptor", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeGtag(grantedOpts);

    airlock.push({ event: "page_view", page_location: "https://spike.example/pricing" });
    registry.fire("pagehide");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [mainThreadUrl] = fetchMock.mock.calls[0];

    // The WORKER path, constructed INDEPENDENTLY (a fresh createConnectorHost
    // instance with the SAME config makeGtag() uses internally) — a genuine
    // cross-path comparison, not a self-comparison of the same main-thread
    // requestMapper/handle instance.
    const host = createConnectorHost(createGa4GtagConnector, gtagConnectorConfig);
    await host.init({});
    const { ready } = await host.routeBatch([
      { type: "page_view", params: { page_location: "https://spike.example/pricing" } },
    ]);

    expect(mainThreadUrl).toBe(ready[0].url);
  });

  it("AC6 — governParams still strips a denylisted field (e.g. `password`) before the gtag GET mapper ever sees it", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeGtag(grantedOpts);

    airlock.push({ event: "page_view", password: "hunter2" });
    registry.fire("pagehide");

    expect(fetchMock).toHaveBeenCalledTimes(1); // still flushes — governance strips the field, doesn't drop the beacon
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET"); // the gtag GET mapper ran, not a GA4-mis-mapped POST
    expect(new URL(url).searchParams.has("ep.password")).toBe(false); // stripped before the mapper ever saw it
  });

  it("AC6 — an un-granted analytics_storage purpose still DROPs a gtag unload flush (no hold at teardown — 017-03 AC4), diagnosing kind:'consent'", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    const airlock = makeGtag({
      egressPurposes: ["analytics_storage"],
      consent: { analytics_storage: "denied" },
      consentStrict: true, // non-strict "denied" alone SENDs (017-02's cookie concern) — strict is required to DROP
      onDiagnostic,
    });

    airlock.push({ event: "page_view" });
    registry.fire("pagehide");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warn", kind: "consent", disposition: "dropped" }),
    );
  });

  it("REGRESSION — pushCritical on a GA4 instance is UNCHANGED: it still maps+POSTs (the gtag wiring is connector-scoped)", () => {
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
