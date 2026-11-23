---
round: 1
verdict: changes-requested
reviewer: Opus 5.5 jig:reviewer (fresh, read-only)
reviewed_at: 2026-11-23T16:19:20Z
prompt_source: "diff 04fe54c2..25d39f21 (squashed into the commit that carries the files)"
scope: craft of the 069-05 tests and rig change
---

# Slice 069-05 craft review (round 1)

The author saved this text from the reviewer's output. The reviewer returned `changes-requested`. "This commit" is the one that carries this file.

Note: `reviewed_at` is the earliest time the output could have been read; the exact read time was not logged. The findings below are summaries from the output, not a verbatim copy.

| Finding | Severity | Disposition |
|---|---|---|
| Ignored fetch fields asserted only conditionally | MED | fixed in 6b00eab5 (the round-1 fix commit): `sameAsStock` asserts both fetch queries |
| Late-answer test vacuous | MED | fixed in 6b00eab5 (the round-1 fix commit): the answered fetch is counted (`stats.answered`) and asserted |
| Slice flipped DONE before the reviews | MED | fixed in 6b00eab5 (the round-1 fix commit): reopened |
| Settle helper, placement comments, duplicate helpers, AC1/AC4 duplicate run, path-only compare | LOW | fixed in 6b00eab5 (the round-1 fix commit): helper shared, AC1 and AC4 share one run, bodies compared |
