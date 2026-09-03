/**
 * LinkedIn Insight Tag's `/collect` wire form as a declarative config for
 * `createPixelConnector` (spec 026-02 AC1) — the ONLY place LinkedIn-specific
 * knowledge lives (connectors/pixel/connector.js itself has NONE, proven by
 * test/pixel-vendors.test.js's empty-diff + no-vendor-string enumeration).
 * Public, documented wire form: `GET https://px.ads.linkedin.com/collect
 * ?pid={partnerId}&fmt=gif` for the BASE tag (R-007:36's
 * `px.ads.linkedin.com` grounding) — fires on every page load, no event-name
 * query key at all — and `…&conversionId={conversionId}` ADDED for a
 * configured conversion action. This is the beacon LinkedIn's `insight.min.js`
 * emits, expressed directly as config, WITHOUT loading that script (a
 * wire-protocol job, not the SDK).
 *
 * NO UNIVERSAL `ev`-STYLE KEY (the frame-critique's grounded distinction from
 * Meta's `/tr`): LinkedIn's base pixel carries no event-name parameter at
 * all — only a CONVERSION carries a `conversionId`, and even then it
 * identifies WHICH configured conversion action fired, not a generic event
 * name. This config expresses that with `eventMap.page_view: null` (present
 * as a KEY so `handle()` still emits a beacon — the interpreter's own
 * `hasOwnProperty` check, `connector.js:127`, is true for a `null`-valued
 * key — but the mapped "vendor event" is `null`, so `paramMap.conversionId`'s
 * `{ from: "event" }` projection OMITS it per the interpreter's own
 * undefined/null -> omitted rule, `connector.js:142`) and
 * `eventMap.lead: <conversionId>` (a conversion's "event name", from the
 * interpreter's point of view, IS its LinkedIn-configured conversion id) —
 * ZERO code, pure config, and itself evidence the flat scalar `paramMap` is
 * expressive enough for a vendor whose vocabulary has no event-name key at
 * all (spec 026-02 AC1's "proving the paramMap is output-key-agnostic, not
 * Meta-shaped").
 *
 * IDENTITY-HONEST BY CONSTRUCTION (mirrors meta.js): this config carries
 * `pid`/`fmt`/`conversionId` only — no `li_fat_id` first-party click-id
 * cookie identity (a chamber cookie-capability follow-up, out of this
 * slice's scope) and no hashed advanced-matching field (deferred to 026-03).
 * A site that maps a PII-shaped field into this connector's `paramMap` still
 * relies on `core/airlock.js`'s own `payloadDenylist` (ADR-0012) to strip it
 * BEFORE this config's `handle()` ever runs — this fixture's own default
 * `paramMap` never does that itself.
 */

/** Public documented LinkedIn Insight Tag wire endpoint. */
export const LINKEDIN_COLLECT_ENDPOINT = "https://px.ads.linkedin.com/collect";

/**
 * A clearly-synthetic placeholder LinkedIn partner id — NEVER a live
 * identifier (CLAUDE.md security-MUST / this slice's "no live identifiers"
 * DoD item). All-zero, unambiguously fake, matching meta.js's own convention.
 */
export const SYNTHETIC_LINKEDIN_PARTNER_ID = "0000000";

/**
 * A clearly-synthetic placeholder LinkedIn conversion id — same rationale as
 * `SYNTHETIC_LINKEDIN_PARTNER_ID` above.
 */
export const SYNTHETIC_LINKEDIN_CONVERSION_ID = "00000000";

/**
 * LinkedIn's egress purpose (ADR-0007 taxonomy) — an ads/remarketing signal,
 * so `ad_storage` (Consent Mode v2), matching meta.js's own `META_EGRESS_
 * PURPOSES`. A caller wires this into `createAirlock`'s `egressPurposes`
 * alongside a matching consent vector (`adapters/eds/index.js` mirrors the
 * SAME wiring pattern for LinkedIn that it already uses for Meta).
 */
export const LINKEDIN_EGRESS_PURPOSES = ["ad_storage"];

/**
 * Build the declarative `{ endpoint, eventMap, paramMap }` config
 * `createPixelConnector` interprets for LinkedIn Insight's `/collect`
 * image-GET wire form.
 *
 * `eventMap`: the site's OWN canonical `page_view` maps to `null` (the base
 * tag — no vendor event name at all, see the file doc comment above);
 * `lead` maps to the LinkedIn-configured `conversionId` itself (a
 * conversion's "vendor event name" IS its numeric conversion id).
 *
 * `paramMap`: `pid` (LinkedIn's partner-id query key) is a STATIC value from
 * `partnerId`; `fmt` is LinkedIn's own fixed `"gif"` beacon-format literal;
 * `conversionId` is sourced from the `eventMap`-mapped value, present only
 * for a conversion event (omitted for `page_view`'s `null` mapping).
 *
 * @param {{ partnerId?: string, conversionId?: string, endpoint?: string }} [opts]
 * @returns {{
 *   name: string, endpoint: string,
 *   eventMap: Record<string, string | null>,
 *   paramMap: Record<string, { from: "static", value: unknown } | { from: "event" } | { from: "params", key: string }>,
 *   egressPurposes: string[],
 * }}
 */
export function createLinkedInInsightConfig({
  partnerId = SYNTHETIC_LINKEDIN_PARTNER_ID,
  conversionId = SYNTHETIC_LINKEDIN_CONVERSION_ID,
  endpoint = LINKEDIN_COLLECT_ENDPOINT,
} = {}) {
  return {
    name: "airlock/pixel/linkedin",
    endpoint,
    eventMap: {
      page_view: null, // the base tag: fires with NO event-name/conversionId key at all
      lead: conversionId, // a conversion: the "vendor event" IS the conversion id itself
    },
    paramMap: {
      pid: { from: "static", value: partnerId },
      fmt: { from: "static", value: "gif" },
      conversionId: { from: "event" }, // omitted for page_view (null vendorEvent), present for lead
    },
    egressPurposes: LINKEDIN_EGRESS_PURPOSES,
  };
}
