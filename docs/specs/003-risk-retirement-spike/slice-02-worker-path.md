---
status: DRAFT
dependencies: [003-01, adr-0001, adr-0002, adr-0003]
last_verified:
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
- [ ] ACs 1–5 pass; unit tests cover the log/projection fold, the ring buffer,
      the chunked drain, and the GA4 connector mapping (in worker + as a pure fn).
- [ ] `isolation_invariant` seed: a test that the connector throws on `document`.
- [ ] Each new test shown capable of failing.
- [ ] Spike-light review (as 003-01); deviation log + reconciliation sweep.

**Anti-horizontal-phasing check:** after this slice, the same GA4 event flows
end-to-end **off the main thread** on the real EDS page, emitting an
MP-conformant payload, and you can read the worker's INP p75 and delivery-rate —
the other half of the head-to-head.
