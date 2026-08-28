---
slice: 009-01 — per-descriptor isolation in the chamber
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-28T01:19:53Z
prompt_source: review.py implementation
---

Compliance 009-01 — PASS. All 4 ACs met by the pure exported mapBatch, exercised meaningfully. Per-descriptor try/catch wraps the whole tracker loop (drop the descriptor for all trackers, record {type,reason}, continue). The typeof-self guard is behavior-preserving: in a real Worker self exists so onmessage is still wired and posts {ready,dropped}; the guard only skips wiring in Node/vitest. Reply additive; airlock.js reads only e.data.ready; map.js unchanged. AC1 partial batch (ready=2*trackers page_views, no purchase), AC2 dropped {type:purchase,reason:/transaction_id/}, AC3 chamber survives (mapBatch re-callable), AC4 all-valid regression. Non-vacuous (mutation-fail-on-removal). No issues.
