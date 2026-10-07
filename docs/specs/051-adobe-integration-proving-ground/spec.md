---
status: DRAFT
skill: jig:spec-workflow
use_cases: [UC-1, UC-2, UC-6, UC-7, UC-8, UC-10, UC-11]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 051: Adobe integration proving ground

> Drafted through Jig on 2026-10-06. This is the only refined spec in the
> [Adobe-first portfolio](../../releases/adobe-compatibility.md#jig-handoff).
> No implementation, authenticated discovery, provisioning or live validation has run.

## Overview

Give the integrator an actionable permission report, a reproducible stock Adobe baseline and
an evidence-led compatibility decision before attempting the broad SDK bridge.
This implements the investigation checkpoint of
[ADR-0031](../../decisions/adr-0031-reframe-onto-adobe-first-compatibility.md) and
[R-012](../../research/R-012-adobe-first-compatibility.md), not the full v1.0 release.

The owner confirmed an organization with Analytics and Target access. API credentials, product
profiles, test resources and Data Collection permissions are not verified. The current Alloy
adapter is a page-view/HTML-placement subset; it cannot be treated as the entire stock SDK.
These facts and the inspected source/official API references are recorded in R-012.

## Scope and operator-facing deliverables

- A read-only preflight that reports ready/blocked/unverified requirements, with actionable reasons
  and a nonzero exit when a required capability cannot be established.
- An approved, namespaced non-production setup/reuse procedure and stock `aem-martech` baseline:
  page/custom Analytics events plus a Target HTML offer and its Adobe-native display notification.
- A pinned SDK public-surface inventory and representative compatibility experiments, resulting in
  a proceed/reshape/stop recommendation and proposed measurable performance budgets.
- Small reusable probe/report utilities under `probes/adobe-compatibility/`, hermetic tests under
  `test/`, sanitized durable evidence in R-012, and live state/captures stored outside the repo.

The command/report names and resource schemas will be designed in the implementation plan using
verified API support. The ACs specify observable behavior; they do not pretend those CLIs already exist.

## Safety and evidence rules

- Read-only discovery precedes mutation. An approved plan must identify org, resources, test domain,
  ownership, permissions, side effects and cleanup scope; drafting this spec authorizes none of them.
- An AEP (Adobe Experience Platform) sandbox does not isolate Analytics/Target automatically.
  Production/default-resource mutation, paid provisioning and uncontrolled publication are excluded.
- OAuth secrets/tokens come from an approved local environment or secret manager. Logs and committed
  reports contain no credentials, raw identities or live tenant/resource identifiers.
- An HTTP success, network request or local stub is not product receipt. Record the observation
  method, bounded waiting window and correlation strategy; missing outcome visibility is a blocker.
- Run stock and chamber arms separately with equivalent synthetic inputs; no duplicate production
  conversions or irreversible SDK/data migration.
- Existing tenant/endpoint/consent/cookie/DOM safeguards remain active. A probe requiring broader
  authority stops and records the requirement for a separate design decision.

## Grounding

- [Pinned `aem-martech` reference](https://github.com/adobe-rnd/aem-martech/tree/1aa3dee3c4791636efa9ad2994342f861c8e149b):
  public SDK submission, phased integration and Adobe notification behavior.
- [R-012 source/API table](../../research/R-012-adobe-first-compatibility.md#sources--findings):
  direct official references and current Airlock source gaps.
- [Stock Alloy supplier decision](../../decisions/adr-0016-alloy-stock-bundle-site-supplied.md):
  keep the official SDK unmodified; confirm the investigation's version/hash rather than silently
  assuming the historic v2.35.0 pin remains the best reference.
- [Stable core](../../decisions/adr-0017-airlock-1-0-api-contract.md): no public contract break here.

## Assumptions

- Product access can be converted into least-privilege API profiles and isolated test resources;
  the owner confirmation is not an authenticated permission check.
- Analytics and Target outcomes can be observed within a documented test window. The availability
  of report/diagnostic APIs, test suite setup and datastream automation is still unverified.
- Representative callbacks and DOM-dependent SDK behavior can be mediated safely. The spike tests
  this assumption; boot/page-view success does not ground the broader claim.

## Decomposition

**Path/Interface first, then one genuine Spike.**
051-01 delivers a useful operator preflight without any setup. 051-02 delivers repeatable isolated
stock behavior and its observation procedure. Neither is a throwaway infrastructure-only shard.
051-03 is research because callback/page-state/DOM compatibility may change the implementation
approach; it produces a decision and evidence, not a thinly disguised full-SDK implementation.

The live portion of 051-02 needs a ready 051-01 report, not just completion of the preflight utility.
The 051-03 offline inventory can be prepared independently, but its final live comparison requires
051-02's baseline. A blocked access report never makes dependent live work ready.

## Slices

- [051-01 — read-only access preflight](slice-01-access-preflight.md)
- [051-02 — reproducible test setup and stock baseline](slice-02-test-baseline.md)
- [051-03 — bounded SDK compatibility decision](slice-03-compatibility-investigation.md)

## Completion and handoff

Completion means the proving-ground tools and evidence are reviewed, not full Adobe support.
Live setup/receipt blockers leave the relevant baseline work unfinished.
The spike may conclude with a demonstrated incompatibility and a reshape recommendation;
that does not authorize a narrower release gate or automatically unblock a build.

The inventory must assign each release-relevant command/option/result/event and product scenario
to a named owner in specs 052-057 or an explicit unresolved decision. There must be no unowned
row silently omitted from the v1.0 contract. Proposed measurements/budgets need owner approval
before dependent implementation specs become ready.

## Out of scope

Full production SDK support; generalized Launch migration; broad field/capability policy;
AJO/CJA/RTCDP product configuration; third-party replacement parity; production publication;
a v1.0 cut. These belong to later portfolio specs or candidate releases.
