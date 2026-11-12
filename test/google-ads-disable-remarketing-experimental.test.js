import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
import {
  closeConversionResources, createConversionReceiver, createNodeConversionChamber,
} from "../rig/google-ads-conversion-prototype.mjs";

const destination = "AW-0000000000";
const selector = `${destination}/SYNTHETIC_LABEL`;
const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";
const retail = { id: 1234, google_business_vertical: "retail" };
const context = { pageURL: "https://example.test/", referrer: "" };

async function local(options, run) {
  let receiver, chamber, adapter, cause;
  try {
    receiver = await createConversionReceiver();
    chamber = createNodeConversionChamber();
    adapter = createGoogleAdsPrototype({
      endpoint: receiver.endpoint, chamber,
      captureContext: () => context,
      consent: { ad_storage: "granted" }, ...options,
    });
    await run({ adapter, receiver, chamber });
  } catch (error) { cause = error; throw error; }
  finally { await closeConversionResources({ adapter, chamber, receiver, cause }); }
}

describe("experimental disabling of local remarketing", () => {
  it("suppresses enabled remarketing events but not labeled purchases or conversions", async () => {
    await local({
      experimentalDisableRemarketing: true, experimentalRetailViewItem: true,
      experimentalViewItemList: true, experimentalViewSearchResults: true,
      experimentalAddToCart: true, experimentalRemarketingPurchase: true, experimentalPurchase: true,
    }, async ({ adapter, receiver }) => {
      adapter.gtag("set", "allow_ad_personalization_signals", false);
      adapter.gtag("config", destination);
      for (const name of ["view_item", "view_item_list", "view_search_results", "add_to_cart", "purchase"]) {
        adapter.gtag("event", name, { items: [retail] });
      }
      adapter.gtag("event", "purchase", { send_to: selector, new_customer: false });
      adapter.gtag("event", "conversion", { send_to: selector, value: 1 });
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual([
        "remarketing-disabled", "configured",
        "remarketing-suppressed", "remarketing-suppressed", "remarketing-suppressed",
        "remarketing-suppressed", "remarketing-suppressed", "transport-settled", "transport-settled",
      ]);
      expect(receiver.arrivals.map(({ url }) => new URL(url).searchParams.get("airlock_event")))
        .toEqual(["purchase", null]);
    });
  }, 8000);

  it("is independently opt-in and accepts only the documented false form as the first admitted command", async () => {
    for (const create of [createGoogleAdsPrototype, createGoogleAdsConversionPrototype]) {
      for (const invalid of [null, 1, "true"]) {
        expect(() => create({ endpoint, experimentalDisableRemarketing: invalid })).toThrow("invalid-experimental-option");
      }
      for (const option of [{ experimentalParameterScopes: true },
        { experimentalRouting: true, experimentalMultiDestination: true }]) {
        expect(() => create({ endpoint, experimentalDisableRemarketing: true, ...option })).toThrow("invalid-experimental-option");
      }
    }
    await local({ experimentalRetailViewItem: true }, async ({ adapter, receiver }) => {
      adapter.gtag("set", "allow_ad_personalization_signals", false);
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", { items: [retail] });
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition))
        .toEqual(["rejected", "configured", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
    });
    await local({ experimentalDisableRemarketing: true, experimentalRetailViewItem: true }, async ({ adapter, receiver }) => {
      for (const value of [true, undefined, null, 0, "false"]) {
        adapter.gtag("set", "allow_ad_personalization_signals", value);
      }
      adapter.gtag("set", { allow_ad_personalization_signals: false });
      adapter.gtag("config", destination);
      adapter.gtag("set", "allow_ad_personalization_signals", false);
      adapter.gtag("event", "view_item", { items: [retail] });
      const state = await adapter.flush();
      expect(state.outcomes.slice(0, 6).every(({ disposition }) => disposition === "rejected")).toBe(true);
      expect(state.outcomes.slice(-3).map(({ disposition }) => disposition)).toEqual(["configured", "rejected", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
    });
    await local({ experimentalDisableRemarketing: true, experimentalRetailViewItem: true }, async ({ adapter, receiver }) => {
      adapter.gtag("set", "allow_ad_personalization_signals", true);
      adapter.gtag("set", "allow_ad_personalization_signals", false);
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", { items: [retail] });
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition))
        .toEqual(["rejected", "remarketing-disabled", "configured", "remarketing-suppressed"]);
      expect(receiver.arrivals).toEqual([]);
    });
  }, 8000);

  it("does not suppress when the option is enabled but the command is absent", async () => {
    await local({ experimentalDisableRemarketing: true, experimentalRetailViewItem: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", { items: [retail] });
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition)).toEqual(["configured", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("does not enable the separate remarketing event gates", async () => {
    await local({ experimentalDisableRemarketing: true, experimentalRetailViewItem: true }, async ({ adapter, receiver }) => {
      adapter.gtag("set", "allow_ad_personalization_signals", false);
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", { items: [retail] });
      for (const name of ["view_item_list", "view_search_results", "add_to_cart", "purchase"]) {
        adapter.gtag("event", name, { items: [retail] });
      }
      const state = await adapter.flush();
      expect(state.outcomes.slice(0, 3).map(({ disposition }) => disposition))
        .toEqual(["remarketing-disabled", "configured", "remarketing-suppressed"]);
      expect(state.outcomes.slice(3).every(({ disposition }) => disposition === "rejected")).toBe(true);
      expect(receiver.arrivals).toEqual([]);
    });
  }, 8000);

  it("preserves the full enabled labeled purchase subset without carrying remarketing items", async () => {
    await local({
      experimentalDisableRemarketing: true, experimentalRetailViewItem: true, experimentalRemarketingPurchase: true,
      experimentalPurchase: true, experimentalPurchaseCart: true, experimentalPurchaseDiscount: true,
      experimentalPurchaseFeed: true,
    }, async ({ adapter, receiver }) => {
      const cart = [{ id: "sku", price: 2, quantity: 3 }];
      adapter.gtag("set", "allow_ad_personalization_signals", false);
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", { items: [retail] });
      adapter.gtag("event", "purchase", {
        send_to: selector, value: 6, currency: "USD", transaction_id: "synthetic",
        new_customer: true, items: cart, discount: 1,
        aw_merchant_id: 98765, aw_feed_country: "US", aw_feed_language: "EN",
      });
      expect((await adapter.flush()).outcomes.slice(-2).map(({ disposition }) => disposition))
        .toEqual(["remarketing-suppressed", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      const query = new URL(receiver.arrivals[0].url).searchParams;
      expect(query.get("airlock_event")).toBe("purchase");
      expect(JSON.parse(query.get("airlock_items"))).toEqual(cart);
      expect(query.get("airlock_discount")).toBe("1");
      expect(query.get("airlock_merchant_id")).toBe("98765");
    });
  }, 8000);

  it("keeps the control confined to its own worker and preserves allowed conversion variables", async () => {
    let receiver, firstChamber, secondChamber, first, second, cause;
    try {
      receiver = await createConversionReceiver();
      firstChamber = createNodeConversionChamber();
      secondChamber = createNodeConversionChamber();
      const options = {
        endpoint: receiver.endpoint, captureContext: () => context, consent: { ad_storage: "granted" },
        experimentalDisableRemarketing: true, experimentalRetailViewItem: true, experimentalCustomVariables: true,
      };
      first = createGoogleAdsPrototype({ ...options, chamber: firstChamber });
      second = createGoogleAdsPrototype({ ...options, chamber: secondChamber });
      first.gtag("set", "allow_ad_personalization_signals", false);
      first.gtag("config", destination);
      second.gtag("config", destination);
      first.gtag("event", "view_item", { items: [retail] });
      second.gtag("event", "view_item", { items: [retail] });
      first.gtag("event", "conversion", { send_to: selector, color: "blue", example_variable: "synthetic" });
      await Promise.all([first.flush(), second.flush()]);
      expect(first.getState().outcomes.map(({ disposition }) => disposition))
        .toEqual(["remarketing-disabled", "configured", "remarketing-suppressed", "transport-settled"]);
      expect(second.getState().outcomes.map(({ disposition }) => disposition)).toEqual(["configured", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(2);
      const queries = receiver.arrivals.map(({ url }) => new URL(url).searchParams);
      expect(queries.filter((query) => query.get("airlock_event") === "view_item")).toHaveLength(1);
      expect(queries.find((query) => query.get("label") === "SYNTHETIC_LABEL").get("airlock_custom_color")).toBe("blue");
    } catch (error) { cause = error; throw error; }
    finally {
      try { await closeConversionResources({ adapter: first, chamber: firstChamber }); }
      finally { await closeConversionResources({ adapter: second, chamber: secondChamber, receiver, cause }); }
    }
  }, 8000);

  it.each([
    ["experimentalRetailViewItem", retail],
    ["experimentalEducationViewItem", { id: "COURSE", google_business_vertical: "education" }],
    ["experimentalLocalViewItem", { id: "DEAL", google_business_vertical: "local" }],
    ["experimentalRealEstateViewItem", { id: "HOME", google_business_vertical: "real_estate" }],
    ["experimentalTravelViewItem", { destination: "JFK", google_business_vertical: "travel" }],
    ["experimentalFlightsViewItem", {
      origin: "SFO", destination: "JFK", start_date: "2028-02-29", end_date: "2028-03-02",
      google_business_vertical: "flights",
    }],
  ])("suppresses %s while independently validating and snapshotting inputs", async (option, item) => {
    await local({ experimentalDisableRemarketing: true, [option]: true }, async ({ adapter, receiver, chamber }) => {
      const sent = [];
      const postMessage = chamber.postMessage;
      chamber.postMessage = (message) => { sent.push(structuredClone(message)); postMessage(message); };
      const mutable = { ...item };
      const params = { items: [mutable], value: 0 };
      adapter.gtag("set", "allow_ad_personalization_signals", false);
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", params);
      mutable.google_business_vertical = "mutated";
      params.items.push({ ...item });
      adapter.gtag("event", "view_item", { items: [] });
      adapter.gtag("event", "view_item", { items: [item], value: -1 });
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition))
        .toEqual(["remarketing-disabled", "configured", "remarketing-suppressed", "rejected", "rejected"]);
      const event = sent.find((message) => message.type === "event" && message.event.payload.args[1] === "view_item");
      expect(event.event.payload.args[2]).toEqual({ items: [item], value: 0 });
      expect(receiver.arrivals).toEqual([]);
      expect(state.host.dispatchAttempts).toBe(0);
    });
  }, 8000);

  it("does not bypass host and tag consent or replay suppressed and held events", async () => {
    await local({
      experimentalDisableRemarketing: true, experimentalRetailViewItem: true,
      experimentalConsentCommands: true, consent: { ad_storage: "denied" },
    }, async ({ adapter, receiver }) => {
      adapter.gtag("set", "allow_ad_personalization_signals", false);
      adapter.gtag("config", destination);
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("event", "view_item", { items: [retail] });
      adapter.gtag("event", "conversion", { send_to: selector, value: 1 });
      expect((await adapter.flush()).outcomes.slice(-2).map(({ disposition }) => disposition))
        .toEqual(["remarketing-suppressed", "held"]);
      adapter.setConsent({ ad_storage: "granted" });
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      adapter.gtag("event", "view_item", { items: [retail] });
      adapter.gtag("event", "conversion", { send_to: selector, value: 2 });
      expect((await adapter.flush()).outcomes.slice(-2).map(({ disposition }) => disposition))
        .toEqual(["remarketing-suppressed", "held"]);
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "view_item", { items: [retail] });
      adapter.gtag("event", "conversion", { send_to: selector, value: 3 });
      expect((await adapter.flush()).outcomes.slice(-2).map(({ disposition }) => disposition))
        .toEqual(["remarketing-suppressed", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      expect(new URL(receiver.arrivals[0].url).searchParams.get("value")).toBe("3");
    });
  }, 8000);

  it("works through the explicit dataLayer drain without replay", async () => {
    await local({
      experimentalDisableRemarketing: true, experimentalRetailViewItem: true,
      experimentalDataLayer: true, experimentalBootstrap: true,
    },
      async ({ adapter, receiver }) => {
        const layer = [];
        function enqueue() { layer.push(arguments); }
        enqueue("set", "allow_ad_personalization_signals", false);
        enqueue("js", new Date("2026-10-29T00:00:00Z"));
        enqueue("config", destination);
        enqueue("event", "view_item", { items: [retail] });
        adapter.drainDataLayer(layer);
        adapter.drainDataLayer(layer);
        expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition))
          .toEqual(["remarketing-disabled", "bootstrap-accepted", "configured", "remarketing-suppressed"]);
        expect(receiver.arrivals).toEqual([]);
      });
  }, 8000);

  it("revalidates the one-way first-command rule in the connector", async () => {
    const make = async () => {
      const host = createConnectorHost(createGoogleAdsConversionPrototype, {
        endpoint, experimentalDisableRemarketing: true, experimentalRetailViewItem: true,
      });
      await host.init({});
      return (args) => host.routeBatch([{ type: "google-ads-command", payload: { args, context } }]);
    };
    const route = await make();
    expect(await route(["set", "allow_ad_personalization_signals", false])).toEqual({ ready: [], dropped: [] });
    expect(await route(["config", destination])).toEqual({ ready: [], dropped: [] });
    expect(await route(["event", "view_item", { items: [retail] }])).toEqual({ ready: [], dropped: [] });
    expect((await route(["event", "view_item", { items: [] }])).dropped).toHaveLength(1);
    expect((await route(["set", "allow_ad_personalization_signals", true])).dropped).toHaveLength(1);
    expect((await route(["event", "conversion", { send_to: selector }])).ready).toHaveLength(1);
    const late = await make();
    await late(["config", destination]);
    expect((await late(["set", "allow_ad_personalization_signals", false])).dropped).toHaveLength(1);
    expect((await late(["event", "view_item", { items: [retail] }])).ready).toHaveLength(1);
  });

  it.each(["remarketing-request", "conversion-injection", "purchase-injection"])(
    "stops a fake worker's %s before it reaches transport", async (attack) => {
      let listener;
      const chamber = {
        sent: [],
        postMessage(message) {
          this.sent.push(message);
          if (message.type === "init") queueMicrotask(() => listener?.({ type: "phase", name: "configured" }));
        },
        onMessage(callback) { listener = callback; return () => { listener = undefined; }; },
        onError() { return () => {}; },
        emit(message) { listener?.(message); },
        dispose() {},
      };
      const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
      const adapter = createGoogleAdsPrototype({
        endpoint, chamber, fetchImpl, captureContext: () => context, consent: { ad_storage: "granted" },
        experimentalDisableRemarketing: true, experimentalRetailViewItem: true, experimentalPurchase: true,
      });
      try {
        adapter.gtag("set", "allow_ad_personalization_signals", false);
        await vi.waitFor(() => expect(chamber.sent.some((message) => message.type === "event")).toBe(true));
        chamber.emit({ type: "result", summary: { seq: 1, disposition: "remarketing-disabled", requests: 0 }, ready: [] });
        await adapter.flush();
        const name = attack === "remarketing-request" ? "view_item" : attack === "purchase-injection" ? "purchase" : "conversion";
        adapter.gtag("event", name, name === "view_item" ? { items: [retail] } : { send_to: selector });
        await vi.waitFor(() => expect(chamber.sent.filter((message) => message.type === "event")).toHaveLength(2));
        const query = new URLSearchParams({
          label: "SYNTHETIC_LABEL", url: context.pageURL,
          ...(name === "purchase" ? { airlock_event: "purchase" } : {}),
          airlock_items: JSON.stringify([retail]),
        });
        chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: `${endpoint}?${query}` });
        expect(await adapter.flush()).toMatchObject({ phase: "terminal", terminalReason: "request-correlation-failed" });
        expect(fetchImpl).not.toHaveBeenCalled();
      } finally { await adapter.dispose(); }
    },
  );

  it.each(["rejected", "wrong-command", "extra-ready", "extra-summary"])(
    "rejects a fake worker's %s control acknowledgement", async (attack) => {
      let listener;
      const chamber = {
        sent: [],
        postMessage(message) {
          this.sent.push(message);
          if (message.type === "init") queueMicrotask(() => listener?.({ type: "phase", name: "configured" }));
        },
        onMessage(callback) { listener = callback; return () => { listener = undefined; }; },
        onError() { return () => {}; },
        emit(message) { listener?.(message); },
        dispose() {},
      };
      const adapter = createGoogleAdsPrototype({
        endpoint, chamber, captureContext: () => context, experimentalDisableRemarketing: true,
      });
      try {
        if (attack === "wrong-command") adapter.gtag("config", destination);
        else adapter.gtag("set", "allow_ad_personalization_signals", false);
        await vi.waitFor(() => expect(chamber.sent.some((message) => message.type === "event")).toBe(true));
        chamber.emit({
          type: "result",
          summary: { seq: 1, disposition: attack === "rejected" ? "rejected" : "remarketing-disabled", requests: 0,
            ...(attack === "extra-summary" ? { injected: true } : {}) },
          ready: attack === "extra-ready" ? [{}] : [],
        });
        expect(await adapter.flush()).toMatchObject({ phase: "terminal", terminalReason: "result-transport-mismatch" });
      } finally { await adapter.dispose(); }
    },
  );
});
