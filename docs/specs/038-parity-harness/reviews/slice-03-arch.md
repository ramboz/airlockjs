---
slice: 038-03 — credential/cookie transport-parity report (feeds E10)
pass: arch
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-08T21:05:31Z
prompt_source: review.py arch <spec> 'transport-parity report' <deliverables>
substrate: non-interactive
---

VERDICT: **pass** (jig:reviewer, read-only). The `transport` field is a sound, minimal extension of the ParityDescriptor contract: optional in the typedef, read only by transport-report.js, structurally invisible to diffParity (body untouched; report.js reads fields explicitly). The two-owner model is clean + correct — cross-site-cookie ownership declared inline (fr/IDE can't live in gapMap, not beacon fields) while first-party ownership is READ from the descriptor's gapMap (firstPartyIdentity: string[] is owner-less → duplication structurally impossible; test-proven). Report/oracle boundary respected: run-transport always exits 0, no verdict, no verdictExitCode.
Strengths: contract-surface discipline; gapMap single-source-of-truth; report/no-gate boundary; two-owner representation.
Non-blocking [nit] → reconciliation: transport-report.js:113's "not in gapMap → gap-free" leans on an implicit invariant (every firstPartyIdentity field is also an attributionField, so diffParity gates it red on drop). Sound as built, but a future descriptor listing a first-party field OUTSIDE attributionFields would false-green here. Suggest an assertion that every firstPartyIdentity entry is an attributionField, or a one-line note. Also note (deliberate): `transport` is optional in the typedef yet required (fail-loud throw) by the report.
