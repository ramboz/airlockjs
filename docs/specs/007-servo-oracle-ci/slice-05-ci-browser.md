---
status: DRAFT
dependencies: [007-03, 007-04]
last_verified:
arch_review: true
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): factual claims about runnable
     surfaces are probe-backed or marked as assumptions in spec.md. -->

## Slice 007-05 — browser CI (Playwright rigs + Lighthouse CI)

**Goal:** Extend the CI pipeline with the **browser** stage — install
Playwright/chromium in Actions and run the rigs behind `cwv_budget`
(Lighthouse before/after, INP-under-storm, drain-stage delivery, and the
structural UC-1 flicker invariant) — so the statistical oracle runs in CI as a
**reported, non-gating** stage. This is the heavier pipeline the MVP1 plan
flags as the browser-automation rabbit hole ([mvp1.md:69](../../releases/mvp1.md));
it lands after the cheap hermetic gate (07-04) so the fast feedback exists first.

**DoR:**
- ✅ 007-04 (hermetic CI) is DONE — this slice extends that workflow.
- ✅ 007-03 (`cwv_budget`) is DONE — this slice runs the rigs it pinned.
- ✅ The rigs run locally (`npm run lh:eds`, `npm run rig`, `npm run rig:teardown`,
  `npm run rig:uc1`).

**Acceptance Criteria:**

1. **A browser CI job installs chromium and runs the rigs.** A job (in
   `ci.yml` or a sibling workflow) installs Playwright + chromium
   (`npx playwright install --with-deps chromium`) and runs the `cwv_budget`
   rigs headless, reporting each metric against its pinned budget (07-03).
   Observable: the job appears in Actions and completes on the current tree
   (spec.md A2).
2. **The structural flicker invariant gates; the statistical budgets report.**
   The UC-1 no-flicker structural assertion (`rig:uc1`) is **gating** (a real
   flicker regression fails the job); the `cwv_budget` statistical metrics are
   **reported as advisory** (a threshold miss surfaces in the job summary but
   does not fail the servo-unattended gate — routing per 07-03). Observable:
   a seeded flicker regression fails; a seeded small budget drift is reported,
   not failed.
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
- [ ] AC2's gating-vs-reporting split is demonstrated (seeded flicker fails;
      seeded budget drift only reports), then seeds removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft; arch pass, since
      `arch_review: true`).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] `docs/refinement-todo.md` CI/CD decision → RESOLVED (full pipeline landed).

**Anti-horizontal-phasing check:** After this slice, the full oracle runs in CI
— hermetic gating + statistical reporting + human-review artifacts — completing
the review-G4 precondition for a servo-unattended GA4 loop, with the
before/after CWV scoreboard visible on every run.

### Deviation log (after reconciliation)

_TBD at reconciliation._

### Reconciliation sweep

_TBD at reconciliation — regenerate the sweep table from the slice template._
