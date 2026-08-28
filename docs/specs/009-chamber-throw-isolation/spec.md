---
status: DRAFT
skill:
use_cases: [UC-2, UC-3]
---

# Spec 009: Chamber connector-throw isolation

> Pulled into MVP1 2026-08-27 ([mvp1.md](../../releases/mvp1.md) Cutline, OQ14).
> Closes a core ADR-0001 guarantee that is stated but not implemented.

## Overview

ADR-0001 and [architecture.md](../../architecture.md) Q1 promise the chamber
**contains** a failing connector: "drop/restart just the failing chamber; other
chambers and the page unaffected." Spec 008 made this reachable — `mapToMp` now
**throws** on a contract-invalid `purchase` — and the 008 design review found the
guarantee is **stated but not implemented**:

- [chamber.worker.js:27-38](../../../core/chamber.worker.js) maps every
  `(descriptor × tracker)` in one **un-guarded** loop and `self.postMessage({
  ready })` **once at the end**. A single throwing descriptor aborts the whole
  loop → the **entire cycle's batch** (all events × all trackers) is lost, and
  the throw escapes `onmessage` as an uncaught worker error.
- [airlock.js:48](../../../core/airlock.js) registers `worker.onmessage` with
  **no `worker.onerror`** — so a chamber-level error is swallowed silently.

Net: one malformed event silently drops a whole batch of *unrelated* good
events — strictly worse than the "unattributed conversion" 008's validation
prevents, and a violation of the isolation guarantee the airlock is built on.

This spec implements the guarantee at the two seams: **per-descriptor isolation**
inside the chamber (a throwing map drops only that descriptor; the rest of the
batch maps and delivers; the chamber survives), and a **chamber-crash backstop**
on the orchestrator (`worker.onerror`) so a chamber-level failure is surfaced,
not swallowed, and the page is unaffected.

## Assumptions

- **A1 — `mapToMp` is the throw source, per-descriptor.** The only throwing path
  today is `mapToMp` (spec 008), and its result depends on `event + ctx` (not the
  tracker index), so a throw on a descriptor recurs for every tracker of that
  descriptor — isolation is correctly scoped **per descriptor** (drop the event
  for all its trackers), not per `(descriptor, tracker)`. Verified against
  [chamber.worker.js:29-35](../../../core/chamber.worker.js) +
  [map.js](../../../connectors/ga4/map.js).
- **A2 — a dropped event must be diagnosable, not silent.** The whole point of
  008's throw was "diagnosable instead of silently landing"; isolation must
  preserve that — a dropped descriptor is *reported* (count + reason back to the
  orchestrator), not vanished. Exact surfacing (console vs the OQ7 inspector) is
  a slice decision, but silence is a non-goal.

## Decomposition

**SPIDR — split by Path** (the common malformed-event path first, then the edge
chamber-crash path):

- **09-01 — per-descriptor isolation** (the load-bearing common case): a
  throwing `mapToMp` on one descriptor drops only that descriptor (with a
  recorded reason), the rest of the batch still maps and is handed back to the
  orchestrator, and the chamber keeps handling subsequent cycles.
- **09-02 — chamber-crash backstop + drop observability** (the edge case): a
  `worker.onerror` handler on the orchestrator so a chamber-level error (one that
  escapes the per-descriptor guard) is surfaced and the page is unaffected, and
  the per-descriptor drops from 09-01 are reported (count/reason) so a dropped
  event is diagnosable.

**Not a spike** — the mechanism is known (try/catch per descriptor;
`worker.onerror`); the design questions (granularity, drop-reporting shape) are
settled in the slices, not a research unknown.

## Slices

- [009-01 — per-descriptor isolation in the chamber](slice-01-per-descriptor-isolation.md)
- [009-02 — chamber-crash backstop + drop observability](slice-02-crash-backstop-observability.md)
