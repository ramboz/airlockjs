---
slice: 034-01 — coarse-consent split: analytics flows when only personalization is denied
pass: arch
verdict: pass
reviewer: general-purpose (independent arch review)
reviewed_at: 2026-09-05T16:39:46Z
prompt_source: review.py arch docs/specs/034-alloy-config-followups/spec.md 034-01 <deliverables>
substrate: non-interactive
---

VERDICT: pass — architecture, slice 034-01 (arch_review: true)

The collect-relaxation is architecturally coherent: delegate (shapeAlloyConsent collect:y iff analytics_storage) = liveness from the untrusted chamber; the trusted seam strict-gates the effective purpose set + strips per-event query.personalization off the same live consentRef. Fail-closed PRESERVED (splitPersonalization removes pzn only from the gated set, never analytics → analytics-denied/pending still strict-drop to a hold). Path-precise strip, differential-vs-native-off Edge-safety, and the FAIL-LOUD consent-without-egressPurposes guard hold; the seam-does-not-trust-the-chamber invariant (017/020) is respected + strengthened.

OQ13-1 residual real but PRE-EXISTING (ad_storage was never in the collect gate), honestly disclosed incl. the reach-widening into the common posture, kept OPEN. NOT a blocker. The 'compensated by the endpoint ceiling' over-claim was SHARPENED (follow-on): the ceiling gates fetch (holds the demdex.net ad-sync egress); the cookie-writeback path is ungated, so a client-side demdex/ad_storage cookie WRITE under denied ad_storage is the exact open creds-gated question OQ13-1 must resolve. Wording corrected in slice+consent.js+refinement-todo.
