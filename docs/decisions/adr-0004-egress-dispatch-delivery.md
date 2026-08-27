---
status: Accepted
dependencies: [adr-0002, adr-0003]
last_verified: 2026-08-26
frame_review: true
---

# ADR-0004: Egress dispatch and delivery model

## Status

Accepted (2026-08-26)

## Context

[ADR-0002](./adr-0002-event-descriptor-cycle-semantics.md) fixed the event
descriptor, the append-only log, and the cycle that carries batches *to* the
worker — and deliberately stopped at the worker boundary, deferring the entire
**egress** model (dispatch location, delivery under interaction-storm load, the
aggregate keepalive budget, and the unload / last-beacon path) to
[OQ10](../refinement-todo.md). Three rounds of adversarial review had shown that
coupled decision could not be settled by argument; it had to be measured. The
[risk-retirement spike (spec 003)](../specs/003-risk-retirement-spike/spec.md)
measured it. This ADR records the resulting decision.

The measured forces:

- **INP vs. dispatch location.** Mapping is the expensive per-tracker work; it must
  stay off the interaction path. Worker-side *mapping* keeps INP at p75 8ms even at
  the realistic 5-tracker × ~30ms load. Where the mapped request is *dispatched*
  (worker vs. main thread) does not touch INP — a prebuilt keepalive body is cheap
  to send anywhere.
- **Delivery under teardown.** A worker-only keepalive egress delivered **155/300**
  beacons when the page closed before the worker drained its backlog, vs. 300/300
  with a normal settle (spec 003 / [R-001](../research/R-001-worker-egress-unload.md)).
  The worker's pending egress is lost when the worker is torn down with the page.
- **The unload-generated last beacon.** The canonical last beacon — an outbound
  click or a closing `page_view` generated *inside* the unload window — cannot
  complete an async worker round-trip (drain → `postMessage` → map → `postMessage`
  → dispatch) before the page is gone. It is therefore absent from the un-sent
  requests any unload flush dispatches, no matter where dispatch happens.

## Decision Options Considered

The load-bearing choice is **where mapped events are dispatched**, and **how the
unload window is served**.

### Option A: Worker maps, orchestrator dispatches on the main thread ("Option C")
- **Pros:** Mapping stays off-thread (INP-safe by construction); dispatch of a
  prebuilt keepalive body on the main thread is cheap and is where the
  `visibilitychange`→hidden flush is most reliable. Measured: INP p75 8ms, 300/300
  under normal settle.
- **Cons:** The steady-state normal path still can't serve a beacon *generated*
  during unload (no time for the round-trip) — needs a companion fast path.

### Option B: Worker maps and dispatches (eager, worker-side)
- **Pros:** No idle-gating stall; the worker sends as soon as it has mapped.
- **Cons:** In-flight/queued egress is lost when the worker is torn down with the
  page (the 155/300 result); needs a two-sender dedup + a consent snapshot pushed
  into the worker; and it *still* cannot map the unload-generated beacon (same
  round-trip problem). Trades a solved problem for two unsolved ones.

### Option C-rejected: All events dispatched synchronously on the main thread
- **Cons:** Re-introduces synchronous mapping on the interaction path — exactly the
  INP regression the architecture exists to prevent (the naive 152ms case).
  Rejected outright.

## Recommended Decision

**A two-path egress model: Option A ("Option C") for the steady state, plus a
main-thread synchronous fast path for the unload window.**

**1. Normal path — worker maps, orchestrator dispatches (Option C).** The worker
maps each event to its MP payload off-thread and returns the ready requests; the
orchestrator dispatches them on the main thread via `fetch(url, { keepalive:
true })`. This is what keeps INP at 8ms while delivering 300/300 under a normal
settle. Unchanged from the spike (`core/airlock.js`, `core/chamber.worker.js`).

**2. Unload path — main-thread synchronous fast path.** For events that cannot
afford a worker round-trip, map **synchronously on the main thread**, reusing the
*same pure `mapToMp`* the worker uses (so the payload is byte-identical), and issue
`fetch` keepalive immediately (`core/egress.js`). Two entry points:

- **`pushCritical(event)`** — the caller declares a beacon unload-critical (an
  outbound-link click handler, a `pagehide`/`beforeunload` handler) and it is
  mapped + sent synchronously, bypassing the worker. This is the canonical
  last-beacon path.
