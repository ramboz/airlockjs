import { createWrappedSdkHost } from "../core/wrapped-sdk-host.js";

const CONTEXT_KEYS = ["pageURL", "referrer", "inFrame", "screenWidth", "screenHeight", "timezoneOffset"];
const HISTORY_LIMIT = 256;
const WORKER_FAILURES = new Set([
  "transport-timeout", "transport-failed", "invalid-transport-response", "invalid-command-order",
  "duplicate-worker-init", "worker-configuration-failed", "unsupported-worker-message",
]);

function capturePageContext() {
  return {
    pageURL: document.URL,
    referrer: document.referrer,
    inFrame: window.self !== window.top,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    timezoneOffset: new Date().getTimezoneOffset(),
  };
}

function browserChamber() {
  const worker = new Worker(new URL("../connectors/meta-pixel/pageview-prototype.worker.js", import.meta.url), { type: "module" });
  return {
    postMessage: (message) => worker.postMessage(message),
    onMessage(listener) {
      const handle = ({ data }) => listener(data);
      worker.addEventListener("message", handle);
      return () => worker.removeEventListener("message", handle);
    },
    onError(listener) {
      worker.addEventListener("error", listener);
      worker.addEventListener("messageerror", listener);
      return () => {
        worker.removeEventListener("error", listener);
        worker.removeEventListener("messageerror", listener);
      };
    },
    dispose: () => worker.terminate(),
  };
}

async function boundedResponse(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > 4096) throw new Error("response-too-large");
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/**
 * EXPERIMENTAL source-only standalone factory. No global fbq installation.
 * Main captures only bounded primitive args and six context fields; all command
 * interpretation and query construction live in the first-party worker.
 * Outcomes describe transport settlement, NEVER receipt or native parity.
 */
