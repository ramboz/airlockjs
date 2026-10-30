import { SYNTHETIC_META_PIXEL_ID } from "../pixel/vendors/meta.js";
import { BASIC_EVENT_DATA_KEYS, SCALAR_EVENT_DATA_KEYS, isStandardEventDataKey, snapshotPageViewData } from "./pageview-data.js";
import { snapshotEventOptions } from "./event-options.js";
import { snapshotSyntheticIdentity, validSyntheticIdentityFixtures } from "./synthetic-identity.js";
import { hashField } from "../pixel/advanced-matching.js";

const CONTEXT_KEYS = ["pageURL", "referrer", "inFrame", "screenWidth", "screenHeight", "timezoneOffset"];
const MULTI_PIXEL_LIMIT = 4;
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

function validContext(context) {
  return context && typeof context === "object" && !Array.isArray(context) &&
    Object.keys(context).length === CONTEXT_KEYS.length &&
    CONTEXT_KEYS.every((key) => Object.hasOwn(context, key)) &&
    validURL(context.pageURL) && validURL(context.referrer, true) &&
    typeof context.inFrame === "boolean" &&
    [context.screenWidth, context.screenHeight].every((n) => Number.isInteger(n) && n >= 0 && n <= 32768) &&
    Number.isInteger(context.timezoneOffset) && Math.abs(context.timezoneOffset) <= 1440;
}

/**
 * EXPERIMENTAL, SDK-free ConnectorFactory. payload.args carries an explicit
 * command; payload.context carries pageURL/referrer (absolute HTTP(S), with an
 * empty referrer allowed), inFrame (boolean), screenWidth/screenHeight and
 * timezoneOffset (integer minutes). Optional event/routing behavior is not
 * native-qualified. No DOM, cookies or ambient network.
 */
