import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";
import { reportGoogleAdsConversionPrototype } from "../rig/google-ads-conversion-prototype-report.mjs";

const destination = "AW-0000000000";
const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";
const context = { pageURL: "https://example.test/list", referrer: "" };
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

describe("experimental Google view_item_list subset", () => {
  it.each(variants)("$option needs the list opt-in and snapshots an explicitly enabled schema", async ({ option, item }) => {
    await local({ [option]: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item_list", { items: [item] });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "rejected" });
      expect(receiver.arrivals).toEqual([]);
    });
    await local({ [option]: true, experimentalViewItemList: true }, async ({ adapter, receiver }) => {
      const mutable = { ...item };
      const params = { items: [mutable], value: 12.5 };
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item_list", params);
      Object.assign(mutable, { google_business_vertical: "changed" });
      params.items.push({ ...item });
      params.value = 99;
      adapter.gtag("event", "view_item_list", { items: [item] });
      adapter.gtag("event", "view_item_list", { items: [item], value: undefined });
      adapter.gtag("event", "view_item_list", { items: [item], value: 0 });
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition)).toEqual([
        "configured", "transport-settled", "transport-settled", "transport-settled", "transport-settled",
      ]);
      const queries = receiver.arrivals.map(({ url }) => new URL(url).searchParams);
      expect(queries.map((query) => query.get("airlock_event"))).toEqual(Array(4).fill("view_item_list"));
      expect(queries.map((query) => query.get("airlock_value"))).toEqual(["12.5", null, null, "0"]);
      for (const query of queries) {
        expect(JSON.parse(query.get("airlock_items"))).toEqual([item]);
        expect(query.has("label")).toBe(false);
      }
    });
  }, 8000);

  it("keeps list and vertical flags independent and refuses ambiguous options", async () => {
    for (const create of [createGoogleAdsPrototype, createGoogleAdsConversionPrototype]) {
      for (const value of [null, 1, "true"]) {
        expect(() => create({ endpoint, experimentalViewItemList: value })).toThrow("invalid-experimental-option");
      }
      expect(() => create({ endpoint, experimentalViewItemList: true, experimentalParameterScopes: true }))
        .toThrow("invalid-experimental-option");
      expect(() => create({ endpoint, experimentalViewItemList: true, experimentalRouting: true, experimentalMultiDestination: true }))
        .toThrow("invalid-experimental-option");
    }
    for (const options of [{}, { experimentalViewItemList: true }]) {
      await local(options, async ({ adapter, receiver }) => {
        adapter.gtag("config", destination);
        for (const { item } of variants) adapter.gtag("event", "view_item_list", { items: [item] });
        expect((await adapter.flush()).outcomes.slice(1).every(({ disposition }) => disposition === "rejected")).toBe(true);
        expect(receiver.arrivals).toEqual([]);
      });
    }
    await local({ experimentalViewItemList: true, experimentalRetailViewItem: true }, async ({ adapter, receiver }) => {
      adapter.gtag("event", "view_item_list", { items: [variants[0].item] });
      adapter.gtag("config", "AW-123");
      adapter.gtag("event", "view_item_list", { items: [variants[0].item] });
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item_list", { items: [variants[1].item] });
      adapter.gtag("event", "view_item", { items: [variants[0].item] });
      adapter.gtag("event", "view_item_list", { items: [variants[0].item] });
      expect((await adapter.flush()).outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
        "conversion-before-config", "synthetic-destination-required", "conversion-before-config", "configured",
        "unsupported-items", "transport-settled", "transport-settled",
      ]);
      expect(receiver.arrivals.map(({ url }) => new URL(url).searchParams.get("airlock_event")))
        .toEqual(["view_item", "view_item_list"]);
    });
  }, 8000);

  it("rejects foreign, mixed, malformed and oversized shapes at capture and again in the connector", async () => {
    const options = Object.fromEntries(variants.map(({ option }) => [option, true]));
    options.experimentalViewItemList = true;
    const getter = vi.fn(() => 1234);
    const accessor = { google_business_vertical: "retail" };
    Object.defineProperty(accessor, "id", { get: getter, enumerable: true });
    let enumerations = 0;
    const oversized = new Proxy(Array(11), { ownKeys(target) { enumerations += 1; return Reflect.ownKeys(target); } });
    const invalidItems = [
      undefined, null, [], Array(1), oversized, [accessor], [variants[0].item, variants[1].item],
      [{ item_id: 1234, google_business_vertical: "retail" }],
      [{ ...variants[0].item, price: 2 }],
      [{ ...variants[1].item, location_id: undefined }],
      [{ ...variants[4].item, start_date: "2026-02-29" }],
    ];
    const invalidValues = [null, "1", -1, -0, NaN, Infinity];
    const extraFields = [
      { send_to: `${destination}/LABEL` }, { currency: "USD" }, { transaction_id: "synthetic" },
      { new_customer: true }, { event_callback: () => {} }, { aw_feed_label: "synthetic" },
    ];
    await local({ ...options, experimentalCallbacks: true, experimentalPurchase: true, experimentalPurchaseCart: true },
      async ({ adapter, receiver }) => {
        adapter.gtag("config", destination);
        for (const items of invalidItems) adapter.gtag("event", "view_item_list", { items });
        for (const value of invalidValues) adapter.gtag("event", "view_item_list", { items: [variants[0].item], value });
        for (const extra of extraFields) adapter.gtag("event", "view_item_list", { items: [variants[0].item], ...extra });
        const state = await adapter.flush();
        expect(state.outcomes.slice(1).map(({ reason }) => reason)).toEqual([
          ...invalidItems.map(() => "unsupported-items"),
          ...invalidValues.map(() => "unsupported-value"),
          ...extraFields.map(() => "unsupported-parameters"),
        ]);
        expect(receiver.arrivals).toEqual([]);
      });
    const host = createConnectorHost(createGoogleAdsConversionPrototype, { endpoint, ...options });
    const event = (args) => ({ type: "google-ads-command", seq: 1, ts: 0, payload: { args, context }, snapshot: {} });
    await host.init({});
    await host.routeBatch([event(["config", destination])]);
    for (const params of [
      { items: oversized }, { items: [variants[0].item, variants[1].item] },
      { items: [variants[0].item], value: Infinity }, { items: [variants[0].item], send_to: `${destination}/LABEL` },
    ]) {
      const result = await host.routeBatch([event(["event", "view_item_list", params])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped).toHaveLength(1);
    }
    expect(getter).not.toHaveBeenCalled();
    expect(enumerations).toBe(0);
  }, 8000);

  it.each(variants)("$option retains host and tag consent and never replays held lists", async ({ option, item }) => {
    await local({
      [option]: true, experimentalViewItemList: true, experimentalConsentCommands: true,
      consent: { ad_storage: "denied" },
    }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("event", "view_item_list", { items: [item] });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "held" });
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      adapter.gtag("event", "view_item_list", { items: [item] });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "held" });
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "view_item_list", { items: [item] });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "transport-settled" });
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("applies an admitted denial immediately to an earlier queued list", async () => {
    let receiver, chamber, adapter, cause, release, notify;
    const arrival = new Promise((resolve) => { notify = resolve; });
    try {
      receiver = await createConversionReceiver({
        respond(_request, response) { release = () => response.writeHead(204).end(); notify(); },
      });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: "granted" },
        experimentalRetailViewItem: true, experimentalViewItemList: true, experimentalConsentCommands: true,
      });
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("config", destination);
      await adapter.flush();
      adapter.gtag("event", "view_item_list", { items: [variants[0].item] });
      await arrival;
      adapter.gtag("event", "view_item_list", { items: [{ ...variants[0].item, id: 2 }] });
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      release();
      release = undefined;
      expect((await adapter.flush()).outcomes.slice(-3).map(({ disposition }) => disposition))
        .toEqual(["transport-settled", "held", "consent-updated"]);
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toHaveLength(1);
    } catch (error) { cause = error; throw error; }
    finally { release?.(); await closeConversionResources({ adapter, chamber, receiver, cause }); }
  }, 8000);

  it("captures ordered bounded lists from a drained dataLayer without replay", async () => {
    await local({
      experimentalRetailViewItem: true, experimentalViewItemList: true, experimentalDataLayer: true,
    }, async ({ adapter, receiver }) => {
      const layer = [];
      function enqueue() { layer.push(arguments); }
      const items = Array.from({ length: 10 }, (_, index) => ({ ...variants[0].item, id: index + 1 }));
      const expected = items.map((item) => ({ ...item }));
      enqueue("config", destination);
      enqueue("event", "view_item_list", { items });
      adapter.drainDataLayer(layer);
      items.reverse();
      items[0].id = 99;
      adapter.drainDataLayer(layer);
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition))
        .toEqual(["configured", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      expect(JSON.parse(new URL(receiver.arrivals[0].url).searchParams.get("airlock_items"))).toEqual(expected);
    });
  }, 8000);

  it("keeps enabled verticals and conversion/purchase/list events separate", async () => {
    const options = Object.fromEntries(variants.map(({ option }) => [option, true]));
    await local({
      ...options, experimentalViewItemList: true, experimentalPurchase: true, experimentalPurchaseCart: true,
      experimentalRouting: true,
    }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      for (const { item } of variants) adapter.gtag("event", "view_item_list", { items: [item], value: 0 });
      adapter.gtag("event", "view_item", { items: [variants[0].item], value: 3 });
      adapter.gtag("event", "conversion", { send_to: `${destination}/CONVERSION`, value: 7 });
      adapter.gtag("event", "purchase", {
        send_to: `${destination}/PURCHASE`, items: [{ id: "sku", price: 2, quantity: 1 }],
      });
      expect((await adapter.flush()).outcomes.slice(1).every(({ disposition }) => disposition === "transport-settled")).toBe(true);
      const queries = receiver.arrivals.map(({ url }) => new URL(url).searchParams);
      expect(queries.map((query) => query.get("airlock_event"))).toEqual([
        ...variants.map(() => "view_item_list"), "view_item", null, "purchase",
      ]);
      for (const [index, { item }] of variants.entries()) {
        expect(JSON.parse(queries[index].get("airlock_items"))).toEqual([item]);
        expect(queries[index].get("airlock_value")).toBe("0");
        expect(queries[index].has("label")).toBe(false);
      }
      expect(queries.slice(-2).map((query) => query.get("label"))).toEqual(["CONVERSION", "PURCHASE"]);
      expect(queries.at(-2).has("airlock_items")).toBe(false);
      expect(JSON.parse(queries.at(-1).get("airlock_items"))).toEqual([{ id: "sku", price: 2, quantity: 1 }]);
      const report = reportGoogleAdsConversionPrototype({
        endpoint: receiver.endpoint, observedRequests: [receiver.arrivals[0]],
        commandSnapshots: [{ args: ["event", "view_item_list", { items: [variants[0].item], value: 0 }], context }],
      });
      expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false, local: [{ relationshipsPreserved: false }] });
      expect(JSON.stringify(report)).not.toContain("1234");
    });
  }, 8000);

  it.each(["list-as-item", "item-as-list", "conversion-as-list", "purchase-as-list", "wrong-items",
    "wrong-value", "injected-value", "dropped-zero", "wrong-endpoint", "extra-label", "duplicate-event"])(
    "refuses fake-worker %s before transport", async (scenario) => {
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
        experimentalRetailViewItem: true, experimentalViewItemList: true, experimentalPurchase: true,
      });
      try {
        const command = scenario === "item-as-list" ? "view_item" : scenario === "conversion-as-list" ? "conversion" :
          scenario === "purchase-as-list" ? "purchase" : "view_item_list";
        const params = ["purchase", "conversion"].includes(command)
          ? { send_to: `${destination}/SYNTHETIC_LABEL` } :
            { items: [variants[0].item], ...(scenario === "injected-value" ? {} : { value: 0 }) };
        adapter.gtag("event", command, params);
        await vi.waitFor(() => expect(chamber.sent.some((message) => message.type === "event")).toBe(true));
        const marker = scenario === "list-as-item" ? "view_item" : "view_item_list";
        const query = new URLSearchParams({
          airlock_event: marker,
          airlock_items: JSON.stringify([scenario === "wrong-items" ? { ...variants[0].item, id: 8 } : variants[0].item]),
          airlock_value: scenario === "wrong-value" ? "1" : "0",
        });
        if (scenario === "dropped-zero") query.delete("airlock_value");
        if (scenario === "extra-label") query.set("label", "SYNTHETIC_LABEL");
        if (scenario === "duplicate-event") query.append("airlock_event", marker);
        const target = scenario === "wrong-endpoint" ? endpoint.replace("43210", "43211") : endpoint;
        chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: `${target}?${query}` });
        expect(await adapter.flush()).toMatchObject({ phase: "terminal", terminalReason: "request-correlation-failed" });
        expect(fetchImpl).not.toHaveBeenCalled();
      } finally { await adapter.dispose(); }
    },
  );
});
