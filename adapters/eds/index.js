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
import { createWrappedSdkHost } from "../../core/wrapped-sdk-host.js";
import { hostOf } from "../../core/config-integrity.js";
import { resolveConsent } from "../../core/consent.js";
import { ALLOY_INTERACT_ENDPOINT } from "../../connectors/alloy/connector.js";
import { sourceGa4Ctx } from "../../connectors/ga4/cookies.js";
import { shapeMpConsent } from "../../connectors/ga4/consent.js";
import { createMetaPixelConfig, META_EGRESS_PURPOSES } from "../../connectors/pixel/vendors/meta.js";
import { createLinkedInInsightConfig, LINKEDIN_EGRESS_PURPOSES } from "../../connectors/pixel/vendors/linkedin.js";
import { createBingUetConfig, BING_EGRESS_PURPOSES } from "../../connectors/pixel/vendors/bing.js";
import { createCookieCapability } from "./cookies.js";
import { createExposureReporter } from "./exposure.js";
import { createBlockInstrumenter } from "./blocks.js";
import { startCwvCapture } from "../../connectors/helix-rum/cwv-capture.js";
import { rumUrl, resolveWeight } from "../../connectors/helix-rum/map.js";
import { DEFAULT_COLLECT_BASE_URL } from "../../connectors/helix-rum/connector.js";
// 030-02: the REAL web-vitals/attribution subscribers — the production wiring the DONE
// 022-04 slice deferred (cwv-capture.js is DI'd). Import is side-effect-free (web-vitals
// registers observers only when onLCP/onCLS/onINP are CALLED), so it is safe at module
// load; `bootHelixRum` accepts overrides so tests inject stubs (no PerformanceObserver).
import { onLCP, onCLS, onINP } from "web-vitals/attribution";

/** Placeholder collect endpoint — the live GA4 MP URL (measurement_id/api_secret)
 *  is deferred; no real GA4 credentials ship in this slice. */
const DEFAULT_ENDPOINTS = ["https://www.google-analytics.com/mp/collect"];

/**
 * GA4's declared egress `purposes.egress` (spec 017-03 AC5 — the purpose→beacon
 * binding is the connector's MANIFEST, not a hardcoded literal at the seal;
 * `connectors/ga4/connector.js`'s manifest carries the same value). GA4 is
 * analytics-only, so its egress is governed by the single Consent Mode
 * `analytics_storage` purpose (ADR-0007).
 */
const GA4_EGRESS_PURPOSES = ["analytics_storage"];

/**
 * spec 026-01 AC6 — re-exported here (its home is
 * `connectors/pixel/vendors/meta.js`) so a caller wiring the SAME
 * `egressPurposes` -> `createAirlock` pattern GA4's constant above documents
 * can import both from this one adapter module. `bootMetaPixel` below wires
 * it into its own `createAirlock` call the same way `bootEdsAnalytics` wires
 * `GA4_EGRESS_PURPOSES`.
 *
 * spec 026-02 AC1/AC2 — `LINKEDIN_EGRESS_PURPOSES`/`BING_EGRESS_PURPOSES` are
 * re-exported the SAME way (their homes are `connectors/pixel/vendors/
 * linkedin.js` / `connectors/pixel/vendors/bing.js`); `bootLinkedInInsight`/
 * `bootBingUet` below wire them into their own `createAirlock` calls the SAME
 * `consent ? … : []` back-compat gate `bootMetaPixel` uses.
 */
export { META_EGRESS_PURPOSES, LINKEDIN_EGRESS_PURPOSES, BING_EGRESS_PURPOSES };

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
 * The hoisted `window.airlock` lifecycle (spec 032-01 AC4, preserving 021-01's
 * no-leak invariant). Installs `handle` as the page singleton, **disposing whatever
 * prior instance held the slot FIRST** (its Worker + unload listeners) — so a
 * re-boot never stacks a second Worker or a second unload-listener set.
 *
 * FACTORED OUT of the per-connector boot logic ON PURPOSE (frame-critique): if only
 * `bootGa4Core` took the slot, a multi-connector `boot(config)` would leave
 * `window.airlock` GA4-only and **leak the pixel/rum Worker on dispose/re-boot**.
 * So this lifecycle is owned by exactly two places — the back-compat
 * `bootEdsAnalytics` wrapper (single GA4 instance) and the `boot(config)` composite
 * (the whole config) — and NEVER by the shared core or a per-connector boot, so
 * there is no double-ownership / double-dispose.
 *
 * `dispose()` is idempotent + null-safe (021-01 AC1), so disposing whatever is
 * present is safe; a first boot (no prior `window.airlock`) skips it. No-op off a
 * real page (no `window`), returning the handle unchanged.
 *
 * @template T
 * @param {T} handle the freshly-booted handle to install + return.
 * @returns {T}
 */
function installOnWindow(handle) {
  if (typeof window === "undefined") return handle;
  if (window.airlock && typeof window.airlock.dispose === "function") window.airlock.dispose();
  window.airlock = handle;
  return handle;
}

/**
 * The shared GA4 boot core (spec 032-01) — everything `bootEdsAnalytics` does
 * EXCEPT taking the `window.airlock` slot (that lifecycle is hoisted to
 * `installOnWindow`). Reused VERBATIM by the config-driven `ga4` entry so its rich
 * wiring — host-side `_ga` sourcing, the pre-`createAirlock` consent fold, and the
 * UC-1/2/3 capture listeners — cannot drift from the per-function boot
 * (frame-critique: reuse the boot logic, hoist only the lifecycle).
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
 * @param {boolean}  [opts.consentStrict]  spec 017-03 AC3 (ADR-0007 point ③): declare a
 *                                         strict/no-processing regime — an un-granted
 *                                         `analytics_storage` purpose DROPS the beacon
 *                                         (no hold, no send) instead of holding it.
 *                                         Only takes effect when `opts.consent` is also
 *                                         wired (see the `egressPurposes` gating below).
 * @param {string[]} [opts.payloadDenylist] spec 019-01 (ADR-0012): host-declared
 *                                         sensitive-field names / dotted paths, threaded
 *                                         straight through to `createAirlock` (parallel to
 *                                         `endpoints`/`consent`/`egressPurposes`, and
 *                                         INDEPENDENT of `consent` — a host may govern the
 *                                         payload without wiring consent at all). Merged
 *                                         with a conservative built-in default INSIDE
 *                                         `createAirlock`, gated on this option being
 *                                         non-empty: an unset/empty list is the identity —
 *                                         every current rig/testbed boot is byte-unchanged
 *                                         (back-compat, AC6).
 * @returns {Promise<{ push: Function, pushCritical: Function, setConsent: Function, getState: Function, flushNow: Function, stats: Function, dispose: Function }>}
 *   a handle over the airlock's public write/read surface (the `window.airlock`
 *   lifecycle is the caller's — `bootEdsAnalytics` / `boot`, via `installOnWindow`).
 *   `setConsent` (spec 017-03 AC2) merges a consent-vector update mid-session and
 *   flushes any beacon the update just granted. `dispose` (spec 021-01 AC1) tears
 *   this instance's Worker + unload listeners down; idempotent + null-safe.
 */
