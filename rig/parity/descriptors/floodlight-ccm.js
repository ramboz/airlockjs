/**
 * The Floodlight (DC) `ccm/collect` same-protocol parity descriptor — spec 046-01. A near-verbatim
 * mirror of `descriptors/google-ads.js`: DC's `ccm/collect` page-load beacon carries the SAME field
 * vocabulary AW's own `ccm/collect` does (spec 046 §A2), so this is likewise a same-protocol
 * descriptor (`wireNameMap` stays empty), fed to the SAME, unmodified `rig/parity/oracle.js`
 * `diffParity` engine — zero pipeline change for the DC vendor (038-01 AC7).
 *
 * Reference field set: the DC page-load `ccm/collect` beacon, grounded on the 2026-09-13 R-010
 * recon `erp.intuit.com` re-capture (redacted into
 * `test/fixtures/parity-floodlight-ccm.redacted.json`).
 *
 * GAP MAP: EMPTY. 046-01 emits every curated attribution field this descriptor lists — destination
 * (`tid`), event (`en`), page (`dl`/`dt`), first-party linker id (`auid`), and the full Consent-Mode
 * v2 carriage (`gcs`/`gcd`/`npa`). The `ad_storage`-denied seal-hold is 046-03 (not a beacon-field
 * gap); the true Floodlight conversion activity / enhanced-match hashes are MVP9, and the
 * `;`-delimited `activity` beacon (Floodlight-native `src`/`type`/`cat` identity) is the SIBLING
 * 046-02 beacon, not a dropped field of THIS one (spec 046 §A5).
 */
import { FLOODLIGHT_CCM_COLLECT_ENDPOINT } from "../../../connectors/floodlight/connector.js";

/** @type {import("../oracle").ParityDescriptor} */
export const floodlightCcmParityDescriptor = {
  vendor: "floodlight-ccm",
  protocol: "same-protocol",
  endpoint: FLOODLIGHT_CCM_COLLECT_ENDPOINT,

  // The container's CURATED, capture-confirmed `ccm/collect` attribution-bearing field set for a
  // page_view: destination + event + page + first-party identity + Consent Mode v2 — the SAME
  // vocabulary as AW's own ccm/collect (spec 046 §A2).
  attributionFields: ["tid", "en", "dl", "dt", "auid", "gcs", "gcd", "npa"],

  // Nondeterministic / deterministic-non-attribution / regulatory-routing fields excluded before
  // the compare (reported `normalised-out`, never silently omitted): `rnd` (cachebuster w/ embedded
  // timestamp), `rcb` (retry/cachebuster count), `tft`/`tfd` (dispatch timestamps), `tids` (the
  // `tid` echo), `fmt` (a container-transport format flag) — all container-only cachebusters/
  // transport plumbing airlock does NOT reproduce — plus `dma` (the EEA Digital-Markets-Act geo-
  // routing flag — regulatory, geo-derived; there is no `encodeDma` anywhere in this codebase and it
  // is not consent-vector-derivable, spec 046 §"dma handling", mirroring the AW descriptor's own
  // `dma` normalisation).
  normaliseDenylist: ["dma", "rnd", "rcb", "tft", "tfd", "tids", "fmt"],

  // SAME-protocol: the container's field names ARE airlock's — identity, no translation table.
  wireNameMap: {},

  // EMPTY — 046-01 emits every curated attribution field (see module doc comment).
  gapMap: {},

  // spec 038-03's transport declaration (feeds ADR-0018 E10): `auid` is DC ccm/collect's one
  // first-party identity field (sourced from the SAME `_gcl_au` cookie AW reads, spec 046 §A4). Not
  // wired into `run-transport.mjs` (mirrors the AW descriptor's own note — that CLI's vendor list
  // stays 038-03's).
  transport: {
    crossSiteCookies: [],
    firstPartyIdentity: ["auid"],
  },

  /**
   * Capture -> logical-event derivation (a REPLAY-INPUT convenience, mirrors `descriptors/
   * google-ads.js`'s own `deriveLogicalEvent`): `en` -> the event type; `dl`/`dt` ->
   * `page_location`/`page_title`. Deliberately does NOT set `auid` — ctx-sourced from the fixture's
   * `_gcl_au` cookie instead (never a beacon back-feed, the decisive AC4 rule 038-02 established).
   * @param {Readonly<Record<string,string>>} containerFields
   * @returns {{ type: string|null, params: Record<string, string> }}
   */
  deriveLogicalEvent(containerFields) {
    const type = containerFields.en ?? null;
    /** @type {Record<string, string>} */
    const params = {};
    if (containerFields.dl !== undefined) params.page_location = containerFields.dl;
    if (containerFields.dt !== undefined) params.page_title = containerFields.dt;
    return { type, params };
  },
};
