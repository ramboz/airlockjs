---
slice: 067-08: Alloy context defaults to the stock list
pass: compliance
verdict: pass
reviewer: claude-opus-5.5 (jig:reviewer)
reviewed_at: 2026-11-14T00:19:41Z
prompt_source: slice-08 ACs + spec 067 + ADR-0062
---

Round 1: four mediums (per-field clearing of denylisted placeholders, stale values, minimalXdm not forwarded by bootAlloy, toXdm fallback placeholders overriding the channel URL). Round 2: one medium (navigator fields not cleared, proxy fell back to its placeholder). All fixed; ACs 1-7 pass. No finding remains.
