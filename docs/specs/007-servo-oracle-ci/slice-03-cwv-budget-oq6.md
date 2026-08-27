---
status: RECONCILED
dependencies: []
last_verified: 2026-08-27
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
- [x] All ACs pass; `npm run cwv:budget` exits 0 on the current tree
      (TBT/CLS/INP-delta/delivery all within budget); `npm test` green (119).
- [x] The budget check flips red on a seeded CLS regression (`+0.05` → exit 1)
      **and** on a seeded INP-delta regression (worker `+100ms` → exit 1), then
      restored (capable of failing on the delta, not just absolutes).
- [x] Oracle-design ADR authored + accepted (ADR-0005); `refinement-todo.md`
      OQ6 → RESOLVED; servo `.servo/refinement-todo.md` Threshold → RESOLVED
      (in 07-01).
- [x] Reviewed by `reviewer` subagent (compliance + craft + arch, all pass;
      ADR-0005 frame-critique pass; nits hardened post-review).
- [x] Deviation log + reconciliation sweep produced under this slice heading.
- [x] `docs/refinement-todo.md` updated (OQ6 resolved; stale wiring line
      corrected to ADR-0005 routing).

### Deviation log (after reconciliation)

The original ACs are preserved above. What changed / notable choices:

1. **`cwv_budget` is a standalone advisory `rig/cwv-budget.mjs` (`npm run
   cwv:budget`)**, deliberately NOT in `oracle.sh` `COMPONENTS` (AC2). It spawns
   the existing rigs (`measure.mjs` ×N under `MODE=deferred`/`worker`,
   `lh-eds.mjs`, `teardown.mjs`) via `execFileSync` and budgets: INP p75 as a
   cross-invocation median-of-N delta vs the rIC-`deferred` control within a
   ±30ms band; TBT before/after ≤50ms; CLS ≤0.01; drain-stage delivery ≥99%.
   Exit 0 all-pass / 1 any-fail — advisory reporting only.
2. **Drain-stage delivery is sourced from the `MODE=worker` storm runs**
   (`egress_requests / expected_egress`), with `teardown.mjs` used only for the
   `pushCritical` fast-path + ring-tail scenarios — faithful to the AC (storm
   300/300 + fast-path/ring-tail full count) and deliberately excluding the
   OQ10 enqueued-last-beacon teardown loss (out of scope).
3. **INP seed via stubbing the worker median, not bumping `WORK`.** `WORK` is
   handed to the off-main-thread worker (`core/airlock.js`) and does not inflate
   *main-thread* INP, so bumping it would produce no regression signal (a false
   demo). Used the spec's offered alternative (stub the worker median).
4. **Oracle-design ADR-0005 authored + accepted** (AC3), recording the three
   settled decisions (AND-gate, isolation reclassification, OQ6 flicker routing)
   each with rejected alternative + the pinned CWV budgets. Its frame-critique
   added a "what the INP budget can and cannot detect" honesty paragraph
   (±30ms band ~4× the 0–8ms signal → detects catastrophic collapse, not the
   fine margin). OQ6 struck + Resolved-by ADR-0005; servo Threshold already
   RESOLVED in 07-01.
5. **Post-review hardening (craft/arch nits, fixed):** per-child
   `CHILD_TIMEOUT_MS` (180s) on every `execFileSync` (no more indefinite hang on
   a stalled chromium/build); `extractTrailingJSON`'s dead `start<0` guard
   corrected to a real "no JSON found" throw; `teardown.mjs` scenarios looked up
   by `scenario` label instead of brittle `results[1]`/`[2]` indices. Re-verified
   `npm run cwv:budget` exits 0 after the changes.
6. **Doc leak-vector fixes (arch nit):** `docs/refinement-todo.md` "Testing
   framework" **Remaining** line no longer lists `cwv_budget`/`isolation_invariant`
   as `oracle.sh` component wiring (it contradicted ADR-0005 — a future agent
   could have read it as a TODO to add `cwv_budget` to the gate); it now states
   the ADR-0005 routing. `architecture.md:65` gained an ADR-0005 pointer.
   `slice-05` gained a `continue-on-error` wiring caveat (below).
7. **07-05 handoff:** `npm run cwv:budget` exits 1 when over-budget, so its
   non-gating nature is NOT in the script — 07-05's CI step MUST be
   `continue-on-error` (recorded in slice-05 AC2). The gating browser checks
   (`rig:isolation`, `rig:uc1`) must NOT be continue-on-error.
8. **Deferred polish (logged, not fixed):** `rig/lh-eds.mjs` shells `npm run
   build` with `stdio:"inherit"`, leaking the npm banner into its stdout — the
   root cause of the `extractTrailingJSON` workaround; fixing lh-eds's stdout
   hygiene (banner → stderr) so the helper can be retired is out of this slice's
   core scope. Duplicated TBT/CLS budget literals (here + `lh-eds` `within_band`)
   risk drift. Child-crash exits 1 identically to an over-budget FAIL (advisory
   CI can't distinguish infra failure). The INP band is **symmetric** (`abs`) by
   intent — a worker >30ms *faster* than control signals a measurement anomaly,
   per ADR-0005 — though AC1's "must not exceed" wording reads one-sided.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Adds an advisory rig + an ADR; project front-door README unaffected. |
| `docs/specs/README.md` | `deferred` | Regenerated by `workflow.py status-board` as the final close-out step (post-`DONE`), per the RECONCILED → commit → DONE → regen sequence; it legitimately lags until then. |
| `docs/product-vision.md` | `no-op` | No product-scope/behavior change; the oracle-routing framing it already carries is unchanged. |
| `docs/architecture.md` | `updated` | Added an [ADR-0005](../../decisions/adr-0005-oracle-design.md) pointer at the measurement-surface note (`:65`) recording the routing split (was: grouped the three as undifferentiated "oracle components"). |
| `oracle.sh` / `.servo/install.json` | `no-op` | Deliberately untouched — `cwv_budget` stays OUT of `COMPONENTS` (AC2). Verified `git diff --stat oracle.sh` empty. |
| `.servo/refinement-todo.md` | `no-op` | Threshold already RESOLVED in 07-01; nothing new here. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Spec 007 still in flight (04/05 open); no close-out compression. |
| `docs/inbox.md` | `no-op` | Nothing to park. |
| `docs/refinement-todo.md` | `updated` | OQ6 struck + Resolved-by ADR-0005; the stale "Testing framework → oracle.sh component wiring" line corrected to the ADR-0005 routing (the arch-flagged doc leak vector). |
| `docs/specs/007-servo-oracle-ci/slice-05-ci-browser.md` | `updated` | AC2 gained the `continue-on-error` wiring caveat for the advisory `cwv:budget` step (deviation-log item 7). |
| `docs/decisions/**` / ADR index | `updated` | ADR-0005 authored, frame-critiqued, accepted; index regenerated. |
| `docs/memory/**` | `no-op` | The INP-delta-vs-noise-floor and advisory-routing lessons are captured in ADR-0005 + this deviation log; not separately memory-worthy. |

**Anti-horizontal-phasing check:** After this slice, the before/after CWV
scoreboard — the demo's "punchline" — is a pinned, runnable measurement surface
with explicit budgets, and the project's position on flicker oracle strength is
recorded rather than left as an open question.
