---
status: DONE
skill: jig:spec-workflow
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 022: Helix-rum connector

> MVP4's third core-AEM-stack piece (GA4 ✅ + governed alloy ✅ + **RUM**). Appetite: fits inside MVP4's
> 2-week box alongside the now-DONE 021 hardening. Release: [mvp4.md](../../releases/mvp4.md).

## Status (2026-09-01) — governance exemplar; full parity + cutover DEFERRED

**Delivered as an egress-governance exemplar:** 022-01 (`top`) ✅ · 022-02 (`error` + sampling) ✅ ·
022-04 (`cwv` via `web-vitals/attribution`) ✅ — the core RUM checkpoints reproduced natively and governed
(confined to `ot.aem.live`, **not consent-gated**, no-exfil). This proves airlock's **governance** half of
the thesis on a real Adobe connector.

**Full parity + the page-side cutover are DEFERRED** (maintainer, 2026-09-01 — see
[lightweight-decisions](../../decisions/lightweight-decisions.md) + [R-008](../../research/R-008-costly-dom-martech-containment.md)):
reproducing the enhancer's *entire* evolving, plugin-extended checkpoint set **natively** is the wrong bet for
a governance runtime. The interaction/lifecycle checkpoints (022-05) and the `sampleRUM` cutover (022-03) wait
on the **worker-dom compatibility layer** (host the real enhancer off-thread, govern its egress) or a
community connector, plus the creds-gated live-collector wire-shape check. RUM proved the governance story;
the **performance** story (containing costly-DOM martech) is taken up separately (R-008 + the nasty-tag POC).

## Overview

