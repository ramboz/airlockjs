// Meta Pixel through the generic connector — spec 026-01 AC3-AC10 (the
// vertical, governed-egress proof). Reuses the SAME FakeWorker harness
// test/consent-seal.test.js / test/endpoint-ceiling-seam.test.js /
// test/helix-rum-seam.test.js already use (no real Worker — hermetic, avoids
// the stale-worktree hang risk), and the SAME global-listener-registry
// harness test/airlock-dispose.test.js uses for AC10's unload-wiring proof.
//
// Every GA4-shaped assertion here is a REGRESSION proof (AC3/AC4/AC10 each
// require one): core/airlock.js's method-aware-dispatch + connector-selection
// + conditional-unload-wiring changes must leave GA4's own POST dispatch,
// selection, and unload path byte-unchanged — proven directly, alongside the
// full existing GA4 seam suites (consent-seal/endpoint-ceiling-seam/
// chamber-observability/airlock-dispose/eds-boot), which this slice does not
// modify and which stay green.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";
import { createPixelConnector } from "../connectors/pixel/connector.js";
import { createMetaPixelConfig, SYNTHETIC_META_PIXEL_ID, META_TR_ENDPOINT } from "../connectors/pixel/vendors/meta.js";

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

const ga4Endpoints = ["https://t0.example/collect"];
const ga4Ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };
const metaConfig = createMetaPixelConfig();
const readyMsg = (reqs) => ({ data: { ready: reqs, dropped: [] } });

const pixelConnector = createPixelConnector(metaConfig);
/** Build the SAME EgressRequest[] a real pixel chamber would hand back for one event. */
const metaReady = (event) => pixelConnector.handle(event);

