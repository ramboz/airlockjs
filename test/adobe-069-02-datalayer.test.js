import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDataLayer, FORWARD_SKIP_EVENTS, MAX_DEPTH } from "../adapters/eds/martech-datalayer.js";
import { createAirlock } from "../core/airlock.js";
import { DEFAULT_DENYLIST } from "../core/payload-governance.js";
import { createAlloyConnector } from "../connectors/alloy/connector.js";

// Slice 069-02: Airlock's generic data layer and the opt-in adobeDataLayer proxy. HERMETIC (no browser): the real-Chromium
// differentials against ACDL 3.0.1 and the real aem-martech are in test/adobe-069-02-datalayer-chromium.test.js.

const tick = () => new Promise((r) => setTimeout(r, 0));
let diags;
let warn;
const make = (over = {}) => createDataLayer({ diagnose: (r) => diags.push(r), ...over });
const kinds = () => diags.map((d) => d.kind);

beforeEach(() => {
  diags = [];
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("069-02 AC1: the generic mechanism, no global", () => {
  it("creating, pushing and reading state touch no page global", async () => {
    const reads = [];
    const sentinel = new Proxy({}, { get: (_t, k) => { reads.push(String(k)); return undefined; }, set: (_t, k) => { reads.push(`set ${String(k)}`); return true; }, has: (_t, k) => { reads.push(`has ${String(k)}`); return false; } });
    const before = Object.keys(globalThis).sort();
    for (const name of ["adobeDataLayer", "alloy", "__alloyNS", "acdl"]) vi.stubGlobal(name, sentinel);
    const dl = make();
    dl.attach();
    dl.push({ event: "e", xdm: { a: 1 } });
    dl.push({ page: { name: "p" } });
    dl.getState();
    dl.getState("page.name");
    await tick();
    expect(reads).toEqual([]);
    for (const name of ["adobeDataLayer", "alloy", "__alloyNS", "acdl"]) expect(globalThis[name]).toBe(sentinel);
    vi.unstubAllGlobals();
    expect(Object.keys(globalThis).sort()).toEqual(before);
  });

  it("an `event` that is present must be a non-empty string: a malformed push warns, is diagnosed and never throws", () => {
    const dl = make();
    for (const bad of [{ event: "" }, { event: 5, x: 1 }, { event: {} }, null, 7, "str", [1], undefined]) expect(() => dl.push(bad)).not.toThrow();
    expect(kinds().filter((k) => k === "datalayer-bad-push")).toHaveLength(8);
    expect(warn).toHaveBeenCalledTimes(8);
    expect(dl.getState()).toEqual({});
  });

  it("a push with no event is a state push: it changes state and maps no event", async () => {
    const onEvent = vi.fn();
    const dl = make({ onEvent });
    dl.attach();
    dl.push({ user: { tier: "gold" } });
    await tick();
    expect(dl.getState("user.tier")).toBe("gold");
    expect(onEvent).not.toHaveBeenCalled();
  });
});

describe("069-02 AC2: capture is O(1) and runs no page code", () => {
  it("a getter on a pushed object is never invoked and the push is dropped", () => {
    const dl = make();
    let calls = 0;
    dl.push({ event: "e", get xdm() { calls += 1; return {}; } });
    dl.push({ nested: { get deep() { calls += 1; return 1; } } });
    expect(calls).toBe(0);
    expect(kinds()).toEqual(["datalayer-bad-push", "datalayer-bad-push"]);
    expect(dl.getState()).toEqual({});
  });

  it("a Proxy is dropped and none of its value-reading traps is hit", () => {
    const dl = make();
    const hits = [];
    const trap = (name) => (...a) => { hits.push(name); return Reflect[name](...a); };
    const p = new Proxy({ event: "e", a: 1 }, { get: trap("get"), set: trap("set"), has: trap("has"), deleteProperty: trap("deleteProperty"), defineProperty: trap("defineProperty") });
    dl.push(p);
    dl.push({ ok: { inner: p } });
    expect(hits).toEqual([]);
    expect(kinds()).toEqual(["datalayer-bad-push", "datalayer-bad-push"]);
    expect(dl.getState()).toEqual({});
  });

  it("a non-plain prototype, a cycle and an over-deep object are dropped without overflowing the stack", () => {
    const dl = make();
    class Foo { constructor() { this.a = 1; } }
    dl.push(new Foo());
    const cyc = { event: "e" };
    cyc.self = cyc;
    dl.push(cyc);
    let deep = { leaf: 1 };
    for (let i = 0; i < MAX_DEPTH + 5; i += 1) deep = { d: deep };
    dl.push(deep);
    let huge = { leaf: 1 };
    for (let i = 0; i < 50000; i += 1) huge = { d: huge };
    dl.push(huge);
    dl.push({ shared: (() => { const s = { v: 1 }; return { a: s, b: s }; })() });
    expect(kinds()).toEqual(["datalayer-bad-push", "datalayer-bad-push", "datalayer-bad-push", "datalayer-bad-push"]);
    expect(dl.getState("shared.b.v")).toBe(1);
  });

  it("the push walk costs the same for a state of 10 keys and of 10,000", () => {
    const visits = (n) => {
      const dl = make();
      const big = {};
      for (let i = 0; i < n; i += 1) big[`k${i}`] = { v: i };
      dl.push(big);
      dl.getState();
      const before = dl.stats().pushVisits;
      dl.push({ event: "e", xdm: { a: { b: 1 } }, data: { c: 2 } });
      return dl.stats().pushVisits - before;
    };
    expect(visits(10)).toBe(visits(10000));
    expect(visits(10)).toBe(4);
  });

  it("push calls no hook and no consumer before it returns; the drain is a separate task, not a microtask", async () => {
    const onEvent = vi.fn();
    const shouldProcessEvent = vi.fn(() => true);
    const dl = make({ onEvent, shouldProcessEvent });
    dl.attach();
    await tick();
    dl.push({ event: "e", xdm: {} });
    expect(shouldProcessEvent).not.toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalled();
    await Promise.resolve();
    await Promise.resolve();
    expect(onEvent).not.toHaveBeenCalled();
    await tick();
    expect(shouldProcessEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it("the drain and a direct call keep order in one queue", async () => {
    const order = [];
    const dl = make({ onEvent: (xdm) => order.push(xdm.eventType) });
    dl.push({ event: "a" });
    dl.enqueue(() => order.push("direct"));
    dl.push({ event: "b" });
    dl.attach();
    await tick();
    expect(order).toEqual(["a", "direct", "b"]);
  });
});

describe("069-02 AC3: state equals ACDL's, folded lazily", () => {
  it("push does not fold: the reducer's visit counter is zero after a thousand pushes", () => {
    const dl = make();
    for (let i = 0; i < 1000; i += 1) dl.push({ k: { i } });
    expect(dl.stats().foldVisits).toBe(0);
    expect(dl.getState("k.i")).toBe(999);
    expect(dl.stats().foldVisits).toBeGreaterThan(0);
  });

  it("a reference taken from getState() stays live and shows later pushes after the next read", () => {
    const dl = make();
    dl.push({ a: { b: 1 } });
    const ref = dl.getState();
    dl.push({ a: { c: 2 }, z: 1 });
    dl.getState();
    expect(ref).toEqual({ a: { b: 1, c: 2 }, z: 1 });
    expect(dl.getState()).toBe(ref);
    expect(dl.getState("a")).toBe(ref.a);
  });

  it("is a deep merge (ACDL's rules): null deletes, arrays replace, an object never replaces a scalar or an array", () => {
    const dl = make();
    dl.push({ a: { b: 1, c: [1, 2], d: 5 }, s: 1, arr: [1], o: { k: 1 } });
    dl.push({ a: { b: null, c: [9] }, s: { x: 1 }, arr: { y: 1 }, o: [1], n: null, e: { f: null, g: 1 } });
    expect(dl.getState()).toEqual({ a: { c: [9], d: 5 }, s: 1, arr: [1], o: [1], e: { g: 1 } });
  });

  it("an event item's data folds (without `event` and `eventInfo`), and the state read in a hook includes every push so far", async () => {
    const seen = [];
    const dl = make({ shouldProcessEvent: () => { seen.push(structuredClone(dl.getState())); return true; } });
    dl.attach();
    dl.push({ event: "e1", eventInfo: { k: 1 }, data: { n: 1 }, user: { a: 1 } });
    dl.push({ event: "e2", user: { b: 2 } });
    await tick();
    // The drain is asynchronous, so a hook reads every push made so far (ACDL's synchronous listener saw up to that push): a recorded deviation.
    const full = { data: { n: 1 }, user: { a: 1, b: 2 } };
    expect(seen).toEqual([full, full]);
    expect(dl.getState()).toEqual(full);
  });

  it("is NOT core's per-event projection: core keeps the last write per event type, the data layer deep-merges", () => {
    class W { constructor() { this.messages = []; } postMessage(m) { this.messages.push(m); } terminate() {} }
    vi.stubGlobal("Worker", W);
    vi.stubGlobal("requestIdleCallback", (cb) => { cb({ didTimeout: false, timeRemaining: () => 0 }); return 1; });
    const airlock = createAirlock({ trackers: 1, workFactor: 0, endpoints: ["https://t0.example/collect"], ctx: { clientId: "1.2", sessionId: "3" }, unloadCritical: [] });
    const dl = make();
    for (const evt of [{ event: "cta", a: 1 }, { event: "cta", b: 2 }]) { airlock.push(evt); dl.push(evt); }
    expect(airlock.getState("cta.params")).toEqual({ b: 2 });
    expect(dl.getState()).toEqual({ a: 1, b: 2 });
  });

  it("no push pollutes Object.prototype (own keys, __proto__, constructor and prototype are skipped)", () => {
    const dl = make();
    dl.push(JSON.parse('{"__proto__":{"polluted":1},"constructor":{"prototype":{"p2":1}},"ok":{"__proto__":{"p3":1}}}'));
    dl.push({ event: "e", data: JSON.parse('{"__proto__":{"p4":1}}') });
    const state = dl.getState();
    expect({}.polluted).toBeUndefined();
    expect({}.p2).toBeUndefined();
    expect({}.p3).toBeUndefined();
    expect({}.p4).toBeUndefined();
    expect(Object.keys(state)).toEqual(["ok", "data"]);
    expect(Object.getPrototypeOf(state)).toBe(Object.prototype);
  });

  it("the state does not alias what was pushed, and getStateSnapshot hands out a copy a hook can edit", () => {
    const dl = make();
    const pushed = { xdm: { a: { b: 1 } }, list: [{ x: 1 }] };
    dl.push(pushed);
    pushed.xdm.a.b = 99;
    pushed.list[0].x = 99;
    expect(dl.getState()).toEqual({ xdm: { a: { b: 1 } }, list: [{ x: 1 }] });
    const copy = dl.getStateSnapshot();
    copy.xdm.a.b = "edited";
    expect(dl.getState("xdm.a.b")).toBe(1);
  });

  it("getState(path) reads dotted and indexed paths and returns undefined for a missing one", () => {
    const dl = make();
    dl.push({ a: { b: [{ c: 7 }] } });
    expect(    dl.getState("a.b.0.c")).toBe(7);
    expect(dl.getState("a.zz.c")).toBeUndefined();
    expect(dl.getState("__proto__.x")).toBeUndefined();
  });
});

describe("069-02 AC4: event mapping and timing", () => {
  it("maps event, xdm, data and configOverrides to sendAnalyticsEvent's arguments and ignores every other key", async () => {
    const onEvent = vi.fn();
    const dl = make({ onEvent });
    dl.attach();
    const pushed = { event: "cta", xdm: { web: { x: 1 } }, data: { d: 1 }, configOverrides: { c: 1 }, renderDecisions: true, decisionScopes: ["s"], consent: { a: 1 } };
    const frozen = JSON.stringify(pushed);
    dl.push(pushed);
    await tick();
    expect(onEvent).toHaveBeenCalledWith({ eventType: "cta", web: { x: 1 } }, { d: 1 }, { c: 1 });
    expect(onEvent.mock.calls[0]).toHaveLength(3);
    expect(JSON.stringify(pushed)).toBe(frozen);
  });

  it("events captured before attach are held and replayed in order; nothing goes out before attach", async () => {
    const order = [];
    const dl = make({ onEvent: (x) => order.push(x.eventType) });
    dl.push({ event: "a" });
    dl.push({ event: "b" });
    await tick();
    expect(order).toEqual([]);
    dl.attach();
    dl.push({ event: "c" });
    await tick();
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("with analytics: false the state is kept and no event is mapped or forwarded", async () => {
    const onEvent = vi.fn();
    const airlock = { push: vi.fn() };
    const dl = make({ onEvent, airlock });
    dl.attach({ analytics: false });
    dl.push({ event: "e", data: { d: 1 } });
    await tick();
    expect(onEvent).not.toHaveBeenCalled();
    expect(airlock.push).not.toHaveBeenCalled();
    expect(dl.getState("data.d")).toBe(1);
  });

  it("shouldProcessEvent false drops the event, and a throwing one drops it with hook-threw", async () => {
    const onEvent = vi.fn();
    let mode = "false";
    const dl = make({ onEvent, shouldProcessEvent: () => { if (mode === "throw") throw new Error("nope"); return false; } });
    dl.attach();
    dl.push({ event: "a" });
    await tick();
    mode = "throw";
    dl.push({ event: "b" });
    await tick();
    expect(onEvent).not.toHaveBeenCalled();
    expect(diags).toEqual([expect.objectContaining({ kind: "hook-threw", option: "shouldProcessEvent" })]);
    expect(dl.getState()).toEqual({});
  });

  it("only calls onEvent: it holds no handle (a consent gate is the library's sendEvent and the seal)", async () => {
    const dl = make();
    expect(Object.keys(dl).sort()).toEqual(["attach", "enqueue", "getState", "getStateSnapshot", "installAdobeDataLayerProxy", "push", "scanBlocks", "stats"]);
  });
});

describe("069-02 AC5/AC6: the opt-in proxy and what cannot cross", () => {
  let win;
  beforeEach(() => { win = {}; vi.stubGlobal("window", win); });

  it("a function push is never executed (data layer and proxy), with a diagnostic", () => {
    const dl = make();
    const fn = vi.fn();
    dl.push(fn);
    win.adobeDataLayer = [fn, { a: 1 }];
    dl.installAdobeDataLayerProxy();
    win.adobeDataLayer.push(fn);
    expect(fn).not.toHaveBeenCalled();
    expect(kinds().filter((k) => k === "datalayer-function-push-dropped")).toHaveLength(3);
    expect(dl.getState("a")).toBe(1);
  });

  it("drains the entries already on the array in order, patches push on the same instance and keeps appending", async () => {
    const order = [];
    const dl = make({ onEvent: (x) => order.push(x.eventType) });
    dl.attach();
    const arr = [{ event: "first" }, { page: { n: 1 } }, { event: "second" }];
    win.adobeDataLayer = arr;
    const early = arr.push;
    expect(dl.installAdobeDataLayerProxy()).toEqual({ installed: true, instanceName: "adobeDataLayer" });
    expect(win.adobeDataLayer).toBe(arr);
    expect(arr.push).not.toBe(early);
    expect(arr.push({ event: "third" })).toBe(4);
    await tick();
    expect(order).toEqual(["first", "second", "third"]);
    expect(arr).toHaveLength(4);
    expect(dl.getState("page.n")).toBe(1);
    expect(Object.keys(arr)).toEqual(["0", "1", "2", "3"]);
  });

  it("creates the array when the page has none, and exposes the live state through getState", () => {
    const dl = make();
    dl.installAdobeDataLayerProxy();
    win.adobeDataLayer.push({ a: { b: 1 } });
    const state = win.adobeDataLayer.getState();
    expect(state).toBe(dl.getState());
    expect(state.a.b).toBe(1);
  });

  it("with a custom instanceName writes exactly that name and leaves window.adobeDataLayer alone", () => {
    const dl = make();
    dl.installAdobeDataLayerProxy({ instanceName: "myLayer" });
    expect(Object.keys(win)).toEqual(["myLayer"]);
    expect("adobeDataLayer" in win).toBe(false);
    win.myLayer.push({ x: 1 });
    expect(dl.getState("x")).toBe(1);
    win.adobeDataLayer = ["page-owned"];
    dl.installAdobeDataLayerProxy({ instanceName: "myLayer2" });
    expect(win.adobeDataLayer).toEqual(["page-owned"]);
    expect(Object.keys(win.adobeDataLayer)).toEqual(["0"]);
  });

  it("addEventListener, removeEventListener, on and off register nothing, do not throw and are diagnosed", () => {
    const dl = make();
    dl.installAdobeDataLayerProxy();
    const cb = vi.fn();
    for (const name of ["addEventListener", "removeEventListener", "on", "off"]) expect(() => win.adobeDataLayer[name]("adobeDataLayer:change", cb)).not.toThrow();
    win.adobeDataLayer.push({ event: "e" });
    expect(cb).not.toHaveBeenCalled();
    expect(kinds().filter((k) => k === "datalayer-listener-not-supported")).toHaveLength(4);
  });

  it("getState returns the live state, not a clone (ACDL returns a clone)", () => {
    const dl = make();
    dl.installAdobeDataLayerProxy();
    win.adobeDataLayer.push({ a: 1 });
    const live = win.adobeDataLayer.getState();
    live.a = "page-edit";
    expect(win.adobeDataLayer.getState().a).toBe("page-edit");
  });

  it("a foreign ACDL on the array is not replaced: datalayer-foreign-implementation", () => {
    const dl = make();
    const foreignPush = vi.fn();
    const arr = Object.assign([], { push: foreignPush, getState: () => ({}), addEventListener() {} });
    win.adobeDataLayer = arr;
    expect(dl.installAdobeDataLayerProxy()).toEqual({ installed: false });
    expect(arr.push).toBe(foreignPush);
    expect(kinds()).toEqual(["datalayer-foreign-implementation"]);
    win.other = { not: "an array" };
    expect(dl.installAdobeDataLayerProxy({ instanceName: "other" })).toEqual({ installed: false });
  });

  it("an implementation that loads later and replaces push is detected: forwarding stops, so no event is sent twice", async () => {
    const onEvent = vi.fn();
    const dl = make({ onEvent });
    dl.attach();
    dl.installAdobeDataLayerProxy();
    const arr = win.adobeDataLayer;
    arr.push({ event: "before" });
    await tick();
    expect(onEvent).toHaveBeenCalledTimes(1);
    // The stand-in wraps the proxy's push and replays the entries already on the array, as a late ACDL does.
    const ours = arr.push;
    const stand = function (...items) { return ours.apply(this, items); };
    arr.push = stand;
    for (const entry of arr.slice()) stand(entry);
    arr.push({ event: "after" });
    await tick();
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(kinds().filter((k) => k === "datalayer-foreign-implementation")).toHaveLength(1);
  });

  it("a replacement that never calls the proxy's push is detected at the next drain", async () => {
    const dl = make();
    dl.installAdobeDataLayerProxy();
    win.adobeDataLayer.push = function replaced() {};
    dl.push({ a: 1 });
    await tick();
    expect(kinds()).toEqual(["datalayer-foreign-implementation"]);
  });

  it("alloy and __alloyNS are rejected as the instance name with a plain Error", () => {
    const dl = make();
    for (const instanceName of ["alloy", "__alloyNS", "", 5]) {
      let err;
      try { dl.installAdobeDataLayerProxy({ instanceName }); } catch (e) { err = e; }
      expect(Object.getPrototypeOf(err)).toBe(Error.prototype);
    }
    expect(Object.keys(win)).toEqual([]);
  });

  it("is never installed by anything else: a data layer used through push, attach and the drain leaves window untouched", async () => {
    const dl = make({ onEvent() {} });
    dl.attach();
    dl.push({ event: "e" });
    dl.scanBlocks({ querySelectorAll: () => [] });
    await tick();
    expect(Object.keys(win)).toEqual([]);
  });

  it("the proxy touches no global but its one instance name (default, then custom)", () => {
    const touched = [];
    const guard = new Proxy(win, {
      get: (t, k, r) => { touched.push(`get ${String(k)}`); return Reflect.get(t, k, r); },
      set: (t, k, v, r) => { touched.push(`set ${String(k)}`); return Reflect.set(t, k, v, r); },
    });
    vi.stubGlobal("window", guard);
    const dl = make();
    dl.installAdobeDataLayerProxy();
    dl.installAdobeDataLayerProxy({ instanceName: "custom" });
    expect([...new Set(touched)].sort()).toEqual(["get adobeDataLayer", "get custom", "set adobeDataLayer", "set custom"]);
  });
});

describe("069-02 AC7: blocks", () => {
  const el = (cls, json, id = "") => ({ id, classList: cls ? [cls] : [], dataset: { blockDataLayer: json } });
  const docOf = (els) => ({ querySelectorAll: (sel) => (sel.startsWith(".") ? els.filter((e) => e.classList[0] === sel.slice(1)) : els) });

  it("pushes { blocks: { [id]: data } } with stock's id assignment and {} for bad JSON", () => {
    const els = [el("hero", '{"a":1}'), el("hero", '{"parentId":"p","b":2}'), el("", "{not json"), el("cards", '{"c":3}', "given")];
    const dl = make();
    expect(dl.scanBlocks(docOf(els))).toEqual(["1", "p-2", "1", "given"]);
    // stock's id logic gives the class-less block id "1" too, so the two ids collide and merge, as in stock
    expect(dl.getState("blocks")).toEqual({ 1: { a: 1 }, "p-2": { parentId: "p", b: 2 }, given: { c: 3 } });
    expect(els.map((e) => e.id)).toEqual(["1", "p-2", "1", "given"]);
  });
});

describe("069-02 AC8: forward to core and the denylist", () => {
  class W { constructor() { W.last = this; this.messages = []; } postMessage(m) { this.messages.push(m); } terminate() {} }
  const makeAirlock = () => {
    vi.stubGlobal("Worker", W);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve()));
    vi.stubGlobal("requestIdleCallback", (cb) => { cb({ didTimeout: false, timeRemaining: () => 0 }); return 1; });
    return createAirlock({ trackers: 1, workFactor: 0, endpoints: ["https://t0.example/collect"], ctx: { clientId: "1.2", sessionId: "3" }, unloadCritical: [], payloadDenylist: ["data.promo_secret"], onDiagnostic: (r) => diags.push(r) });
  };
  const crossed = () => W.last.messages.filter((m) => m.type === "events").flatMap((m) => m.batch);

  it("the connector receives the event with only xdm and data (never configOverrides), and core's own dispatch strips a denylisted key", async () => {
    const airlock = makeAirlock();
    const dl = make({ airlock });
    dl.attach();
    const builtin = DEFAULT_DENYLIST[0];
    dl.push({ event: "cta_engage", xdm: { label: "Buy" }, data: { promo_secret: "secret", [builtin]: "kept-today", ok: 1 }, configOverrides: { c: 1 }, other: 1 });
    await tick();
    const [batchEvent] = crossed();
    expect(batchEvent.type).toBe("cta_engage");
    // Core strips a dotted host path (data.promo_secret) but not the built-in names nested under `data`: pinned as today's depth.
    expect(batchEvent.params).toEqual({ xdm: { label: "Buy" }, data: { [builtin]: "kept-today", ok: 1 } });
    expect(JSON.stringify(batchEvent)).not.toContain("\"secret\"");
    expect(diags).toContainEqual(expect.objectContaining({ kind: "payload-governance", disposition: "stripped", field: "data.promo_secret" }));
    expect(airlock.getState("cta_engage.params.data").promo_secret).toBe("secret");
  });

  it("a state push is not forwarded", async () => {
    const airlock = makeAirlock();
    const dl = make({ airlock });
    dl.attach();
    dl.push({ user: { a: 1 } });
    await tick();
    expect(crossed()).toEqual([]);
  });

  it("the skip list is pinned to the Alloy connector's subscriptions", () => {
    expect([...FORWARD_SKIP_EVENTS].sort()).toEqual([...createAlloyConnector({}).manifest.events].sort());
  });

  it("a page_view is sent to Alloy once: the forward skips it, the library's own path sends it", async () => {
    const airlock = makeAirlock();
    const alloySends = vi.fn();
    const dl = make({ airlock, onEvent: alloySends });
    dl.attach();
    dl.push({ event: "page_view", xdm: { web: { webPageDetails: { name: "p" } } } });
    dl.push({ event: "cta", xdm: {} });
    await tick();
    expect(alloySends.mock.calls.map((c) => c[0].eventType)).toEqual(["page_view", "cta"]);
    expect(crossed().map((e) => e.type)).toEqual(["cta"]);
  });

  it("pins that the Alloy path has no denylist coverage: a denylisted key in xdm reaches onEvent unchanged", async () => {
    const onEvent = vi.fn();
    const key = DEFAULT_DENYLIST[0];
    const dl = make({ onEvent });
    dl.attach();
    dl.push({ event: "e", xdm: { [key]: "kept" }, data: { [key]: "kept" } });
    await tick();
    expect(onEvent).toHaveBeenCalledWith({ eventType: "e", [key]: "kept" }, { [key]: "kept" }, undefined);
  });
});

describe("069-02 AC9: no capability", () => {
  it("holds nothing but the callbacks it was given and has no handle, chamber or command surface", () => {
    const dl = make();
    expect(Object.keys(dl)).not.toEqual(expect.arrayContaining(["command", "sendEvent", "setConsent", "handle"]));
  });
});
