// The floodlight chamber worker's glue — spec 048-02 AC1. Mirrors
// test/google-ads-chamber-worker.test.js's shape (init strips the discriminant ->
// createConnectorHost(createFloodlightConnector, config) + host.init({}); events -> routeBatch ->
// postMessage({ready, dropped})). The worker file guards its own wiring behind `typeof self !==
// "undefined"` (vitest's default node env has none), so this test supplies a fake `self` BEFORE a fresh
// dynamic import — the same self-stub + vi.resetModules() technique the gtag/pixel/google-ads chamber
// tests use.
//
// A1-floodlight (spec 048-02): BOTH DC beacon forms (ccm/collect always, the `;`-matrix activity
// opt-in on `src`) route through this ONE chamber — proven below by driving the SAME chamber with and
// without an activity identity configured.
//
// WIRE SHAPE (048-02 deviation from the google-ads/gtag mirror): the floodlight connector's OWN config
// carries a field literally named `type` (the Floodlight-native activity tag, e.g. "grptag00") — this
// COLLIDES with the init message's `type:"init"` discriminant if spread at the top level (last-key-wins
// would silently clobber whichever one loses, permanently no-op'ing the chamber). So — UNLIKE every
// other chamber's `{type:"init", ...connectorConfig}` shape — floodlight's init message NESTS the
// connector config under its own `connectorConfig` key: `{ type: "init", connectorConfig }`.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FLOODLIGHT_CCM_COLLECT_ENDPOINT, FLOODLIGHT_ACTIVITY_ENDPOINT } from "../connectors/floodlight/connector.js";

const ctx = { consent: { ad_storage: "granted", analytics_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" } };

describe("core/floodlight-chamber.worker.js — init -> events -> {ready, dropped} (spec 048-02 AC1)", () => {
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
    await import("../core/floodlight-chamber.worker.js");
    expect(typeof fakeSelf.onmessage).toBe("function");
  });

  it("a src-less init routes a page_view to ONLY the ccm/collect GET — byte-identical to 046-01, no activity beacon", async () => {
    await import("../core/floodlight-chamber.worker.js");

    fakeSelf.onmessage({ data: { type: "init", connectorConfig: { conversionId: "DC-1234567890", ctx } } });
    fakeSelf.onmessage({
      data: { type: "events", batch: [{ type: "page_view", params: { page_location: "https://spike.example/" } }] },
    });

    await new Promise((r) => setTimeout(r, 0));

    expect(fakeSelf.postMessage).toHaveBeenCalledTimes(1);
    const [{ ready, dropped }] = fakeSelf.postMessage.mock.calls[0];
    expect(dropped).toEqual([]);
    expect(ready).toHaveLength(1);
    expect(ready[0].method).toBe("GET");
    const url = new URL(ready[0].url);
    expect(url.origin + url.pathname).toBe(FLOODLIGHT_CCM_COLLECT_ENDPOINT);
    expect(url.searchParams.get("tid")).toBe("DC-1234567890");
    expect(url.searchParams.get("en")).toBe("page_view");
  });

  it("an init WITH src/type/cat routes a page_view to BOTH the ccm/collect GET and the ;-matrix activity GET (A1-floodlight)", async () => {
    await import("../core/floodlight-chamber.worker.js");

    fakeSelf.onmessage({
      data: {
        type: "init",
        connectorConfig: { conversionId: "DC-1234567890", src: "1234567", type: "grptag00", cat: "acttag00", ctx },
      },
    });
    fakeSelf.onmessage({
      data: { type: "events", batch: [{ type: "page_view", params: { page_location: "https://spike.example/" } }] },
    });

    await new Promise((r) => setTimeout(r, 0));

    expect(fakeSelf.postMessage).toHaveBeenCalledTimes(1);
    const [{ ready, dropped }] = fakeSelf.postMessage.mock.calls[0];
    expect(dropped).toEqual([]);
    expect(ready).toHaveLength(2);
    expect(new URL(ready[0].url).origin + new URL(ready[0].url).pathname).toBe(FLOODLIGHT_CCM_COLLECT_ENDPOINT);
    expect(ready[1].url.startsWith(FLOODLIGHT_ACTIVITY_ENDPOINT)).toBe(true);
    expect(ready[1].url).toContain("src=1234567");
  });

  it("a batch-routing failure posts the {ready: [], dropped: [__batch__]} backstop shape", async () => {
    await import("../core/floodlight-chamber.worker.js");

    fakeSelf.onmessage({ data: { type: "init", connectorConfig: { conversionId: "DC-1234567890", ctx } } });
    // A non-array batch makes routeBatch's `for...of` throw synchronously inside the
    // host's own try, mirroring the gtag/pixel/google-ads chambers' own top-level backstop —
    // unreachable in production (airlock.js always posts a real array batch) but proven here
    // so the backstop path is not a dead, silently-broken branch.
    fakeSelf.onmessage({ data: { type: "events", batch: null } });

    await new Promise((r) => setTimeout(r, 0));

    expect(fakeSelf.postMessage).toHaveBeenCalledTimes(1);
    const [msg] = fakeSelf.postMessage.mock.calls[0];
    expect(msg.ready).toEqual([]);
    expect(msg.dropped).toEqual([{ index: -1, type: "__batch__", reason: expect.any(String) }]);
  });
});
