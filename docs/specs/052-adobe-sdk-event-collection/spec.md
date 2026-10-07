---
status: DRAFT
skill: jig:spec-workflow
use_cases: [UC-2, UC-7, UC-8, UC-10]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 052: Governed Adobe event collection and SDK commands

> Unsliced DRAFT outline, 2026-10-06. Refine only after spec 051's compatibility checkpoint.

## Overview

An integrator can invoke the declared stock Adobe Web SDK commands through Airlock and receive
compatible events/results without granting the SDK unrestricted page or network access.
Keep the official Alloy.js bundle unmodified and version-pinned.
This owns general event submission and the command/options/result/event bridge, not the
personalization renderer, broad policy engine or customer migration procedure.

## Intended outcomes

- Preserve page/custom/commerce event type and permitted XDM (Experience Data Model), `data`,
  identity and per-event configuration rather than coercing every event into a page view.
- Implement the assigned public SDK inventory with command validation, result/error ordering,
  clone-safe callbacks/events and observable failure behavior.
- Keep tenant/endpoint/input safeguards on every route and declare any necessary additions.
- Demonstrate assigned command semantics against the stock baseline, with Analytics receipt for
  relevant collection journeys; no success-shaped stub or silent unsupported-command fallback.

## Assumptions

The permitted command/callback/result model is not yet selected. Full compatibility, event
mapping breadth and SDK endpoint needs are questions for 051, not verified capabilities.
Any required stable-core break needs a separate ADR under ADR-0017.

## Refinement prerequisites

[051](../051-adobe-integration-proving-ground/spec.md)'s pinned inventory, accepted bridge approach,
test baseline and approved performance constraints. Determine executable slice dependencies when
the slices exist; do not invent placeholder dependency IDs.

## Decomposition

Intentionally unsliced. Prefer Data/Interface/Rules splits by independently usable event/command
families. Each slice must expose a caller-facing behavior through the real bridge, not merely
introduce a transport or schema for the next slice.

## Boundaries and references

Personalization rendering/reporting belongs to [053](../053-adobe-personalization-reporting/spec.md);
consent/identity/delivery edge semantics belong to [055](../055-adobe-consent-identity-delivery/spec.md).
Minimum safe consent/identity and failure behavior is required in each collection slice from the start.
Grounding: [R-012](../../research/R-012-adobe-first-compatibility.md),
[ADR-0031](../../decisions/adr-0031-reframe-onto-adobe-first-compatibility.md),
[release plan](../../releases/adobe-compatibility.md). Current code is a bounded page-view adapter,
not this future command bridge. No slice ACs or implementation plan authored yet.
