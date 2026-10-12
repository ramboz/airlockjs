# Release Plan: Adobe Compatibility & Adoption

> Airlock's first adoption path becomes Adobe-first: keep the official Alloy.js SDK, place its work
> behind the chamber boundary, and migrate `aem-martech` integrations without silently losing Adobe
> events, personalization, or reporting. The main tradeoff is breadth: an SDK that boots is not yet
> a compatible SDK or a validated product stack.

## Status

`committed`

**Owner-selected direction, 2026-10-06; targets v1.0.0**
([ADR-0031](../decisions/adr-0031-reframe-onto-adobe-first-compatibility.md)).
**Acceptance boundary updated by the owner on 2026-10-12**
([ADR-0032](../decisions/adr-0032-airlock-boundary-acceptance.md)): stock/chamber
actual wire, governed egress and real response/rendering are mandatory. Further Adobe
downstream reporting is a nonblocking follow-up, not a release prerequisite.
Investigation comes first; this status commits the release direction, not undiscovered APIs, unreviewed
implementation slices, external permissions, or a release date. No version/tag is cut here.
The former [MVP9](mvp9.md) gate is replaced; its unclosed evidence remains deferred and visible.

## Problem / Baseline

- Alloy boots in a chamber and delivers a governed page-view/HTML-placement subset. General XDM
  (Experience Data Model), identity maps, commerce, SDK command/results/events, Adobe proposition
  notifications, and page-native integrations are not thereby implemented.
