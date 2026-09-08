/**
 * The vendor-generic classified-diff + gap-map oracle — spec 038 "The oracle: one classified-
 * diff engine, two descriptor kinds" / ADR-0020. Pure, DI-testable: no imports, no I/O, no
 * vendor-specific code. Every vendor's specifics — which container fields matter, which are
 * nondeterministic/non-attribution noise, how a namespaced wire name translates (the
 * same-protocol descriptor's MINIMAL wire-name table), and which drops are OWNED gaps — are DATA
 * on the descriptor this module reads (AC7: a second vendor is a new descriptor, zero pipeline
 * change — see test/parity-oracle.test.js's "widgetco" proof).
 *
 * NEVER raw URL/query-string equality (ADR-0018 Rabbit Holes) — both field-sets are already-
 * parsed flat `{ [field]: string }` objects; comparing objects means query-parameter ORDERING is
 * structurally irrelevant (one of AC3's normalise-denylist concerns is handled by this shape
 * alone, not by a listed field name).
 *
 * @typedef {Object} GapMapEntry
 * @property {string} owner - the named artifact that closes this gap (ADR-0020 commitment 1),
 *   e.g. "026-04", "chamber cookie-capability follow-up", "026 wire-fidelity".
 *
 * @typedef {Object} ParityDescriptor
 * @property {string} vendor
 * @property {"same-protocol"|"semantic-field-map"} protocol
 * @property {readonly string[]} attributionFields - the container's CURATED attribution-bearing
 *   field set (grounded on a redacted capture + the vendor's documented params — never on
 *   airlock's own connector, which would blind the oracle to exactly what it drops). NOT every
 *   wire field the container's capture happens to carry.
 * @property {readonly string[]} normaliseDenylist - nondeterministic *and* deterministic-non-
 *   attribution container fields (cache-buster, timestamp, protocol version, …) excluded before
 *   the compare — reported as `normalised-out`, never silently omitted from the field list.
 * @property {Readonly<Record<string,string>>} wireNameMap - the same-protocol descriptor's
 *   MINIMAL wire-name translation: container field name -> airlock field name, for the (rare)
 *   case where a namespaced container field is legitimately reconcilable (the vendor accepts
 *   both spellings). Identity (`{}`) is the common case; a field the vendor does NOT confirm
 *   accepts both spellings must NEVER appear here — it belongs in `gapMap` instead (a "map" of a
 *   spelling the vendor won't ingest is a false pass, the false-shim ADR-0020 forbids).
 * @property {Readonly<Record<string, GapMapEntry>>} gapMap - attribution fields airlock is KNOWN
 *   to not (yet) emit, each owned by a named closing artifact (ADR-0020 commitment 1).
 * @property {string} [endpoint] - the vendor's beacon endpoint (report provenance; read by
 *   report.js). Part of the de-facto descriptor contract a new-vendor author must supply.
 * @property {(containerFields: Readonly<Record<string,string>>) => { type: string|null, params: Record<string,string> }} [deriveLogicalEvent] -
 *   the capture->logical-event derivation for the REPLAY half (AC2/AC7): reconstructs the airlock
 *   `{type, params}` `createPixelConnector(...).handle()` consumes from a captured container beacon.
 *   Same-protocol-scoped / replay-input only — it does NOT imply the derived params "map" for the
 *   oracle's own diff (that stays governed by `wireNameMap` + `gapMap`).
 */

/**
 * @typedef {Object} FieldVerdict
 * @property {string} field
 * @property {"maps"|"normalised-out"|"expected-dropped"|"gap-closed"|"dropped"|"divergent"} bucket
 * @property {string} [containerValue]
 * @property {string} [airlockValue]
 * @property {string} [owner] - present for expected-dropped/gap-closed (the gap map's owner)
 * @property {string} [flag] - present for gap-closed ("owner landed — remove from gap map")
 */

