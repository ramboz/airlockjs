// Spec 048-03 — `onetrust` as a `boot(config)` GOVERNANCE FIELD wired to the COMPOSITE
// consent fan-out. MVP8's capstone: turns 047-02's "held Google Ads / Floodlight beacons
// egress on a OneTrust accept" from proven-synthetic-only (a stand-in `createAirlock`,
// test/eds-boot-onetrust.test.js) into a REAL end-to-end proof through the real
// `boot(config)` composite — with BOTH ad connectors booted, consent-gated, and fanned by
// ONE composite-level OneTrust subscription.
//
// Mirrors test/eds-boot-config.test.js's FakeWorker/instances harness (one worker per
// connector) + test/eds-boot-onetrust.test.js's fixture-OneTrust-firing pattern
// (`OnConsentChanged`/`OptanonWrapper`) + test/eds-boot-google-ads.test.js /
// test/eds-boot-floodlight.test.js's real-connector-produced held->flush beacons.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { boot, bootEdsAnalytics } from "../adapters/eds/index.js";
import { ERP_INTUIT_GROUP_PURPOSE_MAP } from "../drivers/consent/onetrust.js";
import { createGoogleAdsConnector, GOOGLE_ADS_CCM_COLLECT_ENDPOINT } from "../connectors/google-ads/connector.js";
import { createFloodlightConnector, FLOODLIGHT_CCM_COLLECT_ENDPOINT } from "../connectors/floodlight/connector.js";

class FakeWorker {
  constructor(url, opts) {
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
FakeWorker.instances = [];

const ga4Worker = () => FakeWorker.instances.find((w) => w.url.endsWith("/chamber.worker.js"));
const googleAdsWorker = () => FakeWorker.instances.find((w) => w.url.includes("google-ads-chamber.worker.js"));
const floodlightWorker = () => FakeWorker.instances.find((w) => w.url.includes("floodlight-chamber.worker.js"));
const initOf = (w) => w.messages.find((m) => m.type === "init");
// floodlight's init message nests its config under `connectorConfig` (048-02 deviation).
const initConfigOf = (w) => initOf(w) && initOf(w).connectorConfig;
const readyMsg = (reqs) => ({ data: { ready: reqs, dropped: [] } });

const ACTIVE_GRANTED = ",1,BG394,4,"; // §A5 accept-all capture (redacted group-id string)
const OPTED_OUT = ",1,"; // group 4 absent -> every mapped purpose denied

const CONVERSION_ID_ADS = "AW-1234567890";
const CONVERSION_ID_DC = "DC-1234567890";

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve()));
  vi.stubGlobal("addEventListener", () => {});
  vi.stubGlobal("removeEventListener", () => {});
});
afterEach(() => vi.unstubAllGlobals());

