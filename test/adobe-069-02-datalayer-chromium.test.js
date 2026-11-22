// Spec 069-02: the generic data layer against REAL ACDL 3.0.1 and the REAL aem-martech 1aa3dee3 in real Chromium.
// Gated like the other real-browser tests: `AIRLOCK_REAL_CHROMIUM=1`. The third-party files are downloaded at test time into
// the gitignored rig/out/b5/ and hash-checked (rig/adobe-b5-martech.mjs). SYNTHETIC pushes only; the stock arm runs the real
// library with a recording `alloy` stand-in (the stand-in records what the library sends and runs `onBeforeEventSend`).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { ensureMartechAsset } from "../rig/adobe-b5-martech.mjs";

const real = process.env.AIRLOCK_REAL_CHROMIUM === "1";
const T = 90000;
const ORIGIN = "https://dl.test";
const SRC = await readFile(new URL("../adapters/eds/martech-datalayer.js", import.meta.url), "utf8");

// Pushes for the corpus: nested objects, arrays, null, event items carrying data, the event and eventInfo keys, repeated keys.
const CORPUS = {
  nested: [{ a: { b: { c: 1 } } }, { a: { b: { d: 2 }, e: 3 } }],
  arrays: [{ list: [1, 2, 3] }, { list: [9] }, { objs: [{ a: 1 }, { b: 2 }] }, { objs: [{ c: 3 }] }],
  nulls: [{ a: { b: 1, c: 2 }, z: 1 }, { a: { b: null }, z: null, q: { r: null } }],
  nullOnAbsent: [{ gone: null }, { n: { m: null, k: 1 } }],
  eventItems: [{ event: "e1", eventInfo: { k: 1 }, data: { n: 1 }, xdm: { x: { y: 1 } } }, { event: "e2", data: { n: 2, m: 3 } }, { page: { name: "p" } }],
  eventKeysNeverFold: [{ event: "only" }, { eventInfo: { solo: 1 } }, { ok: 1, eventInfo: { z: 1 } }],
  repeated: [{ k: 1 }, { k: 2 }, { k: { o: 1 } }, { k: { o: 2, p: 3 } }],
  objectOverScalar: [{ s: 1, arr: [1], o: { k: 1 } }, { s: { x: 1 }, arr: { y: 1 }, o: [1] }],
  scalarOverObject: [{ o: { a: 1 } }, { o: "now a string" }, { p: { a: 1 } }, { p: [1] }],
  emptyObjectOnAbsent: [{ fresh: {} }, { fresh2: { deeper: {} } }],
  arrayOfObjectsWithNull: [{ arr: [{ a: null, b: 1 }, null, 2] }, { nest: [[1, null], { x: null, y: { z: null, w: 1 } }] }],
  configOverridesFold: [{ event: "c", configOverrides: { x: 1 }, xdm: { a: 1 }, data: { b: 2 } }],
  falsyValues: [{ f: 0, g: "", h: false, i: null }],
};
const PATHS = ["a", "a.b", "a.b.c", "list", "list.0", "objs.1.b", "list[0]", "page.name", "nope", "a.nope.x", "o", "k.o", "data.n"];

