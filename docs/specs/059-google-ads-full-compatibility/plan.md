# Plan - full Google Ads browser-tag compatibility

## Current delivery order and work boundaries

**Current execution status:** the shared foreground sequence stopped on Meta
preflight failure before product worker creation. No Google browser or conversion
was acquired. See060-14/059-20 actual records; exact normal cleanup was observed,
no automatic retry followed, and full Google browser DoD remains open.

### 059-20 fixed browser preparation - 2026-10-26

Owner requested both local-browser journeys. Use the bounded
[concrete serving/test plan](../060-meta-pixel-full-compatibility/plan.md#060-14-fixed-browser-preparation---2026-10-26)
for ordinary local source preparation, with a separate fixed Google page/
controller and its own conversion adapter, worker, receiver path and assertions.
Do not use a Meta result as Google evidence. Planned actual limits are one
fresh-profile60-second/64-request/8-measurement-attempt local interval, with
no automatic retry; it remains unadmitted until concrete execution reviews.

The current Chrome bundle is156.0.8078.48; historical155 receipts and another
lane's supervised exception do not qualify it. A request for this lane's
supervised-loss exception returned no selected decision. Source/local HTTP
tests proceeded under that checkpoint. The owner subsequently explicitly
permitted supervised foreground execution for both local journeys; use the
selected procedure in the linked Meta plan with a separate Google profile,
interval, source and receiver assertions. Its scoped source/operational review
precedes acquisition. No Docker, native SDK, vendor or production operation
is permitted. Final goal remains an actual browser conversion and
cleanup, so source preparation alone cannot close059-20.

The [Google/Meta delivery queue](../../releases/vendor-parity-assurance.md#googlemeta-delivery-queue-2026-10-26)
is the single ordered view of the remaining work and decision triggers.
This plan and slice frontmatter retain the detailed evidence/dependency contracts.
[Accepted ADR-0042](../../decisions/adr-0042-google-meta-product-delivery-gates.md)
records the product-first admission/stop rule; it is not an execution grant.

After completed059-19, the next Google product draft is
[059-20 local-browser conversion](slice-20-local-browser-conversion.md).
Refine its local fixture/transport test and current browser stop/cleanup plan;
do not extend the Docker control or invent the34 missing primary fields.
Actual browser execution is blocked until that draft's own DoR clears.
Native/reference work remains with058/059-15; full first cutover remains059-01.
The existing02-12 slices own every currently documented later feature family,
not a fresh duplicate backlog. The queue maps each to its next refinement.

Before supporting work starts, name the consuming criterion, smallest reused
change, allowed inputs/authority, finite checkpoint and concrete exit/blocker.
The default two-hour prerequisite checkpoint is accepted, not a
new spend/run allowance. No unrelated runner, account or billing investigation
is reopened by this plan.

## Offline product construction - 059-19

The synthetic config/conversion journey through a genuine first-party worker
and consent-governed loopback receiver is implemented under
[059-19](slice-19-offline-conversion-prototype.md). It reuses the existing
connector/wrapped host contracts proved by060-13, not another Docker or browser
runner. Controlled label/value/currency/transaction/page relationships reach an
independent receiver; the report explicitly lists missing native behavior.
No default vendor URL, account change or production dispatch is part of this work.

Run `node rig/google-ads-conversion-prototype.mjs`; see
[prototype usage](../../../connectors/google-ads/CONVERSION-PROTOTYPE.md).
Actual local outcomes are2 distinct conversions and0 config/pending/denied/
grant-replay arrivals, with closed owned worker/receiver/sockets. The value-free
shape report covers12 historical rows and62 names: only5 of39 primary field
names are locally constructed,34 remain missing, and native value/endpoint/
complete-chain equality is unavailable. This is not a qualified conversion.

059-01's full native, response/branch, browser, performance and live-readiness
requirements are unchanged; this prototype cannot qualify them.

## Actual local-control checkpoint - 2026-10-26

Desktop became available; the single approved no-work control was attempted
once and is consumed/failed, not still unspent. External exit2/0.75 seconds
followed four normally closed clients through CREATE and created-state INSPECT.
Our strict environment-array ordering check rejected identical unique keys/
values in a different order. No START/Node/guest clock or vendor action ran.
The allocated container was observed not running and was initially cleanup-pending.
The owner later approved cleanup only: exact stopped-case verification,
one nonforced DELETE204 and exact GET404 now confirm that allocation removed.
The original failed result and consumed reservation remain unchanged.
Do not retry/reset the control, infer qualification or expand the harness.
See [the actual record](slice-18-additional-meta-authority.md#actual-single-local-control---2026-10-26-failed-before-start).

## Local-control owner decision - 2026-10-26

At this earlier checkpoint, the owner approved one reviewed no-work Node container control, not a Google
case:45 seconds/.25CPU/64MiB/16processes, no network/mount/build/pull/browser/
vendor/settings changes or automatic retry. Permission is received; current
preparation instead found the exact previously verified Docker endpoint absent,
before any backend request or allocation. The control remains unissued/unspent;
fixed operator implementation and operation-specific safety reviews are still
required after the endpoint becomes available. No general runner expansion
or new tag implementation was substituted for that blocker.
Conditional production reference capture is now permitted, but the operator
selects zero forwarded measurement submissions. It does not replace the owned
case contract, establish delivered responses/attribution or reopen billing work.

## First-journey readiness checkpoint - 2026-10-16

**Status: first slice READY_FOR_REVIEW (authoring) / not implementation-ready.**
The actual blocked-draft frame pass is recorded; it is not boundary-fit or live
authority approval. Source and executable local
baseline discovery are complete for the first journey. They establish a
reusable worker/boot substrate, not direct-conversion compatibility. Actual
native responses, transport/cookie behavior and calibrated C3 limits remain
required before implementation. Autopilot continuation does not silently
grant live advertising traffic, approve a Servo component or waive the DoR.

The integrated source base is `44fd386`; `READY-HERMETIC-1` is 155 passing
tests across the frozen contracts and existing Google/Meta seams.
`READY-WORKER-1` is a private, source-hashed build driven through the actual
exported EDS boots and genuine Chromium module workers. Every asset and sink
was fulfilled locally behind process IP/resolver denial; no native vendor SDK
was loaded. Google produced one legacy page-load request and zero requests for
a conversion, with two actual serialized event batches. Meta produced one
legacy PageView request. Both boot paths left their native global facade
absent. These are observed legacy boundaries, not a proposed implementation.
Private artifact handles are supplied explicitly by the coordinator; no path,
owned selector, cookie or raw payload is committed here.
The legacy probe's explicit host grant and headless cohort are not asserted
equivalent to the headed stock profile's native-default consent state. A
native command/consent transcript and host permission are separate inputs;
do not turn an unset native signal into an explicit granted wire value merely
because the operator permits a synthetic test.

| First-path requirement | Current evidence | Disposition |
|---|---|---|
| Site `gtag` entry and queue | `bootGoogleAds` returns the object-push handle at `adapters/eds/index.js:858-932`; the actual boot probe installed no `gtag`. `contracts/push-api.md` requires `{ event, ...params }`, synchronous void, not the native command/arguments queue. | New optional first-party facade is needed; do not change `push()` or send functions through structured clone. Native argument/readiness/callback behavior still needs path evidence. |
| Actual chamber execution | `core/airlock.js:328-379`, `core/google-ads-chamber.worker.js:43-76` and `core/connector-host.js:40-113`; the actual built worker returned the observed legacy output. | Reuse the first-import confinement, init-before-batch sequencing and serialized boundary. Existing FakeWorker tests alone are not this evidence. |
| Labeled direct conversion | `connectors/google-ads/connector.js:54-64,166-173` accepts only `page_view`; `READY-GAP-1` and the genuine worker both returned zero for a conversion. | New conversion/command state and full request sequence are required; the shipped subset is not a seed that already satisfies F05. |
| First/returning identity | `connectors/google-ads/cookies.js:34-106` reads existing identity and never writes it. The retained stock attempt has an `auid`; actual cookie creation/acceptance/lifetime is unproved. | Establish native-compatible client identity and scoped persistence. Never fabricate click IDs or count a preseed control as the first-visit path. |
| Governed request/response path | Wire workers call `host.init({})` (`core/google-ads-chamber.worker.js:57`). `core/airlock.js:432-433` calls `fetchInit(method, body)`, whose entire option shape is in `core/egress.js:52-54`. | Current path does not forward request headers or expose response bodies/redirect/credential policy. Do not pretend a GET-only, fire-and-forget request is the complete conversion. |
| Existing round-trip building block | `contracts/capability.d.ts:185-187,243-260` defines mediated async dispatch with response text; its separate host is `core/wrapped-sdk-host.js:418-450`. Executed `FIRSTPARTY-ROUNDTRIP-1` below demonstrates first-party worker response chaining with that unchanged host. The current EDS implementation returns only Content-Type at `adapters/eds/index.js:1606-1615`. | Reuse is feasible for the demonstrated text-response path, not yet a Google/Meta integration. Full headers, opaque/script/image behavior, cookie semantics and native consent remain unqualified; do not load the official SDK into production or promote this building block to complete compatibility. |
| Independent candidate comparison | `rig/native-tag-comparison.mjs:403-554,690-692` validates both inputs against the supported producer schemas. Existing passes are exact native copies/local controls. | [059-16](slice-16-chamber-capture.md) owns the independent real-worker/native-absence local capture prerequisite. Native/chamber consumption and complete replacement remain open. Never manufacture a native producer report for a chamber or normalize away missing SDK/configuration behavior. |
| Performance/readiness | C3 below and `docs/product-vision.md` require measured controls, not placement-only claims. The local worker probe was instrumented and is not a CWV baseline. | Measurement protocol is defined below; numeric overhead limits stay unpinned until baseline/calibration evidence exists. |

### Candidate boundary, not an approved API

#### Executed first-party round-trip grounding

`FIRSTPARTY-ROUNDTRIP-1` is a private SDK-absent, loopback-confined browser
probe of the existing `createWrappedSdkHost`, not a new production adapter.
Three independently observed real module workers exercised allowed,
denied-consent and undeclared-path cases. The allowed worker received an
actual server-generated response body/header, parsed the body off-thread
and used its returned token in a second mediated request; the independent
receiver observed exactly two requests. The matched denied and undeclared
cases each produced zero driver dispatches/receiver arrivals and their
corresponding host-seal counters. An ambient worker fetch attempt remained
withheld by the existing first-import confinement. Actual CLI completion was
exit 0, with owned contexts/browser/server/sockets closed and source pins
unchanged.

This grounds a useful **existing** text-response building block without
changing the frozen core. It does not wire the Google/Meta adopter boots,
qualify a native transport/cookie path, establish C2/C3 or replace a native
reference. Its instrumented synthetic fixture is not a performance baseline
or a strict native/chamber qualification report. The coordinator retains
the private helper, original report and command-completion observation;
no owned identifiers or raw local payloads belong in Git.

Source inspection and a separate executed pure-function check also confirm
that `reconcileForBrokerJar` removes `Domain`, `Secure` and `SameSite`
before the existing wrapped-host cookie sink
(`core/wrapped-sdk-host.js:635`, `reconcileForBrokerJar`). That is documented test-origin
reconciliation, **not** production cookie-attribute preservation. Do not
route full replacement identity through it unchanged. The host-internal
cookie sink is experimental under `contracts/capability.d.ts:112-128`;
native evidence must determine the required origin/purpose/name/attribute
policy before choosing its first-party wiring. No frozen-contract
contradiction, cookie permission or production fix is inferred here.

Prefer an opt-in per-vendor facade/boot and first-party chamber over changing
the shipped subset in place. Keep native command interpretation, mapping and
response interpretation off-thread; keep capture/serialization, browser-owned
transport/cookies and application callbacks narrowly mediated on the host.
The event-payload and standalone boot/config carve-outs in ADR-0017 are useful
investigation seams, not blanket authority to widen a frozen type or grant.

No stable-core contradiction has been proved. The existing async dispatch
surface is a candidate, but actual native transport/response data must decide
whether it suffices. In particular, a native measurement Script must not become
ambient main-thread vendor-code execution, and an Image's opaque observation
must not be reported as fabricated HTTP 200. Any necessary frozen-contract
change gets its own specific owner decision and superseding record.

### Proposed native capture envelope - approval required

**Owner approval received 2026-10-19 for this exact conditional envelope.**
The prior approval-required proposal below is preserved as the scope contract.
All four cases were unreserved/unspent at that checkpoint. On 2026-10-21,
the separately approved original Meta stock case ran once and is now
**spent/inconclusive**; its dependent chamber is blocked and the other three
slots remain unused. Approval does not qualify the browser
guard, establish fresh owned-account settings or promote a product slice.
[059-14](slice-14-browser-admission.md) now connects admission to actual
browser/original-byte receiving-sink controls before any native event admission.
Its headless local matrix and intended failure controls pass; it is not a
native/live path policy or headed SDK qualification.
The earlier control20 completed successfully and its stop handoff released
the hold: site disabled, Target saved, bounded schedule retained rather than
original-schedule-restored. A separately proposed next active window was
cancelled before admission and explicitly released. No coordination hold or
shared-source push is currently planned; this grants no Google/Meta activity.
Coordinate and bind a fresh source/measurement window before spending a case.
The later 18:07 Adobe run was interrupted without a qualified result. Its
separate verified stop-only handoff at 23:08:53Z restored that plan's saved-before
schedule, read Target saved and served config disabled, and matched the clean
remote source; its failure-owned lock and canonical state were retained.
That release is not renewed Google/Meta authority or a current setup lease.

059-15's opaque guard is now concretely blocked by browser-internal retries
below logical interception. The owner approved a separate **local-only**
inspected-network experiment, whose H1/H2 receiving controls hold the physical
limit at eight while matched bypasses expose nine. Original application bytes,
browser bodies/cookies and actual upstream certificate-error controls are
preserved. A later explicit owner decision now conditionally permits that
inspected cohort for the original Meta stock slot through
[ADR-0034](../../decisions/adr-0034-inspected-meta-stock-reference.md).
It does not admit immediate traffic or establish default-browser TLS parity;
the native executor remains disabled until the full guard/review/setup/source/
window gates pass. Those gates subsequently cleared for the single spent
Meta case, not a retry or a complete native reference. See the
[current scope and evidence](slice-15-native-stock-capture.md#owner-approved-local-inspection-experiment-2026-10-20).

Subsequent source preparation uses a separately approved authenticated Meta
cohort, not silent replacement of historical pins. One network-denied SDK
initialization produced no PageView command and identified the exact
configuration source, which was fetched once with authenticated HTTPS.
The pre-admission closed-pair source snapshot passed 99 controller and 319 regression tests,
with one older browser opt-in not run; all fourteen SDK-absent controller cases
and eleven relay cohorts passed current-source original/witness verification.
Those controls are not an executed live stock or chamber reference. Their
source bindings are historical after the offline metadata-policy correction.
The actual stock outcome and remaining authority boundary are recorded below.

This is a request for **two bounded paired journeys: four live cases maximum**,
not permission already granted or an executable live plan before its guard
reviews/controls pass. Each vendor has one stock case followed by one
conditional SDK-absent chamber case. The chamber slot cannot be used until its
reference, C2/C3, boundary, implementation and independent-evaluation gates
actually pass. An unused conditional slot is not another stock retry.

| Boundary | Proposed limit / required condition |
|---|---|
| Resources | Only the privately supplied owned Google Secondary Purchase action and owned Meta test Pixel; fresh isolated profiles, synthetic document/input, no Intuit/customer traffic or authenticated personal profile. Fresh read-only setup confirmation must establish the Google action is still Secondary and the owned selectors/settings are unchanged. |
| Execution | Stock uses pinned retained official bytes and generated owned-origin fixture provenance, no silent CDN/download fallback, browser spoofing or filter disabling. Candidate uses first-party code with the official SDK absent. One bounded no-send preflight precedes each live case. |
| Google commands | One stock initialization/config sequence plus **one** deliberate synthetic USD 1 purchase command; later, at most one equivalent eligible chamber sequence/purchase. **Two purchase commands maximum**, with distinct new transaction IDs and exact per-run input-to-wire checks, never a common redaction/identity token hiding a wrong ID. Include native page/config/remarketing/companion and response-linked requests. One command is not one HTTP request or one accepted backend conversion. No payment or campaign/billing mutation is proposed. |
| Meta commands | One stock initialization plus **one** PageView; later, at most one equivalent eligible chamber initialization/PageView. **Two PageView commands maximum**. No form values, enhanced matching, custom conversions, fabricated ad clicks, campaign, billing or account mutations. |
| Admission caps | At most 20 Google or 8 Meta real vendor HTTPS requests **per case**, including redirect/follow-up hops: 40 Google / 16 Meta maximum across both pairs. At most 64 total observed requests per case. Reserve admission before dispatch. These are stop ceilings, not predicted complete cardinalities. |
| Data / clock | 2 KiB request URLs, 64 KiB request bodies/headers, 2 MiB per response, 8 MiB retained aggregate bytes, and one absolute 60-second case budget through settlement/owned cleanup/output. Exceeding any limit is inconclusive, never a truncated pass. |
| One-shot authority | Reserve each slot before execution; no coordinator retry, repeat conversion, fallback event or automatic scope expansion after a failed/incomplete case. A failed stock case blocks the dependent chamber slot. Preserve actual admission/spend history and cleanup. |
| Coordination | Honor the Adobe coordinator's EDS source-push hold and arrange a nonoverlapping browser/measurement window. No shared-site source push, default-tag change or deployment is proposed. Current source pin must be explicit, not assumed after another session changes it. |
| Guard qualification | Before any live SDK admission, independently review and witness receiving-sink positive/enforced/bypass, redirect and marker-loss controls for the exact allowed surface. Existing loopback/no-send qualification alone is not a live SDK guard. Unsupported targets, transports, missing bodies or unknown destinations stop before further dispatch. |
| Ownership / privacy | Private raw originals, final browser headers/cookie attachment/blocking, response bytes/Set-Cookie/redirect/fanout relationships and completion receipt; only categories/counts in public output. All product/attribution/full-support claims remain separate. |

The Google allowlist must be case/method/transport/selector scoped to the
observed owned conversion paths, viewthrough/remarketing paths and owned
`ccm/collect` requests. **`ad.doubleclick.net/ccm/s/collect` needs explicit
case-scoped companion authority:** run-local AUID correlation was previously
accepted only as evidence about an **aborted attempt**, not independent ownership
authentication or permission to send. No broad host wildcard is proposed.
Response-supplied/redirect URLs require an observed parent and exact approved
destination/relationship; losing an ownership marker never grants wider scope.

A case passes only if all required native branches and final observations are
complete. A spent but inconclusive case remains inconclusive; this approval
would not waive missing evidence. The owner's historical one-conversion grant,
read-only source-download grant and unpaired receipts do not authorize this run.

Stock reference execution is distinct from the replacement: the isolated
reference may run the pinned official SDK and approved native response Scripts
to observe their behavior. Production chamber code must not gain ambient
main-thread vendor execution by copying that permission. If the proposed live
guard cannot enforce its declared surface, approval does not authorize a
weakened fallback; stop or consume explicitly supplied complete retained
captures instead. Merely supplying URLs/statuses or redacted/body-less HAR
records does not close response/cookie/redirect evidence.

### Evaluation and performance protocol

1. Preserve no-tag, pinned stock, and SDK-absent chamber fixtures with matched
   input, storage/consent, browser/CPU/network/cache, DOM and interaction workload.
   First/returning state must be native-only versus chamber-only, not a hidden
   stock bootstrap seeding the replacement. An instrumented flat synthetic
   fixture is diagnostic only; it cannot establish adopted-page CWV.
2. Capture original sequences, final browser-controlled evidence and host effects;
   compare action/value/currency/transaction and identity relations before
   privacy. Explicitly account for replaced executable acquisition without
   deleting required configuration, matching or response behavior.
   Live Google cases use distinct new transaction IDs to avoid an accidental
   duplicate submission; each must exactly equal its own predeclared input.
   Identical-input replay/negative controls remain offline. Any cross-case
   input-aware qualification needs its own reviewed path rule; the existing
   exact-copy comparator is not permission to normalize protected `oid` values.
3. After a complete stock capture, use byte-pinned, clearly labeled local
   response replay for repeated **offline** calibration where appropriate.
   Replayed bytes/timing are not fresh vendor responses or reporting evidence.
   No-tag/native/chamber samples and observer overhead/noise remain separate.
4. Pin the existing good-band CWV obligation and measured numerical deltas,
   main-thread/clone/startup/queue/callback/navigation/retention limits in a
   private acceptance manifest before implementation. No guessed numeric
   performance limit or synthetic-worker result closes C3.
5. Require actual serialized worker/capture/seal/dispatch and native absence;
   remove the worker, drop/duplicate/change a request, alter identity/consent,
   truncate a response and remove a redirect/fanout edge as witnessed failures.
   A generic existing GA4 oracle or copied-reference pass is not the goal oracle.
6. Only after these prerequisites and slice reviews can a finite implementation
   mission and goal-specific Servo readiness/suitability proposal be prepared.
   No `.servo` approval is created or approved by this checkpoint.

## Current posture

### Additional case authorized - 2026-10-21

At 18:33:04.581Z the owner explicitly authorized the pending request for one
additional bounded Meta stock case and delegated autonomous handling.
[ADR-0035](../../decisions/adr-0035-additional-one-shot-meta-authority.md)
and [059-18](slice-18-additional-meta-authority.md) add a separate, fixed,
lineage-bound authority; they do not refund or rewrite the original spent
case. The case still has one init/PageView, eight physical attempts and the
unchanged observation/byte/60-second limits and inspected-network distinction.

The coordinator selects finite timing within that delegation without asking
for each routine step, but must create fresh exact bindings and actual
source/setup/qualification/review/coordination evidence. Operator-selected
timing is not represented as a human-chosen timestamp. Conditional additional
grant and inspection data now exist, but no executable case permission,
slot, live window or SDK execution has been created.
After consumption there is no further retry or budget expansion. Google,
candidate and production authority remain unchanged.

The lineage-bound path and mandatory fixed-child SDK-absent supervision are
implemented. Final-source parent checks passed 781 units (34 explicit opt-in
skips), targeted lint, the new additional-path proof and current shared
fourteen-controller/eleven-relay originals (99 controller/352 regression).
The single actual additional suite passed 250 tests; the parent inspected
10,051 post-exit artifact hashes/identities and 30 source-file locators.
This is a pre-admission code checkpoint, not the bounded operator result.
Historical browser/profile unknowns, actual current resource coordination,
case-bound reviews, dated setup/source evidence and complete native capture
remain separate obligations. The withdrawn 20:30 proposal creates no hold
or timing authority for a later run.

The committed `74fa0cc` tooling checkpoint does not close native resource
readiness. Its durable acquisition/abort supervisor covers SDK-absent local
qualification only; the native path still needs supported interrupted-launch/
Node/browser-group/profile ownership and abort evidence. See the current
059-18 finding. No additional case permission, hold, window or slot follows.

### Original Meta stock case spent; offline correction only

The owner approved the exact 16:15–16:16Z (09:15 PDT) case and original-slot
binding on 2026-10-21. The fixed native API ran once after active-window
preparation and actual case-bound reviews. Canonical reservation spent the
original stock slot. Actual exit 2 after 5,325.795 ms preserved an incomplete
reference and zero forwarded public upstream HTTP. Both official source
resources were fulfilled and execution resumed; full SDK completion and
native processing remain unknown. All sixteen cleanup flags and external
receipt hashes were verified; the actual 16:17:13.239Z handoff released the
finite Adobe hold. Its resumed worker is not freshly quiescent.

Offline diagnosis found two missing metadata query fields in the authenticated
cohort's closed policy. The cohort-only correction validates the paired
version/closed canonical-base64 shape, rejects duplicate JSON member names
and preserves the original URL, selectors and byte/count caps. The unchanged
actual request now passes pure eligibility only. This does not repair the
historical capture, prove complete native behavior or grant dispatch.
Fresh source-bound local qualification passed 99 controller and 351 regression
tests, with all fourteen SDK-absent controller cases and eleven loopback relay
cohorts verified; one older browser opt-in was skipped. Compliance, craft and
architecture reviews passed for the policy delta, not native-reference acceptance.
That policy correction did not authorize a new SDK init, source download,
event, namespace, retry or chamber-slot substitution. The later, separate
ADR-0035 authorization above supplies exactly one additional case; it cannot
renew the consumed original through another timing approval.

### Independent offline path

[059-17](slice-17-attempt-chamber-comparison.md) is DONE for the attempt-layer
consumer step. Its offline reader/CLI validates existing qualified
native-attempt inputs and genuine SDK-absent chamber evidence, preserves their
distinct schemas and completion proof, and emits an honest diagnostic.
Actual retained-input runs found Meta one native versus one chamber request
with three difference categories, and Google ten versus one with fourteen
differences including nine missing requests. Both actual CLI exits were 1,
not parity passes. Missing/failed outer completion and the actual spent
stock reference reject with exit 2 and no completion. Originals and the
canonical spent slot remain unchanged.

Local endpoint overrides, legacy
semantics, differing cohorts/consent and unavailable native responses cannot
be normalized into a qualified replacement. This work needs no new SDK,
event slot or live permission; the complete whole-wire consumer remains open.

[059-16](slice-16-chamber-capture.md) owns the already-required real-worker/
native-absence capture prerequisite. Its fixed synthetic local path is
independent of live Meta setup confirmation and the four event slots:
actual built EDS boots and module workers, original local receiver evidence
and a distinct qualified capture source. It does not implement a full tag or
make the existing native comparator accept legacy output as native parity.

### Offline implementation continuation

[059-14](slice-14-browser-admission.md) is DONE and implements the
[fixed local browser qualifier](../../../rig/first-journey-browser.md):
24 positive/enforced/bypass legs across eight fixed paths and 18 fixed negative
controls, exercised through actual child CLI exits. The final combined run is
378 passing tests: 24 browser entry/real-control tests, 150 admission tests and
204 comparison tests. Eight retained parent-witnessed command outcomes bind
actual exit, source digests and cleanup independently of producer snapshots.
This does **not** supply a complete native reference, a candidate producer,
headed/native-default equivalence or full live guard qualification.
The synthetic local-network permission override and unreadable nonempty
redirect body are explicit, as are the post-dispatch final-header limit check
and requirement for an independently observed command exit.
No shared-source, SDK, account, consent or Servo state is changed by this work.
Next: bind and qualify the exact owned native live request/response policy,
obtain fresh owned-account settings and coordinate a measurement window.
The local qualifier has no live switch and cannot spend a case by changing a
flag. A native case must still stop on unknown scope or missing originals.

[059-15](slice-15-native-stock-capture.md) owns that end-to-end native policy,
opaque TLS broker and one-shot stock receipt. A first-party loopback probe
already preserved actual HTTP/2 Image responses through authenticated CONNECT
with 1/0/1 receiving-sink positive/enforced/bypass outcomes. This establishes
feasibility only: no native SDK, public collector or live slot was used.
That initial opaque-broker hypothesis kept browser certificate verification
unchanged but subsequently failed the physical-retry controls. The separately
approved inspected Meta cohort and implemented conditional controller are
described above; neither the old probe nor the current local controls admit
a real case by themselves. The later actual spent case is recorded above.
The owner's 2026-10-19 setup confirmations are historical owner evidence,
not independent API readback or a permanent lease. On 2026-10-21 at
14:52:24.566Z the owner explicitly reconfirmed the same Meta test Pixel is
still theirs and its agreed settings are unchanged. This is fresh owner
evidence, not independent API readback, an evergreen lease or live-run
approval. Newer source bytes and autonomous continuation did not establish
that fact. Original-location/exact-run approval, case-bound reviews,
receipts and a coordinated finite window preceded the spent Meta admission.
They do not authorize another attempt. No further campaign/
billing/account mutation or source push is requested.

[059-13](slice-13-validation-admission.md) is DONE: the
[network-agnostic admission component](../../../rig/first-journey-admission.md)
has 150 local tests, real receiver/bypass controls and actual independent
frame/compliance/craft/reconciliation passes. The initial durability finding is
preserved, not erased. This is one-shot exact request admission, not full
SDK/browser guard qualification. No native SDK execution, vendor traffic or
first-journey implementation readiness was claimed. Complete native wire,
C2/C3, full guard and fresh explicit live authority remain required.

Adobe's 2026-10-16 cleanup handoff released its EDS source-push hold after
verified site/Target/schedule cleanup. It reported a clean config-only forward
revision; that report is not an independent live-head readback here.
Coordination is still required before any future source change or measurement
window. No source push or vendor measurement is queued by this checkpoint.

This is an **authoring packet**, not implementation approval.
ADR-0033 is Accepted for the owner's target; 058 has implemented local controls
and selected Meta/new Google attempted references, with broader
native/comparison/readiness gates open. 059-01 is READY_FOR_REVIEW; the other
eleven slices remain DRAFT.
The parent owns formal frame/architecture/compliance/craft/reconciliation review,
authority/index integration, shared 058, code discovery and trunk collision checks.
No native event, account mutation, shared-site deployment or runtime code work
is authorized by this packet.

### Original authoring grant (historical)

The original preparation ceiling was approximately 25,000 AI credits **total across parent
and both vendor sessions**, not per child, plus four active hours. Phase start
is 2026-10-15T23:34:47Z; conservative wall stop is 2026-10-16T03:34:47Z.
Finish sooner when coherent. No hard automatic credit meter is exposed to this
session; do not claim the written ceiling is mechanically enforced. Report
actual local visibility and use parent checkpoints instead of inventing usage.
That grant cannot fund a full implementation/live-event loop by implication.
The later autopilot objective authorizes continued ordinary repository work
toward the first journeys where their DoR permits it; it is not a new numeric
credit allocation, finite live-send grant or self-approved Servo loop.

## Ordered readiness and implementation plan

1. ADR-0033's frame review and acceptance are recorded; the live vision now
   separates general identity services from required vendor-cookie continuity.
   This does not satisfy implementation/evidence gates. Do not edit Accepted
   histories or reuse Adobe reporting exceptions.
2. Qualify 058-01 local receiving sink, guard, marker-loss branches, bounded
   capture drain and unreadable-body/error outcomes. Consume shared 058-02
   containment and Google-specific 058-04 for the exact native
   runtime/configuration/browser/scenario, then 058-03 value-preserving
   sequence/negative controls. Complete response/dispatch evidence remains a
   separate gate; consume each named layer.
3. Parent freezes C2 browser/cohort/critical interaction coverage and C3 numeric
   performance/host-latency/retention limits from evidence before 059-01 can
   become implementable. Reference and comparator may not generate each other's
   expected values from the replacement.
4. Parent investigates actual current code through the authorized semantic index
   and targeted citations. For 059-01, prove a bounded transport/response design
   fits ADR-0017 or obtain the requisite case-specific decision before code.
   No unverified current connector capability is a design dependency.
5. With new finite implementation authority, deliver 059-01's owned conversion
   from adopter entry through real isolated worker and governed complete response
   branches, diagnostics and independent evidence. No native fallback or mapper-
   only proxy for execution. Further owned dispatch needs its own finite grant.
6. Deliver command routing/callbacks (02), consent (03), then identity/linking
   (04). These establish the input/state/navigation contract consumed by audience
   and rich-order paths. Full basic **and** advanced behavior is already required.
7. Deliver audiences/dynamic verticals (05) and rich purchases/count/custom/
   acquisition (06) using the common state contract. Deliver manual enhanced
   matching (07), then selector/automatic/lead collection (08). Call forwarding
   (09) consumes scoped identity, consent, callback and response behavior.
8. Deliver remote automatic collection and browser/lifecycle qualification (10)
   with branch-complete references. Then deliver mixed native GA4/GTM adoption
   and explicit rollback (11), and the portfolio-level adoption decision (12).
   Numeric performance qualification is continuous, not postponed to 12.

## Dependency rationale

| Slice | Lifecycle dependencies | Reason |
|---|---|---|
| 059-01 | adr-0017, adr-0033, 058-01/02/03/04 | Stable-core authority, accepted target and exact local/native/comparison evidence before the first conversion path; attempted reference is not full response closure. |
| 059-02 | 059-01 | Extend a working end-to-end owned route to complete queue/routing/callback semantics, not a parser-only milestone. |
| 059-03 | 059-02 | Consent commands/updates need the verified queue/callback and dispatch contract. |
| 059-04 | 059-03 | Identity/linker operations depend on precise consent capture/use/revocation boundaries. |
| 059-05 | 059-04 | Audience journeys require persistent/cross-page identity and consent behavior. |
| 059-06 | 059-04 | Repeated/rich purchases require value, order, callback and returning identity correctness; no dependency on dynamic-ad serving. |
| 059-07 | 059-06 | Enhanced purchase data must join the correct complete order/counting path. |
| 059-08 | 059-07 | Automatic/selector/lead acquisition consumes the verified normalization/privacy/manual precedence contract. |
| 059-09 | 059-04 | Call lookup/cache/rendering depends on consent, callback and scoped state; no artificial dependency on commerce feeds. |
| 059-10 | 059-04 | Remote automatic events and browser/lifecycle variants depend on the common command/consent/identity path. |
| 059-11 | 059-02, 059-03, 059-04, 059-10 | Migration must preserve shared commands/consent/linker ownership and pinned remote behavior. |
| 059-12 | 059-05/06/07/08/09/10/11 | Full adoption claim consumes every complete customer path, not only the latest green subset. |

Named dependencies do not replace per-slice DoR account, evidence, performance,
architecture and authorization checks. Experimental API work remains unchosen
until inspected and reviewed. An authority conflict blocks its dependent path;
it is not a reason to silently exclude the feature.

## Reference and measurement procedure

For each owning slice, maintain a private scenario manifest with family/case ID,
positive native pin, account/terms/feed prerequisites, inputs and effective state,
actual/native-absent chamber execution provenance, expected observation surface,
finite window, path-specific nondeterminism rules, necessary product outcomes,
negative mutations and evidence retention. Commit only sanitized case IDs,
results and scope metadata.

The existing smoke is one partial positive, not a full 058 reference. Recover
missing historical outcomes only from authorized retained data. Parent local
qualification must distinguish our allowlist denial from native outcomes and
unavailable bodies from empty ones; it may not authorize a whole host after a
marker disappears. A response-supplied URL is neither automatic egress authority
nor a proof that its branch completed.

No-serving API test accounts can assist configuration work but cannot prove
collector acceptance, serving conversion metrics, matching or attribution.
Use explicit resource handles, no credential discovery. Do not request repeated
sends, fabricated clicks, periodic exports or a new account merely to make a
draft appear ready. Parent chooses the least-mutating authorized evidence route.

## Candidate mediated design boundaries

These are requirements to evaluate, **not approved APIs**:

- Destination/method/credential/redirect-scoped dispatch with response data,
  finite budgets, audit correlation and consent checks; no ambient worker network.
- Key/origin/domain/path/lifetime/purpose-scoped vendor storage operations;
  no generic identity store or arbitrary cookie jar.
- Narrow fresh linker decoration at navigation/form time, preserving handlers,
  fields and allowed domains without a late worker race or an unrestricted DOM proxy.
- Consent-gated typed extraction and bounded automatic-detection work; no eval,
  arbitrary global-variable traversal, or unbounded main-thread page scan.
- Typed response-derived phone text/tel updates and callback handles; no raw
  script/HTML execution or serialization of arbitrary callback code.

Hashing/mapping stays in the isolated chamber where feasible under the reviewed
contract; host-only browser effects stay minimal. If a concrete case cannot meet
security, CWV or the frozen API, present that one evidenced contradiction to the
owner. Full-versus-subset and basic-versus-advanced support are not open choices.

## Review and validation plan

For this authoring turn, run only read-only `frame-review-needed` to derive
flags, the existing read-only `spec_lint.py` on this folder, and
`git diff --check`; then commit this folder only. No lifecycle transition,
review verdict artifact, status-board regeneration, source test/build, .servo
change or push belongs to this grant.

Before implementation, parent formal review focuses on family/scenario completeness,
the first slice's concrete readiness, vertical independence, frozen-core authority,
non-vacuous references/mutations, browser credential/response fidelity and truthful
outcome/performance boundaries. During later implementation, each slice needs
witnessed red-to-green controls, targeted existing tests, applicable lint and
independent required reviews. Never mark those future tasks complete now.
