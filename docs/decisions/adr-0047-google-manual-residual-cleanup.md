---
status: Proposed
dependencies: [adr-0045]
last_verified:
frame_review: true
---

# ADR-0047: Google Chrome residual helpers and manual cleanup

Continue the bounded Google reference with installed Chrome and a fresh
disposable profile. The owner accepts possible leftover Chrome helpers and
manual cleanup. Their exit remains unknown; network stop, finite authority
and complete reference evidence still need independent proof.

## Status

Proposed (2026-11-05)

## Context

The owner accepts residual Chrome helpers for the bounded Google reference.

On 2026-11-05 the Google capture controller relayed this new direct owner
instruction verbatim:

> no isolated runner. you can continue using my Chrome, and ignore the lose helpers. worst case I kill them myself

This differs from the earlier design-only answer that the coordinator gave
on the user's behalf. It rejects provisioning an isolated runner and accepts
the residual process-cleanup risk. It does not approve the user's everyday
profile, extra traffic or invented completion evidence.

[ADR-0045](adr-0045-inspected-google-reference.md) remains the Accepted
inspected-reference decision. This new decision changes only the Google
complete-descendant-cleanup prerequisite for that bounded reference.
It leaves the Accepted record and the original full-slice criteria intact.
It is not a production or Meta exception.

The current helper checks one owned root's exit and retains the guard if
that exit is unavailable
(`rig/inspected-google-qualification.mjs:39-76`). It cannot attest that every
descendant exited. The network wrapper restricts the browser to the case's
loopback broker port (`rig/inspected-google-loopback-chrome:19-31`).
The shared relay rechecks the Google admission flag after asynchronous peer
authentication and upstream setup and before forwarding bytes
(`rig/inspected-transport.mjs:256-331`).
`closeAdmission` currently changes only that flag; `close` destroys sockets,
closes listeners and awaits tracked tasks (`:382-408`). These source facts
are not current-browser stop or residual-helper qualification.

## Decision Options Considered

### Option A: Require complete descendant custody in a new runner
- **Pros:** Could establish complete process cleanup after a separately
  reviewed environment and implementation.
- **Cons:** The owner explicitly declined an isolated runner. The proposed
  Linux design is not selected or provisioned.

### Option B: Treat root exit or manual cleanup as complete cleanup
- **Pros:** Would remove the existing predicate cheaply.
- **Cons:** Produces false evidence. It does not establish either helper
  exit or independent network stop. Rejected.

### Option C: Accept explicit residual helpers, preserve independent stop
- **Pros:** Follows the owner's choice without requiring a new execution
  environment or claiming unobserved helper exit.
- **Cons:** Requires qualified network-stop and guard-release behavior even
  when helpers may remain, plus a private manual-recovery disposition.

## Recommended Decision

Select C within the original Google reference scope, conditional on its
unchanged safety and admission gates.

1. Use only the installed Chrome binary with a new case-owned disposable
   profile. Never attach to the user's everyday browser, use its profile or
   cookies, or select/provision a Linux host, VM or isolated runner. Do not
   adopt or expand the separate Meta supervisor programme.
2. Record `descendant_cleanup: unknown_manual` and
   `complete_descendant_cleanup: false`. Root exit, sampled absence and an
   owner manual-cleanup report cannot turn those fields into complete
   descendant proof. Preserve separately observed root/producer exit,
   resource settlement and incomplete outcomes. A usable reference must
   carry this exception label through every reader and comparison.
3. This exception removes the requirement to prove every helper exited.
   It does not remove the requirement to stop their case egress. Before
   accepting network stop, independently establish synchronous admission
   closure, cancellation of existing upstream sockets and settlement of
   tracked relay/authentication/response work. A queued CONNECT or existing
   H1/H2 tunnel must not regain forwarding after stop or expiry. Already
   issued requests remain issued; cancellation is not a refund or proof
   that a collector received nothing.
4. Preserve confinement for possible residual helpers. Guard release must
   be qualified on the current source/browser even when a helper remains,
   including listener closure/port reuse and attempted reconnects. A
   boolean, root exit or zero receiver sample is insufficient. If safe
   guard release cannot be established, retain the incomplete/blocked
   outcome. Do not infer permission for an unbounded guardian process,
   released socket alias or deadline extension.
5. Close admission before browser/context shutdown. Retain the existing
   guard-until-observed-root-exit correction. An unavailable root handle or
   unobserved root exit remains incomplete; the helper exception does not
   invent root ownership. Close only verified case-owned resources and
   never kill processes by name or touch an everyday Chrome instance.
6. Preserve private original evidence and independent actual producer
   completion, including failure paths. Report profile cleanup separately
   as observed or unknown/manual. Retain unresolved private profile and
   exact owned-handle observations for manual recovery; never claim all
   helpers absent, delete an unverified profile or publish private paths,
   cookies, credentials or certificate keys. No helper inventory is
   claimed complete.
7. Leave all other conditions unchanged: explicit authenticated permission,
   original canonical authority/slot and nonrefundable reservation, current
   setup/source/cohort/reviews/coordination/window, final-egress consent and
   destination checks, physical request and byte limits, and the absolute
   60-second complete-case envelope. No new case, resend, retry, slot,
   traffic grant or time allocation follows from this decision.
8. Qualify fixed SDK-free positive/enforced/defeat controls on the exact
   revised path before any official source. Include stop during peer
   authentication/upstream setup, active H1/H2 traffic, expiry, root exit
   with surviving work, acquisition failure and stop/output failures.
   Establish no post-stop forwarding at an independent receiver, not from
   producer assertions alone. Ordinary tests remain browser-free; actual
   controls require their existing finite reviewed admission.
9. Keep reference completeness, residual cleanup, native SDK execution,
   actual HTTP and product qualification separate. This exception cannot
   make a missing response, truncated original, failed stop, lost witness
   or unresolved admission gate pass. 059-15 remains IN_PROGRESS with
   non-clearing compliance, and 059-01 remains READY_FOR_REVIEW until its
   actual prerequisites clear.

## Consequences

**Becomes easier:**
- The Google continuation can investigate and implement the existing Chrome
  path without proving every helper's exit or introducing another runner.

**Becomes harder:**
- Possible helper/profile residue needs an explicit private manual-recovery
  handoff. No complete process cleanup is established.
- Independent stop and guard-release qualification must account for helpers
  remaining alive. Owner acceptance does not supply that evidence.

## Assumptions

- Unverified: the installed Chrome cohort and inherited confinement can
  preserve the closed egress boundary after root exit with residual helpers,
  including safe listener/port release. Until current controls establish
  that, native admission stays closed.
- Unverified: stop, originals, independent completion and output can settle
  within the unchanged case envelope on the revised path.

## Kill criteria

- Residual helpers can escape confinement or regain unapproved forwarding.
- Stop or guard release requires weakened authority, extra traffic, a longer
  live window, everyday-profile access or an unapproved long-lived guardian.
- The result would silently report unknown/manual cleanup as complete.

## Open questions

Current-source network-stop, guard-release and finite-completion qualification
remain technical gates. The owner has accepted possible leftover Chrome
helpers and manual cleanup; another routine acceptance question is not
needed. A concrete safety/authority conflict outside this narrow exception
must still be surfaced rather than waived.
