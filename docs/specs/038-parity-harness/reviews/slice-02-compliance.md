---
slice: 038-02 — semantic field-map oracle (GA4)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-08T18:45:03Z
prompt_source: review.py compliance docs/specs/038-parity-harness/spec.md 'field-map oracle (GA4)' <deliverables>
---

VERDICT: **pass** (jig:reviewer, read-only). All 7 ACs of slice 038-02 met, reusing the unmodified 038-01 `diffParity` engine. AC1 non-tautological: `ctx` from the fixture's `_ga`/`_ga_<stream>` via the real `sourceGa4Ctx` (run-ga4.mjs:31 passes `fixture.cookies`, never `container_fields`); proven by the "different cookie wins" test (:52-57). `tid`→`measurement_id` surfaced from the collect-URL query (ga4-egress.js:27-30); `_et` normalised-out (fixture `_et`=3841 ≠ default 100). All 21 fixture fields classified; DoD coverage matrix backed by non-vacuous tests; `parity:ga4` present + a corrupt-`_ga`→divergent→exit-1 regression.
Non-blocking: AC4's consent gap is asserted at `diffParity` level (:139-151) + reaches the report transitively — no dedicated report-output assertion (functionally met). Reconciliation notes: deviation log + sweep TBD (this phase); capture the ecommerce/`purchase` scope-out (spec Assumptions only) as a tracked follow-up.
