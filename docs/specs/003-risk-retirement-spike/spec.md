---
status: DONE
skill:
use_cases: [UC-2]
---

# Spec 003: Risk-retirement spike

## Overview

The load-bearing bet of the whole project, retired first and cheaply
(drive-order step 7; [MVP1 release plan](../../releases/mvp1.md) risk-first item).

**Question:** can the event-log/projection + Web Worker boundary beat a competent
main-thread version on **INP p75 under interaction-storm load**, while emitting an
**MP-conformant GA4 payload**, on a **real EDS page**, at **100 Lighthouse**?

**Time-box:** appetite is "a demo a skeptical EDS practitioner believes" —
measurement over polish. Build the smallest thing that answers the question.

**What it builds** (GA4-only; the seed of the real runtime — "everything else is
construction"): a `push()`-shaped entry that appends to an event log and folds a
synchronous projection; a ring-buffer drain on idle that cycles into a Worker
chamber; one GA4 connector doing the Measurement Protocol mapping and keepalive
egress off-thread; a `patchDatalayer`-style main-thread baseline to compare
against; and an INP + Lighthouse + delivery-rate scoreboard, all on the
[EDS testbed](../../../probes/eds-testbed/).

**Outcome:** resolves [OQ10](../../refinement-todo.md) (the egress
dispatch/delivery model) by measurement, and produces the baseline numbers a
later servo-unattended GA4 loop gates on. Consumes the pinned
[contracts/](../../../contracts/README.md) and the accepted
[ADR-0001](../../decisions/adr-0001-chamber-isolation-strength.md) /
[ADR-0002](../../decisions/adr-0002-event-descriptor-cycle-semantics.md) /
[ADR-0003](../../decisions/adr-0003-projection-snapshot-privacy.md).

**Out of scope:** OQ9 (MVP2 sync-access), OQ11/OQ3 (payload governance/schema),
multi-chamber isolation, and the other two demo items (UC-1 above-the-fold PZN,
UC-3 block-decoration). GA4 analytics (UC-2) only.

## Assumptions

- The runtime shape is fixed by the accepted ADRs (0001 plain Worker; 0002 the
  descriptor/cycle + normal-path egress on idle; 0003 snapshot default-deny) and
  the pinned contracts. This spike implements them; it does not re-decide them.
- INP is measurable in-page via `PerformanceObserver` `event`/`first-input`
  timing and the `web-vitals` attribution model (measures the slowest
  interaction, the tail). [To be probe-confirmed in slice 003-01; if the browser
  automation cannot capture a stable p75 under storm, the scoreboard method is
  revisited — Kill criteria.]
- A `patchDatalayer`-style baseline (main-thread map + `fetch` keepalive send,
  deferred via `requestIdleCallback`) is a *fair, competent* main-thread
  comparison — not a strawman. [Design choice; the baseline must also defer work
  to idle, or the comparison flatters the worker — review R1.]
- The EDS testbed page (`aem up`) is a faithful-enough real EDS page for
  CWV/INP measurement (R-005). Local same-host serving flatters absolute cost;
  the *delta* between two runtimes on the same page is the load-bearing number.

## Kill criteria

- The measurement rig cannot produce a stable, discriminating INP p75 under
  interaction-storm load (noise swamps the delta). Then the bet cannot be
  answered by this method; revisit the measurement (more samples, a synthetic
  long-task injector) before drawing a go/no-go.
- The worker path does **not** beat the baseline on INP p75. Then the thesis is
  not retired — record it honestly and stop-and-re-shape MVP1 (release-plan
  release-check).

## Decomposition

**SPIDR axis: Path.** The spec is a spike (research: does the bet hold?); the
*build* splits by path through the same story — the main-thread baseline path
first (simplest, and it establishes the measurement rig — review R1), then the
worker path, then the head-to-head answer. Each slice delivers a real,
observable measurement, not intermediate state.

### Slices

1. **[003-01 — baseline + measurement rig](slice-01-baseline-rig.md)** — the
   `patchDatalayer`-style main-thread path on the testbed, plus the
   interaction-storm + INP + GA4-conformance harness. Delivers the baseline
   number and the rig everything else measures against.
2. **[003-02 — the airlock worker path](slice-02-worker-path.md)** — push → log
   + sync projection → ring buffer → drain/cycle → Worker chamber → GA4 connector
   → keepalive egress, measured on the same rig. Delivers the worker number +
   MP-conformant payload + per-stage delivery-rate.
3. **[003-03 — scoreboard + the answer](slice-03-scoreboard.md)** — the
   head-to-head (worker vs baseline INP p75 under storm; delivery-rate; a
   Lighthouse pass) and the recorded go/no-go that resolves OQ10.

## Findings

**Rig built and validated (003-01).** Playwright drives a trusted-interaction
storm; per-interaction latency is read from the Event Timing API. Validated: a
handler that busy-waits 50ms yields INP p75 48ms — the rig measures the tail. The
GA4 map→MP connector is conformance-tested against the pinned contract (5/5;
reserved-name case rejected, so the `ga4_mp_conformance` link is real).

**Load-bearing early finding — the thesis needs sharpening.**
`requestIdleCallback`-scheduled work **does not harm INP**: the browser
deprioritizes idle callbacks whenever input is pending. A `patchDatalayer`-style
baseline that maps on the main thread but drains on `rIC` measured INP p75 ~8ms
even at 1000 events × 12ms modeled mapping (12s of deferred work) — it all ran
after the storm settled, never contending. So:

- Against a **competently-deferred** (rIC) main-thread baseline, the worker gives
  **≈ no INP advantage** at GA4 loads. That baseline is already INP-safe.
- The worker's INP win is over the **common naive** case — synchronous mapping in
  the interaction handler (what gtag/GTM effectively do), which measured INP p75
  ~48ms at 50ms/interaction of mapping.
- The worker's durable advantages are therefore: **INP-safe by construction** (no
  deferral discipline to get wrong), main-thread freed for other work, and a real
  win under **heavy or indivisible** mapping (the MVP2 wrapped-SDK / alloy case),
  where chunked-yield deferral can't fully hide the cost.

