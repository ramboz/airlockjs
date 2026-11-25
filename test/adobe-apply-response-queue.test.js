import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bootAlloy } from "../adapters/eds/index.js";
import { MAX_HELD_BEACONS } from "../core/airlock.js";
import { shapeAlloyBoot } from "../connectors/alloy/consent.js";

// 064-28 (hermetic): the pump's ordering of a redirect display, the consent ring, and the view-drop decision.
// The Worker models the chamber's boot glue like test/alloy-consent-hold.test.js: pending consent parks every event,
// a grant flushes them, and each driven event leaves through the intercepted fetch.
const INTERACT = "https://adobedc.demdex.net/ee/v1/interact";
const DS = "12345678-1234-1234-1234-123456789012";
const entry = (extra = {}) => ({ type: "alloy", bundleUrl: "https://airlock.example/alloy.js", datastreamId: DS, orgId: "ORG@AdobeOrg", onDecisions: () => {}, ...extra });
const GRANTED = { analytics_storage: "granted", personalization: "granted" };
const NS = "https://ns.adobe.com/personalization/";
const REDIRECT = { id: "rp", scope: "__view__", scopeDetails: { decisionProvider: "TGT", activity: { id: "a" }, characteristics: { scopeType: "view" } }, items: [{ id: "i", schema: `${NS}redirect-item`, data: { content: "https://redirect.example/x" } }] };
const CART = { id: "vc", scope: "cart", scopeDetails: { decisionProvider: "TGT", activity: { id: "b" }, characteristics: { scopeType: "view" } }, items: [{ id: "c1", schema: `${NS}html-content-item`, data: { content: "<b>cart</b>" } }] };

class Worker {
  constructor() { this.handlers = []; this.messages = []; this.queue = []; this.vector = null; this.n = 0; this.held = []; Worker.last = this; }
  addEventListener(t, fn) { if (t === "message") this.handlers.push(fn); }
  removeEventListener() {}
  terminate() {}
  release() { for (const e of this.held.splice(0)) this.fire(Worker.body(e)); }
  emit(msg) { for (const h of this.handlers.slice()) h({ data: msg }); }
  fire(body) {
    this.n += 1;
    this.emit({ type: "intercepted-fetch", id: `f${this.n}`, url: `${INTERACT}?configId=${DS}`, method: "POST", headers: { "content-type": "application/json" }, body });
  }
  postMessage(m) {
    this.messages.push(m);
    if (m.type === "init") {
      this.vector = m.consent;
      setTimeout(() => { this.emit({ type: "phase", name: "install" }); this.emit({ type: "phase", name: "configured" }); }, 0);
    } else if (m.type === "event") {
      if (shapeAlloyBoot(this.vector).defaultConsent === "pending") this.queue.push(m.event);
      else if (Worker.holdDisplays && m.event.params && m.event.params.documentUnloading) this.held.push(m.event);
      else {
        setTimeout(() => {
          this.fire(Worker.body(m.event));
          if (Worker.decide && !(m.event.params && m.event.params.documentUnloading)) this.emit({ type: "decisions", decisions: Worker.decide });
        }, 0);
      }
    } else if (m.type === "setConsent") {
      this.vector = { ...(this.vector || {}), ...m.consent };
      if (shapeAlloyBoot(this.vector).setConsentOptions?.consent[0].value.collect.val === "y") {
        for (const q of this.queue.splice(0)) setTimeout(() => this.fire(Worker.body(q)), 0);
      }
    } else if (m.type === "intercepted-fetch-response") {
      setTimeout(() => this.emit({ type: "result", summary: { booted: true }, ready: [] }), 0);
    }
  }
}
const defaultBody = (event) => (event && event.params && event.params.documentUnloading ? JSON.stringify(event.params.xdm) : "{}");
Worker.body = defaultBody;

const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const view = (name) => ({ event: "page_view", page_location: "https://site/p", xdm: { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name, viewName: name } } } });
const sentEvents = (worker) => worker.messages.filter((m) => m.type === "event").map((m) => m.event);
const isDisplay = (e) => !!(e.params && e.params.documentUnloading);
let responseBody;
let replaced;

