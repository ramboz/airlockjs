// GA4 gtag connector -> Connector wrapper — spec 041-01 AC1. Mirrors
// test/ga4-connector.test.js's own manifest/init/hosted-via-createConnectorHost
// shape, adapted to gtag's single-event `/g/collect` GET (no per-tracker
// fan-out, no vendor-config `body` — a query-string GET instead).
import { describe, it, expect } from "vitest";
import { createGa4GtagConnector, GA4_GTAG_COLLECT_ENDPOINT } from "../connectors/ga4/gtag.js";
import { createConnectorHost } from "../core/connector-host.js";

const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };
const baseConfig = () => ({ measurementId: "G-XXXX", ctx });

describe("GA4 gtag connector manifest (spec 041-01 AC1)", () => {
  it("declares name/events (catch-all) + EMPTY reads (no projection), requests cookies + egress", () => {
    const { manifest } = createGa4GtagConnector(baseConfig());

    expect(manifest.name).toBe("airlock/ga4-gtag");
    expect(manifest.events).toEqual(["*"]);
    expect(manifest.reads).toEqual([]);
    expect(manifest.capabilities.cookies).toEqual(["_ga", "_ga_"]);
    expect(manifest.capabilities.egress).toBe(true);
  });

  it("declares the resolved /g/collect endpoint (advisory, ADR-0006)", () => {
    const { manifest } = createGa4GtagConnector(baseConfig());
    expect(manifest.endpoints).toEqual([GA4_GTAG_COLLECT_ENDPOINT]);
  });

  it("an explicit endpoint override crosses into the manifest verbatim", () => {
    const { manifest } = createGa4GtagConnector({ ...baseConfig(), endpoint: "https://region.example/g/collect" });
    expect(manifest.endpoints).toEqual(["https://region.example/g/collect"]);
  });

  it("declares purposes (ADR-0007) tagging egress + the endpoint + cookies as analytics_storage ONLY", () => {
    const { manifest } = createGa4GtagConnector(baseConfig());

    expect(manifest.purposes.egress).toEqual(["analytics_storage"]);
    expect(manifest.purposes.endpoints[GA4_GTAG_COLLECT_ENDPOINT]).toEqual(["analytics_storage"]);
    expect(manifest.purposes.cookies).toEqual({
      _ga: ["analytics_storage"],
      _ga_: ["analytics_storage"],
    });
  });
});

describe("GA4 gtag connector init() (spec 041-01 AC1)", () => {
  it("is a synchronous no-op that never throws — gtag has no SDK to boot (contract conformance only)", () => {
    const connector = createGa4GtagConnector(baseConfig());
    expect(() => connector.init({})).not.toThrow();
    expect(connector.init({})).toBeUndefined();
    expect(connector.init(undefined)).toBeUndefined();
  });
});

describe("GA4 gtag connector handle() stays UNCHANGED (spec 041-01 AC1)", () => {
  it("still returns a single-element EgressRequest[] carrying the /g/collect GET", () => {
    const connector = createGa4GtagConnector(baseConfig());
    const requests = connector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } });

    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("GET");
    const url = new URL(requests[0].url);
    expect(url.origin + url.pathname).toBe(GA4_GTAG_COLLECT_ENDPOINT);
    expect(url.searchParams.get("tid")).toBe("G-XXXX");
    expect(url.searchParams.get("cid")).toBe(ctx.clientId);
    expect(url.searchParams.get("sid")).toBe(String(ctx.sessionId));
  });
});

describe("GA4 gtag connector hosted via createConnectorHost (spec 041-01 AC1 — same mechanism as GA4-MP/alloy)", () => {
  it("routes a batch through routeBatch, producing the {ready, dropped} shape with the /g/collect GET", async () => {
    const host = createConnectorHost(createGa4GtagConnector, baseConfig());
    await host.init({});

    const { ready, dropped } = await host.routeBatch([
      { type: "page_view", params: { page_location: "https://spike.example/" } },
    ]);

    expect(dropped).toEqual([]);
    expect(ready).toHaveLength(1);
    expect(ready[0].method).toBe("GET");
    const url = new URL(ready[0].url);
    expect(url.origin + url.pathname).toBe(GA4_GTAG_COLLECT_ENDPOINT);
    expect(url.searchParams.get("v")).toBe("2");
    expect(url.searchParams.get("tid")).toBe("G-XXXX");
    expect(url.searchParams.get("cid")).toBe(ctx.clientId);
    expect(url.searchParams.get("sid")).toBe(String(ctx.sessionId));
  });

  it("exposes the manifest via the host, matching the connector's own", () => {
    const host = createConnectorHost(createGa4GtagConnector, baseConfig());
    expect(host.manifest.name).toBe("airlock/ga4-gtag");
  });
});
