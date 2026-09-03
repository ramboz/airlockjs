/**
 * Microsoft/Bing UET's `/action/0` wire form as a declarative config for
 * `createPixelConnector` (spec 026-02 AC2) — the ONLY place Bing-specific
 * knowledge lives (connectors/pixel/connector.js itself has NONE, proven by
 * test/pixel-vendors.test.js's empty-diff + no-vendor-string enumeration).
 * Public, documented wire form: `GET https://bat.bing.com/action/0
 * ?ti={tagId}&evt=pageLoad` for the base tag's own auto-fired page-load hit
 * (R-007:37's `bat.bing.com` grounding), and `…&evt=custom&ec=…&gv=…` for a
 * configured custom "Event" goal — the beacon `bat.js` emits over the wire,
 * expressed directly as config, WITHOUT loading that script (a
 * wire-protocol job, not the SDK). The `uetq` global queue IS the SDK's
 * client-side BATCHING API (`window.uetq.push('event', …)`), not this wire
 * format — this fixture models the resulting NETWORK beacon, not the JS
 * queue-push call shape (`connectors/pixel/connector.js`'s own doc comment
 * draws this same distinction).
 *
 * ILLUSTRATIVE, NOT EXHAUSTIVE (mirrors meta.js's own scoping — a small,
 * non-PII, documented core): a real `bat.js` beacon also carries a long tail
 * of client-context fields (viewport, referrer, a `vid`/`msclkid` cookie
 * pair, a cache-busting timestamp, …) this fixture deliberately OMITS — none
 * of that is `ctx`-sourced here (this connector never reads `ctx` at all,
 * structurally — see below), and adding it is a later slice's job, not a
 * reason to withhold the core params this fixture DOES carry: `ti` (tag id) +
 * `evt=pageLoad` are solidly grounded (R-007:37 + widely documented), while
 * `evt=custom` and the `ec`/`gv` custom-goal abbreviations are
 * MODERATE-confidence fixture data — NOT a captured live `bat.js` beacon (see
 * `docs/inbox.md`; per ADR-0020's grounding discipline this is disclosed, not
 * asserted as verified). Param-name fidelity is pure config data and does not
 * move the zero-code generality thesis this slice proves.
 *
 * IDENTITY-HONEST BY CONSTRUCTION (mirrors meta.js/linkedin.js): this config
 * carries `ti`/`evt`/`ec`/`gv` only — no `_uetsid`/`_uetvid` first-party
 * cookie identity (a chamber cookie-capability follow-up, out of this
 * slice's scope, R-007:37) and no hashed advanced-matching field (deferred
 * to 026-04). A site that maps a PII-shaped field into this connector's
 * `paramMap` still relies on `core/airlock.js`'s own `payloadDenylist`
 * (ADR-0012) to strip it BEFORE this config's `handle()` ever runs — this
 * fixture's own default `paramMap` never does that itself.
 */

/** Public documented Bing/Microsoft Advertising UET wire endpoint. */
export const BING_UET_ENDPOINT = "https://bat.bing.com/action/0";

/**
 * A clearly-synthetic placeholder UET tag id — NEVER a live identifier
 * (CLAUDE.md security-MUST / this slice's "no live identifiers" DoD item).
 * All-zero, unambiguously fake, matching meta.js/linkedin.js's own convention.
 */
export const SYNTHETIC_BING_TAG_ID = "00000000";

/**
 * Bing UET's egress purpose (ADR-0007 taxonomy) — an ads/remarketing signal,
 * so `ad_storage` (Consent Mode v2), matching meta.js/linkedin.js's own
 * constants. A caller wires this into `createAirlock`'s `egressPurposes`
 * alongside a matching consent vector.
 */
export const BING_EGRESS_PURPOSES = ["ad_storage"];

/**
 * Build the declarative `{ endpoint, eventMap, paramMap }` config
 * `createPixelConnector` interprets for Bing UET's `/action/0` image-GET
 * wire form.
 *
 * `eventMap`: the site's OWN canonical `page_view` maps to `"pageLoad"` (the
 * base tag's own documented auto-fired page-view event name); `lead` maps to
 * `"custom"` (Microsoft's documented custom "Event"-goal type).
 *
 * `paramMap`: `ti` (Bing's UET tag-id query key) is a STATIC value from
 * `tagId`; `evt` (the event-name query key) is sourced from the
 * `eventMap`-mapped name; `gv` (goal value) / `ec` (event category) are
 * Bing's own documented custom-event-goal params, projected from
 * `event.params` ONLY when present.
 *
 * @param {{ tagId?: string, endpoint?: string }} [opts]
 * @returns {{
 *   name: string, endpoint: string,
 *   eventMap: Record<string, string>,
 *   paramMap: Record<string, { from: "static", value: unknown } | { from: "event" } | { from: "params", key: string }>,
 *   egressPurposes: string[],
 * }}
 */
export function createBingUetConfig({ tagId = SYNTHETIC_BING_TAG_ID, endpoint = BING_UET_ENDPOINT } = {}) {
  return {
    name: "airlock/pixel/bing",
    endpoint,
    eventMap: {
      page_view: "pageLoad",
      lead: "custom",
    },
    paramMap: {
      ti: { from: "static", value: tagId },
      evt: { from: "event" },
      gv: { from: "params", key: "value" },
      ec: { from: "params", key: "event_category" },
    },
    egressPurposes: BING_EGRESS_PURPOSES,
  };
}
