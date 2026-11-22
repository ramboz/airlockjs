---
round: 2
verdict: changes-requested
reviewer: Opus 5.5 jig:reviewer (fresh, read-only)
reviewed_at: 2026-11-22T19:22:02Z
prompt_source: "the 069-03 build and round-1 fix commits (2801d9cc, 77e5664b; pushed with the round-2 fix commit)"
scope: code craft of slice 069-03 (adapters/eds/martech.js, its hermetic and real-Chromium tests, the rig)
---

# Slice 069-03 craft review (round 2)

The author saved this text from the reviewer's output. The reviewer returned `changes-requested`. "This commit" is the round-2 fix commit that carries this file. Round 3 approved (see `slice-03-martech-library-craft-round-3.md`).

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | Med | `martechLazy` on a failed boot leaves the body hidden when `performanceOptimized: false` hid it. | Fixed in this commit: visibility restored before rethrowing; H test; revert-checked. |
| 2 | Med | Two quick post-boot `updateUserConsent` calls (revoke then grant) overlap and `granted` follows the settle order. | Fixed in this commit: a sequence counter, the last call made decides; H test; revert-checked. |
| 3 | Low | The AC3g Chromium test is vacuous (no request count, no grant-time check). | Fixed in this commit: at least one edge request, none before the grant time recorded in the page, for the library and stock. |
| 4 | Low | Data-layer events are checked against the consent call pending at drain time; undocumented. | Fixed in this commit: library header and Findings. |
| 5 | Low | A few fixed sleeps remain in the Chromium rig journey. | Carried (Low): owner is the next touch of that file. |
