---
status: Proposed
dependencies: []
last_verified:
frame_review: true
---

# ADR-0003: Projection snapshot read boundary

## Status

Proposed (2026-08-25)

## Context

A connector reads across two channels, and the security thesis holds only if both
are governed. The two are:

1. The **event payload** it maps. Per
   [ADR-0002](./adr-0002-event-descriptor-cycle-semantics.md) the descriptor
   carries a payload (inline or by side-table reference), and the connector
   dereferences it as its core job. This set is open and site-defined — UC-2 is
   "analytics with a *custom event*", the `push()` compat surface is an open
   object, and OQ3 leaves the event schema emergent — and it is where raw
   form-field values and datalayer PII live (the Magecart / formjacking surface).
   This is the **primary** channel.
2. The **projection snapshot slice** — the subset of projection state that
   crosses per event/cycle for enrichment (architecture Data model, OQ4). This is
   the **secondary** channel.

The two channels are not different in *shape*: the projection is a synchronous
fold of the same open, site-defined event log (OQ3 emergent schema, `push()` open
object), so it carries the same form-field / PII risk as the payload. They differ
in what a connector *needs* from them, and that is what makes one governable now
and the other not.

**This ADR decides the snapshot channel, for the narrow-need case MVP1 actually
has.** GA4 reads a small, nameable set of projection fields (`session_id`,
`page_path`, `consent_state`), so a default-deny field-allowlist bounds it *by
host policy*. The snapshot is not intrinsically bounded; the allowlist is what
bounds it. The event-payload channel needs a *different* model (you cannot
field-allowlist an open, site-defined payload: a connector forwarding arbitrary
developer params declares a wildcard, which collapses to default-allow), deferred
to [refinement-todo OQ11](../refinement-todo.md) — a host-owned sensitive-field
denylist coupled to the OQ3 schema decision, settled with the connector contract
at step 5. Until OQ11 lands the payload channel is ungoverned and the security
thesis is **not** claimable for it; stated here so it does not silently drift.

**Grounding limit (honest).** The allowlist bounds the snapshot only for a
*narrow-need* connector. A broad-need connector — a CDP like Alloy/Target, which
legitimately enriches from wide profile/context state (R-004 shows Alloy's XDM
interact payload already carries broad context + identity) — would declare a
broad-or-wildcard snapshot need, at which point the snapshot allowlist collapses
to default-allow by the same argument that disqualifies the payload, and the
`isolation_invariant` goes vacuous. R-004 grounded only host→connector context
*injection* (`context:[]` + host XDM), never a broad connector *read* need from
the projection, so the narrow-need premise is **unprobed for the CDP case**; it is
a kill criterion below, resolved together with OQ11.

Review G2: for a capability-security system the value of the snapshot control is
its default *direction*, which should be a stated principle. The sibling send-side
control, the endpoint allowlist, follows the same host-owned principle, pinned in
the capability contract (step 5).

## Decision Options Considered

For the projection snapshot channel:

### Option A: Default-allow (whole projection crosses, minus a denylist)
- **Pros:** Zero friction for connectors.
- **Cons:** Any PII that lands in the projection is exposed to every connector by
  default — the wrong default for a capability-security system, and a later
  tightening is a breaking change.

### Option B: Default-deny (empty snapshot; connector declares needs; host validates)
- **Pros:** Least privilege by construction. A connector reads only the fields it
  declared and the host approved; the invariant is oracle-checkable.
- **Cons:** Requires a declaration mechanism in the connector manifest and a
  host-owned field policy.

### Option C: No per-event snapshot at all (descriptor plus payload only)
- **Pros:** Simplest.
- **Cons:** Too restrictive; pushes session/context state into every event payload,
  which is worse.

## Recommended Decision

Option B (default-deny with connector declaration and host validation) for the
**projection snapshot channel**.

The connector manifest declares the projection fields it reads (for example
`session_id`, `page_path`, `consent_state`). The orchestrator holds a host-owned
policy naming which projection fields any connector may request and which are
never crossable. Per event/cycle it crosses only the intersection of
connector-declared needs, host-policy allow, and present projection state. The
default is empty.

For MVP1 (GA4, first-party) this is lightweight. Establishing default-deny and the
declaration mechanism for the snapshot now is what lets a future connector's
snapshot access be contained without a breaking retrofit.

**The event-payload channel is explicitly out of scope (OQ11).** Its governance is
a denylist, not an allowlist, and couples to OQ3; deciding it here on MVP1
(first-party GA4, no compromised-connector threat) evidence would repeat the
over-reach a frame-critique flagged. It is pinned with the connector contract at
step 5.

## Consequences

**Becomes easier:**
- Least privilege on the snapshot channel is structural; a compromised connector
  reads only its declared, approved projection fields.
- The snapshot isolation invariant is oracle-checkable (`isolation_invariant`:
  an undeclared *projection* read is denied). The payload-channel oracle is
  deferred to OQ11.

**Becomes harder:**
- Connectors declare snapshot read needs (a manifest field); the host maintains a
  projection field policy.
- The read boundary is complete for the snapshot channel only; the primary
  (payload) channel stays open until OQ11.

## Assumptions

- The projection is held in the orchestrator (main thread) and the snapshot
  crosses via structured-clone `postMessage` per cycle. [architecture Data model.]
- At MVP2 a connector wraps vendor code (alloy), making a compromised connector a
  real supply-chain threat the read boundary must contain across *both* channels;
  this ADR closes only the snapshot half. [See
  [R-004](../research/R-004-alloy-in-worker.md) and review Verification D.]
- Snapshot confidentiality across chambers depends on ADR-0001's per-connector
  isolation upgrade (a shared-worker chamber can read a sibling's snapshot from
  shared memory); that upgrade must land with the first wrapped-SDK connector.
- The snapshot is governable by field-allowlist only for narrow-need connectors
  (GA4). A broad-need connector (a CDP) is unprobed for its projection read need —
  R-004 grounded context *injection*, not broad *reads*. [Flagged as an
  assumption; resolved with OQ11 before the step-5 contract.]

## Kill criteria

- Field-level snapshot declaration proves too coarse or too fine. Revisit the
  granularity (namespace or typed-scope).
- MVP1 is tempted to ship snapshot default-allow to move fast. That is the
  decision this ADR exists to prevent; if taken, the snapshot security thesis is
  unproven and must not be claimed.
- A connector needs broad projection access (the CDP / Alloy case), so its
  declared snapshot scope approaches a wildcard and the allowlist collapses to
  default-allow. That is the signal the snapshot channel needs the same
  policy-model rework as the payload — resolve it together with OQ11 before the
  step-5 contract, rather than freezing the snapshot allowlist around GA4's narrow
  needs and forcing a breaking retrofit when the CDP lands.

## Open questions

- **OQ11 (refinement-todo):** event-payload read-boundary governance (a denylist
  model for the open payload; coupling to the OQ3 schema decision). Deferred to
  the connector contract, step 5.
- Snapshot declaration granularity (field / namespace / typed-scope).
- How the host policy is expressed and where it lives.
- Whether the snapshot is per-event or per-cycle. Ties to
  [ADR-0002](./adr-0002-event-descriptor-cycle-semantics.md).
