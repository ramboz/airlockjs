---
slice: 059-15 - Exact native policy and one-shot stock capture
pass: compliance
verdict: needs-changes
reviewer: independent read-only reviewer (explicit gpt-6.1-sol)
reviewed_at: 2026-11-05T23:55:40Z
prompt_source: review.py implementation spec 059 059-15; five-file Google stop correction based on b972ca7e; browser-free source packet only
---

VERDICT: needs-changes

REASONING:
Packet-local landing: no blocker identified in the inspected source and retained test evidence. Google admission stop synchronously destroys owned sockets, direct close establishes the same barrier before awaiting settlement, and pending TLS setup now rejects on socket close (rig/inspected-transport.mjs:287-290,377,391-399); the changes preserve Meta behavior and raw-byte relay semantics. Real Node H1/H2 controls and retained red/green logs meaningfully exercise these corrections, with the peer-authentication control's limitation honestly disclosed. Full 059-15 remains needs-changes: this SDK-free packet does not satisfy its unchanged browser, native-admission and completion gates.

SPECIFIC ISSUES:
- docs/specs/059-google-ads-full-compatibility/plan.md:104-111 - High; existing full-slice gate, not a packet regression: current-source/browser stop and safe guard release remain unqualified with surviving helpers, reconnects and port reuse.
- docs/specs/059-google-ads-full-compatibility/plan.md:113-118 - High; existing full-slice gate, not a packet regression: authenticated permission/review provenance, native transport/lease composition and required qualification remain open; the full acceptance criteria and DoD cannot clear.

RECONCILIATION NOTES:
No additional scope deviation identified. Record only the bounded Google stop correction; preserve source-cohort invalidation, unknown/manual descendant cleanup, the authentication-control caveat and the distinction between retained Node results and unperformed browser/native qualification. ADR-0047's contextual statement that closeAdmission changes only a flag should be marked historical during reconciliation.

## Review scope and coordinator verification

This review covers the bounded Google stop correction from integrated
`b972ca7e5cadb2f2972aee3e4b58a5512f5a5f76`. It does not rereview the earlier
Meta packets or expand their historical review scope. Those records remain
in Git history.

Compliance and craft examined the initial source packet before test-only
hardening. The runtime patch stayed unchanged. Pinned Terra addressed the
craft nits; the final pinned Sol architecture pass examined the exact
baseline patch and revised controls. No fresh full-slice compliance pass or
native safety clearance is claimed.

Coordinator verification of the final test revision passed 395 tests across
twelve files, with 15 opt-in qualification tests skipped. All seven
Node-mocked browser-witness tests ran. Scoped ESLint, source digests and
command logs are retained separately. The test output directory's prior
mode was restored after the run. No browser, SDK, vendor request or original
authority reservation occurred.

The living plan identifies ADR-0047's Context as the source state at decision
time. The Accepted record is unchanged. 059-15 remains IN_PROGRESS with this
non-clearing verdict; 059-01 remains READY_FOR_REVIEW.
