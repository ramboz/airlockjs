import { afterEach, describe, expect, it, vi } from "vitest";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { closePrototypeResources, createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const pixel = "000000000000000";
const context = { pageURL: "https://example.test/", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: 0 };
const event = (args) => ({ type: "meta-pixel-command", payload: { args, context } });
const fields = (requests) => new URL(requests[0].url).searchParams;

afterEach(() => vi.restoreAllMocks());

describe("local PageView preparation context", () => {
  it("keeps the original eight fields unless explicitly enabled", () => {
    const connector = createMetaPageViewPrototype({ endpoint: "http://127.0.0.1:1234/tr/" });
    connector.init({});
    connector.handle(event(["init", pixel]));
    expect([...fields(connector.handle(event(["track", "PageView"]))).keys()]).toEqual(
      ["id", "ev", "dl", "rl", "if", "sw", "sh", "tz"]);
  });

  it("samples epoch time and increments at preparation before async cookie access, even if it fails", async () => {
    let rejectCookie;
    const cookie = { get: () => new Promise((_resolve, reject) => { rejectCookie = reject; }), set: vi.fn() };
    const now = vi.spyOn(Date, "now").mockReturnValue(1700000000000);
    const connector = createMetaPageViewPrototype({ endpoint: "http://127.0.0.1:1234/tr/",
      experimentalPageViewPreparation: true, experimentalFirstPartyCookie: true });
    connector.init({ cookies: cookie });
    connector.handle(event(["init", pixel]));
    const pending = connector.handle(event(["track", "PageView"]));
    now.mockReturnValue(1700000090000);
    rejectCookie(new Error("failed"));
    await expect(pending).rejects.toThrow("cookie-access-failed");
    cookie.get = async () => "fb.1.1700000000000.42";
    cookie.set = async () => {};
    const result = fields(await connector.handle(event(["track", "PageView"])));
    expect(result.get("ts")).toBe("1700000090000");
    expect(result.get("ec")).toBe("1");
  });

  it("retains the preparation time across a delayed successful cookie read", async () => {
    let release;
    const value = "fb.1.1700000000000.42";
    const cookie = { get: vi.fn().mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }))
      .mockResolvedValue(value), set: vi.fn(async () => {}) };
    const now = vi.spyOn(Date, "now").mockReturnValue(1700000000000);
    const connector = createMetaPageViewPrototype({ endpoint: "http://127.0.0.1:1234/tr/",
      experimentalPageViewPreparation: true, experimentalFirstPartyCookie: true });
    connector.init({ cookies: cookie });
    connector.handle(event(["init", pixel]));
    const pending = connector.handle(event(["track", "PageView"]));
    now.mockReturnValue(1700000090000);
    release(value);
    expect(fields(await pending).get("ts")).toBe("1700000000000");
  });

  it("keeps independent preparation counters for each initialized pixel", () => {
    const connector = createMetaPageViewPrototype({ endpoint: "http://127.0.0.1:1234/tr/",
      experimentalPageViewPreparation: true, experimentalRouting: true, experimentalMultiPixelRouting: true });
    connector.init({});
    connector.handle(event(["init", "1"]));
    connector.handle(event(["init", "2"]));
    expect(fields(connector.handle(event(["trackSingle", "1", "PageView"]))).get("ec")).toBe("0");
    expect(fields(connector.handle(event(["trackSingle", "2", "PageView"]))).get("ec")).toBe("0");
    expect(fields(connector.handle(event(["trackSingle", "1", "PageView"]))).get("ec")).toBe("1");
  });

  it("rejects the experiment on both live and owned bindings in both constructors", () => {
    const endpoint = "https://www.facebook.com/tr/";
    const liveBinding = { pixelId: "123", documentURL: "http://127.0.0.1:1234/meta-delivery/case" };
    const ownedPocBinding = { pixelId: "123",
      documentURL: "https://main--aem-eds-airlock-poc--adobe-rnd.aem.live/?airlock-meta=pageview-v1&meta-pixel=off&consent=accept&run=synthetic",
      notBefore: 1700000000000, notAfter: 1700000300000 };
    for (const factory of [createMetaPageViewPrototype, createMetaPixelPrototype]) {
      for (const binding of [{ liveBinding }, { ownedPocBinding }]) {
        expect(() => factory({ endpoint, ...binding, experimentalPageViewPreparation: true })).toThrow("incompatible-live-feature");
      }
      expect(() => factory({ endpoint: "http://127.0.0.1:1234/tr/", experimentalPageViewPreparation: "true" })).toThrow("invalid-experimental-option");
    }
  });

  it("does not dispatch under denied consent with the experiment enabled", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    const adapter = createMetaPixelPrototype({ endpoint: receiver.endpoint, chamber,
      captureContext: () => context, consent: { ad_storage: "denied" }, experimentalPageViewPreparation: true });
    try {
      adapter.fbq("init", pixel);
      adapter.fbq("track", "PageView");
      const result = await adapter.flush();
      expect(result.outcomes.at(-1).disposition).toBe("held");
      expect(receiver.arrivals).toEqual([]);
    } finally { await closePrototypeResources({ adapter, chamber, receiver }); }
  }, 5000);

  it("uses the actual serialized worker and local receiver", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    const adapter = createMetaPixelPrototype({ endpoint: receiver.endpoint, chamber,
      captureContext: () => context, consent: { ad_storage: "granted" }, experimentalPageViewPreparation: true });
    try {
      const before = Date.now();
      adapter.fbq("init", pixel);
      adapter.fbq("track", "PageView");
      adapter.fbq("track", "PageView");
      const result = await adapter.flush();
      const after = Date.now();
      expect(result.outcomes.map(({ disposition }) => disposition)).toEqual(["initialized", "transport-settled", "transport-settled"]);
      expect(receiver.arrivals.map(({ url }) => new URL(url).searchParams.get("ec"))).toEqual(["0", "1"]);
      for (const { url } of receiver.arrivals) {
        const ts = Number(new URL(url).searchParams.get("ts"));
        expect(ts).toBeGreaterThanOrEqual(before);
        expect(ts).toBeLessThanOrEqual(after);
      }
    } finally { await closePrototypeResources({ adapter, chamber, receiver }); }
  }, 5000);
});