describe("boot(config) — AC1 (048-03): `onetrust` is a top-level governance field", () => {
  it("derives governance.consent via resolveOnetrustBootConsent and threads it to EVERY connector (ga4 + google-ads)", async () => {
    vi.stubGlobal("window", {});

    await boot({
      connectors: [
        { type: "ga4", ctx: { clientId: "1.1", sessionId: "2" } },
        { type: "google-ads", ctx: {}, conversionId: CONVERSION_ID_ADS },
      ],
      onetrust: { groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, activeGroups: ACTIVE_GRANTED },
    });

    // GA4's folded ctx.consent matches the SAME derivation test/eds-boot-onetrust.test.js
    // pins for a standalone bootEdsAnalytics({onetrust}) boot — parity across the two paths.
    expect(initOf(ga4Worker()).ctx.consent).toEqual({ ad_user_data: "GRANTED", ad_personalization: "GRANTED" });

    // google-ads half is CORROBORATIVE ONLY (craft review fix round): a GRANTED dispatch here
    // is indistinguishable from an UNGATED one — bootGoogleAds's own back-compat branch also
    // dispatches immediately when NO consent vector reaches it at all (egressPurposes:[] when
    // `consent` is undefined), so this assertion alone cannot prove the derived vector actually
    // reached google-ads. The LOAD-BEARING proof that per-connector wiring works is the ga4
    // `ctx.consent` shape assertion above (a connector-specific match no back-compat default
    // could accidentally produce) plus AC2/AC3 below, whose denied-at-boot HOLD assertions DO
    // discriminate gated-and-denied from ungated.
    const connector = createGoogleAdsConnector({
      conversionId: CONVERSION_ID_ADS,
      ctx: initOf(googleAdsWorker()).ctx,
      endpoint: GOOGLE_ADS_CCM_COLLECT_ENDPOINT,
    });
    const [req] = connector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } });
    googleAdsWorker().onmessage(readyMsg([req]));

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  // Spec 048-03 fix round (arch nit): precedence when a host supplies BOTH fields was
  // implemented (boot()'s derivedConsent is a plain ternary — see its own doc comment) but
  // UNTESTED. This is genuinely discriminating (unlike the corroborative half above): the
  // explicit `consent` below denies EVERYTHING, so if it had won (or been merged in) the
  // google-ads beacon would HOLD — only the onetrust-derived GRANTED vector winning makes it
  // dispatch.
  it("BOTH config.consent and config.onetrust set — the derived onetrust vector WINS (config.consent is dropped, not merged)", async () => {
    vi.stubGlobal("window", {});

    await boot({
      connectors: [
        { type: "ga4", ctx: { clientId: "1.1", sessionId: "2" } },
        { type: "google-ads", ctx: {}, conversionId: CONVERSION_ID_ADS },
      ],
      // an explicit top-level consent denying everything — if THIS won (or was merged),
      // ad_storage would be denied and the google-ads beacon would HOLD (fetch never called).
      consent: { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" },
      onetrust: { groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, activeGroups: ACTIVE_GRANTED },
    });

    // ga4's folded ctx.consent matches the ONETRUST-derived shape (test 1 above) — the
    // explicit denied `consent` left no trace (a merge would show "denied" fields too).
    expect(initOf(ga4Worker()).ctx.consent).toEqual({ ad_user_data: "GRANTED", ad_personalization: "GRANTED" });

    const connector = createGoogleAdsConnector({
      conversionId: CONVERSION_ID_ADS,
      ctx: initOf(googleAdsWorker()).ctx,
      endpoint: GOOGLE_ADS_CCM_COLLECT_ENDPOINT,
    });
    const [req] = connector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } });
    googleAdsWorker().onmessage(readyMsg([req]));

    // dispatches (not held) — proves ad_storage resolved GRANTED from the ONETRUST vector,
    // not the explicit denied `consent` (which would have held it under the seal).
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("absent config.onetrust leaves governance byte-unchanged (an explicit top-level consent still gates normally)", async () => {
    vi.stubGlobal("window", {});

    await boot({
      connectors: [{ type: "google-ads", ctx: {}, conversionId: CONVERSION_ID_ADS }],
      consent: { ad_storage: "denied" },
    });
    const connector = createGoogleAdsConnector({
      conversionId: CONVERSION_ID_ADS,
      ctx: initOf(googleAdsWorker()).ctx,
      endpoint: GOOGLE_ADS_CCM_COLLECT_ENDPOINT,
    });
    const [req] = connector.handle({ type: "page_view", params: {} });
    googleAdsWorker().onmessage(readyMsg([req]));

    expect(globalThis.fetch).not.toHaveBeenCalled(); // still held — onetrust's absence didn't disturb explicit consent
  });
});

