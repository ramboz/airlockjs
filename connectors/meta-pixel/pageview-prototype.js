import { SYNTHETIC_META_PIXEL_ID } from "../pixel/vendors/meta.js";
import { snapshotPageViewData } from "./pageview-data.js";

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
  experimentalEvents = false,
} = {}) {
  if ([experimentalPageViewData, experimentalRouting, experimentalMultiPixelRouting, experimentalEvents]
    .some((option) => typeof option !== "boolean")) {
    throw new Error("invalid-experimental-option");
  }
  if (experimentalMultiPixelRouting && !experimentalRouting) throw new Error("multi-pixel-routing-requires-routing");
  const match = typeof endpoint === "string" && endpoint.match(/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/tr\/$/);
  if (!match || Number(match[1]) > 65535) throw new Error("literal-loopback-endpoint-required");
  const pixelIds = new Set();
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
      if (args[0] === "init" && args.length === 2) {
        if (experimentalRouting === true) {
          if (typeof args[1] !== "string" || !/^\d{1,32}$/.test(args[1])) throw new Error("invalid-pixel-id");
        } else if (args[1] !== SYNTHETIC_META_PIXEL_ID) throw new Error("synthetic-pixel-required");
        if (pixelIds.has(args[1]) || (!experimentalMultiPixelRouting && pixelIds.size)) throw new Error("duplicate-init");
        if (pixelIds.size >= MULTI_PIXEL_LIMIT) throw new Error("pixel-limit");
        pixelIds.add(args[1]);
        return [];
      }
      const single = experimentalMultiPixelRouting && ["trackSingle", "trackSingleCustom"].includes(args[0]);
      const custom = args[0] === "trackCustom" || args[0] === "trackSingleCustom";
      const dataIndex = single ? 3 : 2;
      const name = args[single ? 2 : 1];
      if ((!single && args[0] !== "track" && args[0] !== "trackCustom") ||
          (custom && !experimentalEvents) || (!experimentalEvents && name !== "PageView") ||
          !(args.length === dataIndex || experimentalPageViewData && args.length === dataIndex + 1)) {
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
      const pageViewData = args.length > dataIndex ? snapshotPageViewData(args[dataIndex]) : null;
      if (args.length > dataIndex && !pageViewData) throw new Error("unsupported-parameters");
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
          for (const key of ["value", "currency"]) {
            if (Object.hasOwn(pageViewData, key) && pageViewData[key] !== undefined) query.append(`cd[${key}]`, String(pageViewData[key]));
          }
        }
        const url = `${endpoint}?${query}`;
        if (url.length > 8192) throw new Error("encoded-context-limit");
        return { url, method: "GET" };
      });
    },
  };
}
