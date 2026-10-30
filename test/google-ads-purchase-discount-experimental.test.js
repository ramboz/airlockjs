import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";
import { reportGoogleAdsConversionPrototype } from "../rig/google-ads-conversion-prototype-report.mjs";

const destination = "AW-0000000000";
const sendTo = `${destination}/SYNTHETIC_LABEL`;
const context = { pageURL: "https://example.test/discount", referrer: "" };
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

describe("experimental Google purchase discount", () => {
  it("snapshots the supplied order discount and transmits it through the worker to loopback", async () => {
    await local({ experimentalPurchase: true, experimentalPurchaseDiscount: true }, async ({ adapter, receiver }) => {
      const params = { send_to: sendTo, value: 25, currency: "USD", discount: 2.75 };
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", params);
      params.discount = 99;
      params.value = 20;
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual(["configured", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      const query = new URL(receiver.arrivals[0].url).searchParams;
      expect(query.get("airlock_event")).toBe("purchase");
      expect(query.getAll("airlock_discount")).toEqual(["2.75"]);
      expect(query.get("value")).toBe("25");
      expect(JSON.stringify(state)).not.toContain("airlock_discount");
      const report = reportGoogleAdsConversionPrototype({
        endpoint: receiver.endpoint, observedRequests: receiver.arrivals,
        commandSnapshots: [{ args: ["event", "purchase", { send_to: sendTo, discount: 2.75 }], context }],
      });
      expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false, local: [{ relationshipsPreserved: false }] });
    });
  }, 8000);

  it("is independently default-off and cannot be configured without the purchase opt-in", async () => {
    for (const factory of [createGoogleAdsPrototype, createGoogleAdsConversionPrototype]) {
      expect(() => factory({ endpoint, experimentalPurchaseDiscount: true })).toThrow("invalid-experimental-option");
      for (const invalid of ["true", null, 1]) {
        expect(() => factory({ endpoint, experimentalPurchase: true, experimentalPurchaseDiscount: invalid }))
          .toThrow("invalid-experimental-option");
      }
    }
    await local({ experimentalPurchase: true, experimentalPurchaseCart: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", { send_to: sendTo, discount: 1.5 });
      adapter.gtag("event", "purchase", { send_to: sendTo, items: [{ id: "sku", price: 4, quantity: 1 }] });
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition, reason }) => reason || disposition))
        .toEqual(["configured", "unsupported-parameters", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      expect(new URL(receiver.arrivals[0].url).searchParams.has("airlock_discount")).toBe(false);
    });
  }, 8000);

  it("preserves zero and finite numbers, but omits absent or explicitly undefined discounts", async () => {
    await local({ experimentalPurchase: true, experimentalPurchaseDiscount: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      for (const fields of [{ discount: 0 }, { discount: 2.5 }, { discount: Number.MIN_VALUE },
        { discount: Number.MAX_VALUE }, {}, { discount: undefined }]) {
        adapter.gtag("event", "purchase", { send_to: sendTo, ...fields });
      }
      const state = await adapter.flush();
      expect(state.outcomes.slice(1).every(({ disposition }) => disposition === "transport-settled")).toBe(true);
      expect(receiver.arrivals.map(({ url }) => new URL(url).searchParams.getAll("airlock_discount")))
        .toEqual([["0"], ["2.5"], [String(Number.MIN_VALUE)], [String(Number.MAX_VALUE)], [], []]);
    });
  }, 8000);

  it("refuses invalid discount values, accessors and non-purchase use without dispatch", async () => {
    await local({
      experimentalPurchase: true, experimentalPurchaseDiscount: true, experimentalParameterScopes: true,
    }, async ({ adapter, receiver }) => {
      const getter = vi.fn(() => 2);
      const accessor = { send_to: sendTo };
      Object.defineProperty(accessor, "discount", { enumerable: true, get: getter });
      adapter.gtag("set", { discount: 2 });
      adapter.gtag("config", destination, { discount: 2 });
      adapter.gtag("config", destination);
      adapter.gtag("event", "conversion", { send_to: sendTo, discount: 2 });
      for (const discount of [-1, -0, NaN, Infinity, -Infinity, "2", null, true, [], {}]) {
        adapter.gtag("event", "purchase", { send_to: sendTo, discount });
      }
      adapter.gtag("event", "purchase", accessor);
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
        "unsupported-parameters", "unsupported-parameters", "configured", "unsupported-parameters",
        "unsupported-discount", "unsupported-discount", "unsupported-discount", "unsupported-discount",
        "unsupported-discount", "unsupported-discount", "unsupported-discount", "unsupported-discount",
        "unsupported-parameters", "unsupported-parameters", "unsupported-parameters",
      ]);
      expect(getter).not.toHaveBeenCalled();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "purchase", { send_to: sendTo, discount: 0 });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("revalidates discount fields on the connector boundary", async () => {
    const host = createConnectorHost(createGoogleAdsConversionPrototype, {
      endpoint, experimentalPurchase: true, experimentalPurchaseDiscount: true,
    });
    const event = (args) => ({ type: "google-ads-command", seq: 1, ts: 0, payload: { args, context }, snapshot: {} });
    await host.init({});
    await host.routeBatch([event(["config", destination])]);
    const getter = vi.fn(() => 1);
    const accessor = { send_to: sendTo };
    Object.defineProperty(accessor, "discount", { enumerable: true, get: getter });
    for (const [params, reason] of [
      [{ send_to: sendTo, discount: null }, "unsupported-discount"],
      [{ send_to: sendTo, discount: -0 }, "unsupported-discount"],
      [{ send_to: sendTo, discount: "1" }, "unsupported-discount"],
      [accessor, "unsupported-parameters"],
    ]) {
      const result = await host.routeBatch([event(["event", "purchase", params])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped).toMatchObject([{ reason }]);
    }
    expect(getter).not.toHaveBeenCalled();
    expect((await host.routeBatch([event(["event", "conversion", { send_to: sendTo, discount: 1 }])])).dropped)
      .toMatchObject([{ reason: "unsupported-parameters" }]);
    expect((await host.routeBatch([event(["event", "purchase", { send_to: sendTo, discount: 1 }])])).ready)
      .toHaveLength(1);
  });

  it("keeps the order discount, cart prices, order value and classification independent", async () => {
    await local({
      experimentalPurchase: true, experimentalPurchaseDiscount: true, experimentalPurchaseCart: true,
    }, async ({ adapter, receiver }) => {
      const items = [{ id: "synthetic-sku", price: 100, quantity: 4 }];
      const params = {
        send_to: sendTo, value: 20, currency: "USD", transaction_id: "synthetic-order",
        new_customer: false, items, discount: 1.25,
      };
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", params);
      params.discount = 5;
      items[0].price = 50;
      const state = await adapter.flush();
      expect(state.outcomes.at(-1).disposition).toBe("transport-settled");
      const query = new URL(receiver.arrivals[0].url).searchParams;
      expect(query.getAll("airlock_discount")).toEqual(["1.25"]);
      expect(query.get("value")).toBe("20");
      expect(query.get("currency_code")).toBe("USD");
      expect(query.get("oid")).toBe("synthetic-order");
      expect(query.get("airlock_new_customer")).toBe("false");
      expect(JSON.parse(query.get("airlock_items"))).toEqual([{ id: "synthetic-sku", price: 100, quantity: 4 }]);
      adapter.gtag("event", "purchase", { send_to: sendTo, discount: 1, items: [{ id: "sku", price: 10, quantity: 1, discount: 2 }] });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "rejected", reason: "unsupported-items" });
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("obeys host and tag denials without replay after either grant", async () => {
    await local({
      experimentalPurchase: true, experimentalPurchaseDiscount: true, experimentalConsentCommands: true,
      consent: { ad_storage: "denied" },
    }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("event", "purchase", { send_to: sendTo, discount: 2.5 });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      adapter.gtag("event", "purchase", { send_to: sendTo, discount: 0 });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "purchase", { send_to: sendTo, discount: 0 });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
      expect(new URL(receiver.arrivals[0].url).searchParams.get("airlock_discount")).toBe("0");
    });
  }, 8000);

  it("snapshots a queued dataLayer discount at drain time and does not drain it twice", async () => {
    await local({
      experimentalPurchase: true, experimentalPurchaseDiscount: true, experimentalDataLayer: true,
    }, async ({ adapter, receiver }) => {
      const push = (...args) => (function () { return arguments; })(...args);
      const params = { send_to: sendTo, discount: 1 };
      const layer = [push("config", destination), push("event", "purchase", params)];
      params.discount = 2;
      adapter.drainDataLayer(layer);
      params.discount = 3;
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(new URL(receiver.arrivals[0].url).searchParams.get("airlock_discount")).toBe("2");
      adapter.drainDataLayer(layer);
      await adapter.flush();
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("checks consent on each discounted cart branch and does not replay a held branch", async () => {
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
        experimentalPurchase: true, experimentalPurchaseCart: true, experimentalPurchaseDiscount: true,
        experimentalConsentCommands: true,
      });
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("config", "AW-111");
      adapter.gtag("config", "AW-222");
      await adapter.flush();
      const params = {
        send_to: ["AW-111/ONE", "AW-222/TWO"], discount: 2.5,
        items: [{ id: "sku", price: 4, quantity: 3 }],
      };
      adapter.gtag("event", "purchase", params);
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
      expect(new URL(first.arrivals[0].url).searchParams.get("airlock_discount")).toBe("2.5");
      expect(second.arrivals).toEqual([]);
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(second.arrivals).toEqual([]);
      adapter.gtag("event", "purchase", params);
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
        expect(query.get("airlock_discount")).toBe("2.5");
        expect(JSON.parse(query.get("airlock_items"))).toEqual(params.items);
      }
    } catch (error) { cause = error; throw error; }
    finally {
      try { await closeConversionResources({ adapter, chamber, receiver: first, cause }); }
      finally { await closeConversionResources({ receiver: second, cause }); }
    }
  }, 8000);
});
