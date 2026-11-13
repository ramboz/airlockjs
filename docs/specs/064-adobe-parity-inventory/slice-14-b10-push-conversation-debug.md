---
status: ABANDONED
dependencies: [064-07]
last_verified:
---

## Slice 064-14 — B10: push, conversation and debug

**Goal:** Implement or mark incompatible, with reason, `sendPushSubscription`, `sendConversationEvent` and the Assurance debug hooks.

**DoR:**
- ✅ B3 done.

**Acceptance Criteria:**

1. Each item is implemented against a fixture or listed as incompatible or live-only with a reason in spec 064.

**DoD:**
- Tests, lint and servo gate pass.

**Anti-horizontal-phasing check:** Each item is decided end to end.

**Abandoned 2026-11-13:** Regrouped into new B6 (064-22). See spec 064 section 8.
