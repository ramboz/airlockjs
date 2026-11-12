---
slice: 051-01 — read-only access preflight
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-10-09T03:23:04Z
prompt_source: review.py pr-review --richer-skill pr-review; local craft with test-template supplement
substrate: not-shown
applied_skill: none
---

VERDICT: pass

REASONING:
Reviewed architecture/maintainability, reliability, security, QA and operator impact; LLM systems and GitHub workflow are outside this utility's scope. The implementation keeps schemas, readbacks and orchestration separate, constructs secret-safe reports from fixed primitives, and has meaningful negative tests for refusal, failure precedence and resource limits. One non-blocking filesystem-cancellation limitation remains. This was source-only review, without test execution, private-state access or live calls; the real exit-1 result still blocks 051-02.

SPECIFIC ISSUES:
- [nit][impl] probes/adobe-compatibility/preflight.mjs:236; probes/adobe-compatibility/contract.mjs:91: N1. The private-read timeout wins Promise.race without cancelling readJson. A stalled filesystem operation can retain its handle and continue reading/parsing after the timeout report. Consider cooperative deadline/cancellation checks between reads, with a regression confirming subsequent reads stop.
- [strength][impl] probes/adobe-compatibility/preflight.mjs:38-65: Unexpected thrown objects become fixed categories; reports never copy upstream/operator data and deeply freeze the public result.
- [strength][impl] test/adobe-preflight-transport.test.js:184-255: Tests preserve the omitted-workspace unknown and verify aggregate exhaustion through request/read/cancellation counts.
- [strength][spec] probes/adobe-compatibility/README.md:205-218: Operator guidance preserves the required unknown, names the Admin Console step and requires reviewed evidence before any manual fallback.

RECONCILIATION NOTES:
Retain shared helpers/harness and frame-approved dotted-scope correction. Record N1 as a resource-handling residual, not a readiness waiver. Preserve historical, hermetic and real evidence distinctions: 11 required checks ready, workspace snapshot unverified, owner unavailable, 051-02 blocked. Architecture/reconciliation and product-outcome gates remain separate. Optional deeper security follow-up was recommended but not run.

FINAL TEST-TEMPLATE SUPPLEMENT: pass

The digest is derived with Node crypto once before cloning, independently of the production helper. This is fixture preparation, not a tautological assertion. Token mutations retain the original expected digest and must still produce scope_mismatch; its redaction sentinel remains. Source inspection only, no independent test/scan execution.

Document the null template placeholder and harness hydration before writing synthetic files. No production schema or authority change is implied. N1 and the real workspace unknown remain unchanged.
