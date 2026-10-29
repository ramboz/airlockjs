import { describe, expect, it } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
import { createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

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
    experimentalContentIds: true, experimentalRouting: true, experimentalMultiPixelRouting: true, ...options,
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
  const query = new URL(arrival.url).searchParams;
  return { id: query.get("id"), event: query.get("ev"), contentIds: query.get("cd[content_ids]"),
    value: query.get("cd[value]"), contentType: query.get("cd[content_type]") };
}

describe("experimental content ID arrays through the real worker", () => {
  it("requires a boolean opt-in alongside the existing data opt-in", () => {
    const endpoint = "http://127.0.0.1:43210/tr/";
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint, experimentalContentIds: "true" })).toThrow("invalid-experimental-option");
      expect(() => create({ endpoint, experimentalContentIds: true })).toThrow("content-ids-require-pageview-data");
    }
  });

  it("snapshots ordered, typed and repeated IDs across broadcast and targeted requests", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      const input = { content_ids: ["SKU & 雪", 0, 123, "123", "SKU & 雪"], value: 12.5, content_type: "product" };
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      adapter.fbq("track", "Purchase", input);
      input.content_ids[0] = "changed";
      input.content_ids.push("late");
      input.value = 99;
      adapter.fbq("trackSingle", ids[1], "AddToCart", { content_ids: ["target"] });
      const state = await adapter.flush();
      expect(state.outcomes.slice(2).map((outcome) => outcome.disposition)).toEqual([
        "transport-settled", "transport-settled",
      ]);
      const json = JSON.stringify(["SKU & 雪", 0, 123, "123", "SKU & 雪"]);
      expect(receiver.arrivals.map(dataFrom)).toEqual([
        ...ids.map((id) => ({ id, event: "Purchase", contentIds: json, value: "12.5", contentType: "product" })),
        { id: ids[1], event: "AddToCart", contentIds: '["target"]', value: null, contentType: null },
      ]);
      expect(JSON.stringify(state)).not.toContain("SKU");
    } finally { await env.close(); }
  }, 5000);

  it("does not enable arrays in any previous mode", async () => {
    const env = await setup({ experimentalContentIds: false });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("track", "Purchase", { content_ids: ["one"] });
      expect((await env.adapter.flush()).outcomes.at(-1)).toMatchObject({ reason: "unsupported-parameters" });
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("supports only the new ID field without enabling scalar events, routing or standard events", async () => {
    const env = await setup({
      experimentalScalarEventData: false, experimentalEvents: false,
      experimentalRouting: false, experimentalMultiPixelRouting: false,
    });
    try {
      env.adapter.fbq("init", "000000000000000");
      env.adapter.fbq("track", "PageView", { content_ids: ['"\\&雪'] });
      env.adapter.fbq("track", "PageView", { content_ids: ["ok"], region: "us" });
      const state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "initialized", "transport-settled", "unsupported-parameters",
      ]);
      expect(env.receiver.arrivals.map(dataFrom)).toEqual([
        { id: "000000000000000", event: "PageView", contentIds: JSON.stringify(['"\\&雪']), value: null, contentType: null },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects malformed, sparse, accessor, oversized and extra-property arrays without reading getters", async () => {
    const env = await setup();
    try {
      let reads = 0;
      const accessor = ["one"];
      Object.defineProperty(accessor, "0", { get() { reads += 1; return "one"; }, enumerable: true });
      const extra = Object.assign(["one"], { custom: "private" });
      const symbol = Object.assign(["one"], { [Symbol("extra")]: 1 });
      const changedPrototype = ["one"];
      Object.setPrototypeOf(changedPrototype, Object.create(Array.prototype));
      const invalid = [
        "one", 1, null, [null], [undefined], [{}], [["nested"]], [""], ["a".repeat(65)], ["\ud800"],
        [-1], [-0], [1.5], [Infinity], [Number.MAX_SAFE_INTEGER + 1], Array(17).fill("a"),
        Array(1), accessor, extra, symbol, changedPrototype,
      ];
      env.adapter.fbq("init", ids[0]);
      for (const content_ids of invalid) env.adapter.fbq("track", "Purchase", { content_ids });
      expect((await env.adapter.flush()).outcomes.slice(1).map((item) => item.reason)).toEqual(
        invalid.map(() => "unsupported-parameters"),
      );
      expect(reads).toBe(0);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("independently revalidates untrusted arrays in the chamber", async () => {
    const host = createConnectorHost(createMetaPageViewPrototype, {
      endpoint: "http://127.0.0.1:43210/tr/", experimentalEvents: true,
      experimentalPageViewData: true, experimentalContentIds: true, experimentalRouting: true,
    });
    await host.init({});
    const command = (args) => ({ type: "meta-pixel-command", payload: { args, context: page() } });
    await host.routeBatch([command(["init", ids[0]])]);
    let reads = 0;
    const accessor = [];
    Object.defineProperty(accessor, "0", { get() { reads += 1; return "one"; }, enumerable: true });
    for (const content_ids of [accessor, [1.5], Array(1), Object.assign(["x"], { extra: 1 })]) {
      const result = await host.routeBatch([command(["track", "Purchase", { content_ids }])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped[0].reason).toBe("unsupported-parameters");
    }
    expect(reads).toBe(0);
  });

  it("preserves empty arrays and boundary IDs, omits undefined, and holds without replay", async () => {
    const env = await setup({ consent: { ad_storage: "denied" } });
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", ids[0]);
      adapter.fbq("track", "Purchase", { content_ids: ["x"] });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "held" });
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.fbq("track", "Purchase", { content_ids: [] });
      adapter.fbq("track", "Purchase", { content_ids: undefined });
      adapter.fbq("track", "Purchase", { content_ids: Array(15).fill("a".repeat(64)).concat(Number.MAX_SAFE_INTEGER) });
      const state = await adapter.flush();
      expect(state.outcomes.slice(-3).every((item) => item.disposition === "transport-settled")).toBe(true);
      expect(receiver.arrivals.map((arrival) => dataFrom(arrival).contentIds)).toEqual([
        "[]", null, JSON.stringify(Array(15).fill("a".repeat(64)).concat(Number.MAX_SAFE_INTEGER)),
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects an oversized encoded array before any broadcast branch", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      adapter.fbq("track", "Purchase", { content_ids: Array(16).fill("雪".repeat(64)) });
      adapter.fbq("trackSingle", ids[1], "Purchase", { content_ids: ["ok"] });
      const state = await adapter.flush();
      expect(state.outcomes.slice(-2).map((item) => item.reason || item.disposition)).toEqual([
        "encoded-context-limit", "transport-settled",
      ]);
      expect(receiver.arrivals.map(dataFrom)).toEqual([
        { id: ids[1], event: "Purchase", contentIds: '["ok"]', value: null, contentType: null },
      ]);
    } finally { await env.close(); }
  }, 5000);
});
