---
status: DONE
skill:
frame_review: true
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md. -->

# Spec 030: airlock as the RUM layer (the subsume)

> Reserved on 2026-09-03 via `workflow.py new`. MVP5's final piece — make airlock a **faithful** governed RUM
> authority for the core checkpoints (incl. INP at page-hide) and resolve the MVP4 helix-rum feed/replace/coexist
> decision toward **replace**.

## Overview

MVP5's variable-scope piece (after the 028 inspector + the 029 scoreboard): **airlock becomes the page's
governed, off-thread RUM authority** — *"airlock replaces your RUM tag: off-thread, governed, and it's already
measuring."* The [022 helix-rum connector](../specs/022-helix-rum-connector/spec.md) already **emits** the core
RUM checkpoints natively and governs their egress; this spec makes airlock **bootable as the RUM authority in
production** — including the one piece 022 left latent: **egressing INP (and late CLS/LCP) at page-hide** —
and resolves the MVP4 feed/replace/coexist decision toward **replace** (for the core checkpoints).

**`use_cases: []` — cross-cutting observability/governance, not a 4th customer use case.** RUM is CWV-first
performance telemetry (R-007's host-or-subsume opportunity), the same infra class as the 028 inspector.

**Grounding (2026-09-03 — the emission is DONE; the subsume adds a page-side authority switch PLUS one real core
capability the 030-01 frame-critique surfaced):**

- **Airlock already emits + governs the core RUM checkpoints** ([spec 022](../specs/022-helix-rum-connector/spec.md),
  DONE): `top` / `error` / `cwv` reproduced natively (`connectors/helix-rum/`), **confined to `ot.aem.live`**,
  **not consent-gated** (`purposes.egress: []`), payload-hygienic, ephemeral per-page id (no cookie capability).
  CWV comes from a **main-thread** `web-vitals/attribution` capture (`cwv-capture.js`) — LCP/CLS/INP are
  document-scoped `PerformanceObserver` types a Worker can't see; the chamber isolates only mapping + egress.
  Proven at the **steady-state** seam against the real `createAirlock` (`test/helix-rum-seam.test.js`).
- **THE core gap the frame-critique caught (now IN scope, not assumed away): INP egress at page-hide.** INP —
  and often late CLS/LCP — **finalize only at `visibilitychange`→hidden** (`cwv-capture.js`: web-vitals's
  `whenIdleOrHidden` design). But `startCwvCapture` routes every metric through the **async `push()`** worker
  path, which cannot complete during teardown; airlock's only **synchronous** unload egress
  (`unloadFlush`→`criticalDispatchGated`→`critical.dispatch`, `airlock.js:335-364`) is **hardwired to GA4's
  `mapToMp`** (`egress.js:30,65`) — pixel is already *gated out* of the unload path (`connector !== "pixel"`,
  `airlock.js:429-436`) because its map lives in the worker, and its teardown events are **dropped**. RUM's
  `mapToRum` lives in the chamber too. So a faithful RUM authority needs **new core work**: a
  **connector-generic** main-thread unload dispatcher so `mapToRum` (and, freed, the pixel GET) can egress
  synchronously at page-hide. This is the RUM/POST analogue of the deferred pixel work the maintainers already
  named.
- **The rest of the subsume is page-side / adapter (patterned):** a `bootHelixRum` instance (`createAirlock`,
  `egressPurposes: []`) + a new emitted `helix-rum-chamber.worker.js` + a connector-selection branch + a
  `build.mjs` entry (the exact patterned addition 026 `pixel-chamber` / 025 `dom-chamber` made) + the main-thread
  capture wiring (import the **real** `web-vitals/attribution` runtime dependency — `web-vitals@^6.2.1`, already a
  runtime dep; `push({event:"top"})` on load; the error listeners). The **endpoint-ceiling coupling**:
  `bootHelixRum` must compute the `ot.aem.live/.rum/${weight}` ceiling on the main thread to match the
  worker-constructed connector's resolved `weight`, or every beacon is ceiling-held.
- **The double-count is a pure page-integration concern** — until the page's `sampleRUM` is removed, airlock's
  `top` is redundant with it; "replace" = don't call `sampleRUM`, do boot airlock's RUM.

**THE load-bearing honesty (frame-critique target): a SCOPED, opt-in replace — but now a COMPLETE-CWV one.** Two
honest bounds remain (the INP-at-unload gap is **built**, no longer a bound):

1. **Core checkpoints only.** Airlock covers `top`/`error`/`cwv` (all three CWV, incl. INP after 030-01); it does
   **NOT** reproduce the enhancer's **interaction/lifecycle** checkpoints
   (`click`/`viewblock`/`enter`/`navigate`/`formsubmit`/…) — deferred (2026-09-01 decision) to the worker-dom
   compat layer (now paused — spec 025) or a community connector. A deployment needing those keeps `sampleRUM`.
2. **A REAL production cutover is creds-gated.** Airlock's `cwv` body is a flat `{name,value,…attribution
   scalars}` **superset**, never verified against the live `ot.aem.live` collector. The mechanism is built +
   demonstrated **in-repo** (the testbed); a real cutover is gated on a **creds-gated live wire-shape check** —
   a named deferral.

## Assumptions

- **A core-checkpoint-only, opt-in "replace" is an honest, valuable subsume** — and, with the unload-window CWV
  built (030-01), a COMPLETE-CWV one. Load-bearing framing bet (frame-critique target). If a reviewer argues a
  partial replace is not a real "subsume", the answer is the honest scoping (core checkpoints) + the built INP
  egress, never a blanket claim.
- **The connector-generic unload dispatcher is REAL core work (030-01), not a patterned addition** — the
  frame-critique corrected the original "no new core capability" claim. It generalizes `createCriticalDispatcher`
  (`egress.js`) to take a connector's own main-thread mapper (DI), keeping GA4 byte-unchanged (regression-pinned),
  so a worker-mapped connector (RUM's `mapToRum`; the freed pixel GET) egresses unload-critical events correctly.
- **The chamber + adapter is a patterned addition** (026 `pixel-chamber` + 025 `dom-chamber`) — grounded, but a
  reviewer must verify the RUM chamber round-trip end-to-end (`push`→drain→chamber `routeBatch`→ready→ceiling→
  fetch) and the **endpoint-ceiling coupling** (main-thread ceiling matches the worker connector's resolved
  `weight`), since 022 never routed a RUM event through a chamber (it mapped on the main thread).
- **The live `ot.aem.live` wire-shape check stays deferred (creds-gated).** Built + demonstrated in-repo; not a
  live-collector verification. A named gate on real production cutover.

## Decomposition

SPIDR — the core enabler first (the load-bearing new capability, built before anything can ship complete), then
the full RUM authority, then the observable page replace, then the boundary + decision. Not a spike.

- **030-01 — the connector-generic unload dispatcher (Rules + Data; CORE).** Generalize
  `createCriticalDispatcher` (`core/egress.js`) to accept a connector-specific **main-thread mapper** (DI)
  instead of the hardcoded GA4 `mapToMp`; wire `core/airlock.js`'s unload path so a worker-mapped connector
  egresses its unload-critical events via its OWN mapper. Prove RUM's `mapToRum` egresses a page-hide `cwv`/`top`
  synchronously to `ot.aem.live` (never GA4-mis-mapped/ceiling-held), and un-defer the analogous pixel GET.
  **GA4 byte-unchanged** (regression-pinned). The core capability INP-at-unload needs.
- **030-02 — the production RUM authority (Interface + Data).** `bootHelixRum` (`createAirlock`,
  `egressPurposes: []`) + `helix-rum-chamber.worker.js` + a connector-selection branch + a `build.mjs` entry +
  `confine-helix-rum-chamber.js` + the main-thread capture (real `web-vitals`, `top` on load, error listeners),
  using 030-01's dispatcher for the unload CWV. Airlock is bootable as a **complete** governed RUM authority
  (top/error/cwv incl. INP), confined + not-consent-gated, with the endpoint-ceiling coupling correct.
- **030-03 — the page-side replace + no double-count (Path).** On `probes/eds-testbed`, neutralize inline
  `sampleRUM` and boot airlock's RUM as the single authority; a rig proves **exactly one** governed beacon per
  checkpoint (no double-count).
- **030-04 — the scoped-replace boundary + the decision landed (Rules + Interface).** Land the MVP4
  feed/replace/coexist decision as **replace (core checkpoints)**; document the integrator drop-in path + the
  honest boundary (interaction/lifecycle deferred; live wire-shape creds-gated). Closes the spec.

**Anti-horizontal-phasing check:** 030-01 makes a worker-mapped connector's unload-critical events egress (proven
with RUM's INP — the flagship CWV now leaves the page); 030-02 makes airlock bootable as the complete RUM
authority; 030-03 demonstrates the replace end-to-end; 030-04 lands the decision + boundary. Each is usable.

## Slices

- [030-01 — the connector-generic unload dispatcher](slice-01-unload-dispatcher.md)
- [030-02 — the production RUM authority](slice-02-rum-authority.md)
- [030-03 — the page-side replace + no double-count](slice-03-page-replace.md)
- [030-04 — the scoped-replace boundary + decision landed](slice-04-boundary-decision.md)
