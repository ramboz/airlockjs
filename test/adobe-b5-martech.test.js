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
  const runStock = (extra = {}) => replayFixture(browser, "s10-base", { event: null, skipSteps: true, serve: serveStock, bootOptions: {}, run: (page) => journey(page, extra) });
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

  const flow = (extra, library) => replayFixture(browser, "s10-base", { event: null, skipSteps: true, serve: library ? serveLib : serveStock, bootOptions: library ? AIRLOCK_BOOT : {}, run: (page) => flowJourney(page, library ? { useHandle: true, ...extra } : extra) });
  const comparePosts = (l, s) => {
    const a = posts(l.network);
    const b = posts(s.network);
    expect(a.map(pathOf)).toEqual(b.map(pathOf));
    for (let k = 0; k < b.length; k += 1) expect(diffBodies(normalised(a[k].body), normalised(b[k].body))).toEqual([]);
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

  it("AC4a: the combined { propositions, viewName } applyPropositions form gives the stock run's result", async () => {
    const stockRun = replayFixture(browser, "s10-base", {
      event: null, skipSteps: true, serve: serveStock, bootOptions: {},
      run: (page) => page.evaluate(async () => {
        const m = await (0, eval)('import("/martech/index.js")');
        m.initMartech({ orgId: "x", datastreamId: "y", defaultConsent: "pending" }, { personalization: true });
        await m.updateUserConsent({ collect: true, personalize: true, marketing: false, share: false });
        return window.alloy("applyPropositions", { propositions: [], viewName: "home" }).then((r) => `ok:${JSON.stringify(r)}`, (e) => `err:${String(e.message).split("\n")[0]}`);
      }),
    });
    const libRun = replayFixture(browser, "s10-base", {
      event: null, skipSteps: true, serve: serveLib, bootOptions: AIRLOCK_BOOT,
      run: (page) => page.evaluate(async () => {
        const m = await (0, eval)('import("/martech/index.js")');
        m.initMartech({ orgId: "x", datastreamId: "y", defaultConsent: "pending" }, { handle: window.__handle, personalization: true });
        await m.updateUserConsent({ collect: true, personalize: true, marketing: false, share: false });
        return m.getAirlockHandle().applyPropositions({ propositions: [], viewName: "home" }).then((r) => `ok:${JSON.stringify(r)}`, (e) => `err:${String(e.message).split("\n")[0]}`);
      }),
    });
    const [s, l] = await Promise.all([stockRun, libRun]);
    process.stderr.write(`combined applyPropositions: stock=${s.results.run} library=${l.results.run}\n`);
    expect(l.results.run).toBe(s.results.run);
  }, T);
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
