---
slice: 030-01 — the connector-generic unload dispatcher
pass: craft
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-03T23:58:02Z
prompt_source: review.py implementation 030 'unload dispatcher'
substrate: not-shown
applied_skill: none
---

**Verdict: PASS** (reviewer returned NEEDS-CHANGES with 2 real latent defects + a coverage gap; all fixed inline).
- **[Severe] RUM `t:0` on the unload path — FIXED.** `unloadFlush` (airlock.js) reconstructed `{type,params}` from
  the ring descriptor, DROPPING `ts`; `mapToRum` reads it as `t`, so a page-hide INP beacon carried `t:0`. Now
  `unloadFlush` forwards `ts: d.ts` and `pushCritical` stamps `performance.now()`. GA4's `mapToMp` ignores `ts`
  (byte-unchanged). A new test asserts the real unload path egresses a non-zero `t`.
- **[Medium] Silent GA4 fallback for a helix-rum instance missing `connectorConfig.sampling` — FIXED.** A raw
  `createAirlock({connector:"helix-rum"})` without sampling silently re-armed the exact GA4 mis-map this slice
  fixes; now a construction-time `console.error` surfaces it loudly (bootHelixRum/030-02 always passes sampling).
  Tested.
- **[Medium] Coverage gap — FIXED.** The ring-tail unload path (where the `t:0` bug lived) is now driven directly.
- Layering: airlock.js importing `connectors/helix-rum/map.js` mirrors the existing `egress.js`→`ga4/map.js`
  precedent; no cycle. `ctx` (`{referer}`) is the correct 2nd arg for `mapToRum`. GA4/pixel/dom unchanged.
