---
slice: 059-15 - Exact native policy and one-shot stock capture
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-10-20T23:16:50Z
prompt_source: review.py frame-critique docs/specs/059-google-ads-full-compatibility/spec.md 059-15; Native admission frame 67f9bbeb-35bc-478c-b97c-8a93c9a5d5a2
---

VERDICT: pass

REASONING:
The primary assumption is that SDK-absent qualification can support a safely bounded inspected Meta reference without establishing native completeness beforehand. It survives this read-only attack: physical attempts receive pre-forward checks (rig/inspected-http-wire.mjs:382-420), and native completeness requires source consumption, processing evidence and a nonempty response chain, not merely a callback (rig/inspected-meta-stock.mjs:1193-1219,1288-1299). Preflight avoids self-referential permission hashing, but private receipts remain trusted external evidence: genuine reviews, original-authority location permission and fresh setup/source/window bindings are prerequisites, not authenticity established by hashes (rig/inspected-meta-stock.mjs:270-274,336-371,606-625). ADR-0034 explicitly accepts the distinct TLS cohort while preserving ADR-0033's full-replacement and customer-attribution obligations; this verdict clears neither complete-code review nor SDK admission.

RECONCILIATION NOTES:
No new frame deviation identified. Preserve the opaque-path blocker, historical status of the supplied v2 receipts, unexecuted public/SDK paths and missing admission prerequisites; do not promote this frame pass into a READY manifest or native qualification.

HISTORICAL FINDING PRESERVED:
The earlier needs-changes frame identified browser-internal retries below Fetch/CONNECT observation. Actual H1/H2 receivers subsequently exposed3 requests from2 logical admissions and9 from8, including same-session H2. The opaque transport path remains unqualified. Explicit owner approval and ADR-0034 authorize a distinct inspected Meta reference cohort only; passing local physical controls do not retroactively qualify opaque/native TLS or Google. The original review text is preserved privately before this helper-recorded verdict.
