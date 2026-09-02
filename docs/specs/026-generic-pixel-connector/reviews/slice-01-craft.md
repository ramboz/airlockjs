---
slice: 026-01 — Meta Pixel through the generic connector, governed + dispatched (the archetype proof)
pass: craft
verdict: pass
reviewer: jig:reviewer (independent, 2 rounds)
reviewed_at: 2026-09-02T22:43:50Z
prompt_source: review.py pr-review
substrate: non-interactive
---

Craft (pr-review, 026-01) — NEEDS-CHANGES → PASS after remediation (both verdicts by the same independent
reviewer). Strengths: the declarative-map interpreter is genuinely vendor-neutral (proven by an acme fake-vendor
config running a wholly different wire shape through the same code — vendor specifics are data, not code); the AC8
PII-strip test is an exemplary, non-vacuous security proof; fetchInit is the minimal correct method-aware form
(GET→no body; POST byte-unchanged, regression-pinned); AC6's held-GET-flush proven end-to-end.

Round 1 (NEEDS-CHANGES): (1) [BLOCKER] pushCritical is a SECOND raw-createAirlock-handle entry into the GA4
`critical` dispatcher that the frame-critique's own mis-map enumeration missed — a pixel instance with granted
consent would GA4-map + POST to facebook.com/tr, the exact mis-map AC10 exists to prevent, via an entry the unload
gate doesn't close. (2) [causality nit] AC10's unload test passed even with its gate deleted, because the consent
gate (no consent set) masked it. (3) [optional] the pixel chamber shipped WITHOUT the egress-confinement first-import
guard the GA4 chamber has — a questionable scope call for an ad-vendor egress chamber.

Remediation (all verified genuine in source, round 2 → PASS): (1) core/airlock.js pushCritical early-returns +
diagnoses for a pixel instance before any GA4 routing — the second mis-map entry closed at the exported factory;
new consent-granted no-op test + a connector-scoped GA4 regression. (2) AC10 unload test now grants consent, so the
counterfactual (gate removed) genuinely fetches + fails — it now discriminates the :277-280 gate. (3) built
core/confine-pixel-chamber.js (withholdFetch:true) as the pixel chamber's first import, source-order + withholdFetch
regression-pinned. No new defect introduced. The GET-only interpreter boundary is a clean, non-breaking forward
extension point for 026-02's POST-body vendor (fetchInit already honors r.method) — not debt.
