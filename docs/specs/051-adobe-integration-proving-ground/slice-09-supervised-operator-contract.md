# 051-09 supervised operator contract

**Source implementation contract — scoped frame confirmed (2026-10-26).**
This subordinate contract belongs to existing051-09, not another slice or lifecycle transition. Its requirements are normative for implementation, not run approval.
The original detailed private draft is informative only and does not add or override requirements here.

## 1. Boundary and deliverables

Implement one foreground Node operator (inspect/run/stop), one served inactive page adapter, focused controlled tests and one additive fixed browser-gate export. No general client, runner, ledger service, planner or process broker.
Only product051-09 is active: one stock positive journey, then one chamber positive journey, each in a fresh context. No automatic retry, replay, refresh, rearm or replacement context.
AcceptedADR0041 selects owner supervision outside the coding session, not unattended custody, fresh presence/setup, execution authority or verified descendant closure.
Routing's16 fixed Edge paths and three source reviews are complete; do not redesign routing, the AcceptedADR, frozen core or default connector/boot behavior.
Keep original cases/full baseline, five performance pairs, remaining stock work, old UNKNOWNs, Bug002/Bug003 and wider release gates unchanged.
Never write/reset/unlock/replace original state95ac, owner lock, marker, active plan or history; never disguise either new arm as an original baseline case.
No Docker, launchd, native-owner framework, normal-host control, new sandbox, SDK fork, arbitrary SDK/function broker or main-thread SDK fallback for chamber.
Stock intentionally uses its normal main-thread SDK. Both arms use original Alloy2.31.1 bytes:152336, SHA256 `7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8`.
No provisioning, offer edit, deletion, production publication, deployment client or configuration-API diagnosis belongs to this operator.

## 2. Source/API anchors; appendix is not normative

`stock-site.mjs:45-94,242-282,325-460` supplies isOptIn/validateConfig/createStockEntry, original eager/lazy/delayed actions, runnerConsent and observations.
`chamber-journey-host.mjs:20-36,118-156,162-228` supplies createChamberJourney, governed round trip, reservation/render/trusted-click checks and dispose; caller retains Worker custody.
`chamber-journey-contract.mjs:1-27,31-114` supplies fixed profile/endpoints, boundedData/exactFields/journeyConfig/qualifiedOffer; `connectors/alloy/alloy-chamber.worker.js:316-338,426-455,685-720` supplies existing confined classic-worker selection.
`stock-baseline-browser.mjs:357-440,475-495,547-674` supplies stockAdobeUrl/bounded/attachStockDispatchGate, original-body witnesses, before-continue reservation and old unconditional worker refusal.
`stock-wire-recorder.mjs:118-196` supplies startStockWireRecorder and native-body corroboration; `stock-wire-check.mjs:106-133,235-292` supplies exact recorded-capture schema and checkStockWire predicates, NOT independent provenance.
`contract.mjs:28-112,207-337` exports protected parsing/readJson, credential/input/routing/workspace validators and evaluateScope/evaluateWorkspace/evaluateRouting; `responses.mjs:18-177` exports checkResponseError/validateResponse.
`preflight.mjs:14-65,71-128,225 onward` exports runCli and assertRequest for its fixed READ inventory. assertRequest is neither an HTTP client nor permission for Target PUT.
`stock-baseline.mjs:68-84,1987-2034,2701-2705,2991-3065,3504-3529,6566-6722,6984-7048,7285-7325` is private implementation prior art, not importable management/restore API.
`adapters/eds/dom.js:33-34,152-263` exports createDomCapability/reserveSpace; `core/wrapped-sdk-host.js:430-447,516-524` retains original HTTP responses and validates cookie reconciliation.
Installed Playwright1.62.1 public `types/types.d.ts:16917-16926,17546-17695,20056-20078` support chromium.launchServer/connect and BrowserServer.close/kill/process/wsEndpoint; Browser has NO process API.
Those types`:10948-11000` distinguish connected Browser.close(disconnect) from server termination and expose newBrowserCDPSession; `:9267,9295,10166,22168` expose native context request/response, page CDP and Response.body.
Public `protocol.d.ts:23552` supplies Browser.close; installed implementation `coreBundle.js:56860-56874` corroborates server custody but MUST NOT be imported as a private API.
ADR0045:89-214 and slice09:85-144 control scope/cost/UNKNOWNs; `docs/workflow.md:30-94` controls Jig implementation and independent compliance/craft/architecture. Earlier source tests are not live proof.
Unqualified probe filenames above are under `probes/adobe-compatibility/`; Playwright API citations are under `node_modules/playwright-core/`, not additional private imports.

