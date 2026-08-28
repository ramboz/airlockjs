# Release Plan: MVP1

## Status

`candidate`

Allowed statuses: `candidate`, `committed`, `shipping`, `shipped`, `dropped`.
Do not move a plan from `candidate` to `committed` without an explicit user
decision.

## Problem / Baseline

- Martech is the dominant source of CWV regression and a live supply-chain risk,
  and today's tools address neither structurally. GTM / Launch / Tealium optimize
  *when* code loads, not *where* it runs or *what* it may touch. EDS/Jamstack
  developers who must guarantee 100 Lighthouse watch their performance story
  collapse the moment martech is added.
- Baseline today: the airlock thesis (the main thread only captures and enqueues;
  all mapping and egress happen behind the airlock) is designed
  ([product-vision](../product-vision.md), [architecture](../architecture.md)),
  its MVP1 decisions are pinned ([ADR-0001](../decisions/adr-0001-chamber-isolation-strength.md),
  [ADR-0002](../decisions/adr-0002-event-descriptor-cycle-semantics.md),
  [ADR-0003](../decisions/adr-0003-projection-snapshot-privacy.md) accepted), and
  the five external contracts are pinned ([contracts/](../../contracts/README.md)).
  **No runtime exists yet, and the core performance bet is unproven.**
- Why now: retire the load-bearing uncertainty cheaply, before committing the
  full MVP1 build.

## Appetite

- **"A demo a skeptical EDS practitioner believes."** Fixed attention budget,
  variable scope: cut scope to protect the appetite, never the reverse.

## Solution Outline

- The smallest useful release is the three recurrent EDS customer requests, on a
  real EDS page, at ~zero CWV cost proven by a before/after scoreboard, with GA4
  as the only external contract and in-house decisioning. **Build the
  risk-retirement spike first** (see Risks); everything else is construction on
  top of a retired thesis. The spike is built on the existing
  [EDS testbed](../../probes/eds-testbed/) (aem-boilerplate + experimentation
  plugin; no-flicker eager swap already verified — [R-005](../research/R-005-eds-no-flicker-eager-swap.md)).

## Risks / Rabbit Holes

- **The named risk to retire FIRST (the bet):** can the event-log/projection +
  worker boundary **beat the main-thread version on INP while emitting an
  MP-conformant GA4 payload, on a real EDS page, at 100 Lighthouse?** Retire this
  before committing the rest. Retirement path: the spike, measured head-to-head
  against a `patchDatalayer`-style main-thread baseline on the EDS testbed.
  **RETIRED 2026-08-26 (reframed):** the honest claim is INP-safe-by-construction +
  ~19× over the common naive stack + wins-heavy-load + per-tracker isolation, **not**
  a blanket INP win over a competent (rIC-deferred) main thread, which ties it. See
  the reframed release-check bar below and [spec 003](../specs/003-risk-retirement-spike/spec.md).
- **INP measured wrong is a rabbit hole.** The worker's win is in the *tail*,
  under interaction-storm load — not a single click on a quiet page (review R1).
  The scoreboard must drive an interaction storm and capture INP the `web-vitals`
  way, or the delta will look small and the go/no-go will be made on the wrong
  number.
- **The egress dispatch/delivery model is unresolved (OQ10) and the spike must
  resolve it.** Idle-gated main-thread dispatch stalls delivery under load; the
  delivery-rate oracle must instrument the **drain stage**, not just egress. Keep
  it to "measure and pick," don't let it balloon the spike.
- **PZN above the fold has the widest proxy-gap** (a variant can flash-and-repaint
  within a frame without registering as CLS). Weakest oracle — keep it
  human-reviewed; do not over-automate it.
- **Oracle infrastructure is a precondition, not a nicety.** Lighthouse CI +
  Playwright + a CI pipeline must exist before any servo-unattended loop (review
  G4); CI is currently unconfigured. Under-estimating this is a rabbit hole.
- Do not wander into the No-Gos below (session replay, identity, SW chokepoint,
  edge drivers, non-EDS adapters, vendor experimentation APIs).

## No-Gos

- Session replay / full DOM-mutation streaming (antagonistic to "no DOM access").
- Identity resolution / a first-party cookie store (OQ5, deferred post-MVP2).
- The service-worker egress chokepoint — MVP uses direct `fetch` keepalive; SW is
  a later progressive enhancement.
