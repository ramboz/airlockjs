---
status: READY_FOR_REVIEW
dependencies: []
last_verified:
arch_review: true
frame_review: true
claimed_by: claude/airlock-servo-oracle-ci-6b13d9
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

1. **Thresholds are pinned as explicit, checkable budgets — INP as a DELTA, not
   an absolute** (07-03 frame-critique). The component encodes concrete budgets
   derived from the spike (spec 003 Findings):
   - **TBT** before/after delta ≤ **50 ms** (spike measured 0). *(A delta by
     construction — before vs after on the same run.)*
   - **CLS** ≤ **0.01** (spike measured 0). *(Layout stability is not
     hardware-variance-prone the way timing is.)*
   - **INP p75** budgeted as a **cross-invocation, sampled delta vs the
     rIC-deferred control** — *not* an absolute, and not (per 07-03 re-review) a
     same-run measurement, because [rig/measure.mjs](../../../rig/measure.mjs)
     runs **one `MODE` per invocation** (one browser, one page) and has no
     same-run control+worker pair. The budget is: `INP_p75(worker) −
     INP_p75(rIC-control)` must not exceed a pinned margin, where each side is
     the **median of N runs** (N ≥ 3) of `measure.mjs` under its `MODE`, and the
     margin is a **tolerance band** (not a point value) sized to swamp
     cross-invocation noise (thermal/GC/scheduling between browser launches).
     Spike anchor: worker 8 ms ties the competent rIC baseline; naive stack
     ~152 ms. **No absolute INP threshold is pinned** — spec 003 declares
     absolute INP machine-dependent and only the delta load-bearing
     (003/spec.md:56-57, R-005). This needs a small pairing wrapper (run both
     modes ×N, extract both p75s, compute the delta) that the slice must build —
     `measure.mjs` alone does not emit the pair. Proportionate because
     `cwv_budget` is **advisory** (AC2), not a servo-unattended gate, so the
     sampling need not be gating-grade — it must only be honest about being a
     noisy cross-run signal a human reads.
   - **Delivery-rate** ≥ **99% at the DRAIN stage** under storm (spike: 300/300),
     plus the last-beacon fast path + ring-tail flush delivering full count
     (5/5 `pushCritical`, 50/50 ring-tail). **Deliberately drain-stage-scoped,
     not end-to-end** — the still-open teardown/unload loss (OQ10, R-001) is
     out of this budget's scope; reconciliation must not "fix" this into an
     end-to-end delivery budget.

   Observable: the component reads the rig outputs and reports each metric
   against its pinned budget/delta. The exact pinned values + the INP margin are
   recorded in the oracle-design ADR (AC3).
2. **The component is routed jig-supervised, not servo-unattended.** Because
   every `COMPONENTS` entry in the Tier-0 [oracle.sh](../../../oracle.sh) feeds
   the *gating* composite (spec.md A1), `cwv_budget` is **deliberately NOT added
   to `COMPONENTS`**. Instead it runs as a **separate advisory invocation** (its
   own script — e.g. `bash cwv-budget.sh` or an `oracle.sh --advisory`-style
   entry point that reports but never feeds the gating composite), so a
   statistical, rIC-protected threshold miss surfaces for human judgment rather
   than auto-failing a servo-unattended variant race. Observable: `bash
   oracle.sh`'s gating verdict is unchanged whether `cwv_budget` passes or
   misses; `/servo:edd-suitability` does not mark the CWV route EDD-suitable.
3. **The oracle-design ADR is authored, recording three decisions.** One ADR
   captures the load-bearing oracle-design choices this spec settled, each with
   its rejected alternative (so a future agent does not undo them):
   - **OQ6 / flicker routing** — the structural no-flicker invariant
     ([rig/uc1.mjs](../../../rig/uc1.mjs): exp-applied before `body:appear`,
     both arms) is automated and gates in browser CI; the **perceptual** half
     (screenshot diff) stays **human-reviewed, not servo-unattended** (rejected:
     auto-gate the perceptual diff). `refinement-todo.md` OQ6 → RESOLVED.
   - **AND-gate** — the servo-unattended composite runs at `THRESHOLD=1.0` over
     binary components (rejected: the default soft weighted mean, which dilutes
     a hard gate — 07-01 frame-critique). Resolves the servo `refinement-todo`
     Threshold deferral.
   - **Isolation reclassification** — `isolation_invariant` is a real-Worker
     browser-CI check, not a hermetic `COMPONENTS` entry (rejected: a Node
     vitest test, which is vacuous — 07-02 frame-critique).

**DoD:**
- [ ] All ACs pass; rigs run green on the current tree; `npm test` green.
- [ ] The budget check is shown to flip red on a seeded over-budget input
      (e.g. an injected CLS regression) **and** on a seeded INP-delta regression,
      then restored (capable of failing on the delta, not just absolutes).
- [ ] Oracle-design ADR authored and accepted; `refinement-todo.md` OQ6 →
      RESOLVED and the servo `refinement-todo` Threshold entry → RESOLVED.
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