beforeEach(() => {
  replaced = [];
  responseBody = "{}";
  Worker.body = defaultBody;
  Worker.holdDisplays = false;
  Worker.decide = null;
  vi.stubGlobal("Worker", Worker);
  vi.stubGlobal("window", { location: { replace: (u) => replaced.push(u) } });
  vi.stubGlobal("document", { cookie: "", querySelectorAll: () => [], addEventListener() {}, removeEventListener() {}, documentElement: { appendChild() {} }, createElement: () => ({ remove() {} }) });
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => responseBody })));
});
afterEach(() => vi.unstubAllGlobals());

const boot = async (extra = {}) => {
  const diags = [];
  const handle = await bootAlloy(entry({ onDiagnostic: (d) => diags.push(d), redirectDisplayTimeoutMs: 5000, ...extra }));
  return { handle, diags, worker: Worker.last };
};

describe("064-28 pump ordering (hermetic)", () => {
  it("a redirect display queued while a page event waits goes out before that page event", async () => {
    const { handle, worker } = await boot({ consent: GRANTED });
    handle.push(view("a"));
    handle.push(view("b"));
    await handle.applyPropositions({ propositions: [REDIRECT] });
    await tick(150);
    const sent = sentEvents(worker);
    expect(sent.map((e) => (isDisplay(e) ? "display" : e.params.xdm.web.webPageDetails.name))).toEqual(["a", "display", "b"]);
  });

  it("when the consent ring overflows on the redirect display's own enqueue, the oldest held event is dropped and the display is kept", async () => {
    const { handle, diags, worker } = await boot();
    for (let i = 0; i <= MAX_HELD_BEACONS; i++) handle.push(view(`p${i}`));
    await handle.applyPropositions({ propositions: [REDIRECT] });
    expect(diags.filter((d) => d.kind === "consent" && d.disposition === "dropped")).toHaveLength(1);
    handle.setConsent(GRANTED);
    await tick(300);
    expect(sentEvents(worker).some(isDisplay)).toBe(true);
    expect(sentEvents(worker).some((e) => !isDisplay(e) && e.params.xdm.web.webPageDetails.name === "p1")).toBe(false);
  });

  it("a push naming a cached view that does not redirect is still sent while an earlier redirect is under way", async () => {
    Worker.body = () => JSON.stringify({ events: [{ query: { personalization: {} } }] });
    const { handle, worker } = await boot({ consent: GRANTED });
    responseBody = JSON.stringify({ handle: [{ type: "personalization:decisions", payload: [CART] }] });
    handle.push(view("home"));
    await tick(150);
    await handle.applyPropositions({ propositions: [REDIRECT] });
    const before = sentEvents(worker).length;
    handle.push(view("cart"));
    await tick(150);
    expect(sentEvents(worker).length).toBeGreaterThan(before);
    expect(sentEvents(worker).some((e) => !isDisplay(e) && e.params.xdm.web.webPageDetails.name === "cart")).toBe(true);
  });
});

