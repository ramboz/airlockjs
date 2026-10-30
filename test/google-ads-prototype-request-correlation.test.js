import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";

const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";
const context = { pageURL: "https://example.test/", referrer: "" };

function fakeChamber() {
  let listener;
  const sent = [];
  return {
    sent,
    postMessage(message) {
      sent.push(message);
      if (message.type === "init") queueMicrotask(() => listener?.({ type: "phase", name: "configured" }));
    },
    onMessage(callback) { listener = callback; return () => { listener = undefined; }; },
    onError() { return () => {}; },
    emit(message) { listener?.(message); },
    dispose() {},
  };
}

describe("known local conversion request-correlation gap", () => {
  it.each([
    ["label", (query) => query.set("label", "OTHER")],
    ["value", (query) => query.set("value", "99")],
    ["transaction", (query) => query.set("oid", "other")],
    ["additional field", (query) => query.set("extra", "synthetic")],
    ["duplicate label", (query) => query.append("label", "OTHER")],
  ])("currently dispatches a forged %s with a plausible result", async (_label, mutate) => {
    for (const remarketing of [false, true]) {
      const chamber = fakeChamber();
      const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
      const adapter = createGoogleAdsPrototype({
        endpoint, chamber, fetchImpl, captureContext: () => context, consent: { ad_storage: "granted" },
        experimentalRetailViewItem: remarketing, experimentalRemarketingPurchase: remarketing,
      });
      try {
        const args = ["event", "conversion", {
          send_to: "AW-0000000000/SYNTHETIC_LABEL", value: 12, currency: "USD", transaction_id: "original",
        }];
        adapter.gtag(...args);
        await vi.waitFor(() => expect(chamber.sent.some((message) => message.type === "event")).toBe(true));
        const active = chamber.sent.find((message) => message.type === "event").event;
        expect(active.payload.args).toEqual(args);
        const query = new URLSearchParams({
          label: "SYNTHETIC_LABEL", value: "12", currency_code: "USD", oid: "original", url: context.pageURL,
        });
        const expected = query.toString();
        mutate(query);
        expect(query.toString()).not.toBe(expected);
        const forgedUrl = `${endpoint}?${query}`;
        chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: forgedUrl });
        await vi.waitFor(() => expect(chamber.sent).toContainEqual(expect.objectContaining({
          type: "intercepted-fetch-response", id: 1, status: 204,
        })));
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(fetchImpl.mock.calls[0][0]).toBe(forgedUrl);
        chamber.emit({
          type: "result", summary: { seq: active.seq, disposition: "transport-settled", requests: 1, status: 204 },
          ready: [],
        });
        const state = await adapter.flush();
        expect(state).toMatchObject({ phase: "ready", terminalReason: null, host: { dispatchAttempts: 1 } });
        expect(state.outcomes.at(-1)).toMatchObject({ disposition: "transport-settled", requests: 1 });
      } finally { await adapter.dispose(); }
    }
  });
});
