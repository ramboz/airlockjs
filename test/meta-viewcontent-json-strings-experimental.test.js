import { describe, expect, it } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const pixelId = "000000000000001";
const page = () => ({
  pageURL: "https://example.test/", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: -420,
});
const idsText = ' [ "sku\\/one", "\\u96ea" ] ';
const contentsText = ' [ {"id":"sku\\/one","quantity":1}, {"id":"\\u96ea","quantity":1} ] ';

async function setup(options = {}) {
  const receiver = await createPrototypeReceiver();
  const chamber = createNodePrototypeChamber();
  const adapter = createMetaPixelPrototype({
    endpoint: receiver.endpoint, chamber, captureContext: page, consent: { ad_storage: "granted" },
    experimentalRouting: true, experimentalMultiPixelRouting: true, experimentalEvents: true,
    experimentalPageViewData: true, experimentalContentIds: true, experimentalContents: true,
    experimentalEventIds: true, experimentalSetAgent: true, experimentalCustomProperties: true,
    experimentalTagConsent: true, experimentalViewContentJsonStrings: true, ...options,
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
    pixel: query.get("id"), event: query.get("ev"), eventId: query.get("eid"), agent: query.get("a"),
    ids: query.getAll("cd[content_ids]"), contents: query.getAll("cd[contents]"),
    source: query.get("cd[source]"), version: query.get("cd[pluginVersion]"),
  };
}

describe("experimental ViewContent JSON-string inputs through the local worker", () => {
  it("requires a boolean opt-in and the existing event, data, ID and contents opt-ins", () => {
    const endpoint = "http://127.0.0.1:43210/tr/";
    const prerequisites = {
      experimentalEvents: true, experimentalPageViewData: true,
      experimentalContentIds: true, experimentalContents: true,
    };
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint, experimentalViewContentJsonStrings: "true" })).toThrow("invalid-experimental-option");
      for (const missing of Object.keys(prerequisites)) {
        expect(() => create({ endpoint, ...prerequisites, [missing]: false, experimentalViewContentJsonStrings: true }))
          .toThrow();
      }
    }
  });

  it("keeps strings rejected by default while retaining array behavior", async () => {
    const env = await setup({ experimentalViewContentJsonStrings: false });
    try {
      env.adapter.fbq("init", pixelId);
      env.adapter.fbq("track", "ViewContent", { content_ids: idsText, contents: contentsText });
      env.adapter.fbq("track", "ViewContent", { content_ids: ["sku"], contents: [{ id: "sku", quantity: 1 }] });
      expect((await env.adapter.flush()).outcomes.map((item) => item.reason || item.disposition))
        .toEqual(["initialized", "unsupported-parameters", "transport-settled"]);
      expect(env.receiver.arrivals.map(fields)[0]).toMatchObject({
        ids: ['["sku"]'], contents: ['[{"id":"sku","quantity":1}]'],
      });
    } finally { await env.close(); }
  }, 5000);

  it("preserves exact strings, snapshots inputs and keeps mixed array forms distinct", async () => {
    const env = await setup();
    try {
      const data = { content_ids: idsText, contents: contentsText, source: "magento_opensource", pluginVersion: "1.2.3" };
      const options = { eventID: "synthetic-event" };
      env.adapter.fbq("init", pixelId);
      env.adapter.fbq("set", "agent", "magento_opensource-0.0.0-1.2.3", pixelId);
      env.adapter.fbq("track", "ViewContent", data, options);
      data.content_ids = '["changed"]';
      data.contents = '[{"id":"changed","quantity":1}]';
      data.source = "changed";
      options.eventID = "changed";
      env.adapter.fbq("track", "ViewContent", { content_ids: ["sku/one"], contents: contentsText });
      env.adapter.fbq("track", "ViewContent", { content_ids: idsText, contents: [{ id: "sku/one", quantity: 1 }] });
      expect((await env.adapter.flush()).outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "agent-updated", "transport-settled", "transport-settled", "transport-settled"]);
      expect(env.receiver.arrivals.map(fields)).toEqual([
        {
          pixel: pixelId, event: "ViewContent", eventId: "synthetic-event", agent: "magento_opensource-0.0.0-1.2.3",
          ids: [idsText], contents: [contentsText], source: "magento_opensource", version: "1.2.3",
        },
        {
          pixel: pixelId, event: "ViewContent", eventId: null, agent: "magento_opensource-0.0.0-1.2.3",
          ids: ['["sku/one"]'], contents: [contentsText], source: null, version: null,
        },
        {
          pixel: pixelId, event: "ViewContent", eventId: null, agent: "magento_opensource-0.0.0-1.2.3",
          ids: [idsText], contents: ['[{"id":"sku/one","quantity":1}]'], source: null, version: null,
        },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects malformed, oversized, duplicate-key and non-ViewContent inputs", async () => {
    const env = await setup();
    try {
      env.adapter.fbq("init", pixelId);
      const commands = [
        ["track", "ViewContent", { content_ids: "[" }],
        ["track", "ViewContent", { content_ids: '[""]' }],
        ["track", "ViewContent", { content_ids: '[null]' }],
        ["track", "ViewContent", { content_ids: JSON.stringify(Array(17).fill("a")) }],
        ["track", "ViewContent", { content_ids: " ".repeat(2047) + "[]" }],
        ["track", "ViewContent", { content_ids: '["\\ud800"]' }],
        ["track", "ViewContent", { contents: "not-json" }],
        ["track", "ViewContent", { contents: '[{"id":"one","quantity":2}]' }],
        ["track", "ViewContent", { contents: '[{"id":"one","quantity":1,"item_price":1}]' }],
        ["track", "ViewContent", { contents: '[{"id":"hidden","id":"one","quantity":1}]' }],
        ["track", "ViewContent", { contents: '[{"id":"one","quantity":2,"quantity":1}]' }],
        ["track", "ViewContent", { contents: JSON.stringify(Array.from({ length: 17 }, () => ({ id: "x", quantity: 1 }))) }],
        ["track", "ViewContent", { contents: " ".repeat(2047) + "[]" }],
        ["track", "Purchase", { content_ids: idsText }],
        ["trackCustom", "ViewContent", { contents: contentsText }],
        ["trackSingle", pixelId, "ViewContent", { contents: contentsText }],
      ];
      for (const args of commands) env.adapter.fbq(...args);
      expect((await env.adapter.flush()).outcomes.slice(1).map((item) => item.reason))
        .toEqual(commands.map(() => "unsupported-parameters"));
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("accepts the documented local string and element limits without normalizing the input", async () => {
    const env = await setup();
    try {
      const maximum = "[]".padEnd(2048, " ");
      const ids = JSON.stringify(Array.from({ length: 16 }, (_, index) => `sku-${index}`));
      const contents = JSON.stringify(Array.from({ length: 16 }, (_, index) => ({ id: `sku-${index}`, quantity: 1 })));
      env.adapter.fbq("init", pixelId);
      env.adapter.fbq("track", "ViewContent", { content_ids: maximum, contents: maximum });
      env.adapter.fbq("track", "ViewContent", { content_ids: ids, contents });
      expect((await env.adapter.flush()).outcomes.slice(1).map((item) => item.disposition))
        .toEqual(["transport-settled", "transport-settled"]);
      expect(env.receiver.arrivals.map(fields)).toMatchObject([
        { ids: [maximum], contents: [maximum] }, { ids: [ids], contents: [contents] },
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("holds the strings under tag and host denial and does not replay on grant", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", pixelId);
      adapter.fbq("consent", "revoke");
      adapter.fbq("track", "ViewContent", { content_ids: idsText, contents: contentsText });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      adapter.fbq("consent", "grant");
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.setConsent({ ad_storage: "denied" });
      adapter.fbq("track", "ViewContent", { content_ids: idsText, contents: contentsText });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.fbq("track", "ViewContent", { content_ids: idsText, contents: contentsText });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals.map(fields)).toMatchObject([{ ids: [idsText], contents: [contentsText] }]);
      expect(receiver.arrivals).toHaveLength(1);
    } finally { await env.close(); }
  }, 5000);
});
