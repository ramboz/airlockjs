---
status: Proposed
dependencies: []
last_verified:
frame_review: true
---

# ADR-0003: Projection snapshot privacy boundary

## Status

Proposed (2026-08-25)

## Context

Per event, a bounded, privacy-filtered slice of projection state crosses the
airlock to the worker so a connector can enrich its payload (the "projection
snapshot slice", architecture Data model). This slice defines exactly what a
connector can read, and therefore what a compromised connector could exfiltrate
to its allowlisted endpoint. At MVP2 a connector wraps vendor code (alloy), so a
compromised connector is a real supply-chain threat, not a hypothetical. OQ4 is
an MVP1 blocker because it is part of the boundary contract.

The architecture review (finding G2) made the sharp point: for a
capability-security system, the value of this control is its default direction,
and that direction should be a stated principle, not left to open-question
resolution. The same principle governs the sibling control, the seal's endpoint
allowlist (what a connector may send, and to where), which is pinned in the
capability contract at drive-order step 5.

## Decision Options Considered

### Option A: Default-allow (whole projection crosses, minus a denylist)
- **Pros:** Zero friction for connectors; they read whatever they need.
- **Cons:** Any PII that lands in the projection is exposed to every connector by
  default. This is the wrong default for a capability-security system, and a
  later tightening is a breaking change to every connector.

### Option B: Default-deny (empty snapshot; connector declares needs; host validates)
- **Pros:** Least privilege by construction. A connector reads only the fields it
  declared and the host approved. The security thesis becomes demonstrable and
  checkable (a connector requesting an undeclared field is denied, which an
  isolation oracle can assert).
- **Cons:** Requires a declaration mechanism in the connector manifest and a
  host-owned field policy. More upfront contract design; a connector cannot
  opportunistically read new state without a manifest update.

### Option C: No per-event snapshot at all (descriptor plus payload only)
- **Pros:** Simplest and safest; nothing contextual crosses.
- **Cons:** Too restrictive. Many connectors need session or context state
  (session id, page path, consent state) to build a correct payload, so this
  pushes that state into every event payload instead, which is worse.

## Recommended Decision

Option B, default-deny with connector declaration and host validation.

Concretely: the connector manifest declares the projection fields it reads (for
example `session_id`, `page_path`, `consent_state`). The orchestrator holds a
host-owned policy naming which fields any connector may request and which are
never crossable (raw form input, PII fields). Per event, the orchestrator
assembles the snapshot from the intersection of connector-declared needs,
host-policy allow, and present projection state, and crosses only that. The
default is empty.

For MVP1 (GA4, first-party) this is lightweight, because GA4 declares a small
known set. Establishing default-deny and the declaration mechanism now is
precisely what lets the MVP2 vendor connector be contained without a breaking
retrofit.

The sibling send-side control, the endpoint allowlist, follows the same
principle and must be host-owned and immutable from the connector side. It is
pinned in the capability contract (step 5), and this ADR records the shared
principle so the two controls do not drift.

## Consequences

**Becomes easier:**
- Least privilege is structural; a compromised connector reads only its declared,
  approved fields.
- The isolation/privacy invariant is checkable by an oracle (the
  `isolation_invariant` component can be extended: an undeclared read is denied).

**Becomes harder:**
- Connectors must declare read needs (a manifest field), and the host must
  maintain a field policy.
- Enrichment is gated on declaration; adding a read means updating the manifest.

## Assumptions

- The projection is held in the orchestrator (main thread) and the snapshot
  crosses via structured-clone `postMessage` per cycle. [architecture Data
  model.]
- At MVP2 a connector wraps vendor code (alloy), making a compromised connector a
  real supply-chain threat the read boundary must contain. [Verified; see
  [R-004](../research/R-004-alloy-in-worker.md) and
  [architecture review](../reviews/2026-08-25-mvp1-architecture-review.md)
  Verification D.]
- Default-deny requires a declaration mechanism that becomes part of the
  connector interface contract (step 5).

## Kill criteria

- Field-level declaration proves too coarse or too fine for real connectors.
  Revisit the granularity (namespace or typed-scope instead of field).
- MVP1 is tempted to ship default-allow to move fast. That is the decision this
  ADR exists to prevent, because the retrofit is a breaking change to every
  connector manifest; if it is taken anyway, the security thesis is unproven and
  must not be claimed.

## Open questions

- Granularity of declaration: field-level, namespace-level, or typed-scope. Feeds
  the connector interface contract (step 5).
- How the host policy is expressed and where it lives (config file versus code).
- Whether the snapshot is per-event or per-cycle (a cycle batches events). Ties
  to [ADR-0002](./adr-0002-event-descriptor-cycle-semantics.md).
