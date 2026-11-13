---
status: IN_PROGRESS
skill: spec-workflow
use_cases: [UC-4, UC-5, UC-6, UC-7, UC-8, UC-9, UC-10, UC-11, UC-13, UC-14]
---

> **Rescoped 2026-11 by [spec 065](../065-google-ads-parity-inventory/spec.md) (ADR-0061).** The goal now lives in spec 065's frozen parity inventory and slice list (T1, T2, G0, CAP, G1 to G14). Slices 059-01 to 059-12 and 059-15 are ABANDONED. 059-13, 14, 16, 17, 19, 20, 21 stay DONE; 059-18 stays DEFERRED (Meta, spec 066). plan.md and tasks.md are history.

# Spec 059: Full Google Ads browser-tag compatibility

An adopter can replace the native Google Ads browser tag without losing its
features or changing attribution-bearing behavior. Construction is staged, but
missing native behavior remains unfinished work, not an acceptable subset.
The main tradeoff is that complete browser behavior needs qualified native
evidence and narrowly mediated host operations without giving vendor code
ambient access or moving unbounded work onto the main thread.

**Full-compatibility preparation only.** Of the twelve product-feature slices, the first
is READY_FOR_REVIEW for authoring and the other eleven remain DRAFT. That
first product slice has passed its blocked-draft premise review, not boundary
fit, implementation readiness or implementation review. Operator-preparation
tooling below has separate local code/evidence gates and does not change
production runtime behavior. The first-path plan proposes a
finite paired validation envelope; no live permission is granted by this text.
[ADR-0040](../../decisions/adr-0040-reframe-onto-full-google-meta-compatibility.md)
is **Accepted** for the target/framing only; [058](../058-native-tag-evaluation-qualification/spec.md)
supplies local controls, selected native attempts and offline sequence/control
comparison. Independent full native/chamber comparisons, access and readiness
remain open. The actual qualification and scope prerequisites
are not satisfied merely by accepting the target.
The reservation remains provisional until the parent checks trunk collisions.

[059-19](slice-19-offline-conversion-prototype.md) implements a separate
synthetic-only offline conversion prototype using actual worker/local dispatch.
Two distinguishable conversions preserve controlled route/value relationships
at a real loopback receiver; pending/denied and grant-without-new-command
controls produce zero arrivals. Its report accounts for12 retained native-shape
rows/62 query names and remains INCONCLUSIVE.
It does not change the twelve full-compatibility journeys,059-01 readiness,
live authority or production behavior; a local primary request is not a
complete native conversion sequence.

[059-16](slice-16-chamber-capture.md) defines the independent SDK-absent
chamber-capture qualification path required by the first-journey plan. It
uses only synthetic first-party loopback fixtures and legacy built workers,
without bypassing the fresh-setup gate on live native cases or promoting
the first product slices to implementation-ready.

[059-17](slice-17-attempt-chamber-comparison.md) is DONE for the separately
reviewed attempt-layer consumer prerequisite: offline diagnostics between
retained native attempts and the distinct real-worker chamber capture.
It does not qualify whole wire, equivalent inputs/cohorts or full replacements.

The owner separately authorized one additional bounded Meta stock case at
2026-10-21T18:33:04.581Z and delegated routine preparation/scheduling.
[059-18](slice-18-additional-meta-authority.md) implements the new closed,
lineage-bound authority under [ADR-0042](../../decisions/adr-0042-additional-one-shot-meta-authority.md).
The original spent slot is never refunded; no new case is admitted by this
authoring/readiness checkpoint.

An additional operator-preparation slice,
[059-13](slice-13-validation-admission.md), implements the network-agnostic
admission component and local receiving-sink controls. It does not add a
thirteenth product-feature path, qualify a live browser guard, or waive 059-01's
complete-native-wire, performance and authority prerequisites.

[059-14](slice-14-browser-admission.md) adds the actual local browser/capture
controls needed before a future live guard can be qualified. The owner approved
the bounded four-case envelope on 2026-10-19, conditionally; no live case is
admitted by that approval or by adding this slice.

