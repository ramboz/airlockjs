import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";

async function local(options, check) {
  let first, second, chamber, adapter, cause;
  try {
    first = await createConversionReceiver({ conversionId: "111", respond: options.firstResponse });
    second = await createConversionReceiver({ conversionId: "222", respond: options.secondResponse });
    chamber = createNodeConversionChamber();
    const { firstResponse: _firstResponse, secondResponse: _secondResponse, ...adapterOptions } = options;
    adapter = createGoogleAdsPrototype({
      endpoint: first.endpoint, additionalEndpoint: second.endpoint, chamber,
      experimentalRouting: true, experimentalMultiDestination: true,
      captureContext: () => ({ pageURL: "https://example.test/checkout", referrer: "" }),
      consent: { ad_storage: "granted" }, ...adapterOptions,
    });
    await check({ adapter, first, second });
  } catch (error) { cause = error; throw error; }
  finally {
    try { await closeConversionResources({ adapter, chamber, receiver: first, cause }); }
    finally { await closeConversionResources({ receiver: second, cause }); }
  }
}

const targets = ["AW-111/LOCAL_ONE", "AW-222/LOCAL_TWO"];
const setup = (adapter) => {
  adapter.gtag("config", "AW-111", { currency: "USD" });
  adapter.gtag("config", "AW-222", { currency: "CAD" });
};