- Edge decision/egress **drivers** — the two seams (decision-source, egress)
  exist from day one; only the local drivers ship in MVP1.
- Non-EDS framework adapters (Astro / Vercel / Jamstack come later).
- Vendor experimentation APIs (Optimizely / VWO) — MVP1 decisioning is in-house.
  A deliberate choice (the Google stack has no native experimentation tool since
  Optimize retired), not a gap.
- The Adobe stack (Analytics + Target via alloy) is **MVP2**, not MVP1 — it is the
  other connector archetype (wrapped-SDK) and is explicitly out of scope here.

## Cutline

| Item | Note | Disposition |
|---|---|---|
| Risk-retirement spike: GA4-only, capture → ring buffer → drain/cycle → chamber → MP-conformant payload → keepalive egress; INP + Lighthouse + delivery-rate scoreboard vs a `patchDatalayer` baseline | Retires the thesis; also resolves OQ10 | **Include — RISK-FIRST** (build before the rest) |
| UC-2: analytics with a custom GA4 event via the Measurement Protocol | Strong external oracle (`ga4_mp_conformance` pinned in contracts/) | **✅ DEMO LANDED** ([spec 004](../specs/004-uc2-ga4-eds/spec.md)): bundled + lazy runtime on the real EDS testbed under the boilerplate CSP, real `_ga`-sourced identity, end-to-end MP-conformant beacon (worker cycle) + ADR-0004 unload fast path, at **~zero CWV cost** (before/after Lighthouse TBT/CLS delta 0). Remaining for full servo-unattended: live `/debug/mp/collect` check + CI (drive-order step 9). |
| UC-3: automatic EDS block-decoration instrumentation (WeakMap, no `data-track-*`) | Pin the decoration→event-mapping contract first, or the oracle is self-referential | **✅ DEMO LANDED** ([spec 006](../specs/006-uc3-block-decoration/spec.md)): decorated blocks instrumented via a WeakMap (no markup), a `view_block` GA4 beacon on ≥50% view, `main`-scoped (chrome excluded), MP-conformant. Contract table pinned up front (non-self-referential oracle). **MVP1 demo trio (UC-1/2/3) complete.** |
| UC-1: A/B / PZN above the fold without flicker (in-house eager-window decisioning; exposure reported through the runtime) | Weakest oracle, widest proxy-gap; mechanism known (R-005) | **✅ DEMO LANDED** ([spec 005](../specs/005-uc1-pzn-exposure/spec.md)): exposure reported through the airlock as an MP-conformant `experiment_impression`; no-flicker structural invariant proven (exp-applied before body:appear, both arms) + clean-challenger screenshot (OQ6 human-reviewed). Decisioning stays aem-experimentation's (Clarification Q4). |
| Before/after CWV scoreboard (Lighthouse 100 + INP field metric) | The punchline; doubles as the servo oracle (OQ6) | Include — precondition: browser-automation infra |
| **Chamber throw-isolation (OQ14)** | ADR-0001 / architecture.md Q1 promise a throwing connector is *contained* (drop/restart just that chamber, page unaffected) — but the worker caller has no per-event try/catch or `worker.onerror`, so a throwing mapper silently drops the whole cycle's batch. Spec 008 (GA4 `purchase` validation) made a throw reachable and surfaced that the core guarantee is **stated but not implemented**. | **Include — pulled into MVP1 2026-08-27** (was a post-008 follow-up). A core-guarantee gap, not purchase-specific; must land before real purchase traffic. → spec 009. |
| **GA4 purchase MP conformance coverage (OQ15)** | The pinned `ga4-mp-request.schema.json` restricts `params` to `string\|number\|boolean`, so an ecommerce `items[]` array-of-objects is rejected by the contract, and there is no purchase golden — so `ga4_mp_conformance` never validated the key conversion event. | **Include — pulled into MVP1 2026-08-27** (was a post-008 follow-up). Extends the hermetic conformance oracle to cover purchase. → spec 010. |
| MVP2: Adobe stack (Analytics + Target via alloy, wrapped-SDK archetype) | Proves the connector abstraction generalizes | **Defer** — next release |
| Optimizely / VWO connector | Later slice once the connector format is proven | Defer |
| Edge decision/egress drivers | Seams only in MVP1 | Defer |
| Multi-chamber per-connector isolation (confidentiality) | OQ9; MVP1 is a single first-party connector | Defer |

