import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";
import { reportGoogleAdsConversionPrototype } from "../rig/google-ads-conversion-prototype-report.mjs";

const destination = "AW-0000000000";
const sendTo = `${destination}/SYNTHETIC_LABEL`;
const context = { pageURL: "https://example.test/cart", referrer: "" };
const item = () => ({ id: "sku", price: 2.5, quantity: 3 });
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

describe("experimental Google purchase cart subset", () => {
  it("snapshots ordered direct-Ads items and carries them through the worker to loopback", async () => {
    await local({ experimentalPurchase: true, experimentalPurchaseCart: true }, async ({ adapter, receiver }) => {
      const items = [
        { id: "sku-one", price: 12.5, quantity: 2 },
        Object.assign(Object.create(null), { id: "sku-\u00e9&=\"two\"", price: 0, quantity: 1 }),
      ];
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", {
        send_to: sendTo, value: 25, currency: "USD", transaction_id: "synthetic-order", new_customer: true, items,
      });
      items[0].id = "changed";
      items.reverse();
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual(["configured", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      const query = new URL(receiver.arrivals[0].url).searchParams;
      expect(query.get("airlock_event")).toBe("purchase");
      expect(query.get("airlock_new_customer")).toBe("true");
      expect([query.get("value"), query.get("currency_code"), query.get("oid")]).toEqual(["25", "USD", "synthetic-order"]);
      expect(JSON.parse(query.get("airlock_items"))).toEqual([
        { id: "sku-one", price: 12.5, quantity: 2 }, { id: "sku-\u00e9&=\"two\"", price: 0, quantity: 1 },
      ]);
      expect(JSON.stringify(state)).not.toContain("sku-one");
      const report = reportGoogleAdsConversionPrototype({
        endpoint: receiver.endpoint, observedRequests: receiver.arrivals,
        commandSnapshots: [{ args: ["event", "purchase", { send_to: sendTo, items: [item()] }], context }],
      });
      expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false, local: [{ relationshipsPreserved: false }] });
      expect(JSON.stringify(report)).not.toContain("sku-one");
    });
  }, 8000);

  it("is independently default-off and rejects items on other commands and scopes", async () => {
    expect(() => createGoogleAdsPrototype({ endpoint, experimentalPurchaseCart: true })).toThrow("invalid-experimental-option");
    expect(() => createGoogleAdsConversionPrototype({ endpoint, experimentalPurchaseCart: true })).toThrow("invalid-experimental-option");
    for (const invalid of ["true", null, 1]) {
      expect(() => createGoogleAdsPrototype({ endpoint, experimentalPurchase: true, experimentalPurchaseCart: invalid }))
        .toThrow("invalid-experimental-option");
      expect(() => createGoogleAdsConversionPrototype({ endpoint, experimentalPurchase: true, experimentalPurchaseCart: invalid }))
        .toThrow("invalid-experimental-option");
    }
    await local({ experimentalPurchase: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", { send_to: sendTo, items: [item()] });
      adapter.gtag("event", "purchase", { send_to: sendTo });
      expect((await adapter.flush()).outcomes.map(({ disposition, reason }) => reason || disposition))
        .toEqual(["configured", "unsupported-parameters", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      expect(new URL(receiver.arrivals[0].url).searchParams.has("airlock_items")).toBe(false);
    });
    await local({ experimentalPurchase: true, experimentalPurchaseCart: true, experimentalParameterScopes: true },
      async ({ adapter, receiver }) => {
        adapter.gtag("set", { items: [item()] });
        adapter.gtag("config", destination, { items: [item()] });
        adapter.gtag("config", destination);
        adapter.gtag("event", "conversion", { send_to: sendTo, items: [item()] });
        adapter.gtag("event", "purchase", { send_to: sendTo });
        adapter.gtag("event", "purchase", { send_to: sendTo, items: undefined });
        const state = await adapter.flush();
        expect(state.outcomes.map(({ disposition, reason }) => reason || disposition)).toEqual([
          "unsupported-parameters", "unsupported-parameters", "configured", "unsupported-parameters",
          "transport-settled", "transport-settled",
        ]);
        expect(receiver.arrivals).toHaveLength(2);
        expect(receiver.arrivals.every(({ url }) => !new URL(url).searchParams.has("airlock_items"))).toBe(true);
      });
  }, 8000);

  it("preserves the local upper bounds, duplicate item IDs and explicit zero price", async () => {
    await local({ experimentalPurchase: true, experimentalPurchaseCart: true }, async ({ adapter, receiver }) => {
      const items = Array.from({ length: 10 }, (_, index) => ({
        id: "a".repeat(128), price: index === 0 ? 0 : index + 0.25, quantity: index === 9 ? 1000000 : 1,
      }));
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", { send_to: sendTo, new_customer: false, items });
      const state = await adapter.flush();
      expect(state.outcomes.at(-1).disposition).toBe("transport-settled");
      const query = new URL(receiver.arrivals[0].url).searchParams;
      expect(query.get("airlock_new_customer")).toBe("false");
      expect(JSON.parse(query.get("airlock_items"))).toEqual(items);
    });
  }, 8000);

  it("rejects malformed, ambiguous or non-direct-Ads items without invoking accessors", async () => {
    await local({ experimentalPurchase: true, experimentalPurchaseCart: true }, async ({ adapter, receiver }) => {
      const getter = vi.fn(() => "sku");
      const accessor = { price: 1, quantity: 1 };
      Object.defineProperty(accessor, "id", { get: getter, enumerable: true });
      const arrayAccessor = [];
      Object.defineProperty(arrayAccessor, "0", { get: getter, configurable: true, enumerable: true });
      const extraArrayProperty = [item()];
      extraArrayProperty.other = "not-allowed";
      const invalid = [
        null, [], Array(1), arrayAccessor, extraArrayProperty, Array.from({ length: 11 }, item),
        [{ item_id: "sku", price: 2, quantity: 1 }],
        [{ ...item(), item_id: "sku" }], [{ ...item(), extra: true }],
        [{ price: 2, quantity: 1 }], [{ id: "sku", quantity: 1 }], [{ id: "sku", price: 2 }],
        [accessor], [Object.assign(Object.create({ id: "sku" }), { price: 2, quantity: 1 })],
        [{ ...item(), id: "" }], [{ ...item(), id: "x".repeat(129) }], [{ ...item(), id: "\ud800" }],
        [{ ...item(), price: -1 }], [{ ...item(), price: -0 }], [{ ...item(), price: NaN }],
        [{ ...item(), price: Infinity }], [{ ...item(), price: "2.5" }],
        [{ ...item(), quantity: 0 }], [{ ...item(), quantity: 1.5 }], [{ ...item(), quantity: 1000001 }],
        [{ ...item(), quantity: NaN }], [{ ...item(), quantity: "3" }],
      ];
      adapter.gtag("config", destination);
      for (const items of invalid) adapter.gtag("event", "purchase", { send_to: sendTo, items });
      const state = await adapter.flush();
      expect(state.outcomes.slice(1).map(({ reason }) => reason)).toEqual(invalid.map(() => "unsupported-items"));
      expect(receiver.arrivals).toEqual([]);
      expect(getter).not.toHaveBeenCalled();
      adapter.gtag("event", "purchase", { send_to: sendTo, items: [item()] });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it.each(["adapter", "connector"])("%s bounds array length before enumeration and rejects changing proxies", async (surface) => {
    let enumerations = 0;
    const oversized = new Proxy(Array(11), {
      ownKeys(target) { enumerations += 1; return Reflect.ownKeys(target); },
    });
    let lengthReads = 0;
    const allowed = new Proxy([item()], {
      get(target, key, receiver) {
        if (key === "length") { lengthReads += 1; return 100000; }
        return Reflect.get(target, key, receiver);
      },
    });
    let descriptors = 0;
    const inconsistent = new Proxy([item()], {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        return key === "length" ? { ...descriptor, value: ++descriptors === 1 ? 1 : 0 } : descriptor;
      },
    });
    const growing = new Proxy([item()], {
      ownKeys(target) { target.push(item()); return Reflect.ownKeys(target); },
    });
    let priceReads = 0;
    const changingItem = new Proxy(item(), {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        return key === "price" ? { ...descriptor, value: ++priceReads === 1 ? 2.5 : 99 } : descriptor;
      },
    });
    const checks = [oversized, inconsistent, growing, [changingItem], allowed];
    if (surface === "adapter") {
      await local({ experimentalPurchase: true, experimentalPurchaseCart: true }, async ({ adapter, receiver }) => {
        adapter.gtag("config", destination);
        for (const items of checks) adapter.gtag("event", "purchase", { send_to: sendTo, items });
        const state = await adapter.flush();
        expect(state.outcomes.slice(1).map(({ disposition, reason }) => reason || disposition))
          .toEqual(["unsupported-items", "unsupported-items", "unsupported-items", "unsupported-items", "transport-settled"]);
        expect(receiver.arrivals).toHaveLength(1);
      });
    } else {
      const host = createConnectorHost(createGoogleAdsConversionPrototype, {
        endpoint, experimentalPurchase: true, experimentalPurchaseCart: true,
      });
      const event = (args) => ({ type: "google-ads-command", seq: 1, ts: 0, payload: { args, context }, snapshot: {} });
      await host.init({});
      await host.routeBatch([event(["config", destination])]);
      for (const [index, items] of checks.entries()) {
        const result = await host.routeBatch([event(["event", "purchase", { send_to: sendTo, items }])]);
        if (index < 4) {
          expect(result.ready).toEqual([]);
          expect(result.dropped).toMatchObject([{ reason: "unsupported-items" }]);
        } else expect(result.ready).toHaveLength(1);
      }
    }
    expect(enumerations).toBe(0);
    expect(lengthReads).toBe(0);
  }, 8000);

  it("independently rejects invalid cart records at the connector boundary", async () => {
    const host = createConnectorHost(createGoogleAdsConversionPrototype, {
      endpoint, experimentalPurchase: true, experimentalPurchaseCart: true,
    });
    const event = (args) => ({ type: "google-ads-command", seq: 1, ts: 0, payload: { args, context }, snapshot: {} });
    await host.init({});
    await host.routeBatch([event(["config", destination])]);
    for (const items of [[{ item_id: "ga4", price: 1, quantity: 1 }], [{ ...item(), quantity: -1 }], [], null]) {
      const result = await host.routeBatch([event(["event", "purchase", { send_to: sendTo, items }])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped).toMatchObject([{ reason: "unsupported-items" }]);
    }
    expect((await host.routeBatch([event(["event", "conversion", { send_to: sendTo, items: [item()] }])])).dropped)
      .toMatchObject([{ reason: "unsupported-parameters" }]);
    expect((await host.routeBatch([event(["event", "purchase", { send_to: sendTo, items: [item()] }])])).ready)
      .toHaveLength(1);
  });

  it("holds denied purchases and never replays their cart after host or tag grants", async () => {
    await local({
      experimentalPurchase: true, experimentalPurchaseCart: true, experimentalConsentCommands: true,
      consent: { ad_storage: "denied" },
    }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("event", "purchase", { send_to: sendTo, items: [item()] });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      adapter.gtag("event", "purchase", { send_to: sendTo, items: [item()] });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "purchase", { send_to: sendTo, items: [item()] });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
      expect(JSON.parse(new URL(receiver.arrivals[0].url).searchParams.get("airlock_items"))).toEqual([item()]);
    });
  }, 8000);

  it("captures items when draining a queued dataLayer command and does not drain twice", async () => {
    await local({ experimentalPurchase: true, experimentalPurchaseCart: true, experimentalDataLayer: true },
      async ({ adapter, receiver }) => {
        const push = (...args) => (function () { return arguments; })(...args);
        const items = [item()];
        const layer = [push("config", destination), push("event", "purchase", { send_to: sendTo, items })];
        adapter.drainDataLayer(layer);
        items[0].price = 999;
        const state = await adapter.flush();
        expect(state.outcomes.map(({ disposition }) => disposition)).toEqual(["configured", "transport-settled"]);
        expect(JSON.parse(new URL(receiver.arrivals[0].url).searchParams.get("airlock_items"))).toEqual([item()]);
        adapter.drainDataLayer(layer);
        await adapter.flush();
        expect(receiver.arrivals).toHaveLength(1);
      });
  }, 8000);

  it("refuses an oversized encoded cart URL and continues with a later bounded purchase", async () => {
    const largeContext = { pageURL: `https://example.test/${"\u754c".repeat(1200)}`, referrer: "" };
    await local({
      experimentalPurchase: true, experimentalPurchaseCart: true, captureContext: () => largeContext,
    }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", { send_to: sendTo, items: [{ ...item(), id: "\u754c".repeat(128) }] });
      largeContext.pageURL = context.pageURL;
      adapter.gtag("event", "purchase", { send_to: sendTo, items: [item()] });
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition, reason }) => reason || disposition))
        .toEqual(["configured", "encoded-context-limit", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      expect(JSON.parse(new URL(receiver.arrivals[0].url).searchParams.get("airlock_items"))).toEqual([item()]);
    });
  }, 8000);

  it("enforces an admitted denial between cart destinations and never replays the held branch", async () => {
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
        experimentalPurchase: true, experimentalPurchaseCart: true, experimentalConsentCommands: true,
      });
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("config", "AW-111");
      adapter.gtag("config", "AW-222");
      await adapter.flush();
      const purchase = { send_to: ["AW-111/ONE", "AW-222/TWO"], items: [item()] };
      adapter.gtag("event", "purchase", purchase);
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
      expect(JSON.parse(new URL(first.arrivals[0].url).searchParams.get("airlock_items"))).toEqual([item()]);
      expect(second.arrivals).toEqual([]);
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(second.arrivals).toEqual([]);
      adapter.gtag("event", "purchase", purchase);
      const state = await adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({
        disposition: "transport-settled", branches: [
          { index: 0, disposition: "transport-settled", status: 204 },
          { index: 1, disposition: "transport-settled", status: 204 },
        ],
      });
      expect(first.arrivals).toHaveLength(2);
      expect(second.arrivals).toHaveLength(1);
      expect(JSON.parse(new URL(second.arrivals[0].url).searchParams.get("airlock_items"))).toEqual([item()]);
    } catch (error) { cause = error; throw error; }
    finally {
      try { await closeConversionResources({ adapter, chamber, receiver: first, cause }); }
      finally { await closeConversionResources({ receiver: second, cause }); }
    }
  }, 8000);
});
