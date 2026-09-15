// The floodlight connector-selection seam — spec 048-02 AC1. Mirrors
// test/google-ads-seam.test.js's own shape (the SAME hermetic FakeWorker harness
// test/dom-connector-seam.test.js / test/helix-rum-seam.test.js already use — no real Worker, avoids
// the stale-worktree hang risk). Proves the `core/airlock.js` `connector === "floodlight"` branch
// (Worker-URL selection, the init-message shape, and the requestMapper case for the unload/critical
// GET tail) exists and is wired — an un-branched boot must NOT silently pass: absent the branch,
// `makeFloodlight` below would construct the DEFAULT GA4-MP chamber.worker.js instead, and the very
// first assertion (`.url.endsWith("floodlight-chamber.worker.js")`) would go red.
//
// WIRE SHAPE (048-02 deviation, see core/floodlight-chamber.worker.js's header): floodlight's OWN
// connectorConfig carries a field literally named `type` (the Floodlight-native activity tag), which
// collides with the init message's `type:"init"` discriminant under a top-level spread — so, UNLIKE
// every other connector's `{ type: "init", ...connectorConfig }` shape, floodlight's init message
// NESTS the config: `{ type: "init", connectorConfig }`.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";
import { createFloodlightConnector } from "../connectors/floodlight/connector.js";
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

// Mirrors test/google-ads-seam.test.js's listener-registry harness.
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

