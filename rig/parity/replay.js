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
