// Spec 069-01 (AC2/AC3): stock's `onBeforeEventSend`, run on the main thread before an event is enqueued.
//
// A function cannot cross the airlock, so the hook runs here. Stock hands it the event content AFTER Alloy's own
// context (web, device, environment, placeContext) is merged into the xdm, so this builds that context as plain data
// from the main-thread stock-context channel (core/stock-context.js) and merges the page's xdm over it. What goes on
// to the chamber is the hook's edit of that content, minus every context field the hook left untouched: those are the
// chamber's own Alloy to fill, so an event with no hook (or a hook that changes nothing) is byte-for-byte the event
// without one, and a context field the hook did change reaches Alloy as page-supplied xdm, which Alloy keeps.
import { collectStockContext } from "../../core/stock-context.js";

// The pinned stock Alloy version (the same pin as connectors/alloy/connector.js and the adobe-stock-wire tests).
const ALLOY_VERSION = "2.31.1";
const DEFAULT_GROUPS = ["web", "device", "environment", "placeContext"];
const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** The xdm Alloy's context components produce, from the collected page context; `groups` is Alloy's `context` option (default: all four). */
export function stockContextXdm(context, groups = DEFAULT_GROUPS) {
  const on = (g) => !Array.isArray(groups) || groups.includes(g);
  const { web = {}, device = {}, environment = {}, placeContext = {} } = context || {};
  const xdm = {};
  const webXdm = {};
  if (web.url !== undefined) webXdm.webPageDetails = { URL: web.url };
  if (typeof web.referrer === "string") webXdm.webReferrer = { URL: web.referrer };
  if (on("web") && Object.keys(webXdm).length) xdm.web = webXdm;
  const dev = {};
  if (device.screenWidth !== undefined) dev.screenWidth = device.screenWidth;
  if (device.screenHeight !== undefined) dev.screenHeight = device.screenHeight;
  if (device.screenOrientation) dev.screenOrientation = String(device.screenOrientation).startsWith("portrait") ? "portrait" : "landscape";
  if (on("device") && Object.keys(dev).length) xdm.device = dev;
  const browserDetails = {};
  if (environment.viewportWidth !== undefined) browserDetails.viewportWidth = environment.viewportWidth;
  if (environment.viewportHeight !== undefined) browserDetails.viewportHeight = environment.viewportHeight;
  if (on("environment") && Object.keys(browserDetails).length) xdm.environment = { type: "browser", browserDetails };
  if (on("placeContext") && placeContext.localTime !== undefined) xdm.placeContext = { localTime: placeContext.localTime, localTimezoneOffset: placeContext.timezoneOffset };
  xdm.timestamp = new Date().toISOString();
  xdm.implementationDetails = { name: "https://ns.adobe.com/experience/alloy", version: ALLOY_VERSION, environment: "browser" };
  return xdm;
}

/** `over` merged onto `base` (objects deep, everything else replaced); neither input is changed. */
function merge(base, over) {
  if (!isObject(base) || !isObject(over)) return clone(over === undefined ? base : over);
  const out = { ...clone(base) };
  for (const [k, v] of Object.entries(over)) out[k] = isObject(v) && isObject(out[k]) ? merge(out[k], v) : clone(v);
  return out;
}

/** `edited` without the fields that equal the context's and that the page did not supply itself. */
function withoutUntouchedContext(edited, contextXdm, pageXdm) {
  if (!isObject(edited)) return edited;
  const out = {};
  for (const [k, v] of Object.entries(edited)) {
    if (!(k in contextXdm)) { out[k] = v; continue; }
    if (isObject(v) && isObject(contextXdm[k])) {
      const sub = withoutUntouchedContext(v, contextXdm[k], isObject(pageXdm) ? pageXdm[k] : undefined);
      if (Object.keys(sub).length) out[k] = sub;
    } else if (JSON.stringify(v) !== JSON.stringify(contextXdm[k]) || (isObject(pageXdm) && k in pageXdm)) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Run the hook for one event.
 * @param {{ xdm?: object, data?: object }} content the page's xdm and data (not changed)
 * @param {{ hook?: Function | null, context?: object, contextGroups?: string[], diagnose?: (r: object) => void }} deps `context` is the collected stock context
 * @returns {{ dropped: boolean, xdm: object, data?: object, error?: unknown }} `error` is what a throwing hook threw
 */
export function runBeforeEventSend(content, { hook, context, contextGroups, diagnose = () => {} } = {}) {
  const xdm = clone(content.xdm) || {};
  const data = clone(content.data);
  if (typeof hook !== "function") return { dropped: false, xdm, ...(data === undefined ? {} : { data }) };
  const contextXdm = stockContextXdm(context, contextGroups);
  const seen = { xdm: merge(contextXdm, xdm), data: data === undefined ? {} : data };
  const given = clone(seen);
  let verdict;
  try {
    verdict = hook(seen);
  } catch (e) {
    diagnose({ level: "warn", kind: "hook-threw", option: "onBeforeEventSend", reason: `onBeforeEventSend threw (${String((e && e.message) || e)}); the event is dropped` });
    return { dropped: true, xdm, error: e };
  }
  if (verdict === false) return { dropped: true, xdm };
  const out = { xdm: withoutUntouchedContext(isObject(seen.xdm) ? seen.xdm : {}, contextXdm, xdm) };
  if (JSON.stringify(seen.data) !== JSON.stringify(given.data)) out.data = clone(seen.data);
  else if (data !== undefined) out.data = data;
  return { dropped: false, ...out };
}

export { collectStockContext };
