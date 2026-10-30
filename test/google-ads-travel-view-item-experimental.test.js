import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";
import { reportGoogleAdsConversionPrototype } from "../rig/google-ads-conversion-prototype-report.mjs";

const destination = "AW-0000000000";
const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";
const context = { pageURL: "https://example.test/travel", referrer: "" };
const item = () => ({
  origin: "SFO", destination: "JFK", start_date: "2028-02-29", end_date: "2028-03-02",
  google_business_vertical: "travel",
});

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

describe("experimental Google travel view_item subset", () => {
  it("snapshots the documented input and dispatches a label-free synthetic event", async () => {
    await local({ experimentalTravelViewItem: true }, async ({ adapter, receiver }) => {
      const items = [item()];
      const params = { value: 123.45, items };
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", params);
      items[0].destination = "changed";
      items[0].start_date = "2030-01-01";
      params.value = 0;
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual(["configured", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      const query = new URL(receiver.arrivals[0].url).searchParams;
      expect([...query.keys()]).toEqual(["airlock_event", "airlock_items", "airlock_value"]);
      expect(query.get("airlock_event")).toBe("view_item");
      expect(JSON.parse(query.get("airlock_items"))).toEqual([item()]);
      expect(query.get("airlock_value")).toBe("123.45");
      expect(JSON.stringify(state)).not.toContain("JFK");
    });
  }, 8000);

  it("defaults off independently and rejects ambiguous options and routes", async () => {
    for (const create of [createGoogleAdsPrototype, createGoogleAdsConversionPrototype]) {
      for (const invalid of [null, 1, "true"]) {
        expect(() => create({ endpoint, experimentalTravelViewItem: invalid })).toThrow("invalid-experimental-option");
      }
      expect(() => create({ endpoint, experimentalTravelViewItem: true, experimentalParameterScopes: true })).toThrow("invalid-experimental-option");
      expect(() => create({ endpoint, experimentalTravelViewItem: true, experimentalRouting: true, experimentalMultiDestination: true }))
        .toThrow("invalid-experimental-option");
    }
    for (const options of [{}, {
      experimentalRetailViewItem: true, experimentalEducationViewItem: true,
      experimentalLocalViewItem: true, experimentalRealEstateViewItem: true,
    }]) {
      await local(options, async ({ adapter, receiver }) => {
        adapter.gtag("config", destination);
        adapter.gtag("event", "view_item", { items: [item()], value: 1 });
        expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "rejected" });
        expect(receiver.arrivals).toEqual([]);
      });
    }
    await local({ experimentalTravelViewItem: true }, async ({ adapter, receiver }) => {
      adapter.gtag("event", "view_item", { items: [item()], value: 1 });
      adapter.gtag("config", "AW-123");
      adapter.gtag("event", "view_item", { items: [item()], value: 1 });
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", { items: [{ id: "sku", google_business_vertical: "local" }], value: 1 });
      adapter.gtag("event", "view_item", { items: [item()], value: 1 });
      expect((await adapter.flush()).outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
        "conversion-before-config", "synthetic-destination-required", "conversion-before-config",
        "configured", "unsupported-items", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("accepts optional fields independently and validates calendar boundaries without ordering dates", async () => {
    await local({ experimentalTravelViewItem: true }, async ({ adapter, receiver }) => {
      const inputs = [
        { destination: "A", google_business_vertical: "travel" },
        { destination: "B", origin: "C", google_business_vertical: "travel" },
        { destination: "D", start_date: "0001-01-01", google_business_vertical: "travel" },
        { destination: "E", end_date: "9999-12-31", google_business_vertical: "travel" },
        { destination: "F", start_date: "2000-02-29", end_date: "1900-02-28", google_business_vertical: "travel" },
        { destination: "G", start_date: "2024-04-30", end_date: "2028-02-29", google_business_vertical: "travel" },
      ];
      adapter.gtag("config", destination);
      for (const input of inputs) adapter.gtag("event", "view_item", { items: [input], value: 0 });
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition))
        .toEqual(["configured", ...inputs.map(() => "transport-settled")]);
      expect(receiver.arrivals.map(({ url }) => JSON.parse(new URL(url).searchParams.get("airlock_items"))[0])).toEqual(inputs);
      expect(receiver.arrivals.every(({ url }) => new URL(url).searchParams.get("airlock_value") === "0")).toBe(true);
    });
  }, 8000);

  it("rejects invalid dates, schemas and non-data fields without invoking accessors", async () => {
    await local({
      experimentalTravelViewItem: true, experimentalRetailViewItem: true, experimentalEducationViewItem: true,
      experimentalLocalViewItem: true, experimentalRealEstateViewItem: true, queueLimit: 128,
    }, async ({ adapter, receiver }) => {
      const getter = vi.fn(() => "2028-02-29");
      const accessor = { destination: "JFK", google_business_vertical: "travel" };
      Object.defineProperty(accessor, "start_date", { get: getter, enumerable: true });
      const arrayAccessor = [];
      Object.defineProperty(arrayAccessor, "0", { get: getter, enumerable: true });
      const extra = [item()];
      extra.extra = true;
      const invalid = [
        undefined, null, [], Array(1), arrayAccessor, extra, Array.from({ length: 11 }, item), [accessor],
        [{ google_business_vertical: "travel" }], [{ ...item(), destination: "" }], [{ ...item(), destination: 1 }],
        [{ ...item(), destination: "x".repeat(129) }], [{ ...item(), destination: "\ud800" }],
        [{ ...item(), origin: "" }], [{ ...item(), origin: undefined }], [{ ...item(), origin: 1 }],
        [{ ...item(), origin: "x".repeat(129) }], [{ ...item(), origin: "\ud800" }],
        [{ ...item(), id: "sku" }], [{ ...item(), item_id: "sku" }], [{ ...item(), location_id: "SFO" }],
        [{ ...item(), price: 1 }], [{ ...item(), fbc: "synthetic" }],
        [{ ...item(), google_business_vertical: "local" }],
        [item(), { id: 1234, google_business_vertical: "retail" }],
        [item(), { id: "COURSE", google_business_vertical: "education" }],
        [item(), { id: "DEAL", google_business_vertical: "local" }],
        [item(), { id: "HOME", google_business_vertical: "real_estate" }],
      ];
      const dates = [
        undefined, null, 0, "2024-2-29", "2024-02-9", "2024-02-29Z", "0000-01-01", "2024-00-01",
        "2024-13-01", "2024-01-00", "2024-01-32", "2024-04-31", "2023-02-29", "1900-02-29",
        "2024-02-30", "2024/02/29", "2024-02-29\n", "\uff12\uff10\uff12\uff14-02-29",
      ];
      adapter.gtag("config", destination);
      for (const items of invalid) adapter.gtag("event", "view_item", { items, value: 1 });
      for (const date of dates) {
        adapter.gtag("event", "view_item", { items: [{ ...item(), start_date: date }], value: 1 });
        adapter.gtag("event", "view_item", { items: [{ ...item(), end_date: date }], value: 1 });
      }
      for (const value of [undefined, null, "1", -1, -0, NaN, Infinity]) {
        adapter.gtag("event", "view_item", { items: [item()], value });
      }
      for (const params of [
        { items: [item()], value: 1, send_to: `${destination}/LABEL` },
        { items: [item()], value: 1, currency: "USD" }, { items: [item()], value: 1, fbp: "synthetic" },
      ]) adapter.gtag("event", "view_item", params);
      expect((await adapter.flush()).outcomes.slice(1).map(({ reason }) => reason)).toEqual([
        ...invalid.map(() => "unsupported-items"), ...dates.flatMap(() => ["unsupported-items", "unsupported-items"]),
        ...Array.from({ length: 7 }, () => "unsupported-value"),
        ...Array.from({ length: 3 }, () => "unsupported-parameters"),
      ]);
      expect(receiver.arrivals).toEqual([]);
      expect(getter).not.toHaveBeenCalled();
    });
  }, 8000);

  it("bounds and revalidates nested inputs at both capture and worker boundaries", async () => {
    let enumerations = 0;
    const oversized = new Proxy(Array(11), { ownKeys(target) { enumerations += 1; return Reflect.ownKeys(target); } });
    let reads = 0;
    const changing = new Proxy(item(), {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        return key === "destination" ? { ...descriptor, value: ++reads === 1 ? "before" : "after" } : descriptor;
      },
    });
    let verticalReads = 0;
    const switching = new Proxy(item(), {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        return key === "google_business_vertical" ? { ...descriptor, value: ++verticalReads === 1 ? "travel" : "local" } : descriptor;
      },
    });
    await local({ experimentalTravelViewItem: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", { items: oversized, value: 1 });
      adapter.gtag("event", "view_item", { items: [changing], value: 1 });
      adapter.gtag("event", "view_item", { items: [switching], value: 1 });
      adapter.gtag("event", "view_item", {
        items: Array.from({ length: 10 }, () => ({ destination: "x".repeat(128), google_business_vertical: "travel" })), value: 0,
      });
      expect((await adapter.flush()).outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
        "configured", "unsupported-items", "unsupported-items", "unsupported-items", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(1);
    });
    const host = createConnectorHost(createGoogleAdsConversionPrototype, { endpoint, experimentalTravelViewItem: true });
    const event = (args) => ({ type: "google-ads-command", seq: 1, ts: 0, payload: { args, context }, snapshot: {} });
    await host.init({});
    await host.routeBatch([event(["config", destination])]);
    for (const params of [
      { items: oversized, value: 1 }, { items: [{ ...item(), start_date: "1900-02-29" }], value: 1 },
      { items: [{ ...item(), id: "sku" }], value: 1 }, { items: [item()] }, { items: [item()], value: Infinity },
      { items: [item()], value: 1, send_to: `${destination}/LABEL` },
    ]) {
      const result = await host.routeBatch([event(["event", "view_item", params])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped).toHaveLength(1);
    }
    expect(enumerations).toBe(0);
  }, 8000);

  it("isolates all five view-item verticals from conversion and purchase events", async () => {
    await local({
      experimentalRetailViewItem: true, experimentalEducationViewItem: true, experimentalLocalViewItem: true,
      experimentalRealEstateViewItem: true, experimentalTravelViewItem: true,
      experimentalRouting: true, experimentalPurchase: true, experimentalPurchaseCart: true,
    }, async ({ adapter, receiver }) => {
      const inputs = [
        { id: 1234, google_business_vertical: "retail" },
        { id: "COURSE", google_business_vertical: "education", location_id: "SFO" },
        { id: "DEAL", google_business_vertical: "local" },
        { id: "HOME", google_business_vertical: "real_estate" }, item(),
      ];
      adapter.gtag("config", destination);
      for (const [index, input] of inputs.entries()) adapter.gtag("event", "view_item", { items: [input], value: index });
      adapter.gtag("event", "conversion", { send_to: `${destination}/CONVERSION` });
      adapter.gtag("event", "purchase", { send_to: `${destination}/PURCHASE`, items: [{ id: "sku", price: 2, quantity: 1 }] });
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition))
        .toEqual(["configured", ...Array.from({ length: 7 }, () => "transport-settled")]);
      const queries = receiver.arrivals.map(({ url }) => new URL(url).searchParams);
      for (const [index, input] of inputs.entries()) {
        expect(queries[index].get("airlock_event")).toBe("view_item");
        expect(JSON.parse(queries[index].get("airlock_items"))).toEqual([input]);
        expect(queries[index].get("airlock_value")).toBe(String(index));
        expect(queries[index].has("label")).toBe(false);
      }
      expect(queries[5].get("label")).toBe("CONVERSION");
      expect(queries[5].has("airlock_items")).toBe(false);
      expect(queries[6].get("label")).toBe("PURCHASE");
      expect(JSON.parse(queries[6].get("airlock_items"))).toEqual([{ id: "sku", price: 2, quantity: 1 }]);
      const report = reportGoogleAdsConversionPrototype({
        endpoint: receiver.endpoint, observedRequests: [receiver.arrivals[4]],
        commandSnapshots: [{ args: ["event", "view_item", { items: [item()], value: 4 }], context }],
      });
      expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false, local: [{ relationshipsPreserved: false }] });
      expect(JSON.stringify(report)).not.toContain("JFK");
    });
  }, 8000);

  it("uses only the explicitly configured endpoint, not the travel destination", async () => {
    let receiver, chamber, adapter, cause;
    try {
      receiver = await createConversionReceiver({ conversionId: "12345678901234567890123456789012" });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: "granted" },
        experimentalRouting: true, experimentalTravelViewItem: true,
      });
      adapter.gtag("config", "AW-222");
      adapter.gtag("event", "view_item", { items: [item()], value: 1 });
      adapter.gtag("config", "AW-12345678901234567890123456789012");
      adapter.gtag("event", "view_item", { items: [{ ...item(), destination: "AW-222/LABEL" }], value: 1 });
      expect((await adapter.flush()).outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
        "destination-mismatch", "conversion-before-config", "configured", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(1);
      const request = new URL(receiver.arrivals[0].url);
      expect(request.origin + request.pathname).toBe(receiver.endpoint);
      expect(request.searchParams.has("label")).toBe(false);
      expect(JSON.parse(request.searchParams.get("airlock_items"))[0].destination).toBe("AW-222/LABEL");
    } catch (error) { cause = error; throw error; }
    finally { await closeConversionResources({ adapter, chamber, receiver, cause }); }
  }, 8000);

  it("enforces the URL ceiling and snapshots dataLayer inputs when drained", async () => {
    await local({ experimentalTravelViewItem: true, experimentalDataLayer: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", {
        items: Array.from({ length: 10 }, () => ({ destination: "\u0800".repeat(128), google_business_vertical: "travel" })), value: 1,
      });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "rejected", reason: "encoded-context-limit" });
      expect(receiver.arrivals).toEqual([]);
      const push = (...args) => (function () { return arguments; })(...args);
      const params = { items: [item()], value: 2 };
      const layer = [push("event", "view_item", params)];
      params.items[0].destination = "captured";
      adapter.drainDataLayer(layer);
      params.items[0].destination = "later";
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "transport-settled" });
      expect(JSON.parse(new URL(receiver.arrivals[0].url).searchParams.get("airlock_items"))[0].destination).toBe("captured");
      adapter.drainDataLayer(layer);
      await adapter.flush();
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("applies host and tag denials without replay", async () => {
    await local({
      experimentalTravelViewItem: true, experimentalConsentCommands: true, consent: { ad_storage: "denied" },
    }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("event", "view_item", { items: [item()], value: 1 });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "held" });
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      adapter.gtag("event", "view_item", { items: [item()], value: 1 });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "held" });
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "view_item", { items: [item()], value: 1 });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "transport-settled" });
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("immediately applies an admitted denial to queued travel work", async () => {
    let receiver, chamber, adapter, cause, release, notify;
    const arrival = new Promise((resolve) => { notify = resolve; });
    try {
      receiver = await createConversionReceiver({
        respond(_request, response) { release = () => response.writeHead(204).end(); notify(); },
      });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: "granted" },
        experimentalTravelViewItem: true, experimentalConsentCommands: true,
      });
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("config", destination);
      await adapter.flush();
      adapter.gtag("event", "view_item", { items: [item()], value: 1 });
      await arrival;
      adapter.gtag("event", "view_item", { items: [{ ...item(), destination: "second" }], value: 2 });
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      release();
      release = undefined;
      expect((await adapter.flush()).outcomes.slice(-3).map(({ disposition }) => disposition))
        .toEqual(["transport-settled", "held", "consent-updated"]);
      expect(receiver.arrivals).toHaveLength(1);
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toHaveLength(1);
    } catch (error) { cause = error; throw error; }
    finally { release?.(); await closeConversionResources({ adapter, chamber, receiver, cause }); }
  }, 8000);

  it.each(["valid", "other-vertical", "wrong-destination", "wrong-date", "label", "wrong-endpoint", "conversion-spoof"])(
    "correlates a fake worker's %s request", async (scenario) => {
      let listener;
      const chamber = {
        sent: [],
        postMessage(message) {
          this.sent.push(message);
          if (message.type === "init") queueMicrotask(() => listener?.({ type: "phase", name: "configured" }));
          if (message.type === "intercepted-fetch-response") queueMicrotask(() => listener?.({
            type: "result", summary: { seq: 1, disposition: "transport-settled", requests: 1, status: 204 }, ready: [],
          }));
        },
        onMessage(callback) { listener = callback; return () => { listener = undefined; }; },
        onError() { return () => {}; },
        emit(message) { listener?.(message); },
        dispose() {},
      };
      const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
      const adapter = createGoogleAdsPrototype({
        endpoint, chamber, fetchImpl, captureContext: () => context, consent: { ad_storage: "granted" },
        experimentalTravelViewItem: true, experimentalLocalViewItem: true,
      });
      try {
        const conversion = scenario === "conversion-spoof";
        adapter.gtag("event", conversion ? "conversion" : "view_item",
          conversion ? { send_to: `${destination}/SYNTHETIC_LABEL` } : { items: [item()], value: 2 });
        await vi.waitFor(() => expect(chamber.sent.some((message) => message.type === "event")).toBe(true));
        const actual = scenario === "other-vertical" ? { id: "sku", google_business_vertical: "local" } : {
          destination: "JFK", google_business_vertical: "travel", origin: "SFO", start_date: "2028-02-29", end_date: "2028-03-02",
        };
        if (scenario === "wrong-destination") actual.destination = "BOS";
        if (scenario === "wrong-date") actual.start_date = "2028-03-01";
        const query = new URLSearchParams({
          airlock_event: "view_item", airlock_items: JSON.stringify([actual]), airlock_value: "2",
        });
        if (scenario === "label") query.set("label", "FAKE");
        const path = scenario === "wrong-endpoint" ? "http://127.0.0.1:41234/pagead/conversion/0000000000/" : endpoint;
        chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: `${path}?${query}` });
        const state = await adapter.flush();
        if (scenario === "valid") {
          expect(state.outcomes.at(-1)).toMatchObject({ disposition: "transport-settled" });
          expect(fetchImpl).toHaveBeenCalledOnce();
        } else {
          expect(state).toMatchObject({ phase: "terminal", terminalReason: "request-correlation-failed" });
          expect(fetchImpl).not.toHaveBeenCalled();
        }
      } finally { await adapter.dispose(); }
    },
  );
});
