---
slice: 038-04 — confirm Meta advanced-matching parity (retire the `ud[...]` 026-04 gap)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-11T20:52:16Z
prompt_source: review.py implementation ... rig/parity/descriptors/meta.js test/parity-meta-advanced-matching.test.js docs/refinement-todo.md
---

Verdict: PASS. All 7 ACs met with meaningful, non-vacuous tests — the AC5(b) negative witness (no externalId → ud[external_id] dropped → fail) is the load-bearing anti-vacuity guard. Security handled (synthetic GUID, hash shape-only, never printed). No correctness bugs; honest about presence≠efficacy; ADR-0020 anti-false-shim discipline applied.
Non-blocking → reconciliation: (1) the local replayWithAdvancedMatching helper reproduces the production merge glue (reuses production hashField/mergeAdvancedMatching) rather than exercising core's requestMapper/identityCache wiring — confirms merge OUTPUT, not core wiring (026-04's DONE concern). (2) _fbp vs real-capture fbp wire-name: AC4-compliant "scope + name" branch, so the _fbp/fbc regression guard is real only against the synthetic fixture.
Reconciliation must fill the Deviation log + Reconciliation sweep, and confirm the MVP7 release-check reads "field-presence parity confirmed" (already done in mvp7.md).
