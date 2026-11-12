import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";

const endpoint = "http://127.0.0.1:41234/pagead/conversion/0000000000/";
const context = { pageURL: "https://example.test/bootstrap", referrer: "" };
const selector = "AW-0000000000/SYNTHETIC_LABEL";

async function local(options, check) {
  let receiver, chamber, adapter, cause;
  try {
    receiver = await createConversionReceiver();
    chamber = createNodeConversionChamber();
    adapter = createGoogleAdsPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: () => context,
      consent: { ad_storage: "granted" }, ...options,
    });
    await check({ receiver, chamber, adapter });
  } catch (error) { cause = error; throw error; }
  finally { await closeConversionResources({ adapter, chamber, receiver, cause }); }
}

function fakeChamber() {
  let listener;
  return {
    sent: [],
    postMessage(message) {
      this.sent.push(message);
      if (message.type === "init") queueMicrotask(() => listener?.({ type: "phase", name: "configured" }));
    },
    onMessage(callback) { listener = callback; return () => { listener = undefined; }; },
    onError() { return () => {}; },
    emit(message) { listener?.(message); },
    dispose() {},
  };
}

describe("experimental Google bootstrap command", () => {
  it("preserves default behavior and rejects a nonboolean opt-in", async () => {
    expect(() => createGoogleAdsPrototype({ endpoint, experimentalBootstrap: "yes" })).toThrow("invalid-experimental-option");
    expect(() => createGoogleAdsConversionPrototype({ endpoint, experimentalBootstrap: "yes" })).toThrow("invalid-experimental-option");
    await local({}, async ({ adapter, receiver }) => {
      adapter.gtag("js", new Date(123));
      adapter.gtag("js", 123);
      const state = await adapter.flush();
      expect(state.outcomes.map(({ reason }) => reason)).toEqual(["unsupported-argument", "unsupported-command"]);
      expect(receiver.arrivals).toEqual([]);
    });
  }, 8000);

  it("snapshots a Date into a primitive and processes bootstrap, config and conversion in order", async () => {
    await local({ experimentalBootstrap: true }, async ({ adapter, chamber, receiver }) => {
      const messages = [];
      const unsubscribe = chamber.onMessage((message) => messages.push(message));
      const post = vi.spyOn(chamber, "postMessage");
      try {
        const date = new Date(123456);
        const getter = vi.fn(() => { throw new Error("must-not-read"); });
        for (const key of ["getTime", "valueOf", "toJSON", Symbol.toPrimitive]) {
          Object.defineProperty(date, key, { get: getter });
        }
        adapter.gtag("js", date);
        Date.prototype.setTime.call(date, 999999);
        adapter.gtag("config", "AW-0000000000");
        adapter.gtag("event", "conversion", { send_to: selector, value: 3 });
        const state = await adapter.flush();
        expect(state.outcomes.map(({ disposition }) => disposition))
          .toEqual(["bootstrap-accepted", "configured", "transport-settled"]);
        expect(messages.filter(({ type }) => type === "result").map(({ summary }) => summary.seq)).toEqual([1, 2, 3]);
        const event = post.mock.calls.map(([message]) => message).find((message) => message.type === "event");
        expect(event.event.payload.args).toEqual(["js", 123456]);
        expect(typeof event.event.payload.args[1]).toBe("number");
        expect(getter).not.toHaveBeenCalled();
        expect(receiver.arrivals).toHaveLength(1);
        expect(state.host.dispatchAttempts).toBe(1);
        expect(state.fullCompatibility).toBe(false);
        expect(JSON.stringify(state)).not.toContain("123456");
      } finally { unsubscribe(); }
    });
  }, 8000);

  it("uses the captured Date intrinsic, accepts a cross-realm Date, and does not invoke overridden methods", async () => {
    await local({ experimentalBootstrap: true }, async ({ adapter }) => {
      const overridden = vi.spyOn(Date.prototype, "getTime").mockImplementation(() => { throw new Error("must-not-run"); });
      try {
        adapter.gtag("js", new Date(321));
        adapter.gtag("js", runInNewContext("new Date(654)"));
        expect((await adapter.flush()).outcomes.map(({ disposition }) => disposition))
          .toEqual(["bootstrap-accepted", "bootstrap-accepted"]);
        expect(overridden).not.toHaveBeenCalled();
      } finally { overridden.mockRestore(); }
    });
  }, 8000);

  it("fails closed if the Date method was replaced before module initialization", async () => {
    const overridden = vi.spyOn(Date.prototype, "getTime").mockImplementation(() => { throw new Error("must-not-run"); });
    const chamber = fakeChamber();
    let adapter;
    try {
      vi.resetModules();
      const { createGoogleAdsPrototype: freshAdapter } = await import("../adapters/google-ads-prototype.js");
      adapter = freshAdapter({ endpoint, chamber, captureContext: () => context, experimentalBootstrap: true });
      adapter.gtag("js", new Date(123));
      expect((await adapter.flush()).outcomes).toMatchObject([{ disposition: "rejected", reason: "unsupported-bootstrap" }]);
      expect(overridden).not.toHaveBeenCalled();
    } finally { await adapter?.dispose(); overridden.mockRestore(); }
  });

  it("does not execute a Date prototype accessor during module initialization", async () => {
    const original = Object.getOwnPropertyDescriptor(Date.prototype, "getTime");
    const getter = vi.fn(() => { throw new Error("must-not-run"); });
    let adapter;
    try {
      Object.defineProperty(Date.prototype, "getTime", { configurable: true, get: getter });
      vi.resetModules();
      const { createGoogleAdsPrototype: freshAdapter } = await import("../adapters/google-ads-prototype.js");
      adapter = freshAdapter({ endpoint, chamber: fakeChamber(), captureContext: () => context, experimentalBootstrap: true });
      adapter.gtag("js", new Date(1));
      expect((await adapter.flush()).outcomes).toMatchObject([{ disposition: "rejected", reason: "unsupported-bootstrap" }]);
      expect(getter).not.toHaveBeenCalled();
    } finally { await adapter?.dispose(); Object.defineProperty(Date.prototype, "getTime", original); }
  });

  it("rejects malformed, invalid and proxy Dates without invoking their accessors", async () => {
    await local({ experimentalBootstrap: true }, async ({ adapter, receiver }) => {
      const getter = vi.fn(() => { throw new Error("must-not-run"); });
      const fake = { get getTime() { return getter(); }, [Symbol.toPrimitive]: getter };
      const proxy = new Proxy(new Date(1), { get: getter, getPrototypeOf: getter });
      for (const value of [undefined, null, 0, "0", {}, fake, proxy, Object.create(Date.prototype), new Date(NaN)]) {
        adapter.gtag("js", value);
      }
      adapter.gtag("js", new Date(1), "extra");
      const state = await adapter.flush();
      expect(state.outcomes).toHaveLength(10);
      expect(state.outcomes.every(({ disposition }) => disposition === "rejected")).toBe(true);
      expect(getter).not.toHaveBeenCalled();
      expect(receiver.arrivals).toEqual([]);
    });
  }, 8000);

  it("independently validates the serialized timestamp inside the connector", () => {
    const connector = createGoogleAdsConversionPrototype({ endpoint, experimentalBootstrap: true });
    connector.init();
    const command = (args) => connector.handle({ type: "google-ads-command", payload: { args, context } });
    for (const time of [0, -8640000000000000, 8640000000000000]) expect(command(["js", time])).toEqual([]);
    for (const time of [NaN, Infinity, -Infinity, 0.5, 8640000000000001, -8640000000000001, "1", new Date(1), {}, null]) {
      expect(() => command(["js", time])).toThrow("unsupported-bootstrap");
    }
    expect(() => command(["js", 1, 2])).toThrow("unsupported-bootstrap");
  });

  it("keeps bootstrap local and does not change host consent or require native ordering", async () => {
    await local({ experimentalBootstrap: true, consent: { ad_storage: "denied" } }, async ({ adapter, receiver }) => {
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("js", new Date(1));
      adapter.gtag("js", new Date(2));
      adapter.gtag("event", "conversion", { send_to: selector });
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition))
        .toEqual(["configured", "bootstrap-accepted", "bootstrap-accepted", "held"]);
      expect(state.host).toMatchObject({ dispatchAttempts: 0, consentHeld: 1 });
      expect(receiver.arrivals).toEqual([]);
    });
  }, 8000);
});

