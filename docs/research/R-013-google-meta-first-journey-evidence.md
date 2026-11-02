---
status: OPEN
topic: A bounded native evidence route for the first Google and Meta journeys
created: 2026-11-02
related:
  - ../releases/google-meta-work-plan.md
  - ../specs/059-google-ads-full-compatibility/slice-01-owned-conversion.md
  - ../specs/060-meta-pixel-full-compatibility/slice-01-pageview-entry.md
---

# R-013: First-journey native evidence plan

We have local worker journeys and partial native observations. We still need a
credible route to a same-input native/replacement comparison. This brief asks
for that route before more capture infrastructure is built.

**Meta source/document research is complete and independently reviewed.**
The [document-closeout record](../releases/google-meta-work-plan.md#document-closeout-review)
preserves the review scope. The owner commissioned this bounded research through the
[work plan](../releases/google-meta-work-plan.md). Google's case remains
unresolved. No acquisition route or live action is approved.

## Question

What is the smallest safe, independently reviewable way to obtain the complete
reference needed for one Meta PageView and one Google direct conversion on
owned resources, using the existing evidence and tools where they fit?

## Retained sources and observations

- [058](../specs/058-native-tag-evaluation-qualification/spec.md) qualifies
  specific local, attempted-request and comparison layers. Aborted attempts do
  not supply actual vendor responses or cookie behavior.
- [059-01](../specs/059-google-ads-full-compatibility/slice-01-owned-conversion.md)
  and [060-01](../specs/060-meta-pixel-full-compatibility/slice-01-pageview-entry.md)
  already own the complete first journeys. Their readiness remains open.
- [059-20](../specs/059-google-ads-full-compatibility/slice-20-local-browser-conversion.md)
  and [060-14](../specs/060-meta-pixel-full-compatibility/slice-14-local-browser-pageview.md)
  retain actual local browser execution, with explicit limitations.
- [The Meta reference packet](../specs/060-meta-pixel-full-compatibility/meta-native-reference-plan.md)
  and [059-18](../specs/059-google-ads-full-compatibility/slice-18-additional-meta-authority.md)
  retain the native-acquisition blockers, consumed lineage and historical
  ownership unknowns. This brief does not resolve or bypass them.

These are starting records, not newly checked account facts or current run
qualification.

## Proposed research sessions

One read-only session per vendor, at most 60 active minutes each. Start from
the records above and the public documentation. Use private resources only if
the owner explicitly supplies and permits them for that assignment. No browser,
SDK execution, measurement request, account change, deployment or launcher
repair is part of these sessions.

Each session returns one case card:

| Required entry | Result expected |
|---|---|
| Consumer | Exact first-journey acceptance criteria the reference will satisfy. |
| Case | One explicit command sequence, intended page action and consent timeline. |
| Equivalent inputs | Required native/replacement configuration, browser and storage state; generated-value comparison rules still unknown. |
| Evidence | What is already retained, what is missing and which layer each item establishes. |
| Collection route | Reuse of an existing capture path, an owner-operated capture, or a separately reviewed bounded supervised path. Explain the rejected alternatives. |
| Safety and authority | Exact resource ownership, stop/cleanup responsibilities, allowed destinations, finite counts/window and approval still required. Use symbolic handles, not private IDs. |
| Acceptance | Complete request/response/host-effect accounting, a positive reference and loss/value/extra-request controls. Missing observations remain inconclusive. |
| Exit | A reviewable recommended route or one precise blocker and the owner action needed. |

Do not silently expand a no-send reference into a delivered-response experiment.
Intuit/customer production remains example-only with no synthetic submissions.
Delivered response and product evidence must use separately approved owned
resources.

## Options to evaluate

| Route | Benefit | Limitation to resolve |
|---|---|---|
| Reuse retained originals | No new execution; fastest if the exact evidence exists. | Retained attempts and historical smokes may not contain complete responses or equivalent state. |
| Owner-operated capture | Can avoid building another unattended execution system. | Still needs permitted inputs, complete observation, provenance and an approved stop/cleanup plan. It is not an implicit safety exception. |
| Existing bounded supervised path | Could reuse prior tools and case limits. | Current source/browser/ownership gates and relevant decisions must actually fit the case. |

A new general runner is not an output of this research. If no route fits,
return BLOCKED rather than inventing another prerequisite implementation.

## Meta first-case evidence card

**Status:** Research output for owner review. The case is proposed; acquisition
is blocked. The Google case remains unresolved.

### Consumer

[060-01](../specs/060-meta-pixel-full-compatibility/slice-01-pageview-entry.md)
owns the first replacement journey. One complete native reference informs its
numbered criteria; it cannot satisfy them by itself:

| 060-01 criterion | What this reference can inform | Still required |
|---|---|---|
| 1 | Inputs and native first-PageView sequence. | A real replacement using the documented boot, pre-ready and post-ready calls, serialized chamber processing and mediated dispatch, with native runtime absent. |
| 2 | Observed bootstrap, queue, alias and readiness behavior for this case. | Matched observations for post-ready calls, duplicate install, argument mutation, order, repeated init, returns and errors. A published snippet or empty queue is insufficient. |
| 3 | C1-C9 comparison of the complete applicable PageView sequence and host effects. | An independently qualified, equivalent-input chamber comparison and ownership of every new or private field. |
| 4 | An enabled native positive for the selected setup. | A qualified default-on positive and exact `meta-pixel=off` and duplicate-off negatives paired with that positive. |
| 5 | The expected positive and a basis for loss, changed-value and extra-request controls. | Witnessed controls for every listed mutation, blocked runtime/configuration, disabled observer and empty reference. |
| 6 | Native calls and request correlations where observed. | Replacement per-call diagnostics, governed authority and the chamber/main-thread boundary. |
| 7 | Separately observed native dispatch and response, if authorized and complete. | Actual replacement dispatch/response and any newly correlated product receipt as separate layers. The historical owner receipt remains unpaired. |

[Spec 060](../specs/060-meta-pixel-full-compatibility/spec.md#binding-acceptance-contract)
applies all nine rules:

| Rule | Reference contribution and remaining obligation |
|---|---|
| C1 | Establish a positive with provenance and the named 058 recorder, attempt and comparator layers. Missing or unsupported observations are inconclusive; expected-zero controls need a qualified positive. |
| C2 | A native reference does not show replacement worker execution or actual mediated dispatch. Both remain required with the native runtime absent. |
| C3 | Capture all applicable requests, responses, redirects, retries, dependencies, configuration and ordering. The replacement must match the complete sequence, including browser-controlled headers and credentials. |
| C4 | Preserve private input-to-wire and cookie-to-wire relationships. Classify generated values and establish field-specific comparison rules before comparing runs; equal redactions or two missing values prove nothing. |
| C5 | Observe browser storage, URL, referrer, metadata, callbacks and DOM/lifecycle effects. An aborted request or a different transport cannot establish those effects. |
| C6 | A native reference does not prove governed replacement authority. The host captures or fulfills bounded operations; mapping, hashing and state stay in the chamber, and each dispatch passes consent and destination checks. |
| C7 | Report worker execution, native attempt, actual dispatch/response, backend receipt, matching, deduplication, catalog/audience and attribution separately. A response is not a product receipt. |
| C8 | One case does not waive later behavior, cohorts, outcome evidence or separate authority. No customer traffic, synthetic production conversions, account changes or campaign spend. |
| C9 | Qualify controls for loss, extra sends, changed values/routing/consent, incorrect host effects and unavailable responses. Missing evidence blocks the affected claim; do not lower an oracle threshold. |

### Case

Propose one owned test page and one owner-controlled test Pixel. Load the page
with the site gate enabled. Install the pinned native bootstrap and issue one
`fbq('init', <PIXEL>)` followed by one explicit `fbq('track', 'PageView')`
before the native runtime is ready. If that timing cannot be observed, the
pre-ready reference is inconclusive.
The intended action is the single page load; init alone is not assumed to
produce the event. Observe the bootstrap's callable, queue and alias state before
readiness, command order, transition to readiness and subsequent host effects.
Do not treat `loaded` or an empty queue as proof that the calls were processed.
The separate post-ready and duplicate-install cases remain later obligations.

For this positive, the proposed host consent state is granted before page
load and remains granted through observation and cleanup. The native run uses
its default consent state; record it and establish equivalence rather than
assuming it. No revoke/grant transition, enhanced matching, extra event or
consent-wait/replay policy is part of this case. Consent negatives and timeline
behavior require separate cases. The owned setup's default-on and exact
`meta-pixel=off` policy remains unchanged, including duplicate `off`.

Meta's [get-started page](https://developers.facebook.com/documentation/meta-pixel/get-started)
shows the bootstrap followed by explicit init and PageView, and describes
Events Manager verification. Its [consent page](https://developers.facebook.com/documentation/meta-pixel/implementation/gdpr)
documents revoke before init and a later grant, but does not establish a
complete queue or storage state machine. These pages are documentation, not
observations of this case.

### Equivalent inputs

The owner must explicitly supply private handles for the owned page and Pixel,
site gate and settings, configuration, exact original runtime/dependency bytes
and provenance, browser/version and profile, and permitted observation/output.
The [060 private-input list](../specs/060-meta-pixel-full-compatibility/spec.md#explicit-private-input-handles)
names prior records, not current permissions. No private handles or raw captures
were supplied for this card.

Pin the native and replacement page content and URL/referrer/metadata, command
arguments/order, consent and configuration, runtime/source epoch, browser
version and privacy settings, first/returning profile, cookies and other
storage before and after, cache state, transport and credentials. Record any
differences rather than normalizing them away. Unknown configuration,
automatic collection, dependencies or redirects must be identified and
accounted for. Define private, field-specific rules for generated identifiers,
timestamps and cookie-to-wire relationships using provenance and repeated
evidence. Do not equate redaction tokens, invent values or assume Image and
Fetch are equivalent.

There is no qualified same-input numerical performance baseline or first-case
limit here. Obtain an approved measurement plan and comparable native and
replacement measurements, including Core Web Vitals and main-thread costs,
before choosing evidence-backed limits. The local browser duration below is
not such a baseline.

### Evidence

| Layer | Retained observation and limit |
|---|---|
| Documented behavior | The official [get-started](https://developers.facebook.com/documentation/meta-pixel/get-started), [reference](https://developers.facebook.com/documentation/meta-pixel/reference), [advanced](https://developers.facebook.com/documentation/meta-pixel/advanced) and [consent](https://developers.facebook.com/documentation/meta-pixel/implementation/gdpr) pages provide a public floor. They do not specify the complete private wire or runtime behavior. |
| Local worker/browser | [060-14](../specs/060-meta-pixel-full-compatibility/slice-14-local-browser-pageview.md#actual-successful-local-journey---2026-10-26) records two first-party worker PageViews at a local receiver, controls and normal cleanup in one historical Chrome cohort. Its explicit-empty local HTTP 200 is not a native response, cookie, transport, performance or parity result. |
| Native attempts | [058](../specs/058-native-tag-evaluation-qualification/spec.md) records a selected headed positive using pinned bytes and no-send controls, plus linked disabled, revoked and value controls. Attempts were aborted, not delivered. The older headless cohort saw no beacon; its cause is unknown. |
| Actual responses | [060](../specs/060-meta-pixel-full-compatibility/spec.md#grounded-starting-point-not-a-passing-reference) records official runtime and owned configuration HTTP 200 responses in the earlier automated setup, which observed no PageView request. These are not a complete PageView response or host-effect sequence. |
| Owner receipt | The owner confirmed a normal-browser PageView in Test Events. It was not agent-witnessed or paired to the automated attempt; it does not prove the wire, matching or attribution. |

The saved fixture drops fields and lacks original request bytes and a complete
sequence. The local comparison in 060-01 used synthetic context and different
consent conditions. Neither is an independently qualified same-environment
reference. [058](../specs/058-native-tag-evaluation-qualification/spec.md#required-report-contract)
qualifies named layers, not a complete native/chamber comparison.

### Collection route

Recommend an **owner-operated capture for feasibility and safety review**, not
an immediate run. It may avoid extending unattended runner ownership, but it
must demonstrate the same complete observation, physical destination/count
controls, provenance, independent stop and cleanup evidence as any other route.
Owner operation is not a safety exception. No such qualified path or current
resource confirmation is established by the allowed evidence, so acquisition
is blocked until the owner and reviewers establish one.

Retained originals alone avoid new traffic but lack the complete equivalent
response, state and provenance needed for this case. The existing supervised
route preserves a bounded lineage and limits, but [059-18](../specs/059-google-ads-full-compatibility/slice-18-additional-meta-authority.md#owner-pause---2026-11-02)
is parked and its current browser, ownership, stop and guard gates remain open.
[ADR-0038](../decisions/adr-0038-supervised-native-meta-resource-lifecycle.md)
is Proposed, not accepted or a run grant. Reconsider that route only if the
owner selects it and its existing gates are met. Do not add a general runner.

### Safety and authority

For a future proposal, use symbolic handles only: `<OWNER>`, `<OPERATOR>`,
`<OWNED_PAGE>`, `<TEST_PIXEL>`, `<PINNED_SOURCE>`, `<PROFILE>`,
`<PRIVATE_OUTPUT>` and `<APPROVED_DESTINATIONS>`. The owner must confirm current
ownership and control of each resource, name the operator and independent
stop/cleanup owner, and supply exact private bindings. No present ownership,
permission or usable destination is inferred from historical records.

The existing [reference plan](../specs/060-meta-pixel-full-compatibility/meta-native-reference-plan.md#exact-case-contract)
proposes one init and one explicit PageView, at most eight physical HTTPS
attempts including redirects/retries, 64 observations and a 60-second
absolute window including launch, cleanup and publication. It also specifies
2 KiB per URL, 64 KiB request headers/body, 2 MiB per accepted response and
8 MiB aggregate, with strict inspected transport. Propose those same ceilings
as an upper bound for the owner-operated positive, subject to review of whether
its controls can enforce them. They do not authorize that route. Exact
destinations for the owned page, pinned sources and necessary Meta endpoints
must be supplied, with no wildcard or unknown-route fallback. The selected
route must not exceed its applicable authorized case limits. Stop on unknown
routes, missing observation, unverified ownership, unsafe continuation or
deadline; preserve
spend and unknown cleanup without retrying or signaling guessed resources.
Name who closes the browser, profile, observer, endpoints and any keys, and
how their independent disposition and private publication are recorded.

Case selection, resource/setup and source confirmation, observation and
guard qualification, applicable decision review, and finite actual-dispatch
approval are separate gates. The original case is spent/inconclusive; the
historical additional case was unspent, but is not current permission or a
reserved window. No capture, account change, deployment or retry is authorized
by this card.

### Acceptance

Require one independently qualified positive with original, provenance-bound
request and response data, complete dependency/configuration and auxiliary
traffic, redirects, failures and ordering, plus browser storage and host
effects before and after. Record actual dispatch/response separately from
attempts and any separately authorized product receipt. Include a bounded
observation window and explicit completeness and resource-disposition results.
Private originals stay private; public output contains classifications and
counts, not identifiers or raw payloads.

Pair the positive with controls that detect a removed PageView, altered
Pixel/URL/value, an extra request, blocked runtime/configuration, a disabled
observer and an empty reference. Include applicable consent and site-gate
negatives and host-effect/response-loss controls. Controls requiring a new
native send need their own finite approval; offline mutations do not become
native observations. Missing response, unavailable observation, unknown
cleanup or zero expected-positive event is inconclusive, never a pass.
058's closed report states and 060-01's full criteria remain unchanged.

### Exit

**For owner review:** select whether to investigate an owner-operated capture
and supply current resource owners, private inputs and a bounded observation,
stop and cleanup proposal. A separate review must establish that it meets the
case and safety gates before any acquisition decision. If it cannot, return
the specific blocker rather than repairing or retrying the parked route.
The first reference would inform 060-01 only; replacement qualification,
other cohorts and product outcomes remain open.

## Open questions

- Which current owned-resource confirmations and legitimate product observations
  can the owner supply for each first case?
- Can an existing or owner-operated route supply the complete first-case
  reference within its safety envelope?
- Which first-case numerical performance limits can be grounded in the retained
  baseline, and which measurements need later approval?

## Conclusion

The Meta card recommends an owner-operated capture feasibility/safety packet
for owner review. No qualified acquisition route is established or approved.
Google research and the overall evidence-route investigation remain open.
No capture or live action was executed by this research.

Promoted to: pending; implementation stays with 059-01 and 060-01. Use 059-15/18
for any explicitly approved native-acquisition changes, not a duplicate tool spec.
