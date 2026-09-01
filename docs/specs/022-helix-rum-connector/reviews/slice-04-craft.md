---
slice: 022-04 — CWV checkpoint via `web-vitals` (native runtime capture)
pass: craft
verdict: pass
reviewer: jig:reviewer (orchestrator)
reviewed_at: 2026-09-01T17:50:26Z
prompt_source: review.py craft
substrate: non-interactive
---

Craft (022-04) — PASS (orchestrator-scrutinized; safety-classifier had timed out). The DataCloneError must-fix is genuinely handled by a well-reasoned TWO-LAYER defense: (1) projectCwv uses a STRUCTURAL typeof filter (string/number/boolean only) — cloneable-by-construction, name-agnostic so it's robust against a future web-vitals non-scalar field, reading only name/value off the metric root (entries/id/delta excluded by construction, not by a fallible filter); (2) map.js cwvFields is a NAMED whitelist (CWV_ATTRIBUTION_FIELDS) for outbound wire-hygiene. Independently verified: the whitelist excludes ALL 8 non-cloneable hazard fields (processedEventEntries / longAnimationFrameEntries / largestShiftSource[a live DOM Node] / largestShiftEntry / lcpEntry / lcpResourceEntry / navigationEntry / longestScript). The structured-clone test feeds REAL hazard objects (largestShiftSource:{node}, entry arrays) and asserts structuredClone-safety at BOTH the projectCwv unit level AND end-to-end through startCwvCapture — not a masked stub (it also asserts the INPUT carried the hazards). Emission model (one-per-metric) resolved + reasoned (independent finalization; corroborated by a stale enhancer clone, honestly flagged non-reproducible). startCwvCapture is DI'd (testable). Excluding largestShiftSource closes both a clone hazard AND an info-leak. Scalars grounded from the real web-vitals types. 108/108, lint clean. The two-layer split is justified (distinct boundaries: postMessage-safety vs wire-hygiene), not over-engineering.
