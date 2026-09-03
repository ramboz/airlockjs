---
slice: 029-03 — a realistic martech load (the honest synthetic-representative version)
pass: craft
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-03T22:39:32Z
prompt_source: review.py implementation 029 'realistic'
substrate: not-shown
applied_skill: none
---

**Verdict: PASS** (independent reviewer, Opus). The honesty crux confirmed HONEST, not gamed.
- The ~15x realistic multiplier is honest: the naive arm mechanically scales with load (`INP ≈ T × work`,
  baseline/naive.js), airlock's O(1) capture stays flat — the vision's "wins-heavy/indivisible-load" thesis, not
  manipulation. It's floored (240/16=15, UNDER-claims vs the ~30x at 240/8), disclosed ("naive scales with the
  load; airlock stays below the floor"), and the per-tracker work was LOWERED 30→20µs vs micro (conservative, not
  inflated). The 12-tracker count is R-007-grounded (~10 pixel/wire + 4 wrapped-SDK INP-relevant tags).
- Two minor findings FIXED: non-numeric TRACKERS/WORK override now falls back to the base (`Number(x) || base`,
  no "NaN" through to measure.mjs's harness); the AC3-card test gained a note-only assertion (/representative
  average/i) so the disclosure block has independent teeth. runMeasure's signature change has one correct caller.
- Recorded (reconciliation): work_us=20000 is a slice-authored representative average of R-007's 5–50ms spread
  (R-007 classifies by archetype/count, not per-tag INP cost) — defensible + conservative.
