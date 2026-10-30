import { describe, expect, it, vi } from "vitest";
import { createMetaPixelBootstrapPrototype } from "../adapters/meta-pixel-bootstrap-prototype.js";
import { createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const pixel = "000000000000000";
const page = () => ({
  pageURL: "https://example.test/one", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: -420,
});

function fixtureStub() {
  function fbq() {
    fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
  }
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  return fbq;
}

async function setup(bootstrap, options = {}) {
  const receiver = await createPrototypeReceiver();
  const chamber = createNodePrototypeChamber();
  try {
    const adapter = await createMetaPixelBootstrapPrototype({
      bootstrap, endpoint: receiver.endpoint, chamber, captureContext: page,
      consent: { ad_storage: "granted" }, ...options,
    });
    return {
      adapter, receiver, chamber,
      async close() {
        try { await adapter.dispose(); } finally {
          try { await chamber.dispose(); } finally { await receiver.close(); }
        }
      },
    };
  } catch (error) {
    try { await chamber.dispose(); } finally { await receiver.close(); }
    throw error;
  }
}

describe("opt-in local Meta bootstrap entry", () => {
  it("drains actual argument-object calls in order and routes later calls through the worker", async () => {
    const fbq = fixtureStub();
    const globalBefore = Object.getOwnPropertyDescriptor(globalThis, "fbq");
    const data = { value: 12, currency: "USD" };
    expect(fbq("init", pixel)).toBeUndefined();
    expect(fbq.push("track", "PageView", data)).toBeUndefined();
    const originalQueue = fbq.queue;
    const env = await setup(fbq, { experimentalPageViewData: true });
    try {
      expect(fbq.queue).toEqual([]);
      expect(fbq.queue).not.toBe(originalQueue);
      expect(Object.getOwnPropertyDescriptor(globalThis, "fbq")).toEqual(globalBefore);
      data.value = 99;
      expect(fbq.push("track", "PageView", { value: 3, currency: "USD" })).toBeUndefined();
      const state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "transport-settled", "transport-settled"]);
      expect(env.receiver.arrivals.map(({ url }) => new URL(url).searchParams.get("cd[value]")))
        .toEqual(["12", "3"]);
      expect(JSON.stringify(state)).not.toContain(pixel);
      expect(JSON.stringify(state)).not.toContain("example.test");
      expect((await env.chamber.probe).ambientFetchDenied).toBe(true);
      await env.adapter.dispose();
      fbq("track", "PageView");
      expect(env.adapter.getState().outcomes.at(-1).reason).toBe("disposed");
      expect(fbq.queue).toEqual([]);
      await expect(createMetaPixelBootstrapPrototype({ bootstrap: fbq })).rejects.toThrow("bootstrap-already-attached");
    } finally { await env.close(); }
  }, 5000);

  it("applies a preloaded revoke before older queued dispatch and does not replay on grant", async () => {
    const fbq = fixtureStub();
    fbq("init", pixel);
    fbq("track", "PageView");
    fbq("consent", "revoke");
    fbq("consent", "grant");
    fbq("track", "PageView");
    const env = await setup(fbq, { experimentalTagConsent: true });
    try {
      const state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.disposition))
        .toEqual(["initialized", "held", "consent-updated", "consent-updated", "transport-settled"]);
      expect(env.receiver.arrivals).toHaveLength(1);
    } finally { await env.close(); }
  }, 5000);

  it("keeps tag-consent commands unsupported unless separately opted in", async () => {
    const fbq = fixtureStub();
    fbq("consent", "revoke");
    fbq("init", pixel);
    fbq("track", "PageView");
    const env = await setup(fbq);
    try {
      const state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition))
        .toEqual(["unsupported-command", "initialized", "transport-settled"]);
      expect(env.receiver.arrivals).toHaveLength(1);
    } finally { await env.close(); }
  }, 5000);

  it("preserves local revoke ordering, host consent and no-replay behavior", async () => {
    const fbq = fixtureStub();
    fbq("consent", "revoke");
    fbq("init", pixel);
    fbq("track", "PageView");
    const env = await setup(fbq, { experimentalTagConsent: true, consent: { ad_storage: "denied" } });
    try {
      fbq("consent", "grant");
      fbq("track", "PageView");
      let state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.disposition))
        .toEqual(["consent-updated", "initialized", "held", "consent-updated", "held"]);
      expect(env.receiver.arrivals).toHaveLength(0);
      env.adapter.setConsent({ ad_storage: "granted" });
      await env.adapter.flush();
      expect(env.receiver.arrivals).toHaveLength(0);
      fbq("track", "PageView");
      state = await env.adapter.flush();
      expect(state.outcomes.at(-1).disposition).toBe("transport-settled");
      expect(env.receiver.arrivals).toHaveLength(1);
    } finally { await env.close(); }
  }, 5000);

  it("keeps unsupported pre-install calls visible and forwards later valid calls", async () => {
    const fbq = fixtureStub();
    fbq("init", pixel);
    fbq("track", "Purchase");
    const env = await setup(fbq);
    try {
      fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition))
        .toEqual(["initialized", "unsupported-command", "transport-settled"]);
      expect(env.receiver.arrivals).toHaveLength(1);
    } finally { await env.close(); }
  }, 5000);

  it("refuses oversized preloads before enumerating or reading an element", async () => {
    const fbq = fixtureStub();
    const reads = vi.fn();
    const enumerate = vi.fn(() => { throw new Error("must-not-enumerate"); });
    const queue = new Proxy(new Array(129), {
      ownKeys: enumerate,
      getOwnPropertyDescriptor(target, key) {
        if (key !== "length") reads(key);
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    fbq.queue = queue;
    await expect(createMetaPixelBootstrapPrototype({ bootstrap: fbq })).rejects.toThrow("bootstrap-queue-limit");
    expect(enumerate).not.toHaveBeenCalled();
    expect(reads).not.toHaveBeenCalled();
    expect(fbq.queue).toBe(queue);
    expect(Object.hasOwn(fbq, "callMethod")).toBe(false);
  });

  it("checks an argument-array length before inspecting any argument", async () => {
    const fbq = fixtureStub();
    const reads = vi.fn();
    const enumerate = vi.fn(() => { throw new Error("must-not-enumerate"); });
    const args = new Proxy(new Array(6), {
      ownKeys: enumerate,
      getOwnPropertyDescriptor(target, key) {
        if (key !== "length") reads(key);
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    fbq.queue.push(args);
    await expect(createMetaPixelBootstrapPrototype({ bootstrap: fbq })).rejects.toThrow("invalid-bootstrap-preload");
    expect(enumerate).not.toHaveBeenCalled();
    expect(reads).not.toHaveBeenCalled();
    expect(fbq.queue[0]).toBe(args);
  });

  it("refuses malformed entries, accessors and existing handlers without installing", async () => {
    const getter = vi.fn(() => "track");
    const cases = [
      () => { const fbq = fixtureStub(); fbq.queue = new Array(1); return fbq; },
      () => { const fbq = fixtureStub(); fbq.queue = [["x", "x", "x", "x", "x", "x"]]; return fbq; },
      () => {
        const fbq = fixtureStub();
        fbq("init", pixel);
        Object.defineProperty(fbq.queue[0], "0", { get: getter });
        return fbq;
      },
      () => {
        const fbq = fixtureStub();
        Object.defineProperty(fbq, "queue", { get: getter, configurable: true });
        return fbq;
      },
    ];
    for (const create of cases) {
      const fbq = create();
      await expect(createMetaPixelBootstrapPrototype({ bootstrap: fbq })).rejects.toThrow("invalid-bootstrap-preload");
      expect(Object.hasOwn(fbq, "callMethod")).toBe(false);
    }
    expect(getter).not.toHaveBeenCalled();
    const installed = fixtureStub();
    installed.callMethod = () => {};
    await expect(createMetaPixelBootstrapPrototype({ bootstrap: installed })).rejects.toThrow("bootstrap-already-attached");
  });

  it("rejects a changed preload during worker startup and disposes without installing", async () => {
    const fbq = fixtureStub();
    fbq("init", pixel);
    const originalQueue = fbq.queue;
    let message;
    const chamber = {
      onMessage(listener) { message = listener; return () => {}; },
      onError: () => () => {},
      postMessage(command) {
        if (command.type === "init") {
          fbq("track", "PageView");
          queueMicrotask(() => message({ type: "phase", name: "configured" }));
        }
      },
      dispose: vi.fn(),
    };
    await expect(createMetaPixelBootstrapPrototype({
      bootstrap: fbq, endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: page,
    })).rejects.toThrow("bootstrap-preload-changed");
    expect(chamber.dispose).toHaveBeenCalledTimes(1);
    expect(fbq.queue).toBe(originalQueue);
    expect(fbq.queue).toHaveLength(2);
    expect(Object.hasOwn(fbq, "callMethod")).toBe(false);
  });

  it("preserves the preload and refuses attachment when worker startup fails", async () => {
    const fbq = fixtureStub();
    fbq("init", pixel);
    fbq("track", "PageView");
    const originalQueue = fbq.queue;
    const chamber = {
      onMessage: () => () => {},
      onError: () => () => {},
      postMessage() { throw new Error("private-startup-detail"); },
      dispose: vi.fn(),
    };
    const error = await createMetaPixelBootstrapPrototype({
      bootstrap: fbq, endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: page,
    }).catch((failure) => failure);
    expect(error.message).toBe("bootstrap-worker-unavailable");
    expect(error.stack).not.toContain("private-startup-detail");
    expect(chamber.dispose).toHaveBeenCalledTimes(1);
    expect(fbq.queue).toBe(originalQueue);
    expect(fbq.queue).toHaveLength(2);
    expect(Object.hasOwn(fbq, "callMethod")).toBe(false);
  });

  it("preserves the preload when worker startup fails asynchronously", async () => {
    const fbq = fixtureStub();
    fbq("init", pixel);
    fbq("track", "PageView");
    const originalQueue = fbq.queue;
    let fail;
    const chamber = {
      onMessage: () => () => {},
      onError(listener) { fail = listener; return () => {}; },
      postMessage() { queueMicrotask(() => fail()); },
      dispose: vi.fn(),
    };
    const error = await createMetaPixelBootstrapPrototype({
      bootstrap: fbq, endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: page,
    }).catch((failure) => failure);
    expect(error.message).toBe("bootstrap-worker-unavailable");
    expect(chamber.dispose).toHaveBeenCalledTimes(1);
    expect(fbq.queue).toBe(originalQueue);
    expect(fbq.queue).toHaveLength(2);
    expect(Object.hasOwn(fbq, "callMethod")).toBe(false);
  });

  it("keeps the original stub active until readiness and refuses a changed preload", async () => {
    const fbq = fixtureStub();
    fbq("init", pixel);
    const originalQueue = fbq.queue;
    let message;
    const chamber = {
      onMessage(listener) { message = listener; return () => {}; },
      onError: () => () => {},
      postMessage() {},
      dispose: vi.fn(),
    };
    const attachment = createMetaPixelBootstrapPrototype({
      bootstrap: fbq, endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: page,
    });
    expect(fbq.queue).toBe(originalQueue);
    expect(Object.hasOwn(fbq, "callMethod")).toBe(false);
    fbq("track", "PageView");
    message({ type: "phase", name: "configured" });
    await expect(attachment).rejects.toThrow("bootstrap-preload-changed");
    expect(chamber.dispose).toHaveBeenCalledTimes(1);
    expect(fbq.queue).toBe(originalQueue);
    expect(fbq.queue).toHaveLength(2);
    expect(Object.hasOwn(fbq, "callMethod")).toBe(false);
  });

  it("retains the preload when worker readiness times out", async () => {
    const fbq = fixtureStub();
    fbq("init", pixel);
    const originalQueue = fbq.queue;
    const chamber = {
      onMessage: () => () => {}, onError: () => () => {}, postMessage() {}, dispose: vi.fn(),
    };
    await expect(createMetaPixelBootstrapPrototype({
      bootstrap: fbq, endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: page, initTimeoutMs: 20,
    })).rejects.toThrow("bootstrap-worker-unavailable");
    expect(chamber.dispose).toHaveBeenCalledTimes(1);
    expect(fbq.queue).toBe(originalQueue);
    expect(Object.hasOwn(fbq, "callMethod")).toBe(false);
  });

  it("refuses attachment if the worker fails during the final preload check", async () => {
    const target = fixtureStub();
    target("init", pixel);
    const originalQueue = target.queue;
    let message, fail, armed = false;
    const bootstrap = new Proxy(target, {
      getOwnPropertyDescriptor(object, key) {
        if (key === "queue" && armed) { armed = false; fail(); }
        return Reflect.getOwnPropertyDescriptor(object, key);
      },
    });
    const chamber = {
      onMessage(listener) { message = listener; return () => {}; },
      onError(listener) { fail = listener; return () => {}; },
      postMessage(command) {
        if (command.type === "init") queueMicrotask(() => {
          armed = true;
          message({ type: "phase", name: "configured" });
        });
      },
      dispose: vi.fn(),
    };
    await expect(createMetaPixelBootstrapPrototype({
      bootstrap, endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: page,
    })).rejects.toThrow("bootstrap-worker-unavailable");
    expect(chamber.dispose).toHaveBeenCalledTimes(1);
    expect(target.queue).toBe(originalQueue);
    expect(Object.hasOwn(target, "callMethod")).toBe(false);
  });

  it("restores the original queue and disposes if attachment fails", async () => {
    const target = fixtureStub();
    target("init", pixel);
    const originalQueue = target.queue;
    const bootstrap = new Proxy(target, {
      defineProperty(object, key, descriptor) {
        if (key === "callMethod") throw new Error("private-attachment-detail");
        return Reflect.defineProperty(object, key, descriptor);
      },
    });
    let message;
    const chamber = {
      onMessage(listener) { message = listener; return () => {}; },
      onError: () => () => {},
      postMessage(command) {
        if (command.type === "init") queueMicrotask(() => message({ type: "phase", name: "configured" }));
      },
      dispose: vi.fn(),
    };
    const error = await createMetaPixelBootstrapPrototype({
      bootstrap, endpoint: "http://127.0.0.1:43210/tr/", chamber, captureContext: page,
    }).catch((failure) => failure);
    expect(error.message).toBe("bootstrap-install-failed");
    expect(target.queue).toBe(originalQueue);
    expect(Object.hasOwn(target, "callMethod")).toBe(false);
    expect(chamber.dispose).toHaveBeenCalledTimes(1);
  });

  it("rejects non-loopback endpoints before attaching or consuming the preload", async () => {
    const fbq = fixtureStub();
    fbq("init", pixel);
    const originalQueue = fbq.queue;
    await expect(createMetaPixelBootstrapPrototype({
      bootstrap: fbq, endpoint: "https://example.test/tr/",
    })).rejects.toThrow("literal-loopback-endpoint-required");
    expect(fbq.queue).toBe(originalQueue);
    expect(Object.hasOwn(fbq, "callMethod")).toBe(false);
  });

  it("rejects reentrant capture without reordering preloaded commands", async () => {
    const fbq = fixtureStub();
    fbq("init", pixel);
    fbq("track", "PageView");
    let nested = false;
    const env = await setup(fbq, {
      captureContext() {
        if (!nested) { nested = true; fbq("track", "PageView"); }
        return page();
      },
    });
    try {
      const state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.reason || item.disposition))
        .toEqual(["initialized", "capture-reentrant", "transport-settled"]);
      expect(env.receiver.arrivals).toHaveLength(1);
    } finally { await env.close(); }
  }, 5000);
});
