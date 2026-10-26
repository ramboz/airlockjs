import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";

const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";
const page = { pageURL: "https://example.test/offline-capture", referrer: "" };
function controlledChamber({ configure = false } = {}) {
  let listener;
  let error;
  const retired = [];
  return {
    sent: [],
    postMessage(message) {
      this.sent.push(message);
      if (configure && message.type === "init") queueMicrotask(() => listener?.({ type: "phase", name: "configured" }));
    },
    onMessage(callback) { listener = callback; return () => { retired.push(callback); listener = undefined; }; },
    onError(callback) { error = callback; return () => { error = undefined; }; },
    emit(message) { listener?.(message); },
    emitLate(message) { for (const callback of retired) callback(message); },
    error() { error?.(); },
    dispose: vi.fn(),
  };
}
const result = (seq, disposition = "configured") => ({ type: "result", summary: { seq, disposition, requests: 0 }, ready: [] });

describe("bounded synchronous primitive command capture", () => {
  it("snapshots nested params and context before readiness, with ordered void calls and no arbitrary data", async () => {
    const chamber = controlledChamber();
    const context = { ...page, secret: { never: "cloned" } };
    const params = { send_to: "AW-0000000000/SYNTHETIC_LABEL", value: 33.5, currency: "EUR", transaction_id: "capture-one" };
    const adapter = createGoogleAdsPrototype({ endpoint, chamber, captureContext: () => context });
    try {
      expect(adapter.gtag("config", "AW-0000000000")).toBeUndefined();
      expect(adapter.gtag("event", "conversion", params)).toBeUndefined();
      params.value = 90;
      context.pageURL = "https://example.test/after-capture";
      expect(adapter.getState().queued).toBe(2);
      chamber.emit({ type: "phase", name: "configured" });
      expect(chamber.sent.filter((m) => m.type === "event").map((m) => m.event.seq)).toEqual([1]);
      chamber.emit(result(1));
      await Promise.resolve();
      await Promise.resolve();
      const captured = chamber.sent.filter((m) => m.type === "event")[1].event;
      expect(captured.payload).toEqual({
        args: ["event", "conversion", { send_to: "AW-0000000000/SYNTHETIC_LABEL", value: 33.5, currency: "EUR", transaction_id: "capture-one" }],
        context: page,
      });
      chamber.emit(result(2, "rejected"));
      expect((await adapter.flush()).queued).toBe(0);
      expect(JSON.stringify(adapter.getState())).not.toContain("capture-one");
    } finally { await adapter.dispose(); }
  });

  it("rechecks admission after a disposing capture hook and rejects reentrant calls without reversing order", async () => {
    const disposing = controlledChamber();
    let cleanup;
    const adapter = createGoogleAdsPrototype({
      endpoint, chamber: disposing,
      captureContext() { cleanup = adapter.dispose(); return page; },
    });
    adapter.gtag("config", "AW-0000000000");
    await cleanup;
    expect(await adapter.flush()).toMatchObject({ phase: "disposed", queued: 0, inFlight: false });
    expect(adapter.getState().outcomes).toEqual([{ seq: 1, disposition: "rejected", reason: "disposed" }]);
    expect(disposing.sent.some((m) => m.type === "event")).toBe(false);
    await adapter.dispose();

    const chamber = controlledChamber();
    let nested = false;
    const reentrant = createGoogleAdsPrototype({
      endpoint, chamber,
      captureContext() {
        if (!nested) { nested = true; reentrant.gtag("event", "conversion", {}); }
        return page;
      },
    });
    try {
      reentrant.gtag("config", "AW-0000000000");
      chamber.emit({ type: "phase", name: "configured" });
      expect(chamber.sent.filter((m) => m.type === "event").map((m) => m.event.seq)).toEqual([1]);
      chamber.emit(result(1));
      expect((await reentrant.flush()).outcomes.map((entry) => entry.reason || entry.disposition)).toEqual(["configured", "capture-reentrant"]);
    } finally { await reentrant.dispose(); }
  });

  it("does not execute accessors/callbacks or silently strip unsupported params", async () => {
    const chamber = controlledChamber();
    const getter = vi.fn(() => "must-not-read");
    const callback = vi.fn();
    const adapter = createGoogleAdsPrototype({ endpoint, chamber, captureContext: () => page });
    try {
      const accessor = { send_to: "AW-0000000000/SYNTHETIC_LABEL" };
      Object.defineProperty(accessor, "value", { get: getter });
      for (const params of [accessor, { event_callback: callback }, { value: {} }, { value: [] }, [], { extra: "unapproved" }]) {
        expect(adapter.gtag("event", "conversion", params)).toBeUndefined();
      }
      adapter.gtag("event", "conversion", { value: 1 }, callback);
      adapter.gtag("event", "conversion", callback);
      expect(getter).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
      expect(adapter.getState().queued).toBe(0);
      expect(adapter.getState().outcomes.every((entry) => entry.disposition === "rejected")).toBe(true);
      expect(chamber.sent.filter((m) => m.type === "event")).toEqual([]);
    } finally { await adapter.dispose(); }
    const source = { ...page };
    Object.defineProperty(source, "pageURL", { get: getter });
    const contextAdapter = createGoogleAdsPrototype({ endpoint, chamber: controlledChamber(), captureContext: () => source });
    try {
      contextAdapter.gtag("config", "AW-0000000000");
      expect(contextAdapter.getState().outcomes.at(-1).reason).toBe("unsupported-context");
      expect(getter).not.toHaveBeenCalled();
    } finally { await contextAdapter.dispose(); }
  });

  it("holds every off-ceiling or nonliteral/method/header/body/auth/redirect request before the Fetch driver", async () => {
    const chamber = controlledChamber({ configure: true });
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const adapter = createGoogleAdsPrototype({ endpoint, chamber, fetchImpl, captureContext: () => page, consent: { ad_storage: "granted" } });
    try {
      await Promise.resolve();
      const denied = [
        { url: "https://example.test/pagead/conversion/0000000000/?x=1" },
        { url: "http://localhost:43210/pagead/conversion/0000000000/?x=1" },
        { url: "http://127.0.0.1:43211/pagead/conversion/0000000000/?x=1" },
        { url: "http://user:pass@127.0.0.1:43210/pagead/conversion/0000000000/?x=1" },
        { url: "http://127.0.0.1:43210/pagead/conversion/123/?x=1" },
        { url: `${endpoint}?x=1#fragment` },
        { url: "http://127.0.0.1:43210/other/../pagead/conversion/0000000000/?x=1" },
        { url: `${endpoint}?x=1`, method: "POST" },
        { url: `${endpoint}?x=1`, headers: {} },
        { url: `${endpoint}?x=1`, body: "" },
        { url: `${endpoint}?x=1`, credentials: "include" },
        { url: `${endpoint}?x=1`, redirect: "follow" },
      ];
      denied.forEach((request, index) => chamber.emit({ type: "intercepted-fetch", id: index + 1, method: "GET", ...request }));
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(chamber.sent.filter((m) => m.type === "intercepted-fetch-response")).toHaveLength(denied.length);
      expect(chamber.sent.filter((m) => m.type === "intercepted-fetch-response").every((m) => m.status === 0)).toBe(true);
      expect(adapter.getState().host.ceilingHeld).toBeGreaterThan(0);
      chamber.emit({ type: "intercepted-fetch", id: 99, method: "GET", url: `${endpoint}?x=1` });
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: "GET", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" });
      expect(fetchImpl.mock.calls[0][1]).not.toHaveProperty("headers");
      expect(fetchImpl.mock.calls[0][1]).not.toHaveProperty("body");
    } finally { await adapter.dispose(); }
    expect(() => createGoogleAdsPrototype()).toThrow("literal-loopback-endpoint-required");
    expect(() => createGoogleAdsPrototype({ endpoint: "http://127.0.0.1:99999/pagead/conversion/0000000000/" })).toThrow("literal-loopback-endpoint-required");
  });

  it("makes startup and command timeouts terminal and ignores a genuinely delivered stale callback", async () => {
    const startup = controlledChamber();
    const first = createGoogleAdsPrototype({ endpoint, chamber: startup, captureContext: () => page, initTimeoutMs: 20 });
    try {
      first.gtag("config", "AW-0000000000");
      expect(await first.flush()).toMatchObject({ phase: "terminal", terminalReason: "init-timeout", queued: 0, inFlight: false });
      startup.emitLate({ type: "phase", name: "configured" });
      expect(startup.sent.filter((m) => m.type === "event")).toEqual([]);
    } finally { await first.dispose(); }
    const chamber = controlledChamber({ configure: true });
    const adapter = createGoogleAdsPrototype({ endpoint, chamber, captureContext: () => page, commandTimeoutMs: 20 });
    try {
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", {});
      const state = await adapter.flush();
      expect(state.terminalReason).toBe("command-timeout");
      expect(state.outcomes.map((entry) => entry.reason)).toEqual(["command-timeout", "command-timeout"]);
      chamber.emitLate(result(1));
      expect(adapter.getState()).toEqual(state);
      adapter.gtag("event", "conversion", {});
      expect(adapter.getState().outcomes.at(-1).reason).toBe("terminal");
      expect(chamber.sent.filter((m) => m.type === "event")).toHaveLength(1);
    } finally { await adapter.dispose(); }
  });

  it("makes worker loss and mismatched results visible, without leaking worker diagnostic values", async () => {
    const chamber = controlledChamber({ configure: true });
    const adapter = createGoogleAdsPrototype({ endpoint, chamber, captureContext: () => page });
    try {
      adapter.gtag("config", "AW-0000000000");
      await Promise.resolve();
      chamber.emit({ type: "result", summary: { seq: 90, disposition: "configured", requests: 0, secret: "private-worker-detail" } });
      expect(await adapter.flush()).toMatchObject({ terminalReason: "result-correlation-failed", phase: "terminal", queued: 0 });
      expect(JSON.stringify(adapter.getState())).not.toContain("private-worker-detail");
    } finally { await adapter.dispose(); }
    const lost = controlledChamber();
    const lossAdapter = createGoogleAdsPrototype({ endpoint, chamber: lost, captureContext: () => page });
    try {
      lossAdapter.gtag("config", "AW-0000000000");
      lost.error();
      expect(await lossAdapter.flush()).toMatchObject({ terminalReason: "worker-error", queued: 0 });
    } finally { await lossAdapter.dispose(); }
  });

  it("rejects a duplicate result delivered before the first result microtask settles, without starting the next command", async () => {
    const chamber = controlledChamber({ configure: true });
    const adapter = createGoogleAdsPrototype({ endpoint, chamber, captureContext: () => page, commandTimeoutMs: 30 });
    try {
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("config", "AW-0000000000");
      await Promise.resolve();
      chamber.emit(result(1));
      chamber.emit(result(1));
      expect((await adapter.flush()).terminalReason).toBe("result-correlation-failed");
      expect(chamber.sent.filter((m) => m.type === "event")).toHaveLength(1);
    } finally { await adapter.dispose(); }
  });

  it("rejects class instances as parameter containers rather than cloning arbitrary object identities", async () => {
    const chamber = controlledChamber();
    const adapter = createGoogleAdsPrototype({ endpoint, chamber, captureContext: () => page });
    try {
      const params = new class {
        send_to = "AW-0000000000/SYNTHETIC_LABEL";
        value = 5;
      }();
      adapter.gtag("event", "conversion", params);
      expect(adapter.getState().outcomes.at(-1)?.reason).toBe("unsupported-parameters");
      expect(adapter.getState().queued).toBe(0);
    } finally { await adapter.dispose(); }
  });

  it.each(["throw", "reject"])("retains sanitized event-driven %s cleanup failure across repeated dispose and still attempts listener removal", async (mode) => {
    const chamber = controlledChamber();
    const removed = vi.fn(() => { throw new Error("private-listener"); });
    chamber.onMessage = () => removed;
    chamber.dispose = vi.fn(() => {
      if (mode === "throw") throw new Error("private-dispose");
      return Promise.reject(new Error("private-dispose"));
    });
    const adapter = createGoogleAdsPrototype({ endpoint, chamber, captureContext: () => page });
    chamber.error();
    await expect(adapter.dispose()).rejects.toThrow("prototype-cleanup-failed");
    await expect(adapter.dispose()).rejects.toThrow("prototype-cleanup-failed");
    expect(removed).toHaveBeenCalledTimes(1);
    expect(chamber.dispose).toHaveBeenCalledTimes(1);
    expect(adapter.getState()).toMatchObject({ phase: "terminal", terminalReason: "worker-error", cleanupFailure: "transport-dispose-failed" });
    expect(JSON.stringify(adapter.getState())).not.toContain("private-");
  });

  it("bounds queue, outcome history, flush waiters and lifetime admission", async () => {
    const chamber = controlledChamber();
    const adapter = createGoogleAdsPrototype({ endpoint, chamber, captureContext: () => page, queueLimit: 1 });
    try {
      adapter.gtag("config", "AW-0000000000");
      for (let index = 0; index < 300; index += 1) adapter.gtag("config", "AW-0000000000");
      expect(adapter.getState()).toMatchObject({ queued: 1, truncated: 44 });
      expect(adapter.getState().outcomes).toHaveLength(256);
      const waits = Array.from({ length: 16 }, () => adapter.flush());
      expect((await adapter.flush()).flush).toBe("waiter-limit");
      await adapter.dispose();
      await Promise.all(waits);
    } finally { await adapter.dispose(); }
    const lifetime = controlledChamber({ configure: true });
    const bounded = createGoogleAdsPrototype({ endpoint, chamber: lifetime, captureContext: () => page });
    try {
      await Promise.resolve();
      for (let seq = 1; seq <= 256; seq += 1) {
        bounded.gtag("config", "AW-0000000000");
        lifetime.emit(result(seq));
        await bounded.flush();
      }
      bounded.gtag("config", "AW-0000000000");
      expect(bounded.getState().outcomes.at(-1).reason).toBe("session-command-limit");
      expect(lifetime.sent.filter((m) => m.type === "event")).toHaveLength(256);
    } finally { await bounded.dispose(); }
  });
});
