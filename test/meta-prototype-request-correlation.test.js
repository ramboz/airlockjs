import { describe, expect, it, vi } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";

const endpoint = "http://127.0.0.1:43210/tr/";
const pixel = "000000000000000";
const otherPixel = "000000000000001";
const context = {
  pageURL: "https://example.test/", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: -420,
};

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

function result(chamber, summary) {
  chamber.emit({ type: "result", summary, ready: [] });
}

function requestParams(multi) {
  const params = new URLSearchParams({
    id: pixel, ev: "PageView", dl: context.pageURL, rl: context.referrer,
    if: String(context.inFrame), sw: String(context.screenWidth),
    sh: String(context.screenHeight), tz: String(context.timezoneOffset),
  });
  if (multi) params.append("cd[value]", "12");
  return params;
}

function settledSummary(multi, disposition = "transport-settled") {
  const status = disposition === "held" ? 0 : 204;
  const reason = disposition === "held" ? { reason: "held-at-seal" } : {};
  return multi
    ? { seq: 2, disposition, requests: 1, selected: 1, branches: [{ ordinal: 1, disposition, status, ...reason }] }
    : { seq: 2, disposition, requests: 1, status, ...reason };
}

describe("known local prototype request-correlation gap", () => {
  it.each([
    ["event", (params) => params.set("ev", "Purchase")],
    ["target", (params) => params.set("id", otherPixel)],
    ["event data", (params) => params.set("cd[value]", "99")],
    ["additional field", (params) => params.append("cd[injected]", "synthetic")],
    ["duplicate event", (params) => params.append("ev", "Purchase")],
  ])("currently dispatches a forged %s despite a matching worker summary", async (_label, mutate) => {
    for (const multi of [false, true]) {
      const chamber = fakeChamber();
      const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
      const adapter = createMetaPixelPrototype({
        endpoint, chamber, fetchImpl, captureContext: () => context, consent: { ad_storage: "granted" },
        experimentalRouting: multi, experimentalMultiPixelRouting: multi, experimentalPageViewData: multi,
      });
      try {
        await Promise.resolve();
        adapter.fbq("init", pixel);
        result(chamber, { seq: 1, disposition: "initialized", requests: 0 });
        await adapter.flush();
        const args = multi ? ["trackSingle", pixel, "PageView", { value: 12 }] : ["track", "PageView"];
        adapter.fbq(...args);
        const active = chamber.sent.filter((message) => message.type === "event").at(-1).event;
        expect(active.payload.args).toEqual(args);
        expect(active.payload.context).toEqual(context);

        const params = requestParams(multi);
        const expected = params.toString();
        mutate(params);
        expect(params.toString()).not.toBe(expected);
        const forgedUrl = `${endpoint}?${params}`;
        chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: forgedUrl });
        await vi.waitFor(() => expect(chamber.sent).toContainEqual(expect.objectContaining({
          type: "intercepted-fetch-response", id: 1, status: 204,
        })));
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(fetchImpl.mock.calls[0][0]).toBe(forgedUrl);
        result(chamber, settledSummary(multi));
        const state = await adapter.flush();
        expect(state).toMatchObject({ phase: "ready", terminalReason: null, host: { dispatchAttempts: 1 } });
        expect(state.outcomes.at(-1)).toMatchObject({ seq: 2, disposition: "transport-settled", requests: 1 });
        expect(JSON.stringify(state)).not.toContain(pixel);
        expect(JSON.stringify(state)).not.toContain(otherPixel);
      } finally { await adapter.dispose(); }
    }
  });

  it.each(["host", "tag"])("still holds a forged request on %s consent denial without replay", async (denial) => {
    const chamber = fakeChamber();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const adapter = createMetaPixelPrototype({
      endpoint, chamber, fetchImpl, captureContext: () => context,
      consent: { ad_storage: denial === "host" ? "denied" : "granted" },
      experimentalRouting: true, experimentalMultiPixelRouting: true, experimentalTagConsent: true,
    });
    try {
      await Promise.resolve();
      adapter.fbq("init", pixel);
      result(chamber, { seq: 1, disposition: "initialized", requests: 0 });
      await adapter.flush();
      if (denial === "tag") {
        adapter.fbq("consent", "revoke");
        result(chamber, { seq: 2, disposition: "consent-updated", requests: 0 });
        await adapter.flush();
      }
      adapter.fbq("track", "PageView");
      const params = requestParams(false);
      params.set("ev", "Purchase");
      chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: `${endpoint}?${params}` });
      await vi.waitFor(() => expect(chamber.sent).toContainEqual(expect.objectContaining({
        type: "intercepted-fetch-response", id: 1, status: 0,
      })));
      const seq = denial === "tag" ? 3 : 2;
      result(chamber, { ...settledSummary(true, "held"), seq });
      const state = await adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({ seq, disposition: "held" });
      expect(state.host).toMatchObject({ dispatchAttempts: 0, consentHeld: 1 });
      expect(fetchImpl).not.toHaveBeenCalled();

      if (denial === "host") adapter.setConsent({ ad_storage: "granted" });
      else {
        adapter.fbq("consent", "grant");
        result(chamber, { seq: 4, disposition: "consent-updated", requests: 0 });
      }
      await adapter.flush();
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
  });
});
