/**
 * The GA4 semantic-field-map parity descriptor — spec 038-02. GA4's rewire path TODAY speaks a
 * DIFFERENT protocol from the container: the container's `gtag.js` emits a GET beacon to
 * `/g/collect` (query-string encoded); airlock's `connectors/ga4/map.js` emits a POST-JSON
 * Measurement Protocol (MP) body to `/mp/collect`. So this is the "semantic field-map" descriptor
 * kind (spec 038 § "The oracle: one classified-diff engine, two descriptor kinds") — a FULL
 * container-field -> airlock-field TRANSLATION TABLE, not a same-protocol minimal wire-name table
 * (contrast `descriptors/meta.js`) — fed to the SAME, unmodified 038-01 `diffParity` engine.
 *
 * Reference field set: R-009(a)'s `/g/collect` -> MP map, capture-confirmed on a `page_view`
 * (docs/research/R-009-gtag-family-fidelity.md, 2026-09-07), refined by the slice's two
 * frame-critique rounds (docs/specs/038-parity-harness/reviews/slice-02-frame-critique.md):
 *  - `tid` -> `measurement_id` is the DESTINATION PROPERTY, surfaced by
 *    `rig/parity/ga4-egress.js`'s flatten adapter from the MP collect-URL QUERY (`map.js:79-85`
 *    — it is not in the POST body), so sending to the WRONG property is a caught `divergent`,
 *    never a false `dropped`.
 *  - `_et` (engagement time) maps as a FIELD but its VALUE is host/runtime-measured
 *    (`map.js:65` defaults `engagement_time_msec` to `100`) — normalised-out, not a value check.
 *
 * BOUNDED TO page_view-SHAPED events (frame-critique 2, 2026-09-08). `/g/collect` ECOMMERCE packs
 * items as `pr<n>=id~nm~pr…` delimited strings that restructure into MP's `items[]` ARRAY — a
 * STRUCTURAL translation, not a scalar name->name relation, so it is NOT representable in this
 * scalar `wireNameMap` (a static `Record<string,string>`) and is OUT OF SCOPE for 038-02: a future
 * descriptor extension (a structured translation), not "add a row" (see spec's Assumptions).
 */

/** A clearly-synthetic, real-SHAPED (`G-XXXXXXXXXX`) GA4 measurement id — mirrors
 *  `descriptors/meta.js`'s `SYNTHETIC_META_PIXEL_ID` convention. Never a live property id. */
export const SYNTHETIC_GA4_MEASUREMENT_ID = "G-DEBUGTEST0";

// NOTE: the harness passes an EMPTY MP api_secret (ga4-replay.js) — it never sends the beacon and
// the oracle checks `measurement_id`, not the secret (auth ≠ attribution). A real api_secret is
// browser-side host config, never committed (R-009 part (a)); no synthetic constant is kept here.

/** The container's real beacon host (`gtag.js`'s own endpoint — R-009; region-prefixed variants
 *  exist for the EU, omitted here). Report provenance only (`rig/parity/report.js`'s `endpoint`
 *  field) — airlock's OWN endpoint is `/mp/collect` (a different protocol, by design), never this
 *  one; `run-ga4.mjs` builds airlock's real collect URL separately via `mpUrl(...)`. */
export const GA4_COLLECT_ENDPOINT = "https://www.google-analytics.com/g/collect";

const EP_STRING = /^ep\.(.+)$/;
const EP_NUMBER = /^epn\.(.+)$/;

