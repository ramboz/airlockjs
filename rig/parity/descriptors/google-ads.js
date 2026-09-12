/**
 * The Google Ads (AW) same-protocol parity descriptor — spec 044-01. Like `descriptors/ga4-gtag.js`
 * (and unlike the MP `descriptors/ga4.js`), `connectors/google-ads/connector.js`'s `ccm/collect`
 * beacon speaks the CONTAINER's OWN protocol (ADR-0019) — so this is the "same-protocol" descriptor
 * kind: field names are 1:1 by construction (`wireNameMap` stays empty), fed to the SAME, unmodified
 * `rig/parity/oracle.js` `diffParity` engine — zero pipeline change for a new gtag-family vendor
 * (038-01 AC7).
 *
 * Reference field set: the AW page-load `ccm/collect` beacon, grounded on the 2026-09-11 R-009 §(b)
 * `erp.intuit.com` capture (redacted into `test/fixtures/parity-google-ads-ccm.redacted.json`). The
 * A1 endpoint choice (`ccm/collect`, not the `viewthroughconversion`/`rmkt` mirrors or the
 * `ccm/form-data` enhanced-conversions channel) is justified in the connector's module doc comment.
 *
 * GAP MAP: EMPTY. 044-01 emits every curated attribution field this descriptor lists — destination
 * (`tid`), event (`en`), page (`dl`/`dt`), first-party linker id (`auid`), and the full Consent-Mode
 * v2 carriage (`gcs`/`gcd`/`npa`). The denied-path seal-hold is slice 044-02 (not a beacon-field
 * gap); the true conversion ping + enhanced-match hashes are MVP9 (§A3, a DIFFERENT beacon, not a
 * dropped field of THIS one). `auid` here is a SYNTHETIC value on both sides -> the oracle confirms
 * `auid` SHAPE/POSITION parity, not identity PRESENCE (a rewired page's real `_gcl_au`-writer gap is
 * the MVP9 residual, spec 044 §A5).
 */
import { GOOGLE_ADS_CCM_COLLECT_ENDPOINT } from "../../../connectors/google-ads/connector.js";

/** @type {import("../oracle").ParityDescriptor} */
export const googleAdsParityDescriptor = {
  vendor: "google-ads",
  protocol: "same-protocol",
  endpoint: GOOGLE_ADS_CCM_COLLECT_ENDPOINT,

  // The container's CURATED, capture-confirmed `ccm/collect` attribution-bearing field set for a
  // page_view: destination + event + page + first-party identity + Consent Mode v2.
  attributionFields: ["tid", "en", "dl", "dt", "auid", "gcs", "gcd", "npa"],

  // Nondeterministic / deterministic-non-attribution / regulatory-routing fields excluded before the
  // compare (reported `normalised-out`, never silently omitted): `rnd` (cachebuster w/ embedded
  // timestamp), `rcb` (retry/cachebuster count), `tft`/`tfd` (dispatch timestamps), `dma` (the EEA
  // Digital-Markets-Act geo-routing flag — regulatory, geo-derived, not attribution and not
  // consent-vector-derivable in this slice), plus the `viewthroughconversion`/`rmkt` family's
  // `_p`/`fst`/`random` cachebusters (listed for robustness; skipped when a capture omits them).
  normaliseDenylist: ["dma", "rnd", "rcb", "tft", "tfd", "_p", "fst", "random"],

  // SAME-protocol: the container's field names ARE airlock's — identity, no translation table.
  wireNameMap: {},

  // EMPTY — 044-01 emits every curated attribution field (see module doc comment).
  gapMap: {},

  // spec 038-03's transport declaration (feeds ADR-0018 E10): `auid` is AW's one first-party
  // identity field (sourced from `_gcl_au`, this slice). The cross-site DMP-sync pixel
  // (`cm.g.doubleclick.net/pixel`) is a credentialed cross-site cookie-match — spec 044 §A4 / E10,
  // explicitly OUT of this connector's first-party GET wire, so it is NOT declared here (and this
  // descriptor is not wired into `run-transport.mjs`, whose vendor list stays 038-03's).
  transport: {
    crossSiteCookies: [],
    firstPartyIdentity: ["auid"],
  },

  /**
   * Capture -> logical-event derivation (a REPLAY-INPUT convenience, mirrors `descriptors/
   * ga4-gtag.js`'s own `deriveLogicalEvent`): `en` -> the event type; `dl`/`dt` ->
   * `page_location`/`page_title`. Deliberately does NOT set `auid`/click ids — those are ctx-sourced
   * from the fixture's `_gcl_au` cookie + landing URL (never a beacon back-feed, the decisive AC4
   * rule 038-02 established). The `ccm/collect` page-load beacon carries no `dr` (referrer).
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
