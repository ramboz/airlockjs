# Release Plan: Vendor Parity & Adoption Assurance

> Make third-party migration trustworthy: a customer sees exactly what is supported, what differs,
> and what their vendor actually received. The tradeoff is proof depth and maintenance effort rather
> than a growing roster of superficially green connectors.

## Status

`candidate`

Post-Adobe-first direction; version, appetite and build commitment unassigned.
Captured 2026-10-06 under [ADR-0031](../decisions/adr-0031-reframe-onto-adobe-first-compatibility.md).

## Problem / Baseline

- The parity oracle compares curated fields and permits owned gaps. A passing report is a scoped
  regression result, not full vendor-tag equivalence or revenue-attribution proof.
- Meta's `fbp` wire-name mismatch under-reports the first-party cookie gap; advanced-matching
  presence does not establish identical inputs or matching efficacy.
- Google Ads/Floodlight cover page-load families, not full conversion/enhanced-match behaviors.
  Linker-cookie continuity after native removal and cross-site transport remain separate questions.
- [MVP9](mvp9.md) and [spec 050](../specs/050-mvp9-reference-site-rewire-trial/spec.md) leave
  deployment/console/owner-gated proofs open. Moving the v1.0 gate did not resolve them.

## Appetite

Choose one observed offender and its customer-critical journeys first; estimate only after access
and unsupported behaviors are enumerated. No fixed date or automatic next-minor assignment.

## Solution Outline

- Separate report classes for regression-free supported fields, known functional gaps, presence-only
  evidence, unknown/unclassified fields and live outcomes not yet verified. Missing evidence must
  not resemble equivalence; unexpected capture fields need triage rather than silent omission.
- Fix the Meta `fbp` descriptor/redaction mismatch with a real-capture regression before relying
  on first-party identity reports. Confirm same-input advanced matching and login/logout behavior.
- Build customer-specific scenario coverage for first/returning visitors, conversions, commerce,
  multi-page/cross-domain continuity, relevant consent transitions and cookie-blocked/allowed cohorts.
- Scope Ads/Floodlight conversion, custom-variable and enhanced-match work from captured/documented
  inputs; decide linker ownership and credentialed transport through explicit boundary decisions.
- Validate receipt, then reporting/matching/attribution over an agreed isolated cohort or comparison
  window. Use test properties before production; avoid duplicate revenue conversions.
- Compare official server-side APIs/event forwarding with browser-wire replacement when they
  reduce maintenance or improve fidelity; retain consent, deduplication and vendor eligibility.
- Publish a versioned supported-behavior contract, customer acceptance of material differences,
  controlled rollout/rollback, browser support matrix and upstream-drift monitoring.

## Risks / Rabbit Holes

Unstable/private browser protocols, changed SDKs, insufficient attribution windows, browser privacy
restrictions and paid campaign access can defeat a broad parity claim.

## No-Gos

No customer's revenue risk accepted merely because an internal gap has an owner; no green
fixture-only full-parity claim; no broad credentialed egress by default; no raw live identifiers;
no customer-custom connector shipped; no unapproved production dual-send.

## JIG Handoff

UC-4, UC-5, UC-6, UC-10, UC-11. Reuse specs 026, 038-048 and the current
[refinement ledger](../refinement-todo.md); draft one vendor/journey at a time after the owner commits
the release. Historical MVP9 residuals remain their original evidence obligations.

## Release-Check Criteria

- The selected vendor's supported contract, report classes and gap inventory are current and
  independently grounded; raw capture cannot hide a material unsupported field.
- Customer-critical journeys pass receipt/outcome tests with consent/identity/transport evidence.
- Material exceptions are explicitly accepted by the customer; full parity is claimed only for
  the proven scope and cohorts.
- Booted performance and untouched-stack regression evidence support the rollout.
- A tested rollback and repeatable drift/upgrade procedure exist.
