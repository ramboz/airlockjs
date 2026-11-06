import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { closeConversionResources, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";
import { createManualChainReceiver } from "../rig/google-manual-worker-chain.mjs";

const fixture = JSON.parse(readFileSync(new URL("../rig/fixtures/google-manual-conversion.json", import.meta.url), "utf8"));
const fresh = () => structuredClone(fixture);
const payload = (entries) => JSON.parse(entries[0].response.body.slice(21, -2));
const frame = (value) => `event: message\ndata: ${JSON.stringify(value)}\n\n`;
const mutateUrl = (raw, change) => {
  const url = new URL(raw);
  change(url.searchParams);
  return url.href;
};

function runMutatedPrimaryCli(key, value, defeatComparison = false) {
  const mock = `
    import { isMainThread } from "node:worker_threads";
    if (isMainThread) {
      const original = globalThis.fetch;
      globalThis.fetch = (input, options) => {
        const url = new URL(input);
        if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") throw new Error("non-loopback");
        if (/^\\/pagead\\/conversion\\/\\d+\\/$/.test(url.pathname)) {
          url.searchParams.set(${JSON.stringify(key)}, ${JSON.stringify(value)});
        }
        return original(url.href, options);
      };
    }
  `;
  const loader = `
    export async function load(url, context, nextLoad) {
      const result = await nextLoad(url, context);
      if (!url.endsWith("/rig/google-manual-worker-chain.mjs")) return result;
      const source = result.source.toString();
      const needle = "primary.searchParams.toString() !== expected.toString()";
      if (source.indexOf(needle) < 0 || source.indexOf(needle) !== source.lastIndexOf(needle)) {
        throw new Error("comparison-not-unique");
      }
      return { ...result, source: source.replace(needle, "false"), shortCircuit: true };
    }
  `;
  return spawnSync(process.execPath, [
    ...(defeatComparison ? ["--experimental-loader", `data:text/javascript,${encodeURIComponent(loader)}`] : []),
    "--import", `data:text/javascript,${encodeURIComponent(mock)}`, "rig/google-manual-worker-chain.mjs",
  ], { encoding: "utf8", timeout: 10000 });
}

async function setup({ input = fresh(), respond, consent = "granted", options = {} } = {}) {
  const owned = input.owned;
  const receiver = await createManualChainReceiver({ conversionId: owned.conversion_id.slice(3), entries: input.entries, respond });
  const chamber = createNodeConversionChamber();
  const context = { pageURL: owned.document_url, referrer: "" };
  const params = { send_to: `${owned.conversion_id}/${owned.conversion_label}`, value: owned.value,
    currency: owned.currency, transaction_id: owned.transaction_id };
  const adapter = createGoogleAdsPrototype({
    endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: consent },
    experimentalRouting: true, experimentalManualResponseChain: { auid: owned.auid },
    commandTimeoutMs: 1800, transportTimeoutMs: 700, ...options,
  });
  const probe = await chamber.probe;
  expect(probe).toMatchObject({ ambientFetchDenied: true });
  expect(probe.threadId).toBeGreaterThan(0);
  adapter.gtag("config", owned.conversion_id);
  expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("configured");
  return { adapter, chamber, receiver, params, context };
}

async function close(resources) {
  await closeConversionResources(resources);
  expect(resources.chamber.getState().closed).toBe(true);
  expect(resources.receiver.getState()).toEqual({ listening: false, openSockets: 0 });
  expect(resources.adapter.getState().manualCleanup).toEqual({
    capabilityPending: 0, hostDrivesPending: 0, hostResponsesPending: 0, controllers: 0, hostListeners: 0,
  });
}

