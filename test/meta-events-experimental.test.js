import { describe, expect, it } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const ids = ["000000000000001", "000000000000002"];
const standardEvents = [
  "AddPaymentInfo", "AddToCart", "AddToWishlist", "CompleteRegistration", "Contact", "CustomizeProduct",
  "Donate", "FindLocation", "InitiateCheckout", "Lead", "Purchase", "Schedule", "Search", "StartTrial",
  "SubmitApplication", "Subscribe", "ViewContent",
];
const page = () => ({
  pageURL: "https://example.test/one", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: -420,
});

async function setup(options = {}) {
  const receiver = await createPrototypeReceiver();
  const chamber = createNodePrototypeChamber();
  const adapter = createMetaPixelPrototype({
    endpoint: receiver.endpoint, chamber, captureContext: page, consent: { ad_storage: "granted" },
    experimentalEvents: true, experimentalPageViewData: true,
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

function events(receiver) {
  return receiver.arrivals.map(({ url }) => {
    const query = new URL(url).searchParams;
    return [query.get("id"), query.get("ev"), query.get("cd[value]"), query.get("cd[currency]")];
  });
}

describe("experimental standard and custom events through a real worker", () => {
  it("rejects mistyped event options", () => {
    const endpoint = "http://127.0.0.1:43210/tr/";
    for (const create of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      expect(() => create({ endpoint, experimentalEvents: "true" })).toThrow("invalid-experimental-option");
    }
  });

  it("broadcasts all documented standard names and targets the selected Pixel", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      for (const name of standardEvents) adapter.fbq("track", name);
      const data = { value: 12.5, currency: "CAD" };
      adapter.fbq("trackSingle", ids[1], "Purchase", data);
      data.value = 99;
      const state = await adapter.flush();
      expect(state.outcomes).toHaveLength(20);
      expect(state.outcomes.slice(2).every(({ disposition }) => disposition === "transport-settled")).toBe(true);
      expect(events(receiver)).toEqual([
        ...standardEvents.flatMap((name) => ids.map((id) => [id, name, null, null])),
        [ids[1], "Purchase", "12.5", "CAD"],
      ]);
    } finally { await env.close(); }
  }, 10000);

  it("routes custom names with snapshotted fields, including Unicode and a 50-unit name", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      const data = { value: 0, currency: "€ & CAD" };
      adapter.fbq("trackCustom", "お気に入り", data);
      data.currency = "changed";
      adapter.fbq("trackSingleCustom", ids[1], "x".repeat(50), { value: 4 });
      const state = await adapter.flush();
      expect(state.outcomes.slice(2).map((outcome) => outcome.disposition)).toEqual(["transport-settled", "transport-settled"]);
      expect(events(receiver)).toEqual([
        [ids[0], "お気に入り", "0", "€ & CAD"], [ids[1], "お気に入り", "0", "€ & CAD"],
        [ids[1], "x".repeat(50), "4", null],
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects unknown standard names, malformed custom names and unsupported data without a send", async () => {
    const env = await setup();
    try {
      const { adapter, receiver } = env;
      adapter.fbq("track", "Purchase");
      adapter.fbq("init", ids[0]);
      adapter.fbq("track", "UnknownEvent");
      adapter.fbq("trackCustom", "");
      adapter.fbq("trackCustom", "x".repeat(51));
      adapter.fbq("trackCustom", "\ud800");
      adapter.fbq("trackCustom", "valid", { content_ids: ["a"] });
      adapter.fbq("trackSingleCustom", ids[1], "valid");
      expect((await adapter.flush()).outcomes.map((outcome) => outcome.reason || outcome.disposition)).toEqual([
        "event-before-init", "initialized", "unsupported-standard-event", "invalid-custom-event", "invalid-custom-event",
        "invalid-custom-event", "unsupported-parameters", "uninitialized-pixel",
      ]);
      expect(receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("keeps events other than PageView disabled by default", async () => {
    const env = await setup({ experimentalEvents: false });
    try {
      env.adapter.fbq("init", ids[0]);
      env.adapter.fbq("track", "Purchase");
      env.adapter.fbq("trackCustom", "Example");
      env.adapter.fbq("trackSingleCustom", ids[0], "Example");
      expect((await env.adapter.flush()).outcomes.slice(1).map((item) => item.reason)).toEqual([
        "unsupported-command", "unsupported-command", "unsupported-command",
      ]);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("supports ordinary events with one Pixel without implicitly enabling event data or single targeting", async () => {
    const env = await setup({
      experimentalPageViewData: false, experimentalMultiPixelRouting: false,
    });
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", ids[0]);
      adapter.fbq("track", "Purchase");
      adapter.fbq("trackCustom", "custom");
      adapter.fbq("track", "Purchase", { value: 1 });
      adapter.fbq("trackSingle", ids[0], "Purchase");
      expect((await adapter.flush()).outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "initialized", "transport-settled", "transport-settled", "unsupported-argument", "unsupported-command",
      ]);
      expect(events(receiver)).toEqual([
        [ids[0], "Purchase", null, null], [ids[0], "custom", null, null],
      ]);
    } finally { await env.close(); }
  }, 5000);

  it("holds event broadcasts at the seal without replay on grant", async () => {
    const env = await setup({ consent: { ad_storage: "denied" } });
    try {
      const { adapter, receiver } = env;
      adapter.fbq("init", ids[0]);
      adapter.fbq("init", ids[1]);
      adapter.fbq("track", "Purchase", { value: 1, currency: "USD" });
      const state = await adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({ disposition: "held", requests: 2, selected: 2 });
      expect(state.host).toMatchObject({ dispatchAttempts: 0, consentHeld: 2 });
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.fbq("trackSingleCustom", ids[0], "after-grant");
      await adapter.flush();
      expect(events(receiver)).toEqual([[ids[0], "after-grant", null, null]]);
    } finally { await env.close(); }
  }, 5000);
});
