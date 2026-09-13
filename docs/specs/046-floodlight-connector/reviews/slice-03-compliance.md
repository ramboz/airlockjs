---
slice: 046-03 — DC opts into hold-until-granted, both forms (ad_storage-denied parity)
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-13T19:00:05Z
prompt_source: review.py implementation ... 046-03
---

VERDICT: pass (compliance — all 4 ACs + the fan-out robustness guard met)

REASONING:
Both DC beacons opt into holdOnDenied + carry distinct construction-time remapKeys ("ccm"/"activity"); createFloodlightRemap is key-aware, re-sources the linker id under granted ad_storage, re-encodes gcs/gcd/npa from the passed consent via the shared encoders, and is non-throwing per form. Verified the full chain: seal flush (airlock.js:762-766) threads the preserved remapKey (:461) to remap; encoders (G100/G111, npa 1/0), _gcl_au→auid (parseGclAuId), and the ceiling segment-anchored prefix (endpoint-ceiling.js:124-128) behave as asserted. Tests non-vacuous: denied-hold fails if holdOnDenied unwired; grant test pins re-map-not-resend (granted gcs=G111/npa=0 + re-sourced auid/auiddc; stale G100/npa=1 gone); robustness test asserts setConsent doesn't throw (fails if the guard is removed). Full suite 108 files / 1685 green; seal file 13/13.

SPECIFIC ISSUES: (none — no correctness/security/principle/test-quality findings)

RECONCILIATION NOTES:
- Record the spec-sanctioned divergence from the pure createGoogleAdsRemap mirror: createFloodlightRemap wraps the whole rebuild in try/catch → undefined (required by the slice Robustness section for the N-way fan-out); createGoogleAdsRemap does not (1:1, blast-radius 1).
- Provenance note (immaterial): the additive EgressRequest.event channel was committed with 046-01/02; 046-03's delta is the remapKey additions + createFloodlightRemap.

Reviewer: general-purpose subagent, compliance pass, read-only, no implementation context; verified the seal chain + ran the full suite.
