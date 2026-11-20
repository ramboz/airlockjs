---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-20]
last_verified:
---

## Slice 064-25 — Interact notification parity

**Goal:** Click-driven proposition interact notifications match stock Alloy's full request body.

**DoR:**
- ✅ 064-20 done (renderer, `wireAlloyDecisions`, link-click collector, harness extension).
- ✅ Stock behavior is readable in the pinned bundle; the harness runs stock and Airlock on one synthetic page.

**Acceptance Criteria:**

1. The `propositionInteract` data is merged into the click event itself, as stock does, not sent as a separate event.
2. `viewName`, and `trackingLabel` read from item characteristics (not `data-aep-click-label`), are sent as stock does; the token uses `tokens:[token]`.
3. AJO auto-collect of click interactions is implemented or dispositioned with a reason.
4. Full request bodies compare clean against stock (meta stripped), not `decisioning` only.

**DoD:**
- `npm test && npm run lint` and servo gate pass.
- Real-browser tests run under `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.

## Notes

Origin: 064-20 carry C5. Today the interact is a separate event, `viewName` is dropped, and the test compares `decisioning` only.
