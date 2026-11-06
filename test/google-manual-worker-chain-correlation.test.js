import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";

const fixture = JSON.parse(readFileSync(new URL("../rig/fixtures/google-manual-conversion.json", import.meta.url), "utf8"));
const owned = fixture.owned;
const endpoint = `http://127.0.0.1:41234/pagead/conversion/${owned.conversion_id.slice(3)}/`;
const origin = new URL(endpoint).origin;
const offered = fixture.entries[1].request.url;
const location = fixture.entries[1].response.headers.find(([name]) => name === "location")[1];
const secondary = `${origin}/pagead/viewthroughconversion/${owned.conversion_id.slice(3)}/${new URL(offered).search}`;
const final = `${origin}/pagead/1p-conversion/${owned.conversion_id.slice(3)}/${new URL(location).search}`;

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

async function setup(fetchOverride) {
  const chamber = fakeChamber();
  const fetchImpl = vi.fn(fetchOverride || (async (_url, options) => options.method === "GET"
    ? new Response(fixture.entries[0].response.body, { status: 200, headers: { "content-type": "application/json" } })
    : new Response("", { status: 302, headers: { location } })));
  const adapter = createGoogleAdsPrototype({
    endpoint, chamber, fetchImpl, captureContext: () => ({ pageURL: owned.document_url, referrer: "" }),
    consent: { ad_storage: "granted" }, experimentalRouting: true,
    experimentalManualResponseChain: { auid: owned.auid }, transportTimeoutMs: 500, commandTimeoutMs: 1200,
  });

  adapter.gtag("config", owned.conversion_id);
  await vi.waitFor(() => expect(chamber.sent.some((message) => message.type === "event")).toBe(true));
  chamber.emit({ type: "result", summary: { seq: 1, disposition: "configured", requests: 0 }, ready: [] });
  await adapter.flush();
  const params = { send_to: `${owned.conversion_id}/${owned.conversion_label}`, value: owned.value,
    currency: owned.currency, transaction_id: owned.transaction_id };
  adapter.gtag("event", "conversion", params);
  await vi.waitFor(() => expect(chamber.sent.filter((message) => message.type === "event")).toHaveLength(2));
  const query = new URLSearchParams({ label: owned.conversion_label, value: String(owned.value), currency_code: owned.currency,
    oid: owned.transaction_id, url: owned.document_url });
  const primary = { type: "intercepted-fetch", id: 1, stage: "primary", parent: 0, method: "GET", url: `${endpoint}?${query}` };
  return { adapter, chamber, fetchImpl, primary };
}

async function primaryResponse(resources) {
  resources.chamber.emit(resources.primary);
  await vi.waitFor(() => expect(resources.chamber.sent.find((message) =>
    message.type === "intercepted-fetch-response" && message.id === 1)?.status).toBe(200));
}

async function secondaryResponse(resources) {
  resources.chamber.emit({ type: "intercepted-fetch", id: 2, stage: "secondary", parent: 1,
    method: "POST", url: secondary, source: offered });
  await vi.waitFor(() => expect(resources.chamber.sent.find((message) =>
    message.type === "intercepted-fetch-response" && message.id === 2)?.status).toBe(302));
}

describe("manual chain admission", () => {
  it("requires a separately supplied bounded identity and rejects caller-supplied observer claims", () => {
    const base = { endpoint, experimentalRouting: true };
    for (const identity of [true, null, {}, { auid: "" }, { auid: "bad space" },
      { auid: owned.auid, observed: true }, { auid: owned.auid, nativeQualified: true }]) {
      expect(() => createGoogleAdsPrototype({ ...base, experimentalManualResponseChain: identity }))
        .toThrow("invalid-experimental-option");
    }
    expect(() => createGoogleAdsPrototype({
      ...base, experimentalManualResponseChain: { auid: owned.auid }, experimentalMultiDestination: true,
    })).toThrow("invalid-experimental-option");
  });
  it("limits the opted-in stage and command deadlines", () => {
    const base = { endpoint, chamber: fakeChamber(), experimentalRouting: true,
      experimentalManualResponseChain: { auid: owned.auid } };
    const construct = (options) => {
      let adapter;
      try { adapter = createGoogleAdsPrototype({ ...base, ...options }); }
      finally { void adapter?.dispose(); }
    };
    expect(() => construct({ transportTimeoutMs: 1501 })).toThrow("invalid-prototype-bounds");
    expect(() => construct({ commandTimeoutMs: 5001 })).toThrow("invalid-prototype-bounds");
    expect(() => construct({ initTimeoutMs: 2001 })).toThrow("invalid-prototype-bounds");
  });
});