async function bootGa4Core(opts = {}) {
  const {
    ctx: providedCtx,
    consent,
    consentStrict = false,
    endpoints = DEFAULT_ENDPOINTS,
    trackers = endpoints.length,
    payloadDenylist,
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
  // call sites, AC4). A post-construction consent-update handle method reaching
  // only the live `ctx` reference (never the already-cloned worker `ctx`) is
  // deliberately NOT this slice's seam (that's the mid-session-RESHAPE-update
  // follow-up, AC6/refinement-todo — it needs a worker ctx re-send). NOTE: 017-03
  // later adds its OWN `setConsent` to the returned handle below — a DIFFERENT
  // mechanism (the seal's dispatch gate, not the mapper reshape this paragraph is
  // about); a flushed beacon still carries whatever reshape was folded in HERE,
  // at boot (a named residual — docs/refinement-todo.md).
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
  //
  // 017-03: `egressPurposes` is gated on `consent` being wired at all — mirroring
  // `storageGranted`/`shapedConsent` above — NOT passed unconditionally. GA4's
  // `analytics_storage` purpose is PENDING (no signal) whenever no vector is
  // supplied at all (core/consent.js fails-to-pending on an absent vector, and
  // nothing distinguishes "no CMP wired" from "CMP wired, not yet resolved" at
  // the resolver), and nothing would ever call `setConsent` to release a hold on
  // an unconfigured page — so passing the purpose unconditionally would silently
  // hold EVERY beacon forever on any caller that never wires a consent vector
  // (every current rig/testbed boot). Gating on `consent` keeps that legacy
  // always-dispatch behavior back-compat, exactly like 017-01/017-02, and only
  // engages the seal-hold once a host actually wires a consent-input driver.
  const airlock = createAirlock({
    trackers,
    workFactor: 0,
    endpoints,
    ctx: ctxWithConsent,
    consent,
    egressPurposes: consent ? GA4_EGRESS_PURPOSES : [],
    consentStrict,
    payloadDenylist,
  });

  const handle = {
    push: (evt) => airlock.push(evt),
    pushCritical: (evt) => airlock.pushCritical(evt),
    setConsent: (v) => airlock.setConsent(v), // 017-03 AC2: mid-session grant -> flushes held beacons
    getState: (path) => airlock.getState(path), // whole projection or dotted-path read (push-api.md)
    flushNow: () => airlock.flushNow(), // force-drain the ring to the worker (deterministic teardown/test)
    stats: () => airlock.stats(),
    dispose: () => airlock.dispose(), // 021-01 AC1: tear down this instance's Worker + unload listeners
  };

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

/**
 * Boot the airlock GA4 analytics runtime for an EDS page and install it as the page
 * singleton `window.airlock` (spec 004-02/03/04). Back-compat public entry (the
 * testbed + rigs depend on this exact behavior): delegates the GA4 boot to the
 * shared `bootGa4Core` and adds only the `window.airlock` lifecycle — an idempotent
 * re-boot disposes the prior instance first (021-01 AC2), so a second boot never
 * stacks a second Worker or a second unload-listener set. See `bootGa4Core` for the
 * `opts` contract and the returned handle's surface. (The multi-connector
 * `boot(config)` composite owns `window.airlock` the SAME way — via `installOnWindow`
 * — so ownership is never split between the core and its callers.)
 *
 * @param {object} [opts] — see `bootGa4Core`.
 * @returns {Promise<{ push, pushCritical, setConsent, getState, flushNow, stats, dispose }>}
 */
export async function bootEdsAnalytics(opts = {}) {
  return installOnWindow(await bootGa4Core(opts));
}

/**
 * The pixel-vendor dispatch table (spec 032-01 AC2) — the ONE place the three
 * near-identical pixel boots differ: a vendor config factory + that vendor's egress
 * purposes. `createXxxConfig` + `*_EGRESS_PURPOSES` were always the seed of a
 * config-driven model; collapsing them here replaces three copy-pasted boot bodies
 * with one parameterized path. `bootMetaPixel`/`bootLinkedInInsight`/`bootBingUet`
 * are now thin delegating wrappers over `bootPixelConnector`, and the config-driven
 * `{type:"pixel", vendor}` entry dispatches through the SAME table — so the two
 * paths cannot drift (proven byte-for-byte in test/eds-boot-config-equivalence.test.js).
 */
const PIXEL_VENDORS = {
  meta: { createConfig: createMetaPixelConfig, egressPurposes: META_EGRESS_PURPOSES },
  linkedin: { createConfig: createLinkedInInsightConfig, egressPurposes: LINKEDIN_EGRESS_PURPOSES },
  bing: { createConfig: createBingUetConfig, egressPurposes: BING_EGRESS_PURPOSES },
};

/**
 * The single parameterized pixel boot (spec 032-01 AC2) the three per-vendor
 * functions AND the config `{type:"pixel"}` entry all route through. Identical to
 * the pre-032 per-vendor bodies: build the vendor connector config from its
 * id/endpoint opts, then feed the SAME `createAirlock({connector:"pixel", …})` seam
 * with the vendor's egress purposes under the established `consent ? … : []`
 * back-compat gate (see `bootGa4Core`'s own gate rationale — an unconditional wire
 * would silently hold every beacon forever on a caller that never wires consent).
 * No `pushCritical` on the returned handle and no `window` slot: a pixel instance
 * wires no main-thread critical mapper (026-01 AC10) and takes no page singleton.
 *
 * @param {"meta"|"linkedin"|"bing"} vendor a key of `PIXEL_VENDORS`.
 * @param {object} [opts] `{ …vendorIds, endpoint?, consent?, consentStrict?, payloadDenylist? }`.
 * @returns {{ push: Function, setConsent: Function, getState: Function, flushNow: Function, stats: Function, dispose: Function }}
 */
function bootPixelConnector(vendor, opts = {}) {
  const entry = PIXEL_VENDORS[vendor];
  if (!entry) {
    throw new Error(`airlock: unknown pixel vendor "${vendor}" (expected one of ${Object.keys(PIXEL_VENDORS).join(", ")})`);
  }
  // Pull governance out; whatever remains is the vendor's own id/endpoint bag, which
  // its `createConfig` destructures (ignoring extras) — byte-matching the per-vendor
  // boots' explicit `createXxxConfig({ …ids, endpoint })` calls.
  const { consent, consentStrict = false, payloadDenylist, ...ids } = opts;
  const connectorConfig = entry.createConfig(ids);

  // Host-owned ceiling (ADR-0006): declared INDEPENDENTLY of the connector's own
  // advisory manifest.endpoints — a compromised/misconfigured connector config
  // cannot widen its own egress.
  const airlock = createAirlock({
    trackers: 1,
    workFactor: 0,
    endpoints: [connectorConfig.endpoint],
    ctx: {}, // no host-sourced identity crosses into a pixel instance (026-01 scope)
    connector: "pixel",
    connectorConfig,
    consent,
    egressPurposes: consent ? entry.egressPurposes : [],
    consentStrict,
    payloadDenylist,
  });

  return {
    push: (evt) => airlock.push(evt),
    setConsent: (v) => airlock.setConsent(v),
    getState: (path) => airlock.getState(path),
    flushNow: () => airlock.flushNow(),
    stats: () => airlock.stats(),
    dispose: () => airlock.dispose(),
  };
}

/**
 * Boot a Meta Pixel connector instance for an EDS page (spec 026-01 AC6) —
 * the adapter's Meta wiring, mirroring `bootEdsAnalytics`'s GA4 pattern:
 * a vendor config fixture (`createMetaPixelConfig`) feeds the SAME
 * `createAirlock` seam through the connector-selection option
 * (`connector: "pixel"`), with `META_EGRESS_PURPOSES` wired into
 * `egressPurposes` the SAME `consent ? … : []` back-compat gate
 * `bootEdsAnalytics` uses for `GA4_EGRESS_PURPOSES` (see that function's own
 * doc comment for the full rationale — an unconditional wire would silently
 * hold every beacon forever on a caller that never wires a consent vector).
 *
 * Deliberately MINIMAL relative to `bootEdsAnalytics` (026-01's scope is the
 * connector + core seams + the seal bindings, not a full UC-2-style
 * interaction-capture wiring for Meta — a real site's `push()` calls into
 * this handle are the caller's own event-vocabulary decision, spec 026-01's
 * "Identity honesty" scope note): no cookie-sourced `ctx` (this connector
 * reads none, by design — AC8/AC9), no `wireInteractions`/`wireExposure`/
 * `wireBlocks`, and no `window` global slot (a caller decides where to keep
 * the handle; unlike `window.airlock`, there is no established convention
 * for a second, vendor-specific instance yet).
 *
 * `pushCritical` is deliberately NOT exposed on the returned handle: a
 * pixel-connector airlock instance does not wire the unload-critical path at
 * all (026-01 AC10 — `core/airlock.js`'s `:277-280` unload wiring is
 * connector-conditional), and `pushCritical` would otherwise silently run a
 * pixel event through the UNCONDITIONALLY-constructed GA4 `critical`
 * dispatcher (GA4's own `mapToMp`) — a mis-map, not a beacon. Unload-critical
 * GET dispatch for pixels is a later slice.
 *
 * @param {object} [opts]
 * @param {string} [opts.pixelId]           the Meta pixel id (defaults to a
 *                                          clearly-synthetic placeholder —
 *                                          NO live identifier ships here).
 * @param {string} [opts.endpoint]          override for Meta's `/tr` endpoint
 *                                          (test/rig escape hatch).
 * @param {Record<string, string>} [opts.consent] host-supplied ADR-0007
 *                                          consent vector, folded into
 *                                          `egressPurposes` exactly like
 *                                          `bootEdsAnalytics`'s own gate.
 * @param {boolean} [opts.consentStrict]    spec 017-03 AC3 — a strict/
 *                                          no-processing regime.
 * @param {string[]} [opts.payloadDenylist] spec 019-01 (ADR-0012) — threaded
 *                                          straight through to `createAirlock`,
 *                                          merged with the always-on built-in
 *                                          default inside it.
 * @returns {Promise<{ push: Function, setConsent: Function, getState: Function, flushNow: Function, stats: Function, dispose: Function }>}
 */
export async function bootMetaPixel(opts = {}) {
  return bootPixelConnector("meta", opts); // spec 032-01 AC2: delegates to the collapsed pixel path
}

/**
 * Boot a LinkedIn Insight connector instance for an EDS page (spec 026-02
 * AC1) — mirrors `bootMetaPixel`'s own adapter pattern verbatim (see that
 * function's doc comment above for the full "why minimal relative to
 * `bootEdsAnalytics`" rationale, identical here): a vendor config fixture
 * (`createLinkedInInsightConfig`) feeds the SAME `createAirlock`
 * connector-selection option (`connector: "pixel"`), with
 * `LINKEDIN_EGRESS_PURPOSES` wired into `egressPurposes` behind the SAME
 * `consent ? … : []` back-compat gate `bootMetaPixel` uses for
 * `META_EGRESS_PURPOSES`. `pushCritical` is likewise NOT exposed on the
 * returned handle, for the SAME reason `bootMetaPixel`'s doc comment states
 * (no main-thread critical mapper for a pixel connector — a mis-map, not a
 * beacon).
 *
 * @param {object} [opts]
 * @param {string} [opts.partnerId]         the LinkedIn partner id (defaults
 *                                          to a clearly-synthetic placeholder
 *                                          — NO live identifier ships here).
 * @param {string} [opts.conversionId]      the LinkedIn conversion id for the
 *                                          `lead` event (defaults to a
 *                                          clearly-synthetic placeholder).
 * @param {string} [opts.endpoint]          override for LinkedIn's
 *                                          `/collect` endpoint (test/rig
 *                                          escape hatch).
 * @param {Record<string, string>} [opts.consent] host-supplied ADR-0007
 *                                          consent vector, folded into
 *                                          `egressPurposes` exactly like
 *                                          `bootMetaPixel`'s own gate.
 * @param {boolean} [opts.consentStrict]    spec 017-03 AC3 — a strict/
 *                                          no-processing regime.
 * @param {string[]} [opts.payloadDenylist] spec 019-01 (ADR-0012) — threaded
 *                                          straight through to `createAirlock`,
 *                                          merged with the always-on built-in
 *                                          default inside it.
 * @returns {Promise<{ push: Function, setConsent: Function, getState: Function, flushNow: Function, stats: Function, dispose: Function }>}
 */
export async function bootLinkedInInsight(opts = {}) {
  return bootPixelConnector("linkedin", opts); // spec 032-01 AC2: delegates to the collapsed pixel path
}

/**
 * Boot a Bing UET connector instance for an EDS page (spec 026-02 AC2) —
 * mirrors `bootLinkedInInsight`/`bootMetaPixel`'s own adapter pattern
 * verbatim: a vendor config fixture (`createBingUetConfig`) feeds the SAME
 * `createAirlock` connector-selection option (`connector: "pixel"`), with
 * `BING_EGRESS_PURPOSES` wired into `egressPurposes` behind the SAME
 * `consent ? … : []` back-compat gate. `pushCritical` is likewise NOT
 * exposed on the returned handle, for the SAME reason `bootMetaPixel`'s doc
 * comment states.
 *
 * @param {object} [opts]
 * @param {string} [opts.tagId]             the Bing UET tag id (defaults to
 *                                          a clearly-synthetic placeholder —
 *                                          NO live identifier ships here).
 * @param {string} [opts.endpoint]          override for Bing's `/action/0`
 *                                          endpoint (test/rig escape hatch).
 * @param {Record<string, string>} [opts.consent] host-supplied ADR-0007
 *                                          consent vector, folded into
 *                                          `egressPurposes` exactly like
 *                                          `bootMetaPixel`'s own gate.
 * @param {boolean} [opts.consentStrict]    spec 017-03 AC3 — a strict/
 *                                          no-processing regime.
 * @param {string[]} [opts.payloadDenylist] spec 019-01 (ADR-0012) — threaded
 *                                          straight through to `createAirlock`,
 *                                          merged with the always-on built-in
 *                                          default inside it.
 * @returns {Promise<{ push: Function, setConsent: Function, getState: Function, flushNow: Function, stats: Function, dispose: Function }>}
 */
export async function bootBingUet(opts = {}) {
  return bootPixelConnector("bing", opts); // spec 032-01 AC2: delegates to the collapsed pixel path
}

/**
 * Boot airlock as the page's GOVERNED RUM authority (spec 030-02) — *"airlock
 * replaces your RUM tag: off-thread, governed, already measuring."* Emits the
 * core RUM checkpoints (`top`/`error`/`cwv`, incl. INP at page-hide via 030-01's
 * connector-generic unload dispatcher), confined to `ot.aem.live`, **NOT**
 * consent-gated (RUM's governance class, spec 022).
 *
 * SAMPLING is minted ONCE here on the MAIN thread (`{weight, id, isSelected}`)
 * and passed to (a) the worker connector (via `connectorConfig`, so the chamber
 * maps the SAME id/weight) and (b) the endpoint ceiling + the unload mapper — so
 * main and worker agree byte-for-byte (the 030-01/030-02 endpoint-ceiling
 * coupling the frame-critique flagged). An UNSELECTED page emits nothing
 * (sampleRUM parity).
 *
 * SCOPED replace: covers `top`/`error`/`cwv` only — NOT the enhancer's
 * interaction/lifecycle checkpoints (deferred — spec 030 § honest bounds); a real
 * production cutover is gated on the creds-gated live `ot.aem.live` wire-shape
 * check (030-04). `web-vitals/attribution` subscribers are DI'd (overridable) so
 * this boots headlessly in tests.
 *
 * @param {object} [opts]
 * @param {string} [opts.collectBaseURL] RUM collector base (default `ot.aem.live`)
 * @param {string} [opts.rate]           a sampleRUM rate name (on/high/medium/low/off)
 * @param {number} [opts.weight]         a raw sampling weight (wins over `rate`)
 * @param {string} [opts.referer]        host-sourced page ref (default `document.referrer`)
 * @param {boolean} [opts.forceSelect]   test seam: force `isSelected` past the random gate
 * @param {Function} [opts.onLCP] [opts.onCLS] [opts.onINP] web-vitals subscriber overrides (tests inject stubs)
 * @returns {{ push, pushCritical, setConsent, getState, flushNow, stats, dispose, sampled: boolean }}
 */
export function bootHelixRum(opts = {}) {
  const {
    collectBaseURL = DEFAULT_COLLECT_BASE_URL,
    rate,
    weight: weightOverride,
    referer = (typeof document !== "undefined" && document.referrer) || "",
    forceSelect,
    onLCP: onLCPImpl = onLCP,
    onCLS: onCLSImpl = onCLS,
    onINP: onINPImpl = onINP,
  } = opts;

  // Mint the per-page sampling ONCE on the MAIN thread — the worker connector, the
  // endpoint ceiling, and the unload dispatcher (mapToRum) all use THESE values.
  const weight = resolveWeight({ rate, weight: weightOverride });
  const id = crypto.randomUUID().slice(-9);
  const isSelected = forceSelect !== undefined ? !!forceSelect : weight > 0 && Math.random() * weight < 1;
  const endpoint = rumUrl(collectBaseURL, weight);

  // Unselected page-load: emit NOTHING (sampleRUM parity — an unsampled page fires no beacon).
  if (!isSelected) {
    const noop = () => {};
    return { push: noop, pushCritical: noop, setConsent: noop, getState: () => undefined, flushNow: noop, stats: () => ({}), dispose: noop, sampled: false };
  }

  const ctx = { referer };
  const airlock = createAirlock({
    connector: "helix-rum",
    // The worker connector gets the SAME sampling (id/weight/isSelected) so its
    // steady-state beacons match; `sampling` also drives the main-thread unload
    // mapper (mapToRum) via core/airlock.js's 030-01 criticalMapper selection.
    connectorConfig: { collectBaseURL, weight, id, isSelected: true, ctx, sampling: { weight, id } },
    endpoints: [endpoint], // host-owned ceiling (ADR-0006) — byte-matches the connector's endpoint
    ctx,
    egressPurposes: [], // RUM governance class: confined, NOT consent-gated (spec 022)
    trackers: 1,
  });

  const push = (evt) => airlock.push(evt);

  // Capture wiring — the one-call-site changes 022-01/02/04 deferred to "a production adapter".
  push({ event: "top" }); // page-view on load
  if (typeof addEventListener === "function") {
    addEventListener("error", (e) => push({ event: "error", source: e && e.filename, target: e && e.message }));
    addEventListener("unhandledrejection", (e) => push({ event: "error", source: "unhandledrejection", target: e && String(e.reason) }));
    addEventListener("securitypolicyviolation", (e) => push({ event: "error", source: e && e.blockedURI, target: e && e.violatedDirective }));
  }
  startCwvCapture({ push, onLCP: onLCPImpl, onCLS: onCLSImpl, onINP: onINPImpl }); // LCP/CLS/INP (incl. INP at page-hide)

  return {
    push,
    pushCritical: (evt) => airlock.pushCritical(evt),
    setConsent: (v) => airlock.setConsent(v),
    getState: (p) => airlock.getState(p),
    flushNow: () => airlock.flushNow(),
    stats: () => airlock.stats(),
    dispose: () => airlock.dispose(),
    sampled: true,
  };
}

/**
 * alloy's declared `manifest.events` — its ONE Analytics pageView
 * (`connectors/alloy/connector.js`: `events: ["page_view"]`). NOT a catch-all: the
 * composite gate uses this so only `page_view` fans to alloy — no arbitrary site
 * event becomes a spurious Edge interact. Keep in sync with that manifest (its home).
 */
const ALLOY_MANIFEST_EVENTS = ["page_view"];

/**
 * alloy's declared egress `purposes.egress` (`connectors/alloy/connector.js`:
 * `["analytics_storage", "personalization"]` — analytics events + the Target
 * personalization query ride the same interact). Threaded into the wrapped-SDK
 * host's TRUSTED strict seam gate (spec 020-02: `egressVerdict(consent, …, {strict:
 * true})` — alloy carries NO body-consent field, so a denied OR pending governing
 * purpose is DROPPED, never sent). Kept local mirroring `GA4_EGRESS_PURPOSES`'s
 * pattern (the manifest is the home; this is the seal's view of it).
 */
const ALLOY_EGRESS_PURPOSES = ["analytics_storage", "personalization"];

/**
 * Boot Adobe/alloy through the wrapped-SDK path (spec 033-02 — the analytics
 * vertical). Unlike the `createAirlock`-shaped boots (GA4/pixel/helix-rum), alloy is
 * hosted by `core/wrapped-sdk-host.js` over airlock's CLASSIC alloy chamber Worker,
 * which `importScripts` the ADOPTER-SUPPLIED stock `@adobe/alloy` bundle via
 * `bundleUrl` ([ADR-0016] — airlock does NOT ship it; same-origin byte-pinned
 * recommended, cross-origin supported). Two things the host does NOT provide, so
 * bootAlloy owns them (033-01 Finding): it **constructs + tears down the Worker**
 * (`dispose()` → `worker.terminate()`, honoring the 021-01 no-leak invariant), and it
 * **serializes `push`/`pushCritical` through the single-slot `driveEvent`** via a
 * sequential promise chain so two never overlap (the re-entry guard is respected) —
 * N page events in sequence, riding the 033-02 host extension (post-`configured`
 * `driveEvent` dispatches immediately, no hang on event #2).
 *
 * Consent threads through the TRUSTED strict seam gate (`egressPurposes` +
 * `egressVerdict(strict)`, gated on `consent` being wired — the established
 * back-compat gate); `payloadDenylist` threads the optional seam-side XDM strip. The
 * in-chamber `setConsent` DELEGATE is driven at boot from the same vector (the
 * chamber's boot glue: configure → setConsent → sendEvent) — defense-in-depth, never
 * the enforcement. Decisions-as-data (Target personalization delivery) is OUT of
 * scope → 033-03; the host already ignores `{type:"decisions"}` (no regression).
 *
 * @param {object} [opts]
 * @param {string}   opts.bundleUrl        REQUIRED (ADR-0016) — the adopter-supplied
 *                                         stock alloy bundle URL the chamber loads.
 * @param {string}  [opts.datastreamId]    alloy `configure()` datastream id
 *                                         (`datastream`/`edgeConfigId` accepted as aliases).
 * @param {string}  [opts.orgId]           alloy `configure()` IMS org id.
 * @param {unknown[]} [opts.context]       alloy `configure()` context (default `[]` — headless).
 * @param {Record<string,string>} [opts.consent] host consent vector (ADR-0007).
 * @param {string[]} [opts.payloadDenylist] optional seam-side XDM strip (020-02 AC3).
 * @param {string|URL} [opts.workerUrl]    test/rig seam: override the chamber Worker
 *                                         URL (default the built same-origin sibling).
 * @returns {Promise<{ push: Function, pushCritical: Function, setConsent: Function, getState: Function, stats: Function, dispose: Function }>}
 */
export async function bootAlloy(opts = {}) {
  const { bundleUrl, datastreamId, orgId, datastream, edgeConfigId, context = [], consent, payloadDenylist, workerUrl } = opts;

  // ADR-0016 prerequisite — fail LOUD here too (validateConnectorEntry also checks it
  // on the config path) so a direct bootAlloy caller gets an actionable error rather
  // than a downstream chamber fatal{phase:"load"}.
  if (typeof bundleUrl !== "string" || bundleUrl.length === 0) {
    throw new Error("airlock bootAlloy: `bundleUrl` is required (the adopter-supplied stock @adobe/alloy bundle URL — ADR-0016)");
  }

  // The datastream id (aka Edge config id) is REQUIRED: alloy can't `configure()` without
  // it, AND it is the config-integrity pin's `pinnedTenant` (the `configId` the honest Edge
  // interact carries — 013-03). Fail LOUD rather than boot an un-pinnable chamber that would
  // hold every interact (an incomplete pin) or mis-configure alloy.
  const resolvedDatastreamId = datastreamId ?? datastream ?? edgeConfigId;
  if (typeof resolvedDatastreamId !== "string" || resolvedDatastreamId.length === 0) {
    throw new Error("airlock bootAlloy: a datastream id is required (`datastreamId`, or its `datastream`/`edgeConfigId` alias) — alloy configure() + the config-integrity tenant pin both need it");
  }

  // bootAlloy OWNS the Worker. Classic worker (NO { type: "module" }): the chamber
  // `importScripts` the stock bundle (033-02 AC1's TT-policy'd load). The default
  // resolves to the same-origin sibling emitted next to eds.js (004-01 / build.mjs
  // asserts it); `workerUrl` is the rig/test override. The literal `new Worker(new
  // URL("./alloy-chamber.worker.js", import.meta.url))` is load-bearing for the build
  // assertion (build.mjs scans for it) — keep it verbatim in the else branch.
  const worker = workerUrl
    ? new Worker(workerUrl)
    : new Worker(new URL("./alloy-chamber.worker.js", import.meta.url));

  // The chamber transport the host drives. `addEventListener` (not the single-slot
  // `onmessage`) so a future decisions listener (033-03) can coexist independently.
  const chamber = {
    postMessage: (msg) => worker.postMessage(msg),
    onMessage: (cb) => worker.addEventListener("message", (e) => cb(e.data)),
  };

  // A LIVE consent ref the host reads inside its strict seam gate — so `setConsent`
  // (below) updates enforcement by mutating this same object. `null` when no consent
  // is wired: `egressPurposes` is then `[]` and the gate is off (the established
  // back-compat gate — see bootGa4Core's rationale).
  const consentRef = consent ? { ...consent } : null;

  const caps = {
    egress: {
      // The ADR-0010 capability's orchestrator-side implementation: the REAL
      // main-thread fetch (ADR-0004). The host runs the endpoint/consent/config
      // gates BEFORE calling this, so a held interact never reaches the network.
      async dispatch(req) {
        const res = await fetch(req.url, { method: req.method || "POST", headers: req.headers || {}, body: req.body });
        const body = typeof res.text === "function" ? await res.text() : "";
        const ct = res.headers && typeof res.headers.get === "function" ? res.headers.get("content-type") : null;
        return { status: res.status, statusText: res.statusText, headers: { "content-type": ct || "application/json" }, body };
      },
    },
    cookies: {
      // The chamber's async cookie write-back (the server-assigned ECID), reconciled
      // by the host into a form the real jar accepts (Domain/Secure/SameSite dropped).
      reconcile: (reconciled) => {
        try { if (typeof document !== "undefined") document.cookie = reconciled; } catch (e) { /* jar self-guards */ }
      },
    },
  };

  const host = createWrappedSdkHost({
    chamber,
    caps,
    // ADR-0011 / spec 015 — the TRUSTED config-integrity TENANT pin. A cross-origin/untrusted
    // adopter bundle (ADR-0016) can re-`configure` alloy or craft its own interact fetch to an
    // ATTACKER's Adobe org; the seam pins the tenant to the host-owned datastream (`configId` on
    // adobedc.demdex.net — the live Edge routes by it, 013-03) and HOLDS (fail-closed) any
    // re-tenant. The pin is chamber-immutable (built here, on main), not chamber-supplied.
    configIntegrity: {
      pinnedHost: hostOf(ALLOY_INTERACT_ENDPOINT),
      tenantKey: "configId",
      pinnedTenant: resolvedDatastreamId,
      disposition: "hold",
    },
    // ADR-0006 / spec 016 — the host-owned endpoint CEILING, wired to the GROUNDED interact FLOOR
    // (016-02 AC3/AC5's accepted trade-off): the honest interact origin+path passes; any off-floor
    // destination is HELD. The un-grounded server-directed breadth (demdex/ID-sync URLs the Edge
    // response returns at runtime) is held+surfaced fail-closed — grounding that breadth is the
    // creds-gated live-Alloy follow-on (docs/refinement-todo.md), NOT a silent drop.
    endpointCeiling: [ALLOY_INTERACT_ENDPOINT],
    consent: consentRef,
    // 020-02: the TRUSTED strict seam gate. Gated on `consent` being wired (back-compat:
    // no consent → [] → gate off, byte-unchanged), mirroring every other boot.
    egressPurposes: consent ? ALLOY_EGRESS_PURPOSES : [],
    payloadDenylist,
  });

  // Boot the chamber: the adopter-supplied bundleUrl + the alloy config + the consent
  // vector (the chamber's in-chamber setConsent delegate reads it). The seed cookie is
  // this origin's jar (guarded — a node/SSR boot has no document).
  const config = { datastreamId: resolvedDatastreamId, orgId, context };
  const seedCookie = (typeof document !== "undefined" && document.cookie) || "";
  host.init({ cookie: seedCookie, config, bundleUrl, consent });

  // Serialize push/pushCritical through the single-slot driveEvent: a sequential
  // promise chain so two events never overlap (the re-entry guard at
  // wrapped-sdk-host.js is respected — one page event per host round-trip).
  let tail = Promise.resolve();
  const enqueue = (event) => {
    const run = tail.then(() => host.driveEvent(event));
    // Keep the chain alive past a per-event fatal, and attach a handler to `run` so a
    // rejection is never unhandled (push discards the returned promise).
    tail = run.catch(() => {});
    return run;
  };
  // Map a composite site event `{ event: name, ...fields }` to the chamber descriptor
  // `{ type: name, params: fields }`: routeBatch requires a string `type`, and the
  // alloy connector's `toXdm` reads `params.page_location`/`params.page_title`.
  const toDescriptor = (evt) => {
    const { event, ...params } = evt || {};
    return { type: event, params };
  };

  let disposed = false;
  return {
    push: (evt) => { enqueue(toDescriptor(evt)); },
    // alloy's interact is a synchronous vendor round-trip (not a sync sendBeacon), so
    // pushCritical rides the SAME queued driveEvent — best-effort on unload; a true
    // unload fast path for the wrapped-SDK interact is a named follow-on.
    pushCritical: (evt) => { enqueue(toDescriptor(evt)); },
    // Update the TRUSTED seam gate live (mutating the ref the host reads). A boot with
    // no consent leaves the gate off (egressPurposes stayed []), same as every other
    // connector; a mid-session in-chamber re-delegate is a named follow-on.
    setConsent: (v) => { if (consentRef && v) Object.assign(consentRef, v); },
    getState: () => host.getState(),
    stats: () => host.getState(),
    dispose: () => {
      if (disposed) return; // idempotent (021-01 AC1)
      disposed = true;
      if (worker && typeof worker.terminate === "function") worker.terminate();
    },
  };
}

/**
 * Does a connector's declared event vocabulary accept this event name? `["*"]` is
 * the analytics CATCH-ALL sentinel (GA4's `manifest.events`); otherwise the name
 * must be in the declared list. Used to GATE the composite fan-out (below).
 */
const acceptsEvent = (events, name) => events.includes("*") || events.includes(name);

/**
 * The COMPOSITE handle (spec 032-01 AC4) — the unified public surface `boot(config)`
 * returns and installs on `window.airlock`, wrapping every booted connector's handle
 * together with that connector's declared event vocabulary (`manifest.events`).
 *
 * FAN-OUT SEMANTICS (the pinned decision — the arch reviewer's checkpoint):
 *   - `push(evt)` / `pushCritical(evt)` FAN OUT, but GATED by each connector's
 *     declared `manifest.events`: an event is delivered to a connector ONLY IF its
 *     vocabulary is `["*"]` (GA4 — the analytics catch-all, receives everything) OR
 *     explicitly lists `evt.event` (a pixel: its `eventMap` keys; helix-rum: its RUM
 *     checkpoints `top`/`error`/`cwv`). This is the dataLayer-style model — the site
 *     pushes ONE semantic event and each configured tag that DECLARES it reacts —
 *     and the gate is load-bearing: helix-rum's `mapToRum` turns ANY event.type into
 *     an `ot.aem.live` checkpoint, so WITHOUT the gate an arbitrary site event would
 *     LEAK to the RUM collector as a spurious checkpoint. `pushCritical` additionally
 *     fans only to connectors that EXPOSE it (a pixel handle does not — 026-01 AC10).
 *   - `setConsent(v)` / `dispose()` / `flushNow()` are LIFECYCLE (not event delivery),
 *     so they FAN OUT to EVERY connector unconditionally: `setConsent` reaches every
 *     consent-governed connector (helix-rum's is a harmless no-op — `egressPurposes:[]`),
 *     closing the governance hole a GA4-only handle would leave; `dispose` tears down
 *     EVERY Worker + listener set, so the 021-01 no-leak invariant holds across the
 *     WHOLE config, not just GA4.
 *   - `getState()` / `stats()` READ from the FIRST booted connector (config order):
 *     a composite read has no single answer, so this slice delegates to the
 *     declared-first connector (a deliberate terminal choice — per-connector read
 *     namespacing would be a follow-up only if a real need surfaces). CAVEAT: reads
 *     track connector[0], and return `undefined`/`{}` if connector[0] is, e.g., an
 *     unselected helix-rum (its handle's `getState` is a no-op). For a single-connector
 *     config (e.g. ga4-only) this makes the composite behave exactly like the
 *     standalone handle.
 *
 * CAPTURE BOUNDARY (honest): a connector's BUILT-IN capture (GA4's
 * `wireInteractions`/`wireExposure`/`wireBlocks`; helix-rum's own `top`/`error`/`cwv`
 * capture inside `bootHelixRum`) stays wired to ITS OWN handle — the composite gate
 * applies ONLY to site-initiated `composite.push()`, never to a connector's internal
 * capture. So the composite neither invents cross-connector capture nor suppresses a
 * connector's own.
 *
 * @param {Array<{ handle: object, events: string[] }>} connectors per-connector
 *   handles + their declared `manifest.events`, in config order.
 */
function createComposite(connectors) {
  return {
    push: (evt) => {
      const name = evt && evt.event;
      for (const c of connectors) if (acceptsEvent(c.events, name)) c.handle.push(evt);
    },
    pushCritical: (evt) => {
      const name = evt && evt.event;
      for (const c of connectors) {
        if (typeof c.handle.pushCritical === "function" && acceptsEvent(c.events, name)) c.handle.pushCritical(evt);
      }
    },
    setConsent: (v) => { for (const c of connectors) if (typeof c.handle.setConsent === "function") c.handle.setConsent(v); },
    getState: (path) => (connectors.length ? connectors[0].handle.getState(path) : undefined),
    flushNow: () => { for (const c of connectors) if (typeof c.handle.flushNow === "function") c.handle.flushNow(); },
    stats: () => (connectors.length ? connectors[0].handle.stats() : {}),
    dispose: () => { for (const c of connectors) if (typeof c.handle.dispose === "function") c.handle.dispose(); },
  };
}

/**
 * GA4's declared `manifest.events` — the analytics CATCH-ALL sentinel
 * (`connectors/ga4/connector.js`: `events: ["*"]`; GA4 maps every event type). Kept
 * here as the composite fan-out gate's view of GA4's vocabulary.
 */
const GA4_MANIFEST_EVENTS = ["*"];

/**
 * helix-rum's declared `manifest.events` — its RUM checkpoints only
 * (`connectors/helix-rum/connector.js`: `["top", "error", "cwv"]`). NOT a site-event
 * catch-all: the composite gate uses this so an arbitrary `composite.push()` event
 * name never becomes a spurious `ot.aem.live` checkpoint. Keep in sync with that
 * manifest (its home) — if 022-05 widens the checkpoints, widen here too.
 */
const HELIX_RUM_MANIFEST_EVENTS = ["top", "error", "cwv"];

/**
 * The connector `type`s `boot(config)` can dispatch (spec 032-02 AC2/AC3, 033-02 AC3).
 * The discriminated union's tags — GA4, the three pixel vendors (nested under
 * `pixel`), helix-rum, and (033-02) **alloy** — the analytics vertical: alloy's
 * first-ever adapter boot, hosted via `core/wrapped-sdk-host.js` + `bootAlloy`
 * (adopter-supplied `bundleUrl`, ADR-0016). Personalization / decisions-as-data is
 * the follow-on vertical (033-03); this entry covers the Edge-interact analytics use.
 */
const KNOWN_CONNECTOR_TYPES = ["ga4", "pixel", "helix-rum", "alloy"];

/**
 * Each pixel vendor's REQUIRED id field (spec 032-02 AC2). Keys mirror `PIXEL_VENDORS`;
 * the config path REQUIRES the vendor's real id (a production authoring surface), unlike
 * the standalone `bootMetaPixel`/… boots which default to a synthetic placeholder for
 * rigs/tests (back-compat, unchanged).
 */
const PIXEL_REQUIRED_ID = { meta: "pixelId", linkedin: "partnerId", bing: "tagId" };

/**
 * Validate the config's TOP-LEVEL governance shape (spec 032-02 AC2) — loud + actionable,
 * BEFORE the connector loop, so a wrong-typed field never becomes a cryptic downstream
 * throw (`connectors is not iterable`) or a silently-mis-threaded governance value. This is
 * the hand-rolled RUNTIME validator: a documented SUBSET of `contracts/instrumentation-
 * config.schema.json` (the pinned reference, ajv-validated in the dev harness) — NO ajv in
 * the shipped bundle (a `build.mjs` assertion enforces it). Back-compat: `connectors` absent
 * stays a no-op boot (the schema requires it; the runtime tolerates its absence).
 */
function validateConfig(config) {
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("airlock boot(config): config must be an object");
  }
  const { connectors, consent, consentStrict, payloadDenylist } = config;
  if (connectors !== undefined && !Array.isArray(connectors)) {
    throw new Error('airlock boot(config): "connectors" must be an array');
  }
  if (consent !== undefined && (consent === null || typeof consent !== "object" || Array.isArray(consent))) {
    throw new Error('airlock boot(config): "consent" must be an object (a purpose -> state map)');
  }
  if (consentStrict !== undefined && typeof consentStrict !== "boolean") {
    throw new Error('airlock boot(config): "consentStrict" must be a boolean');
  }
  if (payloadDenylist !== undefined && (!Array.isArray(payloadDenylist) || payloadDenylist.some((k) => typeof k !== "string"))) {
    throw new Error('airlock boot(config): "payloadDenylist" must be an array of strings');
  }
}

/**
 * Validate ONE connector entry (spec 032-02 AC2) — the discriminated-union tag checks the
 * hand-rolled runtime validator owns: an unknown connector `type`, an unknown pixel `vendor`,
 * a missing required vendor id, and a representative wrong-typed field (helix-rum `weight`).
 * Every error NAMES the offending connector (by index) + field, never a silent no-op. A
 * documented SUBSET of the JSON Schema (the schema stays the fuller pinned reference).
 *
 * @param {object} entry a `config.connectors` entry.
 * @param {number} index its position (for an actionable, connector-scoped error message).
 */
function validateConnectorEntry(entry, index) {
  const at = `connectors[${index}]`;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`airlock boot(config): ${at} must be a connector object`);
  }
  const { type } = entry;
  if (!KNOWN_CONNECTOR_TYPES.includes(type)) {
    throw new Error(
      `airlock boot(config): ${at} has unknown connector type ${JSON.stringify(type)} — expected one of: ${KNOWN_CONNECTOR_TYPES.join(", ")}`,
    );
  }
  if (type === "pixel") {
    const idField = PIXEL_REQUIRED_ID[entry.vendor];
    if (!idField) {
      throw new Error(
        `airlock boot(config): ${at} (pixel) has unknown vendor ${JSON.stringify(entry.vendor)} — expected one of: ${Object.keys(PIXEL_REQUIRED_ID).join(", ")}`,
      );
    }
    if (typeof entry[idField] !== "string" || entry[idField].length === 0) {
      throw new Error(
        `airlock boot(config): ${at} (pixel/${entry.vendor}) is missing required id field ${JSON.stringify(idField)} (a non-empty string)`,
      );
    }
  }
  if (type === "helix-rum" && "weight" in entry && typeof entry.weight !== "number") {
    throw new Error(`airlock boot(config): ${at} (helix-rum) field "weight" must be a number`);
  }
  if (type === "alloy") {
    if (typeof entry.bundleUrl !== "string" || entry.bundleUrl.length === 0) {
      // ADR-0016: the stock alloy SDK bundle is ADOPTER-SUPPLIED; without `bundleUrl`
      // the chamber has nothing to importScripts. Reject loud rather than boot a chamber
      // that would fatal{phase:"load"} (a documented subset of the JSON Schema's required).
      throw new Error(`airlock boot(config): ${at} (alloy) is missing required field "bundleUrl" (a non-empty string — the adopter-supplied stock @adobe/alloy bundle URL, ADR-0016)`);
    }
    const dsId = entry.datastreamId ?? entry.datastream ?? entry.edgeConfigId;
    if (typeof dsId !== "string" || dsId.length === 0) {
      // The datastream id is REQUIRED: alloy configure() needs it, AND it is the
      // config-integrity tenant pin (spec 015 / ADR-0011). Without it the seam can't pin
      // the tenant — a re-tenant attack (ADR-0016 untrusted bundle) could go unheld.
      throw new Error(`airlock boot(config): ${at} (alloy) is missing a datastream id — set "datastreamId" (or its "datastream"/"edgeConfigId" alias); alloy configure() + the config-integrity tenant pin both require it`);
    }
  }
}

