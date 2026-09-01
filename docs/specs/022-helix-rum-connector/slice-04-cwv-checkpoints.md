---
status: DRAFT
dependencies: [022-01]
last_verified: 2026-09-01
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 022-04 — CWV/interaction checkpoints (native runtime capture)

> Split out of 022-02 (maintainer "do the split", 2026-09-01). This is the CWV surface — the part that needs
> a **new** capture, because 022-01's grounding showed `helix-rum-enhancer` can't host in a chamber
> (mechanism A: `document`-requiring loader + `sendBeacon`-blocked egress). So airlock **reproduces** the
> enhancer's CWV/interaction checkpoints natively (mechanism **B-extended**).

**Goal:** Give airlock its own **runtime per-page CWV capture** (LCP / CLS / INP + the enhancer's
interaction checkpoints) on the main thread, and emit them as RUM checkpoints through the DONE 022-01 governed
path — so airlock covers the **full** `sampleRUM`+enhancer checkpoint set natively and the page copy can be
removed (022-03) with no signal loss. airlock is **CWV-first** — this promotes its existing oracle-time CWV
measurement into a runtime capture, the aligned home for RUM.

**DoR:**
- ✅ 022-01 DONE: the governed path + the connector shape each checkpoint rides.
- ✅ 022-01 grounding: the enhancer is **not** cleanly chamber-hostable, so this is native reproduction, not a
  hosted SDK (recorded in 022-01 Findings).
- ✅ airlock's CWV measurement primitives exist but are **diagnostic/oracle-time** today (`rig/cwv-budget.mjs`;
  `aem-cwv-helper`'s `observeLayoutShifts`/`observeSlowInteractions`, vision §Tech) — this slice makes them a
  **runtime** capture feeding the connector. **Grounded** (spec Assumptions).
- ⚠️ **NOT yet grounded (this slice's first job — the live enhancer probe 022-01 deferred):** the EXACT
  CWV/interaction **checkpoint set** `helix-rum-enhancer` emits (checkpoint names, the entry types, the
  cadence) — needed so airlock reproduces the real wire contract, not a guess.

**Acceptance Criteria:**

1. **Ground the enhancer's checkpoint set (the deferred live probe).** Probe `@adobe/helix-rum-enhancer`
   (its published source) to enumerate the CWV/interaction checkpoints it emits (e.g. `cwv`/`lcp`/`cls`/`inp`,
   `click`, `viewmedia`, `viewblock`, `enter`, `navigate`, …), each checkpoint's payload fields, and which
   `PerformanceObserver` entry types / DOM events feed them. Record the **definitive** set + which airlock
   will reproduce (and any it deliberately won't, named). This is the load-bearing grounding — do not build a
   capture against a guessed contract.
2. **Native runtime CWV capture → governed RUM checkpoints.** Capture LCP/CLS/INP (and the grounded
   interaction checkpoints) on the main thread via `PerformanceObserver` (promoting airlock's oracle-time
   measurement), and emit each as a RUM checkpoint (`{ weight, id, referer, checkpoint, t, ...cwvData }`)
   through the **022-01** confined, not-consent-gated path — same `id`/`weight` as the page's `top`/`error`.
   Observable: a real LCP/CLS/INP → the grounded checkpoint beacon, held if the endpoint is re-pointed,
   fired regardless of consent.
3. **CWV-safe by construction + parity.** The capture must not itself regress CWV (it is `PerformanceObserver`
   + the O(1) projection discipline — INP-safe-by-construction, per airlock's core thesis); sampling gates it
   uniformly (unselected → silent); combined with 022-02, airlock is now a **complete** `sampleRUM`+enhancer
   stand-in (the precondition 022-03's cutover checks).

**DoD:**
- [ ] AC1 grounding recorded (the enhancer checkpoint set, with probe evidence). ACs 2–3 pass. Tests: each
      captured CWV checkpoint maps to the grounded shape + rides the governed path; CWV-safe (the capture is
      cheap / off the interaction path); sampling gates it. Sweep: `helix-rum-*`, `cwv*`, `endpoint-ceiling`.
- [ ] **Frame-critique** (the load-bearing premise: airlock can reproduce the enhancer's CWV checkpoints
      natively at parity — the checkpoint set must be *grounded from the real enhancer*, and the runtime
      capture must be genuinely CWV-safe, not a new main-thread cost) + compliance + craft + reconciliation.
- [ ] Deviation log + reconciliation sweep; the **production-wiring** fork (022-01-flagged: a RUM-dedicated
      `createAirlock` instance with empty `egressPurposes`; dedicated worker vs connector-generic
      `core/airlock.js`) is **decided here or explicitly carried to 022-03** — it can no longer stay open once
      a real capture must feed a real instance. `mvp4.md` row updated.
- [ ] **No live identifiers committed.**

**Anti-horizontal-phasing check:** real CWV telemetry (LCP/CLS/INP) crosses the seal, governed + confined —
the observability payoff airlock's CWV-first thesis promises, sourced by airlock itself. Not internal
plumbing: it's the signal that, with 022-02, lets 022-03 remove the page's `sampleRUM` without losing CWV.
