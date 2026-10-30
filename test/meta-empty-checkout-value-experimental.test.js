import { describe, expect, it } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const ids = ["000000000000001", "000000000000002"];
const agent = "magento_opensource-0.0.0-1.2.3";
const page = () => ({
  pageURL: "https://example.test/", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: -420,
});

async function setup(options = {}) {
  const receiver = await createPrototypeReceiver();
  const chamber = createNodePrototypeChamber();
  const adapter = createMetaPixelPrototype({
    endpoint: receiver.endpoint, chamber, captureContext: page, consent: { ad_storage: "granted" },
    experimentalRouting: true, experimentalMultiPixelRouting: true, experimentalEvents: true,
    experimentalPageViewData: true, experimentalEmptyCheckoutValue: true, experimentalTagConsent: true,
    ...options,
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

function checkout() {
  return {
    content_type: "product", content_ids: [1], num_items: 1,
    contents: [{ id: 1, quantity: 1, item_price: 0 }],
    content_category: "Synthetic category", value: "", currency: "usd",
    source: "magento_opensource", pluginVersion: "1.2.3",
  };
}

describe("experimental empty InitiateCheckout value through the local worker", () => {
  it("requires a boolean opt-in and both event and data prerequisites", () => {
    const endpoint = "http://127.0.0.1:43210/tr/";
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint, experimentalEmptyCheckoutValue: "true" })).toThrow("invalid-experimental-option");
      for (const options of [{}, { experimentalEvents: true }, { experimentalPageViewData: true }]) {
        expect(() => create({ endpoint, ...options, experimentalEmptyCheckoutValue: true }))
          .toThrow("empty-checkout-value-requires-events-and-pageview-data");
      }
    }
  });

  it("keeps the empty value rejected by default while retaining numeric and omitted values", async () => {
    const env = await setup({ experimentalEmptyCheckoutValue: false });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("trackCustom", "InitiateCheckout", { value: "" });
      env.adapter.fbq("trackCustom", "InitiateCheckout", { value: 0 });
      env.adapter.fbq("trackCustom", "InitiateCheckout", {});
      expect((await env.adapter.flush()).outcomes.map((item) => item.reason || item.disposition))
        .toEqual(["initialized", "unsupported-parameters", "transport-settled", "transport-settled"]);
      expect(env.receiver.arrivals.map(valueFields)).toEqual([
        { pixel: ids[0], event: "InitiateCheckout", values: ["0"] },
        { pixel: ids[0], event: "InitiateCheckout", values: [] },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("snapshots the empty string and distinguishes omission, undefined, zero and separately enabled null", async () => {
    const env = await setup({ experimentalNullPurchaseValue: true });
    try {
      const data = { value: "", currency: "usd" };
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("init", ids[1]);
      env.adapter.fbq("trackCustom", "InitiateCheckout", data);
      data.value = 7;
      env.adapter.fbq("trackCustom", "InitiateCheckout", {});
      env.adapter.fbq("trackCustom", "InitiateCheckout", { value: undefined });
      env.adapter.fbq("trackCustom", "InitiateCheckout", { value: 0 });
      env.adapter.fbq("trackCustom", "Purchase", { value: null });
      expect((await env.adapter.flush()).outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "initialized", ...Array(5).fill("transport-settled")]);
      expect(env.receiver.arrivals.map(valueFields)).toEqual([
        ...ids.map((pixel) => ({ pixel, event: "InitiateCheckout", values: [""] })),
        ...ids.map((pixel) => ({ pixel, event: "InitiateCheckout", values: [] })),
        ...ids.map((pixel) => ({ pixel, event: "InitiateCheckout", values: [] })),
        ...ids.map((pixel) => ({ pixel, event: "InitiateCheckout", values: ["0"] })),
        ...ids.map((pixel) => ({ pixel, event: "Purchase", values: ["null"] })),
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("composes the synthetic zero-subtotal checkout with the other template fields", async () => {
    const env = await setup({
      experimentalScalarEventData: true, experimentalContentIds: true, experimentalContents: true,
      experimentalContentsItemPrice: true, experimentalCustomProperties: true, experimentalEventIds: true,
      experimentalInitAgent: true, experimentalSetAgent: true,
    });
    try {
      const data = checkout();
      const options = { eventID: "synthetic-checkout" };
      env.adapter.fbq("init", ids[0], {}, { agent });
      env.adapter.fbq("set", "agent", agent, ids[0]);
      env.adapter.fbq("trackCustom", "InitiateCheckout", data, options);
      data.content_type = "product_group";
      data.content_ids[0] = 2;
      data.num_items = 2;
      data.contents[0].id = 2;
      data.contents[0].quantity = 2;
      data.contents[0].item_price = 10;
      data.content_category = "changed";
      data.value = 10;
      data.currency = "eur";
      data.source = "changed";
      data.pluginVersion = "changed";
      options.eventID = "changed";
      expect((await env.adapter.flush()).outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "agent-updated", "transport-settled"]);
      expect(env.receiver.arrivals).toHaveLength(1);
      const query = new URL(env.receiver.arrivals[0].url).searchParams;
      expect(Object.fromEntries([
        "id", "ev", "a", "eid", "cd[content_type]", "cd[content_ids]", "cd[num_items]", "cd[contents]",
        "cd[content_category]", "cd[value]", "cd[currency]", "cd[source]", "cd[pluginVersion]",
      ].map((key) => [key, query.getAll(key)]))).toEqual({
        id: [ids[0]], ev: ["InitiateCheckout"], a: [agent], eid: ["synthetic-checkout"],
        "cd[content_type]": ["product"], "cd[content_ids]": ["[1]"], "cd[num_items]": ["1"],
        "cd[contents]": ['[{"id":1,"quantity":1,"item_price":0}]'],
        "cd[content_category]": ["Synthetic category"], "cd[value]": [""], "cd[currency]": ["usd"],
        "cd[source]": ["magento_opensource"], "cd[pluginVersion]": ["1.2.3"],
      });
    } finally { await env.close(); }
  }, 5000);

  it("supports the single synthetic Pixel without enabling routed Pixel IDs", async () => {
    const env = await setup({ experimentalRouting: false, experimentalMultiPixelRouting: false });
    try {
      env.adapter.fbq("init", "000000000000000");
      env.adapter.fbq("trackCustom", "InitiateCheckout", { value: "" });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(env.receiver.arrivals.map(valueFields))
        .toEqual([{ pixel: "000000000000000", event: "InitiateCheckout", values: [""] }]);
    } finally { await env.close(); }
  }, 5000);

  it("refuses other routes and value types without reading an accessor", async () => {
    const env = await setup({ experimentalScalarEventData: true, experimentalNullPurchaseValue: true });
    try {
      let getterReads = 0;
      const commands = [
        ["track", "InitiateCheckout", { value: "" }],
        ["trackCustom", "Purchase", { value: "" }],
        ["trackCustom", "Other", { value: "" }],
        ["trackSingle", ids[0], "InitiateCheckout", { value: "" }],
        ["trackSingleCustom", ids[0], "InitiateCheckout", { value: "" }],
        ["trackCustom", "InitiateCheckout", { value: null }],
        ["trackCustom", "InitiateCheckout", { value: "0" }],
        ["trackCustom", "InitiateCheckout", { value: " " }],
        ["trackCustom", "InitiateCheckout", { value: false }],
        ["trackCustom", "InitiateCheckout", { value: NaN }],
        ["trackCustom", "InitiateCheckout", { value: Infinity }],
        ["trackCustom", "InitiateCheckout", { get value() { getterReads += 1; return ""; } }],
      ];
      env.adapter.fbq("init", ids[0]);
      for (const command of commands) env.adapter.fbq(...command);
      expect((await env.adapter.flush()).outcomes.slice(1).map((item) => item.reason))
        .toEqual(commands.map(() => "unsupported-parameters"));
      expect(getterReads).toBe(0);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("holds empty checkout events for either consent denial and never replays them", async () => {
    const env = await setup();
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("consent", "revoke");
      env.adapter.fbq("trackCustom", "InitiateCheckout", { value: "" });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      env.adapter.fbq("consent", "grant");
      await env.adapter.flush();
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.setConsent({ ad_storage: "denied" });
      env.adapter.fbq("trackCustom", "InitiateCheckout", { value: "" });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      env.adapter.setConsent({ ad_storage: "granted" });
      await env.adapter.flush();
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.fbq("trackCustom", "InitiateCheckout", { value: "" });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(env.receiver.arrivals.map(valueFields))
        .toEqual([{ pixel: ids[0], event: "InitiateCheckout", values: [""] }]);
    } finally { await env.close(); }
  }, 5000);
});
