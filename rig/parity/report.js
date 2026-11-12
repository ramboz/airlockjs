/**
 * The parity report — spec 038-01 AC5. Assembles the classified diff (rig/parity/oracle.js) into
 * a JSON verdict card, mirroring `rig/lh-r010.mjs`'s report shape (a `question`, the echoed
 * config/fixture identity, the measured/classified detail, and an honest note). Recognized Meta
 * identity values are sanitized after comparison; other values require review before sharing.
 */
import { diffParity } from "./oracle.js";

const SCOPE_NOTE =
  "Beacon-FIELD parity only (ADR-0020 scope residual): a `pass` here means no attribution-bearing " +
  "field diverged, was unverifiable or was dropped OUTSIDE the descriptor's gap map — it is NOT a full " +
  "vendor-parity claim. The vendor's cross-site transport cookie is invisible to this oracle " +
  "(owned by ADR-0020 / E10, surfaced by spec 038-03). A `gap-closed` field matches the supplied " +
  "values and flags an owner for follow-up; equal redaction placeholders do not prove identity equality.";

/**
 * @param {Object} args
 * @param {import("./oracle").ParityDescriptor} args.descriptor
 * @param {string|null} [args.fixture] - the fixture path/identity this report was built from (echoed for provenance, never its contents).
 * @param {Readonly<Record<string,string>>} args.containerFields
 * @param {Readonly<Record<string,string>>} args.airlockFields
 * @param {boolean} [args.emitted] - whether replay produced a beacon at all (false = airlock emitted nothing for this event — reportable, AC2).
 * @returns {{
 *   question: string, vendor: string, protocol: string, endpoint: string|undefined,
 *   fixture: string|null, airlock_emitted: boolean, fields: import("./oracle").FieldVerdict[],
 *   counts: Record<string, number>, gap_map: Record<string, {owner: string}>,
 *   verdict: "pass"|"fail"|"inconclusive", note: string,
 * }}
 */
export function buildParityReport({ descriptor, fixture = null, containerFields, airlockFields, emitted }) {
  const diff = diffParity({ descriptor, containerFields, airlockFields });
  const fields = diff.fields.map((field) => {
    if (!descriptor.redactReportField) return field;
    const result = { ...field };
    if (Object.hasOwn(result, "containerValue")) {
      result.containerValue = descriptor.redactReportField(field.field, result.containerValue);
    }
    if (Object.hasOwn(result, "airlockValue")) {
      const name = descriptor.wireNameMap?.[field.field] || field.field;
      result.airlockValue = descriptor.redactReportField(name, result.airlockValue);
    }
    return result;
  });
  return {
    question:
      `does airlock's ${descriptor.vendor} beacon carry the same attribution-bearing fields as the ` +
      "container's — no divergent field, no field dropped outside the declared gap map?",
    vendor: descriptor.vendor,
    protocol: descriptor.protocol,
    endpoint: descriptor.endpoint,
    fixture,
    airlock_emitted: emitted !== false,
    fields,
    counts: diff.counts,
    gap_map: descriptor.gapMap,
    verdict: diff.verdict,
    note: SCOPE_NOTE,
  };
}

/** `pass` -> 0, anything else -> 1 (spec 038-01 AC6: the CLI's process exit code). */
export function verdictExitCode(report) {
  return report.verdict === "pass" ? 0 : 1;
}
