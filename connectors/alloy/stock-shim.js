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
// The cookie scope and Alloy's apex-domain probe read these, so the chamber always takes them
// from the channel, whichever groups the site listed. Alloy's context never sends them.
const HOST_KEYS = ["origin", "protocol", "host", "hostname"];
const URL_FIELD = { href: "url" };

/**
 * @param {Record<string, Record<string, unknown>>} context the received stock context
 * @param {readonly string[]} groups the Alloy `context` list the site chose
 * @returns {{ location: object, document: object, screen: object, window: object, navigator: object }}
 */
export function shimValuesFromStockContext(context, groups) {
  const out = { location: {}, document: {}, documentElement: {}, screen: {}, window: {}, navigator: {} };
  const wanted = new Set(Array.isArray(groups) ? groups : []);
  const ctx = context && typeof context === "object" ? context : {};
  const set = (target, key, value) => {
    if (value !== undefined && value !== null && value !== "") target[key] = value;
  };

  if (ctx.web) for (const k of HOST_KEYS) set(out.location, k, ctx.web[k]);
  if (wanted.has("web") && ctx.web) {
    for (const k of LOCATION_KEYS) set(out.location, k, ctx.web[URL_FIELD[k] || k]);
    if (typeof ctx.web.referrer === "string") out.document.referrer = ctx.web.referrer;
    set(out.document, "title", ctx.web.title);
  }
  if (wanted.has("device") && ctx.device) {
    const d = ctx.device;
    set(out.screen, "width", d.screenWidth);
    set(out.screen, "height", d.screenHeight);
    set(out.screen, "colorDepth", d.colorDepth);
    if (d.screenOrientation) out.screen.orientation = { type: d.screenOrientation };
    set(out.window, "devicePixelRatio", d.pixelRatio);
  }
  if (wanted.has("environment") && ctx.environment) {
    const e = ctx.environment;
    set(out.window, "innerWidth", e.viewportWidth);
    set(out.window, "innerHeight", e.viewportHeight);
    set(out.documentElement, "clientWidth", e.viewportWidth);
    set(out.documentElement, "clientHeight", e.viewportHeight);
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
 * The shim fields each group owns. Before a listed group's channel values are applied, its
 * owned fields are cleared, so a denylisted field, a field the page stopped supplying, or a
 * group the channel never sent leaves no placeholder or stale value for Alloy to collect.
 * `location.origin/protocol/host/hostname` are not owned by a group: Alloy's apex-domain probe and
 * the cookie scope read them, so they always come from the channel (064-17); no placeholder exists.
 */
export const OWNED_SHIM_FIELDS = Object.freeze({
  web: Object.freeze({ location: ["href", "pathname", "search", "hash"], document: ["referrer", "title"] }),
  device: Object.freeze({ screen: ["width", "height", "availWidth", "availHeight", "colorDepth", "pixelDepth", "orientation"], window: ["devicePixelRatio"] }),
  environment: Object.freeze({ window: ["innerWidth", "innerHeight", "outerWidth", "outerHeight"], document: ["visibilityState"], documentElement: ["clientWidth", "clientHeight"], navigator: ["userAgent", "language", "languages", "cookieEnabled", "doNotTrack"] }),
  placeContext: Object.freeze({}),
});

/**
 * Apply the channel to the chamber's shim backing objects: clear what each listed group
 * owns, then set the supplied values. Navigator keys are set to an own `undefined` rather than
 * deleted: the chamber's navigator proxy would otherwise answer a missing key with its own
 * placeholder or the worker's real value.
 * @param {{ location: object, document: object, documentElement: object, screen: object, window: object, navigator: object }} targets
 */
export function applyStockContextToShims(targets, context, groups) {
  for (const g of Array.isArray(groups) ? groups : []) {
    for (const [t, keys] of Object.entries(OWNED_SHIM_FIELDS[g] || {})) for (const k of keys) {
      if (!targets[t]) continue;
      if (t === "navigator") targets[t][k] = undefined;
      else delete targets[t][k];
    }
  }
  for (const [t, values] of Object.entries(shimValuesFromStockContext(context, groups))) if (targets[t]) Object.assign(targets[t], values);
  // Alloy reads `location.href || location` and later calls string methods on it, so an empty href
  // (the URL was denylisted, or `web` is unlisted) falls back to the host root: the one value of
  // the page identity the chamber always holds. A documented difference from stock, not a placeholder.
  const loc = targets.location || {};
  if (!loc.href && loc.origin) loc.href = `${loc.origin}/`;
}
