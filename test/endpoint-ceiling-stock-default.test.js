// Spec 067-04 (ADR-0062 point 7): the default endpoint ceiling is the
// connector's stock destination set; a site may only narrow it.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";
import { resolveEndpointCeiling } from "../core/endpoint-ceiling.js";

class FakeWorker {
  constructor() {
    FakeWorker.last = this;
    this.messages = [];
    this.onmessage = null;
    this.onerror = null;
  }
  postMessage(m) { this.messages.push(m); }
  terminate() {}
}

// Test vendor: two origins and one matrix-path destination.
const STOCK = ["https://a.vendor.test/collect", "https://b.vendor.test/beacon", "https://c.vendor.test/activity;src=1"];
const NON_STOCK = "https://evil.example/steal";
const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };

let fetchMock;
beforeEach(() => {
  FakeWorker.last = null;
  fetchMock = vi.fn(() => Promise.resolve());
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("requestIdleCallback", (cb) => {
    cb({ didTimeout: false, timeRemaining: () => 0 });
    return 1;
  });
});
afterEach(() => vi.unstubAllGlobals());

const make = (opts) => {
  const onDiagnostic = vi.fn();
  createAirlock({ trackers: 1, workFactor: 0, ctx, unloadCritical: [], consentHold: false, onDiagnostic, ...opts });
  return onDiagnostic;
};
const send = (url) => FakeWorker.last.onmessage({ data: { ready: [{ url, method: "POST", body: "{}" }], dropped: [] } });

describe("stock default (no site narrowing)", () => {
  it("sends every stock destination, including the matrix path with a cachebuster", () => {
    make({ stockEndpoints: STOCK });
    send("https://a.vendor.test/collect?x=1");
    send("https://b.vendor.test/beacon");
    send("https://c.vendor.test/activity;src=1;num=9;ord=123");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("holds a non-stock destination with the endpoint-ceiling diagnostic", () => {
    const diag = make({ stockEndpoints: STOCK });
    send(NON_STOCK);
    send("https://c.vendor.test/activity;src=10");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(diag.mock.calls.filter(([d]) => d.kind === "endpoint-ceiling" && d.disposition === "held")).toHaveLength(2);
  });

  it("a stock set, not the caller's declared endpoints, is the ceiling", () => {
    make({ stockEndpoints: STOCK, endpoints: ["https://declared.test/x"] });
    send("https://declared.test/x");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never falls back to no ceiling when a site declares nothing", () => {
    make({ stockEndpoints: STOCK, endpointNarrowing: undefined });
    send(NON_STOCK);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("site narrowing (opt-in, its own state)", () => {
  it("holds a stock destination the site narrowed away, and sends the rest", () => {
    const diag = make({ stockEndpoints: STOCK, endpointNarrowing: ["https://a.vendor.test/collect"] });
    send("https://a.vendor.test/collect");
    send("https://b.vendor.test/beacon");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(diag).toHaveBeenCalledWith(expect.objectContaining({ kind: "endpoint-ceiling", disposition: "held" }));
  });

  it("can never widen past the stock set (throws at construction)", () => {
    expect(() => make({ stockEndpoints: STOCK, endpointNarrowing: [NON_STOCK] })).toThrow(/outside/);
    expect(() => make({ stockEndpoints: STOCK, endpointNarrowing: ["https://c.vendor.test/activity;src=10"] })).toThrow(/outside/);
  });

  it("rejects an empty or non-array narrowing rather than meaning no ceiling", () => {
    expect(() => resolveEndpointCeiling({ stock: STOCK, narrowing: [] })).toThrow(TypeError);
    expect(() => resolveEndpointCeiling({ stock: STOCK, narrowing: "x" })).toThrow(TypeError);
  });

  it("the coalescer re-check uses the same ceiling", () => {
    // The hook turns an on-ceiling input into a stock-but-narrowed-away output.
    const coalesce = () => [{ url: "https://b.vendor.test/beacon", method: "POST", body: "{}" }];
    make({ stockEndpoints: STOCK, endpointNarrowing: ["https://a.vendor.test/collect"], coalesce });
    send("https://a.vendor.test/collect");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("migration (spec 067 check 8): callers declaring no stock set keep today's behavior", () => {
  it("declared endpoints stay the ceiling", () => {
    make({ endpoints: ["https://declared.test/x"] });
    send("https://declared.test/x");
    send(NON_STOCK);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no endpoints at all means no ceiling", () => {
    make({});
    send(NON_STOCK);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a narrowing without a stock set is refused, not silently ignored", () => {
    expect(() => make({ endpoints: ["https://declared.test/x"], endpointNarrowing: ["https://declared.test/x"] })).toThrow(/stock/);
  });
});
