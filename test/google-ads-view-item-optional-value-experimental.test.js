import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";

const destination = "AW-0000000000";
const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";
const context = { pageURL: "https://example.test/optional-value", referrer: "" };
const variants = [
  { option: "experimentalRetailViewItem", item: { id: 1234, google_business_vertical: "retail" } },
  { option: "experimentalEducationViewItem", item: { id: "COURSE", google_business_vertical: "education" } },
  { option: "experimentalLocalViewItem", item: { id: "DEAL", google_business_vertical: "local" } },
  { option: "experimentalRealEstateViewItem", item: { id: "HOME", google_business_vertical: "real_estate" } },
  { option: "experimentalTravelViewItem", item: { destination: "JFK", google_business_vertical: "travel" } },
];

async function local(options, run) {
  let receiver, chamber, adapter, cause;
  try {
    receiver = await createConversionReceiver();
    chamber = createNodeConversionChamber();
    adapter = createGoogleAdsPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: () => context,
      consent: { ad_storage: "granted" }, ...options,
    });
    await run({ adapter, receiver, chamber });
  } catch (error) { cause = error; throw error; }
  finally {
    await closeConversionResources({ adapter, chamber, receiver, cause });
    if (chamber) expect(chamber.getState()).toEqual({ closing: true, closed: true });
    if (receiver) expect(receiver.getState()).toEqual({ listening: false, openSockets: 0 });
  }
}

describe("experimental view_item optional value", () => {
  it.each(variants)("$option omits absent/undefined value but retains zero without cross-event leakage", async (variant) => {
    await local({ [variant.option]: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("event", "view_item", { items: [variant.item], value: 12.5 });
      adapter.gtag("event", "view_item", { items: [variant.item] });
      adapter.gtag("event", "view_item", { items: [variant.item], value: 0 });
      const mutable = { items: [variant.item], value: undefined };
      adapter.gtag("event", "view_item", mutable);
      mutable.value = 999;
      adapter.gtag("event", "view_item", { items: [variant.item], value: 7 });
      expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition))
        .toEqual(["configured", ...Array.from({ length: 5 }, () => "transport-settled")]);
      const queries = receiver.arrivals.map(({ url }) => new URL(url).searchParams);
      expect(queries.map((query) => query.get("airlock_value"))).toEqual(["12.5", null, "0", null, "7"]);
      for (const query of queries) {
        expect(JSON.parse(query.get("airlock_items"))).toEqual([variant.item]);
        expect(query.getAll("airlock_value").length).toBe(query.has("airlock_value") ? 1 : 0);
        expect(query.has("label")).toBe(false);
      }
    });
  }, 8000);

  it("does not enable any view-item vertical by default", async () => {
    await local({}, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      for (const variant of variants) adapter.gtag("event", "view_item", { items: [variant.item] });
      expect((await adapter.flush()).outcomes.slice(1).every(({ disposition }) => disposition === "rejected")).toBe(true);
      expect(receiver.arrivals).toEqual([]);
    });
  }, 8000);

  it("keeps omitted, undefined and zero values separate when all verticals are enabled", async () => {
    const options = Object.fromEntries(variants.map(({ option }) => [option, true]));
    await local(options, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      for (const variant of variants) {
        adapter.gtag("event", "view_item", { items: [variant.item] });
        adapter.gtag("event", "view_item", { items: [variant.item], value: undefined });
        adapter.gtag("event", "view_item", { items: [variant.item], value: 0 });
      }
      expect((await adapter.flush()).outcomes.slice(1).every(({ disposition }) => disposition === "transport-settled")).toBe(true);
      expect(receiver.arrivals).toHaveLength(variants.length * 3);
      for (const [index, variant] of variants.entries()) {
        const queries = receiver.arrivals.slice(index * 3, index * 3 + 3).map(({ url }) => new URL(url).searchParams);
        expect(queries.map((query) => query.get("airlock_value"))).toEqual([null, null, "0"]);
        expect(queries.map((query) => JSON.parse(query.get("airlock_items")))).toEqual([
          [variant.item], [variant.item], [variant.item],
        ]);
      }
    });
  }, 8000);

  it.each(variants)("$option still applies the host and tag seals without replay", async (variant) => {
    await local({
      [variant.option]: true, experimentalConsentCommands: true, consent: { ad_storage: "denied" },
    }, async ({ adapter, receiver }) => {
      adapter.gtag("config", destination);
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("event", "view_item", { items: [variant.item] });
      adapter.gtag("event", "view_item", { items: [variant.item], value: undefined });
      expect((await adapter.flush()).outcomes.slice(-2).map(({ disposition }) => disposition)).toEqual(["held", "held"]);
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      adapter.gtag("event", "view_item", { items: [variant.item] });
      adapter.gtag("event", "view_item", { items: [variant.item], value: undefined });
      expect((await adapter.flush()).outcomes.slice(-2).map(({ disposition }) => disposition)).toEqual(["held", "held"]);
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "view_item", { items: [variant.item] });
      adapter.gtag("event", "view_item", { items: [variant.item], value: undefined });
      expect((await adapter.flush()).outcomes.slice(-2).map(({ disposition }) => disposition))
        .toEqual(["transport-settled", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(2);
      expect(receiver.arrivals.every(({ url }) => !new URL(url).searchParams.has("airlock_value"))).toBe(true);
    });
  }, 8000);

  it.each(variants.flatMap((variant) => ["absent", "undefined", "valid-zero", "injected", "dropped-zero"]
    .map((scenario) => ({ ...variant, scenario }))))(
    "$option correlates fake-worker $scenario", async ({ option, item, scenario }) => {
      let listener;
      const chamber = {
        sent: [],
        postMessage(message) {
          this.sent.push(message);
          if (message.type === "init") queueMicrotask(() => listener?.({ type: "phase", name: "configured" }));
          if (message.type === "intercepted-fetch-response") queueMicrotask(() => listener?.({
            type: "result", summary: { seq: 1, disposition: "transport-settled", requests: 1, status: 204 }, ready: [],
          }));
        },
        onMessage(callback) { listener = callback; return () => { listener = undefined; }; },
        onError() { return () => {}; },
        emit(message) { listener?.(message); },
        dispose() {},
      };
      const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
      const adapter = createGoogleAdsPrototype({
        endpoint, chamber, fetchImpl, captureContext: () => context, consent: { ad_storage: "granted" }, [option]: true,
      });
      try {
        const params = { items: [item] };
        if (scenario === "undefined") params.value = undefined;
        if (["valid-zero", "dropped-zero"].includes(scenario)) params.value = 0;
        adapter.gtag("event", "view_item", params);
        await vi.waitFor(() => expect(chamber.sent.some((message) => message.type === "event")).toBe(true));
        const query = new URLSearchParams({ airlock_event: "view_item", airlock_items: JSON.stringify([item]) });
        if (["valid-zero", "injected"].includes(scenario)) query.set("airlock_value", "0");
        chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: `${endpoint}?${query}` });
        const state = await adapter.flush();
        if (["absent", "undefined", "valid-zero"].includes(scenario)) {
          expect(state.outcomes.at(-1)).toMatchObject({ disposition: "transport-settled" });
          expect(fetchImpl).toHaveBeenCalledOnce();
        } else {
          expect(state).toMatchObject({ phase: "terminal", terminalReason: "request-correlation-failed" });
          expect(fetchImpl).not.toHaveBeenCalled();
        }
      } finally { await adapter.dispose(); }
    },
  );
});
