import "../../core/confine-pixel-chamber.js";
import { createConnectorHost } from "../../core/connector-host.js";
import { createMetaPageViewPrototype } from "./pageview-prototype.js";

let connector;
let configuring = false;
let busy = false;
let terminal = false;
let lastSequence = 0;
let requestId = 0;
let timeoutMs = 1000;
const pending = new Map();

function fatal(reason) {
  if (terminal) return;
  terminal = true;
  for (const entry of pending.values()) {
    clearTimeout(entry.timer);
    entry.reject(new Error(reason));
  }
  pending.clear();
  self.postMessage({ type: "fatal", message: reason });
}

function dispatch(request) {
  if (pending.size || terminal) throw new Error("invalid-pending-state");
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => fatal("transport-timeout"), timeoutMs);
    pending.set(id, { resolve, reject, timer });
    self.postMessage({ type: "intercepted-fetch", id, url: request.url, method: "GET" });
  });
}

async function route(event) {
  if (!connector || busy || !Number.isSafeInteger(event?.seq) || event.seq <= lastSequence) {
    fatal("invalid-command-order");
    return;
  }
  busy = true;
  lastSequence = event.seq;
  try {
    const result = await connector.routeBatch([event]);
    let summary;
    if (result.dropped.length) {
      summary = { seq: event.seq, disposition: "rejected", reason: result.dropped[0].reason, requests: 0 };
    } else if (!result.ready.length) {
      summary = { seq: event.seq, disposition: "initialized", requests: 0 };
    } else {
      if (result.ready.length !== 1) throw new Error("invalid-request-count");
      // A host counter increments BEFORE dispatch. Only the correlated response
      // settles this command, and even that is not independent receiver evidence.
      const response = await dispatch(result.ready[0]);
      const held = response.status === 0 && response.statusText?.startsWith("held at the seal:");
      summary = {
        seq: event.seq,
        disposition: held ? "held" : response.status >= 200 && response.status < 300 ? "transport-settled" : "failed",
        requests: 1,
        status: response.status,
        ...(held ? { reason: "held-at-seal" } : response.status === 0 ? { reason: "transport-failed", terminal: true } : {}),
      };
    }
    if (!terminal) self.postMessage({ type: "result", summary, ready: [] });
  } catch {
    fatal("transport-failed");
  } finally {
    busy = false;
  }
}

self.onmessage = async ({ data }) => {
  if (terminal) return;
  if (data?.type === "intercepted-fetch-response") {
    const entry = pending.get(data.id);
    if (!entry || !Number.isInteger(data.status) || (data.status !== 0 && (data.status < 100 || data.status > 599)) ||
        typeof data.body !== "string" || data.body.length > 4096) {
      fatal("invalid-transport-response");
      return;
    }
    pending.delete(data.id);
    clearTimeout(entry.timer);
    entry.resolve(data);
  } else if (data?.type === "init") {
    if (configuring || connector) { fatal("duplicate-worker-init"); return; }
    configuring = true;
    try {
      if (!Number.isInteger(data.transportTimeoutMs) || data.transportTimeoutMs < 10 || data.transportTimeoutMs > 10000) {
        throw new Error("invalid-timeout");
      }
      timeoutMs = data.transportTimeoutMs;
      connector = createConnectorHost(createMetaPageViewPrototype, { endpoint: data.endpoint });
      await connector.init({});
      self.postMessage({ type: "phase", name: "configured" });
    } catch {
      fatal("worker-configuration-failed");
    }
  } else if (data?.type === "event") {
    await route(data.event);
  } else if (data?.type !== "setConsent") {
    fatal("unsupported-worker-message");
  }
};
