// Spec 064-21 (B5): `aem-martech` 1aa3dee3 + ACDL 3.0.1 on Alloy 2.31.1, the S10 journey, through the airlock wrapper
// (adapters/eds/alloy-bridge.js) in REAL Chromium, against the pinned stock run of the same library.
// Gated like the other real-browser tests: `AIRLOCK_REAL_CHROMIUM=1`. The third-party files are downloaded at test
// time into the gitignored rig/out/ and hash-checked (rig/adobe-b5-martech.mjs).
//
// What is recorded and what is not: the S10 corpus has the set-consent and interact bodies and the URL, count and
// order of two collect POSTs, but NOT the collect bodies. Collect bodies (and the whole journey) are therefore compared
// stock-versus-airlock on the same edge answers; that comparison is SYNTHETIC in the 064-20 sense: no capture was taken.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { consentToVector, createAlloyCommandBridge } from "../adapters/eds/alloy-bridge.js";
import { attachQueueShim } from "../rig/alloy-queue-shim.mjs";
import { chromium } from "playwright";
import { diffBodies, ensureAlloyBundle, loadFixture, replayFixture, splitRequestUrl } from "../rig/adobe-b1-replay.mjs";
import { ensureMartechAsset, buildMartechLibrary } from "../rig/adobe-b5-martech.mjs";

const real = process.env.AIRLOCK_REAL_CHROMIUM === "1";
const T = 90000;
const SCOPE = "airlock.readiness.2e2319c8";
const LINK = "web.webinteraction.linkClicks";
const ORG = "908936ED5D35CC220A495CD4@AdobeOrg";
const DATASTREAM = "23190fa7-9e6b-4250-b87b-abcdc8ebc297";