**Consequence for the scoreboard (003-03):** the head-to-head must compare the
worker against **both** a naive-synchronous baseline and the rIC-deferred baseline,
across light→heavy loads, and characterize *where* the worker wins — not assert a
blanket INP victory. This honestly qualifies the risk-retirement bet and feeds
OQ10 (the delivery/INP tradeoff). It does **not** refute the runtime; it relocates
its value from "beats main-thread on INP" to "INP-safe by construction + wins the
common case + wins heavy load."

### Head-to-head result (003-02 + 003-03) — the realistic case

Modelled the real-world failure mode (domain report 2026-08-26): **5 trackers,
each ~30ms of synchronous logic on click, each to its own endpoint, no deferral.**
60-interaction storm on the rig.

| runtime | INP p75 | INP p98 | delivery (normal settle) |
|---|---|---|---|
| **naive** (synchronous, sequential, no deferral — what most stacks run) | **152ms** | 152ms | 300/300 |
| deferred (rIC-chunked, best-practice main-thread — rarely seen) | 8ms | 8ms | 300/300 |
| **worker** (airlock, off-thread) | **8ms** | 8ms | 300/300 |

- **The worker beats the common real-world case ~19× (152 → 8ms)** and matches the
  best-practice main-thread approach — while giving that INP-safety **by
  construction** (off-thread, capability-mediated: the naive version is
  *impossible* to write in the airlock), plus per-tracker isolation.
- **OQ10 resolved by measurement.** Delivery is only 300/300 when the worker is
  given time to drain. When the page closed early (before the worker's 9s of
  off-thread work finished), it delivered **155/300** — the worker's pending
  egress is lost at teardown (R-001). So the egress model MUST backstop delivery
  on the main thread at `visibilitychange`→`hidden` (ADR-0002 egress path / OQ10);
  a naive worker-only egress silently drops the tail under load.

**Answer to the bet:** retired, with an honest reframing. The worker delivers a
large, real INP win in the case that actually occurs in production, and it does so
*structurally*. The blanket claim "beats a competent main-thread version on INP"
is false at GA4 loads (rIC ties it); the true, defensible claims are **INP-safe by
construction**, **~19× better than the common naive stack**, and **wins heavy /
indivisible load** — plus it exposes OQ10's delivery requirement with data.

