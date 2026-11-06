---
slice: 059-15 - Exact native policy and one-shot stock capture
pass: compliance
verdict: needs-changes
reviewer: jig:reviewer (explicit gpt-6.1-sol; retained 2fdde6a7 turn 4)
reviewed_at: 2026-11-06T05:40:07Z
prompt_source: review.py implementation spec.md 059-15; corrections-compliance prompt plus parent-safety follow-up; exact snapshot b608925e
---

Actual retained reviewer: 2fdde6a7-0ca3-451e-a643-b4900f1c7040, turn 4.
Explicit gpt-6.1-sol. Prompt: google-retained-guard-corrections-compliance-prompt.txt
plus the same-task parent-safety follow-up.
Reviewed snapshot: google-retained-guard-parent-safety-reviewed.patch,
SHA256 b608925efad5f1a08e48a0901a51ae7e2969fce3086089dee8f323e0387a16b6.
Final source hashes: google-retained-guard-parent-safety-manifest.log.

VERDICT: needs-changes

REASONING:
Both packet-local blockers are corrected: bootstrap safely prepares the fixed parent before case creation, capture/invocation reject unsafe parents, and isolated tests no longer depend on pre-existing `rig/out`. The real filesystem refusal controls and supplied 64-test worker green meaningfully support these changes; no packet-local landing blocker remains in this follow-up. Full 059-15 remains needs-changes, 059-01 remains READY_FOR_REVIEW, and native admission stays closed.

RECONCILIATION NOTES:
Preserve the original findings and actual refusal red/green, distinguishing them from the missing-helper failures. Foreign-owner refusal is source-checked but not experimentally exercised; same-owner concurrent mutations remain outside the non-atomic checks’ guarantee.

The parent’s independent rerun remains pending on the supplied evidence. Historical bootstrap status 5 and missing originals remain unchanged. Actual activated-descriptor flags, shared-holder mutation, custody/exclusivity, restart/logout/unload and Chrome/native behavior remain unqualified; this source clearance authorizes no retry or expanded operation.

Parent reconciliation, not a reviewer attestation:
The independent four-file rerun subsequently passed 64 tests, recorded in
google-retained-guard-parent-final-regression.log. C syntax and scoped
ESLint also passed; google-retained-guard-parent-final-eslint.log.
The earlier actual parent-permission and clean-checkout findings are retained
in google-retained-guard-corrections-compliance-first.txt, with their actual
red and correction indexed by google-retained-guard-parent-safety-result.txt.
The source hashes were not changed after this final follow-up.
