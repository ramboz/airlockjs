---
status: READY_FOR_IMPLEMENTATION
dependencies: []
last_verified: 2026-11-13
---

## Slice 065-01: T1: Close the Google surface from retained bytes

**Goal:** Close the surface from the retained loader and the 12-request ledger: command, config, parameter and endpoint lists, and all 62 query names for the field table. No vendor code runs.

**DoR:**
- Spec 065 approved by the owner (D1, 2026-11-13). ADR-0061 and ADR-0062 (Accepted).
- Read-only work on bytes already in the repo (R-015:37, 443,549 bytes, digest-checked 2026-11-05). No network.

**Acceptance Criteria:**

1. The command, config, parameter and endpoint lists are written into spec 065 sections 2 and 3, each entry citing a loader or ledger location.
2. All 62 ledger query names are in the field table (section 3) with a proposed class, to be confirmed by the corpus.
3. The credential allow-list seed (`_gcl_*`, `_ga*` and any others the loader and Google's docs show) is written down for G0 (4.2).
4. New inventory rows found here are counted against kill criterion 4 (at most 5 across T1 to T3 and CAP).

**DoD:**
- Spec 065 sections 2 and 3 updated and the review log notes the change.
- `npm run lint` passes. Spec lint passes.

**Source:** spec 065 section 9 and the owner answers in section 12.
