---
status: DRAFT
skill: jig:spec-workflow
use_cases: [UC-1, UC-2, UC-4, UC-8, UC-13, UC-14]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 054: aem-martech and Launch migration

> Unsliced DRAFT outline, 2026-10-06. The compatibility facade is not chosen before the inventory.

## Overview

An EDS (Edge Delivery Services) integrator can move a declared `aem-martech` integration onto
Airlock while retaining supported Launch rules and unmigrated tags, without duplicate SDK
initialization or measurement. This is the adopter-facing integration contract, not a second SDK host.

## Intended outcomes

- Preserve the assigned eager/lazy/delayed integration behavior and direct instrumentation calls.
- Bridge the required ACDL (Adobe Client Data Layer) event/state and Launch self-hosted instance,
  callback/event semantics onto the same governed SDK instance.
- Prevent duplicate page views, configuration races and cross-instance state leakage.
- Keep the remaining Launch/GTM tags functional and explicitly outside Airlock governance.
- Supply a repeatable opt-in install/configuration/migration procedure, with safe boot failure and
  a coherent rollback that never silently loses or duplicates measurement.

## Assumptions

Launch's self-hosted SDK and ACDL expectations may need more than an asynchronous command wrapper;
callbacks and synchronous page state are genuine compatibility risks. Compatibility is versioned,
not a promise for arbitrary extensions or containers.

## Refinement prerequisites

[051](../051-adobe-integration-proving-ground/spec.md)'s pinned reference/API matrix and bridge
decision; the relevant [052](../052-adobe-sdk-event-collection/spec.md) and
[053](../053-adobe-personalization-reporting/spec.md) behaviors for each migrated scenario.

## Decomposition

Intentionally unsliced. Prefer Interface/Path splits: direct EDS adopter first, then required
ACDL/Launch integration paths. Every slice is a working migration path, not a detached facade stub.

## Boundaries and references

No automatic container translator, arbitrary third-party script containment or production
container publication. Preserve the existing distribution contract; extend it through an ADR if needed.
Grounding: [pinned reference](https://github.com/adobe-rnd/aem-martech/tree/1aa3dee3c4791636efa9ad2994342f861c8e149b),
[R-012](../../research/R-012-adobe-first-compatibility.md),
[release plan](../../releases/adobe-compatibility.md). No slice ACs or implementation plan authored yet.
