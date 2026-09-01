---
slice: 024-01 — worker-dom feasibility spike (POC-B)
pass: craft
verdict: pass
reviewer: jig:reviewer (orchestrator)
reviewed_at: 2026-09-01T21:20:53Z
prompt_source: review.py craft
substrate: non-interactive
---

Craft (024-01 spike) — PASS. The investigation is sound + decision-shaped. The LOAD-BEARING thesis is grounded, not assumed: worker-dom is AD-4-COMPATIBLE (async mutation-flush via postMessage, NO SharedArrayBuffer) — the sharp reason it, not Partytown (SAB fast path AD-4 refuses per R-003, slow sync-XHR default), is the Lever-2 base. The works/won't-work map is SPECIFIC + HONEST: works unmodified for write/compute-heavy tags; won't-work for sync-layout-read/measurement (getBoundingClientRect/offsetHeight/read-after-write) — amp-script rewrites them to async (so not "unmodified"), the sync SAB route is AD-4-refused. The genuinely sharp finding: layout-thrash (the worst INP offender, the 023-01 fixture's own pattern) is IN worker-dom's won't-work set, so Lever 1 + Lever 2 are complementary not overlapping. The build-vs-wrap choice (@ampproject/worker-dom pre-1.0/semi-maintained vs a minimal airlock mirror) is surfaced for the ADR with a lean, not pre-decided. Scope honest: the INP number is named as the build-spec's step, not overclaimed here.
