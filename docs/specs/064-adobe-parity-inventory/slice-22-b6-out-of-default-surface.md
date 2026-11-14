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
4. The 7 datastream gap rows of spec 064 6.5 (DS-17 to DS-20, DS-22, DS-24, DS-34) are known gaps owned here (D11). Their client-side handling is derived from the pinned 2.31.1 source and labeled source-derived, not capture-verified; their server responses stay unverified and outside the v1.0 claim until owned resources exist.
5. Each result is recorded in this slice and in the B7 compatibility report. Spec 064 section 2 stays frozen.

**DoD:**
- `npm test && npm run lint` and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.
