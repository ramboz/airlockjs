import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bootAlloy, createAlloyCommandBridge } from "../adapters/eds/index.js";
import { runBeforeEventSend, stockContextXdm } from "../adapters/eds/before-event-send.js";
import { MAX_HELD_BEACONS } from "../core/airlock.js";

// Slice 069-01: the handle returns what stock returns. HERMETIC tests (a fake Worker records what the adapter posts and
// plays back chamber messages); the real-Chromium differentials against pinned stock Alloy 2.31.1 are in
// test/adobe-069-01-handle-results-chromium.test.js.
const INTERACT = "https://adobedc.demdex.net/ee/v1/interact";
const DS = "12345678-1234-1234-1234-123456789012";
const NS = "https://ns.adobe.com/personalization/";
const entry = (extra = {}) => ({ type: "alloy", bundleUrl: "https://airlock.example/alloy.js", datastreamId: DS, orgId: "ORG@AdobeOrg", ...extra });
const adobe = (value) => ({ standard: "Adobe", version: "2.0", value });
const GRANT = adobe({ collect: { val: "y" }, personalize: { content: { val: "y" } } });
const REFUSAL = adobe({ collect: { val: "n" }, personalize: { content: { val: "n" } } });
const OPEN = { analytics_storage: "granted", personalization: "granted" };
const json = (id, scope) => ({ id, scope, scopeDetails: { decisionProvider: "TGT", activity: { id: `act-${id}` } }, items: [{ id: `${id}-i`, schema: `${NS}json-content-item`, data: { content: { a: 1 } } }] });

class Worker {
  constructor() { this.handlers = []; this.messages = []; this.n = 0; this.answers = []; Worker.last = this; }
  addEventListener(t, fn) { if (t === "message") this.handlers.push(fn); }
  removeEventListener(t, fn) { this.handlers = this.handlers.filter((h) => h !== fn); }
  terminate() { this.terminated = true; }
  emit(msg) { for (const h of this.handlers.slice()) h({ data: msg }); }
  fire() {
    this.n += 1;
    this.emit({ type: "intercepted-fetch", id: `f${this.n}`, url: `${INTERACT}?configId=${DS}`, method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  }
  postMessage(m) {
    this.messages.push(m);
    if (m.type === "init") setTimeout(() => { this.emit({ type: "phase", name: "install" }); this.emit({ type: "phase", name: "configured" }); }, 0);
    if (m.type === "event") {
      // The next scripted answer: decisions the chamber delivers, then the result summary.
      const a = this.answers.shift() || {};
      const answer = () => {
        if (a.decisions) this.emit({ type: "decisions", decisions: a.decisions });
        this.emit({ type: "result", summary: { booted: true, dropped: a.dropped || [] }, ready: [] });
      };
      // A gated answer needs the interact to pass the seal first (a held one is parked with no response).
      if (a.gate) this.pendingAnswer = answer;
      else setTimeout(answer, 0);
      if (a.gate) this.fire();
    }
    if (m.type === "intercepted-fetch-response" && m.status !== 0 && this.pendingAnswer) {
      const f = this.pendingAnswer; this.pendingAnswer = null; setTimeout(f, 0);
    }
  }
}

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
beforeEach(() => {
  vi.stubGlobal("Worker", Worker);
  vi.stubGlobal("window", {});
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => "{}" })));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const boot = async (extra = {}) => {
  const diags = [];
  const handle = await bootAlloy(entry({ onDiagnostic: (d) => diags.push(d), ...extra }));
  return { handle, diags, worker: Worker.last };
};
const types = (worker) => worker.messages.map((m) => m.type);
const sent = (worker) => worker.messages.filter((m) => m.type === "event");
const BOX = { placements: [{ scope: "__view__", selector: "#v", minHeight: 0 }] };

