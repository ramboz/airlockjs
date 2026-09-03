---
slice: 029-01 — the INP scoreboard artifact
pass: reconciliation
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-03T22:08:57Z
prompt_source: reconciliation sweep review (029-01)
---

**Verdict: PASS.** 029-01 promotes the vision's INP punchline to a runnable command (`npm run cwv:scoreboard`) +
a committed, honestly-hedged card (`docs/scoreboard.md`). Both frame-critique catches (durability inversion;
single-sample fast arms) and both craft nits (Math.floor lower bound; p75-aware below_floor) are folded in and
tested; the artifact is floor-aware (never a false-precise "8ms") and leads with the run-to-run-stable floored
bound so a fresh run cannot contradict the committed card. Advisory routing unchanged (oracle.sh grep). The two
recorded deviations (main() spawn verified by the live run not a mock — exceeds the cwv-budget norm; AC4 fairness
in JSON not the card) are honest + non-blocking. Additive, 945 suite green, lint clean, no live identifiers. No
orphans. Ready RECONCILED → DONE.
