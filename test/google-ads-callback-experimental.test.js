import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";
import { reportGoogleAdsConversionPrototype } from "../rig/google-ads-conversion-prototype-report.mjs";

const selector = "AW-0000000000/SYNTHETIC_LABEL";

async function local(options, check) {
  let receiver, chamber, adapter, cause;
  try {
    receiver = await createConversionReceiver({ respond: options.respond });
    chamber = createNodeConversionChamber();
    const { respond: _respond, ...adapterOptions } = options;
    adapter = createGoogleAdsPrototype({
      endpoint: receiver.endpoint, chamber,
      captureContext: () => ({ pageURL: "https://example.test/checkout", referrer: "" }),
      consent: { ad_storage: "granted" }, ...adapterOptions,
    });
    await check({ adapter, receiver, chamber });
  } catch (error) { cause = error; throw error; }
  finally { await closeConversionResources({ adapter, chamber, receiver, cause }); }
}

describe("experimental host-only conversion callbacks", () => {
  it("keeps the original mode rejecting callbacks and validates the opt-in", async () => {
    expect(() => createGoogleAdsPrototype({
      endpoint: "http://127.0.0.1:43210/pagead/conversion/0000000000/", experimentalCallbacks: "true",
    })).toThrow("invalid-experimental-option");
    await local({}, async ({ adapter, receiver }) => {
      const callback = vi.fn();
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", { send_to: selector, event_callback: callback, event_timeout: 100 });
      const state = await adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({ disposition: "rejected", reason: "unsupported-parameters" });
      expect(state).not.toHaveProperty("callbacks");
      expect(callback).not.toHaveBeenCalled();
      expect(receiver.arrivals).toEqual([]);
    });
  }, 8000);

  it("invokes once after a real worker and independently received response, with no function in worker messages", async () => {
    let arrived, release;
    const arrival = new Promise((resolve) => { arrived = resolve; });
    await local({
      experimentalCallbacks: true,
      respond(_request, response) { release = () => response.writeHead(204).end(); arrived(); },
    }, async ({ adapter, receiver, chamber }) => {
      const intercepted = [];
      const sent = [];
      const postMessage = chamber.postMessage;
      chamber.postMessage = (message) => { sent.push(structuredClone(message)); postMessage(message); };
      const unsubscribe = chamber.onMessage((message) => { if (message.type === "intercepted-fetch") intercepted.push(message); });
      try {
        const callback = vi.fn();
        adapter.gtag("config", "AW-0000000000");
        adapter.gtag("event", "conversion", { send_to: selector, value: 7, event_callback: callback, event_timeout: 1000 });
        const done = adapter.flush();
        await arrival;
        expect(receiver.arrivals).toHaveLength(1);
        expect(callback).not.toHaveBeenCalled();
        expect(intercepted).toHaveLength(1);
        expect(JSON.stringify(intercepted)).not.toContain("event_callback");
        const event = sent.find((message) => message.type === "event" && message.event.payload.args[0] === "event");
        expect(event.event.payload.args[2]).toEqual({ send_to: selector, value: 7 });
        release();
        const state = await done;
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith();
        expect(state.callbacks).toMatchObject({ invoked: 1, timeout: 0, errors: 0, pending: 0 });
        expect(state.outcomes.at(-1)).toMatchObject({ disposition: "transport-settled" });
        expect(state.receipt).toBe("not-observed-by-adapter");
      } finally { unsubscribe(); }
    });
  }, 8000);

  it("fires a timeout once without treating it as receipt or cancelling a later local settlement", async () => {
    let arrived, release, notified;
    const arrival = new Promise((resolve) => { arrived = resolve; });
    const callbackDone = new Promise((resolve) => { notified = resolve; });
    await local({
      experimentalCallbacks: true, transportTimeoutMs: 1000,
      respond(_request, response) { release = () => response.writeHead(204).end(); arrived(); },
    }, async ({ adapter, receiver }) => {
      const callback = vi.fn(() => notified());
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", { send_to: selector, event_callback: callback, event_timeout: 80 });
      const done = adapter.flush();
      await Promise.all([arrival, callbackDone]);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(adapter.getState()).toMatchObject({
        inFlight: true, receipt: "not-observed-by-adapter",
        callbacks: { invoked: 1, timeout: 1, pending: 0 },
      });
      release();
      const state = await done;
      expect(state.outcomes.at(-1).disposition).toBe("transport-settled");
      expect(callback).toHaveBeenCalledTimes(1);
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("fires on denied and rejected worker results without dispatch or a success-shaped callback", async () => {
    await local({ experimentalCallbacks: true, consent: { ad_storage: "denied" } }, async ({ adapter, receiver }) => {
      const held = vi.fn();
      const rejected = vi.fn();
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", { send_to: selector, event_callback: held, event_timeout: 1000 });
      adapter.gtag("event", "conversion", { send_to: selector, value: "invalid", event_callback: rejected, event_timeout: 1000 });
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition))
        .toEqual(["configured", "held-at-seal", "unsupported-value"]);
      expect(held).toHaveBeenCalledOnce();
      expect(rejected).toHaveBeenCalledOnce();
      expect(state.callbacks).toMatchObject({ invoked: 2, errors: 0, pending: 0 });
      expect(receiver.arrivals).toEqual([]);
    });
  }, 8000);

  it("rejects malformed callback metadata without invoking it or losing the next conversion", async () => {
    await local({ experimentalCallbacks: true }, async ({ adapter, receiver }) => {
      const callback = vi.fn();
      const getter = vi.fn(() => callback);
      const accessor = { send_to: selector, event_timeout: 100 };
      Object.defineProperty(accessor, "event_callback", { get: getter });
      adapter.gtag("config", "AW-0000000000");
      for (const params of [
        { send_to: selector, event_callback: callback },
        { send_to: selector, event_timeout: 100 },
        { send_to: selector, event_callback: callback, event_timeout: 0 },
        { send_to: selector, event_callback: "not-function", event_timeout: 100 },
        accessor,
      ]) adapter.gtag("event", "conversion", params);
      adapter.gtag("event", "conversion", { send_to: selector });
      const state = await adapter.flush();
      expect(state.outcomes.slice(1, 6).every((item) => item.disposition === "rejected")).toBe(true);
      expect(state.outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
      expect(callback).not.toHaveBeenCalled();
      expect(getter).not.toHaveBeenCalled();
    });
  }, 8000);

  it("reports callback exceptions without disclosing error text or disrupting subsequent commands", async () => {
    await local({ experimentalCallbacks: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", {
        send_to: selector, event_timeout: 1000, event_callback() { throw new Error("private-callback-error"); },
      });
      adapter.gtag("event", "conversion", { send_to: selector });
      const state = await adapter.flush();
      expect(state.outcomes.slice(-2).every((item) => item.disposition === "transport-settled")).toBe(true);
      expect(state.callbacks).toMatchObject({ invoked: 1, errors: 1, pending: 0 });
      expect(JSON.stringify(state)).not.toContain("private-callback-error");
      expect(receiver.arrivals).toHaveLength(2);
    });
  }, 8000);

  it("allows a callback to enqueue a conversion and keeps flush pending until both finish", async () => {
    await local({ experimentalCallbacks: true }, async ({ adapter, receiver }) => {
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", {
        send_to: selector, value: 1, event_timeout: 1000,
        event_callback() { adapter.gtag("event", "conversion", { send_to: selector, value: 2 }); },
      });
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.disposition)).toEqual(["configured", "transport-settled", "transport-settled"]);
      expect(receiver.arrivals.map(({ url }) => new URL(url).searchParams.get("value"))).toEqual(["1", "2"]);
      expect(state.callbacks).toMatchObject({ invoked: 1, pending: 0 });
    });
  }, 8000);

  it("cancels a pending callback on dispose without letting its timer execute it later", async () => {
    await local({ experimentalCallbacks: true }, async ({ adapter, receiver }) => {
      const callback = vi.fn();
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", { send_to: selector, event_callback: callback, event_timeout: 30 });
      await adapter.dispose();
      await new Promise((resolve) => setTimeout(resolve, 70));
      expect(callback).not.toHaveBeenCalled();
      expect(adapter.getState()).toMatchObject({ phase: "disposed", callbacks: { invoked: 0, cancelled: 1, pending: 0 } });
      expect(receiver.arrivals).toEqual([]);
    });
  }, 8000);

  it("invokes once after startup failure, and exposes async callback rejection without its contents", async () => {
    const chamber = {
      postMessage() {}, onMessage() { return () => {}; }, onError() { return () => {}; }, dispose() {},
    };
    const adapter = createGoogleAdsPrototype({
      endpoint: "http://127.0.0.1:43210/pagead/conversion/0000000000/",
      chamber, experimentalCallbacks: true, initTimeoutMs: 20,
      captureContext: () => ({ pageURL: "https://example.test/", referrer: "" }),
    });
    try {
      const callback = vi.fn(() => Promise.reject(new Error("private-async-error")));
      adapter.gtag("event", "conversion", { send_to: selector, event_callback: callback, event_timeout: 1000 });
      const state = await adapter.flush();
      await Promise.resolve();
      expect(state).toMatchObject({ phase: "terminal", terminalReason: "init-timeout" });
      expect(callback).toHaveBeenCalledOnce();
      expect(adapter.getState().callbacks).toMatchObject({ invoked: 1, errors: 1, pending: 0 });
      expect(JSON.stringify(adapter.getState())).not.toContain("private-async-error");
    } finally { await adapter.dispose(); }
  }, 8000);

  it("cancels a terminally scheduled callback if disposed before its microtask", async () => {
    let listener;
    const chamber = {
      postMessage() {}, onMessage(fn) { listener = fn; return () => {}; }, onError() { return () => {}; }, dispose() {},
    };
    const adapter = createGoogleAdsPrototype({
      endpoint: "http://127.0.0.1:43210/pagead/conversion/0000000000/",
      chamber, experimentalCallbacks: true,
      captureContext: () => ({ pageURL: "https://example.test/", referrer: "" }),
    });
    const callback = vi.fn();
    adapter.gtag("event", "conversion", { send_to: selector, event_callback: callback, event_timeout: 1000 });
    listener({ type: "fatal", message: "worker-configuration-failed" });
    await adapter.dispose();
    expect(callback).not.toHaveBeenCalled();
    expect(adapter.getState()).toMatchObject({
      phase: "terminal", terminalReason: "worker-configuration-failed",
      callbacks: { invoked: 0, cancelled: 1, pending: 0 },
    });
  }, 8000);

  it("does not leave an admitted event behind if callback timer creation fails", async () => {
    const chamber = {
      postMessage() {}, onMessage() { return () => {}; }, onError() { return () => {}; }, dispose() {},
    };
    const adapter = createGoogleAdsPrototype({
      endpoint: "http://127.0.0.1:43210/pagead/conversion/0000000000/",
      chamber, experimentalCallbacks: true,
      captureContext: () => ({ pageURL: "https://example.test/", referrer: "" }),
    });
    const realSetTimeout = globalThis.setTimeout;
    const timer = vi.spyOn(globalThis, "setTimeout").mockImplementation((fn, ms, ...args) => {
      if (ms === 123) throw new Error("private-timer-failure");
      return realSetTimeout(fn, ms, ...args);
    });
    try {
      adapter.gtag("event", "conversion", { send_to: selector, event_callback() {}, event_timeout: 123 });
      expect(adapter.getState()).toMatchObject({
        queued: 0, inFlight: false, callbacks: { pending: 0 },
        outcomes: [{ disposition: "rejected", reason: "capture-unavailable" }],
      });
      expect(JSON.stringify(adapter.getState())).not.toContain("private-timer-failure");
    } finally { timer.mockRestore(); await adapter.dispose(); }
  }, 8000);

  it("settles a callback once on a stalled transport failure, without claiming a successful conversion", async () => {
    await local({
      experimentalCallbacks: true, transportTimeoutMs: 40, respond() {},
    }, async ({ adapter, receiver }) => {
      const callback = vi.fn();
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", { send_to: selector, event_callback: callback, event_timeout: 1000 });
      const state = await adapter.flush();
      expect(state.phase).toBe("terminal");
      expect(["transport-timeout", "transport-failed"]).toContain(state.terminalReason);
      expect(state.outcomes.some((item) => item.disposition === "transport-settled")).toBe(false);
      expect(state.callbacks).toMatchObject({ invoked: 1, timeout: 0, pending: 0 });
      expect(callback).toHaveBeenCalledOnce();
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("composes callback handling with scoped values and experimental destination routing", async () => {
    let receiver, chamber, adapter;
    try {
      receiver = await createConversionReceiver({ conversionId: "12345" });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, experimentalCallbacks: true,
        experimentalParameterScopes: true, experimentalRouting: true,
        captureContext: () => ({ pageURL: "https://example.test/checkout", referrer: "" }),
        consent: { ad_storage: "granted" },
      });
      const callback = vi.fn();
      adapter.gtag("set", "value", 8);
      adapter.gtag("config", "AW-12345", { currency: "CAD" });
      adapter.gtag("event", "conversion", {
        send_to: "AW-12345/LOCAL_ACTION", event_callback: callback, event_timeout: 1000,
      });
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.disposition))
        .toEqual(["scope-updated", "configured", "transport-settled"]);
      expect(callback).toHaveBeenCalledOnce();
      const url = new URL(receiver.arrivals[0].url);
      expect(url.pathname).toBe("/pagead/conversion/12345/");
      expect([...url.searchParams]).toEqual([
        ["label", "LOCAL_ACTION"], ["value", "8"], ["currency_code", "CAD"], ["url", "https://example.test/checkout"],
      ]);
      const inputs = {
        observedRequests: receiver.arrivals, endpoint: receiver.endpoint, experimentalRouting: true,
        experimentalParameterScopes: true, experimentalCallbacks: true,
        commandSnapshots: [{
          args: ["event", "conversion", {
            send_to: "AW-12345/LOCAL_ACTION", event_callback: callback, event_timeout: 1000,
          }],
          context: { pageURL: "https://example.test/checkout", referrer: "" },
        }],
        scopeSnapshots: [{ global: { value: 8 }, config: { currency: "CAD" } }],
      };
      const report = reportGoogleAdsConversionPrototype(inputs);
      expect(report.local[0].relationshipsPreserved).toBe(true);
      expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false });
      expect(callback).toHaveBeenCalledOnce();
      expect(reportGoogleAdsConversionPrototype({ ...inputs, experimentalCallbacks: false }).local[0].relationshipsPreserved).toBe(false);
    } finally { await closeConversionResources({ adapter, chamber, receiver }); }
  }, 8000);
});
