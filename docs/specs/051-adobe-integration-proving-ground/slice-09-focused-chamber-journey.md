---
status: IN_PROGRESS
dependencies: [051-01, 051-04, 051-06, 051-07, 051-08, adr-0016, adr-0017, adr-0039, adr-0045]
last_verified:
kind: feature
frame_review: true
arch_review: true
claimed_by: adobe-adoption-goal
---

## Slice 051-09 — one focused Analytics and Target chamber journey

**Goal:** The operator can attempt one named Analytics/Target journey through
the existing Alloy chamber and compare its actual dispatch, response, render
and notification behavior with the stock reference.

**Configured positive witness, 2026-11-06:** One bounded stock/chamber pair
returned observed and passed independent read-only verification. The
[witness](slice-09-configured-positive-witness.md) records its exact source,
job, timing and limits. Negative controls and full 051-09 acceptance remain
open; the eight earlier UNKNOWN allocations do not change.
The [finite control contract](slice-09-finite-control-contract.md) is accepted
for source-only implementation. It does not authorize execution.

**Owner priority decision — 2026-10-26T15:28:33.302Z:** prioritize this one
journey and pause further general harness expansion. This is a prototype/
evidence milestone, not full SDK support, a release or completion of051-02/03.
Their existing acceptance criteria, outstanding cases/performance pairs and
dependencies remain unchanged. Required live ownership/setup gates are not waived.

### Bounded scope and prior art

Reuse the stock journey's order and native event shapes:
fetch proposition; confirm safe host rendering; send page/DISPLAY; submit a
distinct custom link event; submit native INTERACT after a trusted click.
See `stock-site.mjs:314-323,359-421` and the recorded-wire checker contract.
The page and custom event labels must differ; the proposition's original
id/scope/scopeDetails must survive. Neither GA4-style exposure nor a fabricated
SDK result can replace Adobe-native reporting.

