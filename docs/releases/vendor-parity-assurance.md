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

## Google/Meta delivery queue (2026-10-26)

**Current product state:** the SDK-free Node/local-receiver PageView
([060-13](../specs/060-meta-pixel-full-compatibility/slice-13-offline-pageview-prototype.md))
and conversion
([059-19](../specs/059-google-ads-full-compatibility/slice-19-offline-conversion-prototype.md))
are DONE as offline prototypes. Neither production boot is a full replacement.
The twelve full-compatibility journeys per vendor remain unfinished.
The 2026-10-15 allowance above is historical, not a renewed execution budget.

**Next pick:** refine060-14, the real local-browser Meta PageView, then059-20,
the equivalent Google conversion. No new field is guessed from a redacted
fixture. Authoring/code preparation may proceed within ordinary repository
scope; actual browser acquisition waits for its separate current execution plan.
No browser, vendor run, deployment or source pause is authorized by this queue.

[Accepted ADR-0042](../decisions/adr-0042-google-meta-product-delivery-gates.md)
records product-first sequencing, evidence separation and a default two-active-
hour checkpoint for supporting work. Owner acceptance on2026-10-26 is not an
execution exception or a substitute for existing safety/authority gates.

### Ordered deliverables

| Order | Canonical owner | Observable result | Entry/stop condition |
|---|---|---|---|
| 1 | [060-14 local-browser PageView](../specs/060-meta-pixel-full-compatibility/slice-14-local-browser-pageview.md) | Actual browser module-worker, two distinct local PageViews, zero-send consent controls and final owned cleanup | Review the draft; qualify or separately approve the exact browser launch/stop plan before acquisition. Stop on missing ownership/visibility, not a general runner rewrite. |
| 2 | [059-20 local-browser conversion](../specs/059-google-ads-full-compatibility/slice-20-local-browser-conversion.md) | Actual browser conversion route/value/currency/transaction relationships and local response/result barrier | Same execution gate, independent Google source/controls; use common local fixture work only where demonstrated. This has no artificial dependency on Meta completion. |
| Reference gate (paused) | [058 reference/comparison](../specs/058-native-tag-evaluation-qualification/spec.md), [059-15 exact stock capture](../specs/059-google-ads-full-compatibility/slice-15-native-stock-capture.md), [059-18 additional Meta case](../specs/059-google-ads-full-compatibility/slice-18-additional-meta-authority.md) | Fresh pinned native commands, complete request/response/auxiliary/state evidence and falsifiable comparisons for each first journey |059-15/18 are DEFERRED with explicit resolution triggers, not active general-runner projects. Reopen only a named bounded evidence plan with current execution ownership/case grant/setup/coordination and remaining gates. Original spent cases remain spent; intercepted production attempts cannot close delivery gaps. |
| 3 | [060-01 full first PageView](../specs/060-meta-pixel-full-compatibility/slice-01-pageview-entry.md), [059-01 full direct conversion](../specs/059-google-ads-full-compatibility/slice-01-owned-conversion.md) | SDK-absent replacement and complete same-input request/response/browser-effect comparison, with every missing branch visible | Their original DoR, C1-C9, reviewed boundary and measured performance acceptance still apply. Local-browser success alone does not admit implementation or cutover. |
| 4 | Existing command/consent/continuity owners below | Correct queued commands, consent transitions, first/returning state and cross-page relationships through real chambers | Refine from pinned native vectors; decide exact cookie/transport/host capabilities when evidence demonstrates the need. No generic identity or proxy service. |
| 5 | Existing richer feature owners below | One complete end-to-end event/matching/routing/automatic/call journey at a time | Each owning slice's dependencies, feature access, native references and controls; expand discovered inventory rather than exclude behavior. |
| 6 | [059-12](../specs/059-google-ads-full-compatibility/slice-12-portfolio-qualification.md), [060-12](../specs/060-meta-pixel-full-compatibility/slice-12-adoption-assurance.md), plus their adoption/product owners | Full feature/cohort ledger, measured CWV/isolation, product outcomes, integration, rollback and drift decision | All required journey and outcome evidence. Start baseline/performance design in the first journey, not at the end; no release date or full-support claim from prototype counts. |

