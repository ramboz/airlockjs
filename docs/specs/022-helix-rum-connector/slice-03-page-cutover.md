---
status: DRAFT
dependencies: [022-02]
last_verified: 2026-08-31
frame_review: false
---

## Slice 022-03 — page-side sampleRUM cutover + integration proof

> The cutover — only safe once 022-02 makes airlock's RUM a complete stand-in (no signal loss).

**Goal:** Cut the page over to airlock's governed RUM as the **sole** source: remove the inline `sampleRUM`
(the `aem.js` cleanup — done page-side by the integrator; airlock ships the **guidance** + a **demonstration**
in `probes/eds-testbed`), and prove there is **no double-count** and the AEM RUM pipeline still receives its
beacons (now governed, from airlock). This is the coexistence decision (**replace**) landing observably.

**DoR (provisional — firm up post-022-02):**
- ⚠️ Depends on 022-02 (complete checkpoint parity) — cutting over before parity would drop RUM signal.
- `probes/eds-testbed/scripts/aem.js` is the in-repo demonstration surface (the `sampleRUM` to remove).

**Acceptance Criteria:** _TBD — the eds-testbed page emits RUM via airlock only (no inline `sampleRUM`); a
rig/probe shows exactly one governed RUM beacon per checkpoint (no double-count); the beacon still reaches the
grounded AEM RUM contract; integration guidance (how to remove `sampleRUM` from a real `aem.js`) documented._

**No-go (from mvp4.md):** don't **break** the AEM RUM pipeline — replace its *source*, don't sever it.
