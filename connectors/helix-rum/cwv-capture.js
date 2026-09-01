/**
 * CWV (Core Web Vitals) main-thread capture — spec 022-04. Subscribes to
 * Google's `web-vitals/attribution` build (`onLCP`/`onCLS`/`onINP`) and
 * pushes a `cwv` checkpoint per finalized metric through airlock's governed
 * write surface (`push()`, contracts/push-api.md), riding the DONE 022-01
 * `helix-rum` connector path (`connectors/helix-rum/map.js`'s new `cwv`
 * branch -> the confined, not-consent-gated egress, same as `top`/`error`).
 *
 * CAPTURE-LAYER, NOT CHAMBER (spec 022-04's grounded nuance — see the spec's
 * Overview + this slice file's own header). `web-vitals` runs on the MAIN
 * THREAD, not inside a worker chamber: LCP/CLS/INP come from
 * `PerformanceObserver` entry types scoped to the page's own `document` — a
 * Worker has no `document`/`PerformanceObserver` over the page (the SAME
 * `document`-requiring obstacle 022-01's Findings grounded for the
 * enhancer's own loader), so a chamber structurally cannot observe them. The
 * chamber isolates only the MAPPING + EGRESS
 * (`connectors/helix-rum/{connector,map}.js`); the measurement itself is
 * airlock's own main-thread capture — mirrors `adapters/eds/exposure.js`'s
 * "pure / DI'd / null-safe" main-thread capture-module convention.
 *
 * *** THE STRUCTURED-CLONE MUST-FIX (frame-critique, folded into AC1/AC2) ***
 * A raw `web-vitals/attribution` metric's `attribution` sub-object carries
 * non-structured-cloneable `PerformanceEntry`-shaped values — arrays of
 * entry objects (`INPAttribution.processedEventEntries`,
 * `.longAnimationFrameEntries` — `node_modules/web-vitals/dist/modules/
 * types/inp.d.ts`), single entry references (`LCPAttribution.lcpEntry`,
 * `.lcpResourceEntry`, `.navigationEntry` — `.../types/lcp.d.ts`;
 * `CLSAttribution.largestShiftEntry` — `.../types/cls.d.ts`), a
 * DOM-Node-carrying object (`CLSAttribution.largestShiftSource`, a
 * `LayoutShiftAttribution` with a live `node` reference), and a
 * script-entry-carrying object (`INPAttribution.longestScript.entry`, a
 * `PerformanceScriptTiming`). None of these round-trip through
 * `structuredClone` (the algorithm `core/airlock.js`'s `push()` -> worker
 * `postMessage` uses) — pushing the raw `attribution` object THROWS
 * `DataCloneError` and breaks the whole drain (every OTHER queued event in
 * that cycle is lost with it, not just the offending one).
 *
 * `projectCwv` below is the guard: it NEVER forwards `metric.attribution`
 * wholesale, only the scalar (`string`/`number`/`boolean`) values on it — a
 * STRUCTURAL filter (by `typeof`), not a hardcoded field-name list, so it
 * stays safe even against a future `web-vitals` version adding a new
 * non-scalar attribution field this slice never anticipated. It also never
 * reads `metric.entries` or any base `Metric` field other than `name`/
 * `value` (see the JSDoc below) — the base `entries: PerformanceEntry[]` is
 * excluded by construction, not by filtering.
 *
 * EMISSION MODEL — one `cwv` PUSH PER METRIC, not combined (spec 022-04
 * AC2's design fork, resolved). `onLCP`/`onCLS`/`onINP` each finalize
 * independently — LCP + CLS typically settle well before page-hide, while
 * INP only finalizes at page-hide/visibility-change (per
 * `node_modules/web-vitals`'s own `whenIdleOrHidden`-deferred design, which
 * is also why the attribution build's extra cost lands off the interaction
 * hot path — spec 022-04 AC3). Batching them into one combined beacon would
 * mean holding metrics that already finalized until the LAST one does,
 * trading away real-time delivery for no grounded benefit — so this module
 * pushes independently, per callback, as each metric finalizes. This choice
 * is independently corroborated by a local reference clone of the public
 * `adobe/helix-rum-enhancer` GitHub repo (commit `d1695dd`, 2024-04-08 — NOT
 * fetched live this session; a personal-machine artifact only, so NOT a
 * reproducible in-repo citation, recorded here for completeness rather than
 * as the basis for the decision): its `addCWVTracking()` calls
 * `sampleRUM('cwv', …)` separately and immediately inside each `web-vitals`
 * `on<Metric>` callback — i.e. one ping per metric, confirming (not just
 * corroborating from spec prose alone) the steer already in this slice's own
 * AC2 text. Caveat named in this slice's deviation log: that source predates
 * the `attribution` build (calls the PLAIN `web-vitals.iife.js`, no
 * attribution data at all) and nests `{ cwv: { NAME: value } }` in its own
 * pingData; this module instead ships the flatter `{ name, value,
 * ...attributionScalars }` shape this slice's own brief specifies — a named,
 * deliberate choice, not a silent departure from the (stale, unconfirmed)
 * reference.
 */

