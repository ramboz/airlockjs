import { describe, expect, it } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { snapshotPageViewData } from "../connectors/meta-pixel/pageview-data.js";
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
    experimentalEvents: true, experimentalPageViewData: true, experimentalScalarEventData: true,
    experimentalContentNameArray: true, experimentalContents: true, experimentalContentsItemPrice: true,
    experimentalEventIds: true, experimentalRouting: true, experimentalMultiPixelRouting: true, ...options,
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
    names: query.getAll("cd[content_name]"), contents: query.get("cd[contents]"), value: query.get("cd[value]"),
  };
}

describe("experimental content_name arrays through the serialized Meta worker", () => {
  it("requires a boolean opt-in alongside the scalar event-data opt-in", () => {
    const endpoint = "http://127.0.0.1:43210/tr/";
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint, experimentalContentNameArray: "true" })).toThrow("invalid-experimental-option");
      expect(() => create({ endpoint, experimentalContentNameArray: true })).toThrow("content-name-array-requires-scalar-data");
      expect(() => create({
        endpoint, experimentalPageViewData: true, experimentalContentNameArray: true,
      })).toThrow("content-name-array-requires-scalar-data");
    }
  });

  it("keeps arrays rejected by default and existing strings unchanged", async () => {
    const env = await setup({ experimentalContentNameArray: false });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("trackCustom", "Purchase", { content_name: ["Test Product"] });
      env.adapter.fbq("trackCustom", "Purchase", { content_name: "Test Product" });
      expect((await env.adapter.flush()).outcomes.slice(1).map((outcome) => outcome.reason || outcome.disposition))
        .toEqual(["unsupported-parameters", "transport-settled"]);
      expect(env.receiver.arrivals.map(fields)[0].names).toEqual(["Test Product"]);
    } finally { await env.close(); }
  }, 5000);

  it("snapshots custom Purchase names and retains standard and targeted behavior", async () => {
    const env = await setup();
    try {
      const names = ["Test Product", "Second & 雪", "Test Product"];
      const contents = [{ id: "sku", quantity: 1, item_price: 100 }];
      const options = { eventID: "synthetic" };
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("init", ids[1]);
      env.adapter.fbq("trackCustom", "Purchase", { content_name: names, contents, value: 7 }, options);
      names[0] = "changed";
      names.push("late");
      contents[0].item_price = 9;
      options.eventID = "changed";
      env.adapter.fbq("trackSingle", ids[1], "Purchase", { content_name: ["Target"] });
      env.adapter.fbq("trackSingleCustom", ids[0], "Purchase", { content_name: "Scalar" });
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(2).every((outcome) => outcome.disposition === "transport-settled")).toBe(true);
      expect(env.receiver.arrivals.map(fields)).toEqual([
        ...ids.map((pixel) => ({
          pixel, event: "Purchase", eventId: "synthetic", names: ['["Test Product","Second & 雪","Test Product"]'],
          contents: '[{"id":"sku","quantity":1,"item_price":100}]', value: "7",
        })),
        { pixel: ids[1], event: "Purchase", eventId: null, names: ['["Target"]'], contents: null, value: null },
        { pixel: ids[0], event: "Purchase", eventId: null, names: ["Scalar"], contents: null, value: null },
      ]);
      expect(JSON.stringify(state)).not.toContain("Test Product");
      expect(JSON.stringify(state)).not.toContain("synthetic");
    } finally { await env.close(); }
  }, 5000);

  it("supports a single synthetic Pixel without enabling custom events or other data", async () => {
    const env = await setup({
      experimentalEvents: false, experimentalEventIds: false, experimentalContents: false,
      experimentalContentsItemPrice: false, experimentalRouting: false, experimentalMultiPixelRouting: false,
    });
    try {
      env.adapter.fbq("init", "000000000000000");
      env.adapter.fbq("track", "PageView", { content_name: ["Test Product"] });
      env.adapter.fbq("track", "PageView", { content_name: "" });
      env.adapter.fbq("trackCustom", "Purchase", { content_name: ["Test Product"] });
      expect((await env.adapter.flush()).outcomes.map((item) => item.reason || item.disposition))
        .toEqual(["initialized", "transport-settled", "transport-settled", "unsupported-argument"]);
      expect(env.receiver.arrivals.map(fields).map((item) => item.names))
        .toEqual([['["Test Product"]'], [""]]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects malformed arrays and elements without invoking accessors", async () => {
    const env = await setup();
    try {
      let reads = 0;
      const arrayAccessor = [];
      Object.defineProperty(arrayAccessor, "0", { get() { reads += 1; return "not-read"; }, enumerable: true });
      const invalid = [
        null, 1, true, {}, [null], [undefined], [1], [true], [{}], [[]], [""],
        ["x".repeat(65)], ["\ud800"], Array(1), Array(17).fill("name"), arrayAccessor,
        Object.assign(["name"], { extra: true }),
        Object.assign(["name"], { [Symbol("extra")]: 1 }),
        Object.assign(Object.setPrototypeOf(["name"], {}), {}),
      ];
      env.adapter.fbq("init", ids[0]);
      for (const name of invalid) env.adapter.fbq("trackCustom", "Purchase", { content_name: name });
      env.adapter.fbq("trackCustom", "Purchase", {
        get content_name() { reads += 1; return ["not-read"]; },
      });
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(1).map((item) => item.reason))
        .toEqual(Array(invalid.length + 1).fill("unsupported-parameters"));
      expect(reads).toBe(0);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("checks array length before enumeration and rejects changing lengths", () => {
    let enumerations = 0;
    const oversized = new Proxy(Array(17), {
      ownKeys(target) { enumerations += 1; return Reflect.ownKeys(target); },
    });
    expect(snapshotPageViewData({ content_name: oversized }, true, false, false, false, false, false, true)).toBeNull();
    expect(enumerations).toBe(0);
    const changing = new Proxy(["one", "two"], {
      ownKeys(target) { target.pop(); return Reflect.ownKeys(target); },
    });
    expect(snapshotPageViewData({ content_name: changing }, true, false, false, false, false, false, true)).toBeNull();
  });

  it("preserves empty and maximum-sized arrays, and omits undefined", async () => {
    const env = await setup();
    try {
      const maximum = Array.from({ length: 16 }, () => "x".repeat(64));
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("track", "Purchase", { content_name: [] });
      env.adapter.fbq("track", "Purchase", { content_name: undefined });
      env.adapter.fbq("track", "Purchase", { content_name: maximum });
      env.adapter.fbq("track", "Purchase", { content_name: [...maximum, "excess"] });
      expect((await env.adapter.flush()).outcomes.slice(1).map((item) => item.reason || item.disposition))
        .toEqual(["transport-settled", "transport-settled", "transport-settled", "unsupported-parameters"]);
      expect(env.receiver.arrivals.map(fields).map((item) => item.names))
        .toEqual([["[]"], [], [JSON.stringify(maximum)]]);
    } finally { await env.close(); }
  }, 5000);

  it("holds denied names despite tag grant and does not replay", async () => {
    const env = await setup({ consent: { ad_storage: "denied" }, experimentalTagConsent: true });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("consent", "grant");
      env.adapter.fbq("trackCustom", "Purchase", { content_name: ["held"] });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      env.adapter.setConsent({ ad_storage: "granted" });
      await env.adapter.flush();
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.fbq("trackCustom", "Purchase", { content_name: ["new"] });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(env.receiver.arrivals.map(fields)[0].names).toEqual(['["new"]']);
    } finally { await env.close(); }
  }, 5000);

  it("holds remaining broadcast branches on revoke and does not replay", async () => {
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
      adapter.fbq("trackCustom", "Purchase", { content_name: ["Test Product"] });
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
      context.pageURL = `https://example.test/${"é".repeat(900)}`;
      env.adapter.fbq("trackCustom", "Purchase", { content_name: Array(16).fill("雪".repeat(64)) });
      context.pageURL = "https://example.test/next";
      env.adapter.fbq("trackSingle", ids[1], "Purchase", { content_name: ["ok"] });
      expect((await env.adapter.flush()).outcomes.slice(2).map((item) => item.reason || item.disposition))
        .toEqual(["encoded-context-limit", "transport-settled"]);
      expect(env.receiver.arrivals.map(fields)[0].names).toEqual(['["ok"]']);
      expect(env.receiver.arrivals).toHaveLength(1);
    } finally { await env.close(); }
  }, 5000);
});
