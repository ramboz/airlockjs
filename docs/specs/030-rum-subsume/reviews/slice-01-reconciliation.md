---
slice: 030-01 — the connector-generic unload dispatcher
pass: reconciliation
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-03T23:59:02Z
prompt_source: reconciliation sweep review (030-01)
---

**Verdict: PASS.** 030-01 generalizes the critical/unload dispatcher (a `mapper` DI, default `mapToMp` =
GA4 byte-unchanged) so a worker-mapped connector egresses its unload-critical events via its own main-thread
mapper — proven with RUM's INP reaching ot.aem.live at page-hide (the flagship CWV the frame-critique showed was
dropped/mis-mapped). The craft review's two latent defects (the t:0 drop on the unload path; the silent GA4
fallback for a helix-rum instance missing sampling) and the coverage gap (the real visibilitychange path) are all
fixed + tested; the pixel-GET method option is a recorded follow-on. GA4/pixel/dom byte-unchanged (regression-
pinned, 40 tests). Full suite 962 green, build green (4 workers). No orphans. Ready RECONCILED → DONE.
