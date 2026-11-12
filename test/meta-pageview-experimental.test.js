import { describe, expect, it } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
import { createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const pixelId = "000000000000000";
const page = () => ({
  pageURL: "https://example.test/one",
  referrer: "",
  inFrame: false,
  screenWidth: 412,
  screenHeight: 823,
  timezoneOffset: -420,
});

describe("experimental PageView data through the real worker and local receiver", () => {
  it("rejects a mistyped experimental option instead of silently disabling it", () => {
    expect(() => createMetaPixelPrototype({
      endpoint: "http://127.0.0.1:43210/tr/", experimentalPageViewData: "true",
    })).toThrow("invalid-experimental-option");
    expect(() => createMetaPageViewPrototype({
      endpoint: "http://127.0.0.1:43210/tr/", experimentalPageViewData: "true",
    })).toThrow("invalid-experimental-option");
    expect(() => createMetaPixelPrototype({
      endpoint: "http://127.0.0.1:43210/tr/", experimentalRouting: "true",
    })).toThrow("invalid-experimental-option");
    expect(() => createMetaPageViewPrototype({
      endpoint: "http://127.0.0.1:43210/tr/", experimentalRouting: "true",
    })).toThrow("invalid-experimental-option");
  });

  it("uses an explicitly initialized local Pixel ID without accepting malformed IDs", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    const adapter = createMetaPixelPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: page,
      consent: { ad_storage: "granted" }, experimentalRouting: true,
    });
    try {
      adapter.fbq("init", "not-a-pixel");
      adapter.fbq("init", "000000000000001");
      adapter.fbq("track", "PageView");
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "invalid-pixel-id", "initialized", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(1);
      expect(new URL(receiver.arrivals[0].url).searchParams.get("id")).toBe("000000000000001");
    } finally {
      await adapter.dispose();
      await chamber.dispose();
      await receiver.close();
    }
  }, 5000);

  it("snapshots the observed value and currency fields without enabling other data", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    const adapter = createMetaPixelPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: page,
      consent: { ad_storage: "granted" }, experimentalPageViewData: true, experimentalRouting: true,
    });
    try {
      const data = { value: 27.125, currency: "CAD" };
      adapter.fbq("init", pixelId);
      adapter.fbq("track", "PageView", data);
      data.value = 99;
      adapter.fbq("track", "PageView", { value: 0, currency: "" });
      adapter.fbq("track", "PageView", { value: 4, extra: "unsupported" });
      const result = await adapter.flush();
      expect(result.outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "initialized", "transport-settled", "transport-settled", "unsupported-parameters",
      ]);
      expect(receiver.arrivals).toHaveLength(2);
      const first = new URL(receiver.arrivals[0].url).searchParams;
      const second = new URL(receiver.arrivals[1].url).searchParams;
      expect([first.get("cd[value]"), first.get("cd[currency]")]).toEqual(["27.125", "CAD"]);
      expect([second.get("cd[value]"), second.get("cd[currency]")]).toEqual(["0", ""]);
    } finally {
      await adapter.dispose();
      await chamber.dispose();
      await receiver.close();
    }
  }, 5000);

  it("holds data at the consent boundary without replaying on grant", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    const adapter = createMetaPixelPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: page,
      consent: { ad_storage: "denied" }, experimentalPageViewData: true,
    });
    try {
      adapter.fbq("init", pixelId);
      adapter.fbq("track", "PageView", { value: 12, currency: "USD" });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "held" });
      expect(receiver.arrivals).toEqual([]);
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.fbq("track", "PageView", { value: 12, currency: "USD" });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "transport-settled" });
      expect(receiver.arrivals).toHaveLength(1);
    } finally {
      await adapter.dispose();
      await chamber.dispose();
      await receiver.close();
    }
  }, 5000);

  it("rejects malformed, inherited and accessor data without reading getters", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    const adapter = createMetaPixelPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: page,
      consent: { ad_storage: "granted" }, experimentalPageViewData: true,
    });
    try {
      let getterReads = 0;
      const inputs = [
        { value: NaN }, { value: "12" }, { currency: 3 }, { value: null },
        Object.assign(Object.create({ currency: "USD" }), { value: 12 }),
        { get value() { getterReads += 1; return 12; } },
      ];
      adapter.fbq("init", pixelId);
      for (const data of inputs) adapter.fbq("track", "PageView", data);
      const result = await adapter.flush();
      expect(result.outcomes.slice(1).map((item) => item.reason)).toEqual(
        inputs.map(() => "unsupported-parameters"),
      );
      expect(getterReads).toBe(0);
      expect(receiver.arrivals).toEqual([]);
    } finally {
      await adapter.dispose();
      await chamber.dispose();
      await receiver.close();
    }
  }, 5000);

  it("independently rejects untrusted chamber input without reading accessor data", async () => {
    const host = createConnectorHost(createMetaPageViewPrototype, {
      endpoint: "http://127.0.0.1:43210/tr/", experimentalPageViewData: true,
    });
    await host.init({});
    const command = (args) => ({ type: "meta-pixel-command", payload: { args, context: page() } });
    await host.routeBatch([command(["init", pixelId])]);
    let reads = 0;
    for (const data of [
      { get value() { reads += 1; return 12; } },
      Object.assign(Object.create({ currency: "USD" }), { value: 12 }),
      { value: Infinity },
    ]) {
      const result = await host.routeBatch([command(["track", "PageView", data])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped[0].reason).toBe("unsupported-parameters");
    }
    const proxied = new Proxy({ value: 12 }, {
      get(target, key, receiver) {
        reads += 1;
        return Reflect.get(target, key, receiver);
      },
    });
    const admitted = await host.routeBatch([command(["track", "PageView", proxied])]);
    expect(new URL(admitted.ready[0].url).searchParams.get("cd[value]")).toBe("12");
    expect(reads).toBe(0);
  });
});
