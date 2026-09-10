---
status: DONE
dependencies: [041-01, 040-03, 040-05]
last_verified: 2026-09-09
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
- [x] All ACs pass; full suite green (95 files / 1458 tests).
- [x] Coverage: a `bootGa4Gtag` + 2-event same-context cycle → one POST (not 2 GETs); a 1-event cycle → GET; the
      governance-through-the-boot re-assertion. The 2-event batching test is the revert-inverse (removing
      `coalesce: coalesceGa4` → 2 GETs → fails); the 1-event + governance tests are honest re-assertions of behavior
      that holds regardless of the wiring (disclosed — see deviation log).
- [x] Reviewed by `reviewer` (compliance + craft — both PASS).
- [x] Deviation log + reconciliation sweep produced.

## Assumptions

- **Wiring is a one-parameter addition; the seam + strategy are already governed + tested** (040-02 governance-safe on
  inputs AND outputs; 040-03/05 the strategy). This slice carries no new load-bearing assumption beyond "the live boot
  passes the hook" — hence no `frame_review`.

## Anti-horizontal-phasing check

After this slice a burst of same-stream GA4 events on a rewired page reaches `/g/collect` as the batched POST the
container's own tag would send — the full 039+040 stack running end-to-end on a real page.

### Deviation log (after reconciliation)

A one-parameter wiring: `adapters/eds/index.js` imports `coalesceGa4` (`:46`) and passes `coalesce: coalesceGa4` to
`bootGa4Gtag`'s `createAirlock` (`:696`, after the `:686-695` comment block) + `test/eds-ga4-gtag.test.js` (3 new tests). No connector, seam,
or governance change. Both gating passes (compliance + craft) PASS. Notes:

1. **DoD "each new-feature test fails on revert" is loose (craft note; disclosed).** Only the 2-event batching test is a
   true revert-inverse (removing the wiring → 2 GETs → fails). The 1-event GET-passthrough and the governance tests are
   honest RE-ASSERTIONS — they hold with or without the wiring (single-event GET is coalesceGa4's AC3; seal-before-
   coalesce is 040-02's, structural) — so they pass on revert BY DESIGN. Not vacuous (they guard against wiring
   regressions); the test comments say so. The DoD wording is tightened accordingly.
2. **AC2 governance test is an all-held cohort, not a mixed granted/held cohort (compliance note; rationale recorded).**
   The stronger "one granted + one held → held absent from the merged POST" test the reviewer suggested is NOT
   constructible for gtag: the egress consent verdict is CYCLE-UNIFORM (the property 040-02/040-04 established — every
   event in one `worker.onmessage` cycle gets the same verdict), and gtag's endpoint is uniform (`/g/collect`), so a
   single cycle cannot mix granted+held or on/off-endpoint events. The all-held cohort (0 fetches) is the achievable
   form; the "held event never enters a MERGED POST" clause is guaranteed STRUCTURALLY (Phase-1 collects survivors
   BEFORE Phase-2 coalesce grouping, `core/airlock.js`) and already tested at the seam by 040-02. Same reasoning as
   040-02's send/hold/drop-can't-coexist-in-one-array deviation.
3. **Craft comment nit folded:** the wiring comment listed "Alloy" among the `createAirlock`-caller paths; corrected —
   Alloy boots via `core/wrapped-sdk-host.js`, not `createAirlock` (trivially unaffected either way).

**No deviation from:** the one-parameter scope, the connector/seam/governance boundary (untouched), or the
default-off-elsewhere property (no other `createAirlock` caller gained `coalesce`).

### Reconciliation sweep

- **`docs/refinement-todo.md` / `docs/inbox.md`:** nothing new — the batching residuals (n=1 marker grounding, deferred
  live-accept DebugView re-check) are already tracked from 040-03/040-05 and now apply on the LIVE path; no new item.
- **Deferred / carried forward:** none new.
- **Downstream:** 041-04 (declarative config selection) is the last slice; it makes `bootGa4Gtag` (now fully featured:
  boot + session/consent + batching) selectable from a page's instrumentation config.
- **Full suite:** 95 files / 1458 tests green.
