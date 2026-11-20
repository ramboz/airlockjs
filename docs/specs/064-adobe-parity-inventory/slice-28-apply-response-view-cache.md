---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-23]
last_verified: 2026-11-20
---

## Slice 064-28 — applyResponse warms the host view cache

**Goal:** A push naming a SPA view after `applyResponse` renders and notifies that view from cached propositions, as stock Alloy 2.31.1 does, instead of being treated as a cold cache.

**DoR:**
- ✅ 064-23 done (host view cache, per-event view context).
- ✅ 064-26 done (`applyResponse` host command).

**Acceptance Criteria:**

1. View-scoped propositions in an `applyResponse` response body are stored in the host view cache, so a later push naming the view renders them and sends their display notification once (differential test against pinned stock).
2. `track` waits for every pending delivery, not only the last one, and view propositions that reach `onDecisions` carry `renderAttempted` consistently with stock.

**DoD:**
- `npm test && npm run lint` and servo gate pass.
- Real-browser tests run under `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job.

**Anti-horizontal-phasing check:** Vertical: host command to view cache to rendered view and display notification.

## Notes

Raised by the 064-23 round-2 craft and reconciliation reviews. No core change: the host view cache lives in `adapters/eds/index.js`. Stock's `applyResponse` runs the same personalization `onBeforeEvent` as a normal event; confirm against the pinned bundle before building.
