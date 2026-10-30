import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";
import { reportGoogleAdsConversionPrototype } from "../rig/google-ads-conversion-prototype-report.mjs";

const destination = "AW-0000000000";
const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";
const context = { pageURL: "https://example.test/retail", referrer: "" };
const item = (id = 1234) => ({ id, google_business_vertical: "retail" });

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

describe("experimental Google retail view_item subset", () => {
  it("snapshots the documented input and dispatches a label-free synthetic event", async () => {
    await local({ experimentalRetailViewItem: true }, async ({ adapter, receiver }) => {
      const items = [item(), item(45678)];
      const params = { value: 998.55, items };
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", params);
      items[0].id = 2;
      items.reverse();
      params.value = 0;
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual(["configured", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      const query = new URL(receiver.arrivals[0].url).searchParams;
      expect([...query.keys()]).toEqual(["airlock_event", "airlock_items", "airlock_value"]);
      expect(query.get("airlock_event")).toBe("view_item");
      expect(JSON.parse(query.get("airlock_items"))).toEqual([item(), item(45678)]);
      expect(query.get("airlock_value")).toBe("998.55");
      expect(JSON.stringify(state)).not.toContain("1234");
    });
  }, 8000);

  it("defaults off, refuses ambiguous options and keeps the configured route explicit", async () => {
    for (const create of [createGoogleAdsPrototype, createGoogleAdsConversionPrototype]) {
      for (const value of [null, 1, "true"]) {
        expect(() => create({ endpoint, experimentalRetailViewItem: value })).toThrow("invalid-experimental-option");
      }
      expect(() => create({ endpoint, experimentalRetailViewItem: true, experimentalParameterScopes: true }))
        .toThrow("invalid-experimental-option");
      expect(() => create({ endpoint, experimentalRetailViewItem: true, experimentalRouting: true, experimentalMultiDestination: true }))
        .toThrow("invalid-experimental-option");
    }
    await local({}, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", { items: [item()] });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "rejected" });
      expect(receiver.arrivals).toEqual([]);
    });
    await local({ experimentalRetailViewItem: true }, async ({ adapter, receiver }) => {
      adapter.gtag("event", "view_item", { items: [item()] });
      adapter.gtag("config", "AW-123");
      adapter.gtag("event", "view_item", { items: [item()] });
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", { items: [item()] });
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
        "conversion-before-config", "synthetic-destination-required", "conversion-before-config",
        "configured", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("rejects malformed or mixed input without invoking accessors", async () => {
    await local({ experimentalRetailViewItem: true, experimentalPurchase: true, experimentalPurchaseCart: true },
      async ({ adapter, receiver }) => {
        const getter = vi.fn(() => 1234);
        const accessor = { google_business_vertical: "retail" };
        Object.defineProperty(accessor, "id", { get: getter, enumerable: true });
        const arrayAccessor = [];
        Object.defineProperty(arrayAccessor, "0", { get: getter, configurable: true, enumerable: true });
        const extra = [item()];
        extra.extra = true;
        const invalidItems = [
          undefined, null, [], Array(1), arrayAccessor, extra, Array.from({ length: 11 }, () => item()),
          [accessor], [{ item_id: 1234, google_business_vertical: "retail" }],
          [{ ...item(), item_id: 1234 }], [{ ...item(), price: 2 }],
          [{ id: "1234", google_business_vertical: "retail" }], [item(0)], [item(-1)], [item(1.5)],
          [item(Number.MAX_SAFE_INTEGER + 1)], [item(NaN)], [item(Infinity)],
          [{ id: 1234 }], [{ id: 1234, google_business_vertical: "travel" }],
        ];
        adapter.gtag("config", destination);
        for (const items of invalidItems) adapter.gtag("event", "view_item", { items });
        for (const value of [null, "1", -1, -0, NaN, Infinity]) {
          adapter.gtag("event", "view_item", { items: [item()], value });
        }
        for (const params of [
          { items: [item()], send_to: `${destination}/LABEL` }, { items: [item()], currency: "USD" },
          { items: [item()], transaction_id: "synthetic" }, { items: [item()], new_customer: true },
        ]) adapter.gtag("event", "view_item", params);
        adapter.gtag("event", "purchase", { send_to: `${destination}/SYNTHETIC_LABEL`, items: [item()] });
        adapter.gtag("event", "view_item", { items: [item()] }, "extra");
        const state = await adapter.flush();
        const reasons = state.outcomes.slice(1).map(({ reason }) => reason);
        expect(reasons).toEqual([
          ...invalidItems.map(() => "unsupported-items"),
          ...Array.from({ length: 6 }, () => "unsupported-value"),
          ...Array.from({ length: 4 }, () => "unsupported-parameters"),
          "unsupported-items", "argument-limit",
        ]);
        expect(receiver.arrivals).toEqual([]);
        expect(getter).not.toHaveBeenCalled();
      });
  }, 8000);

  it("checks bounds before enumeration and independently validates the worker inputs", async () => {
    let enumerations = 0;
    const oversized = new Proxy(Array(11), { ownKeys(target) { enumerations += 1; return Reflect.ownKeys(target); } });
    let reads = 0;
    const changing = new Proxy(item(), {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        return key === "id" ? { ...descriptor, value: ++reads === 1 ? 1234 : 42 } : descriptor;
      },
    });
    await local({ experimentalRetailViewItem: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", { items: oversized });
      adapter.gtag("event", "view_item", { items: [changing] });
      adapter.gtag("event", "view_item", { items: Array.from({ length: 10 }, () => item(Number.MAX_SAFE_INTEGER)), value: 0 });
      adapter.gtag("event", "view_item", { items: [item()], value: undefined });
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
        "configured", "unsupported-items", "unsupported-items", "transport-settled", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(2);
      expect(new URL(receiver.arrivals[0].url).searchParams.get("airlock_value")).toBe("0");
      expect(new URL(receiver.arrivals[1].url).searchParams.has("airlock_value")).toBe(false);
    });
    const host = createConnectorHost(createGoogleAdsConversionPrototype, { endpoint, experimentalRetailViewItem: true });
    const event = (args) => ({ type: "google-ads-command", seq: 1, ts: 0, payload: { args, context }, snapshot: {} });
    await host.init({});
    await host.routeBatch([event(["config", destination])]);
    for (const params of [
      { items: oversized }, { items: [{ item_id: 1234, google_business_vertical: "retail" }] },
      { items: [item()], value: Infinity }, { items: [item()], send_to: `${destination}/LABEL` },
    ]) {
      const result = await host.routeBatch([event(["event", "view_item", params])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped).toHaveLength(1);
    }
    expect(enumerations).toBe(0);
  }, 8000);

  it("preserves host and tag consent, drops held events and does not replay after grants", async () => {
    await local({
      experimentalRetailViewItem: true, experimentalConsentCommands: true, consent: { ad_storage: "denied" },
    }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("event", "view_item", { items: [item()] });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "held" });
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      adapter.gtag("event", "view_item", { items: [item()] });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "held" });
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "view_item", { items: [item()] });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "transport-settled" });
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("applies an admitted denial immediately to an earlier queued event", async () => {
    let receiver, chamber, adapter, cause, release, notify;
    const arrival = new Promise((resolve) => { notify = resolve; });
    try {
      receiver = await createConversionReceiver({
        respond(_request, response) { release = () => response.writeHead(204).end(); notify(); },
      });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: "granted" },
        experimentalRetailViewItem: true, experimentalConsentCommands: true,
      });
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("config", destination);
      await adapter.flush();
      adapter.gtag("event", "view_item", { items: [item()] });
      await arrival;
      adapter.gtag("event", "view_item", { items: [item(45678)] });
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

  it("routes only to the one explicitly configured endpoint and leaves conversion and purchase separate", async () => {
    let receiver, chamber, adapter, cause;
    try {
      receiver = await createConversionReceiver({ conversionId: "12345678901234567890123456789012" });
      chamber = createNodeConversionChamber();
      const target = "AW-12345678901234567890123456789012";
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: "granted" },
        experimentalRouting: true, experimentalRetailViewItem: true, experimentalPurchase: true,
        experimentalPurchaseCart: true,
      });
      adapter.gtag("config", target);
      adapter.gtag("event", "view_item", { items: [item()] });
      adapter.gtag("event", "conversion", { send_to: `${target}/CONVERSION`, value: 12 });
      adapter.gtag("event", "purchase", {
        send_to: `${target}/PURCHASE`, items: [{ id: "sku", price: 2, quantity: 3 }],
      });
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual([
        "configured", "transport-settled", "transport-settled", "transport-settled",
      ]);
      const queries = receiver.arrivals.map(({ url }) => new URL(url).searchParams);
      expect(queries.map((query) => query.get("airlock_event"))).toEqual(["view_item", null, "purchase"]);
      expect(queries.map((query) => query.get("label"))).toEqual([null, "CONVERSION", "PURCHASE"]);
      const report = reportGoogleAdsConversionPrototype({
        endpoint: receiver.endpoint, experimentalRouting: true, observedRequests: [receiver.arrivals[0]],
        commandSnapshots: [{ args: ["event", "view_item", { items: [item()] }], context }],
      });
      expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false, local: [{ relationshipsPreserved: false }] });
      expect(JSON.stringify(report)).not.toContain("1234");
    } catch (error) { cause = error; throw error; }
    finally { await closeConversionResources({ adapter, chamber, receiver, cause }); }
  }, 8000);

  it.each(["label", "wrong-items", "wrong-value", "wrong-endpoint", "extra-field", "conversion-spoof"])(
    "rejects a fake worker's %s request before transport", async (scenario) => {
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
        experimentalRetailViewItem: true,
      });
      try {
        const conversion = scenario === "conversion-spoof";
        adapter.gtag("event", conversion ? "conversion" : "view_item",
          conversion ? { send_to: `${destination}/SYNTHETIC_LABEL` } : { items: [item()], value: 2 });
        await vi.waitFor(() => expect(chamber.sent.some((message) => message.type === "event")).toBe(true));
        const query = new URLSearchParams({
          airlock_event: "view_item", airlock_items: JSON.stringify([item()]), airlock_value: "2",
        });
        if (scenario === "label") query.set("label", "FAKE");
        if (scenario === "wrong-items") query.set("airlock_items", JSON.stringify([item(42)]));
        if (scenario === "wrong-value") query.set("airlock_value", "3");
        if (scenario === "extra-field") query.set("other", "x");
        const path = scenario === "wrong-endpoint" ? "http://127.0.0.1:41234/pagead/conversion/0000000000/" : endpoint;
        chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: `${path}?${query}` });
        expect(await adapter.flush()).toMatchObject({ phase: "terminal", terminalReason: "request-correlation-failed" });
        expect(fetchImpl).not.toHaveBeenCalled();
      } finally { await adapter.dispose(); }
    },
  );
});