describe("manual chain host correlation", () => {
  it("uses structural admission rather than duplicating the trusted mapper's query semantics", async () => {
    const resources = await setup();
    try {
      const request = { ...resources.primary, url: resources.primary.url.replace("value=1", "value=2") };
      resources.chamber.emit(request);
      await vi.waitFor(() => expect(resources.fetchImpl).toHaveBeenCalledTimes(1));
      expect(resources.fetchImpl.mock.calls[0][0]).toBe(request.url);
      resources.chamber.emit({ type: "fatal", message: "invalid-chain-response" });
      const state = await resources.adapter.flush();
      expect(state).toMatchObject({ phase: "terminal", terminalReason: "invalid-chain-response", host: { actualCalls: 1 } });
    } finally { await resources.adapter.dispose(); }
  });

  it.each(["starting", "ready"])("rejects an unsolicited request while %s and cleans up", async (phase) => {
    const chamber = fakeChamber();
    const fetchImpl = vi.fn();
    const adapter = createGoogleAdsPrototype({
      endpoint, chamber, fetchImpl, consent: { ad_storage: "granted" }, experimentalRouting: true,
      experimentalManualResponseChain: { auid: owned.auid }, transportTimeoutMs: 500, commandTimeoutMs: 1200,
    });
    try {
      if (phase === "ready") await vi.waitFor(() => expect(adapter.getState().phase).toBe("ready"));
      else expect(adapter.getState().phase).toBe("starting");
      expect(() => chamber.emit({ type: "intercepted-fetch", id: 1, stage: "primary", parent: 0,
        method: "GET", url: `${endpoint}?label=test` })).not.toThrow();
      expect(adapter.getState()).toMatchObject({ phase: "terminal", terminalReason: "request-correlation-failed",
        host: { actualCalls: 0, dispatchAttempts: 0 } });
      await adapter.dispose();
      expect(adapter.getState().manualCleanup).toEqual({ capabilityPending: 0, hostDrivesPending: 0,
        hostResponsesPending: 0, controllers: 0, hostListeners: 0 });
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
  });

  it.each([
    ["skipped id", (message) => { message.id = 2; }],
    ["wrong stage", (message) => { message.stage = "final"; }],
    ["foreign parent", (message) => { message.parent = 99; }],
    ["wrong method", (message) => { message.method = "POST"; }],
    ["foreign port", (message) => { message.url = message.url.replace(":41234/", ":41235/"); }],
    ["foreign path", (message) => { message.url = message.url.replace("/conversion/", "/other/"); }],
    ["extra envelope", (message) => { message.headers = {}; }],
  ])("holds a %s primary before any actual call", async (_name, mutate) => {
    const resources = await setup();
    try {
      const request = { ...resources.primary };
      mutate(request);
      resources.chamber.emit(request);
      const state = await resources.adapter.flush();
      expect(state).toMatchObject({ phase: "terminal", terminalReason: "request-correlation-failed",
        host: { actualCalls: 0, dispatchAttempts: 0 } });
      expect(resources.fetchImpl).not.toHaveBeenCalled();
    } finally { await resources.adapter.dispose(); }
  });

  it.each([
    ["duplicate request id", (message) => { message.id = 1; }],
    ["skipped request id", (message) => { message.id = 3; }],
    ["foreign parent", (message) => { message.parent = 42; }],
    ["dropped secondary", (message) => { message.stage = "final"; message.method = "GET"; message.url = final; message.source = location; }],
    ["reordered stage", (message) => { message.stage = "primary"; }],
    ["wrong method", (message) => { message.method = "GET"; }],
    ["unoffered source", (message) => { message.source += "&unexpected=1"; message.url += "&unexpected=1"; }],
    ["different actual URL", (message) => { message.url += "&unexpected=1"; }],
    ["foreign local origin", (message) => { message.url = message.url.replace(":41234/", ":41235/"); }],
  ])("rejects %s after the real first response", async (_name, mutate) => {
    const resources = await setup();
    try {
      await primaryResponse(resources);
      const request = { type: "intercepted-fetch", id: 2, stage: "secondary", parent: 1,
        method: "POST", url: secondary, source: offered };
      mutate(request);
      resources.chamber.emit(request);
      const state = await resources.adapter.flush();
      expect(state).toMatchObject({ phase: "terminal", terminalReason: "request-correlation-failed", host: { actualCalls: 1 } });
      expect(resources.fetchImpl).toHaveBeenCalledTimes(1);
    } finally { await resources.adapter.dispose(); }
  });

  it.each([
    ["wrong parent", (message) => { message.parent = 1; }],
    ["wrong Location", (message) => { message.source += "&other=1"; message.url += "&other=1"; }],
    ["duplicate id", (message) => { message.id = 2; }],
    ["wrong method", (message) => { message.method = "POST"; }],
  ])("rejects final request with %s", async (_name, mutate) => {
    const resources = await setup();
    try {
      await primaryResponse(resources);
      await secondaryResponse(resources);
      const request = { type: "intercepted-fetch", id: 3, stage: "final", parent: 2,
        method: "GET", url: final, source: location };
      mutate(request);
      resources.chamber.emit(request);
      const state = await resources.adapter.flush();
      expect(state).toMatchObject({ phase: "terminal", terminalReason: "request-correlation-failed", host: { actualCalls: 2 } });
      expect(resources.fetchImpl).toHaveBeenCalledTimes(2);
    } finally { await resources.adapter.dispose(); }
  });

  it("rejects a forged success while the final capability is still pending and drains it", async () => {
    let calls = 0, aborted = false;
    const resources = await setup(async (_url, options) => {
      calls += 1;
      if (calls === 1) return new Response(fixture.entries[0].response.body, { headers: { "content-type": "application/json" } });
      if (calls === 2) return new Response("", { status: 302, headers: { location } });
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); }, { once: true });
      });
    });
    try {
      await primaryResponse(resources);
      await secondaryResponse(resources);
      resources.chamber.emit({ type: "intercepted-fetch", id: 3, stage: "final", parent: 2,
        method: "GET", url: final, source: location });
      await vi.waitFor(() => expect(calls).toBe(3));
      resources.chamber.emit({ type: "result", summary: { seq: 2, disposition: "transport-settled", requests: 3, status: 200 }, ready: [] });
      const state = await resources.adapter.flush();
      expect(state).toMatchObject({ terminalReason: "result-transport-mismatch", host: { actualCalls: 3 } });
      await resources.adapter.dispose();
      expect(aborted).toBe(true);
    } finally { await resources.adapter.dispose(); }
  });

  it.each([
    ["primary 200 reported as complete", 1, { disposition: "transport-settled", requests: 1, status: 200 }],
    ["secondary 302 reported as the only failed request", 2, { disposition: "failed", requests: 1, status: 302 }],
  ])("rejects %s with the actual attempt count", async (_name, calls, summary) => {
    const resources = await setup();
    try {
      await primaryResponse(resources);
      if (calls === 2) await secondaryResponse(resources);
      resources.chamber.emit({ type: "result", summary: { seq: 2, ...summary }, ready: [] });
      const state = await resources.adapter.flush();
      expect(state).toMatchObject({ phase: "terminal", terminalReason: "result-transport-mismatch",
        host: { actualCalls: calls, dispatchAttempts: calls },
        outcomes: [{ seq: 1, disposition: "configured" },
          { seq: 2, disposition: "rejected", reason: "result-transport-mismatch" }] });
      expect(state.outcomes.at(-1).chain).toHaveLength(calls);
      expect(resources.fetchImpl).toHaveBeenCalledTimes(calls);
    } finally { await resources.adapter.dispose(); }
  });

  it.each([
    ["forged held disposition", 1, { disposition: "held", requests: 1, status: 0, reason: "held-at-seal" }, "result-transport-mismatch"],
    ["invalid two-stage count", 2, { disposition: "failed", requests: 2, status: 302 }, "invalid-worker-result"],
    ["completed ledger reported as one", 3, { disposition: "held", requests: 1, status: 0, reason: "held-at-seal" }, "result-transport-mismatch"],
    ["completed ledger with contradictory disposition", 3, { disposition: "failed", requests: 3, status: 200 }, "result-transport-mismatch"],
    ["completed ledger with branches", 3, { disposition: "transport-settled", requests: 3, status: 200, branches: [] }, "result-transport-mismatch"],
  ])("rejects %s", async (_name, calls, summary, reason) => {
    const resources = await setup();
    try {
      await primaryResponse(resources);
      if (calls >= 2) await secondaryResponse(resources);
      if (calls === 3) {
        resources.chamber.emit({ type: "intercepted-fetch", id: 3, stage: "final", parent: 2,
          method: "GET", url: final, source: location });
        await vi.waitFor(() => expect(resources.chamber.sent.find((message) =>
          message.type === "intercepted-fetch-response" && message.id === 3)?.status).toBe(200));
      }
      resources.chamber.emit({ type: "result", summary: { seq: 2, ...summary }, ready: [] });
      const state = await resources.adapter.flush();
      expect(state).toMatchObject({ phase: "terminal", terminalReason: reason,
        host: { actualCalls: calls, dispatchAttempts: calls } });
      expect(state.outcomes.at(-1)).toMatchObject({ disposition: "rejected", reason });
      expect(state.outcomes.at(-1).chain).toHaveLength(calls);
      expect(resources.fetchImpl).toHaveBeenCalledTimes(calls);
    } finally { await resources.adapter.dispose(); }
  });
});
