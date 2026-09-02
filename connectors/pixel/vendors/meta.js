/**
 * Meta Pixel's `/tr` wire form as a declarative config for
 * `createPixelConnector` (spec 026-01, AC2) — the ONLY place Meta-specific
 * knowledge lives (connectors/pixel/connector.js itself has none). Public,
 * documented wire form: `GET https://www.facebook.com/tr?id={pixelId}
 * &ev={event}&…` — the beacon `fbevents.js` emits, expressed directly as
 * config, WITHOUT loading `fbevents.js` (a wire-protocol job, not the SDK).
 *
 * IDENTITY-HONEST BY CONSTRUCTION (spec 026-01 "Identity honesty", AC9): this
 * config carries `id` + `ev` + a small set of NON-PII standard event params
 * only. No `_fbp`/`fbc` first-party cookie identity (that needs a chamber
 * cookie-capability — a follow-up slice) and no `ud[...]` advanced-matching
 * hashed identity (deferred to 026-03) — both deliberately absent, not
 * hardcoded elsewhere. A site that maps a PII-shaped field into this
 * connector's `paramMap` (e.g. a raw `email`) relies on
 * `core/airlock.js`'s own `payloadDenylist` (ADR-0012) to strip it BEFORE
 * this config's `handle()` ever runs — this fixture's own default
 * `paramMap` never does that itself (AC8's proof lives in the seam test,
 * not here).
 */

/** Public documented Meta Pixel wire endpoint (fbevents.js's own `/tr` beacon). */
export const META_TR_ENDPOINT = "https://www.facebook.com/tr";

/**
 * A clearly-synthetic placeholder pixel id — NEVER a live identifier
 * (CLAUDE.md security-MUST / this slice's "no live identifiers" DoD item).
 * All-zero, unambiguously fake.
 */
export const SYNTHETIC_META_PIXEL_ID = "000000000000000";

/**
 * Meta's egress purpose (ADR-0007 taxonomy) — a pixel is an ads/remarketing
 * signal, so `ad_storage` (Consent Mode v2), not GA4/RUM's
 * `analytics_storage`. A caller wires this into `createAirlock`'s
 * `egressPurposes` alongside a matching consent vector (adapters/eds/index.js
 * mirrors `GA4_EGRESS_PURPOSES`'s own wiring pattern with this constant).
 */
export const META_EGRESS_PURPOSES = ["ad_storage"];

/**
 * Build the declarative `{ endpoint, eventMap, paramMap }` config
 * `createPixelConnector` interprets for Meta's `/tr` image-GET wire form.
 *
 * `eventMap`: the site's OWN canonical event vocabulary (the same
 * snake_case names a GA4-fed `push()` call would use) mapped to Meta's
 * PascalCase standard-event names — `page_view` -> `PageView` (Meta's base
 * pageview pixel) and `lead` -> `Lead` (Meta's own standard conversion
 * event), covering the slice's two required cases (AC2: "a PageView + one
 * custom event").
 *
 * `paramMap`: `id` (Meta's pixel-id query key) is a STATIC value from
 * `pixelId`; `ev` (Meta's event-name query key) is sourced from the
 * `eventMap`-mapped name; the rest are Meta's own documented standard
 * event-parameter names (value/currency/content_name/content_category),
 * projected from `event.params` ONLY when present.
 *
 * @param {{ pixelId?: string, endpoint?: string }} [opts]
 * @returns {{
 *   name: string, endpoint: string,
 *   eventMap: Record<string, string>,
 *   paramMap: Record<string, { from: "static", value: unknown } | { from: "event" } | { from: "params", key: string }>,
 *   egressPurposes: string[],
 * }}
 */
export function createMetaPixelConfig({ pixelId = SYNTHETIC_META_PIXEL_ID, endpoint = META_TR_ENDPOINT } = {}) {
  return {
    name: "airlock/pixel/meta",
    endpoint,
    eventMap: {
      page_view: "PageView",
      lead: "Lead",
    },
    paramMap: {
      id: { from: "static", value: pixelId },
      ev: { from: "event" },
      value: { from: "params", key: "value" },
      currency: { from: "params", key: "currency" },
      content_name: { from: "params", key: "content_name" },
      content_category: { from: "params", key: "content_category" },
    },
    egressPurposes: META_EGRESS_PURPOSES,
  };
}
