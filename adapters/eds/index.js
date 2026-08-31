/**
 * EDS boot adapter (spec 004-02 AC2, 004-03 AC4) — wires the airlock GA4 runtime
 * into an Adobe Edge Delivery Services page's LAZY phase (AD-8: analytics is lazy).
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
 * Identity ctx (004-03): sourced HOST-SIDE on the main thread — `client_id` from
 * the `_ga` cookie (generated + persisted in GA1 format when absent), `session_id`
 * from `_ga_<stream>` (per-page fallback when absent) — via the mediated cookie
 * accessor (capability.d.ts shape). ONLY the minimal `{ clientId, sessionId }`
 * snapshot crosses into the runtime (ADR-0003); the raw cookie string never leaves
 * this adapter and the chamber stays cookie-free. Boot is therefore ASYNC.
 *
 * Interaction wiring (004-04): boot installs the UC-2 capture listeners
 * (`wireInteractions`) — a non-navigating CTA → steady-state `push` (worker cycle),
 * and the outbound-link / closing-`page_view` unload-critical `pushCritical` fast
 * path (ADR-0004). Boot still does NOT auto-capture a page_view, and the collect
 * endpoint stays the placeholder (no live GA4 measurement_id/api_secret ships here).
 *
 * Exposure wiring (005-01): boot also installs the UC-1 above-the-fold exposure
 * capture (`wireExposure`) — read the applied `body[data-experiment]`/`[data-variant]`
 * durable state at lazy boot and `push` a single `experiment_impression`, plus a live
 * `aem:experimentation` listener for a post-boot experiment (deduped). Decisioning
 * stays `aem-experimentation`'s; the airlock only reports the exposure.
 */
import { createAirlock } from "../../core/airlock.js";
import { resolveConsent } from "../../core/consent.js";
import { sourceGa4Ctx } from "../../connectors/ga4/cookies.js";
import { shapeMpConsent } from "../../connectors/ga4/consent.js";
import { createCookieCapability } from "./cookies.js";
import { createExposureReporter } from "./exposure.js";
import { createBlockInstrumenter } from "./blocks.js";

/** Placeholder collect endpoint — the live GA4 MP URL (measurement_id/api_secret)
 *  is deferred; no real GA4 credentials ship in this slice. */
const DEFAULT_ENDPOINTS = ["https://www.google-analytics.com/mp/collect"];

/**
 * The DISTINCT GA4 event names the UC-2 interaction wiring emits (slice 004-04).
 * Distinct so the push()-XOR-pushCritical() caller rule holds by construction
 * (ADR-0004): each logical event has exactly one sender, so the runtime never
 * double-counts one interaction across the two egress paths.
 */
export const UC2_EVENTS = {
  engage: "cta_engage", // AC1: non-navigating CTA → steady-state worker cycle (push)
  outbound: "outbound_click", // AC2: navigating anchor leaving the page → fast path (pushCritical)
  closing: "page_view", // AC2: closing beacon on pagehide → fast path (pushCritical)
};

/** The current page origin, derived from `loc.href` (no dependency on `loc.origin`). */
function pageOrigin(loc) {
  try {
    return new URL(loc.href).origin;
  } catch {
    return null;
  }
}

/**
 * Does activating this anchor navigate the page AWAY — off-origin, or the testbed's
 * `/signup` outbound CTA? Same-origin in-page links are NOT unload-critical (they
 * do not tear the page down before a worker round-trip could complete), so they are
 * deliberately not routed through the fast path.
 * @param {{ href?: string }} anchor a resolved anchor (its `.href` is absolute in the DOM).
 * @param {{ href: string }} loc the current location.
 */
function navigatesAway(anchor, loc) {
  const href = anchor && anchor.href;
  if (typeof href !== "string" || href.length === 0) return false;
  let url;
  try {
    url = new URL(href, loc.href);
  } catch {
    return false;
  }
  // Only http(s) navigations tear the page down before an async worker round-trip
  // could finish; mailto:/tel:/javascript:/blob: etc. do not, so they must not pay a
  // synchronous unload-critical map or emit a spurious `outbound_click` (craft
  // review 004-04).
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const origin = pageOrigin(loc);
  if (origin && url.origin !== origin) return true; // off-origin outbound
  return url.pathname === "/signup"; // the testbed's known outbound CTA
}

/**
 * Would this click actually navigate the CURRENT page away? A modified click
 * (cmd/ctrl/shift/alt), a `target=_blank`, a `download` anchor, or an
 * already-`defaultPrevented` click (e.g. an SPA router took it) all open elsewhere
 * or are handled — none tears the current page down, so none loses an async beacon
 * and none should take the synchronous fast path (craft review 004-04).
 */
