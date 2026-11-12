import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";
import { reportGoogleAdsConversionPrototype } from "../rig/google-ads-conversion-prototype-report.mjs";

const destination = "AW-0000000000";
const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";
const context = { pageURL: "https://example.test/remarketing-actions", referrer: "" };
const actions = [
  { event: "view_search_results", option: "experimentalViewSearchResults" },
  { event: "add_to_cart", option: "experimentalAddToCart" },
];
const viewEvents = ["view_item", "view_item_list", ...actions.map(({ event }) => event)];
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

describe("experimental Google remarketing actions", () => {
  it.each(actions.flatMap((action) => variants.map((variant) => ({ action, variant }))))(
    "$action.event / $variant.option requires both opt-ins and snapshots its inputs", async ({ action, variant }) => {
      await local({ [variant.option]: true }, async ({ adapter, receiver }) => {
        adapter.gtag("config", destination);
        adapter.gtag("event", action.event, { items: [variant.item] });
        expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "rejected" });
        expect(receiver.arrivals).toEqual([]);
      });
      await local({ [variant.option]: true, [action.option]: true }, async ({ adapter, receiver }) => {
        const mutable = { ...variant.item };
        const params = { items: [mutable], value: 12.5 };
        adapter.gtag("config", destination);
        adapter.gtag("event", action.event, params);
        mutable.google_business_vertical = "changed";
        params.items.push({ ...variant.item });
        params.value = 99;
        adapter.gtag("event", action.event, { items: [variant.item] });
        adapter.gtag("event", action.event, { items: [variant.item], value: undefined });
        adapter.gtag("event", action.event, { items: [variant.item], value: 0 });
        expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition)).toEqual([
          "configured", "transport-settled", "transport-settled", "transport-settled", "transport-settled",
        ]);
        const queries = receiver.arrivals.map(({ url }) => new URL(url).searchParams);
        expect(queries.map((query) => query.get("airlock_event"))).toEqual(Array(4).fill(action.event));
        expect(queries.map((query) => query.get("airlock_value"))).toEqual(["12.5", null, null, "0"]);
        for (const query of queries) {
          expect(JSON.parse(query.get("airlock_items"))).toEqual([variant.item]);
          expect(query.has("label")).toBe(false);
        }
      });
    }, 8000,
  );

  it("keeps all three additional event gates independent in every combination", async () => {
    const gates = [{ event: "view_item_list", option: "experimentalViewItemList" }, ...actions];
    for (let mask = 0; mask < 8; mask += 1) {
      const options = Object.fromEntries(gates.map(({ option }, index) => [option, Boolean(mask & (1 << index))]));
      await local({ ...options, experimentalRetailViewItem: true }, async ({ adapter, receiver }) => {
        adapter.gtag("config", destination);
        adapter.gtag("event", "view_item", { items: [variants[0].item] });
        for (const { event } of gates) adapter.gtag("event", event, { items: [variants[0].item] });
        const state = await adapter.flush();
        expect(state.outcomes.map(({ disposition }) => disposition)).toEqual([
          "configured", "transport-settled",
          ...gates.map((_, index) => (mask & (1 << index)) ? "transport-settled" : "rejected"),
        ]);
        expect(receiver.arrivals.map(({ url }) => new URL(url).searchParams.get("airlock_event")))
          .toEqual(["view_item", ...gates.filter((_, index) => mask & (1 << index)).map(({ event }) => event)]);
      });
    }
  }, 8000);

  it("rechecks every event gate independently in the connector", async () => {
    const gates = [{ event: "view_item_list", option: "experimentalViewItemList" }, ...actions];
    const command = (args) => ({ type: "google-ads-command", seq: 1, ts: 0, payload: { args, context }, snapshot: {} });
    for (let mask = 0; mask < 8; mask += 1) {
      const options = Object.fromEntries(gates.map(({ option }, index) => [option, Boolean(mask & (1 << index))]));
      const host = createConnectorHost(createGoogleAdsConversionPrototype, { endpoint, experimentalRetailViewItem: true, ...options });
      await host.init({});
      await host.routeBatch([command(["config", destination])]);
      for (const [index, { event }] of gates.entries()) {
        const result = await host.routeBatch([command(["event", event, { items: [variants[0].item] }])]);
        expect(result.ready).toHaveLength(mask & (1 << index) ? 1 : 0);
        expect(result.dropped).toHaveLength(mask & (1 << index) ? 0 : 1);
      }
      const unknown = await host.routeBatch([command(["event", "constructor", { items: [variants[0].item] }])]);
      expect(unknown.ready).toEqual([]);
      expect(unknown.dropped).toHaveLength(1);
    }
    const noVertical = createConnectorHost(createGoogleAdsConversionPrototype, {
      endpoint, experimentalViewItemList: true, experimentalViewSearchResults: true, experimentalAddToCart: true,
    });
    await noVertical.init({});
    await noVertical.routeBatch([command(["config", destination])]);
    for (const { event } of gates) {
      const result = await noVertical.routeBatch([command(["event", event, { items: [variants[0].item] }])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped).toHaveLength(1);
    }
  });

  it.each(actions)("$event requires a vertical and configured route and refuses ambiguous options", async ({ event, option }) => {
    for (const create of [createGoogleAdsPrototype, createGoogleAdsConversionPrototype]) {
      for (const value of [null, 1, "true"]) {
        expect(() => create({ endpoint, [option]: value })).toThrow("invalid-experimental-option");
      }
      expect(() => create({ endpoint, [option]: true, experimentalParameterScopes: true })).toThrow("invalid-experimental-option");
      expect(() => create({ endpoint, [option]: true, experimentalRouting: true, experimentalMultiDestination: true }))
        .toThrow("invalid-experimental-option");
    }
    await local({ [option]: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      for (const { item } of variants) adapter.gtag("event", event, { items: [item] });
      expect((await adapter.flush()).outcomes.slice(1).every(({ disposition }) => disposition === "rejected")).toBe(true);
      expect(receiver.arrivals).toEqual([]);
    });
    await local({ [option]: true, experimentalRetailViewItem: true }, async ({ adapter, receiver }) => {
      adapter.gtag("event", event, { items: [variants[0].item] });
      adapter.gtag("config", "AW-123");
      adapter.gtag("event", event, { items: [variants[0].item] });
      adapter.gtag("config", destination);
      adapter.gtag("event", event, { items: [variants[1].item] });
      adapter.gtag("event", event, { items: [variants[0].item] });
      expect((await adapter.flush()).outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
        "conversion-before-config", "synthetic-destination-required", "conversion-before-config",
        "configured", "unsupported-items", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it.each(actions)("$event uses only the explicitly configured alternate loopback route", async ({ event, option }) => {
    let receiver, chamber, adapter, cause;
    try {
      receiver = await createConversionReceiver({ conversionId: "123456789" });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: "granted" },
        experimentalRouting: true, experimentalRetailViewItem: true, [option]: true,
      });
      adapter.gtag("config", "AW-222");
      adapter.gtag("event", event, { items: [variants[0].item] });
      adapter.gtag("config", "AW-123456789");
      adapter.gtag("event", event, { items: [variants[0].item] });
      expect((await adapter.flush()).outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
        "destination-mismatch", "conversion-before-config", "configured", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(1);
      const request = new URL(receiver.arrivals[0].url);
      expect(request.origin + request.pathname).toBe(receiver.endpoint);
      expect(request.searchParams.get("airlock_event")).toBe(event);
      expect(request.searchParams.has("label")).toBe(false);
    } catch (error) { cause = error; throw error; }
    finally { await closeConversionResources({ adapter, chamber, receiver, cause }); }
  }, 8000);

  it.each(actions)("$event refuses malformed and foreign input at capture and again in the connector", async ({ event, option }) => {
    const options = Object.fromEntries(variants.map(({ option: name }) => [name, true]));
    options[option] = true;
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
        for (const items of invalidItems) adapter.gtag("event", event, { items });
        for (const value of invalidValues) adapter.gtag("event", event, { items: [variants[0].item], value });
        for (const extra of extraFields) adapter.gtag("event", event, { items: [variants[0].item], ...extra });
        expect((await adapter.flush()).outcomes.slice(1).map(({ reason }) => reason)).toEqual([
          ...invalidItems.map(() => "unsupported-items"), ...invalidValues.map(() => "unsupported-value"),
          ...extraFields.map(() => "unsupported-parameters"),
        ]);
        expect(receiver.arrivals).toEqual([]);
      });
    const host = createConnectorHost(createGoogleAdsConversionPrototype, { endpoint, ...options });
    const command = (args) => ({ type: "google-ads-command", seq: 1, ts: 0, payload: { args, context }, snapshot: {} });
    await host.init({});
    await host.routeBatch([command(["config", destination])]);
    for (const params of [
      { items: oversized }, { items: [variants[0].item, variants[1].item] },
      { items: [variants[0].item], value: Infinity }, { items: [variants[0].item], send_to: `${destination}/LABEL` },
    ]) {
      const result = await host.routeBatch([command(["event", event, params])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped).toHaveLength(1);
    }
    expect(getter).not.toHaveBeenCalled();
    expect(enumerations).toBe(0);
  }, 8000);

  it.each(actions)("$event holds at host and tag denials without replay", async ({ event, option }) => {
    await local({
      [option]: true, experimentalRetailViewItem: true, experimentalConsentCommands: true,
      consent: { ad_storage: "denied" },
    }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("event", event, { items: [variants[0].item] });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "held" });
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      adapter.gtag("event", event, { items: [variants[0].item] });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "held" });
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", event, { items: [variants[0].item] });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "transport-settled" });
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it.each(actions)("$event applies an admitted denial immediately to an earlier queued event", async ({ event, option }) => {
    let receiver, chamber, adapter, cause, release, notify;
    const arrival = new Promise((resolve) => { notify = resolve; });
    try {
      receiver = await createConversionReceiver({
        respond(_request, response) { release = () => response.writeHead(204).end(); notify(); },
      });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: "granted" },
        [option]: true, experimentalRetailViewItem: true, experimentalConsentCommands: true,
      });
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("config", destination);
      await adapter.flush();
      adapter.gtag("event", event, { items: [variants[0].item] });
      await arrival;
      adapter.gtag("event", event, { items: [{ ...variants[0].item, id: 2 }] });
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

  it("preserves event order and field isolation across all remarketing and conversion paths", async () => {
    const options = Object.fromEntries(variants.map(({ option }) => [option, true]));
    await local({
      ...options, experimentalViewItemList: true, experimentalViewSearchResults: true, experimentalAddToCart: true,
      experimentalPurchase: true, experimentalPurchaseCart: true, experimentalRouting: true,
    }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      for (const [index, event] of viewEvents.entries()) {
        adapter.gtag("event", event, { items: [variants[index].item], value: index });
      }
      adapter.gtag("event", "conversion", { send_to: `${destination}/CONVERSION`, value: 7 });
      adapter.gtag("event", "purchase", {
        send_to: `${destination}/PURCHASE`, items: [{ id: "sku", price: 2, quantity: 1 }],
      });
      expect((await adapter.flush()).outcomes.slice(1).every(({ disposition }) => disposition === "transport-settled")).toBe(true);
      const queries = receiver.arrivals.map(({ url }) => new URL(url).searchParams);
      expect(queries.map((query) => query.get("airlock_event"))).toEqual([...viewEvents, null, "purchase"]);
      for (const [index, event] of viewEvents.entries()) {
        expect(JSON.parse(queries[index].get("airlock_items"))).toEqual([variants[index].item]);
        expect(queries[index].get("airlock_value")).toBe(String(index));
        expect(queries[index].has("label")).toBe(false);
        const report = reportGoogleAdsConversionPrototype({
          endpoint: receiver.endpoint, observedRequests: [receiver.arrivals[index]],
          commandSnapshots: [{ args: ["event", event, { items: [variants[index].item], value: index }], context }],
        });
        expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false, local: [{ relationshipsPreserved: false }] });
      }
      expect(queries.slice(-2).map((query) => query.get("label"))).toEqual(["CONVERSION", "PURCHASE"]);
      expect(queries.at(-2).has("airlock_items")).toBe(false);
      expect(JSON.parse(queries.at(-1).get("airlock_items"))).toEqual([{ id: "sku", price: 2, quantity: 1 }]);
    });
  }, 8000);

  it.each(actions)("$event snapshots a bounded ordered dataLayer list without replay", async ({ event, option }) => {
    await local({ [option]: true, experimentalRetailViewItem: true, experimentalDataLayer: true }, async ({ adapter, receiver }) => {
      const layer = [];
      function enqueue() { layer.push(arguments); }
      const items = Array.from({ length: 10 }, (_, index) => ({ ...variants[0].item, id: index + 1 }));
      const expected = items.map((item) => ({ ...item }));
      enqueue("config", destination);
      enqueue("event", event, { items });
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

  const substitutions = ["conversion", "purchase", ...viewEvents].flatMap((command) =>
    ["conversion", "purchase", ...viewEvents].filter((wire) => command !== wire).map((wire) => ({ command, wire })));

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
      experimentalRetailViewItem: true, experimentalViewItemList: true, experimentalViewSearchResults: true,
      experimentalAddToCart: true, experimentalPurchase: true,
    });
    try {
      const params = viewEvents.includes(command)
        ? { items: [variants[0].item], value: 0 } : { send_to: `${destination}/SYNTHETIC_LABEL` };
      adapter.gtag("event", command, params);
      await vi.waitFor(() => expect(chamber.sent.some((message) => message.type === "event")).toBe(true));
      const query = viewEvents.includes(wire)
        ? new URLSearchParams({ airlock_event: wire, airlock_items: JSON.stringify([variants[0].item]), airlock_value: "0" })
        : new URLSearchParams(wire === "purchase"
          ? { label: "SYNTHETIC_LABEL", airlock_event: "purchase" } : { label: "SYNTHETIC_LABEL" });
      chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: `${endpoint}?${query}` });
      expect(await adapter.flush()).toMatchObject({ phase: "terminal", terminalReason: "request-correlation-failed" });
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
  });

  it.each(actions.flatMap((action) => ["wrong-item", "wrong-value", "injected-value", "dropped-zero",
    "duplicate-event", "wrong-endpoint", "extra-label"].map((scenario) => ({ action, scenario }))))(
    "$action.event refuses fake-worker $scenario before transport", async ({ action, scenario }) => {
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
        experimentalRetailViewItem: true, [action.option]: true,
      });
      try {
        const params = { items: [variants[0].item], ...(scenario === "injected-value" ? {} : { value: 0 }) };
        adapter.gtag("event", action.event, params);
        await vi.waitFor(() => expect(chamber.sent.some((message) => message.type === "event")).toBe(true));
        const query = new URLSearchParams({
          airlock_event: action.event,
          airlock_items: JSON.stringify([scenario === "wrong-item" ? { ...variants[0].item, id: 8 } : variants[0].item]),
          airlock_value: scenario === "wrong-value" ? "1" : "0",
        });
        if (scenario === "dropped-zero") query.delete("airlock_value");
        if (scenario === "duplicate-event") query.append("airlock_event", action.event);
        if (scenario === "extra-label") query.set("label", "SYNTHETIC_LABEL");
        const target = scenario === "wrong-endpoint" ? endpoint.replace("43210", "43211") : endpoint;
        chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: `${target}?${query}` });
        expect(await adapter.flush()).toMatchObject({ phase: "terminal", terminalReason: "request-correlation-failed" });
        expect(fetchImpl).not.toHaveBeenCalled();
      } finally { await adapter.dispose(); }
    },
  );
});
