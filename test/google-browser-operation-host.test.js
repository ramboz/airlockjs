import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";

const mocks = vi.hoisted(() => ({ createRealm: vi.fn() }));
vi.mock("../adapters/google-browser-operation-realm.js", () => ({ createGoogleBrowserRealm: mocks.createRealm }));

const fixture = JSON.parse(readFileSync(new URL("../rig/fixtures/google-manual-conversion.json", import.meta.url), "utf8"));
const owned = fixture.owned;
const origin = "http://127.0.0.1:41234";
const secureOrigin = "https://127.0.0.1:41234";
const endpoint = `${origin}/pagead/conversion/${owned.conversion_id.slice(3)}/`;
const option = {
  auid: owned.auid, recipientOrigins: [origin], secondaryOrigin: origin, secondaryMode: "cors",
  permissions: { [origin]: ["ad_storage"], [secureOrigin]: ["ad_storage"] },
};

afterEach(() => mocks.createRealm.mockReset());

async function start(realmFactory, consent = "granted", browserOption = option) {
  mocks.createRealm.mockImplementation(realmFactory);
  const chamber = createNodeConversionChamber();
  await chamber.probe;
  const fallbackFetch = vi.fn(() => { throw new Error("unexpected legacy fetch"); });
  const adapter = createGoogleAdsPrototype({
    endpoint, chamber, fetchImpl: fallbackFetch, captureContext: () => ({ pageURL: owned.document_url, referrer: "" }),
    consent: { ad_storage: consent }, experimentalRouting: true, experimentalBrowserOperation: browserOption,
    commandTimeoutMs: 1800, transportTimeoutMs: 100,
  });
  adapter.gtag("config", owned.conversion_id);
  adapter.gtag("event", "conversion", {
    send_to: `${owned.conversion_id}/${owned.conversion_label}`, value: owned.value,
    currency: owned.currency, transaction_id: owned.transaction_id,
  });
  return { adapter, chamber, fallbackFetch };
}