describe("069-01 AC1: handle.sendEvent resolves the interact result", () => {
  it("resolves { propositions, decisions } from the event's own deliveries, with renderAttempted false for what was not rendered", async () => {
    const { handle, worker } = await boot({ consent: OPEN, ...BOX, onDecisions: () => {} });
    worker.answers.push({ decisions: [{ scope: "banner", content: json("b1", "banner") }] });
    const r = await handle.sendEvent({ xdm: { eventType: "web.webpagedetails.pageViews" }, renderDecisions: false });
    expect(r.propositions).toEqual([{ ...json("b1", "banner"), renderAttempted: false }]);
    expect(r.decisions).toEqual([json("b1", "banner")]);
  });

  it("is built from the main thread's deliveries, not from the chamber's result summary", async () => {
    const { handle, worker } = await boot({ consent: OPEN, ...BOX, onDecisions: () => {} });
    worker.answers.push({ dropped: [] });
    const r = await handle.sendEvent({ xdm: {} });
    expect(r).toEqual({ propositions: [], decisions: [] });
  });

  it("uses the same queue as push: order is kept and each event settles on its own result", async () => {
    const { handle, worker } = await boot({ consent: OPEN, ...BOX, onDecisions: () => {} });
    worker.answers.push({ decisions: [{ scope: "a", content: json("a1", "a") }] }, { decisions: [{ scope: "b", content: json("b1", "b") }] });
    handle.push({ event: "page_view", xdm: { n: 1 } });
    const second = await handle.sendEvent({ xdm: { n: 2 } });
    expect(sent(worker).map((m) => m.event.params.xdm.n)).toEqual([1, 2]);
    expect(second.propositions.map((p) => p.id)).toEqual(["b1"]);
  });

  it("resolves empty arrays when personalization is not configured (no caps.decisions to collect from)", async () => {
    const { handle, worker, diags } = await boot({ consent: OPEN });
    worker.answers.push({ decisions: [{ scope: "a", content: json("a1", "a") }] });
    expect(await handle.sendEvent({ xdm: {} })).toEqual({ propositions: [], decisions: [] });
    expect(diags.filter((d) => d.kind === "decisions")).toEqual([]);
  });

  it("rejects with a plain Error carrying the chamber's reason when the command failed", async () => {
    const { handle, worker } = await boot({ consent: OPEN, ...BOX, onDecisions: () => {} });
    worker.answers.push({ dropped: [{ reason: "The server responded with a status code 400" }] });
    const err = await handle.sendEvent({ xdm: {} }).then(() => null, (e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("The server responded with a status code 400");
  });

  it("a push held at the seal stays pending, sends nothing, and settles once consent releases it", async () => {
    const { handle, worker } = await boot({ ...BOX, onDecisions: () => {} });
    worker.answers.push({ gate: true, decisions: [{ scope: "a", content: json("a1", "a") }] });
    let settled = null;
    const p = handle.sendEvent({ xdm: {} }).then((v) => { settled = v; return v; });
    await tick(60);
    expect(settled).toBeNull();
    handle.setConsent(OPEN);
    const r = await p;
    expect(r.propositions.map((x) => x.id)).toEqual(["a1"]);
  });

  it("an event the ring drops resolves {} and a dispose settles every pending send with {}", async () => {
    const { handle, worker } = await boot({ ...BOX, onDecisions: () => {} });
    worker.answers.push({ gate: true });
    const all = Array.from({ length: MAX_HELD_BEACONS + 5 }, () => handle.sendEvent({ xdm: {} }));
    await tick(20);
    // The first is in flight (held at the seal); the oldest waiting ones were dropped by the ring.
    expect(await all[1]).toEqual({});
    handle.dispose();
    const rest = await Promise.all(all.slice(2));
    expect(rest.every((v) => JSON.stringify(v) === "{}")).toBe(true);
    expect(await all[0]).toEqual({});
  });
});

// A fake page element and document: setText rendering needs only these.
const fakeDom = () => {
  const el = { nodeType: 1, tagName: "DIV", textContent: "orig", parentNode: null, getAttribute: () => null, setAttribute() {} };
  const document = { querySelectorAll: (sel) => (sel === "#t" ? [el] : []), documentElement: { appendChild() {} }, createElement: () => ({ remove() {} }), getElementById: () => null };
  return { el, document };
};
const textView = (id, scope, text) => ({ id, scope, scopeDetails: { decisionProvider: "TGT", activity: { id: `act-${id}` }, characteristics: { scopeType: "view" } }, items: [{ id: `${id}-i`, schema: `${NS}dom-action`, data: { type: "setText", selector: "#t", content: text } }] });

describe("069-01 AC1: a grant inside stock's eager timeout renders the propositions", () => {
  it("a held sendEvent sends and renders nothing until consent is granted, then renders and resolves the propositions", async () => {
    const { el, document } = fakeDom();
    vi.stubGlobal("document", document);
    const { handle, worker } = await boot({ onDecisions: () => {} });
    const pageWide = { id: "pw", scope: "__view__", scopeDetails: { decisionProvider: "TGT", activity: { id: "act-pw" }, characteristics: { eventToken: "t" } }, items: [{ id: "pw-i", schema: `${NS}dom-action`, data: { type: "setText", selector: "#t", content: "personalized" } }] };
    worker.answers.push({ gate: true, decisions: [{ scope: "__view__", content: pageWide }] });
    const p = handle.sendEvent({ xdm: {} });
    await tick(60); // well inside the 1000 ms stock waits
    expect(fetch).not.toHaveBeenCalled();
    expect(el.textContent).toBe("orig");
    handle.setConsent(OPEN);
    const r = await p;
    expect(el.textContent).toBe("personalized");
    expect(r.propositions.map((x) => [x.id, x.renderAttempted])).toEqual([["pw", true]]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("069-01 settle: the sendEvent promise always settles", () => {
  it("a failure while finishing the event rejects the promise instead of hanging it, and the queue keeps going", async () => {
    let armed = false;
    vi.stubGlobal("document", { getElementById: () => { if (armed) throw new Error("settle boom"); return null; }, createElement: () => ({}), documentElement: { appendChild() {} } });
    const { handle, worker } = await boot({ consent: OPEN, prehidingStyle: "body{opacity:0}", prehidingTimeoutMs: 600000 });
    worker.answers.push({}, {});
    armed = true;
    const err = await Promise.race([handle.sendEvent({ xdm: {} }).then(() => null, (e) => e), tick(1500).then(() => "hung")]);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("settle boom");
    expect(await Promise.race([handle.sendEvent({ xdm: {} }).then(() => "settled", () => "settled"), tick(1500).then(() => "hung")])).toBe("settled");
  });
});

describe("069-01 AC4: handle.applyPropositions({ viewName })", () => {
  it("an unknown view resolves no propositions and sends no request", async () => {
    const { handle, worker } = await boot({ consent: OPEN, ...BOX, onDecisions: () => {} });
    const before = worker.messages.length;
    expect(await handle.applyPropositions({ viewName: "nope" })).toEqual({ propositions: [] });
    expect(worker.messages.length).toBe(before);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("the bare { viewName } on a warm view cache renders that view and resolves { propositions } without a request", async () => {
    const { el, document } = fakeDom();
    vi.stubGlobal("document", document);
    fetch.mockImplementation(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => JSON.stringify({ handle: [{ type: "personalization:decisions", payload: [textView("v-home", "home", "home view")] }] }) }));
    const { handle, worker } = await boot({ consent: OPEN, ...BOX, onDecisions: () => {} });
    // A personalization fetch warms the cache (its answer carries the view proposition).
    worker.emit({ type: "intercepted-fetch", id: "w1", url: `${INTERACT}?configId=${DS}`, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ events: [{ query: { personalization: { decisionScopes: [] } } }] }) });
    await tick(60);
    expect(el.textContent).toBe("orig");
    const calls = fetch.mock.calls.length;
    const out = await handle.applyPropositions({ viewName: "home" });
    expect(el.textContent).toBe("home view");
    expect(out.propositions.map((p) => [p.id, p.renderAttempted])).toEqual([["v-home", true]]);
    expect(fetch.mock.calls.length).toBe(calls);
  });

  it("keeps the { propositions, metadata } form working", async () => {
    const { handle } = await boot({ consent: OPEN, ...BOX, onDecisions: () => {} });
    const out = await handle.applyPropositions({ propositions: [json("j", "banner")] });
    expect(out.propositions).toHaveLength(1);
  });
});

describe("069-01 AC5: handle.setAdobeConsent returns Alloy's outcome", () => {
  const ids = (worker) => worker.messages.filter((m) => m.type === "adobeConsent").map((m) => m.id);

  it("resolves when the chamber reports Alloy's setConsent resolved and rejects with its message when it rejected", async () => {
    const { handle, worker } = await boot();
    const ok = handle.setAdobeConsent([GRANT]);
    worker.emit({ type: "consent-outcome", id: ids(worker)[0], ok: true });
    await expect(ok).resolves.toEqual({});
    const bad = handle.setAdobeConsent([REFUSAL]);
    worker.emit({ type: "consent-outcome", id: ids(worker)[1], ok: false, message: "The server responded with a status code 400" });
    await expect(bad).rejects.toThrow("The server responded with a status code 400");
    await expect(bad).rejects.toBeInstanceOf(Error);
  });

  it("a forged outcome (wrong id, a second answer, or a made-up message) never changes the consent vector or the seal", async () => {
    const { handle, worker } = await boot();
    const refusal = handle.setAdobeConsent([REFUSAL]);
    refusal.catch(() => {});
    worker.fire();
    await tick(40);
    expect(fetch).not.toHaveBeenCalled(); // the seal holds the refusal
    // A chamber trying to open the seal by claiming success, with a made-up id and with the real one.
    worker.emit({ type: "consent-outcome", id: 999, ok: true });
    worker.emit({ type: "consent-outcome", id: ids(worker)[0], ok: true, vector: OPEN, consent: OPEN });
    await refusal;
    worker.emit({ type: "consent-outcome", id: ids(worker)[0], ok: false, message: "second" });
    worker.fire();
    await tick(60);
    expect(fetch).not.toHaveBeenCalled();
    expect(types(worker).filter((t) => t === "setConsent")).toHaveLength(1);
    // And a forged reject never revokes a grant: the seal still decides from the vector derived in the call.
    const grant = handle.setAdobeConsent([GRANT]);
    worker.emit({ type: "consent-outcome", id: ids(worker)[1], ok: false, message: "forged" });
    await expect(grant).rejects.toThrow("forged");
    worker.fire();
    await tick(80);
    expect(fetch).toHaveBeenCalled();
  });

  it("is bounded: a silent chamber rejects after the timeout", async () => {
    vi.useFakeTimers();
    const { handle } = await (async () => { const b = boot(); await vi.advanceTimersByTimeAsync(5); return b; })();
    const p = handle.setAdobeConsent([GRANT]);
    const seen = p.then(() => "resolved", (e) => e.message);
    await vi.advanceTimersByTimeAsync(11000);
    expect(await seen).toMatch(/did not answer setConsent/);
  });

  it("a dispose settles it (rejects) and the entry is gone", async () => {
    const { handle, worker } = await boot();
    const listeners = worker.handlers.length;
    const p = handle.setAdobeConsent([GRANT]);
    const id = worker.messages.find((m) => m.type === "adobeConsent").id;
    handle.dispose();
    await expect(p).rejects.toThrow(/disposed/);
    expect(worker.handlers.length).toBe(listeners - 1);
    expect(() => worker.emit({ type: "consent-outcome", id, ok: true })).not.toThrow();
    await expect(handle.setAdobeConsent([GRANT])).rejects.toThrow(/disposed/);
  });

  it("with no consent ref (consentHold:false, no consent) resolves with no Alloy call and posts nothing", async () => {
    const { handle, worker } = await boot({ consentHold: false });
    const before = worker.messages.length;
    await expect(handle.setAdobeConsent([GRANT])).resolves.toEqual({});
    expect(worker.messages.length).toBe(before);
  });

  it("the vector-shaped fallback settles on return (no object to answer for) and still applies the vector", async () => {
    const { handle, worker } = await boot();
    await expect(handle.setAdobeConsent([{ standard: "IAB TCF", version: "2.0", value: "x" }, REFUSAL])).resolves.toEqual({});
    expect(types(worker)).not.toContain("adobeConsent");
    expect(types(worker)).toContain("setConsent");
  });

  it("handle.setConsent(vector) is unchanged: it posts only the vector message and returns nothing", async () => {
    const { handle, worker } = await boot();
    const before = worker.messages.length;
    expect(handle.setConsent(OPEN)).toBeUndefined();
    expect(types(worker).slice(before)).toEqual(["setConsent"]);
  });
});

describe("069-01 AC5: the chamber's outcome message (real worker file)", () => {
  let fakeSelf;
  let alloy;
  const send = (m) => fakeSelf.onmessage({ data: m });
  const outcomes = () => fakeSelf.postMessage.mock.calls.map(([m]) => m).filter((m) => m.type === "consent-outcome");
  beforeEach(async () => {
    alloy = vi.fn(() => Promise.resolve({}));
    fakeSelf = { postMessage: vi.fn(), alloy, fetch: vi.fn() };
    globalThis.self = fakeSelf;
    vi.resetModules();
    await import("../connectors/alloy/alloy-chamber.worker.js");
  });
  afterEach(() => { delete globalThis.self; });

  it("reports ok when Alloy's setConsent resolved", async () => {
    send({ type: "adobeConsent", id: 7, consent: [GRANT] });
    send({ type: "setConsent", consent: OPEN });
    await tick(10);
    expect(outcomes()).toEqual([{ type: "consent-outcome", id: 7, ok: true }]);
  });

  it("reports Alloy's own message when it rejected the object", async () => {
    alloy.mockImplementation(() => Promise.reject(new Error("invalid consent")));
    send({ type: "adobeConsent", id: 8, consent: [GRANT] });
    send({ type: "setConsent", consent: OPEN });
    await tick(10);
    expect(outcomes()).toEqual([{ type: "consent-outcome", id: 8, ok: false, message: "invalid consent" }]);
  });

  it("reports a rejection (ADR-0064 point 5) when analytics_storage is still pending and Alloy is not called", async () => {
    send({ type: "adobeConsent", id: 9, consent: [GRANT] });
    send({ type: "setConsent", consent: { personalization: "granted" } });
    await tick(10);
    expect(alloy).not.toHaveBeenCalled();
    expect(outcomes()).toEqual([{ type: "consent-outcome", id: 9, ok: false, message: expect.stringMatching(/still pending/) }]);
  });

  it("says Alloy is not loaded (not that consent is pending) when the vector is resolved but Alloy is absent", async () => {
    delete fakeSelf.alloy;
    send({ type: "adobeConsent", id: 10, consent: [GRANT] });
    send({ type: "setConsent", consent: OPEN });
    await tick(10);
    expect(outcomes()).toEqual([{ type: "consent-outcome", id: 10, ok: false, message: expect.stringMatching(/Alloy is not loaded/) }]);
  });

  it("reports the object's own rejection, not the retry's, when the vector retry also fails", async () => {
    alloy.mockImplementation((_c, o) => Promise.reject(new Error(o.consent ? "object rejected" : "retry rejected")));
    send({ type: "adobeConsent", id: 11, consent: [GRANT] });
    send({ type: "setConsent", consent: OPEN });
    await tick(10);
    expect(alloy).toHaveBeenCalledTimes(2);
    expect(outcomes()).toEqual([{ type: "consent-outcome", id: 11, ok: false, message: "object rejected" }]);
  });

  it("a vector-only message reports nothing", async () => {
    send({ type: "setConsent", consent: OPEN });
    await tick(10);
    expect(outcomes()).toEqual([]);
  });
});

describe("069-01 AC7: a disposed handle", () => {
  it("resolves {} (setAdobeConsent rejects) and sends nothing", async () => {
    const { handle, worker } = await boot({ consent: OPEN, ...BOX, onDecisions: () => {} });
    handle.dispose();
    const before = worker.messages.length;
    expect(await handle.sendEvent({ xdm: {} })).toEqual({});
    expect(await handle.applyPropositions({ viewName: "home" })).toEqual({});
    await expect(handle.setAdobeConsent([GRANT])).rejects.toThrow(/disposed/);
    expect(worker.messages.length).toBe(before);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("none of the new methods reads or writes a page global", async () => {
    const { handle, worker } = await boot({ consent: OPEN, ...BOX, onDecisions: () => {} });
    const reads = [];
    const sentinel = new Proxy({}, { get: (_t, k) => { reads.push(String(k)); return undefined; }, set: (_t, k) => { reads.push(`set ${String(k)}`); return true; }, has: (_t, k) => { reads.push(`has ${String(k)}`); return false; } });
    const keys = Object.keys(globalThis).sort();
    vi.stubGlobal("alloy", sentinel);
    vi.stubGlobal("adobeDataLayer", sentinel);
    worker.answers.push({ decisions: [{ scope: "banner", content: json("b", "banner") }] });
    await handle.sendEvent({ xdm: {} });
    await handle.applyPropositions({ viewName: "home" });
    const p = handle.setAdobeConsent([GRANT]);
    worker.emit({ type: "consent-outcome", id: worker.messages.find((m) => m.type === "adobeConsent").id, ok: true });
    await p;
    expect(reads).toEqual([]);
    vi.unstubAllGlobals();
    vi.stubGlobal("window", {});
    expect(Object.keys(globalThis).sort().filter((k) => !keys.includes(k))).toEqual([]);
  });
});

describe("069-01 AC2/AC3: the shared onBeforeEventSend helper", () => {
  const CONTEXT = { web: { url: "https://p.example/a", referrer: "" }, device: { screenWidth: 1, screenHeight: 2, screenOrientation: "landscape-primary" }, environment: { viewportWidth: 3, viewportHeight: 4 }, placeContext: { localTime: "2026-11-22T10:00:00.000+01:00", timezoneOffset: -60 } };

  it("builds the context as plain data", () => {
    const xdm = stockContextXdm(CONTEXT);
    expect(xdm.web).toEqual({ webPageDetails: { URL: "https://p.example/a" }, webReferrer: { URL: "" } });
    expect(xdm.device).toEqual({ screenWidth: 1, screenHeight: 2, screenOrientation: "landscape" });
    expect(xdm.environment).toEqual({ type: "browser", browserDetails: { viewportWidth: 3, viewportHeight: 4 } });
    expect(xdm.placeContext).toEqual({ localTime: "2026-11-22T10:00:00.000+01:00", localTimezoneOffset: -60 });
    expect(xdm.implementationDetails.environment).toBe("browser");
    expect(JSON.parse(JSON.stringify(xdm))).toEqual(xdm);
  });

  it("the hook sees the page's xdm with the context merged in, and data defaulting to {}", () => {
    let seen;
    runBeforeEventSend({ xdm: { eventType: "x", web: { webPageDetails: { name: "n" } } } }, { hook: (c) => { seen = JSON.parse(JSON.stringify(c)); }, context: CONTEXT });
    expect(seen.xdm.web.webPageDetails).toEqual({ name: "n", URL: "https://p.example/a" });
    expect(seen.xdm.device.screenWidth).toBe(1);
    expect(seen.xdm.eventType).toBe("x");
    expect(seen.data).toEqual({});
  });

  it("the page's own value wins over the context, as in stock", () => {
    let seen;
    runBeforeEventSend({ xdm: { web: { webPageDetails: { URL: "https://page.example/" } } } }, { hook: (c) => { seen = c; }, context: CONTEXT });
    expect(seen.xdm.web.webPageDetails.URL).toBe("https://page.example/");
  });

  it("an edit to a context field survives; an untouched context field is left for the chamber's Alloy to fill", () => {
    const out = runBeforeEventSend({ xdm: { eventType: "x" }, data: { k: 1 } }, { hook: (c) => { c.xdm.web.webPageDetails.URL = "https://edited.example/"; c.xdm.device.screenWidth = 99; c.data.added = true; }, context: CONTEXT });
    expect(out.dropped).toBe(false);
    expect(out.xdm.web.webPageDetails).toEqual({ URL: "https://edited.example/" });
    expect(out.xdm.device).toEqual({ screenWidth: 99 });
    expect(out.xdm.environment).toBeUndefined();
    expect(out.xdm.placeContext).toBeUndefined();
    expect(out.xdm.eventType).toBe("x");
    expect(out.data).toEqual({ k: 1, added: true });
  });

  it("a hook that changes nothing yields exactly the page's own event", () => {
    const out = runBeforeEventSend({ xdm: { eventType: "x" } }, { hook: () => {}, context: CONTEXT });
    expect(out).toEqual({ dropped: false, xdm: { eventType: "x" } });
  });

  it("a hook returning false drops the event; a throwing hook drops it with a hook-threw diagnostic", () => {
    const diags = [];
    expect(runBeforeEventSend({ xdm: {} }, { hook: () => false, context: CONTEXT }).dropped).toBe(true);
    expect(runBeforeEventSend({ xdm: {} }, { hook: () => { throw new Error("boom"); }, context: CONTEXT, diagnose: (d) => diags.push(d) }).dropped).toBe(true);
    expect(diags).toEqual([expect.objectContaining({ kind: "hook-threw", option: "onBeforeEventSend", reason: expect.stringContaining("boom") })]);
  });

  it("the wrapper sends the event with the hook's edits and drops a throwing hook's event", async () => {
    const handle = { push: vi.fn(), sendEvent: vi.fn(() => Promise.resolve({ propositions: [1], decisions: [] })), setConsent: vi.fn(), applyPropositions: vi.fn(), command: vi.fn() };
    const diags = [];
    const alloy = createAlloyCommandBridge(handle, { onDiagnostic: (d) => diags.push(d), getContext: () => CONTEXT });
    await alloy("configure", { onBeforeEventSend: (c) => { c.xdm.web.webPageDetails.URL = "https://edited.example/"; } });
    expect(await alloy("sendEvent", { xdm: { eventType: "x" } })).toEqual({ propositions: [1], decisions: [] });
    expect(handle.sendEvent.mock.calls[0][0].xdm.web.webPageDetails.URL).toBe("https://edited.example/");
    expect(handle.push).not.toHaveBeenCalled();
    await alloy("configure", { onBeforeEventSend: () => { throw new Error("boom"); } });
    handle.sendEvent.mockClear();
    await expect(alloy("sendEvent", { xdm: {} })).rejects.toThrow(/Caused by: boom/);
    expect(handle.sendEvent).not.toHaveBeenCalled();
    expect(diags.some((d) => d.kind === "hook-threw")).toBe(true);
  });

  it("a hook that throws a non-Error value rejects with that value's text, not 'undefined'", async () => {
    const handle = { push: vi.fn(), sendEvent: vi.fn(), setConsent: vi.fn(), applyPropositions: vi.fn(), command: vi.fn() };
    const diags = [];
    const alloy = createAlloyCommandBridge(handle, { onDiagnostic: (d) => diags.push(d), getContext: () => CONTEXT });
    await alloy("configure", { onBeforeEventSend: () => { throw "plain string"; } });
    await expect(alloy("sendEvent", { xdm: {} })).rejects.toThrow(/Caused by: plain string$/);
    expect(diags.find((d) => d.kind === "hook-threw").reason).toContain("plain string");
  });

  it("honours Alloy's context option: a group left out is not in the hook's argument (the three-group list aem-martech passes shows no placeContext)", async () => {
    expect(stockContextXdm(CONTEXT, ["web", "device", "environment"]).placeContext).toBeUndefined();
    expect(stockContextXdm(CONTEXT, ["web"]).device).toBeUndefined();
    expect(stockContextXdm(CONTEXT).placeContext).toBeDefined();
    const handle = { push: vi.fn(), sendEvent: vi.fn(() => Promise.resolve({})), setConsent: vi.fn(), applyPropositions: vi.fn(), command: vi.fn() };
    let seen;
    const alloy = createAlloyCommandBridge(handle, { onDiagnostic: () => {}, getContext: () => CONTEXT });
    await alloy("configure", { context: ["web", "device", "environment"], onBeforeEventSend: (c) => { seen = JSON.parse(JSON.stringify(c)); } });
    await alloy("sendEvent", { xdm: {} });
    expect(seen.xdm.placeContext).toBeUndefined();
    expect(seen.xdm.web).toBeDefined();
  });
});

describe("069-01 AC6: the wrapper resolves handle results", () => {
  it("resolves {} and pushes when the handle has no sendEvent", async () => {
    const handle = { push: vi.fn(), setConsent: vi.fn(), applyPropositions: vi.fn(), command: vi.fn() };
    const alloy = createAlloyCommandBridge(handle, { onDiagnostic: () => {} });
    expect(await alloy("sendEvent", { xdm: {} })).toEqual({});
    expect(handle.push).toHaveBeenCalledTimes(1);
  });

  it("its setConsent settles with the handle's setAdobeConsent outcome", async () => {
    const handle = { push: vi.fn(), setConsent: vi.fn(), setAdobeConsent: vi.fn(() => Promise.reject(new Error("nope"))), applyPropositions: vi.fn(), command: vi.fn() };
    const alloy = createAlloyCommandBridge(handle, { onDiagnostic: () => {} });
    await expect(alloy("setConsent", { consent: [GRANT] })).rejects.toThrow("nope");
  });
});
