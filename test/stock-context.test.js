// Spec 067-07 (ADR-0062 point 2): the host-collected stock-context channel.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";
import { createConnectorHost } from "../core/connector-host.js";
import {
  collectStockContext,
  governStockContext,
  createStockContextStore,
  EMPTY_STOCK_CONTEXT,
  STOCK_CONTEXT_GROUPS,
} from "../core/stock-context.js";

const fakeWin = (over = {}) => ({
  location: {
    href: "https://shop.example/p/1?q=2#top", origin: "https://shop.example", protocol: "https:",
    host: "shop.example", hostname: "shop.example", pathname: "/p/1", search: "?q=2", hash: "#top",
  },
  document: { referrer: "https://ref.example/", title: "Product" },
  screen: { width: 1920, height: 1080, colorDepth: 24, orientation: { type: "landscape-primary" } },
  devicePixelRatio: 2,
  innerWidth: 1000,
  innerHeight: 700,
  navigator: {
    userAgent: "UA/1", language: "fr-FR", languages: ["fr-FR", "en"], cookieEnabled: true, doNotTrack: null,
    userAgentData: { platform: "macOS", mobile: false, brands: [{ brand: "Chromium", version: "130" }] },
  },
  ...over,
});
const now = () => new Date(2026, 10, 13, 14, 9, 15, 42);

describe("collectStockContext", () => {
  it("stock default: all groups, flat structured-cloneable records", () => {
    const ctx = collectStockContext({ win: fakeWin(), now });
    expect(Object.keys(ctx)).toEqual([...STOCK_CONTEXT_GROUPS]);
    expect(ctx.web).toMatchObject({ url: "https://shop.example/p/1?q=2#top", referrer: "https://ref.example/", pathname: "/p/1" });
    expect(ctx.device).toMatchObject({ screenWidth: 1920, screenHeight: 1080, screenOrientation: "landscape-primary" });
    expect(ctx.environment).toMatchObject({ viewportWidth: 1000, language: "fr-FR", platform: "macOS", brands: ["Chromium/130"] });
    expect(ctx.placeContext.localTime).toMatch(/^2026-11-13T14:09:15\.042[+-]\d\d:\d\d$/);
    expect(structuredClone(ctx)).toEqual(ctx);
  });

  it("omits what the page cannot supply instead of faking it", () => {
    const ctx = collectStockContext({ win: { location: { href: "https://a.example/" } }, now });
    expect(ctx.web).toEqual({ url: "https://a.example/" });
    expect(ctx.device).toEqual({});
  });

  it("narrowed opt-in: only the listed groups; unknown names ignored", () => {
    const ctx = collectStockContext({ groups: ["web", "nope"], win: fakeWin(), now });
    expect(Object.keys(ctx)).toEqual(["web"]);
    expect(collectStockContext({ groups: [], win: fakeWin(), now })).toEqual({});
  });

  it("site denylist (group.field) strips a field; credentials-named fields never cross", () => {
    const ctx = collectStockContext({ denylist: ["web.referrer"], win: fakeWin(), now });
    expect(ctx.web.referrer).toBeUndefined();
    expect(ctx.web.url).toBeDefined();
    // the built-in credentials list runs on every record: it is not optional
    const bare = collectStockContext({ denylist: ["screenWidth"], win: fakeWin(), now });
    expect(bare.device.screenWidth).toBeUndefined();
    expect(bare.device.screenHeight).toBe(1080);
  });

  it("the built-in credentials denylist always applies, whatever the site passes", () => {
    const dirty = { web: { url: "u", password: "x", CVV: "1" }, device: { ssn: "2" } };
    for (const deny of [undefined, [], null, ["web.url"]]) {
      const out = governStockContext(dirty, deny);
      expect(out.web.password).toBeUndefined();
      expect(out.web.CVV).toBeUndefined();
      expect(out.device.ssn).toBeUndefined();
    }
  });

  it("a throwing page getter does not break collection", () => {
    const win = fakeWin();
    Object.defineProperty(win, "screen", { get() { throw new Error("boom"); } });
    expect(collectStockContext({ win, now }).device).toEqual({});
  });
});

