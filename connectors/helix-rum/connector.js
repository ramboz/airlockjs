import { mapToRum, rumUrl, resolveWeight, RATE_WEIGHTS } from "./map.js";

/**
 * The default AEM RUM collector base — `sampleRUM`'s own default
 * (`probes/eds-testbed/scripts/aem.js:94`, grounded 2026-08-31):
 * `sampleRUM.baseURL = new URL(window.RUM_BASE || '/', new URL('https://ot.aem.live'))`.
 */
export const DEFAULT_COLLECT_BASE_URL = "https://ot.aem.live";

/**
 * `sampleRUM`'s own sampling-rate table (`aem.js:27-34`) — `medium` (100) is
 * the default. Single source of truth is `map.js`'s `RATE_WEIGHTS`; kept as
 * its own named export (022-01) since callers may want the bare default
 * number without the full rate-name table.
 */
export const DEFAULT_WEIGHT = RATE_WEIGHTS.medium;

/**
 * helix-rum connector — spec 022-01, mechanism B: reproduce the AEM RUM `top`
 * (page-view) beacon NATIVELY, fed by airlock's own main-thread capture — NOT
 * a hosted/wrapped `helix-rum-enhancer` (that A/B fork is grounded + recorded
 * in docs/specs/022-helix-rum-connector/spec.md § Assumptions; this connector
 * implements the grounded lean for the core `top` checkpoint, which needs no
 * CWV/enhancer). 022-02 (this slice) extends the SAME mechanism-B native
 * reproduction to the `error` checkpoints + sampling-rate fidelity — no new
 * capture machinery, no enhancer involved. 022-04 (this slice) widens once
 * more to the `cwv` checkpoint (LCP/CLS/INP), fed by a NEW main-thread
 * capture module (`connectors/helix-rum/cwv-capture.js`, native
 * `web-vitals/attribution` subscription — NOT the hosted enhancer, per
 * 022-01's grounding that the enhancer cannot host in a chamber). This
 * connector's OWN code (`handle()`, below) needs no `cwv`-specific branch —
 * only `manifest.events` widens and `map.js`'s `mapToRum` gains a `cwv`
 * branch; the sampling gate + endpoint + governance are identical for every
 * checkpoint type, by construction.
 *
 * Wire-protocol archetype (contracts/connector.d.ts), hosted by the SAME generic
 * core/connector-host.js GA4/alloy use — mirrors connectors/ga4/connector.js's
 * shape byte-for-byte: manifest -> factory -> init (no-op, no SDK to boot) ->
 * handle (map one event to zero-or-one EgressRequest).
 *
 * GOVERNANCE CLASS (spec 022 § Governance class, maintainer 2026-08-31): RUM is
 * PII-compliant performance telemetry, NOT subject to consent — the manifest
 * declares `purposes.egress: []` DELIBERATELY (not omitted — see below), and a
 * caller wires NO `egressPurposes` for this connector's `createAirlock`
 * instance. `core/airlock.js`'s seal (~its `worker.onmessage` dispatch seam)
 * skips the consent gate entirely on an empty `egressPurposes` while the
 * ENDPOINT CEILING (`core/endpoint-ceiling.js`) still confines every beacon to
 * the declared `ot.aem.live` destination — the RUM-appropriate seal: confined,
 * not consent-gated. Contrast GA4/alloy, whose `purposes.egress` names
 * `analytics_storage` (+ `personalization` for alloy) and IS gated.
 *
 * PER-PAGE SAMPLING STATE (grounded — aem.js's `window.hlx.rum`): `weight` (the
 * configured sampling rate) and `id` (`crypto.randomUUID().slice(-9)`, ephemeral,
 * never a persistent/cross-page identifier — no cookie capability requested) are
 * fixed ONCE at connector construction, mirroring sampleRUM's own per-page
 * `window.hlx.rum` state object — NOT re-rolled per event, so a future
 * multi-checkpoint page (022-02's `error` checkpoints) carries the SAME id/weight
 * across all of a page's checkpoints, exactly like the real sampleRUM. Likewise
 * `isSelected` (`weight > 0 && Math.random() * weight < 1`) is decided ONCE: an
 * unselected page-load's `handle()` returns `[]` for every checkpoint it is ever
 * asked to map, not just the first.
 *
 * CAPTURE (AC2 "captured on the main thread"): the checkpoint's `t` (time) is
 * the descriptor's own `ts` field — `core/airlock.js`'s `push()` already stamps
 * `performance.now()` on the MAIN thread at capture time (before the worker
 * round-trip) — so the caller's capture is just `push({ event: "top" })`, no
 * PerformanceObserver/DOM read needed for this checkpoint (see map.js's header).
 * This slice does NOT wire that `push()` call into a production adapter (a
 * flagged, deferred design question — see this slice's deviation log); it
 * establishes the connector's shape only, per the slice's own scope note.
 *
 * SAMPLING-RATE FIDELITY (022-02 AC2): `config.rate` accepts a host-supplied
 * rate NAME (`on`/`high`/`medium`/`low`/`off` -> `1`/`10`/`100`/`1000`/`0`,
 * `map.js`'s `RATE_WEIGHTS` table, grounded against aem.js's own table). The
 * raw numeric `config.weight` (022-01's escape hatch) still WINS when both are
 * given — see `map.js`'s `resolveWeight` doc for why. Either way the resolved
 * `weight` is what feeds `isSelected`/the endpoint/the beacon body below —
 * there is only ONE weight per connector instance, regardless of which knob
 * set it.
 *
 * @param {Readonly<Record<string, unknown>>} [config] host-owned RUM config:
 *   `{ collectBaseURL, rate, weight, ctx: { referer } }`.
 * @returns {import("../../contracts/connector").Connector}
 */
