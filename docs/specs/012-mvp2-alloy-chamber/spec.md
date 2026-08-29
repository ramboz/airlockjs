---
status: DRAFT
skill:
use_cases: [UC-1, UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 012: alloy in a chamber — the wrapped-SDK generalization proof

## Overview

MVP2's central claim is that airlock's MVP1 connector/capability contract — proven
with the **wire-protocol** archetype (GA4, a pure `mapToMp` payload builder) —
**generalizes to the wrapped-SDK archetype**: a stateful vendor library (Adobe's
Experience Platform Web SDK, **alloy**) hosted inside a chamber, running unchanged,
reaching the network only through mediated capabilities. This spec proves that end
to end. It is the first real build of [MVP2](../../releases/mvp2.md), unblocked now
that its RISK-FIRST precondition — the OQ9 coherency probe ([spec 011](../011-mvp2-coherency-probe/spec.md)
/ [ADR-0008](../../decisions/adr-0008-oq9-coherency-sync-access.md)) — is DONE.

Two things have to be true, and the grounding read (2026-08-29) showed only the
second is close:

1. **The wrapped-SDK host the contract describes does not exist yet.** The runtime
   is a GA4-hardcoded spike: [`core/chamber.worker.js`](../../../core/chamber.worker.js)
   `import`s GA4's `mapToMp` directly; there is no manifest loader, no
   `ConnectorFactory` call, no `init(caps)` / `handle(event)` dispatch, and no
   per-chamber connector instance. GA4 never implemented the `Connector` interface —
   it is a pure function plus host-side `ctx` sourcing. So this spec **builds** the
   manifest → factory → `init` → `handle` hosting mechanism the `.d.ts` contract
   already describes.
2. **Stock alloy already runs in a worker unmodified.** [R-004](../../research/R-004-alloy-in-worker.md)
   proved `@adobe/alloy@2.35.0` boots, configures, and sends an XDM `interact` event
   entirely inside a worker with no source edits — needing three things the literal
   "no-DOM / async-only" contract lacks: **synchronous** cookie access (served by a
   sync-cache + async write-back), async context/identity injection, and
   decisions-as-data. Feasibility is not the risk; **building the host and lifting
   ADR-0008's held gate is.**

**"Unchanged" means additively extended, not unedited.** MVP2's plan is explicit
("extend, don't rewrite the pinned contracts"), and the contract already *reserves*
alloy's extensions as designed-for holes: the synchronous-read cookie surface is
marked "intentionally absent … OQ9" in [`capability.d.ts`](../../../contracts/capability.d.ts),
decisions-as-data is a "deferred shape … finalized with the MVP2 wrapped-SDK
connector," and `ConnectorManifest` carries the declaration fields. The acceptance
bar is therefore: **every existing pinned signature stays byte-identical** (async
cookie `get`/`set`, `handle → EgressRequest[]`, the `ConnectorManifest` fields, the
whole GA4 path); alloy's needs are met by **addition**, and GA4 keeps passing
throughout.

**This spec lifts ADR-0008's contract-freeze hold.** ADR-0008 resolved OQ9's
coherency axis with a **GO conditional** on a to-be-designed mechanism for the
wrapped-SDK: chamber-side interception of the vendor's own worker-side `fetch` into
the orchestrator's existing main-thread dispatch ([ADR-0004](../../decisions/adr-0004-egress-dispatch-delivery.md)),
plus XDM mint-recognition + broker-side async request coalescing. Building and
measuring that mechanism (slices 01–02) is what turns ADR-0008's **analytical** GO
into a demonstrated one and lifts the freeze. The isolation-model choice is
**Option B** — a dedicated Worker per chamber ([ADR-0001](../../decisions/adr-0001-chamber-isolation-strength.md)
B-vs-C, resolved for the MVP2 proof scope by slice 012-01; Option C / WASM sandbox
deferred to a later milestone).

**Scope discipline (from [mvp2.md](../../releases/mvp2.md)).** MVP2 is a **proof,
not a production rollout**. The manifest declaration shape is scaffolded but
**declared, not enforced** — the ADR-0006/0007 enforcement teeth (authoritative
endpoints, payload governance, purpose-vector consent) stay in MVP3. This spec does
**not** build the seal *enforcement* (MVP3; see Assumptions — it does not exist today
either). It keeps **GA4's behaviour** at parity while adding the wrapped-SDK path — but
the wrapped-SDK chamber is a **new live-network attack surface** (Assumptions), so slice
01 makes the mediated `fetch` the **sole** egress path by denying the other ambient
network primitives. "Parity with MVP1" is **not** claimed as a safety property for the
live-network chamber.

## Assumptions

<!-- Grounded 2026-08-29 by a read of core/, contracts/, connectors/ga4/, docs/research/R-004, docs/releases/mvp2.md (spec 064-02 / ADR-0020, risk-gated). -->

- **The connector-hosting mechanism does not exist in `core/` today.**
  `core/chamber.worker.js` hardcodes `import { mapToMp } from "../connectors/ga4/map.js"`;
  there is no manifest loader / `ConnectorFactory` / `init` / `handle` / retained
  instance. Grounded (`core/chamber.worker.js`, `core/airlock.js`). This spec builds it.
- **No seal (consent/allow-list egress gate) is enforced in `core/` today.**
  Enumeration: `grep -i "seal|consent|allow.?list" core/` returns zero hits; the seal
  lives only in contract/ADR/architecture prose. MVP2's "the MVP1 seal is the security
  floor" is therefore **aspirational** — this spec neither relies on nor builds it
  (enforcement is MVP3). Flagged as a plan-vs-reality discrepancy for owner awareness.
- **MVP2 introduces a *live-network chamber* — a new attack surface MVP1 lacks.** MVP1's
  worker has **no** network primitive: GA4 returns an `EgressRequest` and
  `core/chamber.worker.js` never fetches (dispatch is main-thread, `core/airlock.js`), so
  MVP1's "no seal" is *structurally* safe — the worker cannot egress. MVP2's wrapped-SDK
  chamber hosts **untrusted vendor code** with a **live (shimmed) `fetch`**, making the
  interception shim the **sole egress chokepoint**. So "parity with MVP1" is **not** a
  safety argument here. Slice 01 makes the chokepoint real with an **allow-list posture**
  — the mediated `fetch` is the chamber's only network-capable surface; a representative
  adversarial set (`XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`,
  `WebTransport`, nested `Worker`, `CacheStorage`, post-load `importScripts`, remote
  `import()`) is **tested unreachable** — so "reaching the network only through mediated
  capabilities" is a *tested chamber property*, not a one-primitive claim. One
  primitive is **language-level** and cannot be withheld by a JS shim: **dynamic
  `import()`** of a remote specifier — closed structurally by the classic-worker load
  route (slice 01 AC2 takes no module-`import()` dependency) and otherwise **disclosed as
  a named residual** gated by MVP3 seal enforcement + an optional worker `connect-src`
  CSP. Full seal *enforcement* (consent / allow-list on the mediated path) stays MVP3.
- **The wrapped-SDK egress model differs from the wire-protocol one — additively.** The
  pinned `handle → EgressRequest[]` is **fire-and-forget** (no response channel). alloy's
  identity mint is a **request/response round-trip** (the ECID returns in the Edge
  response body), intercepted at the `fetch` level — *not* returned as an `EgressRequest`.
  So the wrapped-SDK path adds a **second, round-trip egress surface**: additive (existing
  signatures untouched), and the surface the future seal must gate. "Unchanged = additive"
  means *signature*-compatible, **not** *egress-model*-identical.
- **Stock `@adobe/alloy@2.35.0` boots + sends an XDM `interact` in a worker
  unmodified,** needing synchronous `document.cookie` (sync-cache + async write-back),
  async context/identity injection (`context: []` + host XDM), and decisions-as-data
  (`renderDecisions: false`). Grounded (R-004; executed probe `probes/alloy-worker/`).
  Pin **2.35.0** (the probe's `^2.28.0` resolved to it).
- **Alloy issues its own worker-side `fetch`** to
  `https://adobedc.demdex.net/ee/v1/interact`, bypassing the orchestrator's
  return-a-request egress model. Grounded (R-004, ADR-0008). The interception
  mechanism (slice 01) routes it into ADR-0004's main-thread dispatch.
- **The ECID is minted by an async Edge round-trip (server-assigned, JS-written
  synchronously from the response).** Grounded (R-004, ADR-0008). Concurrent
  two-chamber first-mint → split identity is the fault slice 02 retires via broker
  coalescing.
- **The airlock chamber is a `type: "module"` Worker; R-004 loaded alloy via
  `importScripts` in a *classic* worker.** `importScripts` is unavailable in a module
  worker, so the unmodified 766 KB IIFE bundle-load mechanism must be settled
  (slice 01) while preserving the stock bundle (AD-7).
- **"Unchanged contract" = existing pinned signatures byte-identical + additive
  extension only.** Grounded (`contracts/*.d.ts` reserve the alloy holes; mvp2.md
  "extend, don't rewrite").
- **Live Adobe Edge validation (real datastream / real ECID issuance / cluster
  routing / third-party sync) needs a test datastream (org + datastreamId).** R-004
  faked the Edge response; a live end-to-end run is an external-credential dependency.
  Slices exercise the mint + interception + coalescing **mechanism** against a
  faithful local minting-Edge stub; live-Adobe validation is a credentials-gated step.
  Grounded (R-004 "left open").

## Decomposition

SPIDR, **Path-first** — Spike is deliberately *not* used: R-004 already retired the
feasibility question, so the work is to **build**, not to learn. The split keeps
every slice vertical (each puts an observable alloy behaviour through the chamber)
despite slice 01 being unavoidably thick — the connector host is irreducible (you
cannot run alloy without it), so slice 01 is **thick-but-vertical**, not horizontal
phasing.

- **012-01 `[Path]` — happy path:** the wrapped-SDK host + stock alloy boots + emits
  **one** Analytics `interact` from a **single** chamber, its own `fetch` intercepted
  into the orchestrator's dispatch; real mint against a minting-Edge stub. Serves
  UC-2. Records the ADR-0001 B-vs-C = Option B decision.
- **012-02 `[Path/Rules]` — the hard identity case:** **two** concurrent chambers
  first-minting → broker-side async request coalescing + XDM mint-recognition; one
  ECID across both. Builds + measures ADR-0008's mechanism → lifts the wrapped-SDK
  contract-freeze hold.
- **012-03 `[Interface]` — a second channel:** alloy **Target** personalization,
  decisions-as-data (`renderDecisions: false`); host applies propositions
  (prehiding / anti-flicker stays main-thread). Serves UC-1.
- **012-04 `[Data/Rules]` — declaration + characterization:** alloy's connector
  **declares** its manifest (endpoints / reads / purposes — *declared, not enforced*)
  and its config-driven behaviour (auto-collected data, egress hosts) is characterized
  — the input MVP3's seam design needs.

## Slices

1. [012-01 — wrapped-SDK host + alloy boots + one Analytics event](slice-01-host-and-boot.md)
2. [012-02 — concurrent-chamber mint coalescing (lift ADR-0008's hold)](slice-02-mint-coalescing.md)
3. [012-03 — Target personalization, decisions-as-data](slice-03-target-decisions.md)
4. [012-04 — manifest declaration-shape + alloy behaviour characterization](slice-04-manifest-characterize.md)
