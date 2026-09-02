// Generic pixel connector — spec 026-01 AC1/AC2 (the archetype proof).
//
// createPixelConnector(config) is the vendor-NEUTRAL wire-protocol connector
// (contracts/connector.d.ts: manifest -> factory -> init -> handle) that
// generalizes GA4's bespoke mapToMp into a DECLARATIVE interpreter: it reads
// `{ endpoint, eventMap, paramMap }` off the config and produces a GET
// EgressRequest, with NO vendor-specific code inside connectors/pixel/connector.js
// itself. Meta's specifics (the /tr endpoint, its PageView/Lead event names, its
// id/ev/value/currency query-param shape) live entirely in the config fixture
// (connectors/pixel/vendors/meta.js) — proven here by ALSO running an unrelated
// fake-vendor config through the SAME connector code (AC1's strongest proof: two
// wildly different wire shapes from the SAME connector, config-driven only).
//
// AC2 is table-driven deliberately (not one hardcoded expected object) — the
// point is proving the INTERPRETER-on-config, not a single golden output.
import { describe, it, expect } from "vitest";
import { createPixelConnector } from "../connectors/pixel/connector.js";
import { createConnectorHost } from "../core/connector-host.js";
import { createMetaPixelConfig, SYNTHETIC_META_PIXEL_ID, META_TR_ENDPOINT } from "../connectors/pixel/vendors/meta.js";

describe("createPixelConnector manifest (AC1)", () => {
  it("declares name/events derived from the config's eventMap keys — no wildcard, no hardcoded vendor names", () => {
    const { manifest } = createPixelConnector(createMetaPixelConfig());
    expect(manifest.name).toBe("airlock/pixel/meta");
    expect(manifest.events.sort()).toEqual(["lead", "page_view"]);
  });

  it("declares EMPTY reads — a pixel connector maps event.params only, never a projection snapshot field", () => {
    const { manifest } = createPixelConnector(createMetaPixelConfig());
    expect(manifest.reads).toEqual([]);
  });

  it("requests egress but NO cookie capability — identity-honest by construction (AC9 structural half)", () => {
    const { manifest } = createPixelConnector(createMetaPixelConfig());
    expect(manifest.capabilities.egress).toBe(true);
    expect(manifest.capabilities.cookies).toBeUndefined();
  });

  it("declares its ADVISORY endpoint + purposes from the config (ADR-0006/0007) — host allow-list still wins at the seal", () => {
    const { manifest } = createPixelConnector(createMetaPixelConfig());
    expect(manifest.endpoints).toEqual([META_TR_ENDPOINT]);
    expect(manifest.purposes.egress).toEqual(["ad_storage"]);
    expect(manifest.purposes.endpoints[META_TR_ENDPOINT]).toEqual(["ad_storage"]);
  });
});

describe("createPixelConnector init() (AC1)", () => {
  it("is a synchronous no-op that never throws — no vendor SDK to boot", () => {
    const connector = createPixelConnector(createMetaPixelConfig());
    expect(() => connector.init({})).not.toThrow();
    expect(connector.init({})).toBeUndefined();
  });
});

