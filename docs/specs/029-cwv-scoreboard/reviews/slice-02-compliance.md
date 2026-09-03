---
slice: 029-02 — the load-CWV arm + CI
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-03T22:24:41Z
prompt_source: review.py implementation 029 'load-CWV'
---

**Verdict: PASS** (independent reviewer, Opus). All five ACs met, each exercised non-vacuously.
- AC1 — foldLoadCwv (pure) adds load_cwv from lh-eds's JSON; renderCard shows the row; main() runs lh-eds only
  under WITH_LH, consuming via extractTrailingJSON (banner-robust). Verified end-to-end (`LH_N=1 WITH_LH=1` folded
  load_cwv={tbt 0, cls 0, within_band true}).
- AC2 — default is INP-only + fast (load_cwv:null, no Lighthouse spawned); tested.
- AC3 — CI browser-oracle gains an advisory continue-on-error scoreboard step; oracle.sh COMPONENTS unchanged.
- AC4 — docs/scoreboard.md notes the load-CWV arm (band language + how to run).
- AC5 — no live identifiers (synthetic testbed).
