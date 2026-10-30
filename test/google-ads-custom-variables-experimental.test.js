import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";
import { reportGoogleAdsConversionPrototype } from "../rig/google-ads-conversion-prototype-report.mjs";

const destination = "AW-0000000000";
const sendTo = `${destination}/SYNTHETIC_LABEL`;
const context = { pageURL: "https://example.test/variables", referrer: "" };
const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";

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

describe("experimental Google conversion custom variables", () => {
  it("snapshots the three documented example fields through the worker to loopback", async () => {
    await local({ experimentalCustomVariables: true }, async ({ adapter, receiver }) => {
      const params = {
        send_to: sendTo, example_variable: "synthetic-a", color: "blue", product_name: "synthetic-product",
      };
      adapter.gtag("config", destination);
      adapter.gtag("event", "conversion", params);
      Object.assign(params, { example_variable: "changed", color: "red", product_name: "changed" });
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual(["configured", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      const query = new URL(receiver.arrivals[0].url).searchParams;
      expect(query.getAll("airlock_custom_example_variable")).toEqual(["synthetic-a"]);
      expect(query.getAll("airlock_custom_color")).toEqual(["blue"]);
      expect(query.getAll("airlock_custom_product_name")).toEqual(["synthetic-product"]);
      expect(JSON.stringify(state)).not.toContain("synthetic-product");
      const report = reportGoogleAdsConversionPrototype({
        endpoint: receiver.endpoint, observedRequests: receiver.arrivals,
        commandSnapshots: [{ args: ["event", "conversion", { send_to: sendTo, color: "blue" }], context }],
      });
      expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false, local: [{ relationshipsPreserved: false }] });
      expect(JSON.stringify(report)).not.toContain("synthetic-product");
    });
  }, 8000);

  it("defaults off and rejects invalid flag types at both entry points", async () => {
    for (const factory of [createGoogleAdsPrototype, createGoogleAdsConversionPrototype]) {
      for (const invalid of ["true", null, 1]) {
        expect(() => factory({ endpoint, experimentalCustomVariables: invalid })).toThrow("invalid-experimental-option");
      }
    }
    await local({}, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "conversion", { send_to: sendTo, color: "blue" });
      adapter.gtag("event", "conversion", { send_to: sendTo });
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition, reason }) => reason || disposition))
        .toEqual(["configured", "unsupported-parameters", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      expect(new URL(receiver.arrivals[0].url).searchParams.has("airlock_custom_color")).toBe(false);
    });
  }, 8000);

  it("preserves empty, Unicode and 100-code-unit values while omitting absent or undefined values", async () => {
    await local({ experimentalCustomVariables: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      for (const fields of [
        { color: "" }, { color: "a".repeat(100) }, { color: "\u00e9&=\"\ud83d\ude00" },
        { color: undefined }, {},
      ]) adapter.gtag("event", "conversion", { send_to: sendTo, ...fields });
      const state = await adapter.flush();
      expect(state.outcomes.slice(1).every(({ disposition }) => disposition === "transport-settled")).toBe(true);
      expect(receiver.arrivals.map(({ url }) => new URL(url).searchParams.getAll("airlock_custom_color")))
        .toEqual([[""], ["a".repeat(100)], ["\u00e9&=\"\ud83d\ude00"], [], []]);
    });
  }, 8000);

  it("rejects unknown, reserved, purchase-only, scoped and accessor fields rather than treating them as custom", async () => {
    await local({
      experimentalCustomVariables: true, experimentalPurchase: true, experimentalPurchaseCart: true,
      experimentalPurchaseDiscount: true, experimentalPurchaseFeed: true, experimentalParameterScopes: true,
    }, async ({ adapter, receiver }) => {
      const getter = vi.fn(() => "blue");
      const accessor = { send_to: sendTo };
      Object.defineProperty(accessor, "color", { enumerable: true, get: getter });
      const protoKey = Object.assign(Object.create(null), { send_to: sendTo });
      Object.defineProperty(protoKey, "__proto__", { value: "synthetic", enumerable: true });
      adapter.gtag("set", { color: "blue" });
      adapter.gtag("config", destination, { product_name: "synthetic" });
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", { send_to: sendTo, color: "blue" });
      adapter.gtag("event", "conversion", { send_to: sendTo, other_variable: "synthetic" });
      adapter.gtag("event", "conversion", { send_to: sendTo, discount: 1 });
      adapter.gtag("event", "conversion", { send_to: sendTo, aw_merchant_id: 98765 });
      adapter.gtag("event", "conversion", { send_to: sendTo, new_customer: true });
      adapter.gtag("event", "conversion", { send_to: sendTo, items: [{ id: "sku", price: 1, quantity: 1 }] });
      adapter.gtag("event", "conversion", { send_to: sendTo, event_timeout: "synthetic" });
      adapter.gtag("event", "conversion", protoKey);
      adapter.gtag("event", "conversion", accessor);
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
        "unsupported-parameters", "unsupported-parameters", "configured", "unsupported-parameters",
        "unsupported-parameters", "unsupported-parameters", "unsupported-parameters", "unsupported-parameters",
        "unsupported-parameters", "unsupported-parameters", "unsupported-parameters", "unsupported-parameters",
      ]);
      expect(getter).not.toHaveBeenCalled();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "purchase", { send_to: sendTo, new_customer: true, discount: 1 });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
      expect(new URL(receiver.arrivals[0].url).searchParams.has("airlock_custom_color")).toBe(false);
    });
  }, 8000);

  it.each(["example_variable", "color", "product_name"])(
    "rejects invalid %s values on capture or worker validation", async (name) => {
      await local({ experimentalCustomVariables: true }, async ({ adapter, receiver }) => {
        adapter.gtag("config", destination);
        for (const value of ["a".repeat(101), "\ud800", null, 2, true, [], {}]) {
          adapter.gtag("event", "conversion", { send_to: sendTo, [name]: value });
        }
        const state = await adapter.flush();
        expect(state.outcomes.slice(1).map(({ reason }) => reason)).toEqual([
          "unsupported-custom-variable", "unsupported-custom-variable", "unsupported-custom-variable",
          "unsupported-custom-variable", "unsupported-custom-variable", "unsupported-parameters", "unsupported-parameters",
        ]);
        expect(receiver.arrivals).toEqual([]);
      });
    }, 8000,
  );

  it("revalidates values and exact field names at the connector boundary", async () => {
    const host = createConnectorHost(createGoogleAdsConversionPrototype, { endpoint, experimentalCustomVariables: true });
    const event = (args) => ({ type: "google-ads-command", seq: 1, ts: 0, payload: { args, context }, snapshot: {} });
    await host.init({});
    await host.routeBatch([event(["config", destination])]);
    const getter = vi.fn(() => "blue");
    const accessor = { send_to: sendTo };
    Object.defineProperty(accessor, "color", { enumerable: true, get: getter });
    for (const [params, reason] of [
      [{ send_to: sendTo, color: null }, "unsupported-custom-variable"],
      [{ send_to: sendTo, product_name: "x".repeat(101) }, "unsupported-custom-variable"],
      [{ send_to: sendTo, example_variable: "\ud800" }, "unsupported-custom-variable"],
      [{ send_to: sendTo, other_variable: "synthetic" }, "unsupported-parameters"],
      [{ send_to: sendTo, discount: 1 }, "unsupported-parameters"],
      [accessor, "unsupported-parameters"],
    ]) {
      const result = await host.routeBatch([event(["event", "conversion", params])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped).toMatchObject([{ reason }]);
    }
    expect(getter).not.toHaveBeenCalled();
    expect((await host.routeBatch([event(["event", "conversion", { send_to: sendTo, color: "" }])])).ready)
      .toHaveLength(1);
  });

  it("composes with existing value scopes and host-only callbacks without treating callback fields as variables", async () => {
    await local({
      experimentalCustomVariables: true, experimentalParameterScopes: true, experimentalCallbacks: true,
    }, async ({ adapter, receiver, chamber }) => {
      const sent = [];
      const postMessage = chamber.postMessage;
      chamber.postMessage = (message) => { sent.push(structuredClone(message)); postMessage(message); };
      const callback = vi.fn();
      adapter.gtag("set", { value: 3 });
      adapter.gtag("config", destination, { currency: "USD" });
      adapter.gtag("event", "conversion", {
        send_to: sendTo, value: 7, currency: "CAD", transaction_id: "synthetic-order",
        example_variable: "one", color: "blue", product_name: "synthetic",
        event_callback: callback, event_timeout: 1000,
      });
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual(["scope-updated", "configured", "transport-settled"]);
      expect(callback).toHaveBeenCalledOnce();
      const event = sent.find((message) => message.type === "event" && message.event.payload.args[0] === "event");
      expect(event.event.payload.args[2]).not.toHaveProperty("event_callback");
      expect(event.event.payload.args[2]).not.toHaveProperty("event_timeout");
      const query = new URL(receiver.arrivals[0].url).searchParams;
      expect([query.get("value"), query.get("currency_code"), query.get("oid")]).toEqual(["7", "CAD", "synthetic-order"]);
      expect([query.get("airlock_custom_example_variable"), query.get("airlock_custom_color"), query.get("airlock_custom_product_name")])
        .toEqual(["one", "blue", "synthetic"]);
      expect(query.has("airlock_custom_event_callback")).toBe(false);
    });
  }, 8000);

  it("holds denied custom variables and does not replay after host or tag grants", async () => {
    await local({
      experimentalCustomVariables: true, experimentalConsentCommands: true, consent: { ad_storage: "denied" },
    }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("event", "conversion", { send_to: sendTo, color: "blue" });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      adapter.gtag("event", "conversion", { send_to: sendTo, color: "blue" });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "conversion", { send_to: sendTo, color: "blue" });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
      expect(new URL(receiver.arrivals[0].url).searchParams.get("airlock_custom_color")).toBe("blue");
    });
  }, 8000);

  it("snapshots variables at dataLayer drain time and does not drain them twice", async () => {
    await local({ experimentalCustomVariables: true, experimentalDataLayer: true }, async ({ adapter, receiver }) => {
      const push = (...args) => (function () { return arguments; })(...args);
      const params = { send_to: sendTo, color: "blue" };
      const layer = [push("config", destination), push("event", "conversion", params)];
      params.color = "green";
      adapter.drainDataLayer(layer);
      params.color = "red";
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(new URL(receiver.arrivals[0].url).searchParams.get("airlock_custom_color")).toBe("green");
      adapter.drainDataLayer(layer);
      await adapter.flush();
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("checks custom-variable consent per branch and does not replay a held destination", async () => {
    let first, second, chamber, adapter, cause, release;
    let notify, count = 0;
    const arrival = new Promise((resolve) => { notify = resolve; });
    try {
      first = await createConversionReceiver({
        conversionId: "111", respond(_request, response) {
          if (++count === 1) { release = () => response.writeHead(204).end(); notify(); }
          else response.writeHead(204).end();
        },
      });
      second = await createConversionReceiver({ conversionId: "222" });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: first.endpoint, additionalEndpoint: second.endpoint, chamber, captureContext: () => context,
        consent: { ad_storage: "granted" }, experimentalRouting: true, experimentalMultiDestination: true,
        experimentalCustomVariables: true, experimentalConsentCommands: true,
      });
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("config", "AW-111");
      adapter.gtag("config", "AW-222");
      await adapter.flush();
      const params = {
        send_to: ["AW-111/ONE", "AW-222/TWO"], example_variable: "synthetic", color: "blue", product_name: "sku",
      };
      adapter.gtag("event", "conversion", params);
      const done = adapter.flush();
      await arrival;
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      release();
      expect((await done).outcomes[3]).toMatchObject({
        disposition: "partial", branches: [
          { index: 0, disposition: "transport-settled", status: 204 },
          { index: 1, disposition: "held", reason: "held-at-seal" },
        ],
      });
      expect(new URL(first.arrivals[0].url).searchParams.get("airlock_custom_color")).toBe("blue");
      expect(second.arrivals).toEqual([]);
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(second.arrivals).toEqual([]);
      adapter.gtag("event", "conversion", params);
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({
        disposition: "transport-settled", branches: [
          { index: 0, disposition: "transport-settled", status: 204 },
          { index: 1, disposition: "transport-settled", status: 204 },
        ],
      });
      expect(first.arrivals).toHaveLength(2);
      expect(second.arrivals).toHaveLength(1);
      for (const { url } of [first.arrivals[1], second.arrivals[0]]) {
        const query = new URL(url).searchParams;
        expect([query.get("airlock_custom_example_variable"), query.get("airlock_custom_color"),
          query.get("airlock_custom_product_name")]).toEqual(["synthetic", "blue", "sku"]);
      }
    } catch (error) { cause = error; throw error; }
    finally {
      try { await closeConversionResources({ adapter, chamber, receiver: first, cause }); }
      finally { await closeConversionResources({ receiver: second, cause }); }
    }
  }, 8000);
});
