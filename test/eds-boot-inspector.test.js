import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createInspectorCollector } from "../core/inspector/collector.js";
import { bootEdsAnalytics, bootGa4Gtag, bootMetaPixel, bootHelixRum, bootGoogleAds, bootFloodlight, boot } from "../adapters/eds/index.js";

// spec 028 follow-on (docs/inbox.md, 2026-09-03: "no production boot adapter forwards
// onDiagnostic — the inspector is blind to prod-booted instances"). The 028 inspector
// collector (core/inspector/collector.js) is a read-layer over the 009-02 onDiagnostic
// stream; test/inspector-collector.test.js proves the three seam CONSTRUCTORS honour it,
// but the production BOOT adapters used to construct createAirlock / createWrappedSdkHost
// WITHOUT threading it, so a real page had no way to attach a collector. These tests wire
// a fresh collector through each PUBLIC boot and drive an out-of-ceiling ready beacon (the
// same endpoint-ceiling HOLD inspector-collector.test.js uses) — a collector that captures
// it can only have done so via the threaded pass-through, so each test is non-vacuous by
// construction (a fresh collector has no other input path).
//
// The alloy -> createWrappedSdkHost config-integrity seam (the one collector.js warns a
// createAirlock-only wiring is BLIND to) is covered in test/eds-boot-alloy.test.js, where
// the round-trip chamber harness already lives.

const EVIL = "https://evil.example/x"; // out-of-declared-ceiling destination -> endpoint-ceiling HOLD
const GA4_ENDPOINT = "https://t0.example/collect";

class FakeWorker {
  constructor(url, opts) {
    FakeWorker.last = this;
    this.url = String(url);
    this.opts = opts;
    this.messages = [];
    this.onmessage = null;
    this.onerror = null;
  }
  postMessage(m) {
    this.messages.push(m);
  }
  terminate() {}
}

const fakeDocument = (cookie = "") => ({
  get cookie() {
    return cookie;
  },
  set cookie(_v) {},
  visibilityState: "visible",
});

const readyMsg = (reqs) => ({ data: { ready: reqs, dropped: [] } });
const stubWebVitals = () => ({ onLCP: () => {}, onCLS: () => {}, onINP: () => {} }); // RUM: no real PerformanceObservers

beforeEach(() => {
  FakeWorker.last = null;
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve()));
  vi.stubGlobal("document", fakeDocument("_ga=GA1.1.5555555555.1600000000"));
  vi.stubGlobal("requestIdleCallback", () => {}); // RUM boot schedules its idle drain via this (no-op; we drive the worker->main path directly)
});
afterEach(() => vi.unstubAllGlobals());

