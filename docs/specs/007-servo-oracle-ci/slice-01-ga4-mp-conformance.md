---
status: DONE
dependencies: []
last_verified: 2026-08-27
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
- [x] All ACs pass; full test suite green (`npm test` — 12 files/119 tests),
      `contracts` validator green (no regressions).
- [x] A seeded fixture mutation is shown to flip the component verdict red
      (`npm run test:oracle`: clean→exit 0, broken golden→exit 1), and is
      restored (the gate is capable of failing).
- [x] Reviewed by `reviewer` subagent (compliance pass + craft pass + arch pass
      after a blocker fix + re-review).
- [x] Deviation log + reconciliation sweep produced under this slice heading.
- [x] `docs/refinement-todo.md` unaffected (the resolved Threshold deferral is
      servo-owned — marked RESOLVED in `.servo/refinement-todo.md`).

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

The original ACs are preserved above. What changed during implementation, and
the reviewer findings folded in:

1. **Gate-flip meta-test moved out of the default vitest suite (arch blocker
   fix).** The first implementation put `test/oracle-ga4.test.js` in the default
   suite and spawned `bash oracle.sh` from it to prove the gate flips. Because
   `score_vitest` runs the *whole* default suite, this made the servo-unattended
   primary path (`bash oracle.sh`) re-enter itself and **mutate a committed
   golden fixture** (delete `client_id` → write → restore) as a side effect of
   scoring — a kill mid-mutation would corrupt the golden (arch `[blocker]`).
   First attempt bounded it with an `ORACLE_GA4_TEST_GUARD` recursion guard; the
   review correctly rejected that as insufficient (it bounds depth, not the
   mutation). **Resolution:** a default `vitest.config.js` that `exclude`s the
   meta-test from `npm test`/`score_vitest`, plus a dedicated
   `vitest.oracle.config.js` + `npm run test:oracle` that runs only it. The
   guard was deleted. `bash oracle.sh` now never runs the meta-test and never
   dirties a fixture (verified: `git status` clean after a run). The
   golden-corruption-on-kill risk is now confined to explicit `npm run
   test:oracle` invocations — the inherent cost of any real gate-flip proof, and
   an acceptable residual off the primary path.
2. **Follow-up owed by 007-04 (cross-slice, from arch re-review).** Moving the
   proof out of `npm test` orphaned it from CI as 07-04 was specified (its AC1
   ran `npm test` + `npm run validate`, never `test:oracle`). **07-04's AC1 was
   updated in this reconciliation** to add a `npm run test:oracle` CI step, so
   the gate's fail-capability keeps automated coverage.
3. **Live-check test hermeticity (craft nit, fixed).** The `mp-live-check` test
   now spawns its child with `GA4_MEASUREMENT_ID`/`GA4_API_SECRET` explicitly
   deleted from the env, so a developer with those exported can't make the test
   POST to the real endpoint and fail the skip assertion.
4. **`THRESHOLD=1.0` sits outside the SEED blocks (arch nit, noted).** A comment
   was added at that line warning that a `/servo:scaffold-init --force` re-emit
   could reset it to the template's 0.5 and silently disable the AND-gate.
5. **Lightweight impl choices (reviewer-sanctioned):** the live-check env vars
   are named `GA4_MEASUREMENT_ID` / `GA4_API_SECRET` (documented in the script
   header; no committed values — AC4 honored); the `mp-live-check` npm script is
   colocated in `contracts/package.json` alongside `validate`.
6. **AC3 wording vs implementation (clarify).** AC3 says the live check "runs
   credential-free against the placeholder endpoint, **or** self-skips." The
   implementation has two paths: skip when no creds, or POST to the real GA4
   `/debug/mp/collect` when creds are supplied — there is no credential-free
   *placeholder-endpoint POST*. The skip path satisfies the security MUST
   (credential-free by default); the AC's "placeholder endpoint" phrasing was
   aspirational. No behavior change owed.
7. **Oracle-design decisions destined for the 07-03 ADR.** The `THRESHOLD=1.0`
   AND-gate and the binary-score invariant are load-bearing oracle-design
   choices with a rejected alternative (weighted-mean dilution). They live as
   inline `oracle.sh` comments now, but must be recorded in the "servo oracle
   design" ADR authored during 07-03 (alongside OQ6 + the isolation
   reclassification) — not left only as code comments.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | This slice adds an oracle component + CI-oriented tooling; the project front-door README is unaffected. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` (007-01 → REVIEWED/DONE). |
| `docs/product-vision.md` | `no-op` | No product-scope/behavior change; the oracle-routing framing it already carries is unchanged. |
| `docs/architecture.md` | `no-op` | No module-boundary/public-contract change to `core/`/`connectors/`; the oracle components at `architecture.md:65` are already described. The AND-gate is an oracle-design decision routed to the 07-03 ADR, not an architecture.md edit. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Spec 007 is still in flight (007-02…05 open); no close-out compression yet. |
| `docs/inbox.md` | `no-op` | Nothing to park; implementer surfaced no out-of-scope items. |
| `docs/refinement-todo.md` | `no-op` | The Threshold deferral this slice resolves is servo-owned; see the next row. |
| `.servo/refinement-todo.md` | `updated` | The **Threshold** deferred decision is marked RESOLVED (THRESHOLD=1.0 AND-gate, decided in spec 007 authoring, implemented here). |
| `docs/specs/007-servo-oracle-ci/slice-04-ci-core.md` | `updated` | AC1 gained a `npm run test:oracle` CI step (deviation-log item 2). |
| `docs/decisions/**` / ADR index | `deferred` | The AND-gate + binary-invariant oracle-design decisions are recorded in the 07-03 "servo oracle design" ADR (deviation-log item 7), authored with OQ6. |
| `docs/memory/**` | `no-op` | The servo-oracle-testing lesson (a meta-test that shells the whole oracle must be excluded from `score_vitest`'s suite) is captured in this deviation log + the review evidence; not separately memory-worthy. |
