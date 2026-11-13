---
status: DONE
skill: spec-workflow
use_cases: [UC-4, UC-5, UC-6, UC-7, UC-8, UC-9, UC-10, UC-11, UC-13, UC-14]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

> **Rescoped 2026-11-12 by spec 066 (Meta parity inventory).** Slices 060-01 to 060-12 are abandoned and replaced by slices M1 to M13 in spec 066 (section 8 maps each one). Slices 060-13 to 060-21 stay DONE. This spec is kept as history and as the source of the contract wording.

# Spec 060: Full Meta Pixel compatibility

An adopter must be able to replace the native browser Pixel with an Airlock
chamber without losing collection or changing attribution-bearing behavior.
The work keeps vendor interpretation off the main thread and privileges
mediated; undocumented behavior and missing evidence remain work, not exceptions.

The twelve full-compatibility journeys remain preparation, not a compatibility
claim. The first is READY_FOR_REVIEW for authoring after a blocked-draft frame
pass; the other eleven remain DRAFT. Boundary fit, implementation readiness and
live authority are not certified by that review.
The main tradeoff is more discovery and browser-side capability work in exchange
for a replacement an adopter can actually trust.

[060-13](slice-13-offline-pageview-prototype.md) implements a separate offline
first-party PageView prototype: two distinct pages traverse an actual Node
worker and independently arrive at a loopback receiver. Pending/denied consent
produces zero arrivals and grant does not replay them. Its gap report covers
the supplied fixture's complete field union and remains inconclusive.
This does not change060-01 readiness, any C1-C9 criterion, the full feature
target, live authority or the production boot.

## Remaining work and next authoring step

**Paused for owner review (2026-11-02).** The
[goal/status/work plan](../../releases/google-meta-work-plan.md)
is the proposed bounded pickup order. No research or implementation follows
without an owner-selected packet. 060-14 is already DONE for its historical
local-browser scope; it is not the next draft. Full060-01 remains unqualified.

