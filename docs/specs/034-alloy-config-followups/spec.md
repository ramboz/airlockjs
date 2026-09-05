---
status: IN_PROGRESS
skill:
use_cases: [UC-1, UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 034: Alloy config-wiring follow-ons

> Close the three follow-ons [spec 033](../033-alloy-config-wiring/spec.md) documented when it landed
> config-booted alloy (analytics 033-02 + personalization 033-03). See
> [refinement-todo § alloy config-wiring](../../refinement-todo.md) (the "Still open / follow-ons" block) and the
> [MVP6 release plan](../../releases/mvp6.md). None is a broken-behavior fix — 033 works — these are a **coarse-consent
> refinement**, a **personalization-breadth extension**, and two **architecture cleanups** the 033 arch review flagged.

## Overview

033 shipped config-booted alloy with three deliberately-parked follow-ons (`docs/refinement-todo.md`):

1. **Coarse consent (analytics-yes / personalization-no).** alloy's decisions + analytics ride the **one shared
   interact**, gated by the strict `egressVerdict` over `["analytics_storage","personalization"]`
   (`core/wrapped-sdk-host.js`, 020-02) — which HOLDS the whole interact if *either* purpose is un-granted. So the
   common posture "analytics granted, personalization denied" gets **neither**. Real adopters need analytics to flow
   when only personalization is denied.
2. **Multi-scope personalization.** 033-03 shipped a **single `__view__` placement** — alloy's interact requests only
   `__view__` by default (`connectors/alloy/connector.js`; no `decisionScopes`), so a non-`__view__` placement scope
   is *rejected at validation*. Real personalization uses multiple scopes (named mboxes / view scopes).
3. **Two architecture cleanups (033-03 arch review).** (a) the `proposition_display` **exposure couples to the mutable
   `window.airlock` global** (late-bound in `deliver`) — a re-boot mid-session would route to a different composite;
   a wired composite-emit hook would decouple it. (b) `createComposite.push`/`pushCritical` were **overloaded to return
   the fan-out count** to let the exposure sink detect an alloy-only "nowhere to land" — but `count===0` conflates "no
   connector accepted" with "no analytics sink" (correct only while GA4 is the sole `["*"]` sink); a scoped
   `composite.accepts(name)` predicate is cleaner. (c) the related **alloy-only exposure telemetry** gap (the
   `proposition_display` DISPLAY works, but its EXPOSURE needs an analytics `["*"]` sink) is documented + guarded.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- The 033 surfaces are as landed (read this session): the shared strict `egressVerdict` gate over the two purposes
  (`core/wrapped-sdk-host.js`); `bootAlloy` + the composite (`adapters/eds/index.js`); `reservePersonalization` + the
  single-`__view__` placement (`adapters/eds/reserve-personalization.js`, `adapters/eds/placements.js`); the connector's
  `decisionScope`/`sendEvent` (`connectors/alloy/connector.js`); the exposure via `window.airlock.push`
  (`adapters/eds/decisions-exposure.js`). Each slice re-grounds its own load-bearing claims before asserting ACs.
- **The coarse-consent split (034-01) rests on whether alloy can be driven to emit an analytics-only interact** (no
  personalization query) when personalization is denied — a connector/chamber behavior the slice must ground (alloy's
  `sendEvent` shape + whether `renderDecisions:false` alone already omits the personalization *egress*, or a
  `decisionScopes:[]` / query-suppression is needed). NOT asserted here — 034-01 grounds it (may probe).

## Decomposition

**SPIDR — Rules / Data / Interface, no spike.** 033 already de-risked the alloy path end-to-end; these follow-ons are
bounded extensions of proven surfaces, so no S. Split by the axis each follow-on lives on:

- **034-01 (Rules) — coarse-consent split:** analytics flows when only personalization is denied (per-purpose, not
  all-or-nothing). Highest adopter value; touches the consent → interact gate.
- **034-02 (Data) — multi-scope personalization:** N placement scopes (wire `decisionScopes` into the interact + the
  host-side scope→placement map + the schema). Depends on 033-03's single-`__view__` foundation.
- **034-03 (Interface) — composite/exposure refinements:** a `composite.accepts(name)` predicate replacing the
  `push`-returns-count overload; a wired composite-emit hook decoupling exposure from `window.airlock`; + the
  alloy-only-exposure guard/doc. Cleanups of the 033-03 arch-review smells.

Each slice is independently landable + vertical (a real consent behavior / a real personalization capability / a real
contract cleanup). Order 01 → 02 → 03 (01 highest value; 03 the cleanup, informed by 01/02's use of the surfaces).

## Slices

- [034-01 — coarse-consent split: analytics flows when only personalization is denied](slice-01-coarse-consent-split.md)
- [034-02 — multi-scope personalization: `decisionScopes` + N placements](slice-02-multi-scope.md)
- [034-03 — composite/exposure refinements: `accepts(name)` + a wired emit hook (decouple from `window.airlock`)](slice-03-composite-exposure-refinements.md)
