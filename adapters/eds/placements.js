/**
 * Personalization placement parsing — spec 033-03 AC2 + spec 034-02 AC3/AC4
 * (pure, lightweight).
 *
 * A connector-config → reserveSpace-spec parser SHARED by the two sites that must
 * agree on the placement shape without either importing the other:
 *   - `adapters/eds/reserve-personalization.js` (the EAGER pre-paint reserve module,
 *     AD-8/UC-1) — must stay lightweight, so it imports THIS (which pulls in only the
 *     pure `VIEW_SCOPE`), never `eds.js`/`index.js` (the full runtime);
 *   - `adapters/eds/index.js`'s `validateConnectorEntry` — the loud, connector-indexed
 *     rejection of a duplicate scope (`firstDuplicateScope`).
 *
 * MULTI-SCOPE (spec 034-02): a boot may declare N placements of ARBITRARY scopes
 * (not just `__view__`). The connector now carries the declared scopes on the
 * interact (`decisionScopes`, `connectors/alloy/connector.js`) so alloy fetches
 * every one, and the host maps each returned decision to its box BY SCOPE. Because
 * BOTH the eager reserved map and the lazy deliver map are keyed by `scope`, two
 * placements sharing a scope would silently collapse last-wins — so a DUPLICATE scope
 * is REJECTED at validation (`firstDuplicateScope` + the loud throw in
 * `validateConnectorEntry`), never silently dropped.
 *
 * Pure + null-safe: no DOM, no `self`, no heavy imports — so the eager module that
 * imports it stays off the critical path (build.mjs asserts the emitted eager chunk
 * carries no `createAirlock`).
 */
import { VIEW_SCOPE } from "../../connectors/alloy/decisions.js";

export { VIEW_SCOPE };

/**
 * Parse the alloy connector's `placements` into an ordered array of reserveSpace
 * specs — one per placement, ANY scope (spec 034-02). Scans every `{type:"alloy"}`
 * connector and returns the FIRST alloy connector's placements. Returns `[]` when
 * there is no alloy connector, no `placements`, or none are well-formed enough to
 * reserve (a boot with no personalization) — the eager reserve then reserves nothing.
 *
 * TOLERANT by design (this runs in the eager window, whose contract is "never throws
 * synchronously"): a placement with a non-string/blank scope or selector is SKIPPED
 * here — the lazy `validateConnectorEntry` rejects it LOUDLY at boot. Duplicate scopes
 * are NOT collapsed here either; `firstDuplicateScope` + the loud boot rejection own
 * that (the eager reserve defers to it — see reserve-personalization.js).
 *
 * @param {{ connectors?: Array<{ type?: string, placements?: Array<object> }> } | null | undefined} config
 *   the boot(config) project config.
 * @returns {Array<{ scope: string, selector: string, minHeight: number, prehide?: unknown, timeout?: unknown }>}
 */
export function parsePlacements(config) {
  const connectors = config && Array.isArray(config.connectors) ? config.connectors : [];
  for (const entry of connectors) {
    if (!entry || entry.type !== "alloy" || !Array.isArray(entry.placements)) continue;
    const specs = [];
    for (const p of entry.placements) {
      if (!p || typeof p !== "object") continue;
      if (typeof p.scope !== "string" || !p.scope.trim()) continue;
      if (typeof p.selector !== "string" || !p.selector.trim()) continue;
      // minHeight passes through as-is (Number()) — reserveSpace's normalizeReserveSpec
      // validates it (finite >= 0) and REJECTS an invalid spec, so a mis-typed minHeight
      // becomes a dropped+diagnosed reserve, never a silent zero-height box.
      const spec = { scope: p.scope.trim(), selector: p.selector.trim(), minHeight: Number(p.minHeight) };
      if (p.prehide !== undefined) spec.prehide = p.prehide;
      if (p.timeout !== undefined) spec.timeout = p.timeout;
      specs.push(spec);
    }
    return specs; // the first alloy connector's placements (single-alloy boot the norm)
  }
  return [];
}

/**
 * The first `scope` that appears more than once across `items`, or `null` when every
 * scope is distinct. Pure + null-safe. The duplicate-scope guard SHARED by the eager
 * reserve (which defers to the boot rejection) and `validateConnectorEntry` (which
 * throws loudly, connector-indexed). Items without a string `scope` are ignored.
 *
 * @param {ReadonlyArray<{ scope?: unknown }> | null | undefined} items
 * @returns {string | null}
 */
export function firstDuplicateScope(items) {
  const seen = new Set();
  for (const it of Array.isArray(items) ? items : []) {
    const scope = it && typeof it.scope === "string" ? it.scope : null;
    if (scope == null) continue;
    if (seen.has(scope)) return scope;
    seen.add(scope);
  }
  return null;
}