## JIG Handoff

> Non-mutating pointers. JIG owns the spec lifecycle; nothing here transitions it.

- **Draft the first spec (drive-order step 7): SPIDR-split the risk-retirement
  spike.** Spike-first; the three demo items follow. Build on
  [probes/eds-testbed](../../probes/eds-testbed/).
- Consumes the pinned [contracts/](../../contracts/README.md): the GA4 MP schema +
  golden fixtures (the `ga4_mp_conformance` oracle), and the
  `push()`/connector/capability/seam interfaces.
- **Design the servo oracle components (step 8):** `ga4_mp_conformance` (contract
  basis ready), `cwv_budget` (Lighthouse LHS + INP threshold + the drain-stage
  delivery-rate oracle for OQ10), `isolation_invariant` (a connector touching
  `document` must throw).
- **Resolve OQ10 inside the spike** (egress dispatch/delivery). OQ6 (flicker
  oracle) is designed alongside the scoreboard.
- **Precondition task:** stand up CI + Lighthouse CI + Playwright before any
  servo-unattended loop.
- Deferred and untouched by MVP1: OQ9 (MVP2 sync-access), OQ11/OQ3 (payload
  governance / event schema), **OQ16** (unload/critical fast path maps on the main
  thread, not via the chamber's `mapBatch` — teardown-window isolation gap surfaced
  during spec 009-01 reconciliation; narrow post-MVP1 hardening).

## Release-Check Criteria

> Desired evidence before shipping. **No servo signals were found (servo is not
> yet emitting release signals for this repo); these criteria remain advisory**
> until the oracle infrastructure (Lighthouse CI + Playwright + CI) exists.

- **The bet is retired (reframed) — MET.** The retirement bar is *not* "beats a
  competent main-thread baseline on INP" — the spike measured that a competently
  `requestIdleCallback`-deferred `patchDatalayer` baseline is already INP-safe and
  the worker only *ties* it (both INP p75 ~8ms), so the original blanket bar was
  wrong. The bar that is actually met: the worker is **INP-safe by construction**
  and **~19× better than the common naive multi-tracker stack** (INP p75 152ms →
  8ms — the case that occurs in production), at Lighthouse-clean CWV (TBT 0, CLS 0),
  emitting MP-conformant GA4. A **stop-and-re-shape** is triggered only by a
  regression *below* that naive-case win or loss of INP-safety-by-construction —
  not by tying a hand-optimized main thread. See
  [spec 003 Outcome](../specs/003-risk-retirement-spike/spec.md).
- **GA4 conformance:** payloads pass `ga4_mp_conformance` — hermetic (schema +
  golden fixture) green AND the live `/debug/mp/collect` reports no validation
  errors (non-blocking check).
- **Delivery (OQ10) — MET.** With the Option-C egress backstop (worker maps,
  orchestrator dispatches on the main thread + `visibilitychange` flush) the worker
  path delivers 300/300 under normal settle, matching the baseline; the
  delivery-rate oracle instruments the drain stage, not just egress. **Closed
  2026-08-28:** the beacon-*generated-inside*-the-unload-window case is handled by a
  main-thread synchronous mapping fast path (`createCriticalDispatcher`, no worker
  round-trip at teardown), pinned by
  [ADR-0004](../decisions/adr-0004-egress-dispatch-delivery.md) (Accepted). The
  dedicated egress ADR the earlier draft awaited now exists — OQ10 is resolved.
  *Known narrow follow-up (OQ16, deferred):* that critical fast path maps on the
  main thread and does not route through the chamber's `mapBatch`, so a throwing
  descriptor in the teardown window has undefined isolation — post-MVP1 hardening,
  not a demo blocker.
- **Isolation:** `isolation_invariant` holds — a connector attempt to touch
  `document` throws.
- **Scoreboard:** the before/after CWV scoreboard shows ~zero cost (Lighthouse
  100 retained; INP within the pinned budget).
- **No flicker (UC-1):** human visual review confirms no flash; the structural
  check holds (variant content in the DOM at `body.appear`; `first-paint` never
  before `appear`).

_Last shaped: 2026-08-28 (OQ10 marked resolved via ADR-0004; OQ16 recorded as deferred follow-up; release-check advisory recommendation: ship)._
