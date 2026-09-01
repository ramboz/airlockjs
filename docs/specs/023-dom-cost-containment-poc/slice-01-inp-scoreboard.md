---
status: DONE
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
  (`adapters/eds/dom.js`); the INP instrument is a raw **Event-Timing `PerformanceObserver`** per
  `rig/harness.html:30-74` (NOT `web-vitals` `onINP` — see AC4).
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
- [x] ACs pass. The **scoreboard is recorded** (naive vs airlock within-storm INP p75/p98/max + the naive
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
      N-runs + noise band + observable fairness). Compliance + craft + reconciliation recorded PASS (orchestrator, deep-scrutinized the measurement honesty + first-chunk discipline).
- [x] Deviation log + reconciliation sweep. Record: the exact scheduler mechanism (platform `scheduler.yield`
      vs fallback), the fixture's work shape + why it's representative, the measured numbers, and whether the
      thesis held. Probe code under `probes/` per R-008 (the note is the source of truth). Carry forward:
      Lever 3 enforcement + the read capability (023-02) + POC-B (worker-dom) — all deferred/tracked.
- [x] **No live identifiers committed** (a synthetic fixture; no real tags, no real endpoints).

**Anti-horizontal-phasing check:** the deliverable is a *measured containment* (an INP number), not a scheduler
in isolation — the scheduler/capability exist only to serve the observable before/after scoreboard, which is
airlock's whole performance value made concrete. A scheduler with no measured payoff would be the exact
horizontal-phasing trap this slice avoids.

### Deviation log

- **Scheduler mechanism — grounded, not assumed.** The target Playwright chromium (Chrome-for-Testing,
  `HeadlessChrome/151.0.7922.34`, Playwright 1.62.1) was probed directly (`chromium.launch()` +
  `page.evaluate` `typeof` checks) BEFORE writing `core/scheduler.js`: `scheduler.yield`, `scheduler.postTask`,
  `navigator.scheduling.isInputPending`, `MessageChannel`, and `requestIdleCallback` are ALL available. So the
  default (`?yield=platform`) scoreboard run used `scheduler.yield()` throughout (`mechanism:
  "scheduler.yield"` in every recorded snapshot). The fallback chain
  (`scheduler.postTask` -> `MessageChannel` -> `setTimeout`) is fully DI'd (`core/scheduler.js`'s
  `createScheduler`, an `"x" in deps` disable-a-rung pattern lets a caller pass `null` to force a lower rung)
  and is EXERCISED, not just coded: (1) vitest unit tests construct a scheduler with `{schedulerYield: null,
  schedulerPostTask: null}` and let it fall through to Node's REAL global `MessageChannel` (Node has no
  ambient `scheduler` at all — confirmed `typeof scheduler === "undefined"` under Node v22.16.0), a genuine
  round-trip, not a mock; a further test disables `createMessageChannel` too and proves the `setTimeout`
  last-resort. (2) The fixture's `?yield=fallback` switch disables BOTH platform primitives even in a browser
  that has them, forcing the same MessageChannel path in a REAL Chromium — run once end-to-end
  (`YIELD=fallback node rig/nasty-tag.mjs`, N=1/CLICKS=5 smoke): `mechanism: "message-channel"` reported on
  both modes, thesis still HELD (naive p75=264ms vs airlock p75=40ms) — the fallback is a genuinely viable
  substitute, not just a theoretical branch. `isInputPending` defaults to the ambient
  `navigator.scheduling.isInputPending` (available in the probed chromium) and is exercised by a dedicated
  unit test (an injected `isInputPending` that flips mid-batch ends that batch early, independent of the time
  budget) — not separately probed live in the browser rig (a live isInputPending-driven early-yield is hard to
  observe deterministically in a click-storm harness; the unit test is the load-bearing proof here).
