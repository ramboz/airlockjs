---
status: READY_FOR_IMPLEMENTATION
dependencies: [067-01]
last_verified: 2026-11-13
---

## Slice 067-04: Default egress allowlist is the stock destination set

**Goal:** Each connector's default endpoint ceiling covers every destination its stock tag contacts, so stock traffic is not blocked. Egress stays mediated, and a site narrows the ceiling. This slice ships the shared mechanism. Each vendor's real destination list arrives with its inventory slices.

**DoR:**
- ✅ ADR-0062 point 7 and its Owner answer 3. ADR-0006 and ADR-0011 mechanisms stand.
- Ground first (spec 067 section 2): the ceiling is built from the connector's declared `endpoints` and gated on `ceiling.length`. List where the ceiling is built (`core/airlock.js:164-185`, the wrapped-SDK host, the coalescer re-check at `:569-574`) so the new source is wired once.

**Acceptance Criteria:**

1. A connector manifest can declare its stock destination set (the frozen inventory list) separately from any site narrowing. The default ceiling is that set, in origin+path form, with the existing `;` prefix mode where the stock path carries a matrix segment.
2. A site narrows the ceiling with explicit config (a subset of the stock set, or an explicit allowlist). The narrowing is its own tested state, not the baseline.
3. A destination outside the stock set stays held at the seal (fail closed), with the existing `endpoint-ceiling` diagnostic. A site cannot widen the ceiling past the stock set through chamber input (ADR-0006: the ceiling is reduced once from the host's own declaration).
4. The default is not empty: a connector that declares a stock set never falls back to "no ceiling" because a site declared nothing. A test pins this.
5. The same ceiling covers the flush path and the coalescer re-check, as today.
6. A test vendor connector (fixture list with two origins and one matrix path) proves a stock destination sends by default and a non-stock destination is held. Real vendor lists are not added here.
7. Tests cover the stock-default path and the narrowed opt-in as separate states.

**DoD:**
- `npm test && npm run lint` and the servo quality-gate pass.

**Consumers:** Adobe 064-18 (AC5) and 064-19 onward (vendor-adobe); Google G12; Meta M9 and the D1 row.

**Anti-horizontal-phasing check:** Vertical: manifest field, ceiling build, narrowing option and a held and a sent beacon in the rig.
