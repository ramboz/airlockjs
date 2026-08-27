---
status: DRAFT
dependencies: []
last_verified:
arch_review: true
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): factual claims about runnable
     surfaces are probe-backed or marked as assumptions in spec.md. -->

## Slice 007-03 — `cwv_budget` oracle component + resolve OQ6 (flicker routing)

**Goal:** Pin the `cwv_budget` thresholds from the spike's measured numbers and
wire the existing rigs (Lighthouse before/after, INP-under-storm, drain-stage
delivery) as a **jig-supervised** oracle component; and resolve OQ6 by
recording that the structural no-flicker invariant is automated while the
perceptual half stays human-reviewed. This is the weakest oracle (statistical,
rIC-protected, widest proxy-gap) — it is deliberately **not** promoted to a
servo-unattended gate.

**DoR:**
- ✅ `/servo:scaffold-init` has run (spec.md A1).
- ✅ The rigs run locally: `npm run lh:eds` (before/after Lighthouse),
  `npm run rig` (INP-under-storm), `npm run rig:teardown` (delivery), and
  `npm run rig:uc1` (structural flicker invariant).
- ✅ Spec 003 Findings are re-confirmed on the current tree (spec.md A4).

**Acceptance Criteria:**

1. **Thresholds are pinned as explicit, checkable budgets.** The component
   encodes concrete budgets derived from the spike (spec 003 Findings), each
   with headroom over the measured number and far under the naive baseline:
   - **TBT** before/after delta ≤ **50 ms** (spike measured 0).
   - **CLS** ≤ **0.01** (spike measured 0).
   - **INP p75** under the interaction storm ≤ **50 ms** (spike measured
     8 ms worker path; naive stack was ~152 ms).
   - **Delivery-rate** under storm ≥ **99%** at the drain stage, and the
     last-beacon fast path + ring-tail flush deliver their full count
     (spike: 300/300 drain, 5/5 `pushCritical`, 50/50 ring-tail).

   Observable: the component reads the rig outputs and reports each metric
   against its pinned budget. The exact pinned values are recorded as a
   lightweight decision (or folded into the OQ6 ADR).
2. **The component is routed jig-supervised, not servo-unattended.** It is
   registered in `oracle.sh` / `.servo/` as an **advisory** (non-gating for the
   servo-unattended loop) measurement surface — its statistical, rIC-protected
   nature means a threshold miss surfaces for human judgment rather than
   auto-failing a variant race. Observable: `oracle.sh` classifies it as
   supervised; `/servo:edd-suitability` does not mark the CWV route
   EDD-suitable.
3. **OQ6 is resolved and recorded.** The structural no-flicker invariant
   ([rig/uc1.mjs](../../../rig/uc1.mjs): exp-applied before `body:appear`, both
   arms) is confirmed automated and wired; the **perceptual** half (screenshot
   diff) is recorded as **human-reviewed, not servo-unattended**. Because this
   is a boundary/routing decision with a rejected alternative (auto-gate the
   perceptual diff), it is captured in an **ADR** and `refinement-todo.md`
   OQ6 is marked RESOLVED with a link.

**DoD:**
- [ ] All ACs pass; rigs run green on the current tree; `npm test` green.
- [ ] The budget check is shown to flip red on a seeded over-budget input
      (e.g. an injected CLS regression), then restored (capable of failing).
- [ ] OQ6 ADR authored and accepted; `refinement-todo.md` OQ6 → RESOLVED.
- [ ] Reviewed by `reviewer` subagent (compliance + craft; arch pass, since
      `arch_review: true`).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] `docs/refinement-todo.md` updated (OQ6 resolution + any new deferral).

**Anti-horizontal-phasing check:** After this slice, the before/after CWV
scoreboard — the demo's "punchline" — is a pinned, runnable measurement surface
with explicit budgets, and the project's position on flicker oracle strength is
recorded rather than left as an open question.

### Deviation log (after reconciliation)

_TBD at reconciliation._

### Reconciliation sweep

_TBD at reconciliation — regenerate the sweep table from the slice template._
