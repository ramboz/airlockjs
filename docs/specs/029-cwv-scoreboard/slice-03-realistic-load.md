---
status: DRAFT
dependencies: [029-01, 029-02]
last_verified:
---

## Slice 029-03 — realistic martech load (DEFERRABLE)

**Goal:** Raise the scoreboard's fidelity from the synthetic 5-tracker micro-fixture to a **realistic martech
load** (a representative real-site tracker mix), so the punchline reflects a load real sites carry — per
`mvp5.md`, which marks this **"flexes on the customer stack being available"** (a deferrable stretch, not the
must-land).

**Explicitly deferrable.** `mvp5.md`'s appetite makes the realistic-load run the first thing to give if the box
tightens; 029-01's synthetic triple is the punchline that must land. This slice is a fidelity upgrade, not a
correctness gate. The **RUM-subsume** is a SEPARATE MVP5 spec, not part of this one.

**DoR:**
- ☐ 029-01 + 029-02 DONE (the scoreboard + full before/after exist).
- ☐ A realistic load is available — a representative tracker mix fixture (synthetic-but-realistic), or the
  customer stack if/when accessible (creds/availability-gated — treat as the trigger).

**Acceptance Criteria (draft — sharpened at READY):**

1. The scoreboard runs against a realistic-martech-load fixture (a representative mix, not the 5-tracker micro),
   and the artifact reports the before/after triple for that load.
2. The synthetic-load run (029-01) remains available — the realistic load is additive, not a replacement.
3. No live identifiers (a synthetic-but-realistic mix, or a redacted capture); creds-gated pieces stay deferred.

**DoD:** _standard (see 029-01); full ACs sharpened when this slice reaches READY, if pursued._

**Anti-horizontal-phasing check:** after this slice the punchline reflects a realistic load, not just the
synthetic micro-fixture — the adoption-credible version of the scoreboard.