- [`aem-martech`](https://github.com/adobe-rnd/aem-martech/tree/1aa3dee3c4791636efa9ad2994342f861c8e149b)
  is the initial compatibility reference, not code to transplant wholesale. It already phases eager
  personalization, lazy analytics and delayed Launch. Compare against that competent baseline.
- At initial drafting, the owner needed an isolated Target/Analytics setup and API-led discovery.
  [R-012](../research/R-012-adobe-first-compatibility.md) now records owned fixtures, Analytics queries and scoped Target
  create/edit/future-only approval and its initial inactive restoration. Later partial stock smoke
  deployed with ordinary Analytics page/custom receipt and native Target wire proof; cumulative
  Target report counts are observed in the owner-confirmed Development environment,
  but per-run attribution remains unverified.
  Test code is disabled and the retained activity's serving window ended. Initial routing uses
  owner UI/saved-pin confirmation, not management API readback. Full stock/chamber product
  qualification remains open. API credentials cannot create entitlements; some setup still needs guided UI work.
- Customer-owned Launch/GTM can retain the remaining vendor tags while observed offenders migrate
  individually. Those remaining page scripts are outside Airlock's governance.

## Appetite

**Fixed outcome, variable implementation time; no guessed delivery date.**
The first investigation pass is bounded by an access/automation map, a pinned compatibility inventory
and one complete stock-versus-chamber Adobe journey. Stop at a feasibility/scope checkpoint before
committing the broad build. If access is blocked, finish the offline inventory and actionable access
request; do not pretend the live checkpoint passed.

## Solution Outline

### 1. Investigation and owned test environment

- Start [R-012](../research/R-012-adobe-first-compatibility.md): read-only entitlement/resource
  discovery, then propose a least-privilege setup plan. Prefer OAuth Server-to-Server and supported
  APIs; never paste credentials into chat, code, reports or fixtures.
- Identify a safe EDS test deployment, an Analytics test report suite, a Target test
  environment/workspace/property, and the necessary Data Collection/AEP resources. Verify product
  isolation separately; a development AEP sandbox does not automatically isolate Target or Analytics.
- Prefer reusable, namespaced synthetic fixtures. Provision only explicitly approved non-production
  resources; record ownership and a targeted cleanup plan. Never activate production activities,
  rewrite production datastreams or reset shared sandboxes.
- Inventory the pinned stock SDK's documented commands, options, return values, events, callbacks,
  storage/identity effects and DOM dependencies. Classify each as worker-native, mediated bridge,
  controlled host-side rendering/capture, or incompatible/unverified.
- First vertical journey: synthetic page/custom -> correct actual SDK dispatch and returned
  result/error; Target HTML decision -> safe reserved rendering -> **native display/interaction wire**.
  Drive stock `aem-martech` and Airlock separately with equivalent inputs, not dual production sends.

### 2. Full Alloy compatibility build

- Keep the stock SDK byte-pinned and unmodified. Expand the current page-view adapter into a
  governed documented command bridge, including general event/XDM/data, identity and consent
  semantics, error/result ordering and SDK lifecycle.
- Implement the capability matrix, not unrestricted page RPC. Functions/callbacks and DOM-dependent
  commands need explicit bridge/host design; arbitrary functions do not cross structured clone.
- Complete Adobe personalization display/interaction reporting, scope/view semantics and the
  required proposition types. HTML, JSON, DOM-action and redirect behaviors are separate cases;
  VEC (Visual Experience Composer) authoring/preview compatibility is separately validated.
- Support the required self-hosted Alloy/Launch contract and ACDL (Adobe Client Data Layer) event/state
  integration without duplicate SDK instances, duplicate page views or cross-instance state leakage.
- Close SDK-critical consent revocation, cookie/identity continuity, endpoint/tenant routing,
  worker timeout/crash, offline/navigation/unload and live-host CSP/Trusted Types gaps as they arise.
  Future policy work does not excuse a broken or unsafe Adobe workflow.

### 3. SDK-facing scenarios and downstream follow-up

| Product | Required evidence, not inferred from SDK boot |
|---|---|
| Adobe Analytics | Required final page/custom/commerce payloads, suite/datastream routing and identity continuity. Downstream ingestion/reporting is follow-up. |
| Adobe Target | Required scope/view responses, offer/render behavior and native display/interaction wire. Experiment counters/attribution are follow-up. |
| Adobe Journey Optimizer (AJO) | Assigned SDK commands/payloads/results and safe personalization remain inventory work; required live response access must be explicit. Campaign reporting is follow-up. |
| Customer Journey Analytics (CJA) | Shared SDK-facing event/identity semantics remain required; ingestion, connections/data views/reports are follow-up. |
| Real-Time Customer Data Platform (RTCDP) | Shared SDK identity/consent/request semantics remain required; downstream profiles/audiences/activation are follow-up. |

The stack means **Web SDK-connected workflows**, not every product feature, outbound messaging
channel, classic at.js/AppMeasurement implementation, or server-side Adobe service.
No product is marked *downstream validated* without its entitlement and outcome evidence.
Missing required live request/response access still blocks that assigned SDK-facing scenario;
missing optional report visibility does not block unrelated implementation.
The [reporting follow-up](adobe-reporting-follow-up.md) retains that work and its triggers.

### 4. Repeatable adoption and performance proof

- Publish an EDS integration/upgrade guide from `aem-martech` with explicit API/config compatibility,
  safe failure behavior, opt-in rollout and rollback.
- Compare no-martech, phased stock `aem-martech`, and chamber-backed integration on equivalent
  content/configuration. Report main-thread TBT/INP and LCP/CLS, including worker startup, clone,
  consent, eager decision-network latency and host rendering cost.
- Before implementation approval, pin measurement conditions, repeat counts, noise handling and
  numeric acceptance bands. No "minimal CWV impact" claim merely because mapping is off-thread.
- Retain Launch/GTM for unmigrated vendors; survey and move actual offenders later using the
  [vendor assurance](vendor-parity-assurance.md) gate, never a generic green fixture count.

## Risks / Rabbit Holes

- Entitlement, approval and non-production setup cannot be conjured by Developer Console.
- A complete API surface includes browser-side behaviors that conflict with headless SDK assumptions.
- Adobe outcome visibility, authoring workflows and version support may demand explicit scope changes.
- Existing stock `aem-martech` is already performance-conscious: useful gains must be measured.
- Full compatibility can become endless: a version-pinned inventory and stage checkpoint bound it.

## No-Gos

- No SDK fork, fabricated Adobe receipt, broad DOM/global access or disabled safeguards to pass a test.
- No production publication, paid resource purchase, tenant migration or shared-resource deletion.
- No runtime secrets, raw customer identities or unredacted live captures in committed artifacts.
- No claim that remaining Launch/GTM code is isolated, governed, or cost-free.
- No implicit stable-core break; [ADR-0017](../decisions/adr-0017-airlock-1-0-api-contract.md) still applies.

## JIG Handoff

Use cases: **UC-1, UC-2, UC-4, UC-6, UC-7, UC-8, UC-9, UC-10, UC-11, UC-13, UC-14**.
R-012 remains the investigation record. The portfolio was drafted through Jig on 2026-10-06:

| Spec | Draft scope | Refinement state |
|---|---|---|
| [051 — Adobe integration proving ground](../specs/051-adobe-integration-proving-ground/spec.md) | Safe preflight, reproducible stock baseline, bounded SDK compatibility decision | 051-01/04 DONE with real preparation-ready report. Stock/spike outcome contracts remain open. |
| [052 — Governed Adobe event collection and SDK commands](../specs/052-adobe-sdk-event-collection/spec.md) | General XDM/data and the documented command/result/event bridge | Unsliced DRAFT; needs 051's contract/approach |
| [053 — Adobe personalization and reporting](../specs/053-adobe-personalization-reporting/spec.md) | Offers/rendering/scopes/views and Adobe-native display/interaction evidence | Unsliced DRAFT; refine from inventory and relevant command contracts |
| [054 — aem-martech and Launch migration](../specs/054-aem-martech-launch-migration/spec.md) | Adopter instrumentation, ACDL/Launch compatibility, no duplicate initialization | Unsliced DRAFT; depends on the behaviors being migrated |
| [055 — Adobe consent, identity and delivery lifecycle](../specs/055-adobe-consent-identity-delivery/spec.md) | Revocation, identity continuity, retained/queued work and page/worker/network edges | Unsliced DRAFT; critical safe behavior is pulled into feature slices immediately |
| [056 — Adobe product-workflow validation](../specs/056-adobe-product-workflow-validation/spec.md) | Nonblocking downstream product/reporting follow-up | Unsliced DRAFT; owner deferred priority under ADR-0032, trigger a concrete adopter need |
| [057 — Adobe adoption, performance and release qualification](../specs/057-adobe-adoption-release-qualification/spec.md) | Install/migrate/measure/update/rollback and complete evidence aggregation | Unsliced DRAFT; numeric bands and feature evidence precede readiness |

Only 051 is refined into executable slice contracts. None is READY_FOR_IMPLEMENTATION, and no
authenticated/provisioning action is authorized by drafting. On 2026-10-08 the owner granted
proceeding after independent reviews under strictly fewer than 10,000 credits overall, with a separate
8-active-hour 051-03 budget. This does not clear input/evidence, setup/mutation or baseline gates,
approve numeric performance bands, or authorize release/publication beyond scoped test plans.
AJO/CJA/RTCDP provisioning remains deferred for this run; shared SDK semantics remain required.
ADR-0032 additionally makes downstream outcomes for all products a nonblocking follow-up.
051-01 implements API, scoped owner-evidence and unavailable-automation report bases. Its real
historical exit-1 report has one workspace unknown. The owner supplied exact profile confirmation;
new 051-04's schema-v2 report now verifies all 12 required checks with explicit owner evidence.
Preparation readiness does not establish the stock baseline, deployment or SDK/product proof.
Refine subsequent specs from the investigation's evidence, with actual slice dependencies rather
than placeholder IDs.
Existing specs 012-014, 020, 033-036 are reusable foundations, not the complete target.

### Clean-session execution brief

[The portable `/goal` brief](adobe-compatibility-goal.md) carries the implementation/review
workflow and private-input handles. Its current run scope prioritizes Alloy/Target/Analytics;
AJO/CJA/RTCDP shared SDK behavior remains inventoried; downstream product-workflow reporting is
a nonblocking follow-up under ADR-0032. Running the
brief is a proposed owner execution grant; committing it does not approve a budget or start a run.
Credentials, live selectors and raw evidence remain outside Git.

## Release-Check Criteria

- A version-pinned public SDK inventory has no unclassified items; supported behavior is proven
  against stock behavior, including errors, callbacks/events and lifecycle. Any exclusion forbids a
  **full Alloy support** label and requires an explicit owner-approved revision of this gate.
- Assigned SDK-facing scenarios pass with actual stock/chamber serialized dispatch, correct
  routing/identity/consent and real returned result/render behavior. Missing required live
  protocol access blocks that scenario; a fixture/HTTP 200 alone is insufficient.
- Correct Adobe-native DISPLAY/INTERACT wire corresponds to safe rendering and trusted clicks;
  a GA4 exposure cannot replace those notifications. Invalid vendor responses block.
- Downstream ingestion, per-run attribution and report counters are nonblocking follow-up.
  Preserve existing proof and contradictory diagnostics; do not claim product processing from
  wire conformance. No mandatory export schedule or goal creation solely for counters.
- `aem-martech`/Launch integration and the scripted install/update/rollback path work without
  duplicate initialization or measurement.
- Performance meets the numeric bands established and approved at the investigation checkpoint
  against the phased stock baseline; disclose network/render costs and any residuals.
- Controls remain enforced, frozen-core regressions are absent, and external mutations/fixtures meet
  the isolation/redaction rules.
- Only after these checks (or an explicitly approved revised bar) may **v1.0.0** be cut.

_Release checks remain desired future evidence. R-012 records limited prior admin/setup observations,
and actual partial stock proof, not full SDK/chamber compatibility. This assurance reframe makes no authenticated calls
and executes no new compatibility workflow._
