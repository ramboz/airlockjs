// bootGoogleAds — the EDS adapter's Google Ads (AW) wiring, spec 048-01 AC2/AC4.
// Mirrors test/eds-ga4-gtag.test.js's own ctx-sourcing/consent-wiring pattern
// (bootGa4Gtag), and test/google-ads-seal.test.js's own denied-hold/granted-remap
// proof — but driven through the REAL `bootGoogleAds` boot adapter (a real
// createAirlock({connector:"google-ads"}) + a real chamber-shaped FakeWorker), closing
// that seal test's own named deferred edge ("real boot wiring in adapters/eds").
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bootGoogleAds } from "../adapters/eds/index.js";
import { GOOGLE_ADS_CCM_COLLECT_ENDPOINT, createGoogleAdsConnector } from "../connectors/google-ads/connector.js";

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

// A MUTABLE fake `document` (unlike test/eds-ga4-gtag.test.js's write-only stub): the
// cookie setter actually updates what a later getter read returns, so a test can prove
// a re-map re-SOURCES the cookie at flush time (write, then read-back via a fresh
// `document.cookie` access — never a cached boot-time snapshot).
const fakeDocument = (initialCookie = "") => {
  const state = { cookie: initialCookie };
  const writes = [];
  return {
    writes,
    get cookie() { return state.cookie; },
    set cookie(v) { writes.push(v); state.cookie = v; },
    location: { href: "" },
    visibilityState: "visible",
  };
};

const initMsg = () => FakeWorker.last.messages.find((m) => m.type === "init");
const readyMsg = (reqs) => ({ data: { ready: reqs, dropped: [] } });

const CONVERSION_ID = "AW-1234567890";
const DENIED_ALL = { ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
const GRANTED_ALL = { ad_storage: "granted", analytics_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" };

beforeEach(() => {
  FakeWorker.last = null;
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve()));
});
afterEach(() => vi.unstubAllGlobals());

describe("bootGoogleAds (spec 048-01 AC2 — the boot-happy-path skeleton)", () => {
  it("boots the GOOGLE-ADS chamber, ceiled to the ccm/collect endpoint (NOT the MP DEFAULT_ENDPOINTS)", async () => {
    const ctx = {};
    await bootGoogleAds({ ctx, conversionId: CONVERSION_ID });

    expect(FakeWorker.last.url.endsWith("google-ads-chamber.worker.js")).toBe(true);
    const init = initMsg();
    expect(init.conversionId).toBe(CONVERSION_ID);
    expect(init.endpoint).toBe(GOOGLE_ADS_CCM_COLLECT_ENDPOINT);
  });

  it("an explicit opts.ctx override skips cookie/URL sourcing entirely (rig/test escape hatch, mirrors bootGa4Gtag)", async () => {
    // NO document stub: if boot touched document.cookie/location despite the
    // override, the bare `document` reference would throw and fail this test.
    const provided = { auid: "9.9" };

    const handle = await bootGoogleAds({ ctx: provided, conversionId: CONVERSION_ID });

    expect(handle).toBeTruthy();
    expect(initMsg().ctx).toEqual(provided);
  });

  it("sources ctx from the REAL _gcl_au cookie when ad_storage is granted and no override is given", async () => {
    vi.stubGlobal("document", fakeDocument("_gcl_au=1.1.42.1700000000"));

    await bootGoogleAds({ conversionId: CONVERSION_ID, consent: GRANTED_ALL });

    expect(initMsg().ctx.auid).toBe("42.1700000000");
  });

  it("ad_storage denied -> no _gcl_au read at all (no auid sourced, even with the cookie present) — §A5's read-when-present gate", async () => {
    vi.stubGlobal("document", fakeDocument("_gcl_au=1.1.42.1700000000"));

    await bootGoogleAds({ conversionId: CONVERSION_ID, consent: DENIED_ALL });

    expect(initMsg().ctx.auid).toBeUndefined();
  });

  it("a real page_view drives a GET to ccm/collect carrying tid/en/gcs/npa (event -> connector.handle -> seal -> dispatcher)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    await bootGoogleAds({ ctx: {}, conversionId: CONVERSION_ID, consent: GRANTED_ALL });

    // Simulate the chamber's real response: the SAME connector maps the event — mirrors
    // test/eds-ga4-gtag.test.js's `createGa4GtagConnector` pattern (never a hand-built URL).
    const connector = createGoogleAdsConnector({ conversionId: CONVERSION_ID, ctx: initMsg().ctx, endpoint: GOOGLE_ADS_CCM_COLLECT_ENDPOINT });
    const [req] = connector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } });
    FakeWorker.last.onmessage(readyMsg([req]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(GOOGLE_ADS_CCM_COLLECT_ENDPOINT);
    expect(parsed.searchParams.get("tid")).toBe(CONVERSION_ID);
    expect(parsed.searchParams.get("en")).toBe("page_view");
    expect(parsed.searchParams.get("gcs")).toBe("G111");
    expect(parsed.searchParams.get("npa")).toBe("0");
  });

  it("no `consent` opt at all -> the gate stays OFF: a ready beacon dispatches normally (back-compat, mirrors GA4/gtag's own gating)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    await bootGoogleAds({ ctx: {}, conversionId: CONVERSION_ID });

    FakeWorker.last.onmessage(readyMsg([{ url: `${GOOGLE_ADS_CCM_COLLECT_ENDPOINT}?tid=${CONVERSION_ID}`, method: "GET" }]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("an opts.endpoint override maps + ceils to it (both connectorConfig.endpoint and the endpoints[] ceiling widen together)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const CUSTOM_ENDPOINT = "https://region1.google.com/ccm/collect";
    await bootGoogleAds({ ctx: {}, conversionId: CONVERSION_ID, consent: GRANTED_ALL, endpoint: CUSTOM_ENDPOINT });

    expect(initMsg().endpoint).toBe(CUSTOM_ENDPOINT);
    const connector = createGoogleAdsConnector({ conversionId: CONVERSION_ID, ctx: initMsg().ctx, endpoint: CUSTOM_ENDPOINT });
    const [req] = connector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } });
    FakeWorker.last.onmessage(readyMsg([req]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(new URL(url).origin + new URL(url).pathname).toBe(CUSTOM_ENDPOINT);
  });

  it("returns a working dispose(), and pushCritical IS exposed (its own requestMapper wiring, AC1, makes it safe unlike bootGa4Gtag's minimal-boot omission)", async () => {
    const handle = await bootGoogleAds({ ctx: {}, conversionId: CONVERSION_ID });

    expect(typeof handle.pushCritical).toBe("function");
    expect(() => handle.dispose()).not.toThrow();
    expect(FakeWorker.last.terminated).toBe(1);
  });
});

