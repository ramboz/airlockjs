---
status: DRAFT
dependencies: [022-02, 022-04]
last_verified: 2026-09-01
frame_review: false
---

## Slice 022-03 — page-side sampleRUM cutover + integration proof

> The cutover — **lands last**, only safe once airlock is a COMPLETE `sampleRUM`+enhancer stand-in: 022-02
> (the `top`+`error` checkpoints + sampling) AND 022-04 (the CWV/interaction checkpoints). `sampleRUM` is a
> single function — removing it drops `top`+`error`+CWV **at once** — so a cutover before full parity would
> lose CWV signal. (Corrects an earlier "cutover can proceed for the checkpoints airlock covers" note: it
> cannot be partial.)

**Goal:** Cut the page over to airlock's governed RUM as the **sole** source: remove the inline `sampleRUM`
(the `aem.js` cleanup — done page-side by the integrator; airlock ships the **guidance** + a **demonstration**
in `probes/eds-testbed`), and prove there is **no double-count** and the AEM RUM pipeline still receives its
beacons (now governed, from airlock). This is the coexistence decision (**replace**) landing observably.

**DoR (provisional — firm up post-022-02 + 022-04 + 022-05):**
- ⚠️ Depends on 022-02, 022-04, **and 022-05** (FULL parity: `top`+`error`+`cwv`+the interaction/lifecycle
  checkpoints) — cutting over before full parity drops whatever airlock doesn't yet cover, since removing
  `sampleRUM` is all-or-nothing. (022-05 not yet reserved — add to this frontmatter's `dependencies` when it
  is.)
- `probes/eds-testbed/scripts/aem.js` is the in-repo demonstration surface (the `sampleRUM` to remove).
- **The production-wiring question is resolved HERE** (022-04 deferred it): a RUM-dedicated `createAirlock`
  instance with empty `egressPurposes`, and the main-thread capture wiring (`push({event:"top"})` +
  `startCwvCapture` importing the real `web-vitals/attribution` `onLCP`/`onCLS`/`onINP`) — dedicated worker vs
  connector-generic `core/airlock.js` decided at this point. The cutover needs a real hosted instance to
  point the page at.
- **⚠️ CREDS-GATED, load-bearing before cutover — confirm the `cwv` wire shape against the LIVE AEM RUM
  collector.** 022-04 grounded the CWV *scalar fields* from `web-vitals` types, but the `cwv` *beacon shape*
  (airlock's flat `{name,value,...scalars}` — a possible **superset**) vs what the current enhancer sends +
  what `ot.aem.live` accepts was only corroborated against a stale (2024, pre-attribution) enhancer clone.
  A live probe must confirm the collector accepts airlock's `cwv` (and `top`/`error`) shape; a rejection
  **narrows the `map.js` whitelist to enhancer-parity** (022-04's named fallback) — it does not block, but the
  page must not be cut over onto an unaccepted shape.

**Acceptance Criteria:** _TBD — the eds-testbed page emits RUM via airlock only (no inline `sampleRUM`); a
rig/probe shows exactly one governed RUM beacon per checkpoint (no double-count); the beacon still reaches the
grounded AEM RUM contract; integration guidance (how to remove `sampleRUM` from a real `aem.js`) documented._

**No-go (from mvp4.md):** don't **break** the AEM RUM pipeline — replace its *source*, don't sever it.
