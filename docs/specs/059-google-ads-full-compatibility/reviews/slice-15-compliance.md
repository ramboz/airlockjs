---
slice: 059-15 - Exact native policy and one-shot stock capture
pass: compliance
verdict: needs-changes
reviewer: jig:reviewer (explicit gpt-6.1-sol; retained 2fdde6a7 turn 5)
reviewed_at: 2026-11-06T05:56:30Z
prompt_source: review.py implementation spec.md 059-15; google-retained-guard-coverage-compliance-prompt.txt; exact test/plan snapshot 60baedde
---

Actual retained reviewer: 2fdde6a7-0ca3-451e-a643-b4900f1c7040, turn 5.
Explicit gpt-6.1-sol. Prompt: google-retained-guard-coverage-compliance-prompt.txt.
Snapshot: google-retained-guard-coverage-reviewed.patch,
SHA256 60baedde07a1d7043ec3d6eda1e452acb31d6d8b4bc1d575c4ae44ff34dc3f4d.
Test hashes: google-retained-guard-coverage-test-sha256.txt.

VERDICT: needs-changes

REASONING:
The two named coverage nits are addressed within the documented test scope: receipt-state assertions exercise the actual writers, and the later-client fixture uses real polling, observes client closure, checks unchanged flags and reaps its child. No packet-local blocker is evident in this test-only/documentation delta. Full 059-15 remains needs-changes, 059-01 remains READY_FOR_REVIEW, and native admission remains closed.

RECONCILIATION NOTES:
- Preserve the instrumentation limit: the real 150 ms empty wait precedes client creation, but this does not prove the uninstrumented infinite poll was already blocked before connection.
- Record the private poll-removal failure as mutation-regression evidence, not a historical production defect or runtime modification.
- Synthetic receipt fields—including `command_invoked: true`—are unit-test metadata, not command-execution evidence or authority.
- The supplied ordinary worker run passed 11 tests; the parent’s 65-test regression remains pending on the supplied evidence. Bootstrap status 5, missing historical originals and all activation/lifetime/Chrome/native qualification gaps remain unchanged. No retry or new numeric budget follows.

Parent reconciliation, not reviewer attestation:
The independent four-file rerun passed 65 tests. Its actual output is in
google-retained-guard-coverage-parent-regression.log; scoped ESLint and C
syntax checks also passed. Test code is unchanged after this review.
