---
slice: 023-01 — costly tag contained + measured (the INP scoreboard)
pass: compliance
verdict: pass
reviewer: jig:reviewer (orchestrator)
reviewed_at: 2026-09-01T20:13:28Z
prompt_source: review.py compliance
---

Compliance (023-01) — PASS. Follows the repo's rig conventions (mirrors rig/harness.html's Event-Timing method, rig/measure.mjs's cadence, rig/cwv-budget.mjs's N-runs+band); the capability mirrors adapters/eds/dom.js's DI'd style. No secrets / live identifiers (synthetic fixture, localhost, no real tags/endpoints). TDD (RED-first). eslint clean; targeted tests only. web-vitals dep already present (not re-added). Deviation log + reconciliation sweep present; deviations named (rig/ over probes/ [justified — every existing Playwright harness lives in rig/, R-008 allows either]; runWhenIdle/runBeforePaint built+tested-but-unwired [bounded]; the breakdown-grouping bug fix). I independently re-verified scheduler + capability + fixture + harness + tests + lint.
