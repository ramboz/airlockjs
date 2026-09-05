/**
 * Personalization placement parsing — spec 033-03 AC2/AC5 (pure, lightweight).
 *
 * A connector-config → reserveSpace-spec parser SHARED by the two 033-03 sites that
 * must agree on the placement shape without either importing the other:
 *   - `adapters/eds/reserve-personalization.js` (the EAGER pre-paint reserve module,
 *     AD-8/UC-1) — must stay lightweight, so it imports THIS (which pulls in only the
 *     pure `VIEW_SCOPE`), never `eds.js`/`index.js` (the full runtime);
 *   - `adapters/eds/index.js`'s `validateConnectorEntry` — rejects a non-`__view__`
 *     placement scope (multi-scope is a named follow-on, AC5).
 *
 * SINGLE `__view__` PLACEMENT THIS SLICE (AC5): alloy's interact requests the
 * `__view__` scope by default (`connectors/alloy/connector.js` — `decisionScope=VIEW_SCOPE`;
 * `renderDecisions:false` with no `decisionScopes` in the request), so a non-`__view__`
 * placement would silently never populate — declaring one is rejected at validation.
 * Wiring `decisionScopes` into the interact + a multi-placement host-side map is the
 * follow-on (docs/refinement-todo.md).
 *
 * Pure + null-safe: no DOM, no `self`, no heavy imports — so the eager module that
 * imports it stays off the critical path (build.mjs asserts the emitted eager chunk
 * carries no `createAirlock`).
 */
import { VIEW_SCOPE } from "../../connectors/alloy/decisions.js";

export { VIEW_SCOPE };

/**
 * Extract + normalize the `__view__` placement's reserveSpace spec from a boot
 * config's alloy connector entry. Scans every `{type:"alloy"}` connector for the
 * FIRST `__view__` placement (single-placement slice scope). Returns `null` when
 * there is no alloy connector, no `placements`, or no `__view__` placement (a boot
 * with no personalization) — the eager reserve then reserves nothing.
 *
 * @param {{ connectors?: Array<{ type?: string, placements?: Array<object> }> } | null | undefined} config
 *   the boot(config) project config.
 * @returns {{ scope: string, selector: string, minHeight: number, prehide?: unknown, timeout?: unknown } | null}
 */
export function parseViewPlacement(config) {
  const connectors = config && Array.isArray(config.connectors) ? config.connectors : [];
  for (const entry of connectors) {
    if (!entry || entry.type !== "alloy" || !Array.isArray(entry.placements)) continue;
    const p = entry.placements.find((pl) => pl && pl.scope === VIEW_SCOPE);
    if (!p) continue;
    if (typeof p.selector !== "string" || !p.selector.trim()) return null;
    // minHeight passes through as-is (Number()) — reserveSpace's normalizeReserveSpec
    // validates it (finite >= 0) and REJECTS an invalid spec, so a mis-typed minHeight
    // becomes a dropped+diagnosed reserve, never a silent zero-height box.
    const spec = { scope: VIEW_SCOPE, selector: p.selector.trim(), minHeight: Number(p.minHeight) };
    if (p.prehide !== undefined) spec.prehide = p.prehide;
    if (p.timeout !== undefined) spec.timeout = p.timeout;
    return spec;
  }
  return null;
}
