---
slice: 064-22 — B6: Out-of-default-surface disposition
pass: craft
round: 1
verdict: pass
reviewer: independent reviewer (Copilot general-purpose sub-agent, Opus 5.5)
reviewed_at: 2026-11-20T16:55:00Z
prompt_source: review prompt, slice 064-22 (uncommitted worktree diff)
---

# 064-22 craft — Round 1

**Verdict: pass. 0 blocking, 6 non-blocking (1 medium, 5 low).** Tests drive the pinned bundle in the unmodified chamber and read the browser network log; fake values obviously fake; rig change additive; CI step in `browser-oracle` with `AIRLOCK_REAL_CHROMIUM=1`. Source claims checked against 2.31.1: correct except the wording below.

- C1 (medium): `hideReferrer:true` URL destinations (and ID-syncs) wait for a page `BODY` the chamber lacks, time out after 5 s and emit no tag. **Fixed (reworded + tested):** new test asserts nothing leaves; Audiences row states it is not tagged.
- C2 (low): "retries 4 times" is 4 attempts. **Fixed;** test pins 4 `endpoint-ceiling` diagnostics.
- C3 (low): Advertising iframe is hidden, not visible. **Fixed.**
- C4 (low): "None exist in a worker chamber" too broad (IndexedDB exists). **Fixed.**
- C5 (low): seed was dead. **Fixed:** assertion pins the known gap.
- C6 (low): stale "bridge is 064-22" chamber comments. **Carried** in notes (wording only).
