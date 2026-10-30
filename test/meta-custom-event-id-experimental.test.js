import { describe, expect, it } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
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
    experimentalCustomProperties: true, experimentalNumericOrderId: true, experimentalContents: true,
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
  const params = new URL(arrival.url).searchParams;
  return {
    pixel: params.get("id"), event: params.get("ev"),
    eventIds: params.getAll("eid"),
    data: [...params].filter(([key]) => key.startsWith("cd[")),
  };
}

describe("experimental custom event IDs through the serialized Meta worker", () => {
  it("snapshots custom data and options for each broadcast branch and does not deduplicate", async () => {
    const env = await setup();
    try {
      const data = { order_id: 1, contents: [{ id: "sku", quantity: 1 }] };
      const options = { eventID: "synthetic & 雪" };
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("init", ids[1]);
      env.adapter.fbq("trackCustom", "Purchase", data, options);
      data.order_id = 2;
      data.contents[0].quantity = 9;
      options.eventID = "changed";
      env.adapter.fbq("trackCustom", "Purchase", { order_id: 1 }, { eventID: "synthetic & 雪" });
      env.adapter.fbq("track", "Purchase", {}, { eventID: "standard" });
      env.adapter.fbq("trackSingle", ids[1], "Purchase", {}, { eventID: "targeted" });
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(2).every((item) => item.disposition === "transport-settled")).toBe(true);
      expect(env.receiver.arrivals.map(fields)).toEqual([
        ...ids.map((pixel) => ({
          pixel, event: "Purchase", eventIds: ["synthetic & 雪"],
          data: [["cd[contents]", '[{"id":"sku","quantity":1}]'], ["cd[order_id]", "1"]],
        })),
        ...ids.map((pixel) => ({
          pixel, event: "Purchase", eventIds: ["synthetic & 雪"], data: [["cd[order_id]", "1"]],
        })),
        ...ids.map((pixel) => ({ pixel, event: "Purchase", eventIds: ["standard"], data: [] })),
        { pixel: ids[1], event: "Purchase", eventIds: ["targeted"], data: [] },
      ]);
      const stateJSON = JSON.stringify(state);
      expect(stateJSON).not.toContain("synthetic &");
      expect(stateJSON).not.toContain("order_id");
    } finally { await env.close(); }
  }, 5000);

  it("supports the fourth argument for one synthetic Pixel without changing default-off behavior", async () => {
    const env = await setup({ experimentalRouting: false, experimentalMultiPixelRouting: false });
    try {
      env.adapter.fbq("init", "000000000000000");
      env.adapter.fbq("trackCustom", "Purchase", { order_id: 1 }, { eventID: "local" });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(env.receiver.arrivals.map(fields)).toEqual([
        { pixel: "000000000000000", event: "Purchase", eventIds: ["local"], data: [["cd[order_id]", "1"]] },
      ]);
    } finally { await env.close(); }
    const disabled = await setup({ experimentalEventIds: false });
    try {
      disabled.adapter.fbq("init", ids[0]);
      disabled.adapter.fbq("trackCustom", "Purchase", {}, { eventID: "local" });
      expect((await disabled.adapter.flush()).outcomes.at(-1).reason).toBe("unsupported-argument");
      expect(disabled.receiver.arrivals).toEqual([]);
    } finally { await disabled.close(); }
  }, 5000);

  it("rejects malformed, disabled and targeted-custom options without dispatch", async () => {
    const env = await setup();
    try {
      let getterReads = 0;
      const options = [
        null, [], {}, { eventID: "" }, { eventID: "x".repeat(65) }, { eventID: "\ud800" },
        { eventID: undefined }, { eventID: null }, { eventID: 1 }, { eventID: "one", extra: true },
        Object.assign(Object.create({ extra: true }), { eventID: "one" }),
        { get eventID() { getterReads += 1; return "one"; } },
        { eventID: "one", [Symbol("extra")]: 1 },
      ];
      env.adapter.fbq("init", ids[0]);
      for (const item of options) env.adapter.fbq("trackCustom", "Purchase", {}, item);
      env.adapter.fbq("trackCustom", "Purchase", { order_id: -1 }, { eventID: "valid" });
      env.adapter.fbq("trackSingleCustom", ids[0], "Purchase", {}, { eventID: "valid" });
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(1).map((item) => item.reason)).toEqual([
        ...options.map(() => "unsupported-options"), "unsupported-parameters", "unsupported-argument",
      ]);
      expect(getterReads).toBe(0);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
    const disabled = await setup({ experimentalEvents: false });
    try {
      disabled.adapter.fbq("init", ids[0]);
      disabled.adapter.fbq("trackCustom", "Purchase", {}, { eventID: "local" });
      expect((await disabled.adapter.flush()).outcomes.at(-1).reason).toBe("unsupported-argument");
      expect(disabled.receiver.arrivals).toEqual([]);
    } finally { await disabled.close(); }
  }, 5000);

  it("honors independent host denial despite tag grant and does not replay", async () => {
    const env = await setup({ consent: { ad_storage: "denied" }, experimentalTagConsent: true });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("init", ids[1]);
      env.adapter.fbq("consent", "grant");
      env.adapter.fbq("trackCustom", "Purchase", {}, { eventID: "held" });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      env.adapter.setConsent({ ad_storage: "granted" });
      await env.adapter.flush();
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.fbq("trackCustom", "Purchase", {}, { eventID: "new" });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(env.receiver.arrivals.map(fields)).toEqual(ids.map((pixel) => ({
        pixel, event: "Purchase", eventIds: ["new"], data: [],
      })));
    } finally { await env.close(); }
  }, 5000);

  it("holds after tag revoke and does not replay after grant", async () => {
    const env = await setup({ experimentalTagConsent: true });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("consent", "revoke");
      env.adapter.fbq("trackCustom", "Purchase", {}, { eventID: "held" });
      env.adapter.fbq("consent", "grant");
      expect((await env.adapter.flush()).outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "consent-updated", "held", "consent-updated"]);
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.fbq("trackCustom", "Purchase", {}, { eventID: "new" });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(env.receiver.arrivals.map(fields)).toEqual([
        { pixel: ids[0], event: "Purchase", eventIds: ["new"], data: [] },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("holds remaining broadcast branches when consent is revoked during an in-flight event", async () => {
    let adapter;
    let requests = 0;
    const env = await setup({ experimentalTagConsent: true }, {
      respond(_request, response) {
        requests += 1;
        if (requests === 1) {
          adapter.fbq("consent", "revoke");
          adapter.fbq("consent", "grant");
          adapter.fbq("trackSingle", ids[1], "Purchase", {}, { eventID: "new" });
        }
        response.writeHead(204).end();
      },
    });
    adapter = env.adapter;
    try {
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      adapter.fbq("trackCustom", "Purchase", {}, { eventID: "broadcast" });
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "initialized", "partial", "consent-updated", "consent-updated", "transport-settled"]);
      expect(state.outcomes[2].branches.map((branch) => branch.disposition)).toEqual(["transport-settled", "held"]);
      expect(env.receiver.arrivals.map(fields)).toEqual([
        { pixel: ids[0], event: "Purchase", eventIds: ["broadcast"], data: [] },
        { pixel: ids[1], event: "Purchase", eventIds: ["new"], data: [] },
      ]);
      expect(state.host).toMatchObject({ dispatchAttempts: 2, consentHeld: 1 });
    } finally { await env.close(); }
  }, 5000);

  it("enforces the existing encoded URL ceiling before dispatch", async () => {
    const context = page();
    const env = await setup({ captureContext: () => context });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("init", ids[1]);
      context.pageURL = `https://example.test/${"é".repeat(1400)}`;
      env.adapter.fbq("trackCustom", "Purchase", {}, { eventID: "x".repeat(64) });
      context.pageURL = "https://example.test/next";
      env.adapter.fbq("track", "PageView", {}, { eventID: "next" });
      expect((await env.adapter.flush()).outcomes.slice(2).map((item) => item.reason || item.disposition))
        .toEqual(["encoded-context-limit", "transport-settled"]);
      expect(env.receiver.arrivals.map(fields)).toEqual(ids.map((pixel) => ({
        pixel, event: "PageView", eventIds: ["next"], data: [],
      })));
    } finally { await env.close(); }
  }, 5000);
});
