---
status: ABANDONED
dependencies: [064-05]
last_verified:
---

## Slice 064-07 — B3: response handling and applyResponse

**Goal:** Handle every recorded `handle` type and error shape; `applyResponse` works; an unknown `handle` type is a loud, visible error, never silent.

**DoR:**
- ✅ B1 done.

**Acceptance Criteria:**

1. S3, S4 and S8 response and error fixtures compare clean.
2. An unknown `handle.type` produces a visible error (spec 064 point 11 analogue).

**DoD:**
- Tests, lint and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: response to chamber state to visible result.

**Abandoned 2026-11-13:** Regrouped into new B2 (064-18). See spec 064 section 8.
