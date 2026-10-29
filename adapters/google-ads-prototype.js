import { createWrappedSdkHost } from "../core/wrapped-sdk-host.js";

const PARAM_KEYS = ["send_to", "value", "currency", "transaction_id"];
const LIMIT = 256;
const FAILURES = new Set([
  "transport-timeout", "transport-failed", "invalid-transport-response", "invalid-command-order",
  "duplicate-worker-init", "worker-configuration-failed", "unsupported-worker-message",
]);
const REASONS = new Set([
  "connector-not-initialized", "unsupported-command", "unsupported-config", "synthetic-destination-required",
  "duplicate-config", "conversion-before-config", "unsupported-parameters", "synthetic-selector-required",
  "unsupported-value", "unsupported-currency", "unsupported-transaction", "invalid-context",
  "encoded-context-limit", "held-at-seal", "transport-failed", "destination-mismatch",
]);

function browserChamber() {
  const worker = new Worker(new URL("../connectors/google-ads/conversion-prototype.worker.js", import.meta.url), { type: "module" });
  return {
    postMessage: (message) => worker.postMessage(message),
    onMessage(listener) {
      const callback = ({ data }) => listener(data);
      worker.addEventListener("message", callback);
      return () => worker.removeEventListener("message", callback);
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

function primitive(value, limit) {
  return (value === null || ["undefined", "string", "number", "boolean"].includes(typeof value)) &&
    (typeof value !== "string" || value.length <= limit);
}

async function responseText(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
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

/** EXPERIMENTAL, source-only, synthetic/loopback ONLY. No global installation.
 * Main captures data, not command meaning. Mapping and retained config are in
 * the first-party worker. Transport settlement is never receiver/native proof.
 */
export function createGoogleAdsPrototype({
  endpoint, chamber, captureContext = () => ({ pageURL: document.URL, referrer: document.referrer }),
  consent = null, queueLimit = 32, initTimeoutMs = 2000, commandTimeoutMs = 2000,
  transportTimeoutMs = 1000, fetchImpl = globalThis.fetch,
  experimentalRouting = false, experimentalParameterScopes = false, experimentalCallbacks = false,
} = {}) {
  if (typeof experimentalRouting !== "boolean" || typeof experimentalParameterScopes !== "boolean" ||
      typeof experimentalCallbacks !== "boolean") throw new Error("invalid-experimental-option");
  const pattern = experimentalRouting === true
    ? /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/pagead\/conversion\/\d{1,20}\/$/
    : /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/pagead\/conversion\/0000000000\/$/;
  const match = typeof endpoint === "string" && endpoint.match(pattern);
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
  const callbacks = new Map();
  const callbackStats = { invoked: 0, timeout: 0, errors: 0, cancelled: 0 };
  const consentVector = { ad_storage: consent?.ad_storage };
  let phase = "starting";
  let terminalReason = null;
  let cleanupFailure = null;
  let sequence = 0;
  let admitted = 0;
  let truncated = 0;
  let inFlight = false;
  let capturing = false;
  let activeSequence;
  let activeCommand;
  let activeRequest;
  let lastRequestId = 0;
  let awaitingResult = false;
  let finishCurrent;
  let initTimer;
  let closed;
  let transport;
  let host;

  function record(outcome) {
    if (outcomes.length === LIMIT) { outcomes.shift(); truncated += 1; }
    outcomes.push(outcome);
  }
  function getState() {
    const state = host?.getState();
    return {
      experimental: true, phase, terminalReason, cleanupFailure, queued: queue.length, inFlight, truncated,
      outcomes: outcomes.map((entry) => ({ ...entry })).sort((a, b) => a.seq - b.seq),
      host: { dispatchAttempts: state?.mainDispatch.count || 0, consentHeld: state?.consentHeld || 0, ceilingHeld: state?.ceilingHeld || 0 },
      receipt: "not-observed-by-adapter", fullCompatibility: false,
      ...(experimentalCallbacks ? { callbacks: { ...callbackStats, pending: callbacks.size } } : {}),
    };
  }
  function settle() {
    if (inFlight || queue.length || callbacks.size) return;
    for (const resolve of waiters) resolve(getState());
    waiters.clear();
  }
  function scheduleCallback(seq, trigger) {
    const entry = callbacks.get(seq);
    if (!entry || entry.scheduled) return;
    entry.scheduled = true;
    clearTimeout(entry.timer);
    queueMicrotask(() => {
      if (callbacks.get(seq) !== entry) return;
      callbacks.delete(seq);
      callbackStats.invoked += 1;
      if (trigger === "timeout") callbackStats.timeout += 1;
      try {
        const fn = entry.fn;
        const result = fn();
        Promise.resolve(result).catch(() => { callbackStats.errors += 1; });
      } catch { callbackStats.errors += 1; }
      settle();
    });
  }
  function cancelCallbacks() {
    for (const [seq, entry] of callbacks) {
      clearTimeout(entry.timer);
      callbacks.delete(seq);
      callbackStats.cancelled += 1;
    }
  }
  function recordHostResponse(message) {
    if (!inFlight) return true;
    if (!activeRequest || activeRequest.id !== message.id || activeRequest.response) {
      stop("request-correlation-failed");
      return false;
    }
    activeRequest.response = {
      status: message.status,
      held: message.status === 0 && typeof message.statusText === "string" &&
        message.statusText.startsWith("held at the seal:"),
    };
    return true;
  }
  function matchesHostResponse(summary) {
    if (summary.requests === 0) {
      return !activeRequest && ["configured", "scope-updated", "rejected"].includes(summary.disposition) &&
        (summary.disposition !== "configured" || activeCommand?.[0] === "config") &&
        (summary.disposition !== "scope-updated" || activeCommand?.[0] === "set") &&
        summary.status === undefined && summary.terminal === undefined;
    }
    const response = activeRequest?.response;
    if (!response || activeCommand?.[0] !== "event" || activeCommand?.[1] !== "conversion" ||
        summary.status !== response.status) return false;
    const disposition = response.held ? "held" : response.status >= 200 && response.status < 300 ? "transport-settled" : "failed";
    const reason = response.held ? "held-at-seal" : response.status === 0 ? "transport-failed" : undefined;
    return summary.disposition === disposition && summary.reason === reason &&
      (response.status === 0 && !response.held ? summary.terminal === true : summary.terminal === undefined);
  }
  function stop(reason, disposed = false) {
    if (phase === "terminal" || phase === "disposed") {
      if (disposed) { cancelCallbacks(); settle(); }
      return;
    }
    phase = disposed ? "disposed" : "terminal";
    terminalReason = reason;
    clearTimeout(initTimer);
    for (const unsubscribe of subscriptions) {
      try { unsubscribe?.(); } catch { cleanupFailure = "listener-dispose-failed"; }
    }
    for (const controller of controllers) {
      try { controller.abort(); } catch { cleanupFailure = "transport-abort-failed"; }
    }
    finishCurrent?.({ failure: reason });
    for (const event of queue.splice(0)) record({ seq: event.seq, disposition: "rejected", reason });
    if (disposed) cancelCallbacks();
    else for (const seq of callbacks.keys()) scheduleCallback(seq, "terminal");
    let disposal;
    try { disposal = transport?.dispose?.(); }
    catch { disposal = Promise.reject(new Error("transport-dispose-failed")); }
    closed = Promise.resolve(disposal).then(
      () => { if (cleanupFailure) throw new Error("prototype-cleanup-failed"); },
      () => { cleanupFailure = "transport-dispose-failed"; throw new Error("prototype-cleanup-failed"); },
    );
    // Observe event-driven failure without replacing the rejection dispose returns.
    void closed.catch(() => {});
    settle();
  }
  async function dispatch(request) {
    if (phase !== "ready" || request.method !== "GET" || request.headers !== undefined || request.body !== undefined ||
        typeof request.url !== "string" || request.url.length > 8192 ||
        !request.url.startsWith(`${endpoint}?`) || request.url.includes("#")) throw new Error("literal-loopback-policy");
    const controller = new AbortController();
    controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), transportTimeoutMs);
    try {
      const response = await fetchImpl(request.url, {
        method: "GET", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", signal: controller.signal,
      });
      return { status: response.status, body: await responseText(response), headers: {} };
    } catch { throw new Error("loopback-transport-failed"); }
    finally { clearTimeout(timer); controllers.delete(controller); }
  }
  async function pump() {
    if (inFlight || phase !== "ready") return;
    while (queue.length && phase === "ready") {
      const event = queue.shift();
      activeSequence = event.seq;
      activeCommand = event.payload.args;
      activeRequest = undefined;
      inFlight = true;
      awaitingResult = true;
      const settled = await new Promise((resolve) => {
        let done = false;
        const finish = (value) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          finishCurrent = undefined;
          resolve(value);
        };
        const timer = setTimeout(() => finish({ failure: "command-timeout" }), commandTimeoutMs);
        finishCurrent = finish;
        host.driveEvent(event).then((result) => finish({ result }), () => finish({ failure: "worker-fatal" }));
      });
      if (settled.failure) {
        record({ seq: event.seq, disposition: "rejected", reason: settled.failure });
        stop(settled.failure);
      } else {
        const summary = settled.result.summary;
        record({
          seq: event.seq, disposition: summary.disposition, requests: summary.requests,
          ...(Number.isInteger(summary.status) ? { status: summary.status } : {}),
          ...(summary.reason ? { reason: REASONS.has(summary.reason) ? summary.reason : "worker-rejected" } : {}),
        });
        if (summary.terminal) stop("transport-failed");
      }
      inFlight = false;
      awaitingResult = false;
      activeSequence = undefined;
      activeCommand = undefined;
      activeRequest = undefined;
      scheduleCallback(event.seq, "settled");
    }
    settle();
  }
  function gtag(...args) {
    const seq = ++sequence;
    const reject = (reason) => record({ seq, disposition: "rejected", reason });
    if (capturing) { reject("capture-reentrant"); return; }
    if (phase === "terminal" || phase === "disposed") { reject(phase); return; }
    if (queue.length >= queueLimit) { reject("queue-overflow"); return; }
    if (admitted >= LIMIT) { reject("session-command-limit"); return; }
    if (args.length > 3) { reject("argument-limit"); return; }
    capturing = true;
    try {
      const captured = [];
      let callback;
      for (const [index, arg] of args.entries()) {
        if (primitive(arg, 2048)) { captured.push(arg); continue; }
        if ((index !== 2 && !(experimentalParameterScopes && index === 1)) ||
            !arg || typeof arg !== "object" || Array.isArray(arg)) {
          reject("unsupported-argument"); return;
        }
        if (![Object.prototype, null].includes(Object.getPrototypeOf(arg))) { reject("unsupported-parameters"); return; }
        const keys = Reflect.ownKeys(arg);
        const allowCallback = experimentalCallbacks && index === 2 && args[0] === "event" && args[1] === "conversion";
        const callbackKeys = allowCallback ? ["event_callback", "event_timeout"] : [];
        if (keys.length > 4 + callbackKeys.length ||
            keys.some((key) => !PARAM_KEYS.includes(key) && !callbackKeys.includes(key))) { reject("unsupported-parameters"); return; }
        if (keys.some((key) => callbackKeys.includes(key))) {
          const fn = Object.getOwnPropertyDescriptor(arg, "event_callback");
          const timeout = Object.getOwnPropertyDescriptor(arg, "event_timeout");
          if (!fn || !Object.hasOwn(fn, "value") || typeof fn.value !== "function" ||
              !timeout || !Object.hasOwn(timeout, "value") || !Number.isInteger(timeout.value) ||
              timeout.value < 10 || timeout.value > 10000) { reject("unsupported-callback"); return; }
          callback = { fn: fn.value, timeout: timeout.value };
        }
        const params = {};
        for (const key of keys) {
          if (callbackKeys.includes(key)) continue;
          const descriptor = Object.getOwnPropertyDescriptor(arg, key);
          if (!descriptor || descriptor.get || descriptor.set || !primitive(descriptor.value, 2048)) {
            reject("unsupported-parameters"); return;
          }
          params[key] = descriptor.value;
        }
        captured.push(params);
      }
      const source = captureContext();
      const context = {};
      for (const key of ["pageURL", "referrer"]) {
        const descriptor = source && Object.getOwnPropertyDescriptor(source, key);
        if (descriptor?.get || descriptor?.set || !primitive(descriptor?.value, 2048)) { reject("unsupported-context"); return; }
        context[key] = descriptor?.value;
      }
      const payload = structuredClone({ args: captured, context });
      if (phase === "terminal" || phase === "disposed") { reject(phase); return; }
      if (queue.length >= queueLimit || admitted >= LIMIT) { reject("capture-admission-changed"); return; }
      const event = { seq, type: "google-ads-command", ts: performance.now(), payload, snapshot: {} };
      if (callback) {
        const entry = { fn: callback.fn, scheduled: false, timer: undefined };
        entry.timer = setTimeout(() => scheduleCallback(seq, "timeout"), callback.timeout);
        callbacks.set(seq, entry);
      }
      queue.push(event);
      admitted += 1;
      void pump();
    } catch { reject("capture-unavailable"); }
    finally { capturing = false; }
  }
  try {
    transport = chamber || browserChamber();
    const hostListeners = new Set();
    subscriptions.push(transport.onMessage((message) => {
      if (phase === "terminal" || phase === "disposed") return;
      if (message?.type === "fatal") { stop(FAILURES.has(message.message) ? message.message : "worker-fatal"); return; }
      if (message?.type === "phase" && message.name === "configured") {
        if (phase !== "starting") { stop("duplicate-configured"); return; }
        phase = "ready";
        clearTimeout(initTimer);
      }
      if (message?.type === "result") {
        const summary = message.summary;
        if (!inFlight || !awaitingResult || summary?.seq !== activeSequence) { stop("result-correlation-failed"); return; }
        if (!["configured", "rejected", "held", "transport-settled", "failed",
          ...(experimentalParameterScopes ? ["scope-updated"] : [])].includes(summary.disposition) ||
            ![0, 1].includes(summary.requests) ||
            (summary.status !== undefined && (!Number.isInteger(summary.status) || summary.status < 0 || summary.status > 599))) {
          stop("invalid-worker-result"); return;
        }
        if (!matchesHostResponse(summary)) { stop("result-transport-mismatch"); return; }
        awaitingResult = false;
      }
      if (message?.type === "intercepted-fetch") {
        if (!inFlight || !awaitingResult || activeCommand?.[0] !== "event" || activeCommand?.[1] !== "conversion" ||
            activeRequest || !Number.isSafeInteger(message.id) || message.id <= lastRequestId) {
          stop("request-correlation-failed"); return;
        }
        lastRequestId = message.id;
        activeRequest = { id: message.id };
      }
      if (message?.type === "intercepted-fetch" &&
          (message.method !== "GET" || Object.keys(message).some((key) => !["type", "id", "url", "method"].includes(key)))) {
        try {
          const response = { type: "intercepted-fetch-response", id: message.id, status: 0, statusText: "held at the seal: literal-loopback-policy", body: "" };
          if (recordHostResponse(response)) transport.postMessage(response);
        } catch { stop("transport-post-failed"); }
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
          if (message?.type === "intercepted-fetch-response" && !recordHostResponse(message)) return;
          try { transport.postMessage(message); } catch { stop("transport-post-failed"); }
        },
        onMessage: (listener) => hostListeners.add(listener),
      },
      caps: { egress: { dispatch } }, endpointCeiling: [endpoint], consent: consentVector,
      egressPurposes: ["ad_storage"], grantedCookieNames: [], timeoutMs: transportTimeoutMs, onDiagnostic() {},
    });
    initTimer = setTimeout(() => stop("init-timeout"), initTimeoutMs);
    host.init({ endpoint, transportTimeoutMs,
      ...(experimentalRouting === true ? { experimentalRouting: true } : {}),
      ...(experimentalParameterScopes === true ? { experimentalParameterScopes: true } : {}) });
  } catch { stop("worker-unavailable"); }
  return {
    gtag, getState,
    flush() {
      if (!queue.length && !inFlight && !callbacks.size) return Promise.resolve(getState());
      if (waiters.size >= 16) return Promise.resolve({ ...getState(), flush: "waiter-limit" });
      return new Promise((resolve) => waiters.add(resolve));
    },
    setConsent(vector) {
      if (phase !== "terminal" && phase !== "disposed") consentVector.ad_storage = vector?.ad_storage;
    },
    async dispose() { stop("disposed", true); await closed; },
  };
}
