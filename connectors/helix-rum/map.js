/**
 * helix-rum wire-protocol mapping: shape a captured page-view checkpoint into
 * the AEM RUM `top` beacon body + collect URL — spec 022-01.
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
 */

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
 * @param {{ type: string, ts?: number }} event the captured checkpoint (`type`
 *   is the RUM checkpoint name, e.g. "top"; `ts` its main-thread capture time).
 * @param {{ referer: string }} ctx host-sourced page context.
 * @param {{ weight: number, id: string }} sampling this connector instance's
 *   PER-PAGE sampling state (weight + the ephemeral id), fixed at connector
 *   construction — see connector.js's header for why these are NOT per-event.
 * @returns {{ weight: number, id: string, referer: string, checkpoint: string, t: number }}
 */
export function mapToRum(event, ctx, sampling) {
  return {
    weight: sampling.weight,
    id: sampling.id,
    referer: (ctx && ctx.referer) || "",
    checkpoint: event.type,
    t: typeof event.ts === "number" ? event.ts : 0,
  };
}
