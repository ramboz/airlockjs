import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";
import { reportGoogleAdsConversionPrototype } from "../rig/google-ads-conversion-prototype-report.mjs";

const destination = "AW-0000000000";
const sendTo = `${destination}/SYNTHETIC_LABEL`;
const context = { pageURL: "https://example.test/feed", referrer: "" };
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

describe("experimental Google purchase feed metadata", () => {
  it("snapshots the three direct-Ads feed inputs through worker to loopback", async () => {
    await local({
      experimentalPurchase: true, experimentalPurchaseCart: true, experimentalPurchaseFeed: true,
    }, async ({ adapter, receiver }) => {
      const params = {
        send_to: sendTo, items: [{ id: "synthetic-sku", price: 4, quantity: 2 }],
        aw_merchant_id: 98765, aw_feed_country: "US", aw_feed_language: "EN",
      };
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", params);
      Object.assign(params, { aw_merchant_id: 777, aw_feed_country: "CA", aw_feed_language: "fr" });
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual(["configured", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      const query = new URL(receiver.arrivals[0].url).searchParams;
      expect(query.getAll("airlock_merchant_id")).toEqual(["98765"]);
      expect(query.getAll("airlock_feed_country")).toEqual(["US"]);
      expect(query.getAll("airlock_feed_language")).toEqual(["EN"]);
      expect(JSON.parse(query.get("airlock_items"))).toEqual([{ id: "synthetic-sku", price: 4, quantity: 2 }]);
      expect(JSON.stringify(state)).not.toContain("98765");
      const report = reportGoogleAdsConversionPrototype({
        endpoint: receiver.endpoint, observedRequests: receiver.arrivals,
        commandSnapshots: [{ args: ["event", "purchase", { send_to: sendTo, aw_merchant_id: 98765 }], context }],
      });
      expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false, local: [{ relationshipsPreserved: false }] });
      expect(JSON.stringify(report)).not.toContain("98765");
    });
  }, 8000);

  it("is independently default-off and requires both purchase and cart options", async () => {
    for (const factory of [createGoogleAdsPrototype, createGoogleAdsConversionPrototype]) {
      expect(() => factory({ endpoint, experimentalPurchaseFeed: true })).toThrow("invalid-experimental-option");
      expect(() => factory({ endpoint, experimentalPurchase: true, experimentalPurchaseFeed: true }))
        .toThrow("invalid-experimental-option");
      for (const invalid of ["true", null, 1]) {
        expect(() => factory({
          endpoint, experimentalPurchase: true, experimentalPurchaseCart: true, experimentalPurchaseFeed: invalid,
        })).toThrow("invalid-experimental-option");
      }
    }
    await local({ experimentalPurchase: true, experimentalPurchaseCart: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", { send_to: sendTo, aw_merchant_id: 98765 });
      adapter.gtag("event", "purchase", { send_to: sendTo, items: [{ id: "sku", price: 4, quantity: 1 }] });
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition, reason }) => reason || disposition))
        .toEqual(["configured", "unsupported-parameters", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      expect(new URL(receiver.arrivals[0].url).searchParams.has("airlock_merchant_id")).toBe(false);
    });
  }, 8000);

  it("preserves each optional field independently without normalization or defaults", async () => {
    await local({
      experimentalPurchase: true, experimentalPurchaseCart: true, experimentalPurchaseFeed: true,
    }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      for (const fields of [
        { aw_merchant_id: 1 }, { aw_merchant_id: Number.MAX_SAFE_INTEGER }, { aw_feed_country: "ZZ" },
        { aw_feed_language: "en" }, { aw_feed_language: "EN" }, { aw_feed_language: "eN" },
        {}, { aw_merchant_id: undefined, aw_feed_country: undefined, aw_feed_language: undefined },
      ]) adapter.gtag("event", "purchase", { send_to: sendTo, ...fields });
      const state = await adapter.flush();
      expect(state.outcomes.slice(1).every(({ disposition }) => disposition === "transport-settled")).toBe(true);
      expect(receiver.arrivals.map(({ url }) => {
        const query = new URL(url).searchParams;
        return ["airlock_merchant_id", "airlock_feed_country", "airlock_feed_language"].map((key) => query.getAll(key));
      })).toEqual([
        [["1"], [], []], [[String(Number.MAX_SAFE_INTEGER)], [], []], [[], ["ZZ"], []],
        [[], [], ["en"]], [[], [], ["EN"]], [[], [], ["eN"]], [[], [], []], [[], [], []],
      ]);
    });
  }, 8000);

  it("refuses unsupported feed input, accessors, Analytics-only label and non-purchase use", async () => {
    await local({
      experimentalPurchase: true, experimentalPurchaseCart: true, experimentalPurchaseFeed: true,
      experimentalParameterScopes: true,
    }, async ({ adapter, receiver }) => {
      const getter = vi.fn(() => "US");
      const accessor = { send_to: sendTo };
      Object.defineProperty(accessor, "aw_feed_country", { enumerable: true, get: getter });
      adapter.gtag("set", { aw_feed_country: "US" });
      adapter.gtag("config", destination, { aw_feed_language: "EN" });
      adapter.gtag("config", destination);
      adapter.gtag("event", "conversion", { send_to: sendTo, aw_feed_country: "US" });
      adapter.gtag("event", "purchase", { send_to: sendTo, aw_feed_label: "synthetic" });
      adapter.gtag("event", "purchase", { send_to: sendTo, aw_feed_country: "US", aw_feed_label: "synthetic" });
      const invalid = [
        { aw_merchant_id: 0 }, { aw_merchant_id: -1 }, { aw_merchant_id: 1.5 },
        { aw_merchant_id: Number.MAX_SAFE_INTEGER + 1 }, { aw_merchant_id: NaN }, { aw_merchant_id: Infinity },
        { aw_merchant_id: "98765" }, { aw_merchant_id: null }, { aw_merchant_id: true },
        { aw_feed_country: "" }, { aw_feed_country: "us" }, { aw_feed_country: "USA" }, { aw_feed_country: "US\n" },
        { aw_feed_country: "U1" }, { aw_feed_country: 12 }, { aw_feed_country: null },
        { aw_feed_language: "" }, { aw_feed_language: "eng" }, { aw_feed_language: "en\n" },
        { aw_feed_language: "e1" }, { aw_feed_language: 12 }, { aw_feed_language: null },
      ];
      for (const fields of invalid) adapter.gtag("event", "purchase", { send_to: sendTo, ...fields });
      adapter.gtag("event", "purchase", accessor);
      const state = await adapter.flush();
      expect(state.outcomes.slice(0, 6).map(({ disposition, reason }) => reason || disposition)).toEqual([
        "unsupported-parameters", "unsupported-parameters", "configured", "unsupported-parameters",
        "unsupported-parameters", "unsupported-parameters",
      ]);
      expect(state.outcomes.slice(6, -1).map(({ reason }) => reason)).toEqual(invalid.map(() => "unsupported-feed"));
      expect(state.outcomes.at(-1).reason).toBe("unsupported-parameters");
      expect(receiver.arrivals).toEqual([]);
      expect(getter).not.toHaveBeenCalled();
      adapter.gtag("event", "purchase", { send_to: sendTo, aw_feed_country: "US" });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("independently rejects bad fields at the connector boundary", async () => {
    const host = createConnectorHost(createGoogleAdsConversionPrototype, {
      endpoint, experimentalPurchase: true, experimentalPurchaseCart: true, experimentalPurchaseFeed: true,
    });
    const event = (args) => ({ type: "google-ads-command", seq: 1, ts: 0, payload: { args, context }, snapshot: {} });
    await host.init({});
    await host.routeBatch([event(["config", destination])]);
    const getter = vi.fn(() => 123);
    const accessor = { send_to: sendTo };
    Object.defineProperty(accessor, "aw_merchant_id", { enumerable: true, get: getter });
    for (const [fields, reason] of [
      [{ aw_merchant_id: 1.5 }, "unsupported-feed"], [{ aw_feed_country: "US\n" }, "unsupported-feed"],
      [{ aw_feed_language: "en\n" }, "unsupported-feed"], [{ aw_feed_label: "x" }, "unsupported-parameters"],
    ]) {
      const result = await host.routeBatch([event(["event", "purchase", { send_to: sendTo, ...fields }])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped).toMatchObject([{ reason }]);
    }
    expect((await host.routeBatch([event(["event", "purchase", accessor])])).dropped)
      .toMatchObject([{ reason: "unsupported-parameters" }]);
    expect(getter).not.toHaveBeenCalled();
    expect((await host.routeBatch([event(["event", "purchase", { send_to: sendTo, aw_feed_language: "EN" }])])).ready)
      .toHaveLength(1);
  });

  it("preserves feed metadata independently from all existing purchase fields", async () => {
    await local({
      experimentalPurchase: true, experimentalPurchaseCart: true, experimentalPurchaseDiscount: true, experimentalPurchaseFeed: true,
    }, async ({ adapter, receiver }) => {
      const items = [{ id: "sku", price: 5, quantity: 2 }];
      const params = {
        send_to: sendTo, value: 10, currency: "USD", transaction_id: "synthetic-order", new_customer: false,
        items, discount: 1, aw_merchant_id: 98765, aw_feed_country: "US", aw_feed_language: "en",
      };
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", params);
      items[0].id = "changed";
      params.aw_feed_language = "FR";
      const state = await adapter.flush();
      expect(state.outcomes.at(-1).disposition).toBe("transport-settled");
      const query = new URL(receiver.arrivals[0].url).searchParams;
      expect(query.get("value")).toBe("10");
      expect(query.get("currency_code")).toBe("USD");
      expect(query.get("oid")).toBe("synthetic-order");
      expect(query.get("airlock_new_customer")).toBe("false");
      expect(query.get("airlock_discount")).toBe("1");
      expect(JSON.parse(query.get("airlock_items"))).toEqual([{ id: "sku", price: 5, quantity: 2 }]);
      expect([query.get("airlock_merchant_id"), query.get("airlock_feed_country"), query.get("airlock_feed_language")])
        .toEqual(["98765", "US", "en"]);
    });
  }, 8000);

  it("holds denied feed metadata and never replays after host or tag grants", async () => {
    await local({
      experimentalPurchase: true, experimentalPurchaseCart: true, experimentalPurchaseFeed: true,
      experimentalConsentCommands: true, consent: { ad_storage: "denied" },
    }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("event", "purchase", { send_to: sendTo, aw_merchant_id: 98765 });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      adapter.gtag("event", "purchase", { send_to: sendTo, aw_feed_country: "US" });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "purchase", { send_to: sendTo, aw_feed_country: "US" });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
      expect(new URL(receiver.arrivals[0].url).searchParams.get("airlock_feed_country")).toBe("US");
    });
  }, 8000);

  it("snapshots feed metadata when the dataLayer is drained and does not drain twice", async () => {
    await local({
      experimentalPurchase: true, experimentalPurchaseCart: true, experimentalPurchaseFeed: true, experimentalDataLayer: true,
    }, async ({ adapter, receiver }) => {
      const push = (...args) => (function () { return arguments; })(...args);
      const params = { send_to: sendTo, aw_feed_language: "en" };
      const layer = [push("config", destination), push("event", "purchase", params)];
      params.aw_feed_language = "EN";
      adapter.drainDataLayer(layer);
      params.aw_feed_language = "fr";
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(new URL(receiver.arrivals[0].url).searchParams.get("airlock_feed_language")).toBe("EN");
      adapter.drainDataLayer(layer);
      await adapter.flush();
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("checks consent separately for feed branches and does not replay a held branch", async () => {
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
        experimentalPurchase: true, experimentalPurchaseCart: true, experimentalPurchaseFeed: true,
        experimentalConsentCommands: true,
      });
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("config", "AW-111");
      adapter.gtag("config", "AW-222");
      await adapter.flush();
      const params = {
        send_to: ["AW-111/ONE", "AW-222/TWO"], items: [{ id: "sku", price: 4, quantity: 3 }],
        aw_merchant_id: 98765, aw_feed_country: "US", aw_feed_language: "EN",
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
      expect(new URL(first.arrivals[0].url).searchParams.get("airlock_merchant_id")).toBe("98765");
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
        expect([query.get("airlock_merchant_id"), query.get("airlock_feed_country"), query.get("airlock_feed_language")])
          .toEqual(["98765", "US", "EN"]);
        expect(JSON.parse(query.get("airlock_items"))).toEqual(params.items);
      }
    } catch (error) { cause = error; throw error; }
    finally {
      try { await closeConversionResources({ adapter, chamber, receiver: first, cause }); }
      finally { await closeConversionResources({ receiver: second, cause }); }
    }
  }, 8000);
});
