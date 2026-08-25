---
status: CONCLUDED
topic: GA4 Measurement Protocol /debug/mp/collect as an automated conformance oracle
created: 2026-08-25
related:
  - ../reviews/2026-08-25-mvp1-architecture-review.md
---

# R-002: GA4 debug endpoint as a conformance oracle

## Question

Is `https://www.google-analytics.com/debug/mp/collect` a sound automated
oracle for the servo-unattended GA4 route (drive-order step 9), i.e. does an
empty validation response prove the payload is conformant?

## Sources / findings

Primary source: developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events.
Verified 2026-08-25 (fact-check agent, cited in the arch-review Verification
appendix B).

- **Endpoint confirmed**: `/debug/mp/collect` (EU: `region1.google-analytics.com`).
  Identical request format to production; does not write data.
- **What it validates**: structure + naming/schema rules. Documented
  `validationCode`s: `VALUE_INVALID`, `VALUE_REQUIRED`, `NAME_INVALID`,
  `NAME_RESERVED`, `VALUE_OUT_OF_BOUNDS`, `EXCEEDED_MAX_ENTITIES`,
  `NAME_DUPLICATED`. Response: `{"validationMessages": [...]}` with
  `fieldPath`/`description`/`validationCode`; empty array = pass.
- **What it does NOT catch**:
  - Unknown/typo'd event names — GA4 accepts arbitrary custom event names by
    design, so `purchse` passes clean and silently lands as a custom event.
  - Credentials — the debug endpoint **does not verify** `api_secret` /
    `measurement_id`; a bogus secret still returns an empty array.
  - End-to-end ingestion ("events sent to the validation server don't show up
    in reports").
- **Operational**: live external network call; no documented rate limit or
  SLA for the debug path.

## Conclusion

Sound as a *structural/naming* check — a non-empty `validationMessages` array
is a genuine machine-readable defect. **Unsound as a semantic pass**: an empty
array is a weak "pass" (typo'd names, unverified credentials). A variant-race
gated only on this endpoint can be won by a structurally-valid,
semantically-wrong payload.

`ga4_mp_conformance` must be a **two-part oracle**: (1) a hermetic local
golden fixture pinning the exact expected event name + parameter set,
asserted against the built payload (closes the typo gap, no network); (2) the
debug endpoint used only to gate on the *presence* of validation errors,
non-blocking or cached so CI never depends on the third-party call.

Promoted to: arch-review finding G4
([review](../reviews/2026-08-25-mvp1-architecture-review.md)); the two-part
oracle design lands with the spike's servo oracle components (drive-order
step 8).
