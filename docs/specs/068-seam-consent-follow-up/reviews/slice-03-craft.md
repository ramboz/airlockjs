---
slice: "068-03: The opt-out forward carries only the consent the adapter registered"
pass: craft
round: 3
verdict: approved
reviewer: claude-opus-5.5:jig:reviewer
reviewed_at: 2026-11-23T17:46:00Z
prompt_source: pushed commits 7a67a0b5..56cef833 (full diff in the prompt, plus the round-2 fix diff a09e7f47..56cef833); the author saved the reviewer's text
---

Round 3: approved. No equality bypass and no replay-after-grant path inside the documented scope.

Round history: round 1 changes-requested; round 2 changes-requested (array-order and type tests were rejected by the parse before the compare, so they did not exercise `jsonEqual`); round 3 approved.

- Round 2 MEDIUM, array-order test did not reach `jsonEqual`: fixed in 56cef833 ("keeps array order significant" now fires `[B,A]` and `[A,B]`; revert-checked).
- Round 2 LOW-MEDIUM, type test did not reach `jsonEqual`: fixed in 56cef833 ("holds a value whose type differs but still parses as a refusal"; revert-checked).
- Round 2 LOW, shallow copy of the registration: fixed in 56cef833 (`structuredClone`; test "deep-copies the registration ..."; revert-checked).
- Round 2 LOW, misleading "until consent is decided" reason for a dropped refusal: fixed in 56cef833.
- Round 2 LOW, a forward dropped at the recheck does not bump `consentHeld` or emit a held diagnostic: carried. Observability only, no consent effect; owner: spec 068 maintainers, revisit if the inspector shows confusion.
- Round 2 LOW, no call-order assertion for registration before `host.setConsent`: carried. The chamber round trip is async, so the order is safe today; owner: 064-33 end-to-end test on vendor-adobe.
- Round 3 LOW, `structuredClone` keeps non-JSON values (Date, Map, sparse arrays), and `jsonEqual` assumes JSON data: carried. Only an adapter bug could register such a value; the JSDoc says JSON values. Owner: 064-33, which registers the page object (JSON parsed from the page).
- Round 3 LOW, a copy failure silently clears the registration with no diagnostic: carried. It fails closed; owner: spec 068 follow-up if it is ever seen.
- Round 3 info, a set-consent URL variant the ceiling allows but the suffix check misses parks like any request: carried; the same class as the documented "collect:n outside the declared entry" edge, not a new exposure.
