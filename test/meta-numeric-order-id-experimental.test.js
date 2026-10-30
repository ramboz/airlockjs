import { describe, expect, it } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
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
    experimentalNumericOrderId: true, experimentalRouting: true, experimentalMultiPixelRouting: true,
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

function fields(arrival) {
  const params = new URL(arrival.url).searchParams;
  return {
    pixel: params.get("id"), event: params.get("ev"),
    data: [...params].filter(([key]) => key.startsWith("cd[")),
  };
}

describe("experimental numeric order_id through the serialized Meta worker", () => {
  it("requires a boolean opt-in and the existing custom-property opt-in", () => {
    const endpoint = "http://127.0.0.1:43210/tr/";
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint, experimentalNumericOrderId: "true" })).toThrow("invalid-experimental-option");
      expect(() => create({ endpoint, experimentalNumericOrderId: true })).toThrow("numeric-order-id-requires-custom-properties");
      expect(() => create({
        endpoint, experimentalPageViewData: true, experimentalNumericOrderId: true,
      })).toThrow("numeric-order-id-requires-custom-properties");
    }
  });

  it("preserves default rejection of numeric order IDs even with custom properties", async () => {
    const env = await setup({ experimentalNumericOrderId: false });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("trackCustom", "Purchase", { order_id: 1 });
      env.adapter.fbq("trackCustom", "Purchase", { order_id: "1" });
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(1).map((outcome) => outcome.reason || outcome.disposition))
        .toEqual(["unsupported-parameters", "transport-settled"]);
      expect(env.receiver.arrivals.map(fields)[0].data).toEqual([["cd[order_id]", "1"]]);
    } finally { await env.close(); }
  }, 5000);

  it("snapshots numeric IDs for broadcast, targeted custom and standard events", async () => {
    const env = await setup();
    try {
      const data = { order_id: 1, label: "synthetic" };
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("init", ids[1]);
      env.adapter.fbq("trackCustom", "Purchase", data);
      data.order_id = 2;
      data.label = "changed";
      env.adapter.fbq("trackSingleCustom", ids[1], "Purchase", { order_id: 0 });
      env.adapter.fbq("trackSingle", ids[0], "PageView", { order_id: Number.MAX_SAFE_INTEGER });
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(2).every((outcome) => outcome.disposition === "transport-settled")).toBe(true);
      expect(env.receiver.arrivals.map(fields)).toEqual([
        ...ids.map((pixel) => ({
          pixel, event: "Purchase", data: [["cd[order_id]", "1"], ["cd[label]", "synthetic"]],
        })),
        { pixel: ids[1], event: "Purchase", data: [["cd[order_id]", "0"]] },
        { pixel: ids[0], event: "PageView", data: [["cd[order_id]", String(Number.MAX_SAFE_INTEGER)]] },
      ]);
      expect(JSON.stringify(state)).not.toContain("synthetic");
      expect(JSON.stringify(state)).not.toContain("order_id");
    } finally { await env.close(); }
  }, 5000);

  it("supports a single synthetic Pixel without changing custom-event option refusal", async () => {
    const env = await setup({
      experimentalRouting: false, experimentalMultiPixelRouting: false, experimentalEventIds: true,
    });
    try {
      env.adapter.fbq("init", "000000000000000");
      env.adapter.fbq("trackCustom", "Purchase", { order_id: 1 });
      env.adapter.fbq("trackCustom", "Purchase", { order_id: 2 }, { eventID: "synthetic" });
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(1).map((outcome) => outcome.reason || outcome.disposition))
        .toEqual(["transport-settled", "unsupported-argument"]);
      expect(env.receiver.arrivals.map(fields)).toEqual([
        { pixel: "000000000000000", event: "Purchase", data: [["cd[order_id]", "1"]] },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects unsupported types, numbers and other numeric keys without invoking accessors", async () => {
    const env = await setup();
    try {
      let reads = 0;
      const inputs = [
        { order_id: -1 }, { order_id: -0 }, { order_id: 1.5 },
        { order_id: Number.MAX_SAFE_INTEGER + 1 }, { order_id: Infinity }, { order_id: NaN },
        { order_id: true }, { order_id: null }, { order_id: undefined }, { order_id: 1n },
        { order_id: [] }, { order_id: {} }, { ORDER_ID: 1 }, { other_number: 1 },
        { get order_id() { reads += 1; return 1; } },
      ];
      env.adapter.fbq("init", ids[0]);
      for (const data of inputs) env.adapter.fbq("trackCustom", "Purchase", data);
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(1).map((outcome) => outcome.reason))
        .toEqual(inputs.map(() => "unsupported-parameters"));
      expect(reads).toBe(0);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("holds denied IDs and does not replay after host grant", async () => {
    const env = await setup({ consent: { ad_storage: "denied" }, experimentalTagConsent: true });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("consent", "grant");
      env.adapter.fbq("trackCustom", "Purchase", { order_id: 1 });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      env.adapter.setConsent({ ad_storage: "granted" });
      await env.adapter.flush();
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.fbq("trackCustom", "Purchase", { order_id: 2 });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(env.receiver.arrivals.map(fields)[0].data).toEqual([["cd[order_id]", "2"]]);
    } finally { await env.close(); }
  }, 5000);

  it("holds revoked IDs and does not replay after tag grant", async () => {
    const env = await setup({ experimentalTagConsent: true });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("consent", "revoke");
      env.adapter.fbq("trackCustom", "Purchase", { order_id: 1 });
      env.adapter.fbq("consent", "grant");
      expect((await env.adapter.flush()).outcomes.map((outcome) => outcome.disposition))
        .toEqual(["initialized", "consent-updated", "held", "consent-updated"]);
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.fbq("trackCustom", "Purchase", { order_id: 2 });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(env.receiver.arrivals.map(fields)[0].data).toEqual([["cd[order_id]", "2"]]);
    } finally { await env.close(); }
  }, 5000);

  it("enforces the existing encoded URL ceiling before dispatch", async () => {
    const context = page();
    const env = await setup({ captureContext: () => context });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("init", ids[1]);
      context.pageURL = `https://example.test/${"é".repeat(900)}`;
      const data = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [`field_${index}`, "雪".repeat(64)]));
      env.adapter.fbq("trackCustom", "Purchase", { ...data, order_id: 1 });
      context.pageURL = "https://example.test/next";
      env.adapter.fbq("trackSingleCustom", ids[1], "Purchase", { order_id: 2 });
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(2).map((outcome) => outcome.reason || outcome.disposition))
        .toEqual(["encoded-context-limit", "transport-settled"]);
      expect(env.receiver.arrivals.map(fields)).toEqual([
        { pixel: ids[1], event: "Purchase", data: [["cd[order_id]", "2"]] },
      ]);
    } finally { await env.close(); }
  }, 5000);
});
