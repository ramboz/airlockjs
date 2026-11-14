---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-19, 064-20]
last_verified:
---

## Slice 064-21 — B5: aem-martech, ACDL and Launch

**Goal:** `aem-martech`, ACDL 3.0.1 and the Launch bridge work through the airlock; the ADR-0038 adoption decision is recorded.

**DoR:**
- ✅ B3 and B4 done.

**Acceptance Criteria:**

1. Decision is one of drop-in, wrapper or not viable, with evidence.
2. Fixture S10 (POC site, `aem-martech` + ACDL + Alloy 2.31.1, no Launch, D10) compares clean.
3. The Launch bridge is a gap row owned here (D10): added if this slice shows it is needed, otherwise tagged `live-only` (no Launch property exists).

**DoD:**
- `npm test && npm run lint` and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.
