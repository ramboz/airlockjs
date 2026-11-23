// Spec 069-01: the handle returns what pinned stock Alloy 2.31.1 returns, in real Chromium (SYNTHETIC answers, no
// capture). Each test runs the same page against stock Alloy on the main thread and against the airlock handle (real
// chamber, seam and renderer) and compares what the promise resolved or rejected with. The hermetic tests are in
// test/adobe-069-01-handle-results.test.js. Gated like the other real-browser tests: `AIRLOCK_REAL_CHROMIUM=1`.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { replayFixture } from "../rig/adobe-b1-replay.mjs";

const real = process.env.AIRLOCK_REAL_CHROMIUM === "1";
const T = 90000;
const NS = "https://ns.adobe.com/personalization/";
const DATASTREAM = "12345678-1234-1234-1234-123456789012";
const ORG = "908936ED5D35CC220A495CD4@AdobeOrg";
const cors = (req) => ({ "access-control-allow-origin": req.headers().origin || "*", "access-control-allow-credentials": "true", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, GET, OPTIONS" });
const view = (name) => ({ id: `v-${name}`, scope: name, scopeDetails: { decisionProvider: "TGT", activity: { id: `act-${name}` }, characteristics: { scopeType: "view" } }, items: [{ id: `i-${name}`, schema: `${NS}dom-action`, data: { type: "setHtml", selector: "#z", content: `<b>${name}</b>` } }] });
const banner = { id: "p-banner", scope: "banner", scopeDetails: { decisionProvider: "TGT", activity: { id: "act-banner" } }, items: [{ id: "i-banner", schema: `${NS}json-content-item`, data: { content: { hello: "world" } } }] };
const pageWide = { id: "pw", scope: "__view__", scopeDetails: { decisionProvider: "TGT", activity: { id: "act-pw" }, characteristics: { eventToken: "t" } }, items: [{ id: "pw-0", schema: `${NS}default-content-item`, meta: {} }] };
const PAYLOAD = [pageWide, view("home"), view("cart"), banner];
const answer = (payload, { failInteract, failConsent } = {}) => (req) => {
  if (req.method() !== "POST") return { status: 204, headers: cors(req), body: "" };
  const consent = req.url().includes("set-consent");
  if ((consent && failConsent) || (!consent && failInteract)) return { status: 400, headers: { "content-type": "application/json", ...cors(req) }, body: JSON.stringify({ errors: [{ status: 400, title: "bad" }], requestId: "r" }) };
  return { status: 200, headers: { "content-type": "application/json", ...cors(req) }, body: consent ? JSON.stringify({ requestId: "r", handle: [] }) : JSON.stringify({ requestId: "r", handle: [{ type: "personalization:decisions", payload }] }) };
};
// The recorded S10 interact answer (its recorded response body); it carries an empty personalization:decisions payload.
const S10 = JSON.parse(readFileSync(new URL("./fixtures/adobe-capture/s10-base.json", import.meta.url), "utf8"));
const S10_ANSWER = S10.requests.find((r) => r.method === "POST" && /\/interact\?/.test(r.url)).response_body;
const recordedInteract = (req) => (req.method() !== "POST" ? { status: 204, headers: cors(req), body: "" } : { status: 200, headers: { "content-type": "application/json", ...cors(req) }, body: S10_ANSWER });
const posts = (r) => r.network.filter((n) => n.method === "POST");
const ZONE = '<div id="z">orig</div>';
const PV = { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name: "p" } } };
const viewXdm = (name) => ({ eventType: "web.webpagedetails.viewStart", web: { webPageDetails: { viewName: name, name: "p" } } });
const inst = (r) => (r && r.err ? { ...r, err: r.err.replace("[stockAlloy]", "[alloy]") } : r);
const keys = (o, p = "") => (o && typeof o === "object" ? Object.keys(o).sort().flatMap((k) => [p + k, ...keys(o[k], `${p}${k}.`)]) : []);
const noDest = (r) => { if (r && r.ok) { const { destinations, ...rest } = r.ok; return { ok: rest }; } return r; };

