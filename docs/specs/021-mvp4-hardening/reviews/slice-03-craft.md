---
slice: 021-03 — adopt ESLint + delint the alloy chamber
pass: craft
verdict: pass
reviewer: jig:reviewer (orchestrator)
reviewed_at: 2026-08-31T19:07:25Z
prompt_source: review.py craft
substrate: non-interactive
---

Craft (021-03) — PASS. Flat config is correctly environment-split (browser / worker / node / vitest); the load-bearing correctness point — worker files EXCLUDED from browser globals — is honored (verified core/chamber.worker.js resolves to worker globals only, not window/document). `recommended` baseline chosen for real-bug coverage without a style-churn avalanche; the pragmatic rule calibration (caughtErrors:"none", argsIgnorePattern "^_", allowEmptyCatch) is standard. The alloy-chamber blanket was removed OUTRIGHT (2 no-useless-escape hand-fixed — `eslint --fix` is a no-op for that rule in v10.9.1, correctly diagnosed; the char-class escape removal verified behavior-equivalent). The ~20 pre-existing violations fixed behavior-preservingly (each dead store/binding is linter-guaranteed unobserved); sanitize-html's control-regex got the one justified scoped disable. Independent confirm: lint 0 problems, 97 tests green.
