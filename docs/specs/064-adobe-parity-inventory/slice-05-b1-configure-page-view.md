---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-03, 064-04]
last_verified:
---

## Slice 064-05 — B1: configure, getLibraryInfo, page-view sendEvent (pilot)

**Goal:** `configure`, `getLibraryInfo`, a page-view `sendEvent`, the context block and the network shape match the recorded corpus through real chamber dispatch.

**DoR:**
- ✅ CAP done; B0 field-rule comparison landed.

**Acceptance Criteria:**

1. Fixtures S1 to S2 compare clean through the chamber.
2. The count of captures needed beyond the corpus is written into spec 064 (more than 3 triggers a kill criterion).

**DoD:**
- `npm test && npm run lint` and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: config to wire to comparison for one real journey.