/**
 * The classified-diff + gap-map verdict over TWO already-parsed beacon field-sets (spec 038-01
 * AC2: the airlock side is SUBSTITUTABLE — normally replay output, but a hand-supplied field-set
 * is equally valid input, so the owners-landed case is testable without touching a connector).
 *
 * Only fields the descriptor curates (`attributionFields` + `normaliseDenylist`) are examined —
 * "over the container's curated attribution-bearing set, not every wire field" (AC3). A curated
 * field the container's OWN capture never sent is skipped entirely (neither a false `dropped`
 * nor a false `maps` — there is nothing to classify).
 *
 * Verdict: `pass` iff no field is `divergent` AND no field is `dropped` (a `dropped` bucket is
 * reached ONLY when the field is attribution-bearing, container-sent, absent from airlock's set,
 * and NOT in the gap map — a gap-map member absent from airlock's set is `expected-dropped`
 * instead, a distinct, green bucket). This is ADR-0020's contract verbatim.
 *
 * @param {Object} args
 * @param {ParityDescriptor} args.descriptor
 * @param {Readonly<Record<string,string>>} args.containerFields - the container's beacon
 *   field-set (from a redacted fixture).
 * @param {Readonly<Record<string,string>>} args.airlockFields - airlock's beacon field-set
 *   (replay output, or a supplied fixture — the oracle does not care which).
 * @returns {{ verdict: "pass"|"fail", fields: FieldVerdict[], counts: Record<string, number> }}
 */
export function diffParity({ descriptor, containerFields, airlockFields }) {
  const attributionFields = descriptor.attributionFields || [];
  const normaliseDenylist = descriptor.normaliseDenylist || [];
  const wireNameMap = descriptor.wireNameMap || {};
  const gapMap = descriptor.gapMap || {};

  /** @type {FieldVerdict[]} */
  const fields = [];
  const seen = new Set();

  for (const name of normaliseDenylist) {
    if (seen.has(name)) continue;
    seen.add(name);
    if (!Object.prototype.hasOwnProperty.call(containerFields, name)) continue; // this capture never sent it
    fields.push({ field: name, bucket: "normalised-out" });
  }

  for (const name of attributionFields) {
    if (seen.has(name)) continue;
    seen.add(name);
    if (!Object.prototype.hasOwnProperty.call(containerFields, name)) continue; // this capture never sent it — nothing to judge

    const containerValue = containerFields[name];
    const airlockName = wireNameMap[name] || name; // identity unless the descriptor names a minimal wire translation
    const hasAirlock = Object.prototype.hasOwnProperty.call(airlockFields, airlockName);
    const gap = gapMap[name];

    if (hasAirlock) {
      const airlockValue = airlockFields[airlockName];
      const equal = String(airlockValue) === String(containerValue);
      if (!equal) {
        // Present on both sides but unequal is ALWAYS divergent — landing a WRONG value is never
        // "gap-closed", regardless of gap-map membership (ADR-0020: "no divergent field", full stop).
        fields.push({ field: name, bucket: "divergent", containerValue, airlockValue });
      } else if (gap) {
        fields.push({
          field: name,
          bucket: "gap-closed",
          containerValue,
          airlockValue,
          owner: gap.owner,
          flag: "owner landed — remove from gap map",
        });
      } else {
        fields.push({ field: name, bucket: "maps", containerValue, airlockValue });
      }
    } else if (gap) {
      fields.push({ field: name, bucket: "expected-dropped", containerValue, owner: gap.owner });
    } else {
      fields.push({ field: name, bucket: "dropped", containerValue });
    }
  }

  const counts = {};
  for (const f of fields) counts[f.bucket] = (counts[f.bucket] || 0) + 1;

  const hasDivergent = fields.some((f) => f.bucket === "divergent");
  const hasRegression = fields.some((f) => f.bucket === "dropped");
  const verdict = hasDivergent || hasRegression ? "fail" : "pass";

  return { verdict, fields, counts };
}
