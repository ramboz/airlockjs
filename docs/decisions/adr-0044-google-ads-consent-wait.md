---
status: Proposed
dependencies: [adr-0007, adr-0023, adr-0024, adr-0033]
last_verified:
frame_review: true
---

# ADR-0044: Google Ads consent wait, retention and replay

Google documents consent waiting, while the experimental replacement drops
blocked events without replay. We need an evidence-backed policy before
implementing that input. Retaining events could preserve collection, but
changes privacy, ordering and lifetime obligations.

## Status

Proposed (2026-11-02)

Filed for tracking at the owner's request. No wait, retention or replay policy
is selected or accepted. The number is local/provisional until integration
checks it against trunk. Implementation and live activity remain paused.

## Context

Google Ads consent waiting needs a recorded policy decision before implementation.

[Google's asynchronous consent guide](https://developers.google.com/tag-platform/security/guides/consent#async)
shows a denied default with `wait_for_update: 500`. That example does not
establish the complete queue, expiry, partial-update and repeated-update
behavior needed by the replacement.

[059-03](../specs/059-google-ads-full-compatibility/slice-03-consent-journeys.md)
already owns basic/advanced consent behavior and this open question. The
experimental Google prototype rejects the wait field and does not replay
blocked conversions. Changing that prototype behavior is a separate choice
from the stable core's existing hold/remap behavior under
[ADR-0023](adr-0023-ad-pzn-egress-hold-until-consent.md) and
[ADR-0024](adr-0024-fanout-remap-per-beacon-key.md). This draft supersedes none
of those records.

Meta consent remains owned by
[060-04](../specs/060-meta-pixel-full-compatibility/slice-04-consent-processing.md).
The Google example cannot define Meta's queue or replay semantics.

## Decision Options Considered

### Option A: Keep the experimental input unsupported pending evidence

- **Pros:** Preserves the current local safety policy without guessing timers.
- **Cons:** Leaves required Google behavior unfinished; cannot support a full
  compatibility claim.

### Option B: Implement a bounded chamber-side waiting state machine

- **Pros:** Could preserve the observed event/update semantics while keeping
  interpretation off main and actual dispatch behind the host seal.
- **Cons:** Requires evidence-backed ordering, retention, expiry, revocation,
  memory bounds and callback handling, plus an explicit privacy decision.

### Option C: Reuse the existing hold/remap machinery where it fits

- **Pros:** Could avoid duplicating a retention mechanism.
- **Cons:** Existing hold/remap is not proof of fit for Google wait semantics.
  Any main-thread remapping, timing mismatch or stable-contract impact must be
  identified rather than inherited silently.

## Recommended Decision

Pending controlled native evidence and owner policy review. Preserve current
behavior until a recommendation is accepted; do not guess a 500 ms timer,
silently allow replay or weaken the live seal.

The decision package must distinguish basic and advanced modes, pending from
denied, independent consent purposes, before/at/after-expiry updates and
repeated grants/revokes. It must identify what is retained, for how long, which
inputs are used after grant, and what happens on timeout, navigation or failure.

Any later evidence collection has its own finite approval and safe execution
plan. The first-journey research in R-013 may identify required inputs, but
does not authorize this later consent matrix. This decision need not block an
earlier case that does not use consent waiting.

## Consequences

**Becomes easier:**
- One tracked record owns the known consent-wait policy question.
- Compatibility gaps and privacy choices remain visible before implementation.

**Becomes harder:**
- Complete consent support needs qualified behavior and explicit retention limits.
- Native collection and Airlock policy may conflict; any demonstrated conflict
  needs an owner decision, not an automatic collection-loss waiver.

## Assumptions

- Unverified: qualified native observations can discriminate the required queue
  and expiry behavior under permitted test resources.
- Unverified: that behavior can coexist with the required policy and frozen
  boundary. The documented example alone does not demonstrate a contradiction.

## Kill criteria

- Retained data is released contrary to the current host policy.
- A policy is inferred from one documented timing example or a different vendor.
- Unsupported behavior is hidden, or a stable-core consent rule changes without
  the required decision and compatibility review.

## Open questions

- What exactly happens to captured events at wait expiry and each update ordering?
- Which retention and privacy policy is acceptable to the owner?
- Which existing mechanism can implement the observed behavior without
  main-thread mapping or stale consent release?
