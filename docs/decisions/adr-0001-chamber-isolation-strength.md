---
status: Accepted
dependencies: []
last_verified: 2026-08-25
frame_review: true
---

# ADR-0001: Chamber isolation strength for MVP1

## Status

Accepted (2026-08-25)

## Context

The worker runtime hosts each connector in a "chamber." The project vocabulary
sells two guarantees: fault isolation (a broken tag cannot sink the page) and
confidentiality (one tag cannot read another's data or reach the network except
through the airlock). MVP1 ships a single first-party connector, GA4 over the
Measurement Protocol — wire-protocol code we author, with no untrusted vendor
JavaScript.

OQ1 asks what isolation mechanism MVP1 uses: a plain dedicated Web Worker, or a
harder sandbox (QuickJS compiled to WASM with a capability bridge). **This ADR
decides the MVP1 mechanism only.** The MVP2 isolation model (which arrives when
the runtime hosts vendor code, alloy) and the synchronous-host-access mechanism
it requires are coupled and jointly deferred to
[refinement-todo OQ9](../refinement-todo.md), because the R-004 probe grounds
sync-access feasibility only in the single-thread, one-realm model that both MVP2
isolation options abandon (see Recommended Decision).

The architecture review (G3) sharpened one point: "chamber" implies per-connector
isolation, but a plain Worker is a single shared global scope, so plain-Worker
MVP1 delivers per-worker isolation, not per-chamber. State that honestly.

## Decision Options Considered

### Option A: Plain dedicated Web Worker (one shared scope) for MVP1
- **Pros:** Simplest to build and reason about; a single postMessage channel for
  the drain/cycle plumbing; well-understood; `fetch` keepalive works in it.
  Sufficient for one first-party connector. Off-thread execution already protects
  the main thread from a connector's synchronous work, so INP is protected
  regardless of isolation strength.
- **Cons:** No per-connector confidentiality; a second connector in the same
  worker shares scope. Cannot contain a connector that blocks the worker event
  loop or exhausts memory. The per-tag security story is not demonstrable.

### Option B: One dedicated Web Worker per connector (Worker-per-chamber)
- **Pros:** True per-connector fault isolation (crash, loop, or OOM contained to
  one thread); real confidentiality between connectors.
- **Cons:** Higher overhead (a thread + memory + module graph per connector);
  more cross-worker plumbing; ordering/coordination is harder. Overkill for one
  first-party connector.

### Option C: In-worker sandbox per connector (QuickJS-to-WASM / realm) inside one Worker
- **Pros:** Hard confidentiality and a real capability bridge in one thread; the
  strongest containment for untrusted vendor code.
- **Cons:** Significant complexity and real performance cost (interpreted JS in
  WASM); premature for MVP1's single first-party connector; the capability-bridge
  surface is large and unproven for a real vendor SDK.

## Recommended Decision

Option A (plain dedicated Web Worker) for MVP1, with the guarantee scoped
honestly.

State plainly what MVP1 isolation does and does not provide. It provides:
off-thread execution (the main thread is protected from connector work, so INP is
protected) and fault isolation for thrown exceptions caught at the dispatch
boundary (a throwing connector is isolated or restarted per clarification Q1, and
the page keeps running). It does not provide: per-connector confidentiality, nor
containment of a connector that blocks the worker event loop or exhausts memory.
For one first-party connector this is acceptable, and it should be written into
the docs so the isolation claim and MVP1 reality do not drift (G3).

MVP1's single first-party GA4 connector needs no cross-chamber guarantees. Its one
synchronous-host-access need (GA4 reads/writes its own `client_id` cookie) is
served by the simplest thing — a per-worker sync-cache seeded at boot with async
write-back, which R-004 showed works for a single connector.

**Everything about the MVP2 world is deferred, not reserved.** The per-connector
isolation choice (B vs C) and the synchronous-host-access mechanism that must
accompany it are one coupled decision, and R-004 does **not** ground it: the probe
validated synchronous reads only where the connector and the cache share one
thread and one realm (host globals by reference), and *both* MVP2 models break
that precondition — worker-per-chamber gives each chamber a separate-thread cache
(two chambers sharing an ECID/demdex identity cookie cannot see each other's
synchronous writes without SharedArrayBuffer + Atomics, which AD-4 forbids), and a
WASM sandbox cannot pass globals by reference and must marshal each read across
the boundary (losing the unmodified-stock-bundle property). So this ADR makes
**no** forward reservation about the MVP2 capability shape; it records the
coupling and hands the whole question to OQ9, to be settled by a model-agnostic
probe before the step-5 contract freezes.

## Consequences

**Becomes easier:**
- MVP1 ships on a simple, proven primitive with minimal plumbing.
- The security story is stated honestly, with no overclaim MVP1 cannot back.
- No ungrounded MVP2 commitment is baked into the step-5 capability contract.

**Becomes harder:**
- The per-tag confidentiality and runaway-containment value proposition is not
  demonstrable until MVP2.
- Adding any second or untrusted connector to the MVP1 worker before the
  isolation upgrade is unsafe — a documented gap, not a supported configuration.

## Assumptions

- A plain dedicated Worker supports `fetch(..., {keepalive:true})` and runs
  connector code off the main thread. [Verified; see
  [R-001](../research/R-001-worker-egress-unload.md) and review Verification A.]
- Alloy (the MVP2 archetype) dereferences `window`/`document` at module load and
  needs synchronous cookie/storage access; a plain no-DOM Worker can host it only
  with a shimmed global plus a sync-cache. [Feasibility grounded by executed
  probe — [R-004](../research/R-004-alloy-in-worker.md),
  [probes/alloy-worker](../../probes/alloy-worker/). **Scope: single-connector,
  empty-jar, faked-Edge, one page, plain-Worker realm.** Whether the sync-cache
  holds across chambers, across out-of-band cookie writes, or without SAB is
  *not* grounded — that is OQ9, not this ADR.]
- A single Worker runs one event loop, so it cannot contain a connector that
  blocks that loop or exhausts memory. [Web platform behavior.]

## Kill criteria

- MVP1 scope expands to a second connector, or any untrusted/vendor JavaScript,
  before the isolation upgrade. Plain Worker no longer suffices; escalate to
  Option B or C, and resolve OQ9.

## Open questions

- **OQ9 (refinement-todo):** the MVP2 per-connector isolation model (B vs C) and
  its synchronous-host-access mechanism, jointly — gated by a model-agnostic
  coherency probe before the step-5 contract. Includes cross-chamber cookie
  coherency, out-of-band-write staleness (a `Set-Cookie`, a second tab, or a
  main-thread write leaving the worker's synchronous view stale), and whether any
  of it avoids SharedArrayBuffer.
- Whether the drain/cycle channel should carry per-connector routing metadata in
  MVP1 to ease the later multi-chamber split. Feeds
  [ADR-0002](./adr-0002-event-descriptor-cycle-semantics.md).
