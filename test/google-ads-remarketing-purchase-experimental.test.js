import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";
import { reportGoogleAdsConversionPrototype } from "../rig/google-ads-conversion-prototype-report.mjs";

const destination = "AW-0000000000";
const sendTo = `${destination}/SYNTHETIC_LABEL`;
const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";
const context = { pageURL: "https://example.test/remarketing-purchase", referrer: "" };
const variants = [
  { option: "experimentalRetailViewItem", item: { id: 1234, google_business_vertical: "retail" } },
  { option: "experimentalEducationViewItem", item: { id: "COURSE", location_id: "SFO", google_business_vertical: "education" } },
  { option: "experimentalLocalViewItem", item: { id: "DEAL", google_business_vertical: "local" } },
  { option: "experimentalRealEstateViewItem", item: { id: "HOME", google_business_vertical: "real_estate" } },
  { option: "experimentalTravelViewItem", item: { destination: "JFK", start_date: "2026-10-29", google_business_vertical: "travel" } },
];

async function local(options, run) {
  let receiver, chamber, adapter, cause;
  try {
    receiver = await createConversionReceiver();
    chamber = createNodeConversionChamber();
    adapter = createGoogleAdsPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: () => context,
      consent: { ad_storage: "granted" }, ...options,
    });
    await run({ adapter, receiver, chamber });
  } catch (error) { cause = error; throw error; }
  finally {
    await closeConversionResources({ adapter, chamber, receiver, cause });
    if (chamber) expect(chamber.getState()).toEqual({ closing: true, closed: true });
    if (receiver) expect(receiver.getState()).toEqual({ listening: false, openSockets: 0 });
  }
}

