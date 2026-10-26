import { describe, expect, it } from "vitest";
import { createConnectorHost } from "../core/connector-host.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";

const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";
const config = ["config", "AW-0000000000"];
const params = { send_to: "AW-0000000000/SYNTHETIC_LABEL", value: 27.125, currency: "CAD", transaction_id: "offline-alpha" };
const event = (args, context = { pageURL: "https://example.test/offline-one", referrer: "" }) => ({
  type: "google-ads-command", seq: 1, ts: 0, payload: { args, context }, snapshot: {},
});

describe("synthetic conversion connector retained by the unchanged host", () => {
  it("gates initialization, retains zero-send config, and maps exact controlled conversion relationships", async () => {
    const host = createConnectorHost(createGoogleAdsConversionPrototype, { endpoint });
    expect((await host.routeBatch([event(config)])).dropped).toMatchObject([{ reason: "connector-not-initialized" }]);
    await host.init({});
    expect(await host.routeBatch([event(config)])).toEqual({ ready: [], dropped: [] });
    const result = await host.routeBatch([event(["event", "conversion", params])]);
    expect(result.dropped).toEqual([]);
    expect(result.ready).toHaveLength(1);
    const request = result.ready[0];
    expect(request.method).toBe("GET");
    expect(request).not.toHaveProperty("headers");
    expect(request).not.toHaveProperty("body");
    const url = new URL(request.url);
    expect(`${url.origin}${url.pathname}`).toBe(endpoint);
    expect([...url.searchParams]).toEqual([
      ["label", "SYNTHETIC_LABEL"], ["value", "27.125"], ["currency_code", "CAD"],
      ["oid", "offline-alpha"], ["url", "https://example.test/offline-one"],
    ]);
  });

  it("rejects unsupported commands, routes and types without poisoning retained valid config", async () => {
    const host = createConnectorHost(createGoogleAdsConversionPrototype, { endpoint });
    await host.init({});
    const commands = [
      ["event", "conversion", params],
      ["config", "AW-123"],
      ["config", "AW-0000000000", {}],
      config, config,
      ["js", 1], ["event", "purchase", params],
      ["event", "conversion", { ...params, send_to: "AW-0000000000/OTHER" }],
      ["event", "conversion", { ...params, value: Infinity }],
      ["event", "conversion", { ...params, value: "" }],
      ["event", "conversion", { ...params, value: "1" }],
      ["event", "conversion", { ...params, currency: 5 }],
      ["event", "conversion", { ...params, transaction_id: 5 }],
      ["event", "conversion", { ...params, event_callback() {} }],
      ["event", "conversion", []],
    ];
    const outcomes = [];
    for (const args of commands) {
      const result = await host.routeBatch([event(args)]);
      expect(result.ready).toEqual([]);
      outcomes.push(result.dropped[0]?.reason || "configured");
    }
    expect(outcomes).toEqual([
      "conversion-before-config", "synthetic-destination-required", "unsupported-config",
      "configured", "duplicate-config", "unsupported-command", "unsupported-command",
      "synthetic-selector-required", "unsupported-value", "unsupported-value", "unsupported-value",
      "unsupported-currency", "unsupported-transaction", "unsupported-parameters", "unsupported-parameters",
    ]);
    expect((await host.routeBatch([event(["event", "conversion", params])])).ready).toHaveLength(1);
  });

  it("preserves zero and empty strings versus omitted/explicit undefined, without defaults or coercion", async () => {
    const host = createConnectorHost(createGoogleAdsConversionPrototype, { endpoint });
    await host.init({});
    await host.routeBatch([event(config)]);
    for (const [overrides, expected] of [
      [{ value: 0, currency: "", transaction_id: "" }, [["value", "0"], ["currency_code", ""], ["oid", ""]]],
      [{}, []],
      [{ value: undefined, currency: undefined, transaction_id: undefined }, []],
    ]) {
      const result = await host.routeBatch([event(["event", "conversion", { send_to: params.send_to, ...overrides }])]);
      expect(result.dropped).toEqual([]);
      expect([...new URL(result.ready[0].url).searchParams]).toEqual([
        ["label", "SYNTHETIC_LABEL"], ...expected, ["url", "https://example.test/offline-one"],
      ]);
    }
    expect((await host.routeBatch([event(["event", "conversion", params], { pageURL: "not-a-url", referrer: "" })])).dropped)
      .toMatchObject([{ reason: "invalid-context" }]);
    expect(() => createGoogleAdsConversionPrototype({ endpoint: "https://example.test/" })).toThrow("literal-loopback-endpoint-required");
  });

  it("rejects inherited, class and accessor records without reading inherited values or getters", async () => {
    const host = createConnectorHost(createGoogleAdsConversionPrototype, { endpoint });
    await host.init({});
    await host.routeBatch([event(config)]);
    let reads = 0;
    const inherited = Object.assign(Object.create({
      get value() { reads += 1; return 99; },
    }), { send_to: params.send_to });
    class ParameterRecord { constructor() { Object.assign(this, params); } }
    for (const input of [inherited, new ParameterRecord()]) {
      const result = await host.routeBatch([event(["event", "conversion", input])]);
      expect(result.ready).toEqual([]);
      expect(result.dropped).toMatchObject([{ reason: "unsupported-parameters" }]);
    }
    const accessorContext = {
      get pageURL() { reads += 1; return "https://example.test/not-captured"; },
      referrer: "",
    };
    const result = await host.routeBatch([event(["event", "conversion", params], accessorContext)]);
    expect(result.ready).toEqual([]);
    expect(result.dropped).toMatchObject([{ reason: "invalid-context" }]);
    expect(reads).toBe(0);
    expect((await host.routeBatch([event(["event", "conversion", params])])).ready).toHaveLength(1);
  });

  it("rejects encoded overflow before returning a request without losing retained config", async () => {
    const host = createConnectorHost(createGoogleAdsConversionPrototype, { endpoint });
    await host.init({});
    await host.routeBatch([event(config)]);
    const context = { pageURL: `https://example.test/${"\u754c".repeat(1300)}`, referrer: "" };
    expect(context.pageURL.length).toBeLessThan(2048);
    const result = await host.routeBatch([event(["event", "conversion", params], context)]);
    expect(result.ready).toEqual([]);
    expect(result.dropped).toMatchObject([{ reason: "encoded-context-limit" }]);
    expect((await host.routeBatch([event(["event", "conversion", params])])).ready).toHaveLength(1);
  });

  it("admits null-prototype own-data records without inventing optional values", async () => {
    const host = createConnectorHost(createGoogleAdsConversionPrototype, { endpoint });
    await host.init({});
    await host.routeBatch([event(config)]);
    const ownParams = Object.assign(Object.create(null), { send_to: params.send_to, value: 0 });
    const context = Object.assign(Object.create(null), { pageURL: "https://example.test/null-record", referrer: "" });
    const result = await host.routeBatch([event(["event", "conversion", ownParams], context)]);
    expect(result.dropped).toEqual([]);
    expect([...new URL(result.ready[0].url).searchParams]).toEqual([
      ["label", "SYNTHETIC_LABEL"], ["value", "0"], ["url", "https://example.test/null-record"],
    ]);
  });
});
