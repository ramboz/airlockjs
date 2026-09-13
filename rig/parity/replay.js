/**
 * Replay — spec 038-01 AC2. Runs airlock's OWN connector for a logical event and returns a flat
 * beacon field-set the oracle can diff, exactly as a real deployment would emit it.
 *
 * Vendor-generic: this module knows nothing about Meta, GA4, or any wire vocabulary — it
 * interprets whatever `Connector` a caller hands it (contracts/connector.d.ts's `handle()`
 * shape: `EgressRequest[]`, `[]` for an unmapped event — connectors/pixel/connector.js:149).
 * Parsing a GET beacon's query string into a flat object is generic URL parsing, not a per-vendor
 * concern — it belongs here, not in a descriptor (AC7's "no vendor-specific code in the pipeline").
 *
 * Reads (never edits — 026 is out of this slice's scope) `connectors/pixel/connector.js`'s
 * `createPixelConnector`.
 */
import { createPixelConnector } from "../../connectors/pixel/connector.js";

/**
 * Parse a beacon URL's query string into a flat `{ [param]: string }` field-set. Bracket-
 * namespaced keys (Meta's `cd[value]`, `ud[em]`) are ordinary literal key strings to
 * `URLSearchParams` — no special-casing needed. Last value wins on a duplicate key (no shipped
 * connector emits duplicates).
 * @param {string} url
 * @returns {Record<string,string>}
 */
export function fieldsFromUrl(url) {
  const { searchParams } = new URL(url);
  /** @type {Record<string,string>} */
  const fields = {};
  for (const [key, value] of searchParams.entries()) fields[key] = value;
  return fields;
}

/**
 * Parse a `;`-delimited MATRIX-URI beacon's PATH into a flat `{ [param]: string }` field-set — the
 * path-matrix SIBLING of `fieldsFromUrl` (spec 046-02). `URLSearchParams` cannot help here: the
 * params ride the URL PATH (`/activity;src=…;type=…`), not the query string, so `.searchParams` is
 * empty for these beacons. Splits `.pathname` on `;`, drops the base-path segment (`/activity`), and
 * `decodeURIComponent`s each `key=value` segment — the exact inverse of `core/path-matrix.js`'s
 * `appendMatrixParam`, so a value carrying an escaped `;`/`=` round-trips intact. A segment with no
 * `=` (a bare path element) is skipped, not mis-parsed as a param. Generic URL parsing, not a
 * per-vendor concern — it belongs here alongside `fieldsFromUrl`, not in a descriptor (AC7).
 * @param {string} url
 * @returns {Record<string,string>}
 */
export function fieldsFromMatrixUrl(url) {
  const { pathname } = new URL(url);
  /** @type {Record<string,string>} */
  const fields = {};
  const segments = pathname.split(";");
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) continue;
    const eq = seg.indexOf("=");
    if (eq === -1) continue; // a bare segment with no `=` — not a key=value param
    fields[decodeURIComponent(seg.slice(0, eq))] = decodeURIComponent(seg.slice(eq + 1));
  }
  return fields;
}

/**
 * Replay one logical event through a GET-pixel connector config and return airlock's beacon
 * field-set. `handle()` returning `[]` (an unmapped event) becomes `{ emitted: false, fields: {} }`
 * — a REPORTABLE result (AC2), never a thrown error and never silently treated as a pass (an
 * oracle fed `{}` classifies every attribution field as `dropped` unless gap-owned).
 * @param {import("../../contracts/pixel-connector").PixelVendorConfig} config
 * @param {import("../../contracts/connector").AirlockEvent} logicalEvent
 * @returns {{ emitted: boolean, fields: Record<string,string> }}
 */
export function replayPixelBeacon(config, logicalEvent) {
  const requests = createPixelConnector(config).handle(logicalEvent);
  if (!requests.length) return { emitted: false, fields: {} };
  return { emitted: true, fields: fieldsFromUrl(requests[0].url) };
}