describe.runIf(real)("spec 069-02: generic data layer vs real ACDL 3.0.1 and real aem-martech 1aa3dee3 (real Chromium)", () => {
  let browser;
  let acdl;
  let stockIndex;
  const requested = [];

  async function newPage(html = "<!doctype html><html><body></body></html>") {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on("request", (r) => requested.push(r.url()));
    await page.route(`${ORIGIN}/**`, (route) => {
      const path = new URL(route.request().url()).pathname;
      const js = (body) => route.fulfill({ status: 200, contentType: "text/javascript", body });
      if (path === "/page.html") return route.fulfill({ status: 200, contentType: "text/html", body: html });
      if (path === "/acdl.min.js") return js(acdl);
      if (path === "/stock/index.js") return js(stockIndex);
      if (path === "/stock/acdl.min.js") return js(acdl);
      if (path === "/stock/alloy.min.js") return js("export {};");
      if (path === "/ours/martech-datalayer.js") return js(SRC);
      return route.fulfill({ status: 404, body: "" });
    });
    await page.goto(`${ORIGIN}/page.html`);
    return page;
  }

  beforeAll(async () => {
    browser = await chromium.launch();
    [stockIndex, acdl] = await Promise.all([ensureMartechAsset("index.js"), ensureMartechAsset("acdl.min.js")]);
  }, T);
  afterAll(async () => { await browser?.close(); });

  it("AC3: getState() and getState(path) equal real ACDL's on the corpus, both side by side", async () => {
    const page = await newPage();
    const out = await page.evaluate(async ({ corpus, paths }) => {
      const { createDataLayer } = await (0, eval)(`import("/ours/martech-datalayer.js")`);
      const loadAcdl = () => new Promise((resolve, reject) => {
        window.adobeDataLayer = [];
        const s = document.createElement("script");
        s.src = "/acdl.min.js";
        s.onload = resolve;
        s.onerror = reject;
        document.head.append(s);
      });
      const results = {};
      for (const [name, pushes] of Object.entries(corpus)) {
        await loadAcdl();
        const ours = createDataLayer({});
        for (const p of pushes) { window.adobeDataLayer.push(p); ours.push(p); }
        await new Promise((r) => setTimeout(r, 0));
        const json = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v));
        results[name] = {
          acdl: json(window.adobeDataLayer.getState()),
          ours: json(ours.getState()),
          paths: paths.map((p) => [p, json(window.adobeDataLayer.getState(p)), json(ours.getState(p))]),
        };
      }
      return results;
    }, { corpus: CORPUS, paths: PATHS });
    for (const [name, r] of Object.entries(out)) {
      expect(r.ours, name).toEqual(r.acdl);
      for (const [p, a, o] of r.paths) expect(o, `${name} ${p}`).toEqual(a);
    }
    await page.context().close();
  }, T);

  it("AC1/AC6: with ACDL absent the data layer installs no window global and loads no ACDL; the proxy writes only its one name", async () => {
    requested.length = 0;
    const page = await newPage();
    const out = await page.evaluate(async () => {
      const before = Object.getOwnPropertyNames(window);
      const { createDataLayer } = await (0, eval)(`import("/ours/martech-datalayer.js")`);
      const dl = createDataLayer({});
      dl.attach();
      dl.push({ event: "e", xdm: { a: 1 } });
      dl.push({ page: { n: 1 } });
      dl.getState();
      await new Promise((r) => setTimeout(r, 20));
      const afterPlain = Object.getOwnPropertyNames(window).filter((k) => !before.includes(k));
      const proxyBefore = Object.getOwnPropertyNames(window);
      const res = dl.installAdobeDataLayerProxy({ instanceName: "myLayer" });
      window.myLayer.push({ event: "after", xdm: { z: 1 } });
      window.myLayer.push(() => { window.__ran = true; });
      await new Promise((r) => setTimeout(r, 20));
      return { afterPlain, adl: typeof window.adobeDataLayer, res, added: Object.getOwnPropertyNames(window).filter((k) => !proxyBefore.includes(k)), ran: window.__ran === true, state: dl.getState(), len: window.myLayer.length };
    });
    expect(out.afterPlain).toEqual([]);
    expect(out.adl).toBe("undefined");
    expect(out.res).toEqual({ installed: true, instanceName: "myLayer" });
    expect(out.added).toEqual(["myLayer"]);
    expect(out.ran).toBe(false);
    expect(out.state).toEqual({ page: { n: 1 }, xdm: { a: 1, z: 1 } });
    expect(out.len).toBe(2);
    expect(requested.some((u) => /acdl/.test(u))).toBe(false);
    await page.context().close();
  }, T);

  it("AC6: the proxy on the default name takes over a page array that already holds entries and keeps the same instance", async () => {
    const page = await newPage();
    const out = await page.evaluate(async () => {
      const arr = [{ event: "pre", xdm: { a: 1 } }, { user: { id: "u" } }];
      window.adobeDataLayer = arr;
      const { createDataLayer } = await (0, eval)(`import("/ours/martech-datalayer.js")`);
      const seen = [];
      const dl = createDataLayer({ onEvent: (x) => seen.push(x.eventType) });
      dl.attach();
      dl.installAdobeDataLayerProxy();
      window.adobeDataLayer.push({ event: "post" });
      await new Promise((r) => setTimeout(r, 20));
      return { same: window.adobeDataLayer === arr, seen, len: arr.length, user: dl.getState("user.id") };
    });
    expect(out).toEqual({ same: true, seen: ["pre", "post"], len: 3, user: "u" });
    await page.context().close();
  }, T);

  it("AC6: real ACDL that loads after the proxy replaces push: forwarding stops with the diagnostic, no event is sent twice", async () => {
    const page = await newPage();
    const out = await page.evaluate(async () => {
      const { createDataLayer } = await (0, eval)(`import("/ours/martech-datalayer.js")`);
      const diags = [];
      const seen = [];
      const dl = createDataLayer({ onEvent: (x) => seen.push(x.eventType), diagnose: (d) => diags.push(d.kind) });
      dl.attach();
      dl.installAdobeDataLayerProxy();
      window.adobeDataLayer.push({ event: "before" });
      await new Promise((r) => setTimeout(r, 20));
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "/acdl.min.js";
        s.onload = resolve;
        s.onerror = reject;
        document.head.append(s);
      });
      window.adobeDataLayer.push({ event: "after" });
      await new Promise((r) => setTimeout(r, 30));
      return { seen, diags };
    });
    expect(out.diags).toContain("datalayer-foreign-implementation");
    expect(out.seen.filter((e) => e === "after")).toEqual([]);
    expect(out.seen.filter((e) => e === "before")).toEqual(["before"]);
    await page.context().close();
  }, T);

  // The stock arm: the real index.js with a recording alloy stand-in, driven through the same pushes as ours.
  const STOCK_PAGE = `
    window.__sent = [];
    window.__cfg = null;
    window.alloy = Object.assign((cmd, payload) => {
      if (cmd === "configure") { window.__cfg = payload; return Promise.resolve(); }
      if (cmd === "sendEvent") {
        const body = JSON.parse(JSON.stringify(payload));
        if (window.__cfg && window.__cfg.onBeforeEventSend) window.__cfg.onBeforeEventSend(body);
        window.__sent.push(body);
      }
      return Promise.resolve({});
    }, { q: [] });`;
  const stockRun = (page, { martechConfig, hook, pushes }) => page.evaluate(async ({ stockSetup, martechConfig: mc, hook: h, pushes: ps }) => {
    (0, eval)(stockSetup);
    const m = await (0, eval)(`import("/stock/index.js")`);
    const cfg = h ? { ...mc, shouldProcessEvent: (0, eval)(`(${h})`) } : mc;
    await m.initMartech({ orgId: "00000000000000000000000A@AdobeOrg", datastreamId: "00000000-0000-0000-0000-000000000000", edgeDomain: "edge.example", defaultConsent: "in" }, cfg);
    await m.martechLazy();
    let pushErrors = 0;
    for (const p of ps) { try { window.adobeDataLayer.push(p); } catch (e) { pushErrors += 1; } }
    await new Promise((r) => setTimeout(r, 60));
    return { sent: window.__sent, state: window.adobeDataLayer.getState(), pushErrors };
  }, { stockSetup: STOCK_PAGE, martechConfig, hook, pushes });
  const baseConfig = { analytics: true, personalization: false, trackPageView: false, dataLayer: true, includeDataLayerState: false, launchUrls: [], alloyInstanceName: "alloy", dataLayerInstanceName: "adobeDataLayer" };
  const ourRun = (page, { analytics, pushes, shouldProcessEvent }) => page.evaluate(async ({ analytics: an, pushes: ps, sp }) => {
    const { createDataLayer } = await (0, eval)(`import("/ours/martech-datalayer.js")`);
    const sent = [];
    const diags = [];
    const dl = createDataLayer({
      onEvent: (xdm, data, co) => sent.push({ documentUnloading: true, xdm, data: data ?? {}, edgeConfigOverrides: co ?? {} }),
      shouldProcessEvent: sp ? (0, eval)(`(${sp})`) : undefined,
      diagnose: (d) => diags.push(d.kind),
    });
    dl.attach({ analytics: an });
    for (const p of ps) dl.push(p);
    await new Promise((r) => setTimeout(r, 60));
    return { sent, diags, state: JSON.parse(JSON.stringify(dl.getState())) };
  }, { analytics, pushes, sp: shouldProcessEvent });
  const strip = (sent) => sent.map(({ documentUnloading, xdm, data, edgeConfigOverrides }) => ({ documentUnloading, xdm, data: Object.fromEntries(Object.entries(data ?? {}).filter(([k]) => k !== "__adobe")), edgeConfigOverrides }));

  const EVENT_PUSHES = [
    { event: "cta", xdm: { web: { webInteraction: { name: "buy" } } }, data: { a: 1 }, configOverrides: { c: 1 } },
    { page: { name: "p" } },
    { event: "bare" },
    { event: "ignored-keys", renderDecisions: true, decisionScopes: ["s"], consent: { x: 1 }, xdm: { t: 1 } },
  ];

  it("AC4: events map to the stock run's sendEvent bodies (xdm, data, configOverrides, order) with analytics true", async () => {
    const stockPage = await newPage();
    const stock = await stockRun(stockPage, { martechConfig: { ...baseConfig }, pushes: EVENT_PUSHES });
    const oursPage = await newPage();
    const ours = await ourRun(oursPage, { analytics: true, pushes: EVENT_PUSHES });
    expect(stock.sent.length).toBe(3);
    expect(strip(ours.sent)).toEqual(strip(stock.sent));
    expect(ours.state).toEqual(stock.state);
    await stockPage.context().close();
    await oursPage.context().close();
  }, T);

  it("AC4: with analytics false neither arm sends an event and both keep the state", async () => {
    const stockPage = await newPage();
    const stock = await stockRun(stockPage, { martechConfig: { ...baseConfig, analytics: false }, pushes: EVENT_PUSHES });
    const oursPage = await newPage();
    const ours = await ourRun(oursPage, { analytics: false, pushes: EVENT_PUSHES });
    expect(stock.sent).toEqual([]);
    expect(ours.sent).toEqual([]);
    expect(ours.state).toEqual(stock.state);
    await stockPage.context().close();
    await oursPage.context().close();
  }, T);

  it("AC4: shouldProcessEvent false drops the event and a throwing one drops it too (stock's listener error is page-visible, ours is a hook-threw diagnostic)", async () => {
    const hook = "(p) => { if (p.event === 'boom') throw new Error('x'); return p.event === 'keep'; }";
    const pushes = [{ event: "keep", xdm: { a: 1 } }, { event: "skip" }, { event: "boom" }];
    const stockPage = await newPage();
    const stock = await stockRun(stockPage, { martechConfig: { ...baseConfig }, hook, pushes });
    const oursPage = await newPage();
    const ours = await ourRun(oursPage, { analytics: true, pushes, shouldProcessEvent: hook });
    expect(strip(ours.sent)).toEqual(strip(stock.sent));
    expect(ours.sent).toHaveLength(1);
    expect(stock.pushErrors).toBe(1); // stock: the throw surfaces from the page's own push call; ours never throws into the page
    expect(ours.diags).toEqual(["hook-threw"]);
    await stockPage.context().close();
    await oursPage.context().close();
  }, T);

  it("AC7: scanBlocks() produces the blocks state of the stock run (real ACDL beside)", async () => {
    const html = `<!doctype html><html><body>
      <div class="hero" data-block-data-layer='{"a":1}'></div>
      <div class="hero" data-block-data-layer='{"parentId":"p","b":2}'></div>
      <div class="cards" id="given" data-block-data-layer='{"c":3}'></div>
      <div data-block-data-layer='{bad json'></div>
      <div class="cards" data-block-data-layer='{"parentId":"q"}'></div></body></html>`;
    const stockPage = await newPage(html);
    const stock = await stockRun(stockPage, { martechConfig: { ...baseConfig, analytics: false }, pushes: [] });
    const oursPage = await newPage(html);
    const ours = await oursPage.evaluate(async () => {
      const { createDataLayer } = await (0, eval)(`import("/ours/martech-datalayer.js")`);
      const dl = createDataLayer({});
      const ids = dl.scanBlocks(document);
      return { ids, state: JSON.parse(JSON.stringify(dl.getState())), domIds: [...document.querySelectorAll("[data-block-data-layer]")].map((e) => e.id) };
    });
    const stockIds = await stockPage.evaluate(() => [...document.querySelectorAll("[data-block-data-layer]")].map((e) => e.id));
    expect(ours.state).toEqual(stock.state);
    expect(ours.domIds).toEqual(stockIds);
    expect(Object.keys(ours.state.blocks).length).toBeGreaterThan(2);
    await stockPage.context().close();
    await oursPage.context().close();
  }, T);

  it("AC5: the eager phase differs from stock: stock shallow-merges non-event entries, the data layer deep-merges (owned and recorded)", async () => {
    const pushes = [{ a: { x: 1 } }, { a: { y: 2 } }, { event: "e", xdm: { skip: 1 } }];
    const stockPage = await newPage();
    const stockBody = await stockPage.evaluate(async ({ stockSetup, base, ps }) => {
      (0, eval)(stockSetup);
      window.adobeDataLayer = [];
      for (const p of ps) window.adobeDataLayer.push(p);
      const m = await (0, eval)(`import("/stock/index.js")`);
      await m.initMartech({ orgId: "00000000000000000000000A@AdobeOrg", datastreamId: "00000000-0000-0000-0000-000000000000", edgeDomain: "edge.example", defaultConsent: "in" }, { ...base, personalization: true, includeDataLayerState: true });
      await m.sendEvent({ xdm: { eventType: "t" } });
      return window.__sent[0].xdm;
    }, { stockSetup: STOCK_PAGE, base: baseConfig, ps: pushes });
    const oursPage = await newPage();
    const oursXdm = await oursPage.evaluate(async (ps) => {
      const { createDataLayer } = await (0, eval)(`import("/ours/martech-datalayer.js")`);
      const dl = createDataLayer({});
      for (const p of ps) dl.push(p);
      return { eventType: "t", ...dl.getStateSnapshot() };
    }, pushes);
    expect(stockBody).toEqual({ eventType: "t", a: { y: 2 } });
    expect(oursXdm).toEqual({ eventType: "t", a: { x: 1, y: 2 }, xdm: { skip: 1 } });
    await stockPage.context().close();
    await oursPage.context().close();
  }, T);
});
