// Endpoint ceiling WIRED into core/airlock.js's async seam (spec 016-01 AC3,
// AC4, AC5, AC7b/AC7c) — an ADDITIVE file beyond the 016-01 implementation
// brief's named test list (disclosed in this slice's deviation log).
// test/endpoint-ceiling.test.js pins the PURE checker in isolation (AC1) and
// test/egress-confinement.test.js pins confinement + the import-order
// guarantee (AC2/AC7a); neither exercises the actual core/airlock.js wiring
// the checker is wired into. This file closes that gap directly against the
// wired seam, reusing the SAME FakeWorker harness
// test/chamber-observability.test.js already uses to drive `worker.onmessage`
// without a real Worker (keeps this hermetic — no stale-worktree hang risk).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";

class FakeWorker {
  constructor(url, opts) {
    FakeWorker.last = this;
    this.url = String(url);
    this.opts = opts;
    this.messages = [];
    this.onmessage = null;
    this.onerror = null;
  }
  postMessage(m) { this.messages.push(m); }
  terminate() {}
}

const DECLARED = "https://collect.example/mp/collect";
const EVIL = "https://evil.example/steal";
const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };

beforeEach(() => {
  FakeWorker.last = null;
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("requestIdleCallback", (cb) => {
    cb({ didTimeout: false, timeRemaining: () => 0 });
    return 1;
  });
});
afterEach(() => vi.unstubAllGlobals());

const make = (opts) =>
  createAirlock({ trackers: 1, workFactor: 0, endpoints: [DECLARED], ctx, unloadCritical: [], ...opts });

describe("honest path — a `ready` request to a DECLARED destination (AC3, AC7c)", () => {
  it("dispatches unchanged and stays silent (no diagnostic)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    make({ onDiagnostic });

    FakeWorker.last.onmessage({ data: { ready: [{ url: DECLARED, body: "{}" }], dropped: [] } });

    // `dispatched++` fires inside fetch(...).then(), a microtask not yet
    // flushed here (test/chamber-observability.test.js's established pattern
    // likewise never asserts stats().dispatched synchronously) — the
    // synchronous, load-bearing assertion is that fetch was called at all.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(DECLARED, expect.objectContaining({ method: "POST", body: "{}", keepalive: true }));
    expect(onDiagnostic).not.toHaveBeenCalled();
  });
});

describe("fail-closed — a `ready` request to an UNDECLARED destination (AC3, AC4, AC7b)", () => {
  it("holds it: zero fetch, zero dispatched++", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = make({ onDiagnostic: vi.fn() });

    FakeWorker.last.onmessage({ data: { ready: [{ url: EVIL, body: "{}" }], dropped: [] } });

    expect(fetchMock).not.toHaveBeenCalled(); // the seal bites — no egress at all
    expect(airlock.stats().dispatched).toBe(0);
  });

  it("surfaces the held destination through the 009-02 diagnostics sink — origin+path only, never query/body/secrets", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve()));
    const onDiagnostic = vi.fn();
    make({ onDiagnostic });

    FakeWorker.last.onmessage({
      data: {
        ready: [{
          url: `${EVIL}?measurement_id=G-SYNTHETIC&api_secret=synthetic-secret`,
          body: JSON.stringify({ api_secret: "synthetic-secret" }),
        }],
        dropped: [],
      },
    });

    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    const record = onDiagnostic.mock.calls[0][0];
    expect(record).toMatchObject({ level: "error", kind: "endpoint-ceiling", disposition: "held", destination: EVIL });
    expect(record.reason).toContain("held at the seal");
    // No secret / query / body ever rides in the diagnostic.
    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain("synthetic-secret");
    expect(serialized).not.toContain("measurement_id");
  });

  it("holds each undeclared destination independently in a mixed batch — the declared one still dispatches", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    make({ onDiagnostic });

    FakeWorker.last.onmessage({
      data: { ready: [{ url: EVIL, body: "{}" }, { url: DECLARED, body: "{}" }], dropped: [] },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(DECLARED, expect.anything());
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
  });
});

describe("per-connector attribution — the ceiling is CONSTRUCTION-time, not request-derived (AC5)", () => {
  it("a chamber cannot widen its own ceiling by naming extra fields on the ready request — only the host's construction-time endpoints govern", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    make({ onDiagnostic: vi.fn() }); // constructed with endpoints:[DECLARED] only

    // EgressRequest has no endpoints/ceiling field (contracts/connector.d.ts) —
    // even a smuggled one is ignored; only {url, body} are ever read.
    FakeWorker.last.onmessage({
      data: { ready: [{ url: EVIL, body: "{}", endpoints: [EVIL] }], dropped: [] },
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("back-compat — a caller with NO declared endpoints is unaffected by the ceiling gate", () => {
  it("dispatches unchanged when endpoints is empty (ceiling.length === 0 -> gate inactive)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    createAirlock({ trackers: 1, workFactor: 0, endpoints: [], ctx, unloadCritical: [], onDiagnostic });

    FakeWorker.last.onmessage({ data: { ready: [{ url: EVIL, body: "{}" }], dropped: [] } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onDiagnostic).not.toHaveBeenCalled();
  });
});
