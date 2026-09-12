// Google Ads (AW) denied-consent seal-hold — spec 044-02 (ADR-0023 Option E / spec 045-01's
// mechanism). g-ads OPTS IN to the core seal's `holdOnDenied` mode: grounded on R-009 §(b) (the
// 2026-09-11 Playwright OneTrust.RejectAll() re-capture collapsed the ad-family egress 23 -> 2 — under
// reject-all NO Google Ads beacon fired, only GA4 cookieless-modeled), so the parity-correct denied
// behavior for the AW connector is HOLD (buffer, flush on grant) — not a cookieless AW send, and not a
// stale verbatim re-send of the under-denial payload on grant (which would fire an unattributable
// "user-declined" beacon, 045-01's load-bearing correction).
//
// This slice does NOT rebuild the `holdOnDenied`/`remap` MECHANISM (045-01, reviewed, `core/**`
// untouched here) — it wires the g-ads CONSUMER: `handle()` now attaches its source `event` to the
// ready EgressRequest, and `createGoogleAdsRemap` supplies the main-thread re-mapper the seal calls on
// a grant-flush. Proven end-to-end through a REAL `createAirlock({ holdOnDenied, remap })` + the REAL
// google-ads connector's `handle` output, via the SAME FakeWorker seal harness `test/consent-seal.test.js`
// uses (no real Worker needed).
//
// AC1: the airlock instance opts into `holdOnDenied` AND supplies the re-map inputs (`event` attached +
//      `createGoogleAdsRemap` wired) — proven at the connector-config + seal level (boot wiring in
//      `adapters/eds` is DEFERRED, per 044-01/A2 — not attempted here).
// AC2: denied ad_storage HOLDS the AW beacon (no fetch, a held diagnostic); a later grant RE-MAPS it
//      under the now-current consent — the load-bearing `gcs`/`npa` flip (always available from the
//      consent vector) + an in-test synthetic-cookie proof of the consent-gated `_gcl_au` re-source
//      (§A5 scope: on a real container-removed page `auid` may be absent both sides — this is the
//      in-test demonstration, not a live-page guarantee). Granted-from-start fires unchanged (AC1's
//      "behavior preserving" half).
// AC3: no cookieless AW fallback — handle() emits exactly one beacon shape; a non-page_view event maps
//      to [], never a second denial-shaped variant.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";
import {
  createGoogleAdsConnector,
  createGoogleAdsRemap,
  GOOGLE_ADS_CCM_COLLECT_ENDPOINT,
} from "../connectors/google-ads/connector.js";

// The SAME FakeWorker pattern test/consent-seal.test.js (045-01) and
// test/chamber-observability.test.js use — no real Worker needed; a `ready` reply is simulated
// directly against `FakeWorker.last.onmessage`.
class FakeWorker {
  constructor(url, opts) {
    FakeWorker.last = this;
    this.url = String(url);
    this.opts = opts;
    this.messages = [];
    this.onmessage = null;
    this.onerror = null;
  }
  postMessage(m) { this.messages.push(m); }
  terminate() {}
}

