import { mapToRum, rumUrl } from "./map.js";

/**
 * The default AEM RUM collector base — `sampleRUM`'s own default
 * (`probes/eds-testbed/scripts/aem.js:94`, grounded 2026-08-31):
 * `sampleRUM.baseURL = new URL(window.RUM_BASE || '/', new URL('https://ot.aem.live'))`.
 */
export const DEFAULT_COLLECT_BASE_URL = "https://ot.aem.live";

/** `sampleRUM`'s own sampling-rate table (`aem.js:27-34`) — `medium` (100) is the default. */
export const DEFAULT_WEIGHT = 100;

/**
 * helix-rum connector — spec 022-01, mechanism B: reproduce the AEM RUM `top`
 * (page-view) beacon NATIVELY, fed by airlock's own main-thread capture — NOT
 * a hosted/wrapped `helix-rum-enhancer` (that A/B fork is grounded + recorded
 * in docs/specs/022-helix-rum-connector/spec.md § Assumptions; this connector
 * implements the grounded lean for the core `top` checkpoint, which needs no
 * CWV/enhancer). The enhancer decision itself is deferred to 022-02.
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
 * @param {Readonly<Record<string, unknown>>} [config] host-owned RUM config:
 *   `{ collectBaseURL, weight, ctx: { referer } }`.
 * @returns {import("../../contracts/connector").Connector}
 */
export function createHelixRumConnector(config = {}) {
  const {
    collectBaseURL = DEFAULT_COLLECT_BASE_URL,
    weight = DEFAULT_WEIGHT,
    ctx = {},
  } = config;

  // Per-page sampling state, fixed ONCE (see header) — computed at
  // construction, never re-rolled per handle() call.
  const id = crypto.randomUUID().slice(-9);
  const isSelected = weight > 0 && Math.random() * weight < 1;
  const endpoint = rumUrl(collectBaseURL, weight);

  const manifest = {
    name: "airlock/helix-rum",
    // 022-01 core scope: the `top`/page-view checkpoint only. `error` (3 window
    // listeners) + the CWV/interaction enhancer checkpoints join in 022-02 —
    // widening this array (+ map.js, additively) is that slice's job.
    events: ["top"],
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
   * @param {{ type: string, ts?: number }} event
   * @returns {import("../../contracts/connector").EgressRequest[]}
   */
  function handle(event) {
    if (!isSelected) return [];
    const body = mapToRum(event, ctx, { weight, id });
    return [{ url: endpoint, body: JSON.stringify(body) }];
  }

  return { manifest, init, handle };
}
