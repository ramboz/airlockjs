---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-15]
last_verified:
---

## Slice 064-16 — B12: release check wiring

**Goal:** Wire the release check: fixtures against live behavior and the live-only rows (ADR-0061 point 1).

**DoR:**
- ✅ B11 done.

**Acceptance Criteria:**

1. The release check compares fixtures with live behavior and reports drift (kill criterion 5).
2. Live-only rows are checked once at the release check.

**DoD:**
- Tests, lint and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: one runnable release check end to end.
