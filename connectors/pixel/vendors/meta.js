/**
 * Meta Pixel's `/tr` wire form as a declarative config for
 * `createPixelConnector` (spec 026-01, AC2) — the ONLY place Meta-specific
 * knowledge lives (connectors/pixel/connector.js itself has none). Public,
 * documented wire form: `GET https://www.facebook.com/tr?id={pixelId}
 * &ev={event}&…` — the beacon `fbevents.js` emits, expressed directly as
 * config, WITHOUT loading `fbevents.js` (a wire-protocol job, not the SDK).
 *
 * IDENTITY-HONEST BY CONSTRUCTION (spec 026-01 "Identity honesty", AC9): this
 * config's `paramMap` carries `id` + `ev` + a small set of NON-PII standard
 * event params only. No `_fbp`/`fbc` first-party cookie identity (that needs a
 * chamber cookie-capability — a follow-up slice). A site that maps a PII-shaped
 * field into this connector's `paramMap` (e.g. a raw `email`) relies on
 * `core/airlock.js`'s own `payloadDenylist` (ADR-0012) to strip it BEFORE
 * this config's `handle()` ever runs — this fixture's own default
 * `paramMap` never does that itself (AC8's proof lives in the seam test,
 * not here).
 *
 * `ud[...]` ADVANCED MATCHING (spec 026-04, [ADR-0022] Option C): the hashed
 * advanced-matching identity does NOT live in the `paramMap` (which would make
 * the connector's `handle` identity-AWARE, violating 026-01 AC1). Instead the
 * host-sourced raw `external_id` (this factory's `externalId` arg → a top-level
 * `advancedMatching` config field) rides the pixel chamber's DEDICATED identity
 * channel: the chamber normalizes + SHA-256-hashes it (never `handle`), caches
 * the hash main-side, and merges `ud[external_id]=<hex>` onto both the
 * steady-state and the closing/unload `/tr` GET. PII fields (`em`/`ph`/…) are
 * fed later via the handle's `setIdentity`. Absent `externalId` -> no
 * `advancedMatching` field, byte-identical to the pre-026-04 config.
 *
 * `cd[...]` WIRE-FIDELITY FIX (spec 026-06, closes docs/inbox.md:27): Meta's
 * real `/tr` beacon namespaces standard-event data under `cd[...]`
 * (`cd[value]`, `cd[currency]`, `cd[content_name]`, `cd[content_category]`),
 * confirmed both by Meta's Customer Information / standard-event params docs
 * and by a real captured beacon (test/fixtures/meta-tr-pageview.redacted.json,
 * `cd[region]=us`). This config's `paramMap` projects those four fields under
 * their `cd[...]`-namespaced OUTPUT query keys (the `event.params` SOURCE keys
 * stay bare — `value`/`currency`/`content_name`/`content_category` — only the
 * wire-facing key changed); `connectors/pixel/connector.js`'s `handle()`
 * url-encodes the brackets unchanged (`cd[value]` -> `cd%5Bvalue%5D=…`),
 * matching the real wire form with no connector-core change.
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
 * event-data params, projected from `event.params` (bare
 * value/currency/content_name/content_category keys) ONLY when present, and
 * emitted under Meta's real `cd[...]` custom-data OUTPUT keys (`cd[value]`,
 * `cd[currency]`, `cd[content_name]`, `cd[content_category]` — spec 026-06,
 * see the module doc comment above).
 *
 * @param {{ pixelId?: string, endpoint?: string, externalId?: string }} [opts]
 *   `externalId` (spec 026-04): the host-sourced raw first-party
 *   `external_id` (a cookie/GUID, sourced main-side like GA4's `_ga`). When
 *   present it is declared under a top-level `advancedMatching` field the pixel
 *   chamber hashes on its dedicated identity channel (NEVER the `paramMap`/
 *   `handle`). Absent -> no `advancedMatching` field (byte-identical pre-026-04).
 * @returns {{
 *   name: string, endpoint: string,
 *   eventMap: Record<string, string>,
 *   paramMap: Record<string, { from: "static", value: unknown } | { from: "event" } | { from: "params", key: string }>,
 *   egressPurposes: string[],
 *   advancedMatching?: { external_id: string },
 * }}
 */
export function createMetaPixelConfig({ pixelId = SYNTHETIC_META_PIXEL_ID, endpoint = META_TR_ENDPOINT, externalId } = {}) {
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
      "cd[value]": { from: "params", key: "value" },
      "cd[currency]": { from: "params", key: "currency" },
      "cd[content_name]": { from: "params", key: "content_name" },
      "cd[content_category]": { from: "params", key: "content_category" },
    },
    egressPurposes: META_EGRESS_PURPOSES,
    // 026-04: the boot-time raw identity for the chamber's DEDICATED advanced-
    // matching channel — present ONLY when the host supplied `externalId`, so a
    // default Meta config stays byte-identical (no `advancedMatching` key, no
    // identity channel, no `ud[...]`). This is NOT a `paramMap` entry: `handle`
    // never reads it (026-01 AC1); the chamber hashes it off-`handle`.
    ...(externalId != null && externalId !== "" ? { advancedMatching: { external_id: String(externalId) } } : {}),
  };
}
