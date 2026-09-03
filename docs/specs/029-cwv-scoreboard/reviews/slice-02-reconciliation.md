---
slice: 029-02 — the load-CWV arm + CI
pass: reconciliation
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-03T22:25:43Z
prompt_source: reconciliation sweep review (029-02)
---

**Verdict: PASS.** 029-02 gives the scoreboard the load-CWV half of the before/after (opt-in via WITH_LH, folded
from lh-eds's TBT/CLS deltas) + an advisory continue-on-error CI step, keeping the default run fast. Verified
end-to-end (LH_N=1 WITH_LH=1 folded load_cwv). The craft review's three findings are all fixed inline: CI LH_N=1
(removes the 30-min-job-timeout exposure the doubled Lighthouse sweep created), the lh-eds banner follow-up now
tracked in inbox, within_band null->"band unknown". extractTrailingJSON verified identical to the cwv-budget
original. Additive (no runtime code), 950 suite green, oracle.sh COMPONENTS unchanged, no live identifiers. No
orphans. Ready RECONCILED -> DONE.
