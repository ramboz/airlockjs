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
import { createMetaPixelConfig, META_EGRESS_PURPOSES } from "../../connectors/pixel/vendors/meta.js";
import { createCookieCapability } from "./cookies.js";
import { createExposureReporter } from "./exposure.js";
import { createBlockInstrumenter } from "./blocks.js";

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
 */
export { META_EGRESS_PURPOSES };

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
 * Idempotent re-boot (spec 021-01 AC2, OQ12 item 4): if `window.airlock` already
 * exists, this call **disposes the prior instance first** (`window.airlock.dispose()`
 * — its Worker + unload listeners) before installing the new one. A second boot on
 * the same page therefore never stacks a second Worker or a second set of unload
 * listeners; `window.airlock` always ends up pointing at the live instance.
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
 *   a handle over the airlock's public write/read surface (also set on `window.airlock`).
 *   `setConsent` (spec 017-03 AC2) merges a consent-vector update mid-session and
 *   flushes any beacon the update just granted. `dispose` (spec 021-01 AC1) tears
 *   this instance's Worker + unload listeners down; idempotent + null-safe.
 */
export async function bootEdsAnalytics(opts = {}) {
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

  // 021-01 AC2 (OQ12 item 4): idempotent re-boot — dispose the PRIOR instance
  // (its Worker + unload listeners) before this new one takes over
  // `window.airlock`, so a second bootEdsAnalytics on the same page never stacks
  // a second Worker or a second set of unload listeners. Dispose-prior-then-reboot
  // (not a return-the-existing-handle short-circuit): every call still gets a
  // live, freshly-constructed runtime. `dispose()` is already idempotent +
  // null-safe (AC1), so calling it unconditionally on whatever prior handle is
  // present is safe; a first boot (no prior `window.airlock`) skips it entirely
  // (AC3 — byte-unchanged single-boot path).
  if (typeof window !== "undefined") {
    if (window.airlock && typeof window.airlock.dispose === "function") window.airlock.dispose();
    window.airlock = handle;
  }

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
  const { pixelId, endpoint, consent, consentStrict = false, payloadDenylist } = opts;

  const connectorConfig = createMetaPixelConfig({ pixelId, endpoint });

  // Host-owned ceiling (ADR-0006): declared INDEPENDENTLY of the connector's
  // own advisory manifest.endpoints, exactly like DEFAULT_ENDPOINTS above —
  // a compromised/misconfigured connector config cannot widen its own egress.
  const airlock = createAirlock({
    trackers: 1,
    workFactor: 0,
    endpoints: [connectorConfig.endpoint],
    ctx: {}, // no host-sourced identity crosses into a pixel instance (026-01 scope)
    connector: "pixel",
    connectorConfig,
    consent,
    egressPurposes: consent ? META_EGRESS_PURPOSES : [],
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

export default bootEdsAnalytics;