/** True for exactly the value types `structuredClone` always round-trips
 *  losslessly with no possibility of a live-platform-object hazard hiding
 *  inside (a `string`/`number`/`boolean` can never be a `PerformanceEntry`,
 *  a `Node`, or a container of either). */
function isScalar(value) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

/**
 * Project one `web-vitals/attribution` metric to a PLAIN, structured-
 * cloneable scalar object (spec 022-04 AC1/AC2's must-fix) —
 * `{ name, value, ...attributionScalars }`. `attributionScalars` is every
 * key of `metric.attribution` whose value passes `isScalar` — see this
 * file's header for why a structural `typeof` filter, not a maintained
 * field-name whitelist, is the guard here (that whitelisting instead
 * happens one layer OUT, in `connectors/helix-rum/map.js`'s `cwvFields`,
 * for payload-hygiene-by-construction on the OUTBOUND wire body — a
 * DIFFERENT concern from this file's postMessage-safety guard; see that
 * file's header for the two-layer rationale).
 *
 * Only `name`/`value` are read off the metric root — NOT `entries`
 * (`PerformanceEntry[]`), `id`, `delta`, `rating`, `navigationType`, or any
 * other base `Metric` field (`node_modules/web-vitals/dist/modules/types/
 * base.d.ts`): this slice's grounded shape (AC1) is `{ name, value,
 * ...attributionScalars }` only, so those fields are excluded BY
 * CONSTRUCTION (never read), not by a filter that could theoretically leak
 * them if it had a bug.
 *
 * Pure — no DOM, no push, no globals (mirrors `map.js`'s pure-function
 * style). Null-safe: a missing/malformed `metric` or `attribution` never
 * throws (mirrors `adapters/eds/exposure.js`'s capture-module convention).
 *
 * @param {{ name?: string, value?: number, attribution?: Record<string, unknown> }} [metric]
 *   a `web-vitals/attribution` `LCPMetricWithAttribution` /
 *   `CLSMetricWithAttribution` / `INPMetricWithAttribution` (or a test
 *   double shaped like one).
 * @returns {{ name: string|undefined, value: number|undefined, [scalarAttributionField: string]: string | number | boolean }}
 */
export function projectCwv(metric) {
  const projected = { name: metric && metric.name, value: metric && metric.value };
  const attribution = metric && metric.attribution;
  if (attribution && typeof attribution === "object") {
    for (const key of Object.keys(attribution)) {
      if (isScalar(attribution[key])) projected[key] = attribution[key];
    }
  }
  return projected;
}

/**
 * Wire airlock's `push()` write surface to `web-vitals/attribution`'s
 * `onLCP`/`onCLS`/`onINP` (spec 022-04 AC2). Each injected subscriber is
 * called ONCE with a handler that projects (the structured-clone guard,
 * above) and pushes the resulting `cwv` checkpoint —
 * `push({ event: "cwv", ...projectCwv(metric) })` — riding the SAME
 * `event.params` descriptor bridge (022-02) `error`'s `{source,target}`
 * already uses; the governed egress path is
 * `connectors/helix-rum/{connector,map}.js`'s widened `cwv` branch (this
 * slice), not this module's concern.
 *
 * DI'd (`push`/`onLCP`/`onCLS`/`onINP` are all PARAMETERS, never imported
 * directly from `"web-vitals/attribution"` in this file) so this module is
 * unit-testable with stub subscribers — exactly `adapters/eds/exposure.js`'s
 * capture-module convention. Production wiring (importing the real
 * `onLCP`/`onCLS`/`onINP` from `"web-vitals/attribution"` and an airlock
 * instance's `push` into one call site, e.g. in `adapters/eds/index.js`) is
 * the SAME deferred production-adapter question 022-01/02 flagged for
 * `top`/`error` — this module proves the capture SHAPE, at the fidelity
 * those slices established; see this slice's deviation log.
 *
 * @param {{
 *   push: (evt: { event: string, [k: string]: unknown }) => void,
 *   onLCP: (cb: (metric: object) => void) => void,
 *   onCLS: (cb: (metric: object) => void) => void,
 *   onINP: (cb: (metric: object) => void) => void,
 * }} deps the airlock write surface + the three `web-vitals/attribution`
 *   subscriber functions (all required — see the module doc's "DI'd" note).
 * @returns {void}
 */
export function startCwvCapture({ push, onLCP, onCLS, onINP }) {
  const onMetric = (metric) => push({ event: "cwv", ...projectCwv(metric) });
  onLCP(onMetric);
  onCLS(onMetric);
  onINP(onMetric);
}
