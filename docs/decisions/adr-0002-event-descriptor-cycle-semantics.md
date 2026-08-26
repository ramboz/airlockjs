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

This decision defines the event descriptor, the append-only event log, and the
cycle semantics by which batches cross the airlock to the worker (OQ2). The hard
constraint is INP: the only main-thread work on the interaction path is appending
the descriptor to the log and folding the synchronous projection, both O(1)
(product-vision Design principles).

The architecture review added load-bearing requirements: R1 (the drain's
`postMessage` serialization is main-thread work, so it must chunk with a yield),
R2 (egress cannot be fully worker-owned — unload signals are main-thread-only and
the 64 KiB keepalive limit is an aggregate budget), and T3 (the capture
ring-buffer overflow policy).

**This ADR decides the descriptor and the normal-path cycle and egress.** The
*end-of-session last beacon* — a beacon generated *within* the unload window,
which cannot complete an async worker round-trip to be mapped before the page is
torn down — is a distinct, unresolved path deferred to
[refinement-todo OQ10](../refinement-todo.md). It needs a main-thread synchronous
mapping fast path that this normal-path decision deliberately does not settle, and
this ADR does not assume the last beacon is already a mapped, returned request.

## Decision Options Considered

The load-bearing sub-decision is where normal-path egress is dispatched.

### Option A: Worker maps and dispatches; main thread has no egress role
- **Pros:** Matches the Tech stack as written; zero main-thread egress work.
- **Cons:** Refuted by R2 for the unload path; not viable as the sole model.

### Option B: Worker dispatches the normal path; main thread backstops unload
- **Pros:** Keeps worker-side dispatch for the common case.
- **Cons:** Two senders need a dedup/ack protocol; the aggregate keepalive budget
  splits across two contexts; and it does **not** solve the unload-generated
  beacon either (it also maps in the worker — see OQ10).

### Option C: Worker maps only; orchestrator dispatches normal-path egress through the seal, on idle
- **Pros:** One sender, no dedup. Faithful to capability-mediated egress (AD-5:
  the connector never touches the network); the seal runs where consent authority
  lives. INP cost is bounded once the dispatch is idle-gated (below).
- **Cons:** Revises the Tech stack's "egress from the worker" phrasing; normal-path
  dispatch sits on the document's keepalive budget.

## Recommended Decision

Option C for the normal path, with the descriptor and cycle semantics below.

**Event descriptor (interaction path, O(1)).** A minimal, structured-clone-cheap
record: a monotonic sequence number (total ordering), an event type, a
high-resolution timestamp (`performance.now()`), a payload reference (inline if
small, else a side-table index), and a marker for the projection snapshot slice
that accompanies it (see
[ADR-0003](./adr-0003-projection-snapshot-privacy.md)). The `push` appends the
descriptor to the log and folds the projection synchronously, then enqueues into
the ring buffer. No mapping on the hot path.

**Cycle semantics.** The drain runs on idle (the `aem-cwv-helper` `runWhenIdle` /
`yieldToMain` primitives). It pulls a batch, serializes it in chunks with a yield
between chunks (R1), and `postMessage`s to the worker. Sequence numbers preserve
total order; the worker processes in sequence order. Batching has a max-batch-size
cap and a max-latency cap.

**Normal-path egress.** The worker maps each event into an egress request
(endpoint plus payload) and returns ready-to-send requests to the orchestrator.
Receiving that batch, deserializing it, running the seal (consent plus host-owned
allowlist), accounting each body against the aggregate budget, and dispatching are
main-thread work, **idle-gated and chunked exactly like the outbound drain** (R1):
under `runWhenIdle`, at most a bounded number of requests per idle slice, yielding
between slices. The MVP egress-seam driver is direct `fetch` keepalive; emission is
sequential and bounds the concurrent in-flight keepalive total under the 64 KiB
aggregate budget (R2); a failed request is recorded as sent-unknown (an opaque
`TypeError`, feeding the inspector, OQ7). At `visibilitychange` to `hidden` the
orchestrator flushes any already-returned, un-dispatched requests immediately
(idle will not come again), highest-value first.

**The unload-generated beacon is out of scope here (OQ10).** The canonical last
beacon — an outbound click or closing pageview captured microseconds before unload
— is only appended and enqueued on the hot path and cannot round-trip to the
worker to be mapped before the page is gone, so it is *not* among the returned
requests the flush dispatches. Rescuing it needs a main-thread synchronous mapping
fast path for a declared set of unload-critical event types — a real addition that
cuts against "mapping stays worker-side" and must honor ADR-0003's
out-of-chamber minimization. It is deferred to OQ10, to be settled with the
risk-retirement spike (it is load-bearing for UC-2 correctness).

**Capture ring-buffer overflow.** Capture never blocks (INP), so under sustained
no-idle pressure the bounded ring buffer overwrites the oldest unsent descriptor
(drop-oldest) and increments a dropped-count the inspector can surface. A priority
carve-out for ordering-critical events is deferred (Open questions).

## Consequences

**Becomes easier:**
- Normal-path egress is off the interaction path (idle-gated), and the seal is
  enforced in one place (the orchestrator, where consent authority lives).
- Backpressure is simple: capture buffers, the drain paces on idle, egress paces
  under the aggregate budget.

**Becomes harder:**
- The Tech stack section must be updated: normal-path egress dispatch is
  orchestrator-side (mapping stays worker-side).
- The egress model is complete for the normal path only; the last-beacon path is
  left open (OQ10).

## Assumptions

- **Load-bearing, not-yet-measured:** orchestrator-side receive + seal + dispatch,
  once idle-gated and chunked as above, adds no measurable INP cost versus
  worker-side dispatch. This is an assumption the **risk-retirement spike
  measures** under interaction-storm load (R1), with Option B as the documented
  fallback (Kill criteria). C is chosen over B because it keeps egress
  capability-mediated (AD-5), needs no two-sender dedup, and enforces the seal
  where consent lives.
- Unload-detection events fire on the main thread only and a dedicated worker is
  torn down with its document. [Verified; see
  [R-001](../research/R-001-worker-egress-unload.md) and review Verification A.]
  This is also *why* the unload-generated beacon (OQ10) cannot be worker-mapped.
- The 64 KiB keepalive limit is aggregate across in-flight keepalive requests, and
  Chrome adds count caps (255 total, 9 per renderer). [Verified;
  [R-001](../research/R-001-worker-egress-unload.md).]

## Kill criteria

- Profiling shows the orchestrator-side dispatch or the worker-return hop
  measurably raises INP. Revisit toward Option B.
- The drop-oldest overflow policy loses ordering-critical events in practice. Add
  the priority carve-out.

## Open questions

- **OQ10 (refinement-todo):** the unload-generated last-beacon mapping and
  dispatch path (a main-thread synchronous fast path for declared unload-critical
  event types). Deferred to the spike; load-bearing for UC-2 correctness.
- Priority tiering for the capture buffer (protect pageview/consent/exposure from
  drop-oldest).
- Whether the projection snapshot is per-event or per-cycle. Ties to
  [ADR-0003](./adr-0003-projection-snapshot-privacy.md).
- Exact caps (max batch size, max latency, ring-buffer capacity). To be set with
  the spike's absolute budgets (review G5).
