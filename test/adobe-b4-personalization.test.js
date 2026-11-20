// Spec 064-20 (B4): personalization rendering, prehiding, redirects, click collection and ruleset delivery,
// replayed through the REAL chamber, seam and main-thread renderer in real Chromium. Extends the 064-17..19
// replay harness (rig/adobe-b1-replay.mjs). Gated like the other real-browser tests: `AIRLOCK_REAL_CHROMIUM=1`.
//
// Corpus note: the frozen corpus (S4, S7) has default-content and html-content propositions plus the display
// notification. It has NO recorded dom-action, redirect, JSON, rule-set or click-interact response; those are
// compared against the pinned stock Alloy 2.31.1 itself (`renderDecisions: true`) on a SYNTHETIC response, and the
// notes say so. No capture was taken.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium } from "playwright";
import { diffBodies, replayFixture, splitRequestUrl } from "../rig/adobe-b1-replay.mjs";
import { createPropositionRenderer, displayNotificationXdm, interactNotificationXdm } from "../adapters/eds/personalization-render.js";

const real = process.env.AIRLOCK_REAL_CHROMIUM === "1";
const T = 60000;
const SCOPE = "airlock.readiness.2e2319c8";
const posts = (fixture) => fixture.requests.filter((r) => r.method === "POST");
const byKey = (a, b) => (a.key < b.key ? -1 : 1);
const sortedState = (text) => {
  const b = JSON.parse(text);
  if (b.meta && b.meta.state && b.meta.state.entries) b.meta.state.entries = [...b.meta.state.entries].sort(byKey);
  return JSON.stringify(b);
};
/** The production path: `push` plus declared placements. The connector sends `renderDecisions:false` to the chamber and the host renders; the stock rig's `sendEvent({renderDecisions:true})` is not used. */
const PRODUCTION = {
  bootOptions: { placements: [{ scope: SCOPE, selector: "#hero", minHeight: 20 }, { scope: "__view__", selector: "#v", minHeight: 0 }] },
  bodyHtml: '<div id="hero"></div><div id="v"></div>',
};

const NS = "https://ns.adobe.com/personalization/";
const DATASTREAM = "12345678-1234-1234-1234-123456789012";
const edgeBody = (payload, requestId = "00000000-0000-0000-0000-000000000064") => JSON.stringify({ requestId, handle: [{ type: "personalization:decisions", payload }] });
/** A SYNTHETIC edge answer (no capture): the same bytes go to stock Alloy and to the airlock path. */
const cors = (req) => ({ "access-control-allow-origin": req.headers().origin || "*", "access-control-allow-credentials": "true", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, GET, OPTIONS" });
const synthetic = (payload) => (req) => (req.method() === "POST"
  ? { status: 200, headers: { "content-type": "application/json", ...cors(req) }, body: edgeBody(payload) }
  : { status: 204, headers: cors(req), body: "" });
const domAction = (id, type, selector, content) => ({ id: `${id}`, schema: `${NS}dom-action`, data: { type, selector, content } });
const proposition = (id, scope, items) => ({ id, scope, scopeDetails: { decisionProvider: "TGT", activity: { id: `act-${id}` }, characteristics: { scopeType: "view" } }, items });

/** Stock Alloy 2.31.1 on the MAIN thread (the reference): the same page, the same synthetic answer. */
const runStock = (page, sendOptions, extraConfig = {}) => page.evaluate(async ({ sendOptions, datastreamId, extraConfig }) => {
  // Adobe's documented base code: a queue stub the library drains when it loads.
  window.__alloyNS = ["stockAlloy"];
  window.stockAlloy = function () { const a = arguments; return new Promise((res, rej) => window.stockAlloy.q.push([res, rej, a])); };
  window.stockAlloy.q = [];
  await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/rig/alloy.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  window.stockAlloy("configure", { datastreamId, orgId: "908936ED5D35CC220A495CD4@AdobeOrg", defaultConsent: "in", debugEnabled: false, ...extraConfig });
  return JSON.parse(JSON.stringify(await window.stockAlloy("sendEvent", sendOptions)));
}, { sendOptions, datastreamId: DATASTREAM, extraConfig });

const ZONE = '<div id="z"><p id="a">A</p><p id="b">B</p><p id="c">C</p><p id="d">D</p><p id="e">E</p><p id="f">F</p><p id="g">G</p><p id="h">H</p><p id="n">N</p><div id="k"><i>1</i><i>2</i><i>3</i></div><img id="img" src="/old.png"><span id="m">M</span><span id="r">R</span></div>';
const zoneDom = (page) => page.evaluate(() => document.getElementById("z").outerHTML);
const PV_XDM = { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name: "airlock064-page" } } };
/** Stock vs airlock on the same SYNTHETIC answer; each returns what \`probe(page)\` reads afterwards. */
const stockVsAirlock = async (browser, payload, { probe, head = "", stockConfig = {}, bootExtra = {}, after, renderDecisions = true } = {}) => {
  const stock = await replayFixture(browser, "s4-base", { event: null, headHtml: head, bodyHtml: ZONE, respond: synthetic(payload), run: async (page) => { await runStock(page, { renderDecisions, xdm: PV_XDM }, stockConfig); await page.waitForTimeout(600); return probe(page); } });
  const ours = await replayFixture(browser, "s4-base", { event: null, headHtml: head, bodyHtml: '<div id="v"></div>' + ZONE, bootOptions: { placements: [{ scope: "__view__", selector: "#v", minHeight: 0 }], ...bootExtra }, respond: synthetic(payload), run: async (page) => { await page.evaluate((x) => window.__handle.push({ event: "page_view", xdm: x }), PV_XDM); await page.waitForTimeout(900); if (after) await after(page); return probe(page); } });
  return { stock, ours };
};

