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
  constructor() { this.handlers = []; this.messages = []; this.queue = []; this.vector = null; this.n = 0; this.held = []; this.heldPushes = []; this.silent = new Set(); Worker.last = this; }
  addEventListener(t, fn) { if (t === "message") this.handlers.push(fn); }
  removeEventListener() {}
  terminate() {}
  release() { for (const e of this.held.splice(0)) this.fire(Worker.body(e)); }
  emit(msg) { for (const h of this.handlers.slice()) h({ data: msg }); }
  fire(body, silent = false) {
    this.n += 1;
    if (silent) this.silent.add(`f${this.n}`);
    this.emit({ type: "intercepted-fetch", id: `f${this.n}`, url: `${INTERACT}?configId=${DS}`, method: "POST", headers: { "content-type": "application/json" }, body });
  }
  postMessage(m) {
    this.messages.push(m);
    if (m.type === "init") {
      this.vector = m.consent;
      setTimeout(() => { this.emit({ type: "phase", name: "install" }); this.emit({ type: "phase", name: "configured" }); }, 0);
    } else if (m.type === "event") {
      if (shapeAlloyBoot(this.vector).defaultConsent === "pending") this.queue.push(m.event);
      else if (Worker.deferDisplays && m.event.params && m.event.params.documentUnloading) {
        // The chamber answers the display event before its request leaves, so the pump moves on while that request is still pending.
        this.held.push(m.event);
        setTimeout(() => this.emit({ type: "result", summary: { booted: true }, ready: [] }), 0);
      } else if (Worker.holdPushes && !(m.event.params && m.event.params.xdm && m.event.params.xdm.eventType === "decisioning.propositionDisplay")) {
        // Request held, as a push whose worker round trip is still running.
        this.heldPushes.push(m.event);
        // A documentUnloading push settles before its request leaves.
        if (Worker.settleHeld && m.event.params && m.event.params.documentUnloading) setTimeout(() => this.emit({ type: "result", summary: { booted: true }, ready: [] }), 0);
      } else if (Worker.holdDisplays && m.event.params && m.event.params.documentUnloading) this.held.push(m.event);
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
      if (!this.silent.has(m.id)) setTimeout(() => this.emit({ type: "result", summary: { booted: true }, ready: [] }), 0);
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
  Worker.deferDisplays = false;
  Worker.holdPushes = false;
  Worker.settleHeld = false;
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

describe("064-32 round 7: a rejected apply is not counted and a failed store does not warm (hermetic)", () => {
  const names = (worker) => Object.fromEntries(sentEvents(worker).filter((e) => !isDisplay(e)).map((e) => [e.params.xdm.web.webPageDetails.name, e.params]));

  it("a push queued before a rejected applyResponse is not marked cold by it", async () => {
    // Consent is pending, so p0 stays queued while the rejected apply is called; an accepted apply would make it cold (064-32).
    const { handle, worker } = await boot();
    handle.push(view("p0"));
    handle.push(view("p1"));
    await tick(20);
    await expect(handle.command("applyResponse", "not an object")).rejects.toThrow();
    handle.setConsent(GRANTED);
    await tick(200);
    const sent = names(worker);
    expect(sent.p1).toBeDefined();
    expect(sent.p1.viewCacheCold).not.toBe(true);
  });

  it("an applyResponse whose view-cache store throws does not warm the push called after it", async () => {
    const { handle, worker } = await boot({ consent: GRANTED });
    await tick(20);
    // The only way the store can fail on a well-formed response is a storage error, so the cache's own Map write is made to throw for one view.
    const realSet = Map.prototype.set;
    vi.spyOn(Map.prototype, "set").mockImplementation(function (key, value) { if (key === "doomed") throw new Error("store failed"); return realSet.call(this, key, value); });
    const body = { handle: [{ type: "personalization:decisions", payload: [{ id: "x", scope: "doomed", scopeDetails: { characteristics: { scopeType: "view" } }, items: [] }] }] };
    const applied = handle.command("applyResponse", { responseBody: body, renderDecisions: false });
    handle.push(view("p1"));
    await tick(20);
    const cmd = worker.messages.find((m) => m.type === "command");
    worker.emit({ type: "command-result", id: cmd.id, result: { propositions: [] } });
    await applied;
    await tick(150);
    vi.restoreAllMocks();
    expect(names(worker).p1.viewCacheWarm).not.toBe(true);
  });
});

describe("064-32 (ADR-0066): a redirect navigation waits for each queued push to settle, not for a request that looks like its own (hermetic)", () => {
  // The redirect display goes out first. The pushes are called while that display is on the wire, so they are queued when the navigation gate
  // looks. Each leaves the gate only on its own settlement (the chamber's `result` or `fatal`, which follow its request), a ring drop or dispose.
  // No request is credited to an entry: a request that matches by eventType or body proves nothing about whose it is.
  const arrange = async (pushEvents = [view("a")]) => {
    Worker.holdPushes = true;
    let pushed = false;
    let handleRef;
    vi.stubGlobal("fetch", vi.fn((url, init) => {
      if (!pushed && handleRef && String((init && init.body) || "").includes("decisioning.propositionDisplay")) { pushed = true; for (const e of pushEvents) handleRef.push(e); }
      return Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => "{}" });
    }));
    const { handle, worker } = await boot({ consent: GRANTED, redirectTimeoutMs: 5000 });
    handleRef = handle;
    const applied = handle.command("applyResponse", { responseBody: {}, renderDecisions: true });
    await vi.waitFor(() => expect(worker.messages.some((m) => m.type === "command")).toBe(true));
    worker.emit({ type: "command-result", id: worker.messages.find((m) => m.type === "command").id, result: { propositions: [REDIRECT] } });
    await vi.waitFor(() => expect(worker.heldPushes.length).toBeGreaterThan(0));
    return { worker, applied };
  };
  const settle = (worker) => worker.emit({ type: "result", summary: { booted: true }, ready: [] });
  const linkBody = JSON.stringify({ events: [{ xdm: { eventType: "web.webinteraction.linkClicks" } }] });
  const identityBody = JSON.stringify({ query: { identity: { fetch: ["ECID"] } } });
  const stamp = () => performance.now();

  it("T3: an untyped pending entry is not released by a typed events request that arrives while it is unsettled", async () => {
    const { worker, applied } = await arrange([{ event: "custom_event", page_location: "https://site/p" }]);
    worker.fire(linkBody, true);
    worker.fire(identityBody, true);
    await tick(80);
    expect(replaced).toEqual([]);
    settle(worker);
    await vi.waitFor(() => expect(replaced).toHaveLength(1), { timeout: 120 });
    await applied;
  });

  it("T2: a settled documentUnloading entry no longer holds the gate, so a same-type overlapping push releases on its own settlement", async () => {
    const unloading = { event: "unload", page_location: "https://site/p", documentUnloading: true, xdm: { eventType: "web.webinteraction.linkClicks" } };
    Worker.settleHeld = true;
    const { worker, applied } = await arrange([unloading, { event: "click", page_location: "https://site/p", xdm: { eventType: "web.webinteraction.linkClicks" } }]);
    await vi.waitFor(() => expect(worker.heldPushes).toHaveLength(2));
    await tick(60);
    expect(replaced).toEqual([]);
    const started = stamp();
    settle(worker);
    await vi.waitFor(() => expect(replaced).toHaveLength(1), { timeout: 120 });
    expect(stamp() - started).toBeLessThan(150);
    await applied;
  });

  it("T9: a late request of a retired entry cannot release a newer entry", async () => {
    const { worker, applied } = await arrange([{ event: "a", page_location: "https://site/p", xdm: { eventType: "web.webinteraction.linkClicks" } }, { event: "b", page_location: "https://site/p", xdm: { eventType: "web.webinteraction.linkClicks" } }]);
    settle(worker);
    await vi.waitFor(() => expect(worker.heldPushes).toHaveLength(2));
    worker.fire(linkBody, true);
    await tick(80);
    expect(replaced).toEqual([]);
    settle(worker);
    await vi.waitFor(() => expect(replaced).toHaveLength(1), { timeout: 120 });
    await applied;
  });

  it("T5: a completed no-request case (result with no request) releases the navigation well before the cap", async () => {
    const { worker, applied } = await arrange();
    await tick(40);
    expect(replaced).toEqual([]);
    const started = stamp();
    settle(worker);
    await vi.waitFor(() => expect(replaced).toHaveLength(1), { timeout: 120 });
    expect(stamp() - started).toBeLessThan(150);
    await applied;
  });

  it("T5: a worker fatal for the push releases the navigation before the cap", async () => {
    const { worker, applied } = await arrange();
    await tick(40);
    expect(replaced).toEqual([]);
    const started = stamp();
    worker.emit({ type: "fatal", message: "alloy failed" });
    await vi.waitFor(() => expect(replaced).toHaveLength(1), { timeout: 120 });
    expect(stamp() - started).toBeLessThan(150);
    await applied;
  });

  it("T5/T6: a push with no result and no egress (a parked fetch, or a result that never comes) leaves the existing 250 ms cap to release the navigation", async () => {
    const { applied } = await arrange();
    const fetchCalls = () => globalThis.fetch.mock.calls.length;
    const before = fetchCalls();
    const started = stamp();
    await tick(150);
    expect(replaced).toEqual([]);
    await vi.waitFor(() => expect(replaced).toHaveLength(1), { timeout: 600 });
    const waited = stamp() - started;
    expect(waited).toBeGreaterThan(200);
    expect(waited).toBeLessThan(500);
    expect(fetchCalls()).toBe(before);
    await applied;
  });
});
