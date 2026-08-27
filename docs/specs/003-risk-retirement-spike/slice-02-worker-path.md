---
status: DONE
kind: spike
dependencies: [003-01, adr-0001, adr-0002, adr-0003]
last_verified: 2026-08-26
---

## Slice 003-02 — the airlock worker path

**Goal:** The same GA4 event flows through the airlock runtime — `push()` →
append-only log + synchronous projection fold → capture ring buffer → drain on
idle → batched `postMessage` cycle → Web Worker chamber → GA4 connector → MP
payload → keepalive egress — measured on the 003-01 rig.

**DoR:**
- ✅ 003-01 done (the rig + baseline + the map-to-MP helper to reuse).

**Acceptance Criteria:**

1. **Capture is O(1).** `push(event)` appends a minimal descriptor to the event
   log, folds the synchronous projection, and enqueues to the ring buffer — no
   mapping on the interaction path (ADR-0002). A synchronous `getState()` read
   after a push reflects that push (AD-3).
2. **Drain/cycle off the hot path.** A drain runs on idle, serializes a batch in
   chunks with a yield between chunks, and `postMessage`s it to a Web Worker.
   Ordering is preserved by sequence number.
3. **Worker chamber + connector.** In the worker, a GA4 connector maps each event
   to an MP payload that validates against the pinned schema, and egress leaves
   as `fetch` keepalive. The connector has no `document` (touching it throws — a
   seed of `isolation_invariant`).
4. **Per-stage delivery-rate.** The rig records how many pushed events reach (a)
   the worker (post-drain) and (b) egress, so the delivery-rate can be attributed
   to the drain stage vs egress (OQ10).
5. **Worker number recorded.** Running the 003-01 rig against the worker path
   yields an INP p75 + a delivered-beacon count, captured in Findings.

**DoD:**
- [x] ACs 1–5 verified end-to-end on the rig (worker INP p75 8ms, 300/300
      delivery, MP-conformant payload — spec Findings). The GA4 connector mapping
      is unit-tested (`test/ga4-map.test.js`, 5/5).
- [ ] **Deferred to graduation (spike-light):** dedicated vitest units for the
      log/projection fold, the ring buffer, and the chunked drain — exercised in
      the rig/worker harness, not yet as isolated units. See Deviation log.
- [ ] **Deferred to graduation (spike-light):** the `isolation_invariant` unit
      test (connector throws on `document`) — the chamber enforces no-DOM
      structurally, but the asserting unit test lands with the product review gate.
- [x] Spike-light review (as 003-01); deviation log + reconciliation sweep (below).

**Anti-horizontal-phasing check:** after this slice, the same GA4 event flows
end-to-end **off the main thread** on the real EDS page, emitting an
MP-conformant payload, and you can read the worker's INP p75 and delivery-rate —
the other half of the head-to-head.

### Deviation log

- Closed **spike-light**: the worker path is proven by end-to-end rig measurement
  (INP p75 8ms, per-stage delivery-rate, MP-conformant egress), and the GA4 map is
  unit-tested (5/5). The enumerated per-component vitest units (fold, ring buffer,
  chunked drain) and the `isolation_invariant` asserting test were **deliberately
  deferred** to graduation per the spec Outcome lifecycle note — they are the
  product-grade coverage the runtime earns when it stops being a spike, tracked as
  the two unchecked boxes above rather than silently dropped.
- OQ10 surfaced here: worker-only egress delivered 155/300 under early teardown
  (R-001), which drove the 003-03 Option-C backstop. Recorded in Findings + OQ10.

### Reconciliation sweep

- Spec Findings carry the worker number, the per-stage delivery-rate, and the
  teardown-loss finding; OQ10 updated with the measured risk.
- Runtime seed (`core/airlock.js`, `core/chamber.worker.js`,
  `connectors/ga4/map.js`) is the honest seed of the product runtime, not throwaway
  — noted for the graduation spec.
- No contract/ADR change: consumes pinned contracts + accepted ADR-0001/0002/0003;
  the ADR-0002 egress section remains deliberately open (OQ10 → 003-03 + egress ADR).
