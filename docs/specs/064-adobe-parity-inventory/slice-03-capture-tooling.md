---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-01]
last_verified:
---

## Slice 064-03 — B0: capture tooling

**Goal:** Provide the manifest schema, stored-input-state check, pre-commit credential check and field-rule comparison the capture session needs.

**DoR:**
- ✅ Spec 064 approved (D1). T1 done.

**Acceptance Criteria:**

1. The recorded wire checker (051-07) rejects a fixture without the full stored-input-state block.
2. A pre-commit test rejects vendor login or session cookies, tokens and VPN or proxy credentials, with positive and negative cases, and runs in `npm test`.
3. Native field-rule evaluation works in the comparator. This part is shared toolkit work landing on main and merged into vendor branches; B0 consumes it and does not fork it.

**DoD:**
- `npm test && npm run lint` and the servo gate pass.

**Anti-horizontal-phasing check:** Tooling task; each check is exercised end to end on a sample fixture.