describe("experimental multiple conversion destinations", () => {
  it("routes a snapshotted array to two independent receivers with per-destination scopes and callback", async () => {
    await local({ experimentalParameterScopes: true, experimentalCallbacks: true }, async ({ adapter, first, second }) => {
      const callback = vi.fn();
      const sendTo = [...targets];
      setup(adapter);
      adapter.gtag("event", "conversion", { send_to: sendTo, value: 3, event_callback: callback, event_timeout: 1000 });
      sendTo[0] = "AW-222/CHANGED";
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.disposition)).toEqual(["configured", "configured", "transport-settled"]);
      expect(state.outcomes.at(-1).branches).toEqual([
        { index: 0, disposition: "transport-settled", status: 204 },
        { index: 1, disposition: "transport-settled", status: 204 },
      ]);
      expect(first.arrivals).toHaveLength(1);
      expect(second.arrivals).toHaveLength(1);
      expect([...new URL(first.arrivals[0].url).searchParams]).toEqual([
        ["label", "LOCAL_ONE"], ["value", "3"], ["currency_code", "USD"], ["url", "https://example.test/checkout"],
      ]);
      expect([...new URL(second.arrivals[0].url).searchParams]).toEqual([
        ["label", "LOCAL_TWO"], ["value", "3"], ["currency_code", "CAD"], ["url", "https://example.test/checkout"],
      ]);
      expect(callback).toHaveBeenCalledOnce();
      expect(state).toMatchObject({ receipt: "not-observed-by-adapter", fullCompatibility: false, host: { dispatchAttempts: 2 } });
      expect(JSON.stringify(state)).not.toContain("LOCAL_ONE");
      state.outcomes.at(-1).branches[0].status = 500;
      expect(adapter.getState().outcomes.at(-1).branches[0].status).toBe(204);
    });
  }, 8000);

  it("checks current consent separately for each destination, without claiming full success", async () => {
    let arrived, release;
    const firstArrival = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("first-arrival-timeout")), 2000);
      arrived = () => { clearTimeout(timer); resolve(); };
    });
    await local({
      experimentalParameterScopes: true,
      firstResponse(_request, response) { release = () => response.writeHead(204).end(); arrived(); },
    }, async ({ adapter, first, second }) => {
      setup(adapter);
      adapter.gtag("event", "conversion", { send_to: targets });
      const done = adapter.flush();
      await firstArrival;
      adapter.setConsent({ ad_storage: "denied" });
      release();
      const state = await done;
      expect(first.arrivals).toHaveLength(1);
      expect(second.arrivals).toEqual([]);
      expect(state.outcomes.at(-1)).toMatchObject({
        disposition: "partial",
        branches: [
          { index: 0, disposition: "transport-settled", status: 204 },
          { index: 1, disposition: "held", status: 0, reason: "held-at-seal" },
        ],
      });
      expect(state.host).toMatchObject({ dispatchAttempts: 1, consentHeld: 1 });
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(second.arrivals).toEqual([]);
    });
  }, 8000);

  it("reports each HTTP failure independently and does not treat partial settlement as success", async () => {
    await local({ experimentalParameterScopes: true, firstResponse(_request, response) { response.writeHead(503).end(); } }, async ({ adapter, first, second }) => {
      setup(adapter);
      adapter.gtag("event", "conversion", { send_to: targets });
      const state = await adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({
        disposition: "partial",
        branches: [{ index: 0, disposition: "failed", status: 503 }, { index: 1, disposition: "transport-settled", status: 204 }],
      });
      expect(first.arrivals).toHaveLength(1);
      expect(second.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("rejects unconfigured, duplicate and unlisted destinations before any receiver arrival", async () => {
    await local({ experimentalParameterScopes: true }, async ({ adapter, first, second }) => {
      adapter.gtag("config", "AW-111");
      adapter.gtag("event", "conversion", { send_to: targets });
      adapter.gtag("config", "AW-222");
      adapter.gtag("event", "conversion", { send_to: ["AW-111/ONE", "AW-111/TWO"] });
      adapter.gtag("event", "conversion", { send_to: ["AW-111/ONE", "AW-333/THREE"] });
      const state = await adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition))
        .toEqual(["configured", "conversion-before-config", "configured", "destination-mismatch", "destination-mismatch"]);
      expect(first.arrivals).toEqual([]);
      expect(second.arrivals).toEqual([]);
    });
  }, 8000);

  it("records an unknown in-flight branch and an unattempted branch on transport timeout", async () => {
    await local({ experimentalParameterScopes: true, transportTimeoutMs: 250, firstResponse() {} }, async ({ adapter, first, second }) => {
      setup(adapter);
      adapter.gtag("event", "conversion", { send_to: targets });
      const state = await adapter.flush();
      expect(state.phase).toBe("terminal");
      expect(state.outcomes.at(-1).disposition).not.toBe("transport-settled");
      expect(state.outcomes.at(-1).branches).toHaveLength(2);
      expect(["unknown", "failed"]).toContain(state.outcomes.at(-1).branches[0].disposition);
      expect(state.outcomes.at(-1).branches[1]).toEqual({ index: 1, disposition: "not-attempted" });
      expect(first.arrivals).toHaveLength(1);
      expect(second.arrivals).toEqual([]);
    });
  }, 8000);

  it("preserves input order for reversed destinations and supports a single selected destination", async () => {
    await local({ experimentalParameterScopes: true }, async ({ adapter, first, second }) => {
      setup(adapter);
      adapter.gtag("event", "conversion", { send_to: [targets[1], targets[0]] });
      adapter.gtag("event", "conversion", { send_to: targets[1] });
      const state = await adapter.flush();
      expect(state.outcomes.slice(-2).map((outcome) => outcome.branches)).toEqual([
        [{ index: 0, disposition: "transport-settled", status: 204 }, { index: 1, disposition: "transport-settled", status: 204 }],
        [{ index: 0, disposition: "transport-settled", status: 204 }],
      ]);
      expect(first.arrivals).toHaveLength(1);
      expect(second.arrivals).toHaveLength(2);
      expect(new URL(first.arrivals[0].url).searchParams.get("currency_code")).toBe("USD");
      expect(second.arrivals.map(({ url }) => new URL(url).searchParams.get("currency_code"))).toEqual(["CAD", "CAD"]);
    });
  }, 8000);

  it("stops after a transport failure and invokes the host-only callback without reporting success", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("offline"); });
    await local({ experimentalParameterScopes: true, experimentalCallbacks: true, fetchImpl }, async ({ adapter, first, second }) => {
      const callback = vi.fn();
      setup(adapter);
      adapter.gtag("event", "conversion", { send_to: targets, event_callback: callback, event_timeout: 1000 });
      const state = await adapter.flush();
      expect(state.phase).toBe("terminal");
      expect(state.outcomes.at(-1)).toMatchObject({
        disposition: "partial",
        branches: [
          { index: 0, disposition: "failed", status: 0, reason: "transport-failed" },
          { index: 1, disposition: "not-attempted" },
        ],
      });
      expect(fetchImpl).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledOnce();
      expect(first.arrivals).toEqual([]);
      expect(second.arrivals).toEqual([]);
    });
  }, 8000);

  it("enforces opt-in, literal endpoint and defensive array capture", async () => {
    const endpoint = "http://127.0.0.1:41234/pagead/conversion/111/";
    const second = "http://127.0.0.1:41235/pagead/conversion/222/";
    expect(() => createGoogleAdsPrototype({ endpoint, experimentalMultiDestination: true })).toThrow("invalid-experimental-option");
    for (const additionalEndpoint of [
      undefined, endpoint, "https://127.0.0.1:41235/pagead/conversion/222/",
      "http://localhost:41235/pagead/conversion/222/", "http://127.0.0.1:99999/pagead/conversion/222/",
      "http://127.0.0.1:41235/pagead/conversion/111/",
    ]) {
      expect(() => createGoogleAdsPrototype({ endpoint, additionalEndpoint, experimentalRouting: true, experimentalMultiDestination: true }))
        .toThrow("literal-loopback-endpoint-required");
      expect(() => createGoogleAdsConversionPrototype({ endpoint, additionalEndpoint, experimentalRouting: true, experimentalMultiDestination: true }))
        .toThrow("literal-loopback-endpoint-required");
    }
    const getter = vi.fn(() => targets[0]);
    const accessor = [...targets];
    Object.defineProperty(accessor, "0", { get: getter });
    const hole = Array(2);
    hole[1] = targets[1];
    const extended = [...targets];
    extended.extra = "not-allowed";
    await local({}, async ({ adapter, first, second: receiver }) => {
      for (const send_to of [accessor, hole, extended, [], [...targets, targets[0]]]) adapter.gtag("event", "conversion", { send_to });
      expect((await adapter.flush()).outcomes.every((outcome) => outcome.reason === "unsupported-parameters")).toBe(true);
      expect(getter).not.toHaveBeenCalled();
      expect(first.arrivals).toEqual([]);
      expect(receiver.arrivals).toEqual([]);
    });
    const connector = createGoogleAdsConversionPrototype({
      endpoint, additionalEndpoint: second, experimentalRouting: true, experimentalMultiDestination: true,
    });
    connector.init();
    connector.handle({ type: "google-ads-command", payload: { args: ["config", "AW-111"] } });
    expect(() => connector.handle({
      type: "google-ads-command", payload: {
        args: ["event", "conversion", { send_to: accessor }], context: { pageURL: "https://example.test/", referrer: "" },
      },
    })).toThrow("destination-mismatch");
    expect(getter).not.toHaveBeenCalled();
  }, 8000);
});

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

