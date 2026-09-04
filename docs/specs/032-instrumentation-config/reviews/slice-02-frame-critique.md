---
slice: 032-02 — the config contract (validated JSON Schema, pre-1.0) + breadth + the few-lines-instrument story
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-04T23:12:37Z
prompt_source: review.py frame-critique docs/specs/032-instrumentation-config/spec.md 032-02 <slice>
---

VERDICT: pass (after one needs-changes → revision cycle)

## Assessment (independent frame-critique, jig:reviewer)

Both the primary finding and the two secondary notes are genuinely closed.

## Finding (PRIMARY) — the alloy "wire XOR defer cleanly" false binary → FIXED
alloy has no adapter boot (hosted only via `core/wrapped-sdk-host.js` + `connectors/alloy/*`; `handle` returns `[]`;
rig/test only), so `{type:"alloy"}` is a spike-sized first-ever adapter boot, out of 032's `createAirlock`-shaped
scope; and a bare "defer" silently ships a config surface missing Adobe/alloy — half of MVP6's named "GA4 +
Adobe/alloy" supported subset. **Addressed:** AC3 is reframed to breadth-over-the-adapter-supported-set (ga4, pixel
vendors, helix-rum) + alloy as a **decided deferral to its own spec**, with the coverage gap stated plainly in the
Goal, Assumptions, AC3, spec.md, and `docs/refinement-todo.md` (with an mvp6.md citation + a two-part resolution
trigger).

## Secondary notes → FIXED
- **ajv-in-bundle:** AC2 names the mechanism — a lightweight hand-rolled runtime validator (a documented SUBSET of
  the schema), with a "no `ajv` in `dist/`" build/import assertion as the observable; the JSON Schema is the pinned
  reference (ajv in `contracts/`, dev-only).
- **schema shape:** AC1/Assumptions scope it as the discriminated union it is (`type` → ga4/pixel/helix-rum; nested
  `vendor` under pixel; helix-rum's governance-free shape) via `oneOf`/`if-then` — pinnable pre-1.0, distinct from
  the deferred routing work.

## Reconciliation note (carry to implementation/reconcile)
AC3/AC4 require the coverage-gap statement to land in the **README + schema** at implementation time — reconciliation
should confirm those two surfaces actually carry it (not just spec/refinement-todo), since the "instrument in a few
lines" story (AC4) is where an adopter would otherwise assume Adobe/alloy is covered. (The frontmatter `frame_review`
comment was also updated to match the decided-deferral frame.)

Reviewer: jig:reviewer (independent). Pre-implementation frame gate; frame_review: true. Recovery: needs-changes →
revision → re-run → pass.
