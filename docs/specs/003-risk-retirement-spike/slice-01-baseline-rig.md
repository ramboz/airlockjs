---
status: DRAFT
dependencies: []
last_verified:
---

## Slice 003-01 — baseline + measurement rig

**Goal:** On the EDS testbed, a `push()`-shaped GA4 event is mapped and sent the
`patchDatalayer` (main-thread) way, and a measurement harness drives an
interaction storm and reports a baseline INP p75 — the rig everything else is
measured against.

**DoR:**
- ✅ Pinned [contracts/](../../../contracts/README.md) (GA4 MP schema + golden
  fixtures) and the [EDS testbed](../../../probes/eds-testbed/) exist.

**Acceptance Criteria:**

1. **Main-thread baseline path.** A `pushBaseline(event)` entry on the testbed
   page captures a GA4 event, and — deferred to idle (`requestIdleCallback`) on
   the main thread — maps it to a GA4 Measurement Protocol payload and sends it
   via `fetch(url, { keepalive: true })`. (A competent baseline: work is deferred
   off the interaction, not run inline.)
2. **Conformance.** The emitted MP payload validates against
   `contracts/ga4-mp-request.schema.json` (the hermetic `ga4_mp_conformance`
   half) — provable by feeding a captured payload through `contracts/validate.mjs`
   or an equivalent assertion.
3. **INP-under-storm rig.** A harness drives a scripted interaction storm (rapid
   repeated interactions while events are being pushed) and reports INP as a p75
   over the storm, using the `web-vitals` attribution model (the tail, not a
   single click). The number is retrievable programmatically (e.g. on `window`).
4. **Baseline number recorded.** Running the rig against the baseline path yields
   a concrete INP p75 and a delivered-beacon count, captured in the slice's
   Findings.

**DoD:**
- [ ] ACs 1–4 pass; unit tests cover the map-to-MP and the INP-p75 computation.
- [ ] Each new test shown capable of failing (mutate → red → restore).
- [ ] Spike-light review: self-verified against ACs; full multi-pass review
      deferred (the runtime graduates from spike to product later, where it earns
      the production review gate). `JIG_REVIEW_EVIDENCE_GATE=0` used for lifecycle
      transitions, noted here.
- [ ] Deviation log + reconciliation sweep produced.

**Anti-horizontal-phasing check:** after this slice, a real GA4 event flows
end-to-end (capture → MP payload → keepalive send) the main-thread way on a real
EDS page, and you can read a baseline INP p75 for it. That is the observable
value: the comparison floor.
