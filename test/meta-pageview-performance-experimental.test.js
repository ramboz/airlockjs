import { afterEach, describe, expect, it, vi } from "vitest";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { closePrototypeResources, createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const pixel = "000000000000000";
const base = { pageURL: "https://example.test/", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: 0 };
const timing = (modern, entry, start, end, legacy) => ({
  performanceModernAvailable: modern, performanceNavigationEntryAvailable: entry,
  performanceStartTime: start, performanceDomContentLoadedEventEnd: end,
  performanceNavigationStart: legacy,
});
const event = (args, raw) => ({ type: "meta-pixel-command", payload: { args, context: { ...base, ...raw } } });
const params = (requests) => new URL(requests[0].url).searchParams;
const modern = (start, end) => timing(true, true, start, end, null);
const absent = timing(true, false, null, null, null);
const legacy = (start, end) => timing(false, false, null, end, start);
const connector = () => {
  const instance = createMetaPageViewPrototype({ endpoint: "http://127.0.0.1:1234/tr/", experimentalPageViewPerformance: true });
  instance.init({});
  return instance;
};
afterEach(() => vi.unstubAllGlobals());

describe("offline PageView timing experiment", () => {
  it("samples a positive fractional modern initialization once and caches it", () => {
    const c = connector();
    c.handle(event(["init", pixel], modern(2.25, 12.75)));
    expect(params(c.handle(event(["track", "PageView"], modern(1, 200)))).get("plt")).toBe("10.5");
    expect(params(c.handle(event(["track", "PageView"], legacy(100, 400)))).get("plt")).toBe("10.5");
  });

  it("serializes raw samples through the real worker and local consent seal", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    const samples = [modern(4, 4), absent, modern(1.25, 4.75), modern(0, 100)];
    const adapter = createMetaPixelPrototype({ endpoint: receiver.endpoint, chamber,
      captureContext: () => ({ ...base, ...samples.shift() }),
      consent: { ad_storage: "granted" }, experimentalPageViewPerformance: true });
    try {
      adapter.fbq("init", pixel);
      adapter.fbq("track", "PageView");
      adapter.fbq("track", "PageView");
      adapter.fbq("track", "PageView");
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual([
        "initialized", "transport-settled", "transport-settled", "transport-settled",
      ]);
      expect(receiver.arrivals.map(({ url }) => new URL(url).searchParams.get("plt"))).toEqual([null, "3.5", "3.5"]);
    } finally { await closePrototypeResources({ adapter, chamber, receiver }); }
  }, 5000);

  it("uses legacy only without the modern API, never for an empty modern result", () => {
    const c = connector();
    c.handle(event(["init", pixel], absent));
    expect(params(c.handle(event(["track", "PageView"], absent))).has("plt")).toBe(false);
    expect(params(c.handle(event(["track", "PageView"], legacy(100.5, 120.75)))).get("plt")).toBe("20.25");
    const invalid = { ...absent, performanceNavigationStart: 1, performanceDomContentLoadedEventEnd: 100 };
    expect(() => c.handle(event(["track", "PageView"], invalid))).toThrow("invalid-context");
  });

  it("omits zero and negative timing, retries, and ignores non-PageView events", () => {
    const c = createMetaPageViewPrototype({ endpoint: "http://127.0.0.1:1234/tr/",
      experimentalPageViewPerformance: true, experimentalEvents: true });
    c.init({});
    c.handle(event(["init", pixel], modern(8, 3)));
    expect(params(c.handle(event(["track", "PageView"], modern(3, 3)))).has("plt")).toBe(false);
    expect(params(c.handle(event(["track", "Purchase"], {}))).has("plt")).toBe(false);
    expect(params(c.handle(event(["track", "PageView"], modern(3, 4)))).get("plt")).toBe("1");
  });

  it("rejects negative raw timestamps at host admission", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    const samples = [modern(-1, 5), modern(0, -1), legacy(-1, 5), legacy(0, -1)];
    const adapter = createMetaPixelPrototype({ endpoint: receiver.endpoint, chamber,
      captureContext: () => ({ ...base, ...samples.shift() }),
      consent: { ad_storage: "granted" }, experimentalPageViewPerformance: true });
    try {
      for (let i = 0; i < 4; i += 1) adapter.fbq("init", pixel);
      expect((await adapter.flush()).outcomes.map(({ reason }) => reason))
        .toEqual(["unsupported-context", "unsupported-context", "unsupported-context", "unsupported-context"]);
      expect(receiver.arrivals).toEqual([]);
    } finally { await closePrototypeResources({ adapter, chamber, receiver }); }
  }, 5000);

  it("rejects negative raw timestamps independently in the serialized worker", async () => {
    const receiver = await createPrototypeReceiver();
    const worker = createNodePrototypeChamber();
    const negatives = [modern(-1, 5), modern(0, -1), legacy(-1, 5), legacy(0, -1)];
    const chamber = { ...worker, postMessage(message) {
      if (message.type === "event" && message.event.payload.args[0] === "track") {
        message = structuredClone(message);
        Object.assign(message.event.payload.context, negatives.shift());
      }
      worker.postMessage(message);
    } };
    const adapter = createMetaPixelPrototype({ endpoint: receiver.endpoint, chamber,
      captureContext: () => ({ ...base, ...modern(2, 2) }),
      consent: { ad_storage: "granted" }, experimentalPageViewPerformance: true });
    try {
      adapter.fbq("init", pixel);
      for (let i = 0; i < 4; i += 1) adapter.fbq("track", "PageView");
      const state = await adapter.flush();
      expect(state.outcomes.slice(1).map(({ reason }) => reason))
        .toEqual(["invalid-context", "invalid-context", "invalid-context", "invalid-context"]);
      expect(receiver.arrivals).toEqual([]);
    } finally { await closePrototypeResources({ adapter, chamber, receiver }); }
  }, 5000);

  it("rejects malformed, inherited, accessor and object samples even after caching", () => {
    const c = connector();
    c.handle(event(["init", pixel], modern(0, 3)));
    for (const raw of [
      { ...modern(0, NaN) }, { ...modern(0, Infinity) }, { ...modern(0, {}) },
      { ...modern(0, 2), performanceModernAvailable: "true" },
      { ...modern(0, 2), performanceStartTime: undefined },
    ]) expect(() => c.handle(event(["track", "PageView"], raw))).toThrow("invalid-context");
    const inherited = Object.create(modern(0, 2));
    Object.assign(inherited, base);
    expect(() => c.handle({ type: "meta-pixel-command", payload: { args: ["track", "PageView"], context: inherited } }))
      .toThrow("invalid-context");
    const accessor = { ...base, ...modern(0, 2) };
    Object.defineProperty(accessor, "performanceStartTime", { enumerable: true, get() { throw new Error("read"); } });
    expect(() => c.handle({ type: "meta-pixel-command", payload: { args: ["track", "PageView"], context: accessor } }))
      .toThrow("invalid-context");
  });

  it("rejects invalid option types and both live bindings in both factories", () => {
    const endpoint = "https://www.facebook.com/tr/";
    const liveBinding = { pixelId: "123", documentURL: "http://127.0.0.1:1234/meta-delivery/case" };
    const ownedPocBinding = { pixelId: "123",
      documentURL: "https://main--aem-eds-airlock-poc--adobe-rnd.aem.live/?airlock-meta=pageview-v1&meta-pixel=off&consent=accept&run=synthetic",
      notBefore: 1700000000000, notAfter: 1700000300000 };
    for (const factory of [createMetaPageViewPrototype, createMetaPixelPrototype]) {
      for (const binding of [{ liveBinding }, { ownedPocBinding }]) {
        expect(() => factory({ endpoint, ...binding, experimentalPageViewPerformance: true })).toThrow("incompatible-live-feature");
      }
      for (const invalid of ["true", null, 1]) {
        expect(() => factory({ endpoint: "http://127.0.0.1:1234/tr/", experimentalPageViewPerformance: invalid }))
          .toThrow("invalid-experimental-option");
      }
    }
  });

  it("keeps denied timing at the seal with no receiver arrival", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    const adapter = createMetaPixelPrototype({ endpoint: receiver.endpoint, chamber,
      captureContext: () => ({ ...base, ...modern(1, 4) }),
      consent: { ad_storage: "denied" }, experimentalPageViewPerformance: true });
    try {
      adapter.fbq("init", pixel);
      adapter.fbq("track", "PageView");
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      expect(receiver.arrivals).toEqual([]);
    } finally { await closePrototypeResources({ adapter, chamber, receiver }); }
  }, 5000);

  it("snapshots initialization primitives before the caller can mutate them", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    const context = { ...base, ...modern(2, 5) };
    const adapter = createMetaPixelPrototype({ endpoint: receiver.endpoint, chamber,
      captureContext: () => context, consent: { ad_storage: "granted" }, experimentalPageViewPerformance: true });
    try {
      adapter.fbq("init", pixel);
      context.performanceDomContentLoadedEventEnd = 100;
      adapter.fbq("track", "PageView");
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(new URL(receiver.arrivals[0].url).searchParams.get("plt")).toBe("3");
    } finally { await closePrototypeResources({ adapter, chamber, receiver }); }
  }, 5000);

  it("rejects malformed custom capture and distinguishes capture failure", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    let result = { ...base, ...modern(0, 1), performanceStartTime: {} };
    const adapter = createMetaPixelPrototype({ endpoint: receiver.endpoint, chamber,
      captureContext: () => {
        if (result === null) throw new Error("broken");
        return result;
      }, consent: { ad_storage: "granted" }, experimentalPageViewPerformance: true });
    try {
      adapter.fbq("init", pixel);
      result = null;
      adapter.fbq("init", pixel);
      const state = await adapter.flush();
      expect(state.outcomes.map(({ reason }) => reason)).toEqual(["unsupported-context", "capture-unavailable"]);
      expect(receiver.arrivals).toEqual([]);
    } finally { await closePrototypeResources({ adapter, chamber, receiver }); }
  }, 5000);

  it("does not inspect timing fields or add query keys by default", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    const context = { ...base };
    Object.defineProperty(context, "performanceModernAvailable", { get() { throw new Error("unexpected capture"); } });
    const adapter = createMetaPixelPrototype({ endpoint: receiver.endpoint, chamber,
      captureContext: () => context, consent: { ad_storage: "granted" } });
    try {
      adapter.fbq("init", pixel);
      adapter.fbq("track", "PageView");
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect([...new URL(receiver.arrivals[0].url).searchParams.keys()]).toEqual(["id", "ev", "dl", "rl", "if", "sw", "sh", "tz"]);
    } finally { await closePrototypeResources({ adapter, chamber, receiver }); }
  }, 5000);

  it("captures native-style inherited navigation properties without interpreting them on the host", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    const entry = Object.create({ startTime: 1.125, domContentLoadedEventEnd: 7.375 });
    const getEntriesByType = vi.fn(() => [entry, { startTime: 0, domContentLoadedEventEnd: 999 }]);
    vi.stubGlobal("document", { URL: base.pageURL, referrer: "" });
    vi.stubGlobal("window", { self: 1, top: 1, screen: { width: 412, height: 823 } });
    vi.stubGlobal("performance", { now: () => 1, getEntriesByType });
    const adapter = createMetaPixelPrototype({ endpoint: receiver.endpoint, chamber,
      consent: { ad_storage: "granted" }, experimentalPageViewPerformance: true });
    try {
      adapter.fbq("init", pixel);
      adapter.fbq("track", "PageView");
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(new URL(receiver.arrivals[0].url).searchParams.get("plt")).toBe("6.25");
      expect(getEntriesByType.mock.calls).toEqual([["navigation"], ["navigation"]]);
    } finally { await closePrototypeResources({ adapter, chamber, receiver }); }
  }, 5000);

  it("never queries timing by default and reports broken timing access rather than pretending it is absent", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    vi.stubGlobal("document", { URL: base.pageURL, referrer: "" });
    vi.stubGlobal("window", { self: 1, top: 1, screen: { width: 412, height: 823 } });
    const perf = { now: () => 1 };
    Object.defineProperty(perf, "getEntriesByType", { get() { throw new Error("broken"); } });
    vi.stubGlobal("performance", perf);
    const adapter = createMetaPixelPrototype({ endpoint: receiver.endpoint, chamber,
      consent: { ad_storage: "granted" } });
    try {
      adapter.fbq("init", pixel);
      adapter.fbq("track", "PageView");
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
    } finally { await closePrototypeResources({ adapter, chamber, receiver }); }
    const receiver2 = await createPrototypeReceiver();
    const chamber2 = createNodePrototypeChamber();
    const enabled = createMetaPixelPrototype({ endpoint: receiver2.endpoint, chamber: chamber2,
      consent: { ad_storage: "granted" }, experimentalPageViewPerformance: true });
    try {
      enabled.fbq("init", pixel);
      expect((await enabled.flush()).outcomes.at(-1).reason).toBe("capture-unavailable");
      expect(receiver2.arrivals).toEqual([]);
    } finally { await closePrototypeResources({ adapter: enabled, chamber: chamber2, receiver: receiver2 }); }
  }, 5000);

  it("captures legacy timing only when the modern method is absent", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    vi.stubGlobal("document", { URL: base.pageURL, referrer: "" });
    vi.stubGlobal("window", { self: 1, top: 1, screen: { width: 412, height: 823 } });
    vi.stubGlobal("performance", { now: () => 1, timing: Object.create({
      navigationStart: 100.25, domContentLoadedEventEnd: 125.75,
    }) });
    const adapter = createMetaPixelPrototype({ endpoint: receiver.endpoint, chamber,
      consent: { ad_storage: "granted" }, experimentalPageViewPerformance: true });
    try {
      adapter.fbq("init", pixel);
      adapter.fbq("track", "PageView");
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(new URL(receiver.arrivals[0].url).searchParams.get("plt")).toBe("25.5");
    } finally { await closePrototypeResources({ adapter, chamber, receiver }); }
  }, 5000);

  it("does not read legacy timing when the modern method returns no navigation entry", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    vi.stubGlobal("document", { URL: base.pageURL, referrer: "" });
    vi.stubGlobal("window", { self: 1, top: 1, screen: { width: 412, height: 823 } });
    const perf = { now: () => 1, getEntriesByType: () => [] };
    Object.defineProperty(perf, "timing", { get() { throw new Error("legacy must not be read"); } });
    vi.stubGlobal("performance", perf);
    const adapter = createMetaPixelPrototype({ endpoint: receiver.endpoint, chamber,
      consent: { ad_storage: "granted" }, experimentalPageViewPerformance: true });
    try {
      adapter.fbq("init", pixel);
      adapter.fbq("track", "PageView");
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(new URL(receiver.arrivals[0].url).searchParams.has("plt")).toBe(false);
    } finally { await closePrototypeResources({ adapter, chamber, receiver }); }
  }, 5000);

  it("rejects custom accessor and inherited timing instead of reading them", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    let context = { ...base, ...modern(0, 1) };
    Object.defineProperty(context, "performanceStartTime", { get() { throw new Error("must not read"); } });
    const adapter = createMetaPixelPrototype({ endpoint: receiver.endpoint, chamber, captureContext: () => context,
      consent: { ad_storage: "granted" }, experimentalPageViewPerformance: true });
    try {
      adapter.fbq("init", pixel);
      context = Object.assign(Object.create(modern(0, 2)), base);
      adapter.fbq("init", pixel);
      expect((await adapter.flush()).outcomes.map(({ reason }) => reason)).toEqual(["unsupported-context", "unsupported-context"]);
      expect(receiver.arrivals).toEqual([]);
    } finally { await closePrototypeResources({ adapter, chamber, receiver }); }
  }, 5000);
});