describe("spec 028 — production boot adapters thread onDiagnostic to the inspector collector", () => {
  it("bootEdsAnalytics (GA4 createAirlock path) surfaces an endpoint-ceiling HOLD to the wired collector", async () => {
    const c = createInspectorCollector();
    await bootEdsAnalytics({ endpoints: [GA4_ENDPOINT], onDiagnostic: c.onDiagnostic });
    FakeWorker.last.onmessage(readyMsg([{ url: EVIL, method: "POST", body: "{}" }]));

    expect(c.query({ kind: "endpoint-ceiling", disposition: "held" })).toHaveLength(1);
  });

  it("bootGa4Gtag surfaces an endpoint-ceiling HOLD to the wired collector", async () => {
    const c = createInspectorCollector();
    await bootGa4Gtag({ measurementId: "G-XXXX", onDiagnostic: c.onDiagnostic });
    FakeWorker.last.onmessage(readyMsg([{ url: EVIL, method: "POST", body: "{}" }]));

    expect(c.query({ kind: "endpoint-ceiling", disposition: "held" })).toHaveLength(1);
  });

  it("bootMetaPixel surfaces a HOLD — proving onDiagnostic survives bootPixelConnector's `...ids` rest (not swallowed into the vendor id-bag)", async () => {
    const c = createInspectorCollector();
    await bootMetaPixel({ pixelId: "111111111111111", onDiagnostic: c.onDiagnostic });
    FakeWorker.last.onmessage(readyMsg([{ url: EVIL, method: "GET" }]));

    expect(c.query({ kind: "endpoint-ceiling", disposition: "held" })).toHaveLength(1);
  });

  it("bootHelixRum surfaces an endpoint-ceiling HOLD to the wired collector", () => {
    const c = createInspectorCollector();
    bootHelixRum({ weight: 100, forceSelect: true, onDiagnostic: c.onDiagnostic, ...stubWebVitals() });
    FakeWorker.last.onmessage(readyMsg([{ url: EVIL, method: "POST", body: "{}" }]));

    expect(c.query({ kind: "endpoint-ceiling", disposition: "held" })).toHaveLength(1);
  });

  it("bootGoogleAds surfaces a held ad_storage-denied beacon to the wired collector (spec 048-01 AC6)", async () => {
    const c = createInspectorCollector();
    await bootGoogleAds({
      ctx: {},
      conversionId: "AW-1234567890",
      consent: { ad_storage: "denied" },
      onDiagnostic: c.onDiagnostic,
    });
    FakeWorker.last.onmessage(readyMsg([{ url: "https://www.google.com/ccm/collect?tid=AW-1234567890", method: "GET" }]));

    expect(c.query({ kind: "consent", disposition: "held" })).toHaveLength(1);
  });

  it("the composite boot(config) fans onDiagnostic out to a google-ads sub-connector's seam", async () => {
    const c = createInspectorCollector();
    await boot(
      { connectors: [{ type: "google-ads", ctx: {}, conversionId: "AW-1234567890" }] },
      { onDiagnostic: c.onDiagnostic },
    );
    FakeWorker.last.onmessage(readyMsg([{ url: EVIL, method: "GET" }]));

    expect(c.query({ kind: "endpoint-ceiling", disposition: "held" })).toHaveLength(1);
  });

  it("bootFloodlight surfaces a held ad_storage-denied beacon to the wired collector (spec 048-02 AC6)", async () => {
    const c = createInspectorCollector();
    await bootFloodlight({
      ctx: {},
      conversionId: "DC-1234567890",
      consent: { ad_storage: "denied" },
      onDiagnostic: c.onDiagnostic,
    });
    FakeWorker.last.onmessage(readyMsg([{ url: "https://www.google.com/ccm/collect?tid=DC-1234567890", method: "GET" }]));

    expect(c.query({ kind: "consent", disposition: "held" })).toHaveLength(1);
  });

  it("the composite boot(config) fans onDiagnostic out to a floodlight sub-connector's seam", async () => {
    const c = createInspectorCollector();
    await boot(
      { connectors: [{ type: "floodlight", ctx: {}, conversionId: "DC-1234567890" }] },
      { onDiagnostic: c.onDiagnostic },
    );
    FakeWorker.last.onmessage(readyMsg([{ url: EVIL, method: "GET" }]));

    expect(c.query({ kind: "endpoint-ceiling", disposition: "held" })).toHaveLength(1);
  });

  it("the composite boot(config) fans onDiagnostic out to a sub-connector's seam", async () => {
    const c = createInspectorCollector();
    await boot({ connectors: [{ type: "ga4-gtag", measurementId: "G-XXXX" }] }, { onDiagnostic: c.onDiagnostic });
    FakeWorker.last.onmessage(readyMsg([{ url: EVIL, method: "POST", body: "{}" }]));

    expect(c.query({ kind: "endpoint-ceiling", disposition: "held" })).toHaveLength(1);
  });

  it("back-compat: a boot with NO onDiagnostic falls back to the console default (no throw, unchanged 009-02)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await bootGa4Gtag({ measurementId: "G-XXXX" }); // no onDiagnostic wired

    expect(() => FakeWorker.last.onmessage(readyMsg([{ url: EVIL, method: "POST", body: "{}" }]))).not.toThrow();
    expect(errSpy).toHaveBeenCalled(); // the endpoint-ceiling HOLD still emits via the console default sink

    errSpy.mockRestore();
  });
});