describe("bounded destination-array capture", () => {
  const first = "http://127.0.0.1:41234/pagead/conversion/111/";
  const second = "http://127.0.0.1:41235/pagead/conversion/222/";
  const context = { pageURL: "https://example.test/", referrer: "" };

  async function check(surface, sendTo) {
    if (surface === "connector") {
      const connector = createGoogleAdsConversionPrototype({
        endpoint: first, additionalEndpoint: second, experimentalRouting: true, experimentalMultiDestination: true,
      });
      connector.init();
      connector.handle({ type: "google-ads-command", payload: { args: ["config", "AW-111"] } });
      connector.handle({ type: "google-ads-command", payload: { args: ["config", "AW-222"] } });
      try {
        return { accepted: true, requests: connector.handle({
          type: "google-ads-command", payload: { args: ["event", "conversion", { send_to: sendTo }], context },
        }).length };
      } catch (error) {
        expect(error.message).toBe("destination-mismatch");
        return { accepted: false };
      }
    }
    const chamber = fakeChamber();
    const adapter = createGoogleAdsPrototype({
      endpoint: first, additionalEndpoint: second, experimentalRouting: true, experimentalMultiDestination: true,
      chamber, captureContext: () => context,
    });
    try {
      adapter.gtag("event", "conversion", { send_to: sendTo });
      const state = adapter.getState();
      return state.outcomes.length
        ? { accepted: false, reason: state.outcomes[0].reason }
        : { accepted: true, requests: state.queued };
    } finally { await adapter.dispose(); }
  }

  it.each(["adapter", "connector"])("%s never reads proxy-controlled length properties while copying selectors", async (surface) => {
    let lengthReads = 0;
    let indexReads = 0;
    const array = new Proxy([...targets], {
      get(target, key, receiver) {
        if (key === "length") return ++lengthReads <= 2 ? 2 : 30;
        return Reflect.get(target, key, receiver);
      },
      getOwnPropertyDescriptor(target, key) {
        if (typeof key === "string" && /^\d+$/.test(key)) {
          indexReads += 1;
          if (Number(key) >= 2) return { configurable: true, enumerable: true, writable: true, value: targets[0] };
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const result = await check(surface, array);
    expect(result.accepted).toBe(true);
    expect(result.requests).toBe(surface === "adapter" ? 1 : 2);
    expect(lengthReads).toBe(0);
    expect(indexReads).toBe(2);
  });

  it.each(["adapter", "connector"])("%s rejects arrays whose length changes during enumeration", async (surface) => {
    const array = new Proxy([...targets], {
      ownKeys(target) { target.pop(); return Reflect.ownKeys(target); },
    });
    expect((await check(surface, array)).accepted).toBe(false);
  });

  it.each(["adapter", "connector"])("%s rejects arrays whose length changes while elements are inspected", async (surface) => {
    const array = new Proxy([...targets], {
      getOwnPropertyDescriptor(target, key) {
        if (key === "0") target.push(targets[0]);
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    expect((await check(surface, array)).accepted).toBe(false);
  });

  it.each(["adapter", "connector"])("%s rejects inconsistent proxy length descriptors", async (surface) => {
    let lengthDescriptors = 0;
    const array = new Proxy([...targets], {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        if (key === "length") return { ...descriptor, value: ++lengthDescriptors === 1 ? 2 : 1 };
        return descriptor;
      },
    });
    expect((await check(surface, array)).accepted).toBe(false);
    expect(lengthDescriptors).toBe(2);
  });

  it.each(["adapter", "connector"])("%s rejects oversized arrays before enumerating properties", async (surface) => {
    let enumerations = 0;
    const array = new Proxy(Array(100000), {
      ownKeys(target) { enumerations += 1; return Reflect.ownKeys(target); },
    });
    expect((await check(surface, array)).accepted).toBe(false);
    expect(enumerations).toBe(0);
  });
});

describe("experimental branch correlation", () => {
  const first = "http://127.0.0.1:41234/pagead/conversion/111/";
  const second = "http://127.0.0.1:41235/pagead/conversion/222/";
  const branches = [
    { index: 0, disposition: "transport-settled", status: 204 },
    { index: 1, disposition: "transport-settled", status: 204 },
  ];
  const message = (index, id, url) => ({ type: "intercepted-fetch", index, id, method: "GET", url });
  const result = (summary) => ({ type: "result", summary: { seq: 1, ...summary }, ready: [] });
  const urls = [`${first}?label=LOCAL_ONE`, `${second}?label=LOCAL_TWO`];

  it.each(["no-request", "pending-response", "missing-second", "wrong-status", "hidden-request", "held-as-success",
    "swapped-route", "wrong-label", "repeated-index", "stale-id", "parallel-request", "post-failure-request"])(
    "fails closed for %s", async (scenario) => {
      const chamber = fakeChamber();
      let release;
      const fetchImpl = vi.fn(() => scenario === "pending-response" || scenario === "parallel-request"
        ? new Promise((resolve) => { release = resolve; })
        : scenario === "post-failure-request" ? Promise.reject(new Error("offline")) : Promise.resolve(new Response(null, { status: 204 })));
      const adapter = createGoogleAdsPrototype({
        endpoint: first, additionalEndpoint: second, experimentalRouting: true, experimentalMultiDestination: true,
        chamber, fetchImpl, captureContext: () => ({ pageURL: "https://example.test/", referrer: "" }),
        consent: { ad_storage: scenario === "held-as-success" ? "denied" : "granted" },
      });
      try {
        adapter.gtag("event", "conversion", { send_to: targets });
        await vi.waitFor(() => expect(chamber.sent.some((item) => item.type === "event")).toBe(true));
        if (scenario === "no-request") {
          chamber.emit(result({ disposition: "transport-settled", requests: 2, branches }));
        } else if (scenario === "swapped-route" || scenario === "wrong-label") {
          chamber.emit(message(0, 1, scenario === "swapped-route" ? urls[1] : `${first}?label=LOCAL_TWO`));
        } else {
          chamber.emit(message(0, 1, urls[0]));
          if (scenario === "pending-response") {
            chamber.emit(result({ disposition: "transport-settled", requests: 2, branches }));
          } else if (scenario === "parallel-request") {
            chamber.emit(message(1, 2, urls[1]));
          } else {
            await vi.waitFor(() => expect(chamber.sent.some((item) => item.type === "intercepted-fetch-response")).toBe(true));
            if (scenario === "missing-second" || scenario === "held-as-success") {
              chamber.emit(result({ disposition: "transport-settled", requests: 2, branches }));
            } else if (scenario === "hidden-request") {
              chamber.emit(result({ disposition: "rejected", requests: 0 }));
            } else if (scenario === "wrong-status") {
              chamber.emit(message(1, 2, urls[1]));
              await vi.waitFor(() => expect(chamber.sent.filter((item) => item.type === "intercepted-fetch-response")).toHaveLength(2));
              chamber.emit(result({ disposition: "transport-settled", requests: 2, branches: [branches[0], { ...branches[1], status: 200 }] }));
            } else if (scenario === "repeated-index") {
              chamber.emit(message(0, 2, urls[0]));
            } else if (scenario === "stale-id") {
              chamber.emit(message(1, 1, urls[1]));
            } else if (scenario === "post-failure-request") {
              chamber.emit(message(1, 2, urls[1]));
            }
          }
        }
        const state = await adapter.flush();
        expect(state.phase).toBe("terminal");
        expect(["result-transport-mismatch", "request-correlation-failed"]).toContain(state.terminalReason);
        expect(state.outcomes.at(-1).disposition).toBe("rejected");
        expect(JSON.stringify(state)).not.toContain("LOCAL_ONE");
        if (scenario === "post-failure-request") expect(fetchImpl).toHaveBeenCalledOnce();
      } finally {
        release?.(new Response(null, { status: 204 }));
        await adapter.dispose();
      }
    },
  );
});
