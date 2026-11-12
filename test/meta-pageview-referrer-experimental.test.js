import { afterEach, describe, expect, it, vi } from "vitest";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { closePrototypeResources, createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const pixel = "000000000000000";
const now = 1760000000000;
const ninetyDays = 90 * 24 * 60 * 60 * 1000;
const categoryKey = "lastExternalReferrer";
const timeKey = "lastExternalReferrerTime";
const base = {
  pageURL: "http://127.0.0.1:1234/page", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: 0,
};
const initContext = (referrer = "", userAgent = "Synthetic", xhrDefined = true) => ({
  ...base, referrer, userAgent, xhrDefined,
});

describe("serialized governed referrer installation", () => {
  it("samples once through the actual worker and delivers the cached category to loopback", async () => {
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    const origin = new URL(receiver.endpoint).origin;
    const values = new Map();
    const operations = [];
    const backing = {
      location: { origin },
      localStorage: {
        getItem(name) { operations.push(["get", name]); return values.get(name) ?? null; },
        setItem(name, value) { operations.push(["set", name]); values.set(name, value); },
        removeItem(name) { operations.push(["remove", name]); values.delete(name); },
      },
    };
    const context = { ...base, pageURL: `${origin}/page`, referrer: "https://m.facebook.com/" };
    const adapter = createMetaPixelPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: () => context,
      consent: { ad_storage: "granted" }, experimentalPageViewReferrer: true,
      referrerStorageBinding: { origin, window: backing },
    });
    try {
      adapter.fbq("init", pixel);
      context.referrer = "";
      adapter.fbq("track", "PageView");
      adapter.fbq("track", "PageView");
      const state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual([
        "initialized", "transport-settled", "transport-settled",
      ]);
      expect(receiver.arrivals.map(({ url }) => new URL(url).searchParams.get("ler"))).toEqual(["fb", "fb"]);
      expect(operations.map(([operation]) => operation)).toEqual(["get", "get", "set", "set", "get", "get"]);
      expect(JSON.stringify(state)).not.toContain("facebook.com");
    } finally { await closePrototypeResources({ adapter, chamber, receiver }); }
  }, 5000);

  it("rejects a binding unless the feature is explicitly enabled", () => {
    expect(() => createMetaPixelPrototype({
      endpoint: "http://127.0.0.1:1234/tr/",
      referrerStorageBinding: { origin: "http://127.0.0.1:1234", window: {} },
    })).toThrow();
  });
});
const event = (args, context) => ({ type: "meta-pixel-command", payload: { args, context } });

function setup(initial = {}) {
  const state = new Map(Object.entries(initial));
  const operations = [];
  const storage = {
    async get(name) { operations.push(["get", name]); return state.get(name) ?? null; },
    async set(name, value) { operations.push(["set", name, value]); state.set(name, value); },
    async remove(name) { operations.push(["remove", name]); state.delete(name); },
  };
  const connector = createMetaPageViewPrototype({
    endpoint: "http://127.0.0.1:1234/tr/", experimentalPageViewReferrer: true,
  });
  connector.init({ storage });
  return { connector, state, operations };
}

async function sample(env, context) {
  await env.connector.handle(event(["init", pixel], context));
}

async function ler(env) {
  const requests = await env.connector.handle(event(["track", "PageView"], base));
  return new URL(requests[0].url).searchParams.get("ler");
}

afterEach(() => vi.useRealTimers());

async function localEnvironment(options = {}) {
  const receiver = await createPrototypeReceiver();
  const worker = createNodePrototypeChamber();
  const origin = new URL(receiver.endpoint).origin;
  const values = new Map(Object.entries(options.initial || {}));
  const operations = [];
  const backing = {
    location: { origin },
    localStorage: {
      getItem(name) { operations.push(["get", name]); return values.get(name) ?? null; },
      setItem(name, value) { operations.push(["set", name]); values.set(name, value); },
      removeItem(name) { operations.push(["remove", name]); values.delete(name); },
    },
  };
  const context = { ...base, pageURL: `${origin}/page`, referrer: "https://facebook.com/" };
  const adapter = createMetaPixelPrototype({
    endpoint: receiver.endpoint, chamber: options.wrap ? options.wrap(worker) : worker,
    captureContext: () => context, consent: options.consent ?? { ad_storage: "granted" },
    experimentalPageViewReferrer: true, referrerStorageBinding: { origin, window: backing },
    ...(options.adapterOptions || {}),
  });
  return {
    adapter, receiver, worker, context, values, operations, backing,
    close: () => closePrototypeResources({ adapter, chamber: worker, receiver }),
  };
}