/**
 * Dispatch ONE config connector entry to its per-connector boot (spec 032-01
 * AC1/AC3), returning the connector's handle PAIRED WITH its declared
 * `manifest.events` (so the composite can GATE the fan-out — craft-review blocker).
 * Consent-governed connectors (ga4, pixels) receive the config's top-level
 * `governance` (`consent`/`consentStrict`/`payloadDenylist`) threaded into the SAME
 * per-connector gating the per-function boots use. **helix-rum is EXEMPT** (spec 022
 * governance class): it is booted from ONLY its own entry fields, so no top-level
 * consent/denylist can gate, strip, or force-async it (AC3 carve-out).
 *
 * The `events` vocabulary MIRRORS each connector's existing worker-side
 * `manifest.events`: GA4 `["*"]`, a pixel `Object.keys(eventMap)` (derived from the
 * SAME vendor config the worker manifest derives from — no drift), helix-rum its
 * checkpoints. This honors the connector's EXISTING declaration; config-declared
 * routing is a deferred follow-up, not this.
 *
 * spec 032-02 AC2: the entry is VALIDATED first (loud + actionable, naming the connector
 * by index) — a documented subset of the config JSON Schema — so an unknown type/vendor,
 * a missing required id, or a wrong-typed field rejects with a clear error rather than a
 * silent placeholder or a cryptic downstream throw.
 *
 * @param {{ type: string }} entry a connector entry from `config.connectors`.
 * @param {{ consent?, consentStrict?, payloadDenylist? }} governance top-level governance.
 * @param {number} index the entry's position in `config.connectors` (for error messages).
 * @returns {Promise<{ handle: object, events: string[] }>} the handle + its declared vocabulary.
 */
