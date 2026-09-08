/**
 * The parity report — spec 038-01 AC5. Assembles the classified diff (rig/parity/oracle.js) into
 * a JSON verdict card, mirroring `rig/lh-r010.mjs`'s report shape (a `question`, the echoed
 * config/fixture identity, the measured/classified detail, and an honest note). No live
 * identifiers appear in the output beyond whatever the (already-redacted) input field-sets carry.
 */
import { diffParity } from "./oracle.js";

const SCOPE_NOTE =
  "Beacon-FIELD parity only (ADR-0020 scope residual): a `pass` here means no attribution-bearing " +
  "field diverged and no field was dropped OUTSIDE the descriptor's gap map — it is NOT a full " +
  "vendor-parity claim. The vendor's cross-site transport cookie is invisible to this oracle " +
  "(owned by ADR-0020 / E10, surfaced by spec 038-03). A `gap-closed` field means an owner landed — " +
  "remove it from the descriptor's gap map.";

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
 *   verdict: "pass"|"fail", note: string,
 * }}
 */
export function buildParityReport({ descriptor, fixture = null, containerFields, airlockFields, emitted }) {
  const diff = diffParity({ descriptor, containerFields, airlockFields });
  return {
    question:
      `does airlock's ${descriptor.vendor} beacon carry the same attribution-bearing fields as the ` +
      "container's — no divergent field, no field dropped outside the declared gap map?",
    vendor: descriptor.vendor,
    protocol: descriptor.protocol,
    endpoint: descriptor.endpoint,
    fixture,
    airlock_emitted: emitted !== false,
    fields: diff.fields,
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
