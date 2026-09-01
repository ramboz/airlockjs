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
   **First-chunk discipline (frame-critique must-fix — the load-bearing mechanical fact of INP):** INP counts
   the interaction's **first task** (input delay + the first synchronous chunk **before** the first yield);
   later yields **cannot** rescue a large first chunk. So `chunk` must keep the FIRST batch within budget (or
   yield-first before any heavy work), and the capability entry (AC2) must not run a large un-chunked prefix
   inside the interaction. This is the exact knob that decides whether the scheduled INP is genuinely
   contained (not accidentally tanked by a heavy first task, not gamed by a trivial first batch).
2. **A scheduled-DOM-op capability.** A connector/tag expresses heavy DOM work as yieldable units (the
   per-element step + the item set) through a capability that runs them via the scheduler — so the work
   completes across frames, interleaved with interactions, instead of in one blocking task. Mirrors the
   existing DOM-capability seam (`adapters/eds/dom.js`); DI'd + testable.
3. **A synthetic nasty-tag fixture + its naive baseline.** A click handler that does heavy **chunkable** DOM
   work — an expensive **per-element loop** (layout-read/style-write thrash) over a node set. Two modes on the
   same fixture page: **naive** (the work runs synchronously in the handler) and **airlock** (the same work
   through AC2's scheduled capability). No governance/egress here — purely the main-thread-cost contrast.
   **The dominant cost MUST be the chunkable per-element loop, not `querySelectorAll` itself** (frame-critique
   must-fix): a `querySelectorAll` over a large set is a *monolithic-sync* prefix the scheduler can't chunk
   (Lever 2's domain) — keep it cheap or pre-collect the node set, so the fixture reproduces R-008's
   **layout-thrash** flavor (a major real INP killer), **NOT** the `querySelectorAll`-dominated flavor, which
   POC-A explicitly defers to Lever 2/POC-B. State this plainly so the fixture doesn't imply it contains a
   case it defers.
4. **The INP scoreboard (the proof) — measured the repo's proven way, NOT `onINP`.** A Playwright harness
   loads the fixture and fires a **scripted click storm at a pinned cadence** (clicks + gap, mirroring
   `rig/measure.mjs:36-37`'s `CLICKS`/`GAP` + `rig/harness.html`). Measure INP the way `rig/harness.html:30-74`
   **already does** for a lab per-interaction contrast: a **raw Event-Timing `PerformanceObserver`** over the
   storm → the **within-storm p75/p98/max** interaction-latency distribution. **Do NOT use `web-vitals`
   `onINP`** here — it emits *one* per-page p98-estimate finalized at page-hide (`web-vitals`
   `onINP.js:86,129-131`; the sibling `connectors/helix-rum/cwv-capture.js` already grounded this), the wrong
   instrument for a within-page naive-vs-scheduled contrast (if kept for field-fidelity, report it *alongside*
   the raw distribution, not instead). Run **N page loads per mode, take the median**, with a **noise band**
   (inherit `rig/cwv-budget.mjs:16-20`'s hard-won cross-invocation-noise discipline — a single read is too
   noisy). **Fairness — verified, not asserted:** the pinned cadence + **report work-completed on BOTH modes**,
   so a reader sees the scheduled run did the SAME total work (spilled across interactions), not less. Also
   report the **naive INP breakdown** (input-delay / processing / presentation) so containment is *seen* to
   come from shrinking the long task. Observable + recorded: naive within-storm p75 large (tanked); airlock p75
   small (flat), same work, same page. **Honest outcome:** a non-decisive contrast *falsifies* Lever 1 for
   this fixture — record that plainly (a real finding, not a failure to massage).

**DoD:**
- [ ] ACs pass. The **scoreboard is recorded** (naive vs airlock within-storm INP p75/p98/max + the naive
      breakdown, same fixture) in the slice + a probe note. Measurement pins: **N page loads per mode + median
      + a noise band** (per `rig/cwv-budget.mjs:16-20`), raw Event-Timing (not `onINP`), pinned cadence,
      work-completed reported on both modes. **Grounding probes to run:** `scheduler.yield`/`postTask`
      availability in the target Playwright chromium (+ exercise the `MessageChannel`/`isInputPending`
      fallback); confirm the fixture's `querySelectorAll` is NOT the dominant sync cost (else it poisons the
      first chunk — AC1/AC3). Unit tests: the scheduler (first + subsequent batches within budget; yields
      between; via injected timing fns, no real-clock flake) + the capability (work completes; yields between
      units; the first-chunk discipline holds). The Playwright harness is reproducible (an `npm run` script) —
      browser-rig, not hermetic, so it gates its own job, not the unit suite.
- [x] **Frame-critique** — PASS (verified the chunk-and-yield-contains-INP premise mechanically + against
      `node_modules/web-vitals`; forced three must-fix now folded into AC1/AC3/AC4: the first-task precondition,
      the layout-thrash-not-querySelectorAll fixture, and the Event-Timing-not-`onINP` measurement with
      N-runs + noise band + observable fairness). Still needed: compliance + craft + reconciliation.
- [ ] Deviation log + reconciliation sweep. Record: the exact scheduler mechanism (platform `scheduler.yield`
      vs fallback), the fixture's work shape + why it's representative, the measured numbers, and whether the
      thesis held. Probe code under `probes/` per R-008 (the note is the source of truth). Carry forward:
      Lever 3 enforcement + the read capability (023-02) + POC-B (worker-dom) — all deferred/tracked.
- [ ] **No live identifiers committed** (a synthetic fixture; no real tags, no real endpoints).

**Anti-horizontal-phasing check:** the deliverable is a *measured containment* (an INP number), not a scheduler
in isolation — the scheduler/capability exist only to serve the observable before/after scoreboard, which is
airlock's whole performance value made concrete. A scheduler with no measured payoff would be the exact
horizontal-phasing trap this slice avoids.
