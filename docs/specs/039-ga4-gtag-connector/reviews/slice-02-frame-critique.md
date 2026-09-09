---
slice: 039-02 — Consent Mode state carriage (gcs)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T00:34:17Z
prompt_source: review.py frame-critique <spec> 'Consent Mode state' <slice> (round 3)
---

Frame-critique verdict: **pass** (round 3, independent jig:reviewer, read-only, pre-implementation).

Rounds 1-2 (needs-changes) both concerned gcd; the author excised gcd entirely from 039-02 (moved to 039-05) and
narrowed this slice to gcs STATE carriage only. Reviewer verified the excision is evidence-backed (the capture log shows
gcd co-varies with consent, so removing it from a pure-vector slice is the correct read), and confirmed grounding
against source: core/consent.js:59-67 resolveConsent (granted|denied|pending), connectors/ga4/consent.js:48
(pending-omit). Both gcs anchors (G111 all-granted / G100 all-denied) are live-observed. The central assumption — gcs is
a config-free pure function of the resolved vector (G1<ad_storage><analytics_storage>), derivable on-device — survives.

Non-blocking notes folded before implementation:
1. Residual understated: the signal-SET restriction (gcs depends only on ad_storage+analytics_storage, ignores the two
   data-use signals) is ALSO documentation-only, since the G100 capture denied all four at once. Broadened the residual
   wording; the pre-freeze confirm should include a data-use-only deny. (Live mixed-vector capture attempted but RACED —
   see observed-rules.md — so digit-order + signal-set stay documented-CMv2 residuals, honestly flagged.)
2. Mixed-PENDING behavior undefined: gcs is a joint positional string G1XY (can't omit one digit while keeping the
   other), so the consent.js:48 per-field omit discipline doesn't extend cleanly. Define mixed-pending (e.g. ad=granted,
   analytics=pending) behavior at implementation.
3. Anti-horizontal-phasing "consent parity end-to-end" softened — gcs alone is consent-STATE parity; gcd (defaults) is
   deferred to 039-05.
