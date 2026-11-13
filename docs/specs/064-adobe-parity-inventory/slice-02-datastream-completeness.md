---
status: READY_FOR_IMPLEMENTATION
dependencies: []
last_verified:
---

## Slice 064-02 — T2: datastream setting list and completeness table

**Goal:** List every datastream setting that can change served behavior, with its triggering page input and a disposition, so S9 covers them.

**DoR:**
- ✅ Spec 064 approved (D1) and the owner has exported the test datastream config into the repo (D6).

**Acceptance Criteria:**

1. Each setting has a triggering input and a disposition: covered by S9, no effect (with the three conditions in spec 064 section 6), or gap.
2. The out-of-inventory rate is computed and compared with the 10% threshold.

**DoD:**
- Table committed in spec 064 section 6. No production probe run except under section 9.

**Anti-horizontal-phasing check:** Preparation task; delivers a complete table the capture session consumes.
