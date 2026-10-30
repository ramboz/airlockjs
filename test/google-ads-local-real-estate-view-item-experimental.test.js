import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";
import { reportGoogleAdsConversionPrototype } from "../rig/google-ads-conversion-prototype-report.mjs";

const destination = "AW-0000000000";
const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";
const context = { pageURL: "https://example.test/remarketing", referrer: "" };
const item = (vertical, id = "synthetic-id") => ({ id, google_business_vertical: vertical });
const variants = [
  { vertical: "local", option: "experimentalLocalViewItem" },
  { vertical: "real_estate", option: "experimentalRealEstateViewItem" },
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

describe("experimental Google local and real estate view_item subsets", () => {
  it.each(variants)("snapshots and sends a label-free synthetic $vertical event", async ({ vertical, option }) => {
    await local({ [option]: true }, async ({ adapter, receiver }) => {
      const items = [item(vertical)];
      const params = { value: 10.5, items };
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", params);
      items[0].id = "changed";
      params.value = 0;
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual(["configured", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      const query = new URL(receiver.arrivals[0].url).searchParams;
      expect([...query.keys()]).toEqual(["airlock_event", "airlock_items", "airlock_value"]);
      expect(query.get("airlock_event")).toBe("view_item");
      expect(JSON.parse(query.get("airlock_items"))).toEqual([item(vertical)]);
      expect(query.get("airlock_value")).toBe("10.5");
      expect(JSON.stringify(state)).not.toContain("synthetic-id");
    });
  }, 8000);

  it.each(variants)("keeps $vertical independently default-off and rejects ambiguous options", async ({ vertical, option }) => {
    for (const create of [createGoogleAdsPrototype, createGoogleAdsConversionPrototype]) {
      for (const invalid of [null, 1, "true"]) {
        expect(() => create({ endpoint, [option]: invalid })).toThrow("invalid-experimental-option");
      }
      expect(() => create({ endpoint, [option]: true, experimentalParameterScopes: true })).toThrow("invalid-experimental-option");
      expect(() => create({ endpoint, [option]: true, experimentalRouting: true, experimentalMultiDestination: true }))
        .toThrow("invalid-experimental-option");
    }
    const other = variants.find((variant) => variant.option !== option);
    for (const options of [{}, { [other.option]: true }, { experimentalRetailViewItem: true }, { experimentalEducationViewItem: true }]) {
      await local(options, async ({ adapter, receiver }) => {
        adapter.gtag("config", destination);
        adapter.gtag("event", "view_item", { items: [item(vertical)], value: 1 });
        expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "rejected" });
        expect(receiver.arrivals).toEqual([]);
      });
    }
    await local({ [option]: true }, async ({ adapter, receiver }) => {
      adapter.gtag("event", "view_item", { items: [item(vertical)], value: 1 });
      adapter.gtag("config", "AW-123");
      adapter.gtag("event", "view_item", { items: [item(vertical)], value: 1 });
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", { items: [item(other.vertical)], value: 1 });
      adapter.gtag("event", "view_item", { items: [item(vertical)], value: 1 });
      expect((await adapter.flush()).outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
        "conversion-before-config", "synthetic-destination-required", "conversion-before-config",
        "configured", "unsupported-items", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("isolates four enabled verticals and conversion/purchase in consecutive events", async () => {
    await local({
      experimentalRetailViewItem: true, experimentalEducationViewItem: true,
      experimentalLocalViewItem: true, experimentalRealEstateViewItem: true,
      experimentalRouting: true, experimentalPurchase: true, experimentalPurchaseCart: true,
    }, async ({ adapter, receiver }) => {
      const inputs = [
        { id: 1234, google_business_vertical: "retail" },
        { id: "COURSE", google_business_vertical: "education", location_id: "SFO" },
        item("local", "LOCAL"), item("real_estate", "HOME"),
      ];
      adapter.gtag("config", destination);
      for (const [index, input] of inputs.entries()) adapter.gtag("event", "view_item", { items: [input], value: index });
      adapter.gtag("event", "conversion", { send_to: `${destination}/CONVERSION` });
      adapter.gtag("event", "purchase", { send_to: `${destination}/PURCHASE`, items: [{ id: "sku", price: 2, quantity: 1 }] });
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition))
        .toEqual(["configured", ...Array.from({ length: 6 }, () => "transport-settled")]);
      const queries = receiver.arrivals.map(({ url }) => new URL(url).searchParams);
      for (const [index, input] of inputs.entries()) {
        expect(queries[index].get("airlock_event")).toBe("view_item");
        expect(JSON.parse(queries[index].get("airlock_items"))).toEqual([input]);
        expect(queries[index].get("airlock_value")).toBe(String(index));
        expect(queries[index].has("label")).toBe(false);
      }
      expect(queries[4].get("label")).toBe("CONVERSION");
      expect(queries[4].has("airlock_items")).toBe(false);
      expect(queries[5].get("label")).toBe("PURCHASE");
      expect(JSON.parse(queries[5].get("airlock_items"))).toEqual([{ id: "sku", price: 2, quantity: 1 }]);
      for (const [index, input] of inputs.entries()) {
        const report = reportGoogleAdsConversionPrototype({
          endpoint: receiver.endpoint, observedRequests: [receiver.arrivals[index]],
          commandSnapshots: [{ args: ["event", "view_item", { items: [input], value: index }], context }],
        });
        expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false, local: [{ relationshipsPreserved: false }] });
        expect(JSON.stringify(report)).not.toContain("LOCAL");
      }
    });
  }, 8000);

  it.each(variants)("uses only the explicitly configured destination for $vertical", async ({ vertical, option }) => {
    let receiver, chamber, adapter, cause;
    try {
      receiver = await createConversionReceiver({ conversionId: "12345678901234567890123456789012" });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: "granted" },
        experimentalRouting: true, [option]: true,
      });
      adapter.gtag("config", "AW-222");
      adapter.gtag("event", "view_item", { items: [item(vertical)], value: 1 });
      adapter.gtag("config", "AW-12345678901234567890123456789012");
      adapter.gtag("event", "view_item", { items: [item(vertical)], value: 1 });
      expect((await adapter.flush()).outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
        "destination-mismatch", "conversion-before-config", "configured", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(1);
      const request = new URL(receiver.arrivals[0].url);
      expect(request.origin + request.pathname).toBe(receiver.endpoint);
      expect(request.searchParams.has("label")).toBe(false);
    } catch (error) { cause = error; throw error; }
    finally { await closeConversionResources({ adapter, chamber, receiver, cause }); }
  }, 8000);

  it.each(variants)("rejects malformed, mixed and unsupported $vertical fields", async ({ vertical, option }) => {
    await local({
      [option]: true, experimentalRetailViewItem: true, experimentalEducationViewItem: true,
      experimentalLocalViewItem: true, experimentalRealEstateViewItem: true, queueLimit: 64,
    }, async ({ adapter, receiver }) => {
      const getter = vi.fn(() => "x");
      const accessor = { google_business_vertical: vertical };
      Object.defineProperty(accessor, "id", { get: getter, enumerable: true });
      const extra = [item(vertical)];
      extra.extra = true;
      const invalid = [
        undefined, null, [], Array(1), extra, Array.from({ length: 11 }, () => item(vertical)), [accessor],
        [item(vertical, "")], [item(vertical, "x".repeat(129))], [item(vertical, "\ud800")],
        [item(vertical, 1234)], [item(vertical, null)], [{ google_business_vertical: vertical }],
        [{ item_id: "sku", google_business_vertical: vertical }], [{ ...item(vertical), item_id: "sku" }],
        [{ ...item(vertical), price: 2 }], [{ ...item(vertical), location_id: "SFO" }],
        [{ ...item(vertical), fbc: "synthetic" }],
        [item(vertical), item(vertical === "local" ? "real_estate" : "local")],
        [item(vertical), { id: "COURSE", google_business_vertical: "education" }],
        [item(vertical), { id: 1234, google_business_vertical: "retail" }],
      ];
      adapter.gtag("config", destination);
      for (const items of invalid) adapter.gtag("event", "view_item", { items, value: 1 });
      for (const value of [undefined, null, "1", -1, -0, NaN, Infinity]) {
        adapter.gtag("event", "view_item", { items: [item(vertical)], value });
      }
      for (const params of [
        { items: [item(vertical)], value: 1, send_to: `${destination}/LABEL` },
        { items: [item(vertical)], value: 1, currency: "USD" },
        { items: [item(vertical)], value: 1, fbp: "synthetic" },
      ]) adapter.gtag("event", "view_item", params);
      expect((await adapter.flush()).outcomes.slice(1).map(({ reason }) => reason)).toEqual([
        ...invalid.map(() => "unsupported-items"),
        ...Array.from({ length: 7 }, () => "unsupported-value"),
        ...Array.from({ length: 3 }, () => "unsupported-parameters"),
      ]);
      expect(receiver.arrivals).toEqual([]);
      expect(getter).not.toHaveBeenCalled();
    });
  }, 8000);

  it.each(variants)("bounds and independently revalidates $vertical item snapshots", async ({ vertical, option }) => {
    let enumerations = 0;
    const oversized = new Proxy(Array(11), { ownKeys(target) { enumerations += 1; return Reflect.ownKeys(target); } });
    let reads = 0;
    const changing = new Proxy(item(vertical), {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        return key === "id" ? { ...descriptor, value: ++reads === 1 ? "before" : "after" } : descriptor;
      },
    });
    await local({ [option]: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", { items: oversized, value: 1 });
      adapter.gtag("event", "view_item", { items: [changing], value: 1 });
      adapter.gtag("event", "view_item", { items: Array.from({ length: 10 }, () => item(vertical, "x".repeat(128))), value: 0 });
      expect((await adapter.flush()).outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
        "configured", "unsupported-items", "unsupported-items", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(1);
      expect(new URL(receiver.arrivals[0].url).searchParams.get("airlock_value")).toBe("0");
    });
    const host = createConnectorHost(createGoogleAdsConversionPrototype, { endpoint, [option]: true });
    const event = (args) => ({ type: "google-ads-command", seq: 1, ts: 0, payload: { args, context }, snapshot: {} });
    await host.init({});
    await host.routeBatch([event(["config", destination])]);
    for (const params of [
      { items: oversized, value: 1 }, { items: [{ ...item(vertical), location_id: "SFO" }], value: 1 },
      { items: [item(vertical)] }, { items: [item(vertical)], value: Infinity },
      { items: [item(vertical)], value: 1, send_to: `${destination}/LABEL` },
    ]) {
      const result = await host.routeBatch([event(["event", "view_item", params])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped).toHaveLength(1);
    }
    expect(enumerations).toBe(0);
  }, 8000);

  it.each(variants)("applies host and tag denials to $vertical without replay", async ({ vertical, option }) => {
    await local({
      [option]: true, experimentalConsentCommands: true, consent: { ad_storage: "denied" },
    }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("event", "view_item", { items: [item(vertical)], value: 1 });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "held" });
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      adapter.gtag("event", "view_item", { items: [item(vertical)], value: 1 });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "held" });
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "view_item", { items: [item(vertical)], value: 1 });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "transport-settled" });
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it.each(variants)("immediately applies an admitted denial to queued $vertical work", async ({ vertical, option }) => {
    let receiver, chamber, adapter, cause, release, notify;
    const arrival = new Promise((resolve) => { notify = resolve; });
    try {
      receiver = await createConversionReceiver({
        respond(_request, response) { release = () => response.writeHead(204).end(); notify(); },
      });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: "granted" },
        [option]: true, experimentalConsentCommands: true,
      });
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("config", destination);
      await adapter.flush();
      adapter.gtag("event", "view_item", { items: [item(vertical)], value: 1 });
      await arrival;
      adapter.gtag("event", "view_item", { items: [item(vertical, "second")], value: 2 });
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

  it.each(variants)("enforces the URL ceiling and dataLayer snapshot for $vertical", async ({ vertical, option }) => {
    await local({ [option]: true, experimentalDataLayer: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", {
        items: Array.from({ length: 10 }, () => item(vertical, "\u0800".repeat(128))), value: 1,
      });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "rejected", reason: "encoded-context-limit" });
      expect(receiver.arrivals).toEqual([]);
      const push = (...args) => (function () { return arguments; })(...args);
      const params = { items: [item(vertical)], value: 2 };
      const layer = [push("event", "view_item", params)];
      params.items[0].id = "captured";
      adapter.drainDataLayer(layer);
      params.items[0].id = "later";
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "transport-settled" });
      expect(JSON.parse(new URL(receiver.arrivals[0].url).searchParams.get("airlock_items"))).toEqual([item(vertical, "captured")]);
      adapter.drainDataLayer(layer);
      await adapter.flush();
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it.each(variants.flatMap((variant) => ["valid", "other-vertical", "wrong-id", "label", "wrong-endpoint", "conversion-spoof"]
    .map((scenario) => ({ ...variant, scenario }))))(
    "correlates $vertical fake-worker $scenario", async ({ vertical, option, scenario }) => {
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
        experimentalLocalViewItem: true, experimentalRealEstateViewItem: true, [option]: true,
      });
      try {
        const conversion = scenario === "conversion-spoof";
        adapter.gtag("event", conversion ? "conversion" : "view_item",
          conversion ? { send_to: `${destination}/SYNTHETIC_LABEL` } : { items: [item(vertical)], value: 2 });
        await vi.waitFor(() => expect(chamber.sent.some((message) => message.type === "event")).toBe(true));
        const actualVertical = scenario === "other-vertical" ? (vertical === "local" ? "real_estate" : "local") : vertical;
        const actualId = scenario === "wrong-id" ? "changed" : "synthetic-id";
        const query = new URLSearchParams({
          airlock_event: "view_item", airlock_items: JSON.stringify([item(actualVertical, actualId)]), airlock_value: "2",
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
