---
status: IN_PROGRESS
skill:
use_cases: [UC-1, UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 033: Alloy config-wiring

> Close the **"GA4 + Adobe/alloy" supported-subset gap** that spec 032 deferred: make **Adobe/alloy** — the marquee
> connector for the AEM/EDS audience — instrumentable via `boot(config)`. See
> [refinement-todo § alloy config-wiring](../../refinement-todo.md) and the [MVP6 release plan](../../releases/mvp6.md).
> **Spike-first** (owner decision, 2026-09-04): the feasibility was genuinely uncertain, so 033-01 de-risked it first
> (→ **GO**; distribution decided by [ADR-0016](../decisions/adr-0016-alloy-stock-bundle-site-supplied.md)). The build
> is SPIDR-Path-split into **033-02** (the analytics vertical) + **033-03** (personalization).

## Overview

032 shipped `boot(config)` for the **`createAirlock`-shaped** connectors (GA4, pixel vendors, helix-rum) and
**deliberately deferred alloy**, because alloy is the **wrapped-SDK** path and differs on every axis that matters:

- **No adapter boot.** `createAlloyConnector` (`config → {manifest, init, handle}`) is hosted by
  `core/wrapped-sdk-host.js`'s `createWrappedSdkHost` — a *main-thread round-trip* host (intercept alloy's own
  worker-side `fetch` → `caps.egress.dispatch` → write the minted ECID back). It is wired **only in rigs**; there
  is no `adapters/eds/` `bootAlloy`.
- **A classic `importScripts` worker + a 766 KB stock bundle.** `connectors/alloy/alloy-chamber.worker.js` is a
  **classic** Worker (NOT `type:module`, built as an IIFE by `rig/alloy-chamber.mjs`) that
  `importScripts("…/@adobe/alloy/dist/alloy.js")` — the byte-pinned 766 KB stock SDK — then revokes importScripts.
  The four `dist` workers are esbuild **ESM** bundles; the alloy worker is **not a `build.mjs` entry**, so it isn't
  in `dist` and there is no served-same-origin story for it or the stock bundle.
- **A `driveEvent` (single-event, round-trip) host — not a `push` stream.** `createWrappedSdkHost` exposes
  `init`/`driveEvent`/`getState` ("one page event per host"), a fundamental mismatch with 032's composite handle
  (`push`/`pushCritical`/`setConsent`/`dispose`).
- Plus **decisions-as-data** (Target propositions → `caps.decisions.deliver` → host `reserveSpace`) and a
  **seam-side consent** gate (`egressVerdict(strict)`, spec 020) that need adapter/composite wiring.

So the load-bearing question is **not** "add a `bootConnector` case." It is: **can a classic-worker + a 766 KB
stock vendor bundle be distributed + served same-origin for a *buildless* EDS site, and the wrapped-SDK host be
adapter-booted into a composite-compatible handle** — a clean GO, a reshape, or a partial KILL (e.g. "the site must
supply alloy itself")? This spec **led with a spike (033-01 — DONE, GO)** to answer that with evidence; the build
follows, SPIDR-Path-split into **033-02** (the analytics vertical) + **033-03** (personalization).

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- alloy is a wrapped-SDK connector (`createAlloyConnector`, `connectors/alloy/connector.js`) hosted by
  `createWrappedSdkHost` (`core/wrapped-sdk-host.js`); **no `bootAlloy` in `adapters/`**, wired only in `rig/` +
  `test/` — **grounded** (read this session).
- `alloy-chamber.worker.js` is a **classic IIFE** worker that `importScripts` the 766 KB stock bundle
  (`node_modules/@adobe/alloy/dist/alloy.js`, byte-pinned per AD-7) then revokes importScripts; it is **not** a
  `build.mjs` dist entry — **grounded** (the worker header + `build.mjs` has no alloy entry + `rig/alloy-chamber.mjs`
  builds the IIFE).
- `createWrappedSdkHost` is `init`/`driveEvent` (single-slot)/`getState`, not the composite's
  `push`/`pushCritical`/`setConsent`/`dispose` — **grounded** (read this session).
- **The spike's whole job is to convert the following from unknowns to a GO/KILL + design** (they are NOT asserted
  here): (a) **CSP admission — the PRIMARY KILL risk (frame-critique):** whether a *classic* `importScripts` worker +
  a same-origin 766 KB bundle even **loads/executes under the enforced EDS boilerplate CSP** (`'strict-dynamic'` +
  Trusted Types, no `worker-src`) — 004-01 proved that CSP *only for a `{type:"module"}` worker*, and `importScripts`
  isn't covered by that trust chain; every alloy rig ran CSP-less; (b) the classic-worker + 766 KB-bundle
  **distribution** for a buildless EDS site (same-origin + the bundle's ship-vs-site-supplies + licensing; 031's
  dist story assumes ESM module workers); (c) the `driveEvent`→composite-handle **reconciliation** (the host has no
  `dispose` + doesn't spawn the Worker); (d) the **adapter-boot** wrapping (`createWrappedSdkHost` + the chamber +
  the stock-SDK load); (e) **decisions + seam-consent** wiring through the composite (the chamber's
  `{type:"decisions"}` message is un-consumed by the host today).

## Decomposition

**SPIDR — Spike first (the last-resort S, justified).** The team cannot pick the P/I/D/R design for alloy in
`boot(config)` without first de-risking whether a classic `importScripts` worker + a 766 KB bundle even **loads
under the real EDS CSP** (the primary KILL risk), whether that worker + bundle can be **distributed** for the
buildless EDS audience, and whether the `driveEvent`→composite reconciliation is feasible — the exact "don't yet
know enough to pick" case SPIDR reserves S for (and the 032 frame-critique + this framing both size it as
spike-work).
Resisting the eager-spike default is not the failure here; jumping to a build slice on an unproven wrapped-SDK
integration would be.

- **033-01 (spike, `kind: spike`) — DONE:** de-risked (a)–(e); concluded **GO** with a concrete design + probes
  under `probes/alloy-csp-spike/`. The stock-bundle distribution call is **[ADR-0016](../decisions/adr-0016-alloy-stock-bundle-site-supplied.md)**.
- **The build, SPIDR-Path-split into two verticals** (the spike's GO design is large — ~7 areas across two
  independent user outcomes):
  - **033-02 (build) — the analytics vertical:** `bootAlloy` + `{type:"alloy"}` in `boot(config)` + the classic-worker
    CSP fix + the 5th classic-IIFE `dist` entry + the adopter-supplied `bundleUrl` (ADR-0016) + the schema branch +
    the strict consent gate + a boot→`sendEvent`→intercepted-interact proof. **Closes MVP6's config-surface gap for
    the analytics adopter.**
  - **033-03 (build) — the personalization vertical:** decisions-as-data (`{type:"decisions"}` → `caps.decisions.deliver`
    → `reserveSpace`), the un-built path. **Gated on 033-02 DONE.**

## Slices

- [033-01 — spike: de-risk alloy adapter-boot + distribution + the composite-handle reconciliation (GO/KILL)](slice-01-alloy-feasibility-spike.md) — **DONE (GO)**
- [033-02 — build: config-boot alloy (the analytics vertical) — `{type:"alloy"}` in `boot(config)`](slice-02-alloy-config-build.md)
- [033-03 — build: config-boot alloy (the personalization vertical) — decisions-as-data → `reserveSpace`](slice-03-alloy-decisions.md) — gated on 033-02
