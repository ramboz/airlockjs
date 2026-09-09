---
status: DRAFT
dependencies: [adr-0021]
last_verified:
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

**Acceptance Criteria (spike — evidence, not shipped behavior):**

1. **Cycle-occupancy measurement.** Instrument (or replay against) representative event streams — the existing rigs
   (`rig/`) and the EDS use-case flows (UC-2 GA4, UC-1 pzn, UC-3 block-decoration) — and record, per lock-through cycle,
   how many `ready` `EgressRequest`s share a coalescing group (same endpoint + verdict + credential). Report the
   distribution (how often ≥2 same-group requests co-occur in one cycle).
2. **Projected request-count delta.** From that distribution, compute status-quo request count vs. coalesced request
   count on the measured streams. State the reduction (or its absence) as a number, not a hope.
3. **Burst realism.** Characterize whether same-group bursts arise from real patterns (e.g. a page firing page_view +
   view_item + several ep-events in one drain; UC-2's purchase with item events) or are an artifact of the rig.
4. **A written GO / SHELVE recommendation** against ADR-0021 kill-criterion #1, with the numbers behind it.

**DoD:**
- [ ] The measurement is reproducible (a committed rig/script or a documented procedure), not a one-off.
- [ ] Findings + the GO/SHELVE call recorded in this slice's `Findings:` / `Outcome:`.
- [ ] Reviewed by `reviewer` (is the measurement honest — realistic streams, no cherry-picked burst?).
- [ ] Deviation log + reconciliation sweep produced.

**Findings:** _TBD during the spike._

**Outcome:** _TBD — one of: `spec 040 unblocked (GO — build 040-02)` / `abandoned (SHELVE — no material request-count benefit, ADR-0021 kill-criterion #1)`._

## Assumptions

- **Same-group bursts occur often enough to matter — UNVERIFIED (this spike's whole point).** The efficiency case rests
  on multiple same-endpoint/same-verdict beacons landing in one drain cycle. If real airlock traffic is mostly
  one-beacon-per-cycle, coalescing is a no-op and the feature shelves. The spike must measure this on realistic streams,
  not assume it. (Why `frame_review: true`.)
- **The existing rigs/flows are representative enough to measure against.** They are the best available proxy for real
  traffic absent a production event stream; a finding of "benefit only under rig-artifact bursts" is itself a SHELVE
  signal, not a measurement to force positive.

## Anti-horizontal-phasing check

A spike is exempt from the vertical-slice rule (it ships evidence, not a user-facing layer) — but it is deliberately
scoped to *gate* the vertical work (040-02/03), not to precede a foregone build: a SHELVE outcome is a real, honored
possibility here, not a formality.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
