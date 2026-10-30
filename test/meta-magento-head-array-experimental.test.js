import { describe, expect, it } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const pixelId = "000000000000001";
const agent = "magento_opensource-0.0.0-1.2.3";
const eventId = "00000000-0000-4000-8000-000000000001";
const page = () => ({
  pageURL: "https://example.test/", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: -420,
});

function headData() {
  const data = [];
  data.source = "magento_opensource";
  data.pluginVersion = "1.2.3";
  return data;
}

async function setup(options = {}) {
  const receiver = await createPrototypeReceiver();
  const chamber = createNodePrototypeChamber();
  const sent = [];
  const postMessage = chamber.postMessage.bind(chamber);
  chamber.postMessage = (message) => {
    if (message.type === "event") sent.push(structuredClone(message.event));
    return postMessage(message);
  };
  const adapter = createMetaPixelPrototype({
    endpoint: receiver.endpoint, chamber, captureContext: page, consent: { ad_storage: "granted" },
    experimentalRouting: true, experimentalMultiPixelRouting: true, experimentalPageViewData: true,
    experimentalCustomProperties: true, experimentalEventIds: true, experimentalInitAgent: true,
    experimentalSetAgent: true, experimentalTagConsent: true, experimentalMagentoHeadArray: true,
    ...options,
  });
  return {
    adapter, receiver, sent,
    async close() {
      try { await adapter.dispose(); } finally {
        try { await chamber.dispose(); } finally { await receiver.close(); }
      }
    },
  };
}

function fields(arrival) {
  const query = new URL(arrival.url).searchParams;
  return Object.fromEntries(
    ["id", "ev", "a", "eid", "cd[source]", "cd[pluginVersion]"].map((key) => [key, query.getAll(key)]),
  );
}

function initialize(adapter) {
  adapter.fbq("init", pixelId, {}, { agent });
  adapter.fbq("set", "agent", agent, pixelId);
}

