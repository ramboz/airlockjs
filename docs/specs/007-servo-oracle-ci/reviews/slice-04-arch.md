---
slice: 007-04 — hermetic CI on GitHub Actions (vitest + contracts)
pass: arch
verdict: pass
reviewer: arch-review
reviewed_at: 2026-08-27T22:37:53Z
prompt_source: review.py arch-review --richer-skill arch-review
substrate: non-interactive
---

Arch — PASS (no load-bearing problem). The hermetic/browser split is CLEAN: one hermetic-oracle job, zero Playwright/Lighthouse/chromium/`playwright install` steps, so a browser-install failure can never break the hermetic gate. Plain npm ci relies on playwright carrying no install script (confirmed devDep + frame-critique premise), so the job stays genuinely browser-free. The gate set (npm test + test:oracle + contracts validate) is consistent with ADR-0005 (ga4_mp_conformance is the sole servo-unattended-strong hermetic component); no duplication/contradiction with oracle.sh — CI runs the same underlying checks decomposed, and oracle.sh's AND-gate is validated through test:oracle. test:oracle as its own step exercises the gate-flip proof without the default npm test suite re-discovering the mutating meta-test (matches vitest.config.js:19 exclusion). 07-05 handoff clean: single well-named job, browser rig lands as a sibling job without refactoring. NITS: node major-only pin (adequate — lockfile+npm ci+cache pin the tree); governance self-flag (.github/workflows/**) expected/inert. RECONCILIATION: log the governance self-flag; root npm ci devDep-tree weight is an accepted deviation. Post-review hardening (permissions/timeout/cache-dependency-path/concurrency) added per craft nits; YAML re-verified valid.
