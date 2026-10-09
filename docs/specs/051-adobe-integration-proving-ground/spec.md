---
status: IN_PROGRESS
skill: jig:spec-workflow
use_cases: [UC-1, UC-2, UC-6, UC-7, UC-8, UC-10, UC-11]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 051: Adobe integration proving ground

> Drafted through Jig on 2026-10-06. This is the only refined spec in the
> [Adobe-first portfolio](../../releases/adobe-compatibility.md#jig-handoff).
> Refined at DRAFT on 2026-10-08. Selected authenticated checks and owner-authorized fixture
> setup are recorded in R-012; the versioned preflight is now implemented and hermetically
> validated in 051-01. The real preflight returned unverified; deployment and stock/chamber
> validation remain unexecuted.
> Independent implementation/reconciliation reviews passed; 051-01 utility is DONE.
> This does not clear the real stock baseline gate.

## Overview

Give the integrator an actionable permission report, a reproducible stock Adobe baseline and
an evidence-led compatibility decision before attempting the broad SDK bridge.
This implements the investigation checkpoint of
[ADR-0031](../../decisions/adr-0031-reframe-onto-adobe-first-compatibility.md) and
[R-012](../../research/R-012-adobe-first-compatibility.md), not the full v1.0 release.

R-012 is authoritative for operational facts: the dedicated Analytics suite/report queries and
Target environment/property/workspace association, owned offers/activity create/edit and a
future-only approval/restoration check are verified. The activity is saved/inactive. Managed
datastream routing is established by owner screenshots, exact selector comparisons and saved
environment-pin confirmation, **not** a configuration API readback. Reference push dry-run passed;
actual deployment, SDK events and product outcomes have not run. These ad-hoc observations are
not the tested 051-01 CLI or a fresh report. The subsequent real CLI verified 11 of 12 required
checks; missing workspace association evidence keeps the stock gate blocked. The current Alloy adapter remains a
page-view/HTML-placement subset, not the entire stock SDK.

The immediate proving ground is Alloy/Analytics/Target. AJO/CJA/RTCDP are owner-deferred for this
run, not removed from ADR-0031 or later release obligations. Platform ingestion remains disabled;
a new AEP development sandbox is not an initial Analytics/Target prerequisite.

### Execution grant and remaining gates — 2026-10-08

The owner permits proceeding after independent contract/readiness reviews, under an overall
ceiling **strictly below 10,000 credits**, tracked by the parent across refinement, reviews and
execution. Slice 051-03 separately has **eight active engineering hours** (external waiting
excluded); stop with explicit unknowns before either budget is exhausted. No implicit extension,
production publication, paid provisioning, cleanup deletion, release/tag or narrower release gate.
The parent owns private-state normalization/writes and scoped live checks. Initial DRAFT refinement
made no live calls or code changes; implementation and the real unverified preflight followed their
applicable readiness gates. A spending/time grant does not verify input evidence, approve a mutation
plan or satisfy DoR.

## Scope and operator-facing deliverables

- A versioned read-only preparation preflight that reports ready/blocked/unverified requirements,
  distinct API/manual/unavailable evidence bases and nonzero exit for any required unknown.
- An approved, namespaced non-production setup/reuse procedure and stock `aem-martech` baseline:
  page/custom Analytics events plus a Target HTML offer and its Adobe-native display notification.
- A pinned SDK public-surface inventory and representative compatibility experiments, resulting in
  a proceed/reshape/stop recommendation and proposed measurable performance budgets.
- Small reusable probe/report utilities under `probes/adobe-compatibility/`, existing Vitest tests
  under `test/`, sanitized durable evidence in R-012, and approved private live state/captures
  outside committed artifacts.

The exact Node ES module command, private export/input/evidence schemas, public immutable report,
operation inventory and test selectors are specified in
[051-01's reviewed v1 contract](slice-01-access-preflight.md#draft-v1-operator-and-evidence-contract).
Its CLI and hermetic tests now exist, and the parent-owned real result is recorded in R-012.
Implementation and reconciliation reviews passed; 051-01 utility is DONE. A fixture-ready report grants no later
live/write authority.

## Safety and evidence rules

- Read-only discovery precedes mutation. An approved plan must identify org, resources, test domain,
  ownership, permissions, side effects and cleanup scope; drafting this spec authorizes none of them.
- An AEP (Adobe Experience Platform) sandbox does not isolate Analytics/Target automatically.
  Production/default-resource mutation, paid provisioning and uncontrolled publication are excluded.
- OAuth secrets/tokens come from an approved local environment or secret manager. Logs and committed
  reports contain no credentials, raw identities or live tenant/resource identifiers.
- The approved uppercase Adobe credential export is read directly through `ADOBE_CREDENTIAL_FILE`;
  no copied secret config. Owner routing evidence is versioned, fresh and exactly bound, never
  `ownerConfirmed=true`. Required unavailable automation remains unverified; token issuance and
  the explicitly documented bounded Analytics query are the only preflight POST exceptions.
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
  keep the official SDK unmodified. The pinned `aem-martech` README declares Alloy **2.31.1** and
  ACDL **3.0.1**, not the historic Airlock 2.35.0 pin. The parent's executed offline comparison
  on 2026-10-08 found the reference Alloy file differs from the versioned official artifact by
  one trailing LF only; use the same exact official artifact in both future arms
  ([full byte provenance](slice-02-test-baseline.md#stock-input-provenance--offline-only)).
- [Stable core](../../decisions/adr-0017-airlock-1-0-api-contract.md): no public contract break here.

## Assumptions

- Fresh, scope-bound owner evidence and supported API readbacks can establish the initial
  preparation contract. Historical routing/permission snapshots may be stale; normalization
  alone is not reverification or proof of exclusive application-wide grants.
- Analytics and Target outcomes can be observed within a documented test window. Analytics
  query permission is exercised, but synthetic-event receipt and Target diagnostic/report
  correlation/latency are not. Datastream administration remains unavailable to this tool surface.
- Representative callbacks and DOM-dependent SDK behavior can be mediated safely. The spike tests
  this assumption; boot/page-view success does not ground the broader claim.

## Decomposition

**Path/Interface first, then one genuine Spike.**
051-01 delivers a useful operator preflight without any setup. 051-02 delivers repeatable isolated
stock behavior and its observation procedure. Neither is a throwaway infrastructure-only shard.
051-03 is research because callback/page-state/DOM compatibility may change the implementation
approach; it produces a decision and evidence, not a thinly disguised full-SDK implementation.

The live portion of 051-02 needs a fresh real 051-01 preparation report **and** its separate reviewed
setup/mutation/observation gates, not just completion of the utility or a ready preparation result.
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
