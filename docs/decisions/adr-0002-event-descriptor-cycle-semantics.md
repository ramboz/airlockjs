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
cycle semantics by which batches cross the airlock to the worker. It is the
first architecture spec (OQ2). The hard constraint is INP: the only main-thread
work on the interaction path is appending the descriptor to the log and folding
the synchronous projection, and both must stay O(1)-cheap (product-vision Design
principles).

The architecture review added load-bearing requirements to this decision:
- R1: the drain's `postMessage` serialization is itself main-thread work
  (structured clone), so it must be chunked with a yield between chunks, or an
  idle drain that fires just before an interaction reintroduces the jank the
  design removes.
- R2: egress cannot be fully owned by the worker. The end-of-session flush must
  be triggered from the main thread, because `visibilitychange` to `hidden` and
  `pagehide` fire only there and the worker is torn down with the page. So a
  cycle's results have to reach a place that can send them reliably at unload.
- R2: the 64 KiB keepalive body limit is an aggregate budget across all
  in-flight keepalive requests, not per-request, so emission must bound the
  concurrent in-flight total, not just per-cycle size.
- T3: the capture ring-buffer overflow policy under sustained no-idle pressure
  is undefined.

## Decision Options Considered

This ADR bundles the descriptor shape with cycle semantics because OQ2 defines
them together. The load-bearing sub-decision is where egress is dispatched, so
the options below center on that; the descriptor shape and backpressure are
specified in the Recommended Decision.

### Option A: Worker maps and dispatches; main thread has no egress role
- **Pros:** Matches the architecture Tech stack as written ("egress via fetch
  keepalive from the worker"); zero main-thread egress work.
- **Cons:** Refuted by R2. The worker cannot send the last beacon (it never sees
  unload and is torn down with the page), so the most important beacon of a
  session is dropped. Not viable as the sole model.

### Option B: Worker dispatches the normal path; main thread flushes un-acked payloads on unload
- **Pros:** Keeps worker-side dispatch for the common case; adds a main-thread
  backstop only for the last beacon.
- **Cons:** Two senders means a dedup/ack protocol (the main thread must not
  re-send what the worker already sent), which is extra state and a race surface.
  The aggregate keepalive budget is now split across two contexts.

### Option C: Worker maps only; the orchestrator (main thread) dispatches all egress through the egress seam, after the seal
- **Pros:** One sender, no dedup. The unload flush is the same code path as the
  normal send, just triggered on `visibilitychange` to `hidden`. Most faithful to
  capability-mediated egress (AD-5): the connector never touches the network, it
  hands the orchestrator a mapped egress request that the seal (consent plus
  host-owned allowlist) gates before dispatch, and consent state already lives on
  the main thread. INP cost is negligible because the expensive work (mapping)
  stays in the worker and a `fetch` dispatch is cheap and non-blocking.
- **Cons:** Revises the Tech stack's "egress from the worker" phrasing. All
  egress dispatch sits on the document's keepalive budget.

## Recommended Decision

Option C, with the descriptor and cycle semantics below.

**Event descriptor (interaction path, O(1)).** A minimal, structured-clone-cheap
record: a monotonic sequence number (total ordering across cycles), an event
type, a high-resolution timestamp (`performance.now()`), a payload reference
(inline if small, else an index into a side table), and a marker for which
projection snapshot slice accompanies it (see
[ADR-0003](./adr-0003-projection-snapshot-privacy.md)). The `push` appends the
descriptor to the log and folds the projection synchronously, then enqueues into
the ring buffer. No mapping on the hot path.

**Cycle semantics.** The drain runs on idle (the `aem-cwv-helper` `runWhenIdle`
and `yieldToMain` primitives). It pulls a batch, serializes it in chunks with a
yield between chunks (R1), and `postMessage`s to the worker. Sequence numbers
preserve total order; the worker processes in sequence order. Batching has a
max-batch-size cap and a max-latency cap so events do not sit unsent.

**Egress return path.** The worker maps each event into an egress request
(endpoint plus payload) and returns ready-to-send requests to the orchestrator.
The orchestrator applies the seal (consent plus host-owned allowlist), then
dispatches via the egress seam (MVP driver: direct `fetch` keepalive) on the
main thread. On `visibilitychange` to `hidden`, the orchestrator flushes any
un-dispatched requests. Emission is sequential and bounds the concurrent
in-flight keepalive total under the 64 KiB aggregate budget (R2); a request that
fails is recorded as sent-unknown (the failure is a `TypeError` indistinguishable
from a network error), which feeds the inspector (OQ7).

**Capture ring-buffer overflow.** Capture never blocks (INP), so on sustained
no-idle pressure the bounded ring buffer overwrites the oldest unsent descriptor
(drop-oldest) and increments a dropped-count that the inspector can surface.
Drop-oldest keeps the buffer representing recent activity; a priority carve-out
for ordering-critical events (pageview, consent, exposure) is deferred (see Open
questions).

## Consequences

**Becomes easier:**
- The last beacon of a session is handled by the same reliable path as every
  other send.
- The seal is enforced in one place (the orchestrator), where consent authority
  and unload both live.
- Backpressure is simple: capture buffers, the drain paces on idle, egress paces
  under the aggregate budget.

**Becomes harder:**
- The Tech stack section must be updated: egress dispatch is orchestrator-side,
  not worker-side (mapping stays worker-side).
- The worker-to-orchestrator return channel and the seal step add a hop that must
  stay off the interaction path (it runs on idle and at unload, not on the hot
  path).

## Assumptions

- `fetch` dispatch on the main thread is cheap and non-blocking; the expensive
  work is payload construction, which stays in the worker. [Web platform
  behavior; the body is prebuilt by the worker.]
- Unload-detection events fire on the main thread only and a dedicated worker is
  torn down with its document, so a reliable last-beacon flush must be
  main-thread-triggered. [Verified; see
  [R-001](../research/R-001-worker-egress-unload.md) and
  [architecture review](../reviews/2026-08-25-mvp1-architecture-review.md)
  Verification A.]
- The 64 KiB keepalive limit is aggregate across in-flight keepalive requests,
  and Chrome adds count caps (255 total, 9 per renderer). [Verified against the
  Fetch Standard; see [R-001](../research/R-001-worker-egress-unload.md).]

## Kill criteria

- Profiling shows the orchestrator-side dispatch or the worker-return hop
  measurably raises INP. Revisit toward Option B (worker dispatches the normal
  path, main thread backstops unload).
- The drop-oldest overflow policy is shown to lose ordering-critical events in
  practice. Add the priority carve-out.

## Open questions

- Whether the egress model (Option C) is significant enough to extract into its
  own ADR. It is recorded here because cycle semantics determine where a batch's
  results go.
- Priority tiering for the capture buffer (protect pageview/consent/exposure from
  drop-oldest).
- Whether the projection snapshot is per-event or per-cycle. Ties to
  [ADR-0003](./adr-0003-projection-snapshot-privacy.md).
- Exact caps (max batch size, max latency, ring-buffer capacity). To be set with
  the spike's absolute budgets (review G5).