describe("private Google browser-operation host", () => {
  it("aborts and cancels a real streaming primary missing Content-Type", async () => {
    let signal;
    const cancel = vi.fn();
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode("open")); },
      cancel,
    });
    const fetch = vi.fn(async (_url, init) => { signal = init.signal; return new Response(stream, { status: 200 }); });
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    const { adapter, chamber } = await start(async () => realm);
    try {
      const state = await adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({ disposition: "failed", reason: "rejected", authoredOperations: 1 });
      expect(signal.aborted).toBe(true);
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally { await adapter.dispose(); }
    expect(chamber.getState().closed).toBe(true);
    expect(realm.dispose).toHaveBeenCalledTimes(1);
  }, 5000);

  it("does not cancel readers after successful EOF", async () => {
    const bytes = new TextEncoder().encode(fixture.entries[0].response.body);
    const stream = new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
    const response = new Response(stream, { status: 200, headers: { "content-type": "application/json" } });
    const original = stream.getReader.bind(stream);
    let cancel;
    vi.spyOn(stream, "getReader").mockImplementation(() => {
      const reader = original();
      cancel = vi.spyOn(reader, "cancel");
      return reader;
    });
    const fetch = vi.fn().mockResolvedValueOnce(response).mockResolvedValueOnce(new Response("", { status: 200 }));
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    const { adapter, chamber } = await start(async () => realm);
    try {
      const state = await adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({ disposition: "readable", authoredOperations: 2, status: 200 });
      expect(cancel).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
    expect(chamber.getState().closed).toBe(true);
  }, 5000);

  it("reports and retains a noncooperative streaming cancellation without waiting indefinitely", async () => {
    let release, signal;
    const stream = new ReadableStream({
      cancel() { return new Promise((resolve) => { release = resolve; }); },
    });
    const fetch = vi.fn(async (_url, init) => { signal = init.signal; return new Response(stream, { status: 200 }); });
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    const { adapter, chamber } = await start(async () => realm);
    try {
      const state = await Promise.race([
        adapter.flush(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("flush-unbounded")), 1600)),
      ]);
      expect(signal.aborted).toBe(true);
      expect(release).toBeTypeOf("function");
      expect(state).toMatchObject({ phase: "terminal", terminalReason: "transport-timeout" });
      expect(state.browserCleanup.capabilityPending).toBeGreaterThan(0);
      await expect(adapter.dispose()).rejects.toThrow("prototype-cleanup-failed");
      expect(adapter.getState().cleanupFailure).toBe("capability-drain-timeout");
      expect(adapter.getState().browserCleanup.capabilityPending).toBeGreaterThan(0);
      release();
      await vi.waitFor(() => expect(adapter.getState().browserCleanup.capabilityPending).toBe(0));
    } finally { release?.(); await adapter.dispose().catch(() => {}); }
    expect(chamber.getState().closed).toBe(true);
  }, 6000);

  it("cancels a pending readable body when its operation times out", async () => {
    let signal;
    const cancel = vi.fn();
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode("{")); },
      cancel,
    });
    const fetch = vi.fn(async (_url, init) => {
      signal = init.signal;
      return new Response(stream, { status: 200, headers: { "content-type": "application/json" } });
    });
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    const { adapter, chamber } = await start(async () => realm);
    try {
      const state = await adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({ disposition: "failed", reason: "timed-out", authoredOperations: 1 });
      expect(signal.aborted).toBe(true);
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(state.cleanupFailure).toBe(null);
    } finally { await adapter.dispose(); }
    expect(chamber.getState().closed).toBe(true);
    expect(stream.locked).toBe(false);
  }, 5000);

  it("cancels a response that arrives after worker retirement", async () => {
    let release, signal;
    const cancel = vi.fn();
    const stream = new ReadableStream({ cancel });
    const fetch = vi.fn((_url, init) => {
      signal = init.signal;
      return new Promise((resolve) => { release = () => resolve(new Response(stream, { status: 200 })); });
    });
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    const { adapter, chamber } = await start(async () => realm);
    try {
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      adapter.retireBrowserWorker();
      expect(signal.aborted).toBe(true);
      release();
      release = undefined;
      await adapter.dispose();
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(adapter.getState().browserCleanup.capabilityPending).toBe(0);
    } finally { release?.(); await adapter.dispose(); }
    expect(chamber.getState().closed).toBe(true);
  }, 5000);

  it("reports a failed readable-stream cancellation rather than claiming clean disposal", async () => {
    let signal;
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode("open")); },
      cancel() { return Promise.reject(new Error("cancel-failed")); },
    });
    const fetch = vi.fn(async (_url, init) => { signal = init.signal; return new Response(stream, { status: 200 }); });
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    const { adapter, chamber } = await start(async () => realm);
    try {
      const state = await adapter.flush();
      expect(signal.aborted).toBe(true);
      expect(state).toMatchObject({ phase: "terminal", terminalReason: "browser-response-cleanup-failed",
        cleanupFailure: "browser-response-cancel-failed" });
      await expect(adapter.dispose()).rejects.toThrow("prototype-cleanup-failed");
    } finally { await adapter.dispose().catch(() => {}); }
    expect(chamber.getState().closed).toBe(true);
  }, 5000);

  it("aborts and reports cleanup uncertainty after a real readable-stream read failure", async () => {
    let signal;
    const stream = new ReadableStream({ start(controller) { controller.error(new Error("read-failed")); } });
    const fetch = vi.fn(async (_url, init) => {
      signal = init.signal;
      return new Response(stream, { status: 200, headers: { "content-type": "application/json" } });
    });
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    const { adapter, chamber } = await start(async () => realm);
    try {
      const state = await adapter.flush();
      expect(signal.aborted).toBe(true);
      expect(state).toMatchObject({ phase: "terminal", terminalReason: "browser-response-cleanup-failed",
        cleanupFailure: "browser-response-cancel-failed" });
      expect(fetch).toHaveBeenCalledTimes(1);
      await expect(adapter.dispose()).rejects.toThrow("prototype-cleanup-failed");
    } finally { await adapter.dispose().catch(() => {}); }
    expect(chamber.getState().closed).toBe(true);
    expect(stream.locked).toBe(false);
  }, 5000);

  it("requires purpose permission for the CSP secure-upgrade recipient", async () => {
    const chamber = createNodeConversionChamber();
    await chamber.probe;
    mocks.createRealm.mockResolvedValue({ valid: () => true, fetch: vi.fn(), dispose: vi.fn() });
    let adapter;
    try {
      expect(() => {
        adapter = createGoogleAdsPrototype({
          endpoint, chamber, captureContext: () => ({ pageURL: owned.document_url, referrer: "" }),
          consent: { ad_storage: "granted" }, experimentalRouting: true,
          experimentalBrowserOperation: { ...option, permissions: { [origin]: ["ad_storage"] } },
        });
      }).toThrow("invalid-experimental-option");
    } finally { if (adapter) await adapter.dispose(); else await chamber.dispose(); }
  });

  it.each([
    ["80", ["http://127.0.0.1", "https://127.0.0.1:80", "https://127.0.0.1"]],
    ["443", ["http://127.0.0.1:443", "https://127.0.0.1"]],
    ["41234", [origin, secureOrigin]],
  ])("requires every effective CSP origin at port %s", async (port, required) => {
    const literal = `http://127.0.0.1:${port}`;
    const permissions = Object.fromEntries(required.map((value) => [value, ["ad_storage"]]));
    const chamber = { postMessage: vi.fn(), onMessage: () => () => {}, onError: () => () => {}, dispose: vi.fn() };
    const realm = { valid: () => true, fetch: vi.fn(), dispose: vi.fn() };
    mocks.createRealm.mockResolvedValue(realm);
    const create = (grants) => createGoogleAdsPrototype({
      endpoint: `${literal}/pagead/conversion/${owned.conversion_id.slice(3)}/`, chamber,
      captureContext: () => ({ pageURL: owned.document_url, referrer: "" }),
      consent: { ad_storage: "granted" }, experimentalRouting: true,
      experimentalBrowserOperation: { ...option, recipientOrigins: [literal], secondaryOrigin: literal, permissions: grants },
    });
    for (const omitted of required) {
      const partial = { ...permissions };
      delete partial[omitted];
      expect(() => create(partial)).toThrow("invalid-experimental-option");
    }
    const adapter = create(permissions);
    await adapter.dispose();
    expect(realm.fetch).not.toHaveBeenCalled();
  });

  it("withdraws authority if the secure-upgrade permission disappears while awaiting the realm", async () => {
    let release;
    const fetch = vi.fn();
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    const { adapter, chamber } = await start(() => new Promise((resolve) => { release = () => resolve(realm); }));
    try {
      await vi.waitFor(() => expect(mocks.createRealm).toHaveBeenCalledTimes(1));
      adapter.setBrowserPermissions({ [origin]: ["ad_storage"] });
      release();
      expect((await adapter.flush()).terminalReason).toBe("browser-permission-revoked");
      expect(fetch).not.toHaveBeenCalled();
    } finally { release?.(); await adapter.dispose(); }
    expect(chamber.getState().closed).toBe(true);
    expect(realm.dispose).toHaveBeenCalledTimes(1);
  }, 5000);

  it.each([
    ["command", 3000],
    ["operation", 250],
  ])("rejects an expired %s deadline even if its timer callback has not run", async (_label, advance) => {
    let releaseRealm;
    let observedOperation = false;
    const fetch = vi.fn().mockResolvedValue({ type: "opaque" });
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    mocks.createRealm.mockImplementation(() => new Promise((resolve) => { releaseRealm = () => resolve(realm); }));
    const clock = globalThis.performance;
    let shift = 0;
    vi.stubGlobal("performance", { now: () => clock.now() + shift });
    const chamber = createNodeConversionChamber();
    await chamber.probe;
    const trackedChamber = { ...chamber, onMessage(listener) {
      return chamber.onMessage((message) => {
        if (message.type === "browser-operation-request") observedOperation = true;
        listener(message);
      });
    } };
    const adapter = createGoogleAdsPrototype({
      endpoint, chamber: trackedChamber, captureContext: () => ({ pageURL: owned.document_url, referrer: "" }),
      consent: { ad_storage: "granted" }, experimentalRouting: true,
      experimentalBrowserOperation: option,
      commandTimeoutMs: 1800, transportTimeoutMs: 100,
    });
    try {
      adapter.gtag("config", owned.conversion_id);
      adapter.gtag("event", "conversion", {
        send_to: `${owned.conversion_id}/${owned.conversion_label}`, value: owned.value,
        currency: owned.currency, transaction_id: owned.transaction_id,
      });
      await vi.waitFor(() => expect(observedOperation).toBe(true));
      shift = advance;
      releaseRealm();
      const state = await adapter.flush();
      expect(fetch).not.toHaveBeenCalled();
      expect(state.terminalReason).toBe(_label === "command" ? "command-timeout" : "browser-operation-timeout");
    } finally {
      releaseRealm?.();
      await adapter.dispose();
      vi.unstubAllGlobals();
    }
    expect(chamber.getState().closed).toBe(true);
  }, 5000);

  it("caps transport timeout to the remaining command interval", async () => {
    let releaseRealm;
    let observedOperation = false;
    const fetch = vi.fn((_url, { signal }) => new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })));
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    mocks.createRealm.mockImplementation(() => new Promise((resolve) => { releaseRealm = () => resolve(realm); }));
    const clock = globalThis.performance;
    let shift = 0;
    vi.stubGlobal("performance", { now: () => clock.now() + shift });
    const timers = vi.spyOn(globalThis, "setTimeout");
    const chamber = createNodeConversionChamber();
    await chamber.probe;
    const trackedChamber = { ...chamber, onMessage(listener) {
      return chamber.onMessage((message) => {
        if (message.type === "browser-operation-request") observedOperation = true;
        listener(message);
      });
    } };
    const adapter = createGoogleAdsPrototype({
      endpoint, chamber: trackedChamber, captureContext: () => ({ pageURL: owned.document_url, referrer: "" }),
      consent: { ad_storage: "granted" }, experimentalRouting: true, experimentalBrowserOperation: option,
      commandTimeoutMs: 300, transportTimeoutMs: 700,
    });
    try {
      adapter.gtag("config", owned.conversion_id);
      adapter.gtag("event", "conversion", {
        send_to: `${owned.conversion_id}/${owned.conversion_label}`, value: owned.value,
        currency: owned.currency, transaction_id: owned.transaction_id,
      });
      await vi.waitFor(() => expect(observedOperation).toBe(true));
      shift = 200;
      releaseRealm();
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      const timeout = timers.mock.calls.find(([callback]) => String(callback).includes("controller.abort()"));
      expect(timeout).toBeDefined();
      expect(timeout[1]).toBeGreaterThan(0);
      expect(timeout[1]).toBeLessThanOrEqual(100);
      await adapter.flush();
    } finally {
      releaseRealm?.();
      await adapter.dispose();
      timers.mockRestore();
      vi.unstubAllGlobals();
    }
    expect(chamber.getState().closed).toBe(true);
  }, 5000);

  it.each([
    ["foreign instance", (message) => ({ ...message, instanceId: "foreign" })],
    ["stale epoch", (message) => ({ ...message, epoch: message.epoch + 1 })],
    ["foreign command", (message) => ({ ...message, commandId: message.commandId + 1 })],
    ["wrong operation", (message) => ({ ...message, operationId: message.operationId + 1 })],
    ["wrong parent", (message) => ({ ...message, parentId: 1 })],
    ["wrong method", (message) => ({ ...message, method: "POST" })],
    ["foreign destination", (message) => ({ ...message, url: message.url.replace(origin, "http://127.0.0.1:41235") })],
    ["extra field", (message) => ({ ...message, extra: true })],
  ])("rejects a %s request before realm fetch", async (_label, mutate) => {
    const fetch = vi.fn();
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    mocks.createRealm.mockResolvedValue(realm);
    const chamber = createNodeConversionChamber();
    await chamber.probe;
    const trackedChamber = { ...chamber, onMessage(listener) {
      return chamber.onMessage((message) => listener(message.type === "browser-operation-request" ? mutate(message) : message));
    } };
    const adapter = createGoogleAdsPrototype({
      endpoint, chamber: trackedChamber, captureContext: () => ({ pageURL: owned.document_url, referrer: "" }),
      consent: { ad_storage: "granted" }, experimentalRouting: true, experimentalBrowserOperation: option,
      commandTimeoutMs: 1800, transportTimeoutMs: 100,
    });
    try {
      adapter.gtag("config", owned.conversion_id);
      adapter.gtag("event", "conversion", {
        send_to: `${owned.conversion_id}/${owned.conversion_label}`, value: owned.value,
        currency: owned.currency, transaction_id: owned.transaction_id,
      });
      const state = await adapter.flush();
      expect(state.terminalReason).toBe("request-correlation-failed");
      expect(fetch).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
    expect(chamber.getState().closed).toBe(true);
    expect(realm.dispose).toHaveBeenCalledTimes(1);
  }, 5000);

  it("retires the epoch on a duplicate operation before the awaited realm can fetch", async () => {
    let releaseRealm;
    const fetch = vi.fn();
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    mocks.createRealm.mockImplementation(() => new Promise((resolve) => { releaseRealm = () => resolve(realm); }));
    const chamber = createNodeConversionChamber();
    await chamber.probe;
    const trackedChamber = { ...chamber, onMessage(listener) {
      return chamber.onMessage((message) => {
        listener(message);
        if (message.type === "browser-operation-request") listener(message);
      });
    } };
    const adapter = createGoogleAdsPrototype({
      endpoint, chamber: trackedChamber, captureContext: () => ({ pageURL: owned.document_url, referrer: "" }),
      consent: { ad_storage: "granted" }, experimentalRouting: true, experimentalBrowserOperation: option,
      commandTimeoutMs: 1800, transportTimeoutMs: 100,
    });
    try {
      adapter.gtag("config", owned.conversion_id);
      adapter.gtag("event", "conversion", {
        send_to: `${owned.conversion_id}/${owned.conversion_label}`, value: owned.value,
        currency: owned.currency, transaction_id: owned.transaction_id,
      });
      await vi.waitFor(() => expect(adapter.getState().terminalReason).toBe("request-correlation-failed"));
      releaseRealm();
      await adapter.flush();
      expect(fetch).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
    expect(chamber.getState().closed).toBe(true);
    expect(realm.dispose).toHaveBeenCalledTimes(1);
  }, 5000);

  it("bounds a silent worker by the command deadline without replay", async () => {
    const fetch = vi.fn();
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    mocks.createRealm.mockResolvedValue(realm);
    const chamber = createNodeConversionChamber();
    await chamber.probe;
    const post = chamber.postMessage;
    chamber.postMessage = (message) => {
      if (message.type !== "event" || message.event?.payload?.args?.[0] !== "event") post(message);
    };
    const adapter = createGoogleAdsPrototype({
      endpoint, chamber, captureContext: () => ({ pageURL: owned.document_url, referrer: "" }),
      consent: { ad_storage: "granted" }, experimentalRouting: true, experimentalBrowserOperation: option,
      commandTimeoutMs: 200, transportTimeoutMs: 100,
    });
    try {
      adapter.gtag("config", owned.conversion_id);
      adapter.gtag("event", "conversion", {
        send_to: `${owned.conversion_id}/${owned.conversion_label}`, value: owned.value,
        currency: owned.currency, transaction_id: owned.transaction_id,
      });
      const state = await adapter.flush();
      expect(state.phase).toBe("terminal");
      expect(state.terminalReason).toBe("command-timeout");
      adapter.setConsent({ ad_storage: "granted" });
      adapter.gtag("event", "conversion", { send_to: `${owned.conversion_id}/${owned.conversion_label}` });
      await adapter.flush();
      expect(fetch).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
    expect(chamber.getState().closed).toBe(true);
    expect(realm.dispose).toHaveBeenCalledTimes(1);
  }, 5000);

  it("uses the owned mapper and realm for two operations, and disposes both", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(fixture.entries[0].response.body, {
        status: 200, headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    mocks.createRealm.mockResolvedValue(realm);
    const chamber = createNodeConversionChamber();
    await chamber.probe;
    const fallbackFetch = vi.fn(() => { throw new Error("unexpected legacy fetch"); });
    const adapter = createGoogleAdsPrototype({
      endpoint, chamber, fetchImpl: fallbackFetch, captureContext: () => ({ pageURL: owned.document_url, referrer: "" }),
      consent: { ad_storage: "granted" }, experimentalRouting: true, experimentalBrowserOperation: option,
      commandTimeoutMs: 1800, transportTimeoutMs: 700,
    });
    try {
      adapter.gtag("config", owned.conversion_id);
      adapter.gtag("event", "conversion", {
        send_to: `${owned.conversion_id}/${owned.conversion_label}`, value: owned.value,
        currency: owned.currency, transaction_id: owned.transaction_id,
      });
      const state = await adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({ disposition: "readable", authoredOperations: 2, status: 200 });
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch.mock.calls.map(([, init]) => [init.method, init.redirect, init.credentials])).toEqual([
        ["GET", "error", "omit"], ["POST", "follow", "omit"],
      ]);
      expect(fallbackFetch).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
    expect(realm.dispose).toHaveBeenCalledTimes(1);
    expect(chamber.getState().closed).toBe(true);
  }, 5000);

  it("does not issue the secondary when the primary is opaque", async () => {
    const fetch = vi.fn().mockResolvedValue({ type: "opaque" });
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    const { adapter, chamber } = await start(async () => realm);
    try {
      const state = await adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({
        disposition: "failed", reason: "primary-unreadable", authoredOperations: 1,
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally { await adapter.dispose(); }
    expect(chamber.getState().closed).toBe(true);
    expect(realm.dispose).toHaveBeenCalledTimes(1);
  }, 5000);

  it("invalidates before dispatch if consent is withdrawn during realm setup", async () => {
    const fetch = vi.fn();
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    let release;
    const { adapter, chamber } = await start(() => new Promise((resolve) => { release = () => resolve(realm); }));
    try {
      await vi.waitFor(() => expect(mocks.createRealm).toHaveBeenCalledTimes(1));
      adapter.setConsent({ ad_storage: "denied" });
      release();
      adapter.setConsent({ ad_storage: "granted" });
      expect((await adapter.flush()).phase).toBe("terminal");
      expect(fetch).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
    expect(chamber.getState().closed).toBe(true);
    expect(realm.dispose).toHaveBeenCalledTimes(1);
  }, 5000);

  it("denies a waiting operation if any pinned recipient loses permission", async () => {
    const otherOrigin = "http://127.0.0.1:41235";
    const multiOrigin = { ...option, recipientOrigins: [origin, otherOrigin],
      permissions: { [origin]: ["ad_storage"], [secureOrigin]: ["ad_storage"],
        [otherOrigin]: ["ad_storage"], "https://127.0.0.1:41235": ["ad_storage"] } };
    const fetch = vi.fn();
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    let release;
    const { adapter, chamber } = await start(() => new Promise((resolve) => { release = () => resolve(realm); }), "granted", multiOrigin);
    try {
      await vi.waitFor(() => expect(mocks.createRealm).toHaveBeenCalledTimes(1));
      adapter.setBrowserPermissions({ [origin]: ["ad_storage"] });
      release();
      expect((await adapter.flush()).terminalReason).toBe("browser-permission-revoked");
      expect(fetch).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
    expect(chamber.getState().closed).toBe(true);
    expect(realm.dispose).toHaveBeenCalledTimes(1);
  }, 5000);

  it("denies initial consent without invoking realm fetch", async () => {
    const fetch = vi.fn();
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    const { adapter, chamber } = await start(async () => realm, "denied");
    try {
      expect((await adapter.flush()).terminalReason).toBe("browser-authority-lost");
      expect(fetch).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
    expect(chamber.getState().closed).toBe(true);
  }, 5000);

  it("waits for the final readable body and records an opaque secondary without HTTP success", async () => {
    let closeBody;
    const held = new ReadableStream({ start(controller) { closeBody = () => controller.close(); } });
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(fixture.entries[0].response.body, {
        status: 200, headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(held, { status: 200 }));
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    const resources = await start(async () => realm);
    try {
      let completed = false;
      const completion = resources.adapter.flush().then((state) => { completed = true; return state; });
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      await Promise.resolve();
      expect(completed).toBe(false);
      closeBody();
      expect((await completion).outcomes.at(-1)).toMatchObject({ disposition: "readable", authoredOperations: 2, status: 200 });
    } finally { await resources.adapter.dispose(); }
    expect(resources.chamber.getState().closed).toBe(true);

    mocks.createRealm.mockReset();
    const opaqueFetch = vi.fn()
      .mockResolvedValueOnce(new Response(fixture.entries[0].response.body, {
        status: 200, headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce({ type: "opaque" });
    const opaqueRealm = { valid: () => true, fetch: opaqueFetch, dispose: vi.fn() };
    const opaque = await start(async () => opaqueRealm);
    try {
      const outcome = (await opaque.adapter.flush()).outcomes.at(-1);
      expect(outcome).toMatchObject({ disposition: "opaque", authoredOperations: 2 });
      expect(outcome).not.toHaveProperty("status");
      expect(opaqueFetch).toHaveBeenCalledTimes(2);
    } finally { await opaque.adapter.dispose(); }
    expect(opaque.chamber.getState().closed).toBe(true);
  }, 5000);

  it.each(["permission", "realm", "worker", "disposal"])("aborts an in-flight call on %s loss without replay", async (loss) => {
    let loseRealm;
    let signal;
    const fetch = vi.fn((_url, init) => {
      signal = init.signal;
      return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    });
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    const { adapter, chamber } = await start(async (_origins, onLoss) => { loseRealm = onLoss; return realm; });
    try {
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      if (loss === "permission") adapter.setBrowserPermissions({});
      else if (loss === "realm") loseRealm();
      else if (loss === "worker") adapter.retireBrowserWorker();
      else await adapter.dispose();
      expect(signal.aborted).toBe(true);
      adapter.setConsent({ ad_storage: "granted" });
      adapter.gtag("event", "conversion", {});
      await adapter.flush();
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally { await adapter.dispose(); }
    expect(chamber.getState().closed).toBe(true);
    expect(realm.dispose).toHaveBeenCalledTimes(1);
  }, 5000);

  it("aborts pending transport when the owned worker reports an error", async () => {
    let reportWorkerError;
    let signal;
    const fetch = vi.fn((_url, init) => {
      signal = init.signal;
      return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    });
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    mocks.createRealm.mockResolvedValue(realm);
    const chamber = createNodeConversionChamber();
    await chamber.probe;
    const trackedChamber = { ...chamber, onError(listener) {
      reportWorkerError = listener;
      return chamber.onError(listener);
    } };
    const adapter = createGoogleAdsPrototype({
      endpoint, chamber: trackedChamber, captureContext: () => ({ pageURL: owned.document_url, referrer: "" }),
      consent: { ad_storage: "granted" }, experimentalRouting: true, experimentalBrowserOperation: option,
      commandTimeoutMs: 1800, transportTimeoutMs: 700,
    });
    try {
      adapter.gtag("config", owned.conversion_id);
      adapter.gtag("event", "conversion", {
        send_to: `${owned.conversion_id}/${owned.conversion_label}`, value: owned.value,
        currency: owned.currency, transaction_id: owned.transaction_id,
      });
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      reportWorkerError();
      expect(signal.aborted).toBe(true);
      expect((await adapter.flush()).terminalReason).toBe("worker-error");
    } finally { await adapter.dispose(); }
    expect(chamber.getState().closed).toBe(true);
    expect(realm.dispose).toHaveBeenCalledTimes(1);
  }, 5000);

  it("times out a pending operation and never manufactures a success", async () => {
    const fetch = vi.fn((_url, { signal }) => new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })));
    const realm = { valid: () => true, fetch, dispose: vi.fn() };
    const { adapter, chamber } = await start(async () => realm);
    try {
      const state = await adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({
        disposition: "failed", reason: "timed-out", authoredOperations: 1,
      });
      expect(state.outcomes.at(-1)).not.toHaveProperty("status");
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally { await adapter.dispose(); }
    expect(chamber.getState().closed).toBe(true);
  }, 5000);
});
