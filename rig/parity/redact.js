/**
 * Redaction — spec 038-01 AC1. A raw Meta `/tr` capture (a real container beacon, from a real
 * page — R5/ADR-0020: LOCAL ONLY, never committed) carries LIVE identifiers: a real pixel id,
 * real `_fbp`/`fbc` first-party cookie values, and real SHA-256 hashed advanced-matching data
 * under `ud[...]`. `redactMetaBeacon` replaces each with a clearly-synthetic, REAL-SHAPED
 * placeholder — same field vocabulary, no live value — so the *committed* fixture
 * (test/fixtures/parity-meta-tr.redacted.json) is safe to ship (CLAUDE.md security-MUST).
 *
 * Every non-identifier field carries through UNCHANGED, EXCEPT that URL-valued fields (`dl`
 * document-location, `dr` referrer) have known identifier query-params scrubbed: a real `/tr` `dl`
 * routinely carries `?fbclid=<live click id>` — the very identifier `fbc` encodes — so redacting
 * the `fbc` cookie while leaving `fbclid` in `dl` would leak it (craft-review 2026-09-08).
 * Redaction targets identity — cookie/hash fields AND URL-embedded click ids — never the
 * attribution shape the oracle needs to see.
 *
 * Pure, import-free (mirrors core/consent.js / connectors/pixel/validate.js's dependency-free
 * primitive style) — safe to unit-test with a fabricated "raw" object that is itself never
 * written to disk or committed (see test/parity-meta.test.js).
 */

/** Mirrors connectors/pixel/vendors/meta.js's own placeholder — reused, not reinvented, so the
 * two never drift apart. Re-exported for convenience (test/parity-meta.test.js imports it from
 * here alongside the other SYNTHETIC_* constants). */
import { SYNTHETIC_META_PIXEL_ID } from "../../connectors/pixel/vendors/meta.js";
export { SYNTHETIC_META_PIXEL_ID };

/** A real-SHAPED (`fb.<subdomain-index>.<creation-time-ms>.<random>`), all-zero `_fbp` placeholder. */
export const SYNTHETIC_FBP = "fb.1.0000000000000.0000000000";

/** A real-SHAPED (`fb.<subdomain-index>.<creation-time-ms>.<fbclid>`) `fbc` placeholder — the
 * click-id segment is a literal SYNTHETIC marker so it can never be mistaken for a live value. */
export const SYNTHETIC_FBC = "fb.1.0000000000000.SYNTHETIC-FBCLID-0000";

/** A SHA-256-shaped (64 hex chars), all-zero placeholder for any `ud[...]` hashed-match field. */
export const SYNTHETIC_HASH = "0".repeat(64);

const ADVANCED_MATCH_FIELD = /^ud\[/;

/** URL-valued fields whose query string can carry a live identifier (`dl` document-location,
 *  `dr` referrer). `fbclid` is Facebook's click id, and `fbc` is DERIVED from it — so scrubbing
 *  `fbc` while leaving `fbclid` in `dl` leaks the same identifier. Cross-vendor click ids are
 *  scrubbed too, defensively (craft-review 2026-09-08). */
const URL_VALUED_FIELDS = new Set(["dl", "dr"]);
const CLICK_ID_PARAMS = ["fbclid", "gclid", "gbraid", "wbraid", "msclkid", "ttclid"];

/** Replace each known click-id query param's VALUE with a synthetic marker, leaving the URL shape. */
function scrubUrlIdentifiers(value) {
  let out = value;
  for (const param of CLICK_ID_PARAMS) {
    out = out.replace(new RegExp(`([?&]${param}=)[^&#]*`, "gi"), `$1SYNTHETIC-${param.toUpperCase()}-0000`);
  }
  return out;
}

/**
 * Redact one raw Meta `/tr` field-set to its committed, real-shaped form.
 * @param {Readonly<Record<string,string>>} rawFields
 * @returns {Record<string,string>}
 */
export function redactMetaBeacon(rawFields) {
  /** @type {Record<string,string>} */
  const redacted = {};
  for (const [key, value] of Object.entries(rawFields)) {
    if (key === "id") redacted[key] = SYNTHETIC_META_PIXEL_ID;
    else if (key === "_fbp") redacted[key] = SYNTHETIC_FBP;
    else if (key === "fbc") redacted[key] = SYNTHETIC_FBC;
    else if (ADVANCED_MATCH_FIELD.test(key)) redacted[key] = SYNTHETIC_HASH;
    else if (URL_VALUED_FIELDS.has(key)) redacted[key] = scrubUrlIdentifiers(value);
    else redacted[key] = value;
  }
  return redacted;
}