## 3. Fixed CLI and private input custody

Source entry: `probes/adobe-compatibility/supervised-journey-operator.mjs`; page source: `supervised-journey-page.mjs` in that directory.
CLI grammar is exactly: `inspect --job PATH --sha256 HASH`; `run --job PATH --sha256 HASH --approval PATH`; `stop --job PATH --sha256 HASH`. Prefix each with node and the fixed operator source path.
No other mode, arm selector, executable/module/endpoint/output override, force/resume/retry/unlock flag or user callback. Derive fixed output names from the one private pair directory.
EvidenceRef is exactly `{path,sha256}`: canonical absolute private regular-file path and lowercase64hex hash of ORIGINAL bytes. Avoid redundant ref-plus-hash wrappers.
SourcePin is separately `{path,sha256}`: canonical actual repository regular-file path, owned by the operator uid, no symlink/path escape, and neither file nor path components group/other writable; ordinary0644 files/0755 executables/directories are permitted, not chmodded.
Verify SourcePins against the ACTUAL executing operator entry/import paths, actual resolved fixed helper imports, actual local page/worker bundles and package-lock before effects; private snapshots cannot substitute for executing source. No source-copying framework or arbitrary import is allowed.
Artifact is exactly `{ref,bytes,media_type}`; ref is an EvidenceRef. No private payload, selector, credential or bearer endpoint may enter public output.
For PRIVATE EvidenceRefs/artifacts/output custody, protect directories0700/files0600 (immutable input0400 permitted), correct uid, single-link regular files; reject symlink components, path escape, inode/device replacement and oversized/deep/duplicate/prototype JSON. These private modes do not apply to SourcePins.
Use original-byte hash verification before parsing; descriptor-safe programmatic inputs; reject accessors/proxies/functions/sparse arrays. readJson alone does not establish parent-path custody.
All browser scratch/evidence stays under the project-private pair directory, never system temporary directories or the owner's login profile.
All shapes below are closed and version1: every named field required, unknown keys rejected; enums/maps are literal implementation sets, not extension points.

## 4. Closed prepared job and approval

Job=`{kind:"airlock.05109.supervised-job",schema_version:1,pair_id,binding_sha256,retained,authority,prepared,source_reviews,source_pins,sdk,window,arms,budget,created_at,expires_at}`.
pair_id is fresh airlock05109-32hex; retained=`{owner_nonce,state,active_plan,lock,marker}`, with exact original owner and four immutable EvidenceRefs, never merely a95ac prefix.
authority/prepared are EvidenceRefs. source_reviews=`{compliance,craft,architecture}` refs bind this operator/page/helper implementation, not just completed routing reviews.
source_pins has fixed SourcePin keys: operator,page_source,page_bundle,browser_helper,wire_recorder,wire_checker,contract,responses,preflight,chamber_worker_source,chamber_worker_bundle,journey_host,journey_worker,journey_contract,package_lock.
sdk=`{version:"2.31.1",bytes:152336,sha256:<fixed above>,stock_path,chamber_path}`; stock_path/chamber_path are actual fixed LOCAL repository SDK paths, checked with SourcePin custody and the fixed SDK byte count/hash, never arbitrary imports. Their fixed served-path mapping and original-byte proof are separately bound by Served; original aem-martech/index/ACDL pins remain unchanged.
window=`{start,end,activation_deadline,stop_deadline}`; immutable canonical UTC within current authority/setup/source limits. No cancelled clock/source epoch or fresh eight-hour allowance.
arms is exactly `[{arm:"stock",run_id},{arm:"chamber",run_id}]` in that order; distinct new synthetic run ids satisfy existing stock-query grammar but confer no original-case identity.
Navigation uses only the approved root positive query, consent=decline, google-ads=off/meta-pixel=off; actual synthetic grant comes through runnerConsent, not that query's wording.
Prepared=`{kind:"airlock.05109.prepared",schema_version:1,binding_sha256,observed_at,expires_at,preflight_input,preflight_report,routing,workspace,setup,resources,disabled_config,served,spending,remaining,coordination,original_schedule}`.
All prepared content fields from preflight_input through original_schedule are EvidenceRefs. resources binds original environment/property/activity/two-offer response artifacts and current SAVED/future schedule.
original_schedule binds the exact authorized preparation predecessor/inverse dates and settled preparation effects; spending already includes preparation's schedule compare/write/read costs and failures.
binding_sha256 covers fixed-order retained refs/owner, scoped selectors, exact window/schedule, SDK, ordered run ids, disabled config and served manifest. Prepared never hashes Job; no reference cycle.
Approval=`{kind:"airlock.05109.exact-job-approval",schema_version:1,job,approved_at,expires_at,authority,operator_procedure_sha256,stop_procedure_sha256}`; separate sidecar binds the exact Job EvidenceRef.
Source approval is not exact-run approval. Preparation authority/facts are not current operator presence. Stop needs no new activation approval and cannot activate.
Served=`{kind:"airlock.05109.served",schema_version:1,observed_at,expires_at,reference_head,origin,root,config,entries}`.
root=`{body,csp,normalized_root_sha256,normalized_csp_sha256}`; body/csp are Artifacts. Reuse unchanged normalizeStockRoot/profile, not additional inline/script/CSP allowances.
config is the Artifact of exact disabled runtime-config bytes; entries contain exactly `{path,body,max_reads,required_arm}`, body=Artifact, required_arm=both|stock|chamber|optional.
entries is a finite pinned dependency closure, including inert adapter/worker/vendor assets; canonical same-origin pathname+search targets, fixed media/count/size bounds, no redirect/wildcard/discovery retry. The owner-approved2026-10-27T23:20:58.690Z real-site amendment preserves exact existing query strings, not arbitrary queries or query stripping. optional admits pinned conditional alternatives without making all alternatives required; required current-arm assets remain mandatory, opposite-arm-only files are not current-arm obligations. Do not rewrite the original baseline inventory.

