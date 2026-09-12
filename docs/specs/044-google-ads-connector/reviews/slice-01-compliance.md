---
slice: 044-01 — core AW page-load beacon off-thread (Consent-Mode + auid, parity-confirmed)
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-12T02:34:39Z
prompt_source: review.py implementation (re-verified)
---

VERDICT: pass (re-verified after the AC1-wording fix; the initial pass returned needs-changes)

REASONING:
Both prior findings are addressed. AC1 is now met at the connector-contract level (handle() returns the {method:"GET"} EgressRequest[] that core/airlock.js dispatches for pixel/gtag, verified end-to-end by the 038 parity replay), and boot/worker wiring is an explicit Out-of-scope item with a named owner — a future 041-style boot slice for connectors/google-ads/ (mirrors the 039-01->041 precedent). The connector-shape decision is recorded as a lightweight decision + the extract-on-third-caller convention (owner's convention-not-ADR ruling, within authority). The update also correctly relocated the gtag-family encoders core/->connectors/consent-mode.js (Google wire-shapers are vendor-coupled, not core-neutral); the move is clean — no dangling refs, connectors/consent-mode.js imports resolveConsent via ../core/consent.js (connector->core, allowed), all imports + tests updated, core-boundary.test.js rescoped to core/query-params.js. All five ACs met with meaningful non-vacuous tests (negative controls in parity-google-ads.test.js), no correctness bugs, no design-principle violations, clean all-synthetic fixture.

SPECIFIC ISSUES:
(none)

RECONCILIATION NOTES:
- Record the AC1 deviation: this slice ships the connector contract + 038 parity replay only; boot/worker wiring (core/airlock.js branch + google-ads chamber worker + adapter/config selection) deferred to a future 041-style boot slice (mirrors 039-01->041).
- Record the AC2/module-home correction: gcs/gcd encoders extracted connectors/ga4/gtag.js -> connectors/consent-mode.js (connector-side, not core/, since they emit Google wire strings) per the extract-on-third-caller convention; behavior-preserving (verbatim move).
- Complete close-out: docs/architecture.md connectors section to name connectors/google-ads/ + connectors/consent-mode.js; register namespace airlock/google-ads.
- Minor: the Close-out checkbox still frames the connector-shape ADR conditionally ("if ratified load-bearing") — superseded by the DoD's convention-not-ADR ruling; update it to point at the lightweight decision.

Reviewer substrate: general-purpose subagent running the jig:independent-review compliance rubric; read-only; no implementation context. Re-verified verdict overwrites the initial needs-changes in place (ADR-0014 §4).
