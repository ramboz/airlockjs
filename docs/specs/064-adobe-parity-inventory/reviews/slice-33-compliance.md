---
slice: "064-33: the opt-out forward carries only the consent the page gave (Adobe part)"
pass: compliance
round: 2
verdict: approved
reviewer: claude-opus-5.5:jig:reviewer
reviewed_at: 2026-11-23T18:01:22Z
prompt_source: pushed commits b04c95e4..e52d5e55 (the full diff in the prompt); the author saved the reviewer's text
---

Round 2: approved. Round 1 (5702bdcb, approved) and round 2 (e52d5e55) both had only low findings.

- Round 1 LOW, the post-throws case (`r.kind === "send"` but not sent) was untested: fixed in e52d5e55 (test "an object the chamber never received (postMessage throws) is not registered"; revert-checked red).
- Round 1 LOW, `handle.setConsent(falsy)` cleared the variable while `applyVector` returned early: fixed in e52d5e55 (`if (v) pageConsentObject = null`).
- Round 1 info, the retry is simulated by a hand-written vector body: carried; recorded in Findings. Owner: none needed, the same registration serves the boot-denial test with the real `shapeAlloyConsent` value.
- Round 1 info, CMP `onChange` has no test of its own: carried; it calls `handle.setConsent` (covered by construction, as 068-03 records).
- Round 2 very low, `pageConsentObject` is set before `applyVector(r.vector)`: carried; `classifyAdobeConsent` returns a vector with every `send` (alloy-bridge.js:70). Owner: 064-30 maintainers if that contract changes.
- Round 2 info, the falsy-`setConsent` test cannot tell the fix from the old code: carried; the mutation is equivalent (both `applyVector` callers reset the variable), the test pins the behaviour.
