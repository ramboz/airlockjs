import { createServer } from "node:http";
import { Worker } from "node:worker_threads";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { reportGoogleAdsConversionPrototype } from "./google-ads-conversion-prototype-report.mjs";

export function createNodeConversionChamber() {
  const worker = new Worker(new URL("./google-ads-conversion-prototype-node.worker.mjs", import.meta.url));
  const listeners = new Set();
  const errors = new Set();
  let closing = false;
  let closed = false;
  let closeResult;
  let resolveProbe;
  const probe = new Promise((resolve) => { resolveProbe = resolve; });
  const timer = setTimeout(() => resolveProbe(null), 2000);
  worker.on("message", (message) => {
    if (message.type === "prototype-node-probe") { clearTimeout(timer); resolveProbe(message); }
    for (const listener of listeners) listener(message);
  });
  worker.on("error", () => { for (const listener of errors) listener(); });
  worker.on("exit", () => {
    closed = true;
    clearTimeout(timer);
    resolveProbe(null);
    if (!closing) for (const listener of errors) listener();
  });
  return {
    probe, getState: () => ({ closing, closed }),
    postMessage: (message) => worker.postMessage(message),
    onMessage(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    onError(listener) { errors.add(listener); return () => errors.delete(listener); },
    dispose() {
      if (!closing) {
        closing = true;
        listeners.clear();
        errors.clear();
        closeResult = worker.terminate();
      }
      return closeResult;
    },
  };
}

/** Independent receiving sink, fixed path; never a vendor proxy. */
export async function createConversionReceiver({ respond } = {}) {
  const arrivals = [];
  const sockets = new Set();
  const server = createServer((request, response) => {
    arrivals.push({ method: request.method, url: `http://127.0.0.1:${server.address().port}${request.url}` });
    if (request.method !== "GET" || !request.url.startsWith("/pagead/conversion/0000000000/?")) {
      response.writeHead(400).end();
      return;
    }
    try {
      if (respond) respond(request, response);
      else response.writeHead(204).end();
    } catch { response.destroy(); }
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  server.requestTimeout = 2000;
  server.headersTimeout = 2000;
  server.setTimeout(2000, (socket) => socket.destroy());
  let timer;
  try {
    await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("loopback-listen-timeout")), 2000);
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
  } catch (cause) {
    server.close();
    for (const socket of sockets) socket.destroy();
    throw new Error("loopback-listen-failed", { cause });
  } finally { clearTimeout(timer); }
  let closing;
  return {
    endpoint: `http://127.0.0.1:${server.address().port}/pagead/conversion/0000000000/`,
    arrivals,
    getState: () => ({ listening: server.listening, openSockets: sockets.size }),
    close() {
      if (!closing) closing = (async () => {
        const closes = [...sockets].map((socket) => new Promise((resolve) => socket.once("close", resolve)));
        const serverClosed = new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        for (const socket of sockets) socket.destroy();
        await Promise.all([serverClosed, ...closes]);
      })();
      return closing;
    },
  };
}

async function bounded(promise, ms) {
  let timer;
  try {
    return await Promise.race([
      promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("owned-resource-deadline")), ms); }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function closeConversionResources({ adapter, chamber, receiver, cause }) {
  const failures = [];
  for (const [resource, method, name] of [
    [adapter, "dispose", "adapter"], [chamber, "dispose", "chamber"], [receiver, "close", "receiver"],
  ]) {
    try { await bounded(Promise.resolve().then(() => resource?.[method]()), 2000); }
    catch { failures.push(new Error(`${name}-cleanup-failed`)); }
  }
  if (failures.length) throw new AggregateError(failures, "prototype-cleanup-failed", { cause });
}

export async function runGoogleAdsConversionPrototypeExample() {
  const projection = JSON.parse(await readFile(new URL("../test/fixtures/google-ads-conversion-native-shape.json", import.meta.url), "utf8"));
  let receiver, chamber, adapter, failure, output;
  try {
    receiver = await createConversionReceiver();
    chamber = createNodeConversionChamber();
    const context = { pageURL: "https://example.test/offline-conversion-a", referrer: "" };
    const params = { send_to: "AW-0000000000/SYNTHETIC_LABEL", value: 28.75, currency: "CAD", transaction_id: "offline-example-a-28" };
    adapter = createGoogleAdsPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: () => context, consent: { ad_storage: "pending" },
    });
    const journey = async () => {
      const probe = await chamber.probe;
      const initArrivals = receiver.arrivals.length;
      adapter.gtag("config", "AW-0000000000");
      const configured = await adapter.flush();
      const configArrivals = receiver.arrivals.length;
      if (initArrivals !== 0 || configArrivals !== 0 || configured.outcomes.at(-1)?.disposition !== "configured") throw new Error("config-control-failed");
      adapter.gtag("event", "conversion", params);
      const pending = await adapter.flush();
      const pendingArrivals = receiver.arrivals.length;
      if (pendingArrivals !== 0 || pending.outcomes.at(-1)?.disposition !== "held") throw new Error("pending-control-failed");
      adapter.setConsent({ ad_storage: "denied" });
      adapter.gtag("event", "conversion", params);
      const denied = await adapter.flush();
      const deniedArrivals = receiver.arrivals.length;
      if (deniedArrivals !== 0 || denied.outcomes.at(-1)?.disposition !== "held") throw new Error("denied-control-failed");
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      const grantWithoutNewCommandArrivals = receiver.arrivals.length;
      if (grantWithoutNewCommandArrivals !== 0) throw new Error("unexpected-replay");
      const commandSnapshots = [];
      commandSnapshots.push(structuredClone({ args: ["event", "conversion", params], context }));
      adapter.gtag("event", "conversion", params);
      Object.assign(params, { value: 0, currency: "", transaction_id: "offline-example-b-zero" });
      context.pageURL = "https://example.test/offline-conversion-b#changed";
      commandSnapshots.push(structuredClone({ args: ["event", "conversion", params], context }));
      adapter.gtag("event", "conversion", params);
      const state = await adapter.flush();
      const comparison = reportGoogleAdsConversionPrototype({
        observedRequests: receiver.arrivals, commandSnapshots, endpoint: receiver.endpoint, projection,
      });
      const distinctTransactions = new Set(receiver.arrivals.map(({ url }) => new URL(url).searchParams.get("oid"))).size;
      const distinctPages = new Set(receiver.arrivals.map(({ url }) => new URL(url).searchParams.get("url"))).size;
      const settledConversionCommands = state.outcomes.filter((entry) => entry.disposition === "transport-settled").length;
      if (!probe?.ambientFetchDenied || !(probe.threadId > 0) || receiver.arrivals.length !== 2 || distinctTransactions !== 2 ||
          distinctPages !== 2 || settledConversionCommands !== 2 || !comparison.cardinalityPreserved ||
          !comparison.local.every((row) => row.relationshipsPreserved)) throw new Error("local-journey-not-verified");
      return {
        overall: "INCONCLUSIVE", fullCompatibility: false, experimental: true,
        localJourney: {
          receipt: "independently-observed-loopback-only",
          initArrivals, configArrivals, pendingArrivals, deniedArrivals, grantWithoutNewCommandArrivals,
          actualArrivals: receiver.arrivals.length, hostDispatchAttempts: state.host.dispatchAttempts,
          settledConversionCommands, distinctTransactions, distinctPages,
        },
        workerProbe: { threadId: probe.threadId, ambientFetchDenied: probe.ambientFetchDenied, qualification: "first-party-Node-only" },
        captureAndTransport: state, comparison,
      };
    };
    output = await bounded(journey(), 5000);
  } catch (error) { failure = error; throw error; }
  finally { await closeConversionResources({ adapter, chamber, receiver, cause: failure }); }
  output.cleanup = {
    chamberClosed: chamber.getState().closed,
    receiverClosed: !receiver.getState().listening,
    openSockets: receiver.getState().openSockets,
  };
  if (!output.cleanup.chamberClosed || !output.cleanup.receiverClosed || output.cleanup.openSockets !== 0) throw new Error("owned-cleanup-unverified");
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await runGoogleAdsConversionPrototypeExample(), null, 2)); }
  catch {
    console.error(JSON.stringify({ overall: "failed-local-example", fullCompatibility: false }));
    process.exitCode = 1;
  }
}
