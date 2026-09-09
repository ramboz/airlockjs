---
slice: 040-01 — request-count measurement gate (spike)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T18:24:27Z
prompt_source: review.py implementation <spec> 'measurement gate' <slice+source> (re-review)
---

Compliance verdict: **pass** (spike honesty re-review). The GO is honestly earned. Verified against source:
`blocks.js:85-100` `onIntersect` is a non-async callback looping `handle.push` (`:96`) with NO await → N co-delivered
entries provably land in one drain (`push`→`schedule`→`requestIdleCallback(drain,{timeout:50})` is a macrotask that
cannot preempt synchronous JS) → by-construction, timing-independent co-occupancy; the layout-frequency caveat (≥2
co-visible blocks) is honestly separated. The decisions/`deliver` path (`index.js:888-911`) is genuinely async (await
per push) → microtask-ordering-contingent, correctly demoted to a bonus; `reportAll` verified rig-only (no production
caller). Outcome + both request-count examples match the corrected characterization; no overclaim. Round-1 review caught
a rig-synchronous false-GO (reportAll cited as production by-construction) — corrected to rest GO on blocks.js:96.
