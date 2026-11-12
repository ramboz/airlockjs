import { SYNTHETIC_META_PIXEL_ID } from "../pixel/vendors/meta.js";
import { BASIC_EVENT_DATA_KEYS, SCALAR_EVENT_DATA_KEYS, isStandardEventDataKey, snapshotPageViewData } from "./pageview-data.js";
import { snapshotEventOptions } from "./event-options.js";
import { snapshotSyntheticIdentity, validSyntheticIdentityFixtures } from "./synthetic-identity.js";
import { isSupportedSyntheticAgent, snapshotInitAgentOptions } from "./agent-options.js";
import { hashField } from "../pixel/advanced-matching.js";
import { pageViewCookie } from "./pageview-cookie.js";

const CONTEXT_KEYS = ["pageURL", "referrer", "inFrame", "screenWidth", "screenHeight", "timezoneOffset"];
const PERFORMANCE_KEYS = [
  "performanceModernAvailable", "performanceNavigationEntryAvailable",
  "performanceStartTime", "performanceDomContentLoadedEventEnd", "performanceNavigationStart",
];
const MULTI_PIXEL_LIMIT = 4;
const LIVE_ENDPOINT = "https://www.facebook.com/tr/";

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

function samplePageViewPerformance(raw) {
  const { performanceModernAvailable: modern, performanceNavigationEntryAvailable: entry,
    performanceStartTime: start, performanceDomContentLoadedEventEnd: end,
    performanceNavigationStart: legacy } = raw;
  const value = modern ? (entry ? end - start : null) : (end === null ? null : end - legacy);
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

// This is an exact, case-specific allowance, not a configurable vendor host.
export function snapshotLiveBinding(value, endpoint) {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error("invalid-live-binding");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== 2 ||
      !["pixelId", "documentURL"].every((key) => Object.hasOwn(descriptors[key] || {}, "value"))) {
    throw new Error("invalid-live-binding");
  }
  const { pixelId, documentURL } = value;
  const match = typeof documentURL === "string" &&
    documentURL.match(/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/meta-delivery\/([A-Za-z0-9_-]{1,128})$/);
  if (endpoint !== LIVE_ENDPOINT || typeof pixelId !== "string" || !/^\d{1,32}$/.test(pixelId) ||
      !match || Number(match[1]) > 65535) throw new Error("invalid-live-binding");
  return { pixelId, documentURL };
}

export function snapshotOwnedPocBinding(value, endpoint) {
  try {
    if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
      throw new Error();
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = ["pixelId", "documentURL", "notBefore", "notAfter"];
    if (Reflect.ownKeys(descriptors).length !== keys.length ||
        !keys.every((key) => Object.hasOwn(descriptors[key] || {}, "value"))) throw new Error();
    const { pixelId, documentURL, notBefore, notAfter } = value;
    if (endpoint !== LIVE_ENDPOINT || typeof pixelId !== "string" || !/^\d{1,32}$/.test(pixelId) ||
        typeof documentURL !== "string" ||
        !/^https:\/\/main--aem-eds-airlock-poc--adobe-rnd\.aem\.live\/\?airlock-meta=pageview-v1&meta-pixel=off&consent=accept&run=[A-Za-z0-9_-]{1,128}(?![\s\S])/.test(documentURL) ||
        !Number.isSafeInteger(notBefore) || !Number.isSafeInteger(notAfter) ||
        notBefore <= 0 || notAfter <= notBefore || notAfter - notBefore > 360000) throw new Error();
    return Object.freeze({ pixelId, documentURL, notBefore, notAfter });
  } catch {
    throw new Error("invalid-owned-poc-binding");
  }
}
const STANDARD_EVENTS = new Set([
  "PageView", "AddPaymentInfo", "AddToCart", "AddToWishlist", "CompleteRegistration",
  "Contact", "CustomizeProduct", "Donate", "FindLocation", "InitiateCheckout", "Lead",
  "Purchase", "Schedule", "Search", "StartTrial", "SubmitApplication", "Subscribe", "ViewContent",
]);

