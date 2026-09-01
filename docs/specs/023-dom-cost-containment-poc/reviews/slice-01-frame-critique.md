---
slice: 023-01 — costly tag contained + measured (the INP scoreboard)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (independent)
reviewed_at: 2026-09-01T19:43:12Z
prompt_source: review.py frame-critique
---

Frame-critique — 023-01 (DOM-cost containment POC / INP scoreboard). VERDICT: pass (premise holds; 3 must-fix folded). Independent reviewer verified the load-bearing premise mechanically + against node_modules/web-vitals: a chunk-and-yield scheduler CAN contain INP for chunkable per-element work; the vertical (a measured scoreboard, not a scheduler in isolation) is legitimate; the falsification clause is real; grounding solid (no scheduler taxonomy in source, web-vitals dep, the cited seams). THREE MUST-FIX folded into AC1/AC3/AC4 + spec Assumptions:
(1) MEASUREMENT: "INP p75 via web-vitals onINP from N clicks on one page" is unachievable — onINP emits ONE per-page p98-estimate at page-hide (onINP.js:86,129-131). Use the repo's PROVEN method (rig/harness.html:30-74): raw Event-Timing PerformanceObserver -> within-storm p75/p98/max; N page loads per mode + median + noise band (rig/cwv-budget.mjs:16-20's noise discipline). onINP only alongside, for field-fidelity, never instead.
(2) FIRST-TASK PRECONDITION (the mechanically-critical fact omitted): INP counts the interaction's FIRST task (input delay + the first synchronous chunk before the first yield); later yields can't rescue a large first chunk. The querySelectorAll prefix + first batch must fit budget (or yield-first) — else the "airlock" number is accidentally tanked or gameable.
(3) FIXTURE FLAVOR + FAIRNESS: the dominant cost must be the CHUNKABLE per-element loop (layout-thrash flavor), NOT querySelectorAll (monolithic-sync = Lever 2, deferred) — stated so the fixture doesn't imply it contains a case it defers. Fairness made OBSERVABLE: pin cadence (rig/measure.mjs:36-37) + report work-completed on both modes + the naive INP breakdown, so "same total work" is verified not asserted. Grounding probes to run at impl: scheduler.yield/postTask availability + MessageChannel/isInputPending fallback; confirm querySelectorAll is not the dominant sync cost.