describe("064-29 redirect display: track and the consent ring (hermetic)", () => {
  const stubPrehiding = () => {
    const styles = new Map();
    vi.stubGlobal("document", {
      cookie: "", querySelectorAll: () => [], addEventListener() {}, removeEventListener() {}, documentElement: { appendChild() {} }, head: { appendChild: (el) => styles.set(el.id, el) },
      createElement: () => { const el = { remove() { styles.delete(el.id); } }; return el; }, getElementById: (id) => styles.get(id) || null,
    });
    return styles;
  };

  it("AC3: an answer that starts a redirect keeps its delivery pending until the display's send is issued", async () => {
    const styles = stubPrehiding();
    Worker.holdDisplays = true;
    Worker.decide = [{ scope: "__view__", content: REDIRECT }];
    const { handle, worker } = await boot({ consent: GRANTED, prehidingStyle: "body{opacity:0}" });
    handle.push(view("a"));
    await tick(150);
    expect(worker.held).toHaveLength(1);
    // The event is answered, but its delivery (the redirect's display) has not left, so the pump has not finished it.
    expect(styles.has("alloy-prehiding")).toBe(true);
    worker.release();
    await tick(150);
    expect(styles.has("alloy-prehiding")).toBe(false);
  });

  it("AC4: a later enqueue drops the oldest held page event, not the redirect display queued at the front", async () => {
    const { handle, diags, worker } = await boot();
    for (let i = 0; i <= MAX_HELD_BEACONS; i++) handle.push(view(`p${i}`));
    await handle.applyPropositions({ propositions: [REDIRECT] });
    handle.push(view("late"));
    expect(diags.filter((d) => d.kind === "consent" && d.disposition === "dropped")).toHaveLength(2);
    handle.setConsent(GRANTED);
    const namesNow = () => sentEvents(worker).map((e) => (isDisplay(e) ? "display" : e.params.xdm.web.webPageDetails.name));
    await vi.waitFor(() => expect(namesNow()).toContain("late"), { timeout: 8000 });
    const names = namesNow();
    expect(names).toContain("display");
    expect(names).not.toContain("p1");
    expect(names).not.toContain("p2");
  });

  it("AC4: a redirect display the ring drops settles redirectDisplay, not only the renderer timer", async () => {
    vi.stubGlobal("window", { location: { replace: () => { throw new Error("blocked"); } } });
    const { handle, diags } = await boot({ redirectDisplayTimeoutMs: 1 });
    handle.push(view("p0"));
    for (let i = 0; i <= MAX_HELD_BEACONS; i++) {
      await handle.applyPropositions({ propositions: [{ ...REDIRECT, id: `rp${i}` }] });
      await tick(3);
    }
    const dropped = diags.filter((d) => d.disposition === "redirect-display-failed" && /dropped by the consent hold ring/.test(d.reason));
    expect(dropped.length).toBeGreaterThan(0);
  }, 20000);

  it("round 1: a page-supplied viewCacheWarm never reaches the chamber, even on a notification-shaped event", async () => {
    const { handle, worker } = await boot({ consent: GRANTED });
    handle.push({ event: "x", viewCacheWarm: true, xdm: { eventType: "decisioning.propositionDisplay" } });
    handle.push({ ...view("a"), viewCacheWarm: true });
    await tick(100);
    for (const e of sentEvents(worker)) expect(e.params).not.toHaveProperty("viewCacheWarm");
  });

  // 064-32 round 5 (owner decision): this test pinned the 064-29 order, a push held behind the redirect display of an in-flight
  // applyResponse. Pinned stock 2.31.1 sends a push called right after an unawaited apply first and the display after it
  // (real-Chromium differential in adobe-b4-personalization.test.js), so the expectation is reversed here, not dropped.
  it("064-32 round 5: a push called behind an in-flight applyResponse is sent before the redirect display that apply queues, as stock", async () => {
    const { handle, worker } = await boot({ consent: GRANTED, redirectTimeoutMs: 5000 });
    await tick(20);
    const applied = handle.command("applyResponse", { responseBody: {}, renderDecisions: true });
    await tick(20);
    handle.push(view("a"));
    const cmd = worker.messages.find((m) => m.type === "command");
    worker.emit({ type: "command-result", id: cmd.id, result: { propositions: [REDIRECT] } });
    await tick(300);
    const sent = sentEvents(worker);
    expect(sent.filter((e) => !isDisplay(e)).length).toBe(1);
    expect(sent.findIndex(isDisplay)).toBeGreaterThan(0);
    await applied;
  });

});

describe("064-32 call order decides whether a push sees the applied cache (hermetic)", () => {
  it("AC5: a push queued before an applyResponse call runs cold even after the apply finished; one queued after runs warm", async () => {
    const { handle, worker } = await boot();
    handle.push(view("p0"));
    handle.push(view("p1"));
    await tick(20);
    const applied = handle.command("applyResponse", { responseBody: { handle: [] }, renderDecisions: false });
    handle.push(view("p2"));
    await tick(20);
    const cmd = worker.messages.find((m) => m.type === "command");
    worker.emit({ type: "command-result", id: cmd.id, result: { propositions: [] } });
    await applied;
    handle.setConsent(GRANTED);
    await tick(300);
    // The fake worker answers no fetch, so p1 stays cold; with a real Edge, p0's fetch would warm p1 (the rule is `fetchCount() > 0`).
    const warm = Object.fromEntries(sentEvents(worker).filter((e) => !isDisplay(e)).map((e) => [e.params.xdm.web.webPageDetails.name, e.params.viewCacheWarm === true]));
    expect(warm).toEqual({ p0: false, p1: false, p2: true });
    const cold = Object.fromEntries(sentEvents(worker).filter((e) => !isDisplay(e)).map((e) => [e.params.xdm.web.webPageDetails.name, e.params.viewCacheCold === true]));
    expect(cold).toEqual({ p0: false, p1: true, p2: false });
  });
});
