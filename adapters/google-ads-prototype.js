import { createWrappedSdkHost } from "../core/wrapped-sdk-host.js";
import { resolveConsent } from "../core/consent.js";
import { snapshotDestinationSelectors } from "../connectors/google-ads/destination-selectors.js";
import { CONSENT_COMMAND_KEYS, validConsentCommand } from "../connectors/google-ads/consent-commands.js";
import { validBootstrapCommand } from "../connectors/google-ads/bootstrap-command.js";
import { snapshotPurchaseCartItems } from "../connectors/google-ads/purchase-cart-items.js";
import { validRemarketingDisableCommand } from "../connectors/google-ads/remarketing-control.js";
import {
  isEnabledViewEvent, isRemarketingPurchase, REMARKETING_PURCHASE_MARKER, snapshotViewItems, validViewItemValue, VIEW_EVENT_NAMES,
} from "../connectors/google-ads/view-items.js";

const PARAM_KEYS = ["send_to", "value", "currency", "transaction_id"];
const FEED_KEYS = ["aw_merchant_id", "aw_feed_country", "aw_feed_language"];
const CUSTOM_KEYS = ["example_variable", "color", "product_name"];
const LIMIT = 256;
const DATA_LAYER_LIMIT = 128;
let browserInstanceCounter = 0;
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
  "invalid-owned", "invalid-url", "invalid-ownership", "invalid-parent", "body-limit", "invalid-utf8",
  "invalid-json", "duplicate-json", "structure-limit", "invalid-frame", "invalid-message",
  "invalid-fetch-count", "invalid-chain-response",
  "response-unavailable", "response-too-large",
]);
const REASONS = new Set([
  "connector-not-initialized", "unsupported-command", "unsupported-config", "synthetic-destination-required",
  "duplicate-config", "conversion-before-config", "unsupported-parameters", "synthetic-selector-required",
  "unsupported-value", "unsupported-currency", "unsupported-transaction", "invalid-context",
  "unsupported-new-customer", "unsupported-items", "unsupported-discount", "unsupported-feed", "unsupported-custom-variable",
  "encoded-context-limit",
  "held-at-seal", "transport-failed", "destination-mismatch", "unsupported-bootstrap",
]);

function remarketingEvent(args, viewItem, viewEvents, remarketingPurchase) {
  const params = args?.[2];
  return isEnabledViewEvent(args?.[1], viewItem, viewEvents) ||
    (params && typeof params === "object" && !Array.isArray(params) &&
      isRemarketingPurchase(args?.[1], Object.hasOwn(params, "send_to"), viewItem, remarketingPurchase));
}

function dispatchEvent(args, purchase, viewItem, viewEvents, remarketingPurchase) {
  return args?.[0] === "event" &&
    (args[1] === "conversion" || (purchase && args[1] === "purchase") ||
      remarketingEvent(args, viewItem, viewEvents, remarketingPurchase));
}

function matchesViewItemRequest(url, endpoint, args, viewOptions) {
  const params = args?.[2];
  const items = snapshotViewItems(params?.items, viewOptions);
  if (!items || !validViewItemValue(params?.value) || typeof url !== "string" ||
      url.length > 8192 || !url.startsWith(`${endpoint}?`) || url.includes("#")) return false;
  try {
    const query = new URL(url).searchParams;
    const names = params.value === undefined ? ["airlock_event", "airlock_items"] : ["airlock_event", "airlock_items", "airlock_value"];
    return [...query.keys()].length === names.length && names.every((name) => query.getAll(name).length === 1) &&
      query.get("airlock_event") === (args[1] === "purchase" ? REMARKETING_PURCHASE_MARKER : args[1]) &&
      query.get("airlock_items") === JSON.stringify(items) &&
      (params.value === undefined || query.get("airlock_value") === String(params.value));
  } catch { return false; }
}

function hasViewItemMarker(url) {
  if (typeof url !== "string") return false;
  try {
    return new URL(url).searchParams.getAll("airlock_event")
      .some((event) => VIEW_EVENT_NAMES.includes(event) || event === REMARKETING_PURCHASE_MARKER);
  }
  catch { return false; }
}

function matchesLabeledEventMarker(url, event) {
  if (typeof url !== "string") return false;
  try {
    const markers = new URL(url).searchParams.getAll("airlock_event");
    return event === "purchase" ? markers.length === 1 && markers[0] === "purchase" : markers.length === 0;
  } catch { return false; }
}

function matchesLabeledPurchaseRequest(url, endpoint, args, context, routing) {
  const params = args?.[2];
  if (!params || typeof params !== "object" || typeof params.send_to !== "string" ||
      typeof context?.pageURL !== "string" || typeof url !== "string" ||
      url.length > 8192 || !url.startsWith(`${endpoint}?`) || url.includes("#")) return false;
  const selector = params.send_to.match(/^(AW-\d{1,32})\/([A-Za-z0-9_-]{1,128})$/);
  const route = endpoint.match(/\/pagead\/conversion\/(\d{1,32})\/$/);
  if (!selector || !route || selector[1] !== `AW-${route[1]}` ||
      (!routing && params.send_to !== "AW-0000000000/SYNTHETIC_LABEL")) return false;
  const expected = new URLSearchParams({ label: selector[2] });
  for (const [input, output] of [
    ["value", "value"], ["currency", "currency_code"], ["transaction_id", "oid"],
    ["new_customer", "airlock_new_customer"], ["discount", "airlock_discount"],
    ["aw_merchant_id", "airlock_merchant_id"], ["aw_feed_country", "airlock_feed_country"],
    ["aw_feed_language", "airlock_feed_language"],
  ]) {
    if (params[input] !== undefined) expected.set(output, String(params[input]));
  }
  expected.set("airlock_event", "purchase");
  if (params.items !== undefined) {
    const items = snapshotPurchaseCartItems(params.items);
    if (!items) return false;
    expected.set("airlock_items", JSON.stringify(items));
  }
  expected.set("url", context.pageURL);
  try {
    const query = new URL(url).searchParams;
    return [...query.keys()].length === [...expected.keys()].length &&
      [...expected.keys()].every((key) => query.getAll(key).length === 1 && query.get(key) === expected.get(key));
  } catch { return false; }
}

function matchesLabeledConversionRequest(url, endpoint, args, context, routing, customVariables) {
  const params = args?.[2];
  if (!params || typeof params !== "object" || typeof params.send_to !== "string" ||
      typeof context?.pageURL !== "string" || typeof url !== "string" ||
      url.length > 8192 || !url.startsWith(`${endpoint}?`) || url.includes("#")) return false;
  const selector = params.send_to.match(/^(AW-\d{1,32})\/([A-Za-z0-9_-]{1,128})$/);
  const route = endpoint.match(/\/pagead\/conversion\/(\d{1,32})\/$/);
  if (!selector || !route || selector[1] !== `AW-${route[1]}` ||
      (!routing && params.send_to !== "AW-0000000000/SYNTHETIC_LABEL")) return false;
  const expected = new URLSearchParams({ label: selector[2] });
  for (const [input, output] of [["value", "value"], ["currency", "currency_code"], ["transaction_id", "oid"]]) {
    if (params[input] !== undefined) expected.set(output, String(params[input]));
  }
  if (customVariables) {
    for (const key of CUSTOM_KEYS) {
      if (params[key] !== undefined) expected.set(`airlock_custom_${key}`, params[key]);
    }
  }
  expected.set("url", context.pageURL);
  try {
    const query = new URL(url).searchParams;
    return [...query.keys()].length === [...expected.keys()].length &&
      [...expected.keys()].every((key) => query.getAll(key).length === 1 && query.get(key) === expected.get(key));
  } catch { return false; }
}

