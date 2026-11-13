---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-18]
last_verified:
---

## Slice 064-22 — B6: Out-of-default-surface disposition

**Goal:** Media, push, conversation, Advertising and Assurance each get a disposition: implement, or incompatible or live-only with a reason.

**DoR:**
- ✅ B2 done.

**Acceptance Criteria:**

1. Push is noted as needing a separate service-worker build that `alloy.min.js` does not contain.
2. The Assurance request side (`adb_validation_sessionid` in `location.search` plus localStorage `validation.clientId`) is fixtured; only the session itself is live-only.
3. BrandConcierge streaming fetch and its `bc_session_id` cookie are dispositioned.
4. Each result is recorded in spec 064 section 2.

**DoD:**
- `npm test && npm run lint` and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.
