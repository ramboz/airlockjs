---
status: DONE
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

### Deviation log

- Added a 2.2 correction: the secondary labeled request (ledger 11) was recorded in the smoke, without a response. The spec said it was absent.
- Rows 17 to 20 added to 2.1 (4 of the 5 new-row budget). One row left for T2, T3 and CAP.
- Field classes in 3.2a are proposals from names and structure, since the ledger keeps no values.

### Reconciliation sweep

- Spec 2.1, 2.2, 2.3, 3.2a, 3.4 and 13 updated. Slice 065-02 and 065-03 inputs (6.1, 7.1 skeleton) unaffected beyond the new-row count. No ADR change.
- No private values copied. Loader digest shown in short form only.
