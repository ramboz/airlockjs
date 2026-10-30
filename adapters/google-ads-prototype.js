import { createWrappedSdkHost } from "../core/wrapped-sdk-host.js";
import { resolveConsent } from "../core/consent.js";
import { snapshotDestinationSelectors } from "../connectors/google-ads/destination-selectors.js";
import { CONSENT_COMMAND_KEYS, validConsentCommand } from "../connectors/google-ads/consent-commands.js";
import { validBootstrapCommand } from "../connectors/google-ads/bootstrap-command.js";

const PARAM_KEYS = ["send_to", "value", "currency", "transaction_id"];
const LIMIT = 256;
const DATA_LAYER_LIMIT = 128;
const dateIntrinsics = (() => {
  try {
    return {
      getTime: Object.getOwnPropertyDescriptor(Date.prototype, "getTime")?.value,
      source: Object.getOwnPropertyDescriptor(Function.prototype, "toString")?.value,
      apply: Reflect.apply,
    };
  } catch { return undefined; }
})();
function dateTimeValue(value) {
  const { getTime, source, apply } = dateIntrinsics || {};
  if (typeof getTime !== "function" || typeof source !== "function" || typeof apply !== "function" ||
      apply(source, getTime, []) !== "function getTime() { [native code] }") return undefined;
  return apply(getTime, value, []);
}
const FAILURES = new Set([
  "transport-timeout", "transport-failed", "invalid-transport-response", "invalid-command-order",
  "duplicate-worker-init", "worker-configuration-failed", "unsupported-worker-message",
]);
const REASONS = new Set([
  "connector-not-initialized", "unsupported-command", "unsupported-config", "synthetic-destination-required",
  "duplicate-config", "conversion-before-config", "unsupported-parameters", "synthetic-selector-required",
  "unsupported-value", "unsupported-currency", "unsupported-transaction", "invalid-context",
  "encoded-context-limit", "held-at-seal", "transport-failed", "destination-mismatch", "unsupported-bootstrap",
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

const DATA_LAYER_CHANGED = Symbol("data-layer-changed");

function dataValue(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !Object.hasOwn(descriptor, "value")) throw new Error("invalid-data-layer");
  return descriptor.value;
}

function snapshotDataLayer(layer, previous = []) {
  if (!Array.isArray(layer) || Object.getPrototypeOf(layer) !== Array.prototype) throw new Error("invalid-data-layer");
  const length = dataValue(layer, "length");
  if (!Number.isInteger(length) || length < 0 || length > DATA_LAYER_LIMIT) throw new Error("invalid-data-layer");
  if (length < previous.length) throw DATA_LAYER_CHANGED;
  const entries = [];
  const commands = [];
  for (let index = 0; index < length; index += 1) {
    const entry = dataValue(layer, String(index));
    if (index < previous.length && entry !== previous[index]) throw DATA_LAYER_CHANGED;
    entries.push(entry);
    if (index < previous.length) continue;
    if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
        Object.getPrototypeOf(entry) !== Object.prototype) throw new Error("invalid-data-layer");
    const count = dataValue(entry, "length");
    if (!Number.isInteger(count) || count < 0 || count > 3) throw new Error("invalid-data-layer");
    const args = [];
    for (let position = 0; position < count; position += 1) args.push(dataValue(entry, String(position)));
    commands.push({ entry, args });
  }
  if (dataValue(layer, "length") !== length) throw new Error("invalid-data-layer");
  for (const [index, entry] of entries.entries()) {
    if (dataValue(layer, String(index)) !== entry) throw new Error("invalid-data-layer");
  }
  for (const { entry, args } of commands) {
    if (dataValue(entry, "length") !== args.length) throw new Error("invalid-data-layer");
    for (const [index, arg] of args.entries()) {
      if (!Object.is(dataValue(entry, String(index)), arg)) throw new Error("invalid-data-layer");
    }
  }
  return { entries, commands };
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
  endpoint, additionalEndpoint, chamber, captureContext = () => ({ pageURL: document.URL, referrer: document.referrer }),
  consent = null, queueLimit = 32, initTimeoutMs = 2000, commandTimeoutMs = 2000,
  transportTimeoutMs = 1000, fetchImpl = globalThis.fetch,
  experimentalRouting = false, experimentalParameterScopes = false, experimentalCallbacks = false,
  experimentalMultiDestination = false, experimentalConsentCommands = false, experimentalBootstrap = false,
  experimentalDataLayer = false,
} = {}) {
  if (typeof experimentalRouting !== "boolean" || typeof experimentalParameterScopes !== "boolean" ||
      typeof experimentalCallbacks !== "boolean" || typeof experimentalMultiDestination !== "boolean" ||
      typeof experimentalConsentCommands !== "boolean" || typeof experimentalBootstrap !== "boolean" ||
      typeof experimentalDataLayer !== "boolean" ||
      (experimentalMultiDestination && !experimentalRouting)) throw new Error("invalid-experimental-option");
  const pattern = experimentalRouting === true
    ? /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/pagead\/conversion\/(\d{1,32})\/$/
    : /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/pagead\/conversion\/0000000000\/$/;
  const match = typeof endpoint === "string" && endpoint.match(pattern);
  if (!match || Number(match[1]) > 65535) throw new Error("literal-loopback-endpoint-required");
  const second = experimentalMultiDestination && typeof additionalEndpoint === "string" && additionalEndpoint.match(pattern);
  if (experimentalMultiDestination && (!second || Number(second[1]) > 65535 || match[2] === second[2])) {
    throw new Error("literal-loopback-endpoint-required");
  }
  const endpoints = experimentalMultiDestination ? [endpoint, additionalEndpoint] : [endpoint];
  const routes = experimentalMultiDestination ? new Map([[`AW-${match[2]}`, endpoint], [`AW-${second[2]}`, additionalEndpoint]]) : null;
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
  const hostConsent = { ad_storage: consent?.ad_storage };
  const tagDefaults = Object.create(null);
  const tagUpdates = Object.create(null);
  const pendingDenials = new Set();
  const appliedDenials = new Set();
  const tagConsent = (purpose) => resolveConsent(
    Object.hasOwn(tagUpdates, purpose) ? tagUpdates : tagDefaults, purpose,
  );
  const consentVector = {
    get ad_storage() {
      const hostValue = resolveConsent(hostConsent, "ad_storage");
      if (hostValue !== "granted" || !experimentalConsentCommands) return hostValue;
      if (pendingDenials.size || appliedDenials.size) return "denied";
      if (CONSENT_COMMAND_KEYS.some((purpose) => purpose !== "ad_storage" && tagConsent(purpose) === "denied")) return "denied";
      return tagConsent("ad_storage");
    },
  };
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
  let activeRequests;
  let activeSelectors;
  let lastRequestId = 0;
  let awaitingResult = false;
  let finishCurrent;
  let initTimer;
  let closed;
  let transport;
  let host;
  let dataLayerSource;
  let dataLayerEntries = [];
  let drainingDataLayer = false;

  function record(outcome) {
    if (outcomes.length === LIMIT) { outcomes.shift(); truncated += 1; }
    outcomes.push(outcome);
  }
  function getState() {
    const state = host?.getState();
    return {
      experimental: true, phase, terminalReason, cleanupFailure, queued: queue.length, inFlight, truncated,
      outcomes: outcomes.map((entry) => ({
        ...entry,
        ...(entry.branches ? { branches: entry.branches.map((branch) => ({ ...branch })) } : {}),
        ...(entry.unmodeledPurposes ? { unmodeledPurposes: [...entry.unmodeledPurposes] } : {}),
      })).sort((a, b) => a.seq - b.seq),
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
  function branchOutcome(request, index) {
    if (!request) return { index, disposition: "not-attempted" };
    if (!request.response) return { index, disposition: "unknown" };
    const { status, held } = request.response;
    const disposition = held ? "held" : status >= 200 && status < 300 ? "transport-settled" : "failed";
    const reason = held ? "held-at-seal" : status === 0 ? "transport-failed" : undefined;
    return { index, disposition, status, ...(reason ? { reason } : {}) };
  }
  function branchOutcomes() {
    if (!experimentalMultiDestination || !activeSelectors || activeSelectors.length > 2) return undefined;
    return activeSelectors.map((_selector, index) => branchOutcome(activeRequests[index], index));
  }
  function matchesHostResponse(summary) {
    if (summary.requests === 0) {
      return !activeRequest && ["configured", "scope-updated", "rejected",
        ...(experimentalBootstrap ? ["bootstrap-accepted"] : []),
        ...(experimentalConsentCommands ? ["consent-updated"] : [])].includes(summary.disposition) &&
        (activeCommand?.[0] !== "js" || !experimentalBootstrap || summary.disposition === "bootstrap-accepted") &&
        (activeCommand?.[0] !== "consent" || !experimentalConsentCommands || summary.disposition === "consent-updated") &&
        (summary.disposition !== "configured" || activeCommand?.[0] === "config") &&
        (summary.disposition !== "scope-updated" || activeCommand?.[0] === "set") &&
        (summary.disposition !== "bootstrap-accepted" ||
          (experimentalBootstrap && validBootstrapCommand(activeCommand) && summary.reason === undefined &&
            Object.keys(summary).every((key) => ["seq", "disposition", "requests"].includes(key)))) &&
        (summary.disposition !== "consent-updated" ||
          (experimentalConsentCommands && summary.reason === undefined && validConsentCommand(activeCommand))) &&
        summary.status === undefined && summary.terminal === undefined && summary.branches === undefined;
    }
    if (experimentalMultiDestination) {
      if (activeCommand?.[0] !== "event" || activeCommand?.[1] !== "conversion" ||
          !activeSelectors?.length || activeSelectors.length > 2 || activeRequests.length !== summary.requests ||
          activeRequests.some((request) => !request.response) || !Array.isArray(summary.branches) ||
          summary.branches.length !== activeSelectors.length || summary.status !== undefined || summary.reason !== undefined) return false;
      const branches = branchOutcomes();
      const interrupted = branches.some((branch) => branch.reason === "transport-failed");
      if ((!interrupted && activeRequests.length !== activeSelectors.length) ||
          (interrupted && branches[activeRequests.length - 1]?.reason !== "transport-failed") ||
          summary.terminal !== (interrupted ? true : undefined)) return false;
      for (const [index, branch] of branches.entries()) {
        const reported = summary.branches[index];
        if (!reported || reported.index !== branch.index || reported.disposition !== branch.disposition ||
            reported.status !== branch.status || reported.reason !== branch.reason) return false;
      }
      const dispositions = new Set(branches.map(({ disposition }) => disposition));
      return summary.disposition === (dispositions.size === 1 ? branches[0].disposition : "partial");
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
    dataLayerSource = undefined;
    dataLayerEntries = [];
    clearTimeout(initTimer);
    for (const unsubscribe of subscriptions) {
      try { unsubscribe?.(); } catch { cleanupFailure = "listener-dispose-failed"; }
    }
    for (const controller of controllers) {
      try { controller.abort(); } catch { cleanupFailure = "transport-abort-failed"; }
    }
    finishCurrent?.({ failure: reason });
    for (const event of queue.splice(0)) record({ seq: event.seq, disposition: "rejected", reason });
    pendingDenials.clear();
    appliedDenials.clear();
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
        !endpoints.some((value) => request.url.startsWith(`${value}?`)) || request.url.includes("#")) throw new Error("literal-loopback-policy");
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
      activeRequests = [];
      const eventParams = activeCommand?.[0] === "event" && activeCommand?.[1] === "conversion" ? activeCommand?.[2] : undefined;
      const sendTo = eventParams && Object.hasOwn(eventParams, "send_to") ? eventParams.send_to : undefined;
      activeSelectors = experimentalMultiDestination && (typeof sendTo === "string" || Array.isArray(sendTo))
        ? (Array.isArray(sendTo) ? sendTo : [sendTo]) : undefined;
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
        const branches = branchOutcomes();
        record({ seq: event.seq, disposition: "rejected", reason: settled.failure, ...(branches ? { branches } : {}) });
        stop(settled.failure);
      } else {
        const summary = settled.result.summary;
        if (summary.disposition === "consent-updated") {
          Object.assign(activeCommand[1] === "default" ? tagDefaults : tagUpdates, activeCommand[2]);
          for (const [purpose, value] of Object.entries(activeCommand[2])) {
            if (value === "denied") appliedDenials.add(purpose);
            else appliedDenials.delete(purpose);
          }
          pendingDenials.delete(event.seq);
        }
        record({
          seq: event.seq, disposition: summary.disposition, requests: summary.requests,
          ...(Number.isInteger(summary.status) ? { status: summary.status } : {}),
          ...(summary.reason ? { reason: REASONS.has(summary.reason) ? summary.reason : "worker-rejected" } : {}),
          ...(experimentalMultiDestination && summary.branches ? { branches: branchOutcomes() } : {}),
          ...(summary.disposition === "consent-updated"
            ? { unmodeledPurposes: Object.keys(activeCommand[2]).filter((key) => key !== "ad_storage") } : {}),
        });
        if (summary.terminal) stop("transport-failed");
      }
      inFlight = false;
      awaitingResult = false;
      activeSequence = undefined;
      activeCommand = undefined;
      activeRequest = undefined;
      activeRequests = undefined;
      activeSelectors = undefined;
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
      if (experimentalBootstrap && args[0] === "js") {
        if (args.length !== 2) { reject("unsupported-bootstrap"); return; }
        let timestamp;
        try { timestamp = dateTimeValue(args[1]); } catch { /* Invalid Date brands are rejected below. */ }
        if (!validBootstrapCommand(["js", timestamp])) { reject("unsupported-bootstrap"); return; }
        captured.push("js", timestamp);
      } else for (const [index, arg] of args.entries()) {
        if (primitive(arg, 2048)) { captured.push(arg); continue; }
        if ((index !== 2 && !(experimentalParameterScopes && index === 1)) ||
            !arg || typeof arg !== "object" || Array.isArray(arg)) {
          reject("unsupported-argument"); return;
        }
        if (![Object.prototype, null].includes(Object.getPrototypeOf(arg))) { reject("unsupported-parameters"); return; }
        const keys = Reflect.ownKeys(arg);
        const consentCommand = experimentalConsentCommands && index === 2 && args[0] === "consent";
        const allowedKeys = consentCommand ? CONSENT_COMMAND_KEYS : PARAM_KEYS;
        const allowCallback = experimentalCallbacks && index === 2 && args[0] === "event" && args[1] === "conversion";
        const callbackKeys = allowCallback ? ["event_callback", "event_timeout"] : [];
        if (keys.length > 4 + callbackKeys.length ||
            keys.some((key) => !allowedKeys.includes(key) && !callbackKeys.includes(key))) { reject("unsupported-parameters"); return; }
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
          if (!descriptor || !Object.hasOwn(descriptor, "value")) { reject("unsupported-parameters"); return; }
          if (experimentalMultiDestination && key === "send_to" && Array.isArray(descriptor.value)) {
            const values = snapshotDestinationSelectors(descriptor.value);
            if (!values) { reject("unsupported-parameters"); return; }
            params[key] = values;
            continue;
          }
          if (!primitive(descriptor.value, 2048)) {
            reject("unsupported-parameters"); return;
          }
          params[key] = descriptor.value;
        }
        captured.push(params);
      }
      if (experimentalConsentCommands && captured[0] === "consent" && !validConsentCommand(captured)) {
        reject("unsupported-consent"); return;
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
      if (experimentalConsentCommands && payload.args[0] === "consent" &&
          Object.values(payload.args[2]).includes("denied")) pendingDenials.add(seq);
      admitted += 1;
      void pump();
    } catch { reject("capture-unavailable"); }
    finally { capturing = false; }
  }
  function drainDataLayer(layer) {
    if (phase === "terminal" || phase === "disposed") throw new Error("prototype-unavailable");
    if (drainingDataLayer || capturing) throw new Error("data-layer-reentrant");
    if (dataLayerSource && layer !== dataLayerSource) throw new Error("data-layer-changed");
    drainingDataLayer = true;
    try {
      let snapshot, failure;
      try { snapshot = snapshotDataLayer(layer, dataLayerEntries); }
      catch (error) { failure = error === DATA_LAYER_CHANGED ? "data-layer-changed" : "invalid-data-layer"; }
      if (failure) throw new Error(failure);
      if (phase === "terminal" || phase === "disposed") throw new Error("prototype-unavailable");
      dataLayerSource = layer;
      dataLayerEntries = snapshot.entries;
      for (const { args } of snapshot.commands) gtag(...args);
    } finally { drainingDataLayer = false; }
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
        if (summary.disposition === "bootstrap-accepted" &&
            (!Array.isArray(message.ready) || message.ready.length !== 0 ||
              Object.keys(message).some((key) => !["type", "summary", "ready"].includes(key)))) {
          stop("result-transport-mismatch"); return;
        }
        if (!["configured", "rejected", "held", "transport-settled", "failed",
          ...(experimentalMultiDestination ? ["partial"] : []),
          ...(experimentalConsentCommands ? ["consent-updated"] : []),
          ...(experimentalBootstrap ? ["bootstrap-accepted"] : []),
          ...(experimentalParameterScopes ? ["scope-updated"] : [])].includes(summary.disposition) ||
            !(experimentalMultiDestination ? [0, 1, 2] : [0, 1]).includes(summary.requests) ||
            (summary.status !== undefined && (!Number.isInteger(summary.status) || summary.status < 0 || summary.status > 599))) {
          stop("invalid-worker-result"); return;
        }
        if (!matchesHostResponse(summary)) { stop("result-transport-mismatch"); return; }
        awaitingResult = false;
      }
      if (message?.type === "intercepted-fetch") {
        if (!inFlight || !awaitingResult || activeCommand?.[0] !== "event" || activeCommand?.[1] !== "conversion" ||
            (experimentalMultiDestination
              ? !activeSelectors || message.index !== activeRequests.length || message.index >= activeSelectors.length ||
                (activeRequest && (!activeRequest.response ||
                  (activeRequest.response.status === 0 && !activeRequest.response.held)))
              : activeRequest) || !Number.isSafeInteger(message.id) || message.id <= lastRequestId) {
          stop("request-correlation-failed"); return;
        }
        if (experimentalMultiDestination) {
          const selectors = activeSelectors.map((value) => typeof value === "string" &&
            value.match(/^(AW-\d{1,32})\/([A-Za-z0-9_-]{1,128})$/));
          const destinations = selectors.map((value) => value?.[1]);
          if (selectors.some((value) => !value || !routes.has(value[1])) ||
              new Set(destinations).size !== destinations.length) {
            stop("request-correlation-failed"); return;
          }
          const selector = selectors[message.index];
          const expected = selector && routes.get(selector[1]);
          let valid = false;
          try {
            if (typeof message.url === "string" && message.url.length <= 8192) {
              const url = new URL(message.url);
              valid = !!expected && message.url.startsWith(`${expected}?`) && !message.url.includes("#") &&
                url.searchParams.getAll("label").length === 1 && url.searchParams.get("label") === selector[2];
            }
          } catch { /* Invalid worker URL is rejected before dispatch. */ }
          if (!valid) { stop("request-correlation-failed"); return; }
        }
        lastRequestId = message.id;
        activeRequest = { id: message.id };
        activeRequests.push(activeRequest);
      }
      if (message?.type === "intercepted-fetch" &&
          (message.method !== "GET" || Object.keys(message).some((key) => !["type", "id", "url", "method", ...(experimentalMultiDestination ? ["index"] : [])].includes(key)))) {
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
      caps: { egress: { dispatch } }, endpointCeiling: endpoints, consent: consentVector,
      egressPurposes: ["ad_storage"], grantedCookieNames: [], timeoutMs: transportTimeoutMs, onDiagnostic() {},
    });
    initTimer = setTimeout(() => stop("init-timeout"), initTimeoutMs);
    host.init({ endpoint, transportTimeoutMs,
      ...(experimentalRouting === true ? { experimentalRouting: true } : {}),
      ...(experimentalParameterScopes === true ? { experimentalParameterScopes: true } : {}),
      ...(experimentalConsentCommands === true ? { experimentalConsentCommands: true } : {}),
      ...(experimentalBootstrap === true ? { experimentalBootstrap: true } : {}),
      ...(experimentalMultiDestination ? { additionalEndpoint, experimentalMultiDestination: true } : {}) });
  } catch { stop("worker-unavailable"); }
  return {
    gtag, getState,
    ...(experimentalDataLayer ? { drainDataLayer } : {}),
    flush() {
      if (!queue.length && !inFlight && !callbacks.size) return Promise.resolve(getState());
      if (waiters.size >= 16) return Promise.resolve({ ...getState(), flush: "waiter-limit" });
      return new Promise((resolve) => waiters.add(resolve));
    },
    setConsent(vector) {
      if (phase !== "terminal" && phase !== "disposed") hostConsent.ad_storage = vector?.ad_storage;
    },
    async dispose() { stop("disposed", true); await closed; },
  };
}
