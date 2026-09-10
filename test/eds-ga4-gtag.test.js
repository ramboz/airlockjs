// bootGa4Gtag — the EDS adapter's gtag wiring, spec 041-01 AC4. Mirrors
// test/eds-boot.test.js's own ctx-sourcing/consent-wiring pattern for
// bootEdsAnalytics/bootGa4Core, and test/eds-meta-pixel.test.js's own
// no-pushCritical-exposed precedent (bootMetaPixel's doc comment: a
// worker-mapped, GET-egress connector has no main-thread critical mapper, so
// exposing pushCritical would route through the UNCONDITIONALLY-constructed
// GA4-MP critical dispatcher — a mis-map, not a beacon; the SAME reasoning
// applies verbatim to gtag, which is equally worker-mapped/GET-egress).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bootGa4Gtag } from "../adapters/eds/index.js";
import { GA4_GTAG_COLLECT_ENDPOINT, createGa4GtagConnector } from "../connectors/ga4/gtag.js";
import { shapeMpConsent } from "../connectors/ga4/consent.js";

class FakeWorker {
  constructor(url, opts) {
    FakeWorker.last = this;
    this.url = String(url);
    this.opts = opts;
    this.messages = [];
    this.onmessage = null;
    this.terminated = 0;
  }
  postMessage(m) { this.messages.push(m); }
  terminate() { this.terminated++; }
}

const fakeDocument = (initialCookie = "") => {
  const writes = [];
  return {
    writes,
    get cookie() { return initialCookie; },
    set cookie(v) { writes.push(v); },
    visibilityState: "visible",
  };
};

const initMsg = () => FakeWorker.last.messages.find((m) => m.type === "init");

beforeEach(() => {
  FakeWorker.last = null;
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve()));
});
afterEach(() => vi.unstubAllGlobals());

