---
slice: 029-03 — a realistic martech load (the honest synthetic-representative version)
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-03T22:39:31Z
prompt_source: review.py implementation 029 'realistic'
---

**Verdict: PASS** (independent reviewer, Opus). All five ACs met, tests meaningful (the mutation redded 3).
- AC1 — resolveProfile maps micro/realistic → grounded {trackers,work_us}; TRACKERS/WORK override; unknown/empty/
  non-numeric → base (robustness added). AC2 — model records fixture.profile; main() threads it to measure (live
  run: realistic → 12 trackers, naive p75=240ms). AC3 — the card + docs disclose the SYNTHETIC + uniform-work
  limit AND the deferred real customer stack; never presents realistic AS the real stack. AC4 — docs document the
  profile + how to run + the deferral. AC5 — synthetic numbers, no live identifiers.