export function createHelixRumConnector(config = {}) {
  const {
    collectBaseURL = DEFAULT_COLLECT_BASE_URL,
    rate,
    weight: weightConfig,
    ctx = {},
    // 030-02: OPTIONAL main-thread-minted sampling overrides. When airlock runs
    // this connector in a chamber, the SAME per-page `{weight, id, isSelected}`
    // must also drive the main-thread unload dispatcher (mapToRum) + the endpoint
    // ceiling — so `bootHelixRum` mints them ONCE on the main thread and passes
    // them here, keeping main↔worker byte-identical. Absent (022's own seam tests),
    // they fall back to per-construction generation — byte-unchanged.
    id: idOverride,
    isSelected: isSelectedOverride,
  } = config;

  // Sampling-rate fidelity (022-02 AC2) — resolve ONCE, same as id/isSelected
  // below (see this connector's PER-PAGE SAMPLING STATE header note).
  const weight = resolveWeight({ rate, weight: weightConfig });

  // Per-page sampling state, fixed ONCE (see header) — computed at construction,
  // never re-rolled per handle() call; overridable by the main thread (030-02).
  const id = idOverride || crypto.randomUUID().slice(-9);
  const isSelected = isSelectedOverride !== undefined ? isSelectedOverride : weight > 0 && Math.random() * weight < 1;
  const endpoint = rumUrl(collectBaseURL, weight);

  const manifest = {
    name: "airlock/helix-rum",
    // 022-01 shipped the `top`/page-view checkpoint only. 022-02 widened to
    // the `error` checkpoints (3 window listeners — error/
    // unhandledrejection/securitypolicyviolation, aem.js:68-92). 022-04
    // (this slice) widens again to `cwv` (LCP/CLS/INP via
    // `connectors/helix-rum/cwv-capture.js`'s new `web-vitals/attribution`
    // main-thread capture — 022-01's grounding showed the enhancer itself
    // can't host in a chamber). The remaining interaction/lifecycle
    // enhancer checkpoints stay out of scope (022-05).
    events: ["top", "error", "cwv"],
    reads: [], // RUM reads no projection snapshot field — only host-sourced ctx.referer
    capabilities: {
      // NO cookie capability requested — `id` is ephemeral/per-page (never
      // persisted), unlike GA4's _ga/_ga_ or alloy's kndctr_/AMCV_/demdex.
      egress: true,
    },
    // ADR-0006 ADVISORY endpoint — the host allow-list (core/airlock.js's
    // endpoint ceiling) is authoritative. Computed from the SAME
    // {collectBaseURL, weight} handle() uses, so the ceiling's origin+pathname
    // exact-match (core/endpoint-ceiling.js) matches the runtime URL byte-for-byte.
    endpoints: [endpoint],
    // ADR-0007 purpose annotation — DELIBERATELY EMPTY egress purposes (not
    // omitted): RUM's governance class is "NOT consent-gated" (spec 022 §
    // Governance class, maintainer 2026-08-31) — a conscious declaration, not a
    // missing one. The empty array documents "no consent purpose governs this
    // egress"; core/airlock.js's seal skips the consent gate on the CALLER's
    // (not this manifest's) empty `egressPurposes` config — see this file's
    // header and the seam tests (test/helix-rum-seam.test.js).
    purposes: {
      egress: [],
      endpoints: { [endpoint]: [] },
    },
  };

  /** No vendor SDK to boot — contract conformance only (mirrors GA4's init). */
  function init(_caps) {
    // no-op
  }

  /**
   * Map one captured checkpoint to zero-or-one EgressRequest. Zero when this
   * page-load was not sampling-SELECTED (AC2 "sampling honored") — the
   * connector-level gate that also, by construction, keeps `top` to AT MOST ONE
   * beacon per page-load (AC3): the checkpoint is captured/pushed at most once,
   * and this either maps it or drops it — it never fans a single event out into
   * more than one request (unlike GA4's per-tracker loop; RUM has one destination).
   * @param {{ type: string, ts?: number, params?: Record<string, unknown>, payload?: Record<string, unknown> }} event
   *   `params`/`payload` carry the `error` checkpoint's `{ source, target }`
   *   errData (022-02 AC1) — see map.js's header for the descriptor bridge.
   * @returns {import("../../contracts/connector").EgressRequest[]}
   */
  function handle(event) {
    if (!isSelected) return [];
    const body = mapToRum(event, ctx, { weight, id });
    return [{ url: endpoint, body: JSON.stringify(body) }];
  }

  return { manifest, init, handle };
}