describe("bootGa4Gtag (spec 041-01 AC4 — the boot-happy-path skeleton)", () => {
  it("boots the GA4-GTAG chamber, ceiled to the /g/collect endpoint (NOT the MP DEFAULT_ENDPOINTS)", async () => {
    const ctx = { clientId: "1.1", sessionId: "2" };
    await bootGa4Gtag({ ctx, measurementId: "G-XXXX" });

    expect(FakeWorker.last.url.endsWith("ga4-gtag-chamber.worker.js")).toBe(true);
    const init = initMsg();
    expect(init.measurementId).toBe("G-XXXX");
    expect(init.endpoint).toBe(GA4_GTAG_COLLECT_ENDPOINT);
    expect(init.ctx).toEqual(ctx);
  });

  it("an explicit opts.ctx override skips cookie sourcing entirely (rig/test escape hatch, mirrors bootGa4Core)", async () => {
    // NO document stub: if boot touched document.cookie despite the override,
    // the bare `document` reference would throw and fail this test.
    const provided = { clientId: "9.9", sessionId: "8" };

    const handle = await bootGa4Gtag({ ctx: provided, measurementId: "G-XXXX" });

    expect(handle).toBeTruthy();
    expect(initMsg().ctx).toEqual(provided);
  });

  it("sources ctx from the REAL _ga/_ga_<stream> cookies when no override is given (mirrors bootGa4Core's own sourcing)", async () => {
    vi.stubGlobal(
      "document",
      fakeDocument("_ga=GA1.1.5555555555.1600000000; _ga_TEST9=GS1.1.1699999999.3.1.1700000050.60.0.0"),
    );

    await bootGa4Gtag({ measurementId: "G-XXXX" });

    expect(initMsg().ctx).toEqual({ clientId: "5555555555.1600000000", sessionId: "1699999999" });
  });

  it("a real page_view drives a GET to /g/collect carrying v/tid/cid/sid (event -> connector.handle -> seal -> dispatcher)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };
    await bootGa4Gtag({ ctx, measurementId: "G-XXXX" });

    // Simulate the chamber's real response: the SAME gtag connector maps the event —
    // mirrors test/pixel-seam.test.js's `metaReady` pattern (never a hand-built URL).
    const connector = createGa4GtagConnector({ measurementId: "G-XXXX", ctx, endpoint: GA4_GTAG_COLLECT_ENDPOINT });
    const [req] = connector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } });
    FakeWorker.last.onmessage({ data: { ready: [req], dropped: [] } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(GA4_GTAG_COLLECT_ENDPOINT);
    expect(parsed.searchParams.get("v")).toBe("2");
    expect(parsed.searchParams.get("tid")).toBe("G-XXXX");
    expect(parsed.searchParams.get("cid")).toBe(ctx.clientId);
    expect(parsed.searchParams.get("sid")).toBe(String(ctx.sessionId));
  });

  it("no `consent` opt at all -> the gate stays OFF: a ready beacon dispatches normally (back-compat, mirrors GA4/pixel's own gating)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const ctx = { clientId: "1.1", sessionId: "2" };
    await bootGa4Gtag({ ctx, measurementId: "G-XXXX" });

    FakeWorker.last.onmessage({
      data: { ready: [{ url: `${GA4_GTAG_COLLECT_ENDPOINT}?tid=G-XXXX`, method: "GET" }], dropped: [] },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a wired `consent` vector with analytics_storage unresolved HOLDS a ready beacon (the gate engages once a host wires consent at all)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ctx = { clientId: "1.1", sessionId: "2" };

    await bootGa4Gtag({ ctx, measurementId: "G-XXXX", consent: {} });
    FakeWorker.last.onmessage({
      data: { ready: [{ url: `${GA4_GTAG_COLLECT_ENDPOINT}?tid=G-XXXX`, method: "GET" }], dropped: [] },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "airlock:",
      expect.objectContaining({ kind: "consent", disposition: "held", purpose: "analytics_storage" }),
    );
    warnSpy.mockRestore();
  });

  it("handle.setConsent grants analytics_storage mid-session and flushes the held GET beacon", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const ctx = { clientId: "1.1", sessionId: "2" };
    const handle = await bootGa4Gtag({ ctx, measurementId: "G-XXXX", consent: {} });

    const url = `${GA4_GTAG_COLLECT_ENDPOINT}?tid=G-XXXX`;
    FakeWorker.last.onmessage({ data: { ready: [{ url, method: "GET" }], dropped: [] } });
    expect(fetchMock).not.toHaveBeenCalled();

    handle.setConsent({ analytics_storage: "granted" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ method: "GET" }));
  });

  it("a wired `payloadDenylist` strips the denied field before a pushed event crosses to the worker", async () => {
    vi.stubGlobal("requestIdleCallback", (cb) => { cb({ didTimeout: false, timeRemaining: () => 0 }); return 1; });
    const ctx = { clientId: "1.1", sessionId: "2" };
    const handle = await bootGa4Gtag({ ctx, measurementId: "G-XXXX", payloadDenylist: ["email"] });

    handle.push({ event: "lead", value: 5, email: "a@b.c" });

    const events = FakeWorker.last.messages.find((m) => m.type === "events");
    expect(events.batch[0].params.email).toBeUndefined();
    expect(events.batch[0].params.value).toBe(5);
  });

  it("returns a working dispose() and no pushCritical (a worker-mapped GET connector has no main-thread critical mapper, mirrors bootMetaPixel)", async () => {
    const ctx = { clientId: "1.1", sessionId: "2" };
    const handle = await bootGa4Gtag({ ctx, measurementId: "G-XXXX" });

    expect(handle.pushCritical).toBeUndefined();
    expect(() => handle.dispose()).not.toThrow();
    expect(FakeWorker.last.terminated).toBe(1);
  });
});

