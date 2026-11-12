---
status: Proposed
dependencies: [051-03, adr-0016, adr-0017, adr-0039]
last_verified:
frame_review: true
---

# ADR-0060: Governed Adobe SDK command and result bridge

## Status

Proposed (2026-11-02)

Filed as a design question. The interface and recommendation are not accepted.
The number is provisional in this worktree; recheck/reserve it before landing.

## Context

The production Adobe bridge needs a declared command and result contract.

The [current architecture](../architecture.md#fixed-adobe-journey-probe-051-09-source-reviewed-not-live-qualified)
describes a fixed probe, not the general software development kit (SDK) bridge.
[051-03](../specs/051-adobe-integration-proving-ground/slice-03-compatibility-investigation.md)
and [R-014](../research/R-014-adobe-first-compatibility.md#offline-source-roster-preparation--2026-10-14-utc)
must establish the pinned public commands, callback/page-state behavior and
actual stock/chamber evidence before the broader build in 052-055.
The official SDK remains unmodified and ADR-0017's frozen surface remains protected.

## Decision Options Considered

### Option A: Declared commands/results with explicit host-side adapters
- **Pros:** Makes each permitted crossing and capability reviewable.
- **Cons:** Callback functions and page-dependent behavior need deliberate
  representations; faithful coverage is not yet demonstrated.

### Option B: A transparent generic page/SDK proxy
- **Pros:** Could resemble the stock call surface.
- **Cons:** Risks broad page authority and hidden synchronous/callback assumptions.
  Any unrestricted DOM/global/network fallback is excluded by current constraints.

### Option C: Retain the currently bounded adapter only
- **Pros:** Limits implementation scope.
- **Cons:** Does not meet the full pinned-SDK target. A narrower release promise
  would need a separate explicit owner decision, not an unsupported-command fallback.

## Recommended Decision

Investigate A through 051-03, then return an exact command/options/result/event
contract and explicit host-owned behavior for review. Do not select transport
envelopes, callback identifiers or new public APIs in this filing task.
The actual inventory may require splitting or reshaping this recommendation.

Acceptance requires evidence for ordering, rejection, clone-safe values,
callback/page-state dependence, one SDK instance, disposal and each required
capability. Every inventory row needs a named implementation owner or an
explicit unresolved decision. Preserve tenant, endpoint, consent, cookie,
payload and safe-render controls. Neither an unclassified row nor a stub
success qualifies as compatibility.

## Consequences

**Becomes easier:**
- Event collection, personalization and migration can share one governed contract.

**Becomes harder:**
- Supporting more SDK behavior requires evidence for each crossing rather than
  generic remote procedure calls (RPC).

## Assumptions

- The assigned public behavior can be represented safely across the worker boundary.
- The necessary production integration can preserve the frozen public contract.
  Both assumptions remain subject to the 051-03 result.

## Kill criteria

- A required behavior needs unrestricted page access, an SDK fork or silently changed semantics.
- The proposed interface cannot preserve caller results/errors or enforce existing controls.

## Open questions

- Which pinned public options, events and callbacks need mediation?
- Which host observations must complete before an SDK operation settles?
- How do configuration, instance identity, disposal and late completions interact?
- Is an additive experimental interface sufficient, or is another owner decision necessary?
