---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-20]
last_verified:
---

## Slice 064-24 — Redirect display notification

**Goal:** A redirect proposition sends its display notification before the page navigates, as stock Alloy does.

**DoR:**
- ✅ 064-20 done (renderer, `wireAlloyDecisions`, link-click collector, harness extension).
- ✅ The seam keepalive path exists: 064-18 routes `sendBeacon` and `init.keepalive` through the seal and `createKeepaliveTracker` (`core/egress.js`). Gap: the connector pushes no `documentUnloading` hint (checked 2026-11-20, no match in `connectors/alloy/connector.js` or `adapters/eds`).

**Acceptance Criteria:**

1. A redirect proposition prehides the body, sends the display notification with keepalive (the `documentUnloading` hint on the pushed event) through the seam, then calls `location.replace`.
2. The display request body compares clean against pinned stock Alloy 2.31.1 on the same synthetic page (differential), including the keepalive flag.
3. A held or failed display does not block navigation indefinitely; the outcome is diagnosed.

**DoD:**
- `npm test && npm run lint` and servo gate pass.
- Real-browser tests run under `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.

## Notes

Origin: 064-20 carry C3. The earlier note "needs a keepalive path through the seam" was wrong: the path exists from 064-18; what is missing is the `documentUnloading` hint and the ordering before `location.replace`.