/** The POC page's call sequence (stock-site.mjs), granted case: init, consent, propositionFetch, page view, ACDL link event. */
const journey = (page, extra = {}) => page.evaluate(async ({ orgId, datastreamId, scope, link, pageUrl, extra: more }) => {
  const m = await (0, eval)('import("/martech/index.js")');
  m.initMartech({
    orgId, datastreamId, edgeDomain: "edge.adobedc.net", defaultConsent: more.defaultConsent || "pending", debugEnabled: false, thirdPartyCookiesEnabled: false,
    idMigrationEnabled: false, targetMigrationEnabled: false, clickCollectionEnabled: false, autoCollectPropositionInteractions: { AJO: "never", TGT: "never" },
  }, {
    analytics: true, personalization: true, performanceOptimized: true, personalizationTimeout: 1000, trackPageView: false, dataLayer: true,
    includeDataLayerState: false, launchUrls: [], alloyInstanceName: "alloy", dataLayerInstanceName: "adobeDataLayer", decisionScopes: [scope],
    shouldProcessEvent: (payload) => payload && payload.event === link, ...more, ...(more.useHandle ? { handle: window.__handle } : {}),
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
  return {
    calls: Object.keys(m).sort(),
    globals: { alloy: typeof window.alloy, alloyNS: typeof window.__alloyNS, adobeDataLayer: typeof window.adobeDataLayer },
    resources: performance.getEntriesByType("resource").map((e) => new URL(e.name).pathname),
  };
}, { orgId: ORG, datastreamId: DATASTREAM, scope: SCOPE, link: LINK, extra, pageUrl: "https://main--aem-eds-airlock-poc--adobe-rnd.aem.page/?airlock-stock=v1&case=no-offer&run=airlock05102-c19434f3bd208c0bd9c3706132f6a24b&consent=decline&google-ads=off&meta-pixel=off" });

/** Test-only: the stand-in a site would serve where aem-martech imports `./alloy.min.js`; it hands the queue stub to the wrapper. */
const SHIM = "window.__attachAlloyBridge();";
const ATTACH = (page) => page.evaluate(([src]) => {
  const attach = (0, eval)(`(${src})`);
  window.__bridgeDiag = [];
  window.__attachAlloyBridge = () => attach(globalThis.AirlockEds.createAlloyCommandBridge(window.__handle, { onDiagnostic: (d) => window.__bridgeDiag.push(d) }), window, "alloy");
}, [attachQueueShim.toString()]);


const AIRLOCK_BOOT = { consent: {}, context: ["web", "device", "environment"], edgeDomain: "edge.adobedc.net", thirdPartyCookiesEnabled: false };

/** The eager, lazy and delayed phases (no manual sendEvent): the default page-view path, with the body's style changes recorded. */
const flowJourney = (page, extra = {}) => page.evaluate(async ({ orgId, datastreamId, scope, extra: more, delayGrant }) => {
  const styles = [];
  const edgeStarts = () => performance.getEntriesByType("resource").filter((e) => /edge\.adobedc\.net|demdex/.test(e.name)).map((e) => e.startTime);
  let grantAt = null;
  new MutationObserver(() => styles.push(document.body.getAttribute("style") || "")).observe(document.body, { attributes: true, attributeFilter: ["style"] });
  const m = await (0, eval)('import("/martech/index.js")');
  m.initMartech({
    orgId, datastreamId, edgeDomain: "edge.adobedc.net", defaultConsent: more.defaultConsent || "pending", debugEnabled: false, thirdPartyCookiesEnabled: false,
    idMigrationEnabled: false, targetMigrationEnabled: false, clickCollectionEnabled: false, autoCollectPropositionInteractions: { AJO: "never", TGT: "never" },
    ...(more.deleteImplementationDetails ? { onBeforeEventSend: (p) => { delete p.xdm.implementationDetails; } } : {}),
  }, {
    analytics: true, personalization: true, performanceOptimized: true, personalizationTimeout: 1000, trackPageView: true, dataLayer: true,
    includeDataLayerState: false, launchUrls: [], alloyInstanceName: "alloy", dataLayerInstanceName: "adobeDataLayer", decisionScopes: [scope],
    ...more, ...(more.useHandle ? { handle: window.__handle } : {}),
    ...(more.useAirlock ? { airlock: { bundleUrl: "/rig/alloy.min.js", workerUrl: "/rig/chamber.js" } } : {}),
  });
  const consent = () => { grantAt = performance.now(); return m.updateUserConsent({ collect: true, personalize: true, marketing: false, share: false }); };
  if (!delayGrant) await consent();
  const eager = m.martechEager();
  if (delayGrant) { await new Promise((r) => setTimeout(r, 1500)); await consent(); }
  await eager;
  await m.martechLazy();
  await m.martechDelayed();
  const deadline = Date.now() + 8000;
  while (edgeStarts().length < 3 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => setTimeout(r, 200));
  return { styles, finalStyle: document.body.getAttribute("style") || "", grantAt, edgeStarts: edgeStarts(), globals: { alloy: typeof window.alloy, adobeDataLayer: typeof window.adobeDataLayer } };
}, { orgId: ORG, datastreamId: DATASTREAM, scope: SCOPE, extra, delayGrant: Boolean(extra.delayGrant) });
/** Cookie entries arrive in jar order, which is not part of the contract; sort them before comparing. */
const normalised = (text) => {
  const b = JSON.parse(text);
  if (b.meta?.state?.entries) b.meta.state.entries.sort((x, y) => x.key.localeCompare(y.key));
  return JSON.stringify(b);
};
const posts = (network) => network.filter((n) => n.method === "POST");
const pathOf = (n) => new URL(n.url).pathname;

const isPznQueryField = (p) => /^events\[0\]\.query\.personalization\.(decisionScopes|schemas|surfaces)\[/.test(p);
const sameBody = (x, y) => diffBodies(normalised(x.body), normalised(y.body)).filter((p) => !isPznQueryField(p)).length === 0;
const edgeCall = (n) => pathOf(n).split("/").pop();
/**
 * Bug 007. In the personalization-off journey the page-view `collect` and the `linkClicks` `interact` are independent sends: stock
 * itself starts them in either order under load (the SDK invokes them in a fixed order, the browser starts them in either). Returns
 * the library's requests re-aligned to stock's order, after asserting what must stay strict: `set-consent` is first in both arms
 * and is the only request before the two sends, both arms have the same count, and each of stock's two sends is matched to a
 * library request with the same URL (requestId aside) and an equal body, so a changed body, event, event order, a missing or a
 * duplicated request still fails. Event order inside a request is part of the body and is not normalised.
 */
const alignIndependentSends = (lib, stock) => {
  expect(edgeCall(stock[0])).toBe("set-consent");
  expect(edgeCall(lib[0])).toBe("set-consent");
  expect(lib.map(edgeCall).sort()).toEqual(stock.map(edgeCall).sort());
  const left = lib.slice(1);
  const aligned = stock.slice(1).map((sr) => {
    expect(["collect", "interact"]).toContain(edgeCall(sr));
    const i = left.findIndex((lr) => splitRequestUrl(lr.url).stable === splitRequestUrl(sr.url).stable && sameBody(lr, sr));
    if (i < 0) {
      const same = left.find((lr) => splitRequestUrl(lr.url).stable === splitRequestUrl(sr.url).stable);
      expect(same, `no library ${edgeCall(sr)} request matches stock's`).toBeDefined();
      expect(diffBodies(normalised(same.body), normalised(sr.body)).filter((p) => !isPznQueryField(p))).toEqual([]);
    }
    return left.splice(i, 1)[0];
  });
  return [lib[0], ...aligned];
};
/** The library's requests equal stock's: same URLs (requestId aside) and bodies in the same order, except `independent` sends (bug 007). */
const compareRequests = (lib, stock, { independent = false } = {}) => {
  const a = independent ? alignIndependentSends(lib, stock) : lib;
  expect(a.map((n) => splitRequestUrl(n.url).stable)).toEqual(stock.map((n) => splitRequestUrl(n.url).stable));
  for (let k = 0; k < stock.length; k += 1) expect(diffBodies(normalised(a[k].body), normalised(stock[k].body)).filter((p) => !isPznQueryField(p))).toEqual([]);
};
/** A SYNTHETIC edge answer (no capture): CORS headers for the page's origin and a fixed requestId; `payload` is the decisions array. */
const syntheticAnswer = (req, payload, delay = 0) => {
  const origin = req.headers().origin || "*";
  const headers = { "content-type": "application/json", "access-control-allow-origin": origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, GET, OPTIONS" };
  const body = JSON.stringify({ requestId: "00000000-0000-0000-0000-000000000069", handle: [{ type: "personalization:decisions", payload, eventIndex: 0 }] });
  return new Promise((resolve) => setTimeout(() => resolve({ status: 200, headers, body }), delay));
};


describe.runIf(real)("spec 064-21: aem-martech through the airlock wrapper (real Chromium)", () => {
  let browser;
  let serveStock;
  let serveAirlock;
  let stock;
  let ours;
  let fixtureCache;
  const run = (serve, bootOptions, boot = true) => replayFixture(browser, "s10-base", { event: null, skipSteps: true, serve, bootOptions, boot, run: async (page) => { await ATTACH(page); return journey(page); } });
  beforeAll(async () => {
    browser = await chromium.launch();
    const [index, acdl, alloy] = await Promise.all([ensureMartechAsset("index.js"), ensureMartechAsset("acdl.min.js"), ensureAlloyBundle()]);
    serveStock = { "/martech/index.js": index, "/martech/acdl.min.js": acdl, "/martech/alloy.min.js": alloy.toString("utf8") };
    serveAirlock = { "/martech/index.js": index, "/martech/acdl.min.js": acdl, "/martech/alloy.min.js": SHIM };
    fixtureCache = await loadFixture("s10-base");
    stock = await run(serveStock, {}, false);
    ours = await run(serveAirlock, AIRLOCK_BOOT);
  }, T * 2);
  afterAll(async () => { await browser?.close(); });

  it("AC2 (recorded S10): the airlock run sends set-consent, one interact, two collects, in the recorded order", async () => {
    const rec = (await loadFixture("s10-base")).requests.filter((r) => r.method === "POST");
    const got = posts(ours.network);
    expect(got.map(pathOf)).toEqual(rec.map((r) => new URL(r.url).pathname));
    expect(got.map((n) => n.method)).toEqual(rec.map((r) => r.method));
    expect(splitRequestUrl(got[1].url).stable).toBe(splitRequestUrl(rec[1].url).stable);
    expect(splitRequestUrl(got[0].url).stable).toBe(splitRequestUrl(rec[0].url).stable);
  }, T);

  it("AC2 (recorded S10): the interact body is the recorded one with the explicit decision scope", () => {
    const rec = JSON.parse(recordedBody("interact"));
    expect(rec.events[0].query.personalization.decisionScopes).toEqual([SCOPE]);
    const got = JSON.parse(posts(ours.network)[1].body);
    expect(got.events[0].xdm.eventType).toBe("decisioning.propositionFetch");
    expect(got.events[0].query.personalization.decisionScopes).toEqual([SCOPE]);
    expect(diffBodies(normalised(posts(ours.network)[1].body), normalised(recordedBody("interact")))).toEqual([]);
  });

  it("AC2 (recorded S10): the set-consent body equals the recording: the page's consent object is stock's (064-30)", () => {
    expect(diffBodies(posts(ours.network)[0].body, recordedBody("set-consent")).sort()).toEqual([]);
  });

  it("AC2 (SYNTHETIC, no collect capture): every request of the airlock run equals the stock run's (host and body)", () => {
    const a = posts(ours.network);
    const b = posts(stock.network);
    expect(a.map(pathOf)).toEqual(b.map(pathOf));
    expect(a.map((n) => new URL(n.url).hostname)).toEqual(b.map((n) => new URL(n.url).hostname));
    expect(new URL(b[0].url).hostname).toBe("edge.adobedc.net");
    expect(diffBodies(normalised(a[0].body), normalised(b[0].body))).toEqual([]);
    for (const k of [1, 2, 3]) expect(diffBodies(normalised(a[k].body), normalised(b[k].body))).toEqual([]);
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

describe.runIf(real)("spec 069-03: the Airlock martech library in the S10 differential (real Chromium)", () => {
  let browser;
  let stock;
  let lib;
  let serveStock;
  let serveLib;
  const runLib = (extra = {}, serve = serveLib) => replayFixture(browser, "s10-base", { event: null, skipSteps: true, serve, bootOptions: AIRLOCK_BOOT, run: (page) => journey(page, { useHandle: true, ...extra }) });
  const runStock = (extra = {}) => replayFixture(browser, "s10-base", { event: null, skipSteps: true, serve: serveStock, boot: false, run: (page) => journey(page, extra) });
  beforeAll(async () => {
    browser = await chromium.launch();
    const [index, acdl, alloy, library] = await Promise.all([ensureMartechAsset("index.js"), ensureMartechAsset("acdl.min.js"), ensureAlloyBundle(), buildMartechLibrary()]);
    serveStock = { "/martech/index.js": index, "/martech/acdl.min.js": acdl, "/martech/alloy.min.js": alloy.toString("utf8") };
    serveLib = { "/martech/index.js": library };
    stock = await runStock();
    lib = await runLib();
  }, T * 2);
  afterAll(async () => { await browser?.close(); });

  it("AC1/AC2b (recorded S10): the library run sends the recorded requests and equals the stock run (SYNTHETIC collect bodies)", async () => {
    const rec = (await loadFixture("s10-base")).requests.filter((r) => r.method === "POST");
    const a = posts(lib.network);
    const b = posts(stock.network);
    expect(a.map(pathOf)).toEqual(rec.map((r) => new URL(r.url).pathname));
    expect(splitRequestUrl(a[0].url).stable).toBe(splitRequestUrl(rec[0].url).stable);
    expect(splitRequestUrl(a[1].url).stable).toBe(splitRequestUrl(rec[1].url).stable);
    expect(diffBodies(a[0].body, rec[0].request_body)).toEqual([]);
    expect(diffBodies(normalised(a[1].body), normalised(rec[1].request_body))).toEqual([]);
    expect(a.map((n) => new URL(n.url).hostname)).toEqual(b.map((n) => new URL(n.url).hostname));
    for (const k of [0, 1, 2, 3]) expect(diffBodies(normalised(a[k].body), normalised(b[k].body))).toEqual([]);
  }, T);

  it("AC1/AC2b: no window.alloy, no ACDL file, no alloy.min.js on the main thread, no data layer proxy", () => {
    expect(lib.results.run.globals).toEqual({ alloy: "undefined", alloyNS: "undefined", adobeDataLayer: "undefined" });
    const res = lib.results.run.resources;
    expect(res.some((p) => /acdl\.min\.js/.test(p))).toBe(false);
    expect(res.filter((p) => /alloy\.min\.js/.test(p))).toEqual([]);
    expect(stock.results.run.globals.alloy).toBe("function");
  });

  it("AC3g: defaultConsent \"out\" matches stock at the request level (nothing leaves until collect is granted)", async () => {
    const [s, l] = await Promise.all([runStock({ defaultConsent: "out" }), runLib({ defaultConsent: "out" })]);
    process.stderr.write(`defaultConsent out: stock=${posts(s.network).map(pathOf)} library=${posts(l.network).map(pathOf)}\n`);
    expect(posts(l.network).map(pathOf)).toEqual(posts(s.network).map(pathOf));
  }, T);

  for (const [name, extra] of [["trackPageView:false is the journey default", { trackPageView: false }], ["trackPageView:true", { trackPageView: true }], ["performanceOptimized:false", { performanceOptimized: false }]]) {
    it(`AC6 (SYNTHETIC, no capture): ${name} sends the stock run's requests`, async () => {
      const [s, l] = await Promise.all([runStock(extra), runLib(extra)]);
      const a = posts(l.network);
      const b = posts(s.network);
      expect(a.map(pathOf)).toEqual(b.map(pathOf));
      for (let k = 0; k < b.length; k += 1) expect(diffBodies(normalised(a[k].body), normalised(b[k].body))).toEqual([]);
    }, T);
  }

  const flow = (extra, library) => replayFixture(browser, "s10-base", { event: null, skipSteps: true, serve: library ? serveLib : serveStock, bootOptions: library ? AIRLOCK_BOOT : {}, boot: library, run: (page) => flowJourney(page, library ? { useHandle: true, ...extra } : extra) });
  const comparePosts = (l, s) => {
    const a = posts(l.network);
    const b = posts(s.network);
    expect(a.map(pathOf)).toEqual(b.map(pathOf));
    for (let k = 0; k < b.length; k += 1) { const d = diffBodies(normalised(a[k].body), normalised(b[k].body)); if (d.length) console.log("compare mismatch (bug 006 watch): post", k, "meta.state.domain", JSON.stringify({ lib: JSON.parse(a[k].body).meta?.state?.domain, stock: JSON.parse(b[k].body).meta?.state?.domain })); expect(d).toEqual([]); }
    return b.length;
  };
  for (const [name, extra] of [["default path (martechEager page view, martechLazy none, martechDelayed)", {}], ["trackPageView:false (no offer, so no display event)", { trackPageView: false }], ["performanceOptimized:false (the __view__ fetch, body hidden then restored)", { performanceOptimized: false }]]) {
    it(`AC6 (SYNTHETIC, no capture): martechEager/Lazy/Delayed, ${name}: requests and body styles equal stock`, async () => {
      const [s, l] = await Promise.all([flow(extra, false), flow(extra, true)]);
      expect(comparePosts(l, s)).toBeGreaterThan(1);
      expect(l.results.run.styles).toEqual(s.results.run.styles);
      expect(l.results.run.finalStyle).toBe(s.results.run.finalStyle);
      expect(l.results.run.globals.alloy).toBe("undefined");
    }, T);
  }

  it("AC3g: with defaultConsent \"out\" and a delayed grant, nothing leaves before the grant and the requests equal stock", async () => {
    const extra = { defaultConsent: "out", delayGrant: true };
    const [s, l] = await Promise.all([flow(extra, false), flow(extra, true)]);
    expect(comparePosts(l, s)).toBeGreaterThanOrEqual(1);
    for (const run of [s.results.run, l.results.run]) {
      expect(run.edgeStarts.length).toBeGreaterThanOrEqual(1);
      expect(Math.min(...run.edgeStarts)).toBeGreaterThanOrEqual(run.grantAt);
    }
  }, T);

  it("AC4g: a page hook that deletes implementationDetails gets it refilled by the chamber; the bodies are compared with stock", async () => {
    const extra = { deleteImplementationDetails: true };
    const [s, l] = await Promise.all([flow(extra, false), flow(extra, true)]);
    const refilled = (r) => posts(r.network).map((p) => (JSON.parse(p.body).events || []).map((e) => Boolean(e.xdm && e.xdm.implementationDetails)));
    // Observed deviation: stock lets the page hook delete the field; the chamber refills it (069-03 Findings).
    expect(refilled(s).flat().length).toBeGreaterThanOrEqual(1);
    expect(refilled(l).flat().length).toBeGreaterThanOrEqual(1);
    expect(refilled(s).flat().every((v) => v === false)).toBe(true);
    expect(refilled(l).flat().every((v) => v === true)).toBe(true);
    const a = posts(l.network);
    const b = posts(s.network);
    expect(a.map(pathOf)).toEqual(b.map(pathOf));
    for (let k = 0; k < b.length; k += 1) {
      expect(diffBodies(normalised(a[k].body), normalised(b[k].body)).filter((d) => !/implementationDetails/.test(d))).toEqual([]);
    }
  }, T);

  it("AC1 (boot path): martechConfig.airlock (no pre-booted handle) boots the chamber and sends the stock run's requests", async () => {
    const [s, l] = await Promise.all([flow({}, false), replayFixture(browser, "s10-base", { event: null, skipSteps: true, serve: serveLib, bootOptions: AIRLOCK_BOOT, run: (page) => flowJourney(page, { useAirlock: true }) })]);
    expect(comparePosts(l, s)).toBeGreaterThan(1);
    expect(l.results.run.globals.alloy).toBe("undefined");
  }, T);

  it("AC4a: the combined { propositions, viewName } applyPropositions form, with a warmed view cache, gives the stock run's whole result and DOM", async () => {
    const NS = "https://ns.adobe.com/personalization/";
    const dom = (id, html) => ({ type: "setHtml", selector: id, content: html });
    const proposition = (id, scope, data, scopeType) => ({ id, scope, scopeDetails: { decisionProvider: "TGT", activity: { id: `act-${id}` }, ...(scopeType ? { characteristics: { scopeType } } : {}) }, items: [{ id: `i-${id}`, schema: `${NS}dom-action`, data }] });
    const cart = proposition("v-cart", "cart", dom("#z", "<b>airlock-069-03-view</b>"), "view");
    const pageWide = { id: "pw", scope: "__view__", scopeDetails: { decisionProvider: "TGT", activity: { id: "act-pw" }, characteristics: { eventToken: "t" } }, items: [{ id: "pw-0", schema: `${NS}default-content-item`, meta: {} }] };
    const own = proposition("own", "own", dom("#o", "<i>airlock-069-03-own</i>"));
    // SYNTHETIC answer (no capture): the warm-up fetch carries the view-scoped proposition; set-consent falls through to the fixture.
    const respond = (req) => {
      if (req.method() !== "POST" || !/propositionFetch|pageViews/.test(req.postData() || "")) return null;
      return syntheticAnswer(req, [pageWide, cart]);
    };
    const bodyHtml = '<main><div id="z">orig</div><div id="o">orig</div></main>';
    const arm = (library) => replayFixture(browser, "s10-base", {
      event: null, skipSteps: true, serve: library ? serveLib : serveStock, // The library fetches only declared scopes (AC6): this placement makes it fetch `__view__`, which carries the warmed view cache.
      bootOptions: library ? { ...AIRLOCK_BOOT, placements: [{ scope: "__view__", selector: "#v", minHeight: 0 }] } : {}, boot: library, bodyHtml, respond,
      run: (page) => page.evaluate(async ({ lib, own: prop, orgId, datastreamId }) => {
        const m = await (0, eval)('import("/martech/index.js")');
        m.initMartech({ orgId, datastreamId, edgeDomain: "edge.adobedc.net", defaultConsent: "pending", debugEnabled: false, thirdPartyCookiesEnabled: false, idMigrationEnabled: false, targetMigrationEnabled: false, clickCollectionEnabled: false }, { personalization: true, ...(lib ? { handle: window.__handle } : {}) });
        await m.updateUserConsent({ collect: true, personalize: true, marketing: false, share: false });
        // The handle's result carries only propositions and decisions (069-01), stock's also has destinations: compare the common part.
        const settle = (p) => p.then((r) => { const { destinations, ...rest } = JSON.parse(JSON.stringify(r ?? null)) || {}; return { ok: rest }; }, (e) => ({ err: String(e.message).split("\n")[0] }));
        const target = () => (lib ? m.getAirlockHandle() : window.alloy);
        const call = (name, o) => (lib ? target()[name](o) : window.alloy(name, o));
        const warm = await settle(call("sendEvent", { renderDecisions: false, xdm: { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name: "airlock-069-03" } } } }));
        const combined = await settle(call("applyPropositions", { propositions: [prop], viewName: "cart" }));
        const miss = await settle(call("applyPropositions", { propositions: [prop], viewName: "nowhere" }));
        return { warm, combined, miss, dom: document.body.innerText };
      }, { lib: library, own, orgId: ORG, datastreamId: DATASTREAM }),
    });
    const [s, l] = await Promise.all([arm(false), arm(true)]);
    expect(l.results.run).toEqual(s.results.run);
    expect(s.results.run.warm.ok.propositions.map((p) => p.id)).toEqual(["pw"]);
    expect(s.results.run.combined.ok.propositions.map((p) => p.id).sort()).toEqual(["own", "v-cart"]);
    expect(s.results.run.miss.ok.propositions.map((p) => p.id)).toEqual(["own"]);
    expect(s.results.run.dom).toContain("airlock-069-03-view");
    expect(s.results.run.dom).toContain("airlock-069-03-own");
  }, T);
});


/** 069-05: one display-flow journey, run as-is against the stock arm and the library arm. Returns what the page shows and the edge request starts. */
const EDGE_HOST = /edge\.adobedc\.net|demdex/;
/** Counts the edge requests the page and its chamber Worker start or finish (Playwright reports Worker traffic on the page; performance entries of the main window do not see it). */
const watchEdge = (page) => {
  const seen = { count: 0 };
  const bump = (r) => { if (EDGE_HOST.test(r.url())) seen.count += 1; };
  page.on("request", bump);
  page.on("requestfinished", bump);
  page.on("requestfailed", bump);
  return seen;
};
/** Waits until no edge request started or finished for `quietMs` (bounded by `capMs`), from the Node side so the library arm's Worker requests count. */
const edgeQuiet = async (seen, quietMs = 1600, capMs = 8000) => {
  const deadline = Date.now() + capMs;
  let last = seen.count;
  let quietSince = Date.now();
  while (Date.now() < deadline && Date.now() - quietSince < quietMs) {
    await new Promise((r) => setTimeout(r, 50));
    if (seen.count !== last) { last = seen.count; quietSince = Date.now(); }
  }
  if (Date.now() - quietSince < quietMs) console.error(`edgeQuiet: still ${Date.now() - quietSince}ms since last edge request at the ${capMs}ms cap`);
};
const displayJourney = async (page, opts = {}) => {
  const seen = watchEdge(page);
  const result = await page.evaluate(async ({ orgId, datastreamId, scope, more }) => {
    const m = await (0, eval)('import("/martech/index.js")');
    const personalization = more.personalization !== false;
    m.initMartech({
      orgId, datastreamId, edgeDomain: "edge.adobedc.net", defaultConsent: "pending", debugEnabled: false, thirdPartyCookiesEnabled: false,
      idMigrationEnabled: false, targetMigrationEnabled: false, clickCollectionEnabled: false, autoCollectPropositionInteractions: { AJO: "never", TGT: "never" },
    }, {
      analytics: true, personalization, performanceOptimized: true, personalizationTimeout: 1000, trackPageView: true, dataLayer: false, includeDataLayerState: false,
      launchUrls: [], alloyInstanceName: "alloy", dataLayerInstanceName: "adobeDataLayer", decisionScopes: [scope], ...more.config, ...(more.useHandle ? { handle: window.__handle } : {}),
    });
    const grant = { collect: true, personalize: true, marketing: false, share: false };
    const decorate = () => setTimeout(() => document.getElementById("hero").setAttribute("data-block-status", "loaded"), more.decorateAfter);
    let sent;
    let early;
    if (personalization) {
      await m.updateUserConsent(grant);
      const eager = m.martechEager();
      if (more.decorateAfter) decorate();
      await eager;
      await m.martechLazy();
    } else {
      // Personalization off: alloy loads in martechLazy, so the grant and the event settle only after it.
      const consent = m.updateUserConsent(grant);
      const send = () => m.sendEvent({ xdm: { eventType: "web.webinteraction.linkClicks", web: { webInteraction: { name: "airlock-069-05", type: "other", linkClicks: { value: 1 } } } } }).then(() => "ok", (e) => `err:${String(e.message).split("\n")[0]}`);
      if (more.sendBeforeLazy) sent = send();
      await m.martechEager();
      await m.martechLazy();
      await consent;
      early = await (sent || send());
    }
    return { early };
  }, { orgId: ORG, datastreamId: DATASTREAM, scope: SCOPE, more: opts });
  await edgeQuiet(seen);
  const state = await page.evaluate(() => ({ hero: (document.getElementById("hero") || { innerHTML: null }).innerHTML, globals: { alloy: typeof window.alloy, adobeDataLayer: typeof window.adobeDataLayer } }));
  return { ...result, ...state };
};

/** A SYNTHETIC edge answer (no capture) with one dom-action offer for the fetch; the same bytes go to both arms. */
const OFFER_ID = "airlock-069-05-offer";
const OFFER = { id: OFFER_ID, scope: SCOPE, scopeDetails: { decisionProvider: "TGT", activity: { id: "airlock-069-05-activity" }, characteristics: { eventToken: "airlock-069-05-token" } },
  items: [{ id: "airlock-069-05-item", schema: "https://ns.adobe.com/personalization/dom-action", data: { type: "setHtml", selector: "#hero", content: "<b>airlock-069-05-offer</b>" } }] };
/** The per-arm responder; `stats.answered` counts the fetches answered, so a test can tell a late answer from no fetch at all. */
const DOM_ACTION = "https://ns.adobe.com/personalization/dom-action";
const withOffer = ({ delay = 0 } = {}, stats = { answered: 0 }) => (req) => {
  if (req.method() !== "POST" || !/propositionFetch/.test(req.postData() || "")) return null;
  return syntheticAnswer(req, [OFFER], delay).then((answer) => { stats.answered += 1; return answer; });
};

/** Failed boot: martechLazy after a chamber (library) or Alloy file (stock) that cannot load. Reports how martechLazy settled and what the page shows. */
const failedBootJourney = (page, opts = {}) => page.evaluate(async ({ orgId, datastreamId, scope, more }) => {
  const m = await (0, eval)('import("/martech/index.js")');
  const settled = (p) => Promise.resolve(p).then(() => "ok", (e) => `err:${String(e && e.message).split("\n")[0]}`);
  const init = settled(m.initMartech({
    orgId, datastreamId, edgeDomain: more.edgeDomain || "edge.adobedc.net", defaultConsent: "pending", debugEnabled: false, thirdPartyCookiesEnabled: false,
    idMigrationEnabled: false, targetMigrationEnabled: false, clickCollectionEnabled: false,
  }, {
    analytics: true, personalization: true, performanceOptimized: more.performanceOptimized, personalizationTimeout: 500, trackPageView: true, dataLayer: false,
    launchUrls: [], alloyInstanceName: "alloy", decisionScopes: [scope], ...(more.airlock ? { airlock: more.airlock } : {}),
  }));
  const consent = settled(m.updateUserConsent({ collect: true, personalize: true, marketing: false, share: false }));
  const eager = await settled(m.martechEager());
  const lazy = await settled(m.martechLazy());
  // Deliberate fixed wait: the claim is that nothing is ever sent, and absence cannot be awaited; the real check is the Node-side request list.
  await new Promise((r) => setTimeout(r, 1500));
  return { init: await init, eager, lazy, consent: await Promise.race([consent, new Promise((r) => setTimeout(() => r("pending"), 100))]), bodyStyle: document.body.getAttribute("style") || "" };
}, { orgId: ORG, datastreamId: DATASTREAM, scope: SCOPE, more: opts });

describe.runIf(real)("spec 069-05: the Airlock martech library display flows against stock (real Chromium, SYNTHETIC answers)", () => {
  let browser;
  let serveStock;
  let serveLib;
  const heroHtml = (loaded) => `<main><div id="hero"${loaded ? ' data-block-status="loaded"' : ""}>default</div></main>`;
  /** `more.placements` declares the hero placement for the library arm; `offer` (options for withOffer) answers the fetch with the synthetic offer. */
  const arm = async (library, more, offer) => {
    const stats = { answered: 0 };
    const respond = offer ? withOffer(offer, stats) : undefined;
    const r = await replayFixture(browser, "s10-base", {
      event: null, skipSteps: true, serve: library ? serveLib : serveStock, bootOptions: library ? { ...AIRLOCK_BOOT, ...(more.placements ? { placements: [{ scope: SCOPE, selector: "#hero", minHeight: 0 }] } : {}) } : {}, boot: library, bodyHtml: heroHtml(!more.decorateAfter), respond,
      run: (page) => displayJourney(page, library ? { ...more, useHandle: true } : more),
    });
    r.answered = stats.answered;
    return r;
  };
  const both = (more, offer) => Promise.all([arm(false, more, offer), arm(true, more, offer)]);
  // AC1 and AC4 are two views of the same personalization-off journey: run it once.
  let offJourney;
  const personalizationOff = () => { offJourney = offJourney || both({ personalization: false }); return offJourney; };
  // AC3 and AC6 are two views of the same trackPageView:false offer journey: run it once.
  let offerRun;
  const offerNoPageView = () => { offerRun = offerRun || both({ config: { trackPageView: false }, placements: true }, {}); return offerRun; };
  const bodiesOf = (r) => posts(r.network).map((n) => JSON.parse(n.body));
  const eventTypesOf = (requests) => requests.flatMap((n) => (JSON.parse(n.body).events || []).map((e) => e.xdm && e.xdm.eventType));
  const eventTypes = (r) => eventTypesOf(posts(r.network));
  const fetchQuery = (r) => bodiesOf(r).map((x) => x.events && x.events[0].query && x.events[0].query.personalization).find(Boolean);
  /**
   * Same requests in the same order (path, query string without requestId), equal bodies (cookie order aside) except the three fetch
   * query fields, and the page shows the same. With `fetch` (default) the fetch request must exist in both arms and its scopes,
   * surfaces and schemas are asserted explicitly (AC6): they are the one place the library differs. With `independent` the page-view
   * collect and the event interact may start in either order (bug 007); everything else stays strict.
   */
  const sameAsStock = (s, l, { fetch = true, independent = false } = {}) => {
    const b = posts(s.network);
    compareRequests(posts(l.network), b, { independent });
    if (fetch) {
      const sq = fetchQuery(s);
      const lq = fetchQuery(l);
      expect(sq).toBeDefined();
      expect(lq).toBeDefined();
      expect(sq.decisionScopes).toEqual([SCOPE, "__view__"]);
      expect(sq.surfaces).toEqual(["web://main--aem-eds-airlock-poc--adobe-rnd.aem.page/"]);
      expect(sq.schemas).toContain(DOM_ACTION);
      expect(lq.decisionScopes).toEqual([SCOPE]);
      expect(lq.surfaces).toEqual([]);
      expect(lq.schemas).toEqual(sq.schemas.filter((x) => x !== DOM_ACTION));
    }
    expect(l.results.run.hero).toBe(s.results.run.hero);
    expect(l.results.run.globals.alloy).toBe("undefined");
    return b.length;
  };
  const displays = (r) => bodiesOf(r).flatMap((b) => b.events || []).filter((e) => e.xdm && e.xdm._experience && e.xdm._experience.decisioning && e.xdm._experience.decisioning.propositionEventType);

  beforeAll(async () => {
    browser = await chromium.launch();
    const [index, acdl, alloy, library] = await Promise.all([ensureMartechAsset("index.js"), ensureMartechAsset("acdl.min.js"), ensureAlloyBundle(), buildMartechLibrary()]);
    serveStock = { "/martech/index.js": index, "/martech/acdl.min.js": acdl, "/martech/alloy.min.js": alloy.toString("utf8") };
    serveLib = { "/martech/index.js": library };
  }, T);
  afterAll(async () => { await browser?.close(); });

  it("AC1 (069-05): personalization off, martechLazy called before awaiting sendEvent, sends the stock run's requests", async () => {
    const [s, l] = await personalizationOff();
    expect(sameAsStock(s, l, { fetch: false, independent: true })).toBeGreaterThanOrEqual(3);
    expect(eventTypes(l)).toContain("web.webinteraction.linkClicks");
  }, T);

  it("AC4 (069-05): personalization off, the event after martechLazy and the page view keep stock's order", async () => {
    const [s, l] = await personalizationOff();
    const order = eventTypes(s);
    expect(order).toContain("web.webpagedetails.pageViews");
    expect(order).toContain("web.webinteraction.linkClicks");
    // The page view and the event are independent sends and stock itself starts them in either order under load (bug 007); the
    // events inside each request, and every event, must still equal stock's.
    expect(eventTypesOf(alignIndependentSends(posts(l.network), posts(s.network)))).toEqual(order);
  }, T);

  it("AC9 (069-05): personalization off, an event sent before martechLazy: stock rejects it (alloy not configured yet), the library queues and sends it", async () => {
    const [s, l] = await both({ personalization: false, sendBeforeLazy: true });
    expect(s.results.run.early).toMatch(/^err:.*must be configured first/);
    expect(l.results.run.early).toBe("ok");
    expect(eventTypes(s)).not.toContain("web.webinteraction.linkClicks");
    expect(eventTypes(l)).toContain("web.webinteraction.linkClicks");
  }, T);

  it("AC3 (069-05): a synthetic offer renders and is reported as stock does, trackPageView:false (requests equal stock's)", async () => {
    const [s, l] = await offerNoPageView();
    expect(sameAsStock(s, l)).toBe(3);
    expect(s.results.run.hero).toContain("airlock-069-05-offer");
    expect(l.results.run.hero).toContain("airlock-069-05-offer");
    for (const r of [s, l]) {
      const d = displays(r);
      expect(d).toHaveLength(1);
      expect(d[0].xdm.eventType).toBe("decisioning.propositionDisplay");
      expect(d[0].xdm._experience.decisioning.propositions.map((p) => p.id)).toEqual([OFFER_ID]);
      expect(d[0].xdm._experience.decisioning.propositionEventType).toEqual({ display: 1 });
    }
  }, T);

  it("AC8 (069-05): trackPageView:true, the offer renders and is reported once in both arms; stock sends it as a separate display after the page view, the library bundles it into the page view", async () => {
    const [s, l] = await both({ config: { trackPageView: true }, placements: true }, {});
    expect(s.results.run.hero).toContain("airlock-069-05-offer");
    expect(l.results.run.hero).toContain("airlock-069-05-offer");
    expect(eventTypes(s).slice(-2)).toEqual(["web.webpagedetails.pageViews", "decisioning.propositionDisplay"]);
    expect(eventTypes(l).slice(-1)).toEqual(["web.webpagedetails.pageViews"]);
    expect(eventTypes(l)).not.toContain("decisioning.propositionDisplay");
    for (const r of [s, l]) {
      const d = displays(r);
      expect(d).toHaveLength(1);
      expect(d[0].xdm._experience.decisioning.propositions.map((p) => p.id)).toEqual([OFFER_ID]);
      expect(d[0].xdm._experience.decisioning.propositionEventType).toEqual({ display: 1 });
    }
    // The page view itself carries the proposition in the library arm; in stock it does not.
    const pageView = (r) => bodiesOf(r).flatMap((b) => b.events || []).find((e) => e.xdm.eventType === "web.webpagedetails.pageViews");
    expect(pageView(l).xdm._experience && pageView(l).xdm._experience.decisioning).toBeDefined();
    expect(pageView(s).xdm._experience && pageView(s).xdm._experience.decisioning).toBeUndefined();
  }, T);

  it("AC2 (069-05): an offer rendered after personalizationTimeout (block decorated late) sends the late propositionDisplay as stock does", async () => {
    const [s, l] = await both({ config: { personalizationTimeout: 400 }, decorateAfter: 1000, placements: true }, {});
    expect(sameAsStock(s, l)).toBe(4);
    expect(s.results.run.hero).toContain("airlock-069-05-offer");
    for (const r of [s, l]) {
      expect(eventTypes(r).filter((t) => t === "decisioning.propositionDisplay")).toHaveLength(1);
      expect(displays(r).filter((e) => e.xdm.eventType === "decisioning.propositionDisplay")[0].xdm._experience.decisioning.propositions.map((p) => p.id)).toEqual([OFFER_ID]);
    }
  }, T);

  it("AC11 (069-05): an answer that arrives after personalizationTimeout is not applied and not reported, as stock", async () => {
    const [s, l] = await both({ config: { personalizationTimeout: 300 }, placements: true }, { delay: 900 });
    const requests = sameAsStock(s, l);
    expect(requests).toBeGreaterThanOrEqual(2);
    for (const r of [s, l]) {
      // The fetch was sent and answered (after the timeout), so "nothing applied" is not just "nothing asked".
      expect(r.answered).toBe(1);
      expect(eventTypes(r)).toContain("decisioning.propositionFetch");
      expect(r.results.run.hero).toBe("default");
      expect(displays(r).filter((e) => e.xdm.eventType === "decisioning.propositionDisplay")).toHaveLength(0);
    }
  }, T);

  it("AC6 (069-05): the library fetches only its declared scopes; stock adds __view__, the page surface and the dom-action schema", async () => {
    const [s, l] = await offerNoPageView();
    sameAsStock(s, l);
    // sameAsStock asserts the values; this is the named owner of the difference, so state it in words too.
    expect(fetchQuery(s).decisionScopes).toContain("__view__");
    expect(fetchQuery(s).surfaces).toHaveLength(1);
    expect(fetchQuery(s).schemas).toContain(DOM_ACTION);
    expect(fetchQuery(l).decisionScopes).not.toContain("__view__");
    expect(fetchQuery(l).surfaces).toHaveLength(0);
    expect(fetchQuery(l).schemas).not.toContain(DOM_ACTION);
  }, T);

  it("AC7 (069-05): the library renders only into a declared placement; with none for the scope it renders nothing (stock renders any selector)", async () => {
    const [s, l] = await both({ config: { trackPageView: false } }, {});
    expect(s.results.run.hero).toContain("airlock-069-05-offer");
    expect(l.results.run.hero).toBe("default");
    expect(displays(l).filter((e) => e.xdm.eventType === "decisioning.propositionDisplay")).toHaveLength(0);
    expect(displays(s)).toHaveLength(1);
    expect(l.answered).toBe(1);
    // With the placement declared the library renders (AC3), so the placement is what decides.
    const [, withPlacement] = await offerNoPageView();
    expect(withPlacement.results.run.hero).toContain("airlock-069-05-offer");
  }, T);

  // Two triggers, each applied the same way to both arms: an Alloy file (stock) or chamber bundle (library) that throws at load, and an invalid edgeDomain.
  const BROKEN_SCRIPT = "throw new Error('airlock-069-05-load-failure');";
  const BROKEN_BUNDLE = "/martech/broken-alloy.js";
  const triggers = {
    "a script that throws at load": (library) => ({
      serve: library ? { ...serveLib, [BROKEN_BUNDLE]: BROKEN_SCRIPT } : { ...serveStock, "/martech/alloy.min.js": BROKEN_SCRIPT },
      journey: library ? { airlock: { bundleUrl: BROKEN_BUNDLE, workerUrl: "/rig/chamber.js" } } : {},
    }),
    "an invalid edgeDomain": (library) => ({
      serve: library ? serveLib : serveStock,
      journey: { edgeDomain: "not a host/", ...(library ? { airlock: { bundleUrl: "/rig/alloy.min.js", workerUrl: "/rig/chamber.js" } } : {}) },
    }),
  };
  for (const [trigger, setup] of Object.entries(triggers)) {
    for (const performanceOptimized of [true, false]) {
      it(`AC10 (069-05): a failed boot (${trigger}), performanceOptimized ${performanceOptimized}: how martechLazy settles and what is sent, library versus stock`, async () => {
        const run = (library) => {
          const { serve, journey } = setup(library);
          return replayFixture(browser, "s10-base", {
            event: null, skipSteps: true, serve, bootOptions: library ? AIRLOCK_BOOT : {}, boot: library, bodyHtml: heroHtml(true),
            run: (page) => failedBootJourney(page, { performanceOptimized, ...journey }),
          });
        };
        const [s, l] = await Promise.all([run(false), run(true)]);
        // Both arms: nothing is sent (the real check, the request list) and the page is left visible.
        for (const r of [s, l]) {
          expect(r.results.run.bodyStyle).toBe("");
          expect(posts(r.network)).toEqual([]);
          expect(r.results.run.eager).toBe("ok");
        }
        if (trigger === "an invalid edgeDomain") {
          // The config is rejected up front in both; stock's martechLazy and consent call swallow or hang on it, the library's reject with the config error.
          expect(s.results.run.init).toMatch(/^err:\[alloy\] Resolve these configuration problems/);
          expect(l.results.run.init).toMatch(/^err:edgeDomain must be a bare host name/);
          expect([s.results.run.lazy, s.results.run.consent]).toEqual(["ok", "pending"]);
          expect(l.results.run.lazy).toMatch(/^err:edgeDomain must be a bare host name/);
          expect(l.results.run.consent).toMatch(/^err:edgeDomain must be a bare host name/);
        } else {
          // A load failure: stock's initMartech rejects with the script's error; the library's does not surface it (the chamber never boots), and in both the consent call stays unsettled and martechLazy resolves.
          expect(s.results.run.init).toBe("err:airlock-069-05-load-failure");
          expect(l.results.run.init).toBe("ok");
          expect([s.results.run.lazy, l.results.run.lazy]).toEqual(["ok", "ok"]);
          expect([s.results.run.consent, l.results.run.consent]).toEqual(["pending", "pending"]);
        }
      }, T);
    }
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
    await expect(alloy("sendEvent", { xdm: {}, datasetId: "d", edgeConfigOverrides: { a: 1 } })).rejects.toThrow("boom");
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
    await alloy("applyPropositions", { propositions: [{ id: "p" }] });
    expect(h.applyPropositions).toHaveBeenCalledWith({ propositions: [{ id: "p" }] });
    await expect(alloy("getLibraryInfo", {})).resolves.toBe("cmd");
    expect(h.command).toHaveBeenCalledWith("getLibraryInfo", {});
  });

  it("the test-only queue shim drains the loader's queue stub in order and replaces it", async () => {
    const h = fakeHandle();
    const out = [];
    const g = { alloy: Object.assign(() => {}, { q: [[(v) => out.push(["a", v]), () => {}, ["sendEvent", { xdm: { n: 1 } }]], [(v) => out.push(["b", v]), () => {}, ["sendEvent", { xdm: { n: 2 } }]]] }) };
    const bridge = attachQueueShim(createAlloyCommandBridge(h, { onDiagnostic: () => {} }), g, "alloy");
    expect(g.alloy).toBe(bridge);
    await new Promise((r) => setTimeout(r, 0));
    expect(h.push.mock.calls.map((c) => c[0].xdm.n)).toEqual([1, 2]);
    expect(out.map((x) => x[0])).toEqual(["a", "b"]);
  });

  it("the test-only queue shim routes a sync throw and a rejected command to reject", async () => {
    const h = fakeHandle();
    h.command = vi.fn(async () => { throw new Error("boom"); });
    h.push = vi.fn(() => { throw new Error("SYNC"); });
    const rejected = [];
    const g = { alloy: Object.assign(() => {}, { q: [
      [() => {}, (e) => rejected.push(["sync", e.message]), ["sendEvent", { xdm: {} }]],
      [() => {}, (e) => rejected.push(["async", e.message]), ["getLibraryInfo", {}]],
    ] }) };
    attachQueueShim(createAlloyCommandBridge(h, { onDiagnostic: () => {} }), g, "alloy");
    await new Promise((r) => setTimeout(r, 0));
    expect(rejected).toEqual([["sync", "SYNC"], ["async", "boom"]]);
  });

  it("the bridge neither reads nor writes a page global, at creation or on any command", async () => {
    expect(globalThis.alloy).toBeUndefined();
    const sentinel = { q: [[() => {}, () => {}, ["sendEvent", { xdm: {} }]]] };
    globalThis.alloy = sentinel;
    const keys = Object.keys(globalThis).sort();
    try {
      const h = fakeHandle();
      const alloy = createAlloyCommandBridge(h, { onDiagnostic: () => {} });
      await alloy("configure", {});
      await alloy("sendEvent", { xdm: {} });
      await alloy("setConsent", { consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "y" } } }] });
      await alloy("applyPropositions", { propositions: [{ id: "p" }] });
      await alloy("getLibraryInfo", {});
      expect(globalThis.alloy).toBe(sentinel);
      expect(sentinel.q).toHaveLength(1);
      expect(h.push).toHaveBeenCalledTimes(1);
      expect(Object.keys(globalThis).sort()).toEqual(keys);
    } finally { delete globalThis.alloy; }
  });
});

// Bug 006: a stock arm that also booted a chamber let the chamber's mirrored Alloy probe cookie reach the stock tag.
describe.runIf(real)("bug 006: a stock arm is a pure stock page (real Chromium)", () => {
  it("boot: false loads no adapter, constructs no Worker and requests no chamber; the default still boots one", async () => {
    const browser = await chromium.launch();
    try {
      const probe = (page) => page.evaluate(() => ({
        worker: typeof window.__worker,
        adapter: typeof window.AirlockEds,
        resources: performance.getEntriesByType("resource").map((e) => new URL(e.name).pathname),
      }));
      const stock = await replayFixture(browser, "s10-base", { event: null, skipSteps: true, boot: false, run: probe });
      expect(stock.results.run.worker).toBe("undefined");
      expect(stock.results.run.adapter).toBe("undefined");
      expect(stock.results.run.resources).not.toContain("/rig/chamber.js");
      expect(stock.results.run.resources).not.toContain("/rig/airlock-eds.js");
      const booted = await replayFixture(browser, "s10-base", { event: null, skipSteps: true, run: probe });
      expect(booted.results.run.worker).toBe("object");
      expect(booted.results.run.resources).toContain("/rig/airlock-eds.js");
    } finally { await browser.close(); }
  }, T);
});

describe("bug 007: the page-view collect and the event interact are matched against stock in either start order (hermetic)", () => {
  const post = (call, events, extra = {}) => ({ method: "POST", url: `https://edge.adobedc.net/ee/${call === "set-consent" ? "v1/privacy" : "or2/v1"}/${call}?configId=ds&requestId=${crypto.randomUUID()}`, body: JSON.stringify({ events: events.map((eventType) => ({ xdm: { eventType } })), meta: { state: { entries: [] } }, ...extra }) });
  const consent = () => post("set-consent", []);
  const collect = (...ev) => post("collect", ev.length ? ev : ["web.webpagedetails.pageViews"]);
  const interact = (...ev) => post("interact", ev.length ? ev : ["web.webinteraction.linkClicks"]);
  const stock = (...order) => order.map((f) => f());

  it("accepts both witnessed stock orders against either library order", () => {
    for (const stockOrder of [[collect, interact], [interact, collect]]) {
      for (const libOrder of [[collect, interact], [interact, collect]]) {
        const s = [consent(), ...stock(...stockOrder)];
        const l = [consent(), ...stock(...libOrder)];
        compareRequests(l, s, { independent: true });
      }
    }
  });
  it("rejects a changed event, a changed body field and a changed event order inside a request", () => {
    const s = [consent(), collect(), interact()];
    expect(() => compareRequests([consent(), collect(), interact("web.webinteraction.other")], s, { independent: true })).toThrow();
    expect(() => compareRequests([consent(), collect(), post("interact", ["web.webinteraction.linkClicks"], { query: { x: 1 } })], s, { independent: true })).toThrow();
    const two = [consent(), collect("a", "b"), interact()];
    expect(() => compareRequests([consent(), collect("b", "a"), interact()], two, { independent: true })).toThrow();
  });
  it("rejects a missing request and a duplicated request", () => {
    const s = [consent(), collect(), interact()];
    expect(() => compareRequests([consent(), collect()], s, { independent: true })).toThrow();
    expect(() => compareRequests([consent(), collect(), interact(), interact()], s, { independent: true })).toThrow();
    expect(() => compareRequests([consent(), collect(), collect()], s, { independent: true })).toThrow();
  });
  it("rejects a consent ordering violation", () => {
    const s = [consent(), collect(), interact()];
    expect(() => compareRequests([collect(), consent(), interact()], s, { independent: true })).toThrow();
    expect(() => compareRequests([interact(), collect(), consent()], s, { independent: true })).toThrow();
  });
});
