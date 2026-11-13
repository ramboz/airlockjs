---
status: ABANDONED
dependencies: [064-06, 064-09, 064-11]
last_verified:
---

## Slice 064-12 — B8: aem-martech, ACDL, Launch bridge

**Goal:** Decide the Airlock-backed `aem-martech` adoption path (ADR-0038 step 1: drop-in, wrapper or not viable) and match the S10 corpus.

**DoR:**
- ✅ B2, B5 and B7 done.

**Acceptance Criteria:**

1. S10 compares clean.
2. The adoption decision is written with evidence.

**DoD:**
- Tests, lint and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: page plugin to wire to decision.

**Abandoned 2026-11-13:** Regrouped into new B5 (064-21). See spec 064 section 8.