export function createMetaPageViewPrototype({
  endpoint, experimentalPageViewData = false, experimentalRouting = false, experimentalMultiPixelRouting = false,
  experimentalEvents = false, experimentalScalarEventData = false, experimentalContentIds = false, experimentalContents = false,
  experimentalContentNameArray = false, experimentalContentsItemPrice = false,
  experimentalCustomProperties = false, experimentalNumericOrderId = false, experimentalEventIds = false, experimentalSetAgent = false,
  experimentalSyntheticAdvancedMatching = false, syntheticIdentityFixtures = null,
  experimentalTagConsent = false,
} = {}) {
  if ([experimentalPageViewData, experimentalRouting, experimentalMultiPixelRouting, experimentalEvents,
    experimentalScalarEventData, experimentalContentNameArray, experimentalContentIds, experimentalContents,
    experimentalContentsItemPrice, experimentalCustomProperties,
    experimentalNumericOrderId, experimentalEventIds, experimentalSetAgent,
    experimentalSyntheticAdvancedMatching, experimentalTagConsent]
    .some((option) => typeof option !== "boolean")) {
    throw new Error("invalid-experimental-option");
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
  if (experimentalSyntheticAdvancedMatching && !experimentalMultiPixelRouting) {
    throw new Error("synthetic-identity-requires-multi-pixel-routing");
  }
  if (experimentalSyntheticAdvancedMatching && !validSyntheticIdentityFixtures(syntheticIdentityFixtures)) {
    throw new Error("invalid-synthetic-identity-fixtures");
  }
  const identityFixtures = experimentalSyntheticAdvancedMatching ? [...syntheticIdentityFixtures] : null;
  const match = typeof endpoint === "string" && endpoint.match(/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/tr\/$/);
  if (!match || Number(match[1]) > 65535) throw new Error("literal-loopback-endpoint-required");
  const pixelIds = new Set();
  const pendingPixelIds = new Set();
  const identityHashes = new Map();
  const agents = new Map();
  let initialized = false;
  return {
    manifest: {
      name: "airlock/meta-pixel/pageview-prototype",
      events: ["meta-pixel-command"],
      reads: [],
      capabilities: { egress: true },
      endpoints: [endpoint],
      purposes: { egress: ["ad_storage"], endpoints: { [endpoint]: ["ad_storage"] } },
    },
    init() { initialized = true; },
    handle(event) {
      if (!initialized) throw new Error("connector-not-initialized");
      const { args, context } = event?.payload || {};
      if (event?.type !== "meta-pixel-command" || !Array.isArray(args)) {
        throw new Error("unsupported-command");
      }
      if (experimentalTagConsent && args[0] === "consent" && args.length === 2 &&
          (args[1] === "revoke" || args[1] === "grant")) return [];
      if (experimentalSetAgent && args[0] === "set") {
        if (args.length !== 4 || args[1] !== "agent") throw new Error("unsupported-command");
        if (typeof args[2] !== "string" ||
            !/^(?:magento_opensource|adobe_commerce)-0\.0\.0-\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(args[2])) {
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
      if (args[0] === "init" && (args.length === 2 || hasIdentity)) {
        if (experimentalRouting === true) {
          if (typeof args[1] !== "string" || !/^\d{1,32}$/.test(args[1])) throw new Error("invalid-pixel-id");
        } else if (args[1] !== SYNTHETIC_META_PIXEL_ID) throw new Error("synthetic-pixel-required");
        const pixelId = args[1];
        if (pixelIds.has(pixelId) || pendingPixelIds.has(pixelId) ||
            (!experimentalMultiPixelRouting && (pixelIds.size || pendingPixelIds.size))) throw new Error("duplicate-init");
        if (pixelIds.size + pendingPixelIds.size >= MULTI_PIXEL_LIMIT) throw new Error("pixel-limit");
        if (hasIdentity) {
          const identity = snapshotSyntheticIdentity(args[2], identityFixtures);
          if (!identity) throw new Error("unsupported-identity");
          pendingPixelIds.add(pixelId);
          return hashField("external_id", identity.external_id).then((hash) => {
            pendingPixelIds.delete(pixelId);
            if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error("identity-hash-failed");
            identityHashes.set(pixelId, hash);
            pixelIds.add(pixelId);
            return [];
          }, () => { pendingPixelIds.delete(pixelId); throw new Error("identity-hash-failed"); });
        }
        pixelIds.add(pixelId);
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
      if (!validContext(context)) throw new Error("invalid-context");
      const pageViewData = args.length > dataIndex
        ? snapshotPageViewData(
          args[dataIndex], experimentalScalarEventData, experimentalContentIds, experimentalContents, experimentalCustomProperties,
          experimentalNumericOrderId, experimentalContentsItemPrice, experimentalContentNameArray,
        ) : null;
      if (args.length > dataIndex && !pageViewData) throw new Error("unsupported-parameters");
      const eventOptions = hasOptions ? snapshotEventOptions(args[dataIndex + 1]) : null;
      if (hasOptions && !eventOptions) throw new Error("unsupported-options");
      return (single ? [args[1]] : [...pixelIds]).map((pixelId) => {
        const query = new URLSearchParams({
          id: pixelId,
          ev: name,
          dl: context.pageURL,
          rl: context.referrer,
          if: String(context.inFrame),
          sw: String(context.screenWidth),
          sh: String(context.screenHeight),
          tz: String(context.timezoneOffset),
        });
        if (pageViewData) {
          for (const key of experimentalScalarEventData ? [...BASIC_EVENT_DATA_KEYS, ...SCALAR_EVENT_DATA_KEYS] : BASIC_EVENT_DATA_KEYS) {
            if (Object.hasOwn(pageViewData, key) && pageViewData[key] !== undefined) {
              const value = key === "content_name" && Array.isArray(pageViewData[key])
                ? JSON.stringify(pageViewData[key]) : String(pageViewData[key]);
              query.append(`cd[${key}]`, value);
            }
          }
          if (experimentalContentIds && Object.hasOwn(pageViewData, "content_ids") && pageViewData.content_ids !== undefined) {
            query.append("cd[content_ids]", JSON.stringify(pageViewData.content_ids));
          }
          if (experimentalContents && Object.hasOwn(pageViewData, "contents") && pageViewData.contents !== undefined) {
            query.append("cd[contents]", JSON.stringify(pageViewData.contents));
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
        const url = `${endpoint}?${query}`;
        if (url.length > 8192) throw new Error("encoded-context-limit");
        return { url, method: "GET" };
      });
    },
  };
}
