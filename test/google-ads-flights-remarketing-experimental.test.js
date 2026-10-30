import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";
import { reportGoogleAdsConversionPrototype } from "../rig/google-ads-conversion-prototype-report.mjs";

const destination = "AW-0000000000";
const sendTo = `${destination}/SYNTHETIC_LABEL`;
const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";
const context = { pageURL: "https://example.test/flights", referrer: "" };
const flight = () => ({
  origin: "SFO", destination: "JFK", start_date: "2028-02-29", end_date: "2028-03-02",
  google_business_vertical: "flights",
});
const travel = () => ({ ...flight(), google_business_vertical: "travel" });

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

describe("experimental flights remarketing", () => {
  it("requires independent flights and purchase gates and snapshots the unlabeled input", async () => {
    for (const options of [{ experimentalRemarketingPurchase: true },
      { experimentalTravelViewItem: true, experimentalRemarketingPurchase: true },
      { experimentalFlightsViewItem: true }]) {
      await local(options, async ({ adapter, receiver }) => {
        adapter.gtag("config", destination);
        adapter.gtag("event", "purchase", { items: [flight()] });
        expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "rejected" });
        expect(receiver.arrivals).toEqual([]);
      });
    }
    await local({ experimentalFlightsViewItem: true, experimentalRemarketingPurchase: true }, async ({ adapter, receiver }) => {
      const mutable = flight();
      const params = { items: [mutable], value: 12.5 };
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", params);
      mutable.destination = "changed";
      mutable.start_date = "2030-01-01";
      params.items.push(flight());
      params.value = 99;
      adapter.gtag("event", "purchase", { items: [flight()] });
      adapter.gtag("event", "purchase", { items: [flight()], value: undefined });
      adapter.gtag("event", "purchase", { items: [flight()], value: 0 });
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition)).toEqual([
        "configured", "transport-settled", "transport-settled", "transport-settled", "transport-settled",
      ]);
      const queries = receiver.arrivals.map(({ url }) => new URL(url).searchParams);
      expect(queries.map((query) => query.get("airlock_event"))).toEqual(Array(4).fill("remarketing_purchase"));
      expect(queries.map((query) => query.get("airlock_value"))).toEqual(["12.5", null, null, "0"]);
      for (const query of queries) {
        expect(JSON.parse(query.get("airlock_items"))).toEqual([flight()]);
        expect(query.has("label")).toBe(false);
      }
    });
  }, 8000);

  it("keeps the flights and travel opt-ins independent, including travel's optional fields", async () => {
    for (const flights of [false, true]) {
      for (const travelEnabled of [false, true]) {
        await local({ experimentalFlightsViewItem: flights, experimentalTravelViewItem: travelEnabled },
          async ({ adapter, receiver }) => {
            adapter.gtag("config", destination);
            adapter.gtag("event", "view_item", { items: [flight()] });
            adapter.gtag("event", "view_item", { items: [travel()] });
            adapter.gtag("event", "view_item", { items: [{ destination: "JFK", google_business_vertical: "travel" }] });
            adapter.gtag("event", "view_item", { items: [{ destination: "JFK", google_business_vertical: "flights" }] });
            expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition)).toEqual([
              "configured", flights ? "transport-settled" : "rejected",
              travelEnabled ? "transport-settled" : "rejected", travelEnabled ? "transport-settled" : "rejected", "rejected",
            ]);
            expect(receiver.arrivals).toHaveLength(Number(flights) + 2 * Number(travelEnabled));
          });
      }
    }
  }, 8000);

  it("keeps all additional event gates independent for the flights vertical", async () => {
    const gates = [
      { option: "experimentalViewItemList", command: "view_item_list", marker: "view_item_list" },
      { option: "experimentalViewSearchResults", command: "view_search_results", marker: "view_search_results" },
      { option: "experimentalAddToCart", command: "add_to_cart", marker: "add_to_cart" },
      { option: "experimentalRemarketingPurchase", command: "purchase", marker: "remarketing_purchase" },
    ];
    for (let mask = 0; mask < 16; mask += 1) {
      const options = Object.fromEntries(gates.map(({ option }, index) => [option, Boolean(mask & (1 << index))]));
      await local({ experimentalFlightsViewItem: true, ...options }, async ({ adapter, receiver }) => {
        adapter.gtag("config", destination);
        adapter.gtag("event", "view_item", { items: [flight()] });
        for (const { command } of gates) adapter.gtag("event", command, { items: [flight()] });
        expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition)).toEqual([
          "configured", "transport-settled",
          ...gates.map((_, index) => mask & (1 << index) ? "transport-settled" : "rejected"),
        ]);
        expect(receiver.arrivals.map(({ url }) => new URL(url).searchParams.get("airlock_event")))
          .toEqual(["view_item", ...gates.filter((_, index) => mask & (1 << index)).map(({ marker }) => marker)]);
      });
    }
  }, 12000);

  it("validates the new option and requires the one configured route", async () => {
    for (const create of [createGoogleAdsPrototype, createGoogleAdsConversionPrototype]) {
      for (const invalid of [null, 1, "true"]) {
        expect(() => create({ endpoint, experimentalFlightsViewItem: invalid })).toThrow("invalid-experimental-option");
      }
      expect(() => create({ endpoint, experimentalFlightsViewItem: true, experimentalParameterScopes: true }))
        .toThrow("invalid-experimental-option");
      expect(() => create({ endpoint, experimentalFlightsViewItem: true, experimentalRouting: true, experimentalMultiDestination: true }))
        .toThrow("invalid-experimental-option");
    }
    let receiver, chamber, adapter, cause;
    try {
      receiver = await createConversionReceiver({ conversionId: "123456789" });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: "granted" },
        experimentalRouting: true, experimentalFlightsViewItem: true, experimentalRemarketingPurchase: true,
        experimentalPurchase: true,
      });
      adapter.gtag("config", "AW-222");
      adapter.gtag("event", "purchase", { items: [flight()] });
      adapter.gtag("config", "AW-123456789");
      adapter.gtag("event", "purchase", { items: [flight()] });
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

  it("preserves valid calendar extremes without imposing date ordering", async () => {
    await local({ experimentalFlightsViewItem: true, experimentalRemarketingPurchase: true }, async ({ adapter, receiver }) => {
      const inputs = [
        { ...flight(), start_date: "0001-01-01", end_date: "9999-12-31" },
        { ...flight(), start_date: "2000-02-29", end_date: "1900-02-28" },
        { ...flight(), start_date: "2024-04-30", end_date: "2028-02-29" },
      ];
      adapter.gtag("config", destination);
      for (const input of inputs) adapter.gtag("event", "purchase", { items: [input], value: 0 });
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition))
        .toEqual(["configured", ...inputs.map(() => "transport-settled")]);
      expect(receiver.arrivals.map(({ url }) => JSON.parse(new URL(url).searchParams.get("airlock_items"))[0])).toEqual(inputs);
      expect(receiver.arrivals.every(({ url }) => new URL(url).searchParams.get("airlock_value") === "0")).toBe(true);
    });
  }, 8000);

  it("accepts bounded maximum-size item fields and rejects oversized encoded URLs", async () => {
    await local({ experimentalFlightsViewItem: true, experimentalRemarketingPurchase: true }, async ({ adapter, receiver }) => {
      const maximum = Array.from({ length: 10 }, () => ({
        ...flight(), origin: "o".repeat(128), destination: "d".repeat(128),
      }));
      const oversized = Array.from({ length: 10 }, () => ({
        ...flight(), origin: "\u4e00".repeat(128), destination: "\u4e00".repeat(128),
      }));
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", { items: maximum });
      adapter.gtag("event", "purchase", { items: oversized });
      adapter.gtag("event", "purchase", { items: [flight()] });
      expect((await adapter.flush()).outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
        "configured", "transport-settled", "encoded-context-limit", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(2);
      expect(JSON.parse(new URL(receiver.arrivals[0].url).searchParams.get("airlock_items"))).toEqual(maximum);
      expect(JSON.parse(new URL(receiver.arrivals[1].url).searchParams.get("airlock_items"))).toEqual([flight()]);
    });
  }, 8000);

  it("rejects malformed, mixed and ambiguous input without invoking accessors", async () => {
    const options = {
      experimentalFlightsViewItem: true, experimentalTravelViewItem: true, experimentalRemarketingPurchase: true,
      experimentalPurchase: true, experimentalPurchaseCart: true, queueLimit: 128,
    };
    const getter = vi.fn(() => "2028-02-29");
    const accessor = flight();
    Object.defineProperty(accessor, "start_date", { get: getter, enumerable: true });
    let enumerations = 0;
    const oversized = new Proxy(Array(11), { ownKeys(target) { enumerations += 1; return Reflect.ownKeys(target); } });
    let reads = 0;
    const changing = new Proxy(flight(), {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        return key === "destination" ? { ...descriptor, value: ++reads === 1 ? "before" : "after" } : descriptor;
      },
    });
    const missing = ["origin", "destination", "start_date", "end_date"].map((key) => {
      const result = flight();
      delete result[key];
      return result;
    });
    const invalid = [
      undefined, null, [], Array(1), oversized, [accessor], [changing], ...missing.map((item) => [item]),
      [flight(), travel()], [{ ...flight(), id: "sku" }], [{ ...flight(), item_id: "sku" }],
      [{ ...flight(), price: 2 }], [{ ...flight(), location_id: "SFO" }],
      [{ ...flight(), origin: "" }], [{ ...flight(), destination: 1 }],
      [{ ...flight(), origin: "x".repeat(129) }], [{ ...flight(), destination: "\ud800" }],
      [{ ...flight(), origin: undefined }], [{ ...flight(), end_date: undefined }],
    ];
    const dates = [
      null, 0, "2024-2-29", "2024-02-9", "2024-02-29Z", "0000-01-01", "2024-00-01",
      "2024-13-01", "2024-01-00", "2024-01-32", "2024-04-31", "2023-02-29", "1900-02-29",
      "2024-02-30", "2024/02/29", "2024-02-29\n", "\uff12\uff10\uff12\uff14-02-29",
    ];
    await local(options, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      for (const items of invalid) adapter.gtag("event", "purchase", { items });
      for (const date of dates) {
        adapter.gtag("event", "purchase", { items: [{ ...flight(), start_date: date }] });
        adapter.gtag("event", "purchase", { items: [{ ...flight(), end_date: date }] });
      }
      for (const value of [null, "1", -1, -0, NaN, Infinity]) {
        adapter.gtag("event", "purchase", { items: [flight()], value });
      }
      for (const params of [
        { items: [flight()], send_to: sendTo }, { items: [flight()], send_to: undefined },
        { items: [flight()], currency: "USD" }, { items: [flight()], new_customer: true },
      ]) adapter.gtag("event", "purchase", params);
      expect((await adapter.flush()).outcomes.slice(1).map(({ reason }) => reason)).toEqual([
        ...invalid.map(() => "unsupported-items"), ...dates.flatMap(() => ["unsupported-items", "unsupported-items"]),
        ...Array.from({ length: 6 }, () => "unsupported-value"),
        "unsupported-items", "unsupported-items", "unsupported-parameters", "unsupported-parameters",
      ]);
      expect(receiver.arrivals).toEqual([]);
      expect(getter).not.toHaveBeenCalled();
      expect(enumerations).toBe(0);
    });
  }, 8000);

  it("rechecks flights enablement and the input in the connector", async () => {
    const command = (args) => ({ type: "google-ads-command", seq: 1, ts: 0, payload: { args, context }, snapshot: {} });
    for (const flights of [false, true]) {
      for (const purchase of [false, true]) {
        const host = createConnectorHost(createGoogleAdsConversionPrototype, {
          endpoint, experimentalFlightsViewItem: flights, experimentalRemarketingPurchase: purchase,
        });
        await host.init({});
        await host.routeBatch([command(["config", destination])]);
        const result = await host.routeBatch([command(["event", "purchase", { items: [flight()] }])]);
        expect(result.ready).toHaveLength(flights && purchase ? 1 : 0);
        expect(result.dropped).toHaveLength(flights && purchase ? 0 : 1);
        for (const params of [
          { items: [{ ...flight(), start_date: "1900-02-29" }] },
          { items: [{ ...flight(), origin: undefined }] },
          { items: [flight(), travel()] },
          { items: [flight()], send_to: sendTo },
          { items: [flight()], value: Infinity },
        ]) {
          const invalid = await host.routeBatch([command(["event", "purchase", params])]);
          expect(invalid.ready).toEqual([]);
          expect(invalid.dropped).toHaveLength(1);
        }
      }
    }
  });

  it("keeps all verticals and both purchase paths distinct across consecutive events", async () => {
    await local({
      experimentalFlightsViewItem: true, experimentalTravelViewItem: true, experimentalRetailViewItem: true,
      experimentalEducationViewItem: true, experimentalLocalViewItem: true, experimentalRealEstateViewItem: true,
      experimentalRemarketingPurchase: true, experimentalPurchase: true, experimentalPurchaseCart: true,
    }, async ({ adapter, receiver }) => {
      const inputs = [
        flight(), travel(), { id: 1234, google_business_vertical: "retail" },
        { id: "COURSE", google_business_vertical: "education" }, { id: "DEAL", google_business_vertical: "local" },
        { id: "HOME", google_business_vertical: "real_estate" },
      ];
      adapter.gtag("config", destination);
      for (const input of inputs) adapter.gtag("event", "purchase", { items: [input] });
      adapter.gtag("event", "purchase", {
        send_to: sendTo, items: [{ id: "sku", price: 2, quantity: 1 }],
      });
      adapter.gtag("event", "conversion", { send_to: sendTo });
      const state = await adapter.flush();
      expect(state.outcomes.slice(1).every(({ disposition }) => disposition === "transport-settled")).toBe(true);
      const queries = receiver.arrivals.map(({ url }) => new URL(url).searchParams);
      expect(queries.map((query) => query.get("airlock_event")))
        .toEqual([...inputs.map(() => "remarketing_purchase"), "purchase", null]);
      for (const [index, input] of inputs.entries()) {
        expect(JSON.parse(queries[index].get("airlock_items"))).toEqual([input]);
        expect(queries[index].has("label")).toBe(false);
      }
      expect(JSON.parse(queries.at(-2).get("airlock_items"))).toEqual([{ id: "sku", price: 2, quantity: 1 }]);
      expect(queries.at(-2).get("label")).toBe("SYNTHETIC_LABEL");
      expect(queries.at(-1).has("airlock_items")).toBe(false);
      const report = reportGoogleAdsConversionPrototype({
        endpoint: receiver.endpoint, observedRequests: [receiver.arrivals[0]],
        commandSnapshots: [{ args: ["event", "purchase", { items: [flight()] }], context }],
      });
      expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false, local: [{ relationshipsPreserved: false }] });
      expect(JSON.stringify(state)).not.toContain("JFK");
      expect(JSON.stringify(report)).not.toContain("JFK");
    });
  }, 8000);

  it("holds both flights and labeled purchases at host/tag denials without replay", async () => {
    await local({
      experimentalFlightsViewItem: true, experimentalRemarketingPurchase: true, experimentalPurchase: true,
      experimentalConsentCommands: true, consent: { ad_storage: "denied" },
    }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("event", "purchase", { items: [flight()] });
      adapter.gtag("event", "purchase", { send_to: sendTo });
      expect((await adapter.flush()).outcomes.slice(-2).map(({ disposition }) => disposition)).toEqual(["held", "held"]);
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      adapter.gtag("event", "purchase", { items: [flight()] });
      adapter.gtag("event", "purchase", { send_to: sendTo });
      expect((await adapter.flush()).outcomes.slice(-2).map(({ disposition }) => disposition)).toEqual(["held", "held"]);
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "purchase", { items: [flight()] });
      adapter.gtag("event", "purchase", { send_to: sendTo });
      expect((await adapter.flush()).outcomes.slice(-2).map(({ disposition }) => disposition))
        .toEqual(["transport-settled", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(2);
    });
  }, 8000);

  it("applies admitted denial immediately to a queued flights purchase", async () => {
    let receiver, chamber, adapter, cause, release, notify;
    const arrival = new Promise((resolve) => { notify = resolve; });
    try {
      receiver = await createConversionReceiver({
        respond(_request, response) { release = () => response.writeHead(204).end(); notify(); },
      });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: "granted" },
        experimentalFlightsViewItem: true, experimentalRemarketingPurchase: true, experimentalConsentCommands: true,
      });
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("config", destination);
      await adapter.flush();
      adapter.gtag("event", "purchase", { items: [flight()] });
      await arrival;
      adapter.gtag("event", "purchase", { items: [{ ...flight(), destination: "LAX" }] });
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

  it("snapshots ten ordered flights from dataLayer without replay", async () => {
    await local({
      experimentalFlightsViewItem: true, experimentalRemarketingPurchase: true, experimentalDataLayer: true,
    }, async ({ adapter, receiver }) => {
      const layer = [];
      function enqueue() { layer.push(arguments); }
      const items = Array.from({ length: 10 }, (_, index) => ({ ...flight(), origin: `ORIGIN-${index}` }));
      const expected = items.map((item) => ({ ...item }));
      enqueue("config", destination);
      enqueue("event", "purchase", { items });
      adapter.drainDataLayer(layer);
      items.reverse();
      items[0].destination = "changed";
      adapter.drainDataLayer(layer);
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition))
        .toEqual(["configured", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      expect(JSON.parse(new URL(receiver.arrivals[0].url).searchParams.get("airlock_items"))).toEqual(expected);
    });
  }, 8000);

  it.each([
    "wrong-vertical", "wrong-origin", "wrong-destination", "wrong-start", "wrong-end", "dropped-origin",
    "wrong-value", "injected-value", "dropped-zero", "extra-label", "wrong-marker", "wrong-endpoint", "duplicate-event",
  ])("rejects fake-worker flights purchase with %s before transport", async (scenario) => {
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
      experimentalFlightsViewItem: true, experimentalTravelViewItem: true, experimentalRemarketingPurchase: true,
    });
    try {
      const params = { items: [flight()], ...(scenario === "injected-value" ? {} : { value: 0 }) };
      adapter.gtag("event", "purchase", params);
      await vi.waitFor(() => expect(chamber.sent.some((message) => message.type === "event")).toBe(true));
      const item = {
        destination: "JFK", google_business_vertical: "flights", origin: "SFO",
        start_date: "2028-02-29", end_date: "2028-03-02",
      };
      if (scenario === "wrong-vertical") item.google_business_vertical = "travel";
      if (scenario === "wrong-origin") item.origin = "LAX";
      if (scenario === "wrong-destination") item.destination = "LHR";
      if (scenario === "wrong-start") item.start_date = "2028-02-28";
      if (scenario === "wrong-end") item.end_date = "2028-03-03";
      if (scenario === "dropped-origin") delete item.origin;
      const query = new URLSearchParams({
        airlock_event: scenario === "wrong-marker" ? "view_item" : "remarketing_purchase",
        airlock_items: JSON.stringify([item]), airlock_value: scenario === "wrong-value" ? "1" : "0",
      });
      if (scenario === "dropped-zero") query.delete("airlock_value");
      if (scenario === "extra-label") query.set("label", "SYNTHETIC_LABEL");
      if (scenario === "duplicate-event") query.append("airlock_event", "remarketing_purchase");
      const target = scenario === "wrong-endpoint" ? endpoint.replace("43210", "43211") : endpoint;
      chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: `${target}?${query}` });
      expect(await adapter.flush()).toMatchObject({ phase: "terminal", terminalReason: "request-correlation-failed" });
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
  });

  it.each(["purchase", "conversion", "view_item", "view_item_list", "view_search_results", "add_to_cart"])(
    "rejects fake-worker %s as a flights remarketing purchase", async (command) => {
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
        experimentalFlightsViewItem: true, experimentalRemarketingPurchase: true, experimentalPurchase: true,
        experimentalViewItemList: true, experimentalViewSearchResults: true, experimentalAddToCart: true,
      });
      try {
        const params = ["purchase", "conversion"].includes(command) ? { send_to: sendTo } : { items: [flight()], value: 0 };
        adapter.gtag("event", command, params);
        await vi.waitFor(() => expect(chamber.sent.some((message) => message.type === "event")).toBe(true));
        const item = {
          destination: "JFK", google_business_vertical: "flights", origin: "SFO",
          start_date: "2028-02-29", end_date: "2028-03-02",
        };
        const query = new URLSearchParams({
          airlock_event: "remarketing_purchase", airlock_items: JSON.stringify([item]), airlock_value: "0",
        });
        chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: `${endpoint}?${query}` });
        expect(await adapter.flush()).toMatchObject({ phase: "terminal", terminalReason: "request-correlation-failed" });
        expect(fetchImpl).not.toHaveBeenCalled();
      } finally { await adapter.dispose(); }
    },
  );

  it.each(["purchase", "conversion", "view_item", "view_item_list", "view_search_results", "add_to_cart"])(
    "rejects a flights remarketing purchase substituted as %s", async (wire) => {
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
        experimentalFlightsViewItem: true, experimentalRemarketingPurchase: true, experimentalPurchase: true,
        experimentalViewItemList: true, experimentalViewSearchResults: true, experimentalAddToCart: true,
      });
      try {
        adapter.gtag("event", "purchase", { items: [flight()], value: 0 });
        await vi.waitFor(() => expect(chamber.sent.some((message) => message.type === "event")).toBe(true));
        const item = {
          destination: "JFK", google_business_vertical: "flights", origin: "SFO",
          start_date: "2028-02-29", end_date: "2028-03-02",
        };
        const query = ["purchase", "conversion"].includes(wire)
          ? new URLSearchParams(wire === "purchase"
            ? { label: "SYNTHETIC_LABEL", airlock_event: "purchase", url: context.pageURL }
            : { label: "SYNTHETIC_LABEL", url: context.pageURL })
          : new URLSearchParams({ airlock_event: wire, airlock_items: JSON.stringify([item]), airlock_value: "0" });
        chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: `${endpoint}?${query}` });
        expect(await adapter.flush()).toMatchObject({ phase: "terminal", terminalReason: "request-correlation-failed" });
        expect(fetchImpl).not.toHaveBeenCalled();
      } finally { await adapter.dispose(); }
    },
  );
});