/** Stock Alloy on the main thread; the queue stub is Adobe's documented base code. */
const stockSetup = (page, extra = {}) => page.evaluate(async ({ datastreamId, orgId, extra }) => {
  window.__alloyNS = ["stockAlloy"];
  window.stockAlloy = function () { const a = arguments; return new Promise((res, rej) => window.stockAlloy.q.push([res, rej, a])); };
  window.stockAlloy.q = [];
  await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/rig/alloy.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const cfg = { datastreamId, orgId, defaultConsent: "in", debugEnabled: false };
  if (extra.hook) cfg.onBeforeEventSend = extra.hook === "throw" ? () => { throw new Error("hook failed"); } : extra.hook === "false" ? () => false : (c) => { window.__hookArg = JSON.parse(JSON.stringify(c)); if (extra.hook === "edit") c.xdm.web.webPageDetails.URL = "https://edited.example/p"; };
  if (extra.consent) cfg.defaultConsent = "pending";
  window.stockAlloy("configure", cfg);
}, { datastreamId: DATASTREAM, orgId: ORG, extra });
const stockCall = (page, name, o) => page.evaluate(async ({ name, o }) => {
  try { return { ok: JSON.parse(JSON.stringify((await window.stockAlloy(name, o)) ?? null)) }; } catch (e) { return { err: String(e && e.message), plain: Object.getPrototypeOf(e) === Error.prototype }; }
}, { name, o });

/** The airlock arm: the page talks to the handle (`window.__handle`) or through the wrapper bridge. */
const ours = (browser, respond, run, { boot = {}, body = ZONE, extraCookies = [], fixture = "s4-base" } = {}) => replayFixture(browser, fixture, { event: null, extraCookies, bodyHtml: body, bootOptions: { placements: [{ scope: "__view__", selector: "#v", minHeight: 0 }], ...boot }, respond, run });
const stock = (browser, respond, run, body = ZONE, fixture = "s4-base") => replayFixture(browser, fixture, { event: null, bodyHtml: body, respond, run });
const handleCall = (page, fn, arg) => page.evaluate(async ({ fn, arg }) => {
  const h = window.__handle;
  try { return { ok: JSON.parse(JSON.stringify((await new Function("h", "arg", `return (${fn})(h, arg)`)(h, arg)) ?? null)) }; } catch (e) { return { err: String(e && e.message), plain: Object.getPrototypeOf(e) === Error.prototype }; }
}, { fn, arg });

