---
slice: 059-14 - Browser admission and original-byte capture controls
pass: compliance
verdict: needs-changes
reviewer: jig:reviewer (Browser compliance)
reviewed_at: 2026-10-19T15:43:31Z
prompt_source: review.py implementation docs/specs/059-google-ads-full-compatibility/spec.md 059-14 rig/first-journey-browser.{mjs,test.mjs,md} rig/qualification-loopback-{network.sb,chrome}; task Browser compliance
---

VERDICT: needs-changes

REASONING:
Fixed localhost scope, sink-backed byte/header/cookie comparisons and fail-closed nonempty307 handling are appropriate. Admission evidence, cleanup/deadline guarantees, matched negatives and final completion remain incomplete. Honest live disclaimers do not close the written ACs.

SPECIFIC ISSUES:
- [Medium] transport/parent are inferred from URL descriptors and last named admission; no actual wrong-transport/invalid-parent control.
- [High] fulfilled fixture is marked complete but response remains null in capture; retain its fulfillment status/headers/bytes explicitly.
- [High] failed context close still removes ownership and detaches guard listeners; outer cleanup cannot retry before detach.
- [High] filesystem preparation precedes deadline enforcement; watchdog restarts full duration; losing timed-out output operations can write after return; CLI output is after watchdog clearance.
- [High] unsupported-surface negatives link to FetchPOST, not matched frame/popup/worker/WebSocket positives. A nonnegative link index is insufficient.
- [High] completion writes intended exit before its own final write/sync/close and CLI output; API equality is not actual CLI exit evidence.
- [Medium] containing directory not fsynced after receipt creation.
- [High] provenance omits executing admission module and Playwright identity.

RECONCILIATION NOTES:
Preserve nonempty307 mechanism-specific gap, post-dispatch finalheader cap limitation and unwitnessed service-worker/public-egress/native boundaries. Do not close slice or spend live slots until required corrections/gates pass.