## 5. Inspect, readiness and consumption order

inspect is local/read-only: no directory/lock/claim creation, writes, credentials/environment selectors, HTTP/Git, Playwright import, process probe or signals. It cannot certify live readiness.
run first performs local structural/pin/approval/ref/freshness/budget checks WITHOUT permanent context/SDK consumption or external effects.
Require native foreground stdin/stdout/stderr.isTTY; no coding-session run, redirected input, CI or file boolean. Owner opens a second native Terminal with exact reviewed stop command/job/source available.
Generate an in-memory random60s challenge; require typed `READY <job-digest> <challenge>`. No argv/env/file answer, replay or default proceed; record TTY/uid/time/job provenance later.
AFTER fresh READY, revalidate all local refs, clocks, approval, prepared evidence and full affordability; THEN durably consume the one-use claim and full reservations BEFORE first HTTP/resource/browser effect.
Never burn contexts/SDK slots while waiting for READY or on already-stale local input. Once consumed, all reservations stay spent even if authentication/launch/first arm subsequently fails.
Use exclusive permanent consumed.json/run.lock, independent stop.lock, durable stop-request.json tombstone, single-writer run.jsonl and stop.jsonl, write-once browser.json and immutable terminal.json.
Use public fs exclusive/no-follow opens, identity/mode checks, file sync and directory sync. No truncate/repair of torn prefixes, lock deletion, takeover or original-state writes.
Claim binds exact Job/retained owner and FULL two-context/10-SDK/normal/cleanup/page/evidence maxima. Journal/fsync every external effect's exact intent and reservation before dispatch.
Any torn write, failed sync, drift or loss inhibits activation/next arm. A pre-effect write failure is not a successful claim/effect; ambiguous intent remains UNKNOWN, never refundable.
Before chamber require a fresh NEXT challenge; stock must already be observed closed. EOF/stop/INT/TERM/HUP, lost supervision or expiry is terminal, not a pause/resume opportunity.

## 6. Genuine live facts and NO RUN RESCHEDULING