beforeEach(() => {
  FakeWorker.last = null;
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(() => vi.unstubAllGlobals());

const readyMsg = (reqs) => ({ data: { ready: reqs, dropped: [] } });

const CONVERSION_ID = "AW-1234567890";

// A "reject-all" vector (R-009 §(b)'s captured OneTrust state) and its "accept-all" grant flip — both
// full 4-purpose vectors so gcs/gcd/npa (all four Consent-Mode purposes) resolve JOINTLY rather than
// omitting on a pending sibling purpose (connectors/consent-mode.js's own joint-string discipline).
const DENIED_ALL = {
  ad_storage: "denied",
  analytics_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};
const GRANTED_ALL = {
  ad_storage: "granted",
  analytics_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
};

// AC1: the g-ads airlock instance opts into holdOnDenied AND supplies the re-map inputs — wired at the
// connector-config + seal level (real boot wiring in adapters/eds is the deferred edge, §A2).
const makeAirlock = (opts) =>
  createAirlock({
    trackers: 1,
    workFactor: 0,
    endpoints: [GOOGLE_ADS_CCM_COLLECT_ENDPOINT],
    unloadCritical: [],
    egressPurposes: ["ad_storage"],
    holdOnDenied: true, // g-ads opts in — grounded on R-009 §(b): the container held AW under reject-all
    ...opts,
  });

describe("createGoogleAdsRemap — purity (no `document`/global; the cookie string is injected)", () => {
  it("runs correctly in Node/vitest (where `document` is undefined) and uses the INJECTED reader, not a global", () => {
    expect(typeof document).toBe("undefined"); // grounds the premise (mirrors test/sanitize-html.test.js)

    const readCookieString = vi.fn(() => "_gcl_au=1.1.42.1700000000");
    const remap = createGoogleAdsRemap({ conversionId: CONVERSION_ID, readCookieString });

    let request;
    expect(() => {
      request = remap({ type: "page_view", params: {} }, GRANTED_ALL);
    }).not.toThrow();

    expect(readCookieString).toHaveBeenCalledTimes(1); // the injected seam was actually exercised
    expect(new URL(request.url).searchParams.get("auid")).toBe("42.1700000000");
  });

  it("re-encodes gcd from the passed consent + `consentDefault`, and re-discovers inbound click ids from `landingUrl`", () => {
    // Exercises the `consentDefault` (→ gcd default-scope) and `landingUrl` (→ inbound click-id
    // re-discovery) re-map params (craft-review: both were forwarded but untested).
    const remap = createGoogleAdsRemap({
      conversionId: CONVERSION_ID,
      consentDefault: DENIED_ALL, // the declared Consent-Mode default scope (gcd)
      readCookieString: () => "",
      landingUrl: "https://spike.example/pricing?gclid=TESTCLICK123",
    });

    const deniedParams = new URL(remap({ type: "page_view", params: {} }, DENIED_ALL).url).searchParams;
    const grantedParams = new URL(remap({ type: "page_view", params: {} }, GRANTED_ALL).url).searchParams;

    // gcd is re-encoded from the PASSED consent (with the declared default) — it flips denied→granted.
    expect(deniedParams.get("gcd")).toBeTruthy();
    expect(grantedParams.get("gcd")).toBeTruthy();
    expect(grantedParams.get("gcd")).not.toBe(deniedParams.get("gcd"));

    // inbound gclid re-discovered from landingUrl — consent-INDEPENDENT (URL-sourced, not ad_storage
    // gated), so forwarded on both the denied and granted re-maps.
    expect(grantedParams.get("gclid")).toBe("TESTCLICK123");
    expect(deniedParams.get("gclid")).toBe("TESTCLICK123");
  });
});

describe("AC3 — handle() attaches the source event; no cookieless AW fallback (exactly one beacon shape)", () => {
  it("page_view returns a length-1 EgressRequest[] carrying its source event", () => {
    const connector = createGoogleAdsConnector({ conversionId: CONVERSION_ID, ctx: { consent: GRANTED_ALL } });
    const event = { type: "page_view", params: { page_location: "https://spike.example/pricing" } };

    const requests = connector.handle(event);

    expect(requests).toHaveLength(1);
    expect(requests[0].event).toBe(event); // the SAME source event, for the seal's re-map channel
    expect(requests[0].method).toBe("GET");
  });

  it("a non-page_view event maps to [] — no separate cookieless/denial-shaped variant", () => {
    const connector = createGoogleAdsConnector({ conversionId: CONVERSION_ID, ctx: { consent: GRANTED_ALL } });
    expect(connector.handle({ type: "conversion", params: {} })).toEqual([]);
    expect(connector.handle({ type: "add_to_cart", params: {} })).toEqual([]);
  });
});

describe("AC1 — granted-from-start dispatches unchanged (holdOnDenied wired but not engaged)", () => {
  it("ad_storage granted at construction fires immediately, carrying auid when the (synthetic) ctx supplies one", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);

    const connector = createGoogleAdsConnector({
      conversionId: CONVERSION_ID,
      ctx: { consent: GRANTED_ALL, auid: "1234567890.1700000000" },
    });
    const [ready] = connector.handle({
      type: "page_view",
      params: { page_location: "https://spike.example/pricing" },
    });

    makeAirlock({
      remap: createGoogleAdsRemap({ conversionId: CONVERSION_ID, readCookieString: () => "" }),
      consent: GRANTED_ALL,
    });
    FakeWorker.last.onmessage(readyMsg([ready]));

    expect(fetchMock).toHaveBeenCalledTimes(1); // sent immediately — no hold, no diagnostic
    const [firedUrl] = fetchMock.mock.calls[0];
    expect(firedUrl).toContain("auid=1234567890.1700000000");
    expect(firedUrl).toContain("gcs=G111");
    expect(firedUrl).toContain("npa=0");
  });
});

