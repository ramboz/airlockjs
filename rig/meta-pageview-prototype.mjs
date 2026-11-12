import { createServer } from "node:http";
import { Worker } from "node:worker_threads";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { compareMetaPageViewPrototype } from "./meta-pageview-prototype-report.mjs";

export function createNodePrototypeChamber() {
  const worker = new Worker(new URL("./meta-pageview-prototype-node.worker.mjs", import.meta.url));
  const listeners = new Set();
  const errors = new Set();
  let closing = false;
  let closed = false;
  let closeResult;
  let probeResult;
  let probeResolve;
  const probe = new Promise((resolve) => { probeResolve = resolve; });
  const probeTimer = setTimeout(() => probeResolve(null), 2000);
  worker.on("message", (message) => {
    if (message.type === "prototype-node-probe") {
      clearTimeout(probeTimer);
      probeResult = message;
      probeResolve(message);
    }
    for (const listener of listeners) listener(message);
  });
  worker.on("error", () => { for (const listener of errors) listener(); });
  worker.on("exit", () => {
    closed = true;
    clearTimeout(probeTimer);
    if (!probeResult) probeResolve(null);
    if (!closing) for (const listener of errors) listener();
  });
  return {
    probe,
    getState: () => ({ closing, closed }),
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

export async function createPrototypeReceiver({ respond } = {}) {
  const arrivals = [];
  const sockets = new Set();
  const server = createServer((request, response) => {
    arrivals.push({ method: request.method, url: `http://127.0.0.1:${server.address().port}${request.url}` });
    if (request.method !== "GET" || !request.url.startsWith("/tr/?")) {
      response.writeHead(400).end();
      return;
    }
    if (respond) respond(request, response);
    else response.writeHead(204).end();
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  server.requestTimeout = 2000;
  server.headersTimeout = 2000;
  server.setTimeout(2000, (socket) => socket.destroy());
  let listenTimer;
  try {
    await new Promise((resolve, reject) => {
      listenTimer = setTimeout(() => reject(new Error("loopback-listen-timeout")), 2000);
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
  } catch (error) {
    server.close();
    for (const socket of sockets) socket.destroy();
    throw error;
  } finally {
    clearTimeout(listenTimer);
  }
  let closing;
  return {
    endpoint: `http://127.0.0.1:${server.address().port}/tr/`,
    arrivals,
    getState: () => ({ listening: server.listening, openSockets: sockets.size }),
    close() {
      if (!closing) closing = (async () => {
        // server.close's callback may precede socket "close" events. Wait for
        // both instead of reporting cleanup while an owned socket is live.
        const socketCloses = [...sockets].map((socket) => new Promise((resolve) => socket.once("close", resolve)));
        const serverClosed = new Promise((resolve) => server.close(resolve));
        for (const socket of sockets) socket.destroy();
        await Promise.all([serverClosed, ...socketCloses]);
      })();
      return closing;
    },
  };
}

export async function closePrototypeResources({ adapter, chamber, receiver, cause }) {
  const failures = [];
  for (const [resource, method, name] of [
    [adapter, "dispose", "adapter"], [chamber, "dispose", "chamber"], [receiver, "close", "receiver"],
  ]) {
    try { await resource?.[method](); }
    catch { failures.push(new Error(`${name}-cleanup-failed`)); }
  }
  if (failures.length) throw new AggregateError(failures, "prototype-cleanup-failed", { cause });
}

/** Ordinary local example. The historical page URL is DATA, never navigated. */
export async function runMetaPageViewPrototypeExample() {
  const fixture = JSON.parse(await readFile(new URL("../test/fixtures/meta-tr-pageview.redacted.json", import.meta.url), "utf8"));
  let receiver;
  let chamber;
  let adapter;
  let deadline;
  let failure;
  try {
    receiver = await createPrototypeReceiver();
    chamber = createNodePrototypeChamber();
    const context = {
      pageURL: fixture.beacons[0].dl, referrer: "", inFrame: false,
      screenWidth: 412, screenHeight: 823, timezoneOffset: -420,
    };
    adapter = createMetaPixelPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: () => context,
      consent: { ad_storage: "pending" },
    });
    const journey = async () => {
      adapter.fbq("init", "000000000000000");
      adapter.fbq("track", "PageView");
      const pending = await adapter.flush();
      const pendingArrivals = receiver.arrivals.length;
      if (pendingArrivals !== 0 || pending.outcomes.at(-1)?.disposition !== "held") throw new Error("pending-control-failed");
      adapter.setConsent({ ad_storage: "denied" });
      adapter.fbq("track", "PageView");
      const denied = await adapter.flush();
      const deniedArrivals = receiver.arrivals.length;
      if (deniedArrivals !== 0 || denied.outcomes.at(-1)?.disposition !== "held") throw new Error("denied-control-failed");
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      const grantWithoutNewCommandArrivals = receiver.arrivals.length;
      if (grantWithoutNewCommandArrivals !== 0) throw new Error("unexpected-replay");
      adapter.fbq("track", "PageView");
      context.pageURL = `${fixture.beacons[0].dl}#offline-second`;
      adapter.fbq("track", "PageView");
      adapter.fbq("track", "Purchase");
      const flushed = await adapter.flush();
      const probe = await chamber.probe;
      const pages = receiver.arrivals.map(({ url }) => new URL(url).searchParams.get("dl"));
      const settledPageViewCommands = flushed.outcomes.filter((entry) => entry.disposition === "transport-settled").length;
      if (!probe?.ambientFetchDenied || !(probe.threadId > 0) || receiver.arrivals.length !== 2 ||
          pages[0] !== fixture.beacons[0].dl || pages[1] !== context.pageURL ||
          settledPageViewCommands !== 2 ||
          flushed.outcomes.at(-1)?.reason !== "unsupported-command") throw new Error("local-journey-not-verified");
      return {
        experimental: true,
        overall: "inconclusive",
        fullCompatibility: false,
        localJourney: {
          receipt: "independently-observed-loopback-only",
          pendingArrivals, deniedArrivals, grantWithoutNewCommandArrivals,
          actualArrivals: receiver.arrivals.length,
          hostDispatchAttempts: flushed.host.dispatchAttempts,
          settledPageViewCommands,
          distinctCapturedPages: new Set(pages).size,
        },
        workerProbe: { threadId: probe.threadId, ambientFetchDenied: probe.ambientFetchDenied, qualification: "first-party-Node-only" },
        captureAndTransport: flushed,
        comparisons: receiver.arrivals.map((generatedRequest) => compareMetaPageViewPrototype({ generatedRequest, fixture })),
      };
    };
    return await Promise.race([
      journey(),
      new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error("example-deadline")), 5000); }),
    ]);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    clearTimeout(deadline);
    await closePrototypeResources({ adapter, chamber, receiver, cause: failure });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await runMetaPageViewPrototypeExample(), null, 2));
  } catch {
    console.error(JSON.stringify({ overall: "failed-local-example", fullCompatibility: false }));
    process.exitCode = 1;
  }
}