describe("064-20 the renderer (hermetic)", () => {
  it("builds the recorded display and interact notification shapes", () => {
    const d = [{ id: "a", scope: "__view__", scopeDetails: { x: 1 } }];
    expect(displayNotificationXdm(d)).toEqual({ eventType: "decisioning.propositionDisplay", _experience: { decisioning: { propositions: d, propositionEventType: { display: 1 } } } });
    expect(interactNotificationXdm(d, { label: "L" })._experience.decisioning).toEqual({ propositions: d, propositionEventType: { interact: 1 }, propositionAction: { label: "L" } });
  });

  it("refuses customCode and non-http redirects instead of running them", async () => {
    const seen = [];
    const calls = [];
    const r = createPropositionRenderer({ document: { querySelectorAll: () => [], documentElement: {}, createElement: () => ({}) }, window: { location: { replace: (u) => calls.push(u) } }, diagnose: (d) => seen.push(d) });
    const out = await r.render([
      { id: "1", scope: "s", items: [{ id: "i", schema: "https://ns.adobe.com/personalization/dom-action", data: { type: "customCode", selector: "#x", content: "alert(1)" } }] },
      { id: "2", scope: "t", items: [{ id: "j", schema: "https://ns.adobe.com/personalization/redirect-item", data: { content: "javascript:alert(1)" } }] },
    ]);
    expect(out.propositions.map((p) => p.renderAttempted)).toEqual([false, false]);
    expect(out.displayed).toEqual([]);
    expect(calls).toEqual([]);
    expect(seen.map((d) => d.reason).join("|")).toMatch(/customCode.*incompatible/);
  });
});

describe("064-24 redirect ordering (hermetic)", () => {
  const redirectProp = { id: "rp", scope: "__view__", scopeDetails: { k: 1 }, items: [{ id: "i", schema: "https://ns.adobe.com/personalization/redirect-item", data: { content: "https://redirect.example/x" } }] };
  const setup = (redirectDisplay, redirectTimeoutMs = 20) => {
    const log = [];
    const seen = [];
    const doc = { querySelectorAll: () => [], documentElement: { appendChild: (n) => log.push(`prehide:${n.textContent}`) }, createElement: () => ({ remove() {} }) };
    const win = { location: { replace: (u) => log.push(`replace:${u}`) } };
    const r = createPropositionRenderer({ document: doc, window: win, diagnose: (d) => seen.push(d.disposition), redirectDisplay: (d) => { log.push("display"); return redirectDisplay(d); }, redirectTimeoutMs });
    return { r, log, seen };
  };
  const settled = () => new Promise((res) => setTimeout(res, 60));

  it("prehides BODY, sends the display, then replaces, exactly once", async () => {
    const { r, log, seen } = setup(async () => ({ sent: true }));
    const out = await r.render([redirectProp]);
    await settled();
    expect(out.redirected).toBe(true);
    expect(log).toEqual(["prehide:BODY { visibility: hidden }", "display", "replace:https://redirect.example/x"]);
    expect(seen).toEqual([]);
  });

  it("a display that never settles does not block navigation and is diagnosed as held", async () => {
    const { r, log, seen } = setup(() => new Promise(() => {}));
    await r.render([redirectProp]);
    expect(log).not.toContain("replace:https://redirect.example/x");
    await settled();
    expect(log.at(-1)).toBe("replace:https://redirect.example/x");
    expect(seen).toEqual(["redirect-display-held"]);
  });

  it("a failed display (not sent, or rejected) navigates once and is diagnosed as failed", async () => {
    for (const fail of [async () => ({ sent: false, reason: "x" }), async () => { throw new Error("boom"); }]) {
      const { r, log, seen } = setup(fail);
      await r.render([redirectProp]);
      await settled();
      expect(log.filter((l) => l.startsWith("replace:"))).toHaveLength(1);
      expect(seen).toEqual(["redirect-display-failed"]);
    }
  });
});

