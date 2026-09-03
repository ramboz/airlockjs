---
slice: 029-02 — the load-CWV arm + CI
pass: craft
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-03T22:24:41Z
prompt_source: review.py implementation 029 'load-CWV'
substrate: not-shown
applied_skill: none
---

**Verdict: PASS** (independent reviewer returned NEEDS-CHANGES; all findings fixed). No correctness bug in the
pure logic; extractTrailingJSON verified behaviorally IDENTICAL to cwv-budget.mjs's original (case analysis).

Fixes applied:
- **[Medium] CI LH_N pin.** The advisory step left LH_N unpinned (→ default 5), and the cwv:budget step above
  already runs a full LH_N=5 sweep — so the job would run a SECOND 10-run Lighthouse sweep, risking the job-level
  30-min timeout (which continue-on-error does NOT cover). Pinned **LH_N=1** in the step (matches the local run +
  AC3's "fast" intent; the card's robust number is naive's wall-clock p75, not a 5-median LH delta).
- **[Medium] "tracked follow-up" now actually tracked.** 029-02 added a SECOND consumer of lh-eds's banner-prefixed
  stdout; added a `docs/inbox.md` entry for the source-side fix (build output → stderr) and updated the rig comment
  to point at it.
- **[Low] within_band null → "band unknown"** (was "OVER band", misleading on malformed input; lh-eds always emits
  a boolean, so this only bit a relaxed guard).

Confirmed sound: main() uses `let model` + reassigns only under the WITH_LH guard (no default-path LH spawn); the
CI grep binds continue-on-error to THIS step (non-vacuous); foldLoadCwv's null/malformed guard is sufficient.
