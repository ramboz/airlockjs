---
status: DRAFT
skill: jig:spec-workflow
use_cases: [UC-1, UC-2, UC-6, UC-7, UC-10]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 053: Adobe personalization and reporting

> Unsliced DRAFT outline, 2026-10-06. Proposition types and reporting ACs follow spec 051's evidence.

## Overview

A visitor receives the intended Adobe experience without uncontrolled page mutation, and Adobe
records the offers actually displayed/interacted with. Cover the assigned Target and Adobe
Journey Optimizer (AJO) SDK-facing personalization surface, preserving its routing/identity semantics.

## Intended outcomes

- Render assigned HTML/JSON/DOM-action/redirect proposition behaviors through explicit safe host
  capabilities, with correct scopes, views and timing.
- Send Adobe-native display and interaction notifications for actual rendering/interactions;
  a GA4 exposure event cannot substitute for Adobe reporting.
- Handle late responses, unmatched placements, rendering failures, repeat views and consent
  transitions without false displays or duplicate measurement.
- Validate the required visual-editor/preview behavior separately from runtime delivery.
- Compare assigned flows against stock behavior with real receipt/outcome evidence.

## Assumptions

Safe host rendering may not reproduce every stock DOM action or editor expectation. AJO access
and publication capabilities are unverified. Exclusions or missing access cannot silently narrow
the full compatibility gate.

## Refinement prerequisites

[051](../051-adobe-integration-proving-ground/spec.md)'s inventory and Target baseline; the relevant
event/command contract from [052](../052-adobe-sdk-event-collection/spec.md); verified AJO test
access for AJO-specific proof. Independent Target slices need not wait for unrelated product access.

## Decomposition

Intentionally unsliced. Prefer Data/Path splits by offer type and observable journey, bundling
decision fetch, application and required reporting into each end-to-end slice.

## Boundaries and references

No unrestricted DOM/global bridge, SDK fork or fabricated notification receipt. Campaign authoring
automation and test isolation must follow approved product-specific setup.
Sources: [manual Adobe rendering/reporting](https://experienceleague.adobe.com/en/docs/experience-platform/collection/use-cases/personalization/render-manual-propositions),
[R-012](../../research/R-012-adobe-first-compatibility.md),
[release plan](../../releases/adobe-compatibility.md). Existing specs 033/034 provide HTML-placement
foundations, not proof of full DOM/editor behavior. No slice ACs or implementation plan authored yet.
