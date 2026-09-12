/**
 * Redaction — spec 044-01 AC4 (mirrors 038-01's `rig/parity/redact.js` `redactMetaBeacon`). A raw
 * Google Ads (AW) `ccm/collect` capture (a real container beacon, from a real page — R5/ADR-0018:
 * LOCAL ONLY, never committed) carries LIVE identifiers: a real `AW-<id>` conversion id (in `tid`
 * and `tids`), a real first-party `auid` (`<random>.<unix-seconds>`, from the `_gcl_au`
 * conversion-linker cookie), and — if the landing was an ad click — a live click id embedded in the
 * `dl` URL (`gclid`/`wbraid`/`gbraid`). `redactAwBeacon` replaces each with a clearly-synthetic,
 * REAL-SHAPED placeholder — same field vocabulary, no live value — so the *committed* fixture
 * (test/fixtures/parity-google-ads-ccm.redacted.json) is safe to ship (CLAUDE.md security-MUST).
 *
 * Every non-identifier field carries through UNCHANGED — the Consent-Mode strings (`gcs`/`gcd`/
 * `npa`), the event name (`en`), the title (`dt`) are NOT identifiers. Only identity is redacted:
 * the AW-id, the `auid`, and URL-embedded click ids (scrubbing `gclid` from `dl` while leaving it in
 * `dl` would leak the very identifier — the same craft-review lesson as `redactMetaBeacon`'s
 * `fbclid` scrub, 2026-09-08).
 *
 * Pure, import-free (mirrors `redactMetaBeacon`'s dependency-free style) — safe to unit-test with a
 * fabricated "raw" object that is itself never written to disk or committed (see
 * test/parity-google-ads.test.js). A separate module from `redact.js` (Meta): the two vendors'
 * scrub sets differ, and this keeps `redact.js` untouched (the extract-on-third-caller convention,
 * docs/conventions.md § Code: Meta's + AW's URL scrub are 2 callers, not 3 — no shared
 * `scrubUrlIdentifiers` extraction yet).
 */

/** A clearly-synthetic, real-SHAPED (`AW-<10 digits>`), all-zero AW conversion id placeholder. */
export const SYNTHETIC_AW_CONVERSION_ID = "AW-0000000000";

/** A clearly-synthetic, real-SHAPED (`<random>.<unix-seconds>`), all-zero `auid` placeholder. */
export const SYNTHETIC_AUID = "0000000000.0000000000";

/** The AW-id-bearing fields (`tid` carries `AW-<id>`; `tids` is its echo). */
const AW_ID_FIELDS = new Set(["tid", "tids"]);

/** URL-valued fields whose query string can carry a live click id (`dl` document-location, `dr`
 *  referrer, `url` the remarketing-beacon's own url param). */
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
 * Redact one raw AW `ccm/collect` field-set to its committed, real-shaped form.
 * @param {Readonly<Record<string,string>>} rawFields
 * @returns {Record<string,string>}
 */
export function redactAwBeacon(rawFields) {
  /** @type {Record<string,string>} */
  const redacted = {};
  for (const [key, value] of Object.entries(rawFields)) {
    if (AW_ID_FIELDS.has(key)) redacted[key] = SYNTHETIC_AW_CONVERSION_ID;
    else if (key === "auid") redacted[key] = SYNTHETIC_AUID;
    else if (URL_VALUED_FIELDS.has(key)) redacted[key] = scrubUrlIdentifiers(value);
    else redacted[key] = value;
  }
  return redacted;
}
