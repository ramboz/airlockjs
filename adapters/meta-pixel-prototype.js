import { createWrappedSdkHost } from "../core/wrapped-sdk-host.js";
import { snapshotPageViewData } from "../connectors/meta-pixel/pageview-data.js";
import { snapshotEventOptions } from "../connectors/meta-pixel/event-options.js";
import { createSyntheticIdentityFixtures, snapshotSyntheticIdentity } from "../connectors/meta-pixel/synthetic-identity.js";
import { snapshotInitAgentOptions } from "../connectors/meta-pixel/agent-options.js";
import { snapshotLiveBinding, snapshotOwnedPocBinding } from "../connectors/meta-pixel/pageview-prototype.js";
import { SYNTHETIC_META_PIXEL_ID } from "../connectors/pixel/vendors/meta.js";
import { createCookieCapability } from "./eds/cookies.js";

const CONTEXT_KEYS = ["pageURL", "referrer", "inFrame", "screenWidth", "screenHeight", "timezoneOffset"];
const PERFORMANCE_KEYS = [
  "performanceModernAvailable", "performanceNavigationEntryAvailable",
  "performanceStartTime", "performanceDomContentLoadedEventEnd", "performanceNavigationStart",
];
const HISTORY_LIMIT = 256;
const WORKER_FAILURES = new Set([
  "transport-timeout", "transport-failed", "invalid-transport-response", "invalid-command-order",
  "duplicate-worker-init", "worker-configuration-failed", "unsupported-worker-message",
  "cookie-timeout", "invalid-cookie-response",
  "storage-timeout", "invalid-storage-response", "invalid-referrer-invalidation",
  "invalid-referrer-message",
]);
const MULTI_REJECTIONS = new Set([
  "unsupported-command", "invalid-pixel-id", "synthetic-pixel-required", "duplicate-init", "pixel-limit",
  "unsupported-standard-event", "invalid-custom-event", "pageview-before-init", "event-before-init",
  "uninitialized-pixel", "invalid-context", "unsupported-parameters", "unsupported-options", "encoded-context-limit",
  "unsupported-identity", "identity-hash-failed", "unsupported-agent", "unsupported-init-options",
  "cookie-access-failed",
  "invalid-referrer-state", "referrer-consent-held", "storage-access-failed", "referrer-readback-mismatch",
]);