function opensElsewhere(e, anchor) {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return true;
  if (!anchor) return false;
  if (anchor.target === "_blank") return true;
  return typeof anchor.hasAttribute === "function" && anchor.hasAttribute("download");
}

/**
 * Wire the UC-2 interaction → GA4 beacon paths on an EDS page (slice 004-04,
 * AC1+AC2). The adapter owns BOTH senders, so the push()-XOR-pushCritical() rule
 * holds by construction (ADR-0004) — each event NAME has exactly one sender:
 *
 *   - AC1 (steady state, worker cycle): a delegated click on the NON-navigating
 *     `#cta-engage` CTA → `push({ event: "cta_engage", … })`. Non-navigating, so
 *     the worker round-trip completes while the page is still alive.
 *   - AC2 (unload fast path): a delegated click on a navigating anchor (off-origin
 *     or `/signup`) → `pushCritical({ event: "outbound_click", … })`; and a
 *     `pagehide` → `pushCritical({ event: "page_view", page_location: <current> })`.
 *     `page_location` is read AT CALL TIME (the current URL), not the boot value —
 *     ADR-0004's unload-critical-beacon-carries-current-page-state obligation.
 *
 * Guarded + idempotent-ish: a no-op off a real page (node/SSR) and never wires the
 * same document twice, matching bootEdsAnalytics's once-per-page note.
 *
 * @param {{ push: Function, pushCritical: Function }} handle the airlock write surface.
 * @param {{ doc?: Document, win?: Window, loc?: Location }} [io] injectable DOM handles (test seam).
 */
export function wireInteractions(handle, io = {}) {
  const doc = io.doc || (typeof document !== "undefined" ? document : undefined);
  const win = io.win || (typeof window !== "undefined" ? window : undefined);
  const loc = io.loc || (typeof location !== "undefined" ? location : undefined);
  if (!doc || !win || !loc || typeof doc.addEventListener !== "function") return;
  if (doc.__airlockWired) return; // never double-wire a document (idempotent-ish)
  doc.__airlockWired = true;

  // One delegated document-click listener owns both click paths (mutually exclusive
  // targets): the non-navigating CTA (push) and a navigating outbound anchor
  // (pushCritical). Delegation survives the lazy-phase decoration of the section.
  doc.addEventListener("click", (e) => {
    const t = e && e.target;
    if (!t || typeof t.closest !== "function") return;
    const engage = t.closest("#cta-engage");
    if (engage) {
      // AC1: non-navigating engagement → steady-state worker cycle (push).
      const label = String(engage.textContent || "").trim().slice(0, 100);
      handle.push({ event: UC2_EVENTS.engage, link_text: label, page_location: loc.href });
      return;
    }
    const anchor = t.closest("a[href]");
    if (anchor && !opensElsewhere(e, anchor) && navigatesAway(anchor, loc)) {
      // AC2: outbound navigation leaving the page → unload-critical fast path.
      handle.pushCritical({
        event: UC2_EVENTS.outbound,
        link_url: anchor.href,
        page_location: loc.href,
      });
    }
  });

  // AC2 closing beacon: read location.href NOW (the current page), not boot-time.
  win.addEventListener("pagehide", () => {
    handle.pushCritical({ event: UC2_EVENTS.closing, page_location: loc.href });
  });
}

/**
 * Wire the UC-1 above-the-fold exposure capture on an EDS page (slice 005-01, AC1+AC2).
 * Decisioning stays `aem-experimentation`'s (the local decision-source driver,
 * Clarification Q4); the airlock only REPORTS the exposure:
 *
 *   - AC1 (eager page-level): read the durable `body[data-experiment]`/`[data-variant]`
 *     state (set in the eager window before `appear`, which the lazy boot would miss
 *     as an event) and `push({ event: "experiment_impression", experiment_id,
 *     variant_id })`.
 *   - AC2 (post-boot): a live `aem:experimentation` listener reports an experiment
 *     applied AFTER boot, de-duplicated against the boot read via ONE shared `seen` Set.
 *
 * Exposure takes the steady-state `push()` (worker cycle) — analytics is lazy (AD-8),
 * the exposure already HAPPENED pre-paint (no-flicker), reporting it a few ms later is
 * the analytics-is-lazy contract, not a correctness gap (spec 005 Assumptions).
 *
 * Guarded like wireInteractions: a no-op off a real page (node/SSR — no `document` or
 * no `addEventListener`), null-safe inside (missing body/dataset/detail → no-op), and
 * double-wire-guarded (`doc.__airlockExposureWired`) — a second boot must NOT
 * re-report the eager exposure (a fresh `seen` Set) or stack a second listener, which
 * would double-count the impression (the measurement-critical count — review 005-01).
 *
 * @param {{ push: Function }} handle the airlock write surface.
 * @param {{ doc?: Document }} [io] injectable DOM handle (test seam).
 */
