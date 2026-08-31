---
adr: 0012
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (2 rounds, independent census)
reviewed_at: 2026-08-31T04:54:47Z
prompt_source: review.py frame-critique + tailored re-review
---

# Frame-critique — ADR-0012 (Event-payload read-boundary governance, OQ11)

**VERDICT: pass** (re-review after fixing the crossing-census completeness flaw).

## History
- **Round 1 → needs-changes.** The core model SURVIVED (input-side denylist not allowlist; "input ≈ egress
  for GA4" true vs map.js:59-60; non-mutating obligation grounded; alloy/OQ3 carve-outs honest). BUT the
  "both crossings" enumeration was INCOMPLETE: `flushNow()` (airlock.js:310) is a THIRD chamber crossing —
  an identical async `postMessage({type:"events",batch})` on the public handle (adapters/eds/index.js:377) —
  so an implementer governing only `drain()` would ship raw params (the non-mutating ring keeps raw
  descriptors), the exact hole the ADR warns about.
- **Fix.** Re-cast to route the two async posts (drain + flushNow) through ONE governed `sendBatch` chokepoint;
  named the sync dispatcher as the second point; extended Assumptions grounding to airlock.js:310; added the
  `params` (runtime) vs `payload` (contract) reconciliation note.
- **Round 2 → pass.** Independent census of core/airlock.js confirmed the set is FULL: four params-crossing
  call sites (drain 194, flushNow 310, pushCritical 260, unloadFlush 212) collapse into TWO governed
  chokepoints — `sendBatch` (async pair) + the shared `criticalDispatchGated`→`critical.dispatch`→mapToMp
  (sync pair); init (108, ctx-only) + setConsent re-fetch (already-mapped) correctly excluded. No fourth
  path. sendBatch design sound (flushNow hits the identical serializer; unloadFlush correctly routed to the
  sync point). All new grounding claims verified. The frame survives.

## Note-level nits folded in
- Placement heading recast from "ALL THREE entry points via ONE async chokepoint" to "TWO governance points
  covering all four call sites" — (A) the async `sendBatch` chokepoint (drain+flushNow), (B) the shared sync
  dispatcher before `mapToMp` (pushCritical+unloadFlush) — so "one async chokepoint" is not misread as a
  single global governance point.

## Reconciliation obligations for the implementing spec (019)
- Governance at TWO points: (a) `sendBatch(batch)` both drain+flushNow route through; (b) before the single
  sync `mapToMp` (inside criticalDispatchGated/createCriticalDispatcher) so pushCritical+unloadFlush covered.
- Non-mutating: a governed COPY crosses; the log/projection retain the raw descriptor (airlock.js:241,243);
  setConsent flushes beacons mapped from the already-governed batch → no leak.

Reviewer: jig:reviewer (independent, read-only, 2 rounds; round 2 did a full independent census). Prompt:
review.py frame-critique (round 1) + tailored re-review (round 2).
