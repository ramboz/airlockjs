import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber, runGoogleAdsConversionPrototypeExample } from "../rig/google-ads-conversion-prototype.mjs";

async function within(promise, ms = 2000) {
  let timer;
  try {
    return await Promise.race([
      promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("test-deadline")), ms); }),
    ]);
  } finally { clearTimeout(timer); }
}

async function withLocal({ respond, ...options }, check) {
  let receiver, chamber, adapter, cause;
  try {
    receiver = await createConversionReceiver({ respond });
    chamber = createNodeConversionChamber();
    adapter = createGoogleAdsPrototype({
      endpoint: receiver.endpoint, chamber,
      captureContext: () => ({ pageURL: "https://example.test/offline-controls", referrer: "" }),
      consent: { ad_storage: "granted" }, ...options,
    });
    await within(check({ adapter, chamber, receiver }));
  } catch (error) { cause = error; throw error; }
  finally { await closeConversionResources({ adapter, chamber, receiver, cause }); }
}
const conversion = { send_to: "AW-0000000000/SYNTHETIC_LABEL", value: 54.25, currency: "EUR", transaction_id: "controls-new-54" };

describe("actual first-party Node worker and independently observed loopback", () => {
  it("runs the bounded example with zero-send config/consent controls and two independently received conversions", async () => {
    const example = await runGoogleAdsConversionPrototypeExample();
    expect(example).toMatchObject({
      overall: "INCONCLUSIVE", fullCompatibility: false,
      localJourney: {
        initArrivals: 0, configArrivals: 0, pendingArrivals: 0, deniedArrivals: 0,
        grantWithoutNewCommandArrivals: 0, actualArrivals: 2, settledConversionCommands: 2,
        hostDispatchAttempts: 2, distinctTransactions: 2, distinctPages: 2,
      },
      workerProbe: { ambientFetchDenied: true, qualification: "first-party-Node-only" },
      cleanup: { chamberClosed: true, receiverClosed: true, openSockets: 0 },
    });
    expect(example.comparison.local.every((row) => row.relationshipsPreserved)).toBe(true);
    expect(example.comparison.nativeShape.rowCount).toBe(12);
    expect(example.comparison.nativeShape.uniqueFieldCount).toBe(62);
  }, 10000);

  it("queues config and two mutated-input conversions with genuine serialized value/context snapshots", async () => {
    let receiver, chamber, adapter;
    try {
      receiver = await createConversionReceiver();
      chamber = createNodeConversionChamber();
      const context = { pageURL: "https://example.test/offline-first", referrer: "" };
      const params = { send_to: "AW-0000000000/SYNTHETIC_LABEL", value: 17.75, currency: "CAD", transaction_id: "offline-first-17" };
      adapter = createGoogleAdsPrototype({ endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: "granted" } });
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", params);
      Object.assign(params, { value: 42.25, currency: "EUR", transaction_id: "offline-second-42" });
      context.pageURL = "https://example.test/offline-second#context";
      adapter.gtag("event", "conversion", params);
      Object.assign(params, { value: 999, transaction_id: "never-captured" });
      context.pageURL = "https://example.test/never-captured";
      const state = await within(adapter.flush());
      expect(state.outcomes.map((entry) => entry.disposition)).toEqual(["configured", "transport-settled", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(2);
      expect(receiver.arrivals.map(({ method, url }) => {
        const parsed = new URL(url);
        expect(parsed.pathname).toBe("/pagead/conversion/0000000000/");
        expect(method).toBe("GET");
        expect([...parsed.searchParams.keys()]).toEqual(["label", "value", "currency_code", "oid", "url"]);
        return [...parsed.searchParams.values()];
      })).toEqual([
        ["SYNTHETIC_LABEL", "17.75", "CAD", "offline-first-17", "https://example.test/offline-first"],
        ["SYNTHETIC_LABEL", "42.25", "EUR", "offline-second-42", "https://example.test/offline-second#context"],
      ]);
      expect(state.host.dispatchAttempts).toBe(2);
      expect(state.receipt).toBe("not-observed-by-adapter");
      const probe = await within(chamber.probe);
      expect(probe.threadId).toBeGreaterThan(0);
      expect(probe.ambientFetchDenied).toBe(true);
      expect(JSON.stringify(state)).not.toContain("offline-first-17");
    } finally {
      await closeConversionResources({ adapter, chamber, receiver });
      expect(chamber?.getState()).toEqual({ closing: true, closed: true });
      expect(receiver?.getState()).toEqual({ listening: false, openSockets: 0 });
    }
  }, 8000);

  it("rejects unsupported/preconfig/duplicate/wrong-route/type/callback calls before any arrival, then admits a valid call", async () => {
    await withLocal({}, async ({ adapter, receiver }) => {
      const callback = vi.fn();
      adapter.gtag("event", "conversion", conversion);
      adapter.gtag("config", "AW-123");
      adapter.gtag("config", "AW-0000000000", {});
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", { ...conversion, send_to: "AW-0000000000/WRONG" });
      adapter.gtag("event", "conversion", { ...conversion, value: NaN });
      adapter.gtag("event", "conversion", { ...conversion, value: "54.25" });
      adapter.gtag("event", "conversion", { ...conversion, currency: 54 });
      adapter.gtag("event", "conversion", { ...conversion, transaction_id: false });
      adapter.gtag("event", "conversion", { ...conversion, event_callback: callback });
      adapter.gtag("consent", "update", { ad_storage: "granted" });
      const state = await adapter.flush();
      expect(state.outcomes.map((entry) => entry.reason || entry.disposition)).toEqual([
        "conversion-before-config", "synthetic-destination-required", "unsupported-config", "configured", "duplicate-config",
        "synthetic-selector-required", "unsupported-value", "unsupported-value", "unsupported-currency", "unsupported-transaction",
        "unsupported-parameters", "unsupported-parameters",
      ]);
      expect(callback).not.toHaveBeenCalled();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "conversion", conversion);
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("observes zero/empty fields separately from omission and explicit undefined at the actual receiver", async () => {
    await withLocal({}, async ({ adapter, receiver }) => {
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", { send_to: conversion.send_to, value: 0, currency: "", transaction_id: "" });
      adapter.gtag("event", "conversion", { send_to: conversion.send_to });
      adapter.gtag("event", "conversion", { send_to: conversion.send_to, value: undefined, currency: undefined, transaction_id: undefined });
      const state = await adapter.flush();
      expect(state.outcomes.filter((entry) => entry.disposition === "transport-settled")).toHaveLength(3);
      expect(receiver.arrivals).toHaveLength(3);
      expect(receiver.arrivals.map(({ url }) => [...new URL(url).searchParams])).toEqual([
        [["label", "SYNTHETIC_LABEL"], ["value", "0"], ["currency_code", ""], ["oid", ""], ["url", "https://example.test/offline-controls"]],
        [["label", "SYNTHETIC_LABEL"], ["url", "https://example.test/offline-controls"]],
        [["label", "SYNTHETIC_LABEL"], ["url", "https://example.test/offline-controls"]],
      ]);
    });
  }, 8000);

  it.each([
    ["currency", "unsupported-currency"],
    ["transaction_id", "unsupported-transaction"],
    ["pageURL", "invalid-context"],
  ])("rejects ill-formed %s without a lossy arrival, then admits a valid conversion", async (field, reason) => {
    const context = { pageURL: "https://example.test/unicode-input", referrer: "" };
    await withLocal({ captureContext: () => context }, async ({ adapter, receiver }) => {
      const invalid = { ...conversion };
      if (field === "pageURL") context.pageURL = "https://example.test/\ud800";
      else invalid[field] = "\ud800";
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", invalid);
      const state = await adapter.flush();
      expect(state.phase).toBe("ready");
      expect(state.outcomes.at(-1)).toMatchObject({ disposition: "rejected", reason });
      expect(receiver.arrivals).toEqual([]);
      context.pageURL = "https://example.test/unicode-input";
      adapter.gtag("event", "conversion", conversion);
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("rejects an oversized encoded page inside the worker and still dispatches the following valid conversion", async () => {
    const context = { pageURL: `https://example.test/${"\u754c".repeat(1300)}`, referrer: "" };
    await withLocal({ captureContext: () => context }, async ({ adapter, receiver }) => {
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", conversion);
      context.pageURL = "https://example.test/after-oversized";
      adapter.gtag("event", "conversion", { ...conversion, transaction_id: "valid-after-oversized" });
      const state = await adapter.flush();
      expect(state.phase).toBe("ready");
      expect(state.outcomes.map((entry) => entry.reason || entry.disposition)).toEqual([
        "configured", "encoded-context-limit", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(1);
      expect(new URL(receiver.arrivals[0].url).searchParams.get("oid")).toBe("valid-after-oversized");
    });
  }, 8000);

  it("preserves well-formed non-ASCII values through actual worker encoding and receiver decoding", async () => {
    const context = Object.assign(Object.create(null), {
      pageURL: "https://example.test/\u8def\u5f84", referrer: "",
    });
    const params = Object.assign(Object.create(null), {
      ...conversion, transaction_id: "synthetic-\u8ba2\u5355-\u00e9",
    });
    await withLocal({ captureContext: () => context }, async ({ adapter, receiver }) => {
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", params);
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
      const query = new URL(receiver.arrivals[0].url).searchParams;
      expect(query.get("oid")).toBe(params.transaction_id);
      expect(query.get("url")).toBe(context.pageURL);
      expect(query.get("value")).toBe(String(params.value));
    });
  }, 8000);

  it("withholds the real receiver response and observes a command-result barrier, not a dispatch counter receipt", async () => {
    let arrived, release;
    const arrival = new Promise((resolve) => { arrived = resolve; });
    await withLocal({ respond(_request, response) { release = () => response.writeHead(204).end(); arrived(); } }, async ({ adapter, chamber, receiver }) => {
      const results = [];
      const unsubscribe = chamber.onMessage((message) => { if (message.type === "result") results.push(message.summary.seq); });
      try {
        adapter.gtag("config", "AW-0000000000");
        adapter.gtag("event", "conversion", conversion);
        let done = false;
        const flushed = adapter.flush().then((state) => { done = true; return state; });
        await arrival;
        expect(receiver.arrivals).toHaveLength(1);
        expect(adapter.getState()).toMatchObject({ inFlight: true, host: { dispatchAttempts: 1 }, receipt: "not-observed-by-adapter" });
        expect(done).toBe(false);
        expect(results).toEqual([1]);
        release();
        expect((await flushed).outcomes.at(-1).disposition).toBe("transport-settled");
        expect(results).toEqual([1, 2]);
      } finally { unsubscribe(); }
    });
  }, 8000);

  it("does not execute a returned poison script or follow returned body/header URLs", async () => {
    await withLocal({
      respond(_request, response) {
        const followup = `http://127.0.0.1:${response.socket.localPort}/not-allowed/`;
        response.writeHead(200, { "content-type": "application/javascript", location: followup })
          .end(`throw new Error("poison-script-executed"); fetch(${JSON.stringify(followup)});`);
      },
    }, async ({ adapter, receiver }) => {
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", conversion);
      const state = await adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({ disposition: "transport-settled", status: 200 });
      expect(state.phase).toBe("ready");
      expect(receiver.arrivals).toHaveLength(1);
      expect(new URL(receiver.arrivals[0].url).pathname).toBe("/pagead/conversion/0000000000/");
      expect(JSON.stringify(state)).not.toContain("poison-script");
    });
  }, 8000);

  it("makes a stalled response and queued second conversion terminal on timeout, with one arrival only", async () => {
    await withLocal({ respond() {}, transportTimeoutMs: 50, commandTimeoutMs: 1000 }, async ({ adapter, receiver }) => {
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", conversion);
      adapter.gtag("event", "conversion", { ...conversion, transaction_id: "must-not-send-next" });
      const state = await adapter.flush();
      expect(state.phase).toBe("terminal");
      expect(["transport-timeout", "transport-failed"]).toContain(state.terminalReason);
      expect(state.outcomes.some((entry) => entry.disposition === "transport-settled")).toBe(false);
      expect(state.queued).toBe(0);
      expect(receiver.arrivals).toHaveLength(1);
      adapter.setConsent({ ad_storage: "granted" });
      adapter.gtag("event", "conversion", conversion);
      expect(adapter.getState().outcomes.at(-1).reason).toBe("terminal");
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it.each([302, 503])("does not follow a local %i or report HTTP failure as successful transport", async (status) => {
    await withLocal({ respond(_request, response) { response.writeHead(status, { location: "/not-allowed/" }).end(); } }, async ({ adapter, receiver }) => {
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", conversion);
      expect((await adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "failed", status: status === 302 ? 0 : 503 });
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("surfaces aggregate cleanup faults, retains the original cause and still closes a real receiver/socket", async () => {
    const receiver = await createConversionReceiver();
    const chamber = createNodeConversionChamber();
    const adapter = createGoogleAdsPrototype({
      endpoint: receiver.endpoint, chamber,
      captureContext: () => ({ pageURL: "https://example.test/cleanup", referrer: "" }),
      consent: { ad_storage: "granted" },
    });
    try {
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", conversion);
      await within(adapter.flush());
      const cause = new Error("original-journey-failure");
      const failure = await closeConversionResources({
        adapter: { async dispose() { await adapter.dispose(); throw new Error("private-adapter"); } },
        chamber: { async dispose() { await chamber.dispose(); throw new Error("private-chamber"); } },
        receiver, cause,
      }).catch((error) => error);
      expect(failure).toBeInstanceOf(AggregateError);
      expect(failure.message).toBe("prototype-cleanup-failed");
      expect(failure.errors.map((error) => error.message)).toEqual(["adapter-cleanup-failed", "chamber-cleanup-failed"]);
      expect(failure.cause).toBe(cause);
      expect(receiver.getState()).toEqual({ listening: false, openSockets: 0 });
      expect(chamber.getState()).toEqual({ closing: true, closed: true });
    } finally { await closeConversionResources({ adapter, chamber, receiver }); }
  }, 8000);
});
