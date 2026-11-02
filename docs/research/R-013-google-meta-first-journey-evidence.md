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

**Meta source/document research has produced a case card and a case/limits
manifest.** The [current handoff](../releases/google-meta-work-plan.md#11-owner-decision-and-meta-caselimits-wave)
records the document-review scope. The owner commissioned this bounded research through the
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

### Meta case and limits manifest

**Document: READY_FOR_OWNER_REVIEW. Acquisition and dependent implementation:
BLOCKED.** The records define a proposed first case and its missing inputs.
They supply no current private bundle, qualified acquisition route or measured
replacement budgets. This is the 2026-11-02 document commission from base
`6e61709f1f8c1211a00c2d12ad84ae347fcf8c7d`, not an execution decision.
The owner's "looks good to me, approved, continue" confirms the trusted
first-party mapper choice, C with D's required browser admission and independent
evaluation. ADR-0043 is still Proposed at this base; the coordinator owns its
acceptance record. This section changes no ADR, slice, report contract or grant.

#### Input and action manifest

Each classification below describes the evidence needed for that field,
not a runtime report state. `established-from-records` means the cited record
defines the requirement or historical observation, not that today's case passed.
`owner-input-required` means an explicit private binding or decision is absent.
`measurement-required` means observations under a later finite approval are
needed. `qualification-required` means the named observation/control must be
independently demonstrated for its exact source, browser and transport.

The symbolic command transcript is:

```text
<OWNED_PAGE> loads <PINNED_NATIVE_BOOTSTRAP>
before observed native readiness:
  fbq('init', <TEST_PIXEL>)
  fbq('track', 'PageView')
```

This specifies one init and one explicit PageView in capture order. It is not
an executable invocation, a selected run or a declaration of one wire request.
Native runtime initialization, Pixel init and readiness are separate facts.

| Field | Classification | Binding, provenance and remaining limit |
|---|---|---|
| Commands, timing and arguments | established-from-records | The card's Case and [060-01 criteria 1-3](../specs/060-meta-pixel-full-compatibility/slice-01-pageview-entry.md) define the transcript. No enhanced-matching argument, event data/options, extra event or consent transition is proposed. Observe pre-ready state, callable/queue/alias behavior, order and readiness; an empty queue is insufficient. |
| Actual command/page originals | owner-input-required | `<COMMAND_TRANSCRIPT>` and `<PAGE_SNAPSHOT>` must bind the exact bootstrap, args, site settings and page bytes to `<OWNED_PAGE>` and `<TEST_PIXEL>`. The symbolic transcript is not evidence that these executed. |
| Resource ownership and provenance | owner-input-required | `<OWNER>` supplies current control, lawful test use and private bindings for the page, Pixel, source and `<PRIVATE_OUTPUT>`. [060's private-input handles](../specs/060-meta-pixel-full-compatibility/spec.md#explicit-private-input-handles) name historical records only; none was supplied here. No private IDs or credentials belong in this document. |
| Native/runtime/configuration closure | owner-input-required | `<PINNED_SOURCE_BUNDLE>` must retain authenticated original runtime, bootstrap, configuration and applicable dependencies, retrieval provenance, source epoch and integrity/file identities. Include automatic matching/collection and Event Setup settings. Unknown settings stay missing; a setting is not assumed off. |
| Equivalent page context | owner-input-required | `<PAGE_STATE>` binds exact URL, ordered query, referrer, metadata, document/frame context, dimensions, timezone and other applicable captured inputs. Record differences; do not replace them with shared sentinels. Source: Equivalent inputs and 060 C3-C5. |
| Site initialization gate | established-from-records | Preserve default-on, exact `meta-pixel=off`, and any exact duplicate `off` disabling init. The owner omitted the static noscript image. This is neither consent nor full no-JavaScript parity. Source: [060 grounded starting point](../specs/060-meta-pixel-full-compatibility/spec.md#grounded-starting-point-not-a-passing-reference). |
| Consent scenario | established-from-records | Proposed host grant precedes page load and lasts through cleanup; native uses its recorded default. No transition/wait/replay policy is selected. Preserve prototype no-replay and stable-core behavior separately; Google's ADR-0044 supplies no Meta policy. |
| Actual consent equivalence | qualification-required | `<CONSENT_RECORD>` must show native defaults, host purposes/policy and the observed timeline under equivalent inputs. A host grant does not establish native equivalence. Missing equivalence blocks comparison, not the seal. |
| Browser, device and privacy cohort | owner-input-required | `<BROWSER_COHORT>` pins version/build, device/OS, headed mode, launch/response policy, privacy settings and permitted transport surfaces. Historical Chrome cohorts are not today's installed or qualified cohort. Do not spoof headers or use a personal/shared profile. |
| Profile, storage and cache | owner-input-required | `<PROFILE_STATE>` identifies fresh owned or explicitly returning state, cookies/storage/partitioning and cold/warm cache before execution, plus permitted after-state observation. Preserve actual attributes and values privately. Empty, denied and unavailable storage are different conditions. |
| Host actions and effects | qualification-required | `<HOST_EFFECT_RECORD>` covers actual storage reads/writes, URL/referrer/metadata reads, DOM/site behavior, callbacks/errors and lifecycle effects, including explicitly observed no-effect results. Main may capture or fulfill approved bounded operations; mapping, hashing and state stay in the trusted chamber. Source: 060 C5/C6 and [R-014 Meta contract](R-014-google-meta-request-authority.md#proposed-private-meta-contract). |
| Observers, enforcers and outputs | qualification-required | `<QUALIFICATION_BUNDLE>` must bind independent observation, physical route/count enforcement, source/browser/transport controls and external cleanup/exit witnesses. A passive observer cannot enforce no-send. Producer completion cannot attest its own future exit. Source: [058 report/safety contract](../specs/058-native-tag-evaluation-qualification/spec.md#required-report-contract) and [stock operator limits](../../rig/native-stock-capture.md#current-ownership-guardrail---2026-10-29). |
| Replacement inputs and authority | qualification-required | A later candidate must consume equivalent authorized inputs through real serialized chamber/host dispatch with native absent. C trusts reviewed mapper semantics; host accounting is not an independent expected Meta query. Actual browser loader/ambient-route denial and final live-consent/destination checks remain required. Source: 060 C2/C6 and [R-014's missing relationships](R-014-google-meta-request-authority.md#existing-guarantees-versus-missing-relationships). |
| Performance and finite limits | measurement-required | `<PERFORMANCE_PLAN>` and `<MEASUREMENT_BUNDLE>` must support the numerical fields below. The local browser duration and prototype defaults are not native/replacement acceptance measurements. |

#### Complete observation graph

Require a private `<OBSERVATION_GRAPH>` rooted in the original page/source and
command transcript. Every node needs source/config/cohort provenance, initiator,
command/stage correlation where observable, time/order, destination and operation,
original request/response references, applicable browser/host effects and an
explicit completeness limit. Preserve observer/fixture traffic as separately
classified originals. Do not silently drop it from accounting.

| Applicable graph component | Required observation | Current classification and gap |
|---|---|---|
| Page, bootstrap, runtime and dependencies | Exact served bytes, load/execution order, loader and redirect edges, response policy and caching. | qualification-required; a complete case-bound graph is missing. R-014's 18-file standalone static closure does not establish native or served-loader closure. |
| Configuration and init | Original configuration/settings, fetches, state changes, automatic-collection dependencies and any init-triggered I/O. | qualification-required; no native zero-output init is established. Local zero-output init is a prototype fact only. |
| Explicit PageView and auxiliary traffic | Every applicable primary/auxiliary operation, method/path, ordered query multimap, body/encoding, browser-final headers, cookies/credentials, transport and count. | measurement-required; request/branch counts, graph depth and fan-out remain unset. One PageView does not imply one request. |
| Redirects, retries and cancellation | Every hop/attempt, causal parent, response-dependent continuation, duplicate, failure and cancellation; account for already issued work after stop. | qualification-required; missing edges stay missing. Automatic following or invisible retries cannot be normalized away or bypass a per-hop limit. |
| Response and host/state effects | Original status/headers/body/framing and visibility, cookie acceptance/storage changes, callbacks/site/DOM effects and lifecycle timing. | qualification-required; missing/opaque response observations cannot become complete readable responses or a local 200 substitute. |
| Replacement protocol and privileged effects | Planned zero/nonzero operations, ordered stages, responses and final host-ledger reconciliation; actual worker execution and native absence independently observed. | qualification-required; [R-014's private wrapper](R-014-google-meta-request-authority.md#proposed-private-meta-contract) is proposed source/design, not implemented accounting or native graph evidence. |

A component may be inapplicable only with case-bound evidence and a reason.
Unobserved branches are missing, never zero. A necessary branch that cannot be
observed or safely admitted makes the affected reference incomplete. No
branch count, dependency exemption or private encoding is invented here.

#### Originals, comparison and controls

`<ORIGINALS_BUNDLE>` retains lossless request/response bytes and ordered fields,
runtime/config/page originals, before/after state, command/source/observer
records, guard results and external resource/exit witnesses. Bind each to the
same case/source/cohort and integrity record. Preserve failed observations and
unknown disposition. Raw values stay in the authorized private output.

`<DERIVATION_MANIFEST>` identifies each projection, decoding, redaction or
comparison input by its original and transformation. Derived fixtures are
not originals. The retained PageView fixture omitted 38 experiment flags and
original sequence bytes; its Lead counterpart is synthetic. The old
eight-field local mapper, copied-reference positives and shared mapper tests
cannot independently qualify native relationships.

Compare deterministic fields exactly, including spelling, encoding,
multiplicity, absent/empty distinctions and applicable order. For generated
IDs/timestamps and cookie-to-wire values, require a field-specific private rule
with input/state provenance, continuity and causal/time relationships, supported
by repeated evidence from a separately approved bounded measurement. The
rule's tolerance, permitted variation and qualification are currently unset.
Do not equate `_fbp` cookie names with `fbp` wire names, mint a ClickID, compare
redaction tokens as identities or treat two missing values as equality.
An unexplained field or value difference remains owned and unresolved.

Each control below needs an independent evaluator and a qualified positive
paired by exact source, cohort, input and observation surface. A comparator
copy/mutation may qualify detection mechanics only. Any new native dispatch
for a control requires its own finite approval; this packet grants none.

| Positive/control pair | Required failing witness and limit |
|---|---|
| Enabled native positive / lost or empty reference | Removing the PageView or substituting the known empty reference cannot pass. Missing observation is `inconclusive`; a complete observed material mismatch is `nonconformant`. |
| Positive / changed value or routing | Alter Pixel, URL and an applicable authorized value relationship individually, including cookie/generated-value relationships where present. Detect changed meaning, not only field presence. Do not add a synthetic value to the native case to manufacture evidence. |
| Positive / extra operation | Added/duplicate primary, auxiliary or redirected operation must be detected in the full ledger, including a protocol-valid request to an allowed recipient. Counts alone do not prove semantic correctness under C. |
| Positive / blocked runtime or configuration | Verify dependency/configuration loss cannot masquerade as an empty successful PageView. Distinguish blocked execution from collection loss with independently observed source/command evidence. |
| Positive / disabled observer or enforcement | Disabled observer, dropped observations and unavailable originals must prevent qualification. For each claimed transport, 058 requires a same-run loopback tripwire positive, enforced zero-arrival leg and disabled-guard failing mutation. These are separate from vendor delivery. |
| Positive / site-gate or consent negative | Pair exact off and duplicate-off with enabled default-on. Record native-revoked and host-denied controls separately, without asserting consent equivalence or selecting retention/replay semantics. |
| Positive / response or host-effect loss | Remove/change a required response, causal edge, cookie/storage action or callback/site effect and detect the affected mismatch or incompleteness. Aborted attempts cannot qualify delivery-dependent effects. |

Keep 058's named `local_network`, `native_attempt` and comparator qualification
boundaries. Retain its closed overall states/exits: `qualified`/0,
`nonconformant`/1, `inconclusive`/2 and `invalid_input`/3.
`READY_FOR_OWNER_REVIEW` and `BLOCKED` here describe document/admission status,
not new report states. Under 060 C7, separately name `worker_execution`,
`native_attempt`, `actual_dispatch_response`, `backend_receipt`, `matching`,
`deduplication`, `catalog_audience` and `attribution`. A qualified narrow layer
does not qualify the others. Historical local 200s, aborted native attempts
and the unpaired owner receipt remain in their original layers.
The [059-17 diagnostic](../../rig/chamber-comparison.md#outputs-and-meaning)
has no exit 0 or replacement mode; do not relabel it as full comparison.

#### Acquisition feasibility and safety

| Route | Useful evidence and current feasibility | First missing input/control |
|---|---|---|
| Retained originals only | Avoids new traffic. 058 records a selected headed positive and no-send controls for `native_attempt`, not complete wire. This packet received no originals and cannot requalify them. Full first-case route: BLOCKED. | Explicit `<ORIGINALS_BUNDLE>` with source/cohort/completeness provenance; existing records already leave actual PageView response/state/host effects incomplete. Do not execute or rediscover a producer to fill them. |
| Owner-operated capture | A feasibility candidate, not a selected or currently qualified route. It may avoid extending unattended ownership. Route: BLOCKED. | Current privately bound resources plus a concrete `<CAPTURE_PROCEDURE>` and current independent observation, physical enforcement, early-acquisition stop and cleanup qualification. Owner operation waives none of these. |
| Parked supervised/attended route | Historical SDK-absent local controls and source corrections establish only their named epochs. [059-18 is paused](../specs/059-google-ads-full-compatibility/slice-18-additional-meta-authority.md#owner-pause---2026-11-02); ADR-0038 remains Proposed. Route: BLOCKED. | A separately selected current operation and qualified source/cohort ownership, independent stop and closure evidence, including pending/late acquisition. Existing NO-GO cannot be replaced by normal cleanup, old indices or source-only fixes. No repair is commissioned. |

No allowed record establishes a currently qualified complete acquisition path.
The [local chamber producer](../../rig/chamber-capture.md#what-the-result-means)
qualifies its instrumented synthetic legacy-subset surface only. Its delayed
observation attachment is not ordinary startup/performance evidence.

For any later route, the private procedure must assign these responsibilities
before acquisition:

| Responsibility | Required binding and stop/cleanup obligation |
|---|---|
| `<OWNER>` | Confirm current resource control, permitted observations/retention and `<APPROVED_DESTINATIONS>` under `<RESOURCE_BINDINGS>`, including exact origin/path/method, credential scope and each permitted redirect. No wildcard or unknown-route fallback. Select scope separately from granting dispatch. No customer traffic, production conversions, spend, account/campaign mutation or deployment. |
| `<OPERATOR>` | Bind source/config/cohort, one immutable case and unused private output; establish guards before code/source continuation. Record every physical attempt, byte and elapsed interval. Stop before any unknown destination/dependency/redirect, stale pin, over-limit surface or failed observation/ownership gate. |
| `<INDEPENDENT_STOP_OWNER>` | Have an independently usable exact-case stop before allocation, including before a control record exists and during pending/late browser acquisition. Stop further outbound continuation and owned work without broad scans, guessed identities or name-based signals. Missing ownership means unknown disposition, not permission to signal. |
| `<CLEANUP_OWNER>` | Independently account for browser/context/worker, controller/observer, driver/proxy/listener/socket endpoints, exact profile and temporary case keys. Keep guards through closure and retain late arrivals, failed close and unknown state. Remove only verified case-owned resources under the admitted procedure. |
| `<EVIDENCE_CUSTODIAN>` / `<INDEPENDENT_EVALUATOR>` | Preserve exclusive private originals, hashes/file identities, chronology, publication and external actual exit/post-exit disposition. Evaluate the named layers and controls independently; public output contains classifications/counts only. Producer success or stop acknowledgment cannot replace these witnesses. |

The [historical reference proposal](../specs/060-meta-pixel-full-compatibility/meta-native-reference-plan.md#exact-case-contract)
sets upper ceilings of eight physical HTTPS attempts including retries/redirects,
64 observations, 2 KiB per URL, 64 KiB request headers/body, 2 MiB per accepted
response, 8 MiB aggregate and 60 seconds including launch, cleanup and
publication. Its attended proposal stops work by 40 seconds and reserves at
least 20 seconds for teardown/publication. These are historical proposed
acquisition ceilings/reserves, not measured fit, replacement performance
budgets, proof of currently qualified enforcement or current authority. A required graph
that does not fit blocks; do not truncate it or raise the ceilings implicitly.
Inspected transport needs exact isolated trust, strict upstream certificate/
hostname validation and no system trust changes. Any alternate route needs its
own evidenced transport/credential/redirect decision.

Stop on deadline, disconnect, unavailable stop, incomplete observations,
unverified ownership or unsafe continuation. Preserve original spend and partial/
unknown dispatch or cleanup. Abort does not prove non-arrival. No automatic
retry, source substitution, fallback, old-case replay or deadline renewal.
The original case remains spent/inconclusive; the historical additional case
was unspent without executable permission or a reserved window. No case is
renewed/refunded, slot consumed, window reserved or actual run selected here.

#### Numerical acceptance fields

[R-014's limits inventory](R-014-google-meta-request-authority.md#required-limits-missing-inputs-and-disposition)
provides local defaults and a structural proposal of one authority, one active
command and one outstanding branch. Those are source/design facts, not native
counts or measured budgets. Source-only limits are not implemented by this
manifest. All numerical acceptance values below are **unset**.

| Acceptance field | Classification | Evidence/decision needed before setting a value |
|---|---|---|
| Measurement cohort and workload | owner-input-required | `<PERFORMANCE_PLAN>` must pin native/replacement source, device/browser/profile, consent/storage, page/referrer, CPU/network/cache conditions and ordinary versus instrumented/unload runs. Identify allowed commands and native-supported pre-ready/burst workload. |
| Repetitions, statistics and noise rule | owner-input-required | Sample count, warm-up, statistic/percentile, timing origin, noise treatment and accepted absolute/relative regressions are unset. Agree on the method before collecting results; do not choose a threshold after seeing a failure. |
| Startup/readiness and first-event latency | measurement-required | Native/replacement startup, worker readiness, queue wait and end-to-end command/response distributions, with matched timing origins. Acceptance maxima/deltas unset. |
| Main/worker CPU, snapshot/clone and heap | measurement-required | Main admission work, worker mapping/hash time, input/request/response copying, peak/retained heaps and diagnostic cost. Time, byte and memory maxima unset. String lengths cannot bound UTF-8 bytes, proxy execution or process memory. |
| Input/config/identity limits | measurement-required | Accepted shapes, depth/keys and per-command/aggregate UTF-8, structured-clone and retained bytes. All maxima unset; an acquisition URL ceiling is not a replacement input model. |
| Queues, history and waiters | measurement-required | Native-supported burst/pre-ready workload, queue count/bytes/age, history/ledger lifetime and waiter/diagnostic maxima unset. Later qualification must detect visible overflow and forbid silent trimming or resurrection. |
| Request/response graph limits | measurement-required | Complete native operation count/depth/order, per-URL/header/body bytes, response visibility/types and aggregate bytes. All replacement maxima unset; one local GET and local stream limits are not native requirements. |
| Deadline/close budgets | measurement-required | Init/hash/queue/transport/body/whole-command and close/publication distributions and sequential graph fit. Durations, reserves and accepted uncertainty unset. Later qualification must cover late completion, abort and no-retry behavior. |
| Page performance | measurement-required | Matched Largest Contentful Paint, Interaction to Next Paint and Cumulative Layout Shift measurements (LCP/INP/CLS), plus page startup/main-thread costs. Numerical acceptance and regression allowances unset; the historical local duration is not this baseline. |
| Acceptance/control validity | qualification-required | Independent completeness, byte/queue/deadline overflow, timeout/late-work and loss/value/extra-request/response controls for the selected source/cohort. A measured mean or logical queue limit cannot prove hard CPU/memory preemption. |

To finish route planning, supply the case/resource/evidence handles and proposed
observation/measurement methods; numerical results are not an owner guess.
Actual graphs, generated-value rules and performance distributions need later
separately approved measurement. Before dependent implementation, those results
need reviewed numerical acceptance, frozen-contract/boundary fit and browser
admission evidence. Production boot/unload fit remains independently open.
Before any run, additionally require current source/setup/ownership and control
qualification, the exact finite safety envelope, separate dispatch authority
where applicable, coordination and explicit admission. This document supplies
none of those permissions.

**Minimum owner input bundle:** privately supply one `<META_CASE_INPUT_BUNDLE>`
binding `<OWNED_PAGE>`/`<TEST_PIXEL>` and their current owners, exact command/
page/consent/config/browser/profile state, and explicitly available original
source/capture handles with provenance and completeness limits. Name whether
only retained originals are available or an owner-operated capture procedure
is proposed; for the latter, include the operator, independent stop/cleanup
owners and the existing observation/enforcement proof or its precise absence.
Include the proposed paired measurement conditions/method, leaving numerical
results unset. Do not include private IDs/credentials in public docs.
**First unresolved gate:** that explicit current case/input and route-evidence
bundle is absent. **Exit:** stop with this manifest and blocker. Review only a
locally supplied bundle to decide whether a complete, safe acquisition proposal
is feasible; return its first unsupported input/control if not. No additional
research, runner work, measurement or successor is automatically commissioned.

### Exit

**Blocked on owner input:** explicitly supply the minimum
`<META_CASE_INPUT_BUNDLE>` defined above, using private handles and current
resource/route evidence. Do not automatically commission another feasibility
study, runner repair or retry. A locally supplied bundle can establish whether
a complete safe acquisition proposal is feasible; it is not permission to run
one. The first reference would inform 060-01 only; replacement qualification,
other cohorts and product outcomes remain open.

## Open questions

- Which current owned-resource confirmations and legitimate product observations
  can the owner supply for each first case?
- Can an existing or owner-operated route supply the complete first-case
  reference within its safety envelope?
- Which first-case numerical performance limits can be grounded in the retained
  baseline, and which measurements need later approval?

## Conclusion

The Meta case/limits manifest identifies the first blocker: an explicit current
`<META_CASE_INPUT_BUNDLE>` with ownership, case state, original-evidence handles
and route/control facts. Existing records establish no qualified complete
acquisition route. Google research and the overall evidence-route investigation
remain open. No capture, measurement or live action was executed, and no
additional research or infrastructure packet is automatically commissioned.

Promoted to: pending; implementation stays with 059-01 and 060-01. Use 059-15/18
for any explicitly approved native-acquisition changes, not a duplicate tool spec.