describe.runIf(real)("069-01 the handle vs pinned stock Alloy 2.31.1 (real Chromium, SYNTHETIC answers)", () => {
  let browser;
  beforeAll(async () => { browser = await chromium.launch(); });
  afterAll(async () => { await browser.close(); });

  const OPTS = { renderDecisions: true, decisionScopes: ["banner"], xdm: PV };

  it("AC1: sendEvent resolves { propositions, decisions } as stock does (scoped JSON, named view render:false, named view render:true)", async () => {
    const steps = [OPTS, { renderDecisions: false, xdm: viewXdm("home") }, { renderDecisions: true, xdm: viewXdm("cart") }, { renderDecisions: true, xdm: viewXdm("nowhere") }];
    const s = await stock(browser, answer(PAYLOAD), async (page) => { await stockSetup(page); const out = []; for (const o of steps) out.push(noDest(await stockCall(page, "sendEvent", o))); return out; });
    const o = await ours(browser, answer(PAYLOAD), async (page) => { const out = []; for (const x of steps) out.push(noDest(await handleCall(page, "(h, x) => h.sendEvent(x)", x))); return out; });
    expect(o.results.run).toEqual(s.results.run);
    expect(s.results.run[0].ok.propositions.map((p) => [p.id, p.renderAttempted])).toEqual([["pw", true], ["p-banner", false]]);
    expect(s.results.run[0].ok.decisions.map((p) => p.id)).toEqual(["p-banner"]);
    expect(s.results.run[1].ok.propositions.map((p) => [p.id, p.renderAttempted])).toEqual([["v-home", false]]);
    expect(s.results.run[2].ok.propositions.map((p) => [p.id, p.renderAttempted])).toEqual([["v-cart", true]]);
  }, T);

  it("AC1: the recorded S10 interact answer resolves identically in both arms (it carries no propositions or decisions: an empty personalization:decisions payload)", async () => {
    expect(JSON.parse(S10_ANSWER).handle.find((h) => h.type === "personalization:decisions").payload).toEqual([]);
    // One event per run: the recorded answer's location hint moves the next request to /ee/or2/... on adobedc.demdex.net (the host this rig boots with), and the ceiling lists hint paths only on edge.adobedc.net (a test-setup limit, not a product gap).
    for (const x of [OPTS, { renderDecisions: true, xdm: PV }]) {
      const s = await stock(browser, recordedInteract, async (page) => { await stockSetup(page); return noDest(await stockCall(page, "sendEvent", x)); }, ZONE, "s10-base");
      const o = await ours(browser, recordedInteract, async (page) => noDest(await handleCall(page, "(h, x) => h.sendEvent(x)", x)), { fixture: "s10-base" });
      expect(o.results.run).toEqual(s.results.run);
      expect(s.results.run.ok.propositions).toEqual([]);
      expect(s.results.run.ok.decisions ?? []).toEqual([]);
    }
  }, T);

  it("AC1: a rejected command rejects with a plain Error carrying stock's message", async () => {
    const s = await stock(browser, answer(PAYLOAD, { failInteract: true }), async (page) => { await stockSetup(page); return stockCall(page, "sendEvent", OPTS); });
    const o = await ours(browser, answer(PAYLOAD, { failInteract: true }), (page) => handleCall(page, "(h, x) => h.sendEvent(x)", OPTS));
    expect(s.results.run.err).toMatch(/400/);
    expect(inst(o.results.run)).toEqual(inst(s.results.run));
  }, T);

  it("AC2: the hook sees stock's argument shape with the context merged in, and an edit to a context field reaches the wire", async () => {
    const hookOf = (page) => page.evaluate(() => window.__hookArg);
    const wire = (r) => JSON.parse(posts(r)[0].body).events[0].xdm;
    const s = await stock(browser, answer(PAYLOAD), async (page) => { await stockSetup(page, { hook: "edit" }); await stockCall(page, "sendEvent", { xdm: PV }); return hookOf(page); });
    const o = await ours(browser, answer(PAYLOAD), async (page) => {
      await page.evaluate(() => {
        window.__arg = null;
        const alloy = globalThis.AirlockEds.createAlloyCommandBridge(window.__handle, { onDiagnostic: () => {} });
        window.__bridge = alloy;
        return alloy("configure", { onBeforeEventSend: (c) => { window.__arg = JSON.parse(JSON.stringify(c)); c.xdm.web.webPageDetails.URL = "https://edited.example/p"; } });
      });
      await page.evaluate(() => window.__bridge("sendEvent", { xdm: { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name: "p" } } } }));
      return page.evaluate(() => window.__arg);
    });
    const volatile = (a) => { const c = JSON.parse(JSON.stringify(a)); delete c.xdm.timestamp; delete c.xdm.placeContext; delete c.xdm.device; delete c.xdm.environment; c.xdm.web.webPageDetails.URL = "u"; c.xdm.web.webReferrer.URL = "r"; return c; };
    expect(keys(o.results.run)).toEqual(keys(s.results.run));
    expect(volatile(o.results.run)).toEqual(volatile(s.results.run));
    expect(wire(s).web.webPageDetails.URL).toBe("https://edited.example/p");
    expect(wire(o).web.webPageDetails.URL).toBe("https://edited.example/p");
    expect(wire(o).web.webPageDetails.name).toBe("p");
  }, T);

  it("AC3: a throwing hook drops the event and rejects like stock; a false verdict drops it and resolves like stock", async () => {
    const wrapper = (page, hook) => page.evaluate(async (src) => {
      window.__d = [];
      const alloy = globalThis.AirlockEds.createAlloyCommandBridge(window.__handle, { onDiagnostic: (d) => window.__d.push(d.kind) });
      await alloy("configure", { onBeforeEventSend: new Function(`return ${src}`)() });
      try { return { ok: JSON.parse(JSON.stringify((await alloy("sendEvent", { xdm: { eventType: "x" } })) ?? null)), d: window.__d }; } catch (e) { return { err: String(e && e.message), plain: Object.getPrototypeOf(e) === Error.prototype, d: window.__d }; }
    }, hook);
    for (const [mode, src] of [["throw", "() => { throw new Error('hook failed'); }"], ["false", "() => false"]]) {
      const s = await stock(browser, answer(PAYLOAD), async (page) => { await stockSetup(page, { hook: mode }); return stockCall(page, "sendEvent", { xdm: PV }); });
      const o = await ours(browser, answer(PAYLOAD), (page) => wrapper(page, src));
      const { d, ...settled } = o.results.run;
      expect(posts(s)).toHaveLength(0);
      expect(posts(o)).toHaveLength(0);
      expect(inst(settled)).toEqual(inst(s.results.run));
      if (mode === "throw") { expect(d).toContain("hook-threw"); expect(s.results.run.err).toMatch(/Caused by: hook failed/); }
    }
  }, T);

  it("AC4: applyPropositions({ viewName }) with propositions adds the cached view as stock does; an unknown view renders nothing and sends nothing", async () => {
    const own = { id: "own", scope: "own", scopeDetails: { decisionProvider: "TGT" }, items: [{ id: "oi", schema: `${NS}dom-action`, data: { type: "setHtml", selector: "#o", content: "<i>own</i>" } }] };
    const warm = { renderDecisions: false, xdm: PV };
    const body = '<div id="z">orig</div><div id="o">orig</div>';
    const dom = (page) => page.evaluate(() => document.body.innerText);
    const s = await stock(browser, answer(PAYLOAD), async (page) => {
      await stockSetup(page);
      await stockCall(page, "sendEvent", warm);
      const hit = noDest(await stockCall(page, "applyPropositions", { propositions: [own], viewName: "cart" }));
      const miss = noDest(await stockCall(page, "applyPropositions", { propositions: [own], viewName: "nowhere" }));
      return { hit, miss, dom: await dom(page) };
    }, body);
    const o = await ours(browser, answer(PAYLOAD), async (page) => {
      await handleCall(page, "(h, x) => h.sendEvent(x)", warm);
      const hit = noDest(await handleCall(page, "(h, p) => h.applyPropositions({ propositions: [p], viewName: 'cart' })", own));
      const miss = noDest(await handleCall(page, "(h, p) => h.applyPropositions({ propositions: [p], viewName: 'nowhere' })", own));
      return { hit, miss, dom: await dom(page) };
    }, { body });
    expect(o.results.run).toEqual(s.results.run);
    expect(s.results.run.hit.ok.propositions.map((p) => p.id).sort()).toEqual(["own", "v-cart"]);
    expect(s.results.run.miss.ok.propositions.map((p) => p.id)).toEqual(["own"]);
    expect(posts(o)).toHaveLength(1);
    expect(posts(s)).toHaveLength(1);
  }, T);

  it("AC4 (finding): stock 2.31.1 rejects { viewName } alone (its validator needs propositions) and renders nothing, and so does the wrapper; the handle renders the cached view", async () => {
    const s = await stock(browser, answer(PAYLOAD), async (page) => {
      await stockSetup(page);
      await stockCall(page, "sendEvent", { renderDecisions: false, xdm: PV });
      return { res: await stockCall(page, "applyPropositions", { viewName: "cart" }), dom: await page.evaluate(() => document.getElementById("z").innerHTML) };
    });
    const o = await ours(browser, answer(PAYLOAD), async (page) => {
      await handleCall(page, "(h, x) => h.sendEvent(x)", { renderDecisions: false, xdm: PV });
      return { res: noDest(await handleCall(page, "(h) => h.applyPropositions({ viewName: 'cart' })")), dom: await page.evaluate(() => document.getElementById("z").innerHTML) };
    });
    expect(s.results.run).toEqual({ res: { ok: { propositions: [] } }, dom: "orig" });
    expect(o.results.run.dom).toContain("<b>cart</b>");
    expect(o.results.run.res.ok.propositions.map((p) => [p.id, p.renderAttempted])).toEqual([["v-cart", true]]);
    expect(posts(o)).toHaveLength(1);
    expect((await ours(browser, answer(PAYLOAD), (page) => handleCall(page, "(h) => h.applyPropositions({ viewName: 'nowhere' })"))).results.run).toEqual({ ok: { propositions: [] } });
    const w = await ours(browser, answer(PAYLOAD), async (page) => {
      await handleCall(page, "(h, x) => h.sendEvent(x)", { renderDecisions: false, xdm: PV });
      return page.evaluate(async () => {
        const alloy = globalThis.AirlockEds.createAlloyCommandBridge(window.__handle, { onDiagnostic: () => {} });
        return { res: await alloy("applyPropositions", { viewName: "cart" }), dom: document.getElementById("z").innerHTML };
      });
    });
    expect(w.results.run).toEqual({ res: s.results.run.res.ok, dom: "orig" });
    expect(posts(w)).toHaveLength(1);
  }, T);

  it("AC5: setAdobeConsent settles with Alloy's own outcome (resolve, and the rejection message on a failed set-consent)", async () => {
    const consent = [{ standard: "Adobe", version: "2.0", value: { collect: { val: "y" }, personalize: { content: { val: "y" } } } }];
    const stockRun = (respond) => stock(browser, respond, async (page) => { await stockSetup(page, { consent: true }); return stockCall(page, "setConsent", { consent }); });
    const oursRun = (respond) => ours(browser, respond, (page) => handleCall(page, "(h, c) => h.setAdobeConsent(c)", consent), { boot: { consentHold: null } });
    const sOk = await stockRun(answer(PAYLOAD));
    const oOk = await oursRun(answer(PAYLOAD));
    // Stock and the handle both resolve {} here; the known difference elsewhere is that stock's other results carry destinations etc.
    expect(sOk.results.run.ok).toEqual({});
    expect(oOk.results.run.ok).toEqual({});
    const sBad = await stockRun(answer(PAYLOAD, { failConsent: true }));
    const oBad = await oursRun(answer(PAYLOAD, { failConsent: true }));
    expect(sBad.results.run.err).toBeTruthy();
    expect(inst(oBad.results.run)).toEqual(inst(sBad.results.run));
  }, T);
});
