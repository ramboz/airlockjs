# Release Plan: Vendor Parity & Adoption Assurance

> Make third-party migration trustworthy: a customer sees exactly what is supported, what differs,
> and what their vendor actually received. The tradeoff is proof depth and maintenance effort rather
> than a growing roster of superficially green connectors.

## Status

`candidate`

Post-Adobe-first direction; version, appetite and build commitment unassigned.
Captured 2026-10-06 under [ADR-0031](../decisions/adr-0031-reframe-onto-adobe-first-compatibility.md).

**Google/Meta preparation active (2026-10-15).**
[ADR-0033](../decisions/adr-0033-reframe-onto-full-google-meta-compatibility.md)
records the owner's complete-replacement target. The preparation grant is
shared 25,000 AI credits and a four-active-hour checkpoint for specs and local
evaluation qualification only. It is not release commitment, full implementation,
additional live-event authority or a change to Adobe-first v1.0. A written
ceiling is not a claim that the host exposes an enforceable shared credit meter.

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

Google and Meta now have parallel full-target preparation, not permission to
drop unimplemented native behavior from the adoption contract. Build vertical
journeys incrementally, but preserve the complete inventory and open evidence.
Other vendors remain candidates; estimate after their access and unsupported
behaviors are enumerated. No fixed release date or automatic next-minor assignment.

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
  For Google/Meta these are complementary paths, not substitutes for required browser behavior.
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
[refinement ledger](../refinement-todo.md). New DRAFT owners are
[058](../specs/058-native-tag-evaluation-qualification/spec.md) for recorder/evaluation
qualification, [059](../specs/059-google-ads-full-compatibility/spec.md) for Google
and [060](../specs/060-meta-pixel-full-compatibility/spec.md) for Meta.
Historical MVP9 residuals remain their original evidence obligations. No stage
or owned gap becomes a full replacement pass; actual dispatch, receipt, matching
and attribution remain separate claims.

## Release-Check Criteria

- The selected vendor's supported contract, report classes and gap inventory are current and
  independently grounded; raw capture cannot hide a material unsupported field.
- Customer-critical journeys pass receipt/outcome tests with consent/identity/transport evidence.
- Material exceptions are explicitly accepted by the customer; full parity is claimed only for
  the proven scope and cohorts.
- Booted performance and untouched-stack regression evidence support the rollout.
- A tested rollback and repeatable drift/upgrade procedure exist.
