// Stock-context channel (spec 067-07, ADR-0062 point 2).
//
// A stock vendor tag reads page values the chamber cannot see (it has no DOM,
// ADR-0014): URL, referrer, screen, browser details, local time. The main
// thread collects them here and sends them across the airlock on a dedicated
// `{ type: "stock-context", context }` message. This channel is NOT the
// projection snapshot: the snapshot stays default-deny (ADR-0003), and
// nothing here touches it.
//
// SHAPE (vendor-neutral; each vendor maps groups to its own fields, 067-08
// for Alloy). Every group is a flat record of primitives or string arrays, so
// the whole object is structured-cloneable:
//   web          url, origin, protocol, host, hostname, pathname, search, hash,
//                referrer, title
//   device       screenWidth, screenHeight, screenOrientation, colorDepth,
//                pixelRatio
//   environment  viewportWidth, viewportHeight, visibilityState, userAgent, language,
//                languages, cookieEnabled, doNotTrack, platform, mobile, brands
//   placeContext localTime (ISO 8601 with offset), timezoneOffset (minutes,
//                `Date#getTimezoneOffset` sign), timeZone
// A field the page cannot supply is omitted, never faked.
//
// NARROWING: a site passes `groups` (a list of group names). Value governance
// is opt-in through `denylist` (note: `url`, `search`, `hash` and `referrer`
// carry raw query and fragment values, so a site that wants those governed
// denies each of them) (bare group-field names, or `group.field`
// paths, same match rules as core/payload-governance.js). The built-in
// credentials denylist always applies: a credentials-named field never
// crosses.
//
// COST: collection is a handful of property reads, runs at boot and on
// throttled change events, never inside a capture handler (ADR-0002).
//
// The module has no module-level ambient access: every global is read from
// the injected `win`, so it is testable under Node.
import { DEFAULT_DENYLIST, governPayload } from "./payload-governance.js";

export const STOCK_CONTEXT_MESSAGE = "stock-context";
export const STOCK_CONTEXT_GROUPS = Object.freeze(["web", "device", "environment", "placeContext"]);

const pick = (out, key, value) => {
  if (value !== undefined && value !== null && value !== "") out[key] = value;
};

function webGroup(win) {
  const out = {};
  const loc = win.location;
  if (loc) {
    pick(out, "url", loc.href);
    pick(out, "origin", loc.origin);
    pick(out, "protocol", loc.protocol);
    pick(out, "host", loc.host);
    pick(out, "hostname", loc.hostname);
    pick(out, "pathname", loc.pathname);
    pick(out, "search", loc.search);
    pick(out, "hash", loc.hash);
  }
  const doc = win.document;
  if (doc) {
    pick(out, "referrer", doc.referrer);
    pick(out, "title", doc.title);
  }
  return out;
}

function deviceGroup(win) {
  const out = {};
  const s = win.screen;
  if (s) {
    pick(out, "screenWidth", s.width);
    pick(out, "screenHeight", s.height);
    pick(out, "screenOrientation", s.orientation && s.orientation.type);
    pick(out, "colorDepth", s.colorDepth);
  }
  pick(out, "pixelRatio", win.devicePixelRatio);
  return out;
}

function environmentGroup(win) {
  const out = {};
  pick(out, "viewportWidth", win.innerWidth);
  pick(out, "viewportHeight", win.innerHeight);
  pick(out, "visibilityState", win.document && win.document.visibilityState);
  const n = win.navigator;
  if (n) {
    pick(out, "userAgent", n.userAgent);
    pick(out, "language", n.language);
    if (Array.isArray(n.languages) || (n.languages && typeof n.languages.length === "number")) {
      out.languages = Array.from(n.languages);
    }
    if (typeof n.cookieEnabled === "boolean") out.cookieEnabled = n.cookieEnabled;
    pick(out, "doNotTrack", n.doNotTrack);
    const uad = n.userAgentData;
    if (uad) {
      pick(out, "platform", uad.platform);
      if (typeof uad.mobile === "boolean") out.mobile = uad.mobile;
      if (Array.isArray(uad.brands)) out.brands = uad.brands.map((b) => `${b.brand}/${b.version}`);
    }
  }
  return out;
}

