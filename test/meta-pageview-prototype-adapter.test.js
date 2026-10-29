import { describe, expect, it, vi } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";

const endpoint = "http://127.0.0.1:43210/tr/";
const context = {
  pageURL: "https://example.test/", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: -420,
};

// Unit-only transport controls; actual mapping/receipt are covered by the
// separate real-worker integration suite, never by this protocol stub.
function controlledChamber({ configure = true } = {}) {
  let listener;
  let error;
  const retired = [];
  const sent = [];
  return {
    sent,
    postMessage(message) {
      sent.push(message);
      if (configure && message.type === "init") queueMicrotask(() => listener?.({ type: "phase", name: "configured" }));
    },
    onMessage(callback) {
      listener = callback;
      return () => { retired.push(callback); listener = undefined; };
    },
    onError(callback) { error = callback; return () => { error = undefined; }; },
    emit(message) { listener?.(message); },
    emitLate(message) { for (const callback of retired) callback(message); },
    error() { error?.(); },
    dispose: vi.fn(),
  };
}

describe("bounded experimental capture and trusted transport policy", () => {
  it("does not enqueue work after captureContext disposes the adapter", async () => {
    const chamber = controlledChamber({ configure: false });
    let cleanup;
    const adapter = createMetaPixelPrototype({
      endpoint, chamber,
      captureContext() { cleanup = adapter.dispose(); return context; },
    });
    try {
      adapter.fbq("init", "000000000000000");
      await cleanup;
      expect(adapter.getState()).toMatchObject({ phase: "disposed", queued: 0, inFlight: false });
      expect((await adapter.flush()).outcomes).toContainEqual({ seq: 1, disposition: "rejected", reason: "disposed" });
      expect(chamber.sent.some((message) => message.type === "event")).toBe(false);
    } finally {
      await adapter.dispose();
    }
  });

  it("rejects reentrant capture visibly without reversing worker command order", async () => {
    const chamber = controlledChamber({ configure: false });
    let nested = false;
    const adapter = createMetaPixelPrototype({
      endpoint, chamber,
      captureContext() {
        if (!nested) { nested = true; adapter.fbq("track", "PageView"); }
        return context;
      },
    });
    try {
      adapter.fbq("init", "000000000000000");
      chamber.emit({ type: "phase", name: "configured" });
      const events = chamber.sent.filter((message) => message.type === "event");
      expect(events).toHaveLength(1);
      expect(events[0].event.seq).toBe(1);
      chamber.emit({ type: "result", summary: { seq: 1, disposition: "initialized", requests: 0 }, ready: [] });
      expect((await adapter.flush()).outcomes).toContainEqual({
        seq: 2, disposition: "rejected", reason: "capture-reentrant",
      });
    } finally {
      await adapter.dispose();
    }
  });

  it.each(["throw", "reject"])("surfaces a %s from worker disposal without raw diagnostics or a successful close", async (mode) => {
    const chamber = controlledChamber({ configure: false });
    chamber.dispose = mode === "throw"
      ? vi.fn(() => { throw new Error("private-worker-cleanup-detail"); })
      : vi.fn(() => Promise.reject(new Error("private-worker-cleanup-detail")));
    const adapter = createMetaPixelPrototype({ endpoint, chamber, captureContext: () => context });
    await expect(adapter.dispose()).rejects.toThrow("prototype-cleanup-failed");
    expect(adapter.getState().cleanupFailure).toBe("transport-dispose-failed");
    expect(JSON.stringify(adapter.getState())).not.toContain("private-worker-cleanup-detail");
    expect(chamber.dispose).toHaveBeenCalledTimes(1);
  });

  it.each(["throw", "reject"])("retains event-driven %s cleanup failure across repeated disposal", async (mode) => {
    const chamber = controlledChamber();
    chamber.dispose = mode === "throw"
      ? vi.fn(() => { throw new Error("private-event-cleanup-detail"); })
      : vi.fn(() => Promise.reject(new Error("private-event-cleanup-detail")));
    const adapter = createMetaPixelPrototype({ endpoint, chamber, captureContext: () => context });
    chamber.error();
    await expect(adapter.dispose()).rejects.toThrow("prototype-cleanup-failed");
    await expect(adapter.dispose()).rejects.toThrow("prototype-cleanup-failed");
    expect(adapter.getState()).toMatchObject({
      phase: "terminal", terminalReason: "worker-error", cleanupFailure: "transport-dispose-failed",
    });
    expect(chamber.dispose).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(adapter.getState())).not.toContain("private-event-cleanup-detail");
  });

  it("ignores a genuinely delivered stale result callback after timeout instead of settling another command", async () => {
    const chamber = controlledChamber();
    const adapter = createMetaPixelPrototype({
      endpoint, chamber, captureContext: () => context, commandTimeoutMs: 20,
    });
    try {
      adapter.fbq("init", "000000000000000");
      adapter.fbq("track", "PageView");
      const state = await adapter.flush();
      expect(state.terminalReason).toBe("command-timeout");
      expect(state.outcomes.map((entry) => entry.reason)).toEqual(["command-timeout", "command-timeout"]);
      chamber.emitLate({ type: "result", summary: { seq: 1, disposition: "initialized", requests: 0 }, ready: [] });
      expect(adapter.getState()).toEqual(state);
      expect(chamber.sent.filter((message) => message.type === "event")).toHaveLength(1);
      adapter.fbq("track", "PageView");
      expect(adapter.getState().outcomes.at(-1).reason).toBe("terminal");
    } finally {
      await adapter.dispose();
    }
  });

  it("records terminal startup/error reasons even when no command was captured", async () => {
    const chamber = controlledChamber();
    const adapter = createMetaPixelPrototype({ endpoint, chamber, captureContext: () => context });
    try {
      await Promise.resolve();
      chamber.error();
      expect(adapter.getState()).toMatchObject({ phase: "terminal", terminalReason: "worker-error" });
      expect(chamber.dispose).toHaveBeenCalledTimes(1);
    } finally {
      await adapter.dispose();
    }
  });

  it("keeps a known worker timeout distinguishable from an arbitrary fatal payload", async () => {
    const chamber = controlledChamber();
    const adapter = createMetaPixelPrototype({ endpoint, chamber, captureContext: () => context });
    try {
      chamber.emit({ type: "fatal", message: "transport-timeout", private: "must-not-appear" });
      expect(adapter.getState()).toMatchObject({ terminalReason: "transport-timeout" });
      expect(JSON.stringify(adapter.getState())).not.toContain("must-not-appear");
    } finally {
      await adapter.dispose();
    }
  });

  it("captures only bounded primitives, snapshots values, and reports overflow/uncloneable/disposed calls without throwing", async () => {
    const chamber = controlledChamber({ configure: false });
    const source = { ...context, secret: { deeply: "not-copied" } };
    const adapter = createMetaPixelPrototype({
      endpoint, chamber, captureContext: () => source, queueLimit: 2,
    });
    try {
      const args = ["init", "000000000000000"];
      expect(adapter.fbq(...args)).toBeUndefined();
      args[1] = "changed-after-capture";
      source.pageURL = "https://example.test/changed";
      adapter.fbq("track", "PageView");
      source.pageURL = "https://example.test/late";
      adapter.fbq("track", "PageView");
      expect(adapter.getState().outcomes).toContainEqual({ seq: 3, disposition: "rejected", reason: "queue-overflow" });
      chamber.emit({ type: "phase", name: "configured" });
      const first = chamber.sent.find((message) => message.type === "event");
      expect(first.event.payload.args).toEqual(["init", "000000000000000"]);
      expect(first.event.payload.context).toEqual(context);
      expect(first.event.payload.context).not.toHaveProperty("secret");
      chamber.emit({ type: "result", summary: { seq: 1, disposition: "initialized", requests: 0 }, ready: [] });
      await Promise.resolve();
      await Promise.resolve();
      const second = chamber.sent.filter((message) => message.type === "event")[1];
      expect(second.event.payload.context.pageURL).toBe("https://example.test/changed");
      chamber.emit({ type: "result", summary: { seq: 2, disposition: "rejected", reason: "unit-only", requests: 0 }, ready: [] });
      await adapter.flush();
      adapter.fbq("track", () => {});
      adapter.fbq("track", { nested: "not-cloned" });
      adapter.fbq("x".repeat(65));
      adapter.fbq(...Array(100).fill("x"));
      source.pageURL = "x".repeat(2049);
      adapter.fbq("track", "PageView");
      expect(adapter.getState().outcomes.slice(-5).map((entry) => entry.reason)).toEqual([
        "uncloneable-input", "unsupported-argument", "argument-limit", "argument-limit", "unsupported-context",
      ]);
      await adapter.dispose();
      expect(() => adapter.fbq("track", "PageView")).not.toThrow();
      expect(adapter.getState().outcomes.at(-1).reason).toBe("disposed");
      expect(chamber.dispose).toHaveBeenCalledTimes(1);
    } finally {
      await adapter.dispose();
    }
  });

  it("does not invoke context accessors or clone arbitrary objects", async () => {
    const chamber = controlledChamber({ configure: false });
    const getter = vi.fn(() => context.pageURL);
    const source = { ...context };
    Object.defineProperty(source, "pageURL", { get: getter });
    const adapter = createMetaPixelPrototype({ endpoint, chamber, captureContext: () => source });
    try {
      adapter.fbq("track", "PageView");
      expect(getter).not.toHaveBeenCalled();
      expect(adapter.getState().outcomes.at(-1).reason).toBe("unsupported-context");
    } finally {
      await adapter.dispose();
    }
  });

  it("enforces endpoint ceiling and literal GET-only policy before the actual Fetch driver", async () => {
    const chamber = controlledChamber();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const adapter = createMetaPixelPrototype({
      endpoint, chamber, captureContext: () => context, consent: { ad_storage: "granted" }, fetchImpl,
    });
    try {
      await Promise.resolve();
      for (const [index, request] of [
        { url: "https://www.facebook.com/tr/?id=000000000000000" },
        { url: "http://localhost:43210/tr/?x=1" },
        { url: "http://127.0.0.1:43210/other/?x=1" },
        { url: "http://127.0.0.1:43211/tr/?x=1" },
        { url: "http://127.0.0.1:43210/tr/?x=1#fragment" },
        { url: "http://127.0.0.1:43210/other/../tr/?x=1" },
        { url: `${endpoint}?x=1`, method: "POST" },
        { url: `${endpoint}?x=1`, body: "" },
        { url: `${endpoint}?x=1`, headers: {} },
        { url: `${endpoint}?x=1`, credentials: "include" },
        { url: `${endpoint}?x=1`, redirect: "follow" },
      ].entries()) {
        chamber.emit({ type: "intercepted-fetch", id: index + 1, method: "GET", ...request });
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(fetchImpl).not.toHaveBeenCalled();
      const responses = chamber.sent.filter((message) => message.type === "intercepted-fetch-response");
      expect(responses).toHaveLength(11);
      expect(responses.every((message) => message.status === 0)).toBe(true);
      expect(adapter.getState().host.ceilingHeld).toBe(4);
      chamber.emit({ type: "intercepted-fetch", id: 12, method: "GET", url: `${endpoint}?x=1` });
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(fetchImpl.mock.calls[0][1]).toMatchObject({
        method: "GET", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer",
      });
      expect(fetchImpl.mock.calls[0][1]).not.toHaveProperty("body");
      expect(fetchImpl.mock.calls[0][1]).not.toHaveProperty("headers");
      expect(adapter.getState().receipt).toBe("not-observed-by-adapter");
    } finally {
      await adapter.dispose();
    }
  });

  it("times out startup, drains queued calls visibly and closes exactly once", async () => {
    const chamber = controlledChamber({ configure: false });
    const adapter = createMetaPixelPrototype({
      endpoint, chamber, captureContext: () => context, initTimeoutMs: 30,
    });
    try {
      adapter.fbq("init", "000000000000000");
      adapter.fbq("track", "PageView");
      const state = await adapter.flush();
      expect(state).toMatchObject({ phase: "terminal", terminalReason: "init-timeout", queued: 0, inFlight: false });
      expect(state.outcomes.map((entry) => entry.reason)).toEqual(["init-timeout", "init-timeout"]);
      chamber.emit({ type: "phase", name: "configured" });
      expect(chamber.sent.filter((message) => message.type === "event")).toEqual([]);
      expect(chamber.dispose).toHaveBeenCalledTimes(1);
    } finally {
      await adapter.dispose();
    }
  });

  it("bounds outcome history and fails closed when the Worker is unavailable", async () => {
    const chamber = controlledChamber({ configure: false });
    const adapter = createMetaPixelPrototype({ endpoint, chamber, captureContext: () => context, queueLimit: 1 });
    try {
      adapter.fbq("init", "000000000000000");
      for (let index = 0; index < 300; index += 1) adapter.fbq("track", "PageView");
      expect(adapter.getState()).toMatchObject({ queued: 1, truncated: 44 });
      expect(adapter.getState().outcomes).toHaveLength(256);
    } finally {
      await adapter.dispose();
    }
    const unavailable = createMetaPixelPrototype({
      endpoint,
      chamber: { onMessage() { throw new Error("private-error-message"); } },
      captureContext: () => context,
    });
    try {
      expect(() => unavailable.fbq("init", "000000000000000")).not.toThrow();
      expect(unavailable.getState()).toMatchObject({ phase: "terminal", terminalReason: "worker-unavailable" });
      expect(JSON.stringify(unavailable.getState())).not.toContain("private-error-message");
    } finally {
      await unavailable.dispose();
    }
  });

  it("caps lifetime admissions, not just the queue, so the unchanged host cannot accumulate unbounded history", async () => {
    const chamber = controlledChamber();
    const adapter = createMetaPixelPrototype({ endpoint, chamber, captureContext: () => context });
    try {
      await Promise.resolve();
      for (let seq = 1; seq <= 256; seq += 1) {
        adapter.fbq("init", "000000000000000");
        chamber.emit({ type: "result", summary: { seq, disposition: "initialized", requests: 0 }, ready: [] });
        await adapter.flush();
      }
      adapter.fbq("track", "PageView");
      expect(adapter.getState().outcomes.at(-1).reason).toBe("session-command-limit");
      expect(chamber.sent.filter((message) => message.type === "event")).toHaveLength(256);
      expect(adapter.getState()).toMatchObject({ queued: 0, inFlight: false, truncated: 1 });
    } finally {
      await adapter.dispose();
    }
  });

  it.each([
    ["extra branch field", { seq: 2, disposition: "transport-settled", requests: 1, selected: 1,
      branches: [{ ordinal: 1, disposition: "transport-settled", status: 204, pixelId: "private-pixel" }] }],
    ["extra summary field", { seq: 2, disposition: "transport-settled", requests: 1, selected: 1,
      branches: [{ ordinal: 1, disposition: "transport-settled", status: 204 }], pixelId: "private-pixel" }],
    ["non-array branches", { seq: 2, disposition: "transport-settled", requests: 1, selected: 1, branches: {} }],
    ["null branch", { seq: 2, disposition: "transport-settled", requests: 1, selected: 1, branches: [null] }],
    ["branch count", { seq: 2, disposition: "transport-settled", requests: 1, selected: 2, branches: [] }],
    ["wrong branch ordinal", { seq: 2, disposition: "transport-settled", requests: 1, selected: 1,
      branches: [{ ordinal: 2, disposition: "transport-settled", status: 204 }] }],
    ["invalid branch status", { seq: 2, disposition: "transport-settled", requests: 1, selected: 1,
      branches: [{ ordinal: 1, disposition: "transport-settled", status: 503 }] }],
    ["misleading partial", { seq: 2, disposition: "transport-settled", requests: 1, selected: 2,
      branches: [{ ordinal: 1, disposition: "transport-settled", status: 204 }] }],
    ["misleading held status", { seq: 2, disposition: "held", requests: 1, selected: 1,
      branches: [{ ordinal: 1, disposition: "held", status: 0, reason: "private-pixel" }] }],
    ["omitted terminal failure", { seq: 2, disposition: "failed", requests: 1, selected: 1,
      branches: [{ ordinal: 1, disposition: "failed", status: 0, reason: "transport-failed" }] }],
    ["wrong command kind", { seq: 2, disposition: "initialized", requests: 0 }],
    ["wrong sequence", { seq: 99, disposition: "transport-settled", requests: 1, selected: 1,
      branches: [{ ordinal: 1, disposition: "transport-settled", status: 204 }] }],
    ["private rejection reason", { seq: 2, disposition: "rejected", requests: 0, reason: "private-pixel" }],
    ["branch accessor", { seq: 2, disposition: "transport-settled", requests: 1, selected: 1,
      branches: [{ ordinal: 1, disposition: "transport-settled", get status() { throw new Error("private-pixel"); } }] }],
  ])("rejects malformed multi-Pixel worker result: %s", async (_label, summary) => {
    const chamber = controlledChamber();
    const adapter = createMetaPixelPrototype({
      endpoint, chamber, captureContext: () => context,
      experimentalRouting: true, experimentalMultiPixelRouting: true,
    });
    try {
      await Promise.resolve();
      adapter.fbq("init", "000000000000001");
      chamber.emit({ type: "result", summary: { seq: 1, disposition: "initialized", requests: 0 }, ready: [] });
      await adapter.flush();
      adapter.fbq("track", "PageView");
      chamber.emit({ type: "result", summary, ready: [] });
      const state = await adapter.flush();
      expect(state).toMatchObject({ phase: "terminal", terminalReason: "invalid-worker-result" });
      expect(state.outcomes.at(-1)).toMatchObject({ seq: 2, disposition: "rejected", reason: "invalid-worker-result" });
      expect(JSON.stringify(adapter.getState())).not.toContain("private-pixel");
    } finally { await adapter.dispose(); }
  });

  it("rejects a target result claiming multiple Pixels and unexpected ready data", async () => {
    for (const kind of ["multiple-targets", "unexpected-ready", "non-array-ready", "array-with-extra-field"]) {
      const chamber = controlledChamber();
      const adapter = createMetaPixelPrototype({
        endpoint, chamber, captureContext: () => context,
        experimentalRouting: true, experimentalMultiPixelRouting: true,
      });
      try {
        await Promise.resolve();
        adapter.fbq("init", "000000000000001");
        chamber.emit({ type: "result", summary: { seq: 1, disposition: "initialized", requests: 0 }, ready: [] });
        await adapter.flush();
        adapter.fbq("trackSingle", "000000000000001", "PageView");
        const branches = [{ ordinal: 1, disposition: "transport-settled", status: 204 }];
        if (kind === "multiple-targets") branches.push({ ordinal: 2, disposition: "transport-settled", status: 204 });
        const ready = kind === "unexpected-ready" ? [{ pixelId: "private-pixel" }]
          : kind === "non-array-ready" ? { pixelId: "private-pixel" }
            : kind === "array-with-extra-field" ? Object.assign([], { slice: "private-pixel" }) : [];
        chamber.emit({ type: "result", summary: {
          seq: 2, disposition: "transport-settled", requests: branches.length, selected: branches.length, branches,
        }, ready });
        const state = await adapter.flush();
        expect(state).toMatchObject({ phase: "terminal", terminalReason: "invalid-worker-result" });
        expect(JSON.stringify(state)).not.toContain("private-pixel");
      } finally { await adapter.dispose(); }
    }
  });

  it("rejects unsolicited multi-Pixel worker results while no command is in flight", async () => {
    const chamber = controlledChamber();
    const adapter = createMetaPixelPrototype({
      endpoint, chamber, captureContext: () => context,
      experimentalRouting: true, experimentalMultiPixelRouting: true,
    });
    try {
      await Promise.resolve();
      chamber.emit({ type: "result", summary: { seq: 1, disposition: "initialized", requests: 0 }, ready: [] });
      expect(adapter.getState()).toMatchObject({ phase: "terminal", terminalReason: "invalid-worker-result" });
      expect(adapter.getState().outcomes).toEqual([]);
    } finally { await adapter.dispose(); }
  });

  it("rejects a second result before the first command finishes settling", async () => {
    const chamber = controlledChamber();
    const adapter = createMetaPixelPrototype({
      endpoint, chamber, captureContext: () => context,
      experimentalRouting: true, experimentalMultiPixelRouting: true,
    });
    try {
      await Promise.resolve();
      adapter.fbq("init", "000000000000001");
      const message = { type: "result", summary: { seq: 1, disposition: "initialized", requests: 0 }, ready: [] };
      chamber.emit(message);
      chamber.emit(message);
      const state = await adapter.flush();
      expect(state).toMatchObject({ phase: "terminal", terminalReason: "invalid-worker-result" });
      expect(state.outcomes).toContainEqual({ seq: 1, disposition: "rejected", reason: "invalid-worker-result" });
    } finally { await adapter.dispose(); }
  });
});
