import { createWrappedSdkHost } from "../core/wrapped-sdk-host.js";
import { snapshotPageViewData } from "../connectors/meta-pixel/pageview-data.js";

const CONTEXT_KEYS = ["pageURL", "referrer", "inFrame", "screenWidth", "screenHeight", "timezoneOffset"];
const HISTORY_LIMIT = 256;
const WORKER_FAILURES = new Set([
  "transport-timeout", "transport-failed", "invalid-transport-response", "invalid-command-order",
  "duplicate-worker-init", "worker-configuration-failed", "unsupported-worker-message",
]);
const MULTI_REJECTIONS = new Set([
  "unsupported-command", "invalid-pixel-id", "synthetic-pixel-required", "duplicate-init", "pixel-limit",
  "unsupported-standard-event", "invalid-custom-event", "pageview-before-init", "event-before-init",
  "uninitialized-pixel", "invalid-context", "unsupported-parameters", "encoded-context-limit",
]);

function dataRecord(value, allowed) {
  if (!value || typeof value !== "object" ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string" || !allowed.includes(key) || !Object.hasOwn(descriptors[key], "value")) return null;
    result[key] = descriptors[key].value;
  }
  return result;
}

function exactKeys(record, keys) {
  return Object.keys(record).length === keys.length && keys.every((key) => Object.hasOwn(record, key));
}

function emptyReady(value) {
  try {
    if (!Array.isArray(value)) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return Reflect.ownKeys(descriptors).length === 1 && descriptors.length?.value === 0;
  } catch {
    return false;
  }
}

function multiResultMessage(value) {
  try {
    const record = dataRecord(value, ["type", "summary", "ready"]);
    if (!record || !exactKeys(record, ["type", "summary", "ready"]) ||
        record.type !== "result" || !emptyReady(record.ready)) return null;
    return { type: "result", summary: record.summary, ready: [] };
  } catch {
    return null;
  }
}

