---
slice: 009-02 — chamber failure observability (surface drops + crashes)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-28T01:07:39Z
prompt_source: review.py frame-critique (re-review)
---

Frame-critique 009-02 (re-review after reframe) — VERDICT PASS. The reframe resolves the prior over-claim: AC1/goal now assert the failure is SURFACED/observed and explicitly disclaim page-containment as the assertion ("the Worker boundary already guarantees that"); the DoD mutation test hangs on the surfaced-record assertion, not "no unhandled main-thread throw"; the slice + spec.md Overview reconcile Q1 honestly (MVP1 = page-containment-free + diagnosability; "restart" NOT delivered, deferred OQ9). Non-vacuous confirmed: core/airlock.js:48 registers only worker.onmessage, no worker.onerror, reads only e.data.ready — so both crash-surfacing and drop-surfacing are genuinely absent today. The remaining exposed assumption (a worker.onerror error is diagnosable) holds: the chamber is same-origin/module (new URL("./chamber.worker.js", import.meta.url)), so its ErrorEvent carries message/filename/lineno rather than cross-origin "Script error." sanitization. NON-BLOCKING notes for implementation: (1) the surfaced record should explicitly capture message+filename+lineno so a stray cross-origin/messageerror case degrades gracefully rather than an empty record; (2) dependency-ordering — 009-01 (which supplies {ready,dropped}) is not yet implemented; correctly declared as 009-02 dependencies:[009-01].
