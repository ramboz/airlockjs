---
status: DRAFT
skill:
use_cases: [UC-1, UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md. -->

# Spec 014: wrapped-SDK core integration — one egress model, one hosting path

## Overview

MVP2 demonstrated the wrapped-SDK generalization (alloy in a chamber: fetch-interception →
main-thread dispatch, concurrent-chamber mint coalescing, `reserveSpace`) — but **parallel to
`core/`, in rig harnesses**, a deliberate proof shortcut. Today the runtime carries **two egress
models** and **two connector-hosting paths** that must converge before MVP3's seam-enforcement
(endpoint-ceiling, config-integrity, purpose-vector consent) has a single seam to bind to. This
spec is that convergence — the **foundation** the rest of MVP3 enforcement sits on (mvp3.md
Cutline: "one egress model in core, not two").

**The two egress models (to unify):**
- **Wire-protocol, fire-and-forget** — [`core/airlock.js`](../../core/airlock.js): the worker
  maps and returns `ready: EgressRequest[]`; the orchestrator `fetch(url, {keepalive})`-dispatches
  them on the main thread (ADR-0004/ADR-0002 Option C) and never reads a response. This is GA4
  (MVP1), in `core/` and green.
- **Wrapped-SDK, request/RESPONSE round-trip** — the rig harnesses
  ([`rig/alloy-chamber.mjs`](../../rig/alloy-chamber.mjs) + `connectors/alloy/`): alloy issues its
  OWN worker `fetch`; the chamber **intercepts** it, `postMessage`s it to main, and the main-thread
  dispatch does the real fetch and posts the **response back** into the chamber (the ECID must
  round-trip). `core/airlock.js` has **no** surface for this — its `onmessage` handles only `ready`.

**The two hosting paths (to converge):**
- **Generic** — [`core/connector-host.js`](../../core/connector-host.js): `createConnectorHost(factory, config)`
  → `{manifest, init, routeBatch}`, pure + Node-testable (012-01). Its own docstring flags it as "a
  NEW, PARALLEL path" — GA4 and `core/airlock.js` untouched by it.
- **GA4-hardcoded** — [`core/chamber.worker.js`](../../core/chamber.worker.js): `core/airlock.js`
  hardcodes `new Worker(new URL("./chamber.worker.js", …))`, which imports GA4's `mapToMp` directly.

**What this spec delivers:** the wrapped-SDK **round-trip egress** wired into `core/`, the
**coalescing broker + its reject-path** carried into `core/`, and **GA4 retrofitted onto the generic
host** so both connectors run one way. After it, ADR-0004's main-thread dispatch is a single core
seam the enforcement specs extend — not a rig mirror and a core original that can drift.

**Not in scope:** `reserveSpace` security + hardening (the `innerHTML` sanitizer + Trusted-Types
boundary) is its own MVP3 spec (refinement-todo f–k). This spec is the **egress + hosting**
integration (refinement-todo a–e). It builds no new enforcement teeth — flipping `endpoints`
advisory→authoritative, config-integrity, and consent enforcement are the specs that follow, binding
at the seam this one lands.

## Assumptions

<!-- Grounded 2026-08-30 by reading core/airlock.js, core/connector-host.js, core/chamber.worker.js,
     connectors/alloy/, and the rig harnesses; risk-gated. -->

- **`core/airlock.js` today has no request/response round-trip surface.** Its `worker.onmessage`
  dispatches `ready` requests fire-and-forget and increments `dispatched`; there is no
  `intercepted-fetch` → real-fetch → `intercepted-fetch-response` path. Grounded
  ([`core/airlock.js`](../../core/airlock.js) lines 58–66). The round-trip surface is **new work**,
  not a re-wire.
- **The round-trip egress surface's contract home is an open design choice.** Either lift it into
  `contracts/*.d.ts` (a first-class capability) or keep it chamber-internal and gate it at the seal
  — MVP2 left this open (tracked debt (b); arch-review flag 2: `handle → EgressRequest[]` models only
  fire-and-forget). This spec must **pick and justify** one; it is the load-bearing design decision.
- **The chamber's egress-confinement posture must survive the move to `core/`.** In the rig, the
  chamber's mediated `fetch` is its sole network surface (012-01 AC5); moving the dispatch into
  `core/airlock.js` must not open a second egress path or lose the confinement. Grounded
  (`connectors/alloy/egress-confinement.js`, 012-01 AC5).
- **The coalescing broker's reject-path must be carried, not dropped.** The rig broker settles held
  awaiters on a first-mint dispatch failure (012-02 craft fix; refinement-todo (e)); a naive core
  port that only resolves would hang held chambers forever. Grounded
  ([`rig/alloy-coalescing-broker.js`](../../rig/alloy-coalescing-broker.js)).
- **GA4's MVP1 fire-and-forget path must not regress.** Convergence retrofits GA4 onto the generic
  host; the byte-identical `mapToMp` payloads, the unload fast path (OQ10), and every GA4 test must
  stay green (no breaking change to the MVP1/MVP2 contract — mvp3.md No-Gos). Grounded (the GA4 test
  suite: `test/ga4-*.test.js`, `test/egress-fastpath.test.js`).
- **Live Edge is reachable + a stub exists.** Slices may validate against the 012 minting-Edge stub
  (deterministic) and/or real Edge (spec 013's `.env` creds, gitignored). The round-trip mechanism
  is model-independent; correctness is provable against the stub.

## Decomposition

SPIDR = **Interface / Path** (not a Spike — the mechanisms exist and are demonstrated in MVP2; the
work is porting them into `core/` behind one seam, connector by connector). Each slice runs a **real
connector scenario end-to-end through `core/`** (the user-facing layer: a connector's egress + jar
write-back / analytics beacon), so none is horizontal plumbing — the vertical value is "this
scenario now runs through core, not a rig."

- **014-01 `[Path]` round-trip egress + generic hosting in core (alloy driver)** — `core/airlock.js`
  hosts a wrapped-SDK connector via `core/connector-host.js` in a real Worker chamber, and gains the
  **request/response round-trip** dispatch (intercepted-fetch → main-thread real fetch →
  response-back), the surface the fire-and-forget model lacks — with the confinement posture
  preserved and the round-trip surface's contract home **decided**. E2E: the 012-01 single-chamber
  alloy scenario (interact intercepted → **core** dispatch → Edge → ECID → `AMCV_*`/`kndctr_*` jar)
  runs through `core/`, not the rig. Includes the hardening for this mechanism (fetch-shim timeout so
  a never-answered main response can't hang `sendEvent`; the dead-man real-fetch guard confined).
- **014-02 `[Path]` concurrent-chamber coalescing in core** — the coalescing broker (in-flight-mint
  table + completed-mint association + **the reject-path**) carried into `core/`. E2E: two concurrent
  alloy chambers both first-minting are coalesced by **core's** broker to **one** ECID in both jars,
  and a first-mint dispatch failure settles the held awaiter (the reject-path bites) — the 012-02
  scenario through `core/`.
- **014-03 `[Interface]` converge connector-hosting (GA4 retrofit)** — retrofit **GA4** onto
  `core/connector-host.js` so both connectors are hosted one way, and converge / retire the
  GA4-hardcoded `core/chamber.worker.js` path. E2E: GA4 (UC-2) runs through the generic host with the
  byte-identical MP payloads + the OQ10 unload fast path intact — **one** hosting path, all GA4 tests
  green.

## Slices

1. [014-01 — round-trip egress + generic hosting in core](slice-01-roundtrip-egress-core.md)
2. [014-02 — concurrent-chamber coalescing in core](slice-02-coalescing-core.md)
3. [014-03 — converge connector-hosting (GA4 retrofit)](slice-03-converge-hosting.md)