describe.runIf(real)("064-20 personalization and host DOM (real Chromium)", () => {
  let browser;
  beforeAll(async () => { browser = await chromium.launch(); }, T);
  afterAll(async () => { await browser?.close(); });

  describe("AC3 S4 through the production path (M1)", () => {
    for (const name of ["s4-base", "s4-repeat", "s4-active-base", "s4-active-repeat"]) {
      it(`${name}: request bodies compare clean, display notification included`, async () => {
        const r = await replayFixture(browser, name, { ...PRODUCTION });
        const expected = posts(r.fixture);
        expect(r.observed).toHaveLength(expected.length);
        r.observed.forEach((o, i) => {
          expect(splitRequestUrl(o.url).stable, `url ${i}`).toBe(splitRequestUrl(expected[i].url).stable);
          const diffs = diffBodies(sortedState(o.body), sortedState(expected[i].request_body));
          expect(diffs, `body ${i}`).toEqual([]);
        });
      }, T);
    }
  });

  describe("AC3 S7 through the production path (push, then the stock-shaped link click and SPA view)", () => {
    const LINK = { eventType: "web.webinteraction.linkClicks", web: { webInteraction: { name: "airlock064-link", type: "other", URL: "https://destination.example/landing", linkClicks: { value: 1 } } } };
    const VIEW = { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name: "airlock064-view-2", viewName: "airlock064-view-2" } } };
    for (const name of ["s7-base", "s7-repeat"]) {
      it(`${name}: the three interacts compare clean`, async () => {
        // The capture driver's own options: the page view and the link click use sendEvent's default (renderDecisions
        // false); the SPA view passes renderDecisions:true.
        const steps = [{ xdm: PV_XDM, renderDecisions: false }, { xdm: LINK, renderDecisions: false }, { xdm: VIEW, renderDecisions: true }];
        const r = await replayFixture(browser, name, { event: null, bodyHtml: '<div id="v"></div>', bootOptions: { placements: [{ scope: "__view__", selector: "#v", minHeight: 0 }] }, run: async (page) => {
          for (const { xdm, renderDecisions } of steps) await page.evaluate((x) => window.__handle.push({ event: "page_view", xdm: x.xdm, renderDecisions: x.renderDecisions }), { xdm, renderDecisions });
          await page.waitForFunction(() => window.__observed.length >= 3, null, { timeout: 8000 }).catch(() => {});
          await page.waitForTimeout(500);
        } });
        const expected = posts(r.fixture);
        // Only the 064-19 note remains: the first two POSTs ignore webPageDetails.URL.
        expect(r.observed).toHaveLength(expected.length);
        const url = "events[0].xdm.web.webPageDetails.URL";
        expected.forEach((e, i) => {
          const diffs = diffBodies(sortedState(r.observed[i].body), sortedState(e.request_body)).filter((d) => !(i < 2 && d === url));
          expect(diffs, `body ${i}`).toEqual([]);
        });
      }, T);
    }
  });

  describe("064-23 SPA view cache and first-event-only decisionScopes vs pinned stock Alloy 2.31.1 (SYNTHETIC responses, no capture)", () => {
    const view = (id, scope, items) => ({ id, scope, scopeDetails: { decisionProvider: "TGT", activity: { id: `act-${id}` }, characteristics: { scopeType: "view" } }, items });
    const pageWide = { id: "pw", scope: "__view__", scopeDetails: { decisionProvider: "TGT", activity: { id: "act-pw" }, characteristics: { eventToken: "t" } }, items: [{ id: "pw-0", schema: `${NS}default-content-item`, meta: {} }] };
    const PAYLOAD = [pageWide, view("vh", "home", [domAction("vh1", "setHtml", "#a", "<b>home</b>")]), view("vc", "cart", [domAction("vc1", "setHtml", "#b", "<b>cart</b>"), domAction("vc2", "setText", "#g", "cart text")])];
    const viewXdm = (name) => ({ eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name, viewName: name } } });
    /** The edge answers the first interact with `payload` and every later one with no decisions (as stock's edge does once the cache is warm). */
    const answerFirst = (payload) => { let n = 0; return (req) => (req.method() === "POST" ? { status: 200, headers: { "content-type": "application/json", ...cors(req) }, body: edgeBody(n++ === 0 ? payload : []) } : { status: 204, headers: cors(req), body: "" }); };
    const sum = (r) => r.network.filter((n) => n.method === "POST").map((n) => {
      const e = JSON.parse(n.body).events[0];
      const q = e.query && e.query.personalization;
      return { type: e.xdm.eventType, scopes: q ? q.decisionScopes || null : null, hasQuery: !!q, decisioning: (e.xdm._experience && e.xdm._experience.decisioning) || null };
    });
    const sequence = async (browser, payload, steps, { placements = [{ scope: "__view__", selector: "#v", minHeight: 0 }], stockScopes } = {}) => {
      const stock = await replayFixture(browser, "s4-base", { event: null, bodyHtml: ZONE, respond: answerFirst(payload), run: async (page) => {
        const dom = [];
        for (const [i, s] of steps.entries()) {
          const options = { xdm: s.xdm, renderDecisions: s.renderDecisions, ...(i === 0 && stockScopes ? { decisionScopes: stockScopes } : {}) };
          if (i === 0) await runStock(page, options); else await page.evaluate((o) => window.stockAlloy("sendEvent", o), options);
          await page.waitForTimeout(700);
          dom.push(await zoneDom(page));
        }
        return dom;
      } });
      const ours = await replayFixture(browser, "s4-base", { event: null, bodyHtml: '<div id="v"></div>' + ZONE, bootOptions: { placements }, respond: answerFirst(payload), run: async (page) => {
        const dom = [];
        for (const s of steps) {
          await page.evaluate((x) => window.__handle.push({ event: "page_view", xdm: x.xdm, renderDecisions: x.renderDecisions }), s);
          await page.waitForTimeout(900);
          dom.push(await zoneDom(page));
        }
        return dom;
      } });
      return { stock, ours };
    };
    const PV = { xdm: PV_XDM, renderDecisions: false };

    it("a push naming a cached view renders it and carries its display notification in that event, as stock", async () => {
      const { stock, ours } = await sequence(browser, PAYLOAD, [PV, { xdm: viewXdm("cart"), renderDecisions: true }]);
      expect(sum(ours)).toEqual(sum(stock));
      expect(sum(stock)).toHaveLength(2);
      expect(sum(stock)[1].decisioning.propositions[0].scope).toBe("cart");
      expect(ours.results.run).toEqual(stock.results.run);
      expect(ours.results.run[1]).toContain("<b>cart</b>");
      expect(ours.results.run[1]).not.toContain("<b>home</b>");
    }, T);

    it("the first response renders nothing of the cache without renderDecisions, and only the named view with it, as stock", async () => {
      const first = { xdm: viewXdm("home"), renderDecisions: true };
      const { stock, ours } = await sequence(browser, PAYLOAD, [first]);
      expect(sum(ours)).toEqual(sum(stock));
      expect(ours.results.run).toEqual(stock.results.run);
      expect(ours.results.run[0]).toContain("<b>home</b>");
      expect(ours.results.run[0]).not.toContain("<b>cart</b>");
    }, T);

    it("returning to a view re-renders it once per push, and an unknown view sends the empty view notification, as stock", async () => {
      const steps = [PV, { xdm: viewXdm("cart"), renderDecisions: true }, { xdm: viewXdm("home"), renderDecisions: true }, { xdm: viewXdm("cart"), renderDecisions: true }, { xdm: viewXdm("nowhere"), renderDecisions: true }, { xdm: viewXdm("cart"), renderDecisions: false }];
      const { stock, ours } = await sequence(browser, PAYLOAD, steps);
      expect(sum(ours)).toEqual(sum(stock));
      expect(sum(stock)).toHaveLength(6);
      expect(ours.results.run).toEqual(stock.results.run);
    }, T);

    it("declared decisionScopes ride the first event only, as stock; a later event carries none", async () => {
      const placements = [{ scope: "__view__", selector: "#v", minHeight: 0 }, { scope: SCOPE, selector: "#hero", minHeight: 20 }];
      const steps = [PV, { xdm: { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name: "airlock064-page-2" } } }, renderDecisions: false }, { xdm: viewXdm("cart"), renderDecisions: false }];
      const { stock, ours } = await sequence(browser, PAYLOAD, steps, { placements, stockScopes: [SCOPE] });
      const o = sum(ours);
      // Same first-event scopes as stock, sorted (stock was given [SCOPE]; the airlock side must not add or drop one).
      expect([...(o[0].scopes || [])].sort()).toEqual([...(sum(stock)[0].scopes || [])].sort());
      expect(o[0].scopes).toContain(SCOPE);
      expect(o.slice(1).map((x) => x.hasQuery)).toEqual([false, false]);
      expect(o.map((x) => x.hasQuery)).toEqual(sum(stock).map((x) => x.hasQuery));
      expect(o).toHaveLength(sum(stock).length);
    }, T);

    it("a ruleset item and a view proposition in the same event render and notify the view once, as stock", async () => {
      const SURF = "web://main--aem-eds-airlock-poc--adobe-rnd.aem.page/";
      const ruleset = { id: "rs1", scope: SURF, scopeDetails: { decisionProvider: "AJO", activity: { id: "act-rs" } }, items: [{ id: "ri", schema: `${NS}ruleset-item`, data: { version: 1, rules: [{ condition: { type: "group", definition: { logic: "and", conditions: [{ type: "matcher", definition: { key: "~type", matcher: "eq", values: ["com.adobe.eventType.edge"] } }] } }, consequences: [{ id: "cq-1", type: "schema", detail: { id: "on-event", schema: `${NS}json-content-item`, data: { content: { fired: "event" } } } }] }] } }] };
      const first = { xdm: viewXdm("cart"), renderDecisions: true };
      const { stock, ours } = await sequence(browser, [...PAYLOAD, ruleset], [first], { placements: [{ scope: "__view__", selector: "#v", minHeight: 0 }, { scope: SURF, selector: "#v", minHeight: 0 }] });
      const cartDisplays = (r) => sum(r).flatMap((x) => (x.decisioning ? x.decisioning.propositions : [])).filter((p) => p.scope === "cart");
      expect(cartDisplays(stock)).toHaveLength(1);
      expect(cartDisplays(ours)).toHaveLength(1);
    }, T);

    it("a failed request on a cold cache sends no empty-view display, as stock", async () => {
      const failing = (req) => (req.method() === "POST" ? { status: 400, headers: { "content-type": "application/json", ...cors(req) }, body: JSON.stringify({ errors: [{ status: 400, title: "bad" }] }) } : { status: 204, headers: cors(req), body: "" });
      const post = (r) => r.network.filter((n) => n.method === "POST");
      const stock = await replayFixture(browser, "s4-base", { event: null, bodyHtml: ZONE, respond: failing, run: (page) => runStock(page, { xdm: viewXdm("cart"), renderDecisions: true }).catch(() => "rejected") });
      const ours = await replayFixture(browser, "s4-base", { event: null, bodyHtml: '<div id="v"></div>' + ZONE, bootOptions: { placements: [{ scope: "__view__", selector: "#v", minHeight: 0 }] }, respond: failing, run: async (page) => {
        await page.evaluate((x) => Promise.resolve(window.__handle.push({ event: "page_view", xdm: x, renderDecisions: true })).catch(() => {}), viewXdm("cart"));
        await page.waitForTimeout(1500);
      } });
      expect(post(stock)).toHaveLength(1);
      expect(post(ours)).toHaveLength(1);
    }, T);
  });

  describe("AC1 rendering vs pinned stock Alloy 2.31.1 (SYNTHETIC responses, no capture)", () => {
    const actions = [
      ["setHtml", "#a", "<b>one</b>"], ["replaceHtml", "#b", "<u>two</u>"], ["prependHtml", "#c", "<i>pre</i>"], ["appendHtml", "#d", "<i>app</i>"],
      ["insertBefore", "#e", "<s>bef</s>"], ["insertAfter", "#f", "<s>aft</s>"], ["setText", "#g", "plain <not-html>"],
      ["setAttribute", "#h", { "data-x": "1", title: "t" }], ["setStyle", "#n", { color: "red", "font-size": "20px", priority: "important" }],
      ["setImageSource", "#img", "/new.png"], ["rearrange", "#k", { from: 0, to: 2 }], ["move", "#m", { left: 10, top: 20 }], ["resize", "#r", { width: 30, height: 40 }],
    ];
    it("every DOM action type renders as stock does", async () => {
      const payload = [proposition("p1", "__view__", actions.map(([t, sel, c], i) => domAction(`i${i}`, t, sel, c)))];
      const { stock, ours } = await stockVsAirlock(browser, payload, { probe: zoneDom });
      expect(ours.results.run).toBe(stock.results.run);
      expect(ours.results.run).toContain("<b>one</b>");
      expect(ours.results.run).toContain("/new.png");
    }, T);

    it("remove renders as stock does", async () => {
      const payload = [proposition("p2", "__view__", [domAction("r1", "remove", "#a"), domAction("r2", "remove", "#b")])];
      const { stock, ours } = await stockVsAirlock(browser, payload, { probe: zoneDom });
      expect(ours.results.run).toBe(stock.results.run);
      expect(ours.results.run).not.toContain('id="a"');
    }, T);

    it("sanitizes inserted markup where stock re-executes scripts (the documented difference)", async () => {
      const payload = [proposition("p3", "__view__", [domAction("s1", "setHtml", "#a", '<b>ok</b><img src="x" onerror="window.__pwned=1"><script>window.__pwned=2</script>')])];
      const { ours } = await stockVsAirlock(browser, payload, { probe: async (page) => ({ dom: await zoneDom(page), pwned: await page.evaluate(() => window.__pwned || 0) }) });
      expect(ours.results.run.pwned).toBe(0);
      expect(ours.results.run.dom).toContain("<b>ok</b>");
    }, T);

    it("a redirect item navigates with location.replace to the same URL as stock", async () => {
      const payload = [proposition("p4", "__view__", [{ id: "rd", schema: `${NS}redirect-item`, data: { content: "https://redirect.example/landing" } }])];
      const probe = (page) => page.evaluate(() => performance.getEntriesByType("navigation").length);
      const navs = { stock: [], ours: [] };
      for (const key of ["stock", "ours"]) {
        const common = { event: null, bodyHtml: '<div id="v"></div>' + ZONE, respond: synthetic(payload) };
        const run = async (page) => {
          page.on("request", (rq) => { if (rq.isNavigationRequest() && /redirect\.example/.test(rq.url())) navs[key].push(rq.url()); });
          if (key === "stock") await runStock(page, { renderDecisions: true, xdm: PV_XDM }).catch(() => {});
          else await page.evaluate((x) => window.__handle.push({ event: "page_view", xdm: x }), PV_XDM);
          await page.waitForTimeout(1200);
          return probe(page).catch(() => 0);
        };
        await replayFixture(browser, "s4-base", key === "stock" ? { ...common, run } : { ...common, bootOptions: { placements: [{ scope: "__view__", selector: "#v", minHeight: 0 }] }, run }).catch(() => {});
      }
      expect(navs.stock).toEqual(["https://redirect.example/landing"]);
      expect(navs.ours).toEqual(navs.stock);
    }, T);

    it("several inserted nodes keep their order after insertAfter, as stock", async () => {
      const payload = [proposition("p6", "__view__", [domAction("m1", "insertAfter", "#f", "<s>1</s>text<s>2</s>"), domAction("m2", "prependHtml", "#c", "<i>x</i><i>y</i>")])];
      const { stock, ours } = await stockVsAirlock(browser, payload, { probe: zoneDom });
      expect(ours.results.run).toBe(stock.results.run);
    }, T);

    it("an html-content-item carrying selector and type renders as a dom-action, as stock", async () => {
      const payload = [proposition("p7", "__view__", [{ id: "hc", schema: `${NS}html-content-item`, data: { content: "<b>hc</b>", selector: "#a", type: "setHtml" } }])];
      const { stock, ours } = await stockVsAirlock(browser, payload, { probe: zoneDom });
      expect(ours.results.run).toBe(stock.results.run);
      expect(ours.results.run).toContain("<b>hc</b>");
    }, T);

    it("a json-content-item renders nothing and sends no DOM change, as stock", async () => {
      const payload = [proposition("pj", "__view__", [{ id: "j1", schema: `${NS}json-content-item`, data: { content: { a: 1 } } }])];
      const { stock, ours } = await stockVsAirlock(browser, payload, { probe: zoneDom });
      expect(ours.results.run).toBe(stock.results.run);
    }, T);

    it("renderDecisions:false renders nothing and sends no display notification, as stock", async () => {
      const payload = [proposition("p8", "__view__", [domAction("n1", "setHtml", "#a", "<b>no</b>")])];
      const probe = async (page) => ({ dom: await zoneDom(page) });
      const { stock, ours } = await stockVsAirlock(browser, payload, { probe, renderDecisions: false, bootExtra: { renderDecisions: false } });
      expect(ours.results.run.dom).toBe(stock.results.run.dom);
      expect(ours.results.run.dom).not.toContain("<b>no</b>");
      expect(ours.network.filter((n) => /propositionDisplay/.test(n.body || ""))).toHaveLength(0);
    }, T);

    it("refuses executable setAttribute vectors and isolates a failing item from the rest of the batch", async () => {
      const payload = [proposition("p9", "__view__", [
        domAction("x1", "setAttribute", "#h", { srcdoc: "<script>1</script>", "http-equiv": "refresh", onclick: "1", href: "javascript:1", title: "kept" }),
        domAction("x2", "setAttribute", "#z", { "bad name": "1" }),
        domAction("x3", "setHtml", "#a", "<b>after</b>"),
      ])];
      const { ours } = await stockVsAirlock(browser, payload, { probe: zoneDom });
      expect(ours.results.run).toContain('title="kept"');
      expect(ours.results.run).not.toMatch(/srcdoc|http-equiv|onclick|javascript:/);
      expect(ours.results.run).toContain("<b>after</b>");
    }, T);

    it("prehidingStyle is applied before the answer and removed after rendering, like stock", async () => {
      const head = '<script>window.__seen=[];new MutationObserver(()=>{const s=document.getElementById("alloy-prehiding");if(s&&!window.__seen.includes("on"))window.__seen.push("on");if(!s&&window.__seen.includes("on")&&!window.__seen.includes("off"))window.__seen.push("off");}).observe(document.documentElement,{childList:true,subtree:true});</script>';
      const payload = [proposition("p5", "__view__", [domAction("h1", "setHtml", "#a", "<b>x</b>")])];
      const css = "#z{visibility:hidden}";
      const probe = async (page) => ({ seen: await page.evaluate(() => window.__seen), left: await page.evaluate(() => !!document.getElementById("alloy-prehiding")) });
      const { stock, ours } = await stockVsAirlock(browser, payload, { probe, head, stockConfig: { prehidingStyle: css }, bootExtra: { prehidingStyle: css } });
      expect(stock.results.run.left).toBe(false);
      expect(ours.results.run.left).toBe(false);
      expect(ours.results.run.seen).toEqual(["on", "off"]);
    }, T);

    it("applyPropositions with metadata renders the held propositions like stock and notifies nothing itself", async () => {
      const props = [{ id: "ap1", scope: "web-page", scopeDetails: { decisionProvider: "TGT", activity: { id: "ap-act" } }, items: [{ id: "ai", schema: `${NS}html-content-item`, data: { content: "<em>applied</em>" } }] }];
      const metadata = { "web-page": { selector: "#a", actionType: "setHtml" } };
      const stockRun = await replayFixture(browser, "s4-base", { event: null, bodyHtml: ZONE, respond: synthetic([]), run: async (page) => {
        await runStock(page, { xdm: PV_XDM });
        await page.evaluate(async ([p, m]) => { await window.stockAlloy("applyPropositions", { propositions: p, metadata: m }); }, [props, metadata]);
        await page.waitForTimeout(1500);
        return zoneDom(page);
      } });
      const ours = await replayFixture(browser, "s4-base", { event: null, bodyHtml: ZONE, bootOptions: {}, respond: synthetic([]), run: async (page) => {
        await page.evaluate(([p, m]) => window.__handle.applyPropositions({ propositions: p, metadata: m }), [props, metadata]);
        await page.waitForTimeout(900);
        return zoneDom(page);
      } });
      expect(ours.results.run).toBe(stockRun.results.run);
      expect(ours.results.run).toContain("<em>applied</em>");
      // Stock sends no notification of its own for applyPropositions (rendered propositions ride the NEXT event
      // only on request), and neither do we.
      expect(stockRun.network.filter((n) => n.method === "POST" && /propositionDisplay/.test(n.body || ""))).toHaveLength(0);
      expect(ours.network.filter((n) => n.method === "POST" && /propositionDisplay/.test(n.body || ""))).toHaveLength(0);
    }, T);
  });

  describe("AC2 click collection and notifications vs pinned stock Alloy 2.31.1 (SYNTHETIC page, no capture)", () => {
    const LINKS = '<div id="box"><a id="ext" href="https://destination.example/landing" onclick="return false"><span id="inner">Go there</span></a><a id="dl" href="/files/report.pdf" onclick="return false">Report</a><a id="inl" href="/other" onclick="return false">Other</a></div>';
    const click = async (browser, selector) => {
      const stock = await replayFixture(browser, "s4-base", { event: null, bodyHtml: LINKS, bootOptions: { clickCollectionEnabled: false }, respond: synthetic([]), run: async (page) => { await runStock(page, { xdm: PV_XDM }); await page.click(selector); await page.waitForTimeout(800); } });
      const ours = await replayFixture(browser, "s4-base", { event: null, bodyHtml: LINKS, respond: synthetic([]), run: async (page) => { await page.evaluate((x) => window.__handle.push({ event: "page_view", xdm: x }), PV_XDM); await page.waitForTimeout(600); await page.click(selector); await page.waitForTimeout(1000); } });
      const last = (r) => r.network.filter((n) => n.method === "POST").map((n) => n.body).filter((b) => /linkClicks/.test(b || ""));
      return { stock: last(stock), ours: last(ours) };
    };
    for (const [name, selector] of [["external link (click on a nested element)", "#inner"], ["download link", "#dl"], ["internal link", "#inl"]]) {
      it(`${name}: the auto-collected request body is stock's`, async () => {
        const { stock, ours } = await click(browser, selector);
        expect(stock).toHaveLength(1);
        expect(ours).toHaveLength(1);
        const strip = (t) => { const b = JSON.parse(t); delete b.meta; return JSON.stringify(b); };
        expect(diffBodies(strip(ours[0]), strip(stock[0]))).toEqual([]);
      }, T);
    }

    it("clickCollectionEnabled:false collects nothing", async () => {
      const r = await replayFixture(browser, "s4-base", { event: null, bodyHtml: LINKS, bootOptions: { clickCollectionEnabled: false }, respond: synthetic([]), run: async (page) => { await page.click("#ext"); await page.waitForTimeout(800); } });
      expect(r.network.filter((n) => /linkClicks/.test(n.body || ""))).toHaveLength(0);
    }, T);

    it("a click on a rendered click-action element sends propositionInteract with the proposition metas (decisioning compared; full shape is 064-25)", async () => {
      const payload = [proposition("pc", "__view__", [
        domAction("c0", "setHtml", "#box", '<a id="cta" href="https://destination.example/x" onclick="return false" data-aep-click-label="cta-label" data-aep-click-token="tok">CTA</a>'),
        { ...domAction("c1", "click", "#cta", {}), characteristics: { trackingLabel: "cta-label" } },
      ])];
      const cta = (r) => r.network.filter((n) => n.method === "POST" && /propositionInteract/.test(n.body || "")).map((n) => JSON.parse(n.body).events[0].xdm._experience.decisioning);
      const stock = await replayFixture(browser, "s4-base", { event: null, bodyHtml: LINKS, respond: synthetic(payload), run: async (page) => { await runStock(page, { renderDecisions: true, xdm: PV_XDM }); await page.waitForTimeout(600); await page.click("#cta"); await page.waitForTimeout(800); } });
      const ours = await replayFixture(browser, "s4-base", { event: null, bodyHtml: '<div id="v"></div>' + LINKS, bootOptions: { placements: [{ scope: "__view__", selector: "#v", minHeight: 0 }] }, respond: synthetic(payload), run: async (page) => { await page.evaluate((x) => window.__handle.push({ event: "page_view", xdm: x }), PV_XDM); await page.waitForTimeout(900); await page.click("#cta"); await page.waitForTimeout(1000); } });
      expect(cta(stock)).toHaveLength(1);
      expect(cta(ours)).toEqual(cta(stock));
    }, T);
  });

  describe("064-24 redirect display notification vs pinned stock Alloy 2.31.1 (SYNTHETIC redirect answer, no capture)", () => {
    const URL_TO = "https://redirect.example/landing";
    // Stock sends a documentUnloading event as a beacon only once the identity cookie exists, so the answer stores a synthetic one.
    const IDENTIFIED = (payload, hint) => JSON.stringify({ requestId: "00000000-0000-0000-0000-000000000064", handle: [{ type: "state:store", payload: [{ key: "kndctr_908936ED5D35CC220A495CD4_AdobeOrg_identity", value: "SYNTHETIC-064", maxAge: 34128000 }, ...(hint ? [{ key: "kndctr_908936ED5D35CC220A495CD4_AdobeOrg_cluster", value: hint, maxAge: 1800 }] : [])] }, { type: "personalization:decisions", payload }] });
    const REDIRECT = [proposition("rp", "__view__", [{ id: "rd", schema: `${NS}redirect-item`, data: { content: URL_TO } }])];
    // Records every edge send on the main thread (a beacon or a fetch) with the body visibility and keepalive flag it had at call time.
    const TRACE = `<script>(() => {
      const edge = (u) => /interact|adobedc/.test(String(u));
      const log = (o) => console.log("__trace " + JSON.stringify({ ...o, bodyVisibility: document.body ? getComputedStyle(document.body).visibility : "none" }));
      const beacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = (u, d) => { if (edge(u)) log({ kind: "send", via: "beacon", keepalive: true }); return beacon(u, d); };
      const nativeFetch = window.fetch.bind(window);
      window.fetch = (u, init) => { if (edge(u)) log({ kind: "send", via: "fetch", keepalive: !!(init && init.keepalive) }); return nativeFetch(u, init); };
    })();</script>`;
    /** One arm: the edge answers the first interact with the redirect and the later ones per `later`; returns the ordered trace. */
    const arm = async (browser, who, { later = () => ({ status: 204, body: "" }), bootExtra = {}, drive, hint } = {}) => {
      const trace = [];
      let posts = 0;
      const respond = (req) => {
        if (req.method() !== "POST") return { status: 204, headers: cors(req), body: "" };
        const first = posts++ === 0;
        if (first) return { status: 200, headers: { "content-type": "application/json", ...cors(req) }, body: IDENTIFIED(REDIRECT, hint) };
        const out = later(req);
        return out === "abort" ? out : { headers: { "content-type": "application/json", ...cors(req) }, ...out };
      };
      const common = { event: null, headHtml: TRACE, bodyHtml: '<div id="v"></div>' + ZONE, respond };
      const run = async (page) => {
        page.on("console", (m) => { const t = m.text(); if (t.startsWith("__trace ")) trace.push(JSON.parse(t.slice(8))); });
        page.on("request", (rq) => {
          if (rq.isNavigationRequest() && rq.url() === URL_TO) trace.push({ kind: "navigate" });
          else if (/interact|adobedc/.test(rq.url()) && rq.method() === "POST") trace.push({ kind: "request" });
        });
        if (drive) await drive(page, who); else if (who === "stock") await runStock(page, { renderDecisions: true, xdm: PV_XDM }).catch(() => {}); else await page.evaluate((x) => window.__handle.push({ event: "page_view", xdm: x }), PV_XDM);
        await page.waitForTimeout(2500);
      };
      const r = await replayFixture(browser, "s4-base", who === "stock" ? { ...common, run } : { ...common, bootOptions: { placements: [{ scope: "__view__", selector: "#v", minHeight: 0 }], ...bootExtra }, run });
      return { trace, network: r.network.filter((n) => n.method === "POST"), diagnostics: r.diagnostics };
    };
    const displayOf = (network) => network.find((n) => /propositionDisplay/.test(n.body));

    it("prehides the body, sends the display with keepalive, then navigates, as stock", async () => {
      const stock = await arm(browser, "stock");
      const ours = await arm(browser, "ours");
      const keep = (t) => t.filter((e) => e.kind === "send" && e.keepalive);
      // The display is the second edge POST and it carries the keepalive flag, sent while the body is hidden.
      expect(stock.network).toHaveLength(2);
      expect(ours.network).toHaveLength(2);
      expect(keep(stock.trace).map((e) => e.bodyVisibility)).toEqual(["hidden"]);
      expect(keep(ours.trace).map((e) => e.bodyVisibility)).toEqual(["hidden"]);
      expect(keep(ours.trace).map((e) => e.keepalive)).toEqual(keep(stock.trace).map((e) => e.keepalive));
      // Display request first, then the navigation, in both arms.
      for (const a of [stock, ours]) {
        const kinds = a.trace.map((e) => e.kind).filter((k) => k === "request" || k === "navigate");
        expect(kinds).toEqual(["request", "request", "navigate"]);
      }
    }, T);

    it("the display request body compares clean against stock, keepalive flag included", async () => {
      const stock = await arm(browser, "stock");
      const ours = await arm(browser, "ours");
      const s = displayOf(stock.network);
      const o = displayOf(ours.network);
      expect(s && o).toBeTruthy();
      expect(diffBodies(sortedState(o.body), sortedState(s.body))).toEqual([]);
      expect(JSON.parse(o.body).events[0].xdm.eventType).toBe("decisioning.propositionDisplay");
      // Same transport flag on both sides (stock: sendBeacon; ours: keepalive fetch through the seam).
      const sent = (a) => a.trace.filter((e) => e.kind === "send").map((e) => e.keepalive);
      expect(sent(ours)).toEqual(sent(stock));
      expect(sent(ours)).toEqual([false, true]);
    }, T);

    const kinds = (a) => a.trace.map((e) => e.kind).filter((k) => k === "request" || k === "navigate");
    const dispositions = (a) => a.diagnostics.map((d) => d.disposition);

    it("a failed display still navigates, and the failure is diagnosed", async () => {
      const ours = await arm(browser, "ours", { later: () => "abort" });
      expect(kinds(ours)).toEqual(["request", "request", "navigate"]);
      expect(dispositions(ours)).toContain("redirect-display-failed");
    }, T);

    it("a held display (its destination is outside the declared endpoints) still navigates after the bounded wait, and the hold is diagnosed", async () => {
      // A location hint with two path segments does not match the one-segment `{hint}` endpoint, so the seal holds the display.
      const ours = await arm(browser, "ours", { hint: "va6/x", bootExtra: { redirectDisplayTimeoutMs: 600 } });
      expect(kinds(ours)).toEqual(["request", "navigate"]);
      expect(dispositions(ours)).toContain("redirect-display-held");
      expect(dispositions(ours)).toContain("held");
    }, T);
  });

  describe("M3 and row 11/12: ruleset items as data (SYNTHETIC ruleset answer, no capture)", () => {
    const SURFACE = "web://main--aem-eds-airlock-poc--adobe-rnd.aem.page/";
    const rule = (key, value, id, content) => ({ condition: { type: "group", definition: { logic: "and", conditions: [{ type: "matcher", definition: { key, matcher: "eq", values: [value] } }] } }, consequences: [{ id: `cq-${id}`, type: "schema", detail: { id, schema: `${NS}json-content-item`, data: { content } } }] });
    // The rule set matches on the edge event type (fires on the pushed event) and on a window-less host key (fires only through evaluateRulesets).
    const rulesetPayload = [{ id: "rs1", scope: SURFACE, scopeDetails: { decisionProvider: "AJO", activity: { id: "act-rs" } }, items: [{ id: "ri", schema: `${NS}ruleset-item`, data: { version: 1, rules: [rule("~type", "com.adobe.eventType.edge", "on-event", { fired: "event" }), rule("airlockKey", "yes", "on-eval", { fired: "eval" })] } }] }];
    it("subscribeRulesetItems delivers evaluated items to the main-thread callback as data", async () => {
      const r = await replayFixture(browser, "s4-base", { event: null, bootOptions: { placements: [{ scope: SURFACE, selector: "#v", minHeight: 0 }] }, bodyHtml: '<div id="v"></div>', respond: synthetic(rulesetPayload), run: async (page) => {
        await page.evaluate(() => { window.__rs = []; window.__unsub = window.__handle.subscribeRulesetItems({ surfaces: [], schemas: [], callback: (x) => window.__rs.push(JSON.parse(JSON.stringify(x))) }); });
        await page.evaluate((x) => window.__handle.push({ event: "page_view", xdm: x }), PV_XDM);
        await page.waitForTimeout(1500);
        const got = await page.evaluate(() => window.__rs);
        const evaluated = await page.evaluate(() => window.__command("evaluateRulesets", { renderDecisions: false, personalization: { decisionContext: { airlockKey: "yes" } } }).then((v) => JSON.parse(JSON.stringify(v ?? null)), (e) => ({ error: String(e) })));
        return { got, evaluated };
      } });
      const run = r.results.run;
      const contents = (xs) => xs.flatMap((x) => x.propositions.flatMap((p) => p.items.map((i) => i.data.content)));
      // The callback got DATA only (a function never crossed the airlock) and exactly the event-time rule.
      expect(contents(run.got)).toEqual([{ fired: "event" }]);
      expect(run.got[0].propositions[0].scope).toBe(SURFACE);
      // evaluateRulesets (row 11, chamber-native, rig command) runs the rule set against a host-supplied context.
      expect(JSON.stringify(run.evaluated.result.propositions)).toContain('"fired":"eval"');
      expect(r.observed).toHaveLength(1);
    }, T);
  });
});
