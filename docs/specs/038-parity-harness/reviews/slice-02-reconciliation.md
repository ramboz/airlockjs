---
slice: 038-02 — semantic field-map oracle (GA4)
pass: reconciliation
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-08T18:56:28Z
prompt_source: review.py reconciliation docs/specs/038-parity-harness/spec.md 'field-map oracle (GA4)'
---

VERDICT: **pass** (independent jig:reviewer, read-only). The deviation log + sweep are faithful to what was built — every headline claim verified against code/docs: the shared `replayGa4Egress` pipeline (`rig/parity/ga4-replay.js`) is real and used by BOTH the CLI (`run-ga4.mjs`, `emitted` derived) and the test (`replayFixtureFields`) — no duplication remains; the `oracle.js` `deriveLogicalEvent` typedef widening is a disclosed JSDoc-only touch with 0 GA4 leakage (grep-confirmed); the inbox ecommerce follow-up is present; and ADR-0020's stale `partial` parenthetical is genuinely flagged-NOT-amended (intact at adr-0020:119-120). Scope clean — `report.js` + `connectors/**` unmodified, `oracle.js` = 1-line JSDoc only, no undisclosed changes; the new seams (descriptor/ctx/egress/replay/report-wrapper) are each justified by GA4's different-protocol nature, and `ga4-replay.js` is a de-duplication (leanness improvement), not over-build.
No specific issues. Notes (informational): the cumulative branch-diff conflates prior units — the 038-02 sweep correctly scopes to its own footprint; the DoD checkboxes are unticked at REVIEWED (ticked at the DONE transition, consistent).
