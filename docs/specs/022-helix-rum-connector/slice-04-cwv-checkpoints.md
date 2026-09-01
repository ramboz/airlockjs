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

1. **Ground the `cwv` wire shape, the `web-vitals/attribution` API, AND the structured-cloneable scalar
   subset.** `web-vitals` is already installed (`^6.2.1`, a runtime dependency); read the
   **`web-vitals/attribution`** entry's API (`onLCP`/`onCLS`/`onINP` + the metric object incl. its
   `attribution` sub-object) from `node_modules`. **CRITICAL (frame-critique must-fix):** the raw
   `attribution` object carries **non-structured-cloneable** `PerformanceEntry` sub-objects
   (`processedEventEntries`, `longAnimationFrameEntries`, `longestScript.entry` —
   `web-vitals/dist/modules/attribution/onINP.js`); pushing them through airlock's `push()`→worker
   `postMessage` would throw **`DataCloneError`** and break the whole drain. So AC1 **enumerates the
   structured-cloneable SCALAR** attribution fields airlock projects (e.g. INP's `interactionTarget` selector
   + `interactionType` + the timing numbers; LCP's `target`/`element` selector + timing scalars; CLS's
   `largestShiftTarget` + value), **NOT** the raw entries. Ground the enhancer's exact `cwv` payload
   (checkpoint name + metric fields + which attribution scalars) from the enhancer source / a real payload,
   and record it. **Parity-superset + fallback:** airlock fully controls the payload (`map.js` whitelists), so
   the DEFAULT is **whitelist-to-enhancer-parity**; a superset (extra attribution scalars) ships only if a
   live collector probe confirms the AEM RUM pipeline accepts it — an AC1 rejection **narrows the whitelist**,
   it does not block the slice.
2. **`web-vitals/attribution` CWV capture → governed `cwv` checkpoint.** A **capture-layer** (main-thread)
   module subscribes to `onLCP`/`onCLS`/`onINP` from `web-vitals/attribution`; on each finalized metric it
   **projects the attribution to the grounded structured-cloneable SCALARS on the main thread** (per AC1 —
   never the raw non-cloneable entries) and `push`es a `cwv` checkpoint carrying `{ name, value,
   ...attributionScalars }` on the `event.params` bridge (022-02); the connector maps it to the grounded RUM
   `cwv` body and egresses it through the **022-01** confined, not-consent-gated path (same `id`/`weight` as
   `top`/`error`). **Emission model (design fork — resolve from AC1's grounding):** one `cwv` beacon per
   metric (the callbacks finalize at different times) vs one **combined** `cwv` — if the enhancer combines,
   this slice needs a buffering/combination step, not just per-callback push. Observable: a **stubbed**
   `web-vitals` callback → a `cwv` push carrying **only cloneable scalars** → the governed beacon (held if
   re-pointed; fired regardless of consent; sampling-gated). (Real end-to-end LCP/CLS/INP needs the production
   capture wiring — deferred, like 022-01's `push()` adapter.)
3. **CWV-safe (no new INTERACTION-PATH cost) + no regression.** The attribution build DOES add main-thread
   work — a second `PerformanceObserver` (`long-animation-frame`) + report-time attribution compute — but it
   is **off the interaction hot path**: `web-vitals` defers per-interaction bookkeeping via its own
   `whenIdleOrHidden` and computes attribution only at report-time (visibility-hidden), so INP is unaffected
   (verified against `node_modules/web-vitals` in the frame-critique). The mapping/egress stay behind the
   airlock. The `top`/`error` paths are byte-unchanged; the `cwv` checkpoint rides the identical governance.

**DoD:**
- [ ] AC1 grounding recorded (`web-vitals/attribution` API + the `cwv` wire shape + **the cloneable scalar
      subset**, with evidence). ACs 2–3 pass. Tests (targeted — suite hangs): stubbed `web-vitals` callbacks →
      a `cwv` push → the grounded beacon shape + governed path; **the pushed `params` survive a
      `structuredClone()` round-trip / contain only scalars** (guards the `DataCloneError` hazard the raw
      attribution object would cause — must NOT be masked by an over-simplified stub; feed the projection a
      realistic attribution-shaped input incl. mock entry objects and assert they're stripped to scalars);
      sampling gates it; `top`/`error` unchanged. Sweep: `helix-rum-*`, `endpoint-ceiling-seam`.
- [x] **Frame-critique** — PASS (verified the INP-safety premise directly against `node_modules/web-vitals`;
      surfaced the structured-clone must-fix now folded into AC1/AC2). Still needed: compliance + craft +
      reconciliation.
- [ ] Deviation log + reconciliation sweep. Log explicitly: (a) the **accepted grounded deviation** — CWV
      measurement lives in a **main-thread capture layer** outside the chamber (a Worker can't observe the
      LCP/CLS/INP entry types); the chamber isolates only mapping+egress, and INP-safety is inherited from
      `web-vitals`'s `whenIdleOrHidden`-deferred design, not airlock's off-thread architecture. (b) **022-05**
      (interaction/lifecycle checkpoints) is a new dependency of 022-03's cutover, post-dating 022-03's
      framing. (c) the production-wiring fork carried forward. `mvp4.md` row updated.
- [ ] **No live identifiers committed.**

**Anti-horizontal-phasing check:** real CWV telemetry (LCP/CLS/INP, via `web-vitals`) crosses the seal,
governed + confined — the observability payoff airlock's CWV-first thesis promises, sourced by airlock itself.
**Parity note:** with 022-02 (`top`+`error`) this covers the CWV metrics, but the enhancer's
**interaction/lifecycle** checkpoints (`click`/`viewblock`/`viewmedia`/`enter`/`navigate`/`reload`/
`formsubmit`/`pagesviewed`) remain — a follow-up **022-05** (DOM-event capture, mechanically like 022-02) is
needed before
022-03's cutover can remove the page's `sampleRUM` without losing those signals. 022-03's dependency set grows
to include 022-05 when it lands.
