import { SYNTHETIC_META_PIXEL_ID } from "../pixel/vendors/meta.js";
import { snapshotPageViewData } from "./pageview-data.js";

const CONTEXT_KEYS = ["pageURL", "referrer", "inFrame", "screenWidth", "screenHeight", "timezoneOffset"];

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
 * timezoneOffset (integer minutes). No DOM, cookies or ambient network.
 */
export function createMetaPageViewPrototype({ endpoint, experimentalPageViewData = false, experimentalRouting = false } = {}) {
  if (typeof experimentalPageViewData !== "boolean" || typeof experimentalRouting !== "boolean") {
    throw new Error("invalid-experimental-option");
  }
  const match = typeof endpoint === "string" && endpoint.match(/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/tr\/$/);
  if (!match || Number(match[1]) > 65535) throw new Error("literal-loopback-endpoint-required");
  let pixelId;
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
      if (event?.type !== "meta-pixel-command" || !Array.isArray(args) ||
          !(args.length === 2 || experimentalPageViewData === true && args.length === 3 &&
            args[0] === "track" && args[1] === "PageView")) {
        throw new Error("unsupported-command");
      }
      if (args[0] === "init") {
        if (experimentalRouting === true) {
          if (typeof args[1] !== "string" || !/^\d{1,32}$/.test(args[1])) throw new Error("invalid-pixel-id");
        } else if (args[1] !== SYNTHETIC_META_PIXEL_ID) throw new Error("synthetic-pixel-required");
        if (pixelId) throw new Error("duplicate-init");
        pixelId = args[1];
        return [];
      }
      if (args[0] !== "track" || args[1] !== "PageView") throw new Error("unsupported-command");
      if (!pixelId) throw new Error("pageview-before-init");
      if (!validContext(context)) throw new Error("invalid-context");
      const pageViewData = args.length === 3 ? snapshotPageViewData(args[2]) : null;
      if (args.length === 3 && !pageViewData) throw new Error("unsupported-parameters");
      const query = new URLSearchParams({
        id: pixelId,
        ev: "PageView",
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
      return [{ url, method: "GET" }];
    },
  };
}