Load credentials only after durable reservation via existing ADOBE_CREDENTIAL_FILE/readJson(path,true)/validateCredentials; never accept credential contents or destinations on CLI.
Validate genuine scope/workspace/routing/setup provenance and credential identity using exported validators/evaluators; exact selected org/tenant/property/workspace/environment/datastream/fixtures remain fixed.
Require genuine preflight schema2 overall ready, all12 required ready, generated_at<=now and age<=1h before activation and each arm. Do not project approved/ended into SAVED/future readiness.
Local admission must apply the same scope deadline as management authentication: the complete cleanup stop deadline, before READY or permanent consumption. Approval/scope expiry must be strictly later than that deadline. Future producers must choose cleanup stop strictly before their real evidence expiry; never relabel a confirmation as newly observed or silently extend owner authority. Equality is not current readiness.
Require actual prepared served proof<=5min old at initial admission, unexpired for each arm, plus native in-context original-byte corroboration before SDK dispatch.
Initial real resource reads validate exact environment/property/activity/two offers with validateResponse and approved offer hashes; require prepared SAVED/future activity and exact disabled config.
Consume the PREPARED EXACT schedule/window that the fresh preflight binds. run MUST NOT issue a schedule PUT, choose dates, shift the window or renew preflight by projecting a new schedule.
run performs only fresh activity compare -> durable APPROVE intent -> fixed approval PUT -> complete response -> activity GET -> exact approved/readback comparison, then fixed propagation wait if prepared.
No15min inherited sleep, traffic polling or window extension. Prepared timing must explicitly cover required propagation, both arms, NEXT and cleanup; missing facts block before browser.
External selected-resource ownership must be exclusive and no relevant mutation unsettled; compare/read/write is not server-atomic CAS. Old unrelated UNKNOWNs remain unresolved, not implicitly cleared.
No prepared schedule/authority/freshness/budget fit means BLOCKED; do not build a preparation/deployment platform or repair live resources inside run.

## 7. Cumulative cost/evidence record

CostPlan=`{kind:"airlock.05109.cost-plan",schema_version:1,checkpoint,external_abort,original_remaining,preparation,normal,cleanup,adobe,contexts,page,evidence}`.
checkpoint/external_abort/original_remaining/preparation are exact immutable evidence bindings, including original response prefixes; missing remaining amounts are NOT zero.
normal/cleanup=`{requests,bytes,operations}`; operations is a fixed ordered operation-ID/max-byte list, never caller-selected endpoint/body descriptors.
adobe=`{requests:10,per_arm:5}`; contexts=`{additional:2,aggregate_ceiling:22}`; page/evidence contain exact per-arm maxima and original remaining reservations.
Before any external effect: six spent+14 original remaining+two pair contexts=22; nine historical+44 original remaining+10 pair Adobe slots=63<=64.
Normal:703+262 original remaining+all unaccounted external/preparation costs+FULL pair normal maximum<=1339 under the owner's replacement-handoff approval observed2026-10-28T01:59:42Z. The normal response-byte cap is40894464 (39MiB). Historical1000/1012/1094/1165/1181/1252 ceilings/reservations remain preserved in their dated records; no invented allowance/refund or original-ledger change. One replacement SAVED-window preparation, full preflight and71-check verification are allowed for the same unconsumed pair after its local cutoff refusal. The new exact digest remains subject to native Terminal READY; no automatic retry loop is granted.
NORMAL PREFIX IS14: token1 +current environment/property/activity/two offers5 +disabled-config1 +approve compare/PUT/readback3 +stock activity/config2 +chamber activity/config2.
Preparation's schedule calls are already spendingRef costs, not repeated in14 or erased. At most21 slots remain arithmetically for unaccounted preparation; this is NOT a finding that it fits.
Cleanup:60 canonical+four external abort+original remaining cleanup+all new cleanup maxima<=86. The owner explicitly approved this cleanup-only80->86 amendment at2026-10-27T15:50:12.978Z, preserving the actual14-call original reservation and new8-call prefix; every other cap stays unchanged. AcceptedADR0041 and the original ledger/limits are not rewritten. External abort3533bytes/four calls stays once-only pending original import, not silently reconciled.
STOP PREFIX max8: token1 +disabled-config GET1 +SAVED compare/PUT/read3 +prepared-original-schedule compare/PUT/read3; pre-reserve full8 alongside original remaining cleanup.
Normal completion and independent stop share that ONE prefix via stop.lock; no automatic second cleanup attempt or extra token refresh. Unused/no-op reservations are not refunded.
Normal bytes spent+unimported+original remaining maximum+new maxima<=40894464; cleanup analogous including3533<=8388608. Preserve all original remaining page/native/trace byte/event headroom or FAIL BEFORE browser.
Retain original per-response/page bounds: SDK request8192,response16384,combined32768 per arm; page requests96/body1048576/context8388608/aggregate67108864, queue96/concurrency8; no new performance trace allowance.
Reserve management response maxima: token16384, Target/config65536 each. Account complete observed prefixes on errors/oversize; abort, never clip into success/refund. Remote overrun still counts and stops further work.
Token secrets/original token bodies are NEVER persisted; retain only private status/count/time/hash receipts. Other original wire/resource bodies stay private; public output only bounded categories/hashes/counts.
No compensation/relabel/replay/import into original state. Original continuation remains blocked until separately reviewed supplemental spending reconciliation. Original051-03 active-engineering/time allowance still applies.

