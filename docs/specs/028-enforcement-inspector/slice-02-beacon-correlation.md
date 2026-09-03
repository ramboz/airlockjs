---
status: DRAFT
dependencies: [028-01]
last_verified:
---

<!-- jig grounding (ADR-0020): the "correlation id threads through the emit sites
     as a small enrichment" claim is an ASSUMPTION (spec.md § Assumptions) until
     slice-01's read-layer confirms the event ref is in lexical scope per site. -->

## Slice 028-02 — per-beacon correlation

**Goal:** Thread the originating event / beacon identity (event `type` + a per-beacon id) into the
enforcement-decision records at the main-thread emit sites, and group by it in the collector, so the inspector
answers the vision's actual phrasing — *"why did **this** beacon fire / hold at the seal / get gated / get
stripped"* — as one correlated causal chain, not a flat stream.

**DoR:**
- ☐ 028-01 DONE (the read-layer + query exist to correlate over).
- ☐ Grounded per-site: confirm the event/beacon ref is in lexical scope at each `diagnose(` call
  (`consent`/`ceiling` sit inside `for (const r of ready)` where `r` is the mapped request; the descriptor /
  event `type` is reachable) — if any site lacks it, scope the enrichment there.

**Acceptance Criteria (draft — sharpened at READY):**

1. Each enforcement-decision record carries a stable per-beacon correlation ref (event `type` + id) identifying
   the beacon it governs.
2. The query API can return, for a given beacon, its **ordered decision chain** (e.g. mapped → held(pending) →
   [later] flushed; or mapped → stripped(field) → sent).
3. The enrichment is non-invasive — it passes an in-scope ref into the record, not a signature change to the
   enforcement functions; existing 009-02 records without a ref still collect (back-compat).
4. No PII: the correlation ref is the event type + a synthetic per-beacon id, never user identity.

**DoD:** _standard (see 028-01); full ACs sharpened when this slice reaches READY._

**Anti-horizontal-phasing check:** after this slice a developer can ask "why did THIS specific beacon get
held/stripped" and see the causal chain — the vision's per-beacon inspector answer.
