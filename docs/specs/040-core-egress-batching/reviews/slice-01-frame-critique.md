---
slice: 040-01 — request-count measurement gate (spike)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T18:10:09Z
prompt_source: review.py frame-critique <spec> 'measurement gate' <slice> (round 4)
---

Frame-critique verdict: **pass** (round 4, independent jig:reviewer, read-only, pre-implementation). A hard-won frame:
rounds 1-3 caught a false-GO (rig cadence forces co-occupancy), then a symmetric false-SHELVE (ignoring that
requestIdleCallback's 50ms timeout force-fires under a busy thread — page load — sweeping same-group events into one
drain), then a residual false-GO-from-(b) (granting GO on "fires during load" rather than the ~50ms-window density bar).
Resolved by making the spike ANALYTICAL (real arrival-vs-rIC timing is unmeasurable without a production stream) over
THREE patterns: (a) synchronous same-task multi-push → by-construction one drain → GO; (b) load-phase rIC-timeout-window
batching → a density ESTIMATE → GO-NARROW only (not "structural"); (c) spread singles → occupancy 1 → no benefit.
SHELVE iff neither (a) nor (b); never by fiat, never on (b)-presence alone.

Source grounding verified by the reviewer: drain mechanics (core/airlock.js:346-355 ring.splice(0,50) +
requestIdleCallback(drain,{timeout:50}); one-fetch-per-ready :248,300; verdict/ceiling seam :254-299). Real
by-construction (a) sites confirmed: adapters/eds/decisions-exposure.js:108-110 (reportAll loops handle.push per
decision — layout-independent), exposure.js:67, and blocks.js:85-98 (IO callback, layout-contingent on ≥2 blocks
visible in one delivery). No purchase/items emission site exists in adapters/ (that example is hypothetical — do not
ground GO on it).

Reconciliation-fold notes (non-blocking): use decisions-exposure.js:108-110 as the flagship (a) (cleanest,
layout-independent) rather than the layout-contingent IO callback; drop/caveat the hypothetical purchase+items example;
tighten AC1(b) to state the ≥2-per-window bar AC3 holds it to.
