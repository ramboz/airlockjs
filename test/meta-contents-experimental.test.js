import { describe, expect, it } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { snapshotPageViewData } from "../connectors/meta-pixel/pageview-data.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
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
    experimentalEvents: true, experimentalPageViewData: true, experimentalScalarEventData: true,
    experimentalContentIds: true, experimentalContents: true, experimentalEventIds: true,
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
    pixel: query.get("id"), event: query.get("ev"), contents: query.get("cd[contents]"),
    contentsCount: query.getAll("cd[contents]").length, contentIds: query.get("cd[content_ids]"),
    value: query.get("cd[value]"), region: query.get("cd[region]"), eventId: query.get("eid"),
  };
}

describe("experimental contents arrays through the real worker", () => {
  it("requires a boolean opt-in alongside the data opt-in", () => {
    const endpoint = "http://127.0.0.1:43210/tr/";
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint, experimentalContents: "true" })).toThrow("invalid-experimental-option");
      expect(() => create({ endpoint, experimentalContents: true })).toThrow("contents-require-pageview-data");
    }
  });

  it("snapshots nested items for broadcast, targeting and custom events", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      const data = {
        contents: [{ id: "SKU & 雪", quantity: 1.5 }, { id: 17, quantity: 0 }, { id: "SKU & 雪", quantity: 2 }],
        content_ids: ["SKU & 雪", 17], value: 12.5, region: "us",
      };
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      adapter.fbq("track", "Purchase", data, { eventID: "local-event" });
      data.contents[0].id = "changed";
      data.contents[1].quantity = 9;
      data.contents.push({ id: "late", quantity: 1 });
      data.content_ids[0] = "changed";
      adapter.fbq("trackSingle", ids[1], "AddToCart", { contents: [{ id: "target", quantity: 3 }] });
      adapter.fbq("trackCustom", "LocalCustom", { contents: [{ id: "custom", quantity: 1 }] });
      adapter.fbq("trackSingleCustom", ids[0], "LocalCustom", { contents: [{ id: "single", quantity: 2 }] });
      const state = await adapter.flush();
      expect(state.outcomes.slice(2).every((item) => item.disposition === "transport-settled")).toBe(true);
      const common = {
        contents: JSON.stringify([{ id: "SKU & 雪", quantity: 1.5 }, { id: 17, quantity: 0 }, { id: "SKU & 雪", quantity: 2 }]),
        contentsCount: 1, contentIds: JSON.stringify(["SKU & 雪", 17]), value: "12.5", region: "us", eventId: "local-event",
      };
      const simple = (pixel, event, contents) => ({
        pixel, event, contents: JSON.stringify(contents), contentsCount: 1,
        contentIds: null, value: null, region: null, eventId: null,
      });
      expect(receiver.arrivals.map(fields)).toEqual([
        ...ids.map((pixel) => ({ pixel, event: "Purchase", ...common })),
        simple(ids[1], "AddToCart", [{ id: "target", quantity: 3 }]),
        ...ids.map((pixel) => simple(pixel, "LocalCustom", [{ id: "custom", quantity: 1 }])),
        simple(ids[0], "LocalCustom", [{ id: "single", quantity: 2 }]),
      ]);
      expect(JSON.stringify(state)).not.toContain("SKU");
    } finally { await env.close(); }
  }, 5000);

  it("keeps all previous modes rejecting contents", async () => {
    const env = await setup({ experimentalContents: false });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("track", "Purchase", { contents: [{ id: "one", quantity: 1 }] });
      expect((await env.adapter.flush()).outcomes.at(-1).reason).toBe("unsupported-parameters");
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("supports only the contents opt-in without enabling routing, event names or other data", async () => {
    const env = await setup({
      experimentalScalarEventData: false, experimentalContentIds: false, experimentalEventIds: false,
      experimentalEvents: false, experimentalRouting: false, experimentalMultiPixelRouting: false,
    });
    try {
      env.adapter.fbq("init", "000000000000000");
      env.adapter.fbq("track", "PageView", { contents: [{ id: "one", quantity: 1 }] });
      env.adapter.fbq("track", "PageView", { contents: [{ id: "one", quantity: 1 }], region: "us" });
      env.adapter.fbq("track", "Purchase", { contents: [{ id: "one", quantity: 1 }] });
      const state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "initialized", "transport-settled", "unsupported-parameters", "unsupported-argument",
      ]);
      expect(env.receiver.arrivals).toHaveLength(1);
      expect(fields(env.receiver.arrivals[0]).contents).toBe('[{"id":"one","quantity":1}]');
    } finally { await env.close(); }
  }, 5000);

  it("checks consent separately for each contents-bearing branch", async () => {
    let adapter;
    const env = await setup({}, {
      respond(_request, response) {
        adapter.setConsent({ ad_storage: "denied" });
        response.writeHead(204).end();
      },
    });
    adapter = env.adapter;
    try {
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      adapter.fbq("track", "Purchase", { contents: [{ id: "one", quantity: 1 }] });
      const state = await adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({
        disposition: "partial", requests: 2, selected: 2,
        branches: [
          { ordinal: 1, disposition: "transport-settled", status: 204 },
          { ordinal: 2, disposition: "held", status: 0, reason: "held-at-seal" },
        ],
      });
      expect(env.receiver.arrivals.map((arrival) => fields(arrival).pixel)).toEqual([ids[0]]);
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(env.receiver.arrivals).toHaveLength(1);
    } finally { await env.close(); }
  }, 5000);

  it("rejects malformed or unsupported nested items without reading accessors", async () => {
    const env = await setup({ queueLimit: 64 });
    try {
      let reads = 0;
      const accessor = { get id() { reads += 1; return "one"; }, quantity: 1 };
      const quantityAccessor = { id: "one", get quantity() { reads += 1; return 1; } };
      const arrayAccessor = [];
      Object.defineProperty(arrayAccessor, "0", { get() { reads += 1; return { id: "one", quantity: 1 }; }, enumerable: true });
      const invalid = [
        null, "one", {}, [null], [[]], [1], [undefined], Array(1),
        arrayAccessor, Object.assign([{ id: "one", quantity: 1 }], { extra: true }),
        [{ id: "one" }], [{ quantity: 1 }], [{ id: "one", quantity: 1, item_price: 2 }],
        [Object.assign({ id: "one", quantity: 1 }, { [Symbol("extra")]: 1 })],
        [Object.assign(Object.create({ extra: true }), { id: "one", quantity: 1 })],
        [accessor], [quantityAccessor], [{ id: "", quantity: 1 }], [{ id: "x".repeat(65), quantity: 1 }],
        [{ id: "\ud800", quantity: 1 }], [{ id: -1, quantity: 1 }], [{ id: -0, quantity: 1 }],
        [{ id: 1.5, quantity: 1 }], [{ id: {}, quantity: 1 }], [{ id: "one", quantity: undefined }],
        [{ id: "one", quantity: "1" }], [{ id: "one", quantity: null }], [{ id: "one", quantity: -1 }],
        [{ id: "one", quantity: -0 }], [{ id: "one", quantity: NaN }], [{ id: "one", quantity: Infinity }],
        [{ id: "one", quantity: Number.MAX_SAFE_INTEGER + 1 }], Array(17).fill({ id: "one", quantity: 1 }),
      ];
      env.adapter.fbq("init", ids[0]);
      for (const contents of invalid) env.adapter.fbq("track", "Purchase", { contents });
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(1).map((item) => item.reason)).toEqual(invalid.map(() => "unsupported-parameters"));
      expect(reads).toBe(0);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("checks array length before enumeration and rejects changing lengths", () => {
    let enumerations = 0;
    const oversized = new Proxy(Array(17), {
      ownKeys(target) { enumerations += 1; return Reflect.ownKeys(target); },
    });
    expect(snapshotPageViewData({ contents: oversized }, false, false, true)).toBeNull();
    expect(enumerations).toBe(0);
    const changing = new Proxy([{ id: "one", quantity: 1 }, { id: "two", quantity: 2 }], {
      ownKeys(target) { target.pop(); return Reflect.ownKeys(target); },
    });
    expect(snapshotPageViewData({ contents: changing }, false, false, true)).toBeNull();
  });

  it("independently revalidates nested items in the connector", async () => {
    const host = createConnectorHost(createMetaPageViewPrototype, {
      endpoint: "http://127.0.0.1:43210/tr/", experimentalEvents: true,
      experimentalPageViewData: true, experimentalContents: true, experimentalRouting: true,
    });
    await host.init({});
    const command = (args) => ({ type: "meta-pixel-command", payload: { args, context: page() } });
    await host.routeBatch([command(["init", ids[0]])]);
    let reads = 0;
    const invalid = [[{ id: "one", quantity: "1" }], [{ id: "one", quantity: 1, item_price: 2 }],
      [{ get id() { reads += 1; return "one"; }, quantity: 1 }], Array(1)];
    for (const contents of invalid) {
      const result = await host.routeBatch([command(["track", "Purchase", { contents }])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped[0].reason).toBe("unsupported-parameters");
    }
    expect(reads).toBe(0);
  });

  it("preserves empty and boundary values, omits undefined, and holds without replay", async () => {
    const env = await setup({ consent: { ad_storage: "denied" } });
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", ids[0]);
      adapter.fbq("track", "Purchase", { contents: [{ id: "held", quantity: 1 }] });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.fbq("track", "Purchase", { contents: [] });
      adapter.fbq("track", "Purchase", { contents: undefined });
      const maximum = Array.from({ length: 16 }, () => ({ id: "x".repeat(64), quantity: Number.MAX_SAFE_INTEGER }));
      adapter.fbq("track", "Purchase", { contents: maximum });
      adapter.fbq("track", "Purchase", { contents: [Object.assign(Object.create(null), { id: 0, quantity: Number.MIN_VALUE })] });
      expect((await adapter.flush()).outcomes.slice(-4).every((item) => item.disposition === "transport-settled")).toBe(true);
      expect(receiver.arrivals.map((arrival) => fields(arrival).contents)).toEqual([
        "[]", null, JSON.stringify(maximum), JSON.stringify([{ id: 0, quantity: Number.MIN_VALUE }]),
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects oversized encoded contents before any broadcast branch", async () => {
    const context = page();
    const env = await setup({ captureContext: () => context });
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      context.pageURL = `https://example.test/${"é".repeat(400)}`;
      adapter.fbq("track", "Purchase", { contents: Array.from({ length: 16 }, () => ({ id: "雪".repeat(64), quantity: 1 })) });
      context.pageURL = "https://example.test/next";
      adapter.fbq("trackSingle", ids[1], "Purchase", { contents: [{ id: "ok", quantity: 1 }] });
      const state = await adapter.flush();
      expect(state.outcomes.slice(-2).map((item) => item.reason || item.disposition)).toEqual([
        "encoded-context-limit", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(1);
      expect(fields(receiver.arrivals[0]).contents).toBe('[{"id":"ok","quantity":1}]');
    } finally { await env.close(); }
  }, 5000);
});
