---
status: Accepted
dependencies: []
last_verified: 2026-08-29
frame_review: true
---

# ADR-0008: OQ9 coherency axis — broker-side mint coalescing, conditional on vendor-fetch interception

## Status

Accepted (2026-08-29)

## Context

OQ9 coupled two axes into one deferred decision: cross-thread **coherency** (can a
chamber's synchronous cookie cache stay fresh without SharedArrayBuffer, AD-4-forbidden)
and, for [ADR-0001](./adr-0001-chamber-isolation-strength.md) Option C, **read-semantics**
(a WASM sandbox may have to marshal each read). [Spec 011](../specs/011-mvp2-coherency-probe/spec.md)
investigated the coherency axis. This ADR resolves it, claiming **only the coherency
axis**; read-semantics + the B-vs-C model choice are carried forward, pre-constrained.

**Provenance (honest).** This decision went through **seven adversarial frame-critique
rounds** that progressively corrected the analysis — each removed a false shortcut
(a boot-race; "value-push self-heals"; "mint arbitration is model-independent"; a
"cost asymmetry"; "broker-proxied egress is a non-default driver"). The converged
result below is grounded against the **accepted egress model** ([ADR-0004](./adr-0004-egress-dispatch-delivery.md)),
the **wrapped-SDK archetype** (AD-7), and the **Alloy probe** ([R-004](../research/R-004-alloy-in-worker.md)).
It is an **analytical** result: spec 011's deterministic op-model can demonstrate the
mechanism but cannot *measure* it (the single-threaded broker serializes the requests —
there is no timing race to measure), so the probe's slices 011-01/02 are the grounding
inputs and **011-04 was abandoned** once the critique process established the mechanism.

**The real fault (grounded).** Identity **minting is an async Edge round-trip** — the
ECID is server-assigned, JS-written from the Edge *response* body (R-004). Two chambers
that both read an empty identity and both mint concurrently produce **two distinct
ECIDs → split identity**. This is roughly **model-independent** (it occurs for both the
two-cache B and the shared-cache C/D topologies — a shared cache does not help, because
both read empty during the request→response gap). It is **not** 011-01's fault: 011-01's
`concurrent-async-writeback` modeled a *synchronous local* mint (atomic generate), a
different and less-realistic case whose "B-specific" finding does not transfer here.

**Two grounding corrections the critiques forced:**
- **Broker-push *value*-invalidation cannot un-mint** an already-emitted ECID, so it
  does **not** retire the concurrent-first-mint (the mints already happened; a
  write-back-time value fix is too late).
- The fix is to **prevent the second mint**: **broker-side async request coalescing**.
  But that needs the mint *request* to be **visible to the broker** — and airlock's
  orchestrator **already dispatches egress on the main thread** (accepted ADR-0004;
  the older architecture.md Tech-stack "egress from the worker" line is a superseded
  wizard draft). So airlock-controlled egress is broker-visible; the gap is the
  **wrapped-SDK archetype**, where the *vendor SDK* issues its own opaque worker-side
  `fetch` (AD-7 / R-004) that bypasses the orchestrator's dispatch.

## Decision Options Considered

The [R-006](../research/R-006-cross-chamber-cookie-coherency-mechanisms.md) mechanism
options, judged against the *async first-mint* fault:

### Option A — seed + async write-back (MVP1 shim)
- Concurrent-first-mint fault. Insufficient.

### Option B(value) — broker-push value-invalidation
- Cannot un-mint an emitted ECID; insufficient for the first-mint.

### Option B(coalesce) — broker-side async request coalescing (RECOMMENDED)
- Prevent the second mint: the single-threaded broker holds the second concurrent
  identity-mint and returns the first's ECID. Async (no SAB), model-independent (the
  coalescing point is the broker). **Requires the mint request to be broker-visible.**

### Option D — single shared worker
- Serializes but drops cross-connector confidentiality. No-go fallback.

### Per-read marshalling / SAB
- AD-4-forbidden.

## Recommended Decision

