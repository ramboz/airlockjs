---
slice: 038-02 — semantic field-map oracle (GA4)
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-08T18:45:03Z
prompt_source: review.py craft docs/specs/038-parity-harness/spec.md 'field-map oracle (GA4)' <deliverables>
substrate: non-interactive
---

VERDICT: **pass** (jig:reviewer, read-only). Traced the full pipeline (fixture → sourceGa4Ctx → mapToMp/mpUrl → flatten → diffParity); every field classifies as the spec intends; reuse of oracle.js/report.js unmodified confirmed (0 GA4 refs); report-ga4.js wraps, not duplicates. Strengths: the anti-tautology AC1 test, the `_et` anti-coincidence guard (asserts fixture `_et`≠"100" first), the corrupt-`_ga` real-regression subprocess test, wrap-don't-duplicate reuse.
Non-blocking [nit]s → reconciliation log: (1) PRIMARY — the ctx→mapToMp→mpUrl→flatten replay is re-expressed in both run-ga4.mjs and the test's replayFixtureFields (038-01 factored this into replay.js/replayPixelBeacon); no shared `replayGa4Egress` → drift risk, and `emitted:true` is hardcoded (run-ga4.mjs:43) rather than derived. (2) `deriveLogicalEvent` returns Record<string,string|number> widening oracle.js:39's Record<string,string>. (3) naming unevenness (report-ga4 vs ga4-ctx/ga4-egress). (4) unused `fixture.endpoint` (run-ga4 uses `descriptor.endpoint`).
