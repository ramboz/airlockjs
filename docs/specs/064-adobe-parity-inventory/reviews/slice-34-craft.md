---
slice: "064-34: an opt-out in flight for a superseded consent update still forwards"
pass: craft
round: 2
verdict: approved
reviewer: 29826772-d871-453c-80b4-1e2946651554 (claude-opus-5.5, jig:reviewer)
reviewed_at: 2026-11-24T22:12Z
prompt_source: round-2 diff of cd4fba06 against a9e52864 plus the changed files in the checkout; the author saved the reviewer's text
---

Round 1 (cdc0d2eb-220f-4785-96b1-95a455022593 (claude-opus-5.5, jig:reviewer), read 2026-11-24T22:09Z, verdict: changes-requested) was on a9e52864 (the full diff plus the new real-Chromium test). Round 2 is above.

Round 1 findings and dispositions:
- High, `findLastIndex` over-retires on repeated values: fixed (oldest match), tested.
- Medium, key-order-sensitive compare: fixed (`canon`).
- Low/medium, growth from identical consecutive updates: fixed (skip a generation equal to the last); the unbounded-while-no-request residual is recorded.
- Medium, no repeated-value test: added.
- Low, the 064-33 original-order case: the test now asserts the object still forwards.
- Low, AC2 compares the wire to the page's constant, not the registration: stated in the slice Findings.

Round 2 findings: medium, the key-reorder half of the repeated-value test did not pin `canon` (fixed after the review with a dedicated test that fails when `canon` is reverted to `JSON.stringify`); low, no test for the duplicate-skip line (accepted: it only limits growth); low, `canon` and `jsonEqual` differ on `undefined` keys and NaN (accepted: it can only retire, never widen); low, a long comment line (re-wrapped).
