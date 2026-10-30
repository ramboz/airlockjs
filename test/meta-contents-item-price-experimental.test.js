import { describe, expect, it } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const ids = ["000000000000001", "000000000000002"];
const page = () => ({
  pageURL: "https://example.test/one", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: -420,
});

async function setup(options = {}, receiverOptions) {
  const receiver = await createPrototypeReceiver(receiverOptions);
  const chamber = createNodePrototypeChamber();
  const adapter = createMetaPixelPrototype({
    endpoint: receiver.endpoint, chamber, captureContext: page, consent: { ad_storage: "granted" },
    experimentalEvents: true, experimentalPageViewData: true, experimentalEventIds: true,
    experimentalCustomProperties: true, experimentalNumericOrderId: true,
    experimentalContents: true, experimentalContentsItemPrice: true,
    experimentalRouting: true, experimentalMultiPixelRouting: true, ...options,
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

function fields(arrival) {
  const query = new URL(arrival.url).searchParams;
  return {
    pixel: query.get("id"), event: query.get("ev"), eventId: query.get("eid"),
    contents: query.get("cd[contents]"), orderId: query.get("cd[order_id]"), value: query.get("cd[value]"),
  };
}

describe("experimental contents item_price through the serialized Meta worker", () => {
  it("requires a boolean opt-in alongside the existing contents opt-in", () => {
    const endpoint = "http://127.0.0.1:43210/tr/";
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint, experimentalContentsItemPrice: "true" })).toThrow("invalid-experimental-option");
      expect(() => create({ endpoint, experimentalContentsItemPrice: true })).toThrow("item-price-requires-contents");
      expect(() => create({
        endpoint, experimentalPageViewData: true, experimentalContentsItemPrice: true,
      })).toThrow("item-price-requires-contents");
    }
  });

  it("preserves default-off rejection and existing unpriced item behavior", async () => {
    const env = await setup({ experimentalContentsItemPrice: false });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("trackCustom", "Purchase", { contents: [{ id: "sku", quantity: 1, item_price: 100 }] });
      env.adapter.fbq("trackCustom", "Purchase", { contents: [{ id: "sku", quantity: 1 }] });
      expect((await env.adapter.flush()).outcomes.slice(1).map((outcome) => outcome.reason || outcome.disposition))
        .toEqual(["unsupported-parameters", "transport-settled"]);
      expect(env.receiver.arrivals.map(fields)[0].contents).toBe('[{"id":"sku","quantity":1}]');
    } finally { await env.close(); }
  }, 5000);

  it("supports the opt-in for one synthetic Pixel without enabling other event or data features", async () => {
    const env = await setup({
      experimentalEvents: false, experimentalEventIds: false, experimentalCustomProperties: false,
      experimentalNumericOrderId: false, experimentalRouting: false, experimentalMultiPixelRouting: false,
    });
    try {
      env.adapter.fbq("init", "000000000000000");
      env.adapter.fbq("track", "PageView", {
        contents: [{ id: "sku", quantity: 1, item_price: Number.MIN_VALUE }, { id: 0, quantity: 0 }],
      });
      env.adapter.fbq("track", "PageView", { contents: [{ id: "sku", quantity: 1, item_price: 100 }], region: "us" });
      env.adapter.fbq("trackCustom", "Purchase", { contents: [{ id: "sku", quantity: 1, item_price: 100 }] });
      expect((await env.adapter.flush()).outcomes.map((item) => item.reason || item.disposition))
        .toEqual(["initialized", "transport-settled", "unsupported-parameters", "unsupported-argument"]);
      expect(env.receiver.arrivals.map(fields)[0].contents)
        .toBe('[{"id":"sku","quantity":1,"item_price":5e-324},{"id":0,"quantity":0}]');
      expect(env.receiver.arrivals).toHaveLength(1);
    } finally { await env.close(); }
  }, 5000);

  it("snapshots mixed priced items for custom Purchase, standard and targeted calls", async () => {
    const env = await setup();
    try {
      const contents = [
        { id: "sku", quantity: 1, item_price: 100 },
        { id: 2, quantity: 3 },
        { id: "zero", quantity: 0.5, item_price: 0 },
      ];
      const data = { contents, order_id: 1, value: 7 };
      const options = { eventID: "synthetic" };
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("init", ids[1]);
      env.adapter.fbq("trackCustom", "Purchase", data, options);
      contents[0].item_price = 999;
      contents[1].quantity = 9;
      contents.push({ id: "late", quantity: 1, item_price: 2 });
      options.eventID = "changed";
      env.adapter.fbq("trackSingle", ids[1], "Purchase", {
        contents: [{ id: "fraction", quantity: 2, item_price: 1.25 }],
      });
      env.adapter.fbq("trackSingleCustom", ids[0], "Purchase", {
        contents: [{ id: "max", quantity: 1, item_price: Number.MAX_SAFE_INTEGER }],
      });
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(2).every((outcome) => outcome.disposition === "transport-settled")).toBe(true);
      expect(env.receiver.arrivals.map(fields)).toEqual([
        ...ids.map((pixel) => ({
          pixel, event: "Purchase", eventId: "synthetic", orderId: "1", value: "7",
          contents: '[{"id":"sku","quantity":1,"item_price":100},{"id":2,"quantity":3},{"id":"zero","quantity":0.5,"item_price":0}]',
        })),
        {
          pixel: ids[1], event: "Purchase", eventId: null, orderId: null, value: null,
          contents: '[{"id":"fraction","quantity":2,"item_price":1.25}]',
        },
        {
          pixel: ids[0], event: "Purchase", eventId: null, orderId: null, value: null,
          contents: `[{"id":"max","quantity":1,"item_price":${Number.MAX_SAFE_INTEGER}}]`,
        },
      ]);
      expect(JSON.stringify(state)).not.toContain("sku");
      expect(JSON.stringify(state)).not.toContain("synthetic");
    } finally { await env.close(); }
  }, 5000);

  it("rejects malformed or unsupported prices and item fields without reading accessors", async () => {
    const env = await setup();
    try {
      let reads = 0;
      const invalid = [
        undefined, null, "100", true, 1n, NaN, Infinity, -Infinity, -1, -0, Number.MAX_SAFE_INTEGER + 1, [], {},
      ];
      env.adapter.fbq("init", ids[0]);
      for (const item_price of invalid) {
        env.adapter.fbq("trackCustom", "Purchase", { contents: [{ id: "sku", quantity: 1, item_price }] });
      }
      env.adapter.fbq("trackCustom", "Purchase", {
        contents: [{ id: "sku", quantity: 1, get item_price() { reads += 1; return 100; } }],
      });
      env.adapter.fbq("trackCustom", "Purchase", {
        contents: [{ id: "sku", quantity: 1, item_price: 100, extra: 1 }],
      });
      env.adapter.fbq("trackCustom", "Purchase", { contents: [{ id: "sku", item_price: 100 }] });
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(1).map((item) => item.reason))
        .toEqual(Array(invalid.length + 3).fill("unsupported-parameters"));
      expect(reads).toBe(0);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("preserves empty and maximum-sized arrays without changing item limits", async () => {
    const env = await setup();
    try {
      const maximum = Array.from({ length: 16 }, (_, index) => ({ id: index, quantity: 1, item_price: 100 }));
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("track", "Purchase", { contents: [] });
      env.adapter.fbq("track", "Purchase", { contents: undefined });
      env.adapter.fbq("track", "Purchase", { contents: maximum });
      env.adapter.fbq("track", "Purchase", { contents: [...maximum, maximum[0]] });
      expect((await env.adapter.flush()).outcomes.slice(1).map((outcome) => outcome.reason || outcome.disposition))
        .toEqual(["transport-settled", "transport-settled", "transport-settled", "unsupported-parameters"]);
      expect(env.receiver.arrivals.map(fields).map((item) => item.contents))
        .toEqual(["[]", null, JSON.stringify(maximum)]);
    } finally { await env.close(); }
  }, 5000);

  it("does not let tag grant override host denial or replay held items", async () => {
    const env = await setup({ consent: { ad_storage: "denied" }, experimentalTagConsent: true });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("consent", "grant");
      env.adapter.fbq("trackCustom", "Purchase", { contents: [{ id: "held", quantity: 1, item_price: 100 }] });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      env.adapter.setConsent({ ad_storage: "granted" });
      await env.adapter.flush();
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.fbq("trackCustom", "Purchase", { contents: [{ id: "new", quantity: 1, item_price: 100 }] });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(env.receiver.arrivals.map(fields)[0].contents).toBe('[{"id":"new","quantity":1,"item_price":100}]');
    } finally { await env.close(); }
  }, 5000);

  it("holds remaining priced broadcast branches on revoke and does not replay", async () => {
    let adapter;
    let count = 0;
    const env = await setup({ experimentalTagConsent: true }, {
      respond(_request, response) {
        count += 1;
        if (count === 1) {
          adapter.fbq("consent", "revoke");
          adapter.fbq("consent", "grant");
        }
        response.writeHead(204).end();
      },
    });
    adapter = env.adapter;
    try {
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      adapter.fbq("trackCustom", "Purchase", { contents: [{ id: "sku", quantity: 1, item_price: 100 }] });
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "initialized", "partial", "consent-updated", "consent-updated"]);
      expect(state.outcomes[2].branches.map((branch) => branch.disposition)).toEqual(["transport-settled", "held"]);
      await adapter.flush();
      expect(env.receiver.arrivals.map(fields).map((item) => item.pixel)).toEqual([ids[0]]);
    } finally { await env.close(); }
  }, 5000);

  it("enforces the existing encoded URL ceiling before dispatch", async () => {
    const context = page();
    const env = await setup({ captureContext: () => context });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("init", ids[1]);
      context.pageURL = `https://example.test/${"é".repeat(400)}`;
      const contents = Array.from({ length: 16 }, () => ({ id: "雪".repeat(64), quantity: 1, item_price: 100 }));
      env.adapter.fbq("trackCustom", "Purchase", { contents });
      context.pageURL = "https://example.test/next";
      env.adapter.fbq("trackSingle", ids[1], "Purchase", { contents: [{ id: "ok", quantity: 1, item_price: 100 }] });
      expect((await env.adapter.flush()).outcomes.slice(2).map((outcome) => outcome.reason || outcome.disposition))
        .toEqual(["encoded-context-limit", "transport-settled"]);
      expect(env.receiver.arrivals.map(fields)[0].contents).toBe('[{"id":"ok","quantity":1,"item_price":100}]');
      expect(env.receiver.arrivals).toHaveLength(1);
    } finally { await env.close(); }
  }, 5000);
});