describe("bootGoogleAds (spec 048-01 AC4 — consent enforced END-TO-END through the boot, against the REAL seal)", () => {
  it("ad_storage denied at boot HOLDS the beacon (no fetch), with a held diagnostic naming 'denied'", async () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    await bootGoogleAds({ ctx: {}, conversionId: CONVERSION_ID, consent: DENIED_ALL, onDiagnostic });

    const connector = createGoogleAdsConnector({ conversionId: CONVERSION_ID, ctx: initMsg().ctx, endpoint: GOOGLE_ADS_CCM_COLLECT_ENDPOINT });
    const [req] = connector.handle({ type: "page_view", params: { page_location: "https://spike.example/pricing" } });
    FakeWorker.last.onmessage(readyMsg([req]));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warn", kind: "consent", disposition: "held", purpose: "ad_storage", reason: expect.stringContaining("denied") }),
    );
  });

  it("handle.setConsent grants ad_storage mid-session: RE-MAPS via createGoogleAdsRemap (fresh gcs/npa flip + auid re-sourced from the cookie AT FLUSH TIME) and flushes exactly once — not a stale re-send", async () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    // No cookie yet at boot (denied — sourceGoogleAdsCtx never reads it under denial, §A5).
    vi.stubGlobal("document", fakeDocument(""));
    const handle = await bootGoogleAds({ conversionId: CONVERSION_ID, consent: DENIED_ALL, onDiagnostic });

    const connector = createGoogleAdsConnector({ conversionId: CONVERSION_ID, ctx: initMsg().ctx, endpoint: GOOGLE_ADS_CCM_COLLECT_ENDPOINT });
    const [req] = connector.handle({ type: "page_view", params: { page_location: "https://spike.example/pricing" } });
    FakeWorker.last.onmessage(readyMsg([req]));
    expect(fetchMock).not.toHaveBeenCalled();
    onDiagnostic.mockClear();

    // A synthetic _gcl_au NOW present (arrived while held, or newly readable post-grant) —
    // the remap re-sources it fresh at flush time, not from the boot-time (denied, cookie-less) ctx.
    document.cookie = "_gcl_au=1.1.55555.1700000000";

    // All FOUR Consent-Mode purposes grant (mirrors test/google-ads-seal.test.js's own
    // GRANTED_ALL) — gcs/gcd/npa resolve JOINTLY (connectors/consent-mode.js), so a
    // partial (ad_storage-only) grant would encode a DIFFERENT (still-mixed) gcs value.
    handle.setConsent(GRANTED_ALL);

    expect(fetchMock).toHaveBeenCalledTimes(1); // exactly ONE fresh fetch — a RE-MAP, not a re-send
    const [url, init] = fetchMock.mock.calls[0];
    const params = new URL(url).searchParams;
    expect(params.get("gcs")).toBe("G111"); // the load-bearing granted flip (always available from consent)
    expect(params.get("npa")).toBe("0");
    expect(params.get("auid")).toBe("55555.1700000000"); // re-sourced from the cookie AT FLUSH TIME
    expect(init).toMatchObject({ method: "GET", keepalive: true });
    expect(onDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "consent", disposition: "flushed", purpose: "ad_storage" }),
    );
  });

  // BLOCKER (fix round, 2026-09-14): `bootGoogleAds` folds `opts.consentDefault` into the
  // steady-state ctx (a granted beacon's `gcd = encodeGcd(ctx.consent, ctx.consentDefault)`),
  // but its `createGoogleAdsRemap({...})` call omitted `consentDefault` — so a held->grant-
  // flushed beacon encoded a DIFFERENT gcd than a steady-state granted beacon booted with the
  // SAME declared consentDefault, whenever that declared default is not the implicit
  // denied-all `encodeGcd` falls back to on an ABSENT default (connectors/consent-mode.js's
  // `isDeniedAllDefault`). A non-denied-all CUSTOM_DEFAULT below makes the two paths diverge
  // observably: steady-state omits `gcd` (out-of-scope declared default), but the pre-fix
  // remap — never told about `consentDefault` — falls back to the absent-default (implicit
  // denied-all) branch and fabricates a `gcd` string instead.
  it("gcd PARITY: a held->granted-flushed beacon encodes the SAME gcd as a steady-state granted beacon, given the SAME declared consentDefault", async () => {
    const CUSTOM_DEFAULT = {
      ad_storage: "denied",
      analytics_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "granted", // NOT denied-all -> gcd's scope gate diverges from an absent default
    };

    // Reference: a steady-state GRANTED boot with the SAME declared consentDefault, dispatched directly (never held).
    const steadyFetch = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", steadyFetch);
    await bootGoogleAds({ ctx: {}, conversionId: CONVERSION_ID, consent: GRANTED_ALL, consentDefault: CUSTOM_DEFAULT });
    const steadyConnector = createGoogleAdsConnector({ conversionId: CONVERSION_ID, ctx: initMsg().ctx, endpoint: GOOGLE_ADS_CCM_COLLECT_ENDPOINT });
    const [steadyReq] = steadyConnector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } });
    FakeWorker.last.onmessage(readyMsg([steadyReq]));
    expect(steadyFetch).toHaveBeenCalledTimes(1);
    const steadyGcd = new URL(steadyFetch.mock.calls[0][0]).searchParams.get("gcd");

    // Held -> grant-flush: boot DENIED (holds), same declared consentDefault, then grant.
    const flushFetch = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", flushFetch);
    const handle = await bootGoogleAds({ ctx: {}, conversionId: CONVERSION_ID, consent: DENIED_ALL, consentDefault: CUSTOM_DEFAULT });
    const heldConnector = createGoogleAdsConnector({ conversionId: CONVERSION_ID, ctx: initMsg().ctx, endpoint: GOOGLE_ADS_CCM_COLLECT_ENDPOINT });
    const [heldReq] = heldConnector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } });
    FakeWorker.last.onmessage(readyMsg([heldReq]));
    expect(flushFetch).not.toHaveBeenCalled(); // confirms it actually HELD

    handle.setConsent(GRANTED_ALL);
    expect(flushFetch).toHaveBeenCalledTimes(1); // exactly one grant-flush
    const flushedGcd = new URL(flushFetch.mock.calls[0][0]).searchParams.get("gcd");

    expect(flushedGcd).toBe(steadyGcd); // parity: same declared consentDefault -> same gcd, granted-steady or held-then-flushed
  });
});