describe("boot(config) — AC2 (048-03): the composite is the SOLE OneTrust subscriber, TRUE BY CONSTRUCTION", () => {
  // Mutation-provable (DoD): comment out the `onetrust: _ignoredPerConnectorOnetrust` strip
  // in `bootConnector`'s destructure and this test goes RED — the ga4 sub-boot's own
  // `subscribeOnetrustConsentChanges` call (registered BEFORE `createComposite` runs) wins
  // the driver's identity-keyed idempotency guard on the shared `window` object, so the
  // LATER composite subscription below silently no-ops and the google-ads beacon strands.
  it("a mixed config (config.onetrust + a per-connector onetrust on a ga4 entry) still flushes the ad beacon on accept — the strip prevents stranding", async () => {
    vi.stubGlobal("window", { OnetrustActiveGroups: OPTED_OUT }); // the SAME globalWin both subscriptions would resolve to

    const handle = await boot({
      connectors: [
        // A per-connector `onetrust` riding a ga4 entry — MUST be stripped in `bootConnector`
        // before dispatch, or it reaches `bootGa4Core`'s own 047-02 `if (onetrust)` gate.
        { type: "ga4", ctx: { clientId: "1.1", sessionId: "2" }, onetrust: { groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP } },
        { type: "google-ads", ctx: {}, conversionId: CONVERSION_ID_ADS },
      ],
      onetrust: { groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, activeGroups: OPTED_OUT },
    });
    expect(handle).toBe(window.airlock);

    const connector = createGoogleAdsConnector({
      conversionId: CONVERSION_ID_ADS,
      ctx: initOf(googleAdsWorker()).ctx,
      endpoint: GOOGLE_ADS_CCM_COLLECT_ENDPOINT,
    });
    const [req] = connector.handle({ type: "page_view", params: {} });
    googleAdsWorker().onmessage(readyMsg([req]));
    expect(globalThis.fetch).not.toHaveBeenCalled(); // denied at boot -> held

    // the banner ACCEPT — the composite's own subscription is what installed OptanonWrapper
    // (IF the ga4 per-connector onetrust had NOT been stripped, ga4's own bootGa4Core
    // subscription would have installed it FIRST instead, and the composite's own attempt
    // would have silently no-op'd against the identity-keyed guard).
    window.OnetrustActiveGroups = ACTIVE_GRANTED;
    expect(typeof window.OptanonWrapper).toBe("function");
    window.OptanonWrapper();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1); // the ad beacon flushed — NOT stranded
  });
});

describe("boot(config) — AC3 (048-03 capstone): a OneTrust accept flushes BOTH Google Ads AND Floodlight through the REAL composite", () => {
  it("denied at boot HOLDS a beacon from each; accept flushes BOTH; a later revoke holds a NEW beacon but never un-sends", async () => {
    vi.stubGlobal("window", { OnetrustActiveGroups: OPTED_OUT });

    await boot({
      connectors: [
        { type: "google-ads", ctx: {}, conversionId: CONVERSION_ID_ADS },
        { type: "floodlight", ctx: {}, conversionId: CONVERSION_ID_DC },
      ],
      onetrust: { groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP },
    });

    const adsConnector = createGoogleAdsConnector({
      conversionId: CONVERSION_ID_ADS,
      ctx: initOf(googleAdsWorker()).ctx,
      endpoint: GOOGLE_ADS_CCM_COLLECT_ENDPOINT,
    });
    const dcConnector = createFloodlightConnector({
      conversionId: CONVERSION_ID_DC,
      ctx: initConfigOf(floodlightWorker()).ctx,
      endpoint: FLOODLIGHT_CCM_COLLECT_ENDPOINT,
    });

    googleAdsWorker().onmessage(readyMsg(adsConnector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } })));
    floodlightWorker().onmessage(readyMsg(dcConnector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } })));
    expect(globalThis.fetch).not.toHaveBeenCalled(); // BOTH held

    // the banner ACCEPT
    window.OnetrustActiveGroups = ACTIVE_GRANTED;
    window.OptanonWrapper();

    expect(globalThis.fetch).toHaveBeenCalledTimes(2); // BOTH flushed, once each
    const urls = globalThis.fetch.mock.calls.map(([url]) => String(url));
    // GOOGLE_ADS_CCM_COLLECT_ENDPOINT === FLOODLIGHT_CCM_COLLECT_ENDPOINT (both "ccm/collect") —
    // a `.startsWith(endpoint)` check alone cannot tell WHICH connector flushed which beacon (it
    // would pass even if, say, google-ads alone had flushed twice). Discriminate on the DISTINCT
    // `tid=` conversion ids instead (craft review fix round), so this actually proves EACH
    // connector flushed, not just that fetch fired twice against the shared endpoint.
    expect(urls.some((u) => u.includes(`tid=${CONVERSION_ID_ADS}`))).toBe(true);
    expect(urls.some((u) => u.includes(`tid=${CONVERSION_ID_DC}`))).toBe(true);

    // the revoke — a NEW beacon from each HOLDS; the two already-flushed fetches are untouched
    // (ADR-0007: never un-send).
    window.OnetrustActiveGroups = OPTED_OUT;
    window.OptanonWrapper();

    googleAdsWorker().onmessage(readyMsg(adsConnector.handle({ type: "page_view", params: { page_location: "https://spike.example/2" } })));
    floodlightWorker().onmessage(readyMsg(dcConnector.handle({ type: "page_view", params: { page_location: "https://spike.example/2" } })));

    expect(globalThis.fetch).toHaveBeenCalledTimes(2); // unchanged
  });
});