The existing product entry supports page views and decisions-as-data, but
`ALLOY_EVENTS` admits only page_view and `toXdm` always builds page-view XDM.
The existing host exposure deliberately excludes Alloy, and its separate
decision sink is not awaited by SDK result settlement. The
[source checkpoint](../../research/R-014-adobe-first-compatibility.md#existing-chamber-journey-checkpoint--2026-10-26)
records these gaps and the86 passing controlled-boundary tests.

Deliver narrowly scoped probe journey code under `probes/adobe-compatibility/`
and focused tests. Reuse the current chamber, mediated round-trip egress,
cookie/consent controls and safe host-rendering path. Small additive changes
to the Alloy connector/worker are permitted only when needed for the fixed
probe; existing default boot/config/vocabulary behavior stays unchanged.
Do not introduce a second worker sandbox, generic SDK command broker,
arbitrary callback transport, Docker/runner framework or unrestricted DOM/
network fallback. Do not modify the official SDK or frozen core contracts.

### Source implementation readiness

- [x] The fixed probe event/result/render-ack contract below has frame review.
- [x] Existing stock event/notification shapes and current chamber seams are read.
- [x] The first-party/source-only tests require no browser, credentials or vendor requests.
- [x] Preparation/implementation time is charged against the existing compatibility
      allowance; no new eight-hour budget is created.

### Native routing increment: source implemented and reviewed

The earlier profile refused Alloy's native consent/default-Edge routes.
The implemented change belongs to this slice, not a new SDK or runner project.
At2026-10-26T21:59:57.102Z the owner explicitly approved this routing
amendment and implementation through Jig. Only the opt-in probe's destination
set changes; default connector grants and frozen core remain unchanged.
The original probe-ceiling-preservation instruction is amended only by the
closed grant below. This is not SDK/browser execution or a live window.

The approved source increment passed compliance, craft and architecture;
the parent independently observed188 controlled tests passing. See the
[routing witness](slice-09-routing-implementation-witness.md). This closes the
source routing step, not actual supplier SDK/browser compatibility or AC6/7.

Approved acceptance checklist for that increment:

- Use only HTTPS `edge.adobedc.net` for the probe's native
  `privacy/set-consent` and `interact` actions. Enumerate the16 exact paths
  from the base path plus the stock guard's seven fixed region hints;
  no path wildcard, `collect`, additional host or caller-selected endpoint.
- Explicitly configure that fixed domain in the probe worker. Preserve one
  SDK instance and all tenant/consent/cookie/payload and result/error controls.
- Exercise controlled native-consent initialization followed by the existing
  fetch/render/page/custom/trusted-interaction chain through the real bridge;
  reject wrong tenants, unlisted regions/actions/hosts and denied consent.
- Preserve default connector/boot behavior and frozen core interfaces.
  Do not claim actual vendor serialization or live parity from these tests.

Scope: probe contract/worker/host, focused tests and directly related docs.
Checkpoint after30 active engineering minutes or sooner if the fixed scope
cannot work. No browser/vendor execution or general infrastructure follows.

### Fresh POC transport increment

The coordinator selected a separate source-only transport experiment under the
owner's November 5 POC grant. This is not a separate owner selection of eight
paths, an accepted ADR, or a change to the original 16-path checkpoint above.
The fixed `poc-native-collect-v1` profile adds the base V1 `collect` path and
the same seven region hints on `edge.adobedc.net`. Default connector grants and
the historical profile remain unchanged.

For this profile, page and custom use the original integration's four options:
`documentUnloading: true`, XDM, data and an empty `edgeConfigOverrides`. This
deviates from the explicit page/custom personalization options in AC2 to
match the pinned stock wrapper. Fetch and INTERACT retain their existing
options. A controlled worker fixture supplies the standard Blob constructor,
models the SDK-shaped Blob creation and false beacon result, and checks the
original body reaches mediated fetch. The empty 204 in that test is synthetic.
The fixture does not execute the pinned SDK or prove Blob availability in a
live worker.

A queued beacon and the SDK-local 204 are not an HTTP receipt. The source
fence requires a separately admitted request and captured response; V1
`collect` requires an empty HTTP 204. Consent and interact require HTTP 200
with valid JSON and no reported error. Missing or mismatched evidence remains
UNKNOWN. A separate schema-2 job validates the fixed native profile's
structure. Its code-owned POC commit, page and worker cohort is unbound, so
actual entry and STOP preparation refuse it. Schema-1 jobs retain the old pins
and strict-16 behavior. The coordinator reported a compliance pass for the
runtime at `6a71a646`, and craft and architecture passes at `dcb030af`.
These source reviews do not qualify a live run. A new reviewed source/served
binding and the remaining admission gates are required before execution.
No new job or live admission follows from this increment.

All three earlier outcomes remain UNKNOWN. The original first attempted URL
and cookie condition were not captured; the collect diagnosis remains a
source-supported inference. This increment does not complete 051-09 or prove
downstream reporting.

### Acceptance criteria

1. **One fixed journey, not full command compatibility.** The probe exposes only
   the named fetch, page, custom link and proposition-interaction operations,
   plus explicit host-render and trusted-interaction completion. It uses one
   persisted SDK instance. Unknown operation names/options and out-of-order
   steps fail observably. No caller-selected arbitrary SDK command or function
   crosses the worker message boundary.
2. **Distinct native event payloads.** Fetch uses
   `decisioning.propositionFetch`; page uses
   `web.webpagedetails.pageViews`; custom uses
   `web.webinteraction.linkClicks` with distinct Analytics linkName/linkType;
   INTERACT uses `decisioning.propositionInteract`. Mirror stock's explicit
   `renderDecisions:false`, disabled automatic display/interaction and native
   proposition display metadata on the page event. Do not coerce custom events
   into page views, add duplicate page views or change the default connector.
3. **Real render/interaction ordering.** Return the proposition as original
   bounded data. Apply only a qualified HTML offer to an already-reserved safe
   host placement. Await actual application/visibility completion before
   authorizing DISPLAY; no offer, rejected HTML or non-render yields no DISPLAY
   or INTERACT. INTERACT requires a trusted click on the intended owned control
   after that render. SDK settlement is not a substitute for either observation.
   The host owns these observations; a worker-supplied success flag is insufficient.
4. **Governed request and result path.** SDK fetch continues through the existing
   endpoint/tenant/consent/cookie/payload controls, with only the owner's
  21:59:57.102Z closed probe destination amendment above. No unrestricted
   main-thread SDK fallback, caller-selected endpoint or other widening.
   Each probe operation has a correlated
   completion/error; rejection, malformed/non-clone-safe results and failed host
   completion are explicit, not a synthetic fulfilled result. Preserve original
   clone-safe SDK result data where returned and distinguish it from host facts.
5. **Unit/probe evidence is honest.** First implement and test the whole fixed
   orchestration with controlled SDK/Worker/host-render/trusted-click seams.
   Tests exercise page/custom distinction, exact native proposition metadata,
   SDK rejection, no-consent, no-offer/non-render, untrusted click, duplicate/
   mismatched completion and unchanged default behavior. Controlled captures
   do not establish actual SDK execution, native browser trust or live parity.
6. **Actual journey remains gated.** Before any live attempt, bind the official
   Alloy2.31.1 artifact in both arms, review the exact run plan and remaining
   case/cost allowance, establish supported runner ownership/stop behavior,
   obtain current unchanged-setup facts and fresh preparation checks, and
   verify deployed bytes. Reuse historical evidence without replaying spent
   controls. This slice grants no new case, resource, SDK slot or mutation scope.
7. **Compare one actual matched journey.** Record stock and chamber serialized
   dispatch/returned outcomes/render and native notification ordering separately;
   no uncontrolled dual send. Required differences produce an explicit divergent/
   blocked result. Do not claim this closes the full stock baseline, broad
   compatibility, performance bands or downstream reporting.

### Completion and stop conditions

- Source/frame/compliance/craft/architecture reviews precede a live attempt.
- No new general infrastructure component is a deliverable here. If a safe
  existing runner cannot be established, report the precise operational blocker
  rather than silently restarting the containment-platform project.
- Source preparation can proceed without current Adobe access. Live work cannot.
- Do not mark this slice DONE until actual acceptance evidence is available.
  Keep an implemented-but-live-blocked result distinct from a complete journey.
- The existing051-03 active-time allowance remains the outer compatibility
  budget, including this prototype; stop at its remaining limit with findings.

### Later host-only observation

One separately approved normal control through the existing detached execution
facility completed with native exit0 and0.320-second reported CLI execution.
The [host-control witness](slice-09-host-control-witness.md) preserves its narrow
scope, diagnostic correction and independent retrospective. It does not qualify
session-loss lifetime, actual H/S custody, a browser or the Adobe journey.
The new capsule is consumed; no further control follows automatically.

### Accepted supervised approach; execution still gated

[ADR-0045](../../decisions/adr-0045-owner-supervised-proving-run.md)
was accepted on2026-10-26 after the owner's21:38:31.044Z approval.
It selects the conditional foreground, owner-supervised exception, not an
executable procedure or traffic window. The owner approved two additional
proof contexts at21:13:51.054Z (22 aggregate; other caps unchanged), but none
has been reserved or started. The source-known consent/Edge mismatch must be resolved
under its own exact authority before live spending. The normal host control,
decision acceptance and conditional design reviews establish neither current
operator presence nor an execution window.

## Assumptions

- A fixed probe can reuse the current worker/host capability seams without
  requiring a frozen-core break. If this is false, surface the necessary
  decision before expanding the interface.
- The pinned SDK's clone-safe operation results and explicit native notification
  shapes suffice for this one journey. Unit/source inspection alone does not
  establish actual serialization or Adobe acceptance.

### Deviation log

Source implementation and controlled tests are recorded in
[the implementation witness](slice-09-implementation-witness.md). The fixed
probe uses an additive literal worker profile and independent transport
listener, not a frozen-core/public boot change. Existing default behavior is
unchanged. The later owner-approved routing increment replaces only the probe
ceiling with the fixed16-destination Edge grant and retains all other controls.
Trusted host paint/visibility observations
and caller-owned Worker custody remain explicit seams, not browser/live proof.
The priority decision changes work order, not the remaining baseline, safety or
release criteria. Scoped independent source compliance/craft/architecture now
pass after correcting stale-placement writes and fill-to-paint cancellation,
and were refreshed for the routing source epoch.
The initial findings and causal regressions are retained in the witness.
Actual AC6/7 evidence remains outstanding; this slice remains IN_PROGRESS,
not complete. Source review evidence does not authorize a REVIEWED/DONE claim
against the full journey criteria.

### Reconciliation sweep

Source checkpoint: probe guide, R-014,051 plan/tasks and architecture updated;
default Alloy behavior checked unchanged. No frozen-core/public contract,
SDK byte, release, distribution, baseline cost/state or live resource change.
The next normal worker build includes the inactive handler even on the default
path; runtime selection alone is opt-in. Actual run-plan/setup/runner/deployed
byte reconciliation and final slice reconciliation remain deferred until AC6/7
evidence exists. General harness expansion remains paused.

### Replacement R1 source-only contract and completion bar

The owner approved a bounded replacement source allocation. Its decision
record, [ADR-0050](../../decisions/adr-0050-evidence-independent-05109-source-checkpoint.md),
is Accepted after independent ADR frame review; a separate source frame has
passed. The R1 source candidate remains subject to independent review. This
subsection does not change the seven acceptance criteria, claim, dependencies,
status or earlier approval epochs. The old C compliance result remains FAIL;
its original producer, protected manifest, independent three-digest handoff,
assembler and positive real operational inspector witness remain unmet.

One hermetic source journey uses an owned synthetic response and one finite
first-party SDK double, through the actual bundled Alloy chamber worker,
journey worker and mediated fetch shim, `createChamberJourney`,
`createWrappedSdkHost`, a deterministic in-memory dispatch sink, the real
recorder, the shared operator check and `checkStockWire`. The sink observes
the actual governed host dispatch and returns the same original response bytes
the recorder observes. The SDK double parses the returned response body; it
must not select its result independently or manufacture a completed host
result or wire sequence. Controlled host paint, visibility and click observations
establish source ordering only. They are not real browser rendering or trust.

Extract the existing operator block into the pure same-module export
`checkSupervisedJourneyCapture`, used by `runArm`. Retain the stock branch and
exercise it with owned supplied-record fixtures, without claiming actual stock
integration. Snapshot closed inputs with `snapshotJson` without invoking
getters, proxies or coercions; preserve request and body bounds and five-request
maximum. Join five recorder requests, admissions and body witnesses one-to-one
in order using ordinal, request UUID, URL hash, method/content type and exact
original UTF-8 body hash and byte count. Reject duplicate, swapped, missing or
surplus records. Join the single fetch response's
`personalization:decisions` to returned proposition id, scope, scopeDetails
and qualified item/content; unsupported or ambiguous structure blocks. Bind
the selected activity, experience, scope, allowed offer hash and applied host
HTML. Preserve the real wire predicates, distinct page/custom events, native
proposition identity, notification counts, consent and host ordering.
The closed input includes fixed arm/run identity, existing expected
selectors/owned offer hashes, completed host result and observations, recorder
result and existing admission/native-body witnesses. Use actual hashing,
strict JSON parsing, qualification and wire predicates. Functions stay in their
respective realms and messages use structured clone. Do not substitute a
normalizer, sanitizer, inspector or checker. The committed redacted response
envelope is prior art only; new values are invented and independently labelled.
The SDK double covers only configure, consent and the four fixed operations.
Its serialization is synthetic stimulus, not pinned-vendor conformance.

The checker returns the closed public-safe supplied-records result specified
in the [operator contract](slice-09-supervised-operator-contract.md#replacement-r1-supplied-records-check-and-admission-withdrawal).
It never establishes independent provenance or execution readiness. The
separate `airlock.05109.synthetic-source-witness` contains the shared result,
synthetic classification and source/test hashes; it is not a Job, Prepared,
approval, historical EvidenceRef or actual arm receipt. Recorder URL
classification cannot authenticate Adobe dispatch.

**Separate R1 completion bar.** All six conditions must hold on one pinned
candidate:

1. A hermetic default test drives the actual bundled classic worker and actual
   host/bridge through one response-derived fetch/render/page/custom/
   trusted-click-fixture/interact sequence. It observes one synthetic SDK
   instance, one consent request and four event requests, distinct page/custom
   labels and exact returned proposition identity in DISPLAY and INTERACT.
2. The actual shared join is used by the test and `runArm`. A mutated response,
   request UUID, body byte, proposition identity, rendered HTML or join
   cardinality fails deterministically. Constant-return checker or host-result
   substitutes cannot satisfy the tests.
3. Deferred paint prevents DISPLAY. Rejected response, no consent, no
   offer/non-render, untrusted click, changed tenant/unlisted endpoint, denied
   payload and duplicate/cancelled completion cannot create the forbidden
   notification or effect. Assert exact traces/counts and result/error; reuse
   existing negative cases where they prove the predicate.
4. Reports retain false actual/provenance claims and synthetic records cannot
   enter actual inspect/run as Job, Prepared or approval. Assert no READY,
   claim/write, credentials, HTTP, Playwright import or SDK acquisition.
5. Hostile digest inputs invoke nothing; historical retry and new run admission
   refuse before effects; default tests attempt no unavailable-original reads.
   Changed historical-test dispositions remain visible, opted-in absence fails,
   and the existing invented-official-SDK refusal remains.
6. Required independent source-scoped reviews pass after bounded remediation,
   documentation states residuals, and the coordinator independently
   reproduces the selected offline result on the exact candidate.

The old historical role positive coverage and retry-success filesystem
coverage are withdrawn, not represented by synthetic replacements. No
official SDK execution, browser/server/network, actual dispatch, native host
render, chamber compatibility or full wire conformance follows from R1.
051-09 stays IN_PROGRESS; AC6/7, later fresh actual proving and all release
gates remain open. No source-only PASS replaces the canonical C FAIL.

**Required disposition of the failed partial work.**

| Finding | Choice and regression | Qualification limit |
|---|---|---|
| Digest object coercion | Require a primitive string before `SHA.test`. Test `Symbol.toPrimitive`, `toString`, accessors, outer/nested proxies and function digests through actual readers/source checks. Assert exact refusal, zero invocation counters and zero filesystem access. Valid primitive references use real hashing. | Descriptor safety is required; a regex must not execute attacker-owned coercion. |
| Parent-alias write escape | Quarantine historical retry before every filesystem call and new run admission before effects. Exercise concurrent calls and all write/sync/parent-alias fault schedules; every call refuses and all write/effect counters stay zero. | This forbids new consumption. It does not repair or qualify the real race or any real write/admission adapter. |
| Sixteen thin role assertions | Replace default role assertions with table-driven exact role/path/digest mismatch refusals and hostile-descriptor tests before historical I/O. Any retained actual-original assertions are opt-in, with exact fields/digests and named byte/custody drift failures. Missing originals fail when opted in. | Positive historical role coverage is UNAVAILABLE; default GREEN does not qualify 18 roles or custody continuity. |
| Private fall-through | Default tests use fully owned explicit fixture bytes and complete in-memory filesystem responses or owned temporary files, with no secrets/sibling fallback. Retry tests assert unconditional refusal. Keep historical byte-backed suites and every asset-reading hook opt-in. Assert default imports make no historical/private reads. | Exclusive-write/fsync/concurrency retry-success coverage is withdrawn. Historical integration is not rerun or represented as a passing replacement. |

Preserve the consumed-job stop path and independence from prior-pair journals.
Do not delete historical constants, change original pins, rewrite lost files,
refund reservations or infer quiet or cleanup. No new root or consumption
namespace follows.

**Causal test order.** First extract the existing checks without a behavior
change and pin current positive and negative output with owned fixtures; this
setup is not a RED. Then demonstrate a failing assertion when an otherwise
plausible capture contains a response with a different proposition, implement
the join and witness GREEN; repeat for a same-count swapped request/body.
Make the SDK double depend on the bridged response, and show that a wrong or
missing response causes failure or absence of notifications. Witness digest
coercion before applying the primitive guard. Admission regressions prove
quarantine, not successful retry or race repair. Missing files/tools, import
errors, unmatched tests and unconditional fixture exceptions are not causal RED.

The approved later source scope is limited to the operator; new source pipeline,
source admission, fixture helper and invented fixture; and the affected
evidence-roots, retry-once, retry-evidence, journey-integration and
journey-operator tests named in the approved R1 proposal. Core, connector/worker,
host/page journey source, stock entry, browser gate, recorder, wire checker,
normalizer, preflight, package/lock/config, vendor and deployed trees are
exercised dependencies, not authorized changes. A required interface or
semantic change there is a material blocker.

## Replacement R1 bounded deviation and reconciliation log

This log records the completed source-only checkpoint, not completion of
051-09. Executable/test candidate:
`a6c228350de504a9d6154ef97d8f6046865fd2f9`. The coordinator reproduced the
approved 16-file selection with historical opt-ins unset and one real-Chromium
case excluded: 639 passed, 24 skipped, exit 0. No official SDK, browser,
server, network or live Adobe operation was performed for this checkpoint.

The separate independent explicit Sol source
[compliance](reviews/replacement-r1-compliance.md#final-independent-source-compliance),
[craft](reviews/replacement-r1-craft.md) and
[architecture](reviews/replacement-r1-architecture.md) reviews passed this
candidate only. Architecture identified no additional deviation. The
conditional code-health and design conditions were both false. A different
fresh independent Sol [reconciliation](reviews/replacement-r1-reconciliation.md)
passed the corrected record candidate `d28f821`; it identified no additional
R1 deviation. These scoped passes do not change canonical old C FAIL,
slice/spec IN_PROGRESS, AC6/7 or the later SDK/product/live obligations.

The initial compliance needs-changes verdict remains recorded. Its identified
argv bypass was corrected and witnessed with a later causal RED/GREEN; owned
synthetic records were exercised against actual job, prepared and approval
validators. Historical role positives are strictly opt-in: independent fixed
byte pins and deep equality to parsed raw JSON establish byte/parse identity,
not semantic or actor authenticity. Named read-only actual-reader byte and
custody faults were authored but are unrun and unavailable. They do not
recreate originals or prove historical custody.

The earlier response, request and digest RED operator hashes were derived
after the fact from native edit records, not contemporaneous full-tree
captures; later argv RED/GREEN has actual pre-fix operator and test hashes.
An earlier parent combined run failed from a Vitest worker's missing
`process.nextTick` when stdin tests replaced global process. That is a harness
failure, not assertion RED or successful validation. The final candidate
uses restored scoped stdin getter spies; the subsequent selection passed.

New-run and historical-retry refusal prove pre-effect quarantine, not repair
of the historical filesystem race. Consumed-stop safety and old real-byte
copied-sibling qualification remain unqualified. Prior charges, reservations
and UNKNOWNs remain; no quiet or cleanup is inferred. The [synthetic witness](evidence/replacement-r1-synthetic-witness.json)
binds only its four named inputs and retains false `execution_ready`,
`actual_evidence`, official SDK execution, actual dispatch, native host render,
chamber compatibility, downstream receipt and full wire conformance claims.
The synthetic double and checker can agree on vendor-inaccurate serialization.

## Offline official-SDK checkpoint authority

The owner selected the offline official-SDK journey and authorized the resources
needed for it. The coordinator set a separate four-active-hour stop. The
[bounded contract](slice-09-official-sdk-offline-contract.md) specifies its
pending inputs, fresh independent Sol frame review, finite local cases, source
allowlist and evidence limits. It grants no live operation or historical
recovery. R1 remains a completed source-only checkpoint, old C remains FAIL,
and 051-09 and spec 051 remain IN_PROGRESS with all earlier criteria and
quarantines intact.
