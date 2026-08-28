// Chamber per-descriptor isolation — spec 009 slice 009-01.
//
// The chamber (core/chamber.worker.js) maps a batch of captured descriptors
// off the main thread. Before this slice, a throwing `mapToMp` (spec 008: a
// contract-invalid `purchase`) took down the WHOLE batch — one bad event
// silently dropped every good event alongside it. This tests the extracted,
// pure `mapBatch(batch, cfg)` that isolates the throw to its own descriptor
// (ADR-0001 containment) and reports it via `dropped[]` instead of losing it.
import { describe, it, expect } from "vitest";
import { mapBatch } from "../core/chamber.worker.js";

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

describe("chamber per-descriptor isolation (spec 009-01)", () => {
  it("AC1: a throwing descriptor drops only itself; the rest of the batch survives", () => {
    const { ready } = mapBatch([pageView, badPurchase, pageView], cfg);

    // both page_views mapped × 2 trackers each; no request for the purchase.
    expect(ready.length).toBe(2 * cfg.trackers);
    for (const req of ready) {
      const body = JSON.parse(req.body);
      expect(body.events[0].name).toBe("page_view");
    }
  });

  it("AC2: the dropped descriptor is recorded with its type and the thrown reason", () => {
    const { dropped } = mapBatch([pageView, badPurchase, pageView], cfg);

    expect(dropped.length).toBe(1);
    expect(dropped[0].type).toBe("purchase");
    expect(dropped[0].reason).toMatch(/transaction_id/);
  });

  it("AC3: the chamber survives — a subsequent all-valid batch maps normally", () => {
    // first cycle contains a throwing descriptor
    mapBatch([pageView, badPurchase], cfg);

    // a following cycle, all valid — proves mapBatch (and by extension the
    // onmessage handler that delegates to it) did not die on the prior throw.
    const second = mapBatch([pageView, validPurchase], cfg);

    expect(second.ready.length).toBe(2 * cfg.trackers);
    expect(second.dropped.length).toBe(0);
  });

  it("AC4: an all-valid batch is unaffected — same ready shape, empty dropped (regression guard)", () => {
    const { ready, dropped } = mapBatch([pageView, validPurchase], cfg);

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
