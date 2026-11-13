---
status: READY_FOR_IMPLEMENTATION
dependencies: []
last_verified:
---

## Slice 064-01 — T1: close the command inventory

**Goal:** Name every Alloy 2.31.1 command from the pinned bundle, including the two identifier-referenced `commands` and the core commands, so spec 064 section 2.1 is closed.

**DoR:**
- ✅ Spec 064 approved (D1, 2026-11-12). Read-only task; no vendor code executed.

**Acceptance Criteria:**

1. Section 2.1 lists every command with a class and an owning slice; no `unknown` row remains.
2. The list is reconciled against Adobe's public command documentation.

**DoD:**
- Spec 064 section 2.1 updated; the pinned SHA-256 is cited.

**Anti-horizontal-phasing check:** Preparation task for the capture session (spec 064 section 8); it ships a closed inventory, not a layer.