describe("AC2 — denied ad_storage HOLDS the AW beacon at the seal, then RE-MAPS on grant (not a stale re-send)", () => {
  // A synthetic, real-shaped `_gcl_au` — NEVER a live identifier (security constraint). §A5 scope: on
  // a real container-removed page nothing writes `_gcl_au`, so this is the in-test demonstration of
  // the consent-gated re-source, not a live-page guarantee (the ALWAYS-available gcs/npa flip below is
  // what a live rewired page relies on).
  const SYNTHETIC_GCL_AU_COOKIE = "_gcl_au=1.1.1234567890.1700000000";
  const EXPECTED_AUID = "1234567890.1700000000";

  it("the boot-time (denied) beacon itself carries NO auid + the stale denied gcs/npa, and HOLDS at the seal (no fetch), with a held diagnostic naming 'denied'", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);

    // The connector's OWN ctx is denied-all at construction (a real page's reject-all boot state) —
    // §A5: ad_storage denied means sourceGoogleAdsCtx never even reads _gcl_au, so no auid is minted.
    const connector = createGoogleAdsConnector({ conversionId: CONVERSION_ID, ctx: { consent: DENIED_ALL } });
    const event = { type: "page_view", params: { page_location: "https://spike.example/pricing" } };
    const [ready] = connector.handle(event);
    const readyParams = new URL(ready.url).searchParams;

    // contrast with the re-mapped beacon below: this one is boot-time denied, never re-sourced.
    expect(readyParams.has("auid")).toBe(false);
    expect(readyParams.get("gcs")).toBe("G100");
    expect(readyParams.get("npa")).toBe("1");

    const remap = createGoogleAdsRemap({ conversionId: CONVERSION_ID, readCookieString: () => "" });
    makeAirlock({ onDiagnostic, remap, consent: DENIED_ALL });

    FakeWorker.last.onmessage(readyMsg([ready]));

    expect(fetchMock).not.toHaveBeenCalled(); // held, NOT sent — the g-ads reject-all case (R-009 §(b))
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic.mock.calls[0][0]).toMatchObject({
      level: "warn",
      kind: "consent",
      disposition: "held",
      purpose: "ad_storage",
      reason: expect.stringContaining("denied"),
    });
  });

  it("granting ad_storage (+ siblings) RE-MAPS: the granted gcs/npa flip (always available) + an in-test fresh auid re-sourced from a synthetic _gcl_au — NOT the stale under-denial payload", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);

    const connector = createGoogleAdsConnector({ conversionId: CONVERSION_ID, ctx: { consent: DENIED_ALL } });
    const event = { type: "page_view", params: { page_location: "https://spike.example/pricing" } };
    const [ready] = connector.handle(event);

    // A fake `readCookieString` re-read AT FLUSH TIME (not at construction) — proving the re-map
    // re-sources rather than replaying whatever the boot-time ctx happened to carry.
    const readCookieString = vi.fn(() => SYNTHETIC_GCL_AU_COOKIE);
    const remap = vi.fn(createGoogleAdsRemap({ conversionId: CONVERSION_ID, readCookieString }));
    const airlock = makeAirlock({ onDiagnostic, remap, consent: DENIED_ALL });

    FakeWorker.last.onmessage(readyMsg([ready]));
    expect(fetchMock).not.toHaveBeenCalled();
    onDiagnostic.mockClear();

    airlock.setConsent(GRANTED_ALL);

    // remap invoked ONCE with the SOURCE event + the NOW-GRANTED vector.
    expect(remap).toHaveBeenCalledTimes(1);
    expect(remap).toHaveBeenCalledWith(event, expect.objectContaining(GRANTED_ALL));

    // exactly ONE fresh fetch — proving RE-MAP, not a re-send of the buffered under-denial beacon.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [firedUrl, firedInit] = fetchMock.mock.calls[0];
    const firedParams = new URL(firedUrl).searchParams;

    // THE LOAD-BEARING correction: the granted gcs/npa flip — ALWAYS available from the consent
    // vector, independent of any cookie.
    expect(firedParams.get("gcs")).toBe("G111");
    expect(firedParams.get("npa")).toBe("0");
    expect(firedUrl).not.toContain("gcs=G100"); // the stale under-denial value is gone
    expect(firedUrl).not.toContain("npa=1");

    // gcd (Consent-Mode DEFAULTS) ALSO re-encodes from the granted vector — not the cached boot-time
    // denied gcd (craft-review: a regression reusing the buffered gcd would otherwise stay green).
    const readyGcd = new URL(ready.url).searchParams.get("gcd");
    expect(readyGcd).toBeTruthy(); // the boot-time (denied) beacon carried a gcd
    expect(firedParams.get("gcd")).toBeTruthy();
    expect(firedParams.get("gcd")).not.toBe(readyGcd); // it FLIPPED denied→granted, re-encoded not cached

    // the in-test synthetic-cookie proof of the consent-gated _gcl_au re-source (§A5 scope note).
    expect(firedParams.get("auid")).toBe(EXPECTED_AUID);
    expect(readCookieString).toHaveBeenCalled(); // re-read at flush, not merely at construction

    expect(firedInit).toMatchObject({ method: "GET", keepalive: true });
    expect(firedInit.body).toBeUndefined(); // a GET carries no body

    // the held->flushed diagnostic chain is preserved (028-02's beaconId, exercised by 045-01 already
    // — sanity-checked here too since this is the real g-ads producer, not a fake remap).
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic.mock.calls[0][0]).toMatchObject({ kind: "consent", disposition: "flushed", purpose: "ad_storage" });
  });

  it("pending ad_storage also HOLDS the AW beacon (AC4's enumerated pending→held case), reason names 'pending'", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);

    // No consent signal yet (reject/accept not chosen) — a pending governing purpose, distinct from the
    // denied case above. The connector has no pending-vs-denied branch; it routes through the same
    // 045-01 seal mechanism, held until a later grant.
    const connector = createGoogleAdsConnector({ conversionId: CONVERSION_ID, ctx: { consent: { ad_storage: "pending" } } });
    const [ready] = connector.handle({ type: "page_view", params: { page_location: "https://spike.example/pricing" } });

    const remap = createGoogleAdsRemap({ conversionId: CONVERSION_ID, readCookieString: () => "" });
    makeAirlock({ onDiagnostic, remap, consent: { ad_storage: "pending" } });

    FakeWorker.last.onmessage(readyMsg([ready]));

    expect(fetchMock).not.toHaveBeenCalled(); // pending -> held (AC4), no cookieless send
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic.mock.calls[0][0]).toMatchObject({
      kind: "consent",
      disposition: "held",
      purpose: "ad_storage",
      reason: expect.stringContaining("pending"), // named as pending, not denied (045-01's state-derived reason)
    });
  });
});
