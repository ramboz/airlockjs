---
status: DRAFT
dependencies: []
last_verified:
arch_review: true
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): factual claims about runnable
     surfaces are probe-backed or marked as assumptions in spec.md. -->

## Slice 007-01 — `ga4_mp_conformance` oracle component (hermetic + live complement)

**Goal:** Register the existing hermetic contract validator as the
servo-unattended `ga4_mp_conformance` oracle component in the scaffolded
`oracle.sh`, and add the live `/debug/mp/collect` check as a **non-blocking**
complement — so one command returns a deterministic pass/fail verdict on GA4
Measurement-Protocol conformance.

**DoR:**
- ✅ `/servo:scaffold-init` has run and produced `oracle.sh` + `.servo/` with a
  component-append convention (spec.md A1). If it has not, this slice is
  blocked on that step.
- ✅ [contracts/validate.mjs](../../../contracts/validate.mjs) passes locally
  (`cd contracts && npm run validate`): 4 goldens validate, negative controls
  are rejected.

**Acceptance Criteria:**

1. **The oracle component runs the hermetic validator as a binary score.** A
   `score_ga4_mp_conformance()` function (in its own `# SEED:start/end
   ga4_mp_conformance` block in [oracle.sh](../../../oracle.sh)) runs
   `contracts/validate.mjs` and returns exactly `1.0` when all 4 goldens
   validate and negative controls are rejected, `0.0` otherwise. Observable: the
   score line reads `1.0`/`0.0`, never a fraction.
2. **The gate is an AND of binary checks — any 0.0 fails.** The component is
   added to the `COMPONENTS` array as `ga4_mp_conformance:1.0`, and the
   `THRESHOLD` default in `oracle.sh` is set to **`1.0`** (resolving the servo
   `refinement-todo` Threshold deferral). Because the composite is a weighted
   mean, `composite == 1.0` iff *every* component scores `1.0`, so a single `0.0`
   drops it below `THRESHOLD` and `oracle.sh` exits non-zero — the weighted-mean
   dilution 07-01 frame-critique caught is closed (spec.md Overview + A1).
   Observable: with a seeded broken fixture, `bash oracle.sh` exits `1` (verdict
   fail) even while `vitest` still scores `1.0`; restored, it exits `0`.
3. **The live `/debug/mp/collect` check exists as a non-blocking complement.**
   A separate check posts a golden payload to GA4's MP validation endpoint and
   reports `validationMessages`, but its result **never gates** the oracle
   (R-002; it is the complementary half). It runs credential-free against the
   placeholder endpoint, or self-skips with a clear "live check skipped (no
   endpoint configured)" line when unconfigured (spec.md A3). Observable: the
   check's advisory output; the oracle verdict is unchanged whether it passes,
   fails, or skips.
4. **No real credentials are introduced.** No `measurement_id`/`api_secret`
   appears in the repo or CI config; the endpoint stays a placeholder (security
   MUST).

**DoD:**
- [ ] All ACs pass; full test suite green (`npm test`), `contracts` validator
      green (no regressions).
- [ ] A seeded fixture mutation is shown to flip the component verdict red, and
      is restored (the gate is capable of failing).
- [ ] Reviewed by `reviewer` subagent (compliance + craft; arch pass, since
      `arch_review: true`).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] `docs/refinement-todo.md` updated if any decision was deferred.

**Implementation notes (07-01 re-review, non-blocking):**
- **Wrap `validate.mjs`'s exit code — do not let it propagate.**
  `contracts/validate.mjs` exits `1` on failure / `0` on success and never
  echoes a score. `score_ga4_mp_conformance()` must translate:
  `if (cd contracts && node validate.mjs) >/dev/null 2>&1; then echo 1.0; else echo 0.0; fi`
  (mirroring `score_vitest`). If a raw non-zero exit escaped the score function,
  `oracle.sh` would misclassify a genuine conformance failure (rc=1) as an
  env-error (exit 2) instead of a `0.0` gate-fail.
- **The binary invariant is a convention, not enforced.** `THRESHOLD=1.0`
  behaves as an AND only while every `score_*` returns exactly 1.0/0.0; nothing
  in `oracle.sh` constrains that. Add a comment at the `COMPONENTS` array noting
  that gating components MUST be binary — a future fractional score would make
  `THRESHOLD=1.0` a near-impossible bar rather than an AND.

**Anti-horizontal-phasing check:** After this slice, a developer (or servo)
runs one command and gets a deterministic GA4-conformance verdict — the
strongest, most-ready oracle component, usable immediately as a gate, before
any CI exists.

### Deviation log (after reconciliation)

_TBD at reconciliation._

### Reconciliation sweep

_TBD at reconciliation — regenerate the sweep table from the slice template._
