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
  experimentalRouting = false, experimentalParameterScopes = false,
} = {}) {
  if (typeof experimentalRouting !== "boolean" || typeof experimentalParameterScopes !== "boolean") throw new Error("invalid-experimental-option");
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
    };
  }
  function settle() {
    if (inFlight || queue.length) return;
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
    finishCurrent?.({ failure: reason });
    for (const event of queue.splice(0)) record({ seq: event.seq, disposition: "rejected", reason });
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
      for (const [index, arg] of args.entries()) {
        if (primitive(arg, 2048)) { captured.push(arg); continue; }
        if ((index !== 2 && !(experimentalParameterScopes && index === 1)) ||
            !arg || typeof arg !== "object" || Array.isArray(arg)) {
          reject("unsupported-argument"); return;
        }
        if (![Object.prototype, null].includes(Object.getPrototypeOf(arg))) { reject("unsupported-parameters"); return; }
        const keys = Reflect.ownKeys(arg);
        if (keys.length > 4 || keys.some((key) => !PARAM_KEYS.includes(key))) { reject("unsupported-parameters"); return; }
        const params = {};
        for (const key of keys) {
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
      queue.push({ seq, type: "google-ads-command", ts: performance.now(), payload, snapshot: {} });
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
        awaitingResult = false;
      }
      if (message?.type === "intercepted-fetch" &&
          (message.method !== "GET" || Object.keys(message).some((key) => !["type", "id", "url", "method"].includes(key)))) {
        try {
          transport.postMessage({ type: "intercepted-fetch-response", id: message.id, status: 0, statusText: "held at the seal: literal-loopback-policy", body: "" });
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
      if (!queue.length && !inFlight) return Promise.resolve(getState());
      if (waiters.size >= 16) return Promise.resolve({ ...getState(), flush: "waiter-limit" });
      return new Promise((resolve) => waiters.add(resolve));
    },
    setConsent(vector) {
      if (phase !== "terminal" && phase !== "disposed") consentVector.ad_storage = vector?.ad_storage;
    },
    async dispose() { stop("disposed", true); await closed; },
  };
}
