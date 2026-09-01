---
status: DRAFT
dependencies: [022-01]
last_verified: 2026-09-01
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 022-04 — CWV checkpoint via `web-vitals` (native runtime capture)

> Split out of 022-02 (maintainer "do the split", 2026-09-01). This is the CWV surface — the part that needs
> a **new** runtime capture, because 022-01's grounding showed `helix-rum-enhancer` can't host in a chamber
> (`document`-requiring loader + `sendBeacon`-blocked egress). airlock **reproduces** the enhancer's `cwv`
> checkpoint natively.

**Goal:** Give airlock its own **runtime CWV capture** and emit the `cwv` checkpoint (LCP / CLS / INP) through
the DONE 022-01 governed path — using **Google's `web-vitals/attribution` build** as the metric source
(maintainer, 2026-09-01: the reliable source Adobe RUM uses behind the scenes; the **attribution** build for
richer data — LCP element + sub-part timings, CLS shift sources, INP interaction target + timings), not a
hand-rolled `PerformanceObserver`. **Capture-layer, not chamber (grounded nuance):** `web-vitals` runs in the
**main-thread capture layer** — LCP/CLS/INP come from `PerformanceObserver` entry types scoped to the page's
document, which a Worker cannot observe — so the chamber isolates the metric's **mapping + egress**, not the
measurement. The attribution build's extra cost lands at **metric finalization** (visibility-change /
page-hide), **off** the interaction hot path, so INP is unaffected (airlock's INP-safe-by-construction thesis)
— consistent with the maintainer's "isolated … should not impact perf too much." This is the observability
payoff of airlock's CWV-first thesis, sourced by airlock itself.

**Grounded — the enhancer's checkpoint set (AC1 probe, `helix-rum-enhancer` README, fetched 2026-09-01):**
`cwv` (Core Web Vitals — LCP/CLS/INP), plus interaction/lifecycle checkpoints `click`, `viewblock`,
`viewmedia`, `enter`/`navigate`/`reload`, `formsubmit`, `pagesviewed`. **This slice covers `cwv`** — the
meaty new-capture piece; the interaction/lifecycle checkpoints are DOM-event-driven (like 022-02's `error`
listeners) and are the **remaining parity surface** (a follow-up slice, 022-05, before 022-03's cutover — see
the note in the Anti-horizontal-phasing check).

**DoR:**
- ✅ 022-01 DONE: the governed path + the connector shape each checkpoint rides; 022-02 added the descriptor
  bridge (`event.params`) checkpoints use to carry per-event data — the `cwv` payload rides the same channel.
- ✅ 022-01 grounding: the enhancer is **not** chamber-hostable, so this is native reproduction.
- ✅ The `cwv` checkpoint contract is grounded (enhancer README + `sampleRUM.sendPing`): a `cwv` beacon
  carries the CWV metric(s) alongside the base `{ weight, id, referer, checkpoint:"cwv", t }`.
- ⚠️ **To confirm at implementation:** `web-vitals`'s exact API surface (`onLCP`/`onCLS`/`onINP` +
  `onTTFB`/`onFCP`; the metric object shape `{ name, value, delta, id, rating, … }`) — read it from
  `node_modules/web-vitals` once added, and the enhancer's exact `cwv` payload field names (does it send one
  `cwv` beacon per metric, or a combined one — reconcile against the enhancer source / a real RUM payload).

**Acceptance Criteria:**

1. **Ground the `cwv` wire shape + the `web-vitals/attribution` API.** Add `web-vitals` as a dependency (pin
   the major); read the **`web-vitals/attribution`** entry's API (`onLCP`/`onCLS`/`onINP` + the metric object
   incl. its `attribution` sub-object) from `node_modules`. Ground the enhancer's exact `cwv` payload (metric
   name + value + which attribution fields; one-beacon-per-metric vs combined) from the enhancer source / a
   real payload, and record it. **Parity-superset check:** if the stock enhancer's `cwv` is lighter than the
   attribution build, airlock's `cwv` is a deliberate superset — confirm the AEM RUM collector accepts the
   extra attribution fields. Build against the grounded shape, not a guess.
2. **`web-vitals/attribution` CWV capture → governed `cwv` checkpoint.** A **capture-layer** (main-thread)
   module subscribes to `onLCP`/`onCLS`/`onINP` from `web-vitals/attribution`; each finalized metric is
   `push`ed as a `cwv` checkpoint carrying the metric name + value + the grounded attribution fields (on the
   `event.params` bridge 022-02 established), and the connector maps it to the grounded RUM `cwv` body and
   egresses it through the **022-01** confined, not-consent-gated path (same `id`/`weight` as the page's
   `top`/`error`). Observable: a real LCP/CLS/INP → the grounded `cwv` beacon (with attribution); held if the
   endpoint is re-pointed; fired regardless of consent; sampling-gated (unselected → silent).
3. **CWV-safe by construction + no regression.** The capture must not itself regress CWV — `web-vitals` is
   `PerformanceObserver`-based (passive, off the interaction path), and the mapping/egress stay behind the
   airlock (INP-safe-by-construction, airlock's core thesis). The `top`/`error` paths are byte-unchanged; the
   `cwv` checkpoint rides the identical governance.

**DoD:**
- [ ] AC1 grounding recorded (`web-vitals` API + the `cwv` wire shape, with evidence). ACs 2–3 pass. Tests
      (targeted — suite hangs): `web-vitals` callbacks (stubbed) → a `cwv` push → the grounded beacon shape +
      governed path; CWV-safe (capture is passive); sampling gates it; `top`/`error` unchanged. Sweep:
      `helix-rum-*`, `endpoint-ceiling-seam`.
- [ ] **Frame-critique** (the load-bearing premise: `web-vitals` is the right, CWV-safe capture source and the
      capture→chamber split holds for CWV — the metric callbacks fire on the main thread and only the mapped
      beacon crosses; confirm no new main-thread cost + the `cwv` wire shape is grounded, not guessed) +
      compliance + craft + reconciliation.
- [ ] Deviation log + reconciliation sweep; `web-vitals` dependency recorded (a lightweight decision already
      captures the *why*); the interaction-checkpoint remainder (022-05) + the production-wiring fork are
      explicitly carried forward; `mvp4.md` row updated.
- [ ] **No live identifiers committed.**

**Anti-horizontal-phasing check:** real CWV telemetry (LCP/CLS/INP, via `web-vitals`) crosses the seal,
governed + confined — the observability payoff airlock's CWV-first thesis promises, sourced by airlock itself.
**Parity note:** with 022-02 (`top`+`error`) this covers the CWV metrics, but the enhancer's
**interaction/lifecycle** checkpoints (`click`/`viewblock`/`viewmedia`/`enter`/`navigate`/`formsubmit`/
`pagesviewed`) remain — a follow-up **022-05** (DOM-event capture, mechanically like 022-02) is needed before
022-03's cutover can remove the page's `sampleRUM` without losing those signals. 022-03's dependency set grows
to include 022-05 when it lands.
