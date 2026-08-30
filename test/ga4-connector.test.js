// GA4 wire-protocol connector — spec 014-03 AC1 (converge connector-hosting).
//
// GA4 is now a ConnectorFactory (config -> { manifest, init, handle }) hosted
// by createConnectorHost exactly like alloy (012-01), retiring
// core/chamber.worker.js's old hardcoded mapToMp import. These unit tests pin
// the manifest SHAPE (AC1 impedance a — connectors/ga4/ had no manifest
// before this slice), the {type,params} bridge (impedance b — mapToMp never
// changes, AC2), and the per-tracker fan-out (impedance c) against the REAL
// mapToMp (never faked — GA4 has no vendor SDK to fake, unlike alloy).
import { describe, it, expect } from "vitest";
import { createGa4Connector } from "../connectors/ga4/connector.js";
import { createConnectorHost } from "../core/connector-host.js";
import { mapToMp } from "../connectors/ga4/map.js";

const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };
const endpoints = ["https://t0.example/collect", "https://t1.example/collect"];
const baseConfig = () => ({ trackers: 2, workFactor: 0, endpoints, ctx });

describe("GA4 connector manifest (spec 014-03 AC1)", () => {
  it("declares name/events (catch-all) + EMPTY reads (no projection), requests cookies + egress", () => {
    const { manifest } = createGa4Connector(baseConfig());

    expect(manifest.name).toBe("airlock/ga4");
    // GA4 accepts arbitrary custom event names by design (contracts/ga4-mp.md).
    expect(manifest.events).toEqual(["*"]);
    // reads = PROJECTION fields (ADR-0003 default-deny). GA4's handle reads the
    // event PAYLOAD + ctx, never event.snapshot → it reads ZERO projection fields.
    expect(manifest.reads).toEqual([]);
    expect(Array.isArray(manifest.capabilities.cookies)).toBe(true);
    expect(manifest.capabilities.cookies.length).toBeGreaterThan(0);
    expect(manifest.capabilities.egress).toBe(true);
  });

  it("declares endpoints (advisory, ADR-0006) matching the configured per-tracker collect URLs", () => {
    const { manifest } = createGa4Connector(baseConfig());
    expect(manifest.endpoints).toEqual(endpoints);
  });

  it("declares purposes (ADR-0007) tagging egress + endpoints + cookies as analytics_storage", () => {
    const { manifest } = createGa4Connector(baseConfig());

    expect(manifest.purposes.egress).toContain("analytics_storage");
    for (const e of endpoints) {
      expect(manifest.purposes.endpoints[e]).toContain("analytics_storage");
    }
    expect(Object.keys(manifest.purposes.cookies).length).toBeGreaterThan(0);
  });
});

describe("GA4 connector init() (spec 014-03 AC1)", () => {
  it("is a synchronous no-op that never throws — GA4 has no SDK to boot (contract conformance only)", () => {
    // Connector.init's contract type is `void | Promise<void>` (connector.d.ts) —
    // GA4 genuinely has nothing async to do, so it returns bare `undefined`
    // rather than manufacturing a Promise; createConnectorHost's own `init`
    // wraps whichever shape a connector returns (Promise.resolve(...)).
    const connector = createGa4Connector(baseConfig());
    expect(() => connector.init({})).not.toThrow();
    expect(connector.init({})).toBeUndefined();
    expect(connector.init(undefined)).toBeUndefined();
  });
});

describe("GA4 connector handle() (spec 014-03 AC1 — bridge + per-tracker fan-out)", () => {
  it("bridges the AirlockEvent shape (event.params) to mapToMp's legacy {type,params} descriptor", () => {
    const connector = createGa4Connector(baseConfig());

    const requests = connector.handle({
      seq: 1, type: "page_view", ts: 10,
      params: { page_location: "https://spike.example/" },
      payload: {}, snapshot: {},
    });

    expect(requests).toHaveLength(2); // trackers: 2
    expect(JSON.parse(requests[0].body)).toEqual(
      mapToMp({ type: "page_view", params: { page_location: "https://spike.example/" } }, ctx),
    );
  });

  it("also bridges via event.payload when params is absent (the contract-shaped AirlockEvent path)", () => {
    const connector = createGa4Connector({ ...baseConfig(), trackers: 1, endpoints: [endpoints[0]] });

    const requests = connector.handle({
      seq: 1, type: "custom_event", ts: 10, payload: { foo: "bar" }, snapshot: {},
    });

    expect(JSON.parse(requests[0].body).events[0].params.foo).toBe("bar");
  });

  it("fans out ONE EgressRequest per tracker: url=endpoints[t], body=JSON-stringified mapToMp output", () => {
    const connector = createGa4Connector(baseConfig());

    const requests = connector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } });

    expect(requests.map((r) => r.url)).toEqual(endpoints);
    for (const r of requests) {
      const body = JSON.parse(r.body);
      expect(body.client_id).toBe(ctx.clientId);
      expect(body.events[0].name).toBe("page_view");
    }
  });

  it("propagates a mapToMp throw (e.g. a malformed purchase) OUT of handle — no partial requests for ANY tracker", () => {
    const connector = createGa4Connector(baseConfig());
    // missing transaction_id — mapToMp/validatePurchase throws (spec 008).
    const badPurchase = { type: "purchase", params: { currency: "USD", value: 42.5, items: [{ item_id: "SKU_1" }] } };

    expect(() => connector.handle(badPurchase)).toThrow(/transaction_id/);
  });
});

describe("GA4 connector hosted via createConnectorHost (spec 014-03 AC1/AC4 — same mechanism as alloy)", () => {
  it("routes a batch through routeBatch, producing the {ready, dropped} shape mapBatch used to produce", async () => {
    const host = createConnectorHost(createGa4Connector, baseConfig());
    await host.init({});

    const { ready, dropped } = await host.routeBatch([
      { type: "page_view", params: { page_location: "https://spike.example/" } },
    ]);

    expect(dropped).toEqual([]);
    expect(ready).toHaveLength(2);
    expect(ready[0].url).toBe(endpoints[0]);
  });

  it("a throwing event is contained (dropped[]) by the HOST, not a bespoke GA4-only try/catch", async () => {
    const host = createConnectorHost(createGa4Connector, baseConfig());
    await host.init({});
    const badPurchase = { type: "purchase", params: { currency: "USD", value: 42.5, items: [{ item_id: "SKU_1" }] } };

    const { ready, dropped } = await host.routeBatch([badPurchase]);

    expect(ready).toEqual([]);
    expect(dropped).toEqual([{ index: 0, type: "purchase", reason: expect.stringMatching(/transaction_id/) }]);
  });
});
