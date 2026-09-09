---
slice: 039-01 — core /g/collect page_view beacon
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T01:02:14Z
prompt_source: review.py implementation <spec> 'core /g/collect' <deliverables>
---

Compliance verdict: **pass** (re-review after the bare-object→EgressRequest[] fix). All 5 ACs met:
AC1 handle() returns length-1 EgressRequest[] `[{url,method:"GET"}]` consumable by core/connector-host.js:76's
`for (const req of requests)` loop; AC2 cid/sid via reused sourceGa4Ctx (test threads real _ga/_ga_<stream>);
AC3 no api_secret (structural — no secret input); AC4 MP map.js + contracts/ga4-mp* byte-identical (golden-hash);
AC5 real 038 diffParity oracle, core fields classify `maps`, gap fields `expected-dropped`, negative control
(delete `en`) → fail. Tests non-vacuous. Reconciliation item: transcribe the deferred manifest/init deviation into
the formal deviation log.
