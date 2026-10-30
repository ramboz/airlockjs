import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";
import { reportGoogleAdsConversionPrototype } from "../rig/google-ads-conversion-prototype-report.mjs";

const destination = "AW-0000000000";
const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";
const context = { pageURL: "https://example.test/education", referrer: "" };
const education = () => ({ id: "CS75", location_id: "SFO", google_business_vertical: "education" });
const retail = () => ({ id: 1234, google_business_vertical: "retail" });

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

describe("experimental Google education view_item subset", () => {
  it("snapshots the documented input and dispatches a label-free synthetic event", async () => {
    await local({ experimentalEducationViewItem: true }, async ({ adapter, receiver }) => {
      const items = [education()];
      const params = { value: 998.55, items };
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", params);
      items[0].id = "changed";
      items[0].location_id = "changed";
      params.value = 0;
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual(["configured", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      const query = new URL(receiver.arrivals[0].url).searchParams;
      expect([...query.keys()]).toEqual(["airlock_event", "airlock_items", "airlock_value"]);
      expect(query.get("airlock_event")).toBe("view_item");
      expect(JSON.parse(query.get("airlock_items"))).toEqual([education()]);
      expect(query.get("airlock_value")).toBe("998.55");
      expect(JSON.stringify(state)).not.toContain("CS75");
    });
  }, 8000);

  it("defaults off independently and rejects ambiguous configuration", async () => {
    for (const create of [createGoogleAdsPrototype, createGoogleAdsConversionPrototype]) {
      for (const value of [null, 1, "true"]) {
        expect(() => create({ endpoint, experimentalEducationViewItem: value })).toThrow("invalid-experimental-option");
      }
      expect(() => create({ endpoint, experimentalEducationViewItem: true, experimentalParameterScopes: true }))
        .toThrow("invalid-experimental-option");
      expect(() => create({ endpoint, experimentalEducationViewItem: true, experimentalRouting: true, experimentalMultiDestination: true }))
        .toThrow("invalid-experimental-option");
    }
    for (const options of [{}, { experimentalRetailViewItem: true }]) {
      await local(options, async ({ adapter, receiver }) => {
        adapter.gtag("config", destination);
        adapter.gtag("event", "view_item", { items: [education()], value: 1 });
        expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "rejected" });
        expect(receiver.arrivals).toEqual([]);
      });
    }
    await local({ experimentalEducationViewItem: true }, async ({ adapter, receiver }) => {
      adapter.gtag("event", "view_item", { items: [education()] });
      adapter.gtag("config", "AW-123");
      adapter.gtag("event", "view_item", { items: [education()] });
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", { items: [retail()] });
      adapter.gtag("event", "view_item", { items: [education()], value: 1 });
      expect((await adapter.flush()).outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
        "conversion-before-config", "synthetic-destination-required", "conversion-before-config",
        "configured", "unsupported-items", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("keeps consecutive education, retail, conversion and purchase events separate", async () => {
    await local({
      experimentalEducationViewItem: true, experimentalRetailViewItem: true,
      experimentalPurchase: true, experimentalPurchaseCart: true, experimentalRouting: true,
    }, async ({ adapter, receiver }) => {
      const noLocation = { id: "MATH1", google_business_vertical: "education" };
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", { items: [education()], value: 1 });
      adapter.gtag("event", "view_item", { items: [retail()], value: 2 });
      adapter.gtag("event", "view_item", { items: [noLocation], value: 3 });
      adapter.gtag("event", "conversion", { send_to: `${destination}/CONVERSION` });
      adapter.gtag("event", "purchase", {
        send_to: `${destination}/PURCHASE`, items: [{ id: "sku", price: 2, quantity: 1 }],
      });
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual([
        "configured", "transport-settled", "transport-settled", "transport-settled", "transport-settled", "transport-settled",
      ]);
      const queries = receiver.arrivals.map(({ url }) => new URL(url).searchParams);
      expect(queries.map((query) => query.get("airlock_event"))).toEqual(["view_item", "view_item", "view_item", null, "purchase"]);
      expect(queries.map((query) => query.get("label"))).toEqual([null, null, null, "CONVERSION", "PURCHASE"]);
      expect(JSON.parse(queries[0].get("airlock_items"))).toEqual([education()]);
      expect(JSON.parse(queries[1].get("airlock_items"))).toEqual([retail()]);
      expect(JSON.parse(queries[2].get("airlock_items"))).toEqual([noLocation]);
      expect(queries[2].get("airlock_value")).toBe("3");
      expect([...queries[3].keys()]).not.toContain("airlock_items");
      expect(JSON.parse(queries[4].get("airlock_items"))).toEqual([{ id: "sku", price: 2, quantity: 1 }]);
      const report = reportGoogleAdsConversionPrototype({
        endpoint: receiver.endpoint, observedRequests: [receiver.arrivals[0]],
        commandSnapshots: [{ args: ["event", "view_item", { items: [education()] }], context }],
      });
      expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false, local: [{ relationshipsPreserved: false }] });
      expect(JSON.stringify(report)).not.toContain("CS75");
    });
  }, 8000);

  it("uses only the explicitly configured synthetic destination", async () => {
    let receiver, chamber, adapter, cause;
    try {
      receiver = await createConversionReceiver({ conversionId: "12345678901234567890123456789012" });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: "granted" },
        experimentalRouting: true, experimentalEducationViewItem: true,
      });
      adapter.gtag("config", "AW-222");
      adapter.gtag("event", "view_item", { items: [education()], value: 1 });
      adapter.gtag("config", "AW-12345678901234567890123456789012");
      adapter.gtag("event", "view_item", { items: [education()], value: 1 });
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

  it("rejects mixed, ambiguous and malformed education items without invoking accessors", async () => {
    await local({ experimentalEducationViewItem: true, experimentalRetailViewItem: true, queueLimit: 64 }, async ({ adapter, receiver }) => {
      const getter = vi.fn(() => "SFO");
      const accessor = { id: "CS75", google_business_vertical: "education" };
      Object.defineProperty(accessor, "location_id", { get: getter, enumerable: true });
      const arrayAccessor = [];
      Object.defineProperty(arrayAccessor, "0", { get: getter, enumerable: true });
      const extra = [education()];
      extra.extra = true;
      const invalid = [
        undefined, null, [], Array(1), arrayAccessor, extra, Array.from({ length: 11 }, education),
        [retail(), education()], [education(), retail()], [accessor],
        [{ item_id: "CS75", google_business_vertical: "education" }],
        [{ ...education(), item_id: "CS75" }], [{ ...education(), price: 1 }], [{ ...education(), fbc: "synthetic" }],
        [{ ...education(), id: 1234 }], [{ ...education(), id: "" }], [{ ...education(), id: "x".repeat(129) }],
        [{ ...education(), id: "\ud800" }], [{ ...education(), location_id: "" }],
        [{ ...education(), location_id: undefined }], [{ ...education(), location_id: null }],
        [{ ...education(), location_id: 123 }], [{ ...education(), location_id: "x".repeat(129) }],
        [{ ...education(), location_id: "\ud800" }], [{ id: "CS75" }],
        [{ ...education(), google_business_vertical: "travel" }],
      ];
      adapter.gtag("config", destination);
      for (const items of invalid) adapter.gtag("event", "view_item", { items });
      for (const params of [
        { items: [education()], send_to: `${destination}/LABEL` }, { items: [education()], currency: "USD" },
        { items: [education()], new_customer: true }, { items: [education()], fbp: "synthetic" },
      ]) adapter.gtag("event", "view_item", params);
      for (const value of [undefined, null, "1", -1, -0, NaN, Infinity]) {
        adapter.gtag("event", "view_item", { items: [education()], value });
      }
      const state = await adapter.flush();
      expect(state.outcomes.slice(1).map(({ reason }) => reason)).toEqual([
        ...invalid.map(() => "unsupported-items"), ...Array.from({ length: 4 }, () => "unsupported-parameters"),
        ...Array.from({ length: 7 }, () => "unsupported-value"),
      ]);
      expect(receiver.arrivals).toEqual([]);
      expect(getter).not.toHaveBeenCalled();
    });
  }, 8000);

  it("bounds and revalidates education items at both capture and worker boundaries", async () => {
    let enumerations = 0;
    const oversized = new Proxy(Array(11), { ownKeys(target) { enumerations += 1; return Reflect.ownKeys(target); } });
    let reads = 0;
    const changing = new Proxy(education(), {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        return key === "location_id" ? { ...descriptor, value: ++reads === 1 ? "SFO" : 42 } : descriptor;
      },
    });
    await local({ experimentalEducationViewItem: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", { items: oversized });
      adapter.gtag("event", "view_item", { items: [changing] });
      adapter.gtag("event", "view_item", { items: [education()] });
      adapter.gtag("event", "view_item", {
        items: Array.from({ length: 10 }, () => ({ id: "x".repeat(128), google_business_vertical: "education" })), value: 0,
      });
      adapter.gtag("event", "view_item", { items: [{ id: "y".repeat(128), location_id: "z".repeat(128), google_business_vertical: "education" }], value: 1 });
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
        "configured", "unsupported-items", "unsupported-items", "unsupported-value", "transport-settled", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(2);
      expect(new URL(receiver.arrivals[0].url).searchParams.get("airlock_value")).toBe("0");
    });
    const host = createConnectorHost(createGoogleAdsConversionPrototype, {
      endpoint, experimentalEducationViewItem: true, experimentalRetailViewItem: true,
    });
    const event = (args) => ({ type: "google-ads-command", seq: 1, ts: 0, payload: { args, context }, snapshot: {} });
    await host.init({});
    await host.routeBatch([event(["config", destination])]);
    for (const params of [
      { items: oversized }, { items: [education(), retail()] }, { items: [{ ...education(), location_id: null }] },
      { items: [education()] }, { items: [education()], value: Infinity }, { items: [education()], send_to: `${destination}/LABEL` },
    ]) {
      const result = await host.routeBatch([event(["event", "view_item", params])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped).toHaveLength(1);
    }
    expect(enumerations).toBe(0);
  }, 8000);

  it("refuses an encoded URL above the loopback ceiling without sending", async () => {
    await local({ experimentalEducationViewItem: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", {
        items: Array.from({ length: 10 }, () => ({ id: "\u0800".repeat(128), google_business_vertical: "education" })), value: 1,
      });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "rejected", reason: "encoded-context-limit" });
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "view_item", { items: [education()], value: 1 });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "transport-settled" });
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("captures education fields at dataLayer drain time without draining them twice", async () => {
    await local({ experimentalEducationViewItem: true, experimentalDataLayer: true }, async ({ adapter, receiver }) => {
      const push = (...args) => (function () { return arguments; })(...args);
      const params = { items: [education()], value: 1 };
      const layer = [push("config", destination), push("event", "view_item", params)];
      params.items[0].location_id = "BOS";
      adapter.drainDataLayer(layer);
      params.items[0].location_id = "SEA";
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "transport-settled" });
      expect(JSON.parse(new URL(receiver.arrivals[0].url).searchParams.get("airlock_items"))[0].location_id).toBe("BOS");
      adapter.drainDataLayer(layer);
      await adapter.flush();
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("preserves the independent host and tag seals and never replays held education events", async () => {
    await local({
      experimentalEducationViewItem: true, experimentalConsentCommands: true, consent: { ad_storage: "denied" },
    }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("event", "view_item", { items: [education()], value: 1 });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "held" });
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      adapter.gtag("event", "view_item", { items: [education()], value: 1 });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "held" });
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "view_item", { items: [education()], value: 1 });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "transport-settled" });
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("applies an admitted denial immediately to an earlier queued education event", async () => {
    let receiver, chamber, adapter, cause, release, notify;
    const arrival = new Promise((resolve) => { notify = resolve; });
    try {
      receiver = await createConversionReceiver({
        respond(_request, response) { release = () => response.writeHead(204).end(); notify(); },
      });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: "granted" },
        experimentalEducationViewItem: true, experimentalConsentCommands: true,
      });
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("config", destination);
      await adapter.flush();
      adapter.gtag("event", "view_item", { items: [education()], value: 1 });
      await arrival;
      adapter.gtag("event", "view_item", { items: [{ id: "MATH1", google_business_vertical: "education" }], value: 1 });
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

  it.each(["valid", "retail-substitution", "wrong-location", "label", "wrong-endpoint", "conversion-spoof"])(
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
        experimentalEducationViewItem: true, experimentalRetailViewItem: true,
      });
      try {
        const conversion = scenario === "conversion-spoof";
        adapter.gtag("event", conversion ? "conversion" : "view_item",
          conversion ? { send_to: `${destination}/SYNTHETIC_LABEL` } : { items: [education()], value: 2 });
        await vi.waitFor(() => expect(chamber.sent.some((message) => message.type === "event")).toBe(true));
        const items = scenario === "retail-substitution"
          ? [retail()] : [{ id: "CS75", google_business_vertical: "education", location_id: "SFO" }];
        if (scenario === "wrong-location") items[0].location_id = "BOS";
        const query = new URLSearchParams({
          airlock_event: "view_item", airlock_items: JSON.stringify(items), airlock_value: "2",
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
