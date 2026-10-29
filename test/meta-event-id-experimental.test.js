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
    experimentalEvents: true, experimentalPageViewData: true, experimentalEventIds: true,
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

function requestFrom(arrival) {
  const query = new URL(arrival.url).searchParams;
  return {
    id: query.get("id"), event: query.get("ev"), eventId: query.get("eid"),
    value: query.get("cd[value]"), currency: query.get("cd[currency]"),
    occurrences: query.getAll("eid").length,
  };
}

describe("experimental Meta event IDs through the real worker", () => {
  it("requires a boolean opt-in alongside the existing data opt-in", () => {
    const endpoint = "http://127.0.0.1:43210/tr/";
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint, experimentalEventIds: "true" })).toThrow("invalid-experimental-option");
      expect(() => create({ endpoint, experimentalEventIds: true })).toThrow("event-ids-require-pageview-data");
    }
  });

  it("snapshots documented broadcast and targeted options without suppressing repeated browser events", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      const data = { value: 12.5, currency: "CAD" };
      const options = { eventID: "test & 雪/one" };
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      adapter.fbq("track", "Purchase", data, options);
      data.value = 99;
      options.eventID = "changed";
      adapter.fbq("trackSingle", ids[1], "Purchase", {}, { eventID: "test & 雪/one" });
      adapter.fbq("trackSingle", ids[1], "Purchase", {}, { eventID: "test & 雪/one" });
      adapter.fbq("track", "PageView");
      const state = await adapter.flush();
      expect(state.outcomes.slice(2).every((item) => item.disposition === "transport-settled")).toBe(true);
      expect(receiver.arrivals.map(requestFrom)).toEqual([
        ...ids.map((id) => ({ id, event: "Purchase", eventId: "test & 雪/one", value: "12.5", currency: "CAD", occurrences: 1 })),
        ...[1, 2].map(() => ({ id: ids[1], event: "Purchase", eventId: "test & 雪/one", value: null, currency: null, occurrences: 1 })),
        ...ids.map((id) => ({ id, event: "PageView", eventId: null, value: null, currency: null, occurrences: 0 })),
      ]);
      expect(JSON.stringify(state)).not.toContain("test & 雪");
    } finally { await env.close(); }
  }, 5000);

  it("preserves old rejection behavior and does not infer options for custom events", async () => {
    const old = await setup({ experimentalEventIds: false });
    try {
      old.adapter.fbq("init", ids[0]);
      old.adapter.fbq("track", "Purchase", {}, { eventID: "one" });
      old.adapter.fbq("trackSingle", ids[0], "Purchase", {}, { eventID: "one" });
      expect((await old.adapter.flush()).outcomes.slice(1).map((item) => item.reason)).toEqual([
        "unsupported-argument", "argument-limit",
      ]);
      expect(old.receiver.arrivals).toEqual([]);
    } finally { await old.close(); }
    const env = await setup();
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("trackCustom", "Test", {}, { eventID: "one" });
      env.adapter.fbq("trackSingleCustom", ids[0], "Test", {}, { eventID: "one" });
      expect((await env.adapter.flush()).outcomes.slice(1).map((item) => item.reason)).toEqual([
        "unsupported-argument", "unsupported-argument",
      ]);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects invalid option records without executing accessors or sending", async () => {
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
      for (const item of options) env.adapter.fbq("track", "Purchase", {}, item);
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(1).map((item) => item.reason)).toEqual(options.map(() => "unsupported-options"));
      expect(getterReads).toBe(0);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("revalidates options in the connector without invoking getters", async () => {
    const host = createConnectorHost(createMetaPageViewPrototype, {
      endpoint: "http://127.0.0.1:43210/tr/", experimentalEvents: true,
      experimentalPageViewData: true, experimentalEventIds: true, experimentalRouting: true,
    });
    await host.init({});
    const command = (args) => ({ type: "meta-pixel-command", payload: { args, context: page() } });
    await host.routeBatch([command(["init", ids[0]])]);
    let reads = 0;
    for (const options of [{ get eventID() { reads += 1; return "one"; } }, { eventID: "one", extra: true }, null]) {
      const result = await host.routeBatch([command(["track", "Purchase", {}, options])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped[0].reason).toBe("unsupported-options");
    }
    expect(reads).toBe(0);
  });

  it("supports PageView-only single-Pixel use without enabling other event or routing options", async () => {
    const env = await setup({
      experimentalEvents: false, experimentalRouting: false, experimentalMultiPixelRouting: false,
    });
    try {
      const options = Object.assign(Object.create(null), { eventID: "x".repeat(64) });
      env.adapter.fbq("init", "000000000000000");
      env.adapter.fbq("track", "PageView", {}, options);
      env.adapter.fbq("track", "Purchase", {}, options);
      const state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "initialized", "transport-settled", "unsupported-argument",
      ]);
      expect(env.receiver.arrivals.map(requestFrom)).toEqual([
        { id: "000000000000000", event: "PageView", eventId: "x".repeat(64), value: null, currency: null, occurrences: 1 },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("combines event IDs with separately opted-in content IDs without admitting unsupported data", async () => {
    const env = await setup({ experimentalScalarEventData: true, experimentalContentIds: true });
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", ids[0]);
      adapter.fbq("track", "Purchase", { content_ids: ["SKU", 1], region: "us" }, { eventID: "one" });
      adapter.fbq("track", "Purchase", { content_ids: ["SKU"], unknown: true }, { eventID: "two" });
      adapter.fbq("track", "Purchase", { eventID: "not-an-event-parameter" }, { eventID: "three" });
      adapter.fbq("track", "Purchase", undefined, { eventID: "four" });
      const state = await adapter.flush();
      expect(state.outcomes.slice(1).map((item) => item.reason || item.disposition)).toEqual([
        "transport-settled", "unsupported-parameters", "unsupported-parameters", "unsupported-parameters",
      ]);
      expect(receiver.arrivals).toHaveLength(1);
      const query = new URL(receiver.arrivals[0].url).searchParams;
      expect(query.get("eid")).toBe("one");
      expect(query.get("cd[content_ids]")).toBe('["SKU",1]');
      expect(query.get("cd[region]")).toBe("us");
    } finally { await env.close(); }
  }, 5000);

  it("holds broadcast and targeted IDs on denied consent and does not replay them", async () => {
    const env = await setup({ consent: { ad_storage: "denied" } });
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      adapter.fbq("track", "Purchase", {}, { eventID: "denied-one" });
      adapter.fbq("trackSingle", ids[1], "Purchase", {}, { eventID: "denied-two" });
      const state = await adapter.flush();
      expect(state.outcomes.slice(-2).map((item) => item.disposition)).toEqual(["held", "held"]);
      expect(state.host).toMatchObject({ dispatchAttempts: 0, consentHeld: 3 });
      expect(receiver.arrivals).toEqual([]);
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.fbq("trackSingle", ids[0], "Purchase", {}, { eventID: "new" });
      await adapter.flush();
      expect(receiver.arrivals.map(requestFrom)).toEqual([
        { id: ids[0], event: "Purchase", eventId: "new", value: null, currency: null, occurrences: 1 },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("preserves the encoded URL ceiling and does not send an oversized broadcast", async () => {
    const context = page();
    const env = await setup({ captureContext: () => context });
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      context.pageURL = `https://example.test/${"é".repeat(1400)}`;
      adapter.fbq("track", "Purchase", {}, { eventID: "x".repeat(64) });
      context.pageURL = "https://example.test/next";
      adapter.fbq("trackSingle", ids[1], "Purchase", {}, { eventID: "x".repeat(64) });
      expect((await adapter.flush()).outcomes.slice(-2).map((item) => item.reason || item.disposition)).toEqual([
        "encoded-context-limit", "transport-settled",
      ]);
      expect(receiver.arrivals.map(requestFrom)).toEqual([
        { id: ids[1], event: "Purchase", eventId: "x".repeat(64), value: null, currency: null, occurrences: 1 },
      ]);
    } finally { await env.close(); }
  }, 5000);
});
