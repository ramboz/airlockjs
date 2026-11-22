import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import * as lib from "../adapters/eds/martech.js";
import { createMartech, DEFAULT_CONFIG, buildConsentObject } from "../adapters/eds/martech.js";
import { MAX_HELD_EVENTS } from "../adapters/eds/martech-datalayer.js";

// Slice 069-03 (ADR-0065): the Airlock martech library. HERMETIC tests: a mock handle (or a real `bootAlloy` over a fake
// Worker where the seal matters). The same flows against pinned stock Alloy 2.31.1 and the real `aem-martech` run in real
// Chromium in test/adobe-b5-martech.test.js (the third arm).
const DS = "12345678-1234-1234-1234-123456789012";
const CFG = { orgId: "ORG@AdobeOrg", datastreamId: DS };
const AIRLOCK = { bundleUrl: "https://airlock.example/alloy.js" };
const NS = "https://ns.adobe.com/personalization/";
const advance = (ms = 20) => vi.advanceTimersByTimeAsync(ms);
const deferred = () => { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function mockHandle(over = {}) {
  const calls = [];
  return {
    calls,
    sendEvent: vi.fn(async (e) => { calls.push(["sendEvent", e]); return { propositions: [], decisions: [] }; }),
    applyPropositions: vi.fn(async (o) => { calls.push(["applyPropositions", o]); return { propositions: [] }; }),
    command: vi.fn(async (name, options) => ({ name, options })),
    setConsent: vi.fn(),
    setAdobeConsent: vi.fn(async (c) => { calls.push(["setAdobeConsent", c]); return {}; }),
    ...over,
  };
}
function setup({ handle = mockHandle(), personalization, ...rest } = {}) {
  const diags = [];
  const m = createMartech(handle, { onDiagnostic: (d) => diags.push(d) });
  return { m, handle, diags, init: (web = {}, martech = {}) => m.initMartech({ ...CFG, ...web }, { ...(personalization === undefined ? {} : { personalization }), ...rest, ...martech }) };
}
const kinds = (diags) => diags.map((d) => d.kind);

let body;
let observers;
beforeEach(() => {
  vi.useFakeTimers();
  body = { style: {} };
  observers = [];
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", {
    prerendering: false,
    body,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  });
  vi.stubGlobal("MutationObserver", class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() { this.gone = true; } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("069-03 AC2: no page global", () => {
  it("(a) a full run never reads, writes or probes window.alloy, window.__alloyNS or the instance name", async () => {
    const trap = [];
    const names = ["alloy", "__alloyNS", "myAlloy"];
    const guard = (target) => new Proxy(target, {
      get: (t, k) => { if (names.includes(k)) trap.push(`get ${String(k)}`); return t[k]; },
      set: (t, k, v) => { if (names.includes(k)) trap.push(`set ${String(k)}`); t[k] = v; return true; },
      has: (t, k) => { if (names.includes(k)) trap.push(`has ${String(k)}`); return k in t; },
    });
    vi.stubGlobal("window", guard({}));
    for (const k of names) Object.defineProperty(globalThis, k, { configurable: true, get() { trap.push(`global ${k}`); return undefined; }, set() { trap.push(`set global ${k}`); } });
    try {
      const { m, init } = setup();
      await init({}, { alloyInstanceName: "myAlloy" });
      await m.martechEager();
      await m.martechLazy();
      await m.updateUserConsent({ collect: true, marketing: true });
      await m.sendEvent({ xdm: { eventType: "x" } });
      await m.getPersonalizationForView("v");
      await m.applyPersonalization("v");
      m.pushToDataLayer({ event: "e", xdm: {} });
      await advance();
      await m.martechDelayed();
    } finally {
      for (const k of names) delete globalThis[k];
    }
    expect(trap).toEqual([]);
  });

  it("(b-source) the module never mentions a main-thread alloy bundle, ACDL file, or window, outside comments", async () => {
    const src = (await readFile(new URL("../adapters/eds/martech.js", import.meta.url), "utf8")).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/alloy\.min\.js|acdl|importScripts|\bwindow\b|\bimport\(/);
  });

  it("alloyInstanceName other than alloy and a dataLayerUrl are diagnosed unsupported-option", async () => {
    const { init, diags } = setup();
    await init({}, { alloyInstanceName: "other", dataLayerUrl: "https://x.example/acdl.js" });
    expect(diags.filter((d) => d.kind === "unsupported-option").map((d) => d.option).sort()).toEqual(["alloyInstanceName", "dataLayerUrl"]);
  });

  it("installAdobeDataLayerProxy rejects alloy, __alloyNS and the alloyInstanceName value with a plain Error", async () => {
    const { m, init } = setup();
    await init({}, { alloyInstanceName: "myAlloy" });
    for (const instanceName of ["alloy", "__alloyNS", "myAlloy"]) {
      let err;
      try { m.installAdobeDataLayerProxy({ instanceName }); } catch (e) { err = e; }
      expect(Object.getPrototypeOf(err)).toBe(Error.prototype);
    }
    expect(Object.keys(window)).toEqual([]);
  });

  it("the dataLayerInstanceName config path is checked too: alloy, __alloyNS and the alloyInstanceName value are rejected", async () => {
    for (const name of ["alloy", "__alloyNS", "myAlloy"]) {
      const { m, init } = setup();
      await init({}, { alloyInstanceName: "myAlloy", dataLayerInstanceName: name });
      expect(() => m.installAdobeDataLayerProxy()).toThrow(/would write a global Alloy name/);
    }
    expect(Object.keys(window)).toEqual([]);
  });
});

describe("069-03 AC3: consent goes through setAdobeConsent only", () => {
  it("(a) the object equals what aem-martech builds (marketing boolean and object, collect, personalize, share)", async () => {
    const { m, handle, init } = setup();
    await init();
    expect(await m.updateUserConsent({ collect: true, marketing: true, personalize: false, share: true })).toEqual({});
    expect(handle.setAdobeConsent.mock.calls[0][0]).toEqual([{
      standard: "Adobe", version: "2.0",
      value: { collect: { val: "y" }, marketing: { any: { val: "y" }, preferred: "email" }, personalize: { content: { val: "n" } }, share: { val: "y" } },
    }]);
    await m.updateUserConsent({ collect: false, marketing: { email: true, sms: false, preferred: "sms" }, personalize: true });
    expect(handle.setAdobeConsent.mock.calls[1][0]).toEqual([{
      standard: "Adobe", version: "2.0",
      value: {
        collect: { val: "n" },
        marketing: { preferred: "sms", any: { val: "y" }, email: { val: "y" }, push: { val: "n" }, sms: { val: "n" } },
        personalize: { content: { val: "y" } }, share: { val: "n" },
      },
    }]);
    expect(buildConsentObject({ collect: true })[0].value.marketing).toBeUndefined();
  });

  it("(b) the library never calls handle.setConsent, across a whole run", async () => {
    const { m, handle, init } = setup();
    await init();
    await m.updateUserConsent({ collect: true });
    await m.updateUserConsent({ collect: false });
    await m.martechEager();
    await m.martechLazy();
    expect(handle.setConsent).not.toHaveBeenCalled();
    expect(handle.setAdobeConsent).toHaveBeenCalledTimes(2);
  });

  // A fake Worker under the real bootAlloy: the seal is the real one.
  class Worker {
    constructor() { this.handlers = []; this.messages = []; this.n = 0; Worker.last = this; }
    addEventListener(t, fn) { if (t === "message") this.handlers.push(fn); }
    removeEventListener(t, fn) { this.handlers = this.handlers.filter((h) => h !== fn); }
    terminate() {}
    emit(msg) { for (const h of this.handlers.slice()) h({ data: msg }); }
    fire() { this.n += 1; this.emit({ type: "intercepted-fetch", id: `f${this.n}`, url: `https://adobedc.demdex.net/ee/v1/interact?configId=${DS}`, method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); }
    postMessage(m) {
      this.messages.push(m);
      if (m.type === "init") setTimeout(() => { this.emit({ type: "phase", name: "install" }); this.emit({ type: "phase", name: "configured" }); }, 0);
      if (m.type === "adobeConsent") setTimeout(() => this.emit({ type: "consent-outcome", id: m.id, ok: true }), 0);
    }
  }
  const realBoot = async () => {
    vi.stubGlobal("Worker", Worker);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => "{}" })));
    const diags = [];
    const m = createMartech(undefined, { onDiagnostic: (d) => diags.push(d) });
    const booted = m.initMartech(CFG, { airlock: AIRLOCK });
    await advance(5);
    await booted;
    return { m, diags, worker: Worker.last };
  };

  it("(c) collect:false never yields a granted analytics_storage at the seal; collect:true does", async () => {
    const { m, worker } = await realBoot();
    const off = m.updateUserConsent({ collect: false, personalize: false });
    await advance(5);
    expect(await off).toEqual({});
    worker.fire();
    await advance(40);
    expect(fetch).not.toHaveBeenCalled();
    const vectors = worker.messages.filter((x) => x.type === "setConsent");
    expect(vectors.length).toBeGreaterThan(0);
    for (const v of vectors) expect(JSON.stringify(v)).not.toContain('"analytics_storage":"granted"');
    expect(worker.messages.filter((x) => x.type === "adobeConsent")).toHaveLength(1);
    const on = m.updateUserConsent({ collect: true, personalize: true });
    await advance(5);
    await on;
    worker.fire();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it("(d) a handle without setAdobeConsent is rejected at creation, and via martechConfig.handle, with a plain Error", async () => {
    const bad = mockHandle({ setAdobeConsent: undefined });
    let err;
    try { createMartech(bad); } catch (e) { err = e; }
    expect(Object.getPrototypeOf(err)).toBe(Error.prototype);
    expect(err.message).toMatch(/setAdobeConsent/);
    const m = createMartech(undefined, { onDiagnostic() {} });
    await expect(m.initMartech(CFG, { handle: bad })).rejects.toThrow(/setAdobeConsent/);
  });

  it("(e) a call before the chamber is configured is queued and settles with Alloy's outcome (resolve and reject)", async () => {
    const d = deferred();
    const handle = mockHandle();
    const m = createMartech(undefined, { boot: () => d.promise, onDiagnostic() {} });
    const init = m.initMartech(CFG, { airlock: AIRLOCK });
    const ok = m.updateUserConsent({ collect: true });
    handle.setAdobeConsent.mockImplementationOnce(async () => ({}));
    let settled = false;
    ok.then(() => { settled = true; });
    await advance();
    expect(settled).toBe(false);
    expect(handle.setAdobeConsent).not.toHaveBeenCalled();
    d.resolve(handle);
    await init;
    expect(await ok).toEqual({});
    expect(handle.setAdobeConsent).toHaveBeenCalledTimes(1);

    const d2 = deferred();
    const handle2 = mockHandle({ setAdobeConsent: vi.fn(async () => { throw new Error("The server responded with a status code 400"); }) });
    const m2 = createMartech(undefined, { boot: () => d2.promise, onDiagnostic() {} });
    const init2 = m2.initMartech(CFG, { airlock: AIRLOCK });
    const bad = m2.updateUserConsent({ collect: true });
    bad.catch(() => {});
    d2.resolve(handle2);
    await init2;
    await expect(bad).rejects.toThrow("The server responded with a status code 400");
  });

  it("(f) martechConfig.airlock accepts bundleUrl and workerUrl only (consent and consentHold are rejected)", async () => {
    for (const extra of [{ consent: { analytics_storage: "granted" } }, { consentHold: false }, { onBeforeEventSend() {} }]) {
      const boot = vi.fn(async () => mockHandle());
      const m = createMartech(undefined, { boot, onDiagnostic() {} });
      await expect(m.initMartech(CFG, { airlock: { ...AIRLOCK, ...extra } })).rejects.toThrow(/martechConfig\.airlock\.\w+ is not allowed/);
      expect(boot).not.toHaveBeenCalled();
    }
    const boot = vi.fn(async () => mockHandle());
    const m = createMartech(undefined, { boot, onDiagnostic() {} });
    await m.initMartech(CFG, { airlock: { ...AIRLOCK, workerUrl: "/w.js" } });
    expect(boot.mock.calls[0][0]).toMatchObject({ bundleUrl: AIRLOCK.bundleUrl, workerUrl: "/w.js" });
  });

  it('(g) defaultConsent "out" sends nothing and drops events until a grant; "in" is diagnosed and never grants before updateUserConsent', async () => {
    const out = setup();
    await out.init({ defaultConsent: "out" });
    expect(await out.m.sendEvent({ xdm: { eventType: "a" } })).toEqual({});
    out.m.pushToDataLayer({ event: "e", xdm: { a: 1 } });
    await out.m.martechLazy();
    await advance();
    expect(out.handle.sendEvent).not.toHaveBeenCalled();
    expect(kinds(out.diags)).toContain("consent-out-event-dropped");
    await out.m.updateUserConsent({ collect: true });
    await out.m.sendEvent({ xdm: { eventType: "b" } });
    expect(out.handle.sendEvent).toHaveBeenCalledTimes(1);
    await out.m.updateUserConsent({ collect: false });
    expect(await out.m.sendEvent({ xdm: { eventType: "c" } })).toEqual({});
    expect(out.handle.sendEvent).toHaveBeenCalledTimes(1);

    const inn = setup();
    await inn.init({ defaultConsent: "in" });
    expect(kinds(inn.diags)).toContain("defaultConsent-in-not-honoured");
    expect(inn.handle.setAdobeConsent).not.toHaveBeenCalled();
    expect(inn.handle.setConsent).not.toHaveBeenCalled();
  });

  it('(g) "out": an unawaited grant then send delivers the event (no awaits between them), live', async () => {
    const { m, handle, init } = setup();
    await init({ defaultConsent: "out" });
    const grant = m.updateUserConsent({ collect: true });
    const sent = m.sendEvent({ xdm: { eventType: "a" } });
    await grant;
    await sent;
    expect(handle.calls.map(([k]) => k)).toEqual(["setAdobeConsent", "sendEvent"]);
  });

  it('(g) "out": a grant then a send queued before the chamber exists are drained in one pass and the event is delivered', async () => {
    const d = deferred();
    const handle = mockHandle();
    const m = createMartech(undefined, { boot: () => d.promise, onDiagnostic() {} });
    const init = m.initMartech({ ...CFG, defaultConsent: "out" }, { airlock: AIRLOCK });
    const grant = m.updateUserConsent({ collect: true });
    const sent = m.sendEvent({ xdm: { eventType: "a" } });
    d.resolve(handle);
    await init;
    await grant;
    await sent;
    expect(handle.calls.map(([k]) => k)).toEqual(["setAdobeConsent", "sendEvent"]);
  });

  it('(g) "out": a send queued before the grant is dropped (the order the page made them in decides)', async () => {
    const d = deferred();
    const handle = mockHandle();
    const diags = [];
    const m = createMartech(undefined, { boot: () => d.promise, onDiagnostic: (x) => diags.push(x) });
    const init = m.initMartech({ ...CFG, defaultConsent: "out" }, { airlock: AIRLOCK });
    const sent = m.sendEvent({ xdm: { eventType: "early" } });
    const grant = m.updateUserConsent({ collect: true });
    d.resolve(handle);
    await init;
    await grant;
    expect(await sent).toEqual({});
    expect(handle.calls.map(([k]) => k)).toEqual(["setAdobeConsent"]);
    expect(kinds(diags)).toContain("consent-out-event-dropped");
  });
});

describe("069-03 AC4: every export", () => {
  it("DEFAULT_CONFIG has the pinned file's keys and values; there is no dataLayerUrl", () => {
    expect(Object.keys(DEFAULT_CONFIG).sort()).toEqual(["alloyInstanceName", "analytics", "dataLayer", "dataLayerInstanceName", "decisionScopes", "includeDataLayerState", "launchUrls", "performanceOptimized", "personalization", "personalizationTimeout", "shouldProcessEvent", "trackPageView"]);
    expect({ ...DEFAULT_CONFIG, shouldProcessEvent: DEFAULT_CONFIG.shouldProcessEvent() }).toMatchObject({ analytics: true, alloyInstanceName: "alloy", trackPageView: true, dataLayer: true, dataLayerInstanceName: "adobeDataLayer", includeDataLayerState: true, launchUrls: [], personalization: true, performanceOptimized: true, personalizationTimeout: 1000, decisionScopes: [], shouldProcessEvent: true });
    expect("dataLayerUrl" in DEFAULT_CONFIG).toBe(false);
  });

  it("exports every ADR-0065 name, and the default instance throws before init like stock", async () => {
    for (const name of ["initMartech", "sendEvent", "sendAnalyticsEvent", "pushToDataLayer", "pushEventToDataLayer", "updateUserConsent", "initRumTracking", "isPersonalizationEnabled", "getPersonalizationForView", "applyPersonalization", "martechEager", "martechLazy", "martechDelayed", "getAirlockHandle", "installAdobeDataLayerProxy"]) {
      expect(typeof lib[name], name).toBe("function");
    }
    expect(lib.isPersonalizationEnabled()).toBe(false);
    expect(() => lib.getAirlockHandle()).toThrow(/does not exist yet/);
    await expect(lib.sendEvent({})).rejects.toThrow("Martech needs to be initialized before the `sendEvent` method is called");
  });

  it("initMartech: validation errors, double init, and the airlock requirement", async () => {
    const m = createMartech(undefined, { boot: async () => mockHandle(), onDiagnostic() {} });
    await expect(m.initMartech({ orgId: "o" }, { airlock: AIRLOCK })).rejects.toThrow('Please set your "datastreamId" for the WebSDK config.');
    await expect(m.initMartech({ datastreamId: DS }, { airlock: AIRLOCK })).rejects.toThrow('Please set your "orgId" for the WebSDK config.');
    await expect(m.initMartech(CFG, {})).rejects.toThrow(/martechConfig\.airlock\.bundleUrl/);
    await m.initMartech(CFG, { airlock: AIRLOCK });
    await expect(m.initMartech(CFG, { airlock: AIRLOCK })).rejects.toThrow("Martech is already initialized.");
  });

  it("initMartech maps the boot options: no consent, consentHold or hook reach bootAlloy; context defaults; unsupported options are diagnosed, inert ones are not", async () => {
    const boot = vi.fn(async () => mockHandle());
    const diags = [];
    const m = createMartech(undefined, { boot, onDiagnostic: (d) => diags.push(d) });
    const hook = () => {};
    await m.initMartech({ ...CFG, edgeDomain: "e.example.com", thirdPartyCookiesEnabled: false, clickCollectionEnabled: false, onBeforeEventSend: hook, debugEnabled: true, targetMigrationEnabled: true, autoCollectPropositionInteractions: { TGT: "always" }, idMigrationEnabled: false, prehidingStyle: "x" }, { airlock: AIRLOCK });
    const opts = boot.mock.calls[0][0];
    expect(opts).toMatchObject({ orgId: "ORG@AdobeOrg", datastreamId: DS, edgeDomain: "e.example.com", thirdPartyCookiesEnabled: false, clickCollectionEnabled: false, context: ["web", "device", "environment"], bundleUrl: AIRLOCK.bundleUrl });
    for (const k of ["consent", "consentHold", "onBeforeEventSend", "defaultConsent", "idMigrationEnabled"]) expect(k in opts, k).toBe(false);
    expect(diags.filter((d) => d.kind === "unsupported-option").map((d) => d.option).sort()).toEqual(["idMigrationEnabled", "prehidingStyle"]);
  });

  it("boot timing: at initMartech with personalization on, at martechLazy with it off", async () => {
    const on = vi.fn(async () => mockHandle());
    const a = createMartech(undefined, { boot: on, onDiagnostic() {} });
    await a.initMartech(CFG, { airlock: AIRLOCK });
    expect(on).toHaveBeenCalledTimes(1);
    const off = vi.fn(async () => mockHandle());
    const b = createMartech(undefined, { boot: off, onDiagnostic() {} });
    await b.initMartech(CFG, { airlock: AIRLOCK, personalization: false });
    expect(off).not.toHaveBeenCalled();
    expect(() => b.getAirlockHandle()).toThrow();
    await b.martechLazy();
    expect(off).toHaveBeenCalledTimes(1);
    expect(b.getAirlockHandle()).toBeTruthy();
  });

  it("pre-boot calls replay in call order at boot; data-layer events stay held and send, in push order, only after martechLazy attaches (no event before the eager page view)", async () => {
    const d = deferred();
    const handle = mockHandle();
    const m = createMartech(undefined, { boot: () => d.promise, onDiagnostic() {} });
    const init = m.initMartech(CFG, { airlock: AIRLOCK });
    const all = [];
    all.push(m.sendEvent({ xdm: { n: "send-1" } }));
    m.pushToDataLayer({ event: "ev", xdm: { n: "dl-2" } });
    all.push(m.updateUserConsent({ collect: true }));
    all.push(m.getPersonalizationForView("v1"));
    all.push(m.applyPersonalization("v2"));
    m.pushEventToDataLayer("ev", { n: "dl-6" }, { d: 1 });
    all.push(m.sendEvent({ xdm: { n: "send-7" } }));
    await advance();
    expect(handle.calls).toEqual([]);
    d.resolve(handle);
    await init;
    await Promise.all(all);
    await advance();
    const label = ([kind, arg]) => (kind === "sendEvent" ? (arg.xdm.n || arg.xdm.web?.webPageDetails?.viewName || "?") : kind === "applyPropositions" ? `apply:${arg.viewName}` : kind);
    // Booted, not attached: only the calls ran.
    expect(handle.calls.map(label)).toEqual(["send-1", "setAdobeConsent", "v1", "apply:v2", "send-7"]);
    await m.martechLazy();
    await vi.waitFor(() => expect(handle.calls.map(label)).toEqual(["send-1", "setAdobeConsent", "v1", "apply:v2", "send-7", "dl-2", "dl-6"]));
    expect(handle.calls.find(([, a]) => a && a.xdm && a.xdm.n === "dl-6")[1].data).toEqual({ d: 1 });
  });

  it("(4) a queued pre-boot call does not attach the data layer: no data-layer event is sent before the eager page view", async () => {
    const d = deferred();
    const handle = mockHandle();
    const m = createMartech(undefined, { boot: () => d.promise, onDiagnostic() {} });
    const init = m.initMartech(CFG, { airlock: AIRLOCK, trackPageView: true });
    m.pushToDataLayer({ event: "early", xdm: { n: "dl-early" } });
    const call = m.sendEvent({ xdm: { n: "page-call" } });
    d.resolve(handle);
    await init;
    await call;
    await m.martechEager();
    await advance();
    const labels = handle.calls.map(([, a]) => a.xdm?.eventType || a.xdm?.n || a.type);
    expect(labels).not.toContain("dl-early");
    expect(labels).toContain("web.webpagedetails.pageViews");
    await m.martechLazy();
    await vi.waitFor(() => expect(handle.calls.map(([, a]) => a.xdm?.n)).toContain("dl-early"));
    const order = handle.calls.map(([, a]) => a.xdm?.n || a.xdm?.eventType || a.type);
    expect(order.indexOf("web.webpagedetails.pageViews")).toBeGreaterThan(-1);
    expect(order.indexOf("web.webpagedetails.pageViews")).toBeLessThan(order.indexOf("dl-early"));
  });

  it("(2) a failed boot rejects every queued call (data-layer queue and direct queue) and every later call at once", async () => {
    for (const dataLayer of [true, false]) {
      const d = deferred();
      const m = createMartech(undefined, { boot: () => d.promise, onDiagnostic() {} });
      const init = m.initMartech(CFG, { airlock: AIRLOCK, dataLayer });
      init.catch(() => {});
      const queued = [m.sendEvent({ xdm: {} }), m.updateUserConsent({ collect: true }), m.getPersonalizationForView("v")];
      const outcomes = queued.map((p) => p.then(() => "resolved", (e) => e.message));
      d.reject(new Error("chamber failed to boot"));
      await expect(init).rejects.toThrow("chamber failed to boot");
      expect(await Promise.all(outcomes)).toEqual(["chamber failed to boot", "chamber failed to boot", "chamber failed to boot"]);
      await expect(m.sendEvent({ xdm: {} })).rejects.toThrow("chamber failed to boot");
      await expect(m.applyPersonalization("v")).rejects.toThrow("chamber failed to boot");
      await expect(m.martechLazy()).rejects.toThrow("chamber failed to boot");
    }
  });

  it("(5) without a data layer (dataLayer:false) the held-call cap is the same 200: the oldest call is dropped, its promise rejects, a diagnostic is said", async () => {
    const d = deferred();
    const handle = mockHandle();
    const diags = [];
    const m = createMartech(undefined, { boot: () => d.promise, onDiagnostic: (x) => diags.push(x) });
    const init = m.initMartech(CFG, { airlock: AIRLOCK, dataLayer: false });
    const calls = [];
    for (let i = 0; i < MAX_HELD_EVENTS + 1; i += 1) { const p = m.sendEvent({ xdm: { n: i } }); p.catch(() => {}); calls.push(p); }
    await expect(calls[0]).rejects.toThrow(/dropped/);
    expect(kinds(diags)).toContain("held-call-overflow");
    d.resolve(handle);
    await init;
    await Promise.all(calls.slice(1));
    expect(handle.calls).toHaveLength(MAX_HELD_EVENTS);
    expect(handle.calls[0][1].xdm.n).toBe(1);
  });

  it("the 200-entry pre-attach cap is the data layer's: the oldest held call is dropped, its promise rejects, and a datalayer-held-overflow is said", async () => {
    const d = deferred();
    const handle = mockHandle();
    const diags = [];
    const m = createMartech(undefined, { boot: () => d.promise, onDiagnostic: (x) => diags.push(x) });
    const init = m.initMartech(CFG, { airlock: AIRLOCK });
    const calls = [];
    for (let i = 0; i < MAX_HELD_EVENTS + 1; i += 1) { const p = m.sendEvent({ xdm: { n: i } }); p.catch(() => {}); calls.push(p); }
    await expect(calls[0]).rejects.toThrow(/dropped/);
    expect(kinds(diags)).toContain("datalayer-held-overflow");
    d.resolve(handle);
    await init;
    await Promise.all(calls.slice(1));
    expect(handle.calls).toHaveLength(MAX_HELD_EVENTS);
    expect(handle.calls[0][1].xdm.n).toBe(1);
  });

  it("sendEvent forwards the page's options and resolves the handle's propositions and decisions", async () => {
    const result = { propositions: [{ id: "p", items: [] }], decisions: [{ id: "p" }] };
    const { m, handle, init } = setup({ handle: mockHandle({ sendEvent: vi.fn(async () => result) }) });
    await init();
    expect(await m.sendEvent({ xdm: { eventType: "x" }, decisionScopes: ["s"], renderDecisions: true })).toEqual(result);
    expect(handle.sendEvent.mock.calls[0][0]).toMatchObject({ decisionScopes: ["s"], renderDecisions: true, xdm: { eventType: "x" } });
  });

  it("(b) sendEvent resolves the handle's result unchanged: exactly propositions and decisions (the 069-01 handle carries nothing else), {} for a dropped event", async () => {
    const result = { propositions: [{ id: "p", items: [] }], decisions: [{ id: "p" }] };
    const a = setup({ handle: mockHandle({ sendEvent: vi.fn(async () => result) }) });
    await a.init();
    const resolved = await a.m.sendEvent({ xdm: { eventType: "x" } });
    expect(resolved).toBe(result);
    expect(Object.keys(resolved).sort()).toEqual(["decisions", "propositions"]);
    const dropped = setup();
    await dropped.init({ onBeforeEventSend: () => false });
    expect(await dropped.m.sendEvent({ xdm: { eventType: "x" } })).toEqual({});
    const out = setup();
    await out.init({ defaultConsent: "out" });
    expect(await out.m.sendEvent({ xdm: { eventType: "x" } })).toEqual({});
  });

  it("sendAnalyticsEvent: non-empty edgeConfigOverrides are diagnosed unsupported-option, {} is dropped silently", async () => {
    const { m, init, diags } = setup();
    await init();
    await m.sendAnalyticsEvent({ eventType: "a" }, {}, {});
    expect(kinds(diags)).not.toContain("unsupported-option");
    await m.sendAnalyticsEvent({ eventType: "a" }, {}, { com_adobe_analytics: { reportSuites: ["x"] } });
    expect(diags.filter((d) => d.kind === "unsupported-option").map((d) => d.option)).toEqual(["edgeConfigOverrides"]);
  });

  it("pushToDataLayer and pushEventToDataLayer feed the generic data layer; dataLayer:false throws stock's error", async () => {
    const { m, handle, init } = setup();
    await init();
    await m.martechLazy();
    m.pushToDataLayer({ event: "a", xdm: { k: 1 }, data: { d: 1 } });
    m.pushEventToDataLayer("b", { k: 2 });
    await vi.waitFor(() => expect(handle.sendEvent.mock.calls.map((c) => c[0].xdm.k)).toEqual([1, 2]));
    const off = setup();
    await off.init({}, { dataLayer: false });
    expect(() => off.m.pushToDataLayer({ a: 1 })).toThrow("The data layer is disabled in the martech config");
  });

  it("shouldProcessEvent filters data-layer events on the main thread", async () => {
    const { m, handle, init } = setup();
    await init({}, { shouldProcessEvent: (p) => p.event !== "skip" });
    await m.martechLazy();
    m.pushToDataLayer({ event: "skip", xdm: { k: 1 } });
    m.pushToDataLayer({ event: "keep", xdm: { k: 2 } });
    await vi.waitFor(() => expect(handle.sendEvent.mock.calls.map((c) => c[0].xdm.k)).toEqual([2]));
    await advance();
    expect(handle.sendEvent.mock.calls.map((c) => c[0].xdm.k)).toEqual([2]);
  });

  it("includeDataLayerState merges the state into xdm at send (state overriding); off, it does not", async () => {
    for (const include of [true, false]) {
      const { m, handle, init } = setup();
      await init({}, { includeDataLayerState: include });
      m.pushToDataLayer({ page: { name: "home" }, xdm: undefined });
      await m.sendEvent({ xdm: { eventType: "x", page: { name: "page" } } });
      const sent = handle.sendEvent.mock.calls[0][0].xdm;
      if (include) expect(sent.page).toEqual({ name: "home" });
      else expect(sent.page).toEqual({ name: "page" });
    }
  });

  it("initRumTracking: both tracker shapes, and withRumEnhancer is dropped with a diagnostic", () => {
    const { m, diags } = setup();
    const on = vi.fn();
    const track = m.initRumTracking({ always: { on } }, { withRumEnhancer: true });
    const cb = vi.fn();
    track("click", cb);
    on.mock.calls[0][1]({ checkpoint: "click" });
    expect(on.mock.calls[0][0]).toBe("click");
    expect(cb).toHaveBeenCalledWith({ checkpoint: "click" });
    expect(diags.map((d) => d.option)).toEqual(["withRumEnhancer"]);
    const listeners = [];
    vi.stubGlobal("document", { ...document, addEventListener: (t, fn) => listeners.push([t, fn]) });
    const cb2 = vi.fn();
    m.initRumTracking({})("cwv", cb2);
    listeners[0][1]({ detail: { checkpoint: "other" } });
    listeners[0][1]({ detail: { checkpoint: "cwv", v: 1 } });
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("isPersonalizationEnabled, getPersonalizationForView and applyPersonalization", async () => {
    const { m, handle, init } = setup();
    expect(m.isPersonalizationEnabled()).toBe(false);
    await init();
    expect(m.isPersonalizationEnabled()).toBe(true);
    await m.getPersonalizationForView("v");
    expect(handle.sendEvent.mock.calls[0][0]).toMatchObject({ renderDecisions: true });
    expect(handle.sendEvent.mock.calls[0][0].xdm.web.webPageDetails.viewName).toBe("v");
    await expect(m.getPersonalizationForView("")).rejects.toThrow("The `viewName` parameter needs to be defined");
    await expect(m.applyPersonalization()).rejects.toThrow("The `viewName` parameter needs to be defined");
    await m.applyPersonalization("v");
    expect(handle.applyPropositions).toHaveBeenCalledWith({ viewName: "v" });
    // The combined form is reached on the handle and goes through untouched (stock's `applyPersonalization(viewName)` rejects the bare form).
    const combined = { propositions: [{ id: "p", items: [] }], viewName: "v" };
    await m.getAirlockHandle().applyPropositions(combined);
    expect(handle.applyPropositions).toHaveBeenLastCalledWith(combined);
  });

  it("martechEager hides the body and martechLazy scans the blocks and attaches (personalization on); the page view is sent from martechEager only", async () => {
    const el = { id: "", dataset: { blockDataLayer: '{"a":1}' }, classList: ["hero"] };
    vi.stubGlobal("document", { prerendering: false, body, querySelector: () => null, querySelectorAll: () => [el], addEventListener() {} });
    const { m, handle, init } = setup({ trackPageView: true });
    await init();
    await m.martechEager();
    const first = handle.sendEvent.mock.calls.map((c) => c[0]);
    expect(first[0]).toMatchObject({ renderDecisions: false });
    expect(first.some((e) => e.xdm.eventType === "web.webpagedetails.pageViews")).toBe(true);
    const before = handle.sendEvent.mock.calls.length;
    await m.martechLazy();
    await advance();
    expect(el.id).toBe("1");
    expect(handle.sendEvent.mock.calls.length).toBe(before);
  });

  it("personalization off: martechLazy boots, sends the page view and does not hide the body", async () => {
    const { m, handle, init } = setup({ personalization: false, trackPageView: true });
    await init();
    await m.martechEager();
    expect(body.style.visibility).toBeUndefined();
    await m.martechLazy();
    await vi.waitFor(() => expect(handle.sendEvent.mock.calls.map((c) => c[0].xdm.eventType)).toEqual(["web.webpagedetails.pageViews"]));
  });

  it("performanceOptimized:false: one __view__ fetch, body hidden then restored; trackPageView:false sends no page view", async () => {
    const { m, handle, init } = setup({ performanceOptimized: false, trackPageView: false });
    await init();
    await m.martechEager();
    expect(body.style.visibility).toBe("hidden");
    await m.martechLazy();
    expect(handle.sendEvent.mock.calls).toHaveLength(1);
    expect(handle.sendEvent.mock.calls[0][0]).toMatchObject({ renderDecisions: true, decisionScopes: ["__view__"] });
    expect(body.style.visibility).toBe(null);
  });

  it("martechDelayed loads no Launch container: a launch-not-loaded diagnostic per URL and no request", async () => {
    const { m, handle, init, diags } = setup();
    await init({}, { launchUrls: ["https://a.example/launch-1.js", "https://b.example/launch-2.js"] });
    await m.martechDelayed();
    expect(diags.filter((d) => d.kind === "launch-not-loaded")).toHaveLength(2);
    expect(handle.sendEvent).not.toHaveBeenCalled();
  });

  it("getAirlockHandle returns the handle once it exists and reaches command()", async () => {
    const { m, handle, init } = setup();
    expect(() => m.getAirlockHandle()).toThrow(/does not exist yet/);
    await init();
    expect(m.getAirlockHandle()).toBe(handle);
    await m.getAirlockHandle().command("getIdentity", { namespaces: ["ECID"] });
    expect(handle.command).toHaveBeenCalledWith("getIdentity", { namespaces: ["ECID"] });
  });

  describe("differences", () => {
    it("(b) updateUserConsent resolves {} whatever setAdobeConsent returns", async () => {
      const { m, init } = setup({ handle: mockHandle({ setAdobeConsent: vi.fn(async () => ({ outcome: "x" })) }) });
      await init();
      expect(await m.updateUserConsent({ collect: true })).toEqual({});
    });

    it("(d) a throwing page onBeforeEventSend is caught like the pinned aem-martech: diagnostic, event dropped, sendEvent resolves", async () => {
      const { m, handle, init, diags } = setup();
      await init({ onBeforeEventSend: () => { throw new Error("boom"); } });
      expect(await m.sendEvent({ xdm: { eventType: "x" } })).toEqual({});
      expect(handle.sendEvent).not.toHaveBeenCalled();
      expect(diags.find((d) => d.kind === "hook-threw").reason).toContain("boom");
    });

    it("a hook returning false drops the event and resolves {}", async () => {
      const { m, handle, init } = setup();
      await init({ onBeforeEventSend: () => false });
      expect(await m.sendEvent({ xdm: { eventType: "x" } })).toEqual({});
      expect(handle.sendEvent).not.toHaveBeenCalled();
    });

    it("(e) a partly rendered proposition is marked renderAttempted as a whole: it is applied once with all its items, reported once, and not applied again", async () => {
      const prop = { id: "P", scope: "s", scopeDetails: {}, items: [{ schema: `${NS}dom-action` }, { schema: `${NS}dom-action` }] };
      vi.stubGlobal("document", { prerendering: false, body, querySelector: (sel) => (/data-block-status/.test(sel) ? {} : null), querySelectorAll: () => [], addEventListener() {} });
      // The chamber rendered the first item only: the proposition comes back marked as a whole, items partial.
      const partial = { ...prop, renderAttempted: true, items: [{ ...prop.items[0], renderAttempted: true }, { ...prop.items[1], renderAttempted: false }] };
      const handle = mockHandle({
        sendEvent: vi.fn(async (e) => (e.renderDecisions === false && e.personalization ? { propositions: [prop], decisions: [prop] } : { propositions: [], decisions: [] })),
        applyPropositions: vi.fn(async () => ({ propositions: [partial] })),
      });
      const { m, init } = setup({ handle, trackPageView: true });
      await init();
      await m.martechEager();
      await vi.waitFor(() => expect(handle.applyPropositions).toHaveBeenCalledTimes(1));
      expect(handle.applyPropositions.mock.calls[0][0].propositions[0].items).toHaveLength(2);
      // A later mutation finds nothing left to apply.
      observers.forEach((o) => o.fn([{ target: { tagName: "BODY" } }]));
      await advance();
      expect(handle.applyPropositions).toHaveBeenCalledTimes(1);
      const shown = handle.sendEvent.mock.calls.flatMap((c) => c[0].xdm?._experience?.decisioning?.propositions ?? []).filter((p) => p.id === "P");
      expect(shown).toHaveLength(1);
    });

    it("(f) timestamp and placeContext.localTime are sampled on the main thread: the page hook sees them", async () => {
      let seen;
      const { m, init } = setup();
      await init({ context: ["web", "device", "environment", "placeContext"], onBeforeEventSend: (p) => { seen = p; } });
      await m.sendEvent({ xdm: { eventType: "x" } });
      expect(typeof seen.xdm.timestamp).toBe("string");
      expect(seen.xdm.placeContext).toBeDefined();
      expect(typeof seen.xdm.placeContext.localTime).toBe("string");
      expect(seen.xdm.implementationDetails.name).toBe("https://ns.adobe.com/experience/alloy");
    });

    it("(2) overlapping consent calls: the last call made decides the grant, whatever order they settle in", async () => {
      const releases = [];
      const handle = mockHandle({ setAdobeConsent: vi.fn(() => new Promise((res) => releases.push(() => res({})))) });
      const { m, init } = setup({ handle });
      await init({ defaultConsent: "out" });
      const revoke = m.updateUserConsent({ collect: false });
      const grant = m.updateUserConsent({ collect: true });
      await advance();
      releases[1](); // the grant settles first, the revoke last
      await advance();
      releases[0]();
      await Promise.all([revoke, grant]);
      const sent = m.sendEvent({ xdm: { eventType: "after" } });
      await advance();
      await sent;
      expect(handle.sendEvent).toHaveBeenCalledTimes(1);
    });

    it("(1) a failed boot still restores the body when performanceOptimized:false hid it", async () => {
      const m = createMartech(undefined, { boot: async () => { throw new Error("boot failed"); }, onDiagnostic() {} });
      await m.initMartech(CFG, { airlock: AIRLOCK, personalization: false }).catch(() => {});
      const m2 = createMartech(undefined, { boot: async () => { throw new Error("boot failed"); }, onDiagnostic() {} });
      const init = m2.initMartech(CFG, { airlock: AIRLOCK, performanceOptimized: false });
      await init.catch(() => {});
      await m2.martechEager();
      expect(body.style.visibility).toBe("hidden");
      await expect(m2.martechLazy()).rejects.toThrow("boot failed");
      expect(body.style.visibility).toBeNull();
    });

    it("(g) a field the page hook deletes is absent from what the library sends (the refill is the chamber's context merge, outside this hermetic test)", async () => {
      const { m, handle, init } = setup();
      await init({ onBeforeEventSend: (p) => { delete p.xdm.implementationDetails; p.xdm.custom = 1; } });
      await m.sendEvent({ xdm: { eventType: "x" } });
      const sent = handle.sendEvent.mock.calls[0][0].xdm;
      expect(sent.custom).toBe(1);
      expect(sent.implementationDetails).toBeUndefined();
      expect(sent.timestamp).toBeUndefined();
    });

    it("a page __view__ scope next to named boot scopes is diagnosed", async () => {
      const { m, init, diags } = setup();
      await init({}, { decisionScopes: ["named"] });
      await m.sendEvent({ decisionScopes: ["__view__"], xdm: {} });
      expect(diags.some((d) => d.kind === "unsupported-option" && d.option === "decisionScopes")).toBe(true);
    });

    it("datasetId is dropped with a diagnostic (via the bridge)", async () => {
      const { m, init, diags } = setup();
      await init();
      await m.sendEvent({ xdm: {}, datasetId: "d" });
      expect(diags.some((d) => d.option === "datasetId")).toBe(true);
    });

    it("(AC6) xdm.eventType wins over type; type fills the event type when xdm has none", async () => {
      const { m, handle, init } = setup();
      await init();
      await m.sendEvent({ type: "decisioning.propositionFetch", xdm: { eventType: "custom.event" } });
      await m.sendEvent({ type: "decisioning.propositionFetch", xdm: {} });
      expect(handle.sendEvent.mock.calls.map((c) => c[0].xdm.eventType)).toEqual(["custom.event", "decisioning.propositionFetch"]);
    });

    it("the __view__ plus named scopes diagnostic is said on the first call only", async () => {
      const { m, init, diags } = setup();
      await init({}, { decisionScopes: ["named"] });
      await m.sendEvent({ decisionScopes: ["__view__"], xdm: {} });
      await m.sendEvent({ decisionScopes: ["__view__"], xdm: {} });
      expect(diags.filter((d) => d.option === "decisionScopes")).toHaveLength(1);
    });
  });
});

describe("069-03 diagnostics and failure paths", () => {
  it("boot options a given handle cannot take, the airlock block and a non-function onBeforeEventSend are diagnosed", async () => {
    const { init, diags } = setup();
    await init({ edgeDomain: "e.example.com", thirdPartyCookiesEnabled: false, clickCollectionEnabled: false, onBeforeEventSend: "nope" }, { airlock: AIRLOCK });
    const named = diags.filter((d) => d.kind === "unsupported-option").map((d) => d.option).sort();
    expect(named).toEqual(["airlock", "clickCollectionEnabled", "edgeDomain", "onBeforeEventSend", "thirdPartyCookiesEnabled"]);
  });

  it("a throwing diagnostic sink never breaks boot, the bridge or the data layer", async () => {
    const handle = mockHandle();
    const m = createMartech(handle, { onDiagnostic() { throw new Error("sink"); } });
    await m.initMartech({ ...CFG, defaultConsent: "in", idMigrationEnabled: false }, {});
    await m.martechLazy();
    await expect(m.sendEvent({ xdm: {}, datasetId: "d" })).resolves.toBeDefined();
    m.pushToDataLayer(() => {});
    await advance();
  });

  it("a rejected background applyPropositions run is diagnosed, not unhandled", async () => {
    const prop = { id: "P", scope: "s", scopeDetails: {}, items: [{ schema: `${NS}dom-action` }] };
    vi.stubGlobal("document", { prerendering: false, body, querySelector: (sel) => (/data-block-status/.test(sel) ? {} : null), querySelectorAll: () => [], addEventListener() {} });
    const handle = mockHandle({
      sendEvent: vi.fn(async (e) => (e.renderDecisions === false && e.personalization ? { propositions: [prop], decisions: [prop] } : { propositions: [], decisions: [] })),
      applyPropositions: vi.fn(async () => { throw new Error("render failed"); }),
    });
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      const { m, init, diags } = setup({ handle });
      await init();
      await m.martechEager();
      await vi.waitFor(() => expect(diags.some((d) => d.kind === "apply-propositions-failed")).toBe(true));
      await advance();
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });
});

describe("069-03 AC3(c)/(timeouts): the handle's own rejection messages pass through", () => {
  it("kind none rejects, the fallback kind settles at once, and a silent chamber times out at 10 s", async () => {
    class W {
      constructor() { this.handlers = []; this.messages = []; }
      addEventListener(t, fn) { if (t === "message") this.handlers.push(fn); }
      removeEventListener() {}
      terminate() {}
      emit(msg) { for (const h of this.handlers.slice()) h({ data: msg }); }
      postMessage(m) { this.messages.push(m); if (m.type === "init") setTimeout(() => { this.emit({ type: "phase", name: "install" }); this.emit({ type: "phase", name: "configured" }); }, 0); }
    }
    vi.stubGlobal("Worker", W);
    vi.stubGlobal("fetch", vi.fn());
    vi.useFakeTimers();
    const m = createMartech(undefined, { onDiagnostic() {} });
    const init = m.initMartech(CFG, { airlock: AIRLOCK });
    await vi.advanceTimersByTimeAsync(5);
    await init;
    const handle = m.getAirlockHandle();
    await expect(handle.setAdobeConsent([{ standard: "x", version: "1", value: {} }])).rejects.toThrow("setAdobeConsent carried no Adobe collect/personalize value");
    await expect(handle.setAdobeConsent([{ standard: "IAB TCF", version: "2.0", value: "x" }, buildConsentObject({ collect: false })[0]])).resolves.toEqual({});
    const p = m.updateUserConsent({ collect: true });
    const seen = p.then(() => "resolved", (e) => e.message);
    await vi.advanceTimersByTimeAsync(11000);
    expect(await seen).toBe("the Alloy chamber did not answer setConsent within 10000 ms");
  });
});

describe("069-03 AC5: the data layer through the library", () => {
  it("initMartech, martechEager and martechLazy never touch window.adobeDataLayer (replaces 069-02's stand-in test)", async () => {
    const { m, init } = setup();
    await init();
    await m.martechEager();
    await m.martechLazy();
    m.pushToDataLayer({ event: "e", xdm: {} });
    await advance();
    expect("adobeDataLayer" in window).toBe(false);
    expect(Object.keys(window)).toEqual([]);
    for (const key of Object.keys(window)) delete window[key];
    const proxy = m.installAdobeDataLayerProxy();
    expect(proxy.installed).toBe(true);
    expect(Array.isArray(window.adobeDataLayer)).toBe(true);
  });

  it("measured cost of the S10 state-carrying send with includeDataLayerState: 1x vs 100x (ratios, no absolute bounds)", async () => {
    const s10 = JSON.parse(await readFile(new URL("./fixtures/adobe-capture/s10-base.json", import.meta.url), "utf8"));
    vi.useRealTimers();
    const pushes = s10.requests
      .filter((r) => r.method === "POST" && /\/(interact|collect)\?/.test(r.url) && r.request_body)
      .flatMap((r) => JSON.parse(r.request_body).events ?? [])
      .map((e) => ({ xdm: e.xdm, data: e.data ?? {} }));
    expect(pushes.length).toBeGreaterThan(0);
    const run = async (copies, reps) => {
      const times = [];
      let bytes = 0;
      for (let r = 0; r < reps; r += 1) {
        const { m, handle, init } = setup({ trackPageView: false });
        await init();
        const t0 = performance.now();
        for (let i = 0; i < copies; i += 1) for (const p of pushes) m.pushToDataLayer({ blocks: { [`k${i}`]: p } });
        await m.sendEvent({ xdm: { eventType: "web.webpagedetails.pageViews" } });
        times.push(performance.now() - t0);
        bytes = JSON.stringify(handle.sendEvent.mock.calls.at(-1)[0]).length;
      }
      times.sort((a, b) => a - b);
      return { bytes, ms: Math.max(times[Math.floor(times.length / 2)], 0.05) };
    };
    const one = await run(1, 15);
    const hundred = await run(100, 7);
    const byteRatio = hundred.bytes / one.bytes;
    const timeRatio = hundred.ms / one.ms;
    process.stderr.write(`069-03 AC5 cost: 1x ${one.bytes} B ${one.ms.toFixed(2)} ms; 100x ${hundred.bytes} B ${hundred.ms.toFixed(2)} ms; byte ratio ${byteRatio.toFixed(1)}, time ratio ${timeRatio.toFixed(1)}\n`);
    expect(byteRatio).toBeGreaterThan(20);
    expect(byteRatio).toBeLessThan(200);
    // Linear growth is about 100x; quadratic work would be about 10,000x.
    expect(timeRatio).toBeLessThan(1500);
  });
});

describe("069-03 AC9: the Apache-2.0 notice", () => {
  it("is in the library header and in THIRD_PARTY_NOTICES.md, both naming adobe-rnd/aem-martech", async () => {
    const header = (await readFile(new URL("../adapters/eds/martech.js", import.meta.url), "utf8")).split("\n").slice(0, 25).join("\n");
    const notices = await readFile(new URL("../THIRD_PARTY_NOTICES.md", import.meta.url), "utf8");
    for (const text of [header, notices]) {
      expect(text).toContain("adobe-rnd/aem-martech");
      expect(text).toContain("Apache License, Version 2.0");
    }
  });

  it("the header names the inert options and the differences (AC7)", async () => {
    const header = (await readFile(new URL("../adapters/eds/martech.js", import.meta.url), "utf8")).split("\n").slice(0, 70).join("\n");
    for (const name of ["debugEnabled", "targetMigrationEnabled", "autoCollectPropositionInteractions"]) expect(header).toContain(name);
  });
});
