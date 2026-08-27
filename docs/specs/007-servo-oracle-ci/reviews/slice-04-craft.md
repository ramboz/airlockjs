---
slice: 007-04 — hermetic CI on GitHub Actions (vitest + contracts)
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-08-27T22:37:53Z
prompt_source: review.py pr-review --richer-skill pr-review
substrate: non-interactive
---

Craft — PASS (no blockers). STRENGTHS: header comment accurate/honest (live GA4 check excluded, browser rigs deferred to 07-05); test:oracle included as a visible step (easy to omit, correctly present); sensible step order with GHA default fail-fast; both lockfiles lockfileVersion 3 in sync so both npm ci succeed. NITS (all standard CI hygiene, ADDRESSED post-review): (1)[nit] cache: npm keyed on root lockfile only -> ADDED cache-dependency-path covering root + contracts/. (2)[nit] no permissions block -> ADDED top-level permissions: contents: read (least-privilege). (3)[nit] no timeout-minutes -> ADDED timeout-minutes: 15 on the job. (4)[nit] push (no filter) + pull_request double-runs -> ADDED a concurrency group (cancel-in-progress). RECONCILIATION: root npm ci still installs the full devDep tree (playwright-core/lighthouse/esbuild) the hermetic core doesn't exercise — heavier than "fast core" implies but still credential-free/browser-free; --omit optimization deferred (accepted deviation). Governance self-flag (.github/workflows/**) expected/inert.