describe("Google manual worker response chain", () => {
  it.each([
    ["label", "label", "different"],
    ["value", "value", "2"],
    ["currency", "currency_code", "EUR"],
    ["transaction", "oid", "different"],
    ["page", "url", "https://other.example.test/"],
  ])("rejects a changed primary %s in the fixed CLI after all three local calls", (_name, key, value) => {
    const result = runMutatedPrimaryCli(key, value);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      localExperiment: "failed", reason: "local-check-failed",
      host: { actualCalls: 3, dispatchAttempts: 3 }, receiver: { count: 3 },
      cleanup: { verified: true, chamberClosed: true, receiverClosed: true, openSockets: 0 },
    });
    const defeated = runMutatedPrimaryCli(key, value, true);
    expect(defeated.status).toBe(0);
    const output = JSON.parse(defeated.stdout);
    expect(output.localExperiment).toBeUndefined();
    expect(output).toMatchObject({
      host: { actualCalls: 3, dispatchAttempts: 3 }, receiver: { count: 3 },
      cleanup: { verified: true, chamberClosed: true, receiverClosed: true, openSockets: 0 },
    });
  });

  it("observes a three-stage loopback chain and cleans up its real worker", async () => {
    const { runGoogleManualWorkerChain } = await import("../rig/google-manual-worker-chain.mjs");
    const result = await runGoogleManualWorkerChain();
    expect(result).toMatchObject({
      overall: "INCONCLUSIVE",
      worker: { firstPartyNode: true, ambientFetchDenied: true },
      host: { actualCalls: 3 },
      receiver: { methods: ["GET", "POST", "GET"], count: 3 },
      responseChain: { settled: true, fallback: "offered-not-executed" },
      cleanup: { chamberClosed: true, receiverClosed: true, openSockets: 0 },
      claims: { nativeQualified: false, fullReference: false, browser: false, chamberConversion: false, productReceipt: false },
    });
    const text = JSON.stringify(result);
    for (const value of Object.values(fixture.owned).filter((entry) => typeof entry === "string")) expect(text).not.toContain(value);
    expect(text).not.toContain("://");
    const unsupported = spawnSync(process.execPath, ["rig/google-manual-worker-chain.mjs", "--live"], { encoding: "utf8" });
    expect(unsupported.status).toBe(2);
    expect(unsupported.stderr.trim()).toBe("unsupported-options");
    expect(unsupported.stdout).toBe("");
  });

  it("reports partial observed work and verified cleanup when the local document fails", () => {
    const script = `
      import fs from "node:fs";
      import { syncBuiltinESMExports } from "node:module";
      const read = fs.promises.readFile;
      fs.promises.readFile = async (...args) => {
        const source = await read(...args);
        if (!String(args[0]).endsWith("/fixtures/google-manual-conversion.json")) return source;
        const fixture = JSON.parse(source);
        fixture.entries[0].response.body = "event: other\\ndata: {}\\n\\n";
        return JSON.stringify(fixture);
      };
      syncBuiltinESMExports();
    `;
    const result = spawnSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(script)}`,
      "rig/google-manual-worker-chain.mjs"], { encoding: "utf8", timeout: 10000 });
    expect(result.status).toBe(1);
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({
      overall: "INCONCLUSIVE", localExperiment: "failed", reason: "invalid-frame",
      host: { actualCalls: 1 }, receiver: { count: 1, methods: ["GET"] },
      responseChain: { settled: false }, cleanup: { verified: true, chamberClosed: true, receiverClosed: true, openSockets: 0 },
      claims: { nativeQualified: false, productReceipt: false },
    });
    expect(result.stdout).not.toContain("://");
  });

    it.each([
      ["label", "label", "other"],
      ["value", "value", "2"],
      ["currency", "currency_code", "EUR"],
      ["page", "url", "https://other.example.test/"],
      ["auid", "auid", "999.1"],
    ])("rejects independently changed %s in both otherwise linked offered URLs", async (_name, key, value) => {
      const input = fresh(), data = payload(input.entries);
      data.fetch[0] = mutateUrl(data.fetch[0], (query) => query.set(key, value));
      data.options.fallback_url = mutateUrl(data.options.fallback_url, (query) => query.set(key, value));
      input.entries[0].response.body = frame(data);
      const resources = await setup({ input });
      try {
        resources.adapter.gtag("event", "conversion", resources.params);
        const state = await resources.adapter.flush();
        expect(state).toMatchObject({ phase: "terminal", terminalReason: "invalid-ownership", host: { actualCalls: 1 } });
        expect(resources.receiver.arrivals.map(({ method }) => method)).toEqual(["GET"]);
      } finally { await close(resources); }
    });

    it("rejects invalid UTF-8 before the wrapped host normalizes the response", async () => {
      const fetchImpl = vi.fn(async () => new Response(Uint8Array.from([0xff]), {
        status: 200, headers: { "content-type": "application/json" },
      }));
      const resources = await setup({ options: { fetchImpl } });
      try {
        resources.adapter.gtag("event", "conversion", resources.params);
        const state = await resources.adapter.flush();
        expect(state).toMatchObject({ terminalReason: "invalid-utf8", host: { actualCalls: 1 } });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
      } finally { await close(resources); }
    });

    it.each([
      ["foreign fetch", (data) => { data.fetch[0] = data.fetch[0].replace("googleads.g.doubleclick.net", "foreign.example.test"); }, "invalid-url"],
      ["foreign fallback", (data) => { data.options.fallback_url = data.options.fallback_url.replace("www.google.com", "foreign.example.test"); }, "invalid-url"],
      ["fallback parent", (data) => { data.options.fallback_url = mutateUrl(data.options.fallback_url, (query) => query.set("cv", "different")); }, "invalid-parent"],
      ["invented secondary oid", (data) => {
        data.fetch[0] = mutateUrl(data.fetch[0], (query) => query.append("oid", fixture.owned.transaction_id));
        const fallback = new URL(data.options.fallback_url);
        const gcp = fallback.searchParams.get("gcp");
        fallback.search = new URL(data.fetch[0]).search;
        fallback.searchParams.append("gcp", gcp);
        data.options.fallback_url = fallback.href;
      }, "invalid-parent"],
    ])("rejects %s without a secondary request", async (_name, change, reason) => {
      const input = fresh(), data = payload(input.entries);
      change(data);
      input.entries[0].response.body = frame(data);
      const resources = await setup({ input });
      try {
        resources.adapter.gtag("event", "conversion", resources.params);
        const state = await resources.adapter.flush();
        expect(state).toMatchObject({ phase: "terminal", terminalReason: reason, host: { actualCalls: 1 } });
        expect(resources.receiver.arrivals).toHaveLength(1);
      } finally { await close(resources); }
    });

    it.each([
      ["foreign location", (query, location) => location.replace("www.google.com", "foreign.example.test"), "invalid-url"],
      ["broken prefix", (query, location) => mutateUrl(location, (p) => p.set("cv", "different")), "invalid-parent"],
      ["duplicate ownership", (query, location) => mutateUrl(location, (p) => p.append("label", fixture.owned.conversion_label)), "invalid-ownership"],
      ["reused random", (query, location) => mutateUrl(location, (p) => {
        const pairs = [...p.entries()];
        pairs[pairs.length - 1][1] = p.get("random");
        for (const key of new Set(p.keys())) p.delete(key);
        for (const [key, value] of pairs) p.append(key, value);
      }), "invalid-parent"],
    ])("rejects %s from the actual secondary response", async (_name, change, reason) => {
      const input = fresh();
      const location = input.entries[1].response.headers.find(([name]) => name === "location");
      location[1] = change(new URL(location[1]).searchParams, location[1]);
      const resources = await setup({ input });
      try {
        resources.adapter.gtag("event", "conversion", resources.params);
        const state = await resources.adapter.flush();
        expect(state).toMatchObject({ phase: "terminal", terminalReason: reason, host: { actualCalls: 2 } });
        expect(resources.receiver.arrivals.map(({ method }) => method)).toEqual(["GET", "POST"]);
      } finally { await close(resources); }
    });

    it.each([
      ["malformed frame", () => "event: other\ndata: {}\n\n", "invalid-frame"],
      ["byte order mark", (data) => `\ufeff${frame(data)}`, "invalid-frame"],
      ["duplicate decoded name", (data) => `event: message\ndata: {"fetch":${JSON.stringify(data.fetch)},"fet\\u0063h":${JSON.stringify(data.fetch)},"options":${JSON.stringify(data.options)}}\n\n`, "duplicate-json"],
      ["structure depth", (data) => {
        let nested = 0;
        for (let index = 0; index < 17; index += 1) nested = [nested];
        data.probe = nested;
        return frame(data);
      }, "structure-limit"],
      ["structure nodes", (data) => { data.probe = Array(1030).fill(0); return frame(data); }, "structure-limit"],
      ["over budget", () => "x".repeat(4097), "response-too-large"],
    ])("rejects a %s from the local response", async (_name, change, reason) => {
      const input = fresh(), data = payload(input.entries);
      input.entries[0].response.body = change(data);
      const resources = await setup({ input });
      try {
        resources.adapter.gtag("event", "conversion", resources.params);
        const state = await resources.adapter.flush();
        expect(state).toMatchObject({ phase: "terminal", terminalReason: reason, host: { actualCalls: 1 } });
        expect(resources.receiver.arrivals).toHaveLength(1);
      } finally { await close(resources); }
    });

    it("rejects duplicated Location headers without issuing a final request", async () => {
      const location = fixture.entries[1].response.headers.find(([name]) => name === "location")[1];
      const resources = await setup({ respond({ index, response, document, responses }) {
        if (index === 1) {
          response.writeHead(302, ["Location", location, "Location", location]);
          response.end("", () => responses.push({ stage: index, status: 302 }));
        } else {
          response.writeHead(document.status, document.headers);
          response.end(document.body, () => responses.push({ stage: index, status: document.status }));
        }
      } });
      try {
        resources.adapter.gtag("event", "conversion", resources.params);
        const state = await resources.adapter.flush();
        expect(state).toMatchObject({ phase: "terminal", terminalReason: "invalid-url", host: { actualCalls: 2 } });
        expect(resources.receiver.arrivals.map(({ method }) => method)).toEqual(["GET", "POST"]);
      } finally { await close(resources); }
    });

    it("waits for the final response before settling", async () => {
      let release;
      const resources = await setup({ respond({ index, response, document, responses }) {
        const send = () => {
          response.writeHead(document.status, document.headers);
          response.end(document.body, () => responses.push({ stage: index, status: document.status }));
        };
        if (index === 2) release = send; else send();
      } });
      try {
        resources.adapter.gtag("event", "conversion", resources.params);
        let settled = false;
        const flush = resources.adapter.flush().then((state) => { settled = true; return state; });
        await vi.waitFor(() => expect(release).toBeTypeOf("function"));
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(settled).toBe(false);
        expect(resources.receiver.arrivals.map(({ method }) => method)).toEqual(["GET", "POST", "GET"]);
        release();
        expect((await flush).outcomes.at(-1)).toMatchObject({ disposition: "transport-settled", requests: 3 });
      } finally { await close(resources); }
    });

    it.each(["denied", "pending"])("holds %s at the seal without retry after grant", async (consent) => {
      const resources = await setup({ consent });
      try {
        resources.adapter.gtag("event", "conversion", resources.params);
        expect((await resources.adapter.flush()).outcomes.at(-1)).toMatchObject({ disposition: "held", reason: "held-at-seal" });
        resources.adapter.setConsent({ ad_storage: "granted" });
        await resources.adapter.flush();
        expect(resources.receiver.arrivals).toHaveLength(0);
        expect(resources.adapter.getState().host.actualCalls).toBe(0);
      } finally { await close(resources); }
    });

    it("does not revive a queued grant after revoke then grant during worker startup", async () => {
      const input = fresh(), owned = input.owned;
      const receiver = await createManualChainReceiver({ conversionId: owned.conversion_id.slice(3), entries: input.entries });
      const chamber = createNodeConversionChamber();
      const adapter = createGoogleAdsPrototype({
        endpoint: receiver.endpoint, chamber, consent: { ad_storage: "granted" },
        captureContext: () => ({ pageURL: owned.document_url, referrer: "" }), experimentalRouting: true,
        experimentalManualResponseChain: { auid: owned.auid }, transportTimeoutMs: 700, commandTimeoutMs: 1800,
      });
      const resources = { receiver, chamber, adapter };
      try {
        adapter.gtag("config", owned.conversion_id);
        adapter.gtag("event", "conversion", { send_to: `${owned.conversion_id}/${owned.conversion_label}`,
          value: owned.value, currency: owned.currency, transaction_id: owned.transaction_id });
        adapter.setConsent({ ad_storage: "denied" });
        adapter.setConsent({ ad_storage: "granted" });
        const state = await adapter.flush();
        expect(state.outcomes.at(-1)).toMatchObject({ disposition: "held", reason: "held-at-seal" });
        expect(state.host.actualCalls).toBe(0);
        expect(receiver.arrivals).toHaveLength(0);
      } finally { await close(resources); }
    });

    it.each([
      ["primary body unavailable", 0, "body", "response-unavailable"],
      ["primary headers unavailable", 0, "headers", "response-unavailable"],
      ["secondary body unavailable", 1, "body", "response-unavailable"],
      ["secondary Location unavailable", 1, "location", "response-unavailable"],
      ["final body unavailable", 2, "body", "response-unavailable"],
      ["final headers unavailable", 2, "headers", "response-unavailable"],
      ["primary oversize", 0, "oversize", "response-too-large"],
      ["secondary oversize", 1, "oversize", "response-too-large"],
      ["final oversize", 2, "oversize", "response-too-large"],
    ])("rejects %s before host response normalization", async (_name, faultStage, fault, reason) => {
      let index = 0;
      const fetchImpl = vi.fn(async () => {
        const current = index++;
        const responseHeaders = current === 0 ? { "content-type": "application/json" }
          : current === 1 ? { location: fixture.entries[1].response.headers.find(([name]) => name === "location")[1] }
            : { "content-type": "text/plain" };
        if (current === faultStage && fault === "location") delete responseHeaders.location;
        const body = current === faultStage && fault === "body" ? null
          : current === faultStage && fault === "oversize" ? "x".repeat(4097)
            : current === 0 ? fixture.entries[0].response.body : "";
        const response = new Response(body, { status: current === 1 ? 302 : 200, headers: responseHeaders });
        if (current === faultStage && fault === "headers") return { status: response.status, headers: null, body: response.body };
        return response;
      });
      const resources = await setup({ options: { fetchImpl } });
      try {
        resources.adapter.gtag("event", "conversion", resources.params);
        const state = await resources.adapter.flush();
        expect(state).toMatchObject({ phase: "terminal", terminalReason: reason, host: { actualCalls: faultStage + 1 } });
        expect(fetchImpl).toHaveBeenCalledTimes(faultStage + 1);
        expect(state.outcomes.at(-1).chain).toHaveLength(faultStage + 1);
        expect(resources.receiver.arrivals).toHaveLength(0);
      } finally { await close(resources); }
    });

    it.each([
      ["primary content type", 0, 200],
      ["secondary Location", 1, 302],
    ])("aborts the actual streaming response missing %s and drains owned resources", async (_name, faultStage, status) => {
      let closed = false, finished;
      const resources = await setup({ respond({ index, response, document, responses }) {
        if (index === faultStage) {
          response.on("close", () => { closed = true; finished = response.writableFinished; });
          response.writeHead(status);
          response.write("open");
        } else {
          response.writeHead(document.status, document.headers);
          response.end(document.body, () => responses.push({ stage: index, status: document.status }));
        }
      } });
      try {
        resources.adapter.gtag("event", "conversion", resources.params);
        const state = await resources.adapter.flush();
        expect(state).toMatchObject({ phase: "terminal", terminalReason: "response-unavailable",
          host: { actualCalls: faultStage + 1, dispatchAttempts: faultStage + 1 } });
        await vi.waitFor(() => expect(closed).toBe(true), { timeout: 500, interval: 20 });
        expect(finished).toBe(false);
        expect(resources.receiver.arrivals).toHaveLength(faultStage + 1);
      } finally { await close(resources); }
    });

    it("reports unresolved cancellation for a noncooperative missing-header body", async () => {
      let release, aborted = false;
      const fetchImpl = vi.fn(async (_url, options) => {
        options.signal.addEventListener("abort", () => { aborted = true; }, { once: true });
        return { status: 200, headers: new Headers(), body: {
          getReader() { throw new Error("unexpected-read"); },
          cancel() { return new Promise((resolve) => { release = resolve; }); },
        } };
      });
      const resources = await setup({ options: { fetchImpl } });
      try {
        resources.adapter.gtag("event", "conversion", resources.params);
        await vi.waitFor(() => expect(release).toBeTypeOf("function"));
        expect(aborted).toBe(true);
        await expect(resources.adapter.dispose()).rejects.toThrow("prototype-cleanup-failed");
        expect(resources.adapter.getState()).toMatchObject({ cleanupFailure: "capability-drain-timeout",
          manualCleanup: { capabilityPending: 1 } });
        release();
        await vi.waitFor(() => expect(resources.adapter.getState().manualCleanup.capabilityPending).toBe(0));
        expect(fetchImpl).toHaveBeenCalledTimes(1);
      } finally {
        release?.();
        await resources.chamber.dispose();
        await resources.receiver.close();
      }
      expect(resources.chamber.getState().closed).toBe(true);
      expect(resources.receiver.getState()).toEqual({ listening: false, openSockets: 0 });
    });

    it("reports the exact independently received ordered links and omission", async () => {
      const resources = await setup();
      try {
        resources.adapter.gtag("event", "conversion", resources.params);
        const state = await resources.adapter.flush();
        const stages = state.outcomes.at(-1).chain;
        expect(stages.map(({ stage, status }) => [stage, status])).toEqual([["primary", 200], ["secondary", 302], ["final", 200]]);
        expect(stages.map(({ parent }) => parent)).toEqual([0, stages[0].id, stages[1].id]);
        expect(resources.receiver.arrivals.map(({ method }) => method)).toEqual(["GET", "POST", "GET"]);
        const [primary, post, final] = resources.receiver.arrivals.map(({ url }) => new URL(url));
        const upstream = new URL(fixture.entries[1].request.url);
        const location = new URL(fixture.entries[1].response.headers.find(([name]) => name === "location")[1]);
        expect([...primary.searchParams]).toEqual([...new URLSearchParams({
          label: fixture.owned.conversion_label, value: String(fixture.owned.value),
          currency_code: fixture.owned.currency, oid: fixture.owned.transaction_id, url: fixture.owned.document_url,
        })]);
        expect([...post.searchParams]).toEqual([...upstream.searchParams]);
        expect([...final.searchParams]).toEqual([...location.searchParams]);
        expect(post.searchParams.has("oid")).toBe(false);
        expect(final.searchParams.has("oid")).toBe(false);
        expect(final.searchParams.getAll("random")).toHaveLength(2);
        expect(final.searchParams.getAll("random")[0]).not.toBe(final.searchParams.getAll("random")[1]);
        expect([...final.searchParams].slice(0, [...post.searchParams].length)).toEqual([...post.searchParams]);
        expect(resources.receiver.responses.map(({ status }) => status)).toEqual([200, 302, 200]);
      } finally { await close(resources); }
    });

    it.each([
      ["label", (query) => query.set("label", "different")],
      ["value", (query) => query.set("value", "2")],
      ["currency", (query) => query.set("currency_code", "EUR")],
      ["transaction", (query) => query.set("oid", "different")],
      ["page", (query) => query.set("url", "https://other.example.test/")],
      ["duplicate value", (query) => query.append("value", "1")],
    ])("the independent receiver comparison detects a changed primary %s", async (_name, mutate) => {
      let first = true;
      const fetchImpl = vi.fn((url, options) => {
        const actual = first ? mutateUrl(url, mutate) : url;
        first = false;
        return fetch(actual, options);
      });
      const resources = await setup({ options: { fetchImpl } });
      try {
        resources.adapter.gtag("event", "conversion", resources.params);
        const state = await resources.adapter.flush();
        expect(state).toMatchObject({ phase: "ready", host: { actualCalls: 3 } });
        const observed = [...new URL(resources.receiver.arrivals[0].url).searchParams];
        const expected = [...new URLSearchParams({
          label: fixture.owned.conversion_label, value: String(fixture.owned.value),
          currency_code: fixture.owned.currency, oid: fixture.owned.transaction_id, url: fixture.owned.document_url,
        })];
        expect(observed).not.toEqual(expected);
        expect(resources.receiver.arrivals).toHaveLength(3);
      } finally { await close(resources); }
    });

    it("ends a dropped real worker through the command deadline without a replacement", async () => {
      let arrived = false;
      const resources = await setup({
        options: { commandTimeoutMs: 180, transportTimeoutMs: 500 },
        respond({ index }) { if (index === 0) arrived = true; },
      });
      try {
        resources.adapter.gtag("event", "conversion", resources.params);
        const flush = resources.adapter.flush();
        await vi.waitFor(() => expect(arrived).toBe(true));
        await resources.chamber.dispose();
        const state = await flush;
        expect(state).toMatchObject({ phase: "terminal", terminalReason: "command-timeout", host: { actualCalls: 1 } });
        expect(resources.receiver.arrivals).toHaveLength(1);
      } finally { await close(resources); }
    });

      it("enforces the individual transport deadline without retry", async () => {
        let arrived = false;
        const resources = await setup({
          options: { commandTimeoutMs: 1800, transportTimeoutMs: 120 },
          respond({ index }) { if (index === 0) arrived = true; },
        });
        try {
          resources.adapter.gtag("event", "conversion", resources.params);
          const state = await resources.adapter.flush();
          expect(arrived).toBe(true);
          expect(state).toMatchObject({ phase: "terminal", terminalReason: "transport-timeout", host: { actualCalls: 1 } });
          expect(resources.receiver.arrivals).toHaveLength(1);
        } finally { await close(resources); }
      });

      it.each([1, 2])("invalidates the active lease while waiting for stage %s even after grant", async (heldStage) => {
        let arrived = false;
        const resources = await setup({
          respond({ index, response, document, responses }) {
            if (index === heldStage) { arrived = true; return; }
            response.writeHead(document.status, document.headers).end(document.body,
              () => responses.push({ stage: index, status: document.status }));
          },
        });
        try {
          resources.adapter.gtag("event", "conversion", resources.params);
          const flush = resources.adapter.flush();
          await vi.waitFor(() => expect(arrived).toBe(true));
          resources.adapter.setConsent({ ad_storage: "denied" });
          resources.adapter.setConsent({ ad_storage: "granted" });
          const state = await flush;
          expect(state).toMatchObject({ phase: "terminal", terminalReason: "consent-revoked",
            host: { actualCalls: heldStage + 1 } });
          expect(resources.receiver.arrivals).toHaveLength(heldStage + 1);
          expect(state.outcomes.at(-1).disposition).toBe("rejected");
        } finally { await close(resources); }
      });

      it("does not claim cleanup when an injected capability ignores abort", async () => {
        let release;
        const fetchImpl = vi.fn(() => new Promise((resolve) => { release = resolve; }));
        const resources = await setup({ options: { fetchImpl, transportTimeoutMs: 100 } });
        try {
          resources.adapter.gtag("event", "conversion", resources.params);
          await vi.waitFor(() => expect(release).toBeTypeOf("function"));
          await expect(resources.adapter.dispose()).rejects.toThrow("prototype-cleanup-failed");
          expect(resources.adapter.getState().cleanupFailure).toBe("capability-drain-timeout");
          expect(resources.adapter.getState().manualCleanup).toMatchObject({
            capabilityPending: 1, hostDrivesPending: 0, hostResponsesPending: 0,
          });
          release(new Response(fixture.entries[0].response.body, { headers: { "content-type": "application/json" } }));
          await vi.waitFor(() => expect(resources.adapter.getState().manualCleanup.capabilityPending).toBe(0));
          expect(resources.adapter.getState().manualCleanup.controllers).toBe(0);
          expect(fetchImpl).toHaveBeenCalledTimes(1);
          expect(resources.receiver.arrivals).toHaveLength(0);
        } finally {
          if (release) release(new Response(""));
          await resources.chamber.dispose();
          await resources.receiver.close();
        }
        expect(resources.chamber.getState().closed).toBe(true);
        expect(resources.receiver.getState()).toEqual({ listening: false, openSockets: 0 });
      });
    it.each(["revoke", "dispose", "deadline"])("drains the actual worker and pending transport after %s", async (action) => {
      let arrived = false;
      const resources = await setup({
        options: action === "deadline" ? { commandTimeoutMs: 120, transportTimeoutMs: 400 } : {},
        respond({ index, response, document, responses }) {
          if (index === 0) { arrived = true; return; }
          response.writeHead(document.status, document.headers).end(document.body,
            () => responses.push({ stage: index, status: document.status }));
        },
      });
      try {
        resources.adapter.gtag("event", "conversion", resources.params);
        const flush = resources.adapter.flush();
        await vi.waitFor(() => expect(arrived).toBe(true));
        if (action === "revoke") {
          resources.adapter.setConsent({ ad_storage: "denied" });
          resources.adapter.setConsent({ ad_storage: "granted" });
        }
        if (action === "dispose") await resources.adapter.dispose();
        const state = await flush;
        expect(state.terminalReason).toBe({ revoke: "consent-revoked", dispose: "disposed", deadline: "command-timeout" }[action]);
        expect(state.host.actualCalls).toBe(1);
        expect(resources.receiver.arrivals.map(({ method }) => method)).toEqual(["GET"]);
      } finally { await close(resources); }
  });
});
