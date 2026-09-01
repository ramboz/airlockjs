---
slice: 022-04 — CWV checkpoint via `web-vitals` (native runtime capture)
pass: compliance
verdict: pass
reviewer: jig:reviewer (orchestrator)
reviewed_at: 2026-09-01T17:50:25Z
prompt_source: review.py compliance
---

Compliance (022-04) — PASS. Additive (top/error byte-unchanged; handle() untouched); mirrors the GA4/022-01/02 connector style + adapters/eds/exposure.js's DI'd capture-module convention. web-vitals@^6.2.1 declared as a runtime dependency (major-pinned; the lightweight-decision captures the why). No secrets / live identifiers (synthetic fixtures + the ot.aem.live public default). TDD (RED-first confirmed). eslint clean; targeted tests only. Deviation log + reconciliation sweep present; all five deviations named (main-thread capture, 022-05 dependency, production-wiring fork, flat-vs-nested wire shape, shallow projectCwv filter). AC1 grounded from the REAL web-vitals .d.ts, not guessed. NOTE: the subagent's safety-classifier timed out — I independently re-verified the projection logic, the whitelist exclusions, the structured-clone tests, and lint.
