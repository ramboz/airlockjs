---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-07]
last_verified:
---

## Slice 064-13 — B9: media commands

**Goal:** Implement or mark incompatible, with reason, `getMediaAnalyticsTracker`, `createMediaSession` and `sendMediaEvent`.

**DoR:**
- ✅ B3 done.

**Acceptance Criteria:**

1. Each command is implemented against a fixture or listed as incompatible with a reason in spec 064 section 2.1.

**DoD:**
- Tests, lint and servo gate pass.

**Anti-horizontal-phasing check:** Each command is decided end to end.