function validURL(value, empty = false) {
  if (typeof value !== "string" || value.length > 2048) return false;
  if (empty && value === "") return true;
  if (!/^https?:\/\//.test(value) || /[\s\u0000-\u001f\u007f]/u.test(value)) return false; // eslint-disable-line no-control-regex -- reject URL control characters
  try {
    const url = new URL(value);
    return !url.username && !url.password;
  } catch {
    return false;
  }
}

function validContext(context, timing = false) {
  return context && typeof context === "object" && !Array.isArray(context) &&
    Object.keys(context).length === CONTEXT_KEYS.length + (timing ? PERFORMANCE_KEYS.length : 0) &&
    CONTEXT_KEYS.every((key) => Object.hasOwn(context, key)) &&
    (!timing || snapshotPerformanceContext(context)) &&
    validURL(context.pageURL) && validURL(context.referrer, true) &&
    typeof context.inFrame === "boolean" &&
    [context.screenWidth, context.screenHeight].every((n) => Number.isInteger(n) && n >= 0 && n <= 32768) &&
    Number.isInteger(context.timezoneOffset) && Math.abs(context.timezoneOffset) <= 1440;
}

function exactDataContext(context, timing) {
  if (!context || typeof context !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(context))) return false;
  const keys = [...CONTEXT_KEYS, ...(timing ? PERFORMANCE_KEYS : [])];
  const descriptors = Object.getOwnPropertyDescriptors(context);
  return Reflect.ownKeys(descriptors).length === keys.length &&
    keys.every((key) => Object.hasOwn(descriptors[key] || {}, "value")) && validContext(context, timing);
}

const REFERRER_NAMES = ["lastExternalReferrer", "lastExternalReferrerTime"];
const REFERRER_LIFETIME = 90 * 24 * 60 * 60 * 1000;

function snapshotReferrerContext(context, timing) {
  if (!context || typeof context !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(context))) return null;
  const keys = [...CONTEXT_KEYS, ...(timing ? PERFORMANCE_KEYS : []), "userAgent", "xhrDefined"];
  const descriptors = Object.getOwnPropertyDescriptors(context);
  if (Reflect.ownKeys(descriptors).length !== keys.length ||
      !keys.every((key) => Object.hasOwn(descriptors[key] || {}, "value"))) return null;
  const raw = Object.fromEntries(keys.map((key) => [key, descriptors[key].value]));
  const page = Object.fromEntries(keys.filter((key) => key !== "userAgent" && key !== "xhrDefined")
    .map((key) => [key, raw[key]]));
  if (!validContext(page, timing) || typeof raw.userAgent !== "string" ||
      raw.userAgent.length > 1024 || !raw.userAgent.isWellFormed() || typeof raw.xhrDefined !== "boolean") return null;
  return raw;
}

function referrerPlatformEligible({ userAgent, xhrDefined }) {
  return !(xhrDefined && userAgent.includes("Android") &&
    (userAgent.includes("FB_IAB") || userAgent.includes("Instagram"))) &&
    !(userAgent.includes("AppleWebKit") &&
      ["FBIOS", "Instagram", "MessengerLiteForiOS"].some((token) => userAgent.includes(token)));
}

function validStorageValue(value) {
  return typeof value === "string" && value.length <= 16 &&
    [...value].every((character) => character.charCodeAt(0) <= 127);
}

