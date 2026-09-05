---
status: DRAFT
dependencies: [033-02, 034-01]
last_verified:
arch_review: true  # extends the interact request shape + the public config placements surface to N scopes.
frame_review: true  # rests on the decisionScopes request-wiring being correct (033-03 deferred it unproven).
---

<!-- jig self-defining vocabulary (soft, forward-only). jig grounding (064-02/ADR-0020): probe/cite or mark assumptions. -->

## Slice 034-02 — multi-scope personalization: `decisionScopes` + N placements

**Goal:** extend 033-03's **single `__view__` placement** to **N placement scopes**. 033-03 rejected a non-`__view__`
placement at validation because alloy's interact requests only `__view__` by default (`connectors/alloy/connector.js`
`sendEvent` sends no `decisionScopes`), so a declared non-`__view__` scope would silently never populate. This slice
wires `decisionScopes` into the interact (so alloy fetches every declared scope), maps each returned decision to its
placement **host-side** by scope, and opens the schema + `reservePersonalization` to N placements.

**DoR:**
- ✅ 033-03 landed (single-`__view__` placement, the eager reserve + fill + exposure path, the scope→placement seam).
- ✅ 034-01 landed (consent-conditional interact) — multi-scope requests ride the same consent-gated interact.
- ✅ Grounded (033-03): `extractDecisions(result,{scope:null})` returns every scope present; the connector filters to a
  single `decisionScope` today; `reservePersonalization` reserves one `__view__` box; the schema allows one `__view__`
  placement (non-`__view__` rejected).

**Acceptance Criteria (provisional — ratified/refined at this slice's frame-critique):**

1. **`decisionScopes` on the interact.** The connector's `sendEvent` requests **all configured placement scopes** (the
   set derived from `placements[].scope`), so non-`__view__` scopes are actually fetched — not just `__view__`.
2. **Host-side scope→placement map.** The adapter delivers **all scopes** (`extractDecisions(result,{scope:null})`)
   and fills each decision's placement by matching `scope` → the reserved box (per 033-03's recorded design). A scope
   with no configured placement, or a placement with no returned decision, is dropped/revealed benignly (033-03 rules).
3. **Schema opens to N placements.** `contracts/instrumentation-config.schema.json` allows multiple `placements`
   entries with arbitrary (non-`__view__`) scopes; the 033-03 single-`__view__` restriction + non-`__view__` rejection
   is lifted (+ golden fixture with 2 scopes). `minHeight`/selector validation (034/033) still applies per placement.
4. **Eager reserve of N boxes.** `reservePersonalization` reserves each configured placement box (pre-paint) + hands
   off the N handles; the lazy fill maps by scope. The no-flicker invariant (reserve<appear) holds for every box.
5. **End-to-end proof.** A config with 2 placements (`__view__` + a named scope) → both scopes fetched (one interact
   with `decisionScopes`) → both boxes filled by scope → both exposures reported. Reuse/extend the 033-03 rig.

**DoD:** all ACs pass; TDD red→green; reviewed (compliance + craft + **arch** + **frame-critique**); deviation log +
reconciliation sweep; reconciliation review; `docs/refinement-todo.md` multi-scope follow-on **closed**; board synced.
