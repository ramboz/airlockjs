---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-07]
last_verified:
---

## Slice 064-09 — B5: consent

**Goal:** `setConsent`, queued events and `defaultConsent` behave as recorded (S6), including the seal interaction.

**DoR:**
- ✅ B3 done.

**Acceptance Criteria:**

1. S6 out, in and pending-then-in compare clean, with queued events.

**DoD:**
- Tests, lint and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: consent call to seal to wire.
