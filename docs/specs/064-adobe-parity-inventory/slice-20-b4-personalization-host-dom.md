---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-19]
last_verified:
---

## Slice 064-20 — B4: Personalization and host DOM

**Goal:** Proposition rendering, prehiding, redirects, click collection and rulesets context match the recorded corpus, with the DOM work kept on the main thread.

**DoR:**
- ✅ B3 done.

**Acceptance Criteria:**

1. `applyPropositions`, `renderDecisions`, prehiding and redirect proposition items behave as recorded.
2. Click collection and display or click notifications compare clean.
3. Fixtures S4 and S7 compare clean.

**DoD:**
- `npm test && npm run lint` and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.
