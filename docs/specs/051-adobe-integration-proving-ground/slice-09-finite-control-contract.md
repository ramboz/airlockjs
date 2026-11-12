# 051-02/09 finite negative-control proposal

**Status: ACCEPTED FOR SOURCE-ONLY IMPLEMENTATION.** This defines three fixed controls after
the [configured positive witness](slice-09-configured-positive-witness.md).
Each compares one stock arm and one chamber arm in separate fresh contexts.
The controls test absence of specified effects over a measured interval and
retain original SDK results where the SDK is reached. They do not prove indefinite nonprocessing,
downstream reporting, full 051-02/09 acceptance or adoption.

The coordinator accepted the no-consent mapping below within delegated POC
technical scope after independent frame review of `e1d5fa05`. This accepts
source implementation only. It authorizes no deployment, job, browser, SDK,
network request or Target change. It does not create an allocation or an
accepted execution decision.
Each later actual case also needs its own current scope, setup, source and
served-byte bindings, allocation, independent STOP and cleanup gates.

### No-consent source evidence amendment

The coordinator accepted the fixed no-consent source frame at proposal
SHA-256 `61a5127fa3d7fbb0b293da05cb059d5a0f4dc9698c28128e32cda4f1352eb5f6`,
after independent frame reviews and direct verification of its consent-response
correction. The coordinator retained the review receipts at
`poc-execution-20261105/review-nonrender-0ad3f7e7/no-consent-assets-frame-final.json`
and the three preceding frame results in its session evidence. The proposal
specifies the original chamber worker receipt, guarded host refusals,
zero-request state and stock zero/one-request lineage. A consent response must
be HTTP 200 and pass the existing native
response checks; collect HTTP 204 behavior is unchanged.

The bounded context request/failure observer is a source-grounded candidate.
Native subscription initialization, worker coverage and delivery through
closure remain UNKNOWN until separately established. A mock, empty event list,
source pin or caller flag is not native evidence. Production cohorts remain
unbound, and START has an independent admission refusal even with valid
synthetic proofs. Current owner routing evidence remains missing. This
amendment grants no actual execution or admission and does not change the
slice's lifecycle status or historical records.

## Grounded starting point

