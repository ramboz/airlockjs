---
status: Proposed
dependencies: [adr-0017, adr-0039, adr-0045]
last_verified:
frame_review: true
---

# ADR-0059: Execution policy for the remaining Adobe baseline

## Status

Proposed (2026-11-02)

Filed for later decision, not approval of any option or live operation.
The number is provisional in this worktree; recheck/reserve it before landing.
No accepted ADR is superseded by this draft.

## Context

The remaining stock baseline needs an execution policy separate from the one proving pair.

[051-02](../specs/051-adobe-integration-proving-ground/slice-02-test-baseline.md)
still owns the retained active cases and performance pairs.
[ADR-0045](adr-0045-owner-supervised-proving-run.md) permits a distinct
owner-supervised pair only; it does not extend to that campaign.
[Bug002](../bugs/005-active-runner-lifetime.md) and
[Bug003](../bugs/003-managed-browser-descendant-closure.md) remain open.
The [delivery reset](../releases/adobe-delivery-reset.md) requires small,
separately assigned sessions without silently rebuilding an execution platform.

## Decision Options Considered

### Option A: Complete the existing unattended qualification
- **Pros:** Retains the original campaign's execution model.
- **Cons:** Requires unresolved custody/closure work; no bounded completion is established.

### Option B: Propose explicitly bounded supervised baseline assignments
- **Pros:** Could reuse the attended procedure and expose small evidence checkpoints.
- **Cons:** Needs a new exact contract, owner availability and reviewed accounting;
  an admitted run cannot simply be split, relabeled or restarted.

### Option C: Park the remaining campaign and dependent build
- **Pros:** Avoids another infrastructure project when neither safe route is feasible.
- **Cons:** Leaves the baseline and dependent compatibility decision incomplete.

## Recommended Decision

Decide after 051-09's actual outcome and a bounded comparison of A and B.
Prefer B only if the existing attended mechanism can preserve all required
case predicates, accounting and independent stop without a new platform.
Otherwise return C to the owner rather than treating A as an automatic task.
This is a conditional recommendation, not an accepted execution exception.

Before acceptance, name exact case membership, source and ownership boundaries,
cleanup/loss behavior, costs, permissible fresh windows and which clauses of
the existing campaign contract would change. Preserve all original bytes,
reservations and UNKNOWNs. No replay, refund, automatic retry or broader
resource authority follows. Product acceptance and the frozen core remain unchanged.

## Consequences

**Becomes easier:**
- The operator can choose one supported route before funding more tooling.

**Becomes harder:**
- Small supervised jobs need genuine attendance and a precise retained-state handoff.

## Assumptions

- Supervision could support the remaining baseline without weakening its
  evidence. The one-pair exception does not establish that.

## Kill criteria

- The proposed route needs a new general runner, fabricated closure or changed product criteria.
- Ownership, relevant unsettled writes, stop access or cumulative affordability cannot be established.

## Open questions

- Which remaining cases can be assigned independently without altering their meaning?
- How would the original retained accounting and failure-owned state be handled?
- Which existing ADR clauses require a narrowly scoped replacement?
- What exact budget and attendance can the owner provide?
