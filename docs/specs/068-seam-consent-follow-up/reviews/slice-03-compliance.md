---
slice: "068-03: The opt-out forward carries only the consent the adapter registered"
pass: compliance
round: 3
verdict: approved
reviewer: claude-opus-5.5:jig:reviewer
reviewed_at: 2026-11-23T17:44:30Z
prompt_source: pushed commits 7a67a0b5..56cef833 (full diff in the prompt, plus the round-2 fix diff a09e7f47..56cef833); the author saved the reviewer's text
---

Round 3: approved. All seven ACs met; a held stale or tampered refusal can never be sent later on either gate.

Round history: round 1 changes-requested (MEDIUM: the deferred recheck still parked a refusal-shaped request; MEDIUM: AC4 end-to-end not provable on main). Round 2 approved. Round 3 approved.

- Round 1 MEDIUM, recheck parked the request: fixed in a09e7f47 (test: "a refusal forwarded under a denial, then moved to pending by a diagnostic before the recheck, is never sent after a grant").
- Round 1 MEDIUM, AC4 end-to-end on main: fixed by rewording AC4 and moving the end-to-end proof to 064-33 on vendor-adobe (documented in the slice ownership note and Findings).
- Round 3 LOW, no test replaces the registration between the first gate and the recheck: fixed (test "a registration replaced between the first gate and the deferred recheck holds the request", final docs commit).
- Round 3 LOW, the CMP `onChange` path is covered by construction (it calls `handle.setConsent`), not by its own test: carried, stated in Findings; owner 064-33 end-to-end test on vendor-adobe.
- Round 3 info, the positive AC1 test would also pass on 068-02 code: noted in Findings; AC1 is proven by the hold tests.
- Round 3 info, `jsonEqual` assumes JSON data: carried (see craft file); the JSDoc says JSON values.