async function bootConnector(entry, governance, index) {
  validateConnectorEntry(entry, index);
  const { type, ...rest } = entry || {};
  switch (type) {
    case "ga4":
      return { handle: await bootGa4Core({ ...rest, ...governance }), events: GA4_MANIFEST_EVENTS };
    case "pixel": {
      const { vendor, ...ids } = rest;
      const handle = bootPixelConnector(vendor, { ...ids, ...governance });
      // Derive the pixel's vocabulary from the SAME vendor config factory its worker
      // manifest uses (`manifest.events = Object.keys(eventMap)`) — the eventMap keys
      // are id-independent, so this matches the chamber manifest exactly.
      const events = Object.keys(PIXEL_VENDORS[vendor].createConfig(ids).eventMap);
      return { handle, events };
    }
    case "helix-rum":
      // AC3 carve-out: booted from its OWN fields only — top-level governance is NOT
      // threaded, so `egressPurposes` stays [], no denylist, sync boot (byte-identical
      // to a standalone bootHelixRum). Its vocabulary is the RUM checkpoints only.
      return { handle: bootHelixRum(rest), events: HELIX_RUM_MANIFEST_EVENTS };
    case "alloy":
      // 033-02: the analytics vertical. alloy is consent-governed (NOT exempt like
      // helix-rum), so it receives the top-level governance (consent/consentStrict/
      // payloadDenylist) threaded into bootAlloy's strict seam gate — same as ga4/
      // pixels. Its vocabulary is the ONE Analytics pageView (["page_view"]), so the
      // composite fans only page_view to the Edge interact.
      return { handle: await bootAlloy({ ...rest, ...governance }), events: ALLOY_MANIFEST_EVENTS };
    default:
      // 032-02 owns full JSON-Schema validation with actionable errors; here we fail
      // LOUD rather than silently dropping an unknown connector.
      throw new Error(`airlock boot(config): unknown connector type ${JSON.stringify(type)}`);
  }
}