### Egress backstop + Lighthouse (003-03)

**Egress backstop (OQ10) implemented — ADR-0002 Option C.** The worker now MAPS
off-thread and RETURNS ready requests; the orchestrator DISPATCHES on the main
thread via `fetch` keepalive, with a `visibilitychange`→`hidden` flush. Re-measured:
INP p75 stays **8ms** (mapping still off-thread) and delivery is **300/300** under
normal settle. Main-thread keepalive dispatch is where delivery survives teardown.
**Still OQ10-open:** a beacon *generated inside* the unload window cannot round-trip
to the worker to be mapped — it needs a main-thread synchronous mapping fast path
for declared unload-critical event types (the ADR-0002 kill-criterion, now
confirmed by measurement).

> **Post-spike update (2026-08-26 — [ADR-0004](../../decisions/adr-0004-egress-dispatch-delivery.md)):**
> this last item is now **closed**. The fast path is implemented (`core/egress.js`
> `createCriticalDispatcher`; `pushCritical()` + the `visibilitychange`/`pagehide`
> ring-tail flush) and re-measured (`rig/teardown.mjs`): enqueued last beacon lost
> in the teardown window (0/5), `pushCritical` delivers it (5/5), ring-tail flush
> delivers the tail (50/50), steady-state INP p75 unchanged (8ms). Recorded in
> ADR-0004, which extends ADR-0002's deferred egress section; OQ10 is resolved.

**Lighthouse (load CWV).** The runtime adds **TBT 0ms, CLS 0** — no blocking time,
no layout shift. Bare control: perf 99 (LCP 752ms). Runtime loaded eagerly,
unbundled: perf 89 (LCP 924ms). The ~172ms LCP gap is an artifact of (a) unbundled
ESM dev-serving (a 4-module load chain: harness → airlock → worker → map) and (b)
loading the runtime *eagerly* in the harness. On a real EDS page the runtime loads
in the **lazy/delayed** phase (after LCP, AD-8) and bundled, so its LCP impact is
~0. TBT=0/CLS=0 is the structural result: the runtime is Lighthouse-clean.

## Outcome

**The risk-retirement bet is retired, with an honest reframing.**

1. **INP (the crux):** in the realistic multi-tracker, no-deferral case (the common
   production stack), the worker is **~19× better** (152ms → 8ms) and matches the
   best-practice main-thread approach — delivering that INP-safety **by
   construction** (the naive version is impossible to write in the airlock), with
   per-tracker isolation. The blanket "beats a competent main-thread version on
   INP" is false (rIC ties it); the true claims are INP-safe-by-construction,
   ~19×-over-the-common-case, and wins-heavy/indivisible-load.
2. **Lighthouse:** runtime is CWV-clean at load (TBT 0, CLS 0); LCP impact is a
   dev-serving / eager-load artifact, ~0 with EDS lazy-phase + bundling.
3. **Delivery / OQ10, advanced by measurement:** Option-C egress (worker maps,
   orchestrator dispatches) delivers 300/300 and is INP-safe; the unload-generated
   last beacon still needs a main-thread mapping fast path — the one remaining OQ10
   item, now evidence-backed. **(Closed post-spike by
   [ADR-0004](../../decisions/adr-0004-egress-dispatch-delivery.md): fast path
   implemented + re-measured; OQ10 resolved.)**

`Outcome: risk-retirement bet retired (reframed); OQ10 advanced by measurement
(Option-C egress implemented; unload fast-path remains open); runtime seed built
(core/, connectors/ga4/).`

`Post-spike: OQ10 fully closed — unload synchronous fast path implemented +
re-measured, egress model recorded in ADR-0004 (2026-08-26).`

**Lifecycle note (spike-light).** Per the slices' DoD and the appetite (measurement
over polish), this spike ran a light review: the code is tested (vitest green,
conformance-linked) and every measurement is reproducible (`npm run rig`,
`MODE=worker node rig/lh.mjs`). The full per-slice multi-pass review is deferred to
when the runtime graduates from spike to product.
