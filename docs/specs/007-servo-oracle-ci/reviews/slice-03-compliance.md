---
slice: 007-03 — `cwv_budget` oracle component + resolve OQ6 (flicker routing)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-27T22:22:52Z
prompt_source: review.py implementation
---

Compliance — PASS. All three ACs met. AC1: rig/cwv-budget.mjs runs measure.mjs under MODE=deferred and MODE=worker N>=3 each (INP_N default 3), median inp_p75 per side, delta=median(worker)-median(deferred) vs ±30ms band (INP_BAND_MS default 30) — genuine cross-invocation delta vs the rIC control, not absolute; TBT<=50ms/CLS<=0.01 from lh-eds delta_median; drain-stage delivery>=99% from the MODE=worker storm runs (egress/expected) + fast-path/ring-tail from teardown.mjs. AC2: oracle.sh COMPONENTS = vitest + ga4_mp_conformance only; cwv_budget is a standalone `npm run cwv:budget` advisory, never in the composite. AC3: ADR-0005 Accepted, records the three decisions each with rejected alternative; refinement-todo OQ6 struck + Resolved-by ADR-0005. RECONCILIATION: (1) drain-stage rate sourced from the worker storm measure runs (not teardown) — faithful to AC wording, excludes OQ10; note as a clarification. (2) [low] extractTrailingJSON `start<0` guard is dead (idx=-1 -> start=0) — harmless, fix in passing. (3) confirm the DoD red-flip demos were exercised (they were: CLS+0.05 and INP worker+100 each flipped to exit 1, restored).
