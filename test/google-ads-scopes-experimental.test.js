import { describe, expect, it } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createConnectorHost } from "../core/connector-host.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";
import { reportGoogleAdsConversionPrototype } from "../rig/google-ads-conversion-prototype-report.mjs";

const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";
const selector = "AW-0000000000/SYNTHETIC_LABEL";

async function local(options, check) {
  let receiver, chamber, adapter, cause;
  try {
    receiver = await createConversionReceiver();
    chamber = createNodeConversionChamber();
    adapter = createGoogleAdsPrototype({
      endpoint: receiver.endpoint, chamber,
      captureContext: () => ({ pageURL: "https://example.test/checkout", referrer: "" }),
      consent: { ad_storage: "granted" }, ...options,
    });
    await check({ adapter, receiver });
  } catch (error) { cause = error; throw error; }
  finally { await closeConversionResources({ adapter, chamber, receiver, cause }); }
}

describe("experimental conversion parameter scopes", () => {
  it("requires a boolean opt-in and keeps the original mode unchanged", async () => {
    expect(() => createGoogleAdsPrototype({ endpoint, experimentalParameterScopes: "true" })).toThrow("invalid-experimental-option");
    expect(() => createGoogleAdsConversionPrototype({ endpoint, experimentalParameterScopes: "true" })).toThrow("invalid-experimental-option");
    await local({}, async ({ adapter, receiver }) => {
      adapter.gtag("set", { value: 1 });
      adapter.gtag("set", "value", 1);
      adapter.gtag("config", "AW-0000000000", { currency: "USD" });
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", { send_to: selector });
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "unsupported-argument", "unsupported-command", "unsupported-config", "configured", "transport-settled",
      ]);
      expect([...new URL(receiver.arrivals[0].url).searchParams]).toEqual([
        ["label", "SYNTHETIC_LABEL"], ["url", "https://example.test/checkout"],
      ]);
    });
  }, 8000);

  it("retains scoped snapshots in the real worker and resolves each conversion in queue order", async () => {
    await local({ experimentalParameterScopes: true }, async ({ adapter, receiver }) => {
      const global = { value: 11, currency: "USD", transaction_id: "global-id" };
      const config = { value: 22, currency: "EUR" };
      const event = { send_to: selector, value: 0 };
      adapter.gtag("set", global);
      adapter.gtag("config", "AW-0000000000", config);
      adapter.gtag("event", "conversion", event);
      Object.assign(global, { value: 999, transaction_id: "mutated-global" });
      Object.assign(config, { value: 999, currency: "mutated-config" });
      event.value = 999;
      adapter.gtag("set", { value: 33, currency: "CAD", transaction_id: "next-global" });
      adapter.gtag("event", "conversion", { send_to: selector, currency: "", transaction_id: undefined });
      adapter.gtag("event", "conversion", { send_to: selector });
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "scope-updated", "configured", "transport-settled", "scope-updated", "transport-settled", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(3);
      expect(receiver.arrivals.map(({ url }) => [...new URL(url).searchParams])).toEqual([
        [["label", "SYNTHETIC_LABEL"], ["value", "0"], ["currency_code", "EUR"], ["oid", "global-id"], ["url", "https://example.test/checkout"]],
        [["label", "SYNTHETIC_LABEL"], ["value", "22"], ["currency_code", ""], ["url", "https://example.test/checkout"]],
        [["label", "SYNTHETIC_LABEL"], ["value", "22"], ["currency_code", "EUR"], ["oid", "next-global"], ["url", "https://example.test/checkout"]],
      ]);
      expect(state.host.dispatchAttempts).toBe(3);
      expect(JSON.stringify(state)).not.toContain("global-id");
      const context = { pageURL: "https://example.test/checkout", referrer: "" };
      const report = reportGoogleAdsConversionPrototype({
        observedRequests: receiver.arrivals, endpoint: receiver.endpoint, experimentalParameterScopes: true,
        commandSnapshots: [
          { args: ["event", "conversion", { send_to: selector, value: 0 }], context },
          { args: ["event", "conversion", { send_to: selector, currency: "", transaction_id: undefined }], context },
          { args: ["event", "conversion", { send_to: selector }], context },
        ],
        scopeSnapshots: [
          { global: { value: 11, currency: "USD", transaction_id: "global-id" }, config: { value: 22, currency: "EUR" } },
          { global: { value: 33, currency: "CAD", transaction_id: "next-global" }, config: { value: 22, currency: "EUR" } },
          { global: { value: 33, currency: "CAD", transaction_id: "next-global" }, config: { value: 22, currency: "EUR" } },
        ],
      });
      expect(report.local.every((entry) => entry.relationshipsPreserved)).toBe(true);
      expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false });
      expect(JSON.stringify(report)).not.toContain("global-id");
    });
  }, 8000);

  it("rejects invalid updates atomically and preserves scopes after invalid calls or denied egress", async () => {
    await local({ experimentalParameterScopes: true }, async ({ adapter, receiver }) => {
      adapter.gtag("set", { value: 1, currency: "USD" });
      adapter.gtag("set", { value: 2, currency: 9 });
      adapter.gtag("config", "AW-0000000000", { value: 3, transaction_id: false });
      adapter.gtag("config", "AW-0000000000", { transaction_id: "config-id" });
      adapter.gtag("set", { send_to: selector });
      adapter.gtag("set", { value: undefined });
      adapter.setConsent({ ad_storage: "denied" });
      adapter.gtag("event", "conversion", { send_to: selector });
      let state = await adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "scope-updated", "unsupported-currency", "unsupported-transaction", "configured",
        "unsupported-parameters", "scope-updated", "held-at-seal",
      ]);
      expect(receiver.arrivals).toEqual([]);
      adapter.setConsent({ ad_storage: "granted" });
      adapter.gtag("event", "conversion", { send_to: selector });
      state = await adapter.flush();
      expect(state.outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
      expect([...new URL(receiver.arrivals[0].url).searchParams]).toEqual([
        ["label", "SYNTHETIC_LABEL"], ["currency_code", "USD"], ["oid", "config-id"],
        ["url", "https://example.test/checkout"],
      ]);
    });
  }, 8000);

  it("supports local destination routing without leaking scopes between adapters", async () => {
    let receiver, firstChamber, secondChamber, first, second;
    try {
      receiver = await createConversionReceiver({ conversionId: "12345" });
      firstChamber = createNodeConversionChamber();
      secondChamber = createNodeConversionChamber();
      const options = {
        endpoint: receiver.endpoint, experimentalRouting: true, experimentalParameterScopes: true,
        captureContext: () => ({ pageURL: "https://example.test/", referrer: "" }),
        consent: { ad_storage: "granted" },
      };
      first = createGoogleAdsPrototype({ ...options, chamber: firstChamber });
      second = createGoogleAdsPrototype({ ...options, chamber: secondChamber });
      first.gtag("set", { value: 15 });
      first.gtag("config", "AW-12345", { currency: "CAD" });
      second.gtag("config", "AW-12345");
      await Promise.all([first.flush(), second.flush()]);
      first.gtag("event", "conversion", { send_to: "AW-12345/ONE" });
      await first.flush();
      second.gtag("event", "conversion", { send_to: "AW-12345/TWO" });
      await second.flush();
      expect(receiver.arrivals.map(({ url }) => [...new URL(url).searchParams])).toEqual([
        [["label", "ONE"], ["value", "15"], ["currency_code", "CAD"], ["url", "https://example.test/"]],
        [["label", "TWO"], ["url", "https://example.test/"]],
      ]);
    } finally {
      try { await closeConversionResources({ adapter: first, chamber: firstChamber }); }
      finally { await closeConversionResources({ adapter: second, chamber: secondChamber, receiver }); }
    }
  }, 8000);

  it("rejects accessor and unsupported records without invoking getters or changing retained state", async () => {
    await local({ experimentalParameterScopes: true }, async ({ adapter, receiver }) => {
      let reads = 0;
      const accessor = { currency: "EUR" };
      Object.defineProperty(accessor, "value", { enumerable: true, get() { reads += 1; return 90; } });
      adapter.gtag("set", { value: 5 });
      adapter.gtag("set", accessor);
      adapter.gtag("set", { currency: "EUR", extra: "unsupported" });
      adapter.gtag("config", "AW-0000000000", { value: undefined });
      adapter.gtag("config", "AW-0000000000", { value: 9 });
      adapter.gtag("event", "conversion", { send_to: selector });
      adapter.gtag("event", "conversion", { send_to: selector, value: 0 });
      const state = await adapter.flush();
      expect(reads).toBe(0);
      expect(state.outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "scope-updated", "unsupported-parameters", "unsupported-parameters", "configured",
        "duplicate-config", "transport-settled", "transport-settled",
      ]);
      expect(receiver.arrivals.map(({ url }) => [...new URL(url).searchParams])).toEqual([
        [["label", "SYNTHETIC_LABEL"], ["url", "https://example.test/checkout"]],
        [["label", "SYNTHETIC_LABEL"], ["value", "0"], ["url", "https://example.test/checkout"]],
      ]);
    });
  }, 8000);

  it("enforces scope records and atomic updates inside the connector, independently of capture", async () => {
    const host = createConnectorHost(createGoogleAdsConversionPrototype, { endpoint, experimentalParameterScopes: true });
    await host.init({});
    const route = (args) => host.routeBatch([{
      type: "google-ads-command", payload: {
        args, context: { pageURL: "https://example.test/", referrer: "" },
      },
    }]);
    let reads = 0;
    const getter = { get value() { reads += 1; return 100; } };
    const inherited = Object.assign(Object.create({ currency: "EUR" }), { value: 100 });
    expect(await route(["set", Object.assign(Object.create(null), { value: 8, currency: "CAD" })]))
      .toEqual({ ready: [], dropped: [] });
    for (const invalid of [getter, inherited, { value: 2, currency: false }, { send_to: selector }]) {
      expect((await route(["set", invalid])).dropped).toHaveLength(1);
    }
    expect(reads).toBe(0);
    expect(await route(["config", "AW-0000000000"])).toEqual({ ready: [], dropped: [] });
    const result = await route(["event", "conversion", { send_to: selector }]);
    expect([...new URL(result.ready[0].url).searchParams]).toEqual([
      ["label", "SYNTHETIC_LABEL"], ["value", "8"], ["currency_code", "CAD"], ["url", "https://example.test/"],
    ]);
  });

  it("supports sequential key/value set commands without widening consent, routing or input types", async () => {
    await local({ experimentalParameterScopes: true }, async ({ adapter, receiver }) => {
      adapter.gtag("set", "value", 14);
      adapter.gtag("set", "currency", "CAD");
      adapter.gtag("set", "transaction_id", "kv-synthetic");
      adapter.gtag("set", "value", "bad-number");
      adapter.gtag("set", "send_to", selector);
      adapter.gtag("set", "__proto__", "ignored");
      adapter.gtag("set", "currency", "\ud800");
      adapter.gtag("config", "AW-0000000000", { currency: "EUR" });
      adapter.gtag("event", "conversion", { send_to: selector });
      adapter.gtag("set", "value", undefined);
      adapter.gtag("event", "conversion", { send_to: selector, currency: "" });
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "scope-updated", "scope-updated", "scope-updated", "unsupported-value", "unsupported-parameters",
        "unsupported-parameters", "unsupported-currency",
        "configured", "transport-settled", "scope-updated", "transport-settled",
      ]);
      expect(receiver.arrivals.map(({ url }) => [...new URL(url).searchParams])).toEqual([
        [["label", "SYNTHETIC_LABEL"], ["value", "14"], ["currency_code", "EUR"], ["oid", "kv-synthetic"], ["url", "https://example.test/checkout"]],
        [["label", "SYNTHETIC_LABEL"], ["currency_code", ""], ["oid", "kv-synthetic"], ["url", "https://example.test/checkout"]],
      ]);
      const context = { pageURL: "https://example.test/checkout", referrer: "" };
      const report = reportGoogleAdsConversionPrototype({
        observedRequests: receiver.arrivals, endpoint: receiver.endpoint, experimentalParameterScopes: true,
        commandSnapshots: [
          { args: ["event", "conversion", { send_to: selector }], context },
          { args: ["event", "conversion", { send_to: selector, currency: "" }], context },
        ],
        scopeSnapshots: [
          { global: { value: 14, currency: "CAD", transaction_id: "kv-synthetic" }, config: { currency: "EUR" } },
          { global: { value: undefined, currency: "CAD", transaction_id: "kv-synthetic" }, config: { currency: "EUR" } },
        ],
      });
      expect(report.local.every((entry) => entry.relationshipsPreserved)).toBe(true);
      expect(JSON.stringify(report)).not.toContain("kv-synthetic");
    });
  }, 8000);
});