describe("createPixelConnector handle() — the declarative interpreter (AC1)", () => {
  it("an UNRELATED fake-vendor config produces a COMPLETELY different wire shape from the SAME connector code", () => {
    const acmeConfig = {
      name: "airlock/pixel/acme",
      endpoint: "https://acme.example/beacon",
      eventMap: { conversion: "conv" },
      paramMap: {
        pid: { from: "static", value: "ACME-SYNTHETIC-123" },
        t: { from: "event" },
        amt: { from: "params", key: "amount" },
      },
    };
    const connector = createPixelConnector(acmeConfig);

    const requests = connector.handle({ type: "conversion", params: { amount: 42 } });

    expect(requests).toHaveLength(1);
    const [req] = requests;
    expect(req.method).toBe("GET");
    expect(req.body).toBeUndefined();
    const url = new URL(req.url);
    expect(url.origin + url.pathname).toBe("https://acme.example/beacon");
    expect(url.searchParams.get("pid")).toBe("ACME-SYNTHETIC-123");
    expect(url.searchParams.get("t")).toBe("conv");
    expect(url.searchParams.get("amt")).toBe("42");
    // Meta's OWN query-key vocabulary never leaks into an unrelated vendor's beacon —
    // proof that "id"/"ev" are config-supplied, not hardcoded in the connector.
    expect(url.searchParams.has("id")).toBe(false);
    expect(url.searchParams.has("ev")).toBe(false);
  });

  it("an event type absent from the config's eventMap maps to ZERO requests (never throws, never a partial beacon)", () => {
    const connector = createPixelConnector(createMetaPixelConfig());
    expect(connector.handle({ type: "add_to_cart", params: {} })).toEqual([]);
  });
});

describe("AC2 — Meta maps to a correct GET EgressRequest (table-driven — the interpreter, not a hardcoded output)", () => {
  const pixelId = SYNTHETIC_META_PIXEL_ID;
  const connector = createPixelConnector(createMetaPixelConfig({ pixelId }));

  const table = [
    {
      name: "PageView with no extra params",
      event: { type: "page_view", params: {} },
      expectEv: "PageView",
      expectParams: {},
      absentParams: ["value", "currency", "content_name", "content_category"],
    },
    {
      name: "Lead with value + currency",
      event: { type: "lead", params: { value: 25, currency: "USD" } },
      expectEv: "Lead",
      expectParams: { value: "25", currency: "USD" },
      absentParams: ["content_name", "content_category"],
    },
    {
      name: "Lead with the full standard param set",
      event: {
        type: "lead",
        params: { value: 10, currency: "EUR", content_name: "Newsletter", content_category: "signup" },
      },
      expectEv: "Lead",
      expectParams: { value: "10", currency: "EUR", content_name: "Newsletter", content_category: "signup" },
      absentParams: [],
    },
    {
      name: "the contract-shaped AirlockEvent form (event.payload, not event.params)",
      event: { type: "lead", payload: { value: 5, currency: "GBP" }, snapshot: {} },
      expectEv: "Lead",
      expectParams: { value: "5", currency: "GBP" },
      absentParams: ["content_name", "content_category"],
    },
  ];

  it.each(table)("$name", ({ event, expectEv, expectParams, absentParams }) => {
    const requests = connector.handle(event);
    expect(requests).toHaveLength(1);
    const [req] = requests;

    expect(req.method).toBe("GET");
    expect(req.body).toBeUndefined(); // GET — no body (AC1/AC4's contract)

    const url = new URL(req.url);
    expect(url.origin + url.pathname).toBe(META_TR_ENDPOINT);
    expect(url.searchParams.get("id")).toBe(pixelId);
    expect(url.searchParams.get("ev")).toBe(expectEv);
    for (const [key, value] of Object.entries(expectParams)) {
      expect(url.searchParams.get(key)).toBe(value);
    }
    for (const key of absentParams) {
      expect(url.searchParams.has(key)).toBe(false);
    }
  });
});

describe("createPixelConnector hosted via createConnectorHost (AC3 — same generic host GA4/alloy use)", () => {
  it("routes a batch through routeBatch, producing the {ready, dropped} shape", async () => {
    const host = createConnectorHost(createPixelConnector, createMetaPixelConfig());
    await host.init({});

    const { ready, dropped } = await host.routeBatch([
      { type: "page_view", params: {} },
      { type: "lead", params: { value: 1, currency: "USD" } },
    ]);

    expect(dropped).toEqual([]);
    expect(ready).toHaveLength(2);
    for (const r of ready) {
      expect(r.method).toBe("GET");
      expect(r.url.startsWith(META_TR_ENDPOINT)).toBe(true);
    }
  });
});
