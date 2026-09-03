---
status: DONE
skill: jig:spec-workflow
use_cases: [UC-2]
---

# Spec 025: worker-dom minimal mirror (Lever-2 compat layer, Tier 0)

> Builds the decision in **[ADR-0014](../../decisions/adr-0014-worker-dom-compat-minimal-mirror.md)** — a
> minimal airlock-owned worker-dom mirror (async mutation-flush, no SAB, AD-4-preserving) as the Lever-2 compat
> layer for **unmodified** costly-DOM tags. **De-risk-first** (ADR-0014 §Coverage + the frame-critique): the
> mirror build must not run ahead of the two bets it rests on.

## Overview

Build airlock's **minimal, own** worker-dom mirror so an *unmodified* write/compute-heavy tag runs off-thread
(computation in a chamber; mutations serialized async + frame-budgeted onto the main thread), containing its
INP. **But gate the build on a cheap de-risk first** — ADR-0014 flagged two unproven bets, and the maintainer
set an adoption criterion (**a common tag that won't run is a concern**) — but see **Two orthogonal verdicts**
below: that is an *adoption* signal (GA4 is already supported via the connector), **decoupled** from the
mechanism build decision, not a blunt build kill switch.

## The two bets to validate BEFORE building (ADR-0014, honest)

1. **The main-thread mutation-apply is INP-safe** under a heavy mutation burst (off-thread computation isn't
   just the long task *moved* to the apply) — **unmeasured** (024-01 AC3 deferred).
2. **A useful population of unmodified write/compute-heavy-*without*-sync-read tags exists** — **unvalidated**,
   and R-007 is the wrong yardstick (connector-fit, not DOM-cost shape). Tier 0 may cover a *minority* of
   costly tags (the worst/most-common are sync-read = the Tier-0 gap).

## Two orthogonal verdicts (frame-critique, 2026-09-02) — the gate must NOT conflate them

The maintainer set "unmodified GA4 = kill switch." The frame-critique showed GA4 tests **adoption**, not the
Tier-0 **mechanism** — they are orthogonal, and wiring GA4 to the build decision would kill it for the wrong
reason:

- **Mechanism verdict (decides the build).** ADR-0014's two bets: is the mutation-apply INP-safe under a
  *DOM-mutation-heavy* load, and does a useful population of unmodified write/compute-heavy-*without*-sync-read
  tags exist? GA4 answers **neither** — gtag.js is network/data-shaped, not DOM-heavy. So the mechanism verdict
  is measured on a **DOM-heavy synthetic load** (bet #1) + a **real target-shape tag** (bet #2), NOT GA4.
- **Adoption verdict (GA4 — separate).** Does the *drop-in* path handle GA4? GA4's most-likely failure is
  loading its own `googletagmanager.com` sub-resource — a 024-documented won't-work case **orthogonal** to
  both bets and **plausibly fixable** in airlock's own mirror (a mediated sub-resource proxy the library
  lacks). And **GA4 is already supported** via the wire-protocol connector (spec 004/008) + the pixel connector
  (026). So a GA4 drop-in failure is an *adoption/feature* signal (does 025-02 need a sub-resource proxy? does
  GA4 stay on the connector path?), **not** a mechanism KILL. The maintainer's intent — GA4 must be supported —
  is honored: it is, via the connector; the drop-in is the bonus "easy migration" option.

## Current state (grounded)

- ADR-0014 Accepted (2026-09-02): minimal mirror, Tier 0 (async, no SAB); Tier 1 (SAB) deferred.
- Spike [024](../024-worker-dom-compat-spike/spec.md): worker-dom's async model is AD-4-compatible; the
  sync-read boundary; `@ampproject/worker-dom@0.36` is installable — usable to **probe cheaply** before
  building airlock's own mirror.
- [023](../023-dom-cost-containment-poc/spec.md): the Event-Timing within-storm-p75 INP measurement method
  (the same instrument the de-risk gate uses) + Lever 1 (the main-thread path for adapted/sync-read tags).

## Assumptions

- Carried from ADR-0014: the apply-INP-safety (central unproven bet) + the useful-population assumption are
  what 025-01 **validates or kills** — they are not assumed true here, they are the gate's job.
- A `@ampproject/worker-dom@0.36` result **transfers to airlock's own mirror only when the failure is inherent
  to the async mutation-flush MODEL** (sync-read; needs a real `window` even a proxy can't fake). A failure
  that is **lib-completeness or a sub-resource-proxy gap** (the `googletagmanager.com` config fetch) is a 0.36
  limitation airlock's own mirror could fix (024: "0.36 staleness is immaterial... the *model* is what the
  spike validated") — so 025-01 must **classify each failure by axis** before letting it inform the build, and
  never treat a lib-completeness gap as a model verdict.

## Decomposition

SPIDR — **S then P**: a de-risk **spike** gates a **path** build. 025-01 is genuinely a learning/validation
activity (the two bets are unknown) whose Outcome decides whether 025-02+ happens at all — the honest shape
for a bet ADR-0014 itself flagged as unproven.

- **025-01 (Spike — the de-risk gate):** two orthogonal verdicts (probe `@ampproject/worker-dom`, not airlock's
  mirror yet). **MECHANISM (decides the build):** measure the mutation-apply INP under a **DOM-mutation-heavy
  synthetic** load (bet #1, 023 instrument) + run at least one **real write/compute-heavy-*without*-sync-read**
  tag (bet #2, the target shape). **GO** (apply INP-safe AND a useful population → build the minimal mirror,
  025-02) **or KILL** (apply re-tanks OR population-mirage → don't build Tier 0 standalone; re-route to Lever-1
  / the pixel connector / Tier 1) — keyed on ADR-0014's kill criteria. **ADOPTION (GA4, separate):** does
  unmodified `gtag.js` drop in, and if not, on which axis (model-inherent vs a fixable sub-resource-proxy
  gap)? Feeds 025-02's feature set + the adoption story, **not** the build's existence (GA4 is already
  supported via the connector).
- **025-02 (Path — the mirror CORE, GATED on 025-01 = GO ✅):** airlock's own worker-side DOM mirror (the
  minimal subset the synthetic DOM-mutation-heavy tag needs) + the worker→main mutation-serialize channel + a
  frame-budgeted main-thread apply coordinator (**reusing `core/scheduler.js`**, 023) + a mutation-apply safety
  policy — replacing the probe's `@ampproject/worker-dom`. Proven by the **deferred INP integration probe**
  (ADR-0014's named first AC): the synthetic write-heavy tag runs off-thread through airlock's OWN mirror,
  INP-safe (reproducing 025-01's ~8ms on airlock's own code). `innerHTML` + sanitizer, ambient globals, and the
  Lever-3 budget are OUT (→ 025-03+).
- **025-03+ (Data/Rules — broaden, gated on 025-02):** a REAL tag through the mirror (Prism → `innerHTML` + a
  Trusted-Types / sanitizer write path); ambient-global proxies (`screen` / `sendBeacon` / `cookie`, 025-01 AC3's
  scope input) for broader tags; the Lever-3 budget / circuit-breaker. Each its own slice, framed when picked up.

## Slices

- [025-01 — Tier-0 mechanism de-risk gate (GO/KILL) + GA4 adoption litmus](slice-01-ga4-drop-in-gate.md)
- [025-02 — the mirror core: synthetic tag off-thread through airlock's own mirror, INP-safe](slice-02-mirror-core.md)
- _025-03+ (not yet reserved) — a real tag (Prism / `innerHTML` + sanitizer), ambient globals, Lever-3 budget._
