/**
 * The GA4 gtag-protocol (SAME-protocol) parity descriptor — spec 039-01.
 * Unlike `descriptors/ga4.js` (the MP semantic-field-map descriptor, spec
 * 038-02), `connectors/ga4/gtag.js`'s `/g/collect` beacon speaks the
 * CONTAINER's OWN protocol (ADR-0019) — so this is the "same-protocol"
 * descriptor kind (spec 038 § "two descriptor kinds", `descriptors/meta.js`'s
 * sibling): field names are 1:1 by construction (`wireNameMap` stays empty),
 * fed to the SAME, unmodified `rig/parity/oracle.js` `diffParity` engine —
 * zero pipeline change for a second GA4 rewire path (038-01 AC7).
 *
 * Reference field set: the SAME redacted `/g/collect` page_view capture
 * `descriptors/ga4.js` uses (`test/fixtures/parity-ga4-collect.redacted.json`)
 * — one container capture, two descriptors, because ONE gtag beacon is being
 * compared against TWO airlock rewire paths (MP today; gtag as of 039).
 *
 * GAP MAP (ADR-0020 commitment 1): 039-01 shipped only the CORE attribution
 * set; session state and Consent Mode were both still not emitted. 039-02
 * closed the `gcs` (Consent Mode STATE) gap — `connectors/ga4/gtag.js`'s
 * `encodeGcs` now emits it as a pure function of the host consent vector.
 * 039-03 closes the SESSION-STATE gap — `sct`/`seg`/`_fv`/`_ss`/`_nsi` are now
 * emitted from the host-computed `ctx.sessionState`, itself produced by
 * `connectors/ga4/cookies.js`'s `writeGa4SessionState` (the `_ga_<stream>`
 * read-modify-write writer that closes OQ13-2; see
 * `test/fixtures/parity-ga4-collect-multipage.redacted.json` for the
 * field-for-field values these rows now classify `maps` against). Each closed
 * gap's row is REMOVED from `gapMap` below (not left as `gap-closed`:
 * `gap-closed` is `diffParity`'s transient "owner landed, still gap-map-listed"
 * flag for a row not yet cleaned up; a shipped slice removes the row outright,
 * same as every prior closed gap in this map's history). The Consent Mode
 * DEFAULTS string (`gcd`, owned by 039-05 — it co-varies with consent, so it
 * isn't a pure vector function like `gcs` is) is the sole remaining row. As it
 * lands, `diffParity` reclassifies it the same way (the connector's gap map
 * shrinks; the pipeline and this field list do not change).
 */
import { GA4_GTAG_COLLECT_ENDPOINT } from "../../../connectors/ga4/gtag.js";

const EP_STRING = /^ep\.(.+)$/;
const EP_NUMBER = /^epn\.(.+)$/;

/** @type {import("../oracle").ParityDescriptor} */
export const ga4GtagParityDescriptor = {
  vendor: "ga4-gtag",
  protocol: "same-protocol",
  endpoint: GA4_GTAG_COLLECT_ENDPOINT,

  // The container's CURATED, R-009-confirmed `/g/collect` attribution-bearing
  // field set for a page_view-shaped event (mirrors `descriptors/ga4.js`'s own
  // list — same capture, same vocabulary): destination + identity + event
  // payload + session state + Consent Mode.
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

  // Nondeterministic / deterministic-non-attribution / runtime-measured
  // fields (mirrors `descriptors/ga4.js`'s own denylist): `_et`'s FIELD maps
  // (039-01 emits it) but its VALUE is host/runtime-measured, not a parity
  // check.
  normaliseDenylist: ["_p", "_z", "_s", "_dbg", "_et"],

  // SAME-protocol: the container's field names ARE airlock's — identity, no
  // translation table (contrast the MP descriptor's full R-009 map).
  wireNameMap: {},

  // ADR-0020 commitment 1 — every not-yet-emitted attribution field owned by
  // the NAMED slice that closes it (039's own Decomposition), not a generic
  // "spec 039" bucket — precise enough that landing 039-02 (say) shrinks
  // exactly the `gcs` row, not the whole map at once.
  gapMap: {
    // gcs: CLOSED by 039-02 (encodeGcs) — row removed, now classifies `maps`.
    // sct/seg/_fv/_ss/_nsi: CLOSED by 039-03 (writeGa4SessionState + appendSessionState) — rows
    // removed, now classify `maps` (see test/ga4-gtag.test.js's dedicated 039-03 describe block).
    gcd: { owner: "039-05" },
  },

  /**
   * Capture -> logical-event derivation (a REPLAY-INPUT convenience, mirrors
   * `descriptors/ga4.js`'s own `deriveLogicalEvent` — see that module's doc
   * comment for the same disclaimer: this does NOT itself imply a field
   * "maps" for the oracle's diff, it only answers "which event to replay").
   * `en` -> the event type; `dl`/`dr`/`dt` -> `page_location`/
   * `page_referrer`/`page_title`; each concrete `ep.<k>` (string) /
   * `epn.<k>` (numeric) -> its bare `<k>`. Deliberately does NOT set
   * `sessionId`/`engagementTimeMsec` — those are ctx-sourced (039-01 AC2),
   * never derived from the container's own capture.
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
