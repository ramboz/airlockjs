// Spec 064-21 (B5): `aem-martech` 1aa3dee3 + ACDL 3.0.1 on Alloy 2.31.1, the S10 journey, through the airlock wrapper
// (adapters/eds/alloy-bridge.js) in REAL Chromium, against the pinned stock run of the same library.
// Gated like the other real-browser tests: `AIRLOCK_REAL_CHROMIUM=1`. The third-party files are downloaded at test
// time into the gitignored rig/out/ and hash-checked (rig/adobe-b5-martech.mjs).
//
// What is recorded and what is not: the S10 corpus has the set-consent and interact bodies and the URL, count and
// order of two collect POSTs, but NOT the collect bodies. Collect bodies (and the whole journey) are therefore compared
// stock-versus-airlock on the same edge answers; that comparison is SYNTHETIC in the 064-20 sense: no capture was taken.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { attachAlloyBridge, consentToVector, createAlloyCommandBridge } from "../adapters/eds/alloy-bridge.js";
import { chromium } from "playwright";
import { diffBodies, ensureAlloyBundle, loadFixture, replayFixture, splitRequestUrl } from "../rig/adobe-b1-replay.mjs";
import { ensureMartechAsset } from "../rig/adobe-b5-martech.mjs";

const real = process.env.AIRLOCK_REAL_CHROMIUM === "1";
const T = 90000;
const SCOPE = "airlock.readiness.2e2319c8";
const LINK = "web.webinteraction.linkClicks";
const ORG = "908936ED5D35CC220A495CD4@AdobeOrg";
const DATASTREAM = "23190fa7-9e6b-4250-b87b-abcdc8ebc297";

/** The POC page's call sequence (stock-site.mjs), granted case: init, consent, propositionFetch, page view, ACDL link event. */
const journey = (page) => page.evaluate(async ({ orgId, datastreamId, scope, link, pageUrl }) => {
  const m = await (0, eval)('import("/martech/index.js")');
  m.initMartech({
    orgId, datastreamId, edgeDomain: "edge.adobedc.net", defaultConsent: "pending", debugEnabled: false, thirdPartyCookiesEnabled: false,
    idMigrationEnabled: false, targetMigrationEnabled: false, clickCollectionEnabled: false, autoCollectPropositionInteractions: { AJO: "never", TGT: "never" },
  }, {
    analytics: true, personalization: true, performanceOptimized: true, personalizationTimeout: 1000, trackPageView: false, dataLayer: true,
    includeDataLayerState: false, launchUrls: [], alloyInstanceName: "alloy", dataLayerInstanceName: "adobeDataLayer", decisionScopes: [scope],
    shouldProcessEvent: (payload) => payload && payload.event === link,
  });
  await m.updateUserConsent({ collect: true, personalize: true, marketing: false, share: false });
  await m.sendEvent({
    type: "decisioning.propositionFetch", renderDecisions: false, decisionScopes: [scope], personalization: { defaultPersonalizationEnabled: false, sendDisplayEvent: false },
    xdm: { web: { webPageDetails: { name: "airlock-stock-v1", URL: pageUrl } } },
  });
  await m.sendAnalyticsEvent({ eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name: "airlock-stock-v1", URL: pageUrl, pageViews: { value: 1 } } } },
    { __adobe: { analytics: { pageName: "airlock-stock-v1", pageURL: pageUrl } } }, {});
  await m.martechLazy();
  m.pushEventToDataLayer(link, { web: { webInteraction: { name: "airlock-stock-link", type: "other", linkClicks: { value: 1 } } } },
    { __adobe: { analytics: { linkType: "o", linkName: "airlock-stock-link" } } }, {});
  const deadline = Date.now() + 8000;
  const edgeCalls = () => performance.getEntriesByType("resource").filter((e) => /edge\.adobedc\.net|demdex/.test(e.name)).length;
  while (edgeCalls() < 4 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  return { calls: Object.keys(m).sort() };
}, { orgId: ORG, datastreamId: DATASTREAM, scope: SCOPE, link: LINK, pageUrl: "https://main--aem-eds-airlock-poc--adobe-rnd.aem.page/?airlock-stock=v1&case=no-offer&run=airlock05102-c19434f3bd208c0bd9c3706132f6a24b&consent=decline&google-ads=off&meta-pixel=off" });