beforeEach(() => {
  FakeWorker.last = null;
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(() => vi.unstubAllGlobals());

const makeGa4 = (opts) =>
  createAirlock({ trackers: 1, workFactor: 0, endpoints: ga4Endpoints, ctx: ga4Ctx, unloadCritical: [], ...opts });

const makeMeta = (opts) =>
  createAirlock({
    trackers: 1,
    workFactor: 0,
    endpoints: [metaConfig.endpoint],
    ctx: {},
    unloadCritical: [],
    connector: "pixel",
    connectorConfig: metaConfig,
    egressPurposes: ["ad_storage"],
    ...opts,
  });

describe("AC3 — the connector-selection seam", () => {
  it("a pixel-configured airlock constructs the PIXEL chamber worker + posts a generalized init message ({type:'init', ...connectorConfig})", () => {
    makeMeta();

    expect(FakeWorker.last.url.endsWith("pixel-chamber.worker.js")).toBe(true);
    expect(FakeWorker.last.messages[0]).toEqual({ type: "init", ...metaConfig });
  });

  it("REGRESSION — no `connector` option still constructs the GA4 chamber worker + posts the OLD GA4-shaped init message, byte-unchanged", () => {
    makeGa4();

    expect(FakeWorker.last.url.endsWith("pixel-chamber.worker.js")).toBe(false);
    expect(FakeWorker.last.url.endsWith("chamber.worker.js")).toBe(true);
    expect(FakeWorker.last.messages[0]).toEqual({
      type: "init",
      trackers: 1,
      workFactor: 0,
      endpoints: ga4Endpoints,
      ctx: ga4Ctx,
    });
  });
});

describe("AC4 — method-aware dispatch (three sites: :176 held record, :201 steady, :363 flush)", () => {
  it("a GET ready request dispatches as GET with NO body (steady-state, :201)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    makeMeta({ consent: { ad_storage: "granted" } });

    const [req] = metaReady({ type: "page_view", params: {} });
    FakeWorker.last.onmessage(readyMsg([req]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(req.url);
    expect(init.method).toBe("GET");
    expect(init.keepalive).toBe(true);
    expect(init).not.toHaveProperty("body"); // GET must never carry a body
  });

  it("REGRESSION — a POST (GA4-shaped, no `method` field) ready request dispatches EXACTLY as before (:201)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    makeGa4();

    FakeWorker.last.onmessage(readyMsg([{ url: ga4Endpoints[0], body: '{"n":1}' }]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      ga4Endpoints[0],
      expect.objectContaining({ method: "POST", body: '{"n":1}', keepalive: true }),
    );
  });

  it("a HELD GET (:176 captures `method`) flushes as a GET, not a POST, once consent grants (:363)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeMeta(); // no consent -> pending -> held

    const [req] = metaReady({ type: "lead", params: { value: 9, currency: "USD" } });
    FakeWorker.last.onmessage(readyMsg([req]));
    expect(fetchMock).not.toHaveBeenCalled(); // held, not sent

    airlock.setConsent({ ad_storage: "granted" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(req.url);
    expect(init.method).toBe("GET");
    expect(init).not.toHaveProperty("body");
  });

  it("REGRESSION — a held GA4 POST still flushes as POST with its body intact (:363)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeGa4({ egressPurposes: ["analytics_storage"] }); // no consent -> held

    FakeWorker.last.onmessage(readyMsg([{ url: ga4Endpoints[0], body: '{"held":1}' }]));
    expect(fetchMock).not.toHaveBeenCalled();

    airlock.setConsent({ analytics_storage: "granted" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      ga4Endpoints[0],
      expect.objectContaining({ method: "POST", body: '{"held":1}', keepalive: true }),
    );
  });
});

describe("AC5 — the beacon ships end-to-end (event -> connector.handle -> seal -> dispatcher)", () => {
  it("a governed Meta /tr GET is actually dispatched — the fetch spy sees a GET with the mapped query", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    makeMeta({ consent: { ad_storage: "granted" } });

    const [req] = metaReady({ type: "lead", params: { value: 42, currency: "USD", content_name: "Trial" } });
    FakeWorker.last.onmessage(readyMsg([req]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(META_TR_ENDPOINT);
    expect(parsed.searchParams.get("id")).toBe(SYNTHETIC_META_PIXEL_ID);
    expect(parsed.searchParams.get("ev")).toBe("Lead");
    expect(parsed.searchParams.get("value")).toBe("42");
    expect(parsed.searchParams.get("currency")).toBe("USD");
    expect(parsed.searchParams.get("content_name")).toBe("Trial");
  });
});

describe("AC6 — the seal binds: consent-gated, and the flush is a GET (exercises airlock.js:163)", () => {
  it("consent absent (pending) -> HELD at the seal, zero fetch", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    makeMeta({ onDiagnostic }); // no consent opt -> analytics/ad_storage resolves "pending"

    const [req] = metaReady({ type: "page_view", params: {} });
    FakeWorker.last.onmessage(readyMsg([req]));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic.mock.calls[0][0]).toMatchObject({
      level: "warn", kind: "consent", disposition: "held", purpose: "ad_storage",
    });
  });

  it("granted -> the fetch spy sees the FLUSHED beacon dispatched as a GET to facebook.com/tr (the exact :176->:363 path)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeMeta();

    const [req] = metaReady({ type: "page_view", params: {} });
    FakeWorker.last.onmessage(readyMsg([req]));
    expect(fetchMock).not.toHaveBeenCalled();

    airlock.setConsent({ ad_storage: "granted" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.startsWith(META_TR_ENDPOINT)).toBe(true);
    expect(url).toContain("facebook.com/tr");
    expect(init.method).toBe("GET");
    expect(init).not.toHaveProperty("body");
  });

  it("denied + strict -> DROPPED (no hold, no beacon, nothing to later flush)", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeMeta({ onDiagnostic, consentStrict: true, consent: { ad_storage: "denied" } });

    const [req] = metaReady({ type: "page_view", params: {} });
    FakeWorker.last.onmessage(readyMsg([req]));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic.mock.calls[0][0]).toMatchObject({ kind: "consent", disposition: "dropped" });

    onDiagnostic.mockClear();
    airlock.setConsent({ ad_storage: "granted" }); // nothing was held -> no-op
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AC7 — the seal binds: endpoint-confined to facebook.com (airlock.js:194)", () => {
  it("the connector's own declared-endpoint beacon dispatches (host ceiling matches)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    makeMeta({ consent: { ad_storage: "granted" } });

    const [req] = metaReady({ type: "page_view", params: {} });
    FakeWorker.last.onmessage(readyMsg([req]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a config naming an OUTSIDE endpoint cannot widen egress — the host ceiling still holds it (advisory manifest endpoints)", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    // Host stays pinned to the REAL facebook.com/tr endpoint (ADR-0006: the
    // host allow-list is authoritative), regardless of what a (compromised or
    // misconfigured) connector config claims.
    makeMeta({ onDiagnostic, consent: { ad_storage: "granted" } });

    const compromised = createPixelConnector({ ...metaConfig, endpoint: "https://evil.example/tr" });
    const [evilReq] = compromised.handle({ type: "page_view", params: {} });
    FakeWorker.last.onmessage(readyMsg([evilReq]));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic.mock.calls[0][0]).toMatchObject({ kind: "endpoint-ceiling", disposition: "held" });
  });
});

describe("AC8 — no PII in the query string (a REAL strip, not `email` never having entered params)", () => {
  it("`email`, explicitly wired into the Meta instance's payloadDenylist, is present on the input event yet PROVABLY ABSENT from the dispatched URL", () => {
    vi.stubGlobal("requestIdleCallback", (cb) => { cb({ didTimeout: false, timeRemaining: () => 0 }); return 1; });
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);

    // The paramMap DOES map `email` (a naive custom-data field a real
    // integration might pass) -> were it not for the seal's governance strip,
    // it WOULD appear in the query string. This is what makes the "provably
    // absent" proof real rather than "the connector never looked at that
    // field" (the built-in DEFAULT_DENYLIST is password/ssn/cvv/card — NOT
    // email, airlock.js:59-67 — so `email` must be explicitly wired).
    const configWithEmailMapping = {
      ...metaConfig,
      paramMap: { ...metaConfig.paramMap, email: { from: "params", key: "email" } },
    };
    const connectorWithEmail = createPixelConnector(configWithEmailMapping);

    // Sanity: absent governance, this exact paramMap WOULD have carried it.
    const [ungoverned] = connectorWithEmail.handle({
      type: "lead", params: { value: 5, currency: "USD", email: "person@example.com" },
    });
    expect(new URL(ungoverned.url).searchParams.get("email")).toBe("person@example.com");

    const airlock = makeMeta({
      connectorConfig: configWithEmailMapping,
      consent: { ad_storage: "granted" },
      payloadDenylist: ["email"], // explicitly wired into the Meta INSTANCE's payloadDenylist
    });

    // Drive the REAL path: push() -> sendBatch -> governParams (input-side
    // strip, BEFORE the event crosses to the chamber) -> worker.postMessage.
    airlock.push({ event: "lead", value: 5, currency: "USD", email: "person@example.com" });

    const eventsMsg = FakeWorker.last.messages.find((m) => m.type === "events");
    expect(eventsMsg.batch[0].params.email).toBeUndefined(); // governed BEFORE crossing — the real strip
    expect(eventsMsg.batch[0].params.value).toBe(5); // benign fields pass through unchanged

    // Simulate the chamber's real response: the SAME email-capable connector
    // maps the (already-governed) event — even the paramMap that WOULD
    // serialize email, given governed input, cannot produce one.
    const [req] = connectorWithEmail.handle({ type: "lead", params: eventsMsg.batch[0].params });
    FakeWorker.last.onmessage(readyMsg([req]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [dispatchedUrl] = fetchMock.mock.calls[0];
    expect(dispatchedUrl).not.toContain("email");
    expect(dispatchedUrl).not.toContain("person@example.com");
    expect(new URL(dispatchedUrl).searchParams.has("email")).toBe(false);
  });
});

describe("AC9 — identity honesty: no _fbp/fbc cookie identity, no ud[...] advanced matching", () => {
  it("PageView and Lead beacons never carry _fbp, fbc, or a ud[...] key", () => {
    const events = [
      { type: "page_view", params: {} },
      { type: "lead", params: { value: 1, currency: "USD", content_name: "x" } },
    ];
    for (const event of events) {
      const [req] = metaReady(event);
      expect(req.url).not.toMatch(/_fbp/);
      expect(req.url).not.toMatch(/\bfbc\b/);
      expect(req.url.toLowerCase()).not.toContain("ud%5b");
      expect(req.url.toLowerCase()).not.toContain("ud[");
    }
  });

  it("the manifest requests no cookie capability at all — structurally cannot read _fbp/fbc", () => {
    expect(pixelConnector.manifest.capabilities.cookies).toBeUndefined();
  });
});

describe("AC10 — no GA4 mis-map at unload (airlock.js:277-280 is connector-conditional)", () => {
  let registry;
  beforeEach(() => {
    registry = makeListenerRegistry();
    vi.stubGlobal("addEventListener", registry.addEventListener);
    vi.stubGlobal("removeEventListener", registry.removeEventListener);
    vi.stubGlobal("requestIdleCallback", () => 1);
  });

  it("a pixel instance registers NO visibilitychange/pagehide listener at all", () => {
    makeMeta();

    expect(registry.count("visibilitychange")).toBe(0);
    expect(registry.count("pagehide")).toBe(0);
  });

  it("a pixel event still ring-resident at pagehide is NOT mapped-and-POSTed to facebook.com/tr — dropped, not GA4-mis-mapped (consent GRANTED so the consent gate can't mask the unload-gate)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    // Consent GRANTED (craft-review causality fix): WITHOUT it, the sync/unload
    // consent gate (criticalDispatchGated) drops the event regardless of the
    // :336 unload-wiring gate — the test would pass even if :336 were deleted.
    // Granting consent makes the counterfactual real: were :336 removed, the
    // (then-wired) pagehide listener -> unloadFlush -> critical.dispatch(mapToMp)
    // WOULD POST to facebook.com/tr and fail this assertion.
    const airlock = makeMeta({ consent: { ad_storage: "granted" } });

    airlock.push({ event: "page_view" }); // enqueued into the ring, never drained
    registry.fire("pagehide"); // the pixel instance wired NO pagehide listener, so nothing runs

    expect(fetchMock).not.toHaveBeenCalled(); // no GA4-shaped POST, no beacon at all — the event is simply dropped
  });

  it("pushCritical on a pixel instance is a NO-OP — the SECOND mis-map entry (the frame-critique #2a enumeration missed it), never GA4-maps+POSTs to facebook.com/tr even with consent granted", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    // Consent GRANTED so the counterfactual is real: without the
    // connector==="pixel" guard in pushCritical, criticalDispatchGated ->
    // critical.dispatch (mapToMp) WOULD POST a GA4-shaped body to
    // facebook.com/tr. AC10's neutralization closed the UNLOAD wiring (:336)
    // but pushCritical is a second entry on the raw createAirlock handle.
    const airlock = makeMeta({ consent: { ad_storage: "granted" }, onDiagnostic });

    airlock.pushCritical({ event: "page_view" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warn", kind: "dropped" }),
    );
  });

  it("REGRESSION — pushCritical on a GA4 instance is UNCHANGED: it still maps+POSTs (the pixel guard is connector-scoped)", () => {
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
    expect(typeof init.body).toBe("string");
  });
});