export function wireExposure(handle, io = {}) {
  const doc = io.doc || (typeof document !== "undefined" ? document : undefined);
  if (!doc || typeof doc.addEventListener !== "function") return;
  if (doc.__airlockExposureWired) return; // never double-report/double-listen
  doc.__airlockExposureWired = true;

  const reporter = createExposureReporter(handle, { seen: new Set() });
  reporter.reportFromBody(doc); // AC1: eager page-level exposure from durable body state
  doc.addEventListener("aem:experimentation", (e) =>
    reporter.onAemExperimentation(e && e.detail),
  ); // AC2: post-boot exposure, deduped against the boot read
}

/**
 * Wire the UC-3 block-decoration instrumentation on an EDS page (slice 006-01). At
 * boot, discover the EDS-decorated blocks WITHIN `<main>`, associate each block's
 * `{ block_name }` in a WeakMap (never a `data-track-*` attribute), and register each
 * for a single `view_block` GA4 report the first time it is >=50% in view
 * (IntersectionObserver, threshold 0.5), then unobserve it (once per block).
 *
 * Discovery is scoped to `main` DELIBERATELY (frame-critique 006-01, load-bearing):
 * `loadHeader`/`loadFooter` also `decorateBlock` the header/footer CHROME (in
 * `<body> > header/footer`, outside `main`), so an unscoped sweep would instrument the
 * always-present chrome and fire spurious `view_block` beacons for it. A block in
 * `<header>` is not a descendant of `main`, so it is never discovered or observed.
 *
 * A block view is analytics-lazy (the block already rendered) — it takes the
 * steady-state `push()` (worker cycle), not the unload fast path.
 *
 * Guarded like wireExposure: a no-op off a real page (no `document`), when there is no
 * `IntersectionObserver`, or when the page has no `<main>` (chrome-only) — and
 * double-wire-guarded (`doc.__airlockBlocksWired`) so a second boot never stacks a
 * second observer that would double-count a block view.
 *
 * @param {{ push: Function }} handle the airlock write surface.
 * @param {{ doc?: Document, win?: Window }} [io] injectable DOM handles (test seam).
 */
export function wireBlocks(handle, io = {}) {
  const doc = io.doc || (typeof document !== "undefined" ? document : undefined);
  const win = io.win || (typeof window !== "undefined" ? window : undefined);
  if (!doc || typeof doc.querySelector !== "function") return; // no DOM -> no-op
  if (doc.__airlockBlocksWired) return; // never double-wire a document
  const IntersectionObserverCtor = win && win.IntersectionObserver;
  if (typeof IntersectionObserverCtor !== "function") return; // no IntersectionObserver -> no-op
  const main = doc.querySelector("main");
  if (!main) return; // no <main> (chrome-only page) -> no-op
  doc.__airlockBlocksWired = true;

  // Default observerFactory = the REAL window.IntersectionObserver (unit tests inject
  // a fake via io.win). createBlockInstrumenter owns the threshold-0.5 opts.
  const observerFactory = (cb, opts) => new IntersectionObserverCtor(cb, opts);
  createBlockInstrumenter(handle, { observerFactory }).instrument(main);
}

/**
 * Boot the airlock analytics runtime for an EDS page.
 *
 * Note (recorded, accepted for this slice): boot is once-per-page by design — a
 * second call would create a second Worker + global unload listeners (createAirlock
 * registers `visibilitychange`/`pagehide` with no teardown) and overwrite
 * `window.airlock`. Low risk on EDS (loadLazy runs once), parked for a later slice.
 *
 * @param {object} [opts]
 * @param {object}   [opts.ctx]            explicit ctx override for `mapToMp` (skips
 *                                         cookie sourcing — rig/test escape hatch).
 * @param {Record<string, string>} [opts.consent] host-supplied ADR-0007 consent
 *                                         vector (core/consent.js's shape, e.g.
 *                                         `{ ad_user_data: "denied" }`). Folded
 *                                         into `ctx.consent` (GA4 MP-shaped)
 *                                         BEFORE `createAirlock` runs — the
 *                                         017-01 pre-construction ordering
 *                                         (load-bearing, see the fold comment
 *                                         below). Also resolves `analytics_storage`
 *                                         (017-02, ADR-0007 ②), threaded into
 *                                         `sourceGa4Ctx` as `storageGranted` —
 *                                         see that computation below.
 * @param {string[]} [opts.endpoints]      per-tracker collect URLs.
 * @param {number}   [opts.trackers]       tracker count (defaults to endpoints.length).
 * @returns {Promise<{ push: Function, pushCritical: Function, getState: Function, flushNow: Function, stats: Function }>}
 *   a handle over the airlock's public write/read surface (also set on `window.airlock`).
 */
