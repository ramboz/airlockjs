import { describe, expect, it } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";
import { reportGoogleAdsConversionPrototype } from "../rig/google-ads-conversion-prototype-report.mjs";

describe("experimental conversion routing through the real worker and local receiver", () => {
  it.each([1, 20, 21, 32])("routes a %i-digit destination and reports its local relationship", async (length) => {
    const id = "1".repeat(length);
    const context = { pageURL: "https://example.test/checkout", referrer: "" };
    const params = { send_to: `AW-${id}/SYNTHETIC_ACTION`, value: 3 };
    let receiver, chamber, adapter;
    try {
      receiver = await createConversionReceiver({ conversionId: id });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, experimentalRouting: true,
        captureContext: () => context, consent: { ad_storage: "granted" },
      });
      adapter.gtag("config", `AW-${id}`);
      adapter.gtag("event", "conversion", params);
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual(["configured", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(1);
      expect(new URL(receiver.arrivals[0].url).pathname).toBe(`/pagead/conversion/${id}/`);
      const report = reportGoogleAdsConversionPrototype({
        observedRequests: receiver.arrivals, commandSnapshots: [{ args: ["event", "conversion", params], context }],
        endpoint: receiver.endpoint, experimentalRouting: true,
      });
      expect(report.local[0].relationshipsPreserved).toBe(true);
      expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false });
      expect(JSON.stringify(report)).not.toContain(`AW-${id}`);
      expect(JSON.stringify(report)).not.toContain(`/pagead/conversion/${id}/`);
    } finally { await closeConversionResources({ adapter, chamber, receiver }); }
  }, 8000);

  it("rejects empty or 33-digit destinations, and keeps arbitrary routing opt-in", async () => {
    for (const id of ["", "1".repeat(33)]) {
      const endpoint = `http://127.0.0.1:41234/pagead/conversion/${id}/`;
      await expect(createConversionReceiver({ conversionId: id })).rejects.toThrow("invalid-conversion-id");
      expect(() => createGoogleAdsPrototype({ endpoint, experimentalRouting: true }))
        .toThrow("literal-loopback-endpoint-required");
      expect(() => createGoogleAdsConversionPrototype({ endpoint, experimentalRouting: true }))
        .toThrow("literal-loopback-endpoint-required");
    }
    const endpoint = `http://127.0.0.1:41234/pagead/conversion/${"1".repeat(32)}/`;
    expect(() => createGoogleAdsPrototype({ endpoint })).toThrow("literal-loopback-endpoint-required");
    expect(() => createGoogleAdsConversionPrototype({ endpoint })).toThrow("literal-loopback-endpoint-required");
  });

  it("rejects a 33-digit selector without dispatching from an otherwise valid route", async () => {
    const id = "1".repeat(32);
    let receiver, chamber, adapter;
    try {
      receiver = await createConversionReceiver({ conversionId: id });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, experimentalRouting: true,
        captureContext: () => ({ pageURL: "https://example.test/", referrer: "" }),
        consent: { ad_storage: "granted" },
      });
      adapter.gtag("config", `AW-${id}`);
      adapter.gtag("event", "conversion", { send_to: `AW-${"1".repeat(33)}/SYNTHETIC` });
      expect((await adapter.flush()).outcomes.map((item) => item.reason || item.disposition))
        .toEqual(["configured", "destination-mismatch"]);
      expect(receiver.arrivals).toEqual([]);
    } finally { await closeConversionResources({ adapter, chamber, receiver }); }
  }, 8000);

  it("rejects a mistyped experimental option instead of silently disabling it", () => {
    const options = { endpoint: "http://127.0.0.1:43210/pagead/conversion/0000000000/", experimentalRouting: "true" };
    expect(() => createGoogleAdsPrototype(options)).toThrow("invalid-experimental-option");
    expect(() => createGoogleAdsConversionPrototype(options)).toThrow("invalid-experimental-option");
  });

  it("uses the configured destination and event label without accepting a different destination", async () => {
    let receiver, chamber, adapter;
    try {
      receiver = await createConversionReceiver({ conversionId: "0000000001" });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, experimentalRouting: true,
        captureContext: () => ({ pageURL: "https://example.test/checkout", referrer: "" }),
        consent: { ad_storage: "granted" },
      });
      adapter.gtag("config", "AW-0000000001");
      const params = {
        send_to: "AW-0000000001/SYNTHETIC_ACTION", value: 17.25, currency: "USD", transaction_id: "local-order",
      };
      adapter.gtag("event", "conversion", params);
      adapter.gtag("event", "conversion", { send_to: "AW-0000000002/SYNTHETIC_ACTION" });
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "configured", "transport-settled", "destination-mismatch",
      ]);
      expect(receiver.arrivals).toHaveLength(1);
      const url = new URL(receiver.arrivals[0].url);
      expect(url.pathname).toBe("/pagead/conversion/0000000001/");
      expect([...url.searchParams]).toEqual([
        ["label", "SYNTHETIC_ACTION"], ["value", "17.25"], ["currency_code", "USD"],
        ["oid", "local-order"], ["url", "https://example.test/checkout"],
      ]);
      const report = reportGoogleAdsConversionPrototype({
        observedRequests: receiver.arrivals,
        commandSnapshots: [{ args: ["event", "conversion", params], context: { pageURL: "https://example.test/checkout", referrer: "" } }],
        endpoint: receiver.endpoint, experimentalRouting: true,
      });
      expect(report.local[0].relationshipsPreserved).toBe(true);
      expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false });
      expect(JSON.stringify(report)).not.toContain("local-order");
      expect(JSON.stringify(report)).not.toContain("SYNTHETIC_ACTION");
    } finally {
      await closeConversionResources({ adapter, chamber, receiver });
    }
  }, 8000);

  it("holds denied conversions, then dispatches only new calls after consent is granted", async () => {
    let receiver, chamber, adapter;
    try {
      receiver = await createConversionReceiver({ conversionId: "0000000001" });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, experimentalRouting: true,
        captureContext: () => ({ pageURL: "https://example.test/checkout", referrer: "" }),
        consent: { ad_storage: "denied" },
      });
      adapter.gtag("config", "AW-0000000001");
      adapter.gtag("event", "conversion", { send_to: "AW-0000000001/SYNTHETIC_ONE" });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "held" });
      expect(receiver.arrivals).toEqual([]);
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "conversion", { send_to: "AW-0000000001/SYNTHETIC_TWO" });
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "transport-settled" });
      expect(new URL(receiver.arrivals[0].url).searchParams.get("label")).toBe("SYNTHETIC_TWO");
    } finally {
      await closeConversionResources({ adapter, chamber, receiver });
    }
  }, 8000);

  it("rejects foreign endpoints and malformed or mismatched selectors", async () => {
    expect(() => createGoogleAdsPrototype({
      endpoint: "https://www.googleadservices.com/pagead/conversion/0000000001/", experimentalRouting: true,
    })).toThrow("literal-loopback-endpoint-required");
    let receiver, chamber, adapter;
    try {
      receiver = await createConversionReceiver({ conversionId: "0000000001" });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, experimentalRouting: true,
        captureContext: () => ({ pageURL: "https://example.test/", referrer: "" }),
        consent: { ad_storage: "granted" },
      });
      adapter.gtag("config", "AW-0000000002");
      adapter.gtag("config", "AW-0000000001");
      for (const send_to of ["AW-0000000002/SYNTHETIC", "AW-0000000001/", "AW-0000000001/INVALID?x=1"]) {
        adapter.gtag("event", "conversion", { send_to });
      }
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition)).toEqual([
        "destination-mismatch", "configured", "destination-mismatch", "destination-mismatch", "destination-mismatch",
      ]);
      expect(receiver.arrivals).toEqual([]);
    } finally {
      await closeConversionResources({ adapter, chamber, receiver });
    }
  }, 8000);
});
