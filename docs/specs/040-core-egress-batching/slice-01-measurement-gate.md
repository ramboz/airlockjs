---
status: DONE
dependencies: [adr-0021]
last_verified: 2026-09-09
frame_review: true
kind: spike
---

## Slice 040-01 — request-count measurement gate (spike)

**Question:** Does core-egress coalescing yield a **material request-count reduction** on realistic airlock traffic —
i.e. do multiple same-group beacons actually land in one lock-through cycle often enough to matter — or is the
status-quo one-`fetch`-per-`EgressRequest` path already near-optimal (so the feature should be SHELVED per ADR-0021
kill-criterion #1)?

**Time-box:** 1 day.

**Goal:** Produce the GO/SHELVE evidence ADR-0021 gates the build on — *before* any core seam is written (040-02). This
is a measurement + analysis spike, not an implementation: it must not add the coalescing seam, only quantify its would-be
benefit.

**DoR:**
- ✅ ADR-0021 Accepted — the coalescing design (post-verdict, per-cycle, group-keyed) is settled; this slice measures its
  worth.
- ✅ The current dispatch is one `fetch` per `ready` request (`core/airlock.js:248,300`); the drain/cycle boundary is
  `drain`/`sendBatch` (`:337,346`).

**This is an ANALYTICAL spike, not a rig measurement.** Round-1 and round-2 frame-critiques established that the
load-bearing variable — the temporal relation between real event arrival and the `requestIdleCallback` drain firing under
a realistically-busy main thread — is **unmeasurable without a production event stream**: synchronous-push rigs force a
false GO, and a spread-singles model forces a false SHELVE. So the spike reasons about co-occupancy from **airlock's own
drain mechanics + emission code + documented EDS load-phase timing**, not from rig cadence, and states the magnitude
caveat honestly.

**Acceptance Criteria (spike — analytical evidence + a gated recommendation):**

1. **Characterize co-occupancy across the THREE real patterns against the drain mechanics** (`push()`→`schedule()`→
   `requestIdleCallback(drain,{timeout:50})`, `core/airlock.js:353-354`; `drain()` `ring.splice(0,50)`, `:349`):
   - **(a) Synchronous bursts** — airlock pushes multiple events in one task/handler (enumerate from source: e.g. a
     block-decoration pass emitting several `view_block`; an ecommerce `purchase` + item events). Co-occupy one drain by
     construction → coalesce.
   - **(b) rIC-timeout-window batching (the load-phase mechanism — most plausible real source)** — under a busy main
     thread (page load = peak-beacon phase), `requestIdleCallback` is starved and fires at its **50ms timeout deadline**,
     so `drain()` sweeps *every* event pushed in that window into one cycle regardless of whether they shared a task.
     Reason about how many same-group events plausibly land within one ~50ms window during the EDS load phase (grounded in
     documented EDS phase timing + which airlock emissions fire during load).
   - **(c) Spread-over-time singles** — steady-state post-load (page_view at load, a click seconds later) → distinct
     drain windows → occupancy 1 → no benefit. Correctly no benefit; do not treat as a defect.
2. **Report each pattern separately, with the honest magnitude caveat.** Give the request-count delta per pattern; do NOT
   blend them into one "average occupancy." State plainly that the *frequency* of (a)/(b) in real traffic can only be
   bounded by reasoning (source + EDS docs), not measured here — a GO must rest on (a)/(b) being **structurally**
   co-occupying, not on assumed timing.
3. **Graded recommendation — unqualified GO requires (a)-grade by-construction co-occupancy, NOT (b) load-phase
   hand-waving.**
   - **GO** iff pattern **(a)** holds: airlock emits ≥2 same-group events in **one task** (by construction → one drain
     regardless of timing) at a rate that matters — e.g. an IntersectionObserver callback pushing multiple `view_block`,
     or an ecommerce `purchase` + item events. This is the only timing-independent basis for an unqualified GO.
   - **GO-NARROW** iff only pattern **(b)** holds: same-group events co-occupy only via the ~50ms rIC-timeout window under
     a busy thread. This is a **density estimate** (same-group emission count during load ÷ the ~50ms window budget),
     explicitly flagged an estimate — build the seam but scope the benefit as density-dependent, not structural. Per
     AC1(b) the bar is "≥2 same-group events land within one ~50ms window," NOT merely "fire during the load phase" — do
     not grant even GO-NARROW on the weaker "fires during load" reading.
   - **SHELVE** iff **neither** (a) nor (b) holds — airlock never emits ≥2 same-group events either in one task or within
     a plausible ~50ms window. Do NOT resolve the unmeasurable-frequency case toward SHELVE by fiat (round-2 correction),
     but equally do NOT grant GO on (b)-presence alone (round-3 correction).
   Reconcile against any prior per-cycle evidence in `rig/alloy-coalescing*.mjs` (Alloy-specific, non-load-bearing).
4. **A written GO / SHELVE / GO-NARROW recommendation** against ADR-0021 kill-criterion #1: an unqualified **GO** rests on
   pattern **(a)** being **by-construction** (same-task multi-push → one drain regardless of timing, grounded in source);
   **(b)** is a **density estimate** (not "structural"), which can only support **GO-NARROW** with the caveat stated;
   with the explicit note that exact *frequency/magnitude* in real traffic needs a production event stream this spike
   does not have.

**DoD:**
- [x] The analysis is grounded: every co-occupancy claim cites the drain mechanics (`core/airlock.js`), an enumerated
      airlock emission site, or documented EDS load-phase timing — not rig cadence.
- [x] Per-pattern findings + the GO/SHELVE/GO-NARROW call (GO, on `blocks.js:96`) + the frequency caveat recorded in
      `Findings:` / `Outcome:`.
- [x] Reviewed by `reviewer` — the spike-honesty review caught + corrected a rig-synchronous false-GO (reportAll →
      blocks.js:96); re-review PASS (`reviews/slice-01-*.md`).
- [x] Deviation log + reconciliation sweep produced.

**Findings (2026-09-09 — analytical, grounded in source + drain mechanics):**

- **Pattern (a) — by-construction same-task multi-push — the GO rests on ONE genuinely-synchronous site
  (`blocks.js:96`), corrected after the spike review:**
  - **`adapters/eds/blocks.js:96` (the by-construction GO basis).** The IntersectionObserver `onIntersect` callback loops
    `handle.push(VIEW_BLOCK_EVENT)` per intersecting entry with **no `await`** — a purely synchronous loop. When ≥2
    instrumented blocks cross the 0.5 visibility threshold in **one** IO delivery (common above-the-fold on load), N
    `view_block` events push in one callback task; `requestIdleCallback(drain)` **cannot fire mid-task**, so all N sit in
    the ring at drain (`ring.splice(0,50)`, `core/airlock.js:349`) → one `ready` set, one coalescing group, size N.
    Timing-independent within the delivery; **layout-contingent** on ≥2 co-visible instrumented blocks (a common but not
    guaranteed condition).
  - **Decisions/personalization path is NOT by-construction (spike-review correction).** The layout-independent
    `reportAll` in `decisions-exposure.js:108-110` is a synchronous loop **but is called only in rig harnesses**
    (`rig/alloy-decisions-harness.html`, `rig/alloy-multiscope-harness.html`), NOT in production. The real production
    emission is `adapters/eds/index.js:888-911` `deliver`, an **async loop** (`await handlePromise` before each
    `exposureReporter.report(decision)`, `:898,909`). Its same-drain co-occupancy therefore holds only via **event-loop
    ordering** (the awaited microtasks drain before the rIC macrotask) and only when the eager-reserve promises are
    pre-resolved — a real but timing-adjacent argument, so this leg is a **contingent bonus, not a by-construction GO
    basis** (citing it as the latter was the rig-synchronous false-GO the round-1 critique warned against).
- **Request-count delta on an (a) burst:** status quo = **N** requests — one `fetch` per `ready` request
  (`core/airlock.js:248,300`), each a single-event GA4 GET per 039-01; coalesced = **1** request — the 040-03 GA4 adapter
  merges the N into one multi-`en` POST (the wire form the container itself uses for a batch, per 039's capture). Net
  N→1 regardless of the GET/POST verb detail. **By-construction example:** a
  page with 3 co-visible above-the-fold instrumented blocks → 3 `view_block` beacons → 1 (**67%** fewer). **Contingent
  (microtask-ordering) example:** a personalization page whose `deliver` loop reports 4 decisions under pre-resolved
  reserves → 4 → 1 (**75%**), *if* the awaits stay microtasks the rIC macrotask can't interleave.
- **Pattern (b) — rIC-timeout-window batching — a caveated BONUS, not the GO basis.** Under a busy load thread, rIC
  fires at its 50ms deadline and `drain` sweeps co-pending events into one cycle — strengthening (a)'s benefit — but this
  is a density estimate (how many same-group events fall in one ~50ms window), not by-construction, so it is not relied
  on for the verdict (GO-NARROW territory only).
- **Pattern (c) — spread-over-time singles** (page_view at load; a click seconds later) → distinct drains → occupancy 1
  → no benefit. Correct, not a defect.
- **Honest caveat (unmeasurable here):** the *frequency* of (a) bursts in real traffic — the share of pages that carry
  ≥2 personalization decisions or ≥2 co-visible instrumented blocks — needs a production event stream and is NOT
  measured. But the **mechanism is by-construction** and the emission sites are real, so wherever such pages exist the
  N→1 reduction is structural (timing-independent), and the 040-02 seam is **default-no-coalesce** (zero cost on pages
  that don't burst). No dead surface risk either way.

**Outcome:** `spec 040 unblocked (GO — pattern (a) by-construction co-occupancy confirmed at blocks.js:96 (synchronous IO-callback multi-push, layout-contingent on ≥2 co-visible blocks); the decisions/deliver path is an async loop that co-occurs only via microtask-ordering (a contingent bonus, not by-construction — spike-review correction, reportAll is rig-only); N→1 request reduction where a burst occurs, default-no-coalesce (zero cost) elsewhere; build 040-02 then 040-03)`.

## Assumptions

- **CADENCE CONFOUND — symmetric, and the reason this spike is analytical (frame-critique rounds 1 + 2).** Cycle
  occupancy is set by the temporal relation between event arrival and drain firing, and the production drain
  (`requestIdleCallback(drain,{timeout:50})`, `core/airlock.js:353-354`) behaves in two regimes: idle → fires quickly
  (spread events land in distinct cycles); **busy main thread (page load) → rIC starved → fires at the 50ms timeout, so
  `drain()`'s `ring.splice(0,50)` (`:349`) sweeps every event pushed in that window into ONE cycle.** Rigs that use
  `flushNow` (`:527`)/synchronous pushes over-batch → false **GO** (round 1); a spread-singles model that ignores the
  timeout-window batching under load → false **SHELVE** (round 2). Both errors are the *same unmeasurable* (real arrival
  vs. rIC-under-load), so the honest method is analytical: reason about the three patterns (synchronous burst /
  load-phase rIC-timeout batching / spread singles) from source + documented EDS load-phase busyness, and SHELVE only if
  NEITHER (a) nor (b) structurally co-occurs — never by discounting (b). (Why `frame_review: true`.)
- **Same-group bursts occur often enough to matter — UNVERIFIED (this spike's whole point).** The efficiency case rests
  on multiple same-endpoint/same-verdict beacons landing in one *idle-drain* cycle. If real airlock traffic is mostly
  one-beacon-per-cycle once timing is realistic, coalescing is a no-op and the feature shelves.
- **What is unmeasurable here, stated honestly.** Absent a production event stream, real inter-event *timing* (do a
  page's events land within one ~50ms idle window?) can only be reasoned about from airlock's own emission code (which
  pushes are synchronous) + documented EDS phase timing — not measured. The finding must say so; a GO that rests on
  assumed timing rather than synchronous-by-construction bursts is not a GO. A finding of "benefit only under
  rig-artifact bursts" is itself a SHELVE
  signal, not a measurement to force positive.

## Anti-horizontal-phasing check

A spike is exempt from the vertical-slice rule (it ships evidence, not a user-facing layer) — but it is deliberately
scoped to *gate* the vertical work (040-02/03), not to precede a foregone build: a SHELVE outcome is a real, honored
possibility here, not a formality.

### Deviation log (after reconciliation)

- **GO basis narrowed by the spike review (rig-synchronous false-GO caught).** The first-draft finding rested the
  "cleanest layout-independent by-construction (a)" leg on `decisions-exposure.js:108-110` `reportAll` — but `reportAll`
  is **rig-only** (`rig/alloy-decisions-harness.html`, `rig/alloy-multiscope-harness.html`; no production caller). The
  production decisions path is `adapters/eds/index.js:888-911` `deliver`, an **async loop** (`await handlePromise` before
  each `report`) whose same-drain co-occupancy holds only via microtask-ordering under pre-resolved reserves. Corrected:
  the by-construction GO now rests on `blocks.js:96` (a purely synchronous IO-callback multi-push, layout-contingent on
  ≥2 co-visible blocks), and the decisions/`deliver` leg is demoted to a contingent bonus. This is exactly the
  rig-synchronous hazard the round-1 *frame*-critique warned of, caught again at implementation review — the discipline
  worked twice.
- **Methodology reframed to analytical over 4 frame-critique rounds** (false-GO from rig cadence → false-SHELVE from
  ignoring rIC-timeout batching → false-GO from granting on pattern-(b) presence → the (a)/(b) grade split). The
  load-bearing variable (real arrival-vs-rIC-under-load timing) is unmeasurable without a production event stream; the
  spike is analytical and rests GO on by-construction (a), not timing.
- **Outcome: GO** (build 040-02 then 040-03). No dead-surface risk: 040-02's seam is default-no-coalesce, so pages
  without an (a) burst are byte-unchanged.

### Reconciliation sweep

- **`docs/specs/040-core-egress-batching/slice-01-measurement-gate.md`**: **updated** — the spike's Findings/Outcome
  (this analysis) + the GO-basis correction. This is the deliverable (an analytical spike ships reasoning, not code).
- **Source read, not modified** (`adapters/eds/blocks.js`, `adapters/eds/index.js` `deliver`, `adapters/eds/decisions-exposure.js`,
  `core/airlock.js` drain): **no-op** — the spike measures/reasons, it does not touch the coalescing seam (that is 040-02).
- **Downstream slices**: **no-op here** — 040-02/03 remain DRAFT (framed); the GO unblocks them, it does not implement them.
- **ADR-0021 kill-criterion #1**: **satisfied** — a by-construction request-count benefit is grounded, so the build is
  not shelved.
- **Glossary / architecture.md / primer**: **no-op** — a spike adds no module or always-loaded term; the batching seam's
  architecture write lands with 040-02.