describe("boot(config) — AC4 (048-03): both-fire (OnConsentChanged + OptanonWrapper) is benign at composite scale", () => {
  // Mutation-provable (DoD): a per-connector mutation that makes `setConsent` re-flush an
  // already-drained held-beacon buffer (e.g. skipping core/airlock.js's `heldBeacons.length`
  // guard) turns the `fetchMock` assertion below red (4 calls instead of 2).
  it("one real change fires BOTH grounded surfaces -> composite.setConsent runs twice, but each connector flushes EXACTLY once", async () => {
    let captured;
    const fixtureOneTrust = { OnConsentChanged: (cb) => { captured = cb; } };
    vi.stubGlobal("window", { OnetrustActiveGroups: OPTED_OUT, OneTrust: fixtureOneTrust });

    const handle = await boot({
      connectors: [
        { type: "google-ads", ctx: {}, conversionId: CONVERSION_ID_ADS },
        { type: "floodlight", ctx: {}, conversionId: CONVERSION_ID_DC },
      ],
      onetrust: { groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP },
    });
    const setConsentSpy = vi.spyOn(handle, "setConsent");

    const adsConnector = createGoogleAdsConnector({
      conversionId: CONVERSION_ID_ADS,
      ctx: initOf(googleAdsWorker()).ctx,
      endpoint: GOOGLE_ADS_CCM_COLLECT_ENDPOINT,
    });
    const dcConnector = createFloodlightConnector({
      conversionId: CONVERSION_ID_DC,
      ctx: initConfigOf(floodlightWorker()).ctx,
      endpoint: FLOODLIGHT_CCM_COLLECT_ENDPOINT,
    });
    googleAdsWorker().onmessage(readyMsg(adsConnector.handle({ type: "page_view", params: {} })));
    floodlightWorker().onmessage(readyMsg(dcConnector.handle({ type: "page_view", params: {} })));
    expect(globalThis.fetch).not.toHaveBeenCalled();

    window.OnetrustActiveGroups = ACTIVE_GRANTED; // the banner ACCEPT — one logical change
    expect(typeof captured).toBe("function"); // surface 1 registered (OnConsentChanged)
    expect(typeof window.OptanonWrapper).toBe("function"); // surface 2 registered (OptanonWrapper)
    captured(); // surface 1 fires
    window.OptanonWrapper(); // surface 2 fires (same real change)

    expect(setConsentSpy).toHaveBeenCalledTimes(2); // both surfaces drove composite.setConsent
    expect(globalThis.fetch).toHaveBeenCalledTimes(2); // exactly once per connector — never 4
  });
});

