import { describe, expect, it } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const pixelId = "000000000000001";
const agent = "magento_opensource-0.0.0-1.2.3";
const page = () => ({
  pageURL: "https://example.test/", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: -420,
});

async function setup() {
  const receiver = await createPrototypeReceiver();
  const chamber = createNodePrototypeChamber();
  const adapter = createMetaPixelPrototype({
    endpoint: receiver.endpoint, chamber, captureContext: page, consent: { ad_storage: "granted" },
    experimentalRouting: true, experimentalMultiPixelRouting: true,
    experimentalEvents: true, experimentalPageViewData: true, experimentalScalarEventData: true,
    experimentalContentIds: true, experimentalContents: true, experimentalContentsItemPrice: true,
    experimentalContentNameArray: true, experimentalCustomProperties: true, experimentalNumericOrderId: true,
    experimentalEventIds: true, experimentalSetAgent: true, experimentalTagConsent: true,
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

function purchase() {
  return {
    content_type: "product",
    content_ids: ["synthetic-sku"],
    num_items: 1,
    contents: [{ id: "synthetic-sku", quantity: 1, item_price: 100 }],
    content_name: ["Synthetic product"],
    value: 100,
    currency: "USD",
    order_id: 1,
    source: "magento_opensource",
    pluginVersion: "1.2.3",
  };
}

function fields(arrival) {
  const query = new URL(arrival.url).searchParams;
  return Object.fromEntries([
    "id", "ev", "a", "eid", "cd[content_type]", "cd[content_ids]", "cd[num_items]", "cd[contents]",
    "cd[content_name]", "cd[value]", "cd[currency]", "cd[order_id]", "cd[source]", "cd[pluginVersion]",
  ].map((key) => [key, query.getAll(key)]));
}

// This synthetic composition tests local mappings, not Magento execution or native wire behavior.
describe("Magento-shaped Purchase through the experimental local worker", () => {
  it("snapshots the complete selected input and associates each local field with the event", async () => {
    const env = await setup();
    try {
      const data = purchase();
      const options = { eventID: "synthetic-event" };
      env.adapter.fbq("init", pixelId);
      env.adapter.fbq("set", "agent", agent, pixelId);
      env.adapter.fbq("trackCustom", "Purchase", data, options);
      data.content_type = "product_group";
      data.content_ids[0] = "mutated";
      data.content_ids.push("late");
      data.num_items = 2;
      data.contents[0].id = "mutated";
      data.contents[0].quantity = 2;
      data.contents[0].item_price = 999;
      data.contents.push({ id: "late", quantity: 1, item_price: 1 });
      data.content_name[0] = "mutated";
      data.content_name.push("late");
      data.value = 999;
      data.currency = "EUR";
      data.order_id = 999;
      data.source = "mutated";
      data.pluginVersion = "mutated";
      options.eventID = "mutated";
      const state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "agent-updated", "transport-settled"]);
      expect(env.receiver.arrivals.map(fields)).toEqual([{
        id: [pixelId], ev: ["Purchase"], a: [agent], eid: ["synthetic-event"],
        "cd[content_type]": ["product"], "cd[content_ids]": ['["synthetic-sku"]'],
        "cd[num_items]": ["1"],
        "cd[contents]": ['[{"id":"synthetic-sku","quantity":1,"item_price":100}]'],
        "cd[content_name]": ['["Synthetic product"]'], "cd[value]": ["100"], "cd[currency]": ["USD"],
        "cd[order_id]": ["1"], "cd[source]": ["magento_opensource"], "cd[pluginVersion]": ["1.2.3"],
      }]);
      expect(JSON.stringify(state)).not.toContain("synthetic-sku");
      expect(JSON.stringify(state)).not.toContain("synthetic-event");
    } finally { await env.close(); }
  }, 5000);

  it("holds the composition under either consent denial and does not replay it on grant", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", pixelId);
      adapter.fbq("set", "agent", agent, pixelId);
      adapter.fbq("consent", "revoke");
      adapter.fbq("trackCustom", "Purchase", purchase(), { eventID: "tag-held" });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      expect(receiver.arrivals).toHaveLength(0);

      adapter.fbq("consent", "grant");
      await adapter.flush();
      expect(receiver.arrivals).toHaveLength(0);
      adapter.setConsent({ ad_storage: "denied" });
      adapter.fbq("trackCustom", "Purchase", purchase(), { eventID: "host-held" });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      expect(receiver.arrivals).toHaveLength(0);

      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toHaveLength(0);
      adapter.fbq("trackCustom", "Purchase", purchase(), { eventID: "fresh" });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
      expect(receiver.arrivals.map(fields)).toMatchObject([{ id: [pixelId], a: [agent], eid: ["fresh"] }]);
    } finally { await env.close(); }
  }, 5000);
});