function browserChamber(withLoss = false) {
  const worker = new Worker(new URL("../connectors/google-ads/conversion-prototype.worker.js", import.meta.url), { type: "module" });
  const lossListeners = new Set();
  let closed = false;
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
    ...(withLoss ? {
      onLoss(listener) { lossListeners.add(listener); return () => lossListeners.delete(listener); },
      dispose() {
        if (closed) return;
        closed = true;
        for (const listener of lossListeners) listener();
        lossListeners.clear();
        worker.terminate();
      },
    } : { dispose: () => worker.terminate() }),
  };
}

function browserPermissionOrigins(origins) {
  const effective = new Set();
  for (const literal of origins) {
    const port = literal.slice(literal.lastIndexOf(":") + 1);
    effective.add(new URL(literal).origin);
    effective.add(new URL(`https://127.0.0.1:${port}`).origin);
    if (port === "80") effective.add("https://127.0.0.1");
  }
  return [...effective];
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

async function manualResponse(response, stage, ownership) {
  if (!response || !response.headers || typeof response.headers.get !== "function" ||
      !response.body || typeof response.body.getReader !== "function") throw new Error("response-unavailable");
  const headers = {};
  for (const name of ["content-type", "location"]) {
    const value = response.headers.get(name);
    if (value !== null) {
      if (typeof value !== "string" || value.length > 8192) throw new Error("response-unavailable");
      headers[name] = value;
    }
  }
  if ((stage === "primary" && !headers["content-type"]) || (stage === "secondary" && !headers.location)) {
    throw new Error("response-unavailable");
  }
  const reader = response.body.getReader();
  if (ownership) ownership.reader = reader;
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  const decode = (value, options) => {
    try { return decoder.decode(value, options); }
    catch (error) { throw new Error("invalid-utf8", { cause: error }); }
  };
  let bytes = 0, body = "", reachedEOF = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        const result = { status: response.status, headers, body: body + decode() };
        if (ownership && !ownership.signal.aborted) reachedEOF = true;
        return result;
      }
      bytes += value.byteLength;
      if (bytes > 4096) throw new Error("response-too-large");
      body += decode(value, { stream: true });
    }
  } finally {
    if (!ownership) {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    } else if (reachedEOF) {
      reader.releaseLock();
      ownership.reader = undefined;
      ownership.complete = true;
    }
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
  experimentalDataLayer = false, experimentalPurchase = false, experimentalPurchaseCart = false, experimentalPurchaseDiscount = false,
  experimentalPurchaseFeed = false, experimentalCustomVariables = false, experimentalRetailViewItem = false,
  experimentalEducationViewItem = false, experimentalLocalViewItem = false, experimentalRealEstateViewItem = false,
  experimentalTravelViewItem = false, experimentalFlightsViewItem = false, experimentalViewItemList = false,
  experimentalViewSearchResults = false, experimentalAddToCart = false, experimentalRemarketingPurchase = false,
  experimentalDisableRemarketing = false,
  experimentalManualResponseChain = false,
  experimentalBrowserOperation = false,
} = {}) {
  const viewOptions = {
    retail: experimentalRetailViewItem, education: experimentalEducationViewItem,
    local: experimentalLocalViewItem, realEstate: experimentalRealEstateViewItem,
    travel: experimentalTravelViewItem, flights: experimentalFlightsViewItem,
  };
  const experimentalViewItem = Object.values(viewOptions).some((enabled) => enabled === true);
  const viewEvents = {
    view_item_list: experimentalViewItemList,
    view_search_results: experimentalViewSearchResults,
    add_to_cart: experimentalAddToCart,
  };
  const experimentalViewEvent = experimentalRemarketingPurchase === true || Object.values(viewEvents).some((enabled) => enabled === true);
  if (typeof experimentalRouting !== "boolean" || typeof experimentalParameterScopes !== "boolean" ||
      typeof experimentalCallbacks !== "boolean" || typeof experimentalMultiDestination !== "boolean" ||
      typeof experimentalConsentCommands !== "boolean" || typeof experimentalBootstrap !== "boolean" ||
      typeof experimentalDataLayer !== "boolean" || typeof experimentalPurchase !== "boolean" ||
      typeof experimentalPurchaseCart !== "boolean" || (experimentalPurchaseCart && !experimentalPurchase) ||
      typeof experimentalPurchaseDiscount !== "boolean" || (experimentalPurchaseDiscount && !experimentalPurchase) ||
      typeof experimentalPurchaseFeed !== "boolean" || (experimentalPurchaseFeed && !experimentalPurchaseCart) ||
      typeof experimentalCustomVariables !== "boolean" || typeof experimentalRemarketingPurchase !== "boolean" ||
      typeof experimentalDisableRemarketing !== "boolean" ||
      Object.values(viewEvents).some((enabled) => typeof enabled !== "boolean") ||
      Object.values(viewOptions).some((enabled) => typeof enabled !== "boolean") ||
      ((experimentalViewItem || experimentalViewEvent) && (experimentalParameterScopes || experimentalMultiDestination)) ||
      (experimentalDisableRemarketing && (experimentalParameterScopes || experimentalMultiDestination)) ||
      (experimentalMultiDestination && !experimentalRouting)) throw new Error("invalid-experimental-option");
  const pattern = experimentalRouting === true
    ? /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/pagead\/conversion\/(\d{1,32})\/$/
    : /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/pagead\/conversion\/0000000000\/$/;
  const match = typeof endpoint === "string" && endpoint.match(pattern);
  if (!match || Number(match[1]) > 65535) throw new Error("literal-loopback-endpoint-required");
  let manualIdentity;
  if (experimentalManualResponseChain !== false) {
    const option = experimentalManualResponseChain;
    const descriptor = option && typeof option === "object" && Object.getOwnPropertyDescriptor(option, "auid");
    if (!option || ![Object.prototype, null].includes(Object.getPrototypeOf(option)) ||
        Reflect.ownKeys(option).length !== 1 || !descriptor || !Object.hasOwn(descriptor, "value") ||
        typeof descriptor.value !== "string" || !/^[A-Za-z0-9._-]{1,128}$/.test(descriptor.value) ||
        !experimentalRouting || experimentalParameterScopes || experimentalCallbacks || experimentalMultiDestination ||
        experimentalConsentCommands || experimentalBootstrap || experimentalDataLayer || experimentalPurchase ||
        experimentalCustomVariables || experimentalViewItem || experimentalViewEvent || experimentalDisableRemarketing) {
      throw new Error("invalid-experimental-option");
    }
    manualIdentity = { auid: descriptor.value };
  }
  let browserIdentity;
  if (experimentalBrowserOperation !== false) {
    const option = experimentalBrowserOperation;
    const keys = ["auid", "recipientOrigins", "secondaryOrigin", "secondaryMode", "permissions"];
    if (!option || Object.getPrototypeOf(option) !== Object.prototype ||
        Reflect.ownKeys(option).length !== keys.length ||
        keys.some((key) => !Object.hasOwn(Object.getOwnPropertyDescriptor(option, key) || {}, "value")) ||
        typeof option.auid !== "string" || !/^[A-Za-z0-9._-]{1,128}$/.test(option.auid) ||
        !Array.isArray(option.recipientOrigins) || option.recipientOrigins.length < 1 || option.recipientOrigins.length > 4 ||
        option.recipientOrigins.some((origin) => typeof origin !== "string" ||
          !/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(origin) || Number(new URL(origin).port) > 65535) ||
        new Set(option.recipientOrigins).size !== option.recipientOrigins.length ||
        !option.recipientOrigins.some((origin) => new URL(origin).origin === new URL(endpoint).origin) ||
        !option.recipientOrigins.includes(option.secondaryOrigin) ||
        !["cors", "no-cors"].includes(option.secondaryMode) ||
        !option.permissions || Object.getPrototypeOf(option.permissions) !== Object.prototype ||
        !experimentalRouting || manualIdentity || experimentalParameterScopes || experimentalCallbacks || experimentalMultiDestination ||
        experimentalConsentCommands || experimentalBootstrap || experimentalDataLayer || experimentalPurchase ||
        experimentalCustomVariables || experimentalViewItem || experimentalViewEvent || experimentalDisableRemarketing) {
      throw new Error("invalid-experimental-option");
    }
    const permissionOrigins = browserPermissionOrigins(option.recipientOrigins);
    if (Reflect.ownKeys(option.permissions).length !== permissionOrigins.length ||
        permissionOrigins.some((origin) => {
          const descriptor = Object.getOwnPropertyDescriptor(option.permissions, origin);
          return !descriptor || !Object.hasOwn(descriptor, "value") ||
            !Array.isArray(descriptor.value) || descriptor.value.length !== 1 || descriptor.value[0] !== "ad_storage";
        })) throw new Error("invalid-experimental-option");
    browserIdentity = {
      auid: option.auid, instanceId: `browser-${++browserInstanceCounter}`, epoch: 1,
      recipientOrigins: [...option.recipientOrigins], permissionOrigins,
      secondaryOrigin: option.secondaryOrigin, secondaryMode: option.secondaryMode,
    };
  }
  const second = experimentalMultiDestination && typeof additionalEndpoint === "string" && additionalEndpoint.match(pattern);
  if (experimentalMultiDestination && (!second || Number(second[1]) > 65535 || match[2] === second[2])) {
    throw new Error("literal-loopback-endpoint-required");
  }
  const endpoints = experimentalMultiDestination ? [endpoint, additionalEndpoint] : [endpoint];
  const manualPaths = manualIdentity ? [
    endpoint,
    `http://127.0.0.1:${match[1]}/pagead/viewthroughconversion/${match[2]}/`,
    `http://127.0.0.1:${match[1]}/pagead/1p-conversion/${match[2]}/`,
  ] : null;
  const routes = experimentalMultiDestination ? new Map([[`AW-${match[2]}`, endpoint], [`AW-${second[2]}`, additionalEndpoint]]) : null;
  if (!Number.isInteger(queueLimit) || queueLimit < 1 || queueLimit > 128 ||
      ![initTimeoutMs, commandTimeoutMs, transportTimeoutMs].every((n) => Number.isInteger(n) && n >= 10 && n <= 10000) ||
      ((manualIdentity || browserIdentity) && (initTimeoutMs > 2000 || commandTimeoutMs > 5000 || transportTimeoutMs > 1500))) {
    throw new Error("invalid-prototype-bounds");
  }
  const queue = [];
  const capturedConsent = new WeakMap();
  const capturedConsentGeneration = new WeakMap();
  const outcomes = [];
  const waiters = new Set();
  const controllers = new Set();
  const capabilityWork = new Set();
  const hostDrives = new Set();
  const hostResponsesPending = new Map();
  const hostListeners = new Set();
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
      if (manualIdentity && inFlight && activeLeaseInvalid) return "denied";
      if (inFlight && activeHostConsent !== "granted") return activeHostConsent;
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
  let remarketingDisabled = false;
  let truncated = 0;
  let inFlight = false;
  let capturing = false;
  let activeSequence;
  let activeCommandDeadline;
  let activeHostConsent;
  let activeCommand;
  let activeContext;
  let activeRequest;
  let activeRequests;
  let activeSelectors;
  let activeLeaseInvalid = false;
  let consentGeneration = 0;
  let manualActualCalls = 0;
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
  let browserRealm;
  let browserRealmReady;
  const browserSetup = browserIdentity ? new AbortController() : null;
  let browserPermissions = browserIdentity ? new Set(browserIdentity.permissionOrigins) : null;

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
        ...(entry.chain ? { chain: entry.chain.map((stage) => ({ ...stage })) } : {}),
        ...(entry.unmodeledPurposes ? { unmodeledPurposes: [...entry.unmodeledPurposes] } : {}),
      })).sort((a, b) => a.seq - b.seq),
      host: { dispatchAttempts: state?.mainDispatch.count || 0, consentHeld: state?.consentHeld || 0, ceilingHeld: state?.ceilingHeld || 0,
        ...(manualIdentity ? { actualCalls: manualActualCalls } : {}) },
      ...(manualIdentity ? { manualCleanup: { capabilityPending: capabilityWork.size, hostDrivesPending: hostDrives.size,
        hostResponsesPending: hostResponsesPending.size, controllers: controllers.size, hostListeners: hostListeners.size } } : {}),
      ...(browserIdentity ? { browserCleanup: { capabilityPending: capabilityWork.size, hostDrivesPending: hostDrives.size,
        controllers: controllers.size, realmReady: !!browserRealm, hostListeners: hostListeners.size } } : {}),
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
      ...(manualIdentity ? { body: message.body, headers: message.headers } : {}),
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
  function manualChainOutcome() {
    return activeRequests.map(({ id, stage, parent, actual, response }) => ({
      id, stage, parent, actual: !!actual, status: response?.status,
    }));
  }
  function matchesHostResponse(summary) {
    if (browserIdentity && summary.authoredOperations !== undefined) {
      const allowedKeys = ["seq", "disposition", "authoredOperations",
        ...(summary.status !== undefined ? ["status"] : []), ...(summary.reason !== undefined ? ["reason"] : [])];
      if (!Number.isInteger(summary.authoredOperations) || summary.authoredOperations < 1 ||
          summary.authoredOperations > 2 || activeRequests.length !== summary.authoredOperations ||
          Object.keys(summary).length !== allowedKeys.length || !Object.keys(summary).every((key) => allowedKeys.includes(key)) ||
          activeRequests.some((request) => !request.actual || !request.response) ||
          summary.requests !== undefined || summary.branches !== undefined || summary.terminal !== undefined) return false;
      const last = activeRequests.at(-1).response;
      if (summary.authoredOperations === 1) {
        const reason = ["rejected", "aborted", "timed-out"].includes(last.kind) ? last.kind : "primary-unreadable";
        return summary.disposition === "failed" && summary.reason === reason &&
          (last.kind !== "readable" || last.status !== 200 ||
           !/^application\/json(?:\s*;|$)/i.test(last.headers["content-type"] || "")) &&
          summary.status === undefined;
      }
      if (last.kind === "opaque") return summary.disposition === "opaque" && summary.status === undefined && summary.reason === undefined;
      if (last.kind === "readable") return summary.disposition === "readable" && summary.status === last.status && summary.reason === undefined;
      return summary.disposition === "failed" && summary.reason === last.kind && summary.status === undefined;
    }
    if (summary.requests === 0) {
      return !activeRequest && ["configured", "scope-updated", "rejected",
        ...(experimentalBootstrap ? ["bootstrap-accepted"] : []),
        ...(experimentalConsentCommands ? ["consent-updated"] : []),
        ...(experimentalDisableRemarketing ? ["remarketing-disabled", "remarketing-suppressed"] : [])].includes(summary.disposition) &&
        (!experimentalDisableRemarketing || !validRemarketingDisableCommand(activeCommand) ||
          summary.disposition === "remarketing-disabled") &&
        (summary.disposition !== "remarketing-disabled" ||
          (experimentalDisableRemarketing && remarketingDisabled && validRemarketingDisableCommand(activeCommand) &&
            summary.reason === undefined && Object.keys(summary).every((key) => ["seq", "disposition", "requests"].includes(key)))) &&
        (summary.disposition !== "remarketing-suppressed" ||
          (experimentalDisableRemarketing && remarketingDisabled && activeCommand?.[0] === "event" &&
            remarketingEvent(activeCommand, experimentalViewItem, viewEvents, experimentalRemarketingPurchase) &&
            summary.reason === undefined && Object.keys(summary).every((key) => ["seq", "disposition", "requests"].includes(key)))) &&
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
    if (manualIdentity) {
      if (!dispatchEvent(activeCommand, experimentalPurchase, experimentalViewItem, viewEvents, experimentalRemarketingPurchase) ||
          summary.branches !== undefined || summary.terminal !== undefined) return false;
      if (summary.requests === 1) {
        const request = activeRequests[0];
        return activeRequests.length === 1 && activeRequest === request && request.stage === "primary" &&
          request.parent === 0 && !request.actual && request.response?.status === 0 && request.response.held &&
          summary.disposition === "held" && summary.status === 0 && summary.reason === "held-at-seal";
      }
      return summary.requests === 3 && activeRequests.length === 3 &&
        activeRequest === activeRequests[2] &&
        activeRequests.every((request, index) => request.actual && request.response &&
          request.stage === ["primary", "secondary", "final"][index] &&
          request.parent === (index ? activeRequests[index - 1].id : 0)) &&
        activeRequests.map((request) => request.response.status).join(",") === "200,302,200" &&
        summary.disposition === "transport-settled" && summary.status === 200 && summary.reason === undefined;
    }
    if (experimentalMultiDestination) {
      if (!dispatchEvent(activeCommand, experimentalPurchase, experimentalViewItem, viewEvents, experimentalRemarketingPurchase) ||
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
    if (!response || !dispatchEvent(activeCommand, experimentalPurchase, experimentalViewItem, viewEvents, experimentalRemarketingPurchase) ||
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
    if (manualIdentity || browserIdentity) {
      activeLeaseInvalid = true;
      if (browserIdentity) {
        browserIdentity.epoch += 1;
        browserSetup.abort();
        browserRealm?.dispose();
        browserRealm = undefined;
      }
      for (const listener of hostListeners) listener({ type: "fatal", message: reason });
      hostListeners.clear();
    }
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
    const cleanup = manualIdentity || browserIdentity ? (async () => {
      await Promise.resolve();
      const pending = Promise.allSettled([...hostDrives, ...capabilityWork,
        ...[...hostResponsesPending.values()].map(({ promise }) => promise),
        ...(browserRealmReady ? [browserRealmReady] : []), Promise.resolve(disposal)]);
      let timer;
      try {
        const results = await Promise.race([pending, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("cleanup-deadline")), 1800);
        })]);
        if (results.at(-1)?.status === "rejected") throw new Error("transport-dispose-failed");
        hostListeners.clear();
      } finally { clearTimeout(timer); }
    })() : Promise.resolve(disposal);
    closed = cleanup.then(
      () => { if (cleanupFailure) throw new Error("prototype-cleanup-failed"); },
      (error) => {
        cleanupFailure = (manualIdentity || browserIdentity) && error?.message === "cleanup-deadline" ? "capability-drain-timeout" : "transport-dispose-failed";
        throw new Error("prototype-cleanup-failed", { cause: error });
      },
    );
    // Observe event-driven failure without replacing the rejection dispose returns.
    void closed.catch(() => {});
    settle();
  }
  async function dispatch(request) {
    if (manualIdentity) {
      const current = activeRequest;
      if (phase !== "ready" || !current || current.actual || activeLeaseInvalid ||
          consentVector.ad_storage !== "granted" || request.url !== current.url ||
          request.method !== current.method || request.headers !== undefined || request.body !== undefined) {
        throw new Error("literal-loopback-policy");
      }
      const controller = new AbortController();
      controllers.add(controller);
      let timedOut = false;
      let response;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, transportTimeoutMs);
      try {
        if (phase !== "ready" || activeLeaseInvalid || consentVector.ad_storage !== "granted") throw new Error("consent-revoked");
        current.actual = true;
        manualActualCalls += 1;
        response = await fetchImpl(request.url, {
          method: request.method, credentials: "omit", redirect: "manual", referrerPolicy: "no-referrer", signal: controller.signal,
        });
        if (phase !== "ready" || activeLeaseInvalid || consentVector.ad_storage !== "granted") throw new Error("consent-revoked");
        const result = await manualResponse(response, current.stage);
        if (phase !== "ready" || activeLeaseInvalid || consentVector.ad_storage !== "granted") throw new Error("consent-revoked");
        return result;
      } catch (error) {
        controller.abort();
        try {
          if (response?.body && !response.body.locked && typeof response.body.cancel === "function") {
            await response.body.cancel();
          }
        } catch { /* Abort or cancellation may already have closed the body. */ }
        const safe = ["response-unavailable", "response-too-large", "invalid-utf8", "consent-revoked"];
        throw new Error(timedOut ? "transport-timeout" :
          safe.includes(error?.message) ? error.message : "loopback-transport-failed", { cause: error });
      } finally { clearTimeout(timer); controllers.delete(controller); }
    }
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
  async function cancelBrowserResponse(response, ownership) {
    let timer;
    try {
      const reader = ownership.reader;
      const target = reader || response?.body;
      if (!target) return true;
      if (typeof target.cancel !== "function") throw new Error("cancel-unavailable");
      const work = Promise.resolve().then(() => target.cancel()).then(
        () => { if (reader) reader.releaseLock(); },
        (error) => { if (reader) reader.releaseLock(); throw error; },
      );
      capabilityWork.add(work);
      void work.then(() => capabilityWork.delete(work), () => capabilityWork.delete(work));
      await Promise.race([work, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("cancel-deadline")), 1000);
      })]);
      return true;
    } catch (error) {
      cleanupFailure ||= error?.message === "cancel-deadline"
        ? "browser-response-cancel-timeout" : "browser-response-cancel-failed";
      return false;
    } finally { clearTimeout(timer); }
  }

  async function dispatchBrowserOperation(message, request) {
    const epoch = browserIdentity.epoch;
    let controller;
    let timer;
    let timedOut = false;
    let outcome;
    let response;
    let failed = false;
    const ownership = { reader: undefined, complete: false };
    try {
      const realm = await browserRealmReady;
      controller = new AbortController();
      controllers.add(controller);
      ownership.signal = controller.signal;
      if (phase !== "ready" || !inFlight || activeLeaseInvalid || activeRequest !== request ||
          browserIdentity.epoch !== epoch || resolveConsent(hostConsent, "ad_storage") !== "granted" ||
          browserIdentity.permissionOrigins.some((origin) => !browserPermissions.has(origin)) || !realm.valid()) {
        throw new Error("browser-authority-lost");
      }
      let now = performance.now();
      if (now >= activeCommandDeadline) { stop("command-timeout"); return; }
      if (now >= request.deadline) { stop("browser-operation-timeout"); return; }
      timer = setTimeout(() => { timedOut = true; controller.abort(); },
        Math.floor(Math.min(activeCommandDeadline, request.deadline) - now));
      now = performance.now();
      if (now >= activeCommandDeadline) { stop("command-timeout"); return; }
      if (now >= request.deadline) { stop("browser-operation-timeout"); return; }
      request.actual = true;
      const pending = realm.fetch(request.url, {
        method: request.method, credentials: "omit", redirect: request.stage === "primary" ? "error" : "follow",
        mode: request.stage === "primary" ? "cors" : browserIdentity.secondaryMode,
        referrerPolicy: "no-referrer", signal: controller.signal,
      });
      const result = await pending;
      response = result;
      if (phase !== "ready" || browserIdentity.epoch !== epoch || activeLeaseInvalid) return;
      if (performance.now() >= activeCommandDeadline) { stop("command-timeout"); return; }
      if (performance.now() >= request.deadline) { timedOut = true; throw new Error("browser-operation-timeout"); }
      if (result?.type === "opaque") {
        ownership.complete = true;
        outcome = { kind: "opaque" };
      }
      else {
        const reading = manualResponse(result, request.stage === "primary" ? "primary" : "final", ownership);
        capabilityWork.add(reading);
        void reading.then(() => capabilityWork.delete(reading), () => capabilityWork.delete(reading));
        let onAbort;
        const aborted = new Promise((_, reject) => {
          onAbort = () => reject(new Error("browser-aborted"));
          controller.signal.addEventListener("abort", onAbort, { once: true });
          if (controller.signal.aborted) onAbort();
        });
        let readable;
        try { readable = await Promise.race([reading, aborted]); }
        finally { controller.signal.removeEventListener("abort", onAbort); }
        if (phase !== "ready" || browserIdentity.epoch !== epoch || activeLeaseInvalid) return;
        if (performance.now() >= activeCommandDeadline) { stop("command-timeout"); return; }
        if (performance.now() >= request.deadline) { timedOut = true; throw new Error("browser-operation-timeout"); }
        const contentType = readable.headers["content-type"];
        if (contentType !== undefined && contentType.length > 256) throw new Error("response-unavailable");
        outcome = { kind: "readable", status: readable.status, body: readable.body,
          headers: contentType === undefined ? {} : { "content-type": contentType } };
      }
    } catch (error) {
      failed = true;
      if (error?.message === "browser-authority-lost") {
        stop("browser-authority-lost"); return;
      }
      outcome = { kind: timedOut ? "timed-out" : controller?.signal.aborted ? "aborted" : "rejected" };
    } finally {
      if (controller && (failed || (response && !ownership.complete))) controller.abort();
      if (response && !ownership.complete && !await cancelBrowserResponse(response, ownership)) {
        stop("browser-response-cleanup-failed");
      }
      clearTimeout(timer);
      if (controller) controllers.delete(controller);
    }
    if (phase !== "ready" || browserIdentity.epoch !== epoch || activeLeaseInvalid || activeRequest !== request) return;
    if (performance.now() >= activeCommandDeadline) { stop("command-timeout"); return; }
    if (performance.now() >= request.deadline) outcome = { kind: "timed-out" };
    if (resolveConsent(hostConsent, "ad_storage") !== "granted" ||
        browserIdentity.permissionOrigins.some((origin) => !browserPermissions.has(origin)) || !browserRealm?.valid()) {
      stop("browser-authority-lost"); return;
    }
    request.response = outcome;
    try {
      transport.postMessage({
        type: "browser-operation-response", instanceId: browserIdentity.instanceId, epoch,
        commandId: message.commandId, operationId: message.operationId, outcome,
      });
    } catch { stop("transport-post-failed"); }
  }

  function admitBrowserOperation(message) {
    const index = activeRequests?.length;
    const previous = activeRequests?.at(-1);
    const keys = ["type", "instanceId", "epoch", "commandId", "operationId", "parentId", "stage", "url", "method",
      ...(index === 1 ? ["source"] : [])];
    let valid = phase === "ready" && inFlight && awaitingResult && activeCommand?.[0] === "event" &&
      activeCommand[1] === "conversion" && index < 2 && message.instanceId === browserIdentity.instanceId &&
      message.epoch === browserIdentity.epoch && message.commandId === activeSequence &&
      message.operationId === lastRequestId + 1 && message.parentId === (previous?.id ?? 0) &&
      message.stage === ["primary", "secondary"][index] && message.method === ["GET", "POST"][index] &&
      Object.keys(message).length === keys.length && Object.keys(message).every((key) => keys.includes(key)) &&
      typeof message.url === "string" && message.url.length <= 8192 && message.url.isWellFormed() &&
      // eslint-disable-next-line no-control-regex -- reject URLs that Fetch would normalize before applying the grant.
      !/[\u0000-\u0020\u007f\\#]/u.test(message.url);
    if (valid && index === 0) valid = message.url.startsWith(`${endpoint}?`);
    if (valid && index === 1) {
      const sourcePrefix = `https://googleads.g.doubleclick.net/pagead/viewthroughconversion/${match[2]}/`;
      const target = `${browserIdentity.secondaryOrigin}/pagead/viewthroughconversion/${match[2]}/`;
      valid = previous.actual && previous.response?.kind === "readable" && previous.response.status === 200 &&
        typeof message.source === "string" && message.source.startsWith(`${sourcePrefix}?`) &&
        message.url === `${target}${message.source.slice(sourcePrefix.length)}` &&
        previous.response.body.includes(JSON.stringify(message.source));
    }
    if (!valid) { stop("request-correlation-failed"); return; }
    lastRequestId = message.operationId;
    const request = { id: message.operationId, stage: message.stage, parent: message.parentId,
      url: message.url, method: message.method, actual: false, deadline: performance.now() + transportTimeoutMs };
    activeRequest = request;
    activeRequests.push(request);
    const work = dispatchBrowserOperation(message, request);
    capabilityWork.add(work);
    void work.then(() => capabilityWork.delete(work), () => capabilityWork.delete(work));
  }

  async function pump() {
    if (inFlight || phase !== "ready") return;
    while (queue.length && phase === "ready") {
      const event = queue.shift();
      activeSequence = event.seq;
      activeHostConsent = capturedConsent.get(event);
      activeCommand = event.payload.args;
      activeContext = event.payload.context;
      activeRequest = undefined;
      activeRequests = [];
      activeLeaseInvalid = activeHostConsent !== "granted" ||
        ((manualIdentity || browserIdentity) && capturedConsentGeneration.get(event) !== consentGeneration);
      const eventParams = dispatchEvent(activeCommand, experimentalPurchase, experimentalViewItem, viewEvents, experimentalRemarketingPurchase)
        ? activeCommand?.[2] : undefined;
      const sendTo = eventParams && Object.hasOwn(eventParams, "send_to") ? eventParams.send_to : undefined;
      activeSelectors = experimentalMultiDestination && (typeof sendTo === "string" || Array.isArray(sendTo))
        ? (Array.isArray(sendTo) ? sendTo : [sendTo]) : undefined;
      inFlight = true;
      awaitingResult = true;
      if (browserIdentity) activeCommandDeadline = performance.now() + commandTimeoutMs;
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
        const drive = host.driveEvent(event);
        if (manualIdentity || browserIdentity) {
          hostDrives.add(drive);
          void drive.then(() => hostDrives.delete(drive), () => hostDrives.delete(drive));
        }
        drive.then((result) => finish({ result }), () => finish({ failure: "worker-fatal" }));
      });
      if (settled.failure) {
        const branches = branchOutcomes();
        record({ seq: event.seq, disposition: "rejected", reason: settled.failure, ...(branches ? { branches } : {}),
          ...(browserIdentity && activeRequests.length ? { authoredOperations: activeRequests.length } : {}),
          ...(manualIdentity && activeRequests.length ? { chain: manualChainOutcome() } : {}) });
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
          seq: event.seq, disposition: summary.disposition,
          ...(browserIdentity && summary.authoredOperations !== undefined
            ? { authoredOperations: summary.authoredOperations } : { requests: summary.requests }),
          ...(Number.isInteger(summary.status) ? { status: summary.status } : {}),
          ...(summary.reason ? { reason: REASONS.has(summary.reason) ||
            (browserIdentity && ["primary-unreadable", "rejected", "aborted", "timed-out"].includes(summary.reason))
            ? summary.reason : "worker-rejected" } : {}),
          ...(experimentalMultiDestination && summary.branches ? { branches: branchOutcomes() } : {}),
          ...(manualIdentity && activeRequests.length ? { chain: manualChainOutcome() } : {}),
          ...(summary.disposition === "consent-updated"
            ? { unmodeledPurposes: Object.keys(activeCommand[2]).filter((key) => key !== "ad_storage") } : {}),
        });
        if (summary.terminal) stop("transport-failed");
      }
      inFlight = false;
      awaitingResult = false;
      activeSequence = undefined;
      activeCommandDeadline = undefined;
      activeHostConsent = undefined;
      activeCommand = undefined;
      activeContext = undefined;
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
    const hostConsentAtCapture = resolveConsent(hostConsent, "ad_storage");
    const generationAtCapture = consentGeneration;
    if (experimentalDisableRemarketing && args[0] === "set" && args[1] === "allow_ad_personalization_signals" &&
        (!validRemarketingDisableCommand(args) || admitted !== 0)) { reject("unsupported-remarketing-control"); return; }
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
        const remarketingPurchaseCommand = index === 2 && args[0] === "event" &&
          isRemarketingPurchase(args[1], keys.includes("send_to"), experimentalViewItem, experimentalRemarketingPurchase);
        const purchaseCommand = experimentalPurchase && !remarketingPurchaseCommand &&
          index === 2 && args[0] === "event" && args[1] === "purchase";
        const cartCommand = experimentalPurchaseCart && purchaseCommand;
        const discountCommand = experimentalPurchaseDiscount && purchaseCommand;
        const feedCommand = experimentalPurchaseFeed && purchaseCommand;
        const customCommand = experimentalCustomVariables && index === 2 && args[0] === "event" && args[1] === "conversion";
        const viewItemCommand = index === 2 && args[0] === "event" &&
          (isEnabledViewEvent(args[1], experimentalViewItem, viewEvents) || remarketingPurchaseCommand);
        const allowedKeys = consentCommand ? CONSENT_COMMAND_KEYS : viewItemCommand ? ["items", "value"] : purchaseCommand
          ? [...PARAM_KEYS, "new_customer", ...(cartCommand ? ["items"] : []), ...(discountCommand ? ["discount"] : []),
            ...(feedCommand ? FEED_KEYS : [])] : customCommand ? [...PARAM_KEYS, ...CUSTOM_KEYS] : PARAM_KEYS;
        const allowCallback = experimentalCallbacks && index === 2 && args[0] === "event" && args[1] === "conversion";
        const callbackKeys = allowCallback ? ["event_callback", "event_timeout"] : [];
        if (keys.length > 4 + Number(purchaseCommand) + Number(cartCommand) + Number(discountCommand) +
            (feedCommand ? FEED_KEYS.length : 0) + (customCommand ? CUSTOM_KEYS.length : 0) + callbackKeys.length ||
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
          if (cartCommand && key === "items" && descriptor.value !== undefined) {
            const items = snapshotPurchaseCartItems(descriptor.value);
            if (!items) { reject("unsupported-items"); return; }
            params[key] = items;
            continue;
          }
          if (viewItemCommand && key === "items" && descriptor.value !== undefined) {
            const items = snapshotViewItems(descriptor.value, viewOptions);
            if (!items) { reject("unsupported-items"); return; }
            params[key] = items;
            continue;
          }
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
      capturedConsent.set(event, hostConsentAtCapture);
      if (manualIdentity || browserIdentity) capturedConsentGeneration.set(event, generationAtCapture);
      if (callback) {
        const entry = { fn: callback.fn, scheduled: false, timer: undefined };
        entry.timer = setTimeout(() => scheduleCallback(seq, "timeout"), callback.timeout);
        callbacks.set(seq, entry);
      }
      queue.push(event);
      if (experimentalDisableRemarketing && validRemarketingDisableCommand(payload.args)) remarketingDisabled = true;
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
    transport = chamber || browserChamber(!!browserIdentity);
    subscriptions.push(transport.onMessage((message) => {
      if (phase === "terminal" || phase === "disposed") return;
      if (browserIdentity && (!message || typeof message !== "object" || Array.isArray(message) ||
          !["fatal", "phase", "result", "browser-operation-request"].includes(message.type))) {
        stop("request-correlation-failed"); return;
      }
      if (message?.type === "fatal") { stop(FAILURES.has(message.message) ? message.message : "worker-fatal"); return; }
      if (browserIdentity && message?.type === "phase" &&
          (message.name !== "configured" || Object.keys(message).length !== 2)) {
        stop("request-correlation-failed"); return;
      }
      if (message?.type === "phase" && message.name === "configured") {
        if (phase !== "starting") { stop("duplicate-configured"); return; }
        phase = "ready";
        clearTimeout(initTimer);
      }
      if (message?.type === "result") {
        const summary = message.summary;
        if (!inFlight || !awaitingResult || summary?.seq !== activeSequence) { stop("result-correlation-failed"); return; }
        const browserResult = browserIdentity && summary.authoredOperations !== undefined;
        if (browserIdentity && !browserResult &&
            (!Array.isArray(message.ready) || message.ready.length !== 0 ||
             Object.keys(message).length !== 3 ||
             Object.keys(message).some((key) => !["type", "summary", "ready"].includes(key)) ||
             !["seq", "disposition", "requests", "reason"].every((key) => key in summary || key === "reason") ||
             Object.keys(summary).some((key) => !["seq", "disposition", "requests", "reason"].includes(key)))) {
          stop("result-transport-mismatch"); return;
        }
        if (browserResult && (!Array.isArray(message.ready) || message.ready.length !== 0 ||
            Object.keys(message).length !== 3 ||
            Object.keys(message).some((key) => !["type", "summary", "ready"].includes(key)))) {
          stop("result-transport-mismatch"); return;
        }
        if (summary.disposition === "bootstrap-accepted" &&
            (!Array.isArray(message.ready) || message.ready.length !== 0 ||
              Object.keys(message).some((key) => !["type", "summary", "ready"].includes(key)))) {
          stop("result-transport-mismatch"); return;
        }
        if (["remarketing-disabled", "remarketing-suppressed"].includes(summary.disposition) &&
            (!Array.isArray(message.ready) || message.ready.length !== 0 ||
              Object.keys(message).some((key) => !["type", "summary", "ready"].includes(key)))) {
          stop("result-transport-mismatch"); return;
        }
        if (!(browserResult ? ["readable", "opaque", "failed"] : ["configured", "rejected", "held", "transport-settled", "failed",
          ...(experimentalMultiDestination ? ["partial"] : []),
          ...(experimentalConsentCommands ? ["consent-updated"] : []),
          ...(experimentalBootstrap ? ["bootstrap-accepted"] : []),
          ...(experimentalDisableRemarketing ? ["remarketing-disabled", "remarketing-suppressed"] : []),
          ...(experimentalParameterScopes ? ["scope-updated"] : [])]).includes(summary.disposition) ||
            (!browserResult && !(manualIdentity ? [0, 1, 3] : experimentalMultiDestination ? [0, 1, 2] : [0, 1]).includes(summary.requests)) ||
            (summary.status !== undefined && (!Number.isInteger(summary.status) || summary.status < 0 || summary.status > 599))) {
          stop("invalid-worker-result"); return;
        }
        if (!matchesHostResponse(summary)) { stop("result-transport-mismatch"); return; }
        awaitingResult = false;
      }
      if (browserIdentity && message?.type === "browser-operation-request") {
        admitBrowserOperation(message);
        return;
      }
      if (manualIdentity && message?.type === "intercepted-fetch") {
        if (phase !== "ready" || !inFlight || !awaitingResult || !Array.isArray(activeRequests)) {
          stop("request-correlation-failed"); return;
        }
        const index = activeRequests.length;
        const stages = ["primary", "secondary", "final"];
        const methods = ["GET", "POST", "GET"];
        const prior = activeRequests.at(-1);
        const validKeys = ["type", "id", "url", "method", "stage", "parent", ...(index ? ["source"] : [])];
        let valid = inFlight && awaitingResult && activeCommand?.[0] === "event" && activeCommand[1] === "conversion" &&
          index < 3 && message.id === lastRequestId + 1 && message.stage === stages[index] &&
          message.method === methods[index] && message.parent === (prior?.id ?? 0) &&
          Object.keys(message).length === validKeys.length && Object.keys(message).every((key) => validKeys.includes(key)) &&
          typeof message.url === "string" && message.url.length <= 8192 &&
          message.url.startsWith(`${manualPaths[index]}?`) && !message.url.includes("#");
        if (valid && index > 0) {
          const prefix = index === 1
            ? `https://googleads.g.doubleclick.net/pagead/viewthroughconversion/${match[2]}/`
            : `https://www.google.com/pagead/1p-conversion/${match[2]}/`;
          valid = prior.actual && prior.response?.status === (index === 1 ? 200 : 302) &&
            typeof message.source === "string" && message.source.startsWith(`${prefix}?`) &&
            message.url === `${manualPaths[index]}${message.source.slice(prefix.length)}` &&
            (index === 1 ? typeof prior.response.body === "string" &&
              prior.response.body.includes(JSON.stringify(message.source)) : prior.response.headers?.location === message.source);
        }
        if (!valid) { stop("request-correlation-failed"); return; }
        lastRequestId = message.id;
        activeRequest = { id: message.id, stage: message.stage, parent: message.parent,
          url: message.url, method: message.method, actual: false };
        activeRequests.push(activeRequest);
        let finishResponse;
        const promise = new Promise((resolve) => { finishResponse = resolve; });
        hostResponsesPending.set(message.id, { promise, resolve: finishResponse });
        for (const listener of hostListeners) listener({ type: "intercepted-fetch", id: message.id,
          url: message.url, method: message.method });
        return;
      }
      if (message?.type === "intercepted-fetch") {
        if (!inFlight || !awaitingResult ||
            !dispatchEvent(activeCommand, experimentalPurchase, experimentalViewItem, viewEvents, experimentalRemarketingPurchase) ||
            (remarketingDisabled &&
              remarketingEvent(activeCommand, experimentalViewItem, viewEvents, experimentalRemarketingPurchase)) ||
            (experimentalMultiDestination
              ? !activeSelectors || message.index !== activeRequests.length || message.index >= activeSelectors.length ||
                (activeRequest && (!activeRequest.response ||
                  (activeRequest.response.status === 0 && !activeRequest.response.held)))
              : activeRequest) || !Number.isSafeInteger(message.id) || message.id <= lastRequestId) {
          stop("request-correlation-failed"); return;
        }
        if (remarketingEvent(activeCommand, experimentalViewItem, viewEvents, experimentalRemarketingPurchase) &&
            !matchesViewItemRequest(message.url, endpoint, activeCommand, viewOptions)) {
          stop("request-correlation-failed"); return;
        }
        if ((experimentalViewItem || experimentalViewEvent) &&
            !remarketingEvent(activeCommand, experimentalViewItem, viewEvents, experimentalRemarketingPurchase) && hasViewItemMarker(message.url)) {
          stop("request-correlation-failed"); return;
        }
        if ((experimentalViewSearchResults || experimentalAddToCart || experimentalRemarketingPurchase) &&
            !remarketingEvent(activeCommand, experimentalViewItem, viewEvents, experimentalRemarketingPurchase) &&
            !matchesLabeledEventMarker(message.url, activeCommand[1])) {
          stop("request-correlation-failed"); return;
        }
        if ((experimentalRemarketingPurchase || remarketingDisabled) && activeCommand[1] === "purchase" &&
            !remarketingEvent(activeCommand, experimentalViewItem, viewEvents, experimentalRemarketingPurchase) &&
            !matchesLabeledPurchaseRequest(message.url, endpoint, activeCommand, activeContext, experimentalRouting)) {
          stop("request-correlation-failed"); return;
        }
        if (remarketingDisabled && activeCommand[1] === "conversion" &&
            !matchesLabeledConversionRequest(message.url, endpoint, activeCommand, activeContext, experimentalRouting, experimentalCustomVariables)) {
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
    if (browserIdentity) subscriptions.push(transport.onLoss?.(() => stop("worker-lost")));
    host = createWrappedSdkHost({
      chamber: {
        postMessage(message) {
          if (manualIdentity && message?.type === "intercepted-fetch-response") {
            const pendingResponse = hostResponsesPending.get(message.id);
            if (pendingResponse) {
              hostResponsesPending.delete(message.id);
              pendingResponse.resolve();
            }
          }
          if (phase === "terminal" || phase === "disposed") return;
          if (message?.type === "intercepted-fetch-response" && !recordHostResponse(message)) return;
          try { transport.postMessage(message); } catch { stop("transport-post-failed"); }
        },
        onMessage: (listener) => hostListeners.add(listener),
      },
      caps: { egress: { dispatch(request) {
        const work = dispatch(request);
        if (manualIdentity) {
          capabilityWork.add(work);
          void work.then(() => capabilityWork.delete(work), () => capabilityWork.delete(work));
        }
        return work;
      } } }, endpointCeiling: manualPaths || endpoints, consent: consentVector,
      egressPurposes: ["ad_storage"], grantedCookieNames: [], timeoutMs: transportTimeoutMs, onDiagnostic() {},
    });
    initTimer = setTimeout(() => stop("init-timeout"), initTimeoutMs);
    if (browserIdentity) {
      const setupTimer = setTimeout(() => { browserSetup.abort(); stop("realm-timeout"); }, initTimeoutMs);
      browserRealmReady = import("./google-browser-operation-realm.js")
        .then(({ createGoogleBrowserRealm }) =>
          createGoogleBrowserRealm(browserIdentity.recipientOrigins, () => stop("realm-lost"), browserSetup.signal))
        .then((realm) => {
          if (browserSetup.signal.aborted || phase === "terminal" || phase === "disposed") {
            realm.dispose(); throw new Error("realm-retired");
          }
          browserRealm = realm;
          return realm;
        })
        .catch((error) => { stop("realm-unavailable"); throw error; })
        .finally(() => clearTimeout(setupTimer));
      void browserRealmReady.catch(() => {});
    }
    host.init({ endpoint, transportTimeoutMs,
      ...(manualIdentity ? { experimentalManualResponseChain: manualIdentity } : {}),
      ...(browserIdentity ? { experimentalBrowserOperation: {
        instanceId: browserIdentity.instanceId, epoch: browserIdentity.epoch, auid: browserIdentity.auid,
        secondaryOrigin: browserIdentity.secondaryOrigin,
      } } : {}),
      ...(experimentalRouting === true ? { experimentalRouting: true } : {}),
      ...(experimentalParameterScopes === true ? { experimentalParameterScopes: true } : {}),
      ...(experimentalConsentCommands === true ? { experimentalConsentCommands: true } : {}),
      ...(experimentalBootstrap === true ? { experimentalBootstrap: true } : {}),
      ...(experimentalPurchase === true ? { experimentalPurchase: true } : {}),
      ...(experimentalPurchaseCart === true ? { experimentalPurchaseCart: true } : {}),
      ...(experimentalPurchaseDiscount === true ? { experimentalPurchaseDiscount: true } : {}),
      ...(experimentalPurchaseFeed === true ? { experimentalPurchaseFeed: true } : {}),
      ...(experimentalCustomVariables === true ? { experimentalCustomVariables: true } : {}),
      ...(experimentalRetailViewItem === true ? { experimentalRetailViewItem: true } : {}),
      ...(experimentalEducationViewItem === true ? { experimentalEducationViewItem: true } : {}),
      ...(experimentalLocalViewItem === true ? { experimentalLocalViewItem: true } : {}),
      ...(experimentalRealEstateViewItem === true ? { experimentalRealEstateViewItem: true } : {}),
      ...(experimentalTravelViewItem === true ? { experimentalTravelViewItem: true } : {}),
      ...(experimentalFlightsViewItem === true ? { experimentalFlightsViewItem: true } : {}),
      ...(experimentalViewItemList === true ? { experimentalViewItemList: true } : {}),
      ...(experimentalViewSearchResults === true ? { experimentalViewSearchResults: true } : {}),
      ...(experimentalAddToCart === true ? { experimentalAddToCart: true } : {}),
      ...(experimentalRemarketingPurchase === true ? { experimentalRemarketingPurchase: true } : {}),
      ...(experimentalDisableRemarketing === true ? { experimentalDisableRemarketing: true } : {}),
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
      if (phase !== "terminal" && phase !== "disposed") {
        hostConsent.ad_storage = vector?.ad_storage;
        if ((manualIdentity || browserIdentity) && resolveConsent(hostConsent, "ad_storage") !== "granted") consentGeneration += 1;
        if (resolveConsent(hostConsent, "ad_storage") !== "granted" &&
            (browserIdentity || (manualIdentity && inFlight && activeCommand?.[0] === "event"))) {
          activeLeaseInvalid = true;
          stop("consent-revoked");
        }
      }
    },
    ...(browserIdentity ? {
      retireBrowserWorker() { stop("worker-lost"); },
      setBrowserPermissions(permissions) {
        if (phase === "terminal" || phase === "disposed") return;
        const allowed = new Set();
        if (permissions && Object.getPrototypeOf(permissions) === Object.prototype) {
          for (const origin of browserIdentity.permissionOrigins) {
            const descriptor = Object.getOwnPropertyDescriptor(permissions, origin);
            if (descriptor && Object.hasOwn(descriptor, "value") &&
                Array.isArray(descriptor.value) && descriptor.value.length === 1 && descriptor.value[0] === "ad_storage") {
              allowed.add(origin);
            }
          }
        }
        browserPermissions = allowed;
        if (browserIdentity.permissionOrigins.some((origin) => !allowed.has(origin))) stop("browser-permission-revoked");
      },
    } : {}),
    async dispose() { stop("disposed", true); await closed; },
  };
}