/**
 * The config-driven boot (spec 032-01 AC1) — *"a few lines + a rich JSON config"*.
 * Takes a project config declaring WHICH connectors (+ ids/endpoints) and the
 * top-level consent/payload governance, boots each declared connector through the
 * SAME per-connector boot logic the per-function boots use, and returns a COMPOSITE
 * handle (AC4) installed on `window.airlock` — its `dispose()`/`setConsent()` fan out
 * across the whole config, and a re-`boot()` disposes the ENTIRE prior composite
 * first (021-01 no-leak, now config-wide).
 *
 * The config SELECTS + PARAMETERIZES connectors; event CAPTURE stays built-in (GA4's
 * UC-1/2/3 wiring; `push()` for custom events) — declarative capture rules are a
 * stated out-of-scope follow-up (spec 032 scope). Config VALIDATION (loud, actionable
 * errors on a malformed config) is spec 032-02; this slice dispatches a well-formed
 * config and fails loud only on an unknown connector type.
 *
 * @param {{ connectors?: Array<{ type: string }>, consent?: Record<string,string>, consentStrict?: boolean, payloadDenylist?: string[] }} [config]
 * @returns {Promise<{ push, pushCritical, setConsent, getState, flushNow, stats, dispose }>}
 *   the composite handle (also set on `window.airlock`).
 */