const pad = (n, w = 2) => String(Math.abs(n)).padStart(w, "0");

function placeContextGroup(now) {
  const d = now();
  const off = d.getTimezoneOffset();
  const sign = off > 0 ? "-" : "+";
  const local =
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}` +
    `${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`;
  const out = { localTime: local, timezoneOffset: off };
  try {
    pick(out, "timeZone", Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    // no Intl: omit rather than fake
  }
  return out;
}

const COLLECTORS = {
  web: (win) => webGroup(win),
  device: (win) => deviceGroup(win),
  environment: (win) => environmentGroup(win),
  placeContext: (_win, now) => placeContextGroup(now),
};

/**
 * Collect the stock-read page context on the main thread.
 *
 * @param {{ groups?: readonly string[], denylist?: readonly string[], win?: object, now?: () => Date }} [opts]
 *   `groups` defaults to every group (the stock default). Unknown names are
 *   ignored. `denylist` extends the built-in credentials denylist.
 * @returns {Record<string, Record<string, unknown>>} only the requested groups
 */
export function collectStockContext({ groups = STOCK_CONTEXT_GROUPS, denylist = [], win = globalThis, now = () => new Date() } = {}) {
  const wanted = Array.isArray(groups) ? groups.filter((g) => Object.hasOwn(COLLECTORS, g)) : [];
  const context = {};
  for (const group of new Set(wanted)) {
    let record;
    try {
      record = COLLECTORS[group](win, now);
    } catch {
      record = {}; // a throwing page getter must not break boot
    }
    context[group] = record;
  }
  return governStockContext(context, denylist);
}

/**
 * Apply the denylist to a collected context. The built-in credentials list is
 * always merged in and a site can only add to it. Bare names match inside each
 * group record; `group.field` paths match against the whole context.
 */
export function governStockContext(context, denylist = []) {
  const entries = [...DEFAULT_DENYLIST, ...(Array.isArray(denylist) ? denylist : [])];
  const out = {};
  for (const [group, record] of Object.entries(context)) out[group] = governPayload(record, entries).governed;
  return governPayload(out, entries).governed;
}

/** Stable form used to dedupe: the clock sample alone never triggers a re-send. */
export function stockContextFingerprint(context) {
  const copy = { ...context };
  if (copy.placeContext) {
    const { localTime: _t, ...rest } = copy.placeContext;
    copy.placeContext = rest;
  }
  return JSON.stringify(copy);
}

/** The explicit empty value: no context was received. Never a fake page. */
export const EMPTY_STOCK_CONTEXT = Object.freeze({});

/**
 * Chamber-side store: the one place a connector host reads the received
 * context from. `read()` returns `EMPTY_STOCK_CONTEXT` until a valid
 * `stock-context` message arrives.
 */
export function createStockContextStore() {
  let current = EMPTY_STOCK_CONTEXT;
  return {
    /** @returns {boolean} true when `msg` was a stock-context message (consumed) */
    accept(msg) {
      if (!msg || msg.type !== STOCK_CONTEXT_MESSAGE) return false;
      const ctx = msg.context;
      if (ctx && typeof ctx === "object" && !Array.isArray(ctx)) {
        const next = {};
        for (const g of STOCK_CONTEXT_GROUPS) {
          if (ctx[g] && typeof ctx[g] === "object") {
            const rec = { ...ctx[g] };
            for (const k of Object.keys(rec)) if (Array.isArray(rec[k])) rec[k] = Object.freeze([...rec[k]]);
            next[g] = Object.freeze(rec);
          }
        }
        current = Object.freeze(next);
      }
      return true;
    },
    read() {
      return current;
    },
  };
}
