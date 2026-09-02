---
slice: 026-01 — Meta Pixel through the generic connector, governed + dispatched (the archetype proof)
pass: compliance
verdict: pass
reviewer: jig:reviewer (independent)
reviewed_at: 2026-09-02T22:43:50Z
prompt_source: review.py implementation
---

Compliance (implementation review, 026-01) — PASS. All 10 ACs genuinely met by non-vacuous tests (verified by an
independent reviewer, not the implementer's self-report). Security-property ACs are real, not nominal: AC6's
held→flush-as-GET breaks if the :176 method capture is deleted; AC8 is a real input-side strip with `email`
explicitly wired into the instance payloadDenylist (DEFAULT_DENYLIST is password/ssn/cvv/card only, so it's not
accidentally trivial); AC7 confines to facebook.com via the host ceiling; AC10 gates the unload wiring while
leaving the GA4 `critical` constructed, proving a ring-resident pixel event is dropped, not mis-mapped. Core
change bounded to the DoD-named sites; core/egress.js behaviorally unchanged; GA4 regressions co-located + genuine;
no live identifiers or secrets (synthetic 000000000000000; all assertions against a fetch spy). The 5 disclosed
deviations + parked residuals are honest and none breaks an AC. Two Medium non-blockers flagged: (a) the
pushCritical raw-seam still GA4-shaped for a pixel instance (elevated to a craft BLOCKER and FIXED in the
remediation round — a core connector guard now closes it); (b) build.mjs lacks the pixel-worker bundle entry
(parked to inbox; a real-EDS-rollout gap, out of this slice's Node/vitest scope). Verdict-preservation confirmed.
