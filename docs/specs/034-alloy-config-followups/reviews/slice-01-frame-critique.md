---
slice: 034-01 — coarse-consent split: analytics flows when only personalization is denied
pass: frame-critique
verdict: pass
reviewer: general-purpose (independent frame-critique, 2 rounds, alloy-source-grounded)
reviewed_at: 2026-09-05T15:33:10Z
prompt_source: review.py frame-critique docs/specs/034-alloy-config-followups/spec.md 034-01 <deliverables>
---

VERDICT: pass (after one needs-changes round) — frame-critique, slice 034-01 (coarse-consent split)

Independent frame-critique traced alloy 2.35.0 source, 2 rounds.

Round 1: needs-changes. The premise HOLDS (alloy can emit an analytics-only interact — the personalization query is built only when shouldRequestDefaultPersonalization() is true), but the chamber-side design was TRUST-INVERTED: suppression in the untrusted chamber + a relaxed main-thread gate, with the chamber notified of consent only ONCE at boot → a granted->denied flip LEAKS query.personalization under an analytics-only gate (AC2+AC4 jointly unsatisfiable chamber-side); + the named controls were wrong (decisionScopes:[] is the default + doesn't suppress; the working control is defaultPersonalizationEnabled:false).

Reshape -> TRUSTED SEAM-SIDE: strip query.personalization from the intercepted interact body in wrapped-sdk-host's intercepted-fetch path, driven by the live consentRef (which setConsent already mutates), + gate the analytics-only interact on [analytics_storage]. A compromised chamber can't leak (the seam removes it); the live consentRef is read per-interact so no chamber re-notify (resolves AC4); defaultPersonalizationEnabled:false demoted to an optional chamber build-avoidance follow-on.

Re-verify: PASS. Two grounding precisions folded into AC2/AC5: (1) REQUIRED path-precision — query.personalization is PER-EVENT (events[i].query.personalization) while query.identity.fetch is TOP-LEVEL; the strip MUST iterate parsed.events[] (reuse stripInterceptedXdmBody's :558 scaffold), not a top-level delete (a silent no-op that ships a leak). (2) a DIFFERENTIAL hermetic proof (stripped-from-ON deep-equals native-defaultPersonalizationEnabled:false, both from @adobe/alloy@2.35.0) grounds Edge-safety creds-free. Live-Edge confirmation a creds-gated residual.
