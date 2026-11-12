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
    experimentalPageViewData: true, experimentalContentIds: true, experimentalContents: true,
    experimentalFalseCheckoutContentId: true, experimentalTagConsent: true,
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

function dataFields(arrival) {
  const query = new URL(arrival.url).searchParams;
  return Object.fromEntries(
    ["id", "ev", "a", "eid", "cd[content_ids]", "cd[contents]", "cd[value]", "cd[currency]"]
      .map((key) => [key, query.getAll(key)]),
  );
}

describe("experimental false checkout content IDs through the local worker", () => {
  it("requires a boolean opt-in alongside the event, data and both commerce gates", () => {
    const endpoint = "http://127.0.0.1:43210/tr/";
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint, experimentalFalseCheckoutContentId: "true" })).toThrow("invalid-experimental-option");
      for (const options of [
        {},
        { experimentalPageViewData: true, experimentalContentIds: true, experimentalContents: true },
        { experimentalPageViewData: true, experimentalEvents: true, experimentalContents: true },
        { experimentalPageViewData: true, experimentalEvents: true, experimentalContentIds: true },
        { experimentalEvents: true },
      ]) {
        expect(() => create({ endpoint, ...options, experimentalFalseCheckoutContentId: true }))
          .toThrow("false-checkout-content-id-requires-events-and-commerce-data");
      }
    }
  });

  it("keeps both false ID positions rejected by default and existing ID types accepted", async () => {
    const env = await setup({ experimentalFalseCheckoutContentId: false });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("trackCustom", "InitiateCheckout", { content_ids: [false] });
      env.adapter.fbq("trackCustom", "InitiateCheckout", { contents: [{ id: false, quantity: 1 }] });
      env.adapter.fbq("trackCustom", "InitiateCheckout", {
        content_ids: [0, "false"], contents: [{ id: 0, quantity: 1 }, { id: "false", quantity: 1 }],
      });
      expect((await env.adapter.flush()).outcomes.map((item) => item.reason || item.disposition))
        .toEqual(["initialized", "unsupported-parameters", "unsupported-parameters", "transport-settled"]);
      expect(env.receiver.arrivals.map(dataFields)).toEqual([{
        id: [ids[0]], ev: ["InitiateCheckout"], a: [], eid: [], "cd[content_ids]": ['[0,"false"]'],
        "cd[contents]": ['[{"id":0,"quantity":1},{"id":"false","quantity":1}]'], "cd[value]": [], "cd[currency]": [],
      }]);
    } finally { await env.close(); }
  }, 5000);

  it("snapshots false independently in both ID positions and preserves their types across broadcasts", async () => {
    const env = await setup();
    try {
      const data = { content_ids: [false], contents: [{ id: false, quantity: 1 }] };
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("init", ids[1]);
      env.adapter.fbq("trackCustom", "InitiateCheckout", data);
      data.content_ids[0] = 0;
      data.contents[0].id = "changed";
      env.adapter.fbq("trackCustom", "InitiateCheckout", { content_ids: [false] });
      env.adapter.fbq("trackCustom", "InitiateCheckout", { contents: [{ id: false, quantity: 1 }] });
      env.adapter.fbq("trackCustom", "InitiateCheckout", {
        content_ids: [false, 0, "false"],
        contents: [{ id: false, quantity: 1 }, { id: 0, quantity: 1 }, { id: "false", quantity: 1 }],
      });
      expect((await env.adapter.flush()).outcomes.slice(2).map((item) => item.disposition))
        .toEqual(["transport-settled", "transport-settled", "transport-settled", "transport-settled"]);
      const expected = (pixel, contentIds, contents) => ({
        id: [pixel], ev: ["InitiateCheckout"], a: [], eid: [], "cd[content_ids]": contentIds,
        "cd[contents]": contents, "cd[value]": [], "cd[currency]": [],
      });
      expect(env.receiver.arrivals.map(dataFields)).toEqual([
        ...ids.map((pixel) => expected(pixel, ["[false]"], ['[{"id":false,"quantity":1}]'])),
        ...ids.map((pixel) => expected(pixel, ["[false]"], [])),
        ...ids.map((pixel) => expected(pixel, [], ['[{"id":false,"quantity":1}]'])),
        ...ids.map((pixel) => expected(pixel, ['[false,0,"false"]'],
          ['[{"id":false,"quantity":1},{"id":0,"quantity":1},{"id":"false","quantity":1}]'])),
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("composes the invalid-identifier and zero-subtotal checkout with existing synthetic opt-ins", async () => {
    const env = await setup({
      experimentalScalarEventData: true, experimentalContentsItemPrice: true, experimentalCustomProperties: true,
      experimentalEventIds: true, experimentalInitAgent: true, experimentalSetAgent: true,
      experimentalEmptyCheckoutValue: true,
    });
    try {
      const data = {
        content_type: "product", content_ids: [false], num_items: 1,
        contents: [{ id: false, quantity: 1, item_price: 0 }], content_category: "Synthetic category",
        value: "", currency: "usd", source: "magento_opensource", pluginVersion: "1.2.3",
      };
      const options = { eventID: "synthetic-checkout" };
      env.adapter.fbq("init", ids[0], {}, { agent });
      env.adapter.fbq("set", "agent", agent, ids[0]);
      env.adapter.fbq("trackCustom", "InitiateCheckout", data, options);
      data.content_ids[0] = 1;
      data.contents[0].id = 1;
      data.contents[0].item_price = 10;
      data.value = 10;
      options.eventID = "changed";
      expect((await env.adapter.flush()).outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "agent-updated", "transport-settled"]);
      const query = new URL(env.receiver.arrivals[0].url).searchParams;
      expect(Object.fromEntries([
        "id", "ev", "a", "eid", "cd[content_type]", "cd[content_ids]", "cd[num_items]", "cd[contents]",
        "cd[content_category]", "cd[value]", "cd[currency]", "cd[source]", "cd[pluginVersion]",
      ].map((key) => [key, query.getAll(key)]))).toEqual({
        id: [ids[0]], ev: ["InitiateCheckout"], a: [agent], eid: ["synthetic-checkout"],
        "cd[content_type]": ["product"], "cd[content_ids]": ["[false]"], "cd[num_items]": ["1"],
        "cd[contents]": ['[{"id":false,"quantity":1,"item_price":0}]'],
        "cd[content_category]": ["Synthetic category"], "cd[value]": [""], "cd[currency]": ["usd"],
        "cd[source]": ["magento_opensource"], "cd[pluginVersion]": ["1.2.3"],
      });
    } finally { await env.close(); }
  }, 5000);

  it("retains other routes, types, size limits and accessors as visible refusals", async () => {
    const env = await setup({ experimentalScalarEventData: true, experimentalContentNameArray: true, queueLimit: 64 });
    try {
      let reads = 0;
      let enumerations = 0;
      const getter = { get id() { reads += 1; return false; }, quantity: 1 };
      const oversizedIds = new Proxy(Array(17).fill(false), {
        ownKeys(target) { enumerations += 1; return Reflect.ownKeys(target); },
      });
      const oversizedContents = new Proxy(Array(17).fill({ id: false, quantity: 1 }), {
        ownKeys(target) { enumerations += 1; return Reflect.ownKeys(target); },
      });
      const data = { content_ids: [false], contents: [{ id: false, quantity: 1 }] };
      const commands = [
        ["track", "InitiateCheckout", data],
        ["trackCustom", "Purchase", data],
        ["trackCustom", "Other", data],
        ["trackSingle", ids[0], "InitiateCheckout", data],
        ["trackSingleCustom", ids[0], "InitiateCheckout", data],
        ["trackCustom", "InitiateCheckout", { content_ids: [true] }],
        ["trackCustom", "InitiateCheckout", { contents: [{ id: true, quantity: 1 }] }],
        ["trackCustom", "InitiateCheckout", { content_ids: [null] }],
        ["trackCustom", "InitiateCheckout", { contents: [{ id: null, quantity: 1 }] }],
        ["trackCustom", "InitiateCheckout", { content_ids: [undefined] }],
        ["trackCustom", "InitiateCheckout", { contents: [{ id: undefined, quantity: 1 }] }],
        ["trackCustom", "InitiateCheckout", { content_ids: oversizedIds }],
        ["trackCustom", "InitiateCheckout", { contents: oversizedContents }],
        ["trackCustom", "InitiateCheckout", { contents: [getter] }],
        ["trackCustom", "InitiateCheckout", { contents: [{ id: false, quantity: 1, item_price: 0 }] }],
        ["trackCustom", "InitiateCheckout", { contents: [{ id: false, quantity: "1" }] }],
        ["trackCustom", "InitiateCheckout", { content_name: [false] }],
        ["trackCustom", "InitiateCheckout", { value: false }],
      ];
      env.adapter.fbq("init", ids[0]);
      for (const command of commands) env.adapter.fbq(...command);
      expect((await env.adapter.flush()).outcomes.slice(1).map((item) => item.reason))
        .toEqual(commands.map(() => "unsupported-parameters"));
      expect(reads).toBe(0);
      expect(enumerations).toBe(0);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("holds false checkout IDs under each consent denial and never replays them", async () => {
    const env = await setup();
    try {
      const data = { content_ids: [false], contents: [{ id: false, quantity: 1 }] };
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("consent", "revoke");
      env.adapter.fbq("trackCustom", "InitiateCheckout", data);
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      env.adapter.fbq("consent", "grant");
      await env.adapter.flush();
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.setConsent({ ad_storage: "denied" });
      env.adapter.fbq("trackCustom", "InitiateCheckout", data);
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      env.adapter.setConsent({ ad_storage: "granted" });
      await env.adapter.flush();
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.fbq("trackCustom", "InitiateCheckout", data);
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(env.receiver.arrivals.map(dataFields)).toEqual([{
        id: [ids[0]], ev: ["InitiateCheckout"], a: [], eid: [], "cd[content_ids]": ["[false]"],
        "cd[contents]": ['[{"id":false,"quantity":1}]'], "cd[value]": [], "cd[currency]": [],
      }]);
    } finally { await env.close(); }
  }, 5000);
});
