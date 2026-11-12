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
    experimentalContentIds: true, experimentalContents: true, experimentalCustomProperties: true,
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

function addToCart() {
  return {
    content_name: "Synthetic product",
    content_ids: ["synthetic-sku"],
    value: 10,
    currency: "USD",
    content_type: "product",
    contents: [{ id: "synthetic-sku", quantity: 1 }],
    source: "magento_opensource",
    pluginVersion: "1.2.3",
  };
}

function fields(arrival) {
  const query = new URL(arrival.url).searchParams;
  return Object.fromEntries([
    "id", "ev", "a", "eid", "cd[content_name]", "cd[content_ids]", "cd[value]", "cd[currency]",
    "cd[content_type]", "cd[contents]", "cd[source]", "cd[pluginVersion]",
  ].map((key) => [key, query.getAll(key)]));
}

// This synthetic composition exercises local mappings, not Magento execution or native wire behavior.
describe("Magento-shaped AddToCart through the experimental local worker", () => {
  it("snapshots and associates the selected fields with the synthetic event", async () => {
    const env = await setup();
    try {
      const data = addToCart();
      const options = { eventID: "synthetic-event" };
      env.adapter.fbq("init", pixelId);
      env.adapter.fbq("set", "agent", agent, pixelId);
      env.adapter.fbq("track", "AddToCart", data, options);
      data.content_name = "mutated";
      data.content_ids[0] = "mutated";
      data.content_ids.push("late");
      data.value = 999;
      data.currency = "EUR";
      data.content_type = "product_group";
      data.contents[0].id = "mutated";
      data.contents[0].quantity = 2;
      data.contents.push({ id: "late", quantity: 1 });
      data.source = "mutated";
      data.pluginVersion = "mutated";
      options.eventID = "mutated";
      const state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "agent-updated", "transport-settled"]);
      expect(env.receiver.arrivals.map(fields)).toEqual([{
        id: [pixelId], ev: ["AddToCart"], a: [agent], eid: ["synthetic-event"],
        "cd[content_name]": ["Synthetic product"], "cd[content_ids]": ['["synthetic-sku"]'],
        "cd[value]": ["10"], "cd[currency]": ["USD"], "cd[content_type]": ["product"],
        "cd[contents]": ['[{"id":"synthetic-sku","quantity":1}]'],
        "cd[source]": ["magento_opensource"], "cd[pluginVersion]": ["1.2.3"],
      }]);
      expect(JSON.stringify(state)).not.toContain("synthetic-sku");
      expect(JSON.stringify(state)).not.toContain("synthetic-event");
    } finally { await env.close(); }
  }, 5000);

  it("retains existing refusals for unsupported input types", async () => {
    const env = await setup();
    try {
      const invalid = [
        { ...addToCart(), content_ids: [null] },
        { ...addToCart(), contents: [{ id: {}, quantity: 1 }] },
        { ...addToCart(), value: "10" },
        { ...addToCart(), content_name: ["Synthetic product"] },
      ];
      env.adapter.fbq("init", pixelId);
      for (const data of invalid) env.adapter.fbq("track", "AddToCart", data);
      expect((await env.adapter.flush()).outcomes.slice(1).map((item) => item.reason))
        .toEqual(invalid.map(() => "unsupported-parameters"));
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects filtered-out Magento item IDs rather than coercing or omitting them", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      const missingIds = {
        ...addToCart(),
        content_ids: [undefined],
        contents: [{ id: undefined, quantity: 1 }],
      };
      expect(JSON.stringify(missingIds.content_ids)).toBe("[null]");
      expect(JSON.stringify(missingIds.contents)).toBe('[{"quantity":1}]');

      adapter.fbq("init", pixelId);
      adapter.fbq("track", "AddToCart", missingIds);
      adapter.fbq("track", "AddToCart", { ...addToCart(), content_ids: [undefined] });
      adapter.fbq("track", "AddToCart", { ...addToCart(), contents: [{ id: undefined, quantity: 1 }] });
      adapter.fbq("track", "AddToCart", { ...addToCart(), value: undefined });
      const state = await adapter.flush();
      expect(state.outcomes.slice(1).map(({ disposition, reason }) => [disposition, reason])).toEqual([
        ["rejected", "unsupported-parameters"],
        ["rejected", "unsupported-parameters"],
        ["rejected", "unsupported-parameters"],
        ["transport-settled", undefined],
      ]);
      expect(receiver.arrivals).toHaveLength(1);
      expect(fields(receiver.arrivals[0])).toMatchObject({
        "cd[content_ids]": ['["synthetic-sku"]'],
        "cd[contents]": ['[{"id":"synthetic-sku","quantity":1}]'],
        "cd[value]": [],
      });
    } finally { await env.close(); }
  }, 5000);

  it("holds the composition under tag or host denial and does not replay on grant", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", pixelId);
      adapter.fbq("set", "agent", agent, pixelId);
      adapter.fbq("consent", "revoke");
      adapter.fbq("track", "AddToCart", addToCart(), { eventID: "tag-held" });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      adapter.fbq("consent", "grant");
      await adapter.flush();
      expect(receiver.arrivals).toHaveLength(0);

      adapter.setConsent({ ad_storage: "denied" });
      adapter.fbq("track", "AddToCart", addToCart(), { eventID: "host-held" });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toHaveLength(0);

      adapter.fbq("track", "AddToCart", addToCart(), { eventID: "fresh" });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
      expect(receiver.arrivals.map(fields)).toMatchObject([{
        id: [pixelId], ev: ["AddToCart"], a: [agent], eid: ["fresh"],
        "cd[content_ids]": ['["synthetic-sku"]'], "cd[contents]": ['[{"id":"synthetic-sku","quantity":1}]'],
      }]);
    } finally { await env.close(); }
  }, 5000);
});
