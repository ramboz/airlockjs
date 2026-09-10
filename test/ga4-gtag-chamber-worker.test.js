// The gtag chamber worker's glue — spec 041-01 AC2. Mirrors
// core/pixel-chamber.worker.js's shape (init strips the discriminant ->
// createConnectorHost(createGa4GtagConnector, config) + host.init({}); events
// -> routeBatch -> postMessage({ready, dropped})). The worker file guards its
// own wiring behind `typeof self !== "undefined"` (vitest's default node env
// has none), so this test supplies a fake `self` BEFORE a fresh dynamic
// import — the same self-stub + vi.resetModules() technique that exercises
// the REAL file's onmessage logic directly (not just the createConnectorHost
// core it wraps), proven against the existing core/pixel-chamber.worker.js
// during this slice's spike.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GA4_GTAG_COLLECT_ENDPOINT } from "../connectors/ga4/gtag.js";

const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };

describe("core/ga4-gtag-chamber.worker.js — init -> events -> {ready, dropped} (spec 041-01 AC2)", () => {
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
    await import("../core/ga4-gtag-chamber.worker.js");
    expect(typeof fakeSelf.onmessage).toBe("function");
  });

  it("init strips the discriminant + boots the connector; events routes a page_view to the /g/collect GET", async () => {
    await import("../core/ga4-gtag-chamber.worker.js");

    fakeSelf.onmessage({ data: { type: "init", measurementId: "G-XXXX", ctx } });
    fakeSelf.onmessage({
      data: { type: "events", batch: [{ type: "page_view", params: { page_location: "https://spike.example/" } }] },
    });

    // routeBatch resolves asynchronously (host.init()/routeBatch are Promises) —
    // flush past the microtask queue with a macrotask boundary (a `Promise.resolve()`
    // count is fragile against the exact number of internal .then() hops).
    await new Promise((r) => setTimeout(r, 0));

    expect(fakeSelf.postMessage).toHaveBeenCalledTimes(1);
    const [{ ready, dropped }] = fakeSelf.postMessage.mock.calls[0];
    expect(dropped).toEqual([]);
    expect(ready).toHaveLength(1);
    expect(ready[0].method).toBe("GET");
    const url = new URL(ready[0].url);
    expect(url.origin + url.pathname).toBe(GA4_GTAG_COLLECT_ENDPOINT);
    expect(url.searchParams.get("tid")).toBe("G-XXXX");
    expect(url.searchParams.get("cid")).toBe(ctx.clientId);
  });

  it("a batch-routing failure posts the {ready: [], dropped: [__batch__]} backstop shape", async () => {
    await import("../core/ga4-gtag-chamber.worker.js");

    fakeSelf.onmessage({ data: { type: "init", measurementId: "G-XXXX", ctx } });
    // A non-array batch makes routeBatch's `for...of` throw synchronously inside
    // the host's own try, but the batch itself is malformed at the TOP level
    // (not per-event) — mirrors the pixel chamber's own top-level backstop,
    // unreachable in production (airlock.js always posts a real array) but
    // proven here so the backstop path is not a dead, silently-broken branch.
    fakeSelf.onmessage({ data: { type: "events", batch: null } });

    await new Promise((r) => setTimeout(r, 0));

    expect(fakeSelf.postMessage).toHaveBeenCalledTimes(1);
    const [msg] = fakeSelf.postMessage.mock.calls[0];
    expect(msg.ready).toEqual([]);
    expect(msg.dropped).toEqual([{ index: -1, type: "__batch__", reason: expect.any(String) }]);
  });
});