The table is work priority, not additional lifecycle dependencies. Frontmatter
and per-slice DoR remain authoritative. A feature required by the first journey
cannot be deferred merely because a later slice owns its broader matrix; bring
that case's bounded implementation/evidence into01 without creating a cycle
or pretending the later feature is complete.
Deferral parks unfinished operator work; it does not revoke or enlarge a grant,
clear historical UNKNOWNs, accept an exception or count the reference complete.

### Complete feature ownership, not a second feature backlog

| Remaining behavior | Google owner | Meta owner | Required next refinement |
|---|---|---|---|
| Native entry, queue, routing and configuration | [059-02](../specs/059-google-ads-full-compatibility/slice-02-command-journeys.md) | [060-01](../specs/060-meta-pixel-full-compatibility/slice-01-pageview-entry.md), [060-03](../specs/060-meta-pixel-full-compatibility/slice-03-pixel-routing.md) | Pinned callable/queue/order/duplicate/error/callback and multi-destination vectors; no assumption that prototype validation is native behavior. |
| Native consent/processing | [059-03](../specs/059-google-ads-full-compatibility/slice-03-consent-journeys.md) | [060-04](../specs/060-meta-pixel-full-compatibility/slice-04-consent-processing.md) | Observe grant/default/wait/revoke/regrant and exact wire/state behavior; strict local drop is not Google advanced Consent Mode or Meta replay semantics. |
| First/returning cookies, ClickIDs and linking | [059-04](../specs/059-google-ads-full-compatibility/slice-04-identity-linker.md) | [060-05](../specs/060-meta-pixel-full-compatibility/slice-05-browser-continuity.md) | Exact creation/read/update/delete scopes, attributes/lifetimes and denied/partitioned-state cases; no fabricated live click or native-seeded-only first-visit proof. |
| Rich events/commerce/counting | [059-06](../specs/059-google-ads-full-compatibility/slice-06-rich-purchases.md) | [060-02](../specs/060-meta-pixel-full-compatibility/slice-02-event-journeys.md) | Types, optional/empty/zero, order/item joins and native duplicate/count relationships; a local transaction field is not backend deduplication. |
| Multiple Pixel routing | Google routing is059-02 | [060-03](../specs/060-meta-pixel-full-compatibility/slice-03-pixel-routing.md) | Second owned Pixel and independent settings; prevent cross-Pixel state and event leakage. |
| Manual enhanced/advanced matching | [059-07](../specs/059-google-ads-full-compatibility/slice-07-manual-enhanced.md) | [060-06](../specs/060-meta-pixel-full-compatibility/slice-06-manual-identity.md) | Authorized same-input normalization/hash/update/logout vectors, never sentinel equality or invented native encodings. |
| Automatic/selector/form matching | [059-08](../specs/059-google-ads-full-compatibility/slice-08-automatic-leads.md) | [060-07](../specs/060-meta-pixel-full-compatibility/slice-07-automatic-matching.md) | Owned settings and synthetic form references; bounded DOM capture and clear manual/automatic precedence. |
| Audiences/dynamic verticals/metadata/remote rules | [059-05](../specs/059-google-ads-full-compatibility/slice-05-remarketing.md), [059-10](../specs/059-google-ads-full-compatibility/slice-10-remote-browser.md) | [060-08](../specs/060-meta-pixel-full-compatibility/slice-08-automatic-events.md), [060-11](../specs/060-meta-pixel-full-compatibility/slice-11-product-diagnostics.md) | Feature-specific remote configs, catalog/feed/rule inputs and branch-complete native scenarios. |
| Website calls | [059-09](../specs/059-google-ads-full-compatibility/slice-09-website-calls.md) | No corresponding Pixel call-forwarding feature claimed | Owned number/service eligibility, lookup/cache and safe rendering/click/navigation evidence; not a generic DOM proxy. |
| Browser lifecycle, unload and no-JavaScript paths | [059-10](../specs/059-google-ads-full-compatibility/slice-10-remote-browser.md) | [060-09](../specs/060-meta-pixel-full-compatibility/slice-09-lifecycle-nojs.md) | Real SPA/navigation/BFCache/prerender/unload/loss and supported no-JavaScript cases; never exactly-once from a single happy run. |
| Browser/server event correlation | [059-06](../specs/059-google-ads-full-compatibility/slice-06-rich-purchases.md), [059-12](../specs/059-google-ads-full-compatibility/slice-12-portfolio-qualification.md) | [060-10](../specs/060-meta-pixel-full-compatibility/slice-10-event-correlation.md) | Existing authorized server counterpart and exact join IDs; server APIs complement, not replace, the browser leg. |
| Product diagnostics, adoption and assurance | [059-11](../specs/059-google-ads-full-compatibility/slice-11-adoption-rollback.md), [059-12](../specs/059-google-ads-full-compatibility/slice-12-portfolio-qualification.md) | [060-11](../specs/060-meta-pixel-full-compatibility/slice-11-product-diagnostics.md), [060-12](../specs/060-meta-pixel-full-compatibility/slice-12-adoption-assurance.md) | Readable per-layer results, native-free integration/coexistence, measured CWV, lawful outcomes, rollback and drift. |

