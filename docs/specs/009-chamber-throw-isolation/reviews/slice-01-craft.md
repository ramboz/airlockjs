---
slice: 009-01 — per-descriptor isolation in the chamber
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-08-28T01:19:53Z
prompt_source: review.py pr-review
substrate: non-interactive
---

Craft 009-01 — PASS (no blockers). STRENGTHS: catch placement around the whole descriptor (correct per-descriptor granularity); the typeof-self guard is a clean minimal worker/Node split. NITS (ADDRESSED post-review): (1) reason:err.message would be undefined for a non-Error throw -> made defensive (err&&err.message!=null?err.message:String(err)). (2) dropped entries lacked an index so two same-type drops were indistinguishable -> added `index` (helps 09-02 diagnosability). (3)[nit] AC4 test asserts structural fields not literal byte-identity (semantically adequate; not tightened). (4)[nit] AC3 survival is true-by-construction for a pure mapBatch (inherent to the frame-critique-blessed extraction). NOTED-not-fixed: cfg param shadows module-level cfg (harmless — param wins in the pure fn; module cfg used only in onmessage).