### One accounted retry — owner approval 2026-10-28

The owner approved one additional supervised stock/chamber pair after the
replacement pair was consumed and failed before browser creation. The failed
pair remains charged in full: two contexts, ten Adobe request slots, fourteen
normal calls, eight cleanup calls and16MiB of page-body allowance. Its Target
cleanup remains UNKNOWN. The new cumulative ceilings are24 contexts,73 Adobe
requests,1440 normal calls,43MiB normal response bytes,94 cleanup calls and
80MiB aggregate page bodies; the existing8MiB cleanup-byte and per-case/trace
limits remain unchanged. No refund, automatic retry or original-ledger change
is authorized.

The retry CostPlan adds `prior_pair` with exact EvidenceRefs for the prior job,
claim, terminal, run journal and stop journal. Admission checks the protected
original bytes and fixed digests, journal chains, retained owner/checkpoint,
full old reservation and terminal disposition. New preparation includes the
old preparation plus the separately approved87-call/3096576-byte bound; the
new pair's full normal, cleanup, context, Adobe and page reservations are
added separately. Missing or substituted evidence fails closed. Historical
single-pair budgets are not silently reinterpreted as retry budgets.

After fresh native READY and a second local admission, a single exclusive,
durable retry claim is created before the new case claim or any external
effect. On the running host, an existing marker blocks another job from using
the allowance, including after a partial write or sync failure. If a write or
sync fails or the host crashes, marker persistence can be UNKNOWN: failed
directory sync cannot prove that the name will survive a crash. No external
effect precedes successful file and directory sync. The native READY prompt
instructs the owner not to restart after any error or interruption even if
the marker is absent; another attempt needs a new owner decision. This is not
an unattended crash-recovery guarantee. The claim is not an original ledger
mutation or evidence of actual execution. After consumption, the
independent stop checks the new case claim and its reserved totals without
re-reading the old pair's journals; loss of those historical journals must
not itself prevent the safety inverse.

Jobs pin the executing operator source, including for stop. A changed operator
cannot stop a job pinned to an earlier source epoch; do not change the operator
while a case depends on that stop path. The earlier failed case has already
used its stop lock and is not reopened. No currently running case was reported
in this session before this source increment; that is not a global closure claim.

Approval of these limits does not establish current setup, operator presence,
independent stop access, a fresh window or exact-run approval. All existing
preflight, peer coordination, source review, scope and cleanup gates remain.

## 8. Small fixed management implementation and inverse

No production exported HTTPS client/whole-fixture inverse exists. Implement a private fixed operation switch with public node:https inside this operator, not AST-copied test-private functions or a general client.
HTTPS certificate verification required; no insecure agent/custom CA/proxy/redirect, arbitrary origin/path/query/port/hash/userinfo, retry or broad endpoint seam. Bound entire request/body<=10s and decoded bytes.
AUTH is fixed POST ims-na1.adobelogin.com/ims/token/v3, original client_credentials form; validate token with existing response validator, keep in memory only, never send credentials/token to site/page/worker.
Target base is exactly `https://mc.adobe.io/<encoded approved tenant>/target`; GET environment/property/activity/two-offer URLs use existing v1/v1/v3/v2 media.
APPROVE/SAVE are only activity/ab/<id>/state PUT with v1 media and exact `{state:"approved"}` or `{state:"saved"}`.
RESTORE_SCHEDULE is only that exact activity/schedule PUT with prepared original startsAt/endsAt; only stop may use it after proven settled approval and verified SAVED.
DISABLED_CONFIG is only credential-free GET approved preview-origin/tools/airlock-stock/runtime-config.json, no query/cache/redirect. No site/config mutation exists.
Exact expected status/media, bounded original response, structured error handling and no incomplete-body success; timeout/abort is UNKNOWN backend disposition, not remote cancellation.
Fixture comparison preserves all activity fields except documented state/startsAt/endsAt/modifiedAt/modifiedByName; state/dates separately equal exact known journal images, using original canonical whole-second UTC equivalence.
Initial real SAVED/future activity validates without projection; approved readbacks compare exact allowed transition from that validated image. No broadening of the original validator/compare exceptions.
For every permitted PUT: fresh GET compare -> durable before/expected-after/inverse intent -> PUT -> complete response -> GET exact readback -> durable settled record. One management operation in flight.
On settled completion/failure, independently verify remote config still exact disabled, revoke page capsules/close owned handles, compare/apply/readback SAVED, THEN restore authorized prepared original schedule while SAVED.
Remote config is NEVER enabled, so site inverse is capsule revocation/Worker/context closure plus disabled-config verification, not an unimplemented old-format Git/deploy restore.
Changed/enabled config or resource drift is CONFLICT; do not force-write it. Site/browser branch failure cannot skip applicable Target safety inverse, or vice versa.
Unsettled/lost approval/write cannot be ordered by a new SAVED readback or local abort. Permanently inhibit arms; one reserved best-effort SAVE may occur only on known-owned current shape, labelled UNKNOWN ordering.
Do NOT restore schedule while approval/preparation schedule work can still settle; retain bounded prepared schedule where known, otherwise backstop UNKNOWN. No fresh SAVED read proves no late live effect.
No overwrite, second SAVE/poll/retry or fabricated cancellation on conflict/loss. Exact settlement/accounting needs separate review; preserve no-new-arms state and escalate to owner.

