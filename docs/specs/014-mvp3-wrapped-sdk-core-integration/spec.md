---
status: IN_PROGRESS
skill:
use_cases: [UC-1, UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md. -->

# Spec 014: wrapped-SDK core integration — one dispatch seam, one hosting path (no rig mirror)

## Overview

MVP2 demonstrated the wrapped-SDK generalization (alloy in a chamber: fetch-interception →
main-thread dispatch, concurrent-chamber mint coalescing, `reserveSpace`) — but **parallel to
`core/`, in rig harnesses**, a deliberate proof shortcut. That leaves the wrapped-SDK round-trip
egress as a **rig mirror** of a core original that can drift, plus **two connector-hosting paths**.

The two egress **models** — wire-protocol **fire-and-forget** (GA4: the worker returns
`ready: EgressRequest[]`, main `fetch`-dispatches them, response never read) and wrapped-SDK
**request/RESPONSE round-trip** (alloy: intercepted-fetch → main → response posted back) —
**legitimately coexist**: GA4 never reads a response, alloy must; neither collapses into the other.
So this spec does **not** unify the models. What it unifies is (a) the **dispatch SEAM** — both do
the real `fetch` on the main thread (ADR-0004) — and (b) the **LOCATION** — the round-trip model
**leaves the rig**, so no mirror-vs-core drift — plus (c) the **hosting path**. That single seam is
what MVP3's enforcement binds to, and it must gate **two request shapes** arriving at it: a
structured `EgressRequest` **and** a raw intercepted fetch. This spec is the **foundation** the rest
of MVP3 enforcement sits on ("no rig mirror; one seam, one hosting path").

**The two egress models (coexisting — the round-trip one leaves the rig):**
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

**What this spec delivers:** the wrapped-SDK **round-trip egress** wired into `core/` — in a **new
sibling core module**, so the GA4-hardcoded `core/airlock.js` stays untouched until convergence — the
**coalescing broker + its reject-path** carried into `core/`, and finally **GA4 retrofitted onto the
generic host** so both connectors run one way. The **single dispatch seam is the 014-03 end-state**:
after 014-01/02 core has two dispatch sites (the sibling wrapped-SDK host + `core/airlock.js`'s
wire-protocol dispatch), and 014-03 converges the hosting so ADR-0004's main-thread dispatch is one
core seam the enforcement specs extend — with no rig mirror to drift.

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
- **The round-trip egress surface is a declared-AND-gated capability (settled here; an ADR
  formalizes it).** The "contracts vs seal-gate" framing was a **false binary** conflating two
  orthogonal axes — *declaration home* and *enforcement point*. Settled: the round-trip egress is a
  **first-class capability** the chamber requests and the orchestrator provides —
  `caps.egress.dispatch(req) → Response` — with a **documented contract home** (`contracts/*.d.ts`)
  **and** seal-gating on the manifest's declared `endpoints` / `purposes` (**declared _and_ gated**,
  not either/or). This closes tracked debt (b) / arch flag 2 (the `handle → EgressRequest[]` surface
  only modelled fire-and-forget). Settled **here** (spec Assumptions) — **not** deferred to a slice-time
  pick — because the MVP3 enforcement specs bind to this surface; the **ADR formalizing the
  `caps.egress.dispatch` capability is authored as the first step of 014-01 implementation** (before
  any enforcement spec is drafted, so a slice-time pick can't reopen 014-01).
- **The chamber's egress-confinement is chamber-side, so the move to `core/` is confinement-neutral.**
  `applyEgressConfinement` runs inside the worker's own scope at boot (`alloy-chamber.worker.js`), and
  the AC5 adversarial probe runs in-chamber — where the main-thread dispatch *lives* (rig vs core) has
  no bearing on it (main-thread egress is ADR-0004's **sanctioned** path, not a "second" one). So
  014-01's confinement check is a **cheap regression re-run** against the core-hosted chamber, guarding
  only against an incidental disturbance if the port touches chamber source (it should not need to) —
  not a live risk. Grounded (`connectors/alloy/egress-confinement.js`, 012-01 AC5).
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

- **014-01 `[Path]` round-trip egress + generic hosting in core (alloy driver)** — a **new sibling
  core module** (e.g. `core/wrapped-sdk-host.js`) hosts a wrapped-SDK connector via
  `core/connector-host.js` in a real Worker chamber, and owns the **request/response round-trip**
  dispatch (intercepted-fetch → main-thread real fetch → response-back) — the surface the
  fire-and-forget model lacks, implemented as the **declared-AND-gated `caps.egress.dispatch`
  capability** (Assumptions) — **leaving `core/airlock.js` + its hardcoded GA4 worker untouched**
  (convergence is 014-03). E2E: the 012-01 single-chamber alloy scenario (interact intercepted →
  **core** dispatch → Edge → ECID → `AMCV_*`/`kndctr_*` jar) runs through `core/`, not the rig.
  Includes the hardening for this mechanism (fetch-shim timeout so a never-answered main response
  can't hang `sendEvent`; the dead-man real-fetch guard confined).
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
