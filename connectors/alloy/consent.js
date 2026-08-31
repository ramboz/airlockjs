/**
 * Alloy consent shaping (spec 020-02, ADR-0007) — the vendor-specific half of
 * the idiomatic DELEGATE lever the 020-01 probe found: alloy consent is the
 * Adobe 2.0 consent-standard **command**
 *
 *   alloy("setConsent", { consent: [{ standard: "Adobe", version: "2.0",
 *     value: { collect: { val: "y" | "n" } } }] })
 *
 * — NOT an XDM body field (020-01 Finding, alloy@2.35.0 source + the Adobe
 * setConsent docs). `connectors/alloy/alloy-chamber.worker.js`'s boot glue
 * drives it (`configure -> setConsent(shapeAlloyConsent(vector)) ->
 * sendEvent`), right after `configure` succeeds and before the first
 * `sendEvent` — this module only SHAPES the vector, it never calls `alloy(…)`
 * itself (the chamber owns that call; this stays free of any `self`/worker/
 * command-fn reach, mirroring connectors/ga4/consent.js).
 *
 * `collect.val` is a SINGLE y/n switch — unlike GA4's MP `consent` object
 * (per-purpose GRANTED/DENIED, and a purpose can be OMITTED to signal "no
 * data-use signal at all" — 017-01's `shapeMpConsent`), alloy's switch has no
 * third "pending" state to delegate to. So EVERY collect-governing purpose
 * (connectors/alloy/connector.js's declared `purposes.egress`:
 * `analytics_storage` + `personalization`) must resolve "granted" for `val`
 * to be "y" — a denied OR pending purpose both fail-closed to "n" (the same
 * fail-closed posture as this slice's seam-side drop in
 * core/wrapped-sdk-host.js, AC1 — `setConsent` is the DELEGATE half, the seam
 * drop is the TRUSTED half; defense-in-depth, not a substitute for it).
 *
 * Reads ONLY the vendor-neutral core/consent.js resolver (connector -> core
 * is allowed; the reverse is not — test/core-boundary.test.js). Pure: no
 * DOM, no `self`, no alloy/command-fn reach.
 */
import { resolveConsent } from "../../core/consent.js";

/**
 * The ADR-0007 purposes that govern alloy's single `collect` consent switch
 * — mirrors connectors/alloy/connector.js's manifest `purposes.egress`.
 */
const COLLECT_PURPOSES = ["analytics_storage", "personalization"];

/**
 * Shape a host consent vector into alloy's `setConsent` command options.
 *
 * @param {Record<string, string>|null|undefined} vector the host-supplied
 *   ADR-0007 consent vector (core/consent.js's shape).
 * @returns {{ consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "y"|"n" } } }] }|undefined}
 *   the `setConsent` options alloy's command consumes; `val: "y"` iff EVERY
 *   COLLECT_PURPOSES entry resolves "granted" (`core/consent.js`'s
 *   `resolveConsent`), else `"n"` (fail-closed: a denied or pending purpose
 *   both yield "n" — there is no third state in alloy's switch). Returns
 *   `undefined` when NO vector is supplied at all (`null`/`undefined`) — the
 *   back-compat signal the chamber boot glue reads to SKIP driving
 *   `setConsent` entirely, leaving alloy's own `defaultConsent` (default
 *   `"in"`) window unaffected.
 */
export function shapeAlloyConsent(vector) {
  if (vector == null) return undefined;
  const granted = COLLECT_PURPOSES.every((purpose) => resolveConsent(vector, purpose) === "granted");
  return {
    consent: [
      {
        standard: "Adobe",
        version: "2.0",
        value: { collect: { val: granted ? "y" : "n" } },
      },
    ],
  };
}
