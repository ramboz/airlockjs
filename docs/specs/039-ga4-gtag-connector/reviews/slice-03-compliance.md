---
slice: 039-03 — session-state reproduction + `_ga_<stream>` writer (closes OQ13-2)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T02:07:02Z
prompt_source: review.py implementation <spec> 'session-state' <deliverables>
---

Compliance verdict: **pass**. Reviewer traced all three regimes byte-for-byte against
parity-ga4-collect-multipage.redacted.json (page1 first-visit, page2 continuation +300s, page3 new-session +2100s>1800s):
cookie `ga_stream_after` + beacon fields reproduce field-for-field. AC1 (host-called read-modify-write writer in
cookies.js; gtag.js pure, projects ctx.sessionState; reuses the 017-02 storageGranted seam; denied path never reads/writes
the jar — spied get/set both un-called). AC2 transition math matches. AC3 OQ13-2 asserts sid REUSE + exact continuation
values. AC4 all three regimes via direct assertion, page-1 also via the 038 diffParity oracle. Non-blocking: GS2_TAIL_DEFAULT
is a module-level mutable array assigned by reference (harmless today; prefer a per-call copy). Reconciliation notes: AC5
legacy-fixture value-threading is projection-only + documented (real math tested on the multipage fixture); host-wiring
deferred (raw-vector contract enforced by docs+test, no shipped caller yet).
