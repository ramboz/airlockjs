// Map the 067-07 stock-context channel onto the page values Alloy's own context
// collectors read (spec 067-08, ADR-0062 point 2).
//
// Alloy's `context` option names the groups it collects. In the chamber it reads
// them from the page shim (location, document, screen, window, navigator), so the
// shim must carry the real page values the main thread sent, never invented ones.
// This module is the one place that decides which channel field feeds which shim
// field. It is pure: it returns only the fields the channel actually supplied for
// a group the site listed. Per-field fidelity against the pinned Alloy bytes stays
// with Adobe 064-17.

const LOCATION_KEYS = ["href", "origin", "protocol", "host", "hostname", "pathname", "search", "hash"];
const URL_FIELD = { href: "url" };

/**
 * @param {Record<string, Record<string, unknown>>} context the received stock context
 * @param {readonly string[]} groups the Alloy `context` list the site chose
 * @returns {{ location: object, document: object, screen: object, window: object, navigator: object }}
 */
export function shimValuesFromStockContext(context, groups) {
  const out = { location: {}, document: {}, screen: {}, window: {}, navigator: {} };
  const wanted = new Set(Array.isArray(groups) ? groups : []);
  const ctx = context && typeof context === "object" ? context : {};
  const set = (target, key, value) => {
    if (value !== undefined && value !== null && value !== "") target[key] = value;
  };

  if (wanted.has("web") && ctx.web) {
    for (const k of LOCATION_KEYS) set(out.location, k, ctx.web[URL_FIELD[k] || k]);
    set(out.document, "referrer", ctx.web.referrer);
    set(out.document, "title", ctx.web.title);
  }
  if (wanted.has("device") && ctx.device) {
    const d = ctx.device;
    set(out.screen, "width", d.screenWidth);
    set(out.screen, "height", d.screenHeight);
    set(out.screen, "colorDepth", d.colorDepth);
    if (d.screenOrientation) out.screen.orientation = { type: d.screenOrientation, angle: 0 };
    set(out.window, "devicePixelRatio", d.pixelRatio);
  }
  if (wanted.has("environment") && ctx.environment) {
    const e = ctx.environment;
    set(out.window, "innerWidth", e.viewportWidth);
    set(out.window, "innerHeight", e.viewportHeight);
    set(out.document, "visibilityState", e.visibilityState);
    set(out.navigator, "userAgent", e.userAgent);
    set(out.navigator, "language", e.language);
    if (Array.isArray(e.languages)) out.navigator.languages = [...e.languages];
    if (typeof e.cookieEnabled === "boolean") out.navigator.cookieEnabled = e.cookieEnabled;
    set(out.navigator, "doNotTrack", e.doNotTrack);
  }
  // placeContext needs no shim: Alloy reads the worker's own clock and Intl, which
  // match the page's. The channel's copy stays available for the host.
  return out;
}

/**
 * The shim fields a listed group fills from the channel. When a group is listed
 * but the channel has not supplied it (yet, or ever), the chamber blanks these
 * placeholders so Alloy never collects an invented value.
 */
export const BLANKED_WHEN_UNSET = Object.freeze({
  web: Object.freeze({ document: ["referrer", "title"] }),
  device: Object.freeze({ screen: ["width", "height", "availWidth", "availHeight", "colorDepth", "pixelDepth", "orientation"], window: ["devicePixelRatio"] }),
  environment: Object.freeze({ window: ["innerWidth", "innerHeight", "outerWidth", "outerHeight"] }),
  placeContext: Object.freeze({}),
});
