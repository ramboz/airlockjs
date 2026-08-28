---
slice: 009-02 — chamber failure observability (surface drops + crashes)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-28T01:33:10Z
prompt_source: review.py implementation
---

Compliance 009-02 — PASS. AC1: worker.onerror registered (airlock.js:83-91), surfaces {level:error,kind:chamber-error,message,filename?,lineno?} via the diagnose seam; degrades gracefully (message→String(err); filename/lineno spread-conditional so a partial ErrorEvent never yields an empty record). Backed by chamber-observability.test.js:46-63 (full fields) + :65-75 (degradation). AC2: each dropped[] entry surfaced with type+reason(+index) after the unchanged ready-dispatch loop (airlock.js:69-74); asserted on the surfaced RECORD (:89-106), not "no throw". AC3: happy path silent (surfacing gated on dropped.length + the error event); asserted :139-148. Single injectable seam (diagnose, :37) — no hard-coded console at either drop/error site (the residual console.warn at push/pushCritical guards is pre-existing, out of scope). ready-dispatch regression-free (only ready drives fetch, :61; verified :150-160). chamber.worker.js untouched. Mutation-verified red→restore on the surfaced-record assertions.
