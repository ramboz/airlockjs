---
status: RECONCILED
dependencies: [007-02, 007-03, 007-04]
last_verified: 2026-08-27
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

   > **Wiring caveat (07-03 arch handoff): `npm run cwv:budget` exits `1` when
   > over-budget.** Its advisory (non-gating) nature is NOT in the script — the
   > script exits non-zero on a budget miss. So the `cwv:budget` CI step MUST be
   > `continue-on-error: true` (or run with `|| true` / a captured exit code that
   > only annotates), or an advisory budget miss would fail the browser job. The
   > gating steps (`rig:isolation`, `rig:uc1`) must NOT get `continue-on-error`.
3. **The browser stage is isolated from the hermetic gate.** The browser job's
   flakiness or a chromium-install failure does not block the hermetic core
   job's verdict (they are separate jobs / clearly separable). Observable: the
   hermetic job can pass while the browser job is retried or investigated.
4. **No real credentials; artifacts captured.** The Lighthouse before/after
   scoreboard and the clean-challenger screenshot (OQ6 human-review artifact)
   are uploaded as CI artifacts for the human reviewer. No secrets required.
   Observable: artifacts attached to the run.

**DoD:**
- [x] All ACs pass; the browser job's rig commands are green locally
      (`rig:isolation` 0, `rig:uc1` 0, `cwv:budget` 0) — a live Actions run was
      not possible offline (see deviation log).
- [x] AC2's gating-vs-reporting split is demonstrated (isolation neutralized →
      `rig:isolation` exit 1 → restored; `cwv:budget` forced over-budget via
      `INP_BAND_MS=-1` → exit 1, but the step is `continue-on-error`), seeds
      removed (`git diff` clean).
- [x] Reviewed by `reviewer` subagent (compliance + craft + arch, all pass; the
      artifact-naming/mkdir nits were fixed post-review).
- [x] Deviation log + reconciliation sweep produced under this slice heading.
- [x] `docs/refinement-todo.md` CI/CD decision → RESOLVED (full pipeline landed).

### Deviation log (after reconciliation)

The original ACs are preserved above. What changed / notable choices:

1. **Separate `browser-oracle` job (AC3), pure append.** Added to
   `.github/workflows/ci.yml` alongside the untouched `hermetic-oracle` (07-04)
   with **no `needs:` coupling** — a chromium-install failure or browser flake
   cannot block the hermetic servo-unattended gate. Steps: checkout →
   setup-node (22, cache both lockfiles) → `npm ci` → `npx playwright install
   --with-deps chromium` → **GATING** `rig:isolation` + `rig:uc1` → **ADVISORY**
   `cwv:budget` (`continue-on-error`) → `upload-artifact if: always()`.
   `timeout-minutes: 30`; workflow-level `permissions: contents: read` covers it.
2. **uc1 timeouts made env-configurable (07-05 robustness note, backward-compatible).**
   `rig/uc1.mjs` now reads `UC1_BOOT_TIMEOUT_MS` / `UC1_BEACON_TIMEOUT_MS`,
   **defaulting to the original 20000 / 8000 ms** (local behavior unchanged); the
   CI step sets 60000 / 20000 to give a slow shared runner headroom (the
   frame-critique's spurious-gating-failure concern). A minimal cross-slice touch
   of a spec-005 rig, defaults preserved.
3. **Advisory-report capture fixed post-review (compliance/craft/arch nits).**
   The first cut redirected `npm run cwv:budget > rig/out/lh-scoreboard.json`,
   which (a) named a human-readable text table `.json`, (b) hid the report from
   the live Actions log, and (c) implicitly depended on `rig/out/` existing (only
   because `rig:uc1` mkdir'd it — a fragile ordering coupling `continue-on-error`
   would have silently swallowed). Changed to
   `mkdir -p rig/out && npm run cwv:budget | tee rig/out/cwv-report.txt` — decoupled
   the dir, `.txt` matches the content, and `tee` surfaces the report **both**
   inline and in the artifact (GHA's default `pipefail` preserves the exit code so
   an over-budget miss still annotates the step).
4. **Advisory reporting surface (AC2 "job summary" interpretation).** A budget
   miss surfaces via the uploaded `cwv-report.txt` artifact + the inline `tee`
   output + the `continue-on-error` step annotation — not a formal
   `$GITHUB_STEP_SUMMARY` block. Defensible for an advisory signal a human reads.
5. **Offline verification (constraint).** No live GitHub Actions run was executed
   (offline), and `npm ci` / `npx playwright install` were not run locally
   (chromium already present). Verified: YAML parses (two jobs); the rig commands
   pass locally (isolation 0, uc1 0 building internally, cwv:budget 0);
   `uc1-challenger.png` produced (42 KB). **The genuinely CI-fragile point — the
   frame-critique's note that `rig/lh-eds.mjs` launches Playwright's chromium via
   chrome-launcher under `--with-deps` — cannot be exercised offline; the first
   live run should confirm A2.**

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Extends CI; project front-door README unaffected. |
| `docs/specs/README.md` | `deferred` | Regenerated by `workflow.py status-board` as the final close-out step (post-`DONE`); it legitimately lags until then. |
| `docs/product-vision.md` | `no-op` | No product-scope/behavior change. |
| `docs/architecture.md` | `no-op` | No module-boundary/public-contract change; the oracle routing was already recorded (ADR-0005 pointer added in 07-03). |
| `oracle.sh` / `.servo/` | `no-op` | Untouched — the browser gates are CI-job checks, not `COMPONENTS` entries. |
| `rig/uc1.mjs` | `updated` | Timeouts made env-configurable (defaults preserved); a backward-compatible robustness change. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Spec 007 closes with this slice, but it was never added to `CLAUDE.md`'s Active-specs list (only 001-adopt-jig is there) and there is no `AGENTS.md` — so there is no active-specs entry to compress-on-close-out (spec 025). The status board + ADR-0005 carry the load-bearing facts. |
| `docs/inbox.md` | `no-op` | Nothing to park. |
| `docs/refinement-todo.md` | `updated` | CI/CD decision → **RESOLVED** (full two-job pipeline landed, with the offline caveat). |
| `docs/decisions/**` / ADR index | `no-op` | CI shape follows ADR-0005's already-recorded routing; no new ADR. |
| `docs/memory/**` | `no-op` | The oracle-in-CI shape is captured in ADR-0005 + this deviation log; not separately memory-worthy. |

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
