/**
 * Redaction — spec 046-01 AC4 (mirrors `rig/parity/redact-google-ads.js`'s `redactAwBeacon`). A raw
 * Floodlight (DC) `ccm/collect` capture (a real container beacon, from a real page — R5/ADR-0018:
 * LOCAL ONLY, never committed) carries LIVE identifiers: a real `DC-<id>` conversion id (in `tid`
 * and `tids`), a real first-party `auid` (`<random>.<unix-seconds>`, from the SAME `_gcl_au`
 * conversion-linker cookie AW reads — spec 046 §A4: `auid`==`auiddc`==`_gcl_au`-derived, NOT a
 * distinct `_gcl_dc`), and — if the landing was an ad click — a live click id embedded in the `dl`
 * URL. `redactFloodlightCcmBeacon` replaces each with a clearly-synthetic, REAL-SHAPED placeholder —
 * same field vocabulary, no live value — so the *committed* fixture
 * (test/fixtures/parity-floodlight-ccm.redacted.json) is safe to ship (CLAUDE.md security-MUST).
 *
 * Every non-identifier field carries through UNCHANGED — the Consent-Mode strings (`gcs`/`gcd`/
 * `npa`), the event name (`en`), the title (`dt`) are NOT identifiers. Only identity is redacted: the
 * DC-id, the `auid`, and URL-embedded click ids — the same craft-review lesson as
 * `redactAwBeacon`/`redactMetaBeacon`'s own `fbclid`/`gclid` scrub.
 *
 * Pure, import-free (mirrors `redactAwBeacon`'s dependency-free style) — safe to unit-test with a
 * fabricated "raw" object that is itself never written to disk or committed (see
 * test/parity-floodlight-ccm.test.js). A separate module from `redact-google-ads.js`: the per-vendor
 * redactor modules stay independent because each carries its OWN id-field set (DC's `tid`/`tids` here
 * vs AW's, Meta's `id`). NOTE: the `scrubUrlIdentifiers` FUNCTION below is now a third byte-identical
 * copy (Meta `redact.js`, AW `redact-google-ads.js`, DC here) — a genuine rule-of-three for the scrub
 * logic (docs/conventions.md § Code). Its `CLICK_ID_PARAMS` matches AW's; Meta's set differs (adds
 * `ttclid`, omits `gclaw`/`gclsrc`), so the extraction is the shared function parameterized per vendor.
 * Tracked in `docs/refinement-todo.md` (§ Spec 038 follow-ups); deferred out of 046-01 because it also
 * edits the 038 + 044 redactors.
 */

/** A clearly-synthetic, real-SHAPED (`DC-<7 digits>`), all-zero DC conversion id placeholder — MUST
 *  match the committed fixture's own `tid`/`tids` value exactly (the oracle's `tid` field is an
 *  identity compare, not a shape compare — replay must emit this SAME literal). */
export const SYNTHETIC_DC_CONVERSION_ID = "DC-0000000";

/** A clearly-synthetic, real-SHAPED (`<random>.<unix-seconds>`), all-zero `auid` placeholder — the
 *  SAME shape/value as AW's own `SYNTHETIC_AUID` (both are `_gcl_au`-derived, spec 046 §A4). */
export const SYNTHETIC_AUID = "0000000000.0000000000";

/** The DC-id-bearing fields (`tid` carries `DC-<id>`; `tids` is its echo — mirrors AW's `tid`/`tids`
 *  pair). */
const DC_ID_FIELDS = new Set(["tid", "tids"]);

/** URL-valued fields whose query string can carry a live click id (`dl` document-location; `dr`/`url`
 *  listed defensively, mirroring `redactAwBeacon`'s own set — skipped harmlessly when a capture
 *  omits them). */
const URL_VALUED_FIELDS = new Set(["dl", "dr", "url"]);
const CLICK_ID_PARAMS = ["gclid", "gbraid", "wbraid", "gclaw", "gclsrc", "fbclid", "msclkid"];

/** Replace each known click-id query param's VALUE with a synthetic marker, leaving the URL shape. */
function scrubUrlIdentifiers(value) {
  let out = value;
  for (const param of CLICK_ID_PARAMS) {
    out = out.replace(new RegExp(`([?&]${param}=)[^&#]*`, "gi"), `$1SYNTHETIC-${param.toUpperCase()}-0000`);
  }
  return out;
}

/**
 * Redact one raw DC `ccm/collect` field-set to its committed, real-shaped form.
 * @param {Readonly<Record<string,string>>} rawFields
 * @returns {Record<string,string>}
 */
export function redactFloodlightCcmBeacon(rawFields) {
  /** @type {Record<string,string>} */
  const redacted = {};
  for (const [key, value] of Object.entries(rawFields)) {
    if (DC_ID_FIELDS.has(key)) redacted[key] = SYNTHETIC_DC_CONVERSION_ID;
    else if (key === "auid") redacted[key] = SYNTHETIC_AUID;
    else if (URL_VALUED_FIELDS.has(key)) redacted[key] = scrubUrlIdentifiers(value);
    else redacted[key] = value;
  }
  return redacted;
}
