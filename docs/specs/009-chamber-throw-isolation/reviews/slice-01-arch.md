---
slice: 009-01 — per-descriptor isolation in the chamber
pass: arch
verdict: pass
reviewer: arch-review
reviewed_at: 2026-08-28T01:19:54Z
prompt_source: review.py arch-review
substrate: non-interactive
---

Arch 009-01 — PASS (no load-bearing problem). {ready}->{ready,dropped} additive (airlock.js:49 destructures only ready), giving 09-02 a coherent field. mapBatch a clean pure boundary (no self/postMessage) consistent with ADR-0002 "the worker maps"; the self.onmessage shell only marshals I/O. Per-descriptor try/catch realizes ADR-0001 containment at this seam; chamber-level residuals correctly deferred to 09-02. NITS: cfg param shadow (noted); the const event unpack sits just outside the try -> a malformed/null batch entry would throw out of mapBatch (chamber-level, deferred to 09-02, unreachable today via push() validation). RECONCILIATION NOTES (recorded): (a) the unload/critical path (airlock.js unloadFlush -> critical.dispatch) maps on the MAIN thread and does NOT route through mapBatch, so a throwing descriptor in the unload window has undefined isolation on the critical path -> follow-up. (b) the {ready,dropped} reply shape has no formal contract artifact -> 09-02 decides if it warrants pinning.