[059-15](slice-15-native-stock-capture.md) connects the exact native policy,
confined transparent HTTPS and durable one-shot stock capture. Its bounded
first Meta stock run remains conditional on actual qualification/reviews and
fresh case preflight; no native event or product implementation is implied by
authoring the slice.
Its original opaque-transport path remains blocked by verified hidden HTTP
retries. An owner-approved, separately labelled local TLS-inspection experiment
now exercises physical-count enforcement without spending a live slot. The
owner subsequently approved a conditional inspected Meta stock reference in
[ADR-0041](../../decisions/adr-0041-inspected-meta-stock-reference.md), not
immediate execution or browser-native TLS parity. The original Meta stock
case subsequently ran once and is spent/inconclusive, with no complete
reference; its chamber remains blocked and the other three slots unused.
All remaining native gates and the consumed canonical reservation are preserved.

## Remaining work and next authoring step

**Google resumed by the owner (2026-11-05).** Complete the first Google
conversion autonomously under the [current plan](plan.md#current-assignment-complete-the-google-conversion---2026-11-05).
The owner approved the bounded inspected reference in
[ADR-0052](../../decisions/adr-0052-inspected-google-reference.md), subject to
source and safety review. Meta remains with its parallel session.
059-20/21 are DONE for their local scopes; neither is the next draft or a
qualified full conversion. Full059-01 remains READY_FOR_REVIEW.

The [delivery queue](../../releases/vendor-parity-assurance.md#googlemeta-delivery-queue-2026-10-26)
maps every documented remaining feature to its existing059/060 owner and
separates product construction, reference evidence and adoption. Its dated
instructions are historical following the owner pause. Later02-12 remain
DRAFT, not ready to implement from their presence in the queue.

## Overview

The hard contract is the complete request/response and host-effect sequence
under equivalent inputs and browser state. The target includes every applicable
Google Ads browser feature, not merely the presently documented field list.
The [vision use cases](../../product-vision.md#use-cases) anchor migration,
native-runtime-free advertising, consent, governance, configuration, diagnostics,
comparison, performance, pinned deployment and upgrades.

Keep the [airlock/chamber boundary](../../memory/glossary.md): the host captures
approved inputs and fulfills bounded privileged operations; the isolated worker
interprets commands, maintains connector state, normalizes/hashes data and builds
requests. Core Web Vitals (CWV), security and fault isolation are independent
acceptance requirements. An application programming interface (API) addition
must not silently change the stable core frozen by
[ADR-0017](../../decisions/adr-0017-airlock-1-0-api-contract.md).

### Scope and non-substitutions

- Reimplement Google Ads browser command semantics, conversion and audience
  collection, identity continuity, consent, enhanced matching, website calls,
  remote configuration behavior and relevant browser/lifecycle paths. Currently
  vendor-supported legacy entrypoints also require discovery and coverage;
  legacy documentation is not evidence that every historical API is still supported.
- Preserve required coexistence with native Google Analytics 4 (GA4) and Google
  Tag Manager (GTM). Do not reimplement all GA4, arbitrary GTM containers or
  JavaScript evaluation, Floodlight, native mobile-app SDKs, the AMP framework
  itself, or vendor backends. Required browser-tag behavior on supported mobile
  and AMP journeys remains in discovery/coverage; framework dependency is not a
  feature exclusion. Shared dependencies and interactions cannot be silently dropped.
- Direct Ads tagging does not universally require GA4 import/linking. Merchant
  feeds, customer-data terms, call resources and offline lead imports are
  feature-specific prerequisites, not substitutes for the browser leg.
- Do not substitute server-side APIs, a hidden native bootstrap, a privileged
  SDK wrapper, or a locally generated expected payload for actual chamber
  replacement. No unrestricted DOM, storage, credentials or network proxy.
- Preserve the Adobe-first release scope. Adobe's downstream reporting
  follow-up decision is not a waiver for Google matching/reporting/attribution.
  This packet does not change another spec, an Accepted record, a board, or a
  release gate.

### Evidence available, and what it does not establish

The explicitly supplied private handles below are the only evidence inputs
used for this draft. No repository implementation was explored.

| Input handle | Supplied artifact or resource | Evidence boundary |
|---|---|---|
| `ADS-INVENTORY` | `google-ads-compatibility-inventory.json` | 28 documented feature families, public sources retrieved 2026-10-15, explicit unknowns; not an exhaustive native protocol. |
| `ADS-SYNTHETIC-COVERAGE` | `google-ads-saved-capture-coverage.json` | The examined committed fixture calls itself real-shaped, **not real**; field vocabulary is not a native capture. |
| `ADS-NATIVE-LEDGER` | `google-ads-owned-native-wire-ledger.json` | All 12 observed request ordinals and 62 query names accounted for; no full-chain or compatibility claim. |
| `ADS-NATIVE-RAW` / `ADS-NATIVE-CHECK` | Parent-supplied private native evidence and sanitized scope check underlying that ledger | One conversion command, primary HTTP 200 and input value/currency/transaction relationships; secondary labeled response absent, two auxiliary attempts blocked by our gate, two bodies unavailable. |
| `OWNED-RESOURCES` | Explicit parent-supplied private owned-validation resource manifest | Owner-controlled Secondary action exists; authority for future events, feature eligibility and complete validation is not implied. |

Handles are symbolic inputs resolved by the operator at invocation. No private
path, owned URL, ID, cookie, credential, raw payload or value-derived hash belongs
in Git. Missing handles produce a blocked/inconclusive result, never scanning
other sessions, credential discovery, a download or an automatic live resend.
Relevant manifest selectors are `google.destination`, `google.conversion_label`,
`google.optimization`, `google.enhanced_conversions`, `google.native_smoke`,
and `site.live_origin`/`site.duplicate_rule`; actual values remain private.

The native ledger strengthens F05/F27 but closes no family. Its primary response
contains a fetch URL matching a second labeled request and an unobserved fallback
reference. Our two blocked auxiliaries are **guard interventions**, not native
suppression. Two unavailable bodies and missing runtime bytes/version prevent
using that smoke as the required complete reference. A duplicate query key occurs;
native `rnd` differs from `auid`, unlike the earlier synthetic fixture. Neither
blanket redaction nor dictionary-only comparison is an adequate oracle.

The 2026-10-16 input-readiness check confirms the original recording contains
three measurement-response bodies, but not the official Google loader or
effective configuration/dependency bytes. The new 058-02 Meta attempted-reference
profile cannot qualify Google by analogy. A later explicit owner grant permits
inert owned script/configuration acquisition and offline qualification under
058-04. Its newly pinned loader now produces selected positive/off/value
attempt receipts, with all primary and auxiliary measurements aborted; the
shared slice record carries its actual close-out state. Unknown/contaminated runs stay inconclusive,
and no universal repeatability is claimed. This new cohort does not recover
historical bytes/responses or authorize a live resend.

Any statement about present connector, host, boot or test capabilities remains
**unverified** until the parent performs authorized semantic-index/source
investigation. The slices below prescribe future behavior, not existing code.

### Evidence layers and shared prerequisites

Consume 058 by named qualified layer, not its rollup status:

058-03's exact reference copies and complete local synthetic controls qualify
the comparator only. They do not supply independent candidates, full native
responses/cookies/host effects or reviewed native cross-run normalization.

| Layer | Required evidence | Cannot establish |
|---|---|---|
| `local_network` | 058-01 positive local sink, pre-execution guard, complete async drain and failure/marker-loss controls | Native execution, actual vendor dispatch or any compatibility/outcome claim. |
| Native attempted reference | Shared 058-02 controls and the Google-specific 058-04 qualified positive with exact runtime/configuration/browser/input closure, declared window and every in-scope attempt | Real cookie attachment/acceptance, unexecuted redirects/responses, receipt or attribution when intercepted. |
| Sequence/value comparison | 058-03 complete references, path-specific rules and falsifiable mutations | Worker execution or vendor outcomes merely because a comparator passes. |
| Actual chamber execution | Trace from adopter entry through serialized airlock dispatch to the actual isolated worker and governed host operations | Wire delivery if blocked; model/unit mapper output cannot satisfy this layer. |
| Actual vendor dispatch/response | Separately authorized owned request, browser credentials/headers, real response and dependent branches | Accepted/countable product conversion, matching, reporting or attribution. |
| Product receipt/matching/reporting | Scoped dated product evidence, identified action/configuration and permitted correlation | Attribution or matching efficacy based only on HTTP status, a callback or a hash-shaped field. |
| Attribution | Legitimate permitted interaction/journey, attribution/count/window settings and sufficient independently observed product outcome | Universal modeled/cross-device equivalence from one event. |

Before **059-01 implementation**, ADR-0040 must be Accepted, 058-01/02/03
and Google-specific 058-04 must satisfy their reviewed dependency gates for the
exact scenario and browser, numerical performance limits must be pinned, and the complete direct
conversion reference must be available. Further event authority is a separate
finite parent grant. The historical smoke satisfies none of these by implication.

### Whole-request, response and host-effect contract (C1)

Every slice inherits C1 and must enumerate its fixture scenarios before readiness:

1. Pair native and chamber runs on equivalent effective input, consent timeline,
   account/action/remote configuration, browser/privacy/region, cache and state.
   Standalone replacement never boots the native Google runtime, including to
   seed a first visit. Returning chamber state must also originate in earlier
   chamber-only visits; equivalent preseed controls are additional, not a shortcut.
2. Account for every request class: application/native runtime acquisition,
   configuration, measurement, identifier/cookie, consent, auxiliary and response
   branches. Distinguish replaced executable acquisition from required product/
   configuration behavior explicitly; never silently filter a class from the
   whole ledger. Executable-byte equality is not itself the replacement target.
   Unknown native remote behavior remains blocking discovery.
3. Compare exact destination scheme/host/port/path, method, ordered duplicate query
   pairs, encoding and body bytes/content type; request multiplicity, browser
   headers/client hints/referrer policy, cookie/credential attachment and rejection,
   all relevant storage operations/attributes, and initiator/worker/host context.
   A null body capture or missing extra headers is unknown, not an empty value.
4. Compare responses/status/headers/body availability, Set-Cookie outcomes,
   redirect hops/method changes, response-supplied fetch/fallback/DOM actions and
   resulting request branches. Preserve causal order and strict order where
   required; allow genuinely concurrent order only with a justified rule.
   Record timing, batching, retries, duplication, cancellation and callbacks through
   a finite justified window with pending capture work drained or explicitly failed.
5. Compare host effects: bounded cookie/local-storage state, decorated links/forms,
   navigation, phone text/tel targets, callback values/count/order, listener effects
   and application noninterference. A failed grant must be observable; no silent
   success or automatic native fallback.
6. Pin each nondeterministic path's rule before evaluation: identical controlled
   values, exact normalization/hashes, stable reuse, rotation, uniqueness,
   inequality, array association, timestamp relation, or native-observed range.
   Unknown paths are not ignored. Preserve cross-request/input/state relationships
   privately before sanitizing; equal sentinels are never equal identities.
7. Require a qualified **positive native reference** for every asserted path.
   A legitimate expected-zero control is linked to its positive. Dropped request,
   changed target/label/value/currency/order/identity/consent, wrong body/header,
   duplicate conversion, lost cookie, truncated response, removed branch and
   empty reference must be detected. Missing observation is `inconclusive`;
   a complete material difference is `nonconformant`, never a gap-owned PASS.
8. Use 058's closed states and exits: `qualified`/0 only for its explicitly named
   layer, `nonconformant`/1, `inconclusive`/2, `invalid_input`/3. Expose actual worker,
   attempted wire, actual dispatch, product receipt, matching and attribution as
   separate claims with separate evidence. A local result cannot promote them.

### Scenario floor (C2)

Each family owns an explicit case ledger across applicable axes: first/returning
native and chamber-only visitors; direct and legitimate click-associated journeys;
same-page, multipage, subdomain and cross-domain transitions; cookie/local-storage
allowed, blocked, cleared, expired and partitioned cohorts; pinned Chromium,
Firefox, Safari/WebKit and relevant mobile versions; region/privacy differences;
all independent consent types, basic and advanced modes, defaults/updates/
revocation; slow/offline/error/redirect network; immediate navigation, form,
hidden/pagehide/unload and back-forward-cache restore; multiple tabs; delayed
worker start, chamber failure and queue pressure; multiple Ads destinations and
native GA4/GTM coexistence.

The precise supported version/cohort matrix and observation windows are pinned
before dependent work. Pairwise cases may prioritize discovery but cannot replace
feature-critical interactions or mark untested cases supported. Account-ineligible,
undocumented or unobservable required behavior remains blocked. An inapplicable
browser feature needs dated native/vendor evidence and a bounded applicability
statement, not a feature exclusion disguised as an empty case.

### Performance and core-contract readiness (C3)

Before dependent implementation, the parent pins an evidence-backed acceptance
manifest: no-tag/native/chamber controls; browser/device/CPU/network/cache/consent/
DOM/traffic conditions; sampling/repetition/noise policy; good-band CWV obligation;
numeric LCP, INP and CLS limits and deltas; main-thread CPU/long-task, host-operation,
worker startup/clone/queue/callback/navigation latency, memory and byte budgets.
LCP means Largest Contentful Paint, INP Interaction to Next Paint, and CLS
Cumulative Layout Shift; see [project terms](../../memory/glossary.md).
**No numeric threshold is invented or pinned by this draft.** Missing limits or
unsupported measurement conditions block readiness, not merely the last slice.

Every slice measures its complete delivered path against that manifest and checks
isolation/denied grants. Do not buy speed by dropping traffic, delaying it outside
the window, scanning the whole DOM without a bound, or using native work.
Additive experimental configuration is not blanket approval to extend a frozen
type, stable handle, synchronous void `push` contract, capability grant law or
seam. A demonstrated conflict gets one bounded owner decision and any required
superseding record before implementation; this packet chooses no break.

## Family-to-slice coverage

All 28 inventory families have a primary vertical owner. Cross-cutting C1-C3
apply everywhere; unknown native encodings and applicability are blockers, not
exclusions. `Uxx` below refers to `ADS-INVENTORY`'s explicit unknowns.

| Family | Required surface | Primary slice | Additional coverage / blocking discovery |
|---|---|---|---|
| F01 | gtag initialization, queue and argument semantics | 059-02 | 01 conversion entry; 11 coexistence; U01/U02 native queue/reentrancy/repeated config. |
| F02 | IDs, labels, groups, send_to, precedence | 059-02 | 01/06 conversions; 11 multi-product ownership; U03/U12 aliases/fanout. |
| F03 | get, callbacks, timeout, navigation | 059-02 | 01 initial callback; 09 phone callback; U02/U03/U16 supported fields/failure timing. |
| F04 | page context, history, automatic events | 059-10 | 01/05 page collection; 08 extraction; U04/U18 remote triggers. |
| F05 | labeled conversions/value/currency/transaction | 059-01 | 06 repeats/rich orders; U01/U17 complete dispatch/response/product evidence. |
| F06 | duplicate/reload/count behavior | 059-06 | 01 fanout is not duplicate conversion; U16/U17 native attempts versus server counting. |
| F07 | standard remarketing and suppression | 059-05 | 03 privacy; U05/U12 account/audience and full branches. |
| F08 | dynamic events and all business verticals | 059-05 | U05/U18 feed-key schemas, matching and native sequences. |
| F09 | cart data/feed/revenue/profit | 059-06 | U06/U17 direct Ads id versus imported item_id/event behavior. |
| F10 | custom variables/activation | 059-06 | U07 complete browser serialization and product activation. |
| F11 | new/returning customer acquisition | 059-06 | U08 additional current acquisition extensions cannot be silently omitted. |
| F12 | manual raw/prehashed enhanced data | 059-07 | 08 collection variants; U09/U10 full normalization/arrays/terms. |
| F13 | selector/JavaScript-variable collection | 059-08 | U04/U11 bounded extraction and timing, no arbitrary evaluation. |
| F14 | automatic detection/exclusions | 059-08 | U09/U11 native detection, precedence and bounded host feasibility. |
| F15 | browser lead collection/offline joins | 059-08 | U09/U17 separate offline dependency, not backend implementation. |
| F16 | basic zero-send consent | 059-03 | U03/U14 initialization/queue behavior; remains required. |
| F17 | advanced cookieless independent types | 059-03 | U13/U14 actual codecs/endpoint/credential behavior; remains required. |
| F18 | defaults/update/wait/regions/revoke | 059-03 | 04 continuity, 10 lifecycle; U12/U14 exact transition rules. |
| F19 | redaction/personalization/RDP/service sharing | 059-03 | 07/08 privacy negatives; U05/U13 exact fields/leaks. |
| F20 | click IDs/cookies/storage/lifetimes | 059-04 | 01 initial state; 07/09 joins/cache; U10/U11 lawful bounded writer and native schemas. |
| F21 | cross-domain linker/form decoration | 059-04 | 11 shared ownership; U15 native token validation/interoperability. |
| F22 | denied-storage URL passthrough | 059-04 | 03 redaction inputs; U14/U15 same-domain/redirect/braid behavior. |
| F23 | website-call lookup/cache/DOM | 059-09 | U10/U14/U16 current native consent and response-driven behavior. |
| F24 | remote config, provenance and drift | 059-10 | 01 pins; 12 stale assurance; U12/U18 dependency/config closure. |
| F25 | multiple destinations/native GA4/GTM | 059-11 | 02 routing; U02/U12 hidden native Ads auto-load/noninterference. |
| F26 | browser privacy/attribution mechanisms | 059-10 | 12 attributed outcome; U19 current native use, not an old API overview. |
| F27 | transport/credentials/redirect/retry/lifecycle | 059-10 | Every path, especially 01/04/09; U01/U05/U16 complete sequences. |
| F28 | CWV/isolation/failure/performance | 059-12 | C3 and per-slice measurements before readiness; U20 numeric pin. |

## Blocking discovery and authority register

| Block | Required resolution before dependent readiness | Owner / consumers |
|---|---|---|
| B1 | ADR-0040 frame review/acceptance and 058's exact Google layers, positive references and mutation controls. | Parent; all slices. |
| B2 | Capture closure: secondary labeled response, unavailable rmkt/ccm bodies, marker-loss auxiliary ownership and fallback branch conditions. Recover historical evidence only if retained; never recast our blocks as native. | Parent 058/reference owner; 01/05/10. |
| B3 | Official runtime/module bytes, remote settings, browser/cohort manifest and versioned input provenance. Missing loader bytes cannot be reconstructed from build hints. | Parent reference owner; all slices. |
| B4 | Numeric performance/latency/memory/retention budgets pinned from measured controls and owner-reviewed interpretation. | Parent; C3 before implementation. |
| B5 | Governed storage, credentialed transport, synchronous linker, extraction and phone-render designs fit frozen contracts. Inspect actual surfaces before choosing an API. Escalate only a demonstrated contradiction, one at a time. | Parent shared-API owner with relevant slice. |
| B6 | Feature access: customer terms/unified enhanced settings, feeds/Merchant Center, custom variable activation, acquisition settings, owned domain peers and eligible call resources. | Parent/account owner; feature-specific slices. |
| B7 | gtag get/queue edge semantics, dynamic/cart/custom/acquisition schemas, consent encodings, braid/linker codecs, auto-detection and browser-attribution participation. | Vendor owner in authorized bounded discovery inside each owning path. |
| B8 | Legitimate downstream receipt/matching/reporting/attribution evidence and correlation plan. No fake click, replayed purchase or HTTP-only substitute. | Parent/formal validation owner; each path and 12. |

Vendor-cookie support is required work, not permission for a general first-party
identity service. ADR-0040 and the vision now distinguish that no-go from required
vendor-cookie continuity. This is prospective governed design work, not an
approved writer implementation, ambient jar or stable-core break.
Likewise, documentation saying phone consent support is pending requires bounded
native discovery; it is not permission to send without Airlock consent controls.

## Assumptions

- A1 (unverified): every required Ads behavior and remote variation can be
  discovered and discriminated by the planned positive/negative evidence.
  The 28-family document inventory and partial smoke do not prove completeness.
- A2 (unverified): required cookie, browser-credential, click-time linker,
  automatic extraction and rendering paths can be safely mediated within the
  stable-core contract and C3. Source/API feasibility has not been investigated
  in this authoring turn; no API break is selected.
- A3 (unverified): feature-specific eligible owned resources and legitimately
  correlated product/matching/attribution evidence will become available.
  The Secondary action and one HTTP result do not establish this.
- A4 (unverified): suitable browser observation can close every relevant
  response/lifecycle/credential branch with bounded capture. 058 must prove its
  declared surface; unsupported observation remains blocking.

## Decomposition

Use SPIDR Rules/Data/Paths/Interfaces, not horizontal parser/worker/UI phases.
Each slice owns an adopter-visible complete path, actual worker delivery,
its relevant evidence and operator diagnostics. Research of unknown wire
behavior is a blocking prerequisite **within that path**, not an unbounded
spike before a monolithic implementation. Earlier completed paths remain
explicitly scoped; the full-replacement claim is withheld until the whole matrix
and separate downstream obligations pass.

## Slices

1. [059-01 - owned direct conversion cutover](slice-01-owned-conversion.md)
2. [059-02 - command routing and callback journeys](slice-02-command-journeys.md)
3. [059-03 - consent-respecting measurement journeys](slice-03-consent-journeys.md)
4. [059-04 - returning and linked journeys](slice-04-identity-linker.md)
5. [059-05 - audience and dynamic remarketing journeys](slice-05-remarketing.md)
6. [059-06 - rich purchase and counting journeys](slice-06-rich-purchases.md)
7. [059-07 - manual enhanced matching journeys](slice-07-manual-enhanced.md)
8. [059-08 - automatic and lead matching journeys](slice-08-automatic-leads.md)
9. [059-09 - website-call forwarding journey](slice-09-website-calls.md)
10. [059-10 - remote rules and browser lifecycle journeys](slice-10-remote-browser.md)
11. [059-11 - mixed-tag migration and rollback](slice-11-adoption-rollback.md)
12. [059-12 - full-portfolio adoption qualification](slice-12-portfolio-qualification.md)

### Local construction follow-up

[059-21 - local dataLayer entry](slice-21-local-datalayer-entry.md) connects
the standard queued `gtag` stub to the existing local chamber without manual
draining after each append. It is a bounded local construction task, not a
replacement for 059-01 or an additional full-compatibility family.

## Collected public reference anchors

Retrieved 2026-10-15 in `ADS-INVENTORY`; no fresh network retrieval in this turn.
These describe intended interfaces, not private wire codecs or observed support.

| Subject | Official reference |
|---|---|
| Commands/precedence; controls; routing | [API](https://developers.google.com/tag-platform/gtagjs/reference), [parameters](https://developers.google.com/tag-platform/gtagjs/reference/parameters), [routing](https://developers.google.com/tag-platform/gtagjs/routing) |
| Direct conversions/clicks/transaction IDs | [conversion guide](https://developers.google.com/tag-platform/devguides/conversions), [clicks](https://support.google.com/google-ads/answer/6331304?hl=en), [transaction IDs](https://support.google.com/google-ads/answer/6386790?hl=en) |
| Dynamic remarketing and business verticals | [guide](https://developers.google.com/tag-platform/devguides/dynamic-remarketing), [event/item schemas](https://support.google.com/google-ads/answer/7305793?hl=en) |
| Cart/custom/customer acquisition | [cart parameters](https://support.google.com/google-ads/answer/14943675?hl=en), [custom variables](https://support.google.com/google-ads/answer/9964350?hl=en), [new customer](https://support.google.com/google-ads/answer/12077475?hl=en) |
| Consent/privacy | [basic/advanced and field scope](https://developers.google.com/tag-platform/security/concepts/consent-mode), [defaults/updates/passthrough/redaction](https://developers.google.com/tag-platform/security/guides/consent), [privacy controls](https://developers.google.com/tag-platform/security/guides/privacy) |
| Cookies/linker | [cookie customization](https://developers.google.com/tag-platform/security/guides/customize-cookies), [Conversion Linker](https://support.google.com/tagmanager/answer/7549390?hl=en), [cross-domain](https://developers.google.com/tag-platform/devguides/cross-domain) |
| Enhanced web/leads | [Google tag setup](https://support.google.com/google-ads/answer/13258081?hl=en), [2026 unified settings](https://support.google.com/google-ads/answer/16884284?hl=en), [leads](https://support.google.com/google-ads/answer/15713840?hl=en), [customer policy](https://support.google.com/adspolicy/answer/7475709?hl=en) |
| Calls/remote settings/test-account limits | [calls](https://support.google.com/google-ads/answer/6095883?hl=en), [remote settings](https://support.google.com/tagmanager/answer/12131703?hl=en), [API test accounts](https://developers.google.com/google-ads/api/docs/best-practices/test-accounts) |

Reconcile current UI/native behavior with the 2026 enhanced-conversion migration;
older single-method instructions conflict with newer unified settings. Direct
Ads cart `id` and imported GA4 `item_id` cannot be flattened into one schema.
Generic cookie settings do not establish the lifetime/applicability of every
Ads key. Browser-attribution mechanisms require current observed native use,
not inference from a general or obsolete API overview.