describe("bootstrap worker acknowledgement correlation", () => {
  it("rejects a bootstrap acknowledgement when the feature is disabled", async () => {
    const chamber = fakeChamber();
    const adapter = createGoogleAdsPrototype({ endpoint, chamber, captureContext: () => context });
    try {
      adapter.gtag("config", "AW-0000000000");
      await vi.waitFor(() => expect(chamber.sent.some((item) => item.type === "event")).toBe(true));
      chamber.emit({ type: "result", summary: { seq: 1, disposition: "bootstrap-accepted", requests: 0 }, ready: [] });
      expect((await adapter.flush()).terminalReason).toBe("invalid-worker-result");
    } finally { await adapter.dispose(); }
  });

  it("rejects duplicate or unsolicited acknowledgements", async () => {
    const chamber = fakeChamber();
    const adapter = createGoogleAdsPrototype({ endpoint, chamber, captureContext: () => context, experimentalBootstrap: true });
    try {
      adapter.gtag("js", new Date(1));
      adapter.gtag("config", "AW-0000000000");
      await vi.waitFor(() => expect(chamber.sent.filter((item) => item.type === "event")).toHaveLength(1));
      chamber.emit({ type: "result", summary: { seq: 1, disposition: "bootstrap-accepted", requests: 0 }, ready: [] });
      await vi.waitFor(() => expect(chamber.sent.filter((item) => item.type === "event")).toHaveLength(2));
      chamber.emit({ type: "result", summary: { seq: 1, disposition: "bootstrap-accepted", requests: 0 }, ready: [] });
      const state = await adapter.flush();
      expect(state.terminalReason).toBe("result-correlation-failed");
      expect(state.outcomes.filter(({ disposition }) => disposition === "bootstrap-accepted")).toHaveLength(1);
    } finally { await adapter.dispose(); }
  });

  it.each(["wrong-command", "configured-for-bootstrap", "rejected-bootstrap", "contradictory-ack",
    "extra-field", "nonempty-ready", "missing-ready", "extra-message-field",
    "dispatch-during-bootstrap", "wrong-sequence"])("fails closed on %s", async (scenario) => {
    const chamber = fakeChamber();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const adapter = createGoogleAdsPrototype({ endpoint, chamber, fetchImpl, captureContext: () => context,
      experimentalBootstrap: true, consent: { ad_storage: "granted" } });
    try {
      if (scenario === "wrong-command") adapter.gtag("config", "AW-0000000000");
      else adapter.gtag("js", new Date(123));
      adapter.gtag("event", "conversion", { send_to: selector });
      await vi.waitFor(() => expect(chamber.sent.some((item) => item.type === "event")).toBe(true));
      if (scenario === "dispatch-during-bootstrap") {
        chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: `${endpoint}?label=SYNTHETIC_LABEL` });
      } else {
        chamber.emit({ type: "result", summary: {
          seq: scenario === "wrong-sequence" ? 9 : 1,
          disposition: scenario === "configured-for-bootstrap" ? "configured" :
            scenario === "rejected-bootstrap" ? "rejected" : "bootstrap-accepted",
          requests: 0, ...(scenario === "contradictory-ack" ? { status: 204 } : {}),
          ...(scenario === "extra-field" ? { extra: "private-detail" } : {}),
        }, ...(scenario === "missing-ready" ? {} : { ready: scenario === "nonempty-ready" ? [{}] : [] }),
        ...(scenario === "extra-message-field" ? { extra: "private-detail" } : {}) });
      }
      const state = await adapter.flush();
      expect(state.phase).toBe("terminal");
      expect(state.terminalReason).toBe(scenario === "dispatch-during-bootstrap" ? "request-correlation-failed" :
        scenario === "wrong-sequence" ? "result-correlation-failed" : "result-transport-mismatch");
      expect(state.outcomes.every(({ disposition }) => disposition !== "bootstrap-accepted")).toBe(true);
      expect(JSON.stringify(state)).not.toContain("private-detail");
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
  });
});
