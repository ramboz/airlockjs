---
status: IN_PROGRESS
skill:
use_cases: [UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 032: Instrumentation config

> The MVP6 adoption ergonomics: *"current marketing tags are instrumented with just a few lines — airlock must come
> close, keeping mostly a rich JSON config up to the project."* The **authoring surface**, distinct from spec 031
> (the distribution/consumption channel). See the [MVP6 release plan](../../releases/mvp6.md).

## Overview

Today a site instruments airlock through **per-connector boot functions** whose config is **baked in as imperative
`opts` + hardcoded literals in adapter code** ([`adapters/eds/index.js`](../../../adapters/eds/index.js)):
`bootEdsAnalytics` (GA4), `bootMetaPixel`, `bootLinkedInInsight`, `bootBingUet`, `bootHelixRum`. The three pixel
boots are **near-identical duplication** — `createXxxConfig({...ids, endpoint}) → createAirlock({connector:"pixel",
connectorConfig, endpoints, egressPurposes: consent ? XXX_EGRESS_PURPOSES : [], consent, consentStrict,
payloadDenylist})` — differing only by vendor id/endpoint/purposes.

To clear the marketing-tag adoption bar, the project-specific parts (which connectors, their ids/endpoints,
consent, payload governance) should be a **single project JSON config the site owns**, and boot should be **one
config-driven call** — *a few lines + a rich JSON config*. This spec builds that surface and collapses the
per-connector boot duplication into config dispatch.

**Explicitly pre-1.0 + iterable (MVP6 decision).** The config shape is **not frozen** here — the MVP6
real-production-site validation is meant to *exercise* it, and the later **1.0 API pin** freezes the settled shape
(as a fourth contract surface). Freezing an unproven schema now would trip the plan's own No-Go.

**Scope boundary.** (a) This is the **authoring/config surface**, NOT the distribution channel (spec 031, DONE) and
NOT the real-site validation (a separate MVP6 item). (b) The config **selects + parameterizes connectors + declares
governance**; **event *capture* stays as it is** — GA4's built-in EDS wiring (UC-2/UC-3: interactions, exposure,
blocks) and `push()` for custom events. **Declarative capture rules** (config-expressed selectors→events) are a
deliberate **out-of-scope follow-up**, not this spec. (c) Back-compat: the existing boot functions keep working
(the testbed + rigs are unaffected).

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- The 5 boot functions exist with config baked as `opts` + hardcoded literals, and each dispatches to
  `createAirlock({trackers, endpoints, ctx, connector, connectorConfig, consent, egressPurposes, consentStrict,
  payloadDenylist})` — **grounded** (read `adapters/eds/index.js` this session; lines 329/503/570/629/689).
- The three pixel boots are near-identical over a per-vendor config factory + per-vendor egress purposes —
  **grounded** (`createMetaPixelConfig`/`createLinkedInInsightConfig`/`createBingUetConfig` + `*_EGRESS_PURPOSES`,
  same `consent ? … : []` gate). This duplication is what config dispatch collapses.
- **The core, load-bearing bet (032-01 tests it):** a project JSON config can express the per-connector setup the
  imperative `opts` carry, and one `boot(config)` can dispatch it, **WITHOUT losing GA4's richer wiring**
  (host-side `_ga` cookie sourcing, the pre-`createAirlock` consent fold, and the UC-2/UC-3 capture listeners). The
  honest hypothesis is that the config **selects + parameterizes** connectors while GA4's built-in capture stays
  built-in — not that all capture becomes declarative. If GA4's wiring can't be cleanly reached from a config
  entry, the boundary is wrong.
- **The multi-connector lifecycle is a composition layer, not a reuse freebie (frame-critique correction):** the
  per-connector *boot* logic is reused, but `boot(config)` must **hoist** `window.airlock` ownership + a composite
  `dispose()`/`setConsent()` into a new layer over the per-connector boots — otherwise a reuse-only multi-connector
  boot leaves `window.airlock` GA4-only and **leaks the pixel/rum Worker on dispose/re-boot** (regressing the
  021-01 no-leak invariant) and misses non-GA4 connectors on `setConsent`. 032-01 AC4 owns this.
- **Governance is per governance class, not uniform:** consent/`consentStrict`/`payloadDenylist` apply to the
  **consent-governed** connectors (GA4, pixels); **helix-rum is exempt** (spec 022 — not consent-gated, no
  denylist, sync, no-op-when-unselected) and the config must not gate or strip it. 032-01 AC3 owns this.
- **alloy (the wrapped-SDK connector) has no `adapters/eds/` boot function** — it boots via a different core path
  (specs 012/014). Whether it is config-expressible in the same shape is an open question 032-02 resolves (it may
  be deferred). Marked, not assumed.

## Decomposition

**SPIDR — Interface split** (minimal config surface first, then the contract + breadth). The "user" is an **EDS
site developer** instrumenting airlock; end-to-end value = *"I write a JSON config + two boot lines and airlock
instruments my site with the declared connectors."*

- **I — Interface.** 032-01 is the **minimal config-driven boot**: a `boot(config)` that dispatches the
  currently-adapter-supported connectors (GA4 + the pixel vendors + helix-rum) from a project JSON config,
  collapsing the pixel-boot duplication, threading top-level consent/governance. 032-02 pins the **config
  contract** (a validated JSON Schema, pre-1.0), the breadth check (incl. the alloy question), and the documented
  few-lines-instrument story.
- **Not a Spike.** The config model is *buildable* against the known `createAirlock` shape — the proof is 032-01's
  behavioral tests (config in → the same connector wiring the per-function boots produce), not a timeboxed probe.
- **Deferred (out of scope):** declarative event-capture rules (config-expressed selectors→events); freezing the
  config schema as a 1.0-stable contract (the later 1.0 pin owns that).

## Slices

- [032-01 — the config-driven `boot(config)`: connector dispatch + collapse the pixel-boot duplication](slice-01-config-driven-boot.md)
- [032-02 — the config contract (validated JSON Schema, pre-1.0) + breadth + the few-lines-instrument story](slice-02-config-contract.md)
