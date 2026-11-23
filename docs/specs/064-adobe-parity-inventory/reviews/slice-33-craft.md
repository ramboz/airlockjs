---
slice: "064-33: the opt-out forward carries only the consent the page gave (Adobe part)"
pass: craft
round: 2
verdict: approved
reviewer: claude-opus-5.5:jig:reviewer
reviewed_at: 2026-11-23T18:01:50Z
prompt_source: pushed commits b04c95e4..e52d5e55 (the full diff in the prompt); the author saved the reviewer's text
---

Round 2: approved. Round 1 (5702bdcb, approved) and round 2 (e52d5e55) had only low findings.

- Round 1 LOW, back-to-back updates: an in-flight request for the earlier registration is held when a newer update replaces it: carried to 064-34 (READY_FOR_IMPLEMENTATION), which owns it.
- Round 1 LOW, Alloy sending the page's full object unchanged is proven for the simple vector shape and by 064-30's grant-path real-Chromium test, not by a refusal capture: carried; owner: 064-34 AC2 (a real-Chromium refusal check, with a synthetic or frozen-corpus response only).
- Round 1 LOW, failed-post case untested; retry test fakes the wire body: fixed in e52d5e55 (failed post); retry carried (same as compliance).
- Round 2 LOW, the falsy-`setConsent` test would also pass on the round-1 code: carried; an equivalent mutant, pins the behaviour.
- Round 2 LOW/nit, a truthy `setConsent` clears `pageConsentObject` when `consentRef` is null: carried; no effect (registration is `[]`, `setAdobeConsent` returns early).
- Round 2 notes, a later `setAdobeConsent` that classifies as `none` leaves the previous object registered, and the object stays registered until the next update: carried; both values are the page's own, and nothing was applied.