**GO on the coherency axis — conditional.** The concurrent-first-mint fault is retired
by **broker-side async request coalescing** (the single-threaded orchestrator holds the
second concurrent identity-mint and returns the first's ECID) — async, **no SAB**,
**model-independent** (so it does *not* discriminate B-vs-C). Seed+async and broker-push
value-invalidation are ruled out (fault / cannot-un-mint).

The condition is **egress visibility of the mint request**, which splits by archetype:

- **Wire-protocol connectors (GA4):** the orchestrator already dispatches their egress
  on the main thread (ADR-0004) — broker-visible by construction. **No new mechanism.**
- **Wrapped-SDK archetype (Alloy):** the vendor SDK issues its own opaque worker-side
  `fetch` (AD-7 / R-004) that bypasses the orchestrator's dispatch. So the GO is
  **conditional on two to-be-designed pieces**:
  1. **Chamber-side interception of the vendor's `fetch`**, routed into the
     orchestrator's *existing* main-thread egress dispatch (ADR-0004) — a fetch-shim
     over a path the orchestrator already owns, **not** an exotic egress-infra swap.
  2. **Mint recognizability** — the vendor's egress is one opaque XDM `interact` call
     bundling identity-fetch with pageView/personalization (R-004), so the broker must
     **parse vendor-payload semantics** to recognize two calls as one coalescable ECID
     mint. Not free.

So: the coherency axis is a **GO**, but the **step-5 contract-freeze gate is HELD for
the wrapped-SDK archetype** until the interception + mint-recognition + coalescing
mechanism is designed. The **B-vs-C model choice is not constrained** by this axis
(coalescing is model-independent, at the broker).

Routing onto OQ9:
- **(a) Coherency mechanism** — broker-side async **mint coalescing** (not
  value-invalidation, not SAB). Rides ADR-0004's main-thread dispatch for wire-protocol
  connectors.
- **(b) Contract freeze — HELD for wrapped-SDK** — gated on designing vendor-`fetch`
  interception + XDM mint-recognition + the broker's in-flight-mint coalescing table.
- **(c) Read-semantics** — unmeasured; deferred, pre-constrained by the sync-read
  contract.
- **(d) B-vs-C** — deferred, and this axis does **not** constrain it (coalescing is
  model-independent).

## Consequences

**Becomes easier:**
- The sync-access mechanism is now precisely named — broker-side async mint coalescing
  — and for wire-protocol connectors it rides ADR-0004's existing main-thread dispatch,
  no new machinery.
- OQ9's coherency axis is confirmed **separable** from the B-vs-C choice.

**Becomes harder:**
- The wrapped-SDK archetype needs **chamber-side vendor-`fetch` interception + XDM mint
  recognition + a broker in-flight-mint coalescing table** — a to-be-designed capability;
  this is the contract-freeze-held gate for MVP2's Alloy identity.
- Option-C read-semantics remains deferred, pre-constrained.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- Minting is an async Edge round-trip (server-assigned ECID from the response body) —
  grounded [R-004](../research/R-004-alloy-in-worker.md).
- The orchestrator already dispatches airlock egress on the main thread — grounded in
  **accepted** [ADR-0004](./adr-0004-egress-dispatch-delivery.md) (architecture.md's
  "egress from the worker" Tech-stack line is a superseded wizard draft, flagged).
- The wrapped vendor SDK issues its own opaque worker-side `fetch` bundling identity
  into an XDM `interact` call — grounded R-004 (the executed probe).
- Broker-side coalescing (holding the second concurrent mint) is async, needs no SAB,
  and is model-independent — **structural**, established by analysis across seven
  frame-critique rounds, **not** independently rig-measured (the deterministic op-model
  cannot measure a race the single-threaded broker serializes away).

## Kill criteria

- **The vendor's XDM call is not reliably parseable to recognize the identity mint** —
  then concurrent mints can't be coalesced for the wrapped-SDK, the fault survives, and
  MVP2 needs a different identity strategy (e.g. host-seeded identity before the vendor
  boots). Re-probe against real Alloy before the freeze.
- **Chamber-side `fetch` interception can't preserve the unmodified stock bundle**
  (AD-7) — then the interception mechanism needs rethinking (a service-worker network
  chokepoint is one unmodified-bundle-preserving option).
- **011-01's synchronous-mint "B-specific" finding is taken at face value for the async
  case** — it would mis-scope the model choice. Reconcile: the async fault is
  model-independent; 011-01 measured a different (synchronous-mint) fault.

## Open questions

- The design of **chamber-side vendor-`fetch` interception + XDM mint-recognition + the
  broker in-flight-mint coalescing table** (the contract-freeze-held mechanism).
- Whether **host-seeded identity** (the host provides the ECID before the vendor boots,
  so the vendor never mints) is a simpler alternative to intercept-and-coalesce — worth
  comparing before the design freezes.
- Option-C read-semantics (deferred, pre-constrained).
- The 011-01 reconciliation (synchronous-mint vs async) — surfaced for owner approval,
  not applied unilaterally.
