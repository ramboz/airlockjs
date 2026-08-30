// Chamber per-descriptor isolation — spec 009-01, PORTED onto the generic
// connector host (spec 014-03 — connector-hosting convergence).
//
// core/chamber.worker.js's old hardcoded `mapBatch(batch, cfg)` is retired
// (014-03 AC1/AC4): GA4 is now hosted by createConnectorHost(createGa4Connector,
// cfg), the SAME mechanism alloy's chamber uses. This file pins the exact same
// ADR-0001 containment invariant `mapBatch` used to pin — a throwing descriptor
// (spec 008: a contract-invalid `purchase`) drops only ITSELF, reported via
// `dropped[]`, and the chamber survives to map a later batch normally — now
// against `routeBatch` (async; mapBatch was sync), with byte-identical
// `{ready, dropped}` output.
import { describe, it, expect } from "vitest";
import { createConnectorHost } from "../core/connector-host.js";
import { createGa4Connector } from "../connectors/ga4/connector.js";

const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };
const endpoints = ["https://t0.example/collect", "https://t1.example/collect"];
const cfg = { trackers: 2, workFactor: 0, endpoints, ctx };

const pageView = { type: "page_view", params: { page_location: "https://example.com/" } };
// missing transaction_id — mapToMp/validatePurchase throws (spec 008).
const badPurchase = { type: "purchase", params: { currency: "USD", value: 42.5, items: [{ item_id: "SKU_1" }] } };
const validPurchase = {
  type: "purchase",
  params: { transaction_id: "T-1", currency: "USD", value: 42.5, items: [{ item_id: "SKU_1" }] },
};

/** Build a fresh GA4 chamber host — mirrors core/chamber.worker.js's own wiring
 *  on an "init" message — and route ONE batch through it. */
async function routeGa4Batch(batch, config = cfg) {
  const host = createConnectorHost(createGa4Connector, config);
  await host.init({});
  return host.routeBatch(batch);
}

describe("chamber per-descriptor isolation (spec 009-01, via the generic host — 014-03)", () => {
  it("AC1: a throwing descriptor drops only itself; the rest of the batch survives", async () => {
    const { ready } = await routeGa4Batch([pageView, badPurchase, pageView]);

    // both page_views mapped × 2 trackers each; no request for the purchase.
    expect(ready.length).toBe(2 * cfg.trackers);
    for (const req of ready) {
      const body = JSON.parse(req.body);
      expect(body.events[0].name).toBe("page_view");
    }
  });

  it("AC2: the dropped descriptor is recorded with its type and the thrown reason", async () => {
    const { dropped } = await routeGa4Batch([pageView, badPurchase, pageView]);

    expect(dropped.length).toBe(1);
    expect(dropped[0].type).toBe("purchase");
    expect(dropped[0].reason).toMatch(/transaction_id/);
  });

  it("AC3: the chamber survives — a subsequent all-valid batch maps normally on the SAME host", async () => {
    const host = createConnectorHost(createGa4Connector, cfg);
    await host.init({});

    // first cycle contains a throwing descriptor
    await host.routeBatch([pageView, badPurchase]);

    // a following cycle, all valid — proves routeBatch (and by extension the
    // onmessage handler that delegates to it) did not die on the prior throw.
    const second = await host.routeBatch([pageView, validPurchase]);

    expect(second.ready.length).toBe(2 * cfg.trackers);
    expect(second.dropped.length).toBe(0);
  });

  it("AC4: an all-valid batch is unaffected — same ready shape, empty dropped (regression guard)", async () => {
    const { ready, dropped } = await routeGa4Batch([pageView, validPurchase]);

    expect(dropped).toEqual([]);
    expect(ready.length).toBe(2 * cfg.trackers);

    const [pv0, pv1, pur0, pur1] = ready;
    expect(pv0.url).toBe(endpoints[0]);
    expect(pv1.url).toBe(endpoints[1]);
    expect(JSON.parse(pv0.body).events[0].name).toBe("page_view");
    expect(pur0.url).toBe(endpoints[0]);
    expect(pur1.url).toBe(endpoints[1]);
    const purBody = JSON.parse(pur0.body);
    expect(purBody.events[0].name).toBe("purchase");
    expect(purBody.events[0].params.transaction_id).toBe("T-1");
    expect(purBody.client_id).toBe(ctx.clientId);
    expect(purBody.events[0].params.session_id).toBe(String(ctx.sessionId));
  });
});
