---
status: DRAFT
dependencies: [007-01, 007-02]
last_verified:
arch_review: true
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): factual claims about runnable
     surfaces are probe-backed or marked as assumptions in spec.md. -->

## Slice 007-04 — hermetic CI on GitHub Actions (vitest + contracts)

**Goal:** Stand up a GitHub Actions workflow that runs the **hermetic** oracle
on every push/PR — `npm test` (vitest, which includes `isolation_invariant`)
and the `contracts` validator (`ga4_mp_conformance`) — so the two
servo-unattended-strong components gate CI. This is the fast, credential-free
core pipeline; the browser rigs land in 07-05.

**DoR:**
- ✅ 007-01 (`ga4_mp_conformance`) and 007-02 (`isolation_invariant`) are DONE —
  CI runs the components they wired.
- ✅ `npm ci` installs cleanly from the committed lockfile(s) (root +
  `contracts/`); `node_modules` is not assumed present (fresh checkout).

**Acceptance Criteria:**

1. **A CI workflow runs the hermetic oracle on push and PR.** A new
   `.github/workflows/ci.yml` (separate from `jig-governance.yml`) triggers on
   push and pull_request, runs `npm ci` then `npm test`, and runs the
   `contracts` validator (`cd contracts && npm ci && npm run validate`).
   Observable: the workflow appears in Actions and its job passes on the current
   green tree.
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

**Anti-horizontal-phasing check:** After this slice, every push is gated by the
two hermetic oracle components in CI — the hard precondition (review G4) for any
servo-unattended GA4 loop is met for the deterministic half, with fast feedback
and no browser-install risk.

### Deviation log (after reconciliation)

_TBD at reconciliation._

### Reconciliation sweep

_TBD at reconciliation — regenerate the sweep table from the slice template._