const dcEndpoint = "https://www.google.com/ccm/collect";
const dcActivityEndpoint = "https://ad.doubleclick.net/activity";
const dcCtx = { consent: { ad_storage: "granted", analytics_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" } };

const makeGa4 = (opts) =>
  createAirlock({ trackers: 1, workFactor: 0, endpoints: ["https://t0.example/collect"], ctx: {}, unloadCritical: [], ...opts });

const makeFloodlight = (opts) => {
  const connectorConfig = { conversionId: "DC-1234567890", src: "1234567", type: "grptag00", cat: "acttag00", ctx: dcCtx, endpoint: dcEndpoint };
  return createAirlock({
    endpoints: [connectorConfig.endpoint, `${dcActivityEndpoint};src=1234567`],
    ctx: dcCtx,
    connector: "floodlight",
    connectorConfig,
    ...opts,
  });
};

describe("AC1 — the floodlight connector-selection seam", () => {
  it("a floodlight-configured airlock constructs the FLOODLIGHT chamber worker + posts a NESTED init message ({type:'init', connectorConfig})", () => {
    const connectorConfig = { conversionId: "DC-1234567890", src: "1234567", type: "grptag00", cat: "acttag00", ctx: dcCtx, endpoint: dcEndpoint };
    makeFloodlight({ connectorConfig });

    expect(FakeWorker.last.url.endsWith("floodlight-chamber.worker.js")).toBe(true);
    expect(FakeWorker.last.opts).toEqual({ type: "module" });
    // NESTED (not spread) — see this file's + floodlight-chamber.worker.js's own header comment.
    expect(FakeWorker.last.messages[0]).toEqual({ type: "init", connectorConfig });
  });

  it("REGRESSION — no `connector` option still constructs the GA4 chamber worker, unaffected by the new floodlight branch", () => {
    makeGa4();

    expect(FakeWorker.last.url.endsWith("floodlight-chamber.worker.js")).toBe(false);
    expect(FakeWorker.last.url.endsWith("chamber.worker.js")).toBe(true);
  });

  it("REGRESSION — connector:'google-ads' still constructs the google-ads chamber worker (a top-level SPREAD init), unaffected by the new floodlight branch", () => {
    const connectorConfig = { conversionId: "AW-1234567890", ctx: {}, endpoint: "https://www.google.com/ccm/collect" };
    createAirlock({
      endpoints: [connectorConfig.endpoint], ctx: {},
      connector: "google-ads", connectorConfig,
    });

    expect(FakeWorker.last.url.endsWith("google-ads-chamber.worker.js")).toBe(true);
    expect(FakeWorker.last.url.endsWith("floodlight-chamber.worker.js")).toBe(false);
    // google-ads keeps the SPREAD shape (its config has no `type` field) — proves the floodlight
    // nesting is its own bespoke branch, not a generalization that changed every connector's wire shape.
    expect(FakeWorker.last.messages[0]).toEqual({ type: "init", ...connectorConfig });
  });

  it("the returned handle does NOT expose the raw `worker` for connector:'floodlight' (only the dom branch does)", () => {
    const dc = makeFloodlight();
    expect(dc.worker).toBeUndefined();
  });
});

// Mirrors test/google-ads-seam.test.js's "a google-ads instance flushes at unload via its OWN GET
// requestMapper" section: floodlight is the SAME class (worker-mapped, GET-egress), needing its OWN
// requestMapper wired into core/egress.js's critical dispatcher — for BOTH DC forms.
describe("AC1 — a floodlight instance flushes at unload via its OWN GET requestMapper, for BOTH DC forms", () => {
  let registry;
  beforeEach(() => {
    registry = makeListenerRegistry();
    vi.stubGlobal("addEventListener", registry.addEventListener);
    vi.stubGlobal("removeEventListener", registry.removeEventListener);
    vi.stubGlobal("requestIdleCallback", () => 1);
  });

  const grantedOpts = { egressPurposes: ["ad_storage"], consent: { ad_storage: "granted" } };
  const dcConnectorConfig = { conversionId: "DC-1234567890", src: "1234567", type: "grptag00", cat: "acttag00", ctx: dcCtx, endpoint: dcEndpoint };

  it("a floodlight instance registers exactly one visibilitychange and one pagehide listener", () => {
    makeFloodlight(grantedOpts);

    expect(registry.count("visibilitychange")).toBe(1);
    expect(registry.count("pagehide")).toBe(1);
  });

  it("a floodlight event still ring-resident at pagehide flushes as BOTH a ccm/collect GET and a ;-matrix activity GET — not GA4-mis-mapped, not dropped", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeFloodlight(grantedOpts);

    airlock.push({ event: "page_view", page_location: "https://spike.example/" }); // enqueued into the ring, never drained
    registry.fire("pagehide"); // now wired -> unloadFlush -> criticalDispatchGated -> the floodlight requestMapper (fans out to 2)

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls.some((u) => u.startsWith(dcEndpoint))).toBe(true);
    expect(urls.some((u) => u.startsWith(dcActivityEndpoint))).toBe(true);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.method).toBe("GET");
      expect(init.body).toBeUndefined(); // a GET carries no body
      expect(init.keepalive).toBe(true);
    }
  });

  it("pushCritical on a floodlight instance maps + issues BOTH GETs, no drop", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    const airlock = makeFloodlight({ ...grantedOpts, onDiagnostic });

    airlock.pushCritical({ event: "page_view", page_location: "https://spike.example/" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onDiagnostic).not.toHaveBeenCalledWith(expect.objectContaining({ level: "warn", kind: "dropped" }));
  });

  it("AC1 cross-path parity — the flushed unload GET URLs equal the URLs the WORKER path (createConnectorHost.routeBatch) produces for the SAME governed descriptor", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeFloodlight(grantedOpts);

    airlock.push({ event: "page_view", page_location: "https://spike.example/pricing" });
    registry.fire("pagehide");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const mainThreadUrls = fetchMock.mock.calls.map(([url]) => url).sort();

    // The WORKER path, constructed INDEPENDENTLY (a fresh createConnectorHost instance with the SAME
    // config makeFloodlight() uses internally) — a genuine cross-path comparison.
    const host = createConnectorHost(createFloodlightConnector, dcConnectorConfig);
    await host.init({});
    const { ready } = await host.routeBatch([
      { type: "page_view", params: { page_location: "https://spike.example/pricing" } },
    ]);

    expect(mainThreadUrls).toEqual(ready.map((r) => r.url).sort());
  });

  it("an un-granted ad_storage purpose still DROPs a floodlight unload flush (no hold at teardown — 017-03 AC4), diagnosing kind:'consent'", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    const airlock = makeFloodlight({
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
