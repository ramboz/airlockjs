---
status: DRAFT
skill: jig:spec-workflow
use_cases: [UC-1, UC-2, UC-6, UC-10]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 056: Adobe product-workflow validation

> Unsliced DRAFT outline, 2026-10-06. Product entitlements beyond Analytics/Target remain unverified.

## Overview

An integrator can demonstrate the declared Web SDK-connected product workflows with real
downstream outcomes, not assume every Adobe product is supported because Alloy sends an Edge request.
Reuse the collection/personalization implementation; do not create one redundant connector per product.

## Intended outcomes

- Record per-product scenario inputs, SDK requirements, identity/consent, configuration,
  observation method, report latency/window and isolated resources.
- Validate AJO (Adobe Journey Optimizer) inbound web/code-based qualification and reporting,
  CJA (Customer Journey Analytics) ingestion/connection/data-view/report semantics, and
  RTCDP (Real-Time Customer Data Platform) profile/audience/activation behavior for declared scenarios.
- Reuse Analytics and Target evidence from their feature specs; fill explicit gaps without
  treating a previous page-view/HTML result as a universal product pass.
- Make missing entitlements, unsupported automation and unavailable outcome evidence explicit blockers.

## Assumptions

AJO/CJA/RTCDP licensing and observation APIs have not been established. Outcome latency and
browser/editor constraints need product-specific experiments; shared Edge transport is insufficient.

## Refinement prerequisites

[051](../051-adobe-integration-proving-ground/spec.md)'s matrix, verified product access and
observation strategy; working assigned scenarios from [052](../052-adobe-sdk-event-collection/spec.md),
[053](../053-adobe-personalization-reporting/spec.md) and
[055](../055-adobe-consent-identity-delivery/spec.md).
Dependencies are scenario-specific; unavailable access does not block unrelated licensed scenarios.

## Decomposition

Intentionally unsliced. Prefer Interface/Data splits by product scenario, each containing the
test configuration, user journey and observable downstream assertion.

## Boundaries and references

Not every product feature, outbound messaging channel, classic at.js/AppMeasurement implementation,
or arbitrary destination is in scope. Do not narrow the release's product matrix silently when access
is missing; a revised release bar requires owner approval.
Grounding: [R-012](../../research/R-012-adobe-first-compatibility.md),
[release product matrix](../../releases/adobe-compatibility.md#3-adobe-product-stack-validation).
No slice ACs or implementation plan authored yet.