These owners cover the currently documented families, not every undiscovered
vendor feature. A newly observed required field/branch/cohort remains unfinished
and is assigned before implementation. Later DRAFT slices are not implementation-
ready merely because they appear in this table.

### Decision queue and exact triggers

| Decision | Owning work / when to write the ADR | What is not decided |
|---|---|---|
| Product-first work admission | ADR-0042 Accepted2026-10-26 | No runtime change, execution authority or relaxation of full parity. |
| Browser execution/loss/stop mode | Before060-14/059-20 or any native run, choose a current qualified path or separately approved, case-specific supervised plan | Do not accept Proposed ADR-0038 by implication or import another lane's supervised exception. |
| Vendor-cookie capability |059-01/04 or060-01/05, once native first-visit/return/consent evidence identifies exact required operations and existing API limits | No new name/domain/lifetime/write grant yet; no generic cookie jar. |
| Transport/response capability |059-01 or060-01, once pinned native GET/POST/Image/script/credential/redirect/response effects show the smallest sufficient design | No ambient network/script execution, invented image status or automatic response-URL following. |
| Timing-critical host callbacks/navigation | A first-journey or later routing/lifecycle slice demonstrates behavior that async mediation cannot preserve within measured limits | No main-thread vendor mapper, arbitrary callback cloning or relaxed CWV rule. |

Do not create speculative ADRs for every feature. Existing Accepted boundaries
stay authoritative until a concrete conflict is evidenced; new ADRs document
the specific alternatives and remain Proposed until actually accepted.

### Work-admission and stop card

Before a slice starts, put this card in its plan or execution handoff:

- **Product outcome:** owning slice/criterion, exact user-visible journey and
  evidence that will close it; name explicitly what cannot be claimed.
- **Inputs and authority:** source/cohort/native/reference handles, required
  current setup and scoped execution grant, or explicit offline-only scope.
- **Smallest change:** existing code/evidence reused, failing control, no-gos
  and actual prerequisite; new infrastructure needs this same named consumer.
- **Budget and stop:** one finite agreed checkpoint; ADR-0042 sets a default of two
  active hours for prerequisite preparation. Stop with concrete evidence or a
  blocker rather than silently renewing, resetting cases or widening permissions.
- **Exit:** tests/independent receiver or native observations as applicable,
  final owned resource disposition and required reviews. Test totals are not
  feature progress. A safe pending-operation handoff is not a clean success.

This queue is a planning record. No new run, two-hour allocation, campaign,
production send, custody exception, automatic retry or release commitment is
created by writing it.

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
