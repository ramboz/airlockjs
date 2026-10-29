import { describe, expect, it } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";

describe("experimental conversion routing through the real worker and local receiver", () => {
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
      adapter.gtag("event", "conversion", {
        send_to: "AW-0000000001/SYNTHETIC_ACTION", value: 17.25, currency: "USD", transaction_id: "local-order",
      });
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