function snapshotPerformanceContext(source) {
  if (!source || typeof source !== "object") return null;
  const result = {};
  for (const key of PERFORMANCE_KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    result[key] = descriptor.value;
  }
  const { performanceModernAvailable: modern, performanceNavigationEntryAvailable: entry,
    performanceStartTime: start, performanceDomContentLoadedEventEnd: end,
    performanceNavigationStart: legacy } = result;
  const number = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1e15;
  if (typeof modern !== "boolean" || typeof entry !== "boolean") return null;
  if (modern) {
    if (legacy !== null || (entry ? !number(start) || !number(end) : start !== null || end !== null)) return null;
  } else if (entry || start !== null || !((end === null && legacy === null) || (number(end) && number(legacy)))) return null;
  return result;
}

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
    if (record.disposition === "consent-updated") {
      return command === "consent" && record.requests === 0 && exactKeys(record, ["seq", "disposition", "requests"])
        ? { seq, disposition: "consent-updated", requests: 0 } : null;
    }
    if (record.disposition === "agent-updated") {
      return command === "set" && record.requests === 0 && exactKeys(record, ["seq", "disposition", "requests"])
        ? { seq, disposition: "agent-updated", requests: 0 } : null;
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

function validateSingleSummary(summary, seq, command, referrer = false) {
  try {
    const record = dataRecord(summary, ["seq", "disposition", "requests", "reason", "status", "terminal", "referrerDisposition"]);
    if (!record || record.seq !== seq) return null;
    if (["initialized", "consent-updated", "agent-updated"].includes(record.disposition)) {
      const expected = command === "init" ? "initialized" :
        command === "consent" ? "consent-updated" : command === "set" ? "agent-updated" : null;
      const needsReferrer = referrer && command === "init";
      const keys = ["seq", "disposition", "requests", ...(needsReferrer ? ["referrerDisposition"] : [])];
      return record.disposition === expected && record.requests === 0 &&
        exactKeys(record, keys) && (!needsReferrer ||
          ["sampled", "storage-unavailable", "platform-ineligible", "consent-held"].includes(record.referrerDisposition))
        ? { ...record } : null;
    }
    if (record.disposition === "rejected") {
      return command !== "consent" && record.requests === 0 && MULTI_REJECTIONS.has(record.reason) &&
        exactKeys(record, ["seq", "disposition", "requests", "reason"])
        ? { seq, disposition: "rejected", requests: 0, reason: record.reason } : null;
    }
    if (!["track", "trackCustom"].includes(command) || record.requests !== 1 || !Number.isInteger(record.status)) return null;
    const held = record.status === 0 && record.disposition === "held" && record.reason === "held-at-seal";
    const transportFailed = record.status === 0 && record.disposition === "failed" &&
      ["transport-failed", "transport-aborted", "transport-timeout", "policy-rejected"].includes(record.reason) && record.terminal === true;
    const unavailable = record.status === 0 && record.disposition === "response-unavailable";
    const settled = record.status >= 200 && record.status < 300 && record.disposition === "transport-settled";
    const httpFailed = record.status >= 100 && record.status <= 599 &&
      !(record.status >= 200 && record.status < 300) && record.disposition === "failed";
    if (!(held || transportFailed || unavailable || settled || httpFailed)) return null;
    const keys = ["seq", "disposition", "requests", "status"];
    if (held || transportFailed) keys.push("reason");
    if (transportFailed) keys.push("terminal");
    return exactKeys(record, keys) ? { ...record } : null;
  } catch {
    return null;
  }
}

function capturePageContext(includePerformance = false) {
  const context = {
    pageURL: document.URL,
    referrer: document.referrer,
    inFrame: window.self !== window.top,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    timezoneOffset: new Date().getTimezoneOffset(),
  };
  if (includePerformance) {
    const perf = globalThis.performance;
    const method = perf?.getEntriesByType;
    const modern = method !== undefined && method !== null;
    let entry = null;
    let legacy = null;
    if (modern) {
      if (typeof method !== "function") throw new Error("invalid-performance-api");
      const entries = method.call(perf, "navigation");
      if (!Array.isArray(entries)) throw new Error("invalid-navigation-entries");
      if (entries.length) {
        entry = entries[0];
        if (!entry || typeof entry !== "object") throw new Error("invalid-navigation-entry");
      }
    } else {
      legacy = perf?.timing ?? null;
      if (legacy !== null && typeof legacy !== "object") throw new Error("invalid-legacy-timing");
    }
    Object.assign(context, {
      performanceModernAvailable: modern,
      performanceNavigationEntryAvailable: entry !== null,
      performanceStartTime: entry === null ? null : entry.startTime,
      performanceDomContentLoadedEventEnd: entry !== null ? entry.domContentLoadedEventEnd :
        legacy !== null ? legacy.domContentLoadedEventEnd : null,
      performanceNavigationStart: legacy === null ? null : legacy.navigationStart,
    });
  }
  return context;
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

async function boundedResponse(response, check) {
  const body = response.body;
  check?.();
  if (!body) return "";
  const getReader = body.getReader;
  check?.();
  const reader = Reflect.apply(getReader, body, []);
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    check?.();
    for (;;) {
      const read = reader.read;
      check?.();
      const result = await Reflect.apply(read, reader, []);
      check?.();
      const { value, done } = result;
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

async function cancelLiveBody(response, signal, timedOut) {
  let onAbort;
  try {
    const body = response.body;
    if (!body) return "not-present";
    if (signal.aborted) return timedOut() ? "timeout" : "aborted";
    const aborted = new Promise((resolve) => {
      onAbort = () => resolve(timedOut() ? "timeout" : "aborted");
      signal.addEventListener("abort", onAbort, { once: true });
    });
    return await Promise.race([
      Promise.resolve().then(() => body.cancel()).then(() => "cancelled", () => "failed"),
      aborted,
    ]);
  } catch {
    return "failed";
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort);
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
  liveBinding,
  ownedPocBinding,
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
  experimentalContentNameArray = false,
  experimentalContentIds = false,
  experimentalContents = false,
  experimentalContentsItemPrice = false,
  experimentalCustomProperties = false,
  experimentalNumericOrderId = false,
  experimentalEventIds = false,
  experimentalSetAgent = false,
  experimentalInitAgent = false,
  experimentalMagentoHeadArray = false,
  experimentalNullPurchaseValue = false,
  experimentalEmptyCheckoutValue = false,
  experimentalFalseCheckoutContentId = false,
  experimentalViewContentJsonStrings = false,
  experimentalSyntheticAdvancedMatching = false,
  experimentalTagConsent = false,
  experimentalFirstPartyCookie = false,
  experimentalPageViewPreparation = false,
  experimentalPageViewPerformance = false,
  experimentalPageViewReferrer = false,
  referrerStorageBinding,
  cookieDocument = typeof document !== "undefined" ? document : undefined,
} = {}) {
  const features = [experimentalPageViewData, experimentalRouting, experimentalMultiPixelRouting, experimentalEvents,
    experimentalScalarEventData, experimentalContentNameArray, experimentalContentIds, experimentalContents,
    experimentalContentsItemPrice, experimentalCustomProperties,
    experimentalNumericOrderId, experimentalEventIds, experimentalSetAgent, experimentalInitAgent, experimentalMagentoHeadArray,
    experimentalNullPurchaseValue, experimentalEmptyCheckoutValue, experimentalFalseCheckoutContentId,
    experimentalViewContentJsonStrings,
    experimentalSyntheticAdvancedMatching, experimentalTagConsent, experimentalFirstPartyCookie, experimentalPageViewPreparation,
    experimentalPageViewPerformance, experimentalPageViewReferrer];
  if (features.some((option) => typeof option !== "boolean")) {
    throw new Error("invalid-experimental-option");
  }
  if (liveBinding !== undefined && ownedPocBinding !== undefined) throw new Error("incompatible-live-binding");
  const owned = ownedPocBinding === undefined ? null : snapshotOwnedPocBinding(ownedPocBinding, endpoint);
  const live = liveBinding === undefined ? owned : snapshotLiveBinding(liveBinding, endpoint);
  if (live && features.some(Boolean)) throw new Error("incompatible-live-feature");
  if (live && referrerStorageBinding !== undefined) throw new Error("incompatible-live-feature");
  if (!experimentalPageViewReferrer && referrerStorageBinding !== undefined) throw new Error("referrer-binding-without-feature");
  if (experimentalPageViewReferrer && (experimentalRouting || experimentalMultiPixelRouting || experimentalEvents ||
      experimentalSyntheticAdvancedMatching || experimentalInitAgent)) throw new Error("incompatible-referrer-feature");
  let referrerBinding;
  if (experimentalPageViewReferrer) {
    const binding = dataRecord(referrerStorageBinding, ["origin", "window"]);
    const origin = binding?.origin;
    const originMatch = typeof origin === "string" && origin.match(/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})$/);
    if (!binding || !exactKeys(binding, ["origin", "window"]) || !originMatch || Number(originMatch[1]) > 65535 ||
        new URL(origin).origin !== origin ||
        !binding.window || typeof binding.window !== "object") throw new Error("invalid-referrer-binding");
    referrerBinding = { origin, window: binding.window };
  }
  if (experimentalMultiPixelRouting && !experimentalRouting) throw new Error("multi-pixel-routing-requires-routing");
  if (experimentalScalarEventData && !experimentalPageViewData) throw new Error("scalar-data-requires-pageview-data");
  if (experimentalContentNameArray && !experimentalScalarEventData) throw new Error("content-name-array-requires-scalar-data");
  if (experimentalContentIds && !experimentalPageViewData) throw new Error("content-ids-require-pageview-data");
  if (experimentalContents && !experimentalPageViewData) throw new Error("contents-require-pageview-data");
  if (experimentalContentsItemPrice && !experimentalContents) throw new Error("item-price-requires-contents");
  if (experimentalCustomProperties && !experimentalPageViewData) throw new Error("custom-properties-require-pageview-data");
  if (experimentalNumericOrderId && !experimentalCustomProperties) throw new Error("numeric-order-id-requires-custom-properties");
  if (experimentalEventIds && !experimentalPageViewData) throw new Error("event-ids-require-pageview-data");
  if (experimentalNullPurchaseValue && (!experimentalEvents || !experimentalPageViewData)) {
    throw new Error("null-purchase-value-requires-events-and-pageview-data");
  }
  if (experimentalEmptyCheckoutValue && (!experimentalEvents || !experimentalPageViewData)) {
    throw new Error("empty-checkout-value-requires-events-and-pageview-data");
  }
  if (experimentalFalseCheckoutContentId &&
      (!experimentalEvents || !experimentalPageViewData || !experimentalContentIds || !experimentalContents)) {
    throw new Error("false-checkout-content-id-requires-events-and-commerce-data");
  }
  if (experimentalViewContentJsonStrings &&
      (!experimentalEvents || !experimentalPageViewData || !experimentalContentIds || !experimentalContents)) {
    throw new Error("view-content-json-strings-require-events-and-commerce-data");
  }
  if (experimentalSyntheticAdvancedMatching && !experimentalMultiPixelRouting) {
    throw new Error("synthetic-identity-requires-multi-pixel-routing");
  }
  const syntheticIdentityFixtures = experimentalSyntheticAdvancedMatching ? createSyntheticIdentityFixtures() : null;
  const match = typeof endpoint === "string" && endpoint.match(/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/tr\/$/);
  if (!live && (!match || Number(match[1]) > 65535)) throw new Error("literal-loopback-endpoint-required");
  if (!Number.isInteger(queueLimit) || queueLimit < 1 || queueLimit > 128 ||
      ![initTimeoutMs, commandTimeoutMs, transportTimeoutMs].every((n) => Number.isInteger(n) && n >= 10 && n <= 10000)) {
    throw new Error("invalid-prototype-bounds");
  }
  if (live && transportTimeoutMs > 3000) throw new Error("invalid-prototype-bounds");
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
  let activeCookieRequest = null;
  let activeStorageRequest = null;
  let lastStorageRequestId = 0;
  let storageOperations = 0;
  let storageEffects = 0;
  let storageStage = 0;
  let storageInitiallyUnavailable = false;
  let storageResponsesOk = true;
  let pendingReferrerInvalidation = false;
  let lastCookieRequestId = 0;
  let capturing = false;
  let cleanupFailure = null;
  let liveResponse = null;
  let currentFinish;
  let initTimer;
  let closed;
  let host;
  let transport;
  let resolveReadiness;
  const readiness = new Promise((resolve) => { resolveReadiness = resolve; });
  let hostAdStorage = consent?.ad_storage;
  let tagAllowed = true;
  let revokeGeneration = 0;
  const tagSnapshots = new WeakMap();
  const cookieSnapshots = new WeakMap();
  const referrerSnapshots = new WeakMap();
  const liveSnapshots = new WeakMap();
  let liveSpent = false;
  const consentVector = {
    get ad_storage() {
      if (experimentalTagConsent) {
        const snapshot = activeEvent && tagSnapshots.get(activeEvent);
        if (!snapshot?.allowed || snapshot.generation !== revokeGeneration) return "denied";
      }
      if (experimentalFirstPartyCookie && activeEvent) {
        const snapshot = cookieSnapshots.get(activeEvent);
        if (!snapshot?.allowed || snapshot.generation !== revokeGeneration) return "denied";
      }
      if (experimentalPageViewReferrer && activeEvent) {
        const snapshot = referrerSnapshots.get(activeEvent);
        if (!snapshot?.allowed || snapshot.generation !== revokeGeneration) return "denied";
      }
      if (live && activeEvent) {
        const snapshot = liveSnapshots.get(activeEvent);
        if (!snapshot?.allowed || snapshot.generation !== revokeGeneration) return "denied";
      }
      return hostAdStorage;
    },
  };
  const validateWorker = experimentalMultiPixelRouting || experimentalTagConsent || experimentalSetAgent ||
    experimentalInitAgent || experimentalFirstPartyCookie || experimentalPageViewReferrer || Boolean(live);

  function validReferrerCompletion(disposition, event) {
    const admission = referrerSnapshots.get(event);
    const noStorageWork = storageStage === 0 && storageOperations === 0 && storageEffects === 0;
    if (disposition === "consent-held") return admission?.allowed === false && noStorageWork;
    if (!admission?.allowed || admission.generation !== revokeGeneration || consentVector.ad_storage !== "granted") return false;
    if (disposition === "platform-ineligible") return noStorageWork;
    if (disposition === "storage-unavailable") {
      return storageInitiallyUnavailable && storageStage === 1 && storageOperations === 0 && storageEffects === 0;
    }
    if (disposition === "sampled" && storageResponsesOk) {
      return storageStage === 2 && storageOperations === 2 && storageEffects === 0 ||
        storageStage === 5 && storageOperations === 4 && storageEffects === 2 ||
        storageStage === 8 && (storageOperations === 6 && storageEffects === 2 ||
          storageOperations === 8 && storageEffects === 4);
    }
    return false;
  }

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
      ...(live ? { liveResponse: liveResponse && { ...liveResponse } } : {}),
      receipt: "not-observed-by-adapter",
      fullCompatibility: false,
      ...(experimentalPageViewReferrer ? { referrerStorage: { operations: storageOperations, effects: storageEffects } } : {}),
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
    resolveReadiness();
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

  function referrerOriginStatus(current) {
    if (!current()) return "held";
    try {
      const page = new URL(activeEvent.payload.context.pageURL);
      if (!current()) return "held";
      const location = referrerBinding.window.location;
      if (!current()) return "held";
      const origin = location?.origin;
      if (!current()) return "held";
      return page.origin === referrerBinding.origin && origin === referrerBinding.origin ? "ok" : "failed";
    } catch {
      return current() ? "failed" : "held";
    }
  }

  async function dispatch(request) {
    // Literal base comparison additionally rejects normalization tricks that
    // an origin/path ceiling alone intentionally does not cover.
    if (phase !== "ready" || request.method !== "GET" || request.body !== undefined || request.headers !== undefined ||
        typeof request.url !== "string" || request.url.length > 8192 ||
        !request.url.startsWith(`${endpoint}?`) || request.url.includes("#")) {
      throw new Error(live ? "live-policy-rejected" : "literal-loopback-policy");
    }
    if (live) {
      const args = activeEvent?.payload.args;
      const context = activeEvent?.payload.context;
      const query = new URLSearchParams(request.url.slice(endpoint.length + 1));
      const keys = ["id", "ev", "dl", "rl", "if", "sw", "sh", "tz"];
      const expected = [live.pixelId, "PageView", live.documentURL, "", "false",
        String(context?.screenWidth), String(context?.screenHeight), String(-context?.timezoneOffset)];
      if (!inFlight || !args || args.length !== 2 || args[0] !== "track" || args[1] !== "PageView" ||
          context?.pageURL !== live.documentURL || context.referrer !== "" || context.inFrame !== false ||
          ![context.screenWidth, context.screenHeight].every((n) => Number.isInteger(n) && n >= 0 && n <= 32768) ||
          !Number.isInteger(context.timezoneOffset) || Math.abs(context.timezoneOffset) > 1440 ||
          [...query.keys()].length !== keys.length ||
          !keys.every((key, index) => query.getAll(key).length === 1 && query.get(key) === expected[index]) ||
          request.url !== `${endpoint}?${query}` || liveSpent || consentVector.ad_storage !== "granted") {
        throw new Error("live-policy-rejected");
      }
    }
    const controller = new AbortController();
    controllers.add(controller);
    let timedOut = false;
    let policyRejected = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, transportTimeoutMs);
    const event = activeEvent;
    const hostRequest = activeHostRequest;
    const referrerCurrent = () => phase === "ready" && inFlight && activeEvent === event &&
      hostRequest !== null && activeHostRequest === hostRequest && consentVector.ad_storage === "granted" &&
      event?.snapshot?.referrerGeneration === revokeGeneration;
    const checkReferrer = () => {
      if (experimentalPageViewReferrer && referrerOriginStatus(referrerCurrent) !== "ok") {
        throw new Error("loopback-transport-failed");
      }
    };
    try {
      if (owned) {
        const now = Date.now();
        if (now < owned.notBefore || now >= owned.notAfter || consentVector.ad_storage !== "granted") {
          policyRejected = true;
          throw new Error("live-policy-rejected");
        }
      }
      if (live) liveSpent = true;
      checkReferrer();
      const response = await fetchImpl(request.url, {
        method: "GET", credentials: "omit", redirect: "error",
        referrerPolicy: "no-referrer", signal: controller.signal,
        ...(live ? { mode: "cors", cache: "no-store" } : {}),
      });
      checkReferrer();
      if (live && response.type === "opaque" && response.status === 0) {
        liveResponse = { body: "unavailable", headers: "unavailable", cancellation: "not-applicable" };
        return { status: 0, statusText: "live-response-unavailable", body: "", headers: {} };
      }
      if (live) {
        // The worker needs only the status. The protocol's empty string is a
        // placeholder, not a claim that the uncollected response was empty.
        const status = response.status;
        const cancellation = await cancelLiveBody(response, controller.signal, () => timedOut);
        liveResponse = { body: "not-collected", headers: "not-collected", cancellation };
        return { status, statusText: "live-body-not-collected", body: "", headers: {} };
      }
      const body = await boundedResponse(response, experimentalPageViewReferrer ? checkReferrer : undefined);
      checkReferrer();
      return { status: response.status, body, headers: {} };
    } catch {
      throw new Error(policyRejected ? "live-policy-rejected" : live
        ? timedOut ? "live-transport-timeout" : controller.signal.aborted ? "live-transport-aborted" : "live-transport-failed"
        : "loopback-transport-failed");
    } finally {
      clearTimeout(timer);
      controllers.delete(controller);
    }
  }

  async function pump() {
    if (inFlight || phase !== "ready") return;
    while (queue.length && phase === "ready") {
      const event = queue.shift();
      if (experimentalPageViewReferrer && event.snapshot.referrerGeneration !== revokeGeneration) {
        record({ seq: event.seq, disposition: "rejected", reason: "referrer-consent-held" });
        continue;
      }
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
    if (validateWorker && message.type === "intercepted-fetch-response") {
      if (!inFlight || activeHostRequest !== message.id) { stop("invalid-worker-result"); return; }
      if (experimentalPageViewReferrer) {
        const event = activeEvent;
        const current = () => phase === "ready" && inFlight && activeEvent === event &&
          activeHostRequest === message.id && consentVector.ad_storage === "granted" &&
          event?.snapshot?.referrerGeneration === revokeGeneration;
        const status = referrerOriginStatus(current);
        if (phase !== "ready" || !inFlight || activeHostRequest !== message.id) return;
        if (status !== "ok") {
          message = { type: "intercepted-fetch-response", id: message.id, status: 0,
            statusText: status === "held" ? "held at the seal: consent" : "loopback-transport-failed", body: "" };
        }
      }
      const held = message.status === 0 && message.statusText?.startsWith("held at the seal:");
      const unavailable = live && message.status === 0 && message.statusText === "live-response-unavailable";
      activeHostResponses.push({
        status: message.status,
        disposition: held ? "held" : unavailable ? "response-unavailable" :
          message.status >= 200 && message.status < 300 ? "transport-settled" : "failed",
      });
      activeHostRequest = null;
      if (experimentalPageViewReferrer && consentVector.ad_storage !== "granted") {
        message = { type: "intercepted-fetch-response", id: message.id, status: 0,
          statusText: "held at the seal: consent", body: "" };
        activeHostResponses[activeHostResponses.length - 1] = { status: 0, disposition: "held" };
      }
    }
    try { transport.postMessage(message); } catch { stop("transport-post-failed"); }
  }

  function invalidateReferrer() {
    if (!experimentalPageViewReferrer) return;
    for (const event of queue.splice(0)) {
      if (event.snapshot.referrerGeneration !== revokeGeneration) {
        record({ seq: event.seq, disposition: "rejected", reason: "referrer-consent-held" });
      } else queue.push(event);
    }
    settleFlushes();
    if (phase !== "ready") { pendingReferrerInvalidation = true; return; }
    try { transport.postMessage({ type: "invalidate-referrer" }); }
    catch { stop("transport-post-failed"); }
  }

  async function fulfillStorageRequest(message) {
    const allowed = () => phase === "ready" && inFlight && activeStorageRequest === message.id &&
      consentVector.ad_storage === "granted" && activeEvent?.snapshot?.referrerGeneration === revokeGeneration;
    const respond = (status, value) => {
      if (phase !== "ready" || !inFlight || activeStorageRequest !== message.id) return;
      if (status === "unavailable") storageInitiallyUnavailable = true;
      if (status !== "ok") storageResponsesOk = false;
      activeStorageRequest = null;
      postHostMessage({ type: "storage-response", id: message.id, status,
        ...(status === "ok" && message.operation === "get" ? { value } : {}) });
    };
    if (!allowed()) { respond("held"); return; }
    try {
      let originStatus = referrerOriginStatus(allowed);
      if (originStatus !== "ok") { respond(originStatus); return; }
      const backing = referrerBinding.window.localStorage;
      if (!allowed()) { respond("held"); return; }
      if (backing == null) { respond(storageOperations === 0 ? "unavailable" : "failed"); return; }
      const get = backing.getItem;
      if (!allowed()) { respond("held"); return; }
      const set = backing.setItem;
      if (!allowed()) { respond("held"); return; }
      const remove = backing.removeItem;
      if (!allowed()) { respond("held"); return; }
      if (typeof get !== "function" || typeof set !== "function" || typeof remove !== "function") {
        respond(storageOperations === 0 ? "unavailable" : "failed"); return;
      }
      originStatus = referrerOriginStatus(allowed);
      if (originStatus !== "ok") { respond(originStatus); return; }
      storageOperations += 1;
      if (message.operation === "get") {
        const value = await Reflect.apply(get, backing, [message.name]);
        originStatus = referrerOriginStatus(allowed);
        if (originStatus !== "ok") { respond(originStatus); return; }
        if (value !== null && (typeof value !== "string" || value.length > 16 ||
            ![...value].every((character) => character.charCodeAt(0) <= 127))) throw new Error("invalid-storage-value");
        respond("ok", value);
      } else {
        storageEffects += 1;
        if (message.operation === "set") await Reflect.apply(set, backing, [message.name, message.value]);
        else await Reflect.apply(remove, backing, [message.name]);
        originStatus = referrerOriginStatus(allowed);
        if (originStatus !== "ok") { respond(originStatus); return; }
        respond("ok");
      }
    } catch {
      respond(allowed() ? "failed" : "held");
    }
  }

  async function fulfillCookieRequest(message) {
    const respond = (status, value) => {
      if (phase !== "ready" || !inFlight || activeCookieRequest !== message.id) return;
      activeCookieRequest = null;
      postHostMessage({ type: "cookie-response", id: message.id, status,
        ...(status === "ok" && message.operation === "get" ? { value } : {}) });
    };
    const allowed = () => phase === "ready" && inFlight && activeCookieRequest === message.id &&
      consentVector.ad_storage === "granted";
    if (!allowed()) { respond("held"); return; }
    try {
      const location = cookieDocument?.location;
      const page = new URL(activeEvent.payload.context.pageURL);
      if (!cookieDocument || !location || location.hostname !== page.hostname || location.protocol !== page.protocol) {
        throw new Error("cookie-unavailable");
      }
      if (!["http:", "https:"].includes(page.protocol) || page.hostname === "facebook.com" ||
          page.hostname.endsWith(".facebook.com")) throw new Error("cookie-unavailable");
      const backing = createCookieCapability(cookieDocument);
      if (message.operation === "get") {
        const value = await backing.get("_fbp");
        if (!allowed()) { respond("held"); return; }
        if (value !== null && (typeof value !== "string" || value.length > 256)) throw new Error("cookie-invalid");
        respond("ok", value);
      } else {
        const labels = page.hostname.split(".");
        const options = dataRecord(message.options, ["maxAge", "path", "domain", "sameSite"]);
        if (!options || !exactKeys(options, ["maxAge", "path", "domain", "sameSite"]) ||
            options.maxAge !== 7776000 || options.path !== "/" || options.sameSite !== "lax" ||
            !labels.some((_, index) => options.domain === labels.slice(-1 - index).join(".")) ||
            typeof message.value !== "string" || message.value.length > 256 ||
            !message.value.isWellFormed()) throw new Error("cookie-invalid");
        if (!allowed()) { respond("held"); return; }
        await backing.set("_fbp", message.value, options);
        if (!allowed()) { respond("held"); return; }
        respond("ok");
      }
    } catch {
      respond(allowed() ? "failed" : "held");
    }
  }

  function fbq(...args) {
    const seq = ++sequence;
    const reject = (reason) => record({ seq, disposition: "rejected", reason });
    if (capturing) { reject("capture-reentrant"); return; }
    if (phase === "terminal" || phase === "disposed") { reject(phase); return; }
    if (queue.length >= queueLimit) { reject("queue-overflow"); return; }
    // At most four requests per admitted command bound the host's lifetime history.
    if (admitted >= HISTORY_LIMIT) { reject("session-command-limit"); return; }
    if (args.length > (experimentalMultiPixelRouting ? (experimentalEventIds ? 5 : 4) :
      (experimentalEventIds || experimentalSetAgent || experimentalInitAgent ? 4 : 3))) {
      reject("argument-limit"); return;
    }
    const tagCommand = experimentalTagConsent && args[0] === "consent";
    const agentCommand = experimentalSetAgent && args[0] === "set";
    if (experimentalPageViewReferrer && args[0] === "init") {
      if (args.length !== 2) { reject("unsupported-command"); return; }
      if (args[1] !== SYNTHETIC_META_PIXEL_ID) { reject("synthetic-pixel-required"); return; }
    }
    if (tagCommand && (args.length !== 2 || !["revoke", "grant"].includes(args[1]))) {
      reject("unsupported-command"); return;
    }
    const referrerAdmissionAllowed = hostAdStorage === "granted" && tagAllowed;
    const referrerAdmissionGeneration = revokeGeneration;
    const dataIndex = experimentalMultiPixelRouting &&
      (args[0] === "trackSingle" && (experimentalEvents || args[2] === "PageView") ||
       args[0] === "trackSingleCustom" && experimentalEvents)
      ? 3 : args[0] === "track" && (experimentalEvents || args[1] === "PageView") ||
        args[0] === "trackCustom" && experimentalEvents ? 2 : -1;
    const hasOptions = experimentalEventIds && dataIndex >= 0 &&
      ((args[0] === "track" || args[0] === "trackCustom") && args.length === 4 ||
       experimentalMultiPixelRouting && args[0] === "trackSingle" && args.length === 5);
    const hasIdentity = experimentalSyntheticAdvancedMatching && args[0] === "init" && args.length === 3;
    const hasInitAgent = experimentalInitAgent && args[0] === "init" && args.length === 4;
    for (const [index, arg] of args.entries()) {
      if (["function", "symbol"].includes(typeof arg)) { reject("uncloneable-input"); return; }
      if (arg !== null && typeof arg === "object" &&
          !(experimentalPageViewData === true && index === dataIndex) &&
          !(hasOptions && index === dataIndex + 1) && !(hasIdentity && index === 2) &&
          !(hasInitAgent && (index === 2 || index === 3))) {
        reject("unsupported-argument"); return;
      }
      if (typeof arg === "string" && arg.length > 64) { reject("argument-limit"); return; }
    }
    capturing = true;
    try {
      if (experimentalPageViewData === true && dataIndex >= 0 && (args.length === dataIndex + 1 || hasOptions)) {
        const data = snapshotPageViewData(
          args[dataIndex], experimentalScalarEventData, experimentalContentIds, experimentalContents, experimentalCustomProperties,
          experimentalNumericOrderId, experimentalContentsItemPrice, experimentalContentNameArray,
          experimentalNullPurchaseValue && args[0] === "trackCustom" && args[1] === "Purchase",
          experimentalViewContentJsonStrings && args[0] === "track" && args[1] === "ViewContent",
          experimentalMagentoHeadArray && hasOptions && args[0] === "track" && args[1] === "PageView",
          experimentalEmptyCheckoutValue && args[0] === "trackCustom" && args[1] === "InitiateCheckout",
          experimentalFalseCheckoutContentId && args[0] === "trackCustom" && args[1] === "InitiateCheckout",
        );
        if (!data) { reject("unsupported-parameters"); return; }
        args[dataIndex] = data;
      }
      if (hasOptions) {
        const options = snapshotEventOptions(args[dataIndex + 1]);
        if (!options) { reject("unsupported-options"); return; }
        args[dataIndex + 1] = options;
      }
      if (hasIdentity) {
        const identity = snapshotSyntheticIdentity(args[2], syntheticIdentityFixtures);
        if (!identity) { reject("unsupported-identity"); return; }
        args[2] = identity;
      }
      if (hasInitAgent) {
        const options = snapshotInitAgentOptions(args[2], args[3]);
        if (!options) { reject("unsupported-init-options"); return; }
        args[2] = {};
        args[3] = options;
      }
      const context = {};
      const captureTiming = experimentalPageViewPerformance && (args[0] === "init" ||
        (args[0] === "track" && args[1] === "PageView") ||
        (args[0] === "trackSingle" && args[2] === "PageView"));
      if (!tagCommand && !agentCommand && (!hasInitAgent || captureTiming)) {
        const source = captureTiming ? captureContext(true) : captureContext();
        if (experimentalPageViewReferrer) {
          const expected = [...CONTEXT_KEYS, ...(captureTiming ? PERFORMANCE_KEYS : [])];
          const raw = dataRecord(source, expected);
          if (!raw || !exactKeys(raw, expected)) { reject("unsupported-context"); return; }
        }
        for (const key of CONTEXT_KEYS) {
          const descriptor = source && Object.getOwnPropertyDescriptor(source, key);
          if (descriptor?.get || descriptor?.set) { reject("unsupported-context"); return; }
          const value = descriptor?.value;
          if ((value !== null && typeof value === "object") || ["function", "symbol", "bigint"].includes(typeof value) ||
              (typeof value === "string" && value.length > 2048)) { reject("unsupported-context"); return; }
          context[key] = value;
        }
        if (captureTiming) {
          const timing = snapshotPerformanceContext(source);
          if (!timing) { reject("unsupported-context"); return; }
          Object.assign(context, timing);
        }
        if (experimentalPageViewReferrer && referrerAdmissionAllowed &&
            hostAdStorage === "granted" && tagAllowed && referrerAdmissionGeneration === revokeGeneration) {
          let origin;
          try { origin = new URL(context.pageURL).origin; } catch { reject("unsupported-context"); return; }
          if (origin !== referrerBinding.origin) {
            reject("unsupported-context"); return;
          }
          if (args[0] === "init") {
            const location = referrerBinding.window.location;
            if (hostAdStorage !== "granted" || !tagAllowed || referrerAdmissionGeneration !== revokeGeneration) {
              reject("capture-consent-changed"); return;
            }
            if (location?.origin !== referrerBinding.origin) { reject("unsupported-context"); return; }
          }
        }
        if (experimentalPageViewReferrer && args[0] === "init" &&
            referrerAdmissionAllowed && hostAdStorage === "granted" && tagAllowed &&
            referrerAdmissionGeneration === revokeGeneration) {
          const navigator = globalThis.navigator;
          if (hostAdStorage !== "granted" || !tagAllowed || referrerAdmissionGeneration !== revokeGeneration) {
            reject("capture-consent-changed"); return;
          }
          const userAgent = navigator?.userAgent;
          if (typeof userAgent !== "string" || userAgent.length > 1024 || !userAgent.isWellFormed()) {
            reject("unsupported-context"); return;
          }
          if (hostAdStorage !== "granted" || !tagAllowed || referrerAdmissionGeneration !== revokeGeneration) {
            reject("capture-consent-changed"); return;
          }
          context.userAgent = userAgent;
          context.xhrDefined = typeof globalThis.XMLHttpRequest !== "undefined";
        }
      }
      if (experimentalPageViewReferrer && !tagCommand && referrerAdmissionAllowed &&
          (hostAdStorage !== "granted" || !tagAllowed || referrerAdmissionGeneration !== revokeGeneration)) {
        reject("capture-consent-changed"); return;
      }
      const payload = structuredClone({ args, context });
      if (phase === "terminal" || phase === "disposed") { reject(phase); return; }
      if (queue.length >= queueLimit || admitted >= HISTORY_LIMIT) { reject("capture-admission-changed"); return; }
      const event = { type: "meta-pixel-command", seq, ts: performance.now(), payload, snapshot: {} };
      if (tagCommand) {
        tagAllowed = args[1] === "grant";
        if (!tagAllowed) {
          revokeGeneration += 1;
          invalidateReferrer();
          if (experimentalPageViewReferrer) for (const controller of controllers) controller.abort();
        }
      }
      if (experimentalTagConsent) tagSnapshots.set(event, { allowed: tagAllowed, generation: revokeGeneration });
      if (experimentalFirstPartyCookie) {
        cookieSnapshots.set(event, { allowed: hostAdStorage === "granted", generation: revokeGeneration });
      }
      if (experimentalPageViewReferrer) {
        const allowed = tagCommand ? hostAdStorage === "granted" && tagAllowed :
          referrerAdmissionAllowed && hostAdStorage === "granted" && tagAllowed &&
            referrerAdmissionGeneration === revokeGeneration;
        referrerSnapshots.set(event, { allowed, generation: revokeGeneration });
        event.snapshot = { referrerExperiment: true, referrerAllowed: allowed, referrerGeneration: revokeGeneration };
      }
      if (live) liveSnapshots.set(event, { allowed: hostAdStorage === "granted", generation: revokeGeneration });
      queue.push(event);
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
      if (experimentalPageViewReferrer) {
        try {
          const descriptor = message && Object.getOwnPropertyDescriptor(message, "type");
          if (!message || ![Object.prototype, null].includes(Object.getPrototypeOf(message)) ||
              !descriptor || !Object.hasOwn(descriptor, "value") || typeof descriptor.value !== "string") {
            stop("invalid-worker-result"); return;
          }
          const fixedKeys = {
            phase: ["type", "name"],
            fatal: ["type", "message"],
            "intercepted-fetch": ["type", "id", "url", "method"],
            "prototype-node-probe": ["type", "threadId", "ambientFetchDenied"],
          }[descriptor.value];
          if (fixedKeys) {
            const record = dataRecord(message, fixedKeys);
            if (!record || !exactKeys(record, fixedKeys) ||
                (record.type === "phase" && record.name !== "configured")) { stop("invalid-worker-result"); return; }
          } else if (!["result", "cookie-request", "storage-request"].includes(descriptor.value)) {
            stop("invalid-worker-result"); return;
          }
          if (descriptor.value === "cookie-request" &&
              !dataRecord(message, ["type", "id", "operation", "name", "value", "options"])) {
            stop("invalid-worker-result"); return;
          }
        } catch { stop("invalid-worker-result"); return; }
      }
      let forwarded = message;
      if (validateWorker && message?.type === "result") {
        if (!inFlight || !activeEvent || activeResultReceived) { stop("invalid-worker-result"); return; }
        const result = multiResultMessage(message);
        const command = activeEvent.payload.args[0];
        const summary = result && (experimentalMultiPixelRouting
          ? validateMultiSummary(result.summary, activeEvent.seq, command)
          : validateSingleSummary(result.summary, activeEvent.seq, command, experimentalPageViewReferrer));
        if (!summary || activeHostRequest !== null || activeCookieRequest !== null || activeStorageRequest !== null ||
            summary.requests !== activeHostResponses.length ||
            (experimentalPageViewReferrer && command === "init" && summary.disposition === "initialized" &&
              !validReferrerCompletion(summary.referrerDisposition, activeEvent)) ||
            (command === "consent" && experimentalTagConsent && summary.disposition !== "consent-updated") ||
            (!experimentalTagConsent && summary.disposition === "consent-updated") ||
            (!experimentalSetAgent && summary.disposition === "agent-updated") ||
            (summary.branches && summary.branches.some((branch, index) =>
              branch.status !== activeHostResponses[index].status ||
              branch.disposition !== activeHostResponses[index].disposition)) ||
            (!experimentalMultiPixelRouting && summary.requests === 1 &&
              (summary.status !== activeHostResponses[0].status ||
               summary.disposition !== activeHostResponses[0].disposition))) {
          stop("invalid-worker-result"); return;
        }
        activeResultReceived = true;
        forwarded = { type: "result", summary, ready: [] };
      }
      if (message?.type === "fatal") {
        stop(WORKER_FAILURES.has(message.message) ? message.message : "worker-fatal");
        return;
      }
      if (message?.type === "storage-request") {
        let record;
        try { record = dataRecord(message, ["type", "id", "seq", "generation", "operation", "name", "value", "reason"]); }
        catch { stop("invalid-worker-result"); return; }
        const keys = ["type", "id", "seq", "generation", "operation", "name",
          ...(record?.operation === "set" ? ["value"] : []),
          ...(record?.operation === "remove" ? ["reason"] : [])];
        const first = "lastExternalReferrer";
        const second = "lastExternalReferrerTime";
        const step = record && (
          storageStage === 0 && record.operation === "get" && record.name === first ? 1 :
          storageStage === 1 && record.operation === "get" && record.name === second ? 2 :
          storageStage === 2 && record.operation === "remove" && record.name === first ? 3 :
          storageStage === 3 && record.operation === "remove" && record.name === second ? 5 :
          (storageStage === 2 || storageStage === 5) && record.operation === "set" && record.name === first ? 4 :
          storageStage === 4 && record.operation === "set" && record.name === second ? 6 :
          storageStage === 6 && record.operation === "get" && record.name === first ? 7 :
          storageStage === 7 && record.operation === "get" && record.name === second ? 8 : 0);
        const valid = experimentalPageViewReferrer && storageResponsesOk && record && exactKeys(record, keys) && step &&
          inFlight && activeEvent?.payload.args[0] === "init" && !activeResultReceived &&
          activeStorageRequest === null && activeCookieRequest === null && activeHostRequest === null &&
          record.id === lastStorageRequestId + 1 && record.id <= 8 && record.seq === activeEvent.seq &&
          record.generation === activeEvent.snapshot.referrerGeneration &&
          (record.operation !== "remove" || record.reason === "expired") &&
          (record.operation !== "set" || typeof record.value === "string" && record.value.length <= 16 &&
            [...record.value].every((character) => character.charCodeAt(0) <= 127));
        if (!valid) { stop("invalid-worker-result"); return; }
        activeStorageRequest = record.id;
        lastStorageRequestId = record.id;
        storageStage = step;
        void fulfillStorageRequest(record);
        return;
      }
      if (message?.type === "cookie-request") {
        const valid = experimentalFirstPartyCookie && inFlight && activeEvent &&
          (activeEvent.payload.args[0] === "track" && activeEvent.payload.args[1] === "PageView" ||
           activeEvent.payload.args[0] === "trackSingle" && activeEvent.payload.args[2] === "PageView") &&
          activeCookieRequest === null && activeStorageRequest === null && !activeResultReceived && Number.isSafeInteger(message.id) &&
          message.id > lastCookieRequestId && message.name === "_fbp" &&
          (message.operation === "get" && exactKeys(message, ["type", "id", "operation", "name"]) ||
           message.operation === "set" && exactKeys(message, ["type", "id", "operation", "name", "value", "options"]));
        if (!valid) { stop("invalid-worker-result"); return; }
        activeCookieRequest = message.id;
        lastCookieRequestId = message.id;
        void fulfillCookieRequest(message);
        return;
      }
      if (message?.type === "phase" && message.name === "configured") {
        if (phase !== "starting") { stop("duplicate-configured"); return; }
        phase = "ready";
        if (pendingReferrerInvalidation) {
          pendingReferrerInvalidation = false;
          invalidateReferrer();
        }
        resolveReadiness();
        clearTimeout(initTimer);
      }
      if (message?.type === "intercepted-fetch") {
        if (experimentalPageViewReferrer && activeEvent?.payload.args[0] !== "track") {
          stop("invalid-worker-result"); return;
        }
        if (experimentalSetAgent && activeEvent?.payload.args[0] === "set") {
          stop("invalid-worker-result"); return;
        }
        if ((experimentalTagConsent || live) && (!inFlight || !activeEvent ||
            !["track", "trackCustom", "trackSingle", "trackSingleCustom"].includes(activeEvent.payload.args[0]))) {
          stop("invalid-worker-result"); return;
        }
        if ((experimentalSyntheticAdvancedMatching || experimentalInitAgent) && activeEvent?.payload.args[0] === "init") {
          stop("invalid-worker-result"); return;
        }
        if (validateWorker) {
          if (!inFlight || activeResultReceived || activeHostRequest !== null || activeStorageRequest !== null ||
              activeHostResponses.length >= (experimentalMultiPixelRouting ? 4 : 1) ||
              !Number.isSafeInteger(message.id) || message.id <= lastHostRequestId) {
            stop("invalid-worker-result"); return;
          }
          activeHostRequest = message.id;
          lastHostRequestId = message.id;
        }
        if (message.method !== "GET" || Object.keys(message).some((key) => !["type", "id", "url", "method"].includes(key))) {
          postHostMessage({ type: "intercepted-fetch-response", id: message.id, status: 0,
            statusText: live ? "live-policy-rejected" : "held at the seal: literal-loopback-policy", body: "" });
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
      timeoutMs: live ? transportTimeoutMs + 250 : transportTimeoutMs,
      onDiagnostic() {},
    });
    initTimer = setTimeout(() => stop("init-timeout"), initTimeoutMs);
    host.init({ endpoint, transportTimeoutMs: live ? transportTimeoutMs + 500 : transportTimeoutMs,
      ...(owned ? { ownedPocBinding: owned } : live ? { liveBinding: live } : {}),
      ...(experimentalPageViewData === true ? { experimentalPageViewData: true } : {}),
      ...(experimentalRouting === true ? { experimentalRouting: true } : {}),
      ...(experimentalMultiPixelRouting === true ? { experimentalMultiPixelRouting: true } : {}),
      ...(experimentalEvents === true ? { experimentalEvents: true } : {}),
      ...(experimentalScalarEventData === true ? { experimentalScalarEventData: true } : {}),
      ...(experimentalContentNameArray === true ? { experimentalContentNameArray: true } : {}),
      ...(experimentalContentIds === true ? { experimentalContentIds: true } : {}),
      ...(experimentalContents === true ? { experimentalContents: true } : {}),
      ...(experimentalContentsItemPrice === true ? { experimentalContentsItemPrice: true } : {}),
      ...(experimentalCustomProperties === true ? { experimentalCustomProperties: true } : {}),
      ...(experimentalNumericOrderId === true ? { experimentalNumericOrderId: true } : {}),
      ...(experimentalEventIds === true ? { experimentalEventIds: true } : {}),
      ...(experimentalSetAgent === true ? { experimentalSetAgent: true } : {}),
      ...(experimentalInitAgent === true ? { experimentalInitAgent: true } : {}),
      ...(experimentalMagentoHeadArray === true ? { experimentalMagentoHeadArray: true } : {}),
      ...(experimentalNullPurchaseValue === true ? { experimentalNullPurchaseValue: true } : {}),
      ...(experimentalEmptyCheckoutValue === true ? { experimentalEmptyCheckoutValue: true } : {}),
      ...(experimentalFalseCheckoutContentId === true ? { experimentalFalseCheckoutContentId: true } : {}),
      ...(experimentalViewContentJsonStrings === true ? { experimentalViewContentJsonStrings: true } : {}),
      ...(experimentalTagConsent === true ? { experimentalTagConsent: true } : {}),
      ...(experimentalFirstPartyCookie === true ? { experimentalFirstPartyCookie: true } : {}),
      ...(experimentalPageViewPreparation === true ? { experimentalPageViewPreparation: true } : {}),
      ...(experimentalPageViewPerformance === true ? { experimentalPageViewPerformance: true } : {}),
      ...(experimentalPageViewReferrer === true ? { experimentalPageViewReferrer: true } : {}),
      ...(experimentalSyntheticAdvancedMatching === true
        ? { experimentalSyntheticAdvancedMatching: true, syntheticIdentityFixtures } : {}) });
  } catch {
    stop("worker-unavailable");
  }

  return {
    fbq,
    getState,
    ready() { return readiness.then(getState); },
    ...(experimentalSyntheticAdvancedMatching ? {
      syntheticIdentity(index) {
        if (index !== 0 && index !== 1) throw new Error("invalid-synthetic-identity-index");
        return { external_id: syntheticIdentityFixtures[index] };
      },
    } : {}),
    flush() {
      if (!queue.length && !inFlight) return Promise.resolve(getState());
      if (waiters.size >= 16) return Promise.resolve({ ...getState(), flush: "waiter-limit" });
      return new Promise((resolve) => waiters.add(resolve));
    },
    setConsent(vector) {
      if (phase === "terminal" || phase === "disposed") return;
      hostAdStorage = vector?.ad_storage;
      if ((experimentalFirstPartyCookie || experimentalPageViewReferrer || live) && hostAdStorage !== "granted") {
        revokeGeneration += 1;
        invalidateReferrer();
        if (live || experimentalPageViewReferrer) for (const controller of controllers) controller.abort();
      }
    },
    async dispose() {
      stop("disposed", true);
      await closed;
    },
  };
}