describe("experimental Google remarketing purchase", () => {
  it.each(variants)("$option requires both opt-ins and snapshots the unlabeled input", async ({ option, item }) => {
    await local({ [option]: true, experimentalPurchase: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", { items: [item] });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "rejected" });
      expect(receiver.arrivals).toEqual([]);
    });
    await local({ [option]: true, experimentalRemarketingPurchase: true }, async ({ adapter, receiver }) => {
      const mutable = { ...item };
      const params = { items: [mutable], value: 12.5 };
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", params);
      mutable.google_business_vertical = "changed";
      params.items.push({ ...item });
      params.value = 99;
      adapter.gtag("event", "purchase", { items: [item] });
      adapter.gtag("event", "purchase", { items: [item], value: undefined });
      adapter.gtag("event", "purchase", { items: [item], value: 0 });
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition)).toEqual([
        "configured", "transport-settled", "transport-settled", "transport-settled", "transport-settled",
      ]);
      const queries = receiver.arrivals.map(({ url }) => new URL(url).searchParams);
      expect(queries.map((query) => query.get("airlock_event"))).toEqual(Array(4).fill("remarketing_purchase"));
      expect(queries.map((query) => query.get("airlock_value"))).toEqual(["12.5", null, null, "0"]);
      for (const query of queries) {
        expect(JSON.parse(query.get("airlock_items"))).toEqual([item]);
        expect(query.has("label")).toBe(false);
      }
    });
  }, 8000);

  it("keeps the labeled and unlabeled purchase gates independent in every combination", async () => {
    for (const purchase of [false, true]) {
      for (const remarketing of [false, true]) {
        await local({
          experimentalRetailViewItem: true, experimentalPurchase: purchase, experimentalRemarketingPurchase: remarketing,
        }, async ({ adapter, receiver }) => {
          adapter.gtag("config", destination);
          adapter.gtag("event", "purchase", { send_to: sendTo, value: 1 });
          adapter.gtag("event", "purchase", { items: [variants[0].item], value: 2 });
          expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition)).toEqual([
            "configured", purchase ? "transport-settled" : "rejected", remarketing ? "transport-settled" : "rejected",
          ]);
          expect(receiver.arrivals.map(({ url }) => new URL(url).searchParams.get("airlock_event")))
            .toEqual([...(purchase ? ["purchase"] : []), ...(remarketing ? ["remarketing_purchase"] : [])]);
        });
      }
    }
    await local({ experimentalRemarketingPurchase: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      for (const { item } of variants) adapter.gtag("event", "purchase", { items: [item] });
      expect((await adapter.flush()).outcomes.slice(1).every(({ disposition }) => disposition === "rejected")).toBe(true);
      expect(receiver.arrivals).toEqual([]);
    });
    for (const create of [createGoogleAdsPrototype, createGoogleAdsConversionPrototype]) {
      for (const value of [null, 1, "true"]) {
        expect(() => create({ endpoint, experimentalRemarketingPurchase: value })).toThrow("invalid-experimental-option");
      }
      expect(() => create({ endpoint, experimentalRemarketingPurchase: true, experimentalParameterScopes: true }))
        .toThrow("invalid-experimental-option");
      expect(() => create({ endpoint, experimentalRemarketingPurchase: true, experimentalRouting: true, experimentalMultiDestination: true }))
        .toThrow("invalid-experimental-option");
    }
  }, 8000);

  it("keeps both purchase paths, conversions, and all remarketing events separate", async () => {
    const options = Object.fromEntries(variants.map(({ option }) => [option, true]));
    await local({
      ...options, experimentalRemarketingPurchase: true, experimentalPurchase: true, experimentalPurchaseCart: true,
      experimentalPurchaseDiscount: true, experimentalPurchaseFeed: true,
      experimentalViewItemList: true, experimentalViewSearchResults: true, experimentalAddToCart: true,
    }, async ({ adapter, receiver }) => {
      const cart = [{ id: "sku", price: 2.5, quantity: 3 }];
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", {
        send_to: sendTo, value: 12.5, currency: "USD", transaction_id: "order", new_customer: false,
        items: cart, discount: 0, aw_merchant_id: 98765, aw_feed_country: "US", aw_feed_language: "EN",
      });
      adapter.gtag("event", "purchase", { items: [variants[0].item], value: 0 });
      adapter.gtag("event", "purchase", { send_to: sendTo, items: undefined });
      adapter.gtag("event", "purchase", { items: [variants[1].item] });
      for (const event of ["view_item", "view_item_list", "view_search_results", "add_to_cart"]) {
        adapter.gtag("event", event, { items: [variants[2].item] });
      }
      adapter.gtag("event", "conversion", { send_to: sendTo, value: 4 });
      const state = await adapter.flush();
      expect(state.outcomes.slice(1).every(({ disposition }) => disposition === "transport-settled")).toBe(true);
      const queries = receiver.arrivals.map(({ url }) => new URL(url).searchParams);
      expect(queries.map((query) => query.get("airlock_event"))).toEqual([
        "purchase", "remarketing_purchase", "purchase", "remarketing_purchase",
        "view_item", "view_item_list", "view_search_results", "add_to_cart", null,
      ]);
      expect(queries.map((query) => query.get("label"))).toEqual([
        "SYNTHETIC_LABEL", null, "SYNTHETIC_LABEL", null, null, null, null, null, "SYNTHETIC_LABEL",
      ]);
      expect(JSON.parse(queries[0].get("airlock_items"))).toEqual(cart);
      expect(Object.fromEntries(queries[0])).toMatchObject({
        value: "12.5", currency_code: "USD", oid: "order", airlock_new_customer: "false",
        airlock_discount: "0", airlock_merchant_id: "98765", airlock_feed_country: "US", airlock_feed_language: "EN",
      });
      expect(JSON.parse(queries[1].get("airlock_items"))).toEqual([variants[0].item]);
      expect(queries[1].get("airlock_value")).toBe("0");
      expect(queries[2].has("airlock_items")).toBe(false);
      expect(JSON.parse(queries[3].get("airlock_items"))).toEqual([variants[1].item]);
      expect(JSON.stringify(state)).not.toContain("COURSE");
      const report = reportGoogleAdsConversionPrototype({
        endpoint: receiver.endpoint, observedRequests: [receiver.arrivals[1]],
        commandSnapshots: [{ args: ["event", "purchase", { items: [variants[0].item], value: 0 }], context }],
      });
      expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false, local: [{ relationshipsPreserved: false }] });
    });
  }, 8000);

  it("refuses ambiguous, mixed and malformed purchase shapes without falling back", async () => {
    const options = Object.fromEntries(variants.map(({ option }) => [option, true]));
    await local({
      ...options, experimentalRemarketingPurchase: true, experimentalPurchase: true, experimentalPurchaseCart: true,
      experimentalPurchaseDiscount: true, experimentalPurchaseFeed: true, experimentalCallbacks: true,
    }, async ({ adapter, receiver }) => {
      const getter = vi.fn(() => sendTo);
      const accessor = { items: [variants[0].item] };
      Object.defineProperty(accessor, "send_to", { get: getter, enumerable: true });
      let enumerations = 0;
      const oversized = new Proxy(Array(11), { ownKeys(target) { enumerations += 1; return Reflect.ownKeys(target); } });
      const bad = [
        { items: [variants[0].item], send_to: sendTo },
        { items: [variants[0].item], send_to: undefined },
        { items: [variants[0].item], send_to: null },
        accessor,
        { items: [{ id: "sku", price: 2, quantity: 1 }] },
        { items: [variants[0].item, variants[1].item] },
        { items: oversized }, { items: [] }, { items: undefined }, {},
        { items: [variants[0].item], currency: "USD" }, { items: [variants[0].item], transaction_id: "order" },
        { items: [variants[0].item], new_customer: true }, { items: [variants[0].item], discount: 1 },
        { items: [variants[0].item], aw_merchant_id: 98765 }, { items: [variants[0].item], event_callback: () => {} },
        { items: [variants[0].item], value: -1 }, { items: [variants[0].item], value: -0 },
        { items: [variants[0].item], value: Infinity }, { items: [variants[0].item], value: "1" },
        { send_to: sendTo, items: [{ ...variants[0].item, price: 2, quantity: 1 }] },
      ];
      adapter.gtag("config", destination);
      for (const params of bad) adapter.gtag("event", "purchase", params);
      expect((await adapter.flush()).outcomes.slice(1).every(({ disposition }) => disposition === "rejected")).toBe(true);
      expect(receiver.arrivals).toEqual([]);
      expect(getter).not.toHaveBeenCalled();
      expect(enumerations).toBe(0);
    });
  }, 8000);

  it("rejects an oversized encoded request without poisoning a later valid purchase", async () => {
    await local({ experimentalEducationViewItem: true, experimentalRemarketingPurchase: true }, async ({ adapter, receiver }) => {
      const large = Array.from({ length: 10 }, () => ({
        id: "\u4e00".repeat(128), google_business_vertical: "education",
      }));
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", { items: large });
      adapter.gtag("event", "purchase", { items: [variants[1].item] });
      expect((await adapter.flush()).outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
        "configured", "encoded-context-limit", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(1);
      expect(JSON.parse(new URL(receiver.arrivals[0].url).searchParams.get("airlock_items"))).toEqual([variants[1].item]);
    });
  }, 8000);

  it("independently rechecks purchase classification and items in the connector", async () => {
    const command = (args) => ({ type: "google-ads-command", seq: 1, ts: 0, payload: { args, context }, snapshot: {} });
    for (const purchase of [false, true]) {
      for (const remarketing of [false, true]) {
        const host = createConnectorHost(createGoogleAdsConversionPrototype, {
          endpoint, experimentalRetailViewItem: true, experimentalPurchase: purchase, experimentalRemarketingPurchase: remarketing,
        });
        await host.init({});
        await host.routeBatch([command(["config", destination])]);
        for (const [params, enabled] of [
          [{ send_to: sendTo }, purchase], [{ items: [variants[0].item] }, remarketing],
        ]) {
          const result = await host.routeBatch([command(["event", "purchase", params])]);
          expect(result.ready).toHaveLength(enabled ? 1 : 0);
          expect(result.dropped).toHaveLength(enabled ? 0 : 1);
        }
        for (const params of [
          { items: [variants[0].item], send_to: sendTo }, { items: [variants[0].item], send_to: undefined },
          { items: [variants[0].item], currency: "USD" }, { items: [variants[0].item], value: Infinity },
          { items: [{ id: "sku", price: 2, quantity: 1 }] },
        ]) {
          const result = await host.routeBatch([command(["event", "purchase", params])]);
          expect(result.ready).toEqual([]);
          expect(result.dropped).toHaveLength(1);
        }
      }
    }
  });

  it.each(variants)("$option keeps both purchase paths behind host/tag consent with no replay", async ({ option, item }) => {
    await local({
      [option]: true, experimentalRemarketingPurchase: true, experimentalPurchase: true, experimentalConsentCommands: true,
      consent: { ad_storage: "denied" },
    }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("event", "purchase", { items: [item] });
      adapter.gtag("event", "purchase", { send_to: sendTo });
      expect((await adapter.flush()).outcomes.slice(-2).map(({ disposition }) => disposition)).toEqual(["held", "held"]);
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      adapter.gtag("event", "purchase", { items: [item] });
      adapter.gtag("event", "purchase", { send_to: sendTo });
      expect((await adapter.flush()).outcomes.slice(-2).map(({ disposition }) => disposition)).toEqual(["held", "held"]);
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "purchase", { items: [item] });
      adapter.gtag("event", "purchase", { send_to: sendTo });
      expect((await adapter.flush()).outcomes.slice(-2).map(({ disposition }) => disposition))
        .toEqual(["transport-settled", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(2);
    });
  }, 8000);

  it("applies admitted denial immediately to both queued purchase paths", async () => {
    let receiver, chamber, adapter, cause, release, notify;
    const arrival = new Promise((resolve) => { notify = resolve; });
    try {
      receiver = await createConversionReceiver({
        respond(_request, response) { release = () => response.writeHead(204).end(); notify(); },
      });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: "granted" },
        experimentalRetailViewItem: true, experimentalRemarketingPurchase: true,
        experimentalPurchase: true, experimentalConsentCommands: true,
      });
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("config", destination);
      await adapter.flush();
      adapter.gtag("event", "purchase", { items: [variants[0].item] });
      await arrival;
      adapter.gtag("event", "purchase", { send_to: sendTo });
      adapter.gtag("event", "purchase", { items: [{ ...variants[0].item, id: 2 }] });
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      release();
      release = undefined;
      expect((await adapter.flush()).outcomes.slice(-4).map(({ disposition }) => disposition))
        .toEqual(["transport-settled", "held", "held", "consent-updated"]);
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toHaveLength(1);
    } catch (error) { cause = error; throw error; }
    finally { release?.(); await closeConversionResources({ adapter, chamber, receiver, cause }); }
  }, 8000);

  it("uses only the explicitly configured alternate loopback route for both purchases", async () => {
    let receiver, chamber, adapter, cause;
    try {
      receiver = await createConversionReceiver({ conversionId: "123456789" });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: "granted" },
        experimentalRouting: true, experimentalRetailViewItem: true,
        experimentalRemarketingPurchase: true, experimentalPurchase: true,
      });
      adapter.gtag("config", "AW-222");
      adapter.gtag("event", "purchase", { items: [variants[0].item] });
      adapter.gtag("config", "AW-123456789");
      adapter.gtag("event", "purchase", { items: [variants[0].item] });
      adapter.gtag("event", "purchase", { send_to: "AW-123456789/LABEL" });
      expect((await adapter.flush()).outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
        "destination-mismatch", "conversion-before-config", "configured", "transport-settled", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(2);
      expect(receiver.arrivals.every(({ url }) => {
        const request = new URL(url);
        return request.origin + request.pathname === receiver.endpoint;
      })).toBe(true);
    } catch (error) { cause = error; throw error; }
    finally { await closeConversionResources({ adapter, chamber, receiver, cause }); }
  }, 8000);

  it("snapshots both purchase types from dataLayer without replay", async () => {
    await local({
      experimentalRetailViewItem: true, experimentalRemarketingPurchase: true,
      experimentalPurchase: true, experimentalDataLayer: true,
    }, async ({ adapter, receiver }) => {
      const layer = [];
      function enqueue() { layer.push(arguments); }
      const items = Array.from({ length: 10 }, (_, index) => ({ ...variants[0].item, id: index + 1 }));
      const expected = items.map((item) => ({ ...item }));
      enqueue("config", destination);
      enqueue("event", "purchase", { items });
      enqueue("event", "purchase", { send_to: sendTo });
      adapter.drainDataLayer(layer);
      items.reverse();
      items[0].id = 99;
      adapter.drainDataLayer(layer);
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition))
        .toEqual(["configured", "transport-settled", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(2);
      expect(JSON.parse(new URL(receiver.arrivals[0].url).searchParams.get("airlock_items"))).toEqual(expected);
    });
  }, 8000);

  const kinds = ["remarketing_purchase", "purchase", "conversion", "view_item", "view_item_list", "view_search_results", "add_to_cart"];
  const substitutions = kinds.flatMap((command) => kinds.filter((wire) => command !== wire).map((wire) => ({ command, wire })));

  it.each(substitutions)("refuses fake-worker substitution $command as $wire", async ({ command, wire }) => {
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
      experimentalRetailViewItem: true, experimentalRemarketingPurchase: true, experimentalPurchase: true,
      experimentalPurchaseCart: true, experimentalViewItemList: true, experimentalViewSearchResults: true,
      experimentalAddToCart: true,
    });
    try {
      const params = ["purchase", "conversion"].includes(command)
        ? { send_to: sendTo } : { items: [variants[0].item], value: 0 };
      adapter.gtag("event", command === "remarketing_purchase" ? "purchase" : command, params);
      await vi.waitFor(() => expect(chamber.sent.some((message) => message.type === "event")).toBe(true));
      const query = ["purchase", "conversion"].includes(wire)
        ? new URLSearchParams(wire === "purchase"
          ? { label: "SYNTHETIC_LABEL", airlock_event: "purchase", url: context.pageURL }
          : { label: "SYNTHETIC_LABEL", url: context.pageURL })
        : new URLSearchParams({ airlock_event: wire, airlock_items: JSON.stringify([variants[0].item]), airlock_value: "0" });
      chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: `${endpoint}?${query}` });
      expect(await adapter.flush()).toMatchObject({ phase: "terminal", terminalReason: "request-correlation-failed" });
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
  });
  it.each(["wrong-label", "foreign-items", "missing-items", "wrong-value", "injected-view-value", "wrong-context", "duplicate-event"])(
    "rejects a fake labeled purchase with %s before transport", async (scenario) => {
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
        endpoint, chamber, fetchImpl, captureContext: () => context, consent: { ad_storage: "granted" }, commandTimeoutMs: 100,
        experimentalRetailViewItem: true, experimentalRemarketingPurchase: true,
        experimentalPurchase: true, experimentalPurchaseCart: true,
      });
      try {
        const cart = [{ id: "sku", price: 2, quantity: 1 }];
        adapter.gtag("event", "purchase", { send_to: sendTo, items: cart, value: 3 });
        await vi.waitFor(() => expect(chamber.sent.some((message) => message.type === "event")).toBe(true));
        const query = new URLSearchParams({
          label: scenario === "wrong-label" ? "OTHER" : "SYNTHETIC_LABEL",
          value: scenario === "wrong-value" ? "4" : "3",
          airlock_event: "purchase",
          airlock_items: JSON.stringify(scenario === "foreign-items" ? [variants[0].item] : cart),
          url: context.pageURL,
        });
        if (scenario === "missing-items") query.delete("airlock_items");
        if (scenario === "injected-view-value") query.set("airlock_value", "3");
        if (scenario === "wrong-context") query.set("url", "https://example.test/other");
        if (scenario === "duplicate-event") query.append("airlock_event", "purchase");
        chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: `${endpoint}?${query}` });
        expect(await adapter.flush()).toMatchObject({ phase: "terminal", terminalReason: "request-correlation-failed" });
        expect(fetchImpl).not.toHaveBeenCalled();
      } finally { await adapter.dispose(); }
    },
  );

  it.each(["wrong-item", "wrong-value", "injected-value", "dropped-zero", "duplicate-event", "wrong-endpoint", "extra-label"])(
    "rejects a fake remarketing purchase with %s before transport", async (scenario) => {
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
        experimentalRetailViewItem: true, experimentalRemarketingPurchase: true,
      });
      try {
        const params = { items: [variants[0].item], ...(scenario === "injected-value" ? {} : { value: 0 }) };
        adapter.gtag("event", "purchase", params);
        await vi.waitFor(() => expect(chamber.sent.some((message) => message.type === "event")).toBe(true));
        const query = new URLSearchParams({
          airlock_event: "remarketing_purchase",
          airlock_items: JSON.stringify([scenario === "wrong-item" ? { ...variants[0].item, id: 8 } : variants[0].item]),
          airlock_value: scenario === "wrong-value" ? "1" : "0",
        });
        if (scenario === "dropped-zero") query.delete("airlock_value");
        if (scenario === "duplicate-event") query.append("airlock_event", "remarketing_purchase");
        if (scenario === "extra-label") query.set("label", "SYNTHETIC_LABEL");
        const target = scenario === "wrong-endpoint" ? endpoint.replace("43210", "43211") : endpoint;
        chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: `${target}?${query}` });
        expect(await adapter.flush()).toMatchObject({ phase: "terminal", terminalReason: "request-correlation-failed" });
        expect(fetchImpl).not.toHaveBeenCalled();
      } finally { await adapter.dispose(); }
    },
  );
});
