import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";

// 009-02 — chamber failure observability (surface drops + crashes).
//
// Reframed scope (see slice-02-crash-backstop-observability.md): the Worker
// boundary already keeps the page alive on a chamber crash — that part is
// free. What this slice actually delivers is DIAGNOSABILITY: a chamber-level
// `error` event and 009-01's per-descriptor `dropped[]` are routed through a
// single injectable diagnostics seam (defaulting to `console`) instead of
// being silently swallowed. So the assertions here are about a SURFACED
// RECORD reaching the hook — never about "no unhandled main-thread throw",
// which the Worker boundary already guarantees for free.

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

const endpoints = ["https://t0.example/collect"];
const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };

beforeEach(() => {
  FakeWorker.last = null;
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("requestIdleCallback", (cb) => {
    cb({ didTimeout: false, timeRemaining: () => 0 });
    return 1;
  });
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve()));
});
afterEach(() => vi.unstubAllGlobals());

const make = (opts) =>
  createAirlock({ trackers: 1, workFactor: 0, endpoints, ctx, unloadCritical: [], ...opts });

describe("AC1 — chamber-level worker error is SURFACED via the diagnostics hook", () => {
  it("a simulated worker `error` event produces a surfaced error record via the injected hook", () => {
    const onDiagnostic = vi.fn();
    make({ onDiagnostic });

    expect(FakeWorker.last.onerror).toBeTypeOf("function");
    FakeWorker.last.onerror({
      message: "Uncaught ReferenceError: x is not defined",
      filename: "chamber.worker.js",
      lineno: 42,
    });

    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    const record = onDiagnostic.mock.calls[0][0];
    expect(record.level).toBe("error");
    expect(record.message).toContain("x is not defined");
    expect(record.filename).toBe("chamber.worker.js");
    expect(record.lineno).toBe(42);
  });

  it("degrades gracefully when some ErrorEvent fields are missing — never an empty record", () => {
    const onDiagnostic = vi.fn();
    make({ onDiagnostic });

    FakeWorker.last.onerror({ message: "boom" }); // no filename/lineno

    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    const record = onDiagnostic.mock.calls[0][0];
    expect(record.level).toBe("error");
    expect(record.message).toBe("boom");
    // The spread-conditional must OMIT absent fields, not carry them as
    // `undefined` — that omission is the whole reason for the spread.
    expect(record).not.toHaveProperty("filename");
    expect(record).not.toHaveProperty("lineno");
  });

  it("defaults the diagnostics hook to console.error for a chamber error when none is injected", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    make();

    FakeWorker.last.onerror({ message: "boom", filename: "chamber.worker.js", lineno: 1 });

    expect(errSpy).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });
});

describe("AC2 — dropped descriptors are surfaced from the reply", () => {
  it("a reply with a dropped purchase produces a surfaced drop record naming the type + reason", () => {
    const onDiagnostic = vi.fn();
    make({ onDiagnostic });

    FakeWorker.last.onmessage({
      data: {
        ready: [],
        dropped: [{ index: 1, type: "purchase", reason: "Cannot read properties of undefined (reading 'transaction_id')" }],
      },
    });

    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    const record = onDiagnostic.mock.calls[0][0];
    expect(record.level).toBe("warn");
    expect(record.type).toBe("purchase");
    expect(record.reason).toContain("transaction_id");
    expect(record.index).toBe(1);
  });

  it("defaults the diagnostics hook to console.warn for a drop when none is injected", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    make();

    FakeWorker.last.onmessage({
      data: { ready: [], dropped: [{ index: 0, type: "click", reason: "boom" }] },
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("surfaces multiple drops individually", () => {
    const onDiagnostic = vi.fn();
    make({ onDiagnostic });

    FakeWorker.last.onmessage({
      data: {
        ready: [],
        dropped: [
          { index: 0, type: "click", reason: "a" },
          { index: 2, type: "purchase", reason: "b" },
        ],
      },
    });

    expect(onDiagnostic).toHaveBeenCalledTimes(2);
  });
});

describe("AC3 — no surfacing noise on the happy path", () => {
  it("a clean reply (dropped empty) and no worker error surfaces nothing", () => {
    const onDiagnostic = vi.fn();
    make({ onDiagnostic });

    FakeWorker.last.onmessage({
      data: { ready: [{ url: endpoints[0], body: "{}" }], dropped: [] },
    });

    expect(onDiagnostic).not.toHaveBeenCalled();
  });

  it("existing ready-dispatch behavior is unchanged alongside a clean reply", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    make();

    FakeWorker.last.onmessage({
      data: { ready: [{ url: endpoints[0], body: "{}" }], dropped: [] },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
