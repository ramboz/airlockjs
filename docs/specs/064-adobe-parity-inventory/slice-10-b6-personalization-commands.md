---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-07, 064-08]
last_verified:
---

## Slice 064-10 — B6: personalization commands

**Goal:** `applyPropositions`, `evaluateRulesets` and `subscribeRulesetItems` match the corpus (S4).

**DoR:**
- ✅ B3 and B4 done.

**Acceptance Criteria:**

1. S4 compares clean, including the active Target activity response (D3).

**DoD:**
- Tests, lint and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: command to response to result.
