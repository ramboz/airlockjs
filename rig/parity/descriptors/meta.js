/**
 * The Meta Pixel per-vendor parity descriptor — spec 038-01 AC7 ("the Meta specifics ... live in
 * a per-vendor descriptor, not the pipeline"). Every Meta-specific fact the oracle needs is DATA
 * here; `rig/parity/oracle.js` reads it through the generic `ParityDescriptor` shape and has no
 * Meta-specific code at all (proven independently in test/parity-oracle.test.js by a second,
 * unrelated descriptor through the same `diffParity`).
 *
 * The reference field set is the CONTAINER's (documented Meta `/tr` params — `id`/`ev`, the
 * `cd[...]` event-data namespace, `_fbp`/`fbc`, `ud[...]`), never airlock's own `meta.js` config —
 * grounding it in the artifact under test would blind the oracle to exactly the fields airlock
 * drops (spec 038 § "The oracle", the frame-critique's central correction).
 *
 * THE cd[...] WIRE-FIDELITY GAP (spec 038-01 DoR, ADR-0020): Meta's documented `/tr` wire form
 * namespaces event data under `cd[...]` (`cd[value]`, `cd[currency]`, `cd[content_name]`,
 * `cd[content_category]`); airlock's `connectors/pixel/vendors/meta.js` emits the BARE names
 * (`value`, `currency`, …) instead (verified `meta.js:74-81`). Absent a live capture to confirm
 * Meta's endpoint accepts the bare spelling too, this descriptor does NOT reconcile the two via
 * `wireNameMap` — doing so would be a "map" of a spelling the vendor may never ingest, a false
 * pass the false-shim ADR-0020 forbids. Instead each `cd[...]` field is an OWNED gap-map entry
 * ("026 wire-fidelity") — reported, green, and flagged for the connector to fix, never silently
 * dropped and never falsely mapped. `026 wire-fidelity` deliberately does NOT edit
 * `connectors/pixel/vendors/meta.js` or `connectors/pixel/connector.js` — 026 is out of this
 * slice's scope.
 */
import { createMetaPixelConfig, META_TR_ENDPOINT } from "../../../connectors/pixel/vendors/meta.js";

// The reverse of meta.js's OWN eventMap (site event -> Meta event name), so the capture ->
// logical-event derivation below can never drift out of sync with the shipped connector config.
const { eventMap } = createMetaPixelConfig();
const REVERSE_EVENT_MAP = Object.fromEntries(Object.entries(eventMap).map(([site, vendor]) => [vendor, site]));

/** @type {import("../oracle").ParityDescriptor} */
export const metaParityDescriptor = {
  vendor: "meta",
  protocol: "same-protocol",
  endpoint: META_TR_ENDPOINT,

  // The container's CURATED, documented Meta /tr attribution-bearing field set — id/ev (routing
  // + attribution), the four documented cd[...] event-data params, first-party cookie identity
  // (_fbp/fbc), and hashed advanced-matching (ud[...]). NOT every wire field fbevents.js could
  // ever send — deliberately curated (spec 038-01 AC3).
  attributionFields: [
    "id",
    "ev",
    "cd[value]",
    "cd[currency]",
    "cd[content_name]",
    "cd[content_category]",
    "_fbp",
    "fbc",
    "ud[em]",
    "ud[ph]",
  ],

  // Nondeterministic + deterministic-non-attribution — excluded before the compare (AC3's literal
  // denylist: cache-buster, timestamp, rdp, v, dl). Query-param ORDERING needs no listed field —
  // the oracle diffs parsed field-sets, never raw query strings (rig/parity/oracle.js's header).
  normaliseDenylist: ["rdp", "v", "dl", "ts", "cb"],

  // The same-protocol descriptor's MINIMAL wire-name table (spec 038 "two descriptor kinds") —
  // empty for Meta. id/ev/_fbp/fbc/ud[...] are already 1:1 by name; the cd[...] namespace is
  // DELIBERATELY left untranslated (see the module doc comment above) and lives in gapMap instead.
  wireNameMap: {},

  // ADR-0020 commitment 1 — every dropped attribution field owned by a named closing artifact.
  gapMap: {
    "cd[value]": { owner: "026 wire-fidelity" },
    "cd[currency]": { owner: "026 wire-fidelity" },
    "cd[content_name]": { owner: "026 wire-fidelity" },
    "cd[content_category]": { owner: "026 wire-fidelity" },
    _fbp: { owner: "chamber cookie-capability follow-up" },
    fbc: { owner: "chamber cookie-capability follow-up" },
    "ud[em]": { owner: "026-04" },
    "ud[ph]": { owner: "026-04" },
  },

  /**
   * Capture -> logical-event derivation (AC2/AC7): reconstructs the airlock-shaped
   * `{type, params}` `createPixelConnector(...).handle()` consumes FROM a captured container
   * beacon's fields. A REPLAY-INPUT convenience only — it does NOT imply `cd[value]` "maps" to
   * `value` for the oracle's own diff (see `wireNameMap` above); it only answers "which event
   * should be replayed", using the reverse of meta.js's own `eventMap` so the two can never
   * silently drift apart.
   * @param {Readonly<Record<string,string>>} containerFields
   * @returns {{ type: string|null, params: Record<string,string> }}
   */
  deriveLogicalEvent(containerFields) {
    const type = REVERSE_EVENT_MAP[containerFields.ev] ?? null;
    const params = {};
    if (containerFields["cd[value]"] !== undefined) params.value = containerFields["cd[value]"];
    if (containerFields["cd[currency]"] !== undefined) params.currency = containerFields["cd[currency]"];
    if (containerFields["cd[content_name]"] !== undefined) params.content_name = containerFields["cd[content_name]"];
    if (containerFields["cd[content_category]"] !== undefined) {
      params.content_category = containerFields["cd[content_category]"];
    }
    return { type, params };
  },
};