export async function boot(config = {}) {
  // spec 032-02 AC2: validate the config's top-level shape BEFORE booting anything, so a
  // wrong-typed field rejects loud + actionable instead of becoming a cryptic downstream
  // throw. Per-connector validation happens inside bootConnector (naming the connector by
  // index), on the partial-boot-cleanup path so a bad LATER entry disposes earlier ones.
  validateConfig(config);
  const { connectors = [], consent, consentStrict, payloadDenylist } = config;
  const governance = { consent, consentStrict, payloadDenylist };
  const booted = [];
  try {
    for (let i = 0; i < connectors.length; i++) {
      // Sequential (config order) so `getState`/`stats` read the declared-first
      // connector deterministically and any boot side effects order predictably.
      booted.push(await bootConnector(connectors[i], governance, i));
    }
  } catch (err) {
    // Partial-boot cleanup (craft-review nit): a later entry's throw (unknown
    // type/vendor) must NOT orphan the Workers of connectors that already booted —
    // that would regress the very 021-01 no-leak invariant AC4 establishes. Dispose
    // what we booted (idempotent + null-safe), then rethrow. `window.airlock` is
    // never touched on this path (installOnWindow below is unreached), so no broken
    // composite is installed.
    for (const c of booted) {
      if (c && c.handle && typeof c.handle.dispose === "function") c.handle.dispose();
    }
    throw err;
  }
  return installOnWindow(createComposite(booted));
}

export default bootEdsAnalytics;