describe("referrer capability boundaries", () => {
  it.each([
    ["routing", { experimentalRouting: true }],
    ["multi-Pixel routing", { experimentalRouting: true, experimentalMultiPixelRouting: true }],
    ["events", { experimentalEvents: true }],
  ])("specifically refuses %s alongside referrer with otherwise valid adapter configurations", async (_name, mode) => {
    const endpoint = "http://127.0.0.1:1234/tr/";
    const chamber = { postMessage() {}, onMessage() { return () => {}; }, dispose() {} };
    const binding = { origin: "http://127.0.0.1:1234", window: {} };
    const baseline = createMetaPixelPrototype({ endpoint, chamber, experimentalPageViewReferrer: true,
      referrerStorageBinding: binding });
    const modeBaseline = createMetaPixelPrototype({ endpoint, chamber, ...mode });
    try {
      expect(baseline.getState().phase).toBe("starting");
      expect(modeBaseline.getState().phase).toBe("starting");
      expect(() => createMetaPixelPrototype({ endpoint, chamber, experimentalPageViewReferrer: true,
        referrerStorageBinding: binding, ...mode })).toThrow("incompatible-referrer-feature");
    } finally { await baseline.dispose(); await modeBaseline.dispose(); }
  });

  it("rejects malformed configuration and incompatible modes in both factories", () => {
    const endpoint = "http://127.0.0.1:1234/tr/";
    for (const factory of [createMetaPageViewPrototype, createMetaPixelPrototype]) {
      for (const experimentalPageViewReferrer of ["true", null, 1]) {
        expect(() => factory({ endpoint, experimentalPageViewReferrer })).toThrow();
      }
      for (const mode of ["experimentalRouting", "experimentalMultiPixelRouting", "experimentalEvents"]) {
        expect(() => factory({ endpoint, experimentalPageViewReferrer: true, [mode]: true })).toThrow();
      }
      const liveBinding = { pixelId: "123", documentURL: "http://127.0.0.1:1234/meta-delivery/case" };
      expect(() => factory({ endpoint: "https://www.facebook.com/tr/", liveBinding,
        experimentalPageViewReferrer: true })).toThrow();
      expect(() => factory({ endpoint: "https://www.facebook.com/tr/", liveBinding,
        referrerStorageBinding: {} })).toThrow();
    }
    for (const origin of ["http://localhost:1234", "https://127.0.0.1:1234", "http://127.0.0.1:0", "http://127.0.0.1:80",
      "http://127.0.0.1:65536", "http://127.0.0.1:01234", "http://127.0.0.1:1234/"]) {
      expect(() => createMetaPixelPrototype({ endpoint, experimentalPageViewReferrer: true,
        referrerStorageBinding: { origin, window: {} } })).toThrow();
    }
  });

  it.each(["pending", "denied"])("never accesses persisted state with %s consent", async (consent) => {
    const env = await localEnvironment({ consent: { ad_storage: consent } });
    try {
      env.adapter.fbq("init", pixel);
      env.adapter.fbq("track", "PageView");
      await env.adapter.flush();
      expect(env.operations).toEqual([]);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("does not capture the platform while consent is pending or denied", async () => {
    vi.stubGlobal("navigator", { get userAgent() { throw new Error("platform-must-not-be-read"); } });
    const env = await localEnvironment({ consent: { ad_storage: "denied" } });
    try {
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.outcomes[0]).toMatchObject({ disposition: "initialized", referrerDisposition: "consent-held" });
      expect(env.operations).toEqual([]);
    } finally { await env.close(); vi.unstubAllGlobals(); }
  }, 5000);

  it("does not inspect the platform or storage with the feature disabled", async () => {
    vi.stubGlobal("navigator", { get userAgent() { throw new Error("platform-must-not-be-read"); } });
    const receiver = await createPrototypeReceiver();
    const chamber = createNodePrototypeChamber();
    const adapter = createMetaPixelPrototype({ endpoint: receiver.endpoint, chamber,
      captureContext: () => base, consent: { ad_storage: "granted" } });
    try {
      adapter.fbq("init", pixel);
      adapter.fbq("track", "PageView");
      const state = await adapter.flush();
      expect(state.outcomes.at(-1).disposition).toBe("transport-settled");
      expect([...new URL(receiver.arrivals[0].url).searchParams.keys()])
        .toEqual(["id", "ev", "dl", "rl", "if", "sw", "sh", "tz"]);
    } finally { await closePrototypeResources({ adapter, chamber, receiver }); vi.unstubAllGlobals(); }
  }, 5000);

  it("does not capture the platform before rejecting a bad initialization", async () => {
    vi.stubGlobal("navigator", { get userAgent() { throw new Error("platform-must-not-be-read"); } });
    const env = await localEnvironment();
    try {
      env.adapter.fbq("init", "not-the-synthetic-id");
      const state = await env.adapter.flush();
      expect(state.outcomes[0].reason).toBe("synthetic-pixel-required");
      expect(env.operations).toEqual([]);
    } finally { await env.close(); vi.unstubAllGlobals(); }
  }, 5000);

  it("does not serialize a platform capture revoked during the getter", async () => {
    let adapter;
    let xhrReads = 0;
    const priorXhr = Object.getOwnPropertyDescriptor(globalThis, "XMLHttpRequest");
    Object.defineProperty(globalThis, "XMLHttpRequest", {
      configurable: true, get() { xhrReads += 1; return undefined; },
    });
    vi.stubGlobal("navigator", { get userAgent() {
      adapter.setConsent({ ad_storage: "denied" });
      adapter.setConsent({ ad_storage: "granted" });
      return "synthetic";
    } });
    const env = await localEnvironment();
    adapter = env.adapter;
    try {
      adapter.fbq("init", pixel);
      const state = await adapter.flush();
      expect(state.outcomes[0]).toMatchObject({ disposition: "rejected", reason: "capture-consent-changed" });
      expect(xhrReads).toBe(0);
      expect(env.operations).toEqual([]);
      expect(env.receiver.arrivals).toEqual([]);
    } finally {
      await env.close();
      vi.unstubAllGlobals();
      if (priorXhr) Object.defineProperty(globalThis, "XMLHttpRequest", priorXhr);
      else delete globalThis.XMLHttpRequest;
    }
  }, 5000);

  it("does not restore the cached result after revoke and regrant", async () => {
    const env = await localEnvironment();
    try {
      env.adapter.fbq("init", pixel);
      await env.adapter.flush();
      expect(env.operations.length).toBe(6);
      env.adapter.setConsent({ ad_storage: "denied" });
      env.adapter.setConsent({ ad_storage: "granted" });
      env.adapter.fbq("track", "PageView");
      await env.adapter.flush();
      expect(env.operations.length).toBe(6);
      expect(env.receiver.arrivals).toHaveLength(1);
      expect(new URL(env.receiver.arrivals[0].url).searchParams.has("ler")).toBe(false);
    } finally { await env.close(); }
  }, 5000);

  it("does not send a queued captured initialization after revoke and regrant", async () => {
    let release;
    let ready;
    const observed = new Promise((resolve) => { ready = resolve; });
    const sent = [];
    const env = await localEnvironment({
      wrap: (worker) => ({
        ...worker,
        onMessage(listener) {
          return worker.onMessage((message) => {
            if (message.type === "phase") { release = () => listener(message); ready(); }
            else listener(message);
          });
        },
        postMessage(message) { if (message.type === "event") sent.push(message); worker.postMessage(message); },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      await observed;
      env.adapter.setConsent({ ad_storage: "denied" });
      env.adapter.setConsent({ ad_storage: "granted" });
      release();
      const state = await env.adapter.flush();
      expect(state.outcomes[0]).toMatchObject({ disposition: "rejected", reason: "referrer-consent-held" });
      expect(sent).toEqual([]);
      expect(env.operations).toEqual([]);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("never accesses a backing window at another origin", async () => {
    const env = await localEnvironment();
    try {
      env.backing.location.origin = "http://127.0.0.1:1";
      env.adapter.fbq("init", pixel);
      await env.adapter.flush();
      expect(env.operations).toEqual([]);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects a page from another port before accessing storage", async () => {
    const env = await localEnvironment();
    try {
      env.context.pageURL = "http://127.0.0.1:1/page";
      env.adapter.fbq("init", pixel);
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("rejected");
      expect(env.operations).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("rechecks the backing origin after method acquisition and before the primitive", async () => {
    const responses = [];
    const env = await localEnvironment({
      wrap: (worker) => ({
        ...worker,
        postMessage(message) {
          if (message.type === "storage-response") responses.push(message);
          worker.postMessage(message);
        },
      }),
    });
    try {
      const backing = env.backing.localStorage;
      const get = backing.getItem;
      Object.defineProperty(backing, "getItem", { get() {
        env.backing.location.origin = "http://127.0.0.1:1";
        return get;
      } });
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.outcomes[0]).toMatchObject({ disposition: "rejected", reason: "storage-access-failed" });
      expect(state.referrerStorage).toEqual({ operations: 0, effects: 0 });
      expect(responses).toEqual([{ type: "storage-response", id: 1, status: "failed" }]);
      expect(env.operations).toEqual([]);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it.each(["get", "set"])("withholds a pending %s response when the backing origin changes", async (operation) => {
    let release;
    let notify;
    let timer;
    const responses = [];
    const waiting = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("backing-operation-not-observed")), 1000);
      notify = () => { clearTimeout(timer); resolve(); };
    });
    const env = await localEnvironment({
      wrap: (worker) => ({
        ...worker,
        postMessage(message) {
          if (message.type === "storage-response") responses.push(message);
          worker.postMessage(message);
        },
      }),
    });
    try {
      const backing = env.backing.localStorage;
      if (operation === "get") {
        backing.getItem = (name) => {
          env.operations.push(["get", name]);
          return new Promise((resolve) => { release = () => resolve("private-value"); notify(); });
        };
      } else {
        const set = backing.setItem;
        backing.setItem = (name, value) => {
          set(name, value);
          return new Promise((resolve) => { release = resolve; notify(); });
        };
      }
      env.adapter.fbq("init", pixel);
      await waiting;
      env.backing.location.origin = "http://127.0.0.1:1";
      release();
      const state = await env.adapter.flush();
      expect(responses.at(-1)).toEqual({ type: "storage-response", id: operation === "get" ? 1 : 3, status: "failed" });
      expect(responses.at(-1)).not.toHaveProperty("value");
      expect(state.outcomes[0]).toMatchObject({ disposition: "rejected", reason: "storage-access-failed" });
      expect(state.referrerStorage).toEqual(operation === "get" ? { operations: 1, effects: 0 } :
        { operations: 3, effects: 1 });
      expect(env.receiver.arrivals).toEqual([]);
    } finally { clearTimeout(timer); await env.close(); }
  }, 5000);

  it("blocks PageView egress when the backing origin changes after installation", async () => {
    const env = await localEnvironment();
    try {
      env.adapter.fbq("init", pixel);
      const installed = await env.adapter.flush();
      expect(installed.outcomes[0].disposition).toBe("initialized");
      env.backing.location.origin = "http://127.0.0.1:1";
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({
        disposition: "failed", reason: "transport-failed", status: 0, terminal: true,
      });
      expect(state.referrerStorage).toEqual({ operations: 6, effects: 2 });
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("rechecks the backing origin after PageView preparation and before egress", async () => {
    let env;
    env = await localEnvironment({
      wrap: (worker) => ({
        ...worker,
        onMessage(listener) {
          return worker.onMessage((message) => {
            if (message.type === "intercepted-fetch") env.backing.location.origin = "http://127.0.0.1:1";
            listener(message);
          });
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      await env.adapter.flush();
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({ disposition: "failed", reason: "transport-failed" });
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("withholds a pending egress response when the backing origin changes", async () => {
    let release;
    let notify;
    let timer;
    const responses = [];
    const waiting = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("egress-not-observed")), 1000);
      notify = () => { clearTimeout(timer); resolve(); };
    });
    const env = await localEnvironment({
      adapterOptions: { fetchImpl: async () => {
        await new Promise((resolve) => { release = resolve; notify(); });
        return new Response("private-body", { status: 200 });
      } },
      wrap: (worker) => ({
        ...worker,
        postMessage(message) {
          if (message.type === "intercepted-fetch-response") responses.push(message);
          worker.postMessage(message);
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      await env.adapter.flush();
      env.adapter.fbq("track", "PageView");
      await waiting;
      env.backing.location.origin = "http://127.0.0.1:1";
      release();
      const state = await env.adapter.flush();
      expect(responses).toHaveLength(1);
      expect(responses[0]).toMatchObject({ status: 0, body: "" });
      expect(JSON.stringify(responses)).not.toContain("private-body");
      expect(state.outcomes.at(-1).disposition).not.toBe("transport-settled");
    } finally { clearTimeout(timer); await env.close(); }
  }, 5000);

  it("rechecks the backing origin after response status access and before worker delivery", async () => {
    let env;
    const responses = [];
    env = await localEnvironment({
      adapterOptions: { fetchImpl: async () => ({
        get status() { env.backing.location.origin = "http://127.0.0.1:1"; return 200; },
        body: null,
      }) },
      wrap: (worker) => ({
        ...worker,
        postMessage(message) {
          if (message.type === "intercepted-fetch-response") responses.push(message);
          worker.postMessage(message);
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      await env.adapter.flush();
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(responses[0]).toMatchObject({ status: 0, body: "" });
      expect(state.outcomes.at(-1)).toMatchObject({ disposition: "failed", reason: "transport-failed" });
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("stops reading an egress body when the backing origin changes during a read", async () => {
    let release;
    let notify;
    let timer;
    let reads = 0;
    const responses = [];
    const waiting = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("body-read-not-observed")), 1000);
      notify = () => { clearTimeout(timer); resolve(); };
    });
    const env = await localEnvironment({
      adapterOptions: { fetchImpl: async () => ({
        status: 200,
        body: { getReader: () => ({
          read() {
            reads += 1;
            if (reads > 1) return Promise.resolve({ done: true });
            return new Promise((resolve) => {
              release = () => resolve({ value: new TextEncoder().encode("private-body"), done: false });
              notify();
            });
          },
          cancel: async () => {},
          releaseLock() {},
        }) },
      }) },
      wrap: (worker) => ({
        ...worker,
        postMessage(message) {
          if (message.type === "intercepted-fetch-response") responses.push(message);
          worker.postMessage(message);
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      await env.adapter.flush();
      env.adapter.fbq("track", "PageView");
      await waiting;
      env.backing.location.origin = "http://127.0.0.1:1";
      release();
      const state = await env.adapter.flush();
      expect(reads).toBe(1);
      expect(responses[0]).toMatchObject({ status: 0, body: "" });
      expect(JSON.stringify(responses)).not.toContain("private-body");
      expect(state.outcomes.at(-1)).toMatchObject({ disposition: "failed", reason: "transport-failed" });
    } finally { clearTimeout(timer); await env.close(); }
  }, 5000);

  it("does not execute a primitive if an origin recheck revokes and regrants consent", async () => {
    const env = await localEnvironment();
    try {
      const backing = env.backing.localStorage;
      const get = backing.getItem;
      Object.defineProperty(backing, "getItem", { get() {
        const origin = env.backing.location.origin;
        env.backing.location = { get origin() {
          env.adapter.setConsent({ ad_storage: "denied" });
          env.adapter.setConsent({ ad_storage: "granted" });
          return origin;
        } };
        return get;
      } });
      env.adapter.fbq("init", pixel);
      await env.adapter.flush();
      expect(env.operations).toEqual([]);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("does not read origin after the location getter revokes consent during a storage recheck", async () => {
    const env = await localEnvironment();
    let originReads = 0;
    try {
      const backing = env.backing.localStorage;
      const get = backing.getItem;
      Object.defineProperty(backing, "getItem", { get() {
        Object.defineProperty(env.backing, "location", { get() {
          env.adapter.setConsent({ ad_storage: "denied" });
          env.adapter.setConsent({ ad_storage: "granted" });
          return { get origin() { originReads += 1; return "http://127.0.0.1:1"; } };
        } });
        return get;
      } });
      env.adapter.fbq("init", pixel);
      await env.adapter.flush();
      expect(originReads).toBe(0);
      expect(env.operations).toEqual([]);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("does not dispatch if an origin recheck revokes and regrants consent", async () => {
    const env = await localEnvironment();
    try {
      env.adapter.fbq("init", pixel);
      await env.adapter.flush();
      const origin = env.backing.location.origin;
      env.backing.location = { get origin() {
        env.adapter.setConsent({ ad_storage: "denied" });
        env.adapter.setConsent({ ad_storage: "granted" });
        return origin;
      } };
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.outcomes.at(-1).disposition).not.toBe("transport-settled");
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("does not read origin after the location getter revokes consent during egress", async () => {
    const env = await localEnvironment();
    let originReads = 0;
    try {
      env.adapter.fbq("init", pixel);
      await env.adapter.flush();
      Object.defineProperty(env.backing, "location", { get() {
        env.adapter.setConsent({ ad_storage: "denied" });
        env.adapter.setConsent({ ad_storage: "granted" });
        return { get origin() { originReads += 1; return "http://127.0.0.1:1"; } };
      } });
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.outcomes.at(-1).disposition).not.toBe("transport-settled");
      expect(originReads).toBe(0);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it.each(["extra", "accessor", "inherited", "object", "malformed-url"])(
    "rejects %s context before storage access", async (fault) => {
      const env = await localEnvironment();
      try {
        if (fault === "extra") env.context.extra = "unsupported";
        if (fault === "accessor") Object.defineProperty(env.context, "referrer", { get() { throw new Error("must-not-read"); } });
        if (fault === "inherited") Object.setPrototypeOf(env.context, { extra: true });
        if (fault === "object") env.context.referrer = {};
        if (fault === "malformed-url") env.context.referrer = "not-a-url";
        env.adapter.fbq("init", pixel);
        const state = await env.adapter.flush();
        expect(state.outcomes[0].disposition).toBe("rejected");
        expect(env.operations).toEqual([]);
        expect(env.receiver.arrivals).toEqual([]);
      } finally { await env.close(); }
    }, 5000,
  );

  it("rejects other events and additional initialization without new storage work", async () => {
    const env = await localEnvironment();
    try {
      env.adapter.fbq("init", pixel);
      await env.adapter.flush();
      env.adapter.fbq("init", pixel);
      env.adapter.fbq("track", "Purchase");
      const state = await env.adapter.flush();
      expect(state.outcomes.slice(1).map(({ disposition }) => disposition)).toEqual(["rejected", "rejected"]);
      expect(env.operations).toHaveLength(6);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("reports genuinely unavailable storage without manufacturing a category", async () => {
    const env = await localEnvironment();
    try {
      env.backing.localStorage = undefined;
      env.adapter.fbq("init", pixel);
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.outcomes[0].referrerDisposition).toBe("storage-unavailable");
      expect(env.operations).toEqual([]);
      expect(new URL(env.receiver.arrivals[0].url).searchParams.has("ler")).toBe(false);
    } finally { await env.close(); }
  }, 5000);

  it.each([
    ["failed read", "storage", { operations: 2, effects: 0 }],
    ["failed partial write", "storage", { operations: 3, effects: 1 }],
    ["initial unavailable", "storage", { operations: 0, effects: 0 }],
    ["failed read", "cookie", { operations: 2, effects: 0 }],
    ["failed read", "egress", { operations: 2, effects: 0 }],
  ])("rejects subsequent %s / %s authority after a non-ok storage response", async (fault, next, counts) => {
    let env;
    let listener;
    let lastRequest;
    let injected = false;
    let cookieReads = 0;
    const responses = [];
    const cookieDocument = {
      location: { hostname: "127.0.0.1", protocol: "http:" },
      get cookie() { cookieReads += 1; return ""; },
    };
    env = await localEnvironment({
      adapterOptions: { experimentalFirstPartyCookie: true, cookieDocument },
      wrap: (worker) => ({
        ...worker,
        onMessage(callback) {
          listener = callback;
          return worker.onMessage((message) => {
            if (message.type === "storage-request") lastRequest = message;
            callback(message);
          });
        },
        postMessage(message) {
          if (message.type === "storage-response") responses.push({ id: message.id, status: message.status });
          worker.postMessage(message);
          if (message.type !== "storage-response" || message.status === "ok" || injected) return;
          injected = true;
          if (fault === "initial unavailable") env.backing.localStorage = backing;
          const correlation = { id: lastRequest.id + 1, seq: lastRequest.seq, generation: lastRequest.generation };
          if (next === "storage") {
            listener(fault === "initial unavailable"
              ? { type: "storage-request", ...correlation, operation: "get", name: timeKey }
              : { type: "storage-request", ...correlation, operation: "set",
                name: fault === "failed read" ? categoryKey : timeKey, value: "1" });
          } else if (next === "cookie") {
            listener({ type: "cookie-request", id: 1, operation: "get", name: "_fbp" });
          } else {
            listener({ type: "intercepted-fetch", id: 1, method: "GET", url: `${env.receiver.endpoint}?x=1` });
          }
        },
      }),
    });
    const backing = env.backing.localStorage;
    try {
      if (fault === "initial unavailable") env.backing.localStorage = undefined;
      if (fault === "failed read") {
        const get = backing.getItem;
        backing.getItem = (name) => {
          if (name === timeKey) {
            env.operations.push(["get", name]);
            throw new Error("storage-failure");
          }
          return get(name);
        };
      }
      if (fault === "failed partial write") {
        const set = backing.setItem;
        backing.setItem = (name, value) => {
          set(name, value);
          throw new Error("storage-failure");
        };
      }
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(injected).toBe(true);
      expect(state.referrerStorage).toEqual(counts);
      expect(state.terminalReason).toBe("invalid-worker-result");
      expect(responses.at(-1)).toEqual({ id: fault === "initial unavailable" ? 1 :
        fault === "failed partial write" ? 3 : 2, status: fault === "initial unavailable" ? "unavailable" : "failed" });
      expect(env.operations).toHaveLength(counts.operations);
      expect(env.values.has(categoryKey)).toBe(fault === "failed partial write");
      expect(env.values.has(timeKey)).toBe(false);
      expect(cookieReads).toBe(0);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it.each([1, 2, 3])("rejects unavailable substituted after issued storage operation %s", async (id) => {
    const env = await localEnvironment({
      wrap: (worker) => ({
        ...worker,
        postMessage(message) {
          worker.postMessage(message.type === "storage-response" && message.id === id
            ? { type: "storage-response", id, status: "unavailable" } : message);
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.phase).toBe("terminal");
      expect(state.terminalReason).toBe(id === 1 ? "invalid-worker-result" : "invalid-storage-response");
      expect(state.referrerStorage).toEqual({ operations: id, effects: id === 3 ? 1 : 0 });
      expect(env.operations).toHaveLength(id);
      expect(env.values.has(categoryKey)).toBe(id === 3);
      expect(env.values.has(timeKey)).toBe(false);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects a forged unavailable result after storage effects", async () => {
    const env = await localEnvironment({
      wrap: (worker) => ({
        ...worker,
        onMessage(listener) {
          return worker.onMessage((message) => listener(message.type === "result" &&
            message.summary.disposition === "initialized"
            ? { ...message, summary: { ...message.summary, referrerDisposition: "storage-unavailable" } } : message));
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.terminalReason).toBe("invalid-worker-result");
      expect(state.referrerStorage).toEqual({ operations: 6, effects: 2 });
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it.each([
    ["sampled", "consent-held", "granted"],
    ["sampled", "platform-ineligible", "granted"],
    ["sampled", "storage-unavailable", "granted"],
    ["storage-unavailable", "consent-held", "granted"],
    ["storage-unavailable", "platform-ineligible", "granted"],
    ["storage-unavailable", "sampled", "granted"],
    ["platform-ineligible", "consent-held", "granted"],
    ["platform-ineligible", "storage-unavailable", "granted"],
    ["platform-ineligible", "sampled", "granted"],
    ...["pending", "denied"].flatMap((consent) => [
      ["consent-held", "platform-ineligible", consent],
      ["consent-held", "storage-unavailable", consent],
      ["consent-held", "sampled", consent],
    ]),
  ])("rejects actual-worker %s relabeled as %s under %s admission", async (source, forged, consent) => {
    let observed;
    if (source === "platform-ineligible") vi.stubGlobal("navigator", { userAgent: "AppleWebKit FBIOS" });
    const env = await localEnvironment({
      consent: { ad_storage: consent },
      wrap: (worker) => ({
        ...worker,
        onMessage(listener) {
          return worker.onMessage((message) => {
            if (message.type === "result" && message.summary.disposition === "initialized") {
              observed = message.summary.referrerDisposition;
              listener({ ...message, summary: { ...message.summary, referrerDisposition: forged } });
            } else listener(message);
          });
        },
      }),
    });
    try {
      if (source === "storage-unavailable") env.backing.localStorage = undefined;
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(observed).toBe(source);
      expect(state.terminalReason).toBe("invalid-worker-result");
      expect(state.referrerStorage).toEqual(source === "sampled"
        ? { operations: 6, effects: 2 } : { operations: 0, effects: 0 });
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); vi.unstubAllGlobals(); }
  }, 5000);

  it.each(["pending", "denied"])("preserves genuine %s initialization with no storage work", async (consent) => {
    const env = await localEnvironment({ consent: { ad_storage: consent } });
    try {
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.outcomes[0]).toMatchObject({ disposition: "initialized", referrerDisposition: "consent-held" });
      expect(state.referrerStorage).toEqual({ operations: 0, effects: 0 });
      expect(env.operations).toEqual([]);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("preserves genuine platform ineligibility without storage or a category", async () => {
    vi.stubGlobal("navigator", { userAgent: "AppleWebKit FBIOS" });
    const env = await localEnvironment();
    try {
      env.adapter.fbq("init", pixel);
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.outcomes[0]).toMatchObject({ disposition: "initialized", referrerDisposition: "platform-ineligible" });
      expect(state.referrerStorage).toEqual({ operations: 0, effects: 0 });
      expect(new URL(env.receiver.arrivals[0].url).searchParams.has("ler")).toBe(false);
    } finally { await env.close(); vi.unstubAllGlobals(); }
  }, 5000);

  it.each([
    ["retained same-host", false, false, { operations: 2, effects: 0 }],
    ["expired same-host", true, false, { operations: 4, effects: 2 }],
    ["expired external", true, true, { operations: 8, effects: 4 }],
  ])("preserves genuine %s sampling ledger", async (_name, expired, external, counts) => {
    const env = await localEnvironment({ initial: {
      [categoryKey]: "fb", [timeKey]: String(Date.now() - (expired ? ninetyDays + 10000 : 10000)),
    } });
    try {
      if (!external) env.context.referrer = `${new URL(env.receiver.endpoint).origin}/previous`;
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.outcomes[0]).toMatchObject({ disposition: "initialized", referrerDisposition: "sampled" });
      expect(state.referrerStorage).toEqual(counts);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("preserves a held admission when consent is granted before its result", async () => {
    let env;
    env = await localEnvironment({
      consent: { ad_storage: "pending" },
      wrap: (worker) => ({
        ...worker,
        onMessage(listener) {
          return worker.onMessage((message) => {
            if (message.type === "result" && message.summary.disposition === "initialized") {
              env.adapter.setConsent({ ad_storage: "granted" });
            }
            listener(message);
          });
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.outcomes[0]).toMatchObject({ disposition: "initialized", referrerDisposition: "consent-held" });
      expect(state.referrerStorage).toEqual({ operations: 0, effects: 0 });
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects a platform-ineligible result after current consent is revoked", async () => {
    vi.stubGlobal("navigator", { userAgent: "AppleWebKit FBIOS" });
    let env;
    env = await localEnvironment({
      wrap: (worker) => ({
        ...worker,
        onMessage(listener) {
          return worker.onMessage((message) => {
            if (message.type === "result" && message.summary.referrerDisposition === "platform-ineligible") {
              env.adapter.setConsent({ ad_storage: "denied" });
            }
            listener(message);
          });
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.terminalReason).toBe("invalid-worker-result");
      expect(state.referrerStorage).toEqual({ operations: 0, effects: 0 });
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); vi.unstubAllGlobals(); }
  }, 5000);

  it.each([
    ["second read", { operations: 2, effects: 0 }],
    ["second expiry removal", { operations: 4, effects: 2 }],
    ["second readback", { operations: 6, effects: 2 }],
  ])("rejects a forged sampled result after a failed %s", async (failure, counts) => {
    let observed;
    let reads = 0;
    const env = await localEnvironment({
      ...(failure === "second expiry removal" ? { initial: {
        [categoryKey]: "fb", [timeKey]: String(Date.now() - ninetyDays - 10000),
      } } : {}),
      wrap: (worker) => ({
        ...worker,
        onMessage(listener) {
          return worker.onMessage((message) => {
            if (message.type === "result" && message.summary.disposition === "rejected") {
              observed = message.summary.reason;
              listener({ ...message, summary: { seq: message.summary.seq, disposition: "initialized",
                requests: 0, referrerDisposition: "sampled" } });
            } else listener(message);
          });
        },
      }),
    });
    try {
      const backing = env.backing.localStorage;
      const get = backing.getItem;
      backing.getItem = (name) => {
        reads += 1;
        if (failure === "second read" && reads === 2 || failure === "second readback" && reads === 4) {
          throw new Error("storage-failure");
        }
        return get(name);
      };
      if (failure === "second expiry removal") {
        const remove = backing.removeItem;
        backing.removeItem = (name) => {
          if (name === timeKey) throw new Error("storage-failure");
          remove(name);
        };
      }
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(observed).toBe("storage-access-failed");
      expect(state.terminalReason).toBe("invalid-worker-result");
      expect(state.referrerStorage).toEqual(counts);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it.each(["false", "omitted"])("rejects a binding with the %s feature flag in the actual worker", async (flag) => {
    const receiver = await createPrototypeReceiver();
    const worker = createNodePrototypeChamber();
    const chamber = {
      ...worker,
      postMessage(message) {
        if (message.type !== "init") { worker.postMessage(message); return; }
        const injected = { ...message, referrerStorageBinding: { origin: "http://127.0.0.1:1234" } };
        if (flag === "false") injected.experimentalPageViewReferrer = false;
        worker.postMessage(injected);
      },
    };
    const adapter = createMetaPixelPrototype({ endpoint: receiver.endpoint, chamber,
      captureContext: () => base, consent: { ad_storage: "granted" } });
    try {
      const state = await adapter.ready();
      expect(state.phase).toBe("terminal");
      expect(["invalid-referrer-message", "worker-configuration-failed"]).toContain(state.terminalReason);
      expect(receiver.arrivals).toEqual([]);
    } finally { await closePrototypeResources({ adapter, chamber: worker, receiver }); }
  }, 5000);

  it("fails rather than treating storage lost after a write as initially unavailable", async () => {
    const env = await localEnvironment();
    try {
      const backing = env.backing.localStorage;
      const set = backing.setItem;
      backing.setItem = (name, value) => {
        set(name, value);
        if (name === categoryKey) env.backing.localStorage = undefined;
      };
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.outcomes[0]).toMatchObject({ disposition: "rejected", reason: "storage-access-failed" });
      expect(state.referrerStorage).toEqual({ operations: 3, effects: 1 });
      expect(env.values.has(categoryKey)).toBe(true);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("stops inspecting storage methods when a method getter revokes consent", async () => {
    const env = await localEnvironment();
    let laterReads = 0;
    try {
      Object.defineProperty(env.backing.localStorage, "getItem", { get() {
        env.adapter.setConsent({ ad_storage: "denied" });
        env.adapter.setConsent({ ad_storage: "granted" });
        return () => null;
      } });
      Object.defineProperty(env.backing.localStorage, "setItem", { get() {
        laterReads += 1;
        return () => {};
      } });
      env.adapter.fbq("init", pixel);
      await env.adapter.flush();
      expect(laterReads).toBe(0);
      expect(env.operations).toEqual([]);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("reports an access exception without emitting private exception text", async () => {
    const env = await localEnvironment();
    try {
      env.backing.localStorage.getItem = () => { throw new Error("private-exception"); };
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.outcomes[0]).toMatchObject({ disposition: "rejected", reason: "storage-access-failed" });
      expect(JSON.stringify(state)).not.toContain("private-exception");
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("reports the first issued write when the second write throws, without rollback", async () => {
    const env = await localEnvironment();
    try {
      const set = env.backing.localStorage.setItem;
      env.backing.localStorage.setItem = (name, value) => {
        if (name === timeKey) throw new Error("private-exception");
        set(name, value);
      };
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.outcomes[0]).toMatchObject({ disposition: "rejected", reason: "storage-access-failed" });
      expect(state.referrerStorage).toEqual({ operations: 4, effects: 2 });
      expect(env.values.has(categoryKey)).toBe(true);
      expect(env.values.has(timeKey)).toBe(false);
      expect(env.operations.some(([operation]) => operation === "remove")).toBe(false);
    } finally { await env.close(); }
  }, 5000);

  it("reports partial expiry removals without repair or rollback", async () => {
    const env = await localEnvironment({ initial: {
      [categoryKey]: "fb", [timeKey]: String(Date.now() - ninetyDays - 10000),
    } });
    try {
      const remove = env.backing.localStorage.removeItem;
      env.backing.localStorage.removeItem = (name) => {
        if (name === timeKey) throw new Error("private-exception");
        remove(name);
      };
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.outcomes[0]).toMatchObject({ disposition: "rejected", reason: "storage-access-failed" });
      expect(state.referrerStorage).toEqual({ operations: 4, effects: 2 });
      expect(env.values.has(categoryKey)).toBe(false);
      expect(env.values.has(timeKey)).toBe(true);
      expect(env.operations.some(([operation]) => operation === "set")).toBe(false);
    } finally { await env.close(); }
  }, 5000);

  it("fails on readback mismatch without retrying or dispatching", async () => {
    const env = await localEnvironment();
    try {
      env.backing.localStorage.setItem = (name) => { env.operations.push(["set", name]); };
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.outcomes[0]).toMatchObject({ disposition: "rejected", reason: "referrer-readback-mismatch" });
      expect(env.operations.map(([operation]) => operation)).toEqual(["get", "get", "set", "set", "get"]);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects oversized storage reads without repair or egress", async () => {
    const env = await localEnvironment({ initial: { [categoryKey]: "a".repeat(17), [timeKey]: "1" } });
    try {
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.outcomes[0].disposition).toBe("rejected");
      expect(env.operations).toEqual([["get", categoryKey]]);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects a worker request for an ungranted key", async () => {
    const env = await localEnvironment({
      wrap: (worker) => ({
        ...worker,
        onMessage(listener) {
          return worker.onMessage((message) => listener(message.type === "storage-request"
            ? { ...message, name: "ungranted" } : message));
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.phase).toBe("terminal");
      expect(env.operations).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects an extra field in the initial worker configuration", async () => {
    const env = await localEnvironment({
      wrap: (worker) => ({
        ...worker,
        postMessage(message) {
          worker.postMessage(message.type === "init" ? { ...message, extra: true } : message);
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.phase).toBe("terminal");
      expect(env.operations).toEqual([]);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it.each(["extra", "accessor", "inherited", "duplicate"])("rejects a %s storage request envelope", async (fault) => {
    const env = await localEnvironment({
      wrap: (worker) => ({
        ...worker,
        onMessage(listener) {
          return worker.onMessage((message) => {
            if (message.type !== "storage-request") { listener(message); return; }
            if (fault === "duplicate") { listener(message); listener(message); return; }
            const bad = fault === "inherited" ? Object.assign(Object.create({ extra: true }), message) :
              { ...message, ...(fault === "extra" ? { extra: true } : {}) };
            if (fault === "accessor") Object.defineProperty(bad, "name", { get() { throw new Error("must-not-read"); } });
            listener(bad);
          });
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.phase).toBe("terminal");
      expect(env.operations.length).toBeLessThanOrEqual(fault === "duplicate" ? 1 : 0);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it.each(["oversized", "wrong-order", "wrong-generation", "wrong-command"])(
    "rejects a %s request before the affected primitive", async (fault) => {
      const env = await localEnvironment({
        wrap: (worker) => ({
          ...worker,
          onMessage(listener) {
            return worker.onMessage((message) => {
              if (message.type !== "storage-request" || (fault === "oversized" && message.operation !== "set")) {
                listener(message); return;
              }
              const bad = fault === "oversized" ? { ...message, value: "x".repeat(17) } :
                fault === "wrong-order" ? { ...message, name: timeKey } :
                  fault === "wrong-generation" ? { ...message, generation: message.generation + 1 } :
                    { ...message, seq: message.seq + 1 };
              listener(bad);
            });
          },
        }),
      });
      try {
        env.adapter.fbq("init", pixel);
        const state = await env.adapter.flush();
        expect(state.phase).toBe("terminal");
        expect(env.operations.length).toBe(fault === "oversized" ? 2 : 0);
        expect(env.receiver.arrivals).toEqual([]);
      } finally { await env.close(); }
    }, 5000,
  );

  it("rejects a command result while a storage request remains outstanding", async () => {
    const env = await localEnvironment({
      wrap: (worker) => ({
        ...worker,
        onMessage(listener) {
          return worker.onMessage((message) => {
            listener(message);
            if (message.type === "storage-request") listener({ type: "result", ready: [],
              summary: { seq: message.seq, disposition: "initialized", requests: 0, referrerDisposition: "sampled" } });
          });
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      expect((await env.adapter.flush()).terminalReason).toBe("invalid-worker-result");
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("rejects egress between storage primitives during initialization", async () => {
    let listener;
    let injected = false;
    let answered = false;
    const env = await localEnvironment({
      wrap: (worker) => ({
        ...worker,
        onMessage(callback) { listener = callback; return worker.onMessage(callback); },
        postMessage(message) {
          if (message.type === "intercepted-fetch-response") answered = true;
          if (message.type === "storage-response" && !injected) {
            injected = true;
            listener({ type: "intercepted-fetch", id: 1, method: "GET", url: "http://127.0.0.1:1/tr/?x=1" });
          }
          worker.postMessage(message);
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.terminalReason).toBe("invalid-worker-result");
      expect(answered).toBe(false);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it.each(["extra", "duplicate"])("rejects a %s response inside the actual worker", async (fault) => {
    let injected = false;
    const env = await localEnvironment({
      wrap: (worker) => ({
        ...worker,
        postMessage(message) {
          if (message.type === "storage-response" && !injected) {
            injected = true;
            worker.postMessage(fault === "extra" ? { ...message, extra: true } : message);
            if (fault === "duplicate") worker.postMessage(message);
          } else worker.postMessage(message);
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.phase).toBe("terminal");
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("times out a withheld storage response and preserves issued-operation counts", async () => {
    const env = await localEnvironment({
      adapterOptions: { transportTimeoutMs: 50, commandTimeoutMs: 500 },
      wrap: (worker) => ({
        ...worker,
        postMessage(message) { if (message.type !== "storage-response") worker.postMessage(message); },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.phase).toBe("terminal");
      expect(state.referrerStorage).toEqual({ operations: 1, effects: 0 });
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("retains a partial write count if a write response times out", async () => {
    let operation;
    const env = await localEnvironment({
      adapterOptions: { transportTimeoutMs: 50, commandTimeoutMs: 500 },
      wrap: (worker) => ({
        ...worker,
        onMessage(listener) {
          return worker.onMessage((message) => {
            if (message.type === "storage-request") operation = message.operation;
            listener(message);
          });
        },
        postMessage(message) {
          if (message.type !== "storage-response" || operation !== "set") worker.postMessage(message);
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      const state = await env.adapter.flush();
      expect(state.phase).toBe("terminal");
      expect(state.referrerStorage).toEqual({ operations: 3, effects: 1 });
      expect(env.values.has(categoryKey)).toBe(true);
      expect(env.values.has(timeKey)).toBe(false);
    } finally { await env.close(); }
  }, 5000);

  it.each(["get", "set"])("prevents a delayed %s after revoke and regrant", async (operation) => {
    let release;
    let notify;
    let timer;
    const waiting = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("storage-request-not-observed")), 1000);
      notify = () => { clearTimeout(timer); resolve(); };
    });
    const env = await localEnvironment({
      wrap: (worker) => ({
        ...worker,
        onMessage(listener) {
          return worker.onMessage((message) => {
            if (message.type === "storage-request" && message.operation === operation && !release) {
              release = () => listener(message);
              notify();
            } else listener(message);
          });
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      await waiting;
      const before = env.operations.length;
      env.adapter.setConsent({ ad_storage: "denied" });
      env.adapter.setConsent({ ad_storage: "granted" });
      release();
      await env.adapter.flush();
      expect(env.operations.length).toBe(before);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { clearTimeout(timer); await env.close(); }
  }, 5000);

  it.each(["get", "set"])("does not consume a delayed %s response after revocation", async (operation) => {
    let release;
    let notify;
    let currentOperation;
    let timer;
    const waiting = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("storage-response-not-observed")), 1000);
      notify = () => { clearTimeout(timer); resolve(); };
    });
    const env = await localEnvironment({
      wrap: (worker) => ({
        ...worker,
        onMessage(listener) {
          return worker.onMessage((message) => {
            if (message.type === "storage-request") currentOperation = message.operation;
            listener(message);
          });
        },
        postMessage(message) {
          if (message.type === "storage-response" && currentOperation === operation && !release) {
            release = () => worker.postMessage(message);
            notify();
          } else worker.postMessage(message);
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      await waiting;
      const before = env.operations.length;
      env.adapter.setConsent({ ad_storage: "denied" });
      env.adapter.setConsent({ ad_storage: "granted" });
      release();
      await env.adapter.flush();
      expect(env.operations.length).toBe(before);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { clearTimeout(timer); await env.close(); }
  }, 5000);

  it.each(["get", "set"])("rechecks consent after a pending backing %s", async (operation) => {
    let release;
    let notify;
    let timer;
    const waiting = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("backing-operation-not-observed")), 1000);
      notify = () => { clearTimeout(timer); resolve(); };
    });
    const env = await localEnvironment();
    try {
      const backing = env.backing.localStorage;
      if (operation === "get") {
        backing.getItem = (name) => {
          env.operations.push(["get", name]);
          return new Promise((resolve) => { release = () => resolve(null); notify(); });
        };
      } else {
        const set = backing.setItem;
        backing.setItem = (name, value) => {
          set(name, value);
          return new Promise((resolve) => { release = resolve; notify(); });
        };
      }
      env.adapter.fbq("init", pixel);
      await waiting;
      const before = env.operations.length;
      env.adapter.setConsent({ ad_storage: "denied" });
      env.adapter.setConsent({ ad_storage: "granted" });
      release();
      await env.adapter.flush();
      expect(env.operations.length).toBe(before);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { clearTimeout(timer); await env.close(); }
  }, 5000);

  it("preserves timing arithmetic alongside once-only referrer caching", async () => {
    const env = await localEnvironment({ adapterOptions: { experimentalPageViewPerformance: true } });
    try {
      Object.assign(env.context, {
        performanceModernAvailable: true, performanceNavigationEntryAvailable: true,
        performanceStartTime: 1.25, performanceDomContentLoadedEventEnd: 4.75, performanceNavigationStart: null,
      });
      env.adapter.fbq("init", pixel);
      env.context.performanceDomContentLoadedEventEnd = 99;
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.outcomes.at(-1).disposition).toBe("transport-settled");
      const query = new URL(env.receiver.arrivals[0].url).searchParams;
      expect(query.get("plt")).toBe("3.5");
      expect(query.get("ler")).toBe("fb");
      expect(env.operations).toHaveLength(6);
    } finally { await env.close(); }
  }, 5000);

  it("keeps the existing cookie grant separate from referrer installation", async () => {
    let cookie = "";
    let cookieReads = 0;
    let cookieWrites = 0;
    const cookieDocument = {
      location: { hostname: "127.0.0.1", protocol: "http:" },
      get cookie() { cookieReads += 1; return cookie; },
      set cookie(value) {
        cookieWrites += 1;
        if (value.includes("domain=127.0.0.1")) cookie = value.split(";")[0];
      },
    };
    const env = await localEnvironment({ adapterOptions: { experimentalFirstPartyCookie: true, cookieDocument } });
    try {
      env.adapter.fbq("init", pixel);
      await env.adapter.flush();
      expect(cookieReads).toBe(0);
      expect(cookieWrites).toBe(0);
      expect(env.operations).toHaveLength(6);
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.outcomes.at(-1).disposition).toBe("transport-settled");
      const query = new URL(env.receiver.arrivals[0].url).searchParams;
      expect(query.get("fbp")).toMatch(/^fb\./);
      expect(query.get("ler")).toBe("fb");
      expect(env.operations).toHaveLength(6);
      expect(cookieReads).toBeGreaterThan(0);
    } finally { await env.close(); }
  }, 5000);

  it("holds a prepared request when consent changes before egress", async () => {
    let release;
    let notify;
    let timer;
    const waiting = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("egress-not-observed")), 1000);
      notify = () => { clearTimeout(timer); resolve(); };
    });
    const env = await localEnvironment({
      wrap: (worker) => ({
        ...worker,
        onMessage(listener) {
          return worker.onMessage((message) => {
            if (message.type === "intercepted-fetch") {
              release = () => listener(message);
              notify();
            } else listener(message);
          });
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      env.adapter.fbq("track", "PageView");
      await waiting;
      env.adapter.setConsent({ ad_storage: "denied" });
      env.adapter.setConsent({ ad_storage: "granted" });
      release();
      const state = await env.adapter.flush();
      expect(state.outcomes.at(-1).disposition).toBe("held");
      expect(env.receiver.arrivals).toEqual([]);
    } finally { clearTimeout(timer); await env.close(); }
  }, 5000);

  it("withholds a transport response that settles after revoke and regrant", async () => {
    let settle;
    let notify;
    let timer;
    const waiting = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("fetch-not-observed")), 1000);
      notify = () => { clearTimeout(timer); resolve(); };
    });
    const env = await localEnvironment({
      adapterOptions: { fetchImpl: () => new Promise((resolve) => { settle = resolve; notify(); }) },
    });
    try {
      env.adapter.fbq("init", pixel);
      env.adapter.fbq("track", "PageView");
      await waiting;
      env.adapter.setConsent({ ad_storage: "denied" });
      env.adapter.setConsent({ ad_storage: "granted" });
      settle({ status: 204, body: null });
      const state = await env.adapter.flush();
      expect(state.outcomes.at(-1).disposition).toBe("held");
      expect(state.host.dispatchAttempts).toBe(1);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { clearTimeout(timer); await env.close(); }
  }, 5000);

  it("tag revoke and grant do not revive the installation cache", async () => {
    const env = await localEnvironment({ adapterOptions: { experimentalTagConsent: true } });
    try {
      env.adapter.fbq("init", pixel);
      await env.adapter.flush();
      env.adapter.fbq("consent", "revoke");
      env.adapter.fbq("consent", "grant");
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.outcomes.at(-1).disposition).toBe("transport-settled");
      expect(new URL(env.receiver.arrivals[0].url).searchParams.has("ler")).toBe(false);
      expect(env.operations).toHaveLength(6);
    } finally { await env.close(); }
  }, 5000);
});

describe("governed first PageView referrer worker semantics", () => {
  it.each([2, 3])("fails a late storage-unavailable at operation %s without fallback", async (failedAt) => {
    const env = setup();
    const original = env.connector;
    let operations = 0;
    const storage = {
      async get() {
        operations += 1;
        if (operations === failedAt) throw new Error("storage-unavailable");
        return null;
      },
      async set() {
        operations += 1;
        if (operations === failedAt) throw new Error("storage-unavailable");
      },
      async remove() { throw new Error("unexpected-remove"); },
    };
    original.init({ storage });
    await expect(sample(env, initContext())).rejects.toThrow("storage-access-failed");
    expect(operations).toBe(failedAt);
  });

  it.each([
    ["", "empty"],
    ["https://facebook.com/path", "fb"],
    ["https://m.facebook.com/path", "fb"],
    ["https://instagram.com/path", "ig"],
    ["https://www.instagram.com/path", "ig"],
    ["https://notfacebook.com/path", "other"],
    ["https://facebook.com.example.test/path", "other"],
  ])("samples referrer %s as %s and caches it", async (referrer, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const env = setup();
    await sample(env, initContext(referrer));
    expect(await ler(env)).toBe(expected);
    expect(await ler(env)).toBe(expected);
    expect(env.state.get(categoryKey)).toBe(expected);
    expect(env.state.get(timeKey)).toBe(String(now));
    expect(env.operations.map(([operation]) => operation)).toEqual(["get", "get", "set", "set", "get", "get"]);
  });

  it("preserves complete same-host state exactly at 90 days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const timestamp = String(now - ninetyDays);
    const env = setup({ [categoryKey]: "fb", [timeKey]: timestamp });
    await sample(env, initContext("http://127.0.0.1:1234/previous"));
    expect(await ler(env)).toBe("fb");
    expect(env.state.get(timeKey)).toBe(timestamp);
    expect(env.operations.map(([operation]) => operation)).toEqual(["get", "get"]);
  });

  it("removes both expired keys before processing an absent referrer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const env = setup({ [categoryKey]: "fb", [timeKey]: String(now - ninetyDays - 1) });
    await sample(env, initContext());
    expect(await ler(env)).toBe("empty");
    expect(env.operations.map(([operation]) => operation))
      .toEqual(["get", "get", "remove", "remove", "set", "set", "get", "get"]);
  });

  it("allows same-host fresh state without inventing a category", async () => {
    const env = setup();
    await sample(env, initContext("http://127.0.0.1:1234/previous"));
    expect(await ler(env)).toBeNull();
    expect(env.operations.map(([operation]) => operation)).toEqual(["get", "get"]);
  });

  it("maps a bounded unknown retained category to other without rewriting it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const env = setup({ [categoryKey]: "unknown", [timeKey]: String(now) });
    await sample(env, initContext("http://127.0.0.1:1234/previous"));
    expect(await ler(env)).toBe("other");
    expect(env.state.get(categoryKey)).toBe("unknown");
    expect(env.operations.map(([operation]) => operation)).toEqual(["get", "get"]);
  });

  it.each([
    { [categoryKey]: "fb" },
    { [timeKey]: String(now) },
    { [categoryKey]: "fb", [timeKey]: "01" },
    { [categoryKey]: "fb", [timeKey]: String(now + 1) },
    { [categoryKey]: "x".repeat(17), [timeKey]: String(now) },
    { [categoryKey]: "fb", [timeKey]: "not-a-time" },
  ])("rejects malformed or partial persisted state without repair", async (initial) => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const env = setup(initial);
    await expect(sample(env, initContext())).rejects.toThrow();
    expect(env.operations.every(([operation]) => operation === "get")).toBe(true);
  });

  it.each([
    ["Android FB_IAB", true],
    ["Android Instagram", true],
    ["AppleWebKit FBIOS", false],
    ["AppleWebKit Instagram", true],
    ["AppleWebKit MessengerLiteForiOS", false],
  ])("skips ineligible platform %s without touching storage", async (ua, xhr) => {
    const env = setup();
    await sample(env, initContext("", ua, xhr));
    expect(await ler(env)).toBeNull();
    expect(env.operations).toEqual([]);
  });

  it("does not exclude Android in-app markers without XMLHttpRequest", async () => {
    const env = setup();
    await sample(env, initContext("", "Android FB_IAB", false));
    expect(await ler(env)).toBe("empty");
    expect(env.operations).toHaveLength(6);
  });
});
