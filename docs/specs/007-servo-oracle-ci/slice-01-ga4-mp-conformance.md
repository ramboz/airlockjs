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

1. **The oracle component runs the hermetic validator and gates on it.** A
   `score_ga4_mp_conformance()` function (in its own `# SEED:start/end
   ga4_mp_conformance` block in [oracle.sh](../../../oracle.sh)) runs
   `contracts/validate.mjs` and returns `1.0` when all 4 goldens validate and
   negative controls are rejected, `0.0` otherwise. Observable: the score line;
   a seeded broken fixture drops the composite below `THRESHOLD` so `oracle.sh`
   exits non-zero.
2. **The component is registered as a gating, servo-unattended entry.** It is
   added to the `COMPONENTS` array as `ga4_mp_conformance:<weight>` (feeding the
   gating composite — the Tier-0 template has no non-gating tier; spec.md A1),
   and reflected in `.servo/install.json`. Observable: `bash oracle.sh` invokes
   the component; the seeded-failure run flips the whole oracle verdict to fail.
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

**Anti-horizontal-phasing check:** After this slice, a developer (or servo)
runs one command and gets a deterministic GA4-conformance verdict — the
strongest, most-ready oracle component, usable immediately as a gate, before
any CI exists.

### Deviation log (after reconciliation)

_TBD at reconciliation._

### Reconciliation sweep

_TBD at reconciliation — regenerate the sweep table from the slice template._
