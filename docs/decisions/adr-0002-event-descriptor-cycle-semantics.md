---
status: Proposed
dependencies: []
last_verified:
frame_review: true
---

# ADR-0002: Event descriptor shape and cycle semantics

## Status

Proposed (2026-08-25)

## Context

This decision defines the event descriptor, the append-only event log, the cycle
by which batches cross the airlock *to* the worker, and the capture ring-buffer
overflow policy (OQ2). The hard constraint is INP: the only main-thread work on
the interaction path is appending the descriptor to the log and folding the
synchronous projection, both O(1) (product-vision Design principles). Carried
here from the review: R1 (the drain's `postMessage` serialization is main-thread
work, so it must chunk with a yield).

**The egress model is explicitly out of scope for this ADR.** Where and how mapped
events are dispatched *to the network* — dispatch location (worker vs
orchestrator), delivery under interaction-storm load, the aggregate keepalive
budget, and the unload/last-beacon path — is one coupled decision that three
rounds of adversarial review showed cannot be settled by argument: idle-gating
main-thread dispatch protects INP but stalls delivery under load; worker-side
dispatch trades that for a dedup and consent-snapshot cost; and neither resolves
the beacon generated within the unload window. That whole model is deferred to
[refinement-todo OQ10](../refinement-todo.md), to be settled empirically at the
risk-retirement spike (which measures the INP-versus-delivery tension) and
recorded in its own egress ADR. This ADR decides only what the spike needs
upstream of egress: the descriptor, the cycle to the worker, and overflow.

## Decision Options Considered

The load-bearing choice is how much work the interaction path does per event.

### Option A: Minimal descriptor; synchronous O(1) projection fold on the hot path; mapping deferred
- **Pros:** The interaction path stays O(1) (append + fold), protecting INP;
  synchronous readers still see current state (AD-3); all interpretation/mapping
  moves off-thread.
- **Cons:** The worker sees a per-cycle snapshot, not live state (acceptable for
  the connectors in scope).

### Option B: Richer descriptor with pre-computed fields on the hot path
- **Pros:** Less work later.
- **Cons:** More main-thread work per interaction — directly worsens INP, the one
  thing the architecture exists to protect.

### Option C: No projection fold on the hot path (fold lazily at read time)
- **Pros:** Cheapest possible `push`.
- **Cons:** Breaks synchronous-read correctness (AD-3): a synchronous reader after
  a `push` would not see that push folded. Rejected.

## Recommended Decision

Option A, with the descriptor, cycle, and overflow below.

**Event descriptor (interaction path, O(1)).** A minimal, structured-clone-cheap
record: a monotonic sequence number (total ordering across cycles), an event type,
a high-resolution timestamp (`performance.now()`), a payload reference (inline if
small, else a side-table index), and a marker for the projection snapshot slice
that accompanies it (see
[ADR-0003](./adr-0003-projection-snapshot-privacy.md)). The `push` appends the
descriptor to the log and folds the projection synchronously, then enqueues into
the ring buffer. No mapping on the hot path.

**Cycle semantics (main thread → worker).** The drain runs on idle (the
`aem-cwv-helper` `runWhenIdle` / `yieldToMain` primitives). It pulls a batch,
serializes it in chunks with a yield between chunks (R1), and `postMessage`s to the
worker. Sequence numbers preserve total order; the worker processes in sequence
order. Batching has a max-batch-size cap and a max-latency cap. This contract
covers events crossing *to* the worker; egress *from* the worker is OQ10.

**Capture ring-buffer overflow.** Capture never blocks (INP), so under sustained
no-idle pressure the bounded ring buffer overwrites the oldest unsent descriptor
(drop-oldest) and increments a dropped-count the inspector can surface. A priority
carve-out for ordering-critical events is deferred (Open questions).

## Consequences

**Becomes easier:**
- The interaction path is O(1); INP is protected by construction.
- The drain is chunked and yield-aware (R1), so serialization never becomes a long
  task in front of an interaction.
- Backpressure is simple: capture buffers, the drain paces on idle.

**Becomes harder:**
- The cycle contract deliberately stops at the worker boundary; the egress model
  (OQ10) is left open, so this ADR does not by itself deliver an end-to-end send.

## Assumptions

- The projection fold is O(1) for the event shapes in scope. [Design principle; to
  be confirmed against real GA4 event shapes in the spike — Kill criteria.]
- The drain's structured-clone serialization is main-thread work and must chunk +
  yield to avoid a long task before an interaction. [Verified reasoning; review R1.]

## Kill criteria

- The projection fold proves not-O(1) for real event shapes (e.g. large payloads
  folded synchronously). Revisit the descriptor (move heavy fields to the
  side-table, fold lazily behind a cheap index).
- The drop-oldest overflow policy loses ordering-critical events in practice. Add
  a priority carve-out.

## Open questions

- **OQ10 (refinement-todo), expanded:** the egress dispatch and delivery model —
  dispatch location (worker vs orchestrator, Option C vs B), delivery under
  interaction-storm load, the aggregate keepalive budget, and the unload /
  last-beacon path. Deferred to the risk-retirement spike, which measures the
  INP-versus-delivery tension, and its own egress ADR.
- Priority tiering for the capture buffer (protect pageview/consent/exposure from
  drop-oldest).
- Whether the projection snapshot is per-event or per-cycle. Ties to
  [ADR-0003](./adr-0003-projection-snapshot-privacy.md).
- Exact caps (max batch size, max latency, ring-buffer capacity). To be set with
  the spike's absolute budgets (review G5).