- **Fixture work shape — layout-thrash flavor; `querySelectorAll` confirmed NOT dominant (AC3 grounding).**
  `rig/nasty-tag-harness.html` pre-collects `ELEMENTS` (default 400) plain `<div>`s into an array ONCE at page
  load (`Array.from(pool.querySelectorAll("div"))`, timed) — never inside the click handler. The per-element
  step is a style WRITE (`el.style.transform`) immediately followed by a layout READ (`el.offsetHeight` — a
  forced-synchronous-reflow pair, the textbook layout-thrash shape) plus a `busy()` spin (mirrors
  `baseline/naive.js`'s convention) so the per-element cost is a controllable, deterministic magnitude rather
  than left to vary with DOM size/machine alone. MEASURED collection cost: `collectMs` = 0.2ms (median of 3
  runs, both modes) against a naive interaction of ~200-264ms — under 0.15% of the interaction cost,
  confirming (not just asserting) it never poisons the first chunk. This is the layout-thrash flavor R-008
  names as a major real INP killer, NOT the querySelectorAll-dominated flavor POC-A explicitly defers to
  Lever 2/POC-B.
- **THE SCOREBOARD — the recorded numbers (AC4).** `npm run rig:nasty-tag` (defaults: N=3 page loads/mode,
  CLICKS=15 @ GAP=120ms pinned cadence, ELEMENTS=400, WORK_US=500&micro;s/element, BUDGET_MS=10ms,
  `?yield=platform`), a FRESH `chromium.launch()` per run (inherits `rig/cwv-budget.mjs:16-20`'s
  cross-invocation-noise discipline — deliberately not a shared warm browser across runs):

  | metric (median of N=3)     | naive                     | airlock                  | contrast |
  |-----------------------------|---------------------------|---------------------------|----------|
  | INP p75 (within-storm)      | 200ms                     | 16ms                      | 12.5x, delta 184ms |
  | INP p98                     | 264ms                     | 40ms                      | |
  | INP max                     | 264ms                     | 40ms                      | |
  | noise band (min-max, N=3)   | p75 [200,200], p98/max [264,264] — zero (busy-spin-dominated, deterministic) | p75 [16,32], p98/max [32,40] — small | |
  | naive breakdown (median)    | inputDelay=0ms, processing=200ms, presentation=0ms | inputDelay=0ms, processing=11ms, presentation=5ms | containment visibly comes from shrinking PROCESSING (the long task), not presentation |
  | work completed              | 6000/6000 (=15 clicks x 400 elements) | 6000/6000 | **SAME total work, observed not asserted (fairness)** |
  | reportable interactions/clicks | 16/15 (all 15 clicks reported; +1 from the mirrored first-input double-count quirk inherited byte-faithfully from `rig/harness.html`, harmless — see below) | 4/15, 9/15, 13/15 across the 3 runs | many airlock clicks fell BELOW the `durationThreshold:16` reporting floor entirely (genuinely faster than 16ms, invisible to this instrument) — the tabulated airlock p75/p98/max are a CONSERVATIVE/upper-bound read; the true distribution is likely even better |

  Full JSON (all samples/bands/fairness/fixture blocks) is emitted by `npm run rig:nasty-tag` itself
  (reproducible; not separately committed as a static artifact). `contrast.decisive` =
  `airlock.p75_median <= 200 && airlock.p75_median * 2 <= naive.p75_median` — **TRUE** (16<=200 and 32<=200).
- **Thesis: HELD for this fixture.** A chunkable, layout-thrash-shaped nasty tag's INP genuinely tanks naively
  (200-264ms, needs-improvement/poor boundary) and is genuinely contained when routed through the chunk+yield
  scheduled-DOM-op capability (16-40ms, solidly "good", <=200ms) — same total work (6000 item-ops either way),
  same fixture, same page, N=3 runs/mode with a tight-to-small noise band. Not a strawman manufactured by doing
  less work in the airlock path (fairness row above) or by hiding cost inside `querySelectorAll` (`collectMs`
  confirmed negligible). Honest caveat: this is ONE fixture shape (per-element layout-thrash) at ONE set of
  tuning constants; it says nothing about the querySelectorAll-heavy or monolithic-sync flavors (out of scope
  by the spec's own Assumptions — Lever 2/POC-B's territory).
- **Rig location: `rig/`, not `probes/` (a named departure from the DoD bullet's literal wording).** The DoD
  bullet says "probe code under `probes/` per R-008"; R-008 itself says the choice is "`probes/` OR `rig/` per
  the repo's convention" (the note/slice is the source of truth, not a rigid rule), and the assigning
  instruction explicitly said to mirror `rig/harness.html` + `rig/measure.mjs`'s existing style. Every existing
  Playwright-driven measurement harness in this repo (`measure.mjs`, `cwv-budget.mjs`, the `alloy-*` rigs,
  `sanitize-boundary`, `coherency`, `isolation`, ...) lives under `rig/`; `probes/` is reserved for
  vendored/adopted third-party exploration (`alloy-worker`, `eds-testbed`) — a different kind of artifact.
  `rig/nasty-tag-harness.html` + `rig/nasty-tag.mjs` follow the dominant existing
  `<feature>-harness.html` + `<feature>.mjs` pairing instead (`alloy-chamber-*`, `coherency-*`, etc.).
- **"the slice + a probe note" (DoD bullet 1) interpreted as: this Deviation Log, in the slice itself.** No
  separate `docs/research/` note was added — R-008 stays the umbrella research note; this slice's own file is
  the specific, natural home for its own results (mirrors how e.g. `021-mvp4-hardening/slice-01-...md`'s own
  Deviation Log records that slice's findings inline). Flagged as a judgment call for review, not smuggled.
- **Constants are POC-tuned, not load-bearing production defaults.** `ELEMENTS`/`WORK_US`/`BUDGET_MS`/
  `CLICKS`/`GAP` are all env-overridable (`rig/nasty-tag.mjs`'s header documents each). The defaults (400
  elements, 500&micro;s/element, 10ms budget, 15 clicks @ 120ms) were chosen to land naive decisively in
  needs-improvement/poor territory and airlock decisively in good territory while keeping total harness
  wall-time reasonable (roughly 1-2 minutes for the full N=3/mode run) — NOT claimed as representative of any
  specific real tag's cost profile (there is no real tag here — a synthetic fixture, per the guardrails).
  `core/scheduler.js`'s OWN internal default budget (`DEFAULT_BUDGET_MS = 5`) is a separate, generic module
  default, unrelated to this fixture's tuning (the fixture always passes its own `BUDGET_MS` explicitly).
- **`runWhenIdle`/`runBeforePaint` are built + unit-tested (AC1) but NOT wired into AC2's capability or the
  AC3 fixture.** AC1 requires these two scheduler primitives to exist and be independently testable; AC2's
  capability only needed `chunk`+`yieldToMain` for the interaction-triggered path this POC measures (an
  idle/pre-paint DEFERRAL would delay the START of an interaction-triggered tag's work past the interaction
  itself — a different strategy than what's being demonstrated here, more suited to non-interaction-triggered
  background DOM work a future connector might do). Named as a genuine, bounded design choice, not an
  oversight.
- **The naive INP breakdown required a mid-implementation fix (grounding-honest, not hidden).** A first draft
  computed the breakdown from the FIRST Event-Timing entry seen per `interactionId` (a literal, single-entry
  reading of `onINP.js`'s formula). Real numbers exposed the bug: a click dispatches SEVERAL discrete events
  sharing one `interactionId` (pointerdown/mousedown/pointerup/mouseup/click); this fixture's heavy handler is
  attached only to "click", so an EARLIER event in the group (e.g. pointerdown, near-zero processing of its
  own) could be the one recorded — misattributing the whole cost to "presentation" (observed: naive breakdown
  reading processing=0ms, presentation=199ms for a 272ms interaction — physically implausible for a handler
  doing a ~270ms synchronous loop). Fixed by GROUPING every raw entry by `interactionId` and taking
  min(processingStart)/max(processingEnd) across the group before applying the clamped formula — mirroring
  `web-vitals/attribution`'s own `onINP.js` grouping (`node_modules/web-vitals/dist/modules/attribution/
  onINP.js:120-151,331-345`), not just its single-entry formula. Re-verified: naive breakdown now reads
  inputDelay=0ms/processing=200ms/presentation=0ms — physically sensible (the busy-loop dominates as
  processing time, exactly the "long task" containment is supposed to shrink).
- **`interactions` (reportable Event-Timing entries) vs `clicksFired` — inherited from the proven method, not
  a bug.** The `type:"event"` + `type:"first-input"` collector block is a near-verbatim mirror of
  `rig/harness.html:30-46` per AC4's explicit instruction; its `first-input` dedup key (`"fi"+interactionId`)
  is deliberately distinct from the `event`-type key (the raw `interactionId`), so the very first interaction
  of a page load can be recorded TWICE (naive: 16 interactions for 15 clicks). Kept byte-faithful to the
  proven method rather than "fixed" — a duplicate entry carries the SAME duration value, so it does not
  materially skew p75/p98/max.
- **Carried forward (unchanged, per the DoD bullet).** `docs/refinement-todo.md`'s "Performance thesis (R-008)
  — post-MVP4" section already frames Lever 3 enforcement, the read capability (023-02), and POC-B (worker-dom)
  as deferred/tracked with their own resolution triggers — no edit made (out of this slice's declared scope).
  **Flagged, not acted on:** the worker-dom spike's stated resolution trigger ("after POC-A lands its INP
  scoreboard + DOM-capability") is now met by this slice landing — surfaced for the maintainer to decide
  whether/when to pick up next, not decided here.

### Reconciliation sweep

- `docs/refinement-todo.md` — reviewed, not edited (see "Carried forward" above); its existing Performance
  thesis entries remain accurate as written.
- `docs/inbox.md` — nothing new to park; every deferred item surfaced during this slice (Lever 3, the read
  capability, POC-B) was already tracked before this slice started.
- `docs/specs/README.md` (status board) — deliberately NOT touched; this slice stays `IN_PROGRESS` pending
  the independent review + reconciliation flow (ADR-0014), which regenerates the board at RECONCILED/DONE.
- No `docs/conventions.md` or `CLAUDE.md` change — out of an implementer's scope (conventions require human
  approval; CLAUDE.md is memory-sync's job).
