/**
 * The GA4 parity report — spec 038-02 AC5. Wraps 038-01's generic `buildParityReport`
 * (`rig/parity/report.js`, REUSED UNMODIFIED per this slice's scope) and adds the GA4-specific
 * SESSION-CONTINUITY RESIDUAL NOTE: a single `/g/collect` capture's `sid` may classify `maps`
 * (AC1's shared-cookie sourcing) even though MP-only mints a FRESH `session_id` on the NEXT page
 * it has no cookie to persist across (OQ13-2) — the loss is ACROSS pages, invisible to a
 * single-beacon field-diff, exactly like 038-01's `fr` residual. So cross-page continuity is a
 * scope RESIDUAL (owned by ADR-0020 / spec 039 — the future gtag connector becomes the
 * `_ga_<stream>` writer), surfaced here as a REPORT NOTE, never asserted as a green `sid` "maps"
 * claim of full parity and never forced red (AC5).
 */
import { buildParityReport } from "./report.js";

export const GA4_SESSION_CONTINUITY_RESIDUAL_NOTE =
  "Session continuity is a SCOPE RESIDUAL, not a per-field bucket (spec 038-02 AC5): a single " +
  "/g/collect capture's `sid` may classify `maps` (airlock and the container read the same " +
  "_ga_<stream> cookie) even though MP-only mints a FRESH session_id on the next page, which it " +
  "has no cookie to persist across (OQ13-2) -- the loss is ACROSS pages, invisible to a " +
  "single-beacon field-diff. Owned by ADR-0020 / spec 039 (the gtag connector becomes the " +
  "_ga_<stream> writer) -- never a claim of full cross-page session parity here.";

/**
 * @param {Parameters<typeof buildParityReport>[0]} args
 * @returns {ReturnType<typeof buildParityReport> & { session_continuity_residual: string }}
 */
export function buildGa4ParityReport(args) {
  const report = buildParityReport(args);
  return { ...report, session_continuity_residual: GA4_SESSION_CONTINUITY_RESIDUAL_NOTE };
}
