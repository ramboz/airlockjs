---
status: Proposed
dependencies: [adr-0017, adr-0033, adr-0042]
last_verified:
frame_review: true
---

# ADR-0043: Google and Meta request integrity and egress authority

The prototypes need a clear owner for request construction and dispatch.
This draft records the alternatives before more verifier code is written.
A second worker may detect changed messages, but adds state, lifecycle and
performance costs and does not by itself confine malicious code.

## Status

Proposed (2026-11-02)

Filed for tracking at the owner's request. No architecture option is selected
or accepted. The number is local/provisional until integration checks it
against trunk. Implementation remains paused.

## Context

Google and Meta need request integrity without main-thread vendor mapping.

The [Google](../../test/google-ads-prototype-request-correlation.test.js)
and [Meta](../../test/meta-prototype-request-correlation.test.js) synthetic
controls demonstrate altered mediated requests reaching mock transports in
the tested modes. Some Google options add expected-field checks on the host,
duplicating mapping outside the chamber.

The fixed Node bridges explicitly disclaim adversarial sandboxing. Comparing
messages cannot stop Node code from using capabilities outside that channel.
Native correctness, browser confinement and correspondence to a captured
command are separate guarantees.

[R-014](../research/R-014-google-meta-request-authority.md) owns the bounded
source/design investigation. [059-01](../specs/059-google-ads-full-compatibility/slice-01-owned-conversion.md)
and [060-01](../specs/060-meta-pixel-full-compatibility/slice-01-pageview-entry.md)
own the resulting product work. Unfinished verifier drafts are preserved in
the paused sessions, not adopted as the architecture.

## Decision Options Considered

### Option A: Extend host-side expected-field checks

- **Pros:** Small local change for a bounded schema.
- **Cons:** Repeats mapping on main; partial checks leave semantic gaps and do
  not satisfy the off-main-thread target.

### Option B: Independently provision a trusted verifier worker

- **Pros:** Can compare complete mediated request bytes without host mapping.
- **Cons:** Adds another stateful lifecycle, copying and latency. A shared
  mapper can reproduce the same mistake. Node code can bypass the message
  channel unless a separate confinement boundary prevents it.

### Option C: Give a trusted first-party mapper explicit request authority

- **Pros:** Makes the trusted construction path and allowed host operations clear.
- **Cons:** Requires separation from any untrusted connector code and an
  independent evaluator for native correctness.

### Option D: Use browser capability enforcement and independent evaluation

- **Pros:** Could avoid a second runtime mapper.
- **Cons:** Must establish the actual browser boundary and identify which
  semantic integrity obligations are enforced at runtime versus tested.

## Recommended Decision

Pending R-014 and owner review. No option is selected by filing this draft.

The recommendation must preserve off-thread mapping, independent live consent
and destination checks at every actual dispatch, bounded state and redacted
failure reporting. It must cover the complete command/request/result lifecycle,
including zero requests, branch ordering, mutation, stale replies, failure,
readiness, timeout and disposal.

Before acceptance, record a concrete threat model, existing mechanism reuse,
measured or explicitly proposed overhead budgets, a bounded validation plan
and any required stable-contract treatment. Independent frame review is still
required. No new test or browser execution follows from this draft.

## Consequences

**Becomes easier:**
- One tracked decision owns the prototype integrity and host-mapping concern.
- The first product slices can depend on an explicit boundary rather than a
  partially integrated verifier experiment.

**Becomes harder:**
- Implementation waits for a justified choice and its validation plan.
- Any selected design must account for startup, copying, memory and latency
  costs, as well as native correctness and browser confinement.

## Assumptions

- Unverified: a bounded design can satisfy the required browser integrity,
  isolation and performance contract without changing the frozen surface.
- Unverified: a runtime verifier provides enough additional value to justify
  its second stateful worker. R-014 must compare it with simpler alternatives.

## Kill criteria

- The chosen design moves vendor interpretation or unbounded mapping to main.
- A message-consistency check is presented as malicious-code containment or
  native equivalence without the corresponding evidence.
- The design needs an unbounded verifier or confinement project without a
  concrete first-journey consumer and finite exit.

## Open questions

- Which code and loader are trusted in the intended browser deployment?
- Which semantic relationships need runtime enforcement?
- Can existing capabilities and independent evaluation meet the requirement
  without a second mapper?