describe("chamber-side store / connector host read function", () => {
  it("unset channel reads as an explicit empty value", () => {
    expect(createStockContextStore().read()).toBe(EMPTY_STOCK_CONTEXT);
    const host = createConnectorHost(() => ({ manifest: {}, init() {}, handle: () => [] }), {});
    expect(host.readStockContext()).toEqual({});
  });

  it("accepts a stock-context message and ignores other types", () => {
    const host = createConnectorHost(() => ({ manifest: {}, init() {}, handle: () => [] }), {});
    expect(host.acceptStockContext({ type: "events" })).toBe(false);
    expect(host.acceptStockContext({ type: "stock-context", context: { web: { url: "u" }, junk: { a: 1 } } })).toBe(true);
    expect(host.readStockContext()).toEqual({ web: { url: "u" } });
    expect(Object.isFrozen(host.readStockContext())).toBe(true);
  });
});

class FakeWorker {
  constructor() { FakeWorker.last = this; this.messages = []; }
  postMessage(m) { this.messages.push(m); }
  terminate() {}
}
const listeners = new Map();
const base = { trackers: 1, workFactor: 0, endpoints: ["https://t0.example/collect"], ctx: { clientId: "1.2", sessionId: "3" }, unloadCritical: [] };

describe("createAirlock stockContext channel", () => {
  beforeEach(() => {
    listeners.clear();
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("requestIdleCallback", (fn) => setTimeout(fn, 0));
    vi.stubGlobal("addEventListener", (t, fn) => listeners.set(t, [...(listeners.get(t) || []), fn]));
    vi.stubGlobal("removeEventListener", (t, fn) => {
      const rest = (listeners.get(t) || []).filter((f) => f !== fn);
      if (rest.length) listeners.set(t, rest); else listeners.delete(t);
    });
    const w = fakeWin();
    for (const k of ["location", "document", "screen", "navigator"]) vi.stubGlobal(k, w[k]);
    vi.stubGlobal("devicePixelRatio", 2);
    vi.stubGlobal("innerWidth", 1000);
    vi.stubGlobal("innerHeight", 700);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  const eventsOf = (w) => w.messages.filter((m) => m.type === "events");

  it("is off by default: no extra message", () => {
    createAirlock(base);
    expect(FakeWorker.last.messages.map((m) => m.type)).toEqual(["init"]);
    expect([...listeners.keys()].sort()).toEqual(["pagehide", "visibilitychange"]); // only the pre-existing unload listeners
  });

  it("posts a dedicated message at boot; the event batches are byte-identical with and without it", async () => {
    const run = async (opts) => {
      const a = createAirlock({ ...base, ...opts });
      a.push({ event: "page_view", a: 1 });
      a.flushNow();
      const w = FakeWorker.last;
      a.dispose();
      return w;
    };
    const off = await run({});
    const on = await run({ stockContext: true });
    const strip = (m) => JSON.stringify(eventsOf(m).map((e) => e.batch.map(({ ts: _t, ...d }) => d)));
    expect(strip(on)).toBe(strip(off));
    const ctxMsgs = on.messages.filter((m) => m.type === "stock-context");
    expect(ctxMsgs).toHaveLength(1);
    expect(Object.keys(ctxMsgs[0].context)).toEqual([...STOCK_CONTEXT_GROUPS]);
    expect(JSON.stringify(eventsOf(on))).not.toContain("shop.example");
  });

  it("narrowed config posts only the listed groups", () => {
    createAirlock({ ...base, stockContext: { groups: ["web"] } });
    const m = FakeWorker.last.messages.find((x) => x.type === "stock-context");
    expect(Object.keys(m.context)).toEqual(["web"]);
  });

  it("re-collects debounced off the handler on a change, only when something changed", () => {
    const a = createAirlock({ ...base, stockContext: true });
    const count = () => FakeWorker.last.messages.filter((m) => m.type === "stock-context").length;
    listeners.get("resize")[0]();
    listeners.get("resize")[0]();
    expect(count()).toBe(1); // handler did no collection
    vi.advanceTimersByTime(200);
    expect(count()).toBe(1); // nothing but the clock changed
    vi.stubGlobal("innerWidth", 500);
    listeners.get("resize")[0]();
    vi.advanceTimersByTime(200);
    expect(count()).toBe(2);
    a.dispose();
    expect(listeners.has("resize")).toBe(false);
    FakeWorker.last.messages.length = 0;
    a.refreshStockContext();
    expect(FakeWorker.last.messages).toEqual([]);
  });

  it("sends nothing to a vendor itself: no fetch during collection", () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    createAirlock({ ...base, stockContext: true });
    expect(f).not.toHaveBeenCalled();
  });
});
