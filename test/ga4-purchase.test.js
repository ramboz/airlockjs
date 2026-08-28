// GA4 ecommerce `purchase` conversion event — spec 008.
//
// This is the ORACLE TARGET (the executable spec) for the servo agent-loop:
// the generic `mapToMp` already passes a valid purchase through unchanged, so
// the feature is VALIDATION — a `purchase` is GA4's key conversion and MUST
// carry transaction_id + currency + value + a non-empty items[] (GA4 MP
// ecommerce contract). `mapToMp` must reject a malformed purchase with a clear
// error naming the missing field, while leaving non-purchase events untouched.
//
// The runner implements that validation in connectors/ga4/map.js; the loop is
// green when every assertion below passes (oracle.sh at THRESHOLD=1.0).
import { describe, it, expect } from "vitest";
import { mapToMp } from "../connectors/ga4/map.js";

const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };
const items = [
  { item_id: "SKU_DEMO_1", item_name: "Demo Widget", price: 42.5, quantity: 1 },
];
const validPurchase = {
  type: "purchase",
  params: { transaction_id: "T-12345", currency: "USD", value: 42.5, items },
};

describe("GA4 purchase conversion event (spec 008)", () => {
  it("maps a valid purchase to an MP-conformant body (regression guard)", () => {
    const body = mapToMp(validPurchase, ctx);
    const ev = body.events[0];
    expect(ev.name).toBe("purchase");
    expect(ev.params.transaction_id).toBe("T-12345");
    expect(ev.params.currency).toBe("USD");
    expect(ev.params.value).toBe(42.5);
    expect(ev.params.items).toEqual(items);
    // session/engagement enrichment still applied (existing contract).
    expect(ev.params.session_id).toBe("1724668790");
    expect(typeof ev.params.engagement_time_msec).toBe("number");
  });

  it("throws when a purchase is missing transaction_id", () => {
    const bad = { type: "purchase", params: { currency: "USD", value: 42.5, items } };
    expect(() => mapToMp(bad, ctx)).toThrow(/transaction_id/);
  });

  it("throws when a purchase is missing currency", () => {
    const bad = { type: "purchase", params: { transaction_id: "T-1", value: 42.5, items } };
    expect(() => mapToMp(bad, ctx)).toThrow(/currency/);
  });

  it("throws when a purchase is missing value", () => {
    const bad = { type: "purchase", params: { transaction_id: "T-1", currency: "USD", items } };
    expect(() => mapToMp(bad, ctx)).toThrow(/value/);
  });

  it("throws when a purchase value is negative (a refund is a separate event)", () => {
    const bad = { type: "purchase", params: { transaction_id: "T-1", currency: "USD", value: -5, items } };
    expect(() => mapToMp(bad, ctx)).toThrow(/value/);
  });

  it("allows a zero-value purchase (free / fully-discounted order)", () => {
    const free = { type: "purchase", params: { transaction_id: "T-FREE", currency: "USD", value: 0, items } };
    expect(() => mapToMp(free, ctx)).not.toThrow();
    expect(mapToMp(free, ctx).events[0].params.value).toBe(0);
  });

  it("throws when a purchase has an empty or missing items[]", () => {
    const noItems = { type: "purchase", params: { transaction_id: "T-1", currency: "USD", value: 42.5 } };
    const emptyItems = { type: "purchase", params: { transaction_id: "T-1", currency: "USD", value: 42.5, items: [] } };
    expect(() => mapToMp(noItems, ctx)).toThrow(/items/);
    expect(() => mapToMp(emptyItems, ctx)).toThrow(/items/);
  });

  it("leaves a non-purchase event (page_view) untouched by purchase validation", () => {
    const pageView = { type: "page_view", params: { page_location: "https://example.com/" } };
    // No throw, maps generically — validation is purchase-scoped.
    const body = mapToMp(pageView, ctx);
    expect(body.events[0].name).toBe("page_view");
    expect(body.events[0].params.page_location).toBe("https://example.com/");
  });
});
