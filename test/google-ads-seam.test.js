// The google-ads connector-selection seam — spec 048-01 AC1. Mirrors
// test/ga4-gtag-seam.test.js's own AC3-shaped section (the SAME hermetic FakeWorker
// harness test/dom-connector-seam.test.js / test/helix-rum-seam.test.js already use —
// no real Worker, avoids the stale-worktree hang risk). Proves the `core/airlock.js`
// `connector === "google-ads"` branch (Worker-URL selection, the init-message shape,
// and the requestMapper case for the unload/critical GET tail) exists and is wired —
// an un-branched boot must NOT silently pass: absent the branch, `makeGoogleAds` below
// would construct the DEFAULT GA4-MP chamber.worker.js instead, and the very first
// assertion (`.url.endsWith("google-ads-chamber.worker.js")`) would go red.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";
import { createGoogleAdsConnector } from "../connectors/google-ads/connector.js";
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

// Mirrors test/ga4-gtag-seam.test.js's AC10 listener-registry harness.
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

const gAdsEndpoint = "https://www.google.com/ccm/collect";
const gAdsCtx = { consent: { ad_storage: "granted", analytics_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" } };

const makeGa4 = (opts) =>
  createAirlock({ trackers: 1, workFactor: 0, endpoints: ["https://t0.example/collect"], ctx: {}, unloadCritical: [], ...opts });

const makeGoogleAds = (opts) => {
  const connectorConfig = { conversionId: "AW-1234567890", ctx: gAdsCtx, endpoint: gAdsEndpoint };
  return createAirlock({
    endpoints: [connectorConfig.endpoint],
    ctx: gAdsCtx,
    connector: "google-ads",
    connectorConfig,
    ...opts,
  });
};

describe("AC1 — the google-ads connector-selection seam", () => {
  it("a google-ads-configured airlock constructs the GOOGLE-ADS chamber worker + posts a generalized init message ({type:'init', ...connectorConfig})", () => {
    const connectorConfig = { conversionId: "AW-1234567890", ctx: gAdsCtx, endpoint: gAdsEndpoint };
    makeGoogleAds({ connectorConfig });

    expect(FakeWorker.last.url.endsWith("google-ads-chamber.worker.js")).toBe(true);
    expect(FakeWorker.last.opts).toEqual({ type: "module" });
    expect(FakeWorker.last.messages[0]).toEqual({ type: "init", ...connectorConfig });
  });

  it("REGRESSION — no `connector` option still constructs the GA4 chamber worker, unaffected by the new google-ads branch", () => {
    makeGa4();

    expect(FakeWorker.last.url.endsWith("google-ads-chamber.worker.js")).toBe(false);
    expect(FakeWorker.last.url.endsWith("chamber.worker.js")).toBe(true);
  });

  it("REGRESSION — connector:'ga4-gtag' still constructs the gtag chamber worker, unaffected by the new google-ads branch", () => {
    const connectorConfig = { measurementId: "G-XXXX", ctx: {}, endpoint: "https://www.google-analytics.com/g/collect" };
    createAirlock({
      endpoints: [connectorConfig.endpoint], ctx: {},
      connector: "ga4-gtag", connectorConfig,
    });

    expect(FakeWorker.last.url.endsWith("ga4-gtag-chamber.worker.js")).toBe(true);
    expect(FakeWorker.last.url.endsWith("google-ads-chamber.worker.js")).toBe(false);
  });

  it("the returned handle does NOT expose the raw `worker` for connector:'google-ads' (only the dom branch does)", () => {
    const gAds = makeGoogleAds();
    expect(gAds.worker).toBeUndefined();
  });
});

// Mirrors test/ga4-gtag-seam.test.js's "AC10/042-01" section: a google-ads instance is
// the SAME class as gtag/pixel (worker-mapped, GET-egress, needs its OWN requestMapper
// wired into core/egress.js's critical dispatcher or its unload/pushCritical tail would
// silently mis-map via the default GA4-MP mapToMp instead of the AW ccm/collect GET).
describe("AC1 — a google-ads instance flushes at unload via its OWN GET requestMapper (mirrors ga4-gtag/pixel's 042-01 wiring)", () => {
  let registry;
  beforeEach(() => {
    registry = makeListenerRegistry();
    vi.stubGlobal("addEventListener", registry.addEventListener);
    vi.stubGlobal("removeEventListener", registry.removeEventListener);
    vi.stubGlobal("requestIdleCallback", () => 1);
  });

  const grantedOpts = { egressPurposes: ["ad_storage"], consent: { ad_storage: "granted" } };
  const gAdsConnectorConfig = { conversionId: "AW-1234567890", ctx: gAdsCtx, endpoint: gAdsEndpoint };

  it("a google-ads instance registers exactly one visibilitychange and one pagehide listener", () => {
    makeGoogleAds(grantedOpts);

    expect(registry.count("visibilitychange")).toBe(1);
    expect(registry.count("pagehide")).toBe(1);
  });

  it("a google-ads event still ring-resident at pagehide flushes as a ccm/collect GET — not GA4-mis-mapped", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeGoogleAds(grantedOpts);

    airlock.push({ event: "page_view", page_location: "https://spike.example/" }); // enqueued into the ring, never drained
    registry.fire("pagehide"); // now wired -> unloadFlush -> criticalDispatchGated -> the google-ads requestMapper

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.startsWith(gAdsEndpoint)).toBe(true);
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined(); // a GET carries no body
    expect(init.keepalive).toBe(true);
  });

  it("pushCritical on a google-ads instance maps + issues a ccm/collect GET, no drop", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    const airlock = makeGoogleAds({ ...grantedOpts, onDiagnostic });

    airlock.pushCritical({ event: "page_view", page_location: "https://spike.example/" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.startsWith(gAdsEndpoint)).toBe(true);
    expect(init.method).toBe("GET");
    expect(onDiagnostic).not.toHaveBeenCalledWith(expect.objectContaining({ level: "warn", kind: "dropped" }));
  });

  it("AC1 cross-path parity — the flushed unload GET URL equals the URL the WORKER path (createConnectorHost.routeBatch) produces for the SAME governed descriptor", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeGoogleAds(grantedOpts);

    airlock.push({ event: "page_view", page_location: "https://spike.example/pricing" });
    registry.fire("pagehide");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [mainThreadUrl] = fetchMock.mock.calls[0];

    // The WORKER path, constructed INDEPENDENTLY (a fresh createConnectorHost instance
    // with the SAME config makeGoogleAds() uses internally) — a genuine cross-path
    // comparison, not a self-comparison of the same main-thread requestMapper instance.
    const host = createConnectorHost(createGoogleAdsConnector, gAdsConnectorConfig);
    await host.init({});
    const { ready } = await host.routeBatch([
      { type: "page_view", params: { page_location: "https://spike.example/pricing" } },
    ]);

    expect(mainThreadUrl).toBe(ready[0].url);
  });

  it("an un-granted ad_storage purpose still DROPs a google-ads unload flush (no hold at teardown — 017-03 AC4), diagnosing kind:'consent'", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    const airlock = makeGoogleAds({
      egressPurposes: ["ad_storage"],
      consent: { ad_storage: "denied" },
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
});