describe("Magento head array through the experimental local worker", () => {
  it("preserves the array and its named properties through the full local fbq sequence", async () => {
    const env = await setup();
    try {
      const empty = {};
      const initOptions = { agent };
      const data = headData();
      const options = { eventID: eventId };
      env.adapter.fbq("init", pixelId, empty, initOptions);
      env.adapter.fbq("set", "agent", agent, pixelId);
      env.adapter.fbq("track", "PageView", data, options);
      empty.late = true;
      initOptions.agent = "changed";
      data.source = "changed";
      data.pluginVersion = "changed";
      data.push("late");
      options.eventID = "changed";
      const state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "agent-updated", "transport-settled"]);
      const sentData = env.sent.find((event) => event.payload.args[0] === "track").payload.args[2];
      expect(Array.isArray(sentData)).toBe(true);
      expect(Reflect.ownKeys(sentData)).toEqual(["length", "source", "pluginVersion"]);
      expect(sentData).toHaveLength(0);
      expect(sentData.source).toBe("magento_opensource");
      expect(sentData.pluginVersion).toBe("1.2.3");
      expect(env.receiver.arrivals.map(fields)).toEqual([{
        id: [pixelId], ev: ["PageView"], a: [agent], eid: [eventId],
        "cd[source]": ["magento_opensource"], "cd[pluginVersion]": ["1.2.3"],
      }]);
      expect([...new URL(env.receiver.arrivals[0].url).searchParams].filter(([key]) => key.startsWith("cd[")))
        .toEqual([["cd[source]", "magento_opensource"], ["cd[pluginVersion]", "1.2.3"]]);
      expect(JSON.stringify(state)).not.toContain(eventId);
      expect(JSON.stringify(state)).not.toContain("magento_opensource");
    } finally { await env.close(); }
  }, 5000);

  it("requires a boolean opt-in and keeps array input refused by default", async () => {
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint: "http://127.0.0.1:43210/tr/", experimentalMagentoHeadArray: "true" }))
        .toThrow("invalid-experimental-option");
    }
    const env = await setup({ experimentalMagentoHeadArray: false });
    try {
      initialize(env.adapter);
      env.adapter.fbq("track", "PageView", headData(), { eventID: eventId });
      expect((await env.adapter.flush()).outcomes.at(-1).reason).toBe("unsupported-parameters");
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("refuses other arrays, malformed properties and other event routes without reading getters", async () => {
    const env = await setup({ experimentalEvents: true });
    try {
      let reads = 0;
      const getter = headData();
      Object.defineProperty(getter, "source", { get() { reads += 1; return "not-read"; }, enumerable: true });
      const hidden = headData();
      Object.defineProperty(hidden, "source", { value: "magento_opensource", enumerable: false });
      const missing = headData();
      delete missing.pluginVersion;
      const wrongPrototype = Object.setPrototypeOf(headData(), null);
      const invalid = [
        [], ["item"], Object.assign(["item"], headData()), missing, wrongPrototype, Object.assign(headData(), { extra: "x" }),
        Object.assign(headData(), { [Symbol("extra")]: 1 }), Object.assign(headData(), { source: 1 }),
        Object.assign(headData(), { pluginVersion: "x".repeat(65) }), Object.assign(headData(), { source: "\ud800" }),
        getter, hidden,
      ];
      initialize(env.adapter);
      for (const data of invalid) env.adapter.fbq("track", "PageView", data, { eventID: eventId });
      env.adapter.fbq("track", "ViewContent", headData(), { eventID: eventId });
      env.adapter.fbq("trackCustom", "PageView", headData(), { eventID: eventId });
      env.adapter.fbq("track", "PageView", headData());
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(2).map((item) => item.reason))
        .toEqual([...invalid.map(() => "unsupported-parameters"), "unsupported-parameters", "unsupported-parameters",
          "unsupported-parameters"]);
      expect(reads).toBe(0);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("does not bypass the custom-property opt-in and preserves object-form PageView", async () => {
    const disabled = await setup({ experimentalCustomProperties: false });
    try {
      initialize(disabled.adapter);
      disabled.adapter.fbq("track", "PageView", headData(), { eventID: eventId });
      expect((await disabled.adapter.flush()).outcomes.at(-1).reason).toBe("unsupported-parameters");
      expect(disabled.receiver.arrivals).toEqual([]);
    } finally { await disabled.close(); }
    const noEventIds = await setup({ experimentalEventIds: false });
    try {
      initialize(noEventIds.adapter);
      noEventIds.adapter.fbq("track", "PageView", headData(), { eventID: eventId });
      expect((await noEventIds.adapter.flush()).outcomes.at(-1).reason).toBe("unsupported-argument");
      expect(noEventIds.receiver.arrivals).toEqual([]);
    } finally { await noEventIds.close(); }
    const env = await setup();
    try {
      initialize(env.adapter);
      env.adapter.fbq("track", "PageView", { value: 10, currency: "USD" }, { eventID: eventId });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      const query = new URL(env.receiver.arrivals[0].url).searchParams;
      expect(query.getAll("cd[value]")).toEqual(["10"]);
      expect(query.getAll("cd[currency]")).toEqual(["USD"]);
    } finally { await env.close(); }
  }, 5000);

  it("holds the array event under each consent denial and never replays it", async () => {
    const env = await setup();
    try {
      initialize(env.adapter);
      env.adapter.fbq("consent", "revoke");
      env.adapter.fbq("track", "PageView", headData(), { eventID: eventId });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      env.adapter.fbq("consent", "grant");
      await env.adapter.flush();
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.setConsent({ ad_storage: "denied" });
      env.adapter.fbq("track", "PageView", headData(), { eventID: eventId });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      env.adapter.setConsent({ ad_storage: "granted" });
      await env.adapter.flush();
      expect(env.receiver.arrivals).toEqual([]);
      env.adapter.fbq("track", "PageView", headData(), { eventID: eventId });
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(env.receiver.arrivals.map(fields)).toEqual([{
        id: [pixelId], ev: ["PageView"], a: [agent], eid: [eventId],
        "cd[source]": ["magento_opensource"], "cd[pluginVersion]": ["1.2.3"],
      }]);
    } finally { await env.close(); }
  }, 5000);
});
