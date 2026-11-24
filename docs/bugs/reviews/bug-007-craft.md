---
bug: 007
pass: craft
verdict: pass
reviewer: jig:reviewer (Opus 5.5, round 1)
reviewed_at: 2026-11-24T17:32:05Z
prompt_source: pr-review skill craft pass; diff 4e6189f9..3441eeb5
---

VERDICT: approved, recorded as `pass` (craft, round 1, reviewed on 3441eeb5; its should-fix items were applied in b1f7b889 and re-read by the round 2 and 3 bug reviewers on the final head).

FINDINGS
- should-fix, helper wider than the documented pair and no leftover check: FIXED (exact stock shape asserted, count equality).
- should-fix, bare toThrow in negatives: FIXED (`rejects` asserts an AssertionError).
- should-fix, missing hermetic cases for stock shape: FIXED.
- readability, AC4 title said the order matched stock's: FIXED (title and comment state the independent sends).
- doc, 6/24 vs 14/24 numbers: FIXED (two samples labelled).
- No local paths or private IDs in committed files; strict stock comparison stays outside personalization-off AC1/AC4.
