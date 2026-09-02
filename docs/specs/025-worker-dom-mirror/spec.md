---
status: DRAFT
skill: jig:spec-workflow
use_cases: []
---

# Spec 025: worker-dom minimal mirror (Lever-2 compat layer, Tier 0)

> Builds the decision in **[ADR-0014](../../decisions/adr-0014-worker-dom-compat-minimal-mirror.md)** — a
> minimal airlock-owned worker-dom mirror (async mutation-flush, no SAB, AD-4-preserving) as the Lever-2 compat
> layer for **unmodified** costly-DOM tags. **De-risk-first** (ADR-0014 §Coverage + the frame-critique): the
> mirror build must not run ahead of the two bets it rests on.

## Overview

Build airlock's **minimal, own** worker-dom mirror so an *unmodified* write/compute-heavy tag runs off-thread
(computation in a chamber; mutations serialized async + frame-budgeted onto the main thread), containing its
INP. **But gate the build on a cheap de-risk first** — ADR-0014 flagged two unproven bets, and the maintainer
set a hard adoption criterion: **a common tag that won't run is a kill switch.**

## The two bets to validate BEFORE building (ADR-0014, honest)

1. **The main-thread mutation-apply is INP-safe** under a heavy mutation burst (off-thread computation isn't
   just the long task *moved* to the apply) — **unmeasured** (024-01 AC3 deferred).
2. **A useful population of unmodified write/compute-heavy-*without*-sync-read tags exists** — **unvalidated**,
   and R-007 is the wrong yardstick (connector-fit, not DOM-cost shape). Tier 0 may cover a *minority* of
   costly tags (the worst/most-common are sync-read = the Tier-0 gap).

## The litmus (maintainer, 2026-09-02): **unmodified GA4 is the kill switch**

The de-risk gate tries to run **unmodified `gtag.js`** in a worker-dom mirror. **GA4 fails → stop** (don't
build Tier 0 standalone). GA4 is the most common tag and the honest adoption test — a real drop-in, not a
synthetic ideal. **Clarification (not a contradiction):** airlock *already* supports GA4 via the wire-protocol
GA4 connector (spec 004/008) — the maintained "adapted" path. This gate tests the *second* adoption path (the
**unmodified drop-in** mirror), i.e. the "offer options / easy migration" story. So the kill switch is: *does
the drop-in path handle GA4?* — not *does airlock support GA4* (it does).

## Current state (grounded)

- ADR-0014 Accepted (2026-09-02): minimal mirror, Tier 0 (async, no SAB); Tier 1 (SAB) deferred.
- Spike [024](../024-worker-dom-compat-spike/spec.md): worker-dom's async model is AD-4-compatible; the
  sync-read boundary; `@ampproject/worker-dom@0.36` is installable — usable to **probe cheaply** before
  building airlock's own mirror.
- [023](../023-dom-cost-containment-poc/spec.md): the Event-Timing within-storm-p75 INP measurement method
  (the same instrument the de-risk gate uses) + Lever 1 (the main-thread path for adapted/sync-read tags).

## Assumptions

- Carried from ADR-0014: the apply-INP-safety (central unproven bet) + the useful-population assumption are
  what 025-01 **validates or kills** — they are not assumed true here, they are the gate's job.
- `@ampproject/worker-dom@0.36` can host unmodified `gtag.js` well enough to *probe* the mechanism (even if
  airlock ultimately builds its own mirror) — **to confirm in 025-01**; if the lib itself can't boot gtag.js,
  that is itself a strong signal about the drop-in path.

## Decomposition

SPIDR — **S then P**: a de-risk **spike** gates a **path** build. 025-01 is genuinely a learning/validation
activity (the two bets are unknown) whose Outcome decides whether 025-02+ happens at all — the honest shape
for a bet ADR-0014 itself flagged as unproven.

- **025-01 (Spike — the de-risk gate):** run **unmodified `gtag.js`** in `@ampproject/worker-dom` (cheap probe,
  not airlock's own mirror yet); does it **boot + run**? Measure the main-thread mutation-apply INP (the 023
  way); assess whether a **useful population** of drop-in-compatible common tags exists (GA4 the litmus, plus a
  couple more common tags). **Outcome: GO** (build airlock's minimal mirror, 025-02) **or KILL** (GA4/common
  tags don't run, or the apply re-tanks INP → don't build Tier 0 standalone; route effort to Lever-1
  adaptation / the pixel connector / reconsider Tier 1).
- **025-02+ (Path — the minimal mirror build, GATED on 025-01 = GO):** airlock's own worker-side DOM mirror
  (minimal subset) + the worker→main mutation-serialize channel + the frame-budgeting coordinator, replacing
  the probe's `@ampproject/worker-dom`. Detailed only after the gate passes; the minimal DOM subset is defined
  by what the gate's tags actually need.

## Slices

- [025-01 — GA4-drop-in de-risk gate (GO/KILL)](slice-01-ga4-drop-in-gate.md)
- _025-02+ (not yet reserved) — the minimal mirror build, gated on 025-01 = GO. Framed when the gate passes._