## 9. Browser custody and independently available stop

Set process-local TMPDIR to the owned project-private scratch directory BEFORE dynamically importing Playwright; constrain artifacts/downloads/traces there too, no system-temp fallback.
Use only pinned `chromium.launchServer({headless:false,chromiumSandbox:true,host:"127.0.0.1",port:0,timeout:10000,...fixed private paths})`; no --no-sandbox, executable/channel/profile override or fallback.
Retain real BrowserServer and server.process() ChildProcess, attach actual exit/close observations; connect through its private wsEndpoint using chromium.connect. Never browser.process().
Journal launch intent before effect; browser.json binds exact job/nonce/package/source/time/root-handle observation and unguessable loopback endpoint before contexts; never print endpoint. Ambiguous launch means UNKNOWN/no retry.
Create exactly two sequential `browser.newContext({viewport:{width:1365,height:768},deviceScaleFactor:1,serviceWorkers:"block"})`; fresh cookies/cache, no owner profile; native headed/automation/version observations required.
Observers/page CDP/gate/recorder precede navigation; disable cache/bypass SW; unexpected popup/frame/download/websocket/worker is terminal. Exact stock context close must finish before NEXT/chamber.
stop exclusively fsyncs permanent stop-request before stop effects, acquires independent stop.lock, never waits for/deletes run.lock; no launch/context/SDK/approve/enable/reschedule permission.
run checks tombstone before/after awaits and immediately before dispatch; revoke capsule, journey.dispose, terminate exact Worker, gate.stop, exact context close and server.close under literal deadlines.
Independent stop may chromium.connect ONLY this job's private existing endpoint and issue public `newBrowserCDPSession().send("Browser.close")`<=10s. Connected Browser.close alone is only disconnect, not root exit.
Where retained, BrowserServer.close/kill uses the original actual handle, never PID lookup/takeover. Record root exit separately; it does not prove descendants.
If original Node/endpoint is lost, owner may close ONLY the positively identified dedicated browser window; record human observation, not process/descendant proof. No scan/global/PID-only kill or fake cleanup.
Always attempt separately reserved disabled-site and applicable Target safety branches even if browser close/reconnect fails. Missing endpoint/root exit/descendant/backend facts remain UNKNOWN; no later arm.

## 10. Additive gate and actual served adapter