- **Ring-tail flush at `visibilitychange`→hidden / `pagehide`** — whatever is still
  buffered in the ring (not yet handed to the worker) is mapped + dispatched
  synchronously, declared unload-critical types first so they win the budget. This
  replaces ADR-0002's provisional "post the ring to the worker at unload" backstop,
  which could not complete before teardown.

**Why the two-sender dedup problem dissolves — and where it does not.** OQ10's
hardest sub-problem was that a worker-side sender and a main-thread sender would
need an ack/dedup protocol. For the **runtime's own routing** it dissolves by
construction: `drain()` splices a batch out of the ring *before* handing it to the
worker, and the ring-tail flush reads only what is still in the ring, so a
`push()` event is in-ring XOR handed-to-worker — never both — and a `pushCritical()`
event never touches the ring or the worker. Within one thread, each logical event
the runtime routes has exactly one sender.

What is **not** construction-guaranteed is the **cross-API caller contract**: use
`push()` XOR `pushCritical()` for a given logical event, never both. That contract
is unenforced and fails *silently* — e.g. a site running a generic click tracker
(`push`) alongside the EDS adapter's outbound-link `pushCritical` would double-send
that click (the `pushCritical` sends now; the ring's `push` copy is then re-sent by
the `visibilitychange` ring-tail flush), and removing all dedup machinery removes
the net that would catch it. The adapter's *own* wiring avoids this (it owns both
sites); a site mixing a hand-rolled tracker with the adapter does not. See
Consequences and Open questions — a cheap main-thread idempotency guard is available
because **all** dispatch (worker-path included) happens on the main thread, so it
needs no worker ack.

**3. Keepalive budget.** The fast path enforces the ~64 KiB aggregate keepalive cap
(`KEEPALIVE_BUDGET_BYTES`), dropping and counting sends past budget and sending
declared unload-critical types first, so an over-budget unload burst degrades
predictably and visibly rather than failing silently.

**Consent (the seal).** Egress on both paths remains subject to the consent /
allowlist gate (AD-5 / AD-9). Both paths gate against the orchestrator's
main-thread consent state; the fast path checks it at send time, so an unload-window
beacon honors the latest consent without a round-trip. (This is a *freshness*
advantage, not a unique cost saving — ADR-0003 already carries a `consent_state`
snapshot into the worker per cycle for the normal path's mapping.)

## Consequences

**Becomes easier:**
- The unload-generated last beacon is delivered (measured 5/5 in the teardown
  window, vs. 0/5 for the enqueued worker path); the un-drained ring tail is
  delivered synchronously (50/50). Delivery under teardown no longer silently
  drops the tail.
- INP is untouched: the fast path is taken only at unload (steady-state
  `fastDispatched` is 0; INP p75 stays 8ms). The synchronous main-thread mapping
  the architecture forbids on the interaction path is confined to the moment there
  is no interaction left to protect.
- No worker-side dedup/ack/consent-snapshot machinery — the sole-sender property
  removes the coupling that made OQ10 unsettleable by argument.

**Becomes harder:**
- The caller must *declare* unload-criticality (`pushCritical`) at the outbound
  click / `pagehide` site — a small integration burden, but an explicit and
  auditable one (and the EDS adapter can wire the common cases: outbound-link
  delegation, closing pageview).
- **Silent double-count if `push()` and `pushCritical()` both fire for one logical
  event.** The sole-sender property is construction-true only for the runtime's own
  routing; the cross-API contract is unenforced and fails silently (no exception, no
  dropped-count — just an inflated metric). A site that mixes a hand-rolled generic
  tracker with the adapter's outbound-link fast path is the realistic trigger.
  Removing worker-side dedup machinery (a benefit above) also removes the net that
  would catch this, so it must be prevented by discipline or by the idempotency
  guard parked in Open questions — not assumed away.
- A residual delivery gap remains under **extreme early close** (the page closes
  while the worker still holds a large *unmapped* backlog): those events are past
  the ring, already handed to the worker, so the ring-tail flush does not re-map
  them, and re-mapping them synchronously would reintroduce the two-sender dedup
  problem. This is a delivery/latency trade, out of scope here (see Open questions).

## Assumptions

<!-- Grounded by the spec 003 rigs; re-measured for this ADR. -->

- **Worker-side mapping keeps INP at p75 8ms; the fast path does not regress it.**
  Verified: `MODE=worker … node rig/measure.mjs` reports INP p75 8ms with
  `stats.fastDispatched: 0` in steady state (the fast path is off the interaction
  path). [probe: `rig/measure.mjs`, 2026-08-26]
- **The synchronous fast path delivers within the teardown window; the enqueued
  worker path does not.** Verified: `node rig/teardown.mjs` →
  enqueued last beacon 0/5 in-window (5/5 only after settle), `pushCritical` 5/5
  in-window, ring-tail flush 50/50 in-window. [probe: `rig/teardown.mjs`,
  2026-08-26] The rig models teardown as a *proxy* — "issued to the network within
  `TEARDOWN_MS` on a live page" — and the enqueued path's 0/5 is a function of the
  spike's synthetic load model (`WORK=30000` → worker round-trip > the 100ms
  window). This faithfully captures "worker round-trip cannot beat the unload
  window"; the complementary half — that an *already-issued* keepalive request
  survives an actual page close — is the standard browser keepalive contract, not
  separately re-measured here (kill-criterion #3 covers the case a target browser
  breaks it).
