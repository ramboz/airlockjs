/**
 * helix-rum wire-protocol mapping: shape a captured checkpoint into the AEM
 * RUM beacon body + collect URL — the `top` checkpoint (spec 022-01),
 * extended by spec 022-02 with the `error` checkpoints + sampling-rate
 * resolution.
 *
 * Pure functions — no DOM, no network, no globals (mirrors connectors/ga4/map.js,
 * the map/shape helper pattern this file follows). The wire contract is GROUNDED
 * against probes/eds-testbed/scripts/aem.js:94-124 (`sampleRUM.sendPing`), read
 * 2026-08-31:
 *   url  = new URL(`.rum/${weight}`, collectBaseURL).href
 *   body = JSON.stringify({ weight, id, referer, checkpoint, t, ...pingData, ...uaExtra })
 * For the `top` checkpoint, `pingData` is always `{}` and `uaExtra` only appends
 * a bot-detection `ua` field when `navigator.webdriver` is set — a main-thread
 * -only, browser-automation signal the chamber has no `navigator` to read. So
 * `top`'s body is EXACTLY the five fields `mapToRum` returns below; that is
 * this slice's payload-hygiene guard "by construction" (AC2) — the connector
 * never has a sixth field to add.
 *
 * ERROR CHECKPOINTS (022-02 AC1, grounded against aem.js:49-92): all three
 * error-triggering window listeners (`error` / `unhandledrejection` /
 * `securitypolicyviolation`) call `sampleRUM('error', errData)` with the SAME
 * closed two-field shape, `errData = { source, target }` (`dataFromErrorObj`,
 * aem.js:49-66). The captured checkpoint carries that per-event data on the
 * SAME channel every other airlock connector already reads per-event data
 * from — `event.params` (the internal `{ type, params }` descriptor
 * `core/airlock.js`'s `push({ event, ...params })` produces, contracts/
 * push-api.md) with an `event.payload` fallback for the pinned `AirlockEvent`
 * contract shape (contracts/connector.d.ts) — exactly the
 * `event.params || event.payload` bridge connectors/ga4/connector.js's
 * `handle` and connectors/alloy/connector.js's `toXdm` already use. No new
 * descriptor convention invented for this slice.
 *
 * `mapToRum` WHITELISTS `source`/`target` off that per-event data rather than
 * spreading it wholesale (contrast `sampleRUM`'s own unconstrained
 * `...pingData` spread in `sendPing`) — preserving 022-01's "payload-hygiene
 * by construction" property for the new checkpoint too: an `error` body has
 * AT MOST 7 fields (the 5 base + source/target), never a caller-injected 8th,
 * even if a future/misbehaving caller pushes extra params on an `error` event
 * (spec 022-02 AC1's named payload-hygiene boundary: `target` is a faithful
 * `error.toString()` reproduction, same as `sampleRUM` sends today — no
 * *additional* fields are ever added on top of that).
 *
 * CWV CHECKPOINT (022-04 AC1/AC2, grounded against `node_modules/
 * web-vitals@6.2.1`'s `dist/modules/types/{lcp,cls,inp}.d.ts`): the captured
 * checkpoint's per-event data is `connectors/helix-rum/cwv-capture.js`'s
 * `projectCwv(metric)` output — `{ name, value, ...attributionScalars }`,
 * ALREADY filtered on the main thread to structured-cloneable scalars only
 * (that file's header has the full DataCloneError must-fix rationale). This
 * is a SECOND, independent whitelist layer here — `cwvFields` picks exactly
 * the grounded field-name set (`CWV_ATTRIBUTION_FIELDS`, below) off
 * `event.params`, the SAME payload-hygiene-by-construction reason
 * `errorFields` whitelists rather than spreads: a `cwv` body can never grow a
 * field beyond this named set, even if a future/misbehaving capture call (or
 * a compromised main-thread caller) pushes extra params on a `cwv` event —
 * independent of whatever `projectCwv`'s structural (`typeof`-based) filter
 * happens to allow through. The two layers currently pass through the SAME
 * field set in practice (projectCwv's filter and this whitelist were both
 * grounded off the same three `.d.ts` files), but they guard DIFFERENT
 * boundaries: `projectCwv` guards the postMessage/structured-clone boundary
 * (name-agnostic, structural); `cwvFields` guards the wire-payload boundary
 * (named, wire-contract-hygiene). See `cwv-capture.js`'s header for why
 * `projectCwv` is deliberately NOT a hardcoded whitelist.
 */

