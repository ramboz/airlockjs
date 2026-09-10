---
status: DRAFT
dependencies: [041-01, 040-03, 040-05]
last_verified:
---

## Slice 041-03 — batching on the live path (coalesceGa4 wired)

**Goal:** Pass `coalesce: coalesceGa4` in `bootGa4Gtag` so a same-context event burst on a rewired page egresses as
batched (and, when oversized, split) POSTs through the live core seam — the 040 payoff, previously wired only in tests.

**Blocked-on:** 041-01 (the boot fn). 040-03 (`coalesceGa4`) + 040-05 (the split). DONE.

## Current state (grounded)

- The core coalescing seam is LIVE (`core/airlock.js:380-412`): `createAirlock({ coalesce })` groups a cycle's survivors
  by `originPath` and calls the hook, re-checking each output through the endpoint ceiling. Default (`coalesce` absent) is
  byte-identical one-fetch-each.
- `coalesceGa4` (`connectors/ga4/coalesce.js`) is built + tested (040-03/040-05) but passed **only in tests**
  (`test/ga4-coalesce.test.js`); no boot wires it. `bootGa4Gtag` (041-01) does not pass `coalesce`.

**Acceptance Criteria:**

1. **`bootGa4Gtag` wires `coalesceGa4`.** Add `coalesce: coalesceGa4` to 041-01's `createAirlock({...})` call. A boot +
   a same-context cycle of ≥2 GA4 events → ONE batched `/g/collect` POST (or bounded split POSTs if over-ceiling) through
   the real seam, instead of N GETs; a single-event cycle → still the 039-01 GET. Asserted through the live
   `createAirlock` + FakeWorker path (mirror `test/ga4-coalesce.test.js`'s integration test, now driven by `bootGa4Gtag`).
2. **Governance still holds end-to-end.** The coalesced POST is dispatched only after the per-request seal +
   endpoint-ceiling (040-02), and each coalescer output is re-checked (040-02 AC1) — this slice adds no new governance
   surface, it just turns the hook on; a denied/held/ceiling-blocked event never enters a merged POST (already tested in
   040-02, re-asserted here through the gtag boot).

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Coverage: a `bootGa4Gtag` + 2-event same-context cycle → one POST (not 2 GETs); a 1-event cycle → GET; the
      governance-through-the-boot re-assertion. Each new-feature test fails on revert (removing `coalesce: coalesceGa4`
      → 2 GETs).
- [ ] Reviewed by `reviewer` (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced.

## Assumptions

- **Wiring is a one-parameter addition; the seam + strategy are already governed + tested** (040-02 governance-safe on
  inputs AND outputs; 040-03/05 the strategy). This slice carries no new load-bearing assumption beyond "the live boot
  passes the hook" — hence no `frame_review`.

## Anti-horizontal-phasing check

After this slice a burst of same-stream GA4 events on a rewired page reaches `/g/collect` as the batched POST the
container's own tag would send — the full 039+040 stack running end-to-end on a real page.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
