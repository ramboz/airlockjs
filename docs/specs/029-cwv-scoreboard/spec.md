---
status: DONE
skill:
frame_review: true
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md. -->

# Spec 029: The before/after CWV scoreboard

> Reserved on 2026-09-03 via `workflow.py new`. MVP5 — promote the advisory `cwv_budget` oracle into a
> first-class, reproducible before/after scoreboard (the vision's punchline, OQ6 residual).

## Overview

MVP5's second piece (after the 028 inspector): make airlock's CWV win a **first-class, reproducible output**,
not prose. The vision's punchline — *the naive multi-tracker stack tanks INP; airlock keeps it flat* — is
measured and true (spec 003, 2026-08-26) but lives only as a table in `spec.md`/`architecture.md`. This spec
packages it into a runnable command that emits a durable, legible before/after artifact.

**`use_cases: []` — the cross-cutting oracle, not a 4th customer use case.** The vision names this explicitly
(`product-vision.md:53`): *"Implicit success criterion (not a use case — it's the oracle): prove all three [UC-1/2/3]
land at ~zero CWV cost, shown on a before/after … scoreboard."* The scoreboard **validates** UC-1/2/3; it is not
a UC itself. This spec **resolves the OQ6 scoreboard residual** (`refinement-todo.md`: OQ6's flicker-routing half
was resolved by ADR-0005/007-03; *"this is also where the before/after CWV scoreboard becomes a pinned
measurement surface"* was carried forward to MVP5).

**Grounding (2026-09-03 — the measurement science is RETIRED; the gap is packaging):**

- **Both endpoints reproduce TODAY.** `MODE=naive node rig/measure.mjs` → ~152ms; `MODE=worker …` → ~8ms
  (`rig/harness.html:49-53` maps `naive → baseline/naive.js`, `deferred → baseline/patch-datalayer.js`,
  `worker → core/airlock.js`). `baseline/naive.js` is a real synchronous multi-tracker (sequential `mapToMp` +
  busy + `fetch`, no deferral). The Lighthouse before/after arm also exists (`rig/lh-eds.mjs`: runtime OFF vs ON,
  median TBT/CLS/LCP deltas, JSON out).
- **What's MISSING is small + packaging-shaped:** nothing runs the **naive arm as the "before"** (the shipped
  `rig/cwv-budget.mjs` deliberately pairs *deferred*-vs-*worker*, a ~0ms delta by design — `:78-79`), and nothing
  emits a **durable, legible artifact** (today: ephemeral stdout tables / a CI `cwv-report.txt`).
- **A proven scoreboard SHAPE to copy:** `rig/nasty-tag.mjs` (spec 023) already does a fair before/after —
  fresh-browser-per-run, N-median + noise band, work-completed fairness row, JSON emission, a decisiveness
  verdict — for a *different* thesis (Lever-1 DOM chunking). Copy the shape, not the engine.
- **Routing is SETTLED (ADR-0005) — do not reopen.** The scoreboard is **advisory / jig-supervised**, OUTSIDE
  `oracle.sh`'s gating composite (`COMPONENTS` = `vitest` + `ga4_mp_conformance` only). It rides the existing
  `browser-oracle` CI job as an advisory artifact upload. No gating-design question here.

**THE load-bearing honesty (the frame-critique target):** the scoreboard must be **honest, not a marketing
overclaim.** The vision's own positioning (`product-vision.md` § Design principles) is: *"INP-safe-by-construction
+ wins-the-common-case + wins-heavy/indivisible-load + per-tracker isolation — **NOT** a blanket 'beats a
competent main thread on INP' (a well-deferred main thread **ties** it at GA4 loads)."* Spec 003's own table is
the honest triple: **naive 152ms / deferred 8ms / worker 8ms.** So the scoreboard shows the **naive / deferred /
worker triple**, telling the true story — *airlock matches a competently-deferred main thread **without the
deferral discipline that baseline must get right by hand**, and both crush the naive multi-tracker stack that
real sites actually run.* A naive-vs-worker-only "19×" headline, absent the deferred baseline, would overclaim.

## Assumptions

- **Showing naive-vs-worker ALONE would overclaim; the honest artifact must include the DEFERRED baseline.**
  This is the spec's load-bearing framing bet (frame-critique target). Grounded in the vision's honest-positioning
  principle + spec 003's triple + the deliberate design of `cwv-budget.mjs` (it measures deferred-vs-worker
  precisely to avoid the overclaim). If a reviewer argues the punchline should be naive-vs-worker only (simpler,
  bigger number), that is the frame to attack.