- **The fast-path payload is contract-conformant, byte-identical to the worker's.**
  Verified: it reuses the pure `mapToMp`, and its output validates against the
  pinned `contracts/ga4-mp-request.schema.json`. [probe:
  `test/egress-fastpath.test.js`, 2026-08-26]
- **ADR-0002's descriptor-reshape kill-criterion does not bite this
  implementation.** The spike's descriptor carries `params` **inline** (not by a
  worker-side side-table reference) and `ctx` is a main-thread closure value, so
  the fast path reads everything it needs main-thread-side without reopening the
  descriptor. [probe: `core/airlock.js` `push()`, 2026-08-26] If a future
  implementation moves payload to a worker-held side-table, that kill-criterion
  reopens for unload-critical types (carry their payload inline).
- **The fast path maps with the static `ctx`, not the live projection snapshot —
  invisible in the spike, load-bearing later.** ADR-0003's per-event projection
  snapshot (e.g. `consent_state`, `page_path`) is not yet threaded into the
  synchronous map; the spike's `ctx` is static, so this is currently invisible. The
  projection is held in the orchestrator on the main thread (ADR-0003), so it *is*
  reachable to the fast path — but the wiring (pass the current snapshot slice into
  `mapToMp` at `pushCritical` / ring-tail time) must land when real projection-fed
  GA4 mapping does, or an unload beacon would map against stale/absent snapshot
  state. [probe: `core/egress.js`, `core/airlock.js`, 2026-08-26]

## Kill criteria

- **Extreme-early-close delivery becomes load-bearing for correctness.** If real
  UC-2 traffic shows material loss from the in-worker unmapped backlog at teardown
  (not just the last beacon), revisit with one of: a bounded worker queue depth +
  more eager main-thread dispatch, or a pending-set/ack model (accepting its dedup
  cost). Record as a superseding ADR.
- **The ~64 KiB keepalive budget forces material drops at real session ends.** If
  the unload burst routinely exceeds budget, add per-type priority tiers or move the
  end-of-session flush behind the service-worker egress seam (a deferred no-go for
  MVP1).
- **`fetch` keepalive proves unreliable at `visibilitychange` on a target browser.**
  Fall back to `sendBeacon` for the fast path (main-thread only; it cannot carry the
  worker path, which is why keepalive was chosen — architecture.md § Tech stack).

## Open questions

- **Cross-API idempotency guard** — the `push()`-XOR-`pushCritical()` contract is
  unenforced and silently double-counts if violated (Consequences). Because *all*
  dispatch happens on the main thread (the worker only maps), a lightweight
  main-thread `Set` of recently-sent idempotency keys could dedup all three senders
  with **no worker ack** — the cheap guard the "no dedup machinery" benefit would
  otherwise forfeit. Deferred (needs a per-event id on the descriptor + fast-path
  body); land it if a real integration mixes a generic tracker with the adapter's
  fast path.
- **In-worker backlog under extreme early close** (Consequences) — the one residual
  OQ10 facet this ADR does not close; parked until measured to matter for UC-2.
- **Threading the live projection snapshot into the fast path** (Assumptions) — wire
  the current ADR-0003 snapshot slice into the synchronous map when real
  projection-fed GA4 mapping lands.
- **Where the EDS adapter wires `pushCritical`** — outbound-link click delegation
  and the closing-pageview `pagehide` hook belong in `adapters/eds/`, specced when
  UC-2 graduates to a real EDS page.
- **Priority tiering within the keepalive budget** — currently a binary
  critical-first sort; a finer tier order (pageview > exposure > custom) may be
  wanted if budget pressure is real.
