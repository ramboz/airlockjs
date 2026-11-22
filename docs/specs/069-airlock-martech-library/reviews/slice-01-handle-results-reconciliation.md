---
round: 1
verdict: changes-requested
reviewer: Opus 5.5 jig:reviewer (fresh, read-only)
reviewed_at: 2026-11-22T17:38:28Z
prompt_source: "the full diff 2dcd83fa..7032a6a3 (pushed in the commit that carries these files, squashed into it) saved at a scratch path and read by the reviewer from disk"
scope: reconciliation of slice 069-01 with ADR-0065, slices 069-03 and 064-31, the CHANGELOG and the spec board
---

# Slice 069-01 reconciliation review (round 1)

The author saved this text from the reviewer's output. The reviewer returned `changes-requested`. Dispositions below refer to the round-1 fix commit that carries this file ("this commit"). Reviewer note: the wrapper's throwing-hook rejection is a behavior change and must be in the deviation log. No round-2 re-review has run.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | High | ADR-0065 lines 30, 96 and 173 wrongly say stock 2.31.1 renders the view cache for a bare `applyPropositions({ viewName })`. | Fixed in this commit: the three lines corrected and a dated 2026-11-22 amendment added. |
| 2 | High | AC4 points at a real-Chromium differential in 069-03 for the bare form, which cannot exist. | Fixed in this commit: the pointer removed; 069-03 compares only the combined form. |
| 3 | Med | The `applyPersonalization` difference has no owning AC. | Fixed in this commit: owned by 069-03 AC4, with a reason and a test of the difference. |
| 4 | Med | AC1's recorded S10 answer was replaced by a synthetic one. | Fixed in this commit; see the deviation log (the recorded answer has no propositions or decisions). |
| 5 | Med | The grant-inside-timeout test was dropped. | Fixed in this commit: hermetic test added. |
| 6 | Med | Slice marked DONE before the DoD reviews. | Fixed in this commit: the three reviews are saved; DONE kept because every AC is met after the fixes. |
| 7 | Low | The AC4 hermetic hit test is missing. | Fixed in this commit. |
| 8 | Low | Destinations stripped, `{}` results, partial render and timestamp differences are un-owned. | Fixed in this commit: each owned by a clause in 069-03 AC4 with a test. |
| 9 | Low | The CHANGELOG does not mention the `applyPropositions({ viewName })` difference. | Fixed in this commit. |
| 10 | Low | 064-31 still says `handle.push` returns nothing and `setConsent` resolves after the post. | Fixed in this commit: both lines updated; ACs untouched beyond the re-scope. |
