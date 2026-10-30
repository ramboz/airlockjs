import { describe, expect, it } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const pixelId = "000000000000001";
const page = () => ({
  pageURL: "https://example.test/", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: -420,
});

async function setup(options = {}) {
  const receiver = await createPrototypeReceiver();
  const chamber = createNodePrototypeChamber();
  const adapter = createMetaPixelPrototype({
    endpoint: receiver.endpoint, chamber, captureContext: page, consent: { ad_storage: "granted" },
    experimentalRouting: true, experimentalMultiPixelRouting: true,
    experimentalEvents: true, experimentalPageViewData: true, experimentalNullPurchaseValue: true,
    experimentalTagConsent: true, ...options,
  });
  return {
    adapter, receiver,
    async close() {
      try { await adapter.dispose(); } finally {
        try { await chamber.dispose(); } finally { await receiver.close(); }
      }
    },
  };
}

function valueFields(arrival) {
  const query = new URL(arrival.url).searchParams;
  return { pixel: query.get("id"), event: query.get("ev"), values: query.getAll("cd[value]") };
}

describe("experimental null Purchase value through the local worker", () => {
  it("requires a boolean opt-in and both event and data prerequisites", () => {
    const endpoint = "http://127.0.0.1:43210/tr/";
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint, experimentalNullPurchaseValue: "true" })).toThrow("invalid-experimental-option");
      for (const options of [{}, { experimentalEvents: true }, { experimentalPageViewData: true }]) {
        expect(() => create({ endpoint, ...options, experimentalNullPurchaseValue: true }))
          .toThrow("null-purchase-value-requires-events-and-pageview-data");
      }
    }
  });

  it("keeps null rejected by default without changing numeric and omitted values", async () => {
    const env = await setup({ experimentalNullPurchaseValue: false });
    try {
      env.adapter.fbq("init", pixelId);
      env.adapter.fbq("trackCustom", "Purchase", { value: null });
      env.adapter.fbq("trackCustom", "Purchase", { value: 0 });
      env.adapter.fbq("trackCustom", "Purchase", {});
      expect((await env.adapter.flush()).outcomes.map((item) => item.reason || item.disposition))
        .toEqual(["initialized", "unsupported-parameters", "transport-settled", "transport-settled"]);
      expect(env.receiver.arrivals.map(valueFields)).toEqual([
        { pixel: pixelId, event: "Purchase", values: ["0"] },
        { pixel: pixelId, event: "Purchase", values: [] },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("snapshots null distinctly from omission and zero in custom Purchase broadcasts", async () => {
    const env = await setup();
    try {
      const data = { value: null, currency: "USD" };
      env.adapter.fbq("init", pixelId);
      env.adapter.fbq("trackCustom", "Purchase", data);
      data.value = 42;
      env.adapter.fbq("trackCustom", "Purchase", { value: undefined });
      env.adapter.fbq("trackCustom", "Purchase", {});
      env.adapter.fbq("trackCustom", "Purchase", { value: 0 });
      expect((await env.adapter.flush()).outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "transport-settled", "transport-settled", "transport-settled", "transport-settled"]);
      expect(env.receiver.arrivals.map(valueFields)).toEqual([
        { pixel: pixelId, event: "Purchase", values: ["null"] },
        { pixel: pixelId, event: "Purchase", values: [] },
        { pixel: pixelId, event: "Purchase", values: [] },
        { pixel: pixelId, event: "Purchase", values: ["0"] },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("composes a synthetic existing-order, falsy-total Purchase with the other local Magento-shaped inputs", async () => {
    const env = await setup({
      experimentalScalarEventData: true, experimentalContentIds: true, experimentalContents: true,
      experimentalContentsItemPrice: true, experimentalContentNameArray: true, experimentalCustomProperties: true,
      experimentalNumericOrderId: true, experimentalEventIds: true, experimentalSetAgent: true,
    });
    try {
      const data = {
        content_type: "product", content_ids: ["synthetic-sku"], num_items: 1,
        contents: [{ id: "synthetic-sku", quantity: 1, item_price: 100 }],
        content_name: ["Synthetic product"], value: null, currency: "USD", order_id: 1,
        source: "magento_opensource", pluginVersion: "1.2.3",
      };
      const options = { eventID: "synthetic-event" };
      env.adapter.fbq("init", pixelId);
      env.adapter.fbq("set", "agent", "magento_opensource-0.0.0-1.2.3", pixelId);
      env.adapter.fbq("trackCustom", "Purchase", data, options);
      data.value = 100;
      data.contents[0].item_price = 999;
      data.content_ids[0] = "mutated";
      data.content_name[0] = "mutated";
      options.eventID = "mutated";
      expect((await env.adapter.flush()).outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "agent-updated", "transport-settled"]);
      expect(env.receiver.arrivals).toHaveLength(1);
      const query = new URL(env.receiver.arrivals[0].url).searchParams;
      expect(Object.fromEntries([
        "id", "ev", "a", "eid", "cd[content_type]", "cd[content_ids]", "cd[num_items]", "cd[contents]",
        "cd[content_name]", "cd[value]", "cd[currency]", "cd[order_id]", "cd[source]", "cd[pluginVersion]",
      ].map((key) => [key, query.getAll(key)]))).toEqual({
        id: [pixelId], ev: ["Purchase"], a: ["magento_opensource-0.0.0-1.2.3"], eid: ["synthetic-event"],
        "cd[content_type]": ["product"], "cd[content_ids]": ['["synthetic-sku"]'], "cd[num_items]": ["1"],
        "cd[contents]": ['[{"id":"synthetic-sku","quantity":1,"item_price":100}]'],
        "cd[content_name]": ['["Synthetic product"]'], "cd[value]": ["null"], "cd[currency]": ["USD"],
        "cd[order_id]": ["1"], "cd[source]": ["magento_opensource"], "cd[pluginVersion]": ["1.2.3"],
      });
    } finally { await env.close(); }
  }, 5000);

  it("does not broaden other commands, null fields or unsupported value types", async () => {
    const env = await setup({ experimentalScalarEventData: true });
    try {
      let getterReads = 0;
      env.adapter.fbq("init", pixelId);
      const commands = [
        ["track", "Purchase", { value: null }],
        ["trackCustom", "Other", { value: null }],
        ["trackSingleCustom", pixelId, "Purchase", { value: null }],
        ["trackCustom", "Purchase", { value: "null" }],
        ["trackCustom", "Purchase", { value: false }],
        ["trackCustom", "Purchase", { value: NaN }],
        ["trackCustom", "Purchase", { currency: null }],
        ["trackCustom", "Purchase", { predicted_ltv: null }],
        ["trackCustom", "Purchase", { get value() { getterReads += 1; return null; } }],
      ];
      for (const args of commands) env.adapter.fbq(...args);
      expect((await env.adapter.flush()).outcomes.slice(1).map((item) => item.reason))
        .toEqual(commands.map(() => "unsupported-parameters"));
      expect(getterReads).toBe(0);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("holds null Purchase events for either consent denial and never replays them", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", pixelId);
      adapter.fbq("consent", "revoke");
      adapter.fbq("trackCustom", "Purchase", { value: null });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      adapter.fbq("consent", "grant");
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.setConsent({ ad_storage: "denied" });
      adapter.fbq("trackCustom", "Purchase", { value: null });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.fbq("trackCustom", "Purchase", { value: null });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals.map(valueFields)).toEqual([{ pixel: pixelId, event: "Purchase", values: ["null"] }]);
    } finally { await env.close(); }
  }, 5000);
});
