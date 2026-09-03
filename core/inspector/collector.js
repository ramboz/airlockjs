// The enforcement-decision inspector's collector — spec 028-01 (MVP5 fixed core).
//
// A bounded, in-memory READ-LAYER over the existing 009-02 diagnostic stream.
// MVP3/MVP4 already emit every enforcement decision as a structured record
// `{ level, kind, disposition, ...context }` through an injectable `onDiagnostic`
// seam; this module captures those records into a queryable ring buffer so a
// developer can ask "why did this beacon fire / hold at the seal / get gated /
// get stripped" instead of scrolling console output. Zero NEW instrumentation.
//
// THREE SEAMS, ONE COLLECTOR (frame-critique correction, 2026-09-03). `onDiagnostic`
// is a SEPARATE injectable on three main-thread constructors, each with its own
// emit sites — `createAirlock` (core/airlock.js: consent / endpoint-ceiling /
// payload-governance / dropped / chamber-error), `createWrappedSdkHost`
// (core/wrapped-sdk-host.js: consent / endpoint-ceiling / payload-governance and,
// CRITICALLY, config-integrity — which emits from NOWHERE else), and
// `createDomApplyCoordinator` (adapters/eds/dom-apply.js: the dom-apply-* family).
// Wire ONE collector instance's `onDiagnostic` as the sink on ALL THREE, or the
// inspector is blind to whole classes of decision (a createAirlock-only wiring
// never sees config-integrity or the alloy/wrapped-SDK path — worse than the
// console baseline). See docs/specs/028-enforcement-inspector/.
//
// INP-safe by construction: the collector is ONLY ever reached through
// `onDiagnostic` (an enforcement-decision path), never from capture / push() /
// the projection fold. Insert is O(1) (fixed ring, overwrite-oldest) so even a
// storm of held beacons cannot make the tap the bottleneck.

const DEFAULT_CAPACITY = 500;

/**
 * @param {{ capacity?: number }} [opts] - ring capacity (drop-oldest); default 500.
 * @returns {{
 *   onDiagnostic: (record: { level?: string, kind?: string, disposition?: string, [k: string]: unknown }) => void,
 *   query: (filter?: { kind?: string, disposition?: string, purpose?: string, beaconId?: string }) => object[],
 *   size: () => number,
 *   clear: () => void,
 *   capacity: number,
 * }}
 */
export function createInspectorCollector({ capacity = DEFAULT_CAPACITY } = {}) {
  const cap = Number.isInteger(capacity) && capacity > 0 ? capacity : DEFAULT_CAPACITY;
  const ring = new Array(cap);
  let count = 0; // total records ever accepted (monotonic)
  let head = 0; // next write index

  // The single sink. Pass THIS as `onDiagnostic` to createAirlock,
  // createWrappedSdkHost, AND createDomApplyCoordinator. Stores the record
  // as-received — the emit site already redacted it (a payload-governance record
  // carries the field NAME, never the value); the collector NEVER widens it, so
  // no PII is amplified. A shallow copy freezes the row against a later caller
  // mutating the same object reference. Never throws into an emit site (a
  // non-object record is ignored) — a diagnostics tap must not crash the runtime.
  //
  // FLAT-RECORD INVARIANT (deliberate — 028-01 craft review): the shallow copy is
  // sufficient because EVERY 009-02 record is flat — its values are primitives
  // (`level`/`kind`/`disposition`/`purpose`/`reason`/`destination`/`field`/`type`/
  // `index`/`message`/`op`/`id`/`parentId`/`childId`/`beaconId`, all string|number).
  // No emit site stores a nested object/array, so there is no shared reference to
  // leak across the buffer or a query result. If a future emit site adds a
  // nested-value record, this must become a deep copy/freeze on write (tracked:
  // inbox). `beaconId` (028-02) is a collector-unique `<instanceTag>#<local>` string.
  function onDiagnostic(record) {
    if (!record || typeof record !== "object") return;
    ring[head] = { ...record };
    head = (head + 1) % cap;
    count += 1;
  }

  // Records in emission order (oldest surviving → newest).
  function inOrder() {
    const n = count < cap ? count : cap;
    const start = count <= cap ? 0 : head; // once wrapped, the oldest survivor sits at `head`
    const out = [];
    for (let i = 0; i < n; i += 1) out.push(ring[(start + i) % cap]);
    return out;
  }

  // Read-layer query: filter by kind / disposition / purpose (AND), in emission
  // order, returned as COPIES (a caller mutating a result cannot corrupt the buffer).
  function query(filter = {}) {
    const f = filter || {};
    return inOrder()
      .filter(
        (r) =>
          r &&
          (f.kind === undefined || r.kind === f.kind) &&
          (f.disposition === undefined || r.disposition === f.disposition) &&
          (f.purpose === undefined || r.purpose === f.purpose) &&
          (f.beaconId === undefined || r.beaconId === f.beaconId), // 028-02: reconstruct a beacon's chain
      )
      .map((r) => ({ ...r }));
  }

  return {
    onDiagnostic,
    query,
    size: () => (count < cap ? count : cap),
    clear: () => {
      count = 0;
      head = 0;
      ring.fill(undefined);
    },
    capacity: cap,
  };
}