// Spec 041-02 — session-state + Consent-Mode carriage on the live path (frame-critique
// PASSED round 2). `bootGa4Gtag` now sources `writeGa4SessionState`'s return BEFORE
// `createAirlock`, overriding sourceGa4Ctx's pre-write `sid` (frame-critique's
// sid-reconciliation correction) and folding the RAW ADR-0007 consent vector into
// `ctx.consent`/`ctx.consentDefault`. Every test drives the REAL `createGa4GtagConnector`
// against the posted `init` message (never a hand-built beacon), mirroring the 041-01
// suite's own "real page_view" pattern.
describe("bootGa4Gtag (spec 041-02 — session-state + Consent-Mode carriage)", () => {
  const STREAM = "_ga_STREAM1";
  const GA_COOKIE = "_ga=GA1.1.1111111111.1600000000";

  /** Builds a `_ga_<STREAM>=GS2...` cookie pair, the writer's ONLY supported grammar. */
  const gs2Cookie = (sid, sct, engaged, lastHit) =>
    `${STREAM}=GS2.1.s${sid}$o${sct}$g${engaged}$t${lastHit}$j60$l0$h0`;

  const fakeDocWithWrites = (cookieString) => {
    const writes = [];
    return {
      writes,
      get cookie() { return cookieString; },
      set cookie(v) { writes.push(v); },
      visibilityState: "visible",
    };
  };

  /** Runs the REAL connector against the exact `connectorConfig` bootGa4Gtag posted as
   *  `init`, returning the beacon's decoded query params — mirrors 039-03's own
   *  `beaconParamsFor` helper. */
  function beaconParams(init, params = {}) {
    const connector = createGa4GtagConnector(init);
    const [{ url }] = connector.handle({ type: "page_view", params });
    return Object.fromEntries(new URL(url).searchParams.entries());
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("analytics-granted first-visit boot: session-state (_fv/_ss/_nsi) + gcs/gcd land on the beacon, sid is the write's fresh sessionId", async () => {
    const fixedMs = 1700000000000;
    vi.setSystemTime(fixedMs);
    const nowSeconds = String(Math.floor(fixedMs / 1000));
    const doc = fakeDocWithWrites(GA_COOKIE); // no existing _ga_<stream> cookie -> first visit
    vi.stubGlobal("document", doc);

    const consent = {
      ad_storage: "granted",
      analytics_storage: "granted",
      ad_user_data: "denied",
      ad_personalization: "denied",
    };

    await bootGa4Gtag({ measurementId: "G-XXXX", streamCookieName: STREAM, consent });

    const init = initMsg();
    expect(init.ctx.sessionId).toBe(nowSeconds);
    expect(init.ctx.sessionState).toEqual({ sct: "1", seg: "0", _fv: "1", _ss: "1", _nsi: "1" });
    expect(doc.writes.some((w) => w.startsWith(`${STREAM}=`))).toBe(true); // the write landed under the configured name

    const params = beaconParams(init, { page_location: "https://spike.example/" });
    expect(params.sid).toBe(nowSeconds);
    expect(params.sct).toBe("1");
    expect(params.seg).toBe("0");
    expect(params._fv).toBe("1");
    expect(params._ss).toBe("1");
    expect(params._nsi).toBe("1");
    expect(params.gcs).toBe("G111");
    expect(params.gcd).toBe("13r3r3q3q5l1");
  });

  it("new-session-at-boot (existing _ga_<stream>, gap > the 30min default timeout): beacon sid == the write's FRESH sessionId, sct is the incremented value from the SAME transition — never the stale sourceGa4Ctx sid", async () => {
    const fixedMs = 1700100000000;
    vi.setSystemTime(fixedMs);
    const nowSeconds = Math.floor(fixedMs / 1000);
    const oldLastHit = nowSeconds - 40 * 60; // 40min ago > the 30min default timeout
    const oldSid = String(oldLastHit - 5); // the pre-write sid sourceGa4Ctx would read
    const cookieString = `${GA_COOKIE}; ${gs2Cookie(oldSid, "3", "1", oldLastHit)}`;
    vi.stubGlobal("document", fakeDocWithWrites(cookieString));

    await bootGa4Gtag({ measurementId: "G-XXXX", streamCookieName: STREAM });

    const init = initMsg();
    const freshSid = String(nowSeconds);
    expect(init.ctx.sessionId).toBe(freshSid);
    expect(init.ctx.sessionId).not.toBe(oldSid); // NOT the stale sourceGa4Ctx pre-write sid
    expect(init.ctx.sessionState.sct).toBe("4"); // existing "3" + 1, from the SAME post-write transition

    const params = beaconParams(init);
    expect(params.sid).toBe(freshSid);
    expect(params.sct).toBe("4");
  });

  it("continuation boot (existing _ga_<stream>, gap within the timeout): sid unchanged (override is a no-op), _fv/_ss/_nsi omitted", async () => {
    const fixedMs = 1700200000000;
    vi.setSystemTime(fixedMs);
    const nowSeconds = Math.floor(fixedMs / 1000);
    const lastHit = nowSeconds - 5 * 60; // 5min ago, within the 30min default timeout
    const sid = "1699999999";
    const cookieString = `${GA_COOKIE}; ${gs2Cookie(sid, "2", "0", lastHit)}`;
    vi.stubGlobal("document", fakeDocWithWrites(cookieString));

    await bootGa4Gtag({ measurementId: "G-XXXX", streamCookieName: STREAM });

    const init = initMsg();
    expect(init.ctx.sessionId).toBe(sid); // override is a no-op — matches sourceGa4Ctx's own pre-write read
    expect(init.ctx.sessionState).toEqual({ sct: "2", seg: "1" }); // no _fv/_ss/_nsi keys at all

    const params = beaconParams(init);
    expect(params.sid).toBe(sid);
    expect(params.sct).toBe("2");
    expect(params._fv).toBeUndefined();
    expect(params._ss).toBeUndefined();
    expect(params._nsi).toBeUndefined();
  });

  it("analytics-denied boot: no cookie write, no session-state fields, ctx.sessionId stays the sourceGa4Ctx value, seal behavior unchanged", async () => {
    const fixedMs = 1700300000000;
    vi.setSystemTime(fixedMs);
    const nowSeconds = Math.floor(fixedMs / 1000);
    const cookieString = `${GA_COOKIE}; ${gs2Cookie("1699999999", "2", "0", nowSeconds - 60)}`;
    const doc = fakeDocWithWrites(cookieString);
    vi.stubGlobal("document", doc);
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await bootGa4Gtag({ measurementId: "G-XXXX", streamCookieName: STREAM, consent: {} });

    const init = initMsg();
    expect(init.ctx.sessionState).toBeUndefined();
    expect(init.ctx.sessionId).toBe(String(nowSeconds)); // sourceGa4Ctx's own not-granted ephemeral fallback
    expect(doc.writes).toEqual([]); // no cookie write without analytics consent

    // AC3: the seal is unchanged — an unresolved (pending) analytics_storage still HOLDS
    // a ready beacon exactly like 041-01's own gating test.
    FakeWorker.last.onmessage({
      data: { ready: [{ url: `${GA4_GTAG_COLLECT_ENDPOINT}?tid=G-XXXX`, method: "GET" }], dropped: [] },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "airlock:",
      expect.objectContaining({ kind: "consent", disposition: "held", purpose: "analytics_storage" }),
    );
    warnSpy.mockRestore();
  });

  it("ctx.consent carries the RAW ADR-0007 vector, not shapeMpConsent's MP-shaped output (encodeGcs/encodeGcd read ad_storage/analytics_storage, fields shapeMpConsent never carries)", async () => {
    vi.setSystemTime(1700400000000);
    vi.stubGlobal("document", fakeDocWithWrites(GA_COOKIE));
    const consent = {
      ad_storage: "granted",
      analytics_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    };

    await bootGa4Gtag({ measurementId: "G-XXXX", consent });

    const init = initMsg();
    expect(init.ctx.consent).toEqual(consent); // the RAW vector, verbatim
    expect(init.ctx.consent).not.toEqual(shapeMpConsent(consent)); // never the MP-shaped object

    const params = beaconParams(init);
    expect(params.gcs).toBe("G111"); // only resolvable from the RAW vector (shapeMpConsent has no ad_storage/analytics_storage keys)
  });

  it("an absent streamCookieName skips the session-state write entirely (back-compat: no host config yet)", async () => {
    vi.setSystemTime(1700500000000);
    const doc = fakeDocWithWrites(`${GA_COOKIE}; ${gs2Cookie("1699999999", "2", "0", 1700499000)}`);
    vi.stubGlobal("document", doc);

    await bootGa4Gtag({ measurementId: "G-XXXX" }); // no streamCookieName opt

    const init = initMsg();
    expect(init.ctx.sessionState).toBeUndefined();
    expect(init.ctx.sessionId).toBe("1699999999"); // sourceGa4Ctx's own pre-write read stands, untouched
    expect(doc.writes).toEqual([]); // writeGa4SessionState never called
  });
});

// Spec 041-03 — batching on the live path (coalesceGa4 wired). `bootGa4Gtag`'s
// `createAirlock({...})` call now passes `coalesce: coalesceGa4` — the 040-02
// core seam + 040-03/040-05 GA4 strategy were already governed + tested; this
// slice is the one-parameter wiring that turns the hook ON for a real boot.
// Every test drives the REAL `createGa4GtagConnector` (mirrors
// test/ga4-coalesce.test.js's own "040-02 integration" pattern), now through
// `bootGa4Gtag` instead of a raw `createAirlock` call, so a revert of the one
// wiring line (removing `coalesce: coalesceGa4`) fails these on the exact
// assertions that matter: fetch call COUNT and POST/GET method.
describe("bootGa4Gtag (spec 041-03 — coalesceGa4 wired on the live path)", () => {
  it("AC1: a same-context 2-event cycle merges into ONE batched POST through the real seam (load-bearing inverse — without the wiring this would be 2 GETs)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };
    await bootGa4Gtag({ ctx, measurementId: "G-XXXX" });

    // Mirrors the 041-01 "real page_view" pattern — never a hand-built beacon.
    const connector = createGa4GtagConnector({ measurementId: "G-XXXX", ctx, endpoint: GA4_GTAG_COLLECT_ENDPOINT });
    const [reqA] = connector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } });
    const [reqB] = connector.handle({
      type: "scroll",
      params: { page_location: "https://spike.example/", percent_scrolled: 90 },
    });

    FakeWorker.last.onmessage({ data: { ready: [reqA, reqB], dropped: [] } });

    // Load-bearing: without `coalesce: coalesceGa4` wired, the core's default
    // path fetches one GET per survivor — this would be 2 calls, both GET.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toContain("en=page_view");
    expect(init.body).toContain("en=scroll");
  });

  it("AC1: a 1-event cycle still egresses as a single GET (coalesceGa4's own AC3 — a lone request in its group is unchanged)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };
    await bootGa4Gtag({ ctx, measurementId: "G-XXXX" });

    const connector = createGa4GtagConnector({ measurementId: "G-XXXX", ctx, endpoint: GA4_GTAG_COLLECT_ENDPOINT });
    const [req] = connector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } });

    FakeWorker.last.onmessage({ data: { ready: [req], dropped: [] } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("AC2: governance still holds end-to-end — an unresolved-consent 2-event cycle is held at the seal and never enters a merged POST", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };
    // A wired-but-unresolved consent vector (mirrors the 041-01 gating test) —
    // the seal holds every ready beacon BEFORE 040-02's coalesce grouping runs.
    await bootGa4Gtag({ ctx, measurementId: "G-XXXX", consent: {} });

    const connector = createGa4GtagConnector({ measurementId: "G-XXXX", ctx, endpoint: GA4_GTAG_COLLECT_ENDPOINT });
    const [reqA] = connector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } });
    const [reqB] = connector.handle({
      type: "scroll",
      params: { page_location: "https://spike.example/", percent_scrolled: 90 },
    });

    FakeWorker.last.onmessage({ data: { ready: [reqA, reqB], dropped: [] } });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "airlock:",
      expect.objectContaining({ kind: "consent", disposition: "held", purpose: "analytics_storage" }),
    );
    warnSpy.mockRestore();
  });
});