function validateMultiSummary(summary, seq, command) {
  // Fake transports can supply accessors/proxies; reject them without reading
  // arbitrary values into public outcomes or letting validation escape the pump.
  try {
    const record = dataRecord(summary, ["seq", "disposition", "requests", "reason", "selected", "branches", "terminal"]);
    if (!record || record.seq !== seq) return null;
    if (record.disposition === "initialized") {
      return command === "init" && record.requests === 0 && exactKeys(record, ["seq", "disposition", "requests"])
        ? { seq, disposition: "initialized", requests: 0 } : null;
    }
    if (record.disposition === "rejected") {
      return record.requests === 0 && MULTI_REJECTIONS.has(record.reason) &&
        exactKeys(record, ["seq", "disposition", "requests", "reason"])
        ? { seq, disposition: "rejected", requests: 0, reason: record.reason } : null;
    }
    if (!["track", "trackCustom", "trackSingle", "trackSingleCustom"].includes(command) ||
        !Number.isInteger(record.selected) || record.selected < 1 || record.selected > 4 ||
        !Number.isInteger(record.requests) || record.requests < 1 || record.requests > record.selected ||
        (["trackSingle", "trackSingleCustom"].includes(command) && record.selected !== 1) ||
        !Array.isArray(record.branches)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(record.branches);
    if (descriptors.length?.value !== record.requests ||
        Reflect.ownKeys(descriptors).length !== record.requests + 1) return null;
    const branches = [];
    for (let index = 0; index < record.requests; index += 1) {
      const descriptor = descriptors[index];
      if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
      const branch = dataRecord(descriptor.value, ["ordinal", "disposition", "status", "reason"]);
      if (!branch || branch.ordinal !== index + 1 || !Number.isInteger(branch.status)) return null;
      const held = branch.status === 0 && branch.disposition === "held" && branch.reason === "held-at-seal";
      const failedTransport = branch.status === 0 && branch.disposition === "failed" && branch.reason === "transport-failed";
      const settled = branch.status >= 200 && branch.status < 300 && branch.disposition === "transport-settled";
      const failedHttp = branch.status >= 100 && branch.status <= 599 &&
        !(branch.status >= 200 && branch.status < 300) && branch.disposition === "failed";
      if (!(held || failedTransport || settled || failedHttp) ||
          !exactKeys(branch, held || failedTransport
            ? ["ordinal", "disposition", "status", "reason"] : ["ordinal", "disposition", "status"]) ||
          (failedTransport && index !== record.requests - 1)) return null;
      branches.push({ ...branch });
    }
    const terminal = branches.at(-1).reason === "transport-failed";
    if (record.requests < record.selected && !terminal) return null;
    const disposition = record.requests === record.selected &&
      branches.every((branch) => branch.disposition === branches[0].disposition) ? branches[0].disposition : "partial";
    const keys = ["seq", "disposition", "requests", "selected", "branches"];
    if (terminal) keys.push("terminal", "reason");
    if (!exactKeys(record, keys) || record.disposition !== disposition ||
        (terminal && (record.terminal !== true || record.reason !== "transport-failed"))) return null;
    return { seq, disposition, requests: record.requests, selected: record.selected, branches,
      ...(terminal ? { terminal: true, reason: "transport-failed" } : {}) };
  } catch {
    return null;
  }
}

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
 * Main captures bounded args and six context fields; routing, event validation
 * and query construction live in the first-party worker.
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
  experimentalPageViewData = false,
  experimentalRouting = false,
  experimentalMultiPixelRouting = false,
  experimentalEvents = false,
  experimentalScalarEventData = false,
  experimentalContentIds = false,
} = {}) {
  if ([experimentalPageViewData, experimentalRouting, experimentalMultiPixelRouting, experimentalEvents,
    experimentalScalarEventData, experimentalContentIds]
    .some((option) => typeof option !== "boolean")) {
    throw new Error("invalid-experimental-option");
  }
  if (experimentalMultiPixelRouting && !experimentalRouting) throw new Error("multi-pixel-routing-requires-routing");
  if (experimentalScalarEventData && !experimentalPageViewData) throw new Error("scalar-data-requires-pageview-data");
  if (experimentalContentIds && !experimentalPageViewData) throw new Error("content-ids-require-pageview-data");
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
  let activeEvent;
  let activeResultReceived = false;
  let activeHostRequest = null;
  let lastHostRequestId = 0;
  let activeHostResponses = [];
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
      outcomes: outcomes.map((outcome) => ({
        ...outcome, ...(outcome.branches ? { branches: outcome.branches.map((branch) => ({ ...branch })) } : {}),
      })).sort((a, b) => a.seq - b.seq),
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
      activeEvent = event;
      activeResultReceived = false;
      activeHostRequest = null;
      activeHostResponses = [];
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
      } else {
        const summary = settled.result.summary;
        if (summary?.seq !== event.seq) {
          record({ seq: event.seq, disposition: "rejected", reason: "result-correlation-failed" });
          stop("result-correlation-failed");
        } else {
          record(summary);
          if (summary.terminal) stop("transport-failed");
        }
      }
      inFlight = false;
      activeEvent = undefined;
    }
    settleFlushes();
  }

  function postHostMessage(message) {
    if (phase === "terminal" || phase === "disposed") return;
    if (experimentalMultiPixelRouting && message.type === "intercepted-fetch-response") {
      if (!inFlight || activeHostRequest !== message.id) { stop("invalid-worker-result"); return; }
      const held = message.status === 0 && message.statusText?.startsWith("held at the seal:");
      activeHostResponses.push({
        status: message.status,
        disposition: held ? "held" : message.status >= 200 && message.status < 300 ? "transport-settled" : "failed",
      });
      activeHostRequest = null;
    }
    try { transport.postMessage(message); } catch { stop("transport-post-failed"); }
  }

  function fbq(...args) {
    const seq = ++sequence;
    const reject = (reason) => record({ seq, disposition: "rejected", reason });
    if (capturing) { reject("capture-reentrant"); return; }
    if (phase === "terminal" || phase === "disposed") { reject(phase); return; }
    if (queue.length >= queueLimit) { reject("queue-overflow"); return; }
    // At most four requests per admitted command bound the host's lifetime history.
    if (admitted >= HISTORY_LIMIT) { reject("session-command-limit"); return; }
    if (args.length > (experimentalMultiPixelRouting ? 4 : 3)) { reject("argument-limit"); return; }
    const dataIndex = experimentalMultiPixelRouting &&
      (args[0] === "trackSingle" && (experimentalEvents || args[2] === "PageView") ||
       args[0] === "trackSingleCustom" && experimentalEvents)
      ? 3 : args[0] === "track" && (experimentalEvents || args[1] === "PageView") ||
        args[0] === "trackCustom" && experimentalEvents ? 2 : -1;
    for (const [index, arg] of args.entries()) {
      if (["function", "symbol"].includes(typeof arg)) { reject("uncloneable-input"); return; }
      if (arg !== null && typeof arg === "object" &&
          !(experimentalPageViewData === true && index === dataIndex)) {
        reject("unsupported-argument"); return;
      }
      if (typeof arg === "string" && arg.length > 64) { reject("argument-limit"); return; }
    }
    capturing = true;
    try {
      if (experimentalPageViewData === true && dataIndex >= 0 && args.length === dataIndex + 1) {
        const data = snapshotPageViewData(args[dataIndex], experimentalScalarEventData, experimentalContentIds);
        if (!data) { reject("unsupported-parameters"); return; }
        args[dataIndex] = data;
      }
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
      let forwarded = message;
      if (experimentalMultiPixelRouting && message?.type === "result") {
        if (!inFlight || !activeEvent || activeResultReceived) { stop("invalid-worker-result"); return; }
        const result = multiResultMessage(message);
        const summary = result && validateMultiSummary(result.summary, activeEvent.seq, activeEvent.payload.args[0]);
        if (!summary || activeHostRequest !== null || summary.requests !== activeHostResponses.length ||
            (summary.branches && summary.branches.some((branch, index) =>
              branch.status !== activeHostResponses[index].status ||
              branch.disposition !== activeHostResponses[index].disposition))) {
          stop("invalid-worker-result"); return;
        }
        activeResultReceived = true;
        forwarded = { type: "result", summary, ready: [] };
      }
      if (message?.type === "fatal") {
        stop(WORKER_FAILURES.has(message.message) ? message.message : "worker-fatal");
        return;
      }
      if (message?.type === "phase" && message.name === "configured") {
        if (phase !== "starting") { stop("duplicate-configured"); return; }
        phase = "ready";
        clearTimeout(initTimer);
      }
      if (message?.type === "intercepted-fetch") {
        if (experimentalMultiPixelRouting) {
          if (!inFlight || activeResultReceived || activeHostRequest !== null || activeHostResponses.length >= 4 ||
              !Number.isSafeInteger(message.id) || message.id <= lastHostRequestId) {
            stop("invalid-worker-result"); return;
          }
          activeHostRequest = message.id;
          lastHostRequestId = message.id;
        }
        if (message.method !== "GET" || Object.keys(message).some((key) => !["type", "id", "url", "method"].includes(key))) {
          postHostMessage({ type: "intercepted-fetch-response", id: message.id, status: 0, statusText: "held at the seal: literal-loopback-policy", body: "" });
          return;
        }
      }
      for (const listener of hostListeners) listener(forwarded);
      void pump();
    }));
    subscriptions.push(transport.onError?.(() => stop("worker-error")));
    host = createWrappedSdkHost({
      chamber: {
        postMessage: postHostMessage,
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
    host.init({ endpoint, transportTimeoutMs,
      ...(experimentalPageViewData === true ? { experimentalPageViewData: true } : {}),
      ...(experimentalRouting === true ? { experimentalRouting: true } : {}),
      ...(experimentalMultiPixelRouting === true ? { experimentalMultiPixelRouting: true } : {}),
      ...(experimentalEvents === true ? { experimentalEvents: true } : {}),
      ...(experimentalScalarEventData === true ? { experimentalScalarEventData: true } : {}),
      ...(experimentalContentIds === true ? { experimentalContentIds: true } : {}) });
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
