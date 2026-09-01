---
slice: 022-01 — governed page-view RUM beacon (+ A/B grounding)
pass: craft
verdict: pass
reviewer: jig:reviewer (orchestrator)
reviewed_at: 2026-09-01T15:39:13Z
prompt_source: review.py craft
substrate: non-interactive
---

Craft (022-01) — PASS (orchestrator-scrutinized, not rubber-stamped). Two subtle points independently verified sound: (1) the exact-match endpoint ceiling works because `weight` is fixed ONCE at construction, so manifest endpoints[0] === handle()'s runtime URL (both from the same {collectBaseURL, weight}) — no variable-path mismatch; (2) not-consent-gated is REAL on core/airlock.js:163 (consent gate gated on egressPurposes.length) + :194 (ceiling gated on ceiling.length), proven by a MEANINGFUL contrast test (the identical beacon IS held under egressPurposes:["analytics_storage"]; a consent DENIAL wired elsewhere doesn't touch the RUM path). map.js is 5-field-by-construction (the potential 6th field uaExtra is a main-thread navigator.webdriver signal the chamber can't read — hygiene by construction, correctly reasoned). Sampling (id/isSelected) fixed once = mirrors sampleRUM's per-page state (a future multi-checkpoint page carries a consistent id). The compromised-connector ceiling test (evil collectBaseURL held by the host pin) proves the real threat model. Mirrors GA4 faithfully; no over-engineering.
