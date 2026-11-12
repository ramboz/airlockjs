import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { closeConversionResources, createNodeConversionChamber } from "./google-ads-conversion-prototype.mjs";

async function bounded(promise, ms) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("worker-chain-deadline")), ms);
    })]);
  } finally { clearTimeout(timer); }
}

/** Synthetic local documents, not recovered native response bytes. */
export async function createManualChainReceiver({ conversionId, entries, respond } = {}) {
  if (!/^\d{1,32}$/.test(conversionId) || !Array.isArray(entries) || entries.length !== 3) {
    throw new Error("invalid-receiver-input");
  }
  const paths = ["conversion", "viewthroughconversion", "1p-conversion"]
    .map((path) => `/pagead/${path}/${conversionId}/`);
  const methods = ["GET", "POST", "GET"];
  const arrivals = [];
  const responses = [];
  const sockets = new Set();
  const server = createServer((request, response) => {
    const index = arrivals.length;
    let bodySize = 0;
    request.on("data", (chunk) => {
      bodySize += chunk.length;
      if (bodySize > 4096) request.destroy();
    });
    request.on("end", () => {
      arrivals.push({ method: request.method, url: `http://127.0.0.1:${server.address().port}${request.url}`, bodySize });
      if (index >= 3 || request.method !== methods[index] || !request.url.startsWith(`${paths[index]}?`) || bodySize) {
        response.writeHead(400).end();
        return;
      }
      const document = index === 0
        ? { status: 200, headers: { "content-type": "application/json; charset=UTF-8" }, body: entries[0].response.body }
        : index === 1
          ? { status: 302, headers: { location: entries[1].response.headers.find(([name]) => name.toLowerCase() === "location")[1] }, body: "" }
          : { status: 200, headers: { "content-type": "text/plain" }, body: "" };
      try {
        if (respond) { respond({ index, request, response, document, responses }); return; }
        response.writeHead(document.status, document.headers);
        response.end(document.body, () => responses.push({
          stage: index, status: document.status, bodyBytes: Buffer.byteLength(document.body),
        }));
      } catch { response.destroy(); }
    });
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  server.requestTimeout = 2000;
  server.headersTimeout = 2000;
  server.setTimeout(2000, (socket) => socket.destroy());
  try {
    await bounded(new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    }), 2000);
  } catch {
    server.close();
    for (const socket of sockets) socket.destroy();
    throw new Error("loopback-listen-failed");
  }
  let closing;
  return {
    endpoint: `http://127.0.0.1:${server.address().port}${paths[0]}`,
    arrivals, responses,
    getState: () => ({ listening: server.listening, openSockets: sockets.size }),
    close() {
      if (!closing) closing = (async () => {
        const closedSockets = [...sockets].map((socket) => new Promise((resolve) => socket.once("close", resolve)));
        const closedServer = new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        for (const socket of sockets) socket.destroy();
        await Promise.all([closedServer, ...closedSockets]);
      })();
      return closing;
    },
  };
}

