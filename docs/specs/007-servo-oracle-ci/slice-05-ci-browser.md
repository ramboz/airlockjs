---
status: READY_FOR_REVIEW
dependencies: [007-02, 007-03, 007-04]
last_verified:
arch_review: true
frame_review: true
claimed_by: claude/airlock-servo-oracle-ci-6b13d9
---

<!-- jig grounding (spec 064-02 / ADR-0020): factual claims about runnable
     surfaces are probe-backed or marked as assumptions in spec.md. -->

## Slice 007-05 — browser CI (Playwright rigs + Lighthouse CI)

**Goal:** Extend the CI pipeline with the **browser** stage — install
Playwright/chromium in Actions and run the browser rigs — combining two
**gating** structural checks (the 07-02 real-Worker isolation assert and the
UC-1 no-flicker invariant) with the **advisory** `cwv_budget` statistical rigs
(Lighthouse before/after, INP-delta-under-storm, drain-stage delivery). This is
the heavier pipeline the MVP1 plan flags as the browser-automation rabbit hole
([mvp1.md:69](../../releases/mvp1.md)); it lands after the cheap hermetic gate
(07-04) so the fast feedback exists first.

**DoR:**
- ✅ 007-04 (hermetic CI) is DONE — this slice extends that workflow.
- ✅ 007-03 (`cwv_budget`) is DONE — this slice runs the rigs it pinned (as deltas).
- ✅ 007-02 (`isolation_invariant` real-Worker rig) is DONE — this slice gates on it.
- ✅ The rigs run locally (`npm run rig:isolation`, `npm run lh:eds`,
  `npm run rig`, `npm run rig:teardown`, `npm run rig:uc1`).

**Acceptance Criteria:**

1. **A browser CI job installs chromium and runs the rigs.** A job (in
   `ci.yml` or a sibling workflow) installs Playwright + chromium
   (`npx playwright install --with-deps chromium`) and runs the browser rigs
   headless: the two gating structural asserts (`rig:isolation`, `rig:uc1`) and
   the advisory `cwv_budget` rigs (reporting each metric against its pinned
   delta/budget, 07-03). Observable: the job appears in Actions and completes on
   the current tree (spec.md A2).
2. **Two structural asserts gate; the statistical budgets report.** The 07-02
   real-Worker isolation assert (`rig:isolation`) and the UC-1 no-flicker
   assertion (`rig:uc1`) are **gating** (a real isolation or flicker regression
   fails the job via non-zero exit); the `cwv_budget` statistical metrics are
   **reported as advisory** — a delta/budget miss surfaces in the job summary
   but does not fail the gate (routing per 07-03). These structural asserts gate
   the **CI job exit**; they are not `oracle.sh` `COMPONENTS` entries (spec.md
   routing table). Observable: a seeded isolation regression fails; a seeded
   flicker regression fails; a seeded small budget drift is reported, not failed.
3. **The browser stage is isolated from the hermetic gate.** The browser job's
   flakiness or a chromium-install failure does not block the hermetic core
   job's verdict (they are separate jobs / clearly separable). Observable: the
   hermetic job can pass while the browser job is retried or investigated.
4. **No real credentials; artifacts captured.** The Lighthouse before/after
   scoreboard and the clean-challenger screenshot (OQ6 human-review artifact)
   are uploaded as CI artifacts for the human reviewer. No secrets required.
   Observable: artifacts attached to the run.

**DoD:**
- [ ] All ACs pass; both CI jobs green on the current tree.
- [ ] AC2's gating-vs-reporting split is demonstrated (seeded isolation
      regression fails; seeded flicker regression fails; seeded budget drift only
      reports), then seeds removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft; arch pass, since
      `arch_review: true`).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] `docs/refinement-todo.md` CI/CD decision → RESOLVED (full pipeline landed).

**Implementation notes (07-05 frame-critique, non-blocking):**
- [rig/lh-eds.mjs](../../../rig/lh-eds.mjs) launches via chrome-launcher pointed
  at Playwright's chromium binary (`--headless=new --no-sandbox`), not
  Playwright's own launcher — the genuinely fragile point of A2 under
  `--with-deps` on a CI runner. Focus the per-slice re-grounding run there.
- The `rig:uc1` gating verdict depends on a full airlock boot within a 20s
  `waitForFunction` + 8s beacon poll, and also gates on exposure-beacon
  MP-conformance (not the flicker invariant alone). On a slow shared runner these
  timeouts are a spurious-failure risk for a **gating** check — do a robustness
  pass (raise timeouts / isolate the flicker assertion from the beacon poll) so a
  slow runner does not red-flag a real green.

**Anti-horizontal-phasing check:** After this slice, the full oracle runs in CI
— hermetic gating + statistical reporting + human-review artifacts — completing
the review-G4 precondition for a servo-unattended GA4 loop, with the
before/after CWV scoreboard visible on every run.

### Deviation log (after reconciliation)

_TBD at reconciliation._

### Reconciliation sweep

_TBD at reconciliation — regenerate the sweep table from the slice template._