async function sampleReferrer(storage, raw, current) {
  if (!referrerPlatformEligible(raw)) return { disposition: "platform-ineligible", category: null };
  if (!storage) return { disposition: "storage-unavailable", category: null };
  let attempts = 0;
  const checked = async (operation, name, value) => {
    if (!current()) throw new Error("referrer-consent-held");
    const initial = attempts++ === 0;
    let result;
    try {
      result = await storage[operation](name, ...(operation === "set" ? [value] : []));
    } catch (error) {
      if (!initial && error?.message === "storage-unavailable") {
        // Do not retain potentially private storage failure details.
        // eslint-disable-next-line preserve-caught-error
        throw new Error("storage-access-failed");
      }
      throw error;
    }
    if (!current()) throw new Error("referrer-consent-held");
    return result;
  };
  const now = Date.now();
  let category;
  try {
    category = await checked("get", REFERRER_NAMES[0]);
  } catch (error) {
    if (error?.message === "storage-unavailable") return { disposition: "storage-unavailable", category: null };
    throw error;
  }
  const timestamp = await checked("get", REFERRER_NAMES[1]);
  if ((category === null) !== (timestamp === null) ||
      (category !== null && (!validStorageValue(category) || !validStorageValue(timestamp) ||
        !/^(?:0|[1-9]\d*)$/.test(timestamp) || !Number.isSafeInteger(Number(timestamp)) ||
        Number(timestamp) > now))) throw new Error("invalid-referrer-state");
  if (timestamp !== null && now - Number(timestamp) > REFERRER_LIFETIME) {
    await checked("remove", REFERRER_NAMES[0]);
    await checked("remove", REFERRER_NAMES[1]);
    category = null;
  }
  const page = new URL(raw.pageURL);
  const referrer = raw.referrer === "" ? null : new URL(raw.referrer);
  if (referrer && referrer.hostname === page.hostname) {
    return { disposition: "sampled", category: category === null ? null :
      ["fb", "ig", "empty", "other"].includes(category) ? category : "other" };
  }
  const host = referrer?.hostname;
  const matches = (domain) => host === domain || host?.endsWith(`.${domain}`);
  category = !referrer ? "empty" : matches("facebook.com") ? "fb" : matches("instagram.com") ? "ig" : "other";
  const time = String(now);
  await checked("set", REFERRER_NAMES[0], category);
  await checked("set", REFERRER_NAMES[1], time);
  if (await checked("get", REFERRER_NAMES[0]) !== category ||
      await checked("get", REFERRER_NAMES[1]) !== time) throw new Error("referrer-readback-mismatch");
  return { disposition: "sampled", category };
}

/**
 * EXPERIMENTAL, SDK-free ConnectorFactory. payload.args carries an explicit
 * command; payload.context carries pageURL/referrer (absolute HTTP(S), with an
 * empty referrer allowed), inFrame (boolean), screenWidth/screenHeight and
 * timezoneOffset (integer minutes). Optional event/routing behavior is not
 * native-qualified. No DOM or ambient network; cookie access is mediated and
 * defaults off.
 */
