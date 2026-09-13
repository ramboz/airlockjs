/**
 * Redaction — spec 046-02 AC3 (mirrors `rig/parity/redact-floodlight-ccm.js`'s
 * `redactFloodlightCcmBeacon`, for the `;`-delimited `activity` form). A raw DoubleClick Floodlight
 * `activity` capture (a real container beacon, from a real page — R5/ADR-0018: LOCAL ONLY, never
 * committed) carries LIVE identifiers: the Floodlight identity (`src` advertiser id + `type`/`cat`
 * activity tags), the first-party `auiddc` (`<random>.<unix-seconds>`, from the SAME `_gcl_au`
 * conversion-linker cookie AW/ccm read — spec 046 §A4: `auid`==`auiddc`==`_gcl_au`-derived), the
 * per-visitor uuid `u20`, and the `num` cachebuster / `u99` dc-env label / `~oref` referrer URL.
 * `redactFloodlightActivityBeacon` replaces each with a clearly-synthetic, REAL-SHAPED placeholder —
 * same field vocabulary, no live value — so the *committed* fixture
 * (test/fixtures/parity-floodlight-activity.redacted.json) is safe to ship (CLAUDE.md security-MUST).
 *
 * Every non-identifier field carries through UNCHANGED — the Consent-Mode strings (`gcs`/`gcd`/
 * `npa`), the `dma` geo flag, the custom vars `u10`/`u12`, the protocol fields
 * (`dc_fmt`/`epver`/`em`/`user_data_mode`), and the `ord` ordinal are NOT identifiers. Only identity
 * + the free-text/URL/uuid fields are redacted.
 *
 * `SYNTHETIC_AUID` is REUSED from `redact-floodlight-ccm.js` (not re-declared): §A4 makes the DC
 * `auiddc` and the ccm `auid` the SAME `_gcl_au`-derived value, so a single synthetic placeholder is
 * correct for both forms.
 *
 * Pure, import-light (mirrors the ccm redactor's dependency style) — safe to unit-test with a
 * fabricated "raw" object that is itself never written to disk or committed (see
 * test/parity-floodlight-activity.test.js). A separate module from the ccm redactor: the per-vendor/
 * per-form redactors stay independent because each carries its OWN id-field set (the ccm form's
 * `tid`/`tids`/`auid` vs the activity form's `src`/`type`/`cat`/`auiddc`/`u20` here).
 */
import { SYNTHETIC_AUID } from "./redact-floodlight-ccm.js";

/** Clearly-synthetic, real-SHAPED Floodlight identity placeholders — MUST match the committed
 *  fixture's own `src`/`type`/`cat` exactly (the oracle's identity fields are identity compares, not
 *  shape compares — replay emits these SAME literals from config). */
export const SYNTHETIC_DC_SRC = "0000000";
export const SYNTHETIC_DC_TYPE = "syntc000";
export const SYNTHETIC_DC_CAT = "syntw000";

/** A clearly-synthetic all-zero per-visitor uuid placeholder (the `u20` shape). Normalised-out by the
 *  descriptor, but redacted anyway (R5 — a real capture's `u20` is a live per-visitor id). */
export const SYNTHETIC_DC_U20 = "00000000-0000-0000-0000-000000000000";

/** A clearly-synthetic all-zero `num` cachebuster placeholder (13-digit, the ms-timestamp shape). */
export const SYNTHETIC_DC_NUM = "0000000000000";

/** A clearly-synthetic dc-env label placeholder (the `u99` shape — a real capture carries a live
 *  environment/session label). */
export const SYNTHETIC_DC_U99 = "synthetic-env";

/** A clearly-synthetic referrer-URL placeholder (`~oref` — a real capture's referrer can embed live
 *  click ids / PII in its query, so it is replaced WHOLESALE rather than scrubbed param-by-param). */
export const SYNTHETIC_DC_OREF = "https://example.test/";

export { SYNTHETIC_AUID };

/**
 * Redact one raw DC `activity` field-set to its committed, real-shaped form.
 * @param {Readonly<Record<string,string>>} rawFields
 * @returns {Record<string,string>}
 */
export function redactFloodlightActivityBeacon(rawFields) {
  /** @type {Record<string,string>} */
  const redacted = {};
  for (const [key, value] of Object.entries(rawFields)) {
    if (key === "src") redacted[key] = SYNTHETIC_DC_SRC;
    else if (key === "type") redacted[key] = SYNTHETIC_DC_TYPE;
    else if (key === "cat") redacted[key] = SYNTHETIC_DC_CAT;
    else if (key === "auiddc") redacted[key] = SYNTHETIC_AUID;
    else if (key === "u20") redacted[key] = SYNTHETIC_DC_U20;
    else if (key === "num") redacted[key] = SYNTHETIC_DC_NUM;
    else if (key === "u99") redacted[key] = SYNTHETIC_DC_U99;
    else if (key === "~oref") redacted[key] = SYNTHETIC_DC_OREF;
    else redacted[key] = value;
  }
  return redacted;
}
