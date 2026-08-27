---
status: READY_FOR_REVIEW
dependencies: [007-01]
last_verified:
arch_review: true
frame_review: true
claimed_by: claude/airlock-servo-oracle-ci-6b13d9
---

<!-- jig grounding (spec 064-02 / ADR-0020): factual claims about runnable
     surfaces are probe-backed or marked as assumptions in spec.md. -->

## Slice 007-04 — hermetic CI on GitHub Actions (vitest + contracts)

**Goal:** Stand up a GitHub Actions workflow that runs the **hermetic** oracle
on every push/PR — `npm test` (the vitest unit suite) and the `contracts`
validator (`ga4_mp_conformance`, the sole servo-unattended-strong component) —
so the deterministic, credential-free gate runs in CI. This is the fast core
pipeline; the browser rigs (including the 07-02 isolation assert) land in 07-05.

**DoR:**
- ✅ 007-01 (`ga4_mp_conformance`) is DONE — CI runs the component it wired,
  including the `oracle.sh` `THRESHOLD=1.0` AND-gate.
- ✅ `npm ci` installs cleanly from the committed lockfile(s) (root +
  `contracts/`); `node_modules` is not assumed present (fresh checkout).
  *(Frame-critique confirmed a committed root `package-lock.json`
  lockfileVersion 3 exists and playwright carries no install script, so `npm ci`
  stays browser-free.)*

**Acceptance Criteria:**

1. **A CI workflow runs the hermetic oracle on push and PR.** A new
   `.github/workflows/ci.yml` (separate from `jig-governance.yml`) triggers on
   push and pull_request, runs `npm ci` then `npm test`, runs the
   `contracts` validator (`cd contracts && npm ci && npm run validate`), **and
   runs `npm run test:oracle`** — the `ga4_mp_conformance` gate-flip proof that
   007-01 moved out of the default `npm test` suite (so `bash oracle.sh` cannot
   mutate a golden as a side effect of scoring; 007-01 arch re-review). Without
   this step CI would never exercise the gate's fail-capability. Observable: the
   workflow appears in Actions and its job passes on the current green tree, with
   `test:oracle` a visible step.
2. **A real failure fails the job.** A seeded failing test (or broken golden)
   makes the CI job exit non-zero; a green tree passes. Observable: a
   demonstrated red run, then restored green. (May be shown via `act` locally or
   a scratch branch push; do not leave the seed committed.)
3. **CI is credential-free and secret-safe.** The workflow requires no GA4
   `measurement_id`/`api_secret` and no other secret; the live
   `/debug/mp/collect` check (07-01, non-blocking) is either skipped in CI or
   run credential-free against the placeholder (spec.md A3). Observable: the
   workflow file references no secrets for the gating steps.
4. **Node + lockfile pinned.** The workflow pins a Node version and uses
   `npm ci` against committed lockfiles so runs are reproducible. Observable:
   `ci.yml` sets `actions/setup-node` with a pinned version and cache.

**DoD:**
- [ ] All ACs pass; the workflow is green on the current tree.
- [ ] The fail-closed behavior (AC2) is demonstrated and the seed removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft; arch pass, since
      `arch_review: true`).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] `docs/refinement-todo.md` CI/CD decision updated (partially resolved:
      hermetic core landed; browser CI tracked to 07-05).

**Implementation notes (07-04 frame-critique, non-blocking):**
- Root `npm ci` still installs the full devDep tree (playwright-core, lighthouse,
  esbuild) the hermetic core does not exercise — heavier than "fast core"
  implies. Consider `npm ci --omit=optional` or a leaner install if job time
  matters; still credential-free and browser-free either way.
- Adding `.github/workflows/ci.yml` touches a governance-protected path
  (`jig-governance.yml:28` globs `.github/workflows/**`), so the governance job
  self-flags. Expected/inert until branch protection is armed — record it in the
  deviation log so it is not mistaken for a real failure.

**Anti-horizontal-phasing check:** After this slice, every push is gated by the
GA4 hermetic component (`ga4_mp_conformance` at `THRESHOLD=1.0`) plus the vitest
unit suite — the hard precondition (review G4) for any servo-unattended GA4 loop
is met for the deterministic half, with fast feedback and no browser-install risk.

### Deviation log (after reconciliation)

_TBD at reconciliation._

### Reconciliation sweep

_TBD at reconciliation — regenerate the sweep table from the slice template._
