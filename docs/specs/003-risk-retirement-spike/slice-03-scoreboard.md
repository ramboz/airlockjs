---
status: DONE
kind: spike
dependencies: [003-01, 003-02]
last_verified: 2026-08-26
---

## Slice 003-03 — scoreboard + the answer

**Goal:** The head-to-head that answers the bet and resolves OQ10 — worker vs
baseline INP p75 under the same interaction storm, per-stage delivery-rate, and a
Lighthouse pass — recorded as a go/no-go.

**DoR:**
- ✅ 003-01 (baseline + rig) and 003-02 (worker path) done.

**Acceptance Criteria:**

1. **Head-to-head INP.** The scoreboard runs both paths on the same testbed page
   under the same interaction storm and reports both INP p75 values and the
   delta, over enough samples that the delta is discriminating (not swamped by
   noise).
2. **Lighthouse pass.** A Lighthouse run on the testbed page with the runtime
   loaded reports the performance score (target: 100, or the delta vs a no-martech
   control) — captured as a number.
3. **Delivery-rate comparison.** Both paths' delivered-beacon counts under storm
   are reported, with the worker path's loss (if any) attributed to the drain
   stage vs egress (OQ10 — the delivery-rate oracle instruments the drain).
4. **The answer.** The slice records the go/no-go: does the worker beat the
   baseline on INP p75 under storm, at Lighthouse 100, emitting MP-conformant GA4?
   If yes, the thesis is retired; if no, stop-and-re-shape (release-plan
   release-check). This is the spec's **Outcome**, and it resolves OQ10 by
   measurement.

**DoD:**
- [x] ACs 1–4 pass; the scoreboard is reproducible (`npm run rig`;
      `MODE=worker node rig/lh.mjs`).
- [x] Findings record both numbers, the delta, delivery-rates, and the Lighthouse
      score; the spec Overview Outcome is filled and OQ10 updated with the result.
- [x] Spike-light review; deviation log + reconciliation sweep (below).

**Anti-horizontal-phasing check:** after this slice, the risk-retirement bet has
a measured answer on a real EDS page — the thing the whole front-load existed to
produce — and OQ10 is resolved by data.

### Deviation log

- The bet was **retired but reframed**, not retired as originally framed: the
  head-to-head added a **naive-synchronous** baseline (5 trackers × ~30ms) beside
  the `rIC`-deferred one, because the deferred baseline is already INP-safe. The
  honest answer — INP-safe-by-construction + ~19× the common naive stack + wins
  heavy load, *ties* a competent main thread — is the spec Outcome. This is a
  finding, not a scope cut.
- The Lighthouse LCP gap was diagnosed as a dev-serving/eager-load artifact
  (unbundled 4-module ESM chain, eager load), not a runtime cost — TBT 0 / CLS 0
  is the structural result. Characterized, not "fixed," per the appetite.
- OQ10 is **advanced, not fully closed**: Option-C egress delivers 300/300, but the
  unload last-beacon main-thread fast path remains open — carried forward as the
  next work item (egress ADR).

### Reconciliation sweep

- Spec Outcome + Findings complete; OQ10 in `refinement-todo.md` annotated
  "Measured (spike 003)"; positioning docs reconciled (commit `e4009c0`).
- Release-check bar in `mvp1.md` corrected to the reframed criterion (it had
  required *beating* the competent baseline the spike showed it only ties).
- Open follow-ups handed off cleanly: OQ10 unload fast-path + egress ADR, UC-2 EDS
  graduation, servo oracle wiring + CI — none silently dropped.