/** The shim the site serves where aem-martech imports `./alloy.min.js`: it hands aem-martech's queue stub to the wrapper. */
const SHIM = "window.__attachAlloyBridge();";
const ATTACH = (page) => page.evaluate(() => { window.__attachAlloyBridge = () => globalThis.AirlockEds.attachAlloyBridge({ handle: window.__handle, onDiagnostic: (d) => window.__bridgeDiag.push(d) }); window.__bridgeDiag = []; });


const AIRLOCK_BOOT = { consent: {}, context: ["web", "device", "environment"], edgeDomain: "edge.adobedc.net" };
/** Cookie entries arrive in jar order, which is not part of the contract; sort them before comparing. */
const normalised = (text) => {
  const b = JSON.parse(text);
  if (b.meta?.state?.entries) b.meta.state.entries.sort((x, y) => x.key.localeCompare(y.key));
  return JSON.stringify(b);
};
const posts = (network) => network.filter((n) => n.method === "POST");
const pathOf = (n) => new URL(n.url).pathname;

// Known, owned differences. Anything else in a diff fails the test.
const IDENTITY_FETCH = "query.identity.fetch[1]"; // stock config `idMigrationEnabled:false` is not a boot option -> 064-31
const CONSENT_BODY = ["consent[0].value.marketing.any.val", "consent[0].value.marketing.preferred", "consent[0].value.personalize.content.val", "consent[0].value.share.val"]; // stock consent path -> 064-31 AC4

