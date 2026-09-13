/**
 * The Floodlight (DC) `;`-delimited `activity` same-protocol parity descriptor — spec 046-02. The
 * SIBLING of `descriptors/floodlight-ccm.js` for the OTHER DC page-load form: the classic
 * `ad.doubleclick.net/activity;src=…;type=…;cat=…` beacon whose params ride the URL PATH as
 * `;`-delimited segments (a matrix URI), carrying the Floodlight-native identity `src`/`type`/`cat`
 * that `ccm/collect` does NOT.
 *
 * Same-protocol (`wireNameMap` empty): the container's field NAMES are airlock's — the only
 * difference from the ccm descriptor is the wire ENCODING (`;`-path vs `&`-query), handled entirely
 * on the replay side (`rig/parity/replay.js`'s `fieldsFromMatrixUrl`) BEFORE the oracle, which sees
 * two already-flat `{field:value}` maps and needs no matrix awareness — zero pipeline change (038-01
 * AC7).
 *
 * Reference field set: the DC page-load `activity` beacon, grounded on the 2026-09-13 R-010 recon
 * `erp.intuit.com` re-capture (redacted into `test/fixtures/parity-floodlight-activity.redacted.json`).
 *
 * FIELD PROVENANCE (ADR-0020 — reproduce only what airlock can honestly derive; gap-own or normalise
 * the rest; NEVER fabricate):
 *  - REPRODUCED (`maps`): `src`/`type`/`cat` (config-provided Floodlight identity), `npa`/`gcs`/`gcd`
 *    (the shared `connectors/consent-mode.js` encoders — identical VALUES to the ccm beacon),
 *    `auiddc` (the `_gcl_au`-derived id, §A4).
 *  - GAP-OWNED (`expected-dropped`, each with a named closing artifact): the custom Floodlight
 *    variables `u10`/`u12`/`u99` (container-data-layer-derived — airlock ships no DC custom-variable
 *    mapping; fabricating static values would violate ADR-0020), the enhanced-conversions family
 *    `em`/`user_data_mode`/`epver` (the true Floodlight conversion/enhanced-match activity is MVP9,
 *    §A5), and the DoubleClick protocol/format constant `dc_fmt`.
 *  - NORMALISED (`normalised-out`): the `num`/`ord` cachebusters, the per-visitor uuid `u20`, the
 *    `~oref` referrer, and `dma` (the EEA Digital-Markets-Act geo-routing flag — regulatory,
 *    geo-derived; there is no `encodeDma` anywhere in this codebase and it is not consent-vector-
 *    derivable, consistent with the ccm descriptor's own `dma` normalisation).
 */
import { FLOODLIGHT_ACTIVITY_ENDPOINT } from "../../../connectors/floodlight/connector.js";

/** @type {import("../oracle").ParityDescriptor} */
export const floodlightActivityParityDescriptor = {
  vendor: "floodlight-activity",
  protocol: "same-protocol",
  endpoint: FLOODLIGHT_ACTIVITY_ENDPOINT,

  // The container's CURATED, capture-confirmed `activity` attribution-bearing field set: the
  // Floodlight identity + Consent Mode v2 + auiddc (reproduced), plus the custom-var / enhanced-
  // conversions / protocol fields airlock gap-owns (see the module doc comment for the split).
  attributionFields: [
    "src",
    "type",
    "cat",
    "npa",
    "gcs",
    "gcd",
    "auiddc",
    "u10",
    "u12",
    "u99",
    "em",
    "user_data_mode",
    "epver",
    "dc_fmt",
  ],

  // Nondeterministic / deterministic-non-attribution / regulatory-routing fields excluded before the
  // compare (reported `normalised-out`, never silently omitted): `num`/`ord` (cachebusters — `num`
  // rides the PATH, the frame-critique's ceiling break), `u20` (per-visitor uuid), `~oref`
  // (referrer), `dma` (EEA DMA geo flag — regulatory, geo-derived, no `encodeDma`, not consent-
  // vector-derivable — mirrors the ccm descriptor's own `dma` normalisation).
  normaliseDenylist: ["num", "ord", "u20", "~oref", "dma"],

  // SAME-protocol: the container's field names ARE airlock's — identity, no translation table (the
  // wire ENCODING difference is handled by the replay flattener, not a name map).
  wireNameMap: {},

  // ADR-0020 commitment 1 — every dropped attribution field owned by a NAMED closing artifact.
  gapMap: {
    // Custom Floodlight variables (container-data-layer-derived) — airlock ships no DC custom-var
    // mapping; a static value would be fabrication (ADR-0020). Owned by an MVP9-adjacent follow-up.
    u10: { owner: "DC custom-variable mapping follow-up (MVP9)" },
    u12: { owner: "DC custom-variable mapping follow-up (MVP9)" },
    u99: { owner: "DC custom-variable mapping follow-up (MVP9)" },
    // The enhanced-conversions / user-data family — the true Floodlight conversion + enhanced-match
    // activity is explicitly MVP9 (spec 046 §A5), a DIFFERENT beacon, not a dropped field of this one.
    em: { owner: "MVP9 enhanced-match conversion activity (spec 046 §A5)" },
    user_data_mode: { owner: "MVP9 enhanced-match conversion activity (spec 046 §A5)" },
    epver: { owner: "MVP9 enhanced-match conversion activity (spec 046 §A5)" },
    // A DoubleClick protocol/format constant — not attribution, not reproduced in this core slice.
    dc_fmt: { owner: "DC activity wire-fidelity follow-up" },
  },

  // spec 038-03's transport declaration (feeds ADR-0018 E10): `auiddc` is the activity beacon's one
  // first-party identity field (the SAME `_gcl_au`-derived value as the ccm beacon's `auid`, §A4).
  // Not wired into `run-transport.mjs` (mirrors the ccm/AW descriptors' own note).
  transport: {
    crossSiteCookies: [],
    firstPartyIdentity: ["auiddc"],
  },

  /**
   * Capture -> logical-event derivation (a REPLAY-INPUT convenience, mirrors the ccm descriptor's
   * own `deriveLogicalEvent`). UNLIKE the ccm form, the `;`-delimited activity wire carries NO `en`
   * event-name field — the `activity` beacon IS the page-load family, so a captured activity beacon
   * (identified by the presence of the Floodlight `src` identity) replays as `page_view`. The
   * connector's `handle` needs no params for the activity beacon (its fields come from config + ctx,
   * never the event payload).
   * @param {Readonly<Record<string,string>>} containerFields
   * @returns {{ type: string|null, params: Record<string, string> }}
   */
  deriveLogicalEvent(containerFields) {
    const type = containerFields.src !== undefined ? "page_view" : null;
    return { type, params: {} };
  },
};
