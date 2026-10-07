---
status: DRAFT
skill: jig:spec-workflow
use_cases: [UC-1, UC-2, UC-6, UC-7, UC-9, UC-10]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 055: Adobe consent, identity and delivery lifecycle

> Unsliced DRAFT outline, 2026-10-06. Lifecycle budgets and policy semantics remain to be grounded.

## Overview

A site's Adobe instrumentation behaves observably and correctly as consent, user identity,
network state, worker lifetime and page lifetime change. This completes SDK-critical edge/lifecycle
semantics, not a universal new privacy framework.

## Intended outcomes

- Define collection, storage, transmission and vendor-use effects for pending/granted/denied/
  revoked/re-granted purposes, including already-queued data and worker context.
- Preserve supported identity/session continuity across login/logout and navigation without
  reusing revoked identity or exposing unrelated cookies.
- Bound event retention and queues; observe failures, retries/duplicates and loss for worker
  timeouts/crashes, offline recovery and navigation/unload.
- Keep tenant/endpoint and input controls effective during recovery and expose redacted diagnostics.
- Pin measurable delivery/retention limits before slice readiness; no universal exactly-once or
  reliable-unload guarantee inferred from a worker or HTTP success.

## Assumptions

The selected SDK's revocation/cache/identity behavior and achievable unload guarantees are not
fully grounded. Required recovery mechanisms may need a separate architecture decision.

## Refinement prerequisites

[051](../051-adobe-integration-proving-ground/spec.md)'s lifecycle findings, bounded delivery
experiments and approved budgets; assigned collection/personalization contracts from
[052](../052-adobe-sdk-event-collection/spec.md) and [053](../053-adobe-personalization-reporting/spec.md).
Required safe behavior must be pulled into those slices immediately, not postponed until this spec.

## Decomposition

Intentionally unsliced. Prefer Rules/Path splits by real lifecycle transition, testing capture,
chamber processing, trusted policy and product outcome together.

## Boundaries and references

Already-transmitted data cannot be recalled by this runtime; consent compliance is not certified.
The broader [granular policy candidate](../../releases/granular-chamber-policy.md) remains separate,
but cannot own away a critical SDK gap.
Sources: [R-012](../../research/R-012-adobe-first-compatibility.md), existing 017/020/035/045
foundations, [release plan](../../releases/adobe-compatibility.md).
No slice ACs or implementation plan authored yet.
