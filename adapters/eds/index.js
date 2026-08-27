/**
 * EDS boot adapter (spec 004-02, AC2) — wires the airlock GA4 runtime into an
 * Adobe Edge Delivery Services page's LAZY phase (AD-8: analytics is lazy).
 *
 * This module is the esbuild ENTRY POINT (`npm run build` / build.mjs): it imports
 * the runtime SOURCE directly (`core/airlock.js`), so bundling it pulls the whole
 * runtime into one self-contained module. The build emits it INTO the testbed's
 * served tree as `probes/eds-testbed/scripts/airlock/eds.js` with the worker as its
 * SIBLING `chamber.worker.js` — so the runtime's `new Worker(new
 * URL("./chamber.worker.js", import.meta.url), { type: "module" })` resolves to a
 * same-origin FILE url under the 004-01 CSP verdict (never `blob:`/`data:`).
 * `scripts.js#loadLazy` imports the emitted `/scripts/airlock/eds.js`, i.e. AFTER
 * `body.appear`.
 *
 * STATIC ctx is deliberate for this slice: sourcing `client_id`/`session_id` from
 * the real `_ga` / `_ga_<stream>` cookies via the mediated cookie capability is
 * slice 004-03, and the real GA4 endpoint + before/after Lighthouse is 004-04. Boot
 * is intentionally side-effect-light — it does NOT auto-capture a page_view; the
 * real interaction→beacon path is 004-04.
 */
import { createAirlock } from "../../core/airlock.js";

/** Placeholder identity — replaced by the `_ga` cookie parse in 004-03. */
const STATIC_CTX = { clientId: "1234567890.1700000000", sessionId: "1724668790" };

/** Placeholder collect endpoint — the real GA4 MP URL is wired in 004-03/004-04. */
const DEFAULT_ENDPOINTS = ["https://www.google-analytics.com/mp/collect"];

/**
 * Boot the airlock analytics runtime for an EDS page.
 *
 * Note (recorded, accepted for this slice): boot is once-per-page by design — a
 * second call would create a second Worker + global unload listeners (createAirlock
 * registers `visibilitychange`/`pagehide` with no teardown) and overwrite
 * `window.airlock`. Low risk on EDS (loadLazy runs once), parked for a later slice.
 *
 * @param {object} [opts]
 * @param {object}   [opts.ctx]            session/identity ctx for `mapToMp` (static for now).
 * @param {string[]} [opts.endpoints]      per-tracker collect URLs.
 * @param {number}   [opts.trackers]       tracker count (defaults to endpoints.length).
 * @param {number}   [opts.workFactor]     synthetic per-tracker map cost (µs); 0 in prod.
 * @param {string[]} [opts.unloadCritical] event types routed through the ADR-0004 fast path.
 * @returns {{ push: Function, pushCritical: Function, getState: Function, flushNow: Function, stats: Function }}
 *   a handle over the airlock's public write/read surface (also set on `window.airlock`).
 */
export function bootEdsAnalytics(opts = {}) {
  const {
    ctx = STATIC_CTX,
    endpoints = DEFAULT_ENDPOINTS,
    trackers = endpoints.length,
    workFactor = 0,
    unloadCritical = ["click", "page_view"], // ADR-0004: outbound click + closing page_view
  } = opts;

  const airlock = createAirlock({ trackers, workFactor, endpoints, ctx, unloadCritical });

  const handle = {
    push: (evt) => airlock.push(evt),
    pushCritical: (evt) => airlock.pushCritical(evt),
    getState: (path) => airlock.getState(path), // whole projection or dotted-path read (push-api.md)
    flushNow: () => airlock.flushNow(), // force-drain the ring to the worker (deterministic teardown/test)
    stats: () => airlock.stats(),
  };

  if (typeof window !== "undefined") window.airlock = handle;
  return handle;
}

export default bootEdsAnalytics;