export function createMetaPixelPrototype({
  endpoint,
  chamber,
  captureContext = capturePageContext,
  consent = null,
  queueLimit = 32,
  initTimeoutMs = 2000,
  commandTimeoutMs = 2000,
  transportTimeoutMs = 1000,
  fetchImpl = globalThis.fetch,
} = {}) {
  const match = typeof endpoint === "string" && endpoint.match(/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/tr\/$/);
  if (!match || Number(match[1]) > 65535) throw new Error("literal-loopback-endpoint-required");
  if (!Number.isInteger(queueLimit) || queueLimit < 1 || queueLimit > 128 ||
      ![initTimeoutMs, commandTimeoutMs, transportTimeoutMs].every((n) => Number.isInteger(n) && n >= 10 && n <= 10000)) {
    throw new Error("invalid-prototype-bounds");
  }
  const queue = [];
  const outcomes = [];
  const waiters = new Set();
  const controllers = new Set();
  const subscriptions = [];
  let sequence = 0;
  let admitted = 0;
  let truncated = 0;
  let phase = "starting";
  let terminalReason = null;
  let inFlight = false;
  let capturing = false;
  let cleanupFailure = null;
  let currentFinish;
  let initTimer;
  let closed;
  let host;
  let transport;
  const consentVector = { ad_storage: consent?.ad_storage };

  function record(outcome) {
    if (outcomes.length === HISTORY_LIMIT) { outcomes.shift(); truncated += 1; }
    outcomes.push(outcome);
  }

  function getState() {
    const state = host?.getState();
    return {
      experimental: true, phase, terminalReason, cleanupFailure, queued: queue.length, inFlight, truncated,
      host: {
        dispatchAttempts: state?.mainDispatch.count || 0,
        consentHeld: state?.consentHeld || 0,
        ceilingHeld: state?.ceilingHeld || 0,
      },
      outcomes: outcomes.map((outcome) => ({ ...outcome })).sort((a, b) => a.seq - b.seq),
      receipt: "not-observed-by-adapter",
      fullCompatibility: false,
    };
  }

  function settleFlushes() {
    if (queue.length || inFlight) return;
    for (const resolve of waiters) resolve(getState());
    waiters.clear();
  }

  function stop(reason, disposed = false) {
    if (phase === "terminal" || phase === "disposed") return;
    phase = disposed ? "disposed" : "terminal";
    terminalReason = reason;
    clearTimeout(initTimer);
    for (const unsubscribe of subscriptions) {
      try { unsubscribe?.(); } catch { cleanupFailure = "listener-dispose-failed"; }
    }
    for (const controller of controllers) {
      try { controller.abort(); } catch { cleanupFailure = "transport-abort-failed"; }
    }
    currentFinish?.({ terminalReason: reason });
    for (const event of queue.splice(0)) record({ seq: event.seq, disposition: "rejected", reason });
    let disposal;
    try { disposal = transport?.dispose?.(); }
    catch { disposal = Promise.reject(new Error("transport-dispose-failed")); }
    closed = Promise.resolve(disposal).then(
      () => { if (cleanupFailure) throw new Error("prototype-cleanup-failed"); },
      () => {
        cleanupFailure = "transport-dispose-failed";
        throw new Error("prototype-cleanup-failed");
      },
    );
    // Event-driven stop may have no awaiting caller. Observe rejection here,
    // but preserve the rejected promise and public failure for dispose/getState.
    void closed.catch(() => {});
    settleFlushes();
  }

  async function dispatch(request) {
    // Literal base comparison additionally rejects normalization tricks that
    // an origin/path ceiling alone intentionally does not cover.
    if (phase !== "ready" || request.method !== "GET" || request.body !== undefined || request.headers !== undefined ||
        typeof request.url !== "string" || request.url.length > 8192 ||
        !request.url.startsWith(`${endpoint}?`) || request.url.includes("#")) {
      throw new Error("literal-loopback-policy");
    }
    const controller = new AbortController();
    controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), transportTimeoutMs);
    try {
      const response = await fetchImpl(request.url, {
        method: "GET", credentials: "omit", redirect: "error",
        referrerPolicy: "no-referrer", signal: controller.signal,
      });
      return { status: response.status, body: await boundedResponse(response), headers: {} };
    } catch {
      throw new Error("loopback-transport-failed");
    } finally {
      clearTimeout(timer);
      controllers.delete(controller);
    }
  }

  async function pump() {
    if (inFlight || phase !== "ready") return;
    while (queue.length && phase === "ready") {
      const event = queue.shift();
      inFlight = true;
      const settled = await new Promise((resolve) => {
        let finished = false;
        const finish = (value) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          currentFinish = undefined;
          resolve(value);
        };
        const timer = setTimeout(() => finish({ terminalReason: "command-timeout" }), commandTimeoutMs);
        currentFinish = finish;
        host.driveEvent(event).then((result) => finish({ result }), () => finish({ terminalReason: "worker-fatal" }));
      });
      if (settled.terminalReason) {
        record({ seq: event.seq, disposition: "rejected", reason: settled.terminalReason });
        stop(settled.terminalReason);
      } else if (settled.result.summary?.seq !== event.seq) {
        record({ seq: event.seq, disposition: "rejected", reason: "result-correlation-failed" });
        stop("result-correlation-failed");
      } else {
        record(settled.result.summary);
        if (settled.result.summary.terminal) stop("transport-failed");
      }
      inFlight = false;
    }
    settleFlushes();
  }

  function fbq(...args) {
    const seq = ++sequence;
    const reject = (reason) => record({ seq, disposition: "rejected", reason });
    if (capturing) { reject("capture-reentrant"); return; }
    if (phase === "terminal" || phase === "disposed") { reject(phase); return; }
    if (queue.length >= queueLimit) { reject("queue-overflow"); return; }
    // Also bound the unchanged wrapped host's lifetime request history.
    if (admitted >= HISTORY_LIMIT) { reject("session-command-limit"); return; }
    if (args.length > 3) { reject("argument-limit"); return; }
    for (const arg of args) {
      if (["function", "symbol"].includes(typeof arg)) { reject("uncloneable-input"); return; }
      if (arg !== null && typeof arg === "object") { reject("unsupported-argument"); return; }
      if (typeof arg === "string" && arg.length > 64) { reject("argument-limit"); return; }
    }
    capturing = true;
    try {
      const source = captureContext();
      const context = {};
      for (const key of CONTEXT_KEYS) {
        const descriptor = source && Object.getOwnPropertyDescriptor(source, key);
        if (descriptor?.get || descriptor?.set) { reject("unsupported-context"); return; }
        const value = descriptor?.value;
        if ((value !== null && typeof value === "object") || ["function", "symbol", "bigint"].includes(typeof value) ||
            (typeof value === "string" && value.length > 2048)) { reject("unsupported-context"); return; }
        context[key] = value;
      }
      const payload = structuredClone({ args, context });
      if (phase === "terminal" || phase === "disposed") { reject(phase); return; }
      if (queue.length >= queueLimit || admitted >= HISTORY_LIMIT) { reject("capture-admission-changed"); return; }
      queue.push({ type: "meta-pixel-command", seq, ts: performance.now(), payload, snapshot: {} });
      admitted += 1;
      void pump();
    } catch {
      reject("capture-unavailable");
    } finally {
      capturing = false;
    }
  }

  try {
    transport = chamber || browserChamber();
    const hostListeners = new Set();
    subscriptions.push(transport.onMessage((message) => {
      if (phase === "terminal" || phase === "disposed") return;
      if (message?.type === "fatal") {
        stop(WORKER_FAILURES.has(message.message) ? message.message : "worker-fatal");
        return;
      }
      if (message?.type === "phase" && message.name === "configured") {
        if (phase !== "starting") { stop("duplicate-configured"); return; }
        phase = "ready";
        clearTimeout(initTimer);
      }
      if (message?.type === "intercepted-fetch" &&
          (message.method !== "GET" || Object.keys(message).some((key) => !["type", "id", "url", "method"].includes(key)))) {
        transport.postMessage({ type: "intercepted-fetch-response", id: message.id, status: 0, statusText: "held at the seal: literal-loopback-policy", body: "" });
        return;
      }
      for (const listener of hostListeners) listener(message);
      void pump();
    }));
    subscriptions.push(transport.onError?.(() => stop("worker-error")));
    host = createWrappedSdkHost({
      chamber: {
        postMessage(message) {
          if (phase === "terminal" || phase === "disposed") return;
          try { transport.postMessage(message); } catch { stop("transport-post-failed"); }
        },
        onMessage: (listener) => hostListeners.add(listener),
      },
      caps: { egress: { dispatch } },
      endpointCeiling: [endpoint],
      consent: consentVector,
      egressPurposes: ["ad_storage"],
      grantedCookieNames: [],
      timeoutMs: transportTimeoutMs,
      onDiagnostic() {},
    });
    initTimer = setTimeout(() => stop("init-timeout"), initTimeoutMs);
    host.init({ endpoint, transportTimeoutMs });
  } catch {
    stop("worker-unavailable");
  }

  return {
    fbq,
    getState,
    flush() {
      if (!queue.length && !inFlight) return Promise.resolve(getState());
      if (waiters.size >= 16) return Promise.resolve({ ...getState(), flush: "waiter-limit" });
      return new Promise((resolve) => waiters.add(resolve));
    },
    setConsent(vector) {
      if (phase === "terminal" || phase === "disposed") return;
      consentVector.ad_storage = vector?.ad_storage;
    },
    async dispose() {
      stop("disposed", true);
      await closed;
    },
  };
}