The [delivery queue](../../releases/vendor-parity-assurance.md#googlemeta-delivery-queue-2026-10-26)
orders construction, native evidence and adoption while preserving every
documented feature owner. Its dated instructions are historical following the
owner pause. Full060-01 and later02-12 keep their original evidence/dependency
requirements. Accepted ADR-0046 records the work-admission rule, not an
execution decision.

## Overview

The owner requires feature parity with the official tags and the whole wire
sequence to the official backend for every use case. Construction is staged,
but the product target is not a permitted subset. Native `fbevents.js` must be
absent in replacement runs, including tag-manager reinjection and cached
execution. A connector-only mapper test or a native SDK running elsewhere is
not proof of this reimplementation.

This work serves selective migration, advertising collection, consent,
governance, diagnostics, comparison and measured adoption in the
[vision use cases](../../product-vision.md#use-cases). The Adobe-first release
scope remains unchanged. Adobe's reporting-follow-up ruling is not a waiver
for Meta matching or attribution.

### Authority and open prerequisites

- [ADR-0040](../../decisions/adr-0040-reframe-onto-full-google-meta-compatibility.md)
  is **Accepted** for the owner's target/framing. The vision separates general
  identity services from required vendor-cookie continuity; no writer or broad
  grant is implemented or approved by that clarification.
- [058](../058-native-tag-evaluation-qualification/spec.md) supplies local
  controls, selected native attempts and offline sequence/control comparison.
  Independent full native/chamber comparisons and reviewed cross-run
  normalization remain open. Named evidence layers are prerequisites, not
  capabilities obtained by linking to the overview or copied-reference passes.
- [ADR-0017](../../decisions/adr-0017-airlock-1-0-api-contract.md), including its
  amendments, protects the stable core. Neither this DRAFT nor the experimental
  configuration carve-out authorizes a frozen-interface change.
- Parent owns source discovery, integration/ID collision checks, ADR/index/board
  updates and formal reviews. No source was explored for this packet. Existing
  runtime behavior and available extension seams are essential unknowns until
  the parent supplies source-backed evidence, using configured semantic tools
  when available and targeted source reads otherwise, as the project workflow requires.

### Grounded starting point, not a passing reference

The private evidence handles below were prepared on 2026-10-15. They report:

1. The saved PageView fixture is capture-derived according to its author, but
   drops 38 experiment flags and lacks original request bytes and a complete
   sequence. The Lead fixture is explicitly synthetic. Redacted matching
   placeholders are not same-input hash proof. The fixtures disagree on the
   purported browser-ID wire key: `fbp` versus `_fbp`.
2. Owned setup now exists. The live automated recording has official runtime
   and owned configuration HTTP 200 responses, but no observed PageView request.
   Offline installed and supplied-stock snippets, using the same retained
   resources, both show one Pixel record, an empty remaining queue and no beacon
   under all-intercepted Chrome.
3. The owner separately confirms a normal-browser PageView in Test Events.
   This is owner-confirmed receipt, not agent-witnessed console evidence or a
   paired automated request. The different outcomes have an **unknown cause**;
   no bootstrap, headless, consent or domain diagnosis is established.
4. The owner chose default-on site-wide native installation with
   `meta-pixel=off`; any exact duplicate `off` disables Meta initialization.
   The owner separately omitted the static noscript image for this test setup.
   These choices are preserved, not reopened. They are not full no-JavaScript
   parity or behavioral proof of every gate/lifecycle case.

**Later offline checkpoint (2026-10-16):** 058-02 now produces a positive
retained Meta PageView attempted reference in actual headed Chrome, with
independently demonstrated process/IP/resolver and HTTP no-send controls.
Its disabled, native-revoked and changed-value cases are linked to that positive.
The genuine headless cohort remains a loaded/executed no-beacon negative; no
browser-evidence spoofing or native filter override is used. This separates a
usable narrow reference from the original observations; it does not establish
the full native matrix, actual vendor responses, chamber execution or matching/
attribution. The owner Test Events receipt remains separately attributed.

### Explicit private-input handles

The parent supplies these handles out of band. Missing input produces a visible
blocked/inconclusive result, never file-system discovery, a download or a live
resend. This packet commits no private path, source selector, owned URL, account
identifier, cookie value, credential or value-derived identifier hash.

| Supplied handle | Purpose and limit |
|---|---|
| `owned-validation-resources.local.json` | Owned source, site-gate decisions and feature access; not blanket account authority. |
| `meta-pixel-compatibility-inventory.json` | Twenty feature families F01-F20, eighteen scenarios SC01-SC18, public citations and unknowns. |
| `meta-pixel-saved-capture-coverage.json` | Exact saved-fixture limits; no newly acquired native evidence. |
| `meta-owned-setup-evidence-ledger.json` | Separate automated/live, offline and owner-receipt observations; oracle unqualified. |
| `private-native-wire-evidence.json` | Parent-provided private transport recording; no positive automated PageView. |
| `offline-bootstrap-comparison.json` | Parent-provided intercepted comparison; not backend dispatch or a passing empty baseline. |

Future runtime/configuration, lawful identity vectors, cookie/profile state,
catalog and reporting inputs must likewise be explicitly supplied, authorized
and provenance-qualified. A filename does not grant its contents' privileges.

## Binding acceptance contract

Every slice applies C1-C9 as well as its numbered acceptance criteria.

| Rule | Required behavior and evidence |
|---|---|
| C1 - truthful reference | Consume 058-01's qualified `local_network` recorder/guard, 058-02's positive pinned `native_attempt` acquisition and 058-03's falsifiable comparator. Zero expected-positive native events, missing provenance, unsupported observation or stale pins are `inconclusive`, not PASS. A paired positive is required for expected-zero controls. |
| C2 - actual replacement | An adopter performs the journey through real serialized chamber/host dispatch with native runtime absent. Record worker execution separately from request attempts, actual dispatch/response and backend receipt. Direct connector invocation is insufficient. |
| C3 - whole sequence | Account for every destination/method/path, ordered query multimap, body/encoding, browser-controlled headers/cookies/credentials, response, redirect/fan-out, ordering/timing, retry, duplicate and cancellation. Include dependency/configuration and auxiliary traffic. No hidden field/branch exclusions or private-encoding invention. |
| C4 - value relationships | Compare authorized same inputs before privacy transformation: identity normalization/hashes, cookie-to-wire IDs, ClickID, event IDs, catalog IDs, timestamps, quantities and monetary values. Pin field-specific generated-value relationships; equal redaction sentinels, field presence and two missing values cannot establish equality. |
| C5 - browser and DOM behavior | Observe URL/referrer/metadata, actual browser storage transitions, callbacks/site behavior and lifecycle effects. No browser-header spoofing or assumption that worker fetch, image, beacon and server proxy are equivalent. A blocked attempt does not establish delivery, cookies or redirects. |
| C6 - governed authority | Main thread only captures/enqueues approved inputs or fulfills bounded privileged operations. Interpretation, mapping, hashing and connector state stay in the chamber; each actual dispatch passes consent and destination checks. Granted authority remains declared intersected with allowed. No ambient DOM, cookie jar or network; no silent stable-core changes. |
| C7 - independent layers | Reports separately name `worker_execution`, `native_attempt`, `actual_dispatch_response`, `backend_receipt`, `matching`, `deduplication`, `catalog_audience` and `attribution`, with pass/fail/inconclusive/unavailable evidence per criterion. Reuse 058's closed report states and exits for supported report layers; do not add a success-shaped fallback. Owner receipt is attributed and unpaired unless directly correlated. |
| C8 - preserve scope and safety | Missing native behavior remains unfinished. CAPI complements browser collection, never substitutes for it; campaign/model/backend implementation is not rebuilt. Further events, production capture, account changes and feature access need separate finite grants. No customer or fake production conversions, automatic deployment or campaign spend. |
| C9 - falsifiable assurance | Each required positive and negative control is capable of detecting loss, extra requests, altered values/routing/consent, incorrect DOM effects and unavailable responses. Evidence limitations block the affected claim; no frozen/global oracle threshold or failing criterion is weakened to obtain green. |

Report state, evidence layer and claimed product support are different fields.
An attempt-layer `qualified` report is not full compatibility. A slice may be
implemented without the complete product being qualified; the inventory must
continue to expose every unresolved behavior and required outcome.

## Native discovery floor

Public documents retrieved on 2026-10-15 supply a floor, not an exhaustive
runtime specification. Later pins include official runtime/configuration bytes,
browser/cohort/settings, dependency closure and documented retrieval provenance.
Unknown commands, endpoints, options, fields and configuration effects become
blocking discovery entries owned by their slice.

The cohort ledger covers desktop Chromium, Firefox and WebKit/Safari, mobile/
iOS WebKit and relevant in-app browsers where native supports the journey;
first/returning, allowed/blocked/partitioned storage, privacy controls, explicit
profile state, cold/warm resources and lifecycle variants are separate rows.
Parent pins exact versions/conditions before execution. Missing access or
observation keeps a required native cohort unfinished, not outside the target.

### Commands and event data

Cover bootstrap queue/aliases/readiness and `init`, `set`, `track`,
`trackCustom`, `trackSingle`, `trackSingleCustom`, `consent` and
`dataProcessingOptions`. Derive invocation, mutation, invalid-input, return and
callback behavior from the pinned reference; do not invent a delivery callback
or assume that `init` itself emits PageView.

The standard-event floor is PageView plus AddPaymentInfo, AddToCart,
AddToWishlist, CompleteRegistration, Contact, CustomizeProduct, Donate,
FindLocation, InitiateCheckout, Lead, Purchase, Schedule, Search, StartTrial,
SubmitApplication, Subscribe and ViewContent [P1, P2, P7].

| Data vocabulary | Types and required discovery |
|---|---|
| `content_category`, `content_name`, `currency`, `search_string` | Strings; preserve Unicode, encoding, omission and policy handling. |
| `content_ids` | String/integer ID arrays; scalar acceptance differs across public guides and must be observed. |
| `content_type` | `product` or `product_group`; preserve catalog relationships and native omission behavior. |
| `contents` | Object arrays with `id` and `quantity`; determine supported price/extra fields and nested serialization, not a guessed private schema. |
| `value`, `predicted_ltv`, `num_items`, `status` | Numeric value/lifetime value, integer count and boolean status as documented; compare actual input-to-wire typing, zero/fractions and invalid values. Purchase requires value/currency in the guide. |
| `delivery_category` | `in_store`, `curbside`, `home_delivery`; preserve native validation. |
| Custom events/properties | Documented custom names up to 50 characters and additional properties; determine nested/null/undefined/nonfinite values, size limits, coercion and errors. Custom conversions are backend rules, not an invented new browser command. |

### Identity, privacy and automatic collection

Manual identity vocabulary is `em`, `ph`, `fn`, `ln`, `external_id`, `ge`, `db`,
`ct`, `st`, `zp`, `country` [P4]. Explicit prehashed email support does not
establish every field's prehashed behavior. CAPI normalization/list types and its
external-ID hashing recommendation cannot be transplanted into Pixel without
same-input native proof.

Distinguish `_fbp`/`_fbc` cookie names from `fbp`/`fbc` wire names and `fbclid`
input; do not mint a fake ClickID. Native lifetimes/refresh/attributes and actual
browser policy effects require observation. The server-cookie 90-day
recommendation [P14] is not a universal native lifetime.

Cover revoke/grant/re-grant queue retention/replay and cookie/collection effects,
`dataProcessingOptions` empty/LDU/location variants, per-Pixel scope and changes.
P17's `dpo`/`vdpo` inconsistency remains unresolved, not an encoding choice.
The query initialization gate is not any of these APIs.

Automatic matching, button/page metadata, automatic standard events and Event
Setup Tool rules are separate discovery/configuration surfaces. DOM dependencies,
manual/automatic precedence, exclusions and remote-config effects require pinned
owned fixtures and governed observation. Private `aud`/`cud`/`ncud` names and
state keys are not a license to invent encodings or infer active features.

## Proposed mediated interfaces, not approved contracts

These are minimum review proposals attached to real journeys, not claims that
the current runtime implements them. Parent must identify existing mechanisms
and reuse them before choosing new types. An extension must fit ADR-0017 or
obtain its explicitly required decision/version treatment before implementation.
No general DOM proxy, cookie store or unrestricted transport is proposed.

| Proposal | Typed operation envelope and ceiling | Owning slices |
|---|---|---|
| Command capture | Ordered call record: `pixelRef`, `command`, bounded immutable argument snapshot, sequence, capture time and consent version. Host captures; chamber interprets. Caller-visible fbq semantics are reference-derived; frozen `push()` remains synchronous/void. Reject/diagnose unsupported input rather than silently succeeding. | 01-03 |
| Scoped vendor-cookie operation | `pixelRef`, owner-declared origin/scope reference, exact name from `_fbp`/`_fbc`, read/write/delete operation, chamber-prepared value and policy-ceiling attributes. Host applies only authorized domain/path/expiry/security attributes; returns observed/applied/denied/unavailable status privately. No arbitrary cookie enumeration, cross-site access or Airlock identity-resolution service. | 05-06 |
| Browser transport fulfillment | Chamber-prepared serialized destination/method/query/body, explicit allowed transport/credential scope, byte limit and consent version. Host rechecks the seal for each attempt and redirect branch; browser controls forbidden headers/cookies. Return separately observed attempt, dispatch, response/opaque and failure states, not fabricated delivery. | 01, 05, 09-10 |
| Bounded DOM observation | Owner-registered root/field references, allowed event types/attributes, finite snapshot fields and consent version. Host captures approved input/metadata plus opaque element references; chamber applies rules/normalization. No arbitrary selector execution, callable code, raw-node transfer, full mutation stream or unrelated form values. Numeric work/retention limits come from measured reference needs. | 07-08 |
| Configuration snapshot | Authorized per-Pixel source reference, version/integrity provenance and bounded configuration representation; chamber interprets evidence-backed options. Unknown fields/behavior stay visible. No main-thread evaluation of remote rules or native runtime hidden inside the replacement. | 03, 07-08, 12 |
| Lifecycle dispatch lease | Bounded browser lifecycle signal and pre-serialized request lease tied to purpose/destination/consent version; host fulfills only while the seal allows. No main-thread mapping/hashing, blocking unload or assumed exactly-once survival. Stale identity/consent cannot be replayed. | 09 |

No-JavaScript execution has no worker to fulfill these operations. Slice 09 must
establish a separately governed site-owned fallback path and its prerequisites,
without silently re-adding the omitted static image or assuming an edge service
exists. If controlled evidence demonstrates a real contradiction, parent routes
that one contradiction to the owner; neither dropping no-JavaScript behavior nor
weakening the seal is a default.

## Inventory-to-journey coverage

All 20 inventory families are assigned below. Coverage is planned ownership,
not proof. The discovery blockers in plan.md and each Definition of Ready (DoR)
must be resolved before that journey is implementable.

| Family | Owned end-to-end slices | Required scenario families |
|---|---|---|
| F01 bootstrap/queue/init | 060-01 | SC01, SC18 |
| F02 standard/commerce | 060-02 | SC03, SC18 |
| F03 custom data/events/conversions | 060-02, 060-11 | SC04, SC18 |
| F04 multi-Pixel | 060-03, 060-04, 060-06 | SC05, SC06, SC07, SC08 |
| F05 set/configuration | 060-01, 060-03, 060-07, 060-08 | SC05, SC08, SC10, SC18 |
| F06 consent | 060-04, 060-09 | SC06, SC11, SC13 |
| F07 processing/privacy | 060-04 | SC07, SC11 |
| F08 manual/prehashed matching | 060-06, 060-09 | SC08, SC05, SC13 |
| F09 identity transitions | 060-06 | SC08, SC02 |
| F10 automatic matching | 060-07 | SC09, SC10, SC06 |
| F11 automatic events/DOM | 060-08, 060-09, 060-12 | SC10, SC09, SC12, SC17 |
| F12 runtime/config provenance | 060-01, 060-03, 060-07, 060-08, 060-12 | SC01, SC05, SC09, SC10 |
| F13 first-party/click continuity | 060-05, 060-10 | SC01, SC02, SC11, SC14 |
| F14 transport/browser | 060-05, 060-09, 060-12 | SC11, SC13, SC17 |
| F15 SPA/lifecycle | 060-09 | SC12, SC13, SC18 |
| F16 event IDs/deduplication | 060-10, 060-09 | SC14, SC03, SC04, SC13 |
| F17 helper/diagnostics | 060-11 | SC15, SC18 |
| F18 catalog/audiences | 060-02, 060-11 | SC16, SC04, SC03 |
| F19 invocation/errors | 060-01, 060-02, 060-09, 060-11 | SC18, SC01, SC12 |
| F20 performance/confinement | 060-12, 060-07, 060-08, 060-09 | SC17, SC10, SC13 |

All 18 scenarios have concrete journey owners: SC01 -> 01/05, SC02 -> 05/06,
SC03 -> 02/10, SC04 -> 02/11, SC05 -> 03, SC06 -> 04/07, SC07 -> 04,
SC08 -> 06, SC09 -> 07, SC10 -> 07/08, SC11 -> 05/09, SC12 -> 08/09,
SC13 -> 09/10, SC14 -> 10, SC15 -> 11, SC16 -> 02/11, SC17 -> 07/08/12,
SC18 -> 01/02/03/09/11. New native discoveries extend these rows or block the
claim; this is not a closed-world enumeration of all future vendor behavior.

## Assumptions

- Unverified: the complete required native behavior can be discovered with
  discriminable references. A narrow retained headed PageView reference now
  exists; other commands/events/identity/configuration/cohorts remain unqualified.
- Unverified: required cookie, transport, configuration, DOM and lifecycle work
  can fit precise mediated operations without breaking the stable core or CWV.
  No actual invariant contradiction is demonstrated by the present evidence.
- Unverified: current source offers suitable extension seams and preserves
  generic-pixel/other-vendor behavior. Parent must establish those code facts,
  not infer them from old specs or this proposed design.
- Unverified: feature-specific owned access and lawful outcome observations can
  qualify matching/attribution. Source creation and Test Events receipt alone
  do not establish that access or evidence.
- Unverified: a no-JavaScript path can preserve required native behavior and the
  owner's query policy on a static/edge site. No implementation is presumed.

## Decomposition

Use the Paths, Data, Rules and Interfaces axes of SPIDR (vertical splitting;
see [workflow](../../workflow.md#spidr-splitting)). Each slice gives an adopter
or operator a working input-to-browser-to-official-endpoint journey and an honest
report. There is no parser-first, worker-first or UI-last phase and no research
spike standing in for a deliverable. Native discovery stays inside each journey's
readiness gate. All slices remain DRAFT with blank reconciliation dates.

## Slices

- [060-01 - Replace bootstrap and first PageView](slice-01-pageview-entry.md)
- [060-02 - Report complete event and commerce data](slice-02-event-journeys.md)
- [060-03 - Route and configure multiple Pixels](slice-03-pixel-routing.md)
- [060-04 - Apply consent and processing choices](slice-04-consent-processing.md)
- [060-05 - Preserve anonymous and click continuity](slice-05-browser-continuity.md)
- [060-06 - Match explicit identity through account changes](slice-06-manual-identity.md)
- [060-07 - Match approved forms automatically](slice-07-automatic-matching.md)
- [060-08 - Preserve code-less event and metadata collection](slice-08-automatic-events.md)
- [060-09 - Measure navigation, exit and no-JavaScript journeys](slice-09-lifecycle-nojs.md)
- [060-10 - Correlate browser and server events](slice-10-event-correlation.md)
- [060-11 - Diagnose connected product collection](slice-11-product-diagnostics.md)
- [060-12 - Cut over, roll back and maintain assurance](slice-12-adoption-assurance.md)

### Separate construction and evaluation preparation

The twelve journeys above remain the product parity target. Completed
060-13/14 construction retains its recorded local scope. The owner selected
one additional preparation packet on 2026-11-05:

- [060-15 - Prepare the Meta reference matrix and autonomous evaluation](slice-15-autonomy-evaluation-preparation.md).
- [060-16 - Evaluate one pinned PageView against the actual worker](slice-16-pinned-pageview-evaluation.md).
- [060-17 - Classify retained PageView data and add governed timing](slice-17-pageview-semantic-closure.md).
- [060-18 - Govern persisted first-PageView referrer state](slice-18-governed-referrer-storage.md).
- [060-19 - Prepare one private referrer and timing comparison](slice-19-referrer-timing-comparison.md).
- [060-20 - Distinguish worker cache behavior and prepare a real timing transition](slice-20-sampling-cache-discriminant.md).
- [060-21 - Prepare a bounded native timing comparison](slice-21-native-timing-comparison-source.md).

That packet may adjust the scoped Meta oracle and author proposed evals.
It does not approve their ground truth, complete product journeys or
commission a full native/live/unattended programme.

The separately owner-selected 060-16 packet uses explicit retained sources
for one reviewed local/no-send comparison and directly evidenced experimental
fixes. It preserves 060-01's claim and full criteria, and does not invoke the
parked inspected-native path or renew earlier case grants.

The subsequent 060-17 packet is offline semantic/timing work against those
retained originals. It adds no SDK/browser run or new storage authority and
does not qualify the missing native timing relationship.

060-18 completed the separately accepted local referrer capability. The new
060-19 packet recorded one own-input `ler`/`plt` comparison without broadening
that permission. Source/operational reviews and separate observer/exact-run
decisions passed before the one operation. It returned inconclusive
`sample-unresolved` across three contexts; API cleanup completed, while
process/profile/host cleanup remains unknown. The grant is spent. Neither packet
changes the full 060-01 claim or C1-C9.

## Public references

The following were retrieved during the bounded documentation turn on
2026-10-15; no new external requests were made for this packet.

| ID | Official source and evidence limit |
|---|---|
| P1 | [Get started](https://developers.facebook.com/documentation/meta-pixel/get-started): bootstrap/explicit PageView, requirements and noscript example. |
| P2 | [Reference](https://developers.facebook.com/documentation/meta-pixel/reference): standard-event and property tables, not a complete private runtime schema. |
| P3 | [Advanced](https://developers.facebook.com/documentation/meta-pixel/advanced): multi-Pixel, autoConfig, metadata, image examples and signals/config paths; lightweight IMG is not full fbevents behavior. |
| P4 | [Advanced matching](https://developers.facebook.com/documentation/meta-pixel/advanced/advanced-matching): manual fields, hashing, explicit raw/prehashed email and image ud examples. |
| P5 | [Consent](https://developers.facebook.com/documentation/meta-pixel/implementation/gdpr): revoke/grant, not an exhaustive queue/storage state machine. |
| P6 | [Browser/server deduplication](https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events): eventID/eid relationships and source-specific limits; no blanket browser-only deduplication. |
| P7 | [Conversion tracking](https://developers.facebook.com/documentation/meta-pixel/implementation/conversion-tracking): standard/custom data, custom conversions and policy restrictions. |
| P8 | [Website audiences](https://developers.facebook.com/documentation/meta-pixel/implementation/custom-audiences): collection inputs versus backend audience rules. |
| P9 | [Catalog guide](https://developers.facebook.com/documentation/meta-pixel/get-started/advantage-catalog-ads): catalog-ID relationships; requirement wording differs from P2. |
| P10 | [Helper/Data Advisor](https://developers.facebook.com/documentation/meta-pixel/support/meta-ads-data-advisor): former Pixel Helper, diagnostics versus optional privileged automation. |
| P13 | [CAPI customer information](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters): cross-channel reference, not a universal Pixel input schema. |
| P14 | [fbp/fbc and ClickID](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/fbp-and-fbc): cookie/parameter distinctions; server guidance is not native lifetime proof. |
| P17 | [Processing options](https://developers.facebook.com/documentation/meta-pixel/implementation/data-processing-options): API/image examples with dpo/vdpo inconsistency. |

Automatic-matching, setup, cookie-settings and attempted Event Setup Tool
Business Help bodies were not readable; the attempted Pixel documentation index
was unavailable and cookie policy retrieval was partial. No content from those
unreadable pages is treated as verified. Private runtime configuration and
controlled owned references, not guesswork, must close the relevant gaps.
