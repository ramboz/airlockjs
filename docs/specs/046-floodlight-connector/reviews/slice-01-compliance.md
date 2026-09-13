---
slice: 046-01 — core DC ccm/collect beacon off-thread (query-delimited, reuse-complete)
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-13T17:10:02Z
prompt_source: review.py implementation docs/specs/046-floodlight-connector/spec.md 046-01 <deliverables>
---

VERDICT: pass (compliance re-review, 3rd pass — the stale-comment blocker from the prior pass is fixed)

REASONING:
All five acceptance criteria met and exercised by meaningful, non-vacuous tests (negative guards: un-owned `en` drop → fail; non-page_view → []; CLI exits non-zero on a real drop). 046-01's own targeted suites pass (floodlight 14, parity-floodlight-ccm 8, google-ads 22, ga4-gtag 48); `npm run parity:floodlight-ccm` exits 0, verdict pass (8 fields map / 7 normalised-out). The encodeNpa extraction into connectors/consent-mode.js is behavior-preserving (byte-identical; GA4-gtag + AW consumers green). The DC connector is a faithful reuse-complete mirror of the ratified AW pattern — pure, capability-mediated, off-thread, no principle violation. Comment-accuracy fixes verified: the three scrubUrlIdentifiers copies are genuinely byte-identical; DC's CLICK_ID_PARAMS == AW's while Meta's differs (adds ttclid, omits gclaw/gclsrc); the rule-of-three debt is really tracked in docs/refinement-todo.md (§ Spec 038 follow-ups).

SPECIFIC ISSUES:
- [nit][impl] connectors/google-ads/connector.js:28-29 — the "byte-identical to GA4 gtag carriage" parenthetical over-scoped npa (GA4 emits no npa). FIXED post-review: parenthetical now scopes gcs/gcd only, and the duplicate "039 emits no npa" clause was de-duplicated.

RECONCILIATION NOTES (to record in the 046-01 deviation log before RECONCILED):
- npa extracted on its 2nd caller (AW + Floodlight), ahead of the strict rule-of-three, under the conventions' explicit "MAY extract on the 2nd caller when a 3rd is imminent" allowance (docs/conventions.md § Code); justified in the consent-mode.js module doc-comment. Record for traceability.
- New per-vendor redactor/descriptor modules (redact-floodlight-ccm.js, descriptors/floodlight-ccm.js) rather than literal "reuse VERBATIM" of the AW pair — matches the established per-vendor-module pattern; only diffParity/fieldsFromUrl/appendParam/consent-mode encoders/sourceGoogleAdsCtx are reused verbatim. Record the "mirrored, not literally reused" nuance.
- connectors/floodlight/connector.js:~144-148 attaches the source event to each EgressRequest (the 045-01 additive channel) ahead of this slice's stated scope (seal-hold deferred to 046-03) — additive/harmless, mirrors AW 044-02; record as forward-inclusion.
- Deferred cleanup already tracked in refinement-todo (§ Spec 038): extract the now-rule-of-three scrubUrlIdentifiers helper (touches 038+044 redactors).

DoD note: full `npx vitest run` is green (1643) once the concurrent 045-03 core/airlock.js work landed its own test updates; 046-01's changes are not implicated in any failure.

Reviewer: general-purpose subagent, compliance pass, read-only, no implementation context; ran the targeted suites + parity CLI.
