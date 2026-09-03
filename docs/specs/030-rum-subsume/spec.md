---
status: DRAFT
skill:
frame_review: true
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md. -->

# Spec 030: airlock as the RUM layer (the subsume)

> Reserved on 2026-09-03 via `workflow.py new`. MVP5's final piece — resolve the MVP4 helix-rum
> feed/replace/coexist decision toward **replace** and make airlock the page's governed RUM authority for the
> core checkpoints.

## Overview

MVP5's variable-scope piece (after the 028 inspector + the 029 scoreboard): **airlock becomes the page's
governed, off-thread RUM authority** — *"airlock replaces your RUM tag: off-thread, governed, and it's already
measuring."* The [022 helix-rum connector](../specs/022-helix-rum-connector/spec.md) already **emits** the core
RUM checkpoints natively and governs their egress; this spec makes airlock **bootable as the RUM authority in
production** and resolves the MVP4 feed/replace/coexist decision toward **replace** (for the core checkpoints).

**`use_cases: []` — cross-cutting observability/governance, not a 4th customer use case.** RUM is CWV-first
performance telemetry (R-007's host-or-subsume opportunity), the same infra class as the 028 inspector — it
serves the trust/observability of the deployment, not one of the UC-1/2/3 customer behaviors.

**Grounding (2026-09-03 — the emission is DONE; the subsume is a page-side authority switch, no new runtime
capability):**

- **Airlock already emits + governs the core RUM checkpoints** ([spec 022](../specs/022-helix-rum-connector/spec.md),
  DONE): `top` / `error` / `cwv` reproduced natively (`connectors/helix-rum/`), **confined to `ot.aem.live`**,
  **not consent-gated** (`purposes.egress: []` — a distinct governance class, `lightweight-decisions.md`
  2026-08-31), payload-hygienic (two whitelist layers), ephemeral per-page id (no cookie capability). CWV comes
  from a **main-thread** `web-vitals/attribution` capture (`cwv-capture.js`) — LCP/CLS/INP are document-scoped
  `PerformanceObserver` types a Worker can't see; the chamber isolates only mapping + egress. Proven against the
  real `createAirlock` seam (`test/helix-rum-seam.test.js`).
- **What the subsume ADDS is all page-side / adapter — no `core/` capability is new:** (a) a
  **production-bootable RUM instance** — a `bootHelixRum` adapter (`createAirlock` with `egressPurposes: []`) +
  a new emitted `helix-rum-chamber.worker.js` + a connector-selection branch + a `build.mjs` entry (the **exact
  patterned addition** 026's `pixel-chamber` and 025's `dom-chamber` each made — the runtime is already
  multi-instance + connector-generic); (b) the main-thread capture wiring the DONE slices left as one-call-site
  changes (import the **real** `web-vitals/attribution`, `push({event:"top"})` on load, the error listeners); (c)
  the **page-side replace** — neutralize the inline `sampleRUM` on the testbed so airlock owns the single
  governed path (no double-count).
- **The double-count is a pure page-integration concern** — until the page's `sampleRUM` is removed, airlock's
  `top` is redundant with it (the honest boundary 022-01 AC3 already named). Nothing in `core/` changes to avoid
  it; "replace" = don't call `sampleRUM`, do boot airlock's RUM.

**THE load-bearing honesty (frame-critique target): this is a SCOPED, opt-in replace — not "airlock replaces
your whole RUM."** Two honest bounds, both grounded:

1. **Core checkpoints only.** `sampleRUM` is a single function that emits `top` + `error` + CWV **and** the
   enhancer's **interaction/lifecycle** checkpoints (`click`/`viewblock`/`enter`/`navigate`/`formsubmit`/…).
   Airlock covers `top`/`error`/`cwv`; it does **NOT** reproduce the interaction/lifecycle set — that full-enhancer
   parity was deliberately deferred (`lightweight-decisions.md` 2026-09-01: "governance exemplar, not full native
   reproduction") to the worker-dom compat layer or a community connector. That worker-dom vehicle is now
   **PAUSED** (spec 025's innerHTML net-regression) — which blocks *full parity*, not this core-checkpoint
   subsume. **Honest cost:** a deployment that needs the enhancer's interaction/lifecycle richness is NOT served
   by this replace (it keeps `sampleRUM` / waits). This spec must never claim to cover them.
2. **A REAL production cutover is creds-gated.** Airlock's `cwv` body is a flat `{name,value,…attribution
   scalars}` **superset**, corroborated only against a stale 2024 pre-attribution enhancer clone — **never
   verified against the live `ot.aem.live` collector**. The mechanism is built + demonstrated **in-repo** (the
   testbed) now; a real page must **not** be cut over onto an unaccepted shape, so the live wire-shape
   confirmation is a **named, creds-gated deferral** — a hard gate on real production adoption, even though the
   wiring itself is done.

## Assumptions

- **A core-checkpoint-only, opt-in "replace" is an honest, valuable subsume — not an overclaim.** This is the
  load-bearing framing bet (frame-critique target). Grounded: for a CWV-first governance runtime, replacing the
  RUM tag's core signals (page-views, errors, CWV) with one governed off-thread emitter IS the value prop; the
  interaction/lifecycle richness is a known-deferred extension. If a reviewer argues a partial replace is not a
  real "subsume" (it drops interaction/lifecycle; the live shape is unconfirmed), that is the frame to attack —
  and the answer must be the honest scoping + the deferral, never a blanket claim.
- **The RUM chamber worker + connector-selection branch is a patterned addition, not new runtime work** —
  grounded in 026 (`pixel-chamber`) + 025 (`dom-chamber`): `core/airlock.js` already has the seam,
  `adapters/eds/index.js` already boots four independent instances, `build.mjs` already asserts N same-origin
  worker siblings. A reviewer should verify the RUM chamber mirrors that pattern (confine-first, GET/egress
  shape), not invent a new hosting model.
- **The live `ot.aem.live` wire-shape check stays deferred (creds-gated).** This spec builds + demonstrates the
  mechanism against the testbed; it does NOT verify the live collector accepts airlock's `cwv` superset. Not an
  in-repo blocker — a named gate on real production cutover.

## Decomposition

SPIDR — the bootable RUM authority first, the observable page-side replace second, the adoption boundary +
decision landing third. Not a spike — the emission is DONE (022); this is page-side wiring + honest scoping.

- **030-01 — the production RUM authority (Interface + Data).** A `bootHelixRum` adapter instance
  (`createAirlock`, `egressPurposes: []`, selecting a new `helix-rum-chamber.worker.js` via a connector-selection
  branch + `build.mjs` entry — mirroring `pixel-chamber`/`dom-chamber` + `confine-helix-rum-chamber.js`), wiring
  the **real** `web-vitals/attribution` capture + `push({event:"top"})` on load + the error listeners. Airlock is
  now bootable as a governed RUM emitter in production, confined to `ot.aem.live`, not consent-gated.
- **030-02 — the page-side replace + no double-count (Path).** On the `probes/eds-testbed`, neutralize the inline
  `sampleRUM` and boot airlock's RUM as the single authority; a rig proves **exactly one** governed beacon per
  checkpoint (no double-count), confined + not-consent-gated. The observable "replace, `sampleRUM` off."
- **030-03 — the scoped-replace boundary + the decision landed (Rules + Interface).** Land the MVP4
  feed/replace/coexist decision as **replace (core checkpoints)**; document the integrator drop-in path and the
  **honest boundary** — what "replace" covers (`top`/`error`/`cwv`) vs what it does NOT (the enhancer's
  interaction/lifecycle set → worker-dom/community) and the **creds-gated live wire-shape gate** on real
  production cutover. Closes the spec.

**Anti-horizontal-phasing check:** 030-01 makes airlock bootable as a governed RUM authority (a page CAN use it);
030-02 demonstrates the replace end-to-end (`sampleRUM` off, one governed beacon per checkpoint); 030-03 lands the
decision + the honest adoption boundary. Each is a usable increment.

## Slices

- [030-01 — the production RUM authority](slice-01-rum-authority.md)
- [030-02 — the page-side replace + no double-count](slice-02-page-replace.md)
- [030-03 — the scoped-replace boundary + decision landed](slice-03-boundary-decision.md)
