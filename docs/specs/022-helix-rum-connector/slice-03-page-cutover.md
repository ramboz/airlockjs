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

**DoR (provisional — firm up post-022-02 + 022-04):**
- ⚠️ Depends on 022-02 **and** 022-04 (FULL checkpoint parity: `top`+`error`+CWV) — cutting over before full
  parity drops whatever airlock doesn't yet cover, since removing `sampleRUM` is all-or-nothing.
- `probes/eds-testbed/scripts/aem.js` is the in-repo demonstration surface (the `sampleRUM` to remove).
- The production-wiring question (a RUM-dedicated `createAirlock` instance; dedicated worker vs
  connector-generic `core/airlock.js`) must be resolved by 022-04 at the latest — the cutover needs a real
  hosted instance to point the page at.

**Acceptance Criteria:** _TBD — the eds-testbed page emits RUM via airlock only (no inline `sampleRUM`); a
rig/probe shows exactly one governed RUM beacon per checkpoint (no double-count); the beacon still reaches the
grounded AEM RUM contract; integration guidance (how to remove `sampleRUM` from a real `aem.js`) documented._

**No-go (from mvp4.md):** don't **break** the AEM RUM pipeline — replace its *source*, don't sever it.
