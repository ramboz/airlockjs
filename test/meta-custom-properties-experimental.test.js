import { describe, expect, it, vi } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { snapshotPageViewData } from "../connectors/meta-pixel/pageview-data.js";
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
    experimentalEvents: true, experimentalPageViewData: true, experimentalCustomProperties: true,
    experimentalRouting: true, experimentalMultiPixelRouting: true, ...options,
  });
  return {
    adapter, receiver, chamber,
    async close() {
      try { await adapter.dispose(); } finally {
        try { await chamber.dispose(); } finally { await receiver.close(); }
      }
    },
  };
}

function fields(arrival) {
  const params = new URL(arrival.url).searchParams;
  return {
    pixel: params.get("id"), event: params.get("ev"),
    data: [...params].filter(([key]) => key.startsWith("cd[")),
    eventId: params.get("eid"),
  };
}

describe("experimental custom properties through the serialized Meta worker", () => {
  it("requires a boolean opt-in and the existing event-data opt-in", () => {
    const endpoint = "http://127.0.0.1:43210/tr/";
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint, experimentalCustomProperties: "true" })).toThrow("invalid-experimental-option");
      expect(() => create({ endpoint, experimentalCustomProperties: true })).toThrow("custom-properties-require-pageview-data");
    }
  });

  it("keeps unknown properties rejected without the new opt-in", async () => {
    const env = await setup({ experimentalCustomProperties: false });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("track", "PageView", { example_label: "synthetic" });
      env.adapter.fbq("trackCustom", "LocalCustom", { example_label: "synthetic" });
      expect((await env.adapter.flush()).outcomes.slice(1).map((outcome) => outcome.reason))
        .toEqual(["unsupported-parameters", "unsupported-parameters"]);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("snapshots string properties on standard, custom, broadcast and targeted calls", async () => {
    const env = await setup({ experimentalEventIds: true });
    try {
      const { adapter, receiver } = env;
      const data = { value: 12, currency: "USD", campaign_label: "synthetic & 雪", slot: "" };
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      adapter.fbq("track", "Purchase", data, { eventID: "synthetic-event" });
      data.campaign_label = "changed";
      data.slot = "changed";
      adapter.fbq("trackCustom", "LocalCustom", { placement: "header" });
      adapter.fbq("trackSingleCustom", ids[1], "LocalCustom", { placement: "footer" });
      adapter.fbq("trackSingle", ids[0], "PageView", { placement: "page" });
      const state = await adapter.flush();
      expect(state.outcomes.slice(2).every((item) => item.disposition === "transport-settled")).toBe(true);
      expect(receiver.arrivals.map(fields)).toEqual([
        ...ids.map((pixel) => ({
          pixel, event: "Purchase", eventId: "synthetic-event",
          data: [["cd[value]", "12"], ["cd[currency]", "USD"], ["cd[campaign_label]", "synthetic & 雪"], ["cd[slot]", ""]],
        })),
        ...ids.map((pixel) => ({ pixel, event: "LocalCustom", eventId: null, data: [["cd[placement]", "header"]] })),
        { pixel: ids[1], event: "LocalCustom", eventId: null, data: [["cd[placement]", "footer"]] },
        { pixel: ids[0], event: "PageView", eventId: null, data: [["cd[placement]", "page"]] },
      ]);
      expect(JSON.stringify(state)).not.toContain("synthetic &");
      expect(JSON.stringify(state)).not.toContain("synthetic-event");
    } finally { await env.close(); }
  }, 5000);

  it("supports the opt-in for PageView without enabling custom event names", async () => {
    const env = await setup({ experimentalEvents: false, experimentalRouting: false, experimentalMultiPixelRouting: false });
    try {
      env.adapter.fbq("init", "000000000000000");
      env.adapter.fbq("track", "PageView", { placement: "page" });
      env.adapter.fbq("trackCustom", "Custom", { placement: "page" });
      const state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition))
        .toEqual(["initialized", "transport-settled", "unsupported-argument"]);
      expect(env.receiver.arrivals.map(fields)).toEqual([
        { pixel: "000000000000000", event: "PageView", eventId: null, data: [["cd[placement]", "page"]] },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects malformed or reserved fields without invoking accessors or downgrading other opt-ins", async () => {
    const env = await setup();
    try {
      let getterReads = 0;
      const nullRecord = Object.create(null);
      nullRecord.__proto__ = "synthetic";
      const inputs = [
        { bad: 1 }, { bad: false }, { bad: null }, { bad: undefined }, { bad: [] },
        { bad: {} }, { bad: "x".repeat(65) }, { bad: "\ud800" },
        { "": "x" }, { "9bad": "x" }, { "bad-name": "x" }, { ["a".repeat(33)]: "x" },
        { region: "us" }, { content_ids: "not-an-array" }, { contents: "not-an-array" },
        { VALUE: "not-a-value" }, { eventID: "not-an-option" }, { external_id: "not-identity" }, { fbp: "not-a-cookie" },
        { constructor: "not-supported" }, nullRecord,
        { get custom() { getterReads += 1; return "not-read"; } },
        { [Symbol("custom")]: "x" },
        Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`field_${index}`, "x"])),
      ];
      env.adapter.fbq("init", ids[0]);
      for (const data of inputs) env.adapter.fbq("track", "Purchase", data);
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(1).map((item) => item.reason)).toEqual(inputs.map(() => "unsupported-parameters"));
      expect(getterReads).toBe(0);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("accepts exactly eight bounded properties and composes with separately enabled data", async () => {
    const env = await setup({ experimentalScalarEventData: true, experimentalContentIds: true });
    try {
      const custom = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`field_${index}`, "é".repeat(64)]));
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("track", "Purchase", { ...custom, region: "us", content_ids: ["SKU"] });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      const data = Object.fromEntries(fields(env.receiver.arrivals[0]).data);
      expect(data["cd[region]"]).toBe("us");
      expect(data["cd[content_ids]"]).toBe('["SKU"]');
      expect(data["cd[field_0]"]).toBe("é".repeat(64));
      expect(data["cd[field_7]"]).toBe("é".repeat(64));
      expect(Object.keys(data)).toHaveLength(10);
    } finally { await env.close(); }
  }, 5000);

  it("accepts the exact key and value boundaries", async () => {
    const env = await setup();
    try {
      const key = "a".repeat(32);
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("track", "PageView", { [key]: "x".repeat(64), blank: "" });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(fields(env.receiver.arrivals[0]).data).toEqual([
        [`cd[${key}]`, "x".repeat(64)], ["cd[blank]", ""],
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects excessive keys before reading their descriptors", () => {
    const descriptors = vi.fn();
    const oversized = new Proxy(
      Object.fromEntries(Array.from({ length: 22 }, (_, index) => [`field_${index}`, "x"])),
      {
        getOwnPropertyDescriptor(target, key) {
          descriptors(key);
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      },
    );
    expect(snapshotPageViewData(oversized, false, false, false, true)).toBeNull();
    expect(descriptors).not.toHaveBeenCalled();
  });

  it("revalidates event properties in the connector without reading getters", async () => {
    const host = createConnectorHost(createMetaPageViewPrototype, {
      endpoint: "http://127.0.0.1:43210/tr/", experimentalEvents: true, experimentalRouting: true,
      experimentalPageViewData: true, experimentalCustomProperties: true,
    });
    await host.init({});
    const command = (args) => ({ type: "meta-pixel-command", payload: { args, context: page() } });
    await host.routeBatch([command(["init", ids[0]])]);
    let reads = 0;
    for (const data of [
      { get private() { reads += 1; return "not-read"; } },
      { custom: [] },
      { content_ids: "not-an-array" },
      Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`field_${index}`, "x"])),
    ]) {
      const result = await host.routeBatch([command(["track", "Purchase", data])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped[0].reason).toBe("unsupported-parameters");
    }
    expect(reads).toBe(0);
  });

  it("holds denied custom properties without replay and permits only later new events", async () => {
    const env = await setup({ consent: { ad_storage: "denied" } });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("track", "Purchase", { placement: "held" });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.setConsent({ ad_storage: "granted" });
      await env.adapter.flush();
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.fbq("track", "Purchase", { placement: "new" });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(env.receiver.arrivals.map(fields)).toEqual([
        { pixel: ids[0], event: "Purchase", eventId: null, data: [["cd[placement]", "new"]] },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("holds opted-in properties after a tag revoke and does not replay on grant", async () => {
    const env = await setup({ experimentalTagConsent: true });
    try {
      env.adapter.fbq("consent", "revoke");
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("trackCustom", "LocalCustom", { placement: "held" });
      env.adapter.fbq("consent", "grant");
      expect((await env.adapter.flush()).outcomes.map((item) => item.disposition))
        .toEqual(["consent-updated", "initialized", "held", "consent-updated"]);
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.fbq("trackCustom", "LocalCustom", { placement: "new" });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(fields(env.receiver.arrivals[0]).data).toEqual([["cd[placement]", "new"]]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects an oversized encoded request before any selected branch", async () => {
    const context = page();
    const env = await setup({ captureContext: () => context });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("init", ids[1]);
      context.pageURL = `https://example.test/${"é".repeat(900)}`;
      const data = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`field_${index}`, "雪".repeat(64)]));
      env.adapter.fbq("track", "Purchase", data);
      context.pageURL = "https://example.test/next";
      env.adapter.fbq("trackSingle", ids[1], "PageView", { placement: "ok" });
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(2).map((item) => item.reason || item.disposition))
        .toEqual(["encoded-context-limit", "transport-settled"]);
      expect(env.receiver.arrivals).toHaveLength(1);
      expect(fields(env.receiver.arrivals[0]).data).toEqual([["cd[placement]", "ok"]]);
    } finally { await env.close(); }
  }, 5000);
});
