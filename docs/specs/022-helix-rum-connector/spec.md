---
status: DRAFT
skill: jig:spec-workflow
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 022: Helix-rum connector

> MVP4's third core-AEM-stack piece (GA4 ✅ + governed alloy ✅ + **RUM**). Appetite: fits inside MVP4's
> 2-week box alongside the now-DONE 021 hardening. Release: [mvp4.md](../../releases/mvp4.md).

## Overview

Bring **RUM** (Real User Monitoring — Adobe/AEM's `sampleRUM` sampled-beacon telemetry) into airlock as a
**governed** connector, and make it the **sole** RUM source on the page. On EDS the boilerplate `aem.js`
ships an inline `sampleRUM` that already samples + beacons RUM on every page; the coexistence question
(feed / replace / coexist) is **DECIDED — replace** (maintainer, 2026-08-31): the page's inline `sampleRUM`
is **removed** (an `aem.js` cleanup, done page-side by the integrator) so airlock owns one governed RUM path —
no double-counting, and the RUM beacon now crosses **the seal** (endpoint ceiling + consent + payload
governance) like every other airlock egress.

**Why this is a natural airlock fit (grounded — see Current state):** the RUM egress is
`navigator.sendBeacon(...)`, which airlock's egress-confinement already intercepts (`denySendBeacon` is wired
in the alloy chamber); the destination is a single declarable endpoint (`ot.aem.live/.rum/`, ceiling-able);
and the identity/PII in the payload (`id`, `referer`) is exactly a payload-governance target. airlock is also
already **CWV-first** — it measures the same Core Web Vitals signals the RUM enhancer collects — so it can
*source* the RUM, not merely relay it.

## Current state (grounded — `probes/eds-testbed/scripts/aem.js:14-135`, read 2026-08-31)

`sampleRUM(checkpoint, data)` is a **sampled-beacon sender**, not a DOM-native SDK:
- **Sampling:** a `weight` (`on`=1 / `high`=10 / `medium`=100 / `low`=1000, default 100) + `isSelected =
  Math.random() * weight < 1`. Only selected page-loads emit.
- **Per-page state:** `window.hlx.rum = { weight, id, isSelected, firstReadTime, queue, collector }`;
  `id = crypto.randomUUID().slice(-9)`.
- **Checkpoints:** `top` (page load, `sendPing('top', …)`), `error` (3 window listeners — `error`,
  `unhandledrejection`, `securitypolicyviolation`), and the richer CWV/interaction checkpoints added by a
  **lazily-loaded `helix-rum-enhancer`** script (`sampleRUM.enhance()`, from a CDN — `rum-enhancer`).
- **Egress:** `sendPing(ck, time, pingData)` → `navigator.sendBeacon(url, body)` where
  `url = ".rum/${weight}"` resolved against `collectBaseURL` (default `https://ot.aem.live`), body =
  `{ weight, id, referer: origin+pathname, checkpoint, t, ...pingData }`.

So the **core** RUM contract is small and fully grounded; the **enhancer** (the CWV/interaction richness) is a
separate main-thread script — this is the load-bearing unknown below.

## Assumptions

- **[LOAD-BEARING — resolved by slice 022-01] Hosting mechanism (A vs B).** "Host `helix-rum-js` as a
  connector" admits two mechanisms, and which one fits is a grounding question, not a given:
  - **(A) Wrap the enhancer in a chamber** (wrapped-SDK style, exactly like the alloy chamber hosts stock
    `@adobe/alloy`). Risk: the enhancer is **main-thread-coupled** (`PerformanceObserver` for CWV, DOM event
    listeners) — a worker/chamber has no `document`/PerformanceObserver over the page, so a straight port may
    not observe LCP/CLS/INP at all. Feasibility **unverified** — probe it.
  - **(B) Reproduce the beacon contract natively**, fed by airlock's OWN main-thread capture. The core
    `sendPing` beacon is a tiny, grounded wire contract; airlock already measures CWV off-thread. The
    connector shapes `{weight,id,referer,checkpoint,t,…}` and governs the `sendBeacon`/fetch to
    `ot.aem.live`. Cleaner architectural fit (main-thread captures, chamber maps+egresses — airlock's whole
    model), but airlock must reproduce the enhancer's checkpoint set to avoid signal loss.
  - **Lean (to be confirmed by 022-01's probe):** the **core** path is (B) — small grounded contract, native
    fit; the **enhancer richness** is where (A)-vs-reproduce is genuinely open. 022-01 grounds the enhancer's
    runtime + picks the mechanism before 022-02 builds the full surface.
- **[to confirm] `helix-rum-enhancer` version + integrity.** `aem.js` loads it by CDN URL with an SRI hash
  (`enhancerHash`) — pin whatever airlock hosts (mirrors the esbuild/alloy version-pin discipline).
- **[decided, page-side] The `aem.js` cleanup is the integrator's** ("We'll remove the one on the page" —
  maintainer). airlock ships the connector + the integration guidance + a testbed demonstration; it does not
  edit customers' `aem.js`. The repo's `probes/eds-testbed` is the demonstration surface.

## Decomposition

SPIDR — **Path**-first (the RUM beacon is the vertical), then **Data** (the full checkpoint surface), then
**Interface** (the page-side cutover). No standalone spike: 022-01 folds the (A/B) grounding into the first
real governed-beacon slice (per SKILL.md — research goes *inside* the slice that ships).

- **022-01 (Path — happy path + grounding):** the minimal governed RUM path. Ground the enhancer runtime
  (A vs B) and wire ONE checkpoint (`top`/page-view) captured on the main thread → chamber/connector →
  **governed** beacon through the seal (endpoint ceiling on `ot.aem.live`, consent gate) → the AEM RUM
  collector. Delivers one real, governed RUM beacon end-to-end.
- **022-02 (Data — the full checkpoint surface):** the `error` checkpoints + the CWV/interaction (enhancer)
  checkpoints + sampling-rate fidelity (`weight`/`isSelected`), so airlock's RUM is a **complete** stand-in
  for `sampleRUM`+enhancer — removing the page copy loses no signal. Payload governance on `id`/`referer`.
- **022-03 (Interface — the page-side cutover):** the `sampleRUM` removal (an `aem.js` cleanup) + integration
  guidance, **demonstrated** in `probes/eds-testbed` (page RUM flows via airlock only; no double-count; the
  AEM RUM pipeline still receives its beacons, now governed).

## Slices

- [022-01 — governed page-view RUM beacon (+ A/B grounding)](slice-01-governed-rum-beacon.md)
- [022-02 — full checkpoint surface + sampling fidelity](slice-02-checkpoint-surface.md)
- [022-03 — page-side sampleRUM cutover + integration proof](slice-03-page-cutover.md)
