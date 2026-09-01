---
slice: 022-04 — CWV checkpoint via `web-vitals` (native runtime capture)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (independent)
reviewed_at: 2026-09-01T16:51:11Z
prompt_source: review.py frame-critique
---

Frame-critique — 022-04 (CWV via web-vitals/attribution). VERDICT: pass. Independent reviewer verified the
LOAD-BEARING premise directly against node_modules/web-vitals: web-vitals/attribution is INP-safe — onINP
defers per-interaction bookkeeping via whenIdleOrHidden and computes attribution only in the onReport wrapper
at report-time (visibility-hidden); capture is main-thread, only the mapped beacon crosses. The capture→chamber
split is correct + honestly owned. ONE MUST-FIX (folded into AC1/AC2/DoD): the raw web-vitals attribution
object carries NON-structured-cloneable PerformanceEntry sub-objects (processedEventEntries /
longAnimationFrameEntries / longestScript.entry) → pushing them through push()→worker postMessage throws
DataCloneError + breaks the drain; the capture-layer module MUST project attribution to cloneable SCALARS on
the main thread before push(), AC1 grounds WHICH scalars, and the DoD test must assert structuredClone-safety
(not be masked by an over-simple stub). Should-consider folded: parity-superset FALLBACK (default whitelist to
enhancer-parity; superset only if a live collector probe confirms); one-beacon-per-metric-vs-combined flagged
as a DESIGN fork (combined ⇒ buffering); AC2 Observable made honest (stubbed callback + deferred production
wiring); DoD "no new main-thread cost" → "no new INTERACTION-PATH cost / INP-safe" (the attribution build DOES
add a 2nd PerformanceObserver, off the hot path); web-vitals already installed (^6.2.1); reload checkpoint-list
inconsistency fixed. Reconciliation notes added to the DoD: the main-thread-capture deviation (accepted,
grounded) + 022-05 as a new 022-03 dependency.