/** @type {import("../oracle").ParityDescriptor} */
export const ga4ParityDescriptor = {
  vendor: "ga4",
  protocol: "semantic-field-map",
  endpoint: GA4_COLLECT_ENDPOINT,

  // The container's CURATED, R-009-confirmed `/g/collect` attribution-bearing field set for a
  // page_view-shaped event: destination + identity + event payload + session state + Consent
  // Mode. Every field this fixture's capture carries is classified here or in
  // `normaliseDenylist` below — never left silently unclassified.
  attributionFields: [
    "tid",
    "cid",
    "en",
    "dl",
    "dr",
    "dt",
    "sid",
    "ep.page_type",
    "epn.reading_time_sec",
    "sct",
    "seg",
    "_fv",
    "_ss",
    "_nsi",
    "gcs",
    "gcd",
  ],

  // Nondeterministic / deterministic-non-attribution / runtime-measured fields (R-009's own
  // "cache-buster / internal -> none, normalised out" row, PLUS `_s` — a hit-SEQUENCE ordinal,
  // oracle.js's own "hit-sequence, ordering" normalise category, not real session STATE — and
  // `_et`, whose field maps but whose value is host/runtime-measured, see module doc above).
  normaliseDenylist: ["_p", "_z", "_s", "_dbg", "_et"],

  // The FULL R-009 translation table (the semantic-field-map descriptor kind) -> the FLATTENED
  // airlock field-set `rig/parity/ga4-egress.js`'s `flattenGa4Egress` produces. Each `ep.<k>` /
  // `epn.<k>` row is a CONCRETE field this fixture's capture observed — never a wildcard-strip
  // (`wireNameMap` is a static `Record<string,string>`, oracle.js's own contract): a NEW custom
  // event param needs a NEW row here, confirmed per capture, exactly like a new attribution field.
  wireNameMap: {
    tid: "measurement_id",
    cid: "client_id",
    en: "event_name",
    dl: "page_location",
    dr: "page_referrer",
    dt: "page_title",
    sid: "session_id",
    "ep.page_type": "page_type",
    "epn.reading_time_sec": "reading_time_sec",
  },

  // ADR-0020 commitment 1 — every MP-only-path field with no equivalent TODAY, owned by spec 039
  // (the additive gtag-protocol connector: the future `_ga_<stream>` writer + full Consent Mode
  // carriage, R-009's Conclusion). Session mechanics (sct/seg/_fv/_ss/_nsi) and the Consent-Mode
  // signal (gcs/gcd) are the SAME gap — no MP body field exists for either (AC4).
  gapMap: {
    sct: { owner: "spec 039" },
    seg: { owner: "spec 039" },
    _fv: { owner: "spec 039" },
    _ss: { owner: "spec 039" },
    _nsi: { owner: "spec 039" },
    gcs: { owner: "spec 039" },
    gcd: { owner: "spec 039" },
  },

  /**
   * Capture -> logical-event derivation (a REPLAY-INPUT convenience, mirrors `descriptors/meta.js`'s
   * own `deriveLogicalEvent` — see that module's doc comment for the same disclaimer): reconstructs
   * the `{type, params}` shape `connectors/ga4/map.js`'s `mapToMp` consumes FROM a captured
   * `/g/collect` page_view. `en` -> the event type; `dl`/`dr`/`dt` -> `page_location`/
   * `page_referrer`/`page_title`; each concrete `ep.<k>` (string) / `epn.<k>` (numeric) -> its bare
   * `<k>`. Deliberately does NOT set `session_id` / `engagement_time_msec` — those are CTX-sourced
   * inside `mapToMp` itself (`map.js:63-65`), never derived from the container's own capture
   * (AC1's decisive rule: ctx is never a beacon back-feed).
   * @param {Readonly<Record<string,string>>} containerFields
   * @returns {{ type: string|null, params: Record<string, string|number> }}
   */
  deriveLogicalEvent(containerFields) {
    const type = containerFields.en ?? null;
    /** @type {Record<string, string|number>} */
    const params = {};
    if (containerFields.dl !== undefined) params.page_location = containerFields.dl;
    if (containerFields.dr !== undefined) params.page_referrer = containerFields.dr;
    if (containerFields.dt !== undefined) params.page_title = containerFields.dt;
    for (const [key, value] of Object.entries(containerFields)) {
      const str = EP_STRING.exec(key);
      if (str) {
        params[str[1]] = value;
        continue;
      }
      const num = EP_NUMBER.exec(key);
      if (num) params[num[1]] = Number(value);
    }
    return { type, params };
  },
};