describe.runIf(real)("spec 064-21: aem-martech through the airlock wrapper (real Chromium)", () => {
  let browser;
  let serveStock;
  let serveAirlock;
  let stock;
  let ours;
  let fixtureCache;
  const run = (serve, bootOptions) => replayFixture(browser, "s10-base", { event: null, skipSteps: true, serve, bootOptions, run: async (page) => { await ATTACH(page); return journey(page); } });
  beforeAll(async () => {
    browser = await chromium.launch();
    const [index, acdl, alloy] = await Promise.all([ensureMartechAsset("index.js"), ensureMartechAsset("acdl.min.js"), ensureAlloyBundle()]);
    serveStock = { "/martech/index.js": index, "/martech/acdl.min.js": acdl, "/martech/alloy.min.js": alloy.toString("utf8") };
    serveAirlock = { "/martech/index.js": index, "/martech/acdl.min.js": acdl, "/martech/alloy.min.js": SHIM };
    fixtureCache = await loadFixture("s10-base");
    stock = await run(serveStock, {});
    ours = await run(serveAirlock, AIRLOCK_BOOT);
  }, T * 2);
  afterAll(async () => { await browser?.close(); });

  it("AC2 (recorded S10): the airlock run sends set-consent, one interact, two collects, in the recorded order", async () => {
    const rec = (await loadFixture("s10-base")).requests.filter((r) => r.method === "POST");
    const got = posts(ours.network);
    expect(got.map(pathOf)).toEqual(rec.map((r) => new URL(r.url).pathname));
    expect(got.map((n) => n.method)).toEqual(rec.map((r) => r.method));
    // The interact URL is the recorded one; the set-consent host is part of the consent path (064-31 AC4).
    expect(splitRequestUrl(got[1].url).stable).toBe(splitRequestUrl(rec[1].url).stable);
    expect(splitRequestUrl(got[0].url).stable.replace(/^https:\/\/[^/]+/, "")).toBe(splitRequestUrl(rec[0].url).stable.replace(/^https:\/\/[^/]+/, ""));
  }, T);

  it("AC2 (recorded S10): the interact body is the recorded one with the explicit decision scope, except the identity fetch list (-> 064-31)", () => {
    const rec = JSON.parse(recordedBody("interact"));
    expect(rec.events[0].query.personalization.decisionScopes).toEqual([SCOPE]);
    const got = JSON.parse(posts(ours.network)[1].body);
    expect(got.events[0].xdm.eventType).toBe("decisioning.propositionFetch");
    expect(got.events[0].query.personalization.decisionScopes).toEqual([SCOPE]);
    expect(diffBodies(normalised(posts(ours.network)[1].body), normalised(recordedBody("interact")))).toEqual([IDENTITY_FETCH]);
  });

  it("AC2 (recorded S10): the set-consent body differs from the recording only in the consent value and the identity list (-> 064-31 AC4, AC1)", () => {
    expect(diffBodies(posts(ours.network)[0].body, recordedBody("set-consent")).sort()).toEqual([...CONSENT_BODY, IDENTITY_FETCH].sort());
  });

  it("AC2 (SYNTHETIC, no collect capture): every request of the airlock run equals the stock run's, except the owned differences", () => {
    const a = posts(ours.network);
    const b = posts(stock.network);
    expect(a.map(pathOf)).toEqual(b.map(pathOf));
    // Hosts are compared per request: only the set-consent host differs (-> 064-31 AC4).
    expect(a.map((n) => new URL(n.url).hostname)).toEqual(["adobedc.demdex.net", ...b.slice(1).map((n) => new URL(n.url).hostname)]);
    expect(new URL(b[0].url).hostname).toBe("edge.adobedc.net");
    expect(diffBodies(normalised(a[0].body), normalised(b[0].body)).sort()).toEqual([...CONSENT_BODY, IDENTITY_FETCH].sort());
    for (const k of [1, 2, 3]) expect(diffBodies(normalised(a[k].body), normalised(b[k].body))).toEqual([IDENTITY_FETCH]);
    // the page's data layer link event reached the airlock collect with the ACDL-built xdm and data
    const link = JSON.parse(a[3].body).events[0];
    expect(link.xdm.eventType).toBe(LINK);
    expect(link.data.__adobe.analytics.linkName).toBe("airlock-stock-link");
  });

  it("AC3 (D10, Launch): the POC journey loads no Launch property; no request leaves for a Launch host", () => {
    const hosts = new Set([...ours.allHosts, ...stock.allHosts]);
    expect(hosts.size).toBeGreaterThan(1);
    for (const h of hosts) expect(h).not.toMatch(/adobedtm\.com|launch/);
    expect(posts(ours.network).every((n) => /edge\.adobedc\.net|demdex\.net$/.test(new URL(n.url).hostname))).toBe(true);
  });

  function recordedBody(which) {
    return fixtureCache.requests.filter((r) => r.method === "POST")[which === "set-consent" ? 0 : 1].request_body;
  }
});