export async function bootEdsAnalytics(opts = {}) {
  const {
    ctx: providedCtx,
    consent,
    endpoints = DEFAULT_ENDPOINTS,
    trackers = endpoints.length,
  } = opts;

  // 017-02 AC1 (ADR-0007 point ②): resolve `analytics_storage` BEFORE identity
  // sourcing, threaded INTO sourceGa4Ctx — not gated here (the `_ga` read+write
  // live inside that function, downstream of the adapter). Back-compat default
  // TRUE: no consent vector wired at all -> the legacy always-persist behavior
  // (004-03, unaffected). A PROVIDED vector enforces per-purpose: analytics_storage
  // unset resolves to "pending" (core/consent.js's fail-to-pending default), which
  // is NOT "granted" -> same non-persisted/ephemeral branch as an explicit denial.
  const storageGranted = consent ? resolveConsent(consent, "analytics_storage") === "granted" : true;

  // 004-03 host-side sourcing: read (or generate + persist) the `_ga` identity via
  // the mediated accessor; hand the runtime ONLY the minimal snapshot (ADR-0003).
  // `document.cookie` is passed solely for `_ga_<stream>` discovery and never
  // enters the ctx. `storageGranted` (017-02) gates the read+write INSIDE
  // sourceGa4Ctx: not granted -> a fresh ephemeral client_id/session_id,
  // ignoring any persisted `_ga` / `_ga_<stream>` already in the jar.
  const ctx =
    providedCtx ??
    (await sourceGa4Ctx({
      cookies: createCookieCapability(document),
      cookieString: document.cookie,
      storageGranted,
    }));

  // 017-01 AC2/AC4 consent fold — PRE-createAirlock, load-bearing (frame-critique
  // ordering, not incidental): `core/airlock.js` hands the worker a
  // structured-clone SNAPSHOT of `ctx` at `init` (`postMessage({type:"init", …,
  // ctx})`), while the sync unload fast path (`core/egress.js`) closes over a
  // LIVE REFERENCE to this same `ctx`. Folding consent in HERE — before
  // `createAirlock({ ctx })` runs — is what makes BOTH the worker's frozen clone
  // and the sync path's live reference carry it (the two `mapToMp(event, ctx)`
  // call sites, AC4). A post-construction `setConsent(...)` handle method would
  // reach only the live reference and never the already-cloned worker ctx, so it
  // is deliberately NOT this slice's seam (that's the mid-session-update
  // follow-up, AC6/refinement-todo — it needs a worker ctx re-send).
  //
  // Non-mutating (spreads into a new object) and only adds the `consent` key
  // when there is something to add: no `consent` opt, or a vector with no
  // data-use purpose signaled, leaves `ctx` untouched, so `map.js`'s
  // `if (ctx.consent)` guard keeps omitting `body.consent` — back-compat, an
  // unset-consent host sees a byte-identical mapped body to before this slice.
  const shapedConsent = consent ? shapeMpConsent(consent) : undefined;
  const ctxWithConsent = shapedConsent ? { ...ctx, consent: shapedConsent } : ctx;

  // workFactor is a synthetic per-tracker cost knob for the rigs that call
  // createAirlock DIRECTLY; production is always 0 (OQ12 prune — arch review 004-04).
  // No ring-tail-priority events here: every unload-critical beacon (outbound_click,
  // page_view) goes via pushCritical, which bypasses the ring, so `unloadCritical`
  // (the ring-tail sort) stays the core default (empty).
  const airlock = createAirlock({ trackers, workFactor: 0, endpoints, ctx: ctxWithConsent });

  const handle = {
    push: (evt) => airlock.push(evt),
    pushCritical: (evt) => airlock.pushCritical(evt),
    getState: (path) => airlock.getState(path), // whole projection or dotted-path read (push-api.md)
    flushNow: () => airlock.flushNow(), // force-drain the ring to the worker (deterministic teardown/test)
    stats: () => airlock.stats(),
  };

  if (typeof window !== "undefined") window.airlock = handle;

  // 004-04 AC1+AC2: capture real interactions on the EDS page. Guarded + idempotent
  // (a no-op off a real page — e.g. the node unit env — and never double-wires), so
  // it is safe to call unconditionally at boot. The adapter owns both senders here,
  // so the push()-XOR-pushCritical() rule holds by construction (ADR-0004).
  wireInteractions(handle);

  // 005-01 AC1+AC2: report the applied above-the-fold experiment exposure (read from
  // the durable body dataset at boot + a live aem:experimentation listener, deduped).
  wireExposure(handle);

  // 006-01: instrument the decorated blocks WITHIN <main> — WeakMap-associate each and
  // fire one view_block on first >=50% view (chrome outside main is excluded). Guarded
  // + idempotent, so it is safe to call unconditionally at boot.
  wireBlocks(handle);

  return handle;
}

export default bootEdsAnalytics;
