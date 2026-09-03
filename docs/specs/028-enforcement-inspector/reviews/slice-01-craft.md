---
slice: 028-01 — the decision-stream read-layer + query
pass: craft
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-03T20:23:48Z
prompt_source: review.py implementation 028 'read-layer' + deliverables
substrate: not-shown
applied_skill: none
---

**Verdict: PASS** (independent reviewer, Opus). No correctness bug found.

- **Ring-buffer emission-order math (`collector.js` `inOrder`) — correct**, hand-traced by the reviewer at the
  exact wrap boundary and after many wraps (cap=3: count=3 → `[r0,r1,r2]`; count=4 → `[r1,r2,r3]`; count=6 (2×cap)
  → `[r3,r4,r5]`; count=7 → `[r4,r5,r6]`). The `count <= cap ? 0 : head` branch is robust because at every
  `k·cap` boundary `head===0`, so the full-but-unwrapped and wrapped branches coincide — no off-by-one. `size()`
  and `inOrder()`'s `n` share the `count<cap?count:cap` form, so they never disagree. Insert is O(1).
- **Shallow copy — sufficient, and now DELIBERATE.** The double shallow-copy (insert + query `.map`) fully
  isolates the buffer because every real 009-02 record is FLAT (primitive values only — the reviewer enumerated
  the record shapes across all three hosts). The reviewer's one forward-looking note (a future nested-value emit
  site would share references, uncaught by the top-level-only copy test) is addressed: `collector.js` now carries
  an explicit **FLAT-RECORD INVARIANT** comment naming the assumption and the deep-copy follow-up trigger, turning
  a latent gap into a stated, deliberate choice. Tracked in refinement-todo.
- **INP-safety / "only reached via onDiagnostic" — holds.** Only `onDiagnostic` writes; `query`/`size`/`clear`
  read. Per enforcement decision: one `{...record}` alloc + one modulo + one assign (O(1)), and enforcement
  decisions are already the exceptional (non-interaction) path. AC4 gives behavioural evidence for the airlock hot
  path. The non-object defensive guard correctly never throws into an emit site.
- **Test honesty — clean.** All tests non-vacuous; the two riskiest ACs (AC1 config-integrity, AC4 off-hot-path)
  carry explicit controls that fail if the collector were unwired. Orchestrator independently confirmed a
  capture-disable mutation turns 8/13 red (the 4 survivors correctly don't depend on capture).

No blocking issues.
