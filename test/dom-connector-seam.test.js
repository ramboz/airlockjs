// The DOM-chamber connector-selection seam — spec 025-03 AC6. Extends
// core/airlock.js's binary GA4/pixel ternary (spec 026-01 AC3) to a THIRD
// `connector: "dom"` branch (`core/dom-chamber.worker.js`) + generalizes the
// init message (the SAME `{ type: "init", ...connectorConfig }` shape the
// pixel branch already uses — a free-form bag the specific chamber
// interprets). Reuses the SAME hermetic FakeWorker harness
// test/pixel-seam.test.js's own AC3 section uses (no real Worker — avoids
// the stale-worktree hang risk).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";

class FakeWorker {
  constructor(url, opts) {
    FakeWorker.last = this;
    FakeWorker.instances.push(this);
    this.url = String(url);
    this.opts = opts;
    this.messages = [];
    this.onmessage = null;
    this.onerror = null;
    this.terminated = 0;
  }
  postMessage(m) { this.messages.push(m); }
  terminate() { this.terminated++; }
}

beforeEach(() => {
  FakeWorker.last = null;
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(() => vi.unstubAllGlobals());

const ga4Endpoints = ["https://t0.example/collect"];
const ga4Ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };

const makeGa4 = (opts) =>
  createAirlock({ trackers: 1, workFactor: 0, endpoints: ga4Endpoints, ctx: ga4Ctx, unloadCritical: [], ...opts });

const makeDom = (opts) =>
  createAirlock({
    trackers: 0,
    workFactor: 0,
    endpoints: [],
    ctx: {},
    connector: "dom",
    connectorConfig: { authorSource: "/* real author source */", elements: 0, workUs: 0 },
    ...opts,
  });

describe("AC6 — the selection seam's THIRD (dom) branch", () => {
  it("a dom-configured airlock constructs the DOM-CHAMBER worker + posts a generalized init message ({type:'init', ...connectorConfig})", () => {
    const connectorConfig = { authorSource: "/* src */", elements: 5, workUs: 0 };
    makeDom({ connectorConfig });

    expect(FakeWorker.last.url.endsWith("dom-chamber.worker.js")).toBe(true);
    expect(FakeWorker.last.opts).toEqual({ type: "module" });
    expect(FakeWorker.last.messages[0]).toEqual({ type: "init", ...connectorConfig });
  });

  it("REGRESSION — no `connector` option still constructs the GA4 chamber worker + posts the OLD GA4-shaped init message, byte-unchanged", () => {
    makeGa4();

    expect(FakeWorker.last.url.endsWith("dom-chamber.worker.js")).toBe(false);
    expect(FakeWorker.last.url.endsWith("pixel-chamber.worker.js")).toBe(false);
    expect(FakeWorker.last.url.endsWith("chamber.worker.js")).toBe(true);
    expect(FakeWorker.last.messages[0]).toEqual({
      type: "init",
      trackers: 1,
      workFactor: 0,
      endpoints: ga4Endpoints,
      ctx: ga4Ctx,
    });
  });

  it("REGRESSION — connector:'pixel' still constructs the pixel chamber worker, unaffected by the new dom branch", () => {
    const connectorConfig = { endpoint: "https://facebook.example/tr", pixelId: "PIXEL123", eventMap: {}, paramMap: {} };
    createAirlock({
      trackers: 1, workFactor: 0, endpoints: [connectorConfig.endpoint], ctx: {},
      connector: "pixel", connectorConfig,
    });

    expect(FakeWorker.last.url.endsWith("pixel-chamber.worker.js")).toBe(true);
    expect(FakeWorker.last.url.endsWith("dom-chamber.worker.js")).toBe(false);
    expect(FakeWorker.last.messages[0]).toEqual({ type: "init", ...connectorConfig });
  });

  it("the returned handle exposes the raw `worker` ONLY for connector:'dom' — a dom-tag adapter's own way to drive the chamber's event-forward/mutation-flush protocol (a DIFFERENT shape from GA4/pixel's ready/dropped egress protocol)", () => {
    const dom = makeDom();
    expect(dom.worker).toBe(FakeWorker.last);
  });

  it("REGRESSION — GA4's returned handle does NOT expose `worker` (shape unchanged)", () => {
    const ga4 = makeGa4();
    expect(ga4.worker).toBeUndefined();
  });

  it("REGRESSION — a pixel handle does NOT expose `worker` either (shape unchanged)", () => {
    const connectorConfig = { endpoint: "https://facebook.example/tr", pixelId: "PIXEL123", eventMap: {}, paramMap: {} };
    const pixel = createAirlock({
      trackers: 1, workFactor: 0, endpoints: [connectorConfig.endpoint], ctx: {},
      connector: "pixel", connectorConfig,
    });
    expect(pixel.worker).toBeUndefined();
  });

  it("a dom instance's worker.onmessage can be freely taken over by the caller (createAirlock's own ready/dropped handler is a no-op for the dom-chamber's {type:'mutations'} shape, but does not throw or interfere)", () => {
    const dom = makeDom();
    expect(() => dom.worker.onmessage({ data: { type: "mutations", ops: [] } })).not.toThrow();
  });
});