describe("boot(config) — AC5 (048-03): back-compat + inspector-observable", () => {
  it("no config.onetrust -> subscribes to nothing (no throw), even with a live OneTrust global present", async () => {
    const onConsentChanged = vi.fn();
    vi.stubGlobal("window", { OneTrust: { OnConsentChanged: onConsentChanged } });

    await expect(
      boot({ connectors: [{ type: "google-ads", ctx: {}, conversionId: CONVERSION_ID_ADS }] }),
    ).resolves.toBeTruthy();

    expect(onConsentChanged).not.toHaveBeenCalled(); // guard held: no OnConsentChanged registration
    expect(window.OptanonWrapper).toBeUndefined(); // guard held: no OptanonWrapper hook installed
  });

  it("a direct bootEdsAnalytics({onetrust}) caller (047-02's own path) is unaffected by the bootConnector strip", async () => {
    vi.stubGlobal("document", { cookie: "_ga=GA1.1.5555555555.1600000000", visibilityState: "visible" });
    let captured;
    const fixtureOneTrust = { OnConsentChanged: (cb) => { captured = cb; } };
    const fixtureWin = { OnetrustActiveGroups: null };

    await bootEdsAnalytics({
      endpoints: ["https://t0.example/collect"],
      onetrust: {
        groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP,
        activeGroups: null,
        onetrust: fixtureOneTrust,
        win: fixtureWin,
      },
    });

    // the strip lives in `bootConnector` (the config-entry dispatch path only) — a DIRECT
    // bootEdsAnalytics/bootGa4Core caller never passes through it, so its own 047-02
    // subscription still registers exactly as before.
    expect(typeof captured).toBe("function");
  });

  it("onDiagnostic still fans to the ad connector's seam across the whole held->flushed accept-flow chain", async () => {
    vi.stubGlobal("window", { OnetrustActiveGroups: OPTED_OUT });
    const onDiagnostic = vi.fn();

    await boot(
      { connectors: [{ type: "google-ads", ctx: {}, conversionId: CONVERSION_ID_ADS }], onetrust: { groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP } },
      { onDiagnostic },
    );
    const connector = createGoogleAdsConnector({
      conversionId: CONVERSION_ID_ADS,
      ctx: initOf(googleAdsWorker()).ctx,
      endpoint: GOOGLE_ADS_CCM_COLLECT_ENDPOINT,
    });
    googleAdsWorker().onmessage(readyMsg(connector.handle({ type: "page_view", params: {} })));

    expect(onDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warn", kind: "consent", disposition: "held", purpose: "ad_storage" }),
    );
    onDiagnostic.mockClear();

    window.OnetrustActiveGroups = ACTIVE_GRANTED;
    window.OptanonWrapper();

    expect(onDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "consent", disposition: "flushed", purpose: "ad_storage" }),
    );
  });
});

describe("boot(config) — ADR-0028: a re-boot's LIVE composite still flushes held beacons on a OneTrust accept", () => {
  // The re-boot-unsubscribe residual inherited from 047-02 (refinement-todo § Spec 047): before
  // the fix, a re-`boot()` disposed the prior composite's connectors but LEFT its OneTrust
  // subscription installed, and the prior's permanent first-writer-wins guard made the NEW
  // composite's subscription silently no-op — so the live composite's held ad beacons STRANDED
  // across a re-boot. Mutation-provable (DoD): reverting the driver to the permanent-no-op guard
  // (no active-handler slot) turns the final assertion red (fetch stays 0 — the strand).
  it("re-boot disposes the prior subscription without stranding the new — the second composite's held beacon flushes on accept", async () => {
    vi.stubGlobal("window", { OnetrustActiveGroups: OPTED_OUT });
    const lastAdsWorker = () => FakeWorker.instances.filter((w) => w.url.includes("google-ads-chamber.worker.js")).at(-1);

    // FIRST boot (composite A) under denied consent.
    await boot({
      connectors: [{ type: "google-ads", ctx: {}, conversionId: CONVERSION_ID_ADS }],
      onetrust: { groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP },
    });

    // RE-BOOT (composite B) — installOnWindow disposes composite A, incl. its OneTrust unsubscribe.
    await boot({
      connectors: [{ type: "google-ads", ctx: {}, conversionId: CONVERSION_ID_ADS }],
      onetrust: { groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP },
    });

    // A page-load beacon HELD by composite B's own real-connector-produced output.
    const adsConnector = createGoogleAdsConnector({
      conversionId: CONVERSION_ID_ADS,
      ctx: initOf(lastAdsWorker()).ctx,
      endpoint: GOOGLE_ADS_CCM_COLLECT_ENDPOINT,
    });
    lastAdsWorker().onmessage(readyMsg(adsConnector.handle({ type: "page_view", params: {} })));
    expect(globalThis.fetch).not.toHaveBeenCalled(); // held under denied

    // The banner ACCEPT — composite B (the LIVE composite) must receive the change and flush.
    // Pre-fix (ADR-0028) this stranded (B's subscription no-op'd behind A's permanent guard) -> fetch stayed 0.
    window.OnetrustActiveGroups = ACTIVE_GRANTED;
    window.OptanonWrapper();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1); // B's held beacon flushed — NOT stranded across the re-boot
  });
});
