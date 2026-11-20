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
  constructor() { this.handlers = []; this.messages = []; this.queue = []; this.vector = null; this.n = 0; Worker.last = this; }
  addEventListener(t, fn) { if (t === "message") this.handlers.push(fn); }
  removeEventListener() {}
  terminate() {}
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
      else setTimeout(() => this.fire(Worker.body(m.event)), 0);
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
Worker.body = () => "{}";

const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const view = (name) => ({ event: "page_view", page_location: "https://site/p", xdm: { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name, viewName: name } } } });
const sentEvents = (worker) => worker.messages.filter((m) => m.type === "event").map((m) => m.event);
const isDisplay = (e) => !!(e.params && e.params.documentUnloading);
let responseBody;
let replaced;

beforeEach(() => {
  replaced = [];
  responseBody = "{}";
  Worker.body = () => "{}";
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
