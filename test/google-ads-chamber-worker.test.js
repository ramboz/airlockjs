// The google-ads chamber worker's glue — spec 048-01 AC1. Mirrors
// test/ga4-gtag-chamber-worker.test.js's shape (init strips the discriminant ->
// createConnectorHost(createGoogleAdsConnector, config) + host.init({}); events ->
// routeBatch -> postMessage({ready, dropped})). The worker file guards its own wiring
// behind `typeof self !== "undefined"` (vitest's default node env has none), so this
// test supplies a fake `self` BEFORE a fresh dynamic import — the same self-stub +
// vi.resetModules() technique the gtag/pixel chamber tests use.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GOOGLE_ADS_CCM_COLLECT_ENDPOINT } from "../connectors/google-ads/connector.js";

const ctx = { consent: { ad_storage: "granted", analytics_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" } };

describe("core/google-ads-chamber.worker.js — init -> events -> {ready, dropped} (spec 048-01 AC1)", () => {
  let fakeSelf;

  beforeEach(() => {
    fakeSelf = { postMessage: vi.fn() };
    globalThis.self = fakeSelf;
    vi.resetModules();
  });

  afterEach(() => {
    delete globalThis.self;
  });

  it("wires self.onmessage when imported inside a worker-like global", async () => {
    await import("../core/google-ads-chamber.worker.js");
    expect(typeof fakeSelf.onmessage).toBe("function");
  });

  it("init strips the discriminant + boots the connector; events routes a page_view to the ccm/collect GET", async () => {
    await import("../core/google-ads-chamber.worker.js");

    fakeSelf.onmessage({ data: { type: "init", conversionId: "AW-1234567890", ctx } });
    fakeSelf.onmessage({
      data: { type: "events", batch: [{ type: "page_view", params: { page_location: "https://spike.example/" } }] },
    });

    // routeBatch resolves asynchronously (host.init()/routeBatch are Promises) — flush
    // past the microtask queue with a macrotask boundary (mirrors the gtag chamber test).
    await new Promise((r) => setTimeout(r, 0));

    expect(fakeSelf.postMessage).toHaveBeenCalledTimes(1);
    const [{ ready, dropped }] = fakeSelf.postMessage.mock.calls[0];
    expect(dropped).toEqual([]);
    expect(ready).toHaveLength(1);
    expect(ready[0].method).toBe("GET");
    const url = new URL(ready[0].url);
    expect(url.origin + url.pathname).toBe(GOOGLE_ADS_CCM_COLLECT_ENDPOINT);
    expect(url.searchParams.get("tid")).toBe("AW-1234567890");
    expect(url.searchParams.get("en")).toBe("page_view");
  });

  it("a batch-routing failure posts the {ready: [], dropped: [__batch__]} backstop shape", async () => {
    await import("../core/google-ads-chamber.worker.js");

    fakeSelf.onmessage({ data: { type: "init", conversionId: "AW-1234567890", ctx } });
    // A non-array batch makes routeBatch's `for...of` throw synchronously inside the
    // host's own try, mirroring the gtag/pixel chambers' own top-level backstop —
    // unreachable in production (airlock.js always posts a real array) but proven here
    // so the backstop path is not a dead, silently-broken branch.
    fakeSelf.onmessage({ data: { type: "events", batch: null } });

    await new Promise((r) => setTimeout(r, 0));

    expect(fakeSelf.postMessage).toHaveBeenCalledTimes(1);
    const [msg] = fakeSelf.postMessage.mock.calls[0];
    expect(msg.ready).toEqual([]);
    expect(msg.dropped).toEqual([{ index: -1, type: "__batch__", reason: expect.any(String) }]);
  });
});