- [051-02 AC4/5 and cases](slice-02-test-baseline.md#cases-timing-and-limits)
  require actual no-consent, no-offer and non-render controls, explicit
  outcomes and positive sensitivity. Its 64-request whole-baseline ceiling
  is cumulative, not a new allowance for this proposal.
- The [positive witness](slice-09-configured-positive-witness.md) records
  five native requests per arm: consent, fetch, page with DISPLAY, custom,
  and INTERACT after render and trusted input. It used the configured
  `poc-native-collect-v1` and `poc-sticky-conversation-v1` profiles and pinned
  Alloy 2.31.1. The
  [offline roster contract](slice-09-official-sdk-offline-contract.md#finite-roster-and-bounds)
  sizes no-consent at one and no-offer/non-render at four requests per arm.
  Its supplier execution used synthetic responses, not live negative proof.
- [`stock-site.mjs`](../../../probes/adobe-compatibility/stock-site.mjs)
  has fixed cases. Its no-consent `collect` returns before invoking the SDK;
  its no-offer and non-render paths collect page/custom without render
  notifications. [`stock-wire-check.mjs`](../../../probes/adobe-compatibility/stock-wire-check.mjs)
  checks recorded values only. It can label zero-request checks
  `not_exercised`; it cannot establish provenance or SDK denial.
- [`chamber-journey-host.mjs`](../../../probes/adobe-compatibility/chamber-journey-host.mjs)
  returns `no-offer` for absent qualified content and rejects interaction
  without confirmed render. Its denied-consent fixture rejects initialization
  before a worker call
  ([test](../../../test/adobe-chamber-journey.test.js)). That is a host
  guard, not an observed SDK rejection.
- At framing, the fresh arm and page hard-coded the positive case and the
  job required five requests per arm. The subsequent
  [no-offer source checkpoint](slice-09-no-offer-source-witness.md) adds a
  closed four-request path but retains its admission and observed-result
  refusals. The positive-v3 checker and binder do not accept these controls.

## Fixed cases and required outcomes

Each case has one fresh stock context followed by one fresh chamber context,
with the first context closed before the second starts. Each case uses a new
bound job, run, ledger and evidence root. No reuse of a consumed allocation,
retry, warm-up, resending or mixing arms from different attempts is allowed.
Use the same official SDK bytes, configured profile, declared endpoint and
cookie grants, tenant, scope and state-evidence controls as the positive.
Current owned resource bindings and active-only environment must be verified
again before traffic. Do not select a foreign scope to manufacture no-offer.

| Case | Required original result and wire | Host and notification result |
|---|---|---|
| `no-consent` | Record initialization, consent and each reached or blocked fixed collection command with its original outcome. At most one native consent-only request, zero collection events. An SDK-denial claim requires an invoked SDK collection command and its original denial. A pending result does not prove denial. A host refusal before invocation is `host_guarded_sdk_unexercised`, not SDK denial. | No qualified offer, insertion, DISPLAY or INTERACT. Preserve the actual guard and reached seam per arm. See the accepted predicate below. |
| `no-offer` | With the known owned activity inactive in the approved active-only environment, capture the real fetch response and returned SDK result. They must establish no qualifying offer at the exact scope. One grant, one fetch, one page and one custom event are the expected four requests; retain the actual page/custom returns. | No offer insertion, DISPLAY or INTERACT. Record the trusted input used for the custom event separately from a rendered-offer interaction. A returned owned offer, unknown serving state or incomplete response fails or leaves the case unverified. |
| `non-render` | With the same owned activity qualifying, capture the actual fetch response and returned SDK result. Exactly one qualified owned offer must join by original identity, scope, scopeDetails and content to the approved expectation. One grant, one fetch, one page and one custom event are the expected four requests. | Deliberately skip insertion and render acknowledgement; prove the reserved slot has no inserted offer and no native DISPLAY or INTERACT. Record custom input separately. A failed render attempt is an error, not this control. |

Use the following closed result vocabulary in the new case-specific report:
`observed` only when both arms satisfy their complete case predicates and close
cleanly; `divergent` when complete original evidence disproves a predicate;
`unexercised` when the required stimulus did not reach its named seam; and
`unknown` for missing, late, interrupted or ambiguous evidence or closure.
Preserve the actual underlying command outcome and any safe error category;
do not manufacture an SDK result, replace a void return with success or infer
dispatch from a locally resolved command. An SDK rejection or pending result
alone is insufficient without original command identity and the bounded wire
observation. AC5 requires the real-SDK no-consent control and an honest
distinction between host and SDK enforcement; it does not explicitly require
an SDK-native denial in each arm.

## No-consent reachability and acceptance

The source establishes the following paths. These are source expectations
and controlled-fixture evidence, not a fresh live no-consent result.

| Arm and stimulus | Reached seam and expected source outcome |
|---|---|
| Stock `initMartech`, then `updateUserConsent` with collect and personalize false | [`stock-site.mjs:346-358`](../../../probes/adobe-compatibility/stock-site.mjs#L346-L358) invokes these fixed integration exports. The consent call can reach the SDK's `setConsent` through the pinned integration; capture its actual original command/result and any completed consent-only response. The pinned 2.31.1 [offline runner and checker](../../../test/helpers/adobe-official-sdk-journey.js#L1990-L2008) exercise the host-guarded case with synthetic responses. The [witness](slice-09-official-sdk-offline-witness.md) records consent-state sensitivity; neither it nor the separate [2.35.0 rig](../../../rig/alloy-consent-pending.mjs) predicts this live result. |
| Stock fetch `sendEvent`, page `sendAnalyticsEvent`, custom `pushEventToDataLayer`, interaction `sendEvent` | [`collect`](../../../probes/adobe-compatibility/stock-site.mjs#L310-L316) blocks each callback before invocation under denied consent. The fixed fixture expects four attempted and four blocked collection calls and `locally_guarded` ([test](../../../test/adobe-stock-site.test.js#L457-L470)). SDK collection denial is unexercised; an undefined host return is not an SDK return. |
| Chamber `initialize` with denied analytics or personalization | [`perform` calls `check` before `request("init")`](../../../probes/adobe-compatibility/chamber-journey-host.mjs#L67-L119); `check` rejects `no-consent`. The controlled test records no worker calls and no dispatch ([test](../../../test/adobe-chamber-journey.test.js#L1032-L1041)); the [offline runner](../../../test/helpers/adobe-official-sdk-journey.js#L2044-L2057) expects that rejection. The worker's separate [`initialize` guard](../../../probes/adobe-compatibility/chamber-journey-worker.mjs#L139-L156) also precedes its SDK `configure` and `setConsent` if reached. Under this path, chamber SDK initialization, consent and collection are unexercised. |
| Chamber `fetch`, `page`, `custom`, `interact` with denied consent | The same host `check` precedes each step; no worker `sendEvent` follows. Existing page orchestration hard-codes granted consent and assumes successful initialization ([page](../../../probes/adobe-compatibility/supervised-journey-page.mjs#L376-L414)); it cannot execute this denied path unchanged. |

AC5 and its complete [case block](slice-02-test-baseline.md#cases-timing-and-limits)
call for a real-SDK no-consent control with explicit outcomes and for
distinguishing SDK rejection from host guarding. They do not say that both
arms must produce the same internal denial category or that native SDK denial
must be manufactured. Stock host guarding and chamber host guarding may be
compared on their reached enforcement and bounded absence, while reporting
each unexercised SDK operation separately. A guarded host outcome is not an
SDK rejection.

The independent frame review of `e1d5fa05` supports the following mapping,
which the coordinator accepted under delegated POC technical scope. A chamber
host-enforcement control may qualify when the fixed denied-consent stimulus
actually reaches the pre-initialization host check and retains the original
`no-consent` refusal, reached seam and attempted fixed commands. SDK
initialization, consent and collection remain explicitly `unexercised`, as
does native SDK denial. Stock retains its own actual initialization and
SDK-consent outcomes separately and records its collection host guard.

The **case** is `observed` only when both arms satisfy their own complete
enforcement predicates, including actual bounded post-settlement observation,
positive sensitivity, state and closure evidence. An unreached stimulus,
missing original refusal, synthetic fixture or empty recording cannot pass.
Do not silently substitute an initialized chamber SDK, equate a host refusal
with native SDK denial or widen a consent gate. No-offer and non-render
are independent paths; neither requires a native-denial claim.

## Bounds and observation

Freeze one case per job with two contexts and one page per arm. The per-arm
Adobe admission caps are **1** for no-consent and **4** for each granted
control, with corresponding pair maxima **2**, **8** and **8**. Those are
ceilings, not permission to consume or retry; an unexpected event, duplicate,
extra route or attempted over-cap dispatch stops the case before dispatch.
Count all attempted and admitted traffic, including consent and SDK retries,
against the approved cumulative baseline budget. The stock wire predicates
and offline sizing above ground these caps; actual future SDK behavior is not
assumed to fit them.

Retain the existing per-arm ceilings of 96 resource admissions, 8388608 page
bytes, 8192 request-body bytes, 16384 response-body bytes and 32768 total
recorded wire bytes. The cap applies before release of a dispatch. Preserve
the existing exact endpoint, tenant, body, browser, asset and source checks.
Do not raise a cap to make an unexpected SDK retry pass.

Keep the existing 35-second wall/monotonic action cutoff, 45-second per-arm
case limit, job hard deadline and cleanup deadline, with cleanup no later
than hard plus 10 seconds or the approved earlier cap. Start the passive
interval only after the latest of the final reached case-specific stimulus,
the last required command settlement and the last required completed
response or state observation. Retain the recorder and guards for at least
**10000 measured monotonic milliseconds** from that anchor. If a required
result or response stays pending, the anchor is not established and the
case remains unverified. A void return is recorded as void; it is not an unsettled
promise or a transmission acknowledgement. Check
STOP, owner state, clock regression, case, hard and cleanup deadlines during
the wait. The action cutoff still applies to new actions; passive observation
may cross it but must finish before the case and hard deadlines. Continue
observing a pending SDK result only within those bounds; it cannot start the
post-settlement interval until it settles. If the full interval cannot fit,
refuse or report UNKNOWN. Record each anchor component and actual wall and monotonic anchor,
end, elapsed, substage and first guard. A fixed timeout callback alone does
not prove elapsed time.

## Evidence and comparisons

Keep original private captures and explicit byte hashes. For every admitted
request, join its original bytes, unique request identity, method, route,
body hash and size to reservation, release, actual completed response,
boundary/state evidence and SDK outcome. A local acknowledgement, beacon queue
or synthetic response cannot stand in for the completed Adobe response.
Check consent and the absence of collection separately when there is no
request; absence requires the active observation and a reached stimulus,
not an empty capture alone. Retain the state proof and final state for each
arm under the same applicable v2 controls as the positive; any zero-request
case must define and test the applicable local-read and final-state shape
before execution rather than inventing five request records.

Compare stock and chamber per case: exact routing and consent intent,
ordered events, reached seams and their actual outcome categories, response
semantics, qualified offer state, host and notification behavior. Do not
require equal internal SDK categories when host governance differs. Join
each arm's own original identities and state transitions. Preserve the positive-v3 field-specific
normalization rules and their within-arm continuity checks wherever applicable;
do not broadly strip identity, event, routing or proposition fields. Incomplete
response, unjoined evidence, a required external mismatch or an unknown field
is not parity. Recorded differences in reached internal guards are not by
themselves a mismatch.
Public reports contain only status, counts, timing, hashes and safe categories.
Selectors, private hosts, payload values, cookies and credentials stay private.

## Source shape and review gate

Propose the closed discriminator `airlock.05109.finite-control/v1` with
case exactly `no-consent`, `no-offer` or `non-render`. A case-specific job,
page capsule, admission, capture, boundary/state evidence, original result
and pair report must bind that exact version and case to the same job hash,
pair/run identities and arm; reject a missing, mismatched or cross-case
binding before accepting evidence. A zero-request arm still binds its
original stimulus, guard, observation interval and state/closure evidence;
it has no invented reservation or response. The validator uses only the
predicate for that case and version. This is a proposed closed contract,
not an implemented schema or a new admission path.

The case-specific checker sits behind the existing fresh execution path.
Positive-v3 jobs, binder,
historical run/retry refusals, evidence roots and old UNKNOWNs retain their
existing behavior. Do not widen a v3 positive predicate to accept a negative
record. Do not add a generic command broker, scheduler, custody platform,
arbitrary endpoint or user-supplied code.

The smallest likely touched surfaces are `fresh-pair-execution-job.mjs`,
`fresh-pair-execution-arm.mjs`, `fresh-pair-execution.mjs`,
`supervised-journey-page.mjs` and the existing case-specific capture/binder
seams, with focused job, arm, entry, boundary, state and wire tests. The
controller and independent STOP may require a narrow case-specific cap
binding; preserve their single-use, locked admission and original-marker
invariants. Inspect these seams before implementing. The actual set is a
proposal, not a claim that those edits alone are sufficient.

Synthetic source tests must cover each implemented case and both arms, exact
results and limits, isolation, source binding, deadline/STOP/cleanup, and
preservation of the positive-v3 path. Mutate each protected predicate:
inject collection under denied consent, DISPLAY or INTERACT without render,
foreign or absent offer, missing real response, altered reservation/release
join, wrong tenant/route, early settle callback, clock regression, missing
state/final state and duplicate dispatch. Reject mixed version, case, job,
run and arm evidence. A delayed-settlement test must show that a result
arriving near the end of an initial ten-second period starts a new full
post-settlement interval or yields UNKNOWN when it cannot fit. Each mutation must fail the relevant
checker. Use the actual positive-shaped evidence as a sensitivity reference
without reclassifying synthetic data as a live run.

## Assumptions and stop conditions

1. **Unverified:** A future actual no-consent execution has not established
   the reached host refusals, stock SDK-consent outcome, finite observation
   or closure. Native SDK denial remains unexercised; do not infer it from
   a host guard or relax a boundary to obtain it.
2. **Unverified:** Both arms can retain their required original results,
   state evidence and complete responses within the smaller caps and timing
   bounds. Missing consent responses, SDK retries, delayed settlement or
   unobservable results are stop/UNKNOWN outcomes, not permission to raise
   limits or fabricate evidence.
3. **Unverified:** The current owned activity can be made inactive or
   qualifying as required with a separately reviewed bounded operation and
   verified inverse. Any drift, foreign change, unknown serving state or
   incomplete cleanup blocks the next case.

Before any later run, verify the exact owned baseline, preflight, current
served/source/browser/SDK pins, exclusive operator supervision, one-shot
independent STOP and a bounded inverse with readback. On STOP, refusal, lost
supervision, unexpected traffic, deadline or uncertain closure, preserve the
original partial record and consumption. Close owned contexts and processes,
disable test configuration and perform the approved compare-controlled
inverse; do not overwrite foreign changes. No later case begins until cleanup
is observed and the next case's gates are independently current.

## Proposed no-offer serving proof

**Status: ACCEPTED FOR SOURCE-ONLY IMPLEMENTATION.** This amendment defines a
binding, not a case allocation or authority to perform reads, writes or SDK
traffic. The production cohort remains null. Independently, START refuses
even with valid data and a bound cohort until a separately reviewed
finite-case admission plan exists. A validated serving-state result does not
grant admission.

Before job finalization, the fixed trusted operator captures one OAuth
exchange and one GET each for the selected activity and environment, with no
retry or additional metadata reads in this step. Before the first request,
the operator creates a fixed exclusive private consumption marker bound to
the case, pair, run, source and exact serving plan. Failure leaves this marker
in place; a repeated invocation refuses before any request. Its bytes and
identity are checked and its digest is bound into the receipt and job.
It retains
bounded request-intent and completion receipts. OAuth credentials and bearer
tokens are never retained. The activity and environment retain their original
response bytes, status, media type, receipt times and hashes. The private
receipt binds the planned no-offer case, pair and run IDs, source and cohort
pins, exact selected resources, operation window and cleanup/STOP scope.
It is not a caller-supplied boolean or an authority service.

The finalized job includes immutable digests of that receipt and its exact
raw inputs, the approved original activity baseline and the separate routing
evidence. The job hash then binds those inputs transitively; the pre-job
receipt does not contain its future job hash. The fixed loader must check
file ownership, type, link count, no-follow opening, stable file identity,
bounded size and hashes before use and at the existing input-change checks.
Missing, changed, substituted, symlinked or mismatched evidence refuses
entry. No mutable post-finalization sidecar substitutes for a job input.

The activity predicate requires the exact owned activity, workspace, property,
scope and offer bindings, `saved` state, original historical dates and full
original baseline equality excluding only `modifiedAt` and `modifiedByName`.
It is a separate inactive-case predicate. The positive
[`target.activity`](../../../probes/adobe-compatibility/responses.mjs#L138)
future-start requirement stays unchanged. The environment response must pass
the existing selected-ID, `default:false` and
`serveInactiveActivities:false` checks. Both GET responses must be HTTP 200,
complete, correctly typed and joined to their original request intents.
Unknown fields or incomplete comparisons do not establish inactivity.

Routing is a distinct, current owner UI and saved-pin proof for the same
datastream and selected environment. Apply the existing
[routing evidence contract](slice-01-access-preflight.md#managed-routing-evidence-separate-file-version-1),
including its original timestamps, complete service/suite scope, saved-pin
acknowledgment, provenance and current resource comparisons. A digest alone
does not attest what the owner saw. An expired record cannot be renewed by
copying it, and an unavailable response is not a confirmation. The last
owner screenshot is also more than 24 hours old. A new acknowledgment alone
cannot refresh that observation; a new current evidence set is needed. This step's
three calls do not provide the fresh property-token comparison required by
preflight. The separately authorized preparation below must provide its
current witness, or entry remains blocked. No configuration API access is
inferred.

The fixed, reviewed no-offer preparation operator reads the exact protected
input and routing buffers once, validates them and, in that invocation,
validates the completed selected-property response and passes its actual
token to `evaluateRouting`. Omission of the token refuses this mode. Its
versioned, secret-free comparison witness binds those input and routing
digests, the exact generated report digest, selected scope, reviewed producer
and source, operation and original comparison/validity times. It retains
only fixed nonsecret property request/completion metadata and allowed scope
fields. The wrapper generates the comparison event after validation; a caller
cannot supply a boolean or ready event.

The candidate source checks routing freshness before preparation requests,
then requires the selected property's token for the in-memory comparison.
The fixed preparation and serving reads request identity encoding and refuse
an encoded response or a declared content length that does not match the
completed body. The serving receipt records the fixed request and completion
metadata, but does not retain the OAuth response body.

The fresh API token, newly computed token hash, property response body, body
hash, prefixes and unknown property fields stay in memory and never enter
the witness, logs or job inputs. The owner-supplied routing file retains its
existing historical digest unchanged. The loader verifies the witness's
producer, version, byte, scope, operation and time joins using protected-file
checks; it cannot re-compute the token comparison. This is a trusted-operator
attestation, not independently recomputable secret proof, a server signature
or permission. The property read belongs to separately bounded preparation,
not the three-call serving-state step. The default preflight, its report and
the closed 051-01 privacy record remain unchanged.

The maximum metadata-proof interval is **five minutes**
from the earliest activity or environment request start. Both responses and
their receipts must complete before job finalization. Job observation must
follow their completion. START must occur after all proofs complete and
before their expiry. Let proof expiry be the earliest of that five-minute
limit, the actual routing evidence expiry and 24-hour observation limit, the
authorized operation window and all existing proof limits. The job hard
deadline must be at least ten seconds before proof expiry; cleanup must end
by proof expiry and all existing earlier cleanup limits. Keep the existing minimum remaining time,
per-arm bounds and STOP. If both arms and normal cleanup cannot fit, refuse;
do not extend or refresh the job in place. No current routing proof exists.

The five-minute bound is a local risk limit, not a server lease or
a claim that remote state cannot change. It assumes the recorded UTC wall
clock is comparable and accurate enough for the bound. Detect clock
regression, preserve each recorder's own monotonic interval and do not compare
monotonic values across processes as one clock. Resource or routing drift,
lost supervision, stale proof or uncertain closure stops the case and keeps
its outcome unverified. STOP and approved safety cleanup still apply after a
refusal or expiry; late cleanup does not make an expired case valid.

Source tests must mutate each receipt and raw digest, file identity, case/run
and resource binding, original baseline, state, environment flags, routing
proof, timestamps and each deadline. They must reject missing, stale,
post-finalization or cross-case evidence while preserving positive-v3,
STOP and original failure outcomes. Synthetic fixtures cannot establish
actual serving state or routing.

## No-offer response shape

The public [Adobe Edge response schema](https://api.github.com/repos/AdobeDocs/data-collection-apis/git/blobs/a4e4b5761289e71d1f7444fbaab2377dded47db1)
requires root `requestId` and `handle` fields. Its event handles require a
type and payload, but do not require a `personalization:decisions` member.
The retained blob has SHA-256
`1a8e1c3dfb781bad2f43fbf51c197a080af0608c407d67ba2a0b28033d11fa36`.
Read-only inspection of the retained
152336-byte Alloy 2.31.1 source, SHA-256
`7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8`,
shows its response wrapper defaults a missing `handle` to `[]` and filters
handles by type before flattening payloads (byte offset 48286). Its
personalization path consumes that filtered result and logs no offers for an
empty result (offset 109086).

The no-offer capture predicate accepts zero or one empty typed decision
handle, with a present, well-formed root handle array and an empty original
SDK propositions array. A present decision handle must retain its event
index and empty payload. The paired comparison still requires the original
response request ID, known state and identity handling, exact remaining
fields, scope, reservation and temporal joins. Missing root handles,
malformed or duplicate decisions, nonempty propositions and unmatched
contents refuse. These source checks do not prove an actual no-offer response
or establish serving state, routing or admission.
