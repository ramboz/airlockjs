---
slice: 014-03 — converge connector-hosting (GA4 retrofit)
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T19:14:48Z
prompt_source: review.py frame-critique docs/specs/014-mvp3-wrapped-sdk-core-integration/spec.md 014-03 slice-03-converge-hosting.md
---

## Frame-critique — slice 014-03 (GA4 hosting convergence) — **pass** (frame-tightening applied)

The two highest-value load-bearing premises both survive grounding against the actual code — and are
PRE-COMMITTED by the 012 connector contract (which explicitly names GA4 as a target archetype) + by
`routeBatch`'s `{ready, dropped}` shape matching `mapBatch`:
- **[2] batch→per-event feasibility SOUND** — `mapToMp` is pure/stateless/ctx-fixed, so per-event
  `handle()` reproduces byte-identically (order, per-descriptor containment, per-tracker fan-out).
- **[3] airlock.js rewire BOUNDED** — the generic GA4 worker preserves the exact protocol, so
  `onmessage`/`drain`/`ring`/`projection` stay untouched; only the Worker URL + init payload change.
  The unload path is worker-independent (`egress.js` imports `mapToMp` directly) → can't regress.

All 5 findings were frame-tightening, applied:
- **[1] AC4 wording over-claimed** ("airlock.js hosts both connectors") → corrected to "one hosting
  MECHANISM (createConnectorHost inside both chambers), NOT one orchestrator": airlock.js stays the GA4
  orchestrator (path i), alloy stays on the separate wrapped-sdk-host — don't route alloy through
  airlock.js.
- **[2] impedances surfaced in AC1/AC2** — (a) GA4 has NO manifest today (author one); (b)
  `event.params` vs `AirlockEvent {payload,snapshot}` → feed `handle` the legacy `{type,params}`
  descriptor (the bridge alloy uses), leaving `mapToMp` untouched; (c) re-home the `busy(workFactor)`
  loop; plus the async init-before-events sequencing note.
- **[4] sync-unload enforcement difficulty NAMED** — the sync unload egress bypasses the manifest+seal
  and can't call an async seal-gate; MVP3's enforcement inherits a hard synchronous-gating sub-problem
  (out of 014-03 scope, but flagged so it isn't discovered late).
- **[5] rig-broker retirement gated with a split tripwire** — keep only as mechanical delete+redirect;
  split it out the moment the redirect proves non-mechanical (an alloy artifact, orthogonal to GA4).
