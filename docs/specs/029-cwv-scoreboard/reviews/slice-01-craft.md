---
slice: 029-01 — the INP scoreboard artifact
pass: craft
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-03T22:07:52Z
prompt_source: review.py implementation 029 'INP scoreboard'
substrate: not-shown
applied_skill: none
---

**Verdict: PASS** (independent reviewer, Opus). Math correct, edge cases handled, honest framing real. No
correctness bug. The reviewer's substantive nits are FIXED:

- **Math.round → Math.floor on the floor bound (the public-number honesty fix).** The stated "at least ~Nx" lower
  bound was `round(152/16)=10`, on a 9/10 knife-edge (a fresh naive=150 → round(9.4)=9 would contradict a committed
  "~10x"). Now `Math.floor` (152/16 → 9), and the committed card reads "~9x conservatively (~19x true margin)" — a
  fresh run's floored bound can never contradict it. This is exactly the durable-vs-regenerable contradiction AC2b
  aims to preclude, now closed.
- **below_floor is now p75-aware** (`interactions <= 2 AND p75 <= 16ms`) — guards against mislabeling a hypothetical
  few-but-SLOW arm (2 interactions @ 100ms) as "below floor".
- **INP_N guard** (`Math.max(1, ...)`) — INP_N=0 no longer NaNs.

Confirmed sound by the reviewer: median odd/even; the worker_median=0 division guard (→ null, falls back to the
robust floor bound); N=1; the `import.meta.url === process.argv[1]` isMain guard (test imports never launch a
browser — 10/10 green, no hang). The headline leads with the run-to-run-stable floored bound. Low residual notes
(main() orchestration uncovered; AC4 fairness in JSON not card) recorded in the deviation log.