Add attachSupervisedJourneyDispatchGate to stock-baseline-browser.mjs using shared internal implementation, not a caller flag. Existing attachStockDispatchGate/public core contract and worker refusal remain unchanged.
Fixed supervised mode admits zero stock workers or exactly one chamber classic Worker at the job-pinned URL. Preserve native-body/expiry/tenant/cap/page controls; never fake no-martech/old-case policy.
Observe actual BrowserContext request/response for worker entry and one SDK import in addition to page CDP; hash original native buffers before releasing first SDK egress. Reject missing/duplicate/redirect/cache/SW asset proof.
Before importing the manual adapter or booting an SDK, explicitly fetch the one literal disabled runtime-config resource in the owned page through the installed native gate, and verify original text bytes/hash, JSON media,200/non-redirect and enabled:false. Include that fixed resource in both arms' normal-page proof inventory. Never rely on the disabled ordinary bootstrap or a fixture's navigation helper to manufacture this browser observation.
Prepared assets are already served/inert; operator has no build/deploy action. Literal automation may import/call that fixed served module, but evaluate/CDP-injected code is NEVER called deployed proof.
Closed page capsule=`{kind:"airlock.05109.page-capsule",schema_version:1,pair_id,job_sha256,arm,run_id,origin,page_url,start_at,action_expires_at,case_expires_at,config,request_cap:5,asset_pins}`.
Accept once per exact document/query; no arbitrary endpoint/options/function. Install nonreplaceable closure-private fetch/beacon wrappers BEFORE SDK loading; inability to lock required descriptors blocks initialization.
SDK sends require POST to exact fixed Edge16 endpoints, selected configId+one UUID requestId only, admitted type/size, no credentials/redirect/collect. Intersect stockAdobeUrl; its broader collect regex is not authority.
Check captured monotonic elapsed AND immutable UTC expiry before EACH send; synchronously spend one of FULL pre-reserved five slots, including consent/retries/beacons/ambiguous attempts; no reset/refund after controller loss.
Allow separately budgeted first-party GET only for exact prepared dependency inventory. Resolve relative string GET input against the fixed document URL, then require canonical origin and complete literal inventory target equality. No arbitrary query, foreign destination, discovery or fallback; deny other methods, XHR/WebSocket/EventSource/WebTransport, uncontrolled workers/frames/alternate Adobe transports.
Preserve original string/Blob bytes; beacon admission is synchronous type/size/URL/cap, never fabricated body. Expiry disables controls/new work, disposes journey/terminates Worker/aborts owned fetch; already-issued work may persist.
Chamber dispatcher forwards actual mediated request/body and original bounded `{status,statusText,headers,body}` response; retains consent/tenant/payload/granted-cookie enforcement and same-page scoped cookie reconciliation.

## 11. Fixed page actions and clocks

Stock: same empty320x180 owned slot/control; createStockEntry with private enabled config, runnerConsent:"grant", fixed original importer; remote config stays disabled and must not consume entry claim.
Run original eager -> lazy -> delayed; wait actual ready and perform one fixed locator trusted click. Observe original API results/rejections; synchronous pushEventToDataLayer remains undefined, never a fake custom-result promise.
Chamber: eager public reserveSpace handle, existing classic Worker, createChamberJourney with literal config/consent/scoped cookie/SDK URL and real capabilities; initialize -> fetch -> render -> page -> custom -> interact.
afterPaint is two real animation frames; visibility checks actual connection/reservation/filled marker/HTML/style/clipped geometry. Install interact's native listener before one fixed locator click; isTrusted/intended target is checked by host.
Preserve original bounded SDK results and proposition id/scope/scopeDetails, distinct page/custom Analytics mappings, actual safe render before native DISPLAY, actual trusted click before INTERACT. Host facts are not SDK ACKs.
t0 is monotonic+UTC immediately before navigation after observers; observe45s, require all actions settled by35s and at least10s passive post-action capture.20s fixture ceiling is NOT the Adobe case clock.
Page SDK/action expiry<=t0+35s and all earlier immutable bounds; each action wait<=min(existing10s,remaining action time). No clock reset/extension; missed35s fails rather than shortens observation.
Allow bounded5s recorder drain and10s context close; both arms/NEXT/propagation/cleanup must fit exact reviewed window/source/preflight/authority. Timers do not cancel buffered work or prove event-loop/descendant closure.

## 12. Evidence, terminal disposition and Jig handoff