// Hermetic (no browser): the wrapper's stock-command mapping.
describe("spec 064-21: the alloy command wrapper (hermetic)", () => {
  const fakeHandle = () => ({ push: vi.fn(), setConsent: vi.fn(), applyPropositions: vi.fn(async () => ({ propositions: [] })), command: vi.fn(async () => "cmd") });

  it("sendEvent maps to push, carries the per-call options, and lets onBeforeEventSend edit or drop the event", async () => {
    const h = fakeHandle();
    const alloy = createAlloyCommandBridge(h, { onDiagnostic: () => {} });
    await alloy("configure", { onBeforeEventSend: (c) => { c.data = { edited: true }; } });
    await alloy("sendEvent", { type: "decisioning.propositionFetch", xdm: { web: {} }, decisionScopes: ["s"], personalization: { sendDisplayEvent: false }, renderDecisions: false, documentUnloading: true });
    expect(h.push).toHaveBeenCalledWith({ event: "page_view", xdm: { web: {}, eventType: "decisioning.propositionFetch" }, data: { edited: true }, documentUnloading: true, decisionScopes: ["s"], personalization: { sendDisplayEvent: false }, renderDecisions: false });
    await alloy("configure", { onBeforeEventSend: () => false });
    await alloy("sendEvent", { xdm: {} });
    expect(h.push).toHaveBeenCalledTimes(1);
  });

  it("diagnoses a callback it cannot carry and per-event config overrides, and never forwards the overrides", async () => {
    const h = fakeHandle();
    const diag = [];
    const alloy = createAlloyCommandBridge(h, { onDiagnostic: (d) => diag.push(d) });
    await alloy("configure", { onSomething: () => {} });
    await alloy("sendEvent", { xdm: {}, edgeConfigOverrides: { com_adobe_target: { enabled: false } } });
    expect(diag.map((d) => d.kind)).toEqual(["unsupported-callback", "unsupported-option"]);
    expect(JSON.stringify(h.push.mock.calls)).not.toContain("com_adobe_target");
  });

  it("reports both overrides, a throwing hook (event dropped) and a consent value it cannot map", async () => {
    const h = fakeHandle();
    const diag = [];
    const alloy = createAlloyCommandBridge(h, { onDiagnostic: (d) => diag.push(d) });
    await alloy("configure", { onBeforeEventSend: () => { throw new Error("boom"); } });
    await alloy("sendEvent", { xdm: {}, datasetId: "d", edgeConfigOverrides: { a: 1 } });
    await alloy("setConsent", { consent: [{ standard: "TCF", version: "2.0", value: "x" }] });
    expect(diag.map((d) => d.kind)).toEqual(["unsupported-option", "unsupported-option", "hook-threw", "unsupported-consent"]);
    expect(h.push).not.toHaveBeenCalled();
    expect(h.setConsent).not.toHaveBeenCalled();
  });

  it("sendEvent never renders unless the page asks (stock default is false)", async () => {
    const h = fakeHandle();
    const alloy = createAlloyCommandBridge(h, { onDiagnostic: () => {} });
    await alloy("sendEvent", { xdm: {} });
    await alloy("sendEvent", { xdm: {}, renderDecisions: true });
    expect(h.push.mock.calls.map((c) => c[0].renderDecisions)).toEqual([false, true]);
  });

  it("setConsent maps Adobe 2.0 collect and personalize onto the vector; applyPropositions and other commands go to the handle", async () => {
    const h = fakeHandle();
    const alloy = createAlloyCommandBridge(h);
    await alloy("setConsent", { consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "y" }, personalize: { content: { val: "n" } }, marketing: { any: { val: "n" } } } }] });
    expect(h.setConsent).toHaveBeenCalledWith({ analytics_storage: "granted", personalization: "denied" });
    expect(consentToVector([{ standard: "IAB TCF", value: {} }])).toBeNull();
    await alloy("applyPropositions", { propositions: [] });
    expect(h.applyPropositions).toHaveBeenCalledWith({ propositions: [] });
    await expect(alloy("getLibraryInfo", {})).resolves.toBe("cmd");
    expect(h.command).toHaveBeenCalledWith("getLibraryInfo", {});
  });

  it("attachAlloyBridge drains the loader's queue stub in order and replaces it", async () => {
    const h = fakeHandle();
    const out = [];
    const g = { alloy: Object.assign(() => {}, { q: [[(v) => out.push(["a", v]), () => {}, ["sendEvent", { xdm: { n: 1 } }]], [(v) => out.push(["b", v]), () => {}, ["sendEvent", { xdm: { n: 2 } }]]] }) };
    const bridge = attachAlloyBridge({ handle: h, global: g });
    expect(g.alloy).toBe(bridge);
    await new Promise((r) => setTimeout(r, 0));
    expect(h.push.mock.calls.map((c) => c[0].xdm.n)).toEqual([1, 2]);
    expect(out.map((x) => x[0])).toEqual(["a", "b"]);
  });
});
