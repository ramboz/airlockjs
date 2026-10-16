---
slice: 059-13 - Paired validation admission component
pass: compliance
verdict: needs-changes
reviewer: jig:reviewer (Admission compliance)
reviewed_at: 2026-10-16T22:17:46Z
prompt_source: review.py implementation docs/specs/059-google-ads-full-compatibility/spec.md 059-13 rig/first-journey-admission.{mjs,test.mjs,md}; task Admission compliance
---

VERDICT: needs-changes

REASONING:
AC1, AC3, AC4 and AC6 substantially align. AC5 provides meaningful real-receiver positive, denial, bypass, redirect and marker-loss controls, but concurrency tests miss an AC2 crash-durability gap. This read-only reviewer did not execute tests/lint.

SPECIFIC ISSUES:
- rig/first-journey-admission.mjs:154-155 — High confidence: parent-directory fsync is conditional on this instance creating the journal directory. Another instance can adopt the directory after mkdir but before its creator fsyncs the parent, and issue permission without guaranteeing durability of the journal's parent entry. Sync the parent even for an existing directory and add interrupted-creation/fsync-order coverage.

RECONCILIATION NOTES:
Resolve before retaining unconditional durable one-shot claims; preserve the network-agnostic trusted-attestation boundary and false live/compatibility claims.
