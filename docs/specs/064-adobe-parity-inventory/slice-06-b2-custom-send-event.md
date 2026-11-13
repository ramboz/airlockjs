---
status: ABANDONED
dependencies: [064-05]
last_verified:
---

## Slice 064-06 — B2: custom sendEvent, mergeId, onBeforeEventSend

**Goal:** Custom XDM `sendEvent`, `mergeId`, `createEventMergeId` and `onBeforeEventSend` match the recorded corpus (S3).

**DoR:**
- ✅ B1 done.

**Acceptance Criteria:**

1. S3 compares clean through the chamber.
2. `onBeforeEventSend` can modify or cancel an event as recorded.

**DoD:**
- Tests, lint and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: call to wire to comparison.

**Abandoned 2026-11-13:** Regrouped into new B3 (064-19). See spec 064 section 8.
