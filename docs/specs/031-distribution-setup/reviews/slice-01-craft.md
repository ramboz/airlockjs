---
slice: 031-01 — the distributable build target + subtree-install proof (boots on a clean EDS checkout, CWV preserved)
pass: craft
verdict: pass
reviewer: general-purpose (richer: pr-review)
reviewed_at: 2026-09-04T19:36:44Z
prompt_source: review.py pr-review docs/specs/031-distribution-setup/spec.md 031-01 <deliverables> --richer-skill pr-review
substrate: non-interactive
---

VERDICT: pass (after one needs-changes → fix → re-review cycle)

## Assessment (independent craft review, general-purpose reviewer, richer skill: pr-review)

The build refactor and the git-mechanics of the proven path (rig + unit tests, which use bare-repo paths) are
correct, hermetic, and well-guarded; the two seeded breaks are genuinely non-vacuous. The one blocker — the
documented release command being non-functional — is now resolved.

## The [blocker] (first pass) and how it was fixed
**Blocker (empirically verified):** `npm run publish:dist -- --target origin` failed — `publishDist` pushes from a
throwaway `git init` staging repo with no `origin` remote, so a remote NAME errored with `fatal: 'origin' does not
appear to be a git repository`. The rig/tests only ever passed bare-repo PATHS, so the broken form was never
exercised.

**Fixed + re-verified (pass):** new exported `resolveTarget()` resolves a bare remote name to its URL via
`git -C ROOT remote get-url` in the airlock repo (where names are meaningful); paths/URLs short-circuit verbatim;
unknown name falls back to the literal for git to reject. `publishDist` pushes the resolved `pushTarget`. README +
JSDoc + comments aligned (no drift). A genuine regression test guards it (path/URL pass through; `resolveTarget("origin")`
resolves to non-literal). Re-verified: `resolveTarget("origin")` → `git@github.com:ramboz/airlockjs.git`; 14/14
tests green (AC2 pushes hit only local bare temp repos, never real origin); lint clean.

## Non-blocking nits → reconciliation-log items (all still stand, none gates)
1. **rig/subtree-install.mjs:287** — break (i)'s red condition (`chamber_worker_absent && beaconFired === false`)
   doesn't assert boot actually succeeded, so "no beacon" isn't provably attributable to the missing sibling vs a
   total boot failure. `probeBoot` returns `hasAirlock`/`bootFailed`; adding `hasAirlock === true && bootFailed ===
   null` would make the red match the inline claim. Genuinely red today; future-regression hardening.
2. **rig/subtree-install.mjs:187** — `probeBoot` uses a fixed `page.waitForTimeout(1200)` instead of awaiting the
   `**/collect*` request it already routes; `waitForResponse('**/collect*')` would be deterministic (mild flake risk).
3. **build.mjs:170-172** — `parseOutdir` silently falls back to the testbed default when `--outdir` is passed with
   no value; npm scripts always pass a value so it can't bite today; small footgun.

## Strengths (preserve if revisited)
- The `resolveTarget` fix: exported, doc-aligned, regression-tested, resolved in the correct repo context; the
  `catch → return target` fallback lets git emit its own error rather than masking it.
- break-(ii) (add-from-`main` → no eds.js → boot fail) proves the `--prefix`-is-local mechanism crux.
- Bidirectional build-time worker-layout enforcement (basename-keyed; holds for dist/temp/testbed).
- Hermetic/repo-safe git discipline (`core.hooksPath=/dev/null`, array-arg `execFileSync`, refuse-to-guess-`origin`).
- `DIST_ARTIFACTS` derived from build.mjs's entry+worker set — single source of truth, can't drift.

Reviewer: general-purpose (independent), richer skill pr-review. Recovery: needs-changes → fix → re-run → pass.