Bring **RUM** (Real User Monitoring — Adobe/AEM's `sampleRUM` sampled-beacon telemetry) into airlock as a
**governed** connector, and make it the **sole** RUM source on the page. On EDS the boilerplate `aem.js`
ships an inline `sampleRUM` that already samples + beacons RUM on every page; the coexistence question
(feed / replace / coexist) is **DECIDED — replace** (maintainer, 2026-08-31): the page's inline `sampleRUM`
is **removed** (an `aem.js` cleanup, done page-side by the integrator) so airlock owns one governed RUM path —
no double-counting, and the RUM beacon is confined by airlock's egress controls.

**Governance class — RUM is NOT consent-gated (maintainer, 2026-08-31).** Unlike GA4/alloy marketing egress,
AEM RUM is **PII-compliant performance telemetry not subject to consent** — sampled, an **ephemeral per-page**
`id` (`crypto.randomUUID().slice(-9)`, not a cross-site/persistent identifier), no PII — and `sampleRUM` fires
regardless of consent today. So airlock's seal for RUM is **purpose-appropriate**: the **endpoint ceiling**
(pin egress to `ot.aem.live` — a compromised RUM connector can't exfiltrate elsewhere) + a **payload-hygiene
guard** (assert the beacon stays PII-clean), and **NOT** the marketing-consent gate. Gating RUM on consent
would collect *less* than the page does today; the point of hosting it is parity + confinement, not
suppression. This shows airlock's governance is class-appropriate, not one-size-fits-all.

**Why this is a natural airlock fit (grounded — see Current state + Assumptions):** the destination is a
single declarable endpoint (`ot.aem.live/.rum/`, ceiling-able); the RUM payload's identity surface is an
**ephemeral per-page** `id` (no persistent PII); and airlock's diagnostics **already measure CWV**
(`PerformanceObserver`-based, for the inspector + the `cwv_budget` oracle — vision §Tech, `rig/cwv-budget.mjs`),
so its capture-and-enqueue model is the natural home for the RUM signals. **Two grounded caveats (scope-shaping,
not blockers):** (1) `sampleRUM` egresses via `navigator.sendBeacon`, but airlock's egress model is
`fetch(url,{keepalive:true})` (works from workers, unlike `sendBeacon` — vision §Tech), so the RUM connector
reproduces the beacon over **fetch-keepalive**; `egress-confinement`'s `denySendBeacon` is what stops a
*hosted* enhancer from bypassing the seal via `sendBeacon`, not the egress path itself. (2) airlock's CWV
measurement today is **diagnostic/oracle-time**, NOT a runtime per-page LCP/CLS/INP capture feeding a
connector — so the enhancer's CWV checkpoints (022-02) need either the hosted enhancer (mechanism A) or a
**new** runtime capture (an extension of mechanism B); the **core** beacon (022-01: just the `top`/page-view
checkpoint) needs neither, which is why it leads.

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
    not observe LCP/CLS/INP at all. And the enhancer egresses via `navigator.sendBeacon`, which
    `egress-confinement`'s `denySendBeacon` **throws** on (`core/egress-confinement.js`) — so (A) must
    additionally re-plumb the enhancer's beacon onto the mediated fetch. Feasibility **unverified** — probe it
    (isolated to 022-02).
  - **(B) Reproduce the beacon contract natively**, fed by airlock's OWN main-thread capture. The core
    `sendPing` beacon is a tiny, grounded wire contract; airlock already measures CWV off-thread. The
    connector shapes `{weight,id,referer,checkpoint,t,…}` and governs the `sendBeacon`/fetch to
    `ot.aem.live`. Cleaner architectural fit (main-thread captures, chamber maps+egresses — airlock's whole
    model), but airlock must reproduce the enhancer's checkpoint set to avoid signal loss.
  - **(B′) Govern the page's `sampleRUM` in place** (intercept its egress; host/reproduce nothing) does
    **NOT** survive: coexistence=replace **removes** the page beacon (nothing left to intercept after
    cutover), and main-thread egress interception is off-model — airlock's seal/ceiling/confinement live
    *behind* the airlock, not on main. Recorded so the fork is demonstrably complete.
  - **Lean (to be confirmed by 022-01's probe):** the **core** path is (B) — small grounded contract, native
    fit; the **enhancer richness** is where (A)-vs-reproduce is genuinely open. 022-01 grounds the enhancer's
    runtime + picks the mechanism before 022-02 builds the full surface. Grounding note (frame-critique,
    2026-08-31): the not-consent-gated class is **free** on the existing seam — `core/airlock.js` applies the
    endpoint ceiling when `ceiling.length` and skips consent when `egressPurposes` is empty, so the RUM
    manifest declares `endpoints:[ot.aem.live]` + **no** egress purposes.
- **[grounded, scope-shaping] airlock has no *runtime* per-page CWV capture yet.** Its CWV measurement is
  **diagnostic/oracle-time** (the inspector + `cwv_budget`, `rig/cwv-budget.mjs`). So mechanism B for the
  *enhancer's* CWV checkpoints (LCP/CLS/INP) implies **building** a runtime capture — real work, isolated to
  022-02. The 022-01 core (the `top`/page-view checkpoint alone) is main-thread-trivial and needs no CWV
  capture, which is why it leads; the `error` checkpoints (also main-thread-trivial — 3 window listeners)
  join the full surface in 022-02, not 022-01.
- **[grounded] Egress is `fetch(url,{keepalive:true})`, not `sendBeacon`.** airlock's egress model (vision
  §Tech) — the RUM connector POSTs the beacon body to `ot.aem.live/.rum/${weight}` via fetch-keepalive.
- **[to confirm] `helix-rum-enhancer` version + integrity.** `aem.js` loads it by CDN URL with an SRI hash
  (`enhancerHash`) — pin whatever airlock hosts (mirrors the esbuild/alloy version-pin discipline).
- **[decided, page-side] The `aem.js` cleanup is the integrator's** ("We'll remove the one on the page" —
  maintainer). airlock ships the connector + the integration guidance + a testbed demonstration; it does not
  edit customers' `aem.js`. The repo's `probes/eds-testbed` is the demonstration surface.

## Decomposition

SPIDR — **Path**-first (the RUM beacon is the vertical), then **Data** (the checkpoint surface, **split by
capture cost**), then **Interface** (the page-side cutover). No standalone spike: 022-01 folded the (A/B)
grounding into the first real governed-beacon slice. **Data split (maintainer, 2026-09-01):** the CWV
checkpoints need a *new* runtime capture (022-01's grounding showed the enhancer can't host in a chamber), so
they get their own slice rather than bloating 022-02.

- **022-01 (Path — happy path + grounding) — ✅ DONE:** the minimal confined RUM path — one `top`/page-view
  checkpoint captured on the main thread → connector → **confined** beacon (endpoint ceiling on `ot.aem.live`
  + payload-hygiene, **NOT** consent-gated) → the AEM RUM collector. Grounded: core = mechanism B (native);
  the enhancer is **not** cleanly chamber-hostable (A), so CWV needs a native capture → 022-04.
- **022-02 (Data — the no-new-capture checkpoints):** the `error` checkpoints (3 window listeners —
  `error`/`unhandledrejection`/`securitypolicyviolation`) + **sampling-rate fidelity** (the `on/high/medium/
  low` rate table + `SAMPLE_PAGEVIEWS_AT_RATE`/URL-param resolution — 022-01 fixed `weight`/`isSelected` once
  but hardcoded the default rate). These ride the 022-01 connector path directly — **no CWV capture needed**.
- **022-04 (Data — the `cwv` checkpoint via `web-vitals`, NEW):** build airlock's own **runtime CWV capture**
  using Google's **`web-vitals/attribution`** build (LCP/CLS/INP + attribution — the reliable source Adobe RUM
  uses behind the scenes; maintainer 2026-09-01) in the **main-thread capture layer** (a Worker can't observe
  those PerformanceObserver entry types), and emit the `cwv` checkpoint through the 022-01 governed path
  (mapping + egress behind the airlock). Mechanism **B-extended**. The meaty slice. **The enhancer's
  interaction/lifecycle checkpoints** (`click`/`viewblock`/`viewmedia`/`enter`/`navigate`/`formsubmit`/
  `pagesviewed`) are DOM-event-driven (like 022-02's `error`) — a follow-up **022-05** before the cutover.
- **022-03 (Interface — the page-side cutover):** the `sampleRUM` removal (an `aem.js` cleanup) + integration
  guidance, **demonstrated** in `probes/eds-testbed`. **Gated on FULL parity — depends on 022-02 AND 022-04:**
  `sampleRUM` is a single function, so removing it drops `top`+`error`+CWV **at once**; airlock must cover all
  of them first, or the cutover loses CWV signal. (Corrects an earlier "cutover can proceed partially" framing
  — it cannot; the cutover is all-or-nothing and lands **last**.)

## Slices

_Execution order 01 → 02 → 04 → 03 (numbers = reservation order; dependencies define execution)._

- [022-01 — governed page-view RUM beacon (+ A/B grounding)](slice-01-governed-rum-beacon.md) — **DONE**
- [022-02 — error checkpoints + sampling-rate fidelity](slice-02-checkpoint-surface.md) — **DONE**
- [022-04 — `cwv` checkpoint via `web-vitals/attribution` (native runtime capture)](slice-04-cwv-checkpoints.md) — **DONE**
- _022-05 — the enhancer's interaction/lifecycle checkpoints — **DEFERRED / not pursued natively**
  (2026-09-01). Native reimplementation of Adobe's evolving, plugin-extended checkpoint set is the wrong bet;
  full parity comes via the worker-dom compat layer or a community connector ([R-008](../../research/R-008-costly-dom-martech-containment.md)), not a native 022-05._
- [022-03 — page-side sampleRUM cutover](slice-03-page-cutover.md) — **DEFERRED** (trigger: full parity via
  worker-dom/community + the creds-gated live-collector check; see the slice).
