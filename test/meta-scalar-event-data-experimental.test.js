import { describe, expect, it } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
import { createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";
import fixture from "./fixtures/meta-tr-pageview.redacted.json";

const ids = ["000000000000001", "000000000000002"];
const page = () => ({
  pageURL: "https://example.test/one", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: -420,
});

async function setup(options = {}) {
  const receiver = await createPrototypeReceiver();
  const chamber = createNodePrototypeChamber();
  const adapter = createMetaPixelPrototype({
    endpoint: receiver.endpoint, chamber, captureContext: page, consent: { ad_storage: "granted" },
    experimentalEvents: true, experimentalPageViewData: true, experimentalScalarEventData: true,
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

function dataFrom(arrival) {
  const params = new URL(arrival.url).searchParams;
  return {
    id: params.get("id"), ev: params.get("ev"),
    data: Object.fromEntries([...params].filter(([key]) => key.startsWith("cd["))),
  };
}

describe("experimental scalar Meta event data through the real worker", () => {
  it("requires explicit boolean configuration and the existing data opt-in", () => {
    const endpoint = "http://127.0.0.1:43210/tr/";
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint, experimentalScalarEventData: "true" })).toThrow("invalid-experimental-option");
      expect(() => create({ endpoint, experimentalScalarEventData: true })).toThrow("scalar-data-requires-pageview-data");
    }
  });

  it("preserves retained region wire shape and snapshots documented scalars through targeted and broadcast events", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      const region = fixture.beacons[0]["cd[region]"];
      expect(region).toBe("us");
      const data = {
        value: 0, currency: "CAD", region, content_category: "café & 雪", content_name: "hat",
        search_string: "red+blue", content_type: "product_group", predicted_ltv: 12.75,
        num_items: 0, status: false, delivery_category: "curbside",
      };
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      adapter.fbq("track", "PageView", { region });
      adapter.fbq("track", "Purchase", data);
      data.region = "changed";
      data.content_name = "changed";
      adapter.fbq("trackSingleCustom", ids[1], "Special", { content_type: "product", status: true });
      const state = await adapter.flush();
      expect(state.outcomes.slice(2).map((outcome) => outcome.disposition)).toEqual([
        "transport-settled", "transport-settled", "transport-settled",
      ]);
      const purchase = {
        "cd[value]": "0", "cd[currency]": "CAD", "cd[region]": "us",
        "cd[content_category]": "café & 雪", "cd[content_name]": "hat",
        "cd[search_string]": "red+blue", "cd[content_type]": "product_group",
        "cd[predicted_ltv]": "12.75", "cd[num_items]": "0", "cd[status]": "false",
        "cd[delivery_category]": "curbside",
      };
      expect(receiver.arrivals.map(dataFrom)).toEqual([
        ...ids.map((id) => ({ id, ev: "PageView", data: { "cd[region]": "us" } })),
        ...ids.map((id) => ({ id, ev: "Purchase", data: purchase })),
        { id: ids[1], ev: "Special", data: { "cd[content_type]": "product", "cd[status]": "true" } },
      ]);
      expect(JSON.stringify(state)).not.toContain("café");
    } finally { await env.close(); }
  }, 5000);

  it("leaves previous data behavior unchanged without the new opt-in", async () => {
    const env = await setup({ experimentalScalarEventData: false });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("track", "PageView", { region: "us" });
      env.adapter.fbq("track", "Purchase", { content_name: "hat" });
      env.adapter.fbq("track", "Purchase", { value: 1, currency: "USD" });
      expect((await env.adapter.flush()).outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "initialized", "unsupported-parameters", "unsupported-parameters", "transport-settled",
      ]);
      expect(env.receiver.arrivals.map(dataFrom)).toEqual([
        { id: ids[0], ev: "Purchase", data: { "cd[value]": "1", "cd[currency]": "USD" } },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects malformed, inherited, nested and unknown data without invoking accessors or sending", async () => {
    const env = await setup();
    try {
      let getterReads = 0;
      const inputs = [
        { region: null }, { region: "x".repeat(65) }, { region: "\ud800" },
        { content_name: 1 }, { search_string: [] }, { content_type: "other" },
        { delivery_category: "delivery" }, { predicted_ltv: NaN }, { predicted_ltv: "12" },
        { num_items: -1 }, { num_items: 1.1 }, { num_items: Number.MAX_SAFE_INTEGER + 1 },
        { status: 0 }, { content_ids: ["a"] }, { contents: [{ id: "a", quantity: 1 }] },
        { value: 1, unknown: "not-dropped" },
        Object.assign(Object.create({ region: "us" }), { value: 1 }),
        { get region() { getterReads += 1; return "us"; } },
        { [Symbol("field")]: "x" },
      ];
      env.adapter.fbq("init", ids[0]);
      for (const data of inputs) env.adapter.fbq("track", "Purchase", data);
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(1).map((item) => item.reason)).toEqual(inputs.map(() => "unsupported-parameters"));
      expect(getterReads).toBe(0);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("independently revalidates untrusted event data in the connector without reading getters", async () => {
    const host = createConnectorHost(createMetaPageViewPrototype, {
      endpoint: "http://127.0.0.1:43210/tr/", experimentalEvents: true,
      experimentalPageViewData: true, experimentalScalarEventData: true, experimentalRouting: true,
    });
    await host.init({});
    const command = (args) => ({ type: "meta-pixel-command", payload: { args, context: page() } });
    await host.routeBatch([command(["init", ids[0]])]);
    let reads = 0;
    for (const data of [
      { get region() { reads += 1; return "us"; } },
      Object.assign(Object.create({ status: true }), { region: "us" }),
      { num_items: 2.5 }, { contents: [] },
    ]) {
      const result = await host.routeBatch([command(["track", "Purchase", data])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped[0].reason).toBe("unsupported-parameters");
    }
    expect(reads).toBe(0);
  });

  it("accepts string and integer boundaries and each documented enum without coercion", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", ids[0]);
      adapter.fbq("track", "Purchase", {
        region: "é".repeat(64), num_items: Number.MAX_SAFE_INTEGER, content_type: "product",
        delivery_category: "in_store",
      });
      adapter.fbq("track", "Purchase", { content_type: "product_group", delivery_category: "home_delivery" });
      expect((await adapter.flush()).outcomes.slice(1).map((outcome) => outcome.disposition)).toEqual([
        "transport-settled", "transport-settled",
      ]);
      expect(receiver.arrivals.map(dataFrom)).toEqual([
        { id: ids[0], ev: "Purchase", data: {
          "cd[region]": "é".repeat(64), "cd[num_items]": String(Number.MAX_SAFE_INTEGER),
          "cd[content_type]": "product", "cd[delivery_category]": "in_store",
        } },
        { id: ids[0], ev: "Purchase", data: {
          "cd[content_type]": "product_group", "cd[delivery_category]": "home_delivery",
        } },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects an oversized encoded broadcast before any branch, then permits a later valid event", async () => {
    const context = page();
    const env = await setup({ captureContext: () => context });
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      context.pageURL = `https://example.test/${"é".repeat(1350)}`;
      adapter.fbq("track", "Purchase", { content_name: "雪".repeat(64) });
      context.pageURL = "https://example.test/next";
      adapter.fbq("trackSingle", ids[1], "Purchase", { content_name: "ok" });
      const state = await adapter.flush();
      expect(state.outcomes.slice(2).map((outcome) => outcome.reason || outcome.disposition)).toEqual([
        "encoded-context-limit", "transport-settled",
      ]);
      expect(receiver.arrivals.map(dataFrom)).toEqual([
        { id: ids[1], ev: "Purchase", data: { "cd[content_name]": "ok" } },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("omits undefined values, keeps zero and false, and holds without replay on consent denial", async () => {
    const env = await setup({ consent: { ad_storage: "denied" } });
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", ids[0]);
      adapter.fbq("track", "Purchase", { value: 0, num_items: 0, status: false, region: undefined });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "held" });
      expect(receiver.arrivals).toEqual([]);
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.fbq("track", "Purchase", { value: 0, num_items: 0, status: false, region: undefined });
      await adapter.flush();
      expect(receiver.arrivals.map(dataFrom)).toEqual([
        { id: ids[0], ev: "Purchase", data: { "cd[value]": "0", "cd[num_items]": "0", "cd[status]": "false" } },
      ]);
    } finally { await env.close(); }
  }, 5000);
});
