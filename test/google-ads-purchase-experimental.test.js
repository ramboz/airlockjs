import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";
import { reportGoogleAdsConversionPrototype } from "../rig/google-ads-conversion-prototype-report.mjs";

const destination = "AW-0000000000";
const sendTo = `${destination}/SYNTHETIC_LABEL`;
const context = { pageURL: "https://example.test/purchase", referrer: "" };

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
  finally { await closeConversionResources({ adapter, chamber, receiver, cause }); }
}

describe("experimental Google purchase input", () => {
  it("carries a supplied new-customer classification through the worker to loopback", async () => {
    await local({ experimentalPurchase: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      const purchase = { send_to: sendTo, value: 12.5, currency: "USD", transaction_id: "synthetic-order", new_customer: true };
      adapter.gtag("event", "purchase", purchase);
      Object.assign(purchase, { new_customer: false, value: 42 });
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual(["configured", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      expect([...new URL(receiver.arrivals[0].url).searchParams]).toEqual([
        ["label", "SYNTHETIC_LABEL"], ["value", "12.5"], ["currency_code", "USD"], ["oid", "synthetic-order"],
        ["airlock_event", "purchase"], ["airlock_new_customer", "true"], ["url", context.pageURL],
      ]);
    });
  }, 8000);

  it("preserves true and false separately from omission, without inferring a classification", async () => {
    await local({ experimentalPurchase: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      for (const fields of [{ new_customer: true }, { new_customer: false }, {}, { new_customer: undefined }]) {
        adapter.gtag("event", "purchase", { send_to: sendTo, ...fields });
      }
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual([
        "configured", "transport-settled", "transport-settled", "transport-settled", "transport-settled",
      ]);
      expect(receiver.arrivals.map(({ url }) => new URL(url).searchParams.getAll("airlock_new_customer")))
        .toEqual([["true"], ["false"], [], []]);
      expect(receiver.arrivals.every(({ url }) => new URL(url).searchParams.get("airlock_event") === "purchase")).toBe(true);
      expect(state).toMatchObject({ receipt: "not-observed-by-adapter", fullCompatibility: false });
      expect(JSON.stringify(state)).not.toContain("new_customer");
      const report = reportGoogleAdsConversionPrototype({
        endpoint: receiver.endpoint, observedRequests: [receiver.arrivals[0]],
        commandSnapshots: [{ args: ["event", "purchase", { send_to: sendTo, new_customer: true }], context }],
      });
      expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false, local: [{ relationshipsPreserved: false }] });
      expect(JSON.stringify(report)).not.toContain(sendTo);
    });
  }, 8000);

  it("leaves purchase off by default and refuses the field on conversion even when opted in", async () => {
    await local({}, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "purchase", { send_to: sendTo });
      adapter.gtag("event", "purchase", { send_to: sendTo, new_customer: true });
      const state = await adapter.flush();
      expect(state.outcomes.map(({ reason, disposition }) => reason || disposition))
        .toEqual(["configured", "unsupported-command", "unsupported-parameters"]);
      expect(receiver.arrivals).toEqual([]);
    });
    await local({ experimentalPurchase: true, experimentalCallbacks: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "conversion", { send_to: sendTo, new_customer: true });
      adapter.gtag("event", "purchase", { send_to: sendTo, event_callback() {}, event_timeout: 100 });
      adapter.gtag("event", "conversion", { send_to: sendTo });
      const state = await adapter.flush();
      expect(state.outcomes.map(({ reason, disposition }) => reason || disposition))
        .toEqual(["configured", "unsupported-parameters", "unsupported-parameters", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      expect(new URL(receiver.arrivals[0].url).searchParams.has("airlock_event")).toBe(false);
      expect(new URL(receiver.arrivals[0].url).searchParams.has("airlock_new_customer")).toBe(false);
    });
  }, 8000);

  it("rejects malformed, inherited and accessor input without invoking accessors or dispatching", async () => {
    await local({ experimentalPurchase: true }, async ({ adapter, receiver }) => {
      const getter = vi.fn(() => true);
      const accessor = { send_to: sendTo };
      Object.defineProperty(accessor, "new_customer", { enumerable: true, get: getter });
      const inherited = Object.assign(Object.create({ new_customer: true }), { send_to: sendTo });
      adapter.gtag("event", "purchase", { send_to: sendTo, new_customer: true });
      adapter.gtag("config", destination);
      for (const new_customer of [null, 0, 1, "true", [], {}]) {
        adapter.gtag("event", "purchase", { send_to: sendTo, new_customer });
      }
      adapter.gtag("event", "purchase", accessor);
      adapter.gtag("event", "purchase", inherited);
      adapter.gtag("event", "purchase", { send_to: "AW-0000000000/WRONG", new_customer: true });
      const state = await adapter.flush();
      expect(state.outcomes[0].reason).toBe("conversion-before-config");
      expect(state.outcomes.slice(2).map(({ reason }) => reason)).toEqual([
        "unsupported-new-customer", "unsupported-new-customer", "unsupported-new-customer",
        "unsupported-new-customer", "unsupported-parameters", "unsupported-parameters",
        "unsupported-parameters", "unsupported-parameters", "synthetic-selector-required",
      ]);
      expect(getter).not.toHaveBeenCalled();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "purchase", { send_to: sendTo, new_customer: false });
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("independently rejects invalid worker-side fields and option types", async () => {
    const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";
    expect(() => createGoogleAdsConversionPrototype({ endpoint, experimentalPurchase: "true" })).toThrow("invalid-experimental-option");
    expect(() => createGoogleAdsPrototype({ endpoint, experimentalPurchase: "true" })).toThrow("invalid-experimental-option");
    const host = createConnectorHost(createGoogleAdsConversionPrototype, { endpoint, experimentalPurchase: true });
    const event = (args) => ({ type: "google-ads-command", seq: 1, ts: 0, payload: { args, context }, snapshot: {} });
    await host.init({});
    await host.routeBatch([event(["config", destination])]);
    const getter = vi.fn(() => true);
    const accessor = { send_to: sendTo };
    Object.defineProperty(accessor, "new_customer", { enumerable: true, get: getter });
    for (const [params, reason] of [
      [{ send_to: sendTo, new_customer: null }, "unsupported-new-customer"],
      [{ send_to: sendTo, new_customer: "false" }, "unsupported-new-customer"],
      [accessor, "unsupported-parameters"],
      [{ send_to: sendTo, extra: true }, "unsupported-parameters"],
    ]) {
      const result = await host.routeBatch([event(["event", "purchase", params])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped).toMatchObject([{ reason }]);
    }
    expect(getter).not.toHaveBeenCalled();
    expect((await host.routeBatch([event(["event", "purchase", { send_to: sendTo, new_customer: false }])])).ready)
      .toHaveLength(1);
  });

  it("respects host and tag denials without implicitly replaying held purchases", async () => {
    await local({ experimentalPurchase: true, experimentalConsentCommands: true, consent: { ad_storage: "denied" } },
      async ({ adapter, receiver }) => {
        adapter.gtag("config", destination);
        adapter.gtag("consent", "default", { ad_storage: "granted" });
        adapter.gtag("event", "purchase", { send_to: sendTo, new_customer: true });
        expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
        adapter.setConsent({ ad_storage: "granted" });
        await adapter.flush();
        expect(receiver.arrivals).toEqual([]);
        adapter.gtag("consent", "update", { ad_user_data: "denied" });
        adapter.gtag("event", "purchase", { send_to: sendTo, new_customer: false });
        adapter.gtag("consent", "update", { ad_storage: "granted" });
        adapter.gtag("event", "purchase", { send_to: sendTo, new_customer: false });
        expect((await adapter.flush()).outcomes.filter(({ disposition }) => disposition === "held")).toHaveLength(3);
        expect(receiver.arrivals).toEqual([]);
        adapter.gtag("consent", "update", { ad_user_data: "granted" });
        await adapter.flush();
        expect(receiver.arrivals).toEqual([]);
        adapter.gtag("event", "purchase", { send_to: sendTo, new_customer: false });
        expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
        expect(receiver.arrivals).toHaveLength(1);
      });
  }, 8000);

  it("supports queued purchase snapshots and existing scopes without scoping customer classification", async () => {
    await local({ experimentalPurchase: true, experimentalDataLayer: true, experimentalParameterScopes: true },
      async ({ adapter, receiver }) => {
        const push = (...args) => (function () { return arguments; })(...args);
        const params = { send_to: sendTo, new_customer: true };
        const layer = [
          push("set", { value: 7 }), push("config", destination, { currency: "USD" }),
          push("set", { new_customer: false }), push("event", "purchase", params),
        ];
        adapter.drainDataLayer(layer);
        params.new_customer = false;
        const state = await adapter.flush();
        expect(state.outcomes.map(({ reason, disposition }) => reason || disposition))
          .toEqual(["scope-updated", "configured", "unsupported-parameters", "transport-settled"]);
        expect(receiver.arrivals).toHaveLength(1);
        expect([...new URL(receiver.arrivals[0].url).searchParams]).toEqual([
          ["label", "SYNTHETIC_LABEL"], ["value", "7"], ["currency_code", "USD"],
          ["airlock_event", "purchase"], ["airlock_new_customer", "true"], ["url", context.pageURL],
        ]);
        adapter.drainDataLayer(layer);
        await adapter.flush();
        expect(receiver.arrivals).toHaveLength(1);
      });
  }, 8000);

  it.each([false, true])("rejects fake-worker purchase transport without valid correlation (opt-in %s)", async (enabled) => {
    let listener;
    const chamber = {
      sent: [],
      postMessage(message) { this.sent.push(message); },
      onMessage(callback) { listener = callback; return () => { listener = undefined; }; },
      onError() { return () => {}; },
      emit(message) { listener?.(message); },
      dispose() {},
    };
    const fetchImpl = vi.fn();
    const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";
    const adapter = createGoogleAdsPrototype({
      endpoint, chamber, fetchImpl, captureContext: () => context,
      consent: { ad_storage: "granted" }, experimentalPurchase: enabled,
    });
    try {
      chamber.emit({ type: "phase", name: "configured" });
      adapter.gtag("config", destination);
      chamber.emit({ type: "result", summary: { seq: 1, disposition: "configured", requests: 0 }, ready: [] });
      await adapter.flush();
      adapter.gtag("event", "purchase", { send_to: sendTo });
      if (enabled) {
        chamber.emit({ type: "result", summary: { seq: 2, disposition: "transport-settled", requests: 1, status: 204 }, ready: [] });
      } else {
        chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: `${endpoint}?label=SYNTHETIC_LABEL` });
      }
      const state = await adapter.flush();
      expect(state.phase).toBe("terminal");
      expect(state.terminalReason).toBe(enabled ? "result-transport-mismatch" : "request-correlation-failed");
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
  });

  it("checks consent separately for purchase branches and applies an admitted denial immediately", async () => {
    let first, second, chamber, adapter, cause, release;
    let count = 0;
    let notify;
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
        experimentalPurchase: true, experimentalConsentCommands: true,
      });
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("config", "AW-111");
      adapter.gtag("config", "AW-222");
      await adapter.flush();
      adapter.gtag("event", "purchase", { send_to: ["AW-111/ONE", "AW-222/TWO"], new_customer: false });
      const done = adapter.flush();
      await arrival;
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      release();
      const state = await done;
      expect(state.outcomes[3]).toMatchObject({
        disposition: "partial", branches: [
          { index: 0, disposition: "transport-settled", status: 204 },
          { index: 1, disposition: "held", reason: "held-at-seal" },
        ],
      });
      expect(new URL(first.arrivals[0].url).searchParams.get("airlock_new_customer")).toBe("false");
      expect(second.arrivals).toEqual([]);
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(second.arrivals).toEqual([]);
      adapter.gtag("event", "purchase", { send_to: ["AW-111/ONE", "AW-222/TWO"], new_customer: true });
      const later = await adapter.flush();
      expect(later.outcomes.at(-1)).toMatchObject({
        disposition: "transport-settled", branches: [
          { index: 0, disposition: "transport-settled", status: 204 },
          { index: 1, disposition: "transport-settled", status: 204 },
        ],
      });
      expect(first.arrivals).toHaveLength(2);
      expect(second.arrivals).toHaveLength(1);
      expect(new URL(first.arrivals[1].url).searchParams.get("airlock_new_customer")).toBe("true");
      expect(new URL(second.arrivals[0].url).searchParams.get("airlock_new_customer")).toBe("true");
    } catch (error) { cause = error; throw error; }
    finally {
      try { await closeConversionResources({ adapter, chamber, receiver: first, cause }); }
      finally { await closeConversionResources({ receiver: second, cause }); }
    }
  }, 8000);
});