Use actual startStockWireRecorder(maxRequests5,request8192,response16384,total32768,settle5000,nativeBodySource=gate source) on public caller-owned handles.
Fsync original CDP request-stage body/witness before continue; correlate ordinal/requestId/URLhash/method/type/time/filehash with real response. No postData fallback, reconstructed JSON, loopback or route.fulfill proof.
Store pair-private per-arm originals, native asset/body/network witnesses, actual SDK returns and independent render/trust times; preserve errors/partial prefixes and unavailable API results, never success-shaped substitutes.
Existing checkStockWire exact positive-capture schema is populated only from actual parsed originals; preserve its false provenance claims. A chamber check using that schema is not an original baseline stock case.
Require actual consent/fetch/page/custom/interact, native DISPLAY/INTERACT ordering, owned offer/activity/experience binding and each arm's ORIGINAL proposition identity; compare semantics, not dynamic requestId/ECID equality.
Arm=`{kind:"airlock.05109.arm",schema_version:1,job,arm,run_id,source_epoch,started_at,action_settled_at,stopped_at,environment,native_assets,native_bodies,network,sdk_results,host_observations,wire_check,dispatch,closure,disposition}`.
Terminal=`{kind:"airlock.05109.terminal",schema_version:1,job,outcome,arms,spending,cleanup,unknowns,original_reconciliation,claims}`; outcome=observed_pair|divergent|failed|blocked|unknown.
cleanup separately reports capsule/remote-disabled/Target-SAVED/schedule/root/descendants/backend; dispatch separates full reservation, attempts, observed sends and unknown pending; retain native whole-operator exit/duration or UNKNOWN.
Label owner-supervised proving evidence; downstream receipt/full compatibility/performance/unattended/descendant qualification/baseline completion stay false. Original accounting import remains pending; no full slice DONE from source tests.
Frame review precedes source TDD. Controlled tests cover closed inputs/inspect no-effects, READY-before-burn, immutable schedule,14-call arithmetic, durable failures, sandbox/temp ordering, page cap on loss, native assets/bodies, ordering/trust, independent stop and unresolved late-write UNKNOWN.
Retain old worker-refusal/default/core regressions and original files byte-for-byte; no actual SDK/browser/network/native tests are authorized by this source task.
Then independent compliance/craft/architecture on exact new pins and ordinary Jig records/reconciliation. Actual run still requires fresh exact job review, facts, budget and native presence; no execution request follows here.
Single live admission blocker: no current reviewed prepared exact-window/job package with complete cumulative cost/byte evidence has been established by this writing task; never claim it fits or create another framework to bypass it.

## Replacement R1 supplied-records check and admission withdrawal

**2026-11-02, proposed source contract:** the approved R1 allocation withdraws
new run admission and historical retry effects. The originals are UNAVAILABLE
under the bounded restoration observation; no backup absence beyond those
checks is claimed. [ADR-0050](../../decisions/adr-0050-evidence-independent-05109-source-checkpoint.md)
is Accepted after independent ADR frame review. The separate source frame
passed; the source candidate still requires independent review. This is not
current run approval.
The preceding C requirements and historical approvals remain intact.

Later source implementation must make `reserveSupervisedRetry` refuse
`historical-retry-unqualified` before any filesystem call, and make public
new-run admission return bounded `source-unqualified` before READY, claims,
credentials, runtime imports or other effects. No flag, root or fixture switch
may re-enable it. The parent-alias race and all real write/admission adapters
remain unqualified. Preserve the existing consumed-job `stop` path without a
new prior-pair-journal dependency or a claim that its filesystem safety is fixed.

The pure `checkSupervisedJourneyCapture` checks supplied closed records only.
It uses the descriptor-safe snapshot, exact request/body/admission and
response/proposition/host joins and actual `checkStockWire` described in the
[R1 source bar](slice-09-focused-chamber-journey.md#replacement-r1-source-only-contract-and-completion-bar).
Its complete bounded output has this shape:

```js
{
  kind: "airlock.05109.journey-capture-check",
  schema_version: 1,
  evidence_basis: "supplied-records",
  overall: "source_checks_passed", // or source_checks_failed / invalid_input
  exit_code: 0,                   // respectively 0 / 1 / 2
  checks: {
    request_join: "passed",
    response_join: "passed",
    proposition_join: "passed",
    host_binding: "passed",
    wire: "passed"
  },
  counts: { requests: 5, admissions: 5, body_witnesses: 5 },
  execution_ready: false,
  actual_evidence: false,
  claims: {
    official_sdk_execution_verified: false,
    actual_dispatch_verified: false,
    native_host_render_verified: false,
    chamber_compatibility_verified: false,
    downstream_receipt_verified: false,
    full_wire_conformance_verified: false
  }
}
```

Failures keep the same shape, bounded `failed`/`not_exercised` checks and no raw
inputs. A valid divergent join returns exit 1; malformed or hostile input
returns exit 2. All claims remain false for every outcome, including a call
from `runArm`. This checks relationships among supplied records, not independent
provenance. `runArm` retains `wire_check` and adds required `capture_check` to
the current Arm shape; a failed join blocks before saving a successful arm.
Historical arm records and Job, Prepared and approval schemas do not change.
The full operator remains unqualified and run admission remains frozen.

No original evidence is reconstructed, repinned or replaced. Old charges,
claims, reservations and UNKNOWNs remain. Default tests later use owned data
without private fallback; actual historical byte-backed qualification stays
opt-in and fails on missing originals. This source checkpoint grants no SDK,
browser, network, live case, clock renewal or cleanup claim.
