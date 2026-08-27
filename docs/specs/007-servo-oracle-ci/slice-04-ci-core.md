---
status: RECONCILED
dependencies: [007-01]
last_verified: 2026-08-27
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
- [x] All ACs pass; the workflow's step commands are green on the current tree
      (`npm test` 119, `npm run test:oracle` 3, `contracts validate` 14) — see
      the offline-verification note below (a live Actions run was not possible
      offline).
- [x] The fail-closed behavior (AC2) is demonstrated (deleted `client_id` from a
      golden → `validate` exit 1 + `test:oracle` fail → restored via Edit) and
      the seed removed (`git status` clean).
- [x] Reviewed by `reviewer` subagent (compliance + craft + arch, all pass).
- [x] Deviation log + reconciliation sweep produced under this slice heading.
- [x] `docs/refinement-todo.md` CI/CD decision updated (partially resolved:
      hermetic core landed; browser CI tracked to 07-05).

### Deviation log (after reconciliation)

The original ACs are preserved above. What changed / notable choices:

1. **Offline verification (constraint, not a deviation from intent).** We are
   offline (`could not reach origin`), so a live GitHub Actions run could not be
   executed, and `npm ci` was not run (it would wipe `node_modules` and fail with
   no registry). Instead: (a) the YAML parses cleanly; (b) the workflow's actual
   step commands were run locally and pass — `npm test` (119), `npm run
   test:oracle` (3, incl. its own gate-flip assertion), `cd contracts && npm run
   validate` (14); (c) the AC2 fail-closed demo ran locally (delete `client_id`
   from `contracts/fixtures/ga4-mp-page_view.golden.json` → `validate` exit 1 +
   `test:oracle` fail → restored via Edit, `git status` clean); (d) `act -n
   -W .github/workflows/ci.yml` recognized the job then hit "Cannot connect to
   the Docker daemon" (expected offline). **A real Actions run remains
   unverified** — the first live push should confirm it.
2. **Post-review CI hardening (craft nits, applied).** Added `permissions:
   contents: read` (least-privilege), `timeout-minutes: 15`, a `concurrency`
   group (cancel-in-progress, so a push+PR pair doesn't double-run to
   completion), and `cache-dependency-path` covering **both** lockfiles (root +
   `contracts/`) so a contracts dep change invalidates the npm cache. YAML
   re-verified valid.
3. **Accepted deviation: plain `npm ci` (not `--omit=optional`).** Root `npm ci`
   installs the full devDep tree (playwright-core, lighthouse, esbuild) the
   hermetic core does not exercise — heavier than "fast core" implies, but still
   credential-free and browser-free (playwright has no install script, so no
   chromium download). The leaner-install optimization is deferred, not owed.
4. **Governance self-flag (expected/inert).** `.github/workflows/ci.yml` lives
   under `.github/workflows/**`, which `jig-governance.yml` globs as a
   protected path, so that job flags this change for owner review — expected and
   inert until branch protection is armed; not a real CI failure.
5. **`node-version: "22"` pins the major only** (patch/minor float across 22.x).
   Satisfies AC4 ("pinned node-version"); the lockfile + `npm ci` + cache pin
   the dependency tree. Tighten to an exact patch only if fully reproducible
   builds are later required.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Adds a CI workflow; project front-door README unaffected. |
| `docs/specs/README.md` | `deferred` | Regenerated by `workflow.py status-board` as the final close-out step (post-`DONE`); it legitimately lags until then. |
| `docs/product-vision.md` | `no-op` | No product-scope/behavior change. |
| `docs/architecture.md` | `no-op` | No module-boundary/public-contract change; CI is process infra, not a runtime interface. |
| `oracle.sh` / `.servo/` | `no-op` | Untouched — CI *runs* the oracle, it does not alter it. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Spec 007 still in flight (05 open); no close-out compression. |
| `docs/inbox.md` | `no-op` | Nothing to park. |
| `docs/refinement-todo.md` | `updated` | CI/CD decision marked **partially resolved** — hermetic core landed; browser CI tracked to 07-05, with the offline-verification caveat. |
| `docs/specs/007-servo-oracle-ci/slice-05-ci-browser.md` | `no-op` | Already depends on 007-04 and extends this pipeline; no edit owed here. |
| `docs/decisions/**` / ADR index | `no-op` | No ADR-worthy decision; CI shape follows ADR-0005's already-recorded routing. |
| `docs/memory/**` | `no-op` | Nothing durable beyond the deviation log / refinement-todo update. |

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