/**
 * `sampleRUM`'s own sampling-rate table (`aem.js:27-34`) — the host-facing
 * rate NAME resolves to the numeric `weight` (the sampling denominator).
 */
export const RATE_WEIGHTS = { on: 1, off: 0, high: 10, medium: 100, low: 1000 };

/**
 * Resolve a connector instance's sampling weight (022-02 AC2). An explicit
 * numeric `weight` (022-01's raw escape hatch — direct, test-oriented) WINS
 * over a `rate` name when both are given: the raw value is already-resolved
 * and more specific, so a friendlier name never silently clobbers it. Falls
 * back to the `rate` table, then to the grounded default (`medium`/100) when
 * `rate` is omitted or unrecognized — mirroring `aem.js`'s own
 * `rateValue !== undefined ? rateValue : 100` fallback (aem.js:34).
 * @param {{ rate?: string, weight?: number }} [config]
 * @returns {number}
 */
export function resolveWeight({ rate, weight } = {}) {
  if (typeof weight === "number") return weight;
  if (typeof rate === "string" && Object.prototype.hasOwnProperty.call(RATE_WEIGHTS, rate)) {
    return RATE_WEIGHTS[rate];
  }
  return RATE_WEIGHTS.medium;
}

/**
 * Build the RUM collect URL for a given sampling weight, resolved the SAME way
 * `sampleRUM.sendPing` resolves it (a relative `.rum/${weight}` against the
 * collector base). Verified against a real `new URL(...)` resolution:
 * `rumUrl("https://ot.aem.live", 100) === "https://ot.aem.live/.rum/100"`.
 * @param {string} collectBaseURL e.g. "https://ot.aem.live"
 * @param {number} weight the sampling-rate denominator (1/10/100/1000)
 * @returns {string}
 */
export function rumUrl(collectBaseURL, weight) {
  return new URL(`.rum/${weight}`, collectBaseURL).href;
}

/**
 * Extract the grounded `errData` shape off a captured `error` checkpoint's
 * per-event data (see this file's header — the `event.params || event.payload`
 * bridge). Whitelisted to exactly `source`/`target`; see header for why.
 * @param {{ params?: Record<string, unknown>, payload?: Record<string, unknown> }} event
 * @returns {{ source: unknown, target: unknown }}
 */
function errorFields(event) {
  const data = (event && (event.params || event.payload)) || {};
  return { source: data.source, target: data.target };
}

/**
 * The whitelisted `cwv` checkpoint attribution fields (022-04 AC1) — the
 * UNION of every grounded structured-cloneable SCALAR field across
 * `LCPAttribution` / `CLSAttribution` / `INPAttribution`
 * (`node_modules/web-vitals@6.2.1`'s `dist/modules/types/{lcp,cls,inp}.d.ts`,
 * read 2026-09-01). A single flat union (not a per-metric-name branch): each
 * metric only ever populates ITS OWN subset (an LCP push never carries
 * `interactionTarget`; an INP push never carries `elementRenderDelay` — see
 * `cwv-capture.js`'s `projectCwv`), so `cwvFields` picking from this union is
 * a no-op for whichever fields a given metric didn't set — mirrors
 * `mapToRum`'s existing branch-free style (no `if (name === "LCP") …`
 * anywhere in this connector).
 *
 * Deliberate SUPERSET beyond bare `{name,value}` enhancer-parity (spec 022-04
 * AC1's "parity-superset + fallback": airlock fully controls the payload, so
 * the richer attribution data ships whitelisted now; a live-collector probe
 * confirming/narrowing it against the real AEM RUM pipeline is a follow-up,
 * not a slice blocker — see this slice's deviation log for the caveat and
 * the (stale, non-attribution-build) reference this was cross-checked
 * against).
 */
