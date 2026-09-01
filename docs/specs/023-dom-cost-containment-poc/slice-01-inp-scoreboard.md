---
status: DRAFT
dependencies: []
last_verified: 2026-09-01
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 023-01 — costly tag contained + measured (the INP scoreboard)

**Goal:** Produce airlock's **performance proof** — a before/after INP scoreboard showing that a costly-DOM
tag's INP hit is **contained** when its work is routed through airlock's scheduled DOM capability, vs the same
work run naively in a click handler. Builds the machinery one Path slice needs: a minimal scheduler, a
scheduled-DOM-op capability, a synthetic nasty-tag fixture + its naive baseline, and a Playwright INP harness.

**DoR:**
- ✅ [R-008](../../research/R-008-costly-dom-martech-containment.md) frames Lever 1 + the strategy; this slice
  is its first concrete proof (POC-A).
- ✅ Grounded current state (spec Overview): no `yieldToMain`/`runWhenIdle`/`runBeforePaint` taxonomy in core
  (only `requestIdleCallback` for the drain, `core/airlock.js:255`); DOM capability is injection-only
  (`adapters/eds/dom.js`); `web-vitals@^6.2.1` is a dep (its `onINP` is the INP instrument).
- ✅ Chunkability boundary named (spec Assumptions): scheduling contains **chunkable** work only; the fixture
  is chunkable per-element processing; monolithic-sync is Lever 2 (POC-B), out of scope.

**Acceptance Criteria:**

1. **A minimal main-thread scheduler.** `chunk(items, perItem, {budgetMs})` runs work in batches, calling
   `yieldToMain()` between batches so no single task exceeds the budget; plus `runWhenIdle` (over
   `requestIdleCallback`) and `runBeforePaint` (over `requestAnimationFrame`). `yieldToMain` prefers the
   platform `scheduler.yield()` / `scheduler.postTask`, falling back to a `MessageChannel` yield (ground the
   fallback + any `isInputPending` use at implementation). Pure/DI'd + unit-testable (inject the timing fns);
   no ambient globals hard-coded.
2. **A scheduled-DOM-op capability.** A connector/tag expresses heavy DOM work as yieldable units (the
   per-element step + the item set) through a capability that runs them via the scheduler — so the work
   completes across frames, interleaved with interactions, instead of in one blocking task. Mirrors the
   existing DOM-capability seam (`adapters/eds/dom.js`); DI'd + testable.
3. **A synthetic nasty-tag fixture + its naive baseline.** A click handler that does heavy **chunkable** DOM
   work (e.g. `querySelectorAll` a large node set + an expensive per-element step — layout-read/style-write).
   Two modes on the same fixture page: **naive** (the work runs synchronously in the handler) and **airlock**
   (the same work through AC2's scheduled capability). No governance/egress here — this is purely the
   main-thread-cost contrast.
4. **The INP scoreboard (the proof).** A Playwright harness loads the fixture, fires **N scripted clicks**,
   and reads **INP p75** (via `web-vitals` `onINP`) for each mode. Observable + recorded:
   naive INP p75 is large (tanked); airlock-scheduled INP p75 is small (flat) for the **same total work** on
   the **same page**. The delta is the number. **Honest outcome:** if the contrast is NOT decisive, the POC
   has *falsified* Lever 1's premise for this fixture — record that plainly (a real finding, not a failure to
   massage).

**DoD:**
- [ ] ACs pass. The **scoreboard is recorded** (naive vs airlock INP p75, same fixture) in the slice + a probe
      note. Unit tests: the scheduler (chunking yields between batches; budget respected — via injected timing
      fns, no real clock flake) + the capability (work completes; yields between units). The Playwright harness
      is reproducible (an `npm run` script) — browser-rig, not hermetic, so it gates its own job, not the unit
      suite. Targeted sweep for the units.
- [ ] **Frame-critique** (the load-bearing premise: a chunk-and-yield scheduler *actually* contains INP for
      chunkable work, AND the Playwright INP measurement is a valid, reproducible naive-vs-scheduled contrast —
      not a rigged demo; confirm the fixture's work is genuinely chunkable + representative, and that "INP p75"
      is measured, not asserted) + compliance + craft + reconciliation.
- [ ] Deviation log + reconciliation sweep. Record: the exact scheduler mechanism (platform `scheduler.yield`
      vs fallback), the fixture's work shape + why it's representative, the measured numbers, and whether the
      thesis held. Probe code under `probes/` per R-008 (the note is the source of truth). Carry forward:
      Lever 3 enforcement + the read capability (023-02) + POC-B (worker-dom) — all deferred/tracked.
- [ ] **No live identifiers committed** (a synthetic fixture; no real tags, no real endpoints).

**Anti-horizontal-phasing check:** the deliverable is a *measured containment* (an INP number), not a scheduler
in isolation — the scheduler/capability exist only to serve the observable before/after scoreboard, which is
airlock's whole performance value made concrete. A scheduler with no measured payoff would be the exact
horizontal-phasing trap this slice avoids.