- **The engines reproduce — DEMONSTRATED 2026-09-03 (not asserted), and the fast arms are FLOOR/single-sample.**
  Fresh `rig/measure.mjs` re-probe on the dev machine: **naive `inp_p75 = 152ms` over 61 interactions** (a real
  p75 — `baseline/naive.js` = `5 × busy(30000µs)`, wall-clock, hardware-independent); **deferred `inp_p75 = 0` /
  worker `inp_p75 = 8`, each over 1 interaction** — because `rig/harness.html`'s Event-Timing observer uses
  `durationThreshold: 16`, the fast arms' sub-16ms steady-state interactions are **below the INP measurement
  floor and dropped**, leaving only the cold `first-input`. So the honest artifact reports the fast arms as
  **at/below the 16ms floor** (single-digit ms, `interactions` count disclosed), **never a precise "8ms" p75**,
  and the headline is a **band** (`~150ms → sub-16ms floor; ~19× vs naive; ties deferred`). This is a **craft**
  measurement-honesty requirement (the fairness AC + craft review guard it), not a wrong frame.
- **Durable ≠ regenerable (frame-critique #1).** `rig/out/` is **gitignored** — the per-run JSON/card there is
  the reproducible *cache*, not the durable artifact. The durable first-class output is a **committed**
  `docs/scoreboard.md` in **tolerance-band + provenance** language (never raw run output), so a fresh run on
  other hardware cannot contradict the committed headline.
- **No gating-design question.** ADR-0005 already routed the scoreboard advisory/jig-supervised, outside
  `oracle.sh`. This spec does not change gating; a reviewer need not re-litigate it.

## Decomposition

SPIDR — the punchline artifact first (the must-land), the fuller CWV picture + CI second, realistic load last
(deferrable per `mvp5.md`, which marks it "flexes on the customer stack being available"). Not a spike — the
measurement is retired; this is packaging.

- **029-01 — the INP scoreboard artifact (Interface + Data).** A `rig/cwv-scoreboard.mjs`
  (`npm run cwv:scoreboard`) that runs `rig/measure.mjs` under **naive / deferred / worker** (N-median + noise
  band, reusing `cwv-budget.mjs`'s cross-invocation discipline + work-completed fairness), and emits **one durable
  before/after artifact** — JSON + a rendered markdown card — stating the **honest triple** (naive 152 / deferred
  8 / worker 8), the ~19× win **vs the naive stack**, and the "ties a competently-deferred main thread, without
  the discipline" honesty. The fixed core / the punchline as a runnable command.
- **029-02 — the load-CWV arm + CI (Data).** Fold `rig/lh-eds.mjs`'s off-vs-on Lighthouse TBT/CLS/LCP deltas
  into the scoreboard (the field-INP half + the load-CWV half = the full before/after the vision names), and wire
  it into the existing `browser-oracle` CI job as an **advisory** artifact upload (per ADR-0005). Fixes the
  `lh-eds.mjs` stdout-banner hygiene wart if the scoreboard consumes its JSON.
- **029-03 — realistic martech load (Data) — DEFERRABLE.** Run the scoreboard against a realistic martech load
  (vs the synthetic 5-tracker micro-fixture), per `mvp5.md` (flexes on the customer stack being available). The
  RUM-subsume is a SEPARATE MVP5 spec, not a slice here.

**Anti-horizontal-phasing check:** 029-01 delivers, end-to-end, a runnable command emitting the punchline
artifact a developer/maintainer can read; 029-02 adds the load-CWV dimension + CI visibility; 029-03 raises
fidelity to a real load. Each is a usable increment, not internal plumbing.

## Slices

- [029-01 — the INP scoreboard artifact](slice-01-inp-scoreboard-artifact.md)
- [029-02 — the load-CWV arm + CI](slice-02-load-cwv-ci.md)
- [029-03 — realistic martech load (deferrable)](slice-03-realistic-load.md)