const CWV_ATTRIBUTION_FIELDS = [
  // LCPAttribution (lcp.d.ts:14-67) — excludes navigationEntry/
  // lcpResourceEntry/lcpEntry (each PerformanceEntry-shaped).
  "target", "url", "timeToFirstByte", "resourceLoadDelay", "resourceLoadDuration", "elementRenderDelay",
  // CLSAttribution (cls.d.ts:14-51) — excludes largestShiftEntry (a
  // LayoutShift entry) and largestShiftSource (carries a live DOM Node ref).
  "largestShiftTarget", "largestShiftTime", "largestShiftValue", "loadState",
  // INPAttribution (inp.d.ts:36-155) — excludes processedEventEntries /
  // longAnimationFrameEntries (entry arrays) and longestScript (nests a
  // PerformanceScriptTiming `.entry`; its two safe sub-scalars, `subpart`/
  // `intersectingDuration`, are dropped WHOLESALE along with it by
  // `projectCwv`'s shallow filter rather than partially unwrapped — see that
  // function's doc). `loadState` is shared with CLSAttribution, listed once.
  "interactionTarget", "interactionTime", "interactionType", "nextPaintTime",
  "inputDelay", "processingDuration", "presentationDelay",
  "totalScriptDuration", "totalStyleAndLayoutDuration", "totalPaintDuration", "totalUnattributedDuration",
];

/**
 * Extract the whitelisted `cwv` checkpoint fields off a captured event's
 * per-event data (the SAME `event.params || event.payload` bridge
 * `errorFields` uses, above) — `name`/`value` (the metric identity) plus
 * whichever of `CWV_ATTRIBUTION_FIELDS` the caller actually set. See this
 * file's header ("CWV CHECKPOINT") for why this is a SECOND, independent
 * whitelist layer on top of `cwv-capture.js`'s own structural filter.
 * @param {{ params?: Record<string, unknown>, payload?: Record<string, unknown> }} event
 * @returns {{ name: unknown, value: unknown, [scalarAttributionField: string]: unknown }}
 */
function cwvFields(event) {
  const data = (event && (event.params || event.payload)) || {};
  const fields = { name: data.name, value: data.value };
  for (const key of CWV_ATTRIBUTION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(data, key)) fields[key] = data[key];
  }
  return fields;
}

/**
 * Shape one captured checkpoint into the RUM beacon body.
 *
 * `ctx.referer` is HOST-SOURCED (`window.location.origin + pathname`,
 * main-thread-only — mirrors GA4's `ctx.clientId`/`sessionId`). `event.ts` is
 * the descriptor's `push()`-time `performance.now()` stamp, taken on the MAIN
 * thread at capture (`core/airlock.js`'s `push()`: `ts: performance.now()`),
 * which is exactly `sampleRUM`'s own `timeShift()` semantic (time since the
 * page's own performance time origin) — so `t` needs no separate capture path,
 * and is never regenerated inside this (off-thread) connector.
 *
 * @param {{ type: string, ts?: number, params?: Record<string, unknown>, payload?: Record<string, unknown> }} event
 *   the captured checkpoint (`type` is the RUM checkpoint name, e.g. "top",
 *   "error", or "cwv"; `ts` its main-thread capture time; `params`/`payload`
 *   carry the `error` checkpoint's `{ source, target }` errData, or the
 *   `cwv` checkpoint's `{ name, value, ...attributionScalars }` — see header).
 * @param {{ referer: string }} ctx host-sourced page context.
 * @param {{ weight: number, id: string }} sampling this connector instance's
 *   PER-PAGE sampling state (weight + the ephemeral id), fixed at connector
 *   construction — see connector.js's header for why these are NOT per-event.
 * @returns {{ weight: number, id: string, referer: string, checkpoint: string, t: number, source?: unknown, target?: unknown, name?: unknown, value?: unknown }}
 */
export function mapToRum(event, ctx, sampling) {
  const body = {
    weight: sampling.weight,
    id: sampling.id,
    referer: (ctx && ctx.referer) || "",
    checkpoint: event.type,
    t: typeof event.ts === "number" ? event.ts : 0,
  };
  // `top` stays EXACTLY the 5-field body (byte-unchanged, spec 022-02 AC3);
  // `error` gains the whitelisted source/target fields; `cwv` (022-04) gains
  // the whitelisted name/value/attribution-scalar fields. Branch-free
  // otherwise — no metric-name/checkpoint-specific logic beyond this dispatch.
  if (event.type === "error") return { ...body, ...errorFields(event) };
  if (event.type === "cwv") return { ...body, ...cwvFields(event) };
  return body;
}