export function createMetaPageViewPrototype({
  endpoint, liveBinding, ownedPocBinding, experimentalPageViewData = false, experimentalRouting = false, experimentalMultiPixelRouting = false,
  experimentalEvents = false, experimentalScalarEventData = false, experimentalContentIds = false, experimentalContents = false,
  experimentalContentNameArray = false, experimentalContentsItemPrice = false,
  experimentalCustomProperties = false, experimentalNumericOrderId = false, experimentalEventIds = false, experimentalSetAgent = false,
  experimentalNullPurchaseValue = false,
  experimentalEmptyCheckoutValue = false,
  experimentalFalseCheckoutContentId = false,
  experimentalInitAgent = false,
  experimentalMagentoHeadArray = false,
  experimentalViewContentJsonStrings = false,
  experimentalSyntheticAdvancedMatching = false, syntheticIdentityFixtures = null,
  experimentalTagConsent = false,
  experimentalFirstPartyCookie = false,
  experimentalPageViewPreparation = false,
  experimentalPageViewPerformance = false,
  experimentalPageViewReferrer = false,
  referrerStorageBinding,
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
  const live = liveBinding !== undefined ? snapshotLiveBinding(liveBinding, endpoint) :
    ownedPocBinding !== undefined ? snapshotOwnedPocBinding(ownedPocBinding, endpoint) : null;
  if (live && (features.some(Boolean) || syntheticIdentityFixtures !== null)) throw new Error("incompatible-live-feature");
  if (referrerStorageBinding !== undefined) throw new Error(live ? "incompatible-live-feature" : "invalid-referrer-binding");
  if (experimentalPageViewReferrer && (experimentalRouting || experimentalMultiPixelRouting || experimentalEvents ||
      experimentalSyntheticAdvancedMatching || experimentalInitAgent)) throw new Error("incompatible-referrer-feature");
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
  if (experimentalSyntheticAdvancedMatching && !validSyntheticIdentityFixtures(syntheticIdentityFixtures)) {
    throw new Error("invalid-synthetic-identity-fixtures");
  }
  const identityFixtures = experimentalSyntheticAdvancedMatching ? [...syntheticIdentityFixtures] : null;
  const match = typeof endpoint === "string" && endpoint.match(/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/tr\/$/);
  if (!live && (!match || Number(match[1]) > 65535)) throw new Error("literal-loopback-endpoint-required");
  const pixelIds = new Set();
  const preparationCounts = new Map();
  const pendingPixelIds = new Set();
  const identityHashes = new Map();
  const agents = new Map();
  let initialized = false;
  let pageViewPerformance = null;
  let pageViewReferrer = null;
  let referrerGeneration = 0;
  let referrerDisposition = "not-sampled";
  function sample(context) {
    if (pageViewPerformance === null) pageViewPerformance = samplePageViewPerformance(context);
  }
  let cookies;
  let storage;
  return {
    manifest: {
      name: "airlock/meta-pixel/pageview-prototype",
      events: ["meta-pixel-command"],
      reads: [],
      capabilities: { egress: true, ...(experimentalFirstPartyCookie ? { cookies: ["_fbp"] } : {}),
        ...(experimentalPageViewReferrer ? { storage: true } : {}) },
      endpoints: [endpoint],
      purposes: { egress: ["ad_storage"], endpoints: { [endpoint]: ["ad_storage"] } },
    },
    init(caps) {
      if (experimentalFirstPartyCookie && (!caps?.cookies || typeof caps.cookies.get !== "function" ||
          typeof caps.cookies.set !== "function")) throw new Error("cookie-unavailable");
      cookies = caps?.cookies;
      storage = caps?.storage;
      initialized = true;
    },
    invalidateReferrer() {
      referrerGeneration += 1;
      pageViewReferrer = null;
      referrerDisposition = "consent-held";
    },
    referrerDisposition() { return referrerDisposition; },
    handle(event) {
      if (!initialized) throw new Error("connector-not-initialized");
      const { args, context } = event?.payload || {};
      if (event?.type !== "meta-pixel-command" || !Array.isArray(args)) {
        throw new Error("unsupported-command");
      }
      if (live && !(args.length === 2 &&
          (args[0] === "init" && args[1] === live.pixelId || args[0] === "track" && args[1] === "PageView"))) {
        throw new Error("unsupported-command");
      }
      if (experimentalTagConsent && args[0] === "consent" && args.length === 2 &&
          (args[1] === "revoke" || args[1] === "grant")) return [];
      if (experimentalSetAgent && args[0] === "set") {
        if (args.length !== 4 || args[1] !== "agent") throw new Error("unsupported-command");
        if (!isSupportedSyntheticAgent(args[2])) {
          throw new Error("unsupported-agent");
        }
        if (experimentalRouting) {
          if (typeof args[3] !== "string" || !/^\d{1,32}$/.test(args[3])) throw new Error("invalid-pixel-id");
        } else if (args[3] !== SYNTHETIC_META_PIXEL_ID) throw new Error("synthetic-pixel-required");
        if (!pixelIds.has(args[3])) throw new Error("uninitialized-pixel");
        agents.set(args[3], args[2]);
        return [];
      }
      const hasIdentity = experimentalSyntheticAdvancedMatching && args[0] === "init" && args.length === 3;
      const hasInitAgent = experimentalInitAgent && args[0] === "init" && args.length === 4;
      if (args[0] === "init" && (args.length === 2 || hasIdentity || hasInitAgent)) {
        const options = hasInitAgent ? snapshotInitAgentOptions(args[2], args[3]) : null;
        if (hasInitAgent && !options) throw new Error("unsupported-init-options");
        if (experimentalRouting === true) {
          if (typeof args[1] !== "string" || !/^\d{1,32}$/.test(args[1])) throw new Error("invalid-pixel-id");
        } else if (!live && args[1] !== SYNTHETIC_META_PIXEL_ID) throw new Error("synthetic-pixel-required");
        const pixelId = args[1];
        if (pixelIds.has(pixelId) || pendingPixelIds.has(pixelId) ||
            (!experimentalMultiPixelRouting && (pixelIds.size || pendingPixelIds.size))) throw new Error("duplicate-init");
        if (pixelIds.size + pendingPixelIds.size >= MULTI_PIXEL_LIMIT) throw new Error("pixel-limit");
        const timing = experimentalPageViewPerformance ? snapshotPerformanceContext(context) : null;
        if (experimentalPageViewPerformance && !timing) throw new Error("invalid-context");
        if (experimentalPageViewReferrer) {
          if (event.snapshot?.referrerAllowed === false) {
            if (!exactDataContext(context, experimentalPageViewPerformance)) throw new Error("invalid-context");
            pixelIds.add(pixelId);
            referrerDisposition = "consent-held";
            if (timing) sample(timing);
            return [];
          }
          const raw = snapshotReferrerContext(context, experimentalPageViewPerformance);
          if (!raw) throw new Error("invalid-context");
          const generation = referrerGeneration;
          pendingPixelIds.add(pixelId);
          return sampleReferrer(storage, raw, () => generation === referrerGeneration).then((result) => {
            pendingPixelIds.delete(pixelId);
            if (generation !== referrerGeneration) throw new Error("referrer-consent-held");
            pixelIds.add(pixelId);
            pageViewReferrer = result.category;
            referrerDisposition = result.disposition;
            if (timing) sample(timing);
            return [];
          }, (error) => { pendingPixelIds.delete(pixelId); throw error; });
        }
        if (hasIdentity) {
          const identity = snapshotSyntheticIdentity(args[2], identityFixtures);
          if (!identity) throw new Error("unsupported-identity");
          pendingPixelIds.add(pixelId);
          return hashField("external_id", identity.external_id).then((hash) => {
            pendingPixelIds.delete(pixelId);
            if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error("identity-hash-failed");
            identityHashes.set(pixelId, hash);
            pixelIds.add(pixelId);
            if (timing) sample(timing);
            return [];
          }, () => { pendingPixelIds.delete(pixelId); throw new Error("identity-hash-failed"); });
        }
        pixelIds.add(pixelId);
        if (options) agents.set(pixelId, options.agent);
        if (timing) sample(timing);
        return [];
      }
      const single = experimentalMultiPixelRouting && ["trackSingle", "trackSingleCustom"].includes(args[0]);
      const custom = args[0] === "trackCustom" || args[0] === "trackSingleCustom";
      const dataIndex = single ? 3 : 2;
      const name = args[single ? 2 : 1];
      const hasOptions = experimentalEventIds && (!custom || args[0] === "trackCustom") &&
        args.length === dataIndex + 2;
      if ((!single && args[0] !== "track" && args[0] !== "trackCustom") ||
          (custom && !experimentalEvents) || (!experimentalEvents && name !== "PageView") ||
          !(args.length === dataIndex || experimentalPageViewData && args.length === dataIndex + 1 || hasOptions)) {
        throw new Error("unsupported-command");
      }
      if (custom) {
        if (typeof name !== "string" || name.length < 1 || name.length > 50 || !name.isWellFormed()) {
          throw new Error("invalid-custom-event");
        }
      } else if (!STANDARD_EVENTS.has(name)) throw new Error("unsupported-standard-event");
      if (!pixelIds.size) throw new Error(name === "PageView" ? "pageview-before-init" : "event-before-init");
      if (single && (typeof args[1] !== "string" || !/^\d{1,32}$/.test(args[1]))) throw new Error("invalid-pixel-id");
      if (single && !pixelIds.has(args[1])) throw new Error("uninitialized-pixel");
      const timingEnabled = experimentalPageViewPerformance && !custom && name === "PageView";
      if (!(experimentalPageViewReferrer ? exactDataContext(context, timingEnabled) : validContext(context, timingEnabled))) {
        throw new Error("invalid-context");
      }
      if (live && (context.pageURL !== live.documentURL || context.referrer !== "" || context.inFrame !== false)) {
        throw new Error("invalid-context");
      }
      const pageViewData = args.length > dataIndex
        ? snapshotPageViewData(
          args[dataIndex], experimentalScalarEventData, experimentalContentIds, experimentalContents, experimentalCustomProperties,
          experimentalNumericOrderId, experimentalContentsItemPrice, experimentalContentNameArray,
          experimentalNullPurchaseValue && args[0] === "trackCustom" && name === "Purchase",
          experimentalViewContentJsonStrings && args[0] === "track" && name === "ViewContent",
          experimentalPageViewData && experimentalMagentoHeadArray && hasOptions && args[0] === "track" && name === "PageView",
          experimentalEmptyCheckoutValue && args[0] === "trackCustom" && name === "InitiateCheckout",
          experimentalFalseCheckoutContentId && args[0] === "trackCustom" && name === "InitiateCheckout",
        ) : null;
      if (args.length > dataIndex && !pageViewData) throw new Error("unsupported-parameters");
      const eventOptions = hasOptions ? snapshotEventOptions(args[dataIndex + 1]) : null;
      if (hasOptions && !eventOptions) throw new Error("unsupported-options");
      if (timingEnabled) sample(snapshotPerformanceContext(context));
      const targets = single ? [args[1]] : [...pixelIds];
      const prepared = targets.map((pixelId) => {
        if (!experimentalPageViewPreparation) return { pixelId };
        const ts = Date.now();
        const ec = preparationCounts.get(pixelId) ?? 0;
        preparationCounts.set(pixelId, ec + 1);
        return { pixelId, ts, ec };
      });
      const makeRequests = (fbp) => prepared.map(({ pixelId, ts, ec }) => {
        const query = new URLSearchParams({
          id: pixelId,
          ev: name,
          dl: context.pageURL,
          rl: context.referrer,
          if: String(context.inFrame),
          sw: String(context.screenWidth),
          sh: String(context.screenHeight),
          tz: String(-context.timezoneOffset),
        });
        if (experimentalPageViewPreparation) {
          query.append("ts", String(ts));
          query.append("ec", String(ec));
        }
        if (timingEnabled && pageViewPerformance !== null) query.append("plt", String(pageViewPerformance));
        if (experimentalPageViewReferrer && pageViewReferrer !== null) query.append("ler", pageViewReferrer);
        if (pageViewData) {
          for (const key of experimentalScalarEventData ? [...BASIC_EVENT_DATA_KEYS, ...SCALAR_EVENT_DATA_KEYS] : BASIC_EVENT_DATA_KEYS) {
            if (Object.hasOwn(pageViewData, key) && pageViewData[key] !== undefined) {
              const value = pageViewData[key] === null ? "null" :
                key === "content_name" && Array.isArray(pageViewData[key])
                  ? JSON.stringify(pageViewData[key]) : String(pageViewData[key]);
              query.append(`cd[${key}]`, value);
            }
          }
          if (experimentalContentIds && Object.hasOwn(pageViewData, "content_ids") && pageViewData.content_ids !== undefined) {
            const ids = pageViewData.content_ids;
            query.append("cd[content_ids]", typeof ids === "string" ? ids : JSON.stringify(ids));
          }
          if (experimentalContents && Object.hasOwn(pageViewData, "contents") && pageViewData.contents !== undefined) {
            const contents = pageViewData.contents;
            query.append("cd[contents]", typeof contents === "string" ? contents : JSON.stringify(contents));
          }
          if (experimentalCustomProperties) {
            for (const key of Object.keys(pageViewData)) {
              if (!isStandardEventDataKey(key)) query.append(`cd[${key}]`, String(pageViewData[key]));
            }
          }
        }
        if (eventOptions) query.append("eid", eventOptions.eventID);
        if (agents.has(pixelId)) query.append("a", agents.get(pixelId));
        if (identityHashes.has(pixelId)) query.append("ud[external_id]", identityHashes.get(pixelId));
        if (fbp) query.append("fbp", fbp);
        const url = `${endpoint}?${query}`;
        if (url.length > 8192) throw new Error("encoded-context-limit");
        return { url, method: "GET" };
      });
      if (!experimentalFirstPartyCookie || custom || name !== "PageView") return makeRequests(null);
      return pageViewCookie(cookies, context.pageURL).then(makeRequests, (error) => {
        if (error?.message === "cookie-consent-held") return makeRequests(null);
        throw new Error("cookie-access-failed");
      });
    },
  };
}
