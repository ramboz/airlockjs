---
status: Proposed
dependencies: []
last_verified:
frame_review: true
---

# ADR-0001: Chamber isolation strength for MVP1

## Status

Proposed (2026-08-25)

## Context

The worker runtime hosts each connector in a "chamber." The project vocabulary
(product-vision, architecture) sells the chamber as two guarantees: fault
isolation (a broken tag cannot sink the page) and confidentiality (one tag
cannot read another's data or reach the network except through the airlock).
MVP1 ships a single first-party connector, GA4 over the Measurement Protocol,
which is wire-protocol code we author, with no untrusted vendor JavaScript.

OQ1 asks what isolation mechanism MVP1 uses: a plain dedicated Web Worker, or a
harder sandbox (for example QuickJS compiled to WASM with a capability bridge).
The refinement-todo leaning is a plain Worker for MVP1, on the grounds that hard
isolation is load-bearing only at MVP2, when the runtime hosts alloy (vendor
code).

The architecture review (finding G3) sharpened the question. "Chamber" implies
per-connector isolation, but a plain Worker is a single shared global scope, so
a plain-Worker MVP1 delivers per-worker isolation, not per-chamber. The review
also surfaced a coupling (R3): the MVP2 archetype, alloy, needs synchronous
cookie and storage access, which pushes toward SharedArrayBuffer and therefore
conflicts with AD-4's no-SAB stance, unless a synchronous-cache shim is used
instead. So the MVP2 isolation choice is entangled with the
synchronous-host-access mechanism.

## Decision Options Considered

### Option A: Plain dedicated Web Worker (one shared scope) for MVP1
- **Pros:** Simplest to build and reason about; a single postMessage channel for
  the drain/cycle plumbing; well-understood platform primitive; fetch keepalive
  works in it. Sufficient for one first-party connector. Off-thread execution
  already protects the main thread from a connector's synchronous work, so INP is
  protected regardless of isolation strength.
- **Cons:** No per-connector confidentiality (a second connector added to the
  same worker shares scope). Cannot contain a connector that blocks the worker
  event loop (infinite loop) or exhausts its memory; those wedge the shared
  worker. The per-tag security story is not demonstrable.

### Option B: One dedicated Web Worker per connector (Worker-per-chamber)
- **Pros:** True per-connector fault isolation (a crash, loop, or OOM is
  contained to one connector's thread); real confidentiality between connectors.
  Uses the same familiar Worker primitive.
- **Cons:** Higher overhead (each Worker is a thread plus its own memory and
  module graph); more cross-worker plumbing; ordering and coordination across
  per-connector channels is more complex. Overkill for one first-party connector
  in MVP1.

### Option C: In-worker sandbox per connector (QuickJS-to-WASM or realm-based) inside one Worker
- **Pros:** Hard confidentiality and a genuine capability bridge inside a single
  thread; the strongest containment story for untrusted vendor code.
- **Cons:** Significant complexity and a real performance cost (interpreted JS
  inside WASM); premature for MVP1's single first-party connector; the
  capability-bridge surface is large and unproven for a real vendor SDK.

## Recommended Decision

Option A for MVP1, with the guarantee scoped honestly and a documented upgrade
path for MVP2.

State plainly what MVP1 isolation does and does not provide. It provides:
off-thread execution (the main thread is protected from connector work, so INP
is protected) and fault isolation for thrown exceptions caught at the dispatch
boundary (a connector that throws is isolated or restarted per clarification Q1,
and the page keeps running). It does not provide: per-connector confidentiality,
nor containment of a connector that blocks the worker event loop or exhausts
memory. For one first-party connector this is acceptable, and it should be
written into the docs so the isolation claim and the MVP1 reality do not drift
(review G3).

Defer the per-connector isolation choice (Option B versus Option C) to MVP2,
decided together with the alloy feasibility spike, because the two are coupled:
alloy needs synchronous cookie/storage, so the isolation mechanism and the
synchronous-host-access mechanism must be chosen together. Record now that the
capability contract (drive-order step 5) should reserve synchronous-looking host
calls served by a sync-cache with async write-back, so the MVP2 isolation choice
is not forced into SharedArrayBuffer (which would breach AD-4).

## Consequences

**Becomes easier:**
- MVP1 ships on a simple, proven primitive with minimal plumbing.
- The security story is stated honestly, avoiding an overclaim the MVP1 build
  cannot back.
- The MVP2 isolation decision is made with real evidence (the alloy spike)
  rather than up front.

**Becomes harder:**
- The per-tag confidentiality and runaway-containment value proposition is not
  demonstrable until MVP2.
- Adding any second or untrusted connector to the MVP1 worker before the
  isolation upgrade is unsafe, and is a documented gap, not a supported
  configuration.

## Assumptions

- A plain dedicated Worker supports `fetch(..., {keepalive:true})` and runs
  connector code off the main thread. [Verified against the Fetch Standard and
  MDN; see [architecture review](../reviews/2026-08-25-mvp1-architecture-review.md)
  Verification A.]
- Alloy (the MVP2 archetype) dereferences `window`/`document` at module load and
  needs synchronous cookie/storage access, so a plain no-DOM Worker cannot host
  it unmodified; a shimmed global plus a synchronous-cache shim is required, and
  that couples the isolation choice to the synchronous-access mechanism.
  [Grounded by executed probe: stock `@adobe/alloy@2.35.0` booted, configured,
  and sent an event in a Worker with the sync-cache shim satisfying all 33
  cookie reads / 5 writes — see
  [R-004](../research/R-004-alloy-in-worker.md) and
  [probes/alloy-worker](../../probes/alloy-worker/); doc trail in review
  Verification D.]
- A single Worker runs one event loop, so it cannot contain a connector that
  blocks that loop or exhausts memory. [Web platform behavior.]

## Kill criteria

- MVP1 scope expands to include a second connector, or any untrusted/vendor
  JavaScript, before the MVP2 isolation upgrade. Plain Worker no longer suffices;
  escalate to Option B or C.
- The alloy feasibility spike shows synchronous access cannot be shimmed without
  SharedArrayBuffer, forcing a reconciliation with AD-4 that changes the
  isolation calculus.

## Open questions

- The MVP2 choice between Worker-per-connector (B) and an in-worker sandbox (C).
  Deferred to the alloy feasibility spike.
- Whether the drain/cycle channel should carry per-connector routing metadata in
  MVP1 to ease the later multi-chamber split. Feeds
  [ADR-0002](./adr-0002-event-descriptor-cycle-semantics.md).