export async function runGoogleManualWorkerChain() {
  const fixture = JSON.parse(await readFile(new URL("./fixtures/google-manual-conversion.json", import.meta.url), "utf8"));
  const owned = fixture.owned;
  let receiver, chamber, adapter, failure, cleanupFailure, partial, output;
  try {
    receiver = await createManualChainReceiver({ conversionId: owned.conversion_id.slice(3), entries: fixture.entries });
    chamber = createNodeConversionChamber();
    const context = { pageURL: owned.document_url, referrer: "" };
    const params = { send_to: `${owned.conversion_id}/${owned.conversion_label}`, value: owned.value,
      currency: owned.currency, transaction_id: owned.transaction_id };
    adapter = createGoogleAdsPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: "pending" },
      experimentalRouting: true, experimentalManualResponseChain: { auid: owned.auid },
      commandTimeoutMs: 5000, transportTimeoutMs: 1500,
    });
    output = await bounded((async () => {
      const probe = await chamber.probe;
      if (!probe?.ambientFetchDenied || !(probe.threadId > 0)) throw new Error("worker-probe-failed");
      adapter.gtag("config", owned.conversion_id);
      const configured = await adapter.flush();
      if (configured.outcomes.at(-1)?.disposition !== "configured" || receiver.arrivals.length) throw new Error("config-control-failed");
      adapter.gtag("event", "conversion", params);
      const pending = await adapter.flush();
      adapter.setConsent({ ad_storage: "denied" });
      adapter.gtag("event", "conversion", params);
      const denied = await adapter.flush();
      if (pending.outcomes.at(-1)?.disposition !== "held" || denied.outcomes.at(-1)?.disposition !== "held" ||
          receiver.arrivals.length) throw new Error("consent-control-failed");
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      if (receiver.arrivals.length) throw new Error("unexpected-replay");
      adapter.gtag("event", "conversion", params);
      params.value = 2;
      context.pageURL = "https://owned.example.test/changed";
      const state = await adapter.flush();
      const result = state.outcomes.at(-1);
      const primary = new URL(receiver.arrivals[0]?.url);
      const expected = new URLSearchParams({ label: owned.conversion_label, value: String(owned.value),
        currency_code: owned.currency, oid: owned.transaction_id, url: owned.document_url });
      const secondary = new URL(fixture.entries[1].request.url);
      const location = new URL(fixture.entries[1].response.headers.find(([name]) => name.toLowerCase() === "location")[1]);
      const secondaryLocal = `${new URL(receiver.endpoint).origin}/pagead/viewthroughconversion/${owned.conversion_id.slice(3)}/${secondary.search}`;
      const finalLocal = `${new URL(receiver.endpoint).origin}/pagead/1p-conversion/${owned.conversion_id.slice(3)}/${location.search}`;
      if (state.host.actualCalls !== 3 || state.host.dispatchAttempts !== 3 ||
          result?.disposition !== "transport-settled" || result.requests !== 3 ||
          primary.searchParams.toString() !== expected.toString() ||
          receiver.arrivals[1]?.url !== secondaryLocal || receiver.arrivals[2]?.url !== finalLocal ||
          receiver.arrivals.some(({ bodySize }) => bodySize !== 0) || receiver.responses.length !== 3 ||
          result.chain?.length !== 3 || result.chain[0].parent !== 0 ||
          result.chain[1].parent !== result.chain[0].id || result.chain[2].parent !== result.chain[1].id) {
        throw new Error("worker-chain-not-verified");
      }
      return {
        overall: "INCONCLUSIVE", experimental: true, fullCompatibility: false,
        worker: { firstPartyNode: true, ambientFetchDenied: true, threadId: probe.threadId,
          trust: "first-party Node worker; not an adversarial browser sandbox" },
        host: { actualCalls: state.host.actualCalls, dispatchAttempts: state.host.dispatchAttempts,
          commandStages: result.chain },
        receiver: { count: receiver.arrivals.length, methods: receiver.arrivals.map(({ method }) => method),
          independent: true },
        responseChain: { settled: true, fallback: "offered-not-executed", localSurrogate: true,
          originalSecondaryAndFinalBytes: "unavailable", primary: "experimental-mapper-output",
          surrogateBodyBytes: receiver.responses.map(({ bodyBytes }) => bodyBytes),
          snapshotControls: "passed", consentControls: "passed" },
        claims: { nativeQualified: false, fullReference: false, browser: false, chamberConversion: false, productReceipt: false },
        gaps: ["native primary fields", "initialization", "original response bytes", "cookies",
          "full native parity", "performance", "backend receipt"],
      };
    })(), 7000);
  } catch (error) {
    failure = error;
    const state = adapter?.getState();
    partial = {
      reason: state?.terminalReason || "local-check-failed",
      host: { actualCalls: state?.host.actualCalls ?? 0, dispatchAttempts: state?.host.dispatchAttempts ?? 0 },
      receiver: { count: receiver?.arrivals.length ?? 0, methods: receiver?.arrivals.map(({ method }) => method) ?? [] },
      responseChain: { settled: false, stages: state?.outcomes.at(-1)?.chain ?? [] },
    };
  } finally {
    try { await closeConversionResources({ adapter, chamber, receiver, cause: failure }); }
    catch { cleanupFailure = true; }
  }
  if (failure || cleanupFailure) {
    const chamberClosed = chamber?.getState().closed === true;
    const receiverClosed = receiver ? !receiver.getState().listening : false;
    const openSockets = receiver?.getState().openSockets ?? null;
    return {
      overall: "INCONCLUSIVE", experimental: true, fullCompatibility: false, localExperiment: "failed",
      ...(partial || { reason: "cleanup-failed", host: output?.host, receiver: output?.receiver, responseChain: output?.responseChain }),
      cleanup: { chamberClosed, receiverClosed, openSockets,
        verified: !cleanupFailure && chamberClosed && receiverClosed && openSockets === 0 },
      claims: { nativeQualified: false, fullReference: false, browser: false, chamberConversion: false, productReceipt: false },
    };
  }
  output.cleanup = { chamberClosed: chamber.getState().closed, receiverClosed: !receiver.getState().listening,
    openSockets: receiver.getState().openSockets, adapter: adapter.getState().manualCleanup };
  output.cleanup.verified = output.cleanup.chamberClosed && output.cleanup.receiverClosed &&
    output.cleanup.openSockets === 0 && Object.values(output.cleanup.adapter).every((count) => count === 0);
  if (!output.cleanup.verified) {
    output.localExperiment = "failed";
    output.reason = "owned-cleanup-unverified";
  }
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 2) {
    console.error("unsupported-options");
    process.exitCode = 2;
  } else {
    try {
      const result = await runGoogleManualWorkerChain();
      console.log(JSON.stringify(result, null, 2));
      if (result.localExperiment === "failed") process.exitCode = 1;
    }
    catch {
      console.error(JSON.stringify({ overall: "INCONCLUSIVE", localExperiment: "failed", nativeQualified: false }));
      process.exitCode = 1;
    }
  }
}
