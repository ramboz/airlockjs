---
status: IN_PROGRESS
dependencies: [051-01, 051-04, 051-06, 051-07, 051-08, adr-0038, adr-0039]
last_verified:
kind: feature
frame_review: true
arch_review: true
claimed_by: adobe-adoption-goal
---

## Slice 051-02 — reproducible stock wire baseline

**Goal:** An integrator can reproduce pinned stock Adobe journeys and compare actual
outbound requests, responses, rendering, negative controls and performance with the chamber arm.

**Owner-approved reframe — 2026-10-12:** [ADR-0039](../../decisions/adr-0039-airlock-boundary-acceptance.md)
replaces mandatory downstream report receipts with boundary conformance. Reporting/attribution
is a nonblocking [056 follow-up](../056-adobe-product-workflow-validation/spec.md).
The original eight criteria's deployment, repeatability, event/notification correctness,
controls, isolation, cleanup and performance scope survives. Criteria 3/4 now measure
actual wire/response/host behavior rather than waiting for vendor report processing.
The former fifteen-export, fourteen-hour polling plan is retired, not an Adobe requirement.
Prior draft/history is preserved in Git at `c9008a6` and dated [R-014](../../research/R-014-adobe-first-compatibility.md);
closed 051-01/04/05/06 and their evidence are unchanged.

### Established inputs versus remaining work

051-06 supplies deployed pinned assets, real stock no-offer/positive attempts, safe rendering,
trusted click and an independent disabled stop. The headed positive has ordinary Analytics
page/custom count one each in its original interval. The seven-day Target export has two
cumulative Scoped displays in owner-confirmed Development, not per-run attribution.
051-07/08 supply recorded-payload predicates and passive original-byte observation.
None completes the real controls, full response capture or performance baseline below.
051-03 chamber experiments have not run.

The owner authorized continuation beyond the original 10,000-credit stop; actual usage
remains tracked. The eight-active-hour 051-03 cap remains. Success may retain a bounded
approved activity with site code disabled. Failure/control pauses still apply.
No new resource, routing, profile, ingestion or publication authority follows.

**DoR — offline implementation, not live permission:**
- [x] Reviewed preparation, stock entry, recorded checker and browser recorder exist.
- [x] ADR-0039 is Accepted; the assigned operator contract is specified below.
- [x] Previous exact operator contract received independent frame review; the proposed
      normal-page refinement below requires a new frame review before implementation.
- [x] Pinned request/result/state rules are grounded in 2.31.1 source and retained evidence;
      unsupported forms remain unverified, not a permissive success envelope.

**Per-stage live gates:** Genuine current owner scope, exact operational-plan review,
implementation compliance/craft/architecture passes, fresh owned-resource reads, verified
deployed bytes, and an actual preparation report-v2 with all twelve required checks ready
generated <=1h before traffic. Preparation requires saved/future activity; the previously
approved-ended state is not readiness. These gates do not block hermetic implementation.

**Acceptance Criteria:**
1. **Plan before apply.** A no-mutation inspection/plan lists exact resource reuse, proposed
   changes, effects, approvals, costs and private journal location. Apply refuses unbound plans.
2. **Repeatable scoped resources.** Reuse only the approved owned fixtures; verify ownership,
   current content/state and pins, refuse collisions/drift, and retain IDs privately.
   Unsupported administration remains explicit/manual, not silently bypassed.
3. **Pinned collection wire and return path.** Actual official SDK page/custom requests
   carry the expected final XDM, Adobe data, identity/consent and selected routing. Verify
   request dispatch and result/error behavior with a receiving endpoint and live approved
   Adobe positive. Neither pre-serialization input nor HTTP success alone satisfies this.
4. **Pinned Target round trip.** Fetch the real owned proposition, render safely in the
   reserved slot, and verify native DISPLAY/INTERACT on actual wire with returned
   id/scope/scopeDetails and real render/trusted-click ordering. No-render emits neither;
   GA4 exposure is not a substitute. Goal provisioning/report counts are not required.
5. **Negative controls.** Real SDK no-consent/no-offer/non-render cases establish absence
   of forbidden egress/notifications and explicit returned outcomes within the chosen
   finite window. Positive sensitivity makes those assertions non-vacuous. Distinguish
   host guards from SDK-native denial; record failures/retries rather than hiding them.
6. **Independent isolation.** Verify suite/datastream and Target environment/workspace/
   property bindings separately from AEP sandbox choice. Only authorized test resources.
7. **Private evidence and independent stop.** Captures/IDs stay local, public reports use
   fixed safe fields, and the dry-run cleanup names exact owned operations. Independently
   disable the site and perform applicable pause/compare-controlled inverse on failure;
   disclose unknown writes, conflicts and incomplete cleanup. No deletion/reset/replay.
8. **Measured baseline.** Record stock versus no-martech observations under equivalent
   conditions, including eager wait/rendering and main-thread work, sample failures/noise.
   No Airlock improvement, field CWV or release performance band is inferred from this stock baseline.

### Implementation contract

Deliver `probes/adobe-compatibility/stock-baseline.mjs`, three Vitest suites
`adobe-stock-baseline`, `adobe-stock-baseline-browser`, `adobe-stock-baseline-operator`,
and the directly related README. This is the existing vertical operator slice, not
another utility milestone. Use installed Node/Playwright/Vitest; no new dependency,
framework, SDK host, arbitrary script/URL loader or frozen-core/connector change.
Reuse `contract.mjs` private reader/parser/validators, `preflight.mjs`'s in-process CLI,
the pure `checkStockWire` and passive `startStockWireRecorder`. Do not change their
closed contracts. One concrete browser helper module is permitted only if needed to
keep this actual operator's browser code separate; no plugin or provisioning abstraction.

#### Interface and private schemas

Import performs no I/O. Export `validateBaselineInput(value)`,
`buildStockBaselinePlan({input,stage,now,resources,reference})`,
`checkStockBaselineCase({plan,capture,ledger})`, and
`runBaselineCli({argv,env,stdout,stderr})`. Pure functions validate bounded plain data,
reject accessors/proxies/symbols/cycles/nonfinite numbers, and return independent frozen
objects or fixed `Failure("invalid_input")`. Tests may mock installed methods; no live
clock, transport, browser executable, importer or endpoint override is an operator option.

```text
--help
plan --input FILE --stage controls|active
prepare|verify|run --input FILE --plan FILE --approval FILE
observe --input FILE
restore --input FILE --plan FILE --approval FILE --mode inspect|apply
```

Operation is positional; flag order is immaterial. Reject unknown/duplicate flags,
extra arguments, empty/control-containing paths and flags as values. Static help
reads nothing. `ADOBE_CREDENTIAL_FILE` is the only credential handle, never a value flag.
Plan/observe/restore-inspect read no credentials and perform no network/Git/browser work.
Only prepare invokes the existing preflight's fixed access inventory; optional configuration
API diagnosis stays stopped. Credential export validation/identity binding is reused.

All objects below are closed; `raw` means bounded original vendor JSON, not an extensible
operation. `Ref={path,sha256}` binds original file bytes. Existing evidence retains its
original timestamps/authority references; do not require unrelated historical references
to be equal or rewrite sources to meet this schema. Hash canonical JSON only for derived
vendor projections, preserving array order; file/SDK hashes bind actual original bytes.

| Private artifact | Required keys / shape |
|---|---|
| Input | `kind:"airlock.adobe-stock.input",schema_version:1,baseline_id,authority:{authority_ref,approved_at,expires_at},preflight:{input:Ref,routing:Ref,workspace:Ref},resources:Ref,reference:{directory,base_commit,config_sha256,assets:[{path,sha256}],content?:[{path,sha256,content_type:"text/html"}]},code_pins:{operator,contract,preflight,responses,site,harness,wire_checker,wire_recorder,package_lock},sdk_pins:{alloy,aem_martech,acdl}` |
| Resources | `kind:"airlock.adobe-stock.resources",schema_version:1,observed_at,activity:raw,offers:[raw,raw]` in preflight selector order; exact IDs, ownership, location/options/experience links and content hashes verified |
| Plan | `kind:"airlock.adobe-stock.plan",schema_version:1,baseline_id,stage,input_sha256,source_hashes,code_pins,sdk_pins,planned_at,window_start,window_end,expires_at,resource_before:raw,config_before:raw,config_enabled:raw,config_disabled:raw,reference_before,effects:[{operation,before,after,inverse}],cases:[{ordinal,label,arm,case,run_id,pair,adobe_cap}],limits,cost,restore` |
| Approval | `kind:"airlock.adobe-stock.approval",schema_version:1,plan_sha256,input_sha256,code_pins,approved_at,expires_at,authority_ref,reviews:{frame:Ref,compliance:Ref,craft:Ref,arch:Ref,operational:Ref}`; genuine pass sources, exact reviewed code/plan, owner-scope grant |
| State | `kind:"airlock.adobe-stock.state",schema_version:1,baseline_id,input_sha256,stages:{controls,active},contexts_spent:[ordinal],reservations:[{case_ordinal,request_id,url_sha256,body_sha256,at,status}],metadata_requests,cleanup_requests,errors,cleanup,reference_head,resource_current:raw` |
| Stage state | `plan_sha256,approval_sha256,status,preflight:Ref|null,verification:Ref|null,cases:[Ref],effects:[{operation,before,expected_after,status,observed_after}]`; stage status `unstarted|prepared|verified|running|passed|failed|cleanup_incomplete` |
| Verification | `kind:"airlock.adobe-stock.verification",schema_version:1,plan_sha256,verified_at,expires_at,preflight:Ref,resources:Ref,reference_head,served_hashes,overall` |
| Case capture | `kind:"airlock.adobe-stock.case",schema_version:1,plan_sha256,case_spec,started_at,ended_at,provenance,environment,network:Ref,host:{entry,observation,events},metrics,errors,result`; entry and observation preserve current stock-site returns |
| Lock | `kind:"airlock.adobe-stock.lock",schema_version:1,baseline_id,pid,operation,nonce` acquired exclusively; matching nonce required on release |

Further enumerated value shapes are fixed in tests before production implementation:
no unknown artifacts/fields, caller-supplied success provenance or dynamic file inventories.
IDs are `airlock05102-<32 lowercase hex>`; case run IDs are freshly minted, unique and
bound by the immutable plan. Stage is `controls|active`. SHA-256 is lowercase64 hex;
Git SHA lowercase40 hex; times finite canonical UTC; private scalar values <=250 UTF8
bytes except canonical URLs <=2048 and file handles <=4096. Pure inputs <=262144 encoded
bytes/depth16/10000 nodes. SDK/code pins name only the fixed source files above.

Generated artifacts live in ignored `secrets/adobe-stock-baseline/<baseline_id>/`
under this worktree (0700 directories,0600 regular files), never the shared main checkout.
Reference clone is a child `reference/`; parent supplies it, operator never clones.
Check owner/mode, symlink components, containment, regular-file identity and original hash.
Reuse `readJson(path,true)` protections; an internal bounded byte reader must compare its
parsed hashed bytes to that reader's value, refusing replacement/disagreement. No credential
scanning or token persistence. New metadata <=262144 bytes/file; partition raw captures
into per-case network/host/trace files rather than raise the existing reader's ceiling.

State is one durable owner-only file: persist intent/fsync before each external write,
context admission and `Fetch.continueRequest`; atomic replacement and directory sync
must succeed first. Journal before/expected/observed effects and spent reservations
survive all stages/restarts. No hash-chain framework or replay log is needed.
Interrupted/running stage is failed/spent, never resumed or refunded. Missing/corrupt state
after effects is unverified. Exclusive lock refuses concurrent/ambiguous ownership;
no automatic force-unlock, PID-only stale inference or operation replay.

#### Operations and owned effects

Plan is offline and lists exact proposed narrow changes/inverses, scope, cost/count caps
and private paths. It binds current resource/config/reference snapshots, source hashes,
code and approvals; a private review projection is consistency evidence inside our trust
boundary, not cryptographic producer authentication. Insufficient/stale sources refuse.
Planning snapshot may be saved or approved-ended; it is not a preparation-ready snapshot.
Active planning uses the verified preceding control state, not replayed initial snapshots.

Prepare, under reviewed scope/plan, reads current resources and disabled reference first.
It may set only the exact owned activity saved and future `startsAt/endsAt`, then obtains
an actual in-process preflight report. This repair precedes the saved/future readiness check;
it does not waive it. Verify repeats exact resources/reference/served-byte comparisons,
requires all twelve preparation checks ready <=1h, and produces <=5min verification.
Run requires that evidence plus its reviewed exact operational plan; no traffic from
fixtures, HTTP-only readiness, missing approval or unknown prior cleanup.

**Post-success restore clarification — 2026-10-20:** Actual control20 passed and
its site stop/Target SAVED readback succeeded, but an additional standalone
restore refused before effects. Read-only diagnosis on executed51a1 source
showed exactly one source-hash difference: the controls plan bound
`current_resources:null`, while successful completion had created a later
current-resources receipt. Restore must reproduce the reviewed plan's source
footprint, not promote a post-plan artifact into an old plan dependency.
If that plan's current_resources hash is null, this derived later receipt is
not required for its owned stop; original input resources, all immutable
ownership lineage, current state/effects, exact source/approval/config pins and
independent remote ownership comparisons remain mandatory. A non-null hash
(including active plans) still requires the exact bound receipt; never ignore
its mismatch. No source-hash comparison is removed or replaced by observed bytes.

An explicit successful restore that **begins with a passed stage** preserves
that passed measurement/case status only when its cleanup succeeds. It must
not relabel successful original samples as failed solely for a compare-controlled
inverse. New conflicts/unknown cleanup remain cleanup_incomplete and block
further traffic. Existing failed/interrupted-stage and operational-error cleanup
semantics remain failed; no passed status is resurrected from an incomplete or
failed stage. Test the plan-null receipt boundary, non-null receipt tampering,
successful status preservation, unknown-cleanup refusal and unchanged original
case bytes/counts. This is an offline correction, not permission to edit
executed input/code pins, bypass a refusal, replay20 or claim its original
schedule restored retroactively. Any real use of corrected code requires its
own reviewed execution binding.

Only administration requests: existing OAuth issuance/preflight reads, exact selected
Target environment/property/activity/two offers GETs, and the known activity
`PUT /state` (`{"state":"saved"|"approved"}`) or `PUT /schedule`
(`{"startsAt":...,"endsAt":...}`). Existing Accept v1/v2/v3 and narrow write v1 media
types remain. No listing/create/content/goal/audience edits, whole-activity PUT,
configuration API, UI token extraction, publish/delete/reset or broad fallback.
Metadata requests are exact HTTPS, no redirects, request timeout10s, response1MiB,
normal metadata ceiling512/32MiB total and cleanup reserved allowance32/8MiB.

Before each write fresh GET must match the recorded prior projection and preserved
activity fields; read back after. Fingerprint the full activity except state/dates and
the retained server audit strings `modifiedAt`/`modifiedByName` (retained original
snapshot confirms those keys). Other fields, including Page Delivery/goals/settings,
remain exact. Audit changes are recorded, not silently discarded as arbitrary volatility.
This is a compare-before-write, not server atomic compare-and-swap. Foreign drift refuses.
Failed/ambiguous write/readback remains unknown and triggers independent cleanup.

Reference must be clean with canonical selected HTTPS origin and HEAD=origin/main at
the current approved parent. Non-force forward commits may alter only
`tools/airlock-stock/runtime-config.json`; enabled/window fields only, preserving all
selectors/pins/offer hashes. Disable changes only enabled=false, not old whole-file replay.
Keep normal Git/secret-scanning hooks, no bypass flags; fixed `execFile` arrays only,
bounded output, no shell/input command hooks. Compare remote before push; journal unknown
push outcome, never blindly retry. Existing source/SDK paths are read-only pinned assets.
Verify decoded source/served hashes, expected media/CSP and config before navigation.
Bound config propagation to120s/13 exact reads; no SDK resend on mismatch.

Each plan uses future start at least5min after planning, <=50min config/activity serving
window and >=5min cleanup allowance inside source/authority expiry. Active approval
readback precedes traffic by the reviewed15min propagation interval; reread current
state/config and freshness after waiting. No reports determine stage spacing.

The concrete planner uses a15min future lead so fresh operational review and actual
preparation/verification can finish before the fixed start. This is planning-time
lead, not a requirement to retain five minutes at the schedule PUT. A missed start
is never extended in place or approved retroactively.
Controls keep activity saved in the confirmed active-only Development environment;
active approves only its finite schedule. Observe is local-only, recomputes captures/
counts and refuses missing/failed cases; restore-inspect lists exact pending inverses
without claiming current state. Restore-apply read/compares recorded owned effects only.

Failure scope encloses preparation, activation/readback, deployment and browser work.
Stop new dispatch first; independently attempt site-disable and activity saved/schedule
inverse even if the first branch or activation readback failed. Each branch has its own
bounded120s allowance. Preserve foreign later changes; before-or-after known intermediate
projection may be reconciled by fresh read, unknown ownership cannot justify blind inverse.
Cleanup unknown/conflict blocks all later traffic. Success disables site and may retain
bounded approved activity; distinguish approved-ended from currently serving.
Stop transient helpers. No activity deletion or restoration to old approved-ended state.

#### Actual wire, return and host oracle

Before navigation attach original-byte recorder and native CDP request-stage Fetch
interception, including redirected hops. Allow exact selected HTTPS preview GET resources
of the pinned page and canonical POST `https://edge.adobedc.net` only for the 051-07/08
regional action regex, literal single configId and UUID requestId, JSON/body limits.
No foreign origin, redirect, alternate Adobe/demdex host, trailing dot, routing override,
arbitrary navigation, worker/popup/WebSocket producer or new dynamic resource inventory.
Inspect the pinned page's real producer/resource set; unsupported interception remains
blocked, not a hostile-browser sandbox claim. Continue native requests with **requestId
only**, never changed headers/body/URL, forwarding or fulfillment.

Reserve/fsync each allowed request before continue; per-case/global ceilings count
failed/ambiguous dispatch and SDK retries. Classification is separate from observation:
passive Page request events are not dispatch authority. Reconcile reservation UUIDs/
original body hashes with paired recorder Request/Response identities; unpaired,
duplicate, extra, incomplete or reordered evidence fails. Record original buffer bytes,
selected Content-Type and response bytes, not lossy postData/reconstructed historical fields.

Use unchanged checker predicates for exact consent/query/page/custom/notification shape.
One assigned event per request; sequence grant→fetch→page(+DISPLAY)→custom→INTERACT.
No-offer/non-render omit notifications only. Identity query, if present, is ECID only.
SDK-generated implementationDetails must identify pinned2.31.1 browser; record XDM
timestamps/environment/device/state and validate known container types rather than
erase them. Unknown routing/identity/policy/personalization fields cannot pass as additive.

Recorder generic JSON200 is not the protocol oracle. Ground exact 2.31.1 success/handle
families from pinned source before readiness; preserve all responses. Nonempty error
envelopes, unexpected/malformed/unsupported decision/identity/state handle, mismatched
response requestId or transport failure is failed/unverified, not ignored HTTP success.
Fetch must return matching owned scope/provider/activity/experience/offer content;
no-offer requires actual empty propositions, non-render actual qualified offer.
Link raw personalization response to the SDK caller's original result and every native
notification. Returned ECID/state keys must exhibit same-context continuity into later
requests; fresh contexts need not have equal IDs. Never substitute `_id`/proposition/
scopeDetails, ignore rotations, or decode opaque identity to invent an ECID relationship.

Independent DOM/trusted-event observation verifies connected visible320x180 placement,
exact hash-qualified inert offer, visible descendants/clipping and actual trusted click.
DISPLAY follows observed rendering, INTERACT follows actual click, both reference this
arm's original returned id/scope/scopeDetails. Non-render slot remains empty throughout.
Current stock entry's no-consent initializes/updates real SDK but **locally guards**
four collection attempts. Classify `host_guarded_denial`, not SDK-native collection
rejection; absence within the complete window is meaningful only alongside real positives.
Unexpected/lost/rejected callback is explicit. Zero request observation alone never passes.

Normalization handoff retains raw fields plus a path/reason/consistency table for
request UUIDs, generated XDM timestamps/_id, queue timing, per-context ECID/state,
returned proposition references and known regional hints. No wildcard stripping;
all event/routing/notification semantics stay exact. Cross-arm normalization and broader
identity/revocation/retry/lifetime coverage remain tested051-03 requirements, not done here.

#### Cases, finite windows and performance

| Ordinals / labels | Stage / arm | Per-case Adobe cap |
|---|---|---|
|1 no-consent,2 no-offer | controls / stock |1,4 |
|3 non-render | active / stock |4 |
|4..6 positive-1..3 | active / stock |5 each |
|7,9,11,13,15 pair-1..5-control | active / no-martech |0 |
|8,10,12,14,16 pair-1..5-stock | active / stock positive |5 each |

Exactly16 fresh contexts,11 stock installations,10 granted; whole baseline64 Adobe
requests, smaller caps sum49 and may not be transferred. Controls then active, no
same-case retry/warmup/new context/failed-sample replacement. Three positives make
negative sensitivity non-vacuous. Context/admission intents are spent before launch.
Unknown cleanup or a failed case stops normal traffic; unexecuted cases stay unexecuted.

Per case: launch10s, navigation20s, entry15s, module30s/phases10s, trusted-click5s,
watchdog90s, close5s, recorder drain5s. Observe from before navigation through at least
45s AND10s after actual action/entry settlement. No-consent uses settlement instead of
click. Bounds never shorten the required window into a pass. Recorder request8KiB,
response16KiB/body-total32KiB; retain overflow/error as incomplete. Browser/CDP buffering
is not physically allocation-capped by these accepted-data limits.

Default headed Chromium/automation disclosed; no stealth, UA spoof, headless fallback,
owner profile or remote browser attach. Record OS/browser/Playwright/code/config/SDK.
1365x768/deviceScale1, fresh cold contexts, service workers/cache/prerender disabled;
CDP CPU4x, decimal network1.6Mbps down/750Kbps up/150ms. Same preview/content, placement
and fixed measurement observers in both arms. No-martech normal consent-decline root
loads no stock SDK; runner creates only the same empty placement/control. Stock offer
is the treatment, not substituted control content. Observe10s after trusted action.

Measure navigation→stop: CDP ScriptDuration delta(ms), long-task count/sum and
sum max(0,duration−50ms) labelled lab excess (not Lighthouse TBT); buffered LCP before
first trusted action; CLS maximum session window(gap<=1s,total<=5s,no recent input);
fetch admission→paired response wait; observed eager/qualified→visible render durations;
owned-click Event Timing when available, never population INP. Include observer overhead/
sampling uncertainty. Missing/reset/unavailable values are null with
`observed|missing|unsupported|not_applicable|failed`, never invented0.
Required scripting/longtasks/LCP/CLS/render/window observations must actually exist.
Event Timing subthreshold absence is missing, an explicit allowed limitation.

Auxiliary numeric CDP trace spans navigation/eager/decision/ACDL/click/10s aftermath,
no screenshots/header/code output; bounded8MiB/20000 events per case,64MiB/160000 total,
512 performance entries, stop5s. Disclose projection versus original trace and native
already-buffered allocation. Trace loss/overflow and missing required metrics fail
qualification; no summing nested scripting trace durations. Preserve failed samples.
Five interleaved pairs only: metric n/median/min/max and same-pair stock-minus-control
deltas, nulls/failed_pairs retained. No Airlock improvement or acceptance band inferred.

#### Public report and validation

Exactly one JSON line per non-help operation:
`{kind:"airlock.adobe-stock.report",schema_version:1,operation,stage,overall,exit_code,
checks,counts,cases,cleanup,reasons,performance,claims}`.
Tests freeze every subordinate key/enum before implementation. Fixed checks name
input/approval/sources/preflight/ownership/reference/deployment/egress/wire/response/
identity/host/controls/performance/cleanup. Counts are nonnegative contexts spent/passed,
reserved/paired/denied requests and failed pairs; cases use only sixteen fixed labels,
`passed|failed|unverified|not_executed` and fixed safe reasons.
Cleanup site/activity/schedule independently `not_needed|verified|unknown|conflict|failed`.
No IDs/paths/URLs/hashes/bodies/tokens/arbitrary exceptions or vendor strings in public output.

Exit0 applicable operation pass,1 gate/observed failure/incomplete baseline,2 invocation/
schema/binding refusal,3 internal failure,4 unknown/incomplete cleanup (takes precedence).
Overall enum `planned|prepared|verified|stage_passed|baseline_passed|restore_inspected|
restored|failed|unverified|invalid_input|invalid_invocation|internal_failure|cleanup_incomplete`.
Claims stock_boundary_verified only on complete genuine observe; chamber/downstream/
full_sdk/release/sdk_native_collection_denial_verified always false. Other operations
do not claim baseline; manually tagged/synthetic cases cannot bless producer provenance.

Witness red→green tests for exact schemas/refusal/redaction, source/ownership/review/
freshness, durable reservation/restart/caps/redirect enforcement, current source pins,
response/identity/host oracle sensitivity, true loopback receiving-sink original bytes,
independent failed-activation cleanup, metrics/nulls/failed pairs. Loopback only tests,
not operator override. Required implementation reviews precede any live effect; exact
private operational review is additional. New tests plus existing stock/preflight/
workspace/contract-stability run in one targeted Vitest invocation. Normal hooks/lint
and syntax apply; no new tooling or validation bypass. Real baseline completion is
separate from hermetic implementation success.

**Offline grounding:** The exact official152336-byte artifact hashes to the pin above.
UTF8 offsets6348-6450 derive org-scoped state keys;35928-36190 map returned identity
namespaces;45800-46500 transfer state and apply `state:store` (including optional attrs);
47400-48470 check status/handle arrays and process warnings/errors;48470-51000 apply
response/state before lifecycle result callbacks;94100-94730 preserve original proposition
items and add `renderAttempted`;108950-110180 return propositions/decisions. The immutable
headed caller result additionally has destinations; its propositions include
`renderAttempted`, while its decisions preserve identity/items without that flag.
These are source/retained-shape rules, not reconstructed historical response bodies.
Actual response bodies and continuity remain required new-run evidence.

### Downstream reporting follow-up

### Pre-code subordinate contract — 2026-10-13

The three named suites freeze the subordinate report keys, safe reasons, checks,
claims, case labels, exact caps/limits and metrics before production edits.
`checks` maps the fifteen fixed names above to
`passed|failed|unverified|not_exercised`; counts keys are
`contexts_spent,contexts_passed,requests_reserved,requests_paired,requests_denied,failed_pairs`.
Claims keys are `stock_boundary_verified,chamber_verified,downstream_verified,
full_sdk_verified,release_verified,sdk_native_collection_denial_verified`.
Performance is `{metrics,pairs,failed_pairs,limitations}`. Metric keys are
`scripting_ms,longtask_count,longtask_ms,lab_excess_ms,lcp_ms,cls,decision_wait_ms,
eager_wait_ms,render_ms,owned_click_ms,window_ms`; each is `{value:number|null,status}` with the
specified observed/missing/unsupported/not_applicable/failed enum. Aggregates use
`{n,median,min,max}`; pairs use `{pair,status,deltas}` retaining nulls. Limitations
are fixed `lab_only,automation_disclosed,trace_projection,observer_overhead,
event_timing_subthreshold,host_guarded_denial`.
Public reasons are exactly the test's `REASONS` inventory, never arbitrary exceptions.
Restore shape is `{site:"disable_current",activity:"saved_on_failure",
schedule:"compare_inverse_on_failure",delete:false}`.

Pure planning's `resources` argument is the fixed loaded projection
`{snapshot,preflight,routing,workspace,source_hashes,previous}`; reference is
`{head,remote_head,origin,clean,config,assets}`. These are internal consistency
facts, not caller-authenticated provenance. The CLI independently reads and binds
original bytes and validates current state before effects. No extra input option,
endpoint, dynamic importer or public evidence claim follows.
Activity audit exceptions are only `modifiedAt,modifiedByName`. Response payload
families are `personalization:decisions,identity:result,state:store,locationHint:result`;
nonempty warnings/errors, policy/destination and unknown handle/caller forms are
unverified. Original decisions and propositions are compared by original identity/
scope/details/items, allowing only the source-qualified `renderAttempted:false`
addition. No cookie decoding is used.

Private review projection is `airlock.adobe-stock.review` v1 with
`pass,verdict,reviewed_at,plan_sha256,input_sha256,code_pins,source_hashes,
authority_ref,source:Ref`. The original source's 051-02 slice/pass/PASS/timestamp
must agree; the projection alone is not a genuine review source. Source times
retain original UTC precision. `source_hashes` binds the original input/resources/
preflight/routing/workspace bytes, the concrete browser helper bytes, and
`current_resources:null|sha256` for the preceding completed control stage.
Active offline planning reads the fixed `controls-current-resources.json`
produced by the control run's actual final resource read, not the historical
initial input snapshot. No resource inputs or timestamps are rewritten.
Case-checker's loaded capture is `{case,network,trace}`; case additionally records
actual `settled_at`, and independent host observations retain navigation time
origin and main-first placement. The browser defaults remain headed; the one
real 45-second hermetic control test explicitly replaces only the installed
launch method to use headless Chromium, never adding an operator option.
Trace files are fixed per-case partitioned numeric projections with bound Refs;
no arbitrary importer or trace/script loader is exposed.
Case `result` is `{status:"observed"|"failed",dispatch:{reserved,denied,errors},
trace:Ref}`: original generated trace metadata/parts are bound privately and
dispatch denials survive failed samples. Independent host observations include
the actual rendered slot markup (not just the entry's caller wrapper), actual
navigation time origin, and equivalent main-first placement. The fixed trace
header is `{kind,schema_version,bytes,count,errors,parts:[Ref]}`; parts are bounded
`{kind,schema_version,ordinal,index,events:[{name,ts,dur}]}`. No original trace
arguments/headers/code/screenshots are persisted.

Lifecycle transition was made with `workflow.py transition … 051-02 IN_PROGRESS`
before tests. Initial red command selected all three new suites: 56 failures;
fixture response nesting was then corrected before retaining the behavioral witness.
No LIVE criterion or review box is completed here.

**Parent continuation after interrupted implementer — 2026-10-13:** The implementer
was cancelled without a final handoff; the56-failure initial witness above is its
retained note, not independently received parent output. Parent inspection ran the
existing110 tests successfully, then witnessed17 additional red regression assertions
before corrections: exact URL/media/tenant/network-window checks, stopped/failed-page
admission, truthful frame/code versus operational review binding, real eager/ancestor
visibility measurements, native beacon recording and fixed error output. The source
enumeration also establishes **both** native fetch and sendBeacon use JSON bytes with
`text/plain; charset=UTF-8`; this is not permission for arbitrary text or legacy streaming.
The earlier parent collect-only hypothesis was corrected before live traffic.
The recorder's POST-JSON body/routing/privacy/limit/false-claim contract is unchanged;
no closed record is rewritten. Known SDK `_id` absence/queue timing and204 collect
responses are qualified without inventing response bodies or identities.

Review projections preserve scope: frame has null code/source/plan/input bindings;
compliance/craft/arch bind actual code and browser helper, with null plan/input bindings;
only operational review binds the actual stage plan/input/source hashes. A projection
cannot add future facts to an earlier review. Full live criteria, final slice compliance
and reconciliation remain pending after pre-live code review.

**Pre-live independent review recovery — 2026-10-13:** The first code-readiness pass
failed on five concrete implementation gaps; it did not grade unexecuted live ACs as passed.
Four new red assertions reproduced mandatory dotted vendor filename refusal, consistently
paired semantic event reorder and missing private restore operations. Another red assertion
proved expired evidence could launch a browser after the15-minute propagation wait;
two red cases demonstrated known published/unpublished Git intermediates stranded cleanup.
Those corrections now pass with the existing targeted suite (1128 cases); independent
re-review remains required before effects.

`restore-inspection` v1 is a private fixed object with
`kind,schema_version,baseline_id,stage,plan_sha256,state_sha256,inspected_at,
current_resources_verified:false,operations`. Each operation is closed
`{operation,selector,before,after,comparison}` naming only `site.disable`,
`activity.saved` and the applicable exact prior schedule inverse. It is a dry-run
candidate list bound to the actual journal, never proof current state matches.
Known site recovery compares a recorded commit/config, its actual parent and config-only
diff with fresh remote state. It may forward only the disabled disposition when remote
is the known parent, or disable a proven published owned commit; it cannot replay approval,
push an enabled disposition or erase foreign changes. A conflicting site does not skip
the independently authorized Target saved/schedule recovery attempt.

Activation propagation does not extend a five-minute verification. Before every context,
the operator re-reads actual owned resources/reference and served bytes, then writes a
new <=5min verification. The browser requires enough remaining evidence for its100s
maximum completion allowance and refuses admission at expiry. Exact page/custom/INTERACT
semantic order is enforced separately from byte pairing. The genuine original-file
offline plan now returns `planned`, with all live/SDK/chamber/release claims still false.
No new operational approval or external write follows from these fixes.

**Follow-up source-shaped review — 2026-10-13:** Review caught a two-commit cleanup
chain that the one-commit tests had missed: recorded unpublished enable E above P,
then recorded disable D above E, with D publication unknown. Two actual red cases
now cover remote P and remote D. Recovery checks the bounded recorded chain back to
the journaled head, actual parents, each config-only diff and intermediate original
config JSON. Only a proven disabled head may be forwarded; foreign commits still block.
This does not replay an enabled push or relax current-state comparisons.

The normal pinned page also loads fonts and served content fragments. Source assets
remain exact Git-local paths/hashes; optional `reference.content` is a closed list of
at most16 distinct canonical root-relative `.plain.html` paths with exact SHA-256 and
`text/html`. No queries, encoded/path-traversal syntax, foreign origins or prefixes.
These content entries are independently byte-verified at the owned preview, not treated
as Git-local files. The browser gets only their exact literal GET paths. Binary source
assets retain original bounded bytes and expected `font/woff2`, `image/png`,
`image/jpeg` or `image/webp` media; never fatal-decode/re-encode them to hash.
Three source-shaped red assertions covered the content separation and chain failures;
an additional binary/fragment stop test checks invalid-UTF8 font bytes unchanged.
Current1135 targeted cases pass; independent re-review/operational approval remain pending.
The five-file offline planning inventory is not yet a complete normal-page traffic plan.

**Stop-accounting correction — 2026-10-13:** Follow-up review showed that repeating
the complete asset/content verification during stop would exhaust the shared32-request
allowance. One new red full-inventory two-stop case reproduced the exhaustion.
Normal preparation/traffic verification checks complete source/content bytes using
the normal metadata budget; successful post-stop resource reads use that budget too.
Independent stop checks the exact current disabled config bytes and root CSP, with
local source/config comparisons retained, rather than downloading every immutable asset.
No budget is replenished or expanded. When an owned Target inverse is applicable,
the site branch leaves seven requests and7MiB accepted-byte allowance within the shared
32-request/8MiB ceiling for the Target branch. Cleanup-only OAuth issuance is charged
to cleanup, not an already exhausted normal pool. Exhaustion remains incomplete cleanup.
Binary verification still runs before any preparation mutation; its font test retains
actual invalid-UTF8 bytes. A bad initial served CSP now blocks before Target writes,
so no schedule inverse is needed in that case; independent site status remains unverified.
The initial six-request reservation was corrected after a cutoff regression proved the
approved→saved plus schedule inverse needs seven (initial GET and fresh GET/PUT/readback
for each inverse). Stop reads root CSP headers and cancels its body; config propagation
is at most13 reads of the <=64KiB source-bound config, fitting the site's1MiB share.
No whole-root byte/rendering proof is claimed by this header-only stop check.

**Craft recovery — 2026-10-13:** A parked state-file sync regression reproduced late
Site work making another request after its120s branch timeout, consuming the Target
phase and even relabeling the Site as verified. Cleanup now carries an immutable
epoch/deadline/phase/abort signal through deploy, served reads, metadata and Target
writes. Every dispatch checks that original scope before and after its durable intent;
branch changes abort outstanding network/child work, and late callbacks are quarantined.
State snapshots are serialized so a late file operation cannot overwrite a newer
branch's counters. File-system work is not claimed physically cancellable.
Two measurement red regressions additionally exposed CLS anchoring at navigation and
shutdown time in `window_ms`. CLS anchors at the first shift; window_ms is the actual
navigation-to-measurement-stop interval and excludes teardown. No performance gain,
field metric or live correctness follows from these fixes.
The craft re-review identified three remaining edges: snapshot Git children lacked
the original scope; a resumed deployment-intent save could admit a new config write;
and final Target saves could still relabel timeout results. Snapshot Git reads now
receive scope checks/signals, config admission rechecks after the intent, and Target
return/retention checks bracket final saves. Two further parked-sync tests cover no
expired config admission and no late Target verified flags/PUT. The outer handler
does not blindly repeat an already failed cleanup; explicit later restore still
read/compares recorded effects. Required craft/architecture verdicts remain pending.
The next re-review found that a detached catch-save could outlive lock release.
A two-park regression reproduced a later invocation acquiring ownership while the
old writer was still parked. Finalization now seals further writer admission, checks
the seal before atomic state replacement, and drains admitted state/config writers
within5s before releasing ownership. If native file work remains unresolved, the
operator returns incomplete cleanup and retains the lock; it never permits that old
writer to overwrite a later owner. No physical file-system cancellation is claimed.
The unrenewed owner source expired at2026-10-13T14:55:35.910Z. Further work is offline
until genuine renewed scope and fresh operational evidence are supplied.

**Architecture recovery — 2026-10-13:** Scope freshness is now reevaluated from
the original owner-selection evidence whenever the preparation report is checked,
including after activation propagation and before every context. Verification expiry
also cannot exceed that observation's24-hour boundary. The propagation regression uses
explicit synthetic source/hash stand-ins to reach orchestration, not claimed SDK execution.
It crosses the original observation's age limit and confirms no context is admitted.
Journal save callers now wait at most5s throughout orchestration, including the between-
branch and terminal saves. Unresolved native writes route to sealed, lock-retaining
finalization instead of an unbounded wait; durability still precedes any dispatch.
The hung-before-dispatch regression confirms no HTTP request and no ownership release.
With bounded waits, the earlier two-park case may quarantine further writer admission
before the second park; it still refuses a later owner while the native first writer
is unresolved. Complete literal-inventory feasibility within cumulative normal-read/
byte budgets remains an explicit operational-plan question, not a cap increase.
The architecture re-review found one pre-controller interrupted-stage replacement
outside that queue. A hung-interruption regression reproduced the unbounded wait;
that replacement now uses the same tracked/bounded/sealed writer immediately after
lock acquisition. It reaches incomplete-cleanup finalization within the save/drain
bounds, performs no HTTP request, and retains ownership while native work is unresolved.

**Executable read-cost gate — 2026-10-13:** Plan now includes closed `cost` fields
`inventory_resources,controls_metadata_requests,active_metadata_requests,
baseline_metadata_requests,metadata_request_ceiling,adobe_request_slots,contexts`.
For N source-assets plus served fragments, the current full-verification algorithm's
successful minimum is controls `5N+63` (plus3 if initially approved), active `17N+150`,
and baseline `22N+213` (or216). It excludes propagation polls and failures: fitting
the minimum is necessary, not sufficient. Plan refuses `budget_spent` before effects
if the minimum exceeds512; active planning also charges its minimum against actual
reads already spent rather than granting a new allowance.

Static inspection of the pinned reference and its public root markup exposes25 candidate
source assets, two default fragment candidates, and40 declared image URL variants.
This is source inspection, not an executed browser inventory or renewed owner scope.
Even the27-entry source/fragment candidate set requires at least807 reads with the
current algorithm, before media. It is not a live-approved feasible plan. No resource,
request, byte, freshness or evidence cap is increased or silently waived.
A reviewed reduction of redundant verification and an exact normal-page media contract
remain necessary before this reference can execute the full baseline.

Existing ordinary Analytics and cumulative Target counts retain their recorded scope.
No mandatory exports/counter-stability/click-goal/report API/polling for every sample.
Optional contrary evidence exposing a protocol defect is investigated, not ignored.
Spec056 retains per-run attribution and product processing for a concrete future need.

### Proposed normal-page byte contract — 2026-10-13 (fresh frame review pending)

Keep the full normal page and prove the bytes it actually loads, rather than repeatedly
prefetching its fonts, fragments and images. This refinement supersedes only the all-assets
served-read procedure, queryless normal-resource gate and associated cost/schema rules above.
AC1–8, original SDK bytes, native wire/result/host/performance, frozen core, effects and
all existing safety caps remain. No code, test, transition, approval or traffic is claimed.
**Grounding and scope.** Read-only inspection at reference main
`c1438e33b53d5d894fbaabb9b5a4a9d0ff59ab9b`: `scripts/scripts.js:187–206,214–286`
loads ordinary sections/fonts and the exact opt-in stock/config bridge;
`stock-site.mjs:278`, vendor `index.js:239,313` bind pinned imports; `scripts/aem.js:337–380,535–560`
and `blocks/cards/cards.js:15` derive picture queries and block imports;
`blocks/header/header.js:95–97`, `blocks/footer/footer.js:10–12` and
`blocks/fragment/fragment.js:21–39` resolve literal fragments; `styles/fonts.css:1–35`
names four WOFF2 files. Parent's retained public-root source has two head module scripts,
columns/cards, a highlight **section**, ten images/forty declared query variants.
The 25-asset/two-fragment candidate ledger is not a closed or browser-observed inventory.
Parent alone renewed private scope/current preflight, routing and workspace envelopes.
Receipt `2026-10-13T16:11:20Z` records the owner verbatim: "I confirm the setup is unchanged.
I will not change anything without explicitly informing you or unless you explicitly
asked me to change something manually". Historical files/times remain untouched.
Use the new original scope evidence's <=24h limit, not a timestamp fabricated here;
renewal does not clear resource/config/consent/tenant, preparation or operational gates.

**Concrete interface.** Still exactly the four baseline exports and existing CLI operations.
Only `stock-baseline.mjs` constructs policy and calls `stock-baseline-browser.mjs`.
Reuse the private reader/parser/preflight, pure wire checker and unchanged Adobe recorder.
Inside that browser helper, one passive normal-response observer serves this caller;
no crawler, arbitrary loader, plugin, importer, endpoint override or producer-script change.
Input v1 `reference` gains required `normal_page:Ref`; `assets` still means original
Git-local path/hash. Legacy `content`, if present, must equal the fragment path/hash/type
subset below; reject disagreement. CMS means served content, not a fabricated Git path.
Bind the new Ref in source hashes/plan/operational review; old plans/approvals cannot apply.

Closed inventory: `{kind:"airlock.adobe-stock.normal-page",schema_version:1,reference_head,qualification:Ref,
root:{body:Ref,csp,normalized_sha256,normalized_csp_sha256},entries:[Entry]}`.
Entry is `{target,sha256,bytes,content_type,source,required}`; `required` is
`both|stock|conditional`, `bytes` integer1..1048576, SHA/media explicit.
Source is exactly `{kind:"git",path}` or `{kind:"cms",body:Ref,observed_at}`.
Git entries bijectively match `reference.assets`, original file sizes/hashes and media;
CMS entries bind original received bytes, not presumed immutability or a filename hash.
At most96 distinct targets; root/config derive only from case/current config, not entries.
`both` requires an actual successful response in every arm;
`stock` requires one in stock and forbids admission in no-martech. `conditional` permits
only source-derived alternatives (font glyph use, lazy images, picture selection), not
optional missing scripts/styles/fragments. Every admitted response must qualify.
JS media is the existing exact two-type allowance; other entries name one concrete type.
Root/styles, executed ordinary modules, fonts CSS and resolved header/footer fragments
are `both`; the four stock entry/vendor modules are `stock`. Conditional unused entries
are recorded, never reported loaded/byte-verified. No prefetch to make them “observed”.

`target` is the literal root-relative pathname plus literal query; exact known HTTPS
preview origin is derived from preflight, never an inventory-supplied origin.
Git targets have no query; fragment targets are canonical `.plain.html` with no query.
CMS images have source-resolved `media_<41 lowercase hex>.(jpg|png)` paths and exact
`width=750|2000&format=jpg|png|webply&optimize=medium` strings; fallback format matches
the path extension. These are admissible forms, **not** grants: only enumerated literal
targets pass, with original binary hashes and `image/jpeg|image/png|image/webp`.
Reject altered query order/duplicates/encoding, extra keys, origins, traversal, fragments,
redirects and path/prefix expansions. Derive entries from root/fragment markup, pinned
CSS/imports and these concrete functions; review the resolved closure before apply.
Missing fragment/media original bytes or unsupported producer edges refuse the plan.

Qualification Ref: `{kind:"airlock.adobe-stock.qualification",schema_version:1,baseline_id,
attempts:[{target,at,status,received_bytes,body:Ref|null,content_type,csp:string|null}]}`.
At most96 attempts; status `received|failed|incomplete`, bytes0..1MiB, media nullable on failure.
Successful root/CMS entries must match original receipt body/hash/size/type; root also CSP.
Failed/ambiguous attempts and received bytes count too. Parent supplies real receipts,
not reconstructed headers or a self-attested producer success. This receipt imports only
already-spent metadata counts/bytes once into durable state; it performs no reads itself.
The earlier public-root inspection lacked CSP/fragment/media byte proof. Parent's new
original root/CSP receipt now grounds the single header and nonce relationship;
fragment/media qualification and full receipt-ledger binding remain pending.

**Source versus loaded-byte proof.** Critical served-source set is fixed to seven files:
`scripts/aem.js`, `scripts/scripts.js`, `scripts/consent-check.js`,
`tools/airlock-stock/stock-site.mjs` and its three pinned vendor files
`vendor/aem-martech/{index.js,alloy.min.js,acdl.min.js}`.
Every existing full served checkpoint reads these seven, exact current config and root.
All Git assets still receive local clean/reference/original-byte checks. Other block JS,
CSS, fonts and CMS bytes receive native loaded-byte checks below, not redundant HTTP probes.
Root imports, stock query/consent/config bridge, vendor imports and exact pins remain
fully source-qualified. Producer closure is reviewed across **all** reachable code/markup;
the seven prefetches alone are not a claim that ordinary modules cannot affect the page.
No cross-context source-proof reuse is proposed: each admission has an actual new
critical/config/root check. Verification includes `normal_page_sha256` and
`source_proof:{observed_at,expires_at,root_sha256,normalized_root_sha256,
normalized_csp_sha256,critical_hashes:[{path,sha256}],config_sha256}`; earliest read starts <=5min
lifetime, clipped by original scope/authority/plan/window expiry. Enough remaining lifetime
for100s completion is required. Never date a proof from its later save or copy.
**Root nonce exception, not root byte equality.** The retained source shows only
`/html/head/script[1]/@nonce` and `[2]/@nonce`, on the two external module scripts.
Both are identical canonical base64 encodings of18 bytes in that response. Fixed code
may replace only those two attribute **value byte ranges** with ASCII `AIRLOCK_NONCE`
for a separate comparison digest. A bounded lexical parser must validate exact head
script positions/src/type, double-quoted unique nonce attributes and canonical encoding;
reject extra/missing/duplicate/inline scripts, nonce sites or ambiguous markup.
Require the same nonce in the actual root's single `script-src` CSP nonce token;
replace only that token's nonce value for the separate CSP digest. Reject nonce tokens
elsewhere or multiple CSP headers; all other CSP bytes/directives stay exact, including
the existing strict-dynamic/object/base/Trusted Types checks. The exact CSP nonce location is now grounded by the parent's original public HTTPS
root/CSP receipt; qualification must bind those original bytes, not invented fields.
Preserve raw root body/CSP privately and both raw/normalized hashes. Every other body
byte, identifier, attribute, URL and field remains exact; no DOM reserialization,
whitespace cleanup, wildcard stripping or mutable hash called an original-byte match.
Fragments require raw byte equality and have no normalization exception.
**Native observation and dispatch.** Attach observer and gate before navigation, equal
in both arms, with existing cache/service-worker/prerender restrictions. Gate every GET
against the literal map (root query case-bound; config stock-only), then durable page reservation
and `Fetch.continueRequest({requestId})` only. No fulfillment/forwarding/new fetch or
page-script injection beyond existing equal measurements/assigned consent.
Observer pairs the actual native Request/Response with that reservation, obtains
`Response.body()` once, and hashes/saves its Buffer unchanged. These are original
browser response-body bytes after HTTP transfer/content decoding, not compressed wire
octets. Never text-decode fonts/images; UTF8 decode only validated HTML/JS/JSON as needed.
Record failed/pending/body-read/overflow/cache/redirect/mismatched-media evidence explicitly.
Before each Adobe continuation, wait <=10s for root/current config and every critical or
ordinary executable GET already admitted to have matching body proof; expiry/failed proof
stops dispatch. This is not a response-stage rewrite or claim to prevent script execution.
Final oracle requires **all** admitted normal GETs paired/proved and required entries loaded.
Check independently connected normal main/columns/cards/highlight section, nonempty
header/footer, visible images successfully decoded and existing slot/render/click evidence;
do not hide/remove normal content or claim transformed DOM equals original HTML bytes.
Case gains `normal_page:Ref`; checker's loaded capture gains `normal_page`.
Closed capture: `{kind:"airlock.adobe-stock.normal-capture",schema_version:1,case_ordinal,
inventory_sha256,source_proof:Ref,records,unused,overhead,errors}`.
Records are `{ordinal,target,request_at,response_at,status,content_type,body:Ref|null,
bytes,sha256:string|null,csp:string|null,normalized_sha256:string|null,
normalized_csp_sha256:string|null,result}`; result `proved|failed|missing|incomplete`.
Status is HTTP integer|null (proved200); response time/media may be null only on failure,
bytes0..1MiB; source_proof Ref binds the actual Verification. Refs use fixed case/ordinal paths.
Unused is 1-based entry ordinals; records have 1-based admission ordinals, fixed errors.
Overhead is finite nonnegative `{callbacks,body_read_ms,hash_ms,
gate_wait_ms,drain_ms}` (wall times, not invented CPU cost). Record it in both arms and
retain treatment-dependent work/noise. Existing report checks/reasons/claims stay fixed;
missing proof is unverified, wrong proof failed, never baseline pass.
CLI binds original body/verification Refs before pure checking; derived data cannot
authenticate a producer. State gains closed
`page_requests:{count,bytes,cases:[{ordinal,reserved,received_bytes}]}`; counts are durable
before native continue, ordinal/target pairing preserved in captures. Missing records fail;
partial requests remain spent after failure/restart, never resumed or refunded.
**Bounds/cost, before effects.** Native normal GETs <=96/context, <=2/entry (root/config1),
<=1MiB/body, <=8MiB/context and <=64MiB/baseline; body reads <=8 concurrent, queue<=96,
read10s/drain5s. Fixed private binary partitions use owner-only files and original hashes;
manifest <=256KiB, no reader-limit increase. Browser/body API allocation is not physically
capped; accepted overflow fails and late reads cannot save after sealed finalization.
Normal native loads are not operator metadata calls: record their distinct counts/bytes;
moving a prefetch into page code/another context is forbidden. Adobe64/16 contexts,
metadata512/32MiB, cleanup32/8MiB, trace/windows and no replacement/warmup stay unchanged.
Metadata admin responses are additionally capped64KiB, OAuth16KiB, root256KiB, config64KiB;
critical bodies are capped at their original pinned sizes (each still <=1MiB).
Let S=7, B=sum original critical byte sizes, Q/Qb=qualification spent requests/bytes,
I=1 if initially approved else0. Successful request minimum:
controls `5S+63+3I`, active `17S+150`, baseline `Q+22S+213+3I`;
normal enable propagation adds at most24 config polls total. There are22 critical sets,
24 root bodies (two are preflight),22 config bodies,8 OAuth calls and159 other admin calls.
Accepted-byte upper bound is `Qb+22B+24*262144+46*65536+8*16384+(159+3I)*65536`.
Request upper = minimum+24. Cost retains old keys (inventory_resources = normal entries), adding
`critical_resources,qualification_requests,qualification_bytes,propagation_request_slots,
baseline_metadata_requests_upper_bound,baseline_metadata_bytes_upper_bound,active_metadata_bytes_upper_bound`.
Freeze derived values; reject request upper bound >512 or byte upper bound >32MiB before
effects. Active requires actual spent plus `17S+162` requests and
`17B+18*262144+29*65536+4*16384+111*65536` bytes, not Q again or a fresh pool.
Actual dispatch/read/poll/failure bytes are journaled; exhaustion stops, retries only declared config polls.
Candidate S7 gives367/370 reads before Q versus807/810 with N27; Q43+24 polls gives434/437.
B245708 leaves Qb<=8291448/8094840 bytes (saved/approved); actual Qb/map remain to validate.
**Required witnesses before implementation/live review.** Freeze schemas and red tests
for exact CMS queries/closure, binary invalid-UTF8 fidelity, raw nonce retention and
only-two-sites/CSP consistency, extra identifiers/fields/scripts, changed fragment/media,
missing bodies/required loads, redirects/cache/duplicates, early Adobe gate and expiry.
Use one real loopback receiving page with original JS/CSS/WOFF2/image/fragment responses
and native requests to prove observer/gate pairing, no extra HTTP/SDK sends and equal arms.
Test cost enumeration against actual instrumented prepare/verify/run/stop paths, Q import
once, byte upper bound, active spent ledger, caps/overflow/late writes and overhead/nulls.
Source gap: `scripts/aem.js:29–37,119–149,193–200` randomly selects RUM and can attempt
a same-origin beacon; current policy forbids it. Do not suppress sampling, add query/init
overrides, grant telemetry or replace a failed context. Its actual branch remains blocked/
explicit failure; any desire to allow or alter it is an owner decision, not this refinement.
Parent closes original fragment/media/CSP receipts/closure; fresh frame and subsequent
reviews remain required. No new owner decision for this refusal-preserving model; no live baseline claimed.

**Original-source dependency correction — 2026-10-13:** Actual66-entry original-file
planning initially refused because a text regex mistook an Alloy string for an import
and required `consented.js`, which all assigned consent-decline pages leave unloaded.
Five witnessed red assertions covered the exact consent-driver source, strings/comments,
unknown dynamic edges and invalid syntax. The operator now uses the already-declared
ESLint parser for actual import/export syntax; no new dependency or SDK execution.
Source inline lint directives are not executed as parser configuration.
Unsupported executable import expressions remain refused. Two precise pinned exceptions
are source-qualified: the unchanged `scripts/consent-check.js` SHA-256
`ac21f825288cfc82c52a6acd9c57bbb76a2017ee1b06319d493244f32751249a` leaves its literal
`./consented.js` unloaded for every assigned `consent=decline` navigation; the unchanged
`scripts/aem.js` SHA-256
`786e8019b14b4c0bee9df38a3162f129c04310d9d00e7a6dd326c7e5830c84ae` has one actual
dynamic block-import template whose concrete JS/CSS names are derived from original
markup. A changed producer cannot inherit these exceptions. No granted-only martech
module is added to the inventory or force-loaded. Actual native-proof R2 offline
planning now returns `planned` with the real receipts/current resource readback,
not traffic permission or full closure against arbitrary code.

**Native-resource craft recovery — 2026-10-13:** Four new red assertions reproduced
HTTP302/500 roots with otherwise valid CSP being accepted by the header-only stop
path, and executed observation counts/metrics being erased when cleanup was unknown
or failed. Stop now requires an actual200/nonredirect/expected media response before
returning its header-only proof; independent Target inverse remains attempted.
Observation keeps its accumulated case results, spending and available pair measurements
while applying exit4 cleanup precedence and leaving baseline claims false.
Hermetic two-stage fixtures prove retention, not vendor execution.

**Native-resource recovery independence — 2026-10-13:** Three new red assertions
showed missing/changed retained page bodies or later local source drift preventing
controller creation and therefore suppressing Target recovery. Restore now derives
traffic-only page metadata from its already hash-bound, independently reviewed plan,
not from loading every CMS body or re-proving the traffic source closure. Input,
approval, code, journal and ownership checks remain; current Site stop proof and
current Target compare/inverse remain independent. This is not a traffic fallback:
prepare/verify/run still require actual original bodies and full source closure.
Later ordinary-source drift yields Site unknown while the applicable Target inverse
is still attempted. Missing historical page bytes do not themselves disprove a fresh
disabled config/CSP stop. No missing evidence is reclassified as live qualification.
Three further red regressions covered raw missing-file errors and missing/malformed
current config. Only those concrete Site-snapshot error categories are isolated;
the journal records reference drift/Site unknown, and current Target recovery still
read/compares ownership. Authority, code, approval and journal errors remain blocking,
not hidden by the Site fallback.

**Execution-host Git transport correction — 2026-10-14:** The first exact approved
controls preparation refused `reference_drift` before controller creation, token
issuance or effects. Actual clean local/remote/journal heads and source/config bytes
matched; the host's existing Git rewrite expands the stored canonical HTTPS origin
to `git@github.com:<same-owner>/<same-repository>.git`. A witnessed regression now
qualifies only that exact same-GitHub transport equivalence. Both stored
`remote.origin.url` and effective URL are checked: stored HTTPS must be exact, and
effective transport is only that HTTPS URL or exact GitHub/git SSH spelling.
Foreign hosts/repositories, ports/aliases and arbitrary rewrites remain refused.
No Git settings, credentials, ref, resource selector or protocol payload is changed.
The old control start boundary is not extended; that unexecuted plan remains preserved,
and any new stage requires fresh code/input/plan bindings and exact operational review.
Review additionally caught fetch-versus-push routing: three red regressions showed
foreign, additional and duplicated effective push destinations passing a fetch-only
check. Both effective fetch and push URL lists must now contain exactly one approved
repository spelling, with the stored canonical HTTPS origin unchanged. This check
also runs immediately before each normal/recovery push. No `pushurl`/`pushInsteadOf`
configuration can silently publish elsewhere; actual unknown outcomes still use the
recorded compare-controlled recovery path, not an enabled push replay.

**Actual R4 preparation and date-precision correction — 2026-10-14:** The exact
reviewed R4 preparation set the owned activity SAVED, then refused schedule readback:
Target returned whole-second UTC strings while the plan had fractional milliseconds.
The journal retains the unknown schedule result and verified inverse. Independent
Site/Target stop completed: public code stayed disabled, activity is SAVED, prior
dates were restored and all other preserved owner fields matched. Actual spending is
64 normal metadata requests (including the43 qualification reads), six cleanup requests,
zero browser contexts and zero SDK dispatches. This is not a live negative-control pass.

Two witnessed red assertions grounded the fix: planned start/end are rounded upward
to whole-second instants without shortening the five-minute future preparation lead;
readback compares that exact instant while accepting only UTC seconds or `.000Z`.
A third red assertion refuses unknown submillisecond formatting that JavaScript Date
would otherwise truncate. State and every non-date preserved owner field remain exact;
no arbitrary precision/offset normalization or unknown-write success is allowed.
The failed stage/history/spending remains preserved. A preparation-only retry decision
was requested because no traffic case had started; the owner was unavailable, so no
failed stage or budget is silently reset and no retry/SDK traffic is inferred.

### Reviewed preparation-only reentry refinement — 2026-10-14

One safely recovered preparation attempt may reenter before any traffic, without
refunding spending or replacing a sample. The original failed attempt stays immutable.
This corrects the author's broader failed-stage lockout; it is not an AC waiver.

Independent scope/frame review found the **existing original execution grant sufficient**:
the Task delegates ordinary framing/proceed choices and planned owned Target state/date
changes. The recorded "set it to inactive; change dates as needed" permission survives.
Neither automated reminders, owner unavailability nor this reviewer provide a new grant.
The earlier retry question/history above is retained; reentry becomes applicable only
after this exact exception receives frame/code/operational reviews.

**Closed input and state additions, before implementation:**
- Optional Input `preparation_reentry` is exactly
  `{state:Ref,prior_input:Ref,prior_plan:Ref,prior_approval:Ref}`. These are owner-only
  immutable JSON snapshots, never executable paths or booleans asserting safety.
- State gains optional `preparation_history`, an array of exactly those four-Ref
  records. Absence/empty means no reentry; at most one record is permitted.
  Historical states/plans retain their schemas and original bytes.
- New Plan gains `preparation_attempt:0|1`; missing on historical plans means0.
  `source_hashes` gains optional `prior_preparation:H`, the canonical hash of the
  validated four-Ref input, present only for attempt1.

**Eligibility is derived, not caller-attested.** Only `plan --stage controls` may
accept reentry. Acquire the existing exclusive lock before rereading current state;
an unresolved lock/writer refuses, with no stale-PID or force unlock.
Load/hash/validate all four snapshots and compare the retained state **exactly** with
the current canonical state before changing any journal pointer. Require:
- Current controls status `failed`, active `unstarted`, no earlier preparation_history;
  all prior Site/activity/schedule cleanup verified, no pending/unrecognized recovery.
- Entire baseline has zero `contexts_spent`, Adobe `reservations`, and page requests/
  received bytes/case counters. Any attempted launch, admitted normal GET or SDK
  dispatch excludes this exception, even when that request later failed.
- Prior input hash equals the failed state's input hash; prior plan and approval hashes
  equal its recorded control plan/approval hashes. Original failure/effects and unknown
  schedule readback remain in the retained state, not rewritten as a pristine attempt.
- New baseline ID, authority, preflight/routing/workspace Refs, SDK pins and reference
  selectors/source inventory match the prior input exactly. Only current resource Ref,
  reviewed code pins and this reentry record may differ.
- Current resource snapshot is genuinely fresh and SAVED, with the prior restored dates
  and preserved owner fields matching the failed state's verified current resource.
  Current reference is clean and config actually disabled. Live prepare rereads these
  resources/deployed bytes before any write; offline `planned` is not live verification.

**Audited transition:** Retain the four snapshots and append them to preparation_history.
Carry all existing normal/cleanup request and byte counters and qualification spending
forward verbatim; do not call initialState or import Q again. The new control attempt
gets a fresh unstarted current slot and fresh plan binding, while the prior failed slot
and its complete effects/reviews/code/input remain accessible through history.
No SDK/context/page budget is added or transferred. Reject before writes if actual spent
normal requests/bytes plus the new controls and still-required active upper bounds
cannot fit512/32MiB, or remaining32/8MiB cleanup cannot cover the reviewed stop.

Persist plan/history/current-state replacements through the same bounded, tracked,
replacement-gated writer under the held lock. Preserve the previous canonical plan
against its supplied Ref before replacing it; any mismatch/foreign edit refuses.
If persistence is unresolved, finalization seals admission and retains ownership,
not a success-shaped empty journal. Reentry is one explicit reviewed operation, not
an automatic loop, old-operation replay, `--force`/`--retry` flag or fresh allowance.
Preparation itself still requires the new exact five-review approval; all twelve actual
READY checks, source/resource freshness and deployed proof precede any traffic.

**Required red/green witnesses:** exact prior-state/input/plan/approval bindings; carry
64 normal/six cleanup counters and bytes without reimporting Q; preserve failed history;
deny any context/reservation/page activity, unknown cleanup, foreign fields/scopes,
active state, second reentry, stale source and insufficient remaining budgets;
quarantine parked plan/history/state writes and refuse ownership conflicts.
Verify a real receiving-sink failure sample cannot use this exception. Actual R4 raw
snapshots are not rewritten or labeled synthetic. Fresh independent reviews are required
before application; no full slice, SDK/chamber or release success follows.

**Implementation red witness — 2026-10-14:** Official helper transitioned
READY_FOR_IMPLEMENTATION → IN_PROGRESS before tests/code. Focused pure/operator
`ZERO-TRAFFIC` selection witnessed 44 behavioral failures, seven passes (214 existing
tests skipped), before production changes. Failures include absent attempt0, refused
eligible carry-forward, incorrect budget refusal, and lack of locked/parked replacement
behavior; these are actual assertions against the existing operator, not missing imports.
All R4-shaped test records and SDK-byte stand-ins are synthetic. Parent's actual R4
state was inspected read-only for counter/effect shapes; no record or reference changed.

**Implementation green witness — 2026-10-14:** The fixed operator now validates
the four original-byte Ref bindings and exact current failed state under its existing
exclusive lock, preserves the old canonical plan against its snapshot hash, and
replaces only the audited current controls slot. History retains the failed raw
state/input/plan/approval, including unknown schedule readback and verified inverse.
The synthetic R4-shaped witness carries exactly64/1341399 normal and6/4745 cleanup
requests/bytes, without reimporting Q. Actual prior normal spending beyond Q and the
remaining independent worst stop are charged before any replacement.

The62 new pure/operator tests pass: one-attempt, scope/current-resource/expiry/budget
refusals; failed-launch/context/SDK/page admission lockouts; genuine new approval
requirements; historical missing attempt0; committed-history ordinary active
continuation; and snapshot/history/current-plan tampering. Parked plan/history-state
fsync and native state rename retain sealed ownership after bounded5s work plus5s
drain. Foreign nonce/state replacement and multi-file partial success refuse; no
atomic transaction is claimed. A real Chromium loopback receiving-sink source
failure is admitted/spent and cannot use preparation reentry; it uses no SDK.

Unified stock/preflight/workspace/frozen-contract/private-input selection passes
**1325/1325 tests,13 suites** (the1263 parent cases plus62 new cases). The first
unified run had one stale closed-Plan key assertion omitting the required new field;
that assertion was aligned and the same unified selection rerun green. Normal
`npm run lint`, explicit recommended lint on the ignored operator/browser helper and
both changed tests (zero findings), syntax and whitespace checks pass.
Browser helper, ordinary SDK/date/Git/source/media proof and all caps remain unchanged.
This is hermetic feature verification, not independent review or actual reentry.
Actual R4 records/reference/config and genuine owner expiry remain untouched.
Fresh code/operational reviews, actual preparation/deployed proof and all live ACs
remain pending; lifecycle stays IN_PROGRESS and no DoD/review/live boxes are ticked.

**Compliance correction red witness — 2026-10-14:** Same-task review found two
blockers: reentry feasibility omitted the existing cumulative Site1MiB branch cap,
and history/state replacement did not rebind the newly written canonical controls
plan after inter-file foreign edits. Before production fixes, twelve new pure/CLI
tests witnessed seven behavioral failures/five passes. Boundary cases include prior
cleanup bytes196607/196608/196609,300000, global8MiB boundary and unchanged request
caps; a separate parked history/state fsync test replaces only the new plan, not the
existing canonical-state conflict witness. Actual R4/R5 records were not accessed.

**Compliance correction green witness — 2026-10-14:** Feasibility now charges the
unchanged cumulative Site1MiB reserved-Target branch as well as the global8MiB
cleanup allowance. Prior bytes plus13 × 65536 must be strictly below1MiB, because
the subsequent header-only root admission still checks `<` that cap:196607 fits,
196608/196609/300000 refuse. Site25/global32 count boundaries and global byte
boundary refusals are tested without refunds or cap changes.

History/state's bounded replacement gate now re-reads the expected newly persisted
controls-plan Ref/hash after nonce and original-state comparisons. A foreign plan
edit while state.temp fsync is parked refuses before state replacement, preserves
the old failed journal and foreign plan, and refuses subsequent reentry. The
separate pre-existing state-conflict test remains intact; tracked5s writers/seals/
drain/ownership behavior and nontransactional partial-success lockout remain green.

All twelve correction tests pass; focused reentry selection is74/74, and the same
unified13-suite regression selection passes **1337/1337**, retaining all1325 prior
cases. Normal lint, explicit recommended ignored-probe/test lint (zero findings),
syntax and whitespace pass. README clarifies the original explicit state/date
grant plus fresh independent reviews/current gates, not a new owner grant.
No actual private record/reference/API/credential/SDK operation or commit occurred.
Fresh independent review and exact operational/live gates remain pending; status
stays IN_PROGRESS and no review/DoD/live acceptance box is ticked.

**Craft continuation red witness — 2026-10-14:** A synthetic operator RUN failed
after Site enable but before any context admission; independent disable and date
inverse completed. Its changed disabled window/config and reference head allowed
reentry planning, but fresh prepare refused `reference_drift` after emptyStage lost
the consulted Site lineage. Six new operation-chain/drift tests witnessed one
behavioral failure/five passes before code. They retain real operator sequencing
with mocked fixed Git/metadata and synthetic SDK/source stand-ins, not actual SDK
execution. Actual R4 input/state/reference/API were not accessed or changed.

**Craft continuation green witness — 2026-10-14:** `referenceSnapshot` now
consults Site effects from the validated, hash-bound historical state as well as
current-stage effects when comparing owned config/head and known Git recovery
lineage. The same four-Ref/history/input/scope/spending checks apply on every
consultation. Historical effects stay read-only: they are not imported into the
fresh slot, relabeled by recovery or used to replay an old operation. Foreign
window/control/source/head changes and history tampering still refuse before
network/write effects and retain the foreign bytes.

The positive synthetic chain executes old plan/prepare/verify, RUN failure after
owned enable but before context admission, verified disable/date inverse, then
reentry plan and a fresh synthetic five-review approval for prepare/verify. It verifies the retained
changed disabled config's **original byte hash** and head, new-only schedule
operations, exact carried counters/Q, and empty old Site effects in the fresh slot.
Current-attempt restore inspect/apply uses only the new date inverse and performs
no new Git commit/push or old-config replay. All four immutable snapshots retain
their exact bytes; no browser/SDK case is invoked in this chain.

Six craft regressions pass, focused reentry selection **80/80**, and the unified
stock/preflight/workspace/frozen-contract/private-input selection **1343/1343,
13 suites**, retaining all1337 previous cases. Normal lint, explicit recommended
ignored-probe/test lint (zero findings), syntax and whitespace pass. Browser helper,
caps, state/history schemas, single-reentry limit, locks/seals and ordinary SDK/date/
source proof remain unchanged. No actual input/state/reference/API edit or commit;
independent craft and other fresh review/live gates remain pending. IN_PROGRESS,
no acceptance/review/DoD box ticked.

### Unstarted-plan timing refinement — 2026-10-14

Actual R6 planning applied the reviewed four-Ref history transition, retained
64 normal requests/1341399 bytes and six cleanup requests/4745 bytes, and created
an unstarted controls plan. No preparation/API mutation/context/page/SDK admission
occurred. Exact operational review refused a mistakenly requested five-minute
write-time lead; the actual normative lead is five minutes after **planning**.
The fixed start02:46:28Z was missed without execution. Do not extend that plan,
pretend the refusal passed, erase history, or manually reset state.

One explicit CLI `plan --stage controls` replacement of that **unstarted,
unapproved, effect-free** audited controls plan is permitted. This is not a
second failed-preparation reentry or failed-case replacement. The optional Input
`unstarted_replan` is exactly `{state:Ref,input:Ref,plan:Ref}` pointing to original
immutable bytes for the current unstarted attempt, not the historical failed R4.
State gains optional `unstarted_plan_history`, at most one such three-Ref record;
Plan source hashes gain optional `unstarted_plan:H`, the fingerprint of those Refs.
No CLI flag, arbitrary lead, transport or retry loop is added.

Eligibility is closed: exactly one already validated preparation_history matching
the same four Refs; current state byte-equals the new state snapshot; current
input/controls-plan hashes equal the new snapshots and recorded bindings; current
controls is unstarted with approval/preflight/verification null and cases/effects
empty; active unstarted/effect-free; zero-ever contexts/reservations/page requests/
bytes/case counters; all cleanup dispositions verified/not_needed; no earlier
unstarted_plan_history. Historical R4 still must pass its existing audit. The new
input differs from the prior current input only in fresh resources/code pins and
the new three-Ref field. Authority/source lease, reference/SDK/preflight/routing/
workspace/original byte proof and four historical Refs remain identical.

Acquire the existing exclusive lock, reread and validate all original Refs/current
resources/reference/spending, preserve original counters/Q and four-Ref history,
and retain the three-Ref retired plan in history before replacing the current
unstarted slot. New plan has the fixed15min planning lead and its own input/code/
source hashes; actual prepare/verify must finish before its fixed start. It needs
five freshly bound genuine review sources including exact operational review.
Do not import an old approval or carry an old verification.

Use existing bounded/sealed writes and nonce checks; recheck expected old state/
plan before replacements and expected new plan before state commit, including
after parked sync. Multi-file persistence is fail-closed, not atomic. Foreign
edits/unknown writes/partial transition refuse without cleanup replay; preserve
unknown journals/lock. No tracked reference/API/browser effect occurs while
planning. Subsequent operations audit both histories, use only current-attempt
effects, and refuse a second unstarted replacement or any replacement after
approval/effect/context/admission. No counter, cleanup capacity or owner time is
refunded or renewed.

Required red→green witnesses: exact R6-shape replacement retains all prior bytes,
spending and four-Ref history once; new fixed lead meets the threshold; approval/
prepared/verified/running/failed/case/effect/any-ever-traffic/foreign bindings/
second replacement refuse without overwrite; changed snapshot/history/input/
plan/resource/reference/pins refuse; parked foreign plan/state edits and unknown
native writes retain ownership; synthetic fresh approval→prepare→verify→restore
works through both histories without replaying old Site effects. Existing1343
cases and code/craft/architecture/frame gates remain required. This refinement
received exact frame PASS and the official READY_FOR_IMPLEMENTATION handback,
not actual preparation acceptance.

**Timing refinement red witness — 2026-10-14:** Verified READY_FOR_IMPLEMENTATION
and transitioned through the official helper to IN_PROGRESS before tests/code.
The focused `UNSTARTED` pure/operator selection witnessed35 failures/14 passes
before production edits: fixed lead, closed three-Ref shape, exact R6-shaped
carry-forward, eligibility/binding/budget refusals, parked CAS/native writers,
partial persistence and both-history operation audits. Tests are synthetic;
actual R6's missed02:46:28Z start and operational refusal remain history, not
permission, and no actual record/reference/API was accessed.

**Timing refinement green witness — 2026-10-14:** The operator now closes the
three-Ref input/state/source-hash additions, admits only the exact eligible
unstarted/unapproved/effect-free controls slot after one validated four-Ref history,
and records its immutable retirement once. Current state must match snapshot bytes;
current input/plan and both historical bindings are rechecked under nonce ownership.
The shared bounded writer rechecks old state/plan after sync and expected new plan
before state commit. All counters/Q, prior raw records and both histories survive;
partial success, foreign CAS edits and unresolved native work remain fail-closed.

All new plans use15-minute planning lead/45-minute serving/5-minute cleanup, inside
unchanged authority/source expiry and24-hour observation-age limits. A supplemental
red compatibility test corrected empty preparation-history handling in the shared
transition; four red expiry assertions caught longer-window lease/age gaps. No
source expiry is renewed. Current-attempt prepare/verify/restore and ordinary active
planning/prepare/verify audit both histories and consult old Site lineage read-only.
The synthetic one-minute-before-start prepare/verify succeeds without inventing a
five-minute-after-PUT requirement; old approvals/verification and replacements
after approval/effects/admission/failure remain refused.

**56 added tests pass**, focused timing/reentry selection136/136; unified
stock/preflight/workspace/frozen-contract/private-input selection **1399/1399,
13 suites**, retaining all1343 parent cases. The first full run had one legacy
freshness fixture expecting planning to accept only200 seconds of observation
age allowance. Its negative post-propagation test now starts with a valid longer-
window source and explicitly expires the installed wall clock during propagation;
the guard was not relaxed, and the same full selection reran green.
Normal lint, explicit recommended ignored-probe/test lint (zero findings), syntax
and whitespace pass. No actual R4/R6 input/state/reference/API/SDK/credential access,
commit or SDK-case replacement occurred. Current code/operational and full live
acceptance remain pending; lifecycle IN_PROGRESS, no DoD/review box ticked.

**Timing completion compliance red — 2026-10-14:** Twelve new regressions
witnessed11 failures/one pass before production changes. The original preflight
approval lease was omitted from full-window feasibility. Async reference/served/
intent/report/artifact/final-journal waits could cross the fixed start: prepare
could still write its normal schedule after that crossing, or prepare/verify
could persist success and return0. Clock-crossing and parked-native-persistence
tests are synthetic and leave actual records/reference/API untouched.

**Timing completion compliance green — 2026-10-14:** Full-window feasibility
now also requires the original `preflight.approval.expires_at` strictly after the
serving/cleanup deadline. Prepare/verify check completion-before-start after awaited
reference, served-byte, readiness, artifact and final-journal persistence. Verify
artifact replacement is time-gated; preparation's existing scoped checks also
cover Target intent and durable request reservation before dispatch. An additional
red reservation test caught the nested save→PUT gap before that scope correction.
No five-minute write-time lead or new runtime option follows.

Missed completion retains spent requests/intent and fails, with independent
cleanup of only current-attempt effects; both histories retain exact bytes.
Unresolved native verification fsync still returns4 and keeps sealed ownership,
not a late writer after lock handoff. All13 new regressions pass, focused combined
selection149/149, and unified13-suite stock/preflight/workspace/frozen-contract/
private-input selection **1412/1412**, retaining all1399 previous cases. Normal
lint, explicit recommended ignored-probe/test lint (zero findings), syntax and
whitespace pass. No actual private records/reference/API/SDK effects or commits;
fresh scoped compliance and other code/operational/live gates remain pending.
IN_PROGRESS, no review/DoD/acceptance boxes ticked.

**R7 fallout red witness — 2026-10-14:** Parent reports actual R7 preparation/
verification passed, then its first no-consent context failed after six normal GETs,
zero SDK reservations and19 denials; independent stop verified all three branches.
The context/capture/body/network/17 trace parts remain spent and preserved. A
network-blocked loopback replay strongly implicates the unlisted root favicon,
but the original live first-denial URL was not retained: no direct-live favicon
URL observation is claimed. Owner unavailability on a17th-context request is not
permission, and no new live attempt/reset/retry/cap follows.

Offline synthetic tests reproduce original66062-byte typed favicon refusal and
lost immediate RUN spending/case/denial summaries. Native loopback additionally
exposes Playwright's absent favicon Request event despite a CDP network identity;
the existing Page-only proof wait refuses it. Unknown-persistence tests exercise
the writer lock, not actual R7 records. Red behavior precedes source changes.

**R7 fallout green witness — 2026-10-14:** The exact root Git `favicon.ico`
is now accepted only with original hash/66062-byte body, successful matching
qualification receipt and `image/vnd.microsoft.icon`. Conditional both-arm
inventory/AST closure adds only this implicit dependency. No alternate `.ico`,
path/query/origin, missing/404/type/hash/size fallback, root/vendor/CSP rewrite,
critical-read expansion or cap/schema change follows.

Native receiving-sink tests reproduced Playwright's absent favicon Request event
with an actual CDP network identity. The tightly coupled browser helper now reads
only that exact admitted favicon's native CDP response/loading/body bytes through
the existing media/hash/cache/redirect/byte-budget/sealing pipeline. Both arms
prove the original binary; native wrong hash/size/media/404 fail, and foreign/
unlisted requests still stop the gate. This is loopback evidence, not the missing
original live first-denial URL.

Failed RUN now summarizes known terminal intent/capture evidence after admission
and writers are sealed. It retains spent contexts/reservations, case failure/
denials, proved controls/pairings and applicable observe metrics/failed pairs.
Spent-without-capture is unverified, not not-executed. Missing parts stay explicit
without erasing other proved cases or presenting unknown wire as proved zero.
Original errors and cleanup-unknown exit4/retained lock remain; no success claim.

Initial behavioral reds reproduced favicon/summary loss and native Page-only
proof refusal; a supplemental red caught partial active evidence erasing controls.
All27 new regressions pass. Complete unified13-suite selection **1439/1439**
retains all1412 prior cases; an initially mistyped selection ran only nine suites
and was corrected/rerun in full. Normal lint, explicit recommended operator/
browser-helper/test lint (zero findings), syntax and whitespace pass.
All actual R7 records/qualification/failed trace, reference, credentials/API/SDK
and commits remain untouched. Source changes stale R7 approval only for new
operations. No retry/reset/extra context or unavailable-owner permission;
IN_PROGRESS, fresh reviews/owner-bound live decision/full ACs remain pending.

**R7 scoped compliance red — 2026-10-14:** Twenty actual-adapter/partial-evidence
regressions witnessed15 failures/five passes before source edits. Installed CDP
method instrumentation exposed permissive base64/encoding/surrogate conversion,
not a substitute adapter. Missing/corrupt active plans and invalid capture binding
erased independent control summaries; missing normal manifest/body mislabeled an
otherwise passed capture failed. Binary/BOM preservation and actual failed-capture
controls remain tested. No actual records/effects/extra context were accessed.

**R7 scoped compliance green — 2026-10-14:** The actual favicon CDP adapter
now accepts only string body/boolean encoding, canonical base64 round-trip or
lossless UTF-8 round-trip with BOM preservation and surrogate rejection. Raw
binary original bytes remain hash/size/media-qualified; no extra URI/fallback.
Stage-plan read/hash/schema failures and per-case capture binding errors are
isolated with explicit reasons and unverified affected cases, preserving
independent controls/pairings and eligible remaining-case metrics.

Missing normal manifest/body now stays unverified/missing_evidence like missing
network proof. A bound explicit failed capture (including R7) and observed
deployment mismatch remain failed. The first full run caught one legacy observed-
mismatch classification regression; that distinction was restored, its five
legacy sensitivity cases pass, and the complete selection was rerun green.
No error is hidden, no baseline claim is promoted, and cleanup-unknown exit4
and original RUN reasons retain precedence.

All20 new regressions pass after15 behavioral reds/five passes. Complete unified
stock/preflight/workspace/frozen-contract/private-input selection **1459/1459,
13 suites**, retains all1439 prior tests (missing-proof expectations aligned to
the required distinction, not deleted). Normal/explicit recommended lint (zero
findings), syntax and whitespace pass. Actual records/reference/credentials/
API/SDK/authorization/lease/caps and commits remain untouched. No17th context,
retry or permission from owner unavailability. IN_PROGRESS; fresh scoped
compliance/craft/architecture/operational and full live acceptance remain pending.

**Convergent summary corruption red — 2026-10-14:** Two structural tests
witnessed two failures before source changes. A hash-bound case with incorrect
`plan_sha256` was mislabeled failed rather than binding-refused/unverified;
`metrics:{}` crashed failed-pair processing and erased partial summaries.
Each test mutates the actual retained synthetic case bytes/hash across binding,
schema, ordinal/evidence and metric key/value/unit/status variants, retaining
the other15 known cases/metrics. Actual records, authority, leases/caps and
ungranted17th-context status are unchanged.

**Convergent summary corruption green — 2026-10-14:** Summary verifies the
original case-plan byte hash before trusting result or denial evidence. Checker
schema/binding/source refusals stay unverified, not observed failures. The exact
existing metric validator is shared with the checker before summary accumulation;
invalid/refused metric evidence is excluded. Aggregate and pair accesses guard
missing keys, with null deltas for failed pairs rather than an outside-catch crash.
The same summary accumulation/pairing paths were swept; no duplicate metric
schema or new abstraction/public shape was added.

Both structural tests pass across incorrect/invalid plan hash, forged failed-
wrong-plan result, ordinal/schema/evidence/checker refusals, and empty/missing/
bad-value/unit/null/array/status metric variants. Every mutation retains the
other15 known cases/counts/eligible metrics; a correctly bound failed capture
and observed deployment mismatch remain failed. Original RUN reasons,
cleanup-unknown exit4, spending and native ownership behavior are unchanged.

Complete unified13-suite selection **1461/1461** retains all1459 prior tests;
normal lint, explicit recommended lint (zero findings), syntax and whitespace
pass. No actual records/roles/effects/API/SDK/reference/lease/caps/retry/state/
authorization or commits changed. No17th-context permission. IN_PROGRESS,
fresh scoped compliance/craft/architecture/operational and full live ACs pending.

### Owner-approved single control continuation — 2026-10-14

At16:07:14.318Z the owner explicitly approved the requested single additional
browser context: **seventeen total**, original failed attempt and all spending
retained, every other budget/safety limit unchanged. The actual statement was
"Sure, I approve raising the limit as required." The original grant remains the
authority for ordinary owned fixture/date/config work. This dated exception
supersedes only the historical exactly16/no-same-case-retry rule for the one
corrected no-consent control; it grants no further retry or context increase.
The original sixteen qualified scenarios, controls, three positives, five pairs,
native notifications, timing and full acceptance requirements are unchanged.

The approval is not an unchanged-setup renewal. The prior setup receipt expires
2026-10-14T16:11:20Z. Parent asked separately and received owner unavailable, not
confirmation. Implementation/framing can proceed offline; new live admission
requires a genuine new setup receipt, fresh source envelopes, actual current
resource/reference/byte proof and new exact operational approval. No historical
source/approval date or evidence is edited or replayed.

**Closed continuation:** Input gains optional `controls_continuation`, exactly
`{state:Ref,prior_input:Ref,prior_plan:Ref,prior_approval:Ref,owner_grant:Ref}`,
and required `setup_confirmation:Ref`/`preparation_spending:Ref` when continuation
is present. The grant
is `kind:"airlock.owner-extra-context-confirmation",schema_version:1,received_at,
owner_statement,request_context,approved_total_contexts:17,additional_contexts:1,
corrected_scenario:"no-consent",prior_failed_sample_retained:true,
spending_refunded:false,other_budgets_or_authority_extended:false,
setup_unchanged_confirmation,source_scope_renewed:false,
live_execution_approved_without_fresh_gates:false`. Require the actual recorded
request context to remain bounded as above; an unsigned fixture alone is not
human permission. Parent retains the genuine message as the grant provenance.
Setup receipt is `kind:"airlock.owner-setup-confirmation",schema_version:1,
received_at,owner_statement,unchanged:true,expires_at`; expiry is at most24h after
receipt. No unavailable/reminder message supplies that record.
Preparation spending is `kind:"airlock.adobe-stock.preparation-spending",
schema_version:1,observed_at,resource_ref:Ref,qualification_ref:Ref,
resource_requests:{count,bytes},qualification_requests:{count,bytes,bytes_upper_bound}`.
It binds fresh input resource/qualification receipts and their incurred counts/
bytes, excluding any credential contents. Current qualification preserves the
original attempts and appends only the favicon's incomplete/received attempts;
historical incomplete bytes may be conservatively upper-bounded and explicitly
marked. Exactly six bounded fresh fixture/authentication reads and two additional
favicon qualification attempts are charged once to the same normal ledger, not
outside it. No further preparation read may be omitted from that ledger; if
necessary reads exceed the closed bound, refuse without replenishing allowances.

State gains optional `controls_history`, maximum one five-Ref record. Plan gains
optional `control_attempt:0|1` (missing historical means0) and optional source hashes
`prior_controls:H`/`setup_confirmation:H`/`preparation_spending:H`.
Preserve the existing four- and three-
Ref histories unchanged. The current failed R7 slot remains accessible by its
original state/input/plan/approval Refs, including all case/normal/network/trace
Refs; historical Site effects are read-only ownership lineage, never imported
or replayed as new effects. Snapshot paths cannot point at replaced artifacts.

Eligible only under exclusive lock and exact reread: current state byte-equals
the supplied snapshot; controls failed with exactly one captured no-consent case,
spent contexts exactly[1], zero Adobe reservations, exactly one page case for
ordinal1, active unstarted/effect-free, all three cleanup dispositions verified,
no controls_history, no unresolved writer/lock, and all old bindings/retained
capture Refs match. Verify that the old case was a bound failed capture, not a
passed or missing/unverified artifact. All counters, bytes, errors and histories
carry exactly; old failed capture remains immutable. Any later failed case,
different scenario, second continuation, foreign edit or unknown stop refuses.

Current input may change only current resource/code Refs, the exact qualified
favicon addition to assets/original-page inventory, explicitly received setup
freshness envelopes, and these new continuation fields. Preserve SDK pins,
baseline ID, fixture selectors, org/environment/property/workspace/routing facts,
reference base/repository, all previous asset/CMS/root originals and old owner
authority scope. Historical inputs audit against their own snapshots; current
source renewal must be bound to the genuine new receipt, not ignored by history
comparison. Validate renewal values with existing preflight/routing/workspace
validators; exact selectors and retained configuration facts remain identical.
If no new receipt exists, refuse current planning rather than timestamp defaults.

Append the five Refs and replace only the fresh current controls slot, through
existing bounded/sealed writes, nonce, old state/plan comparisons and new-plan
hash check after sync. No manual journal/reset/new baseline allowance. New current
slot is unstarted with empty cases/effects/approval/preflight/verification.
Retained qualification Q is charged once; explicitly charge only new favicon
qualification attempts/bytes, including its incomplete read, without refund.
Unknown received-byte totals are bounded conservatively and labelled as upper
bounds, never invented as original-body receipts.

New case roster remains the original16 required scenario slots, except the fresh
no-consent uses **ordinal17, label no-consent-corrected**, independent run ID and
cap1. No-offer stays ordinal2/cap4; active ordinals3-16/caps stay unchanged.
Reports for a continuation show original no-consent failure plus the corrected
case (seventeen entries), preserve all total spending/denials, and never relabel
or overwrite the old attempt. Required-case acceptance uses the corrected control
and ordinals2-16; the explicitly exempted historical failure remains visible but
is not averaged into comparable performance or counted as a passed control.
Ordinary non-continuation reports/rosters remain sixteen entries. A failed or
unverified corrected case stops all normal traffic, with no second attempt.

**Remaining-budget feasibility:** Actual R7 spent normal144/2417789 bytes and
cleanup13/10333 bytes. The old whole-baseline upper bound would require535 normal
requests and34 cleanup requests; do not silently raise512/32MiB or32/8MiB.
Eliminate only redundant seven-critical-file prefetch inside `deploy(true)`:
config/head/CSP deployment proof still precedes case preparation, and the complete
seven critical files/root/config proof is freshly read **before every context**.
Prepare/verify proofs and all native loaded-byte gates remain unchanged. This
avoids one duplicate seven-file read in each controls/active deployment, not a
warmup, cached proof or evidence renewal. Reflect the actual read paths in cost
formulas and enumeration tests before effects.

Continuation normal config propagation admits at most three reads per stage,
including the first, instead of thirteen; independent cleanup admits at most
five config reads plus the header-only root, leaving seven Target stop calls.
With six fresh fixture reads and two new favicon qualification attempts, the
remaining whole-baseline count is144+91+262+6+6+2=511, within512.
Cleanup worst case for successful controls followed by failed active is
13+6+6+7=32; failed controls stop before active. Both byte
ceilings, stricter Site1MiB admission, actual current spending and any later
source-refresh reads must also fit. Normal/cleanup propagation exhaustion is an
explicit mismatch/unknown-stop failure, not fallback/resend or delayed success.
No cap transfer; ordinary non-continuation limits remain unchanged.

Require fresh fixed15min planning lead,45min serving/5min cleanup, strict current
authority/setup/source deadlines, five genuine code/frame/exact operational review
bindings, actual twelve required READY, completion-before-start, and fresh
per-case original native-byte/source proof. Every existing safety/ownership/
transport/independent stop gate remains. No activation during controls.

TDD witnesses must cover bound actual R7-shaped carry-forward, distinct ordinal17/
files/caps, immutable old failure and both histories, genuine-grant/new-setup
requirements, no refund, exact favicon-only source change, changed selector/
scope/config refusal, source expiry, worst count/byte/cleanup boundaries, parked
foreign state/plan/grant/history writes, zero reuse of old operations, and a complete
synthetic controls17/2→active3-16→observation sequence with old failure visible and
full required-case/performance qualification distinct. Ordinary1461 regressions
remain intact. Fresh frame critique and compliance/craft/architecture must pass
before actual continuation; full slice AC/live/reconciliation remain pending.

**Historical review-source closure refinement — 2026-10-14:** Scoped compliance
found historical review/source Refs checked structurally but not read/hash-audited,
and generic non-RUN refusals losing independently proved current controls. These
are implementation gaps, not accepted deviations. Audit all five old review
binding files, their original pass sources and the old resource snapshot against
the old input/approval hashes, without requiring current freshness of old evidence.
The original files may expire; that never renews them or permits changing bytes.

Jig legitimately overwrites the canonical frame-review path at a later framing
pass. Parent's retained R7 code archive contains the exact original frame bytes:
its SHA matches the old R7 review binding even though the current canonical file
now has different bytes. Do not restore the old review over the new canonical
PASS, edit old bindings to point at a different verdict, or accept a hash mismatch.

Input gains optional `historical_review_sources:Ref` only with controls_continuation;
source hashes gain matching optional `historical_reviews:H`. Its closed manifest is
`kind:"airlock.adobe-stock.review-source-snapshots",schema_version:1,
approval:Ref,sources:{frame:{original:Ref,retained:Ref},
compliance:{original:Ref,retained:Ref},craft:{original:Ref,retained:Ref},
arch:{original:Ref,retained:Ref},operational:{original:Ref,retained:Ref}}`.
Approval must equal the immutable prior_approval Ref. Every original must exactly
equal the corresponding old binding's source Ref; each retained sha must equal
its original sha, and original retained bytes must pass private reader/hash/pass
validation at their original reviewed_at. Reject extra/missing/swapped passes,
duplicate retained paths, mutable replaced-artifact paths, source/hash/verdict
changes or missing snapshots. The manifest never supplies an alternative digest.
Without it, require all original source files to match their original hashes.
With it, read retained source bytes; the later canonical file is not old evidence.
Preserve manifest/input/plan hashes through every history and post-sync audit,
including later active/observe/restore calls. Ordinary inputs remain unchanged.

Generic failed operations reuse independently validated old/new observation
summaries after sealing, preserving current passed controls/metrics/pairing plus
the visible old failure. Original operation/stage/refusal/nonzero status, false
success claims and cleanup/lock exit4 precedence remain authoritative. Missing
or corrupt evidence stays explicit and cannot be promoted to known success.
Add historical binding/source/resource deletion/mutation and retained-source-map
drift regressions, including parked-sync rejection; add passed controls17/2 then
refused second-plan/invalid-active-approval partial-summary witnesses. Fresh frame
critique precedes the optional manifest implementation; other budget, authority,
scenario and live-readiness contracts are unchanged.

**Scoped closure correction witness — 2026-10-14:** Fresh frame PASS and official
READY_FOR_IMPLEMENTATION preceded the helper's IN_PROGRESS transition. The focused
pure/operator `CLOSURE` selection witnessed21 behavioral failures/11 passes before
production changes: optional closed Ref acceptance, original binding/source/resource
hash omissions, native post-sync omissions and loss of generic refusal summaries.
Historical review binding JSON and raw original pass sources are now hash-read,
scope/plan/input/code/source/date/verdict checked at the original approval instant.
The old resource snapshot is hash-read and ownership/planning facts validated at
the original planning time. Neither is compared against current lease/code pins
or rewritten to satisfy freshness.

The approved five-pass snapshot manifest only selects bytes matching the exact old
source Ref/digest, never an alternative verdict/hash. It binds the immutable prior
approval, rejects unknown/missing/swapped passes, duplicate/mutable paths, changed
bytes and public-mode retained snapshots. Without a map, all original source paths
must still hash-match. Existing post-sync `loadControls` gates now re-audit this full
closure, retaining the lock on partial transitions. Later prepare/verify/run/active/
observe/restore preserve the manifest fingerprint and historical audit. Original
canonical review files are neither restored nor repointed.

The existing observation accumulator is shared by generic failed operations after
sealing. Non-RUN summaries first bind newly read durable state to actual input bytes,
not a desired in-memory replacement. Original operation/stage/refusal/nonzero status,
false claims and cleanup/lock exit4 remain authoritative. Passed corrected17/no-offer2
and old failed1/19 denials remain visible; complete known pairs/metrics also survive
a refused operation without asserting new success. Corrupt/missing proof stays
explicit and cannot be promoted to validated evidence.

All36 new regressions pass, including internally rehashed verdict/date refusals,
map-free old-resource/source/binding deletion/drift, owner modes, parked writer
tampering, retained original alias versus later canonical frame, later active/
observe/restore and generic second-plan/invalid-approval/foreign-lock/unknown-cleanup
summaries. The synthetic old review closure is frozen before the old test operation;
already-retained fixture histories are not repaired. Nested timer reuse and a stale
synthetic mapped-input hash were corrected before retaining the later witness.
A valid alias-map replacement escaped explicit observe binding; that assertion
was witnessed red and fixed with a stage-plan fingerprint comparison.
No actual private source/archive/resource/state/reference/credential/API/SDK was
read or changed. Existing browser helper/recorder/runtime/public exports and all
caps/authority/scenarios are unchanged. Fresh scoped compliance/craft/architecture
and exact operational/live gates remain pending; no acceptance/review/DoD tick.
Final exact unified selection passes **1580/1580 tests,13 suites**, retaining
all1544 preceding cases (1461 original regressions plus83 continuation witnesses).
Normal lint, explicit recommended lint on the changed probe/two tests (zero findings),
syntax and whitespace pass. Lifecycle remains IN_PROGRESS; no commit or promotion.

**Post-framing setup receipt — 2026-10-14:** Parent relayed the actual owner
statement "yes, setup is unchanged on my end", received16:36:12.449Z, with
expiry no later than2026-10-15T16:36:12.449Z. This supersedes the earlier missing-
renewal disposition, not its historical record. Parent separately normalized
current preflight/routing/workspace freshness from that receipt, keeping the
same original authority identifier/actor/configuration facts and old screenshots.
Renewed approval timestamps may bind this actual receipt; they do not require
an invented new authority identifier. The implementer read no actual private
receipt, input, reference, credential or capture. Parent's six fresh fixture/
authentication reads remain a separate genuinely incurred spending/readiness
step, not permission supplied by these offline tests.

**Scoped actual-input / native replacement correction — 2026-10-14:** Eight new
`FINAL-BINDING` tests witnessed eight failures before production changes. Complete
ordinary/continuation synthetic captures passed even when schema-valid current
input code pins changed. All three audited replacement paths could actually rename
the plan, then reject directory sync/close and release ownership because the
completed-plan marker had not been assigned.

Observation now receives the original supplied input Ref digest, compares it with
durable state and binds every current stage plan to that state/input before any
baseline claim. Changed pins or raw JSON whitespace cannot pass. Original samples/
counts/pair metrics can remain independently proved under their original plans
while the current operation is binding-refused/exit2; changed state/current-plan
bindings refuse affected proof. Historical plans still use their own immutable
inputs/times, and unknown cleanup retains exit4.

The existing writer accepts only an internal synchronous replacement-admission
marker after successful comparison and immediately before native rename. The
audited controller retains ownership/exit4 whenever admitted replacement has not
fully committed plan plus state, including settled directory sync/close errors.
Continuation, preparation reentry and unstarted retirement share this rule.
No physical cancellation, atomic multi-file transaction, old snapshot rewrite,
force-unlock or additional allowance is claimed. Old pre-rename guards remain.

All eight new tests pass across changed actual input bytes/state/current stage
hashes and both native directory failure phases. Current old state and original
immutable snapshots remain exact; partial new plan/retained lock are explicit and
the second planner refuses. The first unified run was1585 passes/three failures:
three existing partial-persistence assertions expected a released owner's later
`binding_refused`. Those tests now strengthen the original contract with exit4,
lock existence and subsequent `lock_refused`; no cases/guards were removed.
Focused fix/legacy/push selection passed14/14. Unchanged foreign/additional/duplicate
push guards still report `reference_drift` before metadata/push under frozen code.
Parent's pre-correction502-pass/one-failure result is retained, not reported as503
passes or diagnosed as proven concurrent source drift.
No actual private/API/SDK/reference effects, scope/lease/cap change or commit.
Fresh compliance/craft/architecture and live/operational gates remain pending;
IN_PROGRESS, no acceptance/review/DoD tick.
Final frozen-source unified selection passes **1588/1588 tests,13 suites**,
retaining all1580 prior cases. Separate unchanged foreign/additional/duplicate push
selection passes3/3 with `reference_drift` before effects. Normal/explicit recommended
lint (zero findings), syntax and whitespace pass. Implementation/test source remains
unchanged pending the parent's fresh scoped compliance/craft/architecture reviews.

**Controlled-continuation TDD witness — 2026-10-14:** The official helper first
transitioned READY_FOR_IMPLEMENTATION → IN_PROGRESS. Tests preceded production
changes. The first broad selection had23 failures/31 passes, including read-only
fixture mutation errors and parked paths not yet reachable. After correcting
that synthetic fixture, the initial focused witness was two behavioral failures/
26 passes: closed input acceptance and eligible R7-shaped planning were absent.
The original whole-chain/parked-write assertions also preceded implementation.
Six native ordinal-boundary failures/one existing cap-preservation pass preceded
helper changes. Supplemental actual-statement spelling, receipt-bound approval
timing, stale fresh-resource refusal, immutable pre-renewal favicon times,
post-sync input binding and retained partial observation after lease expiry
were witnessed red before their fixes. A strengthened whole-chain assertion
then caught a missing original deployment root/CSP receipt (eight instead of
nine retained controls roots); that assertion was witnessed red and fixed without
adding a download or weakening ordinary/per-context proof.

The operator preserves the five original Refs, both older histories, bound failed
case/network/normal/trace/body Refs, counters and errors. Synthetic carry is exactly
144/2417789 normal plus the bound eight new preparation attempts/bytes, and
13/10333 cleanup unchanged; no old Q reimport or old effect replay. Fresh current
controls is unstarted/empty. The private loaded planner projection adds only
`continuation:{grant,setup,spending}`; it is consistency data, not authenticated
human provenance. Source fingerprints bind the three new receipt groups.
Continuation cost retains the ordinary closed keys and adds only
`preparation_requests,preparation_bytes`, accounting for six new fixture reads.
Historical missing control_attempt means0; ordinary artifacts remain unchanged.

Native ordinal17 is limited to this corrected stock control/cap1, with a fresh
run ID and fixed distinct files. `controls-continued-*` stage evidence prevents
new preparation/verification from overwriting the old stage Refs. Native sink
tests prove original bytes/requestId-only continue and second-dispatch denial,
with all external traffic gated and no pinned vendor SDK execution.
Synthetic controls17/2 → active3–16 → observe qualifies all sixteen required
cases/three positives/five performance pairs while preserving the old failed
case and19 denials in seventeen-entry reports. A failed corrected control stops
normal traffic; unknown cleanup retains exit4. Old failures are not passed
controls or averaged performance samples. Local partial observation after expiry
does not renew sources, and missing historical capture cannot erase new cases.

Count enumeration is controls91/active262, twenty critical-file checkpoints
instead of22, with every context still freshly proving all seven critical files,
root and config. Original deployment root/CSP bytes are retained; deployment-
only proof is not a reusable context proof. Unpolled cumulative normal count505,
conservative upper511, unchanged512/32MiB and32/8MiB caps. Tests cover145/146
normal-count admission/refusal,13/14 cleanup counts and strict Site byte boundary
393215/393216, current normal/global bytes, native unknown-sync sealing, post-sync
foreign input/state/plan/grant/setup/history/nonce, and three/five config-poll
exhaustion with independent Target recovery. Timer recursion/teardown mistakes
in new tests were corrected without changing old guards or the existing helper.

All83 new tests pass; the exact required unified selection passes
**1544/1544 tests,13 suites**, retaining all1461 parent regressions. Normal lint,
explicit recommended lint on both probes/all three tests (zero findings), syntax
and whitespace pass. No dependencies, runtime/public exports, actual private
records, SDK/API/reference effects or commits changed. All supplied permission/
review/resource/SDK-byte stand-ins in tests are explicitly synthetic, not genuine
human permission or completed live acceptance. Fresh independent compliance/
craft/architecture, exact operational five-review approvals, actual12 READY/
served/current proof and full live ACs remain pending. IN_PROGRESS; no acceptance,
DoD or review box is ticked.

### Owner-approved historical-audit placement — 2026-10-15

At16:16:45.198Z the owner replied, "I guess, I approve. I'm not sure I understand
the ask," to the specific historical-audit-placement request. Parent explained in
plain language that repeated reopening of old records was delaying normal page
resources. Interpret approval **only** as moving that historical work, not a new
live attempt, higher budget, source renewal, removed resource/consent gate or
acceptance of the unfinished goal.

This supersedes only the full historical completionAdmission callback on each
ordinary static-page GET. Run the full original-proof/history qualification at
stage start, retain normal-effect/launch checks and recheck before every native
Adobe dispatch after durable reservation. Recheck again during final case
qualification and observation. The current original-byte/resource allowlist,
body hash/media/cache/redirect/source freshness/budget checks and durable GET
reservation all remain mandatory before their corresponding native continuations.
Unknown URLs, missing or changed current resource bytes, expired current source
proof and stop signals still halt the gate. Removing a historical callback is
not permission for unobserved or substituted page resources.

If historical proof changes while static resources load, the next Adobe
dispatch must refuse and retain its spent reservation; no Adobe bytes may escape.
If no Adobe dispatch occurs, final qualification must refuse on changed proof.
Persist actual case/network/normal/trace artifacts **before** that final proof
check, so refusal/cleanup does not erase an executed attempt. Original raw
proof/verdicts/pins/case1/failed2/all spending remain unchanged. Independently
owned cleanup remains possible even when historical traffic proof is corrupt.

Only the normal GET callback invocation is removed from the browser helper;
the SDK callback and all other safety/ownership gates stay. Add final controller
completionAdmission after captured-case persistence but before final checking/
passing the case. No new CLI flag/input/export/schema/dependency/cache/resume
framework. No phase/observation threshold or SDK/byte/context/call ceiling changes.

TDD: revise the six old callback-per-GET witnesses with this explicit approved
rationale, not silent deletion. Native root/config/asset GETs may complete their
existing original-byte proof without historical callback, but current resource
hash failure/unknown URL/expiry/stop remain sensitive. Corrupt history after a
normal GET and before Adobe dispatch must prevent actual receiving-sink delivery;
the correct stable case still dispatches once. Corrupt history during a case
with no SDK dispatch must fail final qualification after retaining its raw
capture/spending and attempting independent cleanup. Source pins, execution
versus qualification provenance and generic partial-summary behavior stay strict.
Measure synthetic startup/waterfall overhead before/after without treating it
as successful actual no-offer execution.

Frame and scoped code review precede using the changed harness. Original2's
failed14.720s window cannot be requalified by this code; any later live retry,
context allowance, budget change and current setup evidence are separate.
Full stock/chamber/adoption/DoD acceptance remains open.

**Implementation witness — 2026-10-15:** Recorded READY_FOR_IMPLEMENTATION was
confirmed, then the official helper transitioned this frame to IN_PROGRESS.
Ten reds preceded the two-line production change: remove only historical
admission from the ordinary GET branch; add final completionAdmission after all
raw artifacts and the stage case Ref/save, before normal/pure qualification.
The native Adobe post-reservation callback and every other current byte,
consent/egress, source/clock, effect/launch, ownership/nonce/CAS and cleanup gate
remain. No new shape, flag, export, cache or permission follows.

The six old GET witnesses now explicitly cite this approved placement rationale.
Stable/changed history permits known normal bytes with zero historical GET calls;
current-body/unknown/expiry/stop remain strict. Native SDK witnesses retain one
spent reservation, zero delivery on changed history and exactly one unchanged
requestId-only continuation when stable. Final no-SDK witnesses audit once after
durable captures, refuse corrupt history and preserve case/network/normal/trace/
body bytes, error history, spending and verified independent cleanup. Missing SDK
evidence still cannot pass; the complete synthetic SDK case passes only after
its final audit. Test expectations were corrected to preserve the existing
error journal and successful-control not_needed Target dispositions, not change
production behavior.

Targeted operator8 checks pass in partitioned/corrected runs, native
normal-resource64/64 and pure baseline247/247 pass. Same synthetic31-GET sink:
31/31 proved, zero historical GET audits,0.791/1.019s versus earlier7.841s.
Final and pre-SDK audits are separately witnessed; this is not actual SDK/host
acceptance or proof of the sole cause of failed2. Normal/explicit lint, syntax
and whitespace pass. No30-call benchmark/full-suite rerun, actual private/live
effect, source renewal, cap/context/retry/phase change, commit or review/DoD tick.
Source frozen for fresh scoped reviews; original2 remains FAILED.

### Native original-request body capture — 2026-10-16

Actual control19 ran45.279s, settled and admitted four original-byte-hashed
Adobe requests with zero denied requests. All three cleanup actions were
independently verified; the reference is clean/disabled. Wire qualification
failed because the passive Page recorder retained null bodies for two collect
requests, despite the native request-stage gate having decoded and hashed
their original bytes before continuation. The observed200/204 responses do
not replace the missing original body evidence. Original19 remains spent,
failed/unqualified and immutable; never fill its missing bodies or relabel it.

A headed loopback probe on the actual launched browser151.0.7922.34 reproduces
the gap: `Request.postDataBuffer()` is null for a native Blob sendBeacon, while
the original CDP entries, gate hash and owned receiver bytes agree. The string
fetch control retains its body. This proves byte visibility, not SDK/product
success; the probe's separate204 response-observer failures remain visible.
An attempted Blob-fetch variation did not complete and was stopped; it is not
passing evidence. No vendor traffic or actual baseline/context charge occurred.

**Required producer correction, hermetic first:**

- Capture the exact original CDP request-stage byte entries while the gate
  owns them, before native continuation. Keep the existing POST/origin/path/
  query/content-type/UTF8/JSON/8KiB/duplicate-ID/expiry/consent/reservation and
  per-hop no-send gates. Do not rewrite requests, force fetch instead of Blob/
  beacon, change SDK options/bundle, use lossy `postData()` or reconstruct JSON.
- Persist a bounded original-byte witness, with exact request-ID, URL/method/
  media identity, timestamps, size and body SHA, tied to the durable reservation
  and this case. Body-provider failure, mismatch, short/late write, duplicate,
  queue overflow or proof expiry must refuse continuation and stay spent.
  Maintain the32KiB case body budget; no inter-case/global body cache.
- Let the caller-owned baseline recorder consume only that explicitly bound
  original-byte source when the Page API cannot expose a body. Preserve legacy
  passive behavior and all failure/response checks for callers without it.
  Keep source provenance in the artifact/oracle: callback data is not proof
  merely because a function returned bytes. No arbitrary module/transport/
  endpoint/environment provider or success-shaped fallback.
- A current-schema qualification must validate every body witness against
  original bytes, reservation and captured transaction, not just planned event
  values. Missing/mismatched witnesses remain unverified. Preserve raw observer
  anomalies and all old19 body-null/error evidence; do not clear old failures
  or weaken generic response checks to make a local probe pass.
- Witness real local matched string/Blob native controls on the launched
  browser, with receiver/gate/recorder SHA equality, all body/aggregate/identity/
  timeout/mutation/no-send negative controls and real request/response pairing.
  Exercise the official pinned SDK serialization under inert fulfilled
  responses or owned loopback only before another live attempt; SDK stubs alone
  are not this regression. No vendor/API/site/account mutation for debugging.
- This correction alone authorizes no new live context or retry of spent19.
  Any next control requires a separately framed, finite audited recovery under
  the owner's existing numeric delegation, preserving all failed19 state,
  captures, source/approval provenance and541/7,809,420 normal and49/40,063
  cleanup costs. No manual state reset, second prelaunch retirement or blind
  SDK replay; actual source/readiness/operational gates apply anew.

**Closed handoff shape for this correction:**

- Add only optional recorder option `nativeBodySource`, a descriptor-validated
  plain object with exact `{kind,schema_version,read}`. Kind is
  `"airlock.cdp-request-body-source"`, version1; `read` is a trusted caller-owned
  function, never a proxy/accessor, module/environment/CLI selector or SDK hook.
  Its exact input is `{url,method,content_type}`. Its result is exact
  `{body:Buffer,witness}`; `witness` is the record shape below. Compare the
  original-byte source with Page bytes when both exist; disagreement fails.
  Without this option, the recorder's existing API/output/error checks stay
  unchanged. Keep its returned handle and report/capture DTO shapes unchanged.
- Add only trusted baseline-gate callback `writeNativeBody(ordinal,bytes,meta)`
  alongside existing callbacks. `bytes` is a copied original Buffer, never
  serialized JSON. Exact meta is `{request_id,url_sha256,method,content_type,at}`;
  `at` is the same admission timestamp stored with the reservation. The callback
  writes/verifies/fsyncs the owned case body and returns exact
  `{ordinal,request_id,url_sha256,method,content_type,at,body:Ref,bytes}`.
  Method is POST; Ref SHA equals the gate's original-body SHA and returned
  byte count equals the original Buffer length. Failure/mismatch or scope/nonce/
  expiry change before continuation refuses send; a reservation stays spent.
- The baseline owns the bounded pending-reader/record map and lifetime, with
  capacity at most this case's existing SDK cap. Unknown/missing/duplicate/
  closed source entries fail, not hang or default. Capture callbacks cannot
  grant egress. Publish only a successful original-body witness before native
  continuation, and discard in-memory bytes on case closure. Recorder
  settlement/body/aggregate budgets stay unchanged.
- Every newly built plan declares `native_body_capture:1`; legacy plans lacking
  the field retain their original validation. The new producer returns exact
  `airlock.adobe-stock.native-request-bodies` version1
  `{case_ordinal,plan_sha256,records}` (in addition to kind/schema_version), with
  the exact record shape above and zero records for a zero-SDK case.
  Controller stores `case-N-adobe-body-M.bin` and `case-N-adobe-bodies.json`,
  attaching `adobe_bodies:Ref` to the case. On new-marker plans this Ref and
  all its original bytes are mandatory; protected readers verify exact paths,
  owners/modes/hashes/sizes and closed metadata. Legacy cases do not gain
  synthetic witnesses.
- Pure qualification receives the bound witness object as optional
  `capture.adobe_bodies`; on a new-marker plan it must match the case Ref SHA,
  plan/case, every transaction ordinal/request ID/URL SHA/media and reservation
  timestamp/body SHA, exact serialized body size/hash, and observation window.
  The disk loader separately verifies original files before passing this view.
  Missing, added, reordered, mutated or cross-case witnesses fail. No rewriting
  of old19 artifacts, and no new network or DOM capability follows.

### Finite original-body recapture — delegated limits, 2026-10-17

This is a proposed, separately reviewed recovery for the observed request-body
loss, not permission to rerun19 or to declare it qualified. Only after the
producer correction and this recovery pass their own required reviews may one
new no-offer20 collect complete original bytes. Original19's45.279s execution,
four SDK reservations, two null captured bodies, failed verdict and all costs
remain visible. The existing owner's numeric delegation supplies the bounded
budget decision; it does not waive any source, consent, payload, timing,
response, rendering, ownership, cleanup or readiness rule.

Add only optional input `capture_recovery:Ref`, requiring the existing
`prelaunch_reentry`. Its closed version1
`airlock.adobe-stock.body-capture-recovery` manifest has exactly eight immutable
Refs: `state`, `prior_input`, `prior_plan`, `prior_approval`, `run_result`,
`recorder_qualification`, `preparation_spending`, `operational_budget`.
None may alias canonical state/plan/lock/current config/replacing input. Prior
input has one prelaunch reentry and no capture recovery. No recursive or second
capture recovery, no manual state reset or baseline ID change.

- Eligible prior state is FAILED controls after exactly[1,17,2,18,19], SDK
  reservations5 (one17 and four19), controls carrying original17 and19,
  active empty/unstarted, no20 capture/page/reservation and all three stops
  verified. Canonical state must equal its immutable old bytes before both
  replacements. Check old canonical plan before the first and the exact new
  plan before the second; keep reading the immutable old plan throughout.
  Existing fresh per-admission read scopes, final synchronous fences,5s writer
  allowance and partial/uncertain durability ownership apply unchanged.
- Bind prior input/state/plan/approval and five immutable original review
  sources. `run_result` is the original closed
  `airlock.prelaunch.operation-result` version1 wrapper with exact
  `recorded_at`, `operation`, `stage`, `exit`, `input:Ref`, `stdout`, `stderr`,
  `process_only_https_transport`, `persistent_git_configuration_changed`.
  Require run/controls/exit1, nonfuture time, process-only true, persistent change
  false and input SHA equal the retained prior input. Parse bounded stdout
  under its existing complete report shape; require the original failed/
  unqualified19, wire_failed/missing_evidence reasons, all three verified stops
  and the original counts. Original wrapper path provenance may differ from an
  equal-hash retained input; do not reread an overwritten path or invent a plan
  SHA field. Bind its one plan through state/approval/input/plan hashes.
- Prove original19 from its actual bound case/network/normal/verification/trace
  and every retained body/part. Require result observed, errors[], settled,
  full45s plus10s after settlement, four reserved/zero denied, network errors
  exactly invalid_request, original response statuses[200,200,204,204] and
  request bodies1/2 present but3/4 null with invalid_request. Match all four
  request-ID/URL/body-SHA reservations and known metadata; verify present bytes,
  all original source/normal/trace bindings and complete ownership history.
  Missing old bytes remain missing. This eligibility proof is not a passing
  wire, identity, host, product or complete-case qualification.
- `recorder_qualification` is closed
  `airlock.adobe-stock.native-body-qualification` version1 with exact
  `observed_at`, `prior_input:Ref`, `native_probe:Ref`,
  `native_probe_script:Ref`, `sdk_probe:Ref`, `sdk_probe_script:Ref`,
  `source_freeze`. Require same retained prior input and nonfuture time no
  earlier than both probe ends. `source_freeze` has the seven literal source/
  test paths in the body witness's freeze table, each a SHA; both probe maps
  equal it. Its operator/recorder/browser digests match the current input and
  source assembly. Verify original script bytes against each probe's script SHA
  with protected readers; scripts are evidence, never loaded/executed by CLI.
- Require actual closed `airlock.private.native-body-loopback-probe` version1
  proof with schema1's exact recorded fields and safe integer probe_revision
  between2 and4096: canonical start/end, before/after freeze true, headed actual
  browser, SDK executed false, external observed/continued/blocked counts0,
  body_witness_passed/recording_complete true, full_wire_qualification_claimed
  false, outcome body_and_recording_complete, unchanged complete network report
  with recording_complete/exit0 and all claims false, all error lists empty,
  complete cleanup. Its two exact ordered paired records are string_fetch and
  blob_sendBeacon, distinct valid IDs, nonempty receiver bytes≤8192,
  original-hashes-equal true and CDP/gate/witness/recorder/receiver SHAs equal.
  String Page SHA equals that SHA; Blob Page bytes are absent/null. Actual,
  recorder and receiver response statuses are respectively200/204, with
  original response bodies and no record errors. Validate every closed field,
  fixed pair ordinal and report count/byte sum, not just pass booleans.
- Require actual closed `airlock.private.native-body-sdk-inert-probe` version1
  proof with schema1's exact recorded fields and safe integer probe_revision
  between2 and4096: canonical nonfuture start/end, before/after freeze true,
  unchanged152336-byte Alloy SHA7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8,
  headed same browser as the native probe, zero external continuations/blocked
  attempts, all error lists empty and cleanup complete. Its two paired records
  are original interact/string and collect/Blob; valid SHAs/equality, Page SHA
  present/matching only for string, absent for Blob. Page response events and
  each record's response status are[200,200], not SDK-simulated204; require
  sdk_queue_time_simulated_204_used_as_wire_evidence false and the recorded
  inert-fulfilment provenance string. This is serialization-only proof, not
  vendor delivery or live204 proof. No field may be omitted/added/rebound to
  unrelated/mismatched source. Independently review the actual receipts/code
  before effects; future actual launched browser mismatch remains unverified,
  never relabelled as the old probe's version.
  The schema1 probe receipts may additionally carry only
  `previous_script_sha256`, a valid SHA retained as revision-history metadata;
  it is not a source selector, executing module or substitute for the current
  `script_sha256`/bound script bytes. All other extra fields still refuse.
- `preparation_spending` uses the existing closed recovery-spending schema
  with only six **new** fixture-purpose successes plus actual new failed reads.
  No source prefix or already-imported six/3,481 reimport. Fresh resource Ref/
  observed time bind the receipt; count/bytes sum every new attempt once.
  Preserve prior normal541/7,809,420, cleanup49/40,063, all errors/reservations/
  page data, original17 and failures1/2/18/19. Audit retired proof using its
  recorded input/time/pins, not the new body schema.
- `operational_budget` uses the existing closed budget/delegation envelopes
  and genuine original fifteen-fifty-six delegation, with exact reason
  `"preserve failed native-body capture19; execute one no-offer20 then active3-16"`.
  Complete limits equal the prior19/900/80 object except contexts20 and
  metadata_requests1000. SDK64, cleanup80 and every other byte/window/privacy
  limit remain identical. This finite headroom retains failed19 and the
  corrected control plus original14 active cases; it is not unlimited retries.
- Only resources/current code pins and this manifest may change from the prior
  input. Existing genuine20:41 setup/authority/routing/workspace, reference/
  assets/normal map/SDKs/vendor opt-outs and all old history fields stay deeply
  equal. No new asset/head/root exception: current source is the known config-
  only chain3f→677d4c5 or subsequent recorded owned config effects.
  New plan `capture_attempt:1` requires all old prelaunch/bootstrap/recovery/
  completion/control discriminators, `native_body_capture:1`, exact finite
  limits and `source_hashes.capture_recovery`. Legacy plans remain exact.
- CAS alone appends `capture_history:[input.capture_recovery]`, updates input
  hash and adds new preparation count/bytes once. Fresh UNSTARTED controls has
  new plan, original17 only, null approval/preflight/verification, empty effects.
  Other history and active state stay exact. Use a distinct capture stage
  artifact prefix; retain old19 plan/approval/effects/readiness/verification
  immutably. Runtime/restore/observe audit retired19 under its old input.
- Required roster is17,20,3–16; controls executes20 only, active3–16 only.
  Native dispatch admits exact20/stock/no-offer/cap4 only with the new capture/
  native-body markers and original scope flags; no19 relabelling or broader
  routing. Any attempted20 or committed capture history permanently precludes
  another capture recovery. Indexed reports keep failures1/2/18/19 visible,
  original17 reused once, required20/active results and all old trace/body costs.
  Actual five review bindings,12READY/current served-source proof, source hold,
  fixed windows/full native observations and independent cleanup apply anew.
- TDD must cover actual input/plan/CAS/original failed-body history, all probe/
  script/source/body/limit/accounting mutations, interrupted/late/both-boundary
  writes, legacy17/source-schema separation, native20 sink only after durable
  original-body proof, and complete synthetic20→active→observe. Code/local
  fixture/review passes are never permission to bypass real gates or claim a
  finished stock/chamber/product goal.

### Unadmitted capture preparation renewal — 2026-10-19

This extension renews preparation **before the first capture20 admission**,
not after an executed or committed capture. The owner genuinely confirmed
unchanged setup at2026-10-19T21:11:38.874Z, with exact statement
`It is indeed unchanged`; the new receipt expires24h later. Earlier unavailable
answers and continuation reminders supplied no setup facts. Scope, selectors,
permissions, routing, source/opt-outs, SDKs, resource ownership, acceptance,
cleanup and the single20/active3–16 roster are unchanged.

Grounding: the complete636-test operator run passed on5c9d production/c477
operator test; original failed629/7 and fixture repairs remain preserved.
The actual first capture input a457 and its eight-Ref manifest were never
admitted: canonical state d482 still records541/7809420 normal,
49/40063 cleanup, SDK5 and contexts[1,17,2,18,19], with verified prior stops,
no lock, case20 or capture_history. One successful preparation journal from
2026-10-17 cost6/3478 and is now stale. Full retained-history/disposable-writer
timing subsequently passed1.52–1.74s under the unchanged5s budget. These facts
are retained in the implementation witness/private receipts; none qualifies
current remote/account state. `setupEnvelopeRefresh` in stock-baseline.mjs
already defines the exact timestamp/provenance-only renewal leaves; its existing
immutable prior/current envelopes remain the model, not broader scope editing.

For this unadmitted branch only, the closed capture manifest may additionally
carry **both** `setup_renewal:Ref` and `preparation_carryover:Ref`. Either alone,
unknown fields, aliasing and recursive renewal refuse. The original eight-Ref
branch remains exact and unchanged. New fields grant no new baseline ID, retry,
context, CLI/export, browser option, source exception or mutable-state reset.
All ten immutable Refs are distinct and must not alias canonical state/plan/
lock/config/replacing input; nested Refs retain the same forbidden-path rules.

`setup_renewal` uses the existing closed
`airlock.adobe-stock.setup-renewal`v1 shape:
`confirmation:Ref`, `previous:{input:Ref,routing:Ref,workspace:Ref}`,
`current` with the same three Refs. Require previous exactly the original
failed19 input's preflight, current exactly the new input's preflight and
confirmation exactly its setup_confirmation. The six-field confirmation must
be genuine unchanged:true, nonfuture, newer than the original authority,
and expires_at strictly after received_at and at most24h later; current effect
admission requires it still valid. Top-level authority changes only approved_at/
expires_at. Read/validate all six preflight envelopes and require deep equality
after only the existing setupEnvelopeRefresh timestamp/provenance whitelist.
Every identity/selector/credential/permission/assessment/routing fact remains
equal. Original expired envelopes remain immutable and are audited under their
own recorded times, never relabeled as current.

`preparation_carryover` is closed
`airlock.adobe-stock.capture-preparation-carryover`v1 with exactly three Refs:
`unadmitted_input`, `fixture_job`, `fixture_journal`. It proves the single
already-spent, successful preparation—not an arbitrary list or source prefix.

- The unadmitted input has the original eight-Ref capture manifest, no paired
  renewal/carryover. Its underlying prior_input/state/prior_plan/prior_approval/
  run_result and operational_budget Refs equal the new manifest's corresponding
  Refs; prior input is the actual failed19 prelaunch input, not the new input.
  Only its old resources/code pins/capture manifest could have differed from
  that original input. Its old setup/authority/preflight/history/normal assets/
  opt-outs/SDKs stay exact. It is not a retired committed capture attempt.
- The closed old `airlock.capture.fixture-job`v1 has the existing exact
  prior_input/state/preflight/setup/budget Refs. Bind those to the original
  failed19 input/state and old owner/preflight/budget. Its closed
  `airlock.capture.fixture-journal`v1 has the exact recorded fields:
  observed_at, complete, source_prefix_count, sdk_requests, mutations,
  prior_input, preflight, setup, retired_state, budget, resource_ref, spending_ref,
  completed_at, phase, attempts. Require complete:true, prefix/SDK/mutations0,
  phase offer-2, exact job bindings and immutable resource/spending Refs matching
  the unadmitted input and its manifest. Canonical original state equality,
  absent case20/capture_history and the unchanged operation-owned lock/nonce
  (never a competing or failure-owned lock) are prerequisites at both replacements.
- Require exactly the six ordered purposes authentication/environment/property/
  activity/offer-1/offer-2, all received, no upper-bound flag, bounded bytes and
  total count6/bytes3478. Journal and spending attempts equal exactly. Require
  ordered canonical nonfuture receipt times from the old genuine confirmation
  through journal start/resource observation/spending/end, all before its old
  expiry. Validate old SAVED resource content/ownership against the old
  preflight at its original observation time. Preserve these successful reads,
  original timestamps and source files; never recast them as failed, silently
  omit them or refund them because they became stale.
- The old qualification Ref/file bytes remain hash-bound history only. It is
  not required to match current code, nor may an expired old input be approved,
  executed or recursively requalified. Validate its closed manifest/source
  bindings without invoking current-code/current-time proof on that old input.
  Only the new source-bound native qualification attests current code.

New `preparation_spending` remains the existing closed recovery-spending schema:
exactly six **new** fixture-purpose successes plus every actual new failed read,
zero source prefix, fresh resource Ref/current observation and a new exclusively
claimed job/journal/output prefix. It is not a combined rewritten journal.
The new collector rechecks genuine renewal/current scopes and exact old state
before every send, reserves/fsyncs each attempt first, charges failures
conservatively, refuses redirect/response drift and never retries automatically.
Before transport, account for canonical541/7809420 **plus old pending6/3478**
plus all new attempts under the already-approved finite metadata ceilings.
No previous consumed job or old six/3481 already-imported preparation is replayed.
Collector code/exact job need their own independent preparation-scope review.

Pure planning and actual CAS derive preparation cost as old6/3478 plus the new
receipt's count/bytes. With six new successes, count12 is imported once; canonical
normal count becomes553, not547 or559, and bytes become7812898 plus new bytes.
Every cost/byte upper-bound and normal budget check includes both jobs. Keep
old/fresh spending as separate bound proof objects; a derived numeric sum is
not a fabricated receipt. The complete20/1000/80/SDK64 budget object and all other
limits remain unchanged. Existing capture_history:[new_capture_recovery] alone
consumes the one recovery; no second renewal after either capture admission or
partial/uncertain canonical replacement, no failed19 replay and no context21.

Both canonical replacement boundaries and every later historical admission/
restore/observe bind the new renewal/carryover and every loaded old/fresh
setup/job/journal/resource/spending/code/probe/body/source file through successful
typed expected-pin reads and a fresh sealed evidence catalog. Preserve the
current synchronous oldstate/old-or-new-plan/input/immutable-old-plan/nonce/
prepared-original-inode/protections/bytes/deadline fences, failed-lock ownership,
admission-local syntax-only reuse and5s writer unchanged. Restore may omit
traffic-only current qualification for an independent owned stop, not its
renewal/ownership/spending lineage. Old marker-absent and original eight-Ref
captures retain their behavior; full current/legacy regression is required.

Pure capture source DTO gains optional paired `renewal` and `carryover` only
for this branch. `renewal` is exactly `{value,ref,confirmation:{value,ref}}`
with value the setup-renewal envelope. `carryover` is exactly
`{value,ref,state:{value,ref},unadmitted_input:{value,ref},unadmitted_manifest:{value,ref},
fixture_job:{value,ref},fixture_journal:{value,ref},spending:{value,ref},
resources:{value,ref}}`. Existing capture fields remain unchanged. All Refs
must bind the matching manifest/closed source record; pure validation checks
the same immutable equality, times, ordered spending and separate numeric sum.
The `state` record is the **original failed19 state**, with Ref exactly equal
to the capture manifest's `state`, validated under its original input schema
and eligible checkpoint. Require historical carried resources to satisfy
`sameActivity(resources.value.activity,state.value.resource_current)` during
both controls and active pure planning. Current `resources.previous` after CAS
is not a substitute for original-state ownership evidence. This explicit
original record resolves the2026-10-19 compliance gap: an immutable Ref alone
did not supply its value to active pure planning. It adds no file or state
authority; the disk loader already reads and verifies this exact original.
Matching Refs are insufficient if their paths are forbidden: pure validation
must exclude canonical mutable/config/replacing-input aliases throughout both
the renewal and carryover views, including coherently rebound nested Refs.
The disk loader additionally validates whitelist-only preflight envelope
renewal and protected original file bytes. Do not add redundant plan/runtime
flags: capture_attempt/native-body markers and source_hashes.capture_recovery
already bind the new manifest branch; no ABI or receiving-gate widening is needed.

TDD must witness original-eight-Ref compatibility and paired-field refusal;
genuine-expired/future/over24h/changed-fact renewal rejection; old successful
spend preservation and all carryover job/journal/Ref/purpose/count/byte/time/
ownership/alias/recursive mutations; count12/bytes sum once at both actual CAS
boundaries; late old/new setup/resources/spend/journal/temp mutations and
partial/timeout lock retention; synthetic renewed20→active→observe and independent
restore; per-admission syntax/policy separation; no actual network/SDK admission
from local fixtures. Final-source new native receipts, full actual read-only
proof/disposable5s measurement, current source coordination, exact operational
review/five genuine bindings/12READY/served-source proof and one fixed20 window
remain mandatory before live SDK traffic. Owner setup renewal alone waives none.

### Passed-control active preparation — proposed offline contract, 2026-10-20

This prepares only the remaining active3–16 phase, keeping actual17/20 and
their execution code/evidence immutable. A new code version may inspect old
code bytes as **data** while separately proving its own executing source.
The tradeoff is a bounded extra proof envelope, not a general importer or
permission to rewrite old pins. **A separate trace-storage approval was not
received.** Re-reading the original owner message on2026-10-20 established
that necessary approval-limit adjustments were already delegated; the earlier
restriction to context/admin/cleanup counters was an orchestrator interpretation,
not an express owner limitation. The exact existing-delegation path below needs
its own reviewed bounded budget record before real preparation or replacement.
Generic continuation reminders and unavailable answers remain non-approvals.

Grounding: actual20 passed on51a1/input061/plan df2/approval baa with all four
original bodies. The stopped351 state has controls passed, active empty,
normal631/8661669, cleanup52/41748, contexts[1,17,2,18,19,20], SDK9,
site verified and Target SAVED with its bounded successful schedule retained.
Its standalone optional restore refused before effects; the separately reviewed
offline8c1 correction must not be applied using that old execution binding.
All57 case20 files and11 artifacts are retained immutably. Six original traces
consume87978 events/19572859 bytes, leaving72022 events under the old160000 cap
for14 cases. This is a measured budget risk, not a universal lower bound on
future event counts. The private storage proposal and actual summaries retain
all original counters and the unanswered permission question.

**Unverified assumption and kill condition:** The finite cumulative observation
budget must have a reviewed binding to either the exact genuine numeric
delegation below or a separate genuine owner decision. No such current bounded
record is admitted yet. If its authority is absent, declined, mismatched or
expired relative to the stage's current authority,
the new branch performs no live vendor/site reads/effects, baseline SDK admission
or canonical replacement; protected local inspection and hermetic tests remain
permitted. Keep
legacy profiles unchanged. Neither lower trace fidelity, fewer samples, shorter
windows, waived acceptance nor a second20/extra context is an alternative.

#### Closed active handoff

Add only optional input `active_preparation:Ref`, requiring the existing paired
capture-recovery input lineage. Its closed
`airlock.adobe-stock.active-preparation`v1 manifest has exactly ten Refs:
`state`, `prior_input`, `prior_plan`, `prior_approval`, `run_result`,
`controls_resources`, `historical_sources`, `recorder_qualification`,
`preparation_spending`, `operational_budget`. All ten are distinct, immutable,
protected and forbidden from aliasing canonical state/controls-plan/active-plan/
lock/config/replacing input. Nested role Refs retain those exclusions.

The prior input is the actually executed061 paired-capture input, with no active
preparation. Prior plan/approval/run describe the successful controls execution,
not unadmitted a457. Prove exact original hashes, actual body/response/identity/
host/window qualification of17 and20, all old failed1/2/18/19 ownership/history/
review/costs, and current saved-resource readback after20. The closed run wrapper
is the actual `airlock.capture-renewed.operation-result`v1, with recorded_at,
operation,stage,exit,input:Ref,stdout,stderr,process_only_https_transport and
persistent_git_configuration_changed: require run/controls/exit0, bounded
complete stdout report with stage_passed, current17/20 passed and historical
failures visible, process-only true/persistent false, original input SHA.
It has no invented plan-SHA field. Bind the plan through state/approval/input.
Validate historical plans, approvals and source evidence at their own recorded
times/code pins; expired original windows are not current execution permission.
The new active plan requires wholly new current operational/readiness approval.

Eligible prior state is exactly the post-controls checkpoint: controls passed
with original17 and new20, active equal emptyStage, original capture history
consumed once, no active-preparation history, no active context/plan/case/effect,
six contexts[1,17,2,18,19,20], nine reservations ordered17/19×4/20×4,
normal631/8661669 and cleanup52/41748. Cleanup flags may be verified/not_needed,
never unknown/conflict; resource_current must be SAVED. The post-controls
resources Ref matches state.resource_current, preserved original ownership and
the actual successful window/effects. Requalify17 under its original marker-
absent plan and20 under its original native-body plan, never current code pins
or invented old bodies. All original files and trace parts remain required
before active traffic; independent stop may omit traffic-only proof, not owned
state/plan/approval/spending lineage.

Only new resources, current code pins and active_preparation may differ from
the prior input. Authority/preflight/setup, SDKs, opt-outs, normal/reference
assets and all existing history fields stay deeply equal. No setup renewal
is implicit; if current genuine scope expires, this branch refuses. Original
control plans/approvals/source pins/captures are never rewritten to match new
code. The actual original061 input remains available independently.

#### Original sources are data, not executable authority

`historical_sources` is closed `airlock.adobe-stock.retired-control-sources`v1:
`input:Ref`, `code` with exactly the nine fixed CODE role Refs, and `body_freeze`
with the seven literal BODY_FREEZE_PATHS Refs. Input equals prior_input.
Each code digest equals its original input code pin; each body-freeze digest
equals the original recorded native qualification's map. Operator and recorder
overlaps share the exact same Ref: sixteen entries represent fourteen unique
source files, not a caller-selected inventory. Unknown/missing/extra roles,
mutable/current-executing path aliases, conflicting duplicates and bad modes/
owner/hash/size/symlink components refuse. Source files are opaque protected
original bytes <=10MiB each. CLI never imports/executes them or parses an archive.
Historical-copy Ref paths are canonical; this new closed-role rule does not
change raw-path compatibility of unrelated legacy readers.

A historical source alias scope may exist **only around the old read-only
qualification**. Match the exact canonical logical fixed path AND expected old
digest, then read the protected historical Ref. Catalog/cache keys use the
actual immutable file consumed, not a fabricated current-path digest. Every
old/body/source read retains its applicable bound and protection policy.
Leave the alias scope before validating any executing current CODE/browser/
test pins, current qualification, source snapshot or effect. Even when old and
current digests coincide, a historical copy cannot substitute for the current
physical source or hide later tampering. Canonical mutable journals/config/Git
facts never alias. Fresh catalogs and original synchronous fences apply.
Per-admission AST syntax reuse remains syntax-only with rules rerun.

The parent's retired-control source map copied all seven body-freeze files from
the hash-verified executed-source archive; other code copies were admitted only
when current bytes still equaled recorded original digests. This supplies
data provenance for review, not a script loader or new live grant. Old native
qualification/probe/script files remain bound to their old pins and timestamps;
the new recorder_qualification alone attests current code with the existing
closed native/SDK schemas, scripts and actual matching launched-browser checks.

#### Bound cumulative-storage authority

`operational_budget` is closed `airlock.adobe-stock.active-operational-budget`v1
with `authority:Ref`, `trace_authority:Ref`, `recorded_at`, `limits`, `reason`.
Authority is the original genuine numeric delegation. One accepted trace
authority is a **new genuine owner decision**, closed
`airlock.owner-trace-budget-approval`v1 with received_at,owner_statement,
previous_limits,limits,remaining_cases,per_case_limits_unchanged,
trace_fields_unchanged,acceptance_unchanged,scope_unchanged. All four booleans
are true; remaining_cases exactly[3..16]. Previous limits are exactly
`{total_trace_events:160000,total_trace_bytes:67108864}`; new limits exactly
`{total_trace_events:367978,total_trace_bytes:137013371}`. Statement is bounded
original owner text; canonical nonfuture received_at is after actual20 ended
and no later than budget.recorded_at/plan time. Except for the exact existing
numeric-delegation path below, prior generic delegation,
setup-only confirmation, synthetic fixture text presented as actual authority,
unavailable response or self-generated permission is not a substitute.

The complete budget equals the old20/1000/80/SDK64 object except those two
cumulative trace totals. Reason is exactly
`preserve all six spent contexts and trace costs; execute only remaining active3-16`.
Numbers equal actual retained87978/19572859 plus14 times unchanged per-case
20000/8388608. Verify each of the six original trace metadata/part bindings and
sum once. No field/category/privacy/per-case cap, SDK/context count, payload
rule, request/body/response size, performance criterion or acceptance changes.
These are future local observation ceilings, not authority to dispatch events.
Use the approved plan's cumulative limits everywhere aggregate trace guards
run; old profiles retain160000/64MiB and all per-case checks stay unchanged.

**Existing numeric-delegation clarification — 2026-10-20 (scoped frame PASS):**
The genuine owner statement was exactly
`feel free to update the approval limits as needed`, received
2026-10-16T15:56:11.731Z. The conversation around that message contains no
express exclusion for cumulative local trace limits. The stored description
limiting delegation to context/admin/cleanup counters was authored by the
orchestrator; preserve its original receipt bytes and do not relabel its date.
This fixed increase accommodates the already assigned14 remaining cases and
retains failed-attempt costs; it does not add cases, captured fields, privacy
categories, SDK traffic, external resources or acceptance changes.

Accordingly, the other accepted path is for `trace_authority` to equal
`authority`, both exactly the original budget's bound numeric-delegation Ref.
The existing `trace_grant:{value,ref}` DTO then carries that unmodified
`airlock.owner-operational-budget-delegation`v1 record, not a manufactured
`airlock.owner-trace-budget-approval` receipt. Require exact Ref and deep-value
equality with the independently bound original delegation already present in
the capture lineage, including its closed schema, exact owner statement and
all unchanged scope/cost-retention flags. A merely renamed object, arbitrary
earlier approval, setup receipt, copied statement with rebound Ref, unavailable
answer or new self-authored owner receipt still refuses.

For this path, `operational_budget.recorded_at` is the orchestrator's actual
bounded adjustment time: canonical, after actual20 ended, no later than plan
time, and no earlier than the original owner's unchanged receipt time.
The owner's `received_at` remains the original October16 date, never rewritten
or presented as a new post20 decision. Require fresh preparation attempts and
the new resource observation after this budget's recorded_at, not merely after
the old delegation date. The other separate-owner-decision path retains its
existing receipt/date semantics. Both paths require the same exact complete
budget, retained six-trace sums, fixed reason, remaining3–16 scope and every
source/owner/setup/operational approval, current readiness and safety gate.
No new DTO field, export, generic limit override or additional proof partition
is introduced; no actual budget/state/plan changes before the guarded handoff.

Fresh preparation remains the existing recovery-spending schema: six new owned
fixture-purpose successes plus every actual new failed read, no old source/
preparation prefix, all attempts reserved durably before transport. Resources
must be newly observed SAVED and match original ownership/current recorded
SAVED state, not merely the stale post-controls observation. Code/exact new
collector job require independent review before one real collection. Import
only this new count/bytes; old12/6959 and all631/8661669 normal spending are
already imported and cannot be charged again or refunded.

#### Active-only plan/CAS and typed proof surfaces

Only `plan --stage active` can initially admit this branch. Require exact old
state bytes and original controls-plan bytes through both replacements; no
competing/failure-owned lock. Active-plan destination is initially absent,
then exactly the prepared new plan before state replacement. Old controls plan
stays unchanged throughout. Final synchronous checks cover original old state,
old controls plan, new-or-absent active plan, new input, immutable manifest/
all consumed original/current source/job/spend/probe/code/body/trace evidence,
original prepared inode/owner/mode/link/bytes, operation nonce and unchanged5s
writer deadline. Unexpected destination creation, late changes or uncertain/
partial durability keep failure ownership, never overwrite/refund/reset.

CAS alone updates input_sha256, appends
`active_preparation_history:[input.active_preparation]`, imports fresh attempt
count/bytes once, and assigns the new active plan to the otherwise empty active
slot. Controls and every prior history/case/reservation/page/error/trace cost
remain exact. A second committed or partial/uncertain active handoff refuses;
any spent active context precludes preparation replay. No controls planning/
SDK20 replay, context21 or generic retry. New plan `active_preparation_attempt:1`
is active-only, requires existing capture/native-body/scope markers and
source_hashes.active_preparation. It selects only active3–16 and approved
cumulative totals. Earlier plan formats remain exact.

For this branch, the current planning snapshot is the **new fresh resource
receipt**, not the stale controls-current-resources file. Existing
source_hashes.resources/current_resources may both bind that fresh receipt;
the old controls_resources Ref remains separate immutable history. No synthetic
current receipt is written. Current scope/source checks and subsequent actual
API comparisons remain mandatory. Future restore uses this reviewed plan's
source footprint and the corrected fresh-branch verdicts.

The pure source DTO gains only optional `resources.active_preparation`, exact
fields `manifest,state,prior_input,prior_plan,prior_approval,run_result,
controls_resources,historical_sources,qualification,native_probe,sdk_probe,
spending,budget,delegation,trace_grant,controls,traces`.
All except controls/traces are exact `{value,ref}` records matching manifest/
typed source bindings. Controls is exactly the ordered17/20 pair
`{source:Ref,plan:{value,ref},capture:{case,network,normal_page,trace,adobe_bodies?}}`,
reusing the existing case-checker view and original17 plan discovery/lineage.
Case source Refs equal the old state;20 plan equals prior_plan;17 plan is the
original bound plan from its existing qualified lineage, not caller choice.
Trace views are the existing bounded projected `{events,bytes,count,errors}`;
disk loading separately verifies every original trace part, normal body and
native original file. Traces is exactly six ordered spent-context records
`{ordinal,case:{value,ref},trace:{value,ref}}`, original raw case and trace-index
metadata with exact protected bindings; pure totals derive from their metadata,
never counters/pass booleans alone.

**Original-state proof clarification — 2026-10-20 (scoped frame PASS):**
The original state values for failed1/2/18 are available to the disk loader but
were omitted from the closed pure DTO above. For these three ordinals only,
each trace record additionally requires `lineage_state:{value,ref}`; forbid the
field on17/19/20, whose original case Refs are already present. This does not add
an eighteenth top-level field, another manifest Ref or another proof partition.
The exact original state Ref and original case Ref are:

| Ordinal | `lineage_state.ref` must equal | Case Ref within `lineage_state.value` |
|---|---|---|
| 1 | `prior_input.value.controls_continuation.state` | `stages.controls.cases[0]` |
| 2 | `resources.recovery.manifest.state` | `stages.controls.cases[1]` |
| 18 | `resources.bootstrap.manifest.state` | `stages.controls.cases[1]` |

Each value is the original compact-JSON state already read by the existing typed
loader, not a projection or newly written state. Require its state kind/version,
baseline identity, recorded context membership and complete compact-JSON hash
to match its bound Ref before using the case Ref. Bind19 directly to
`resources.capture.carryover.state.value.stages.controls.cases[1]`; bind17/20 to
the already required original control Refs. Thus all six case Refs must equal
original lineage, not just canonical paths and self-consistent new hashes.
Keep the six-record trace partition's existing byte/node/depth limits; these
three state records do not receive independent limits. Disk loading must reuse
the existing protected original-state reads and include their physical files in
the unchanged final evidence fences. No historical file, state, source pin,
grant or spent cost is rewritten, and no new live read or execution authority
follows from this clarification.

Use three fixed descriptor-safe proof partitions (header, controls, traces),
each retaining snapshot's262144-byte/10000-node/depth16 bounds. No generic
reader/pure-data ceiling is raised; reject unknown fields/proxies/getters/
toJSON/cycles before reading caller values, then compose the closed view.
**Fixed partition packing clarification — 2026-10-20 (scoped frame PASS):**
Actual read-only source assembly succeeded, but grouping both complete control
plans with their captures produced275967 bytes in the controls partition,
over262144. This was an internal proof-layout refusal before any canonical
handoff or new SDK context, not failed vendor behavior.
Keep exactly the existing three partitions and their original ceilings. Pack
the supplied control20 plan record in the header beside its existing15 metadata
records; leave the complete control17 record and control20's source/capture in
the controls partition. Traces are unchanged. Reattach that same supplied plan
after bounded cloning to restore the exact original external control DTO.
The temporary header slot is constructed internally, never accepted as another
caller field or substituted from prior_plan. No field/value is dropped,
deduplicated, rewritten or reconstructed, and original case/plan/body hashes
and all source readers/fences remain mandatory.

Inspect the exact two-element controls array and second control shell through
descriptors before extracting the plan: reject proxy, wrong prototype, holes,
extra/symbol keys and accessors before reading caller values. Deep hostile data
still passes through the same bounded snapshots; unknown fields/cycles/toJSON
must not escape because of packing. The measured actual packing is
header223384 bytes/5375 nodes/depth12, controls199735/7678/depth11,
traces116498/3403/depth13, each inside its original bound. Tests must exercise
all three actual packed call sites, their exact ceilings and hostile shells,
plus an oversized combined control proof that becomes admissible only through
this fixed packing. The external17-field DTO, four exports, number of proof
partitions, general limits, observation fidelity and genuine authority stay
unchanged. Preserve the unadmitted first candidate and its refusal; a new
source-qualified candidate may reuse the same already-spent six-read receipt
only while still fresh, without replaying it or adding a history entry before
the first canonical handoff.

Original capture proofs are validated against the prior061 input/time/source
channel, not the new active code or expanded totals. Current effects require
the independent new CODE/qualification/owned-source channel. Four exports,
fixed CLI and native dispatch capability surface stay unchanged.

TDD: absent/invalid/future/unrelated or rebound trace authority refuses before writes; old
profiles unchanged; original17/20 and all failures requalified/preserved;
closed fourteen-source map, expected-digest/path/policy isolation and current
physical source tampering despite matching historical digest; opaque sources
never execute; full snapshot partition hostile-input bounds; exact retained
trace sums/derived totals, no dropped/double counts; current fresh snapshot/
spending/cost/counter once-only guards; both actual plan/state CAS destination/
late-evidence/prepared-file/nonce/deadline/uncertain writer cases; synthetic
new active3–16→observe/independent stop with unchanged native body and post-pass
restore refusal guards. No real SDK/context/metadata/source action by fixtures.
Final current-source native qualification, fresh API/setup/source proof,
actual full read-only/disposable5s measurement, separate exact operational/
five bindings/12READY and a new coordinated fixed window remain live gates.
No actual grant, fixture pass or historical alias supplies them automatically.

### Bounded unstarted active replan — framed contract, 2026-10-20

Scoped preimplementation frame review PASS; implementation/reviews remain open.

The first active plan was locally admitted but never approved, prepared or run.
Its initial resource receipt would expire during the mandatory15-minute Target
approval wait plus14 measured cases. The parent cancelled the entire window
before any Target/site/SDK effect and released the other lane's hold. Preserve
the admitted plan and its imported6/3481 costs; do not backdate receipts, waive
freshness, replay its collector, clear history or race the remaining clock.
This adds one explicit refresh of that untouched active plan, not a retry of a
case. Original controls17/20 and every failed case remain unchanged.

#### Closed input and eligibility

Add optional inline input `active_replan:{state:Ref,input:Ref,plan:Ref,preparation:Ref}`,
requiring active_preparation. All four are distinct protected immutable Refs,
not canonical state/controls-plan/active-plan/lock/config/replacing-input paths.
The retired input has active_preparation but no active_replan; preparation
equals its active_preparation Ref. Its input/plan/state hashes match each other.
The plan is active, with active_preparation_attempt1 and the fixed3–16 roster.
Its stage is exactly emptyStage with only plan_sha256 assigned: unstarted,
approval/preflight/verification null, cases/effects empty. No active artifact,
context, reservation or failure-owned lock may exist.

The exact retired state is derived from the original post-controls351 state by
ONLY the original admitted input SHA, singleton active_preparation_history,
its six preparation calls/3481 bytes and the active plan SHA. All other bytes'
values, including controls, reservations, pages, errors, resource_current,
cleanup, reference and older histories remain deeply equal. The actual result
is637/8665150 normal,52/41748 cleanup, six original contexts and nine SDK
reservations. Require canonical state/active-plan bytes to match these retired
Refs through admission. Already-approved/prepared/verified/running/failed,
partial/uncertain, spent-active or already-replanned states refuse.

The new input differs from the retired input only in resources, code_pins,
active_preparation and the added active_replan. The new preparation manifest
keeps the exact original control state/input/plan/approval/run/resource/source
anchors; only its current recorder_qualification, preparation_spending and
operational_budget Refs change. Original setup/authority, SDKs, query opt-outs,
reference assets and all existing history fields stay equal. No setup renewal
or shared-source qualification change is implicit.

#### Typed original spending and current authority

The pure DTO adds only `resources.active_replan`, closed records
`state,input,plan,preparation,spending,resources,budget`, each exact `{value,ref}`.
The first four equal the inline input Refs; spending/budget match the retired
manifest and resources matches the retired input. The complete seven-record
component has its own fixed existing262144-byte/10000-node/depth16 snapshot
bound; no generic bound changes and the active proof's existing three packed
partitions remain unchanged. Actual retained values occupy124414 bytes,
3177 nodes and depth12. Reject unknown fields, hostile descriptors and aliases
before caller-value access. No caller-selected inventory or recursive profile.

Validate the old plan/input/manifest/budget/spending/resource records at the
old plan's genuine planned_at. In particular, derive the original imported
6/3481 from its original recovery-spending attempts, resource Ref and old
bounded delegation, not just counters. Old plan code pins equal old input pins;
the old manifest SHA matches its plan and state. These are unstarted planning
records, not SDK measurements or executable authority: preserve their source
archive as opaque data, never execute it or substitute old code/qualification
for current physical CODE and new current qualification. All original executed
control proofs still pass their existing historical-source channel.

The new bounded operational budget keeps the exact original authority and
limits/reason, with actual later recorded_at. Fresh preparation is a newly
reviewed one-use six-read job plus any genuine failed-read costs, observed after
that adjustment. New resource/spending Refs must differ from the already
imported old receipts. Read source/fixtures only after code/job review; perform
no real refresh before all current proof shapes and source qualification are
ready. Never replay the consumed first job or relabel its six successes.
The new state imports ONLY the new preparation count/bytes: another clean six
reads would yield643/8668631 normal, not refund or recharge the prior637.

#### Replacement and subsequent operations

Only plan --stage active can initially use this discriminator. Keep the
canonical controls plan unchanged. Both existing non-yielding five-second CAS
boundaries require exact retired state/input/active-plan and all consumed
typed evidence, current input/source/qualification, prepared inode/device/
owner/mode/link/bytes and operation nonce. First replacement requires the
canonical active plan to equal the retired plan; state replacement then
requires it to equal the newly prepared plan. Unexpected destinations, late
drift or partial/uncertain durability retain failure ownership, never reset.

The state changes only input_sha256, new preparation counts, the still-empty
active slot's plan SHA, and active_preparation_history from `[old]` to exactly
`[old,new]`. Preserve the old entry and every other history/case/cost/value.
No additional mutable history field or context is needed. The new active plan
adds active_replan_attempt1 and source_hashes.active_replan equal to the
existing canonical fingerprint of the inline four Refs. Its active preparation
and native markers/current source hashes remain mandatory. It still runs only
the unspent3–16 once; no20 replay,21 or retry of a spent active case.

State-schema/history checks, planning snapshots, source loading, both writers,
prepare/verify/run/observe and independent stop must distinguish the exact
precommit `[old]` from committed `[old,new]`. No other operation may use a new
input before its committed input hash/history/plan binding. A second renewal
or a retired input already carrying active_replan refuses. Independent stop
may omit traffic-only proof as before, but not owned plan/state/spending
lineage; validate historical receipt ages at their own time while preserving
fresh actual resource comparisons and honest current cleanup verdicts.

TDD: successful source-forward unstarted replan and current-source isolation;
coherent Ref/value/old-spending edits, nonempty stage, active artifacts,
approved or spent states, recursive/second renewal and canonical races refuse;
new costs import once while all old values remain; exact seven-record hostile
bounds and unchanged three packed proofs; both CAS/prepared-file/nonce/deadline/
uncertain-lock paths; synthetic new run/observe/stop retains controls and every
failure without another context. All source/native/public-pure/actual5s,
five-review operational,12READY/served and new quiet-window gates still apply.
This framed contract is not implementation or current live permission.

### Owner-approved interrupted-active recovery — 2026-10-20

The owner explicitly approved recovery at2026-10-20T23:27:34.002Z after
confirming unchanged setup at23:21:46.067Z, valid throughOctober21 at the same
time. The approved boundary is one reviewed ownership handoff, retaining every
original and cost, then only the14 unexecuted cases with session-independent
execution and bounded independent stop. No passed control/event replay,
unreviewed operation, extra case, privacy/acceptance change or wider resource
access follows. [ADR-0033](../../decisions/adr-0033-interrupted-active-ownership-handoff.md)
records the design choice; this new contract requires frame review before code.
The combined ADR/contract frame review passed before implementation; this
does not establish runner/stop qualification or actual admission.

Grounding: interrupted canonical state8b9/input681/plan472/approval0b1/lock9ce
record running with only verified schedule/approval effects, no active case,
contexts[1,17,2,18,19,20], SDK9, normal697/9231050 and cleanup52/41748.
The exact cause/time of process disappearance is unknown. The separate,
verified stop restored SAVED and prior schedule and verified disabled source
aba9; its eight durable cleanup attempts consumed6255 bytes. Original state,
lock and empty result are retained, not relabeled. The new owner grant is a
separate genuine receipt, not one of the earlier unavailable answers.

#### Closed recovery identity and proofs

Add only inline optional input `interrupted_active_recovery`, exactly twelve
Refs: `state,input,plan,approval,lock,stop_result,stop_journal,grant,renewal,
historical_sources,spending,qualification`. Require existing active_preparation
and active_replan. The old input contains neither this discriminator nor any
prior interrupted recovery. Its original active_preparation and active_replan
bindings remain unchanged; no third preparation-history entry or generic retry.
Fingerprint the twelve Refs with the existing canonical fingerprint helper
as source_hashes.interrupted_active_recovery. Earlier schemas stay exact.

Pure resources gains optional interrupted_active_recovery with exactly fifteen
`{value,ref}` records: the same twelve names, plus
`confirmation,preparation,budget`. Bind the first twelve to the inline Refs;
confirmation to renewal.confirmation, preparation to oldInput.active_preparation,
and budget to that old preparation's operational_budget. Current resources
remain the existing snapshot/new input resources. Use one existing
262144-byte/10000-node/depth16 snapshot bound for this component, not a generic
quota increase. All existing three packed active-proof partitions stay as-is.
Reject unknown roles, proxies/accessors/toJSON/cycles before caller access.
Measure the final actual component; a similar candidate's153612 bytes/4093
nodes/depth12 is grounding, not automatic qualification of this final shape.

All source Refs are distinct except specifically required original-source role
overlaps. Exclude canonical state/active-plan/controls-plan/lock/marker/config
and replacing input from immutable aliases. The marker and canonical files
remain separately pinned current mutable facts. Immutable copies must retain
the exact original supplied digests; no hash of newly observed bytes becomes
expected authority.

The grant is closed `airlock.owner-interrupted-active-recovery`v1:
`received_at,owner_statement,request_context,prior_state_sha256,prior_lock_sha256,
prior_input_sha256,prior_plan_sha256,prior_approval_sha256,eligible_cases,
original_evidence_and_lock_retained,all_spending_and_failures_retained,
session_independent_runner_required,independent_bounded_stop_required,
passed_control_or_sdk_event_replay,new_cases_or_resource_scope,
code_reviews_and_live_readiness_waived,setup_receipt`.
Require the genuine statement `yes, i approve the recovery`, exact old five
digests and eligible[3..16], the four retention/runner/stop flags true, the last
three replay/scope/waiver flags false, and setup_receipt equal to the genuine
confirmation Ref. Its canonical received_at follows interruption and verified
stop and is nonfuture. Generic reminders and unavailable responses never qualify.

Require the exact old lock's baseline/run operation/nonce and exact interrupted
checkpoint: original six contexts/nine reservations and all pages/control
cases/failures remain; active cases are empty and no3–16 artifact exists.
Its only effects are the recorded verified activity.schedule/activity.approved.
PID death is corroboration, not authority to unlock or proof of quiescence.
Reject recursive/second recovery, mixed/foreign/partial ownership or any spent
active context. Both old metadata and cleanup ledgers are unreplenished.

Validate old plan, approval, input, original source/probe/report lineage at
their own genuine recorded times and hashes, including all original controls
and failed traces. The interrupted executor map uses the same closed fixed
nine CODE/seven body-freeze roles/fourteen unique protected copies. Its scope
is old read-only validation only; retain the existing original control map
independently. Exit each retired alias scope before current physical source
checks, including equal-hash files. No original archive/code executes, global
clock override, cached semantic PASS or synthetic reset-state projection.

Validate stop_result against the full final stop_journal: exact interrupted
state/lock hashes, eight ordered charge-before-call attempts, received statuses,
actual bytes, successful SAVED/prior schedule readbacks matching original owned
effects, and disabled-site/source provenance. A success boolean alone is not
evidence. Derive cleanup60/48003 by adding8/6255 once to52/41748; preserve
normal697/9231050, all prior costs and trace totals. Add only the new spending
receipt's actual attempts; six clean new reads would yield703/9234531 normal.
The consumed earlier collectors and their imported costs are never replayed.

**Existing stop serialization prerequisite — 2026-10-21 (scoped frame PASS):**
The old stop_result and twenty-five journal snapshots already exist; do not
invent their types or rewrite them into a new old receipt. Their exact schemas
are below. The original final snapshot alone has no hash links to its prefixes
and cannot establish the historical reservation sequence by itself.

Keep the twelve inline Refs and fifteen proof records unchanged. Define
stop_journal as a Ref/Record to one NEW immutable
`airlock.adobe-stock.interrupted-stop-evidence`v1 index, with exact fields
`recorded_at,result,journal,snapshots,writer_source,core_source,reviews`.
Result equals input.stop_result; journal is exact `{value,ref}` of the
UNCHANGED original final raw snapshot. Snapshots is exactly25 ordered Refs,
with snapshots[24] equal journal.ref. Reviews is exact `{initial:Ref,closure:Ref}`.
The index is a new catalog, dated at its actual later creation time, not a
claim that a linked index existed during cleanup. Its typed journal.value
must hash back to its exact original compact JSON bytes; no invented values
or reconstruction of missing source artifacts.

Every snapshot is protected and named journal-001.json through journal-025.json
in the original stop_result.journal_directory, with fixed order and distinct
Refs; reject missing/extra files, aliases, links and canonical mutable paths.
All expected hashes come from the immutable reviewed index before admission,
not from scanning observed bytes into a successful audit. Disk loading reads
and verifies all25 expected original files plus original writer/core/review
Refs; catalog and final fences retain each physical Ref and reader policy.
The two source roles are opaque original serialization code, never imported
or executed and never substituted for current role implementation authority.

Pure validation checks the closed index, role bindings and full original
final journal semantics. It does not claim to have read all prefix bytes;
disk loading additionally checks their exact bound order/progression. The
new final index occupies12808 bytes including the original5861-byte final
journal value; the final fifteen-record component must still fit its one
original snapshot bound. No sixteenth record or extra quota is added.

The existing raw stop result is closed
`airlock.private.interrupted-active.stop`v1, exactly:
`started_at,ended_at,target,schedule,site,target_observed_at,site_observed_at,
errors,no_sdk_or_context,retained_operation_lock_unchanged,
canonical_state_unchanged,cleanup_calls,cleanup_bytes,journal_directory,
canonical_cleanup_counters_not_yet_imported,source_pin`.
Require target verified_saved, schedule verified_original, site
verified_disabled, errors[], the four retention/no-SDK/not-yet-imported flags
true, calls8 and bytes6255. Source pin equals the original state/reference and
verified site record. Times are its actual canonical timestamps; these old
facts are not current readiness. Its original stdout serialization is compact
JSON followed by one LF, which must be retained if deriving its source hash.

Each raw snapshot is closed
`airlock.private.interrupted-active.cleanup-journal`v1, exactly:
`recorded_at,retained_state_sha256,retained_lock_sha256,attempts,
observed_records,status`. Retained hashes equal the explicitly approved old
state/lock. Attempt records are exact
`{ordinal,purpose,status,bytes,upper_bound}`. Eight fixed purposes are, in
order: cleanup.authentication, cleanup.activity.read, cleanup.activity.state,
cleanup.activity.read, cleanup.activity.schedule, cleanup.activity.read,
cleanup.site.disabled.read, cleanup.source.remote-read. Every newly reserved
attempt first appears as reserved_failed/upper_bound true, charging16384 for
authentication or65536 for the other purposes. Its subsequent received version
uses actual nonnegative bytes and upper_bound false; final sum is6255.
Ordinals, prior finalized attempts and prefixes cannot change or disappear.
All recorded_at values are nonfuture and nondecreasing; the final recorded_at
may follow result.ended_at because that timestamp precedes the final durable
write. Do not backdate it to make a false end-before-write ordering.

Snapshot status is exactly one of: `{phase}`; the original13-field core result
(the stop result above without cleanup_calls/cleanup_bytes/journal_directory/
canonical_cleanup_counters_not_yet_imported/source_pin); or that core result
plus `inverse_intent:{operation,before,expected_after}`. Operation is only
activity.saved or activity.schedule. Phase is one of the eight purpose strings
or activity.read/site.disabled. Nullable unfinished times and unknown states
are valid only in nonfinal snapshots. Final status exactly matches the
13-field core of stop_result, with no inverse_intent and all verified outcomes.

Observed records are exactly three chronological
`{purpose:"activity.read",at,value}` records plus one terminal
`{purpose:"site.disabled",at,config_sha256,head,remote_sha256,worktree_clean}`.
Target values use existing owned-activity validation, comparing full preserved
fields while ignoring only vendor modifiedAt/modifiedByName and allowing
equivalent canonical instants for schedules. The first matches an original
known approved effect, the second matches its SAVED-only inverse, and the third
matches the original plan's SAVED/prior schedule. Site record requires clean,
matching local/remote head and the original disabled configuration hash.
Inverse-intent before/expected values must bind those same owned transitions.
Prefix observed records are never overwritten/reordered or invented.

Require first-reserved/first-received snapshot pairs for attempts1..8 at
(2,3),(4,5),(8,9),(10,11),(15,16),(17,18),(21,22),(23,24), respectively.
SAVED intent is in snapshot7 before attempt3; schedule intent is snapshot14
before attempt5. Final snapshot25 binds the exact terminal record and result.
These protected original prefix images plus the pinned original writer's
awaited reservation/intent protocol support ordering; they are not a vendor
transport timestamp, a retroactive hash chain or a new owner approval.
Tests must reject corrupted/permuted/rebound prefix sources, charge tampering,
missing intent/before images, contradictory terminal targets and forged
summary-only records without admitting a case or changing current ownership.

Reuse the closed setup-renewal `{confirmation,previous,current}`:
previous equals old input preflight, current equals new input preflight, and
new setup_confirmation equals confirmation. Only the existing observed/expiry,
approval-date, routing assessment/pin-confirmation, workspace-confirmation and
provenance record_ref leaves may differ. Authority identity, selectors, scope
flags, screenshots, credential identity and false configuration-API claims
stay equal. Top authority dates equal the actual confirmation dates. Everything
else in the new input matches old except resources/code_pins/this discriminator.
No implicit later renewal or extension beyond the current genuine receipt.

New spending uses the existing recovery-spending schema, only a newly reviewed
one-use six-read job plus every genuine new failed attempt, after the recovery
grant and current qualification. Fresh owned resources must be SAVED with the
restored prior schedule. Do not collect before proof shapes, code, source/tooling
qualification and exact collection job reviews are ready.

Current qualification is closed
`airlock.adobe-stock.interrupted-active-qualification`v1 with
`observed_at,interrupted_input,historical_qualification,source_freeze,
runner_source,stop_source,method`. Method is exactly `read-only-public-pure`;
source_freeze enumerates the fourteen literal logical paths in CODE union
BODY_FREEZE_PATHS, with overlaps one key. Bind runner_source to
`probes/adobe-compatibility/stock-baseline-recovery-runner.mjs` and stop_source
to `probes/adobe-compatibility/stock-baseline-recovery-stop.mjs`, their fixed
implementation modules. Actual plan-bound launch wrappers and receipts stay
private. Check those current physical bytes, not arbitrary executable paths. Historical
native/SDK qualification remains at its own real time/source map. It may
establish the unchanged native path only when all non-operator CODE files and
the native browser/recorder files still equal their original pins; changing
those requires actual matching fresh native qualification instead. Never claim
that read-only operator qualification executed the SDK. Admission recomputes
all applicable current rules and expected-file checks; the receipt is not a cache.

#### One guarded ownership and journal handoff

Reuse offline-planning-abort.marker.json as a durable hard block, with closed
kind `airlock.adobe-stock.interrupted-active-recovery-owner`v1 and fields
`baseline_id,recovery_sha256,input_sha256,old_state_sha256,old_lock_sha256,
old_nonce,owner_nonce,phase,plan_sha256,committed_state_sha256,execution,stop_result`.
Initial phase intent; later owned/committed/stopping/terminal are monotonic.
Plan/state/stop_result start null. Compare complete prior marker bytes on every
change. Unknown, foreign or partial markers refuse, never overwrite them.

Complete the full audit before marker/credential/command effects. Create marker
exclusively and fsync it while retaining the old canonical lock. Prepare a new
ordinary lock with a fresh owner nonce. Under the existing synchronous
prepared-file/owner/mode/link/inode/device/bytes/evidence/nonce/five-second fences,
compare exact old canonical state/active-plan/lock/marker and immutable originals,
then replace the lock by guarded rename, never unlink-first. Require directory
durability; uncertain replacement keeps the marker/current owner and refuses.

Publish new active plan only against exact old state/old plan images, then
publish derived state against exact old state/new plan. Controls-plan bytes
stay unchanged. Each existing five-second publication does a fresh complete
typed audit and final expected-file check, not a cached verdict. Marker commits
only after both images and directory durability are confirmed. Distinguish old
images, new-plan/old-state partial images, durable committed images and foreign
images from actual bytes, not marker phase alone. No automatic rollback,
repeated consumption or finally-release of unknown ownership.

New state preserves controls, prior histories, contexts, reservations, pages
and errors. It updates input_sha256, the derived cumulative cost ledgers,
validated current stopped resource/reference/cleanup facts, and a new empty
active stage whose only initial populated field is the new plan SHA. Preserve
the old RUNNING stage in immutable source evidence, not as a rewritten failure
or success. Add exactly one interrupted_active_recovery_history entry:
`{recovery_sha256,interrupted_outcome:"interrupted",cause:"unknown",terminal_stop:null}`.
Only terminal_stop may later move once to the uniquely reconciled stop Ref.
Keep active_preparation_history exactly the existing two original Refs.

New plan has interrupted_active_recovery_attempt1, the fingerprint, current
physical source hashes and exactly cases3–16. Generate fresh run IDs/window
normally. Recovery-specific artifact names must not overwrite the old phase's
preflight/verification/results/current resources. Only the archived, guarded
canonical state/active-plan slots may be replaced. No new SDK case, replacement
sample, replayed control or later replan/recovery is admitted.

#### Two finite execution roles and sole cleanup writer

Keep four exports and fixed CLI grammar. Only runBaselineCli may gain optional
descriptor-validated `recovery_owner:{role,recovery_sha256,owner_nonce,role_nonce}`;
role is handoff/runner/stop. This is ownership metadata, not authority by itself.
Require matching durable marker, fixed tooling pins, reviewed input/plan/approval
and allowed phase; non-recovery callers retain the old callable behavior.

Marker.execution is null, then closed
`{plan:Ref,approval:Ref,runner,stop,stop_at,exit_at}`. Each role is null until
one-time registration of `{pid,started_at,nonce}`. Registration alone authorizes
no live effect. Only the actual ready stop role plus both fixed registered
sources permits prepare/verify/run. PIDs/nonces alone never prove ownership,
termination or quiescence; verify the exact owned process identity/tree.

The parent launches both fixed finite roles with supported host detach mode,
not raw background/nohup, a service install or “keep chat open.” Each has a
separate durable result channel. The runner first waits inertly for actual stop
readiness, then performs only the reviewed preparation/verification/run.
Fence every mutation, context/SDK admission and late writer on current marker
phase and ownership. No case replay or failed-stage resumption.

**Managed browser prerequisite — 2026-10-21 (scoped frame PASS):**
The existing runStockBrowserCase launches Chromium internally
(`stock-baseline-browser.mjs:901`) and exposes no launch-time ownership or
physical termination handle. Reporting a PID after launch in the runner leaves
a race if it dies before registration; sampled parentage after death cannot
prove no orphan browser. The recovery stop role must instead own the entire
launch promise, BrowserServer and physical ChildProcess. The runner never
launches Chromium in recovery. Ordinary callers retain exactly the existing
chromium.launch arguments, context, recording, dispatch and close behavior.

Permit only optional internal `recovery_browser:{binding,acquire,release}` on
runStockBrowserCase. Binding is exact
`{plan_sha256,case_ordinal,run_id,lease_nonce}`: derive it from the admitted plan/
selected case3–16 with a fresh single-use internally generated nonce. The fixed
runner builds the two callable capabilities, additionally bound to recovery/
owner/registered-role nonces. They are not JSON-supplied implementations, CLI
options or arbitrary browser factories. Admit no executable, endpoint, PID,
source path or launch-options argument through this interface.

`acquire(binding)` returns exact `{binding,browser}`; browser is an opaque
Playwright connection created by the fixed lease client, never JSON authority.
`release(binding)` returns exact `{binding,terminal:Ref}`. Descriptor-check the
capability/binding/result envelopes before access: exact data keys, ordinary/
null prototypes, no proxies/accessors/symbols/extra fields and callable,
non-proxy acquire/release. Do not recursively serialize the native Browser
object. Results must echo the exact case/plan/run/nonce binding. Duplicate
release for that same lease returns the same immutable terminal Ref without
another launch/inverse/charge; any different binding refuses.

The stop role validates current marker, role identities, source pins, plan/
approval, time and unused case/lease; persists intent before launch; then calls
chromium.launchServer with fixed existing headed/timeout/Chromium arguments,
loopback listener, ephemeral port and a new unguessable WebSocket path.
It retains the launch promise even after timeout or runner loss. Before
publishing ready it obtains the actual BrowserServer.process ChildProcess and
durably registers OS identity/containment evidence. Only then may the runner
connect through chromium.connect to that exact protected endpoint. Never
publish readiness or allow a case/SDK from an unresolved launch. If the runner
dies during launch, fence the lease and close any subsequently returned server,
never offer it to another case. Unresolved launch is unknown, not quiescent.

Use a fixed protected per-case channel with exact kind
`airlock.adobe-stock.recovery-browser-lease`v1 and fields
`recovery_sha256,owner_nonce,runner_nonce,stop_nonce,binding,phase,process,
endpoint,terminal`. Phases launching→ready→closing→closed; terminal unknown is
allowed from an unsettled phase. Process/endpoint/terminal begin null.
Process is exact `{pid,uid,ppid,pgid,start_identity}`, derived from the retained
physical handle plus current OS evidence, not caller claims. PID/parent/group
are positive safe integers, UID is the actual owner and start_identity is a
bounded nonempty OS start identifier checked again before any forced stop.
Endpoint is a private loopback WebSocket URL, never a public report field.
Terminal is an immutable Ref. Every transition compares and fsyncs complete
preceding bytes; foreign/mixed/late leases do not become ready.

The browser helper retains existing cold context creation, observers, gate,
recorder, trusted action and measurement windows. Its recovery finalizer closes
the local context, then releases through the stop owner instead of terminating
Chromium itself. The lease client disconnects its connection and requests the
independent physical close. Stop also initiates that close on runner loss or
cutoff. Release failure must escape as cleanup_incomplete, not be swallowed
into a successful case result. All launch/connect/close work consumes the
existing absolute case/stop deadlines; no additive timeout extends authority.

Verified closure requires admission fenced, actual physical-child exit/reaping
through the retained handle, accounted owned descendants terminated, established
launch-owned containment empty, private endpoint closed, and durable terminal
evidence matching this lease. BrowserServer.close resolution, close event,
root-PID absence, a successful signal or runner death alone is insufficient.
Do not grant generic process-group killing. Explicit forced stops target only
freshly rechecked, positively owned individual identities. Unaccounted/escaped
descendants, ambiguity, unresolved launch or failed closure remain unknown.

The implementation may define closed, bounded internal terminal evidence
inside the two fixed role modules; it may not add another broker/framework,
caller-chosen inventory or source capability. Its production shape and reader
must be documented and covered by causal tests before review. An unrelated
sentinel process must survive every forced-close test.

TDD additionally covers unchanged ordinary launch, hostile/wrong/replayed
bindings, loss before launch promise settlement, readiness-before-identity,
tampered endpoint/identity, normal/lost/hung/late-connection/deadline closure,
close resolving without exit, surviving/escaped child, endpoint still open,
finite unknown outcome and idempotent duplicate release. SDK-absent actual
managed Chromium launch/connect/loss/close qualification and fresh matching
native-source qualification are mandatory because the browser-helper bytes
will change. Neither may be replaced by the old R10 qualification.

Grounding probes on2026-10-21 at00:15 UTC used headed Chromium151.0.7922.34
with no SDK/provider/owner-API requests: terminating a synthetic runner after
connection and while owner launch was still pending both left the separate
owner able to close the browser. The retained child exited, the observed owned
process IDs disappeared, the launch-owned group was empty and the loopback
endpoint refused connections. These are actual feasibility observations, not
qualification of the production lease protocol, host failure or unobserved
possible descendant behavior. No canonical state or failure lock changed.

The stop helper is the sole recovery inverse writer for both normal and failed
completion. Runner success/error cleanup requests are routed to that owner,
not a concurrent independent inverse. Reuse createController.cleanup with the
appropriate preservePassed outcome and an isolated journal-backed state image,
fixed stop-role guards and existing owned comparisons. Do not implement a
second generic vendor mutation client. Charge its authentication/requests
durably before transport and preserve the entire stop delta.

Stop on normal completion, runner loss, failed admission or the earliest
existing traffic cutoff. Derive stop_at as the minimum of plan.window_end and
current resource receipt.observed_at+3600000; exit_at is plan.expires_at, and
both must be covered by current genuine authority. Do not wait past a known
earlier source/receipt gate. Before inverse work, fence all new runner effects
and establish owned runner/browser/Git quiescence; sent-but-ambiguous writes
remain ambiguous until readback. Only exact registered owned PIDs may be
stopped, never name-based/broad process killing or arbitrary callers' processes.

The helper never unlocks, replans, retries or dispatches SDK work. It independently
verifies site disabled, Target SAVED, restored original new-plan schedule and
reference ownership. On normal completion the runner may import this unique
final stop count/bytes and terminal Ref once under marker guards. On runner
loss retain canonical failure ownership and the external stop journal. No
verified-stop claim from a killed process, successful signal send or clock
expiry alone; unknown quiescence/readback means cleanup-incomplete.

Admission must reserve the full normal work plus independent stop authentication,
source checks, inverse, persistence and readbacks against the cumulative limits;
prove headroom rather than assume it. Existing caps remain unless the original
numeric delegation supports an explicitly reviewed finite adjustment. Per-case
limits/observation fields/windows/native notifications never relax.

Hermetic TDD covers exact owner grant/nonce/hash binding, cleanup/spending once,
renewal whitelist, retired/current physical source isolation, fifteen-record
bounds/hostile descriptors, all partial marker/lock/plan/state boundaries and
original five-second late prepared-file/evidence races. Prove normal strict
stop, runner loss, hung runner, late writer, stop-helper failure and unrelated
sentinel process survival. No actual SDK/browser/vendor/private baseline action
by fixtures. Actual read-only public-pure/source/writer proof, current facts,
exact five review bindings,12READY/served proof, actual stop-helper readiness
and a fresh coordinated window remain mandatory before new live work.

### Owner-approved same-owner prelive reschedule — 2026-10-21

**Combined frame PASS; offline implementation only.** The genuine
13:31:49.496Z owner answer approves the bounded design/implementation exception
in accepted [ADR-0034](../../decisions/adr-0034-same-owner-prelive-rescheduling.md), not
browser closure, setup renewal, a new window or live activation. This section
narrowly replaces the preceding no-later-replan rule for the one
cancelled, never-started checkpoint. All other interrupted-handoff rules remain.
There is no second interrupted recovery, generic retry or failed-stage resume.

#### Exact checkpoint, input and separate identity

The eligible checkpoint is cancelled input48ad/state95ac/planA25/markerA642/
lock93d from the dated witness. Supplied expected digests must match immutable
copies and current canonical images; never turn newly observed bytes into
expected authority. The marker is committed with execution/stop_result null.
The active stage has exactly the existing empty-stage fields with only its
plan SHA populated: no approval/preflight/verification/cases/effects.
Require contexts[1,17,2,18,19,20], nine reservations, normal703/9234531,
cleanup60/48003, both preparation histories and the one interrupted/unknown
history unchanged. Inspect the entire fixed interrupted-FID channel directory
and top-level active-case names: no execution locator, identity, readiness,
request, lease, result or case artifact may exist.

Add only optional input `prelive_reschedule:Ref`. Its closed target is
`airlock.adobe-stock.prelive-reschedule`v1 with:

```text
cancelled:{input:Ref,state:Ref,plan:Ref,marker:Ref,lock:Ref},
grant:Ref, readiness:Ref, abort_evidence:Ref, historical_sources:Ref,
qualification:Ref, spending:Ref
```

The new input equals the cancelled input except resources, code_pins and this
Ref. Its original twelve interrupted-recovery Refs, setup/preflight/authority,
reference/SDK/selector/scope fields and both preparation bindings stay exact.
Keep FID=fingerprint(interrupted_active_recovery) and the owner nonce unchanged;
RID=fingerprint(prelive_reschedule) is a separate one-use identity. Reject a
predecessor discriminator/history, second RID or replay after any intent.

The closed `airlock.owner-same-owner-prelive-reschedule`v1 grant has
`received_at,owner_statement,request_context,cancelled,eligible_cases,
same_owner_required,evidence_costs_and_failures_retained,replay_permitted,
verified_quiescence_before_publication_required,operational_or_live_approval_granted,
scope_or_readiness_waiver,setup_receipt`. Require genuine statement `yes, do it`,
the actual received time, exact cancelled copy Refs, cases[3..16], the same-owner/
retention/quiescence flags true and replay/live-approval/waiver flags false.
setup_receipt equals the cancelled input's existing confirmation. request_context
is the exact prior same-owner/no-replay/evidence-and-cost-retention question.
The earlier unavailable answer remains history, never this grant.

The expected request_context is this exact single-line literal, with no
newline folding or normalization:

```text
May I change the one-use recovery design to allow a reviewed, same-owner reschedule of this cancelled, never-started plan? It would retain all evidence and costs, permit no replay, and still require verified browser quiescence before committing a new window.
```

#### Actual readiness before another clock

Readiness is closed `airlock.adobe-stock.prelive-reschedule-readiness`v1:

```text
recorded_at,cancelled,recovery_sha256,owner_nonce,coordination_nonce,
browser_closure:{
  resource:"coordinator-owned-meta-canvas",observed_at,
  outcome:"verified-closed",evidence:{value,ref}
},
lanes:{
  observed_at,stock_helpers:"quiescent",source_helpers:"quiescent",
  worker_tests:"quiescent",evidence:{value,ref}
},
hold:{value,ref},collect_not_before,publish_by,
window:{window_start,window_end,expires_at}
```

The embedded closure evidence is closed
`airlock.adobe-stock.owned-canvas-closure`v1 with
`resource,observed_at,basis,source`; resource is the same fixed canvas, basis is
`owner-panel-close-attestation` or `supported-close-readback`, and source is an
immutable Ref to the actual observation/statement. The embedded lane evidence
is closed `airlock.adobe-stock.coordinated-lane-quiescence`v1 with
`observed_at,stock_helpers,source_helpers,worker_tests,continuity_to,source`;
the three outcomes are quiescent and source binds the actual lane observation.
The orchestrator records these faithfully from genuine observations, not
inferred prose. Pure checks inspect both embedded records; disk checks bind
their bytes and raw provenance. Bare ready booleans, unavailable answers,
navigation acceptance, timeout, PID absence, no-role evidence or an
unattributed shared browser do not establish owned-canvas closure.

The hold image is closed
`airlock.adobe-stock.prelive-reschedule-coordination`v1 with
`cancelled,recovery_sha256,owner_nonce,coordination_nonce,acquired_at,
expires_at,phase`; phase is held/revoked/released. Its fixed canonical path is
`prelive-reschedule-coordination.json` below this baseline, never a caller
path. Only the orchestrator mirrors the genuine finite coordination agreement
and any revocation/release under complete-image CAS; no cross-worktree writer,
new process-closing authority or reverse transition to held is introduced.

Closure/lane observations follow the grant, precede hold acquisition, and
attest continuity through acquisition. Acquisition precedes collect_not_before;
new preparation collection follows it. publish_by precedes window_start.
For every publication fence, ceil(actualNow/1000)*1000+900000 must not exceed
window_start. window_end is start+2700000; expiry is end+300000 and equals
the hold expiry, within genuine authority. No sliding or extension.
Reopen the exact held bytes at every publication and work-admission fence,
outside historical aliases/read caches. Replacement, revocation, expiry,
missing or unreadable hold denies publication, readiness, new effects,
browser launch and SDK work; it does not revoke existing owned cleanup.
An elapsed publish_by is only historical evidence at runtime, not a reason
to retroactively reject an otherwise-current published plan.

Chronology is code/proof qualification, actual closure and finite coordination,
then the reviewed fresh six-read job, final input/audit and publication.
Agree the exact SDK interval before publication. This reverses the prior
mistake of committing a non-replannable clock before resource readiness.

#### Original abort bytes, not a rewritten stop receipt

Use closed `airlock.adobe-stock.prelive-reschedule-abort-evidence`v1:
`recorded_at,result:{value,ref},journal:{value,ref},
readbacks:{activity:{value,ref},config:{value,ref},remote:{value,ref}},
writer_source:Ref,record_writer_source:Ref,contract_source:Ref,review:Ref`.
Provenance sources are protected opaque bytes, never imported or executed.

The actual raw result remains `airlock.private.prelive-recovery-readonly-abort`v1
with exactly `outcome,observed_at,delta,canonical_cost_imported,
canonical_unchanged,journal_uncertain,readbacks,snapshots,
hostwide_quiescence_claimed,shared_mcp_ownership_claimed,
stock_qualification_claimed,cli_exit_claimed,our_scope`.
Require verified-readonly-abort, delta4/3533, unchanged true, import/uncertainty/
all four claim flags false. our_scope is exactly execution_null:true,
role_channels_absent:true, active_effects:0, active_cases:0 and the original
fixed interpretation string; it is not host-wide quiescence evidence.

The raw `airlock.private.prelive-recovery-abort-journal`v1 remains
`recorded_at,expected_images,attempts,readbacks,status`. expected_images has
the canonical state/lock/active-plan/offline-planning-abort.marker role paths
and the cancelled expected hashes. Attempts have exactly
`ordinal,purpose,status,at,bytes,upper_bound,received_bytes`.
Require nine original snapshots: intent, then reserved/received pairs for
cleanup.authentication, cleanup.activity.read, cleanup.site.disabled.read
and cleanup.source.remote-read, in that order. Reserved charges are16384 for
auth/65536 otherwise, reserved_failed/upper_bound true/received_bytes0.
Received transitions preserve ordinal/purpose/reservation time, use actual
bytes with received/upper_bound false, and total3533. Preserve finalized
prefixes. Successful status shapes are exactly `{phase:"intent"}` or
`{phase:"reserved"|"received",purpose}`.

The two HTTP readbacks are purpose/at/status/content_type/body:Ref; remote is
purpose/at/body:Ref. Bind the index's records to those exact body Refs. Activity
is SAVED and matches cancelled plan.resource_before; configuration is disabled
and equals config_before, not the never-deployed config_disabled. The remote
body has exactly head/branch/bytes/sha256 for the original matching
refs/heads/main read. The body Refs retain semantic JSON readbacks, not an
invented claim that reserialized JSON is original HTTP wire bytes.
Final journal Ref equals result.snapshots[8]. Pure validates result/final
journal/readbacks/sums; disk also reads and validates all nine prefixes and
the exact successful directory footprint. Summary-only success refuses.

#### Historical and current source epochs

Use closed `airlock.adobe-stock.cancelled-prelive-sources`v1 with
`baseline_sources,runner_source:Ref,stop_source:Ref`. baseline_sources is the
existing closed retired-control-sources format, input bound to the cancelled
input copy. Reuse its nine CODE/seven body roles/fourteen logical files; add
only the fixed runner and stop roles pinned by the cancelled qualification.
All sixteen copies are distinct physical files except existing required
CODE/BODY overlaps. Exclude canonical path and dev/ino aliases with current
executables, mutable canonical/hold files, both earlier fourteen-file source
epochs and incompatible evidence roles. Missing aliases never fall back to
current bytes. No archived code executes.

Current `airlock.adobe-stock.prelive-reschedule-qualification`v1 is
`observed_at,cancelled_input:Ref,historical_qualification:Ref,
source_freeze,runner_source:Ref,stop_source:Ref,method`.
method is read-only-public-pure; freeze is the exact fourteen CODE-union-BODY
logical paths; roles use their fixed implementation paths. Reuse genuine R12
native evidence only as history when browser/recorder and every non-operator
CODE file equal that qualified lineage. Validate it with its own original
input/operator/test pins/time, then separately check current operator/test/
role files. Otherwise require actual fresh matching native qualification.
Do not globally relax activeQualification or label read-only work SDK proof.

#### Bounded pure proof and cumulative state

Keep all three existing packed partitions and the fifteen-record recovery
component unchanged. Add exactly one sixteen-record prelive_reschedule
component: manifest,input,state,plan,marker,lock,grant,readiness,abort_evidence,
historical_sources,qualification,spending,resources,preflight,routing,workspace.
Each is `{value,ref}`; the last four bind the cancelled input's resource/
preflight Refs, others bind the manifest. Apply one unchanged262144-byte/
10000-node/depth16 bound to this fixed component. Descriptor checks precede
access; unknown keys/proxies/accessors/symbols/toJSON/cycles refuse.

Dispatch the new branch before interrupted-active planning. Reconstruct the
cancelled planning frame using its original resources/envelopes/reference,
old source hashes and genuine planned_at. Recompute the complete cancelled
plan with the existing interrupted planner, then derive its committed state
using the same internal state constructor as original publication; require
full equality with the supplied checkpoint. Original interrupted approval
is still validated; cancelled-plan approval must remain null.

The historical loader mode is closed/internal: time only from that validated
cancelled plan, aliases only from the fixed sixteen-role map, no fresh Git/
credential/role/effect operations. Its nested original source scopes restore
the outer scope. Exit all retired scopes before current tooling/reference/
rules/evidence. Reuse raw-byte/syntax admission-local caching only, not
semantic PASSes; the mutable hold is never cached or aliased.

Fresh spending keeps the existing recovery-spending schema and one-use
six-read job. Collection follows grant/current qualification/readiness, retains
genuine failures conservatively and binds new resources. Derive normal from
703/9234531 plus the new receipt, and cleanup64/51536 by adding the verified
four/3533 once. Do not reimport old8/6255 or old6/3481.
Preserve all other ledgers/controls/failures/histories/contexts/reservations.
Add one `prelive_reschedule_history` entry:
`{reschedule_sha256:RID,cancelled_outcome:"cancelled-prelive",abort_evidence:Ref}`.
The original interrupted/unknown entry and terminal_stop:null remain unchanged.

The new plan retains interrupted_active_recovery_attempt1, adds
prelive_reschedule_attempt1 and source_hashes.prelive_reschedule=RID, and uses
fresh case run IDs and the exact coordinated window. Reserve the complete
remaining active work and independent stop cumulatively. Cleanup64 plus the
existing fourteen-call stop reserve is78 against80; caps, native notifications,
case windows and observations are not expanded or relaxed.

#### Same-owner publication and existing runtime

Add one optional closed marker field
`prelive_reschedule:{reschedule_sha256:RID,attempt_nonce,phase:"intent"|"committed",
cancelled_marker_sha256}`. Recovery FID/owner nonce/old interruption hashes
and old nonce stay exact. Keep the ordinary lock bytes and physical identity;
do not rename, rewrite, unlink or replace it.

After full audit and exact checkpoint/current readiness checks: CAS the marker
to consume intent, publish new plan against old images, publish derived state
against old-state/new-plan, then commit marker with new input/plan/state hashes
only after durability. Recompute the complete typed audit and recheck every
file/evidence/hold/nonce/prepared inode/device/mode/link/byte/five-second fence
for each publication. Classify actual old, intent, mixed plan/state and final
images; marker phase alone never establishes success. Uncertain/partial
publication keeps ownership and consumes the attempt. No rollback, automatic
retry, second exception or completion of a remaining rename.

**Final-durability prerequisite — 2026-10-21, scoped frame PASS:**
Matching committed-looking images are not proof that the publication returned
success. The witnessed final-marker rename followed by directory-fsync failure
returns4 but can leave all visible images matching. Such a result must not
authorize a job, even with an otherwise-valid RID and approval.

A rescheduled execution job additionally requires `publication:Ref`; ordinary
jobs forbid it. It names a closed
`airlock.adobe-stock.prelive-reschedule-publication`v1 record with
`observed_at,recovery_sha256,prelive_reschedule_sha256,owner_nonce,
input:Ref,plan:Ref,state:Ref,marker:Ref,lock:Ref,result:{value,ref}`.
The state/marker/lock Refs are immutable retained copies of the successful
publication's images. Input/plan match the job, state matches the committed
state digest and marker semantically matches FID/RID/owner/input/plan/state.
The unchanged lock matches the manifest's cancelled lock. Copies may not alias
canonical mutable files or incompatible evidence roles.

The result is the exact orchestrator-observed CLI outcome, closed
`airlock.private.prelive-reschedule-operation-result`v1 with
`recorded_at,operation:"plan",stage:"active",input:Ref,
controller_exit_code,process_exit_code,stdout,stderr`.
Require both exit codes0, empty stderr, and stdout parsing as the existing
stock report with operation plan, stage active, overall planned, exit_code0,
no reasons and checks.input/checks.sources/checks.ownership/checks.reference
all passed. Result/receipt
times are genuine, nonfuture and follow this plan's planned_at.
Disk reads bind the raw result bytes and every retained image; a record that
summarizes matching images, claims success over an actual failure, or lacks
the raw successful outcome refuses.

Only the orchestrator records this after observing actual successful CLI
completion, not inside the publication writer or by inspecting visible
files after a refusal. A failed/unknown CLI result never produces the
confirmation and is not retried. This evidence does not complete a rename,
change an owner, relax durability, or itself grant live permission. Before
registration, fixed role admission requires this positive outcome as well
as all existing source/approval/readiness checks. Later owned stop-only
cleanup remains governed by the separate retained-authority rule above;
this confirmation grants no work-ready or cleanup bypass.

Only the internal recovery_owner role enum adds reschedule for the existing
plan grammar. It binds the same FID and owner, not authority by metadata alone.
Rescheduled execution jobs require prelive_reschedule_sha256:RID; ordinary
jobs forbid it. Context/registration/timers/results/late writers bind the
new plan and RID, complete committed marker, current effective qualification
and, for work admission, freshly held coordination image. Pending intent
blocks old and new roles.
Select that qualification consistently in loaders and physicalPins.

The stop role has a separate internal stop-only guard, not a caller-supplied
bypass. With a fully committed matching RID/plan, exact retained owner/job/
marker/lock/source pins and genuine cleanup authority still valid through
the existing exit_at, hold loss must still permit registration for stop-only
work, transition to stopping, fencing/quiescing positively owned runner and
browser work, and the existing sole-writer inverse/readbacks/accounting.
Stop-only registration publishes no work-ready receipt and permits no browser
launch, SDK, new live effect, replan, hold rewrite or deadline extension.
If a work-ready receipt predates hold loss, its presence cannot satisfy a
later traffic guard. Preserve the lost/revoked hold and use ordinary owned
resource/source comparisons; unknown neighboring work is not quiescence or
permission to overwrite foreign changes. Ownership/source/authority failure
or exit_at still fails closed and retains the unknown result.

The existing interrupted-FID channel namespace can be reused only because all
channels were absent. Helpers never replan; stop remains the sole inverse.
Fresh five genuine review bindings,12READY/served verification, actual detached
stop readiness and existing stop_at/exit_at limits remain live gates.

**Required causal coverage:** positive pure/disk once-only paths; coherently
rebound nonempty/foreign checkpoint, controls/history/failed-cost changes;
second/replayed exception; all source epoch path/devino aliases and changed
current files; native reuse versus changed native dependencies; abort prefix/
reservation/readback/cost contradictions; unavailable/navigation-only/stale/
revoked/replaced/expired coordination; collection/publication/window bounds;
every partial marker/plan/state and prepared-file/directory-fsync boundary;
final committed-marker directory-fsync uncertainty followed by an otherwise
RID-bound job carrying the actual failed outcome, which must refuse; genuine
successful publication and confirmation must admit the corresponding low side;
validly bound stale jobs/timers/writers; full stop reserve and once-only imports;
hold loss after live effects denying all further work while the exact owned
stop still quiesces and performs the inverse before exit_at; hold loss before
effects yielding no work-ready receipt or activation;
unchanged ordinary input/export/CLI/browser behavior. Prove valid low-side
bounds before high-side refusal. Final real component and full five-second
writer measurements remain mandatory; old measurements are not qualification.

**DoD:**
**Native response qualifier correction — 2026-10-14:** The actual corrected
ordinal17 capture completed its45s window with32 proved normal resources, zero
new gate/page/network errors, one native privacy/set-consent request and HTTP200.
Its raw captured result is observed, not a failed browser journey. The operator
stopped because the strict response oracle had three unqualified assumptions.
All original bytes, old validator verdict, spending and verified cleanup remain
retained; no case replay or new context is authorized by this correction.

The real response requestId retains the exact request UUID followed by a hyphen
and sixteen lowercase hexadecimal server-entropy characters. The current official
[Interact documentation](https://developer.adobe.com/data-collection-apis/docs/endpoints/interact/)
explicitly describes a response entropy suffix and prefix correlation; its v2
endpoint example is not authority to change the pinned SDK's v1 URL/headers.
Keep existing exact UUID/absent-response-ID forms and additionally qualify only
that observed suffix form, requiring the exact native request UUID prefix.
Unknown prefix/length/encoding forms still refuse. Never strip or rewrite original
response bytes/IDs; native request-object/reservation pairing remains mandatory.

The same official response example contains Target35, AAM9 and EdgeNetworkor2
location hints. Qualify these known ancillary Target/AAM entries as bounded
read-only metadata alongside the existing EdgeNetwork hint rule, with closed
type/payload fields, positive TTL and no duplicate scopes. Other ancillary hints/
scopes stay unverified pending evidence. They grant no destination/network/routing
authority and cannot replace ECID/state continuity or justify product enablement.

The native consent:preferences payload exactly echoes the sent Adobe2.0 consent
value (collect/share/personalize.content/marketing.any n, preferred email).
Qualify a single such payload only on the native privacy/set-consent action,
bound to one matching Adobe2.0 request of the selected case's deny/grant semantics
and the exact known producer shape. No-consent has all four choices n; grant cases
have collect/personalize.content y while marketing.any/share remain n, preserving
the existing producer and wire-checker data-sharing guards. Preferred remains email.
Reject mismatched preferences, granted no-consent, wrong standard/action, unknown
fields, duplicate preference handles, missing/wrong payload structure and unrelated
handle families. Do not assert the SDK explicitly consumes this handle; native
request/response and completed host observation provide the evidence.

In-memory diagnostic ablation of all three differences makes the existing pure
checker pass; removing only one/two still refuses. These deliberately modified
diagnostic copies are not admissible evidence. The correction must instead pass
the **unchanged original** after witnessed red→green tests and independent review,
with original execution pins distinct from new qualification-code pins. Existing
unknown-response/error/identity/wire/host/native-notification controls stay strict.
This work is offline qualifier correction only: no stage/status reset, fixture
mutation, old approval replay, extra context or resumption of unexecuted no-offer/
active work follows automatically. Full baseline/DoD acceptance remains pending.

**Native qualifier implementation witness — 2026-10-14:** Existing IN_PROGRESS
correction stayed inside the private response oracle, pure test suite and related
documentation. Initial grant “all y” wording conflicted with unchanged producer/
wire-checker marketing/share denial. Work stopped before edits; parent explicitly
corrected the wording. No sharing guard, authority or source timestamp changed.

TDD `QUALIFIER` selections separately witnessed four ID-correlation failures/
sixteen passes, seven ancillary-hint failures/eighteen passes, and four bare
preference failures/twenty-four passes before their respective implementation.
The finite oracle accepts exact original UUID or exact UUID plus observed16-lowerhex
suffix (or prior absent field); exact Target35/AAM9 and the existing regional Edge
hints with positive TTL/closed fields/no duplicate scopes; and one optional bare
Adobe2.0 preference echo of the known privacy request and case semantics. Grant
collect/personalize y still requires marketing/share n; denied is all n; preferred
email is exact. No other response families/values, routing or identity authorities
were added, and no response bytes/IDs are rewritten or stripped.

All88 new tests pass across complete synthetic no-consent/no-offer/non-render/
positive witnesses, the three forms together, immutability and strict negative
variants. Existing warnings/errors, unknown family, org cookie, ECID rotation,
notification reference, window, request body-hash and BOM refusals retain sensitivity.
Tests use fake selectors/IDs and hash-bind complete synthetic captures, never actual
private samples or modified live diagnostic copies. The exact SDK literal absence
is not treated as proof of a handle-specific consumer; only the parent's observed
wire/host grounding and verified official Interact source justify these finite forms.

Related12-suite selection passes **1317/1317** (1229 prior plus88 new). The long
unchanged359-case operator lifecycle suite was deliberately not rerun for this
isolated pure-oracle change; all1588 preceding tests remain, with their frozen
13-suite pass retained as history, not asserted as a new1676-case full run.
Normal lint, explicit recommended changed-probe/test lint (zero findings) and
syntax pass. No actual private records/body/archive/credential/source-reference/API/
SDK execution, lifecycle/status/approval replay, context/cap/lease changes or commit.
Actual stage remains FAILED, original17 captured result observed and all spending/
cleanup/history immutable. New qualification pins are not original execution or
live-approval pins. Source held unchanged for fresh scoped reviews and parent-only
read-only qualification of the unchanged original; full acceptance and DoD pending.

### Bounded setup refresh under retained prelive ownership — 2026-10-22

**Combined frame PASS; implementation authorized, live work still gated.** The genuine
15:34:38.903Z owner approval permits this bounded design, implementation and
reviews, using the separate genuine unchanged-setup statement received at
2026-10-21T23:50:30.872Z. See accepted
[ADR-0039](../../decisions/adr-0039-same-owner-setup-confirmation-refresh.md).
This is not live approval or helper-quiescence evidence. Earlier unavailable
answers remain history; they are not either new receipt.
The genuine independent combined frame verdict covers this delta and
ADR-0039 only; it is not full-slice or live acceptance.

#### One nested refresh, not a new recovery or recurring renewal

The exact cancelled checkpoint and every eligibility condition of the
preceding same-owner contract remain mandatory. No previous prelive intent,
role registration, approval, effect or spent active case is admitted.
The ordinary legacy path remains unchanged.

Allow only optional `setup_refresh:{value,ref}` on the existing
`airlock.adobe-stock.prelive-reschedule`v1 manifest. Its Ref names the exact
embedded value; the sixteen top-level proof records remain unchanged.
The paired value is closed `airlock.adobe-stock.prelive-setup-refresh`v1:

```text
recorded_at,cancelled:{input,state,plan,marker,lock},
approval:{value,ref},confirmation:{value,ref},setup:{value,ref},
preflight:{input:{value,ref},routing:{value,ref},workspace:{value,ref}}
```

The five cancelled Refs equal the manifest's originals. Every paired Ref
binds the serialized value; all are protected immutable files under existing
private evidence rules, distinct from incompatible roles, canonical mutable
files and retired/current source files by path and device/inode. No refresh
predecessor, arbitrary record discovery, chain or additional DTO partition.
Keep262144 bytes/10000 nodes/depth16 for the entire component; descriptor
validation still precedes access, rejecting proxies/accessors/unknown keys/
symbols/toJSON/cycles before side effects.

`approval` is the exact protected
`airlock.private.owner-setup-refresh-design-approval`v1 receipt. Preserve its
closed recorded shape: received_at,recorded_at,owner_statement,request_context,
setup_reconfirmation,approved_scope,design_implementation_reviews_approved,
live_run_approved,helper_quiescence_attested,scope_or_readiness_waiver,
ownership_reset_or_replay_approved,identifier_migration_approval_inferred.
Require received_at2026-10-22T15:34:38.903Z, exact statement
`You have my approval, do what you need`, the exact setup-refresh question
retained in that receipt, setup_reconfirmation equal to confirmation.ref,
design_implementation_reviews_approved:true and all five other flags:false.
The approved_scope must retain design/implementation/reviews only, original
history/cost/no-replay/helper constraints and no live-run authority.

`confirmation` is the separate exact protected
`airlock.private.owner-setup-reconfirmation`v1 receipt. Preserve its closed
recorded shape: received_at,recorded_at,owner_statement,source,request_context,
interpreted_scope,prior_setup_confirmation,prior_receipt_preserved,
expiry_assigned,authority_transition_approved,live_approval_granted,
helper_quiescence_or_closure_attested,scope_or_readiness_waiver,
identifier_migration_approved,new_attempt_or_slot_authorized.
Require received_at2026-10-21T23:50:30.872Z, exact statement
`previously approved stuff is still the same`, prior_setup_confirmation equal
to the cancelled input's old setup Ref, prior_receipt_preserved:true and all
seven remaining flags:false. Preserve the source/request-context/scope text;
do not reinterpret factual setup confirmation as any execution decision.
Both raw recorded_at values must follow their actual received_at and precede
refresh.recorded_at; refresh.recorded_at must not be in the future.

`setup` is a new, separate existing six-field
`airlock.owner-setup-confirmation`v1 record, not a rewrite of either raw receipt.
Its received_at and owner_statement equal the genuine new confirmation,
unchanged:true, and expires_at is exactly received_at+86400000:
2026-10-22T23:50:30.872Z. Never measure validity from the later design approval,
preparation or current time. Original411, both historical grants and their
old setup bindings remain exact and are still evaluated at genuine old times.

#### Narrow current input/envelope differences

Without refresh, the preceding input equality rule is unchanged. With a
fully validated refresh, permit only the existing resources/code_pins/
prelive_reschedule differences plus authority.approved_at/expires_at,
setup_confirmation and preflight Refs. Preserve authority.authority_ref and
every other input field, all twelve interrupted-recovery Refs, SDK/reference/
selector/permission/consent/trace/case/budget fields and owner/FID/lock.

The new authority dates equal setup.received_at/expires_at and the input's
setup_confirmation Ref equals refresh.setup.ref. The three input.preflight
Refs equal refresh.preflight's respective Refs. Each current envelope equals
its original cancelled counterpart except this exhaustive date/provenance
projection, following the existing setupEnvelopeRefresh precedent:

- Scope, routing and workspace observed_at/expires_at equal the new setup
  dates; their provenance.record_ref is confirmation.ref.path.
- Preflight approval approved_at/expires_at equal those dates, with its
  original authority_ref and every other approval field unchanged.
- Routing assessment_completed_at and target_environment_pin_confirmed_at,
  and workspace confirmed_at equal setup.received_at.

No other field differs, including selectors, profile/object scope, permission
claims, environment pin, limits, sources or configuration-readback claims.
Validate both original and renewed schemas. Do not broaden old quotation
validators, strip arbitrary fields as "facts", redate old native/page/source
receipts or claim fresh configuration-API/screenshot/product evidence.

The existing proof.preflight/routing/workspace records continue to bind the
cancelled input for historical reconstruction. The new outer resources'
preflight/routing/workspace projections bind the renewed nested records;
source_hashes.preflight/routing/workspace/setup_confirmation bind current
input Refs, never old hashes with substituted values. Recompute the cancelled
plan and initial state solely from the original complete frame/time/source
epochs before using any current facts.

#### Current admission, collection and publication

Require current source qualification and both actual closure/lane observations
at or after max(new confirmation.received_at,new approval.received_at).
Closure/lane observations also follow final current source qualification;
all original continuity/hold/collect_not_before/publish_by rules remain.
Every publication fence retains ceil-second15-minute lead,45-minute window
and5-minute expiry, entirely within the new setup/input/envelope expiry.
The original same-owner grant remains unchanged and bound to its original
setup receipt; it is not relabelled as the fresh design approval.

The existing private six-read fixture job may add only the same optional
paired setup_refresh. Inspect/claim/credentials/every request/body/publication
must recheck all new raw, derived and renewed files alongside existing inputs.
Use current derived setup/envelopes only after their complete pure-equivalent
binding checks; all old evidence still binds the old checkpoint. Keep fixed
auth+five Target GETs, original operational-budget Ref, exact source pins,
no redirects, caps, conservative received/uncertain accounting and one-use
exclusive journal. This extension adds no actual job, permission or retry.

The plan/input/manifest fingerprint transitively binds the refresh. Add only
optional setup_refresh:Ref to its single prelive_reschedule_history entry;
when present it equals the manifest pair's Ref. Absence/presence must agree
through initial-state construction, publication images and later runtime
invariant checks. Keep cumulative floors and external positive controller/
OS publication confirmation. Refresh files join the complete typed evidence
audit and every prepared-FD/nonce/hold/path/dev/inode/mode/link/byte/durability/
five-second fence; no cached semantic PASS or historical alias may serve them.

Keep once-only normal703/9234531+new preparation costs and cleanup64/51536,
including the original four/3533 import once. Preserve every old failure,
control, context, SDK reservation and source epoch. Unknown/partial publication
still consumes the one reschedule; there is no second refresh/recovery/replay.
Hold loss denies work, not the existing valid bounded sole inverse; cleanup
must still fit the new genuinely authorized expiry and cannot extend a
previously running role or obtain a work-ready receipt.

#### Required causal coverage and actual qualification

Witness old-code RED then GREEN for a coherent refreshed pure plan and disk
publication. Preserve legacy/no-refresh positives and historical recomputation.
Cover coherently rebound wrong receipt/statement/time/predecessor, approval/
confirmation swaps, current-time or approval-time expiry, changed scope or
nonlisted input/envelope fields, stale/future receipts/qualification/closure,
wrong current source hashes, nested Ref/content/path/dev/inode aliases,
incomplete/oversized/deep/hostile proof, mutable refresh drift before/after
claim and each writer fence, one-use replay/uncertain publication, missing
refresh history/refunded costs, and held/revoked/stop-only runtime behavior.
Private collector SYN tests must exercise renewed setup before transport,
retain actual overflow/failure costs and prove no genuine-policy bypass.

Report complete real proof bounds and actual five-second writer qualification
only after final source review, genuine quiescence/finite coordination and
reviewed fresh collection. Synthetic results or old measurements are not
these actual receipts. All five operational bindings,12READY, served proof
and independent-stop readiness remain mandatory. The two unknown acquisitions
remain an independent current-helper blocker, with no resource exclusion or
unowned-process/shared-MCP action authorized.

### Disabled isolated-supervisor source controller — 2026-10-22

**Scoped pre-code frame PASS; source-only implementation authorized.** The genuine owner
answer at22:12:13.666Z approves implementing the fixed first-party supervisor's
source control path and synthetic failure tests. Every actual backend and
workload launch remains disabled. No image pull, container/browser/vendor
operation, new daemon query, configuration change or old-UNKNOWN waiver
follows. Proposed [ADR-0044](../../decisions/adr-0044-isolated-linux-qualification-boundary.md)
remains a conditional design; this increment does not adopt its runtime,
fix Bug003 or enable the macOS driver.

Deliver one probe-side, cold-import-inert source controller plus existing-runner
unit tests. The operator can replay a bounded **synthetic-only** trace of the
fixed pending-operation/permit/closure protocol and obtain structured rejection
or a source-model result. This is not a running independent supervisor, durable
custodian, transport adapter, clock issuer or real containment evidence.
No accepted runtime interface, stock operator export or CLI changes.

#### Closed source interface and data

`probes/adobe-compatibility/isolated-qualification-supervisor.mjs` exposes
`evaluateSupervisorSourceTrace(text)` and `runIsolatedQualification()`.
The latter always refuses with repository-standard `Failure`, before parsing
input, reading environment/files, issuing management requests or starting any
helper. No flags, environment variables, callbacks, image, program, endpoint,
transport injection or evidence record can enable it.

The evaluator accepts only a bounded JSON string, parsed with the existing
strict `parseJson` helper, not arbitrary caller objects. Unknown keys,
duplicate keys, unsupported types, unsafe integers, excessive size/depth/
event count and malformed identities refuse with explicit `Failure`; there
is no silent default or success-shaped parse fallback. Use at most262144
input/output bytes, depth16 and64 events. Each returned object/array is
deep-frozen. Import/evaluation may use deterministic hashing only; no FS,
environment, process inspection/spawn, timers, sockets or backend/browser/
vendor modules. The unchanged main stock operator is not imported.

The closed trace consists of `kind,schema_version,ticket,events`.
kind is `airlock.isolated-supervisor.source-trace`, version1.
Ticket binds a namespaced case ID, case nonce, immutable source/cohort SHA256,
`origin_ms,work_end_ms,end_ms`; all model times are nonnegative safe integer
ticks, origin<work_end<end and end-origin exactly20000. Work_end is a
synthetic scenario fence, not a measured or production phase reserve.
The entire evaluation is explicitly source-only; all observations and ticks
are fixture inputs, never trusted runtime capabilities.

#### Fixed protocol and write-ahead custody model

Events bind the same case nonce and monotonically nondecreasing `at_ms`.
Use a closed event inventory for pending create/start/stop/wait/dispose,
their matching settlements/lost responses, containment-ready, HELLO/ARM/
ARMED/WORK issuance/acceptance/start, revocation, worker loss, supervisor
loss, closure observation and external completion. Implementation must
document exact field variants alongside tests; no generic executable, signal,
URL, backend or operation-name dispatcher.

An operation intent is retained as a hash-bound predecessor record before
its modeled settlement. Each operation has an exact derived identity bound to
ticket/verb; duplicate issue/settlement or an unknown response refuses.
A lost response is not cancellation: keep its pending entry and sticky
uncertainty. Worker/supervisor loss never drops an intent or claims an API
operation settled. Only a matching settlement can remove the pending entry;
loss/error history remains unqualified even if later cleanup succeeds.
At most one issue per fixed operation is allowed; no automatic retry or
replacement case. No operation intent after the original end fence.

Creation settlement binds one immutable allocation ID and expected
configuration/cohort digest; start cannot precede exact identity custody.
Containment-ready is a modeled supervisor observation tied to that allocation,
not a guest boolean that itself permits work. Start issuance is permitted
only with the allocation and modeled containment evidence. Late start
settlement may not reinstate readiness or clear uncertainty.

The fixed guest HELLO binds allocation, nonce and its retained monotonic
origin. ARM issuance additionally requires an explicit **synthetic** clock-
contract observation tied to source/cohort; daemon version/info is not that
contract. Its bounded durations are derived from the original model fences
and anchored at the earlier HELLO origin, never permit receipt or a fresh
20000ms. ARMED precedes one WORK issue, then separate guest acceptance and
start. Each is one-use, exact-bound and before both existing work fences.
Delayed HELLO/ARM/WORK, clock regression, duplicate messages or rebasing
refuse rather than renewing. No source clock record can enable real launch.

Worker loss before WORK permanently denies later WORK and new cases, even
if create/start/HELLO later settles. Supervisor loss permanently invalidates
qualification and closes new permit issuance. Model the valid buffered
pre-loss WORK race explicitly: acceptance/start after undetected S death can
occur only under that original one-use fence; detected loss or uncertain
custody denies them. No poll, disconnect or acknowledgement is instantaneous
revocation. Existing management cleanup may be modeled within the same end
fence, retaining unresolved obligations; there is no deadline extension.

Revocation denies subsequent acceptance/start. A late successful start reply
after stop or loss cannot count as proof that a previous stop closed it.
Pending operations, failed operations and reordering must remain visible;
an empty pending map alone is not success.

#### Evidence result and runtime denial

Model recursive closure only after matching stop/wait settlements. Require a
complete modeled boundary observation for exact allocation/cohort, including
init exit, recursive empty subtree, retained-child reaping, closed endpoints,
outside sentinel survival and separate case-storage disposition. Dispose
settlement follows process closure; do not infer profile/storage deletion
from group emptiness or process exit. External command exit0 and complete
publication are separate final observations; a producer terminal/CLI0 alone
is insufficient, and no record may attest its own future completion.

Every accepted event is retained in a bounded append-only hash chain with
sequence, ticket identity, prior digest and exact event. Uncertainty is sticky,
and no failed/unsettled/expired cell may produce a completed model result.
The complete synthetic positive may report `model_complete:true` only when
all fixed obligations and external completion fit the original fences.
Every result must also carry `source_only:true`, `runtime_qualified:false`,
`actual_operations:0` and `live_authority:false`, even for that positive.
Incomplete or uncertain valid prefixes return those explicit limitations and
pending obligations, never a real readiness/cleanup/authority receipt.

The result cannot be used in existing stock proofs, setup refresh, owner/
lane closure, kernel/clock/backend qualification or canonical state. No
new review receipt, work-ready image or real allocation ID is minted.

#### Required causal tests and review

Witness missing-code/required-behavior RED before implementation and genuine
GREEN afterward. Cover a complete synthetic normal trace; original ticket/
nonce/source/cohort/custody binding; start-before-create refusal; lost create/
start/stop/wait/dispose responses retained; worker loss before/after ARM;
late replies and start-after-stop ordering; delayed and duplicate permits;
buffered WORK after S death before detection and refusal after detection;
expiry/clock regression/rebasing; missing clock or incomplete containment;
detached/orphan closure obligations; missing reaping/endpoints/storage or
external command/publication; failed command/output bound; hostile JSON and
immutability. No fixture may be called an actual process or clock control.

Cold-import and actual-entry tests must put FS/env/network/spawn/backend/
browser operations behind tripwires and prove zero calls with any purported
enable flag or callback. Do not import or run the old disabled driver.
Run existing Vitest/Node tooling and explicit lint/syntax checks; install no
new dependencies. Required independent compliance/craft/architecture review
and correction closure precede a component-complete source handoff. Keep
all earlier failures, Bug003 and old UNKNOWNs; no full051-02 completion or
environment execution follows.

### Host custody prerequisite for first-party runtime preparation — 2026-10-22

**Scoped pre-code frame PASS; no Docker mutation.** The existing bounded
first-party preparation/test grant permits progressing the host-side custody
prerequisite while image-store capacity remains unresolved. This increment
does not expand that grant, enable either disabled entrypoint, contact Docker,
import the staged image or allocate/start a workload. It implements a real
private-file ledger and fixed host supervisor role; backend operations and
guest clock/containment remain unqualified and denied.

Deliver `isolated-qualification-custody.mjs` under the existing probe directory,
one focused Vitest file and a small fixed first-party test actor if needed.
Do not modify the reviewed source-trace evaluator, original stock operator/
recovery/browser files, canonical checkpoint or previous disabled driver.
Reuse strict `parseJson`, `hash` and `Failure`; no new dependencies, generic
backend/executable broker, image management or arbitrary commands.

#### Durable source custody, not a runtime grant

The host actor accepts one private job Ref and an exact parent/worker
binding. Only the fixed first-party custody protocol may run. Job/event JSON
uses bounded primitive text and closed schemas, at most262144 bytes/depth16/
64 ledger events. In-memory handles and copied data must not carry getters,
proxies, unknown keys, callbacks, executable paths, endpoints or caller clock
functions. Source/test dependency mocks are not production options.

The job binds an unpredictable case nonce, exact source/cohort digests and
the same20-second total envelope. A supported host monotonic clock is captured
before opening its exclusive ledger; never reset it on worker handshake,
operation completion, loss, timeout or retry. Phase allowance is a test
scenario, not a qualified host/guest clock-rate contract. Runtime admission
cannot be enabled by this local clock or by any replay/model result.

Create only a new case directory below a positively owned private preparation
root supplied by a Ref-bound job. Root and case directory must be canonical,
UID-owned0700 and unchanged by device/inode around writes. Bound files are
regular, UID-owned0600/single-link and opened with no-follow/exclusive-create
policy; read through the same protected FD with exact expected hashes.
Never overwrite, truncate, repair or silently adopt an existing ledger.
An existing directory/slot or incompatible source/evidence alias refuses.

Each event is a sequential immutable file with case/source/cohort/nonce,
predecessor hash and exact typed content. Prepare and fsync the file, publish
without replacement, then fsync the directory before acknowledging it.
The result must expose failure explicitly if any write/fsync/publication
fails. Matching visible bytes do not turn a failed publication into success.
No operation can be dispatched or acknowledged from a partial/uncertain
intent; retain original/temporary files as unqualified evidence. A subsequent
reader diagnoses complete prefixes/partial images, not replay or repair.
Use complete-byte/identity fences, not just a mutable summary hash.

#### Publication-order correction — 2026-10-23

**Scoped independent frame PASS; implementation compliance still pending.** This narrowly
revises the preceding prepare/fsync/publish ordering, not the rule that durable
acknowledgement must precede any intent admission. The initial hardlink
candidate's ctime transition could absorb a same-inode identical-byte rewrite
with restored mtime. The [implementation witness](slice-02-host-custody-implementation-witness.md#residual-b1--separate-final-fd-candidate-b2-closed-and-unchanged)
retains the causal real-file counterexamples and the separate-FD candidate;
passing tests alone do not establish contract alignment.
The [scoped correction frame review](reviews/slice-02-host-custody-publication-frame-critique.md)
accepts this host-file contract only: complete matching bytes after a crash or
lost acknowledgement remain diagnostic and cannot reconstruct admission.
It is not an owner runtime grant, candidate-conformance verdict or ADR acceptance.

The corrected ordering is: exclusively create/write/fence/fsync a private
preparation image; exclusively create a **different** final numbered inode;
write the same pre-bound planned bytes into its retained FD; bind its own
complete pre-file-fsync metadata and bytes; fsync that final file; require
unchanged final metadata/bytes through preparation cleanup and retained
directory fsync; only then acknowledge its original expected Ref. The final
slot is never replaced, truncated for retry or adopted after an error.
No publication-related ctime change is permitted after the final inode's own
pre-fsync baseline. Expected hashes come from planned bytes before either
fsync, not an observed mutable file or newly adopted stat baseline.

**Intentional tradeoff:** the final slot may be empty or partially visible
before its own file fsync. Exclusive creation is not atomic publication of a
complete event, nor a commit marker. An independent reader remains diagnostic
only even for complete matching bytes; it cannot reconstruct an acknowledgement,
admit work, replay, repair or resume. Crash/lost acknowledgement or uncertainty
at any write, file fsync, cleanup, directory fsync or final fence permanently
poisons that writer. Preserve existing pending/UNKNOWN obligations and
unqualified footprints; no second operation, new case or retry follows.

Reject ordinary rename because replacement cannot satisfy exclusive/no-repair
publication. Reject hardlink plus permissive ctime adoption because the
demonstrated restored-mtime rewrite defeats it. A native helper, new locking
framework or dependency is outside this bounded correction. This contract
makes no guarantee against an undetectable arbitrary concurrent same-UID writer
or filesystem failure beyond the checked host-file operations, and does not
provide portable immutable storage or a qualified guest/runtime durability
contract.

Required coupled tests target the final inode itself, not only the preparation
write: failure immediately after final-slot creation, partial final write,
and final-file-fsync failure while appending an intent. They must verify the
fault actually reached that final stage, no acknowledgement/admission, retained
pending/uncertainty and evidence, diagnostic-only inspection and no retry or
adoption. Retain all earlier fences and causal rewrite tests. Frame acceptance
alone neither closes compliance nor permits an actual actor control:
same-compliance closure and fresh craft/architecture remain required. All
backend, clock, containment, cleanup, older UNKNOWN and live gates are unchanged.

The fixed inventory is create/start/stop/wait/dispose intent, corresponding
received/failed/lost response, worker-loss, deadline, close-custody and final
external observation. Intent must exist durably before a transport dispatch
could occur. No actual transport is provided in this increment; any would-be
backend dispatch fails at a fixed deny boundary **before** contacting it.
Injected first-party fixtures can report simulated settlements for testing,
but those records remain explicitly synthetic observations and cannot bind
an actual allocation, lease, clock contract or authority.

Keep pending obligations across lost replies, worker exit and late completion.
A request-client exit is not backend cancellation. Only exact matching
settlement may close a pending record; uncertainty/failure history stays
sticky and cannot be erased by later cleanup. Never initiate a second
operation of the same fixed verb or replace a case. Stop/cleanup preparation
may account for later replies without issuing more work or extending time.
No pending obligation may disappear into a closed/success-shaped summary.

#### Fixed host actor and loss boundary

The supervisor is a separate fixed Node role, not the worker's finally block.
It retains its native message/child handles before fallible observers.
Protocol records and acknowledgements bind parent-issued case/source/nonce
and the actual retained channel/role; a message claiming a PID or possessing
a nonce is not itself kernel attribution. Malformed, duplicate, mismatched,
out-of-order or oversized frames close work readiness and are recorded as
unqualified, not retried.

The role installs its existing-envelope watchdog and parent-channel failure
handling before acknowledging readiness. It never starts or owns Docker
resources, forks target workload or launches a browser. Its native entry is
inert on import and refuses caller-selected program/endpoint/transport.
An actual first-party actor control may use only the fixed reviewed helper,
private fixture files and owned IPC; no loopback/daemon/OS inventory or
signals are added merely to test serialization.

If the worker disappears, the independent host role remains responsible for
the retained ledger and pending simulated obligations until the original
fence or a properly bound final observation. It may not falsely clear them
on channel closure. Parent/supervisor loss remains a distinct unsupported
custody condition; actual S-loss injection is not part of this increment.
No claim of survival across execution-host/session shutdown follows from a
worker-loss control. All actual host controls must retain native handles
before observers, use first-party self-expiry within the original20 seconds,
and prove owned child/stdio/IPC closure without targeting unrelated PIDs.

For this increment, source/unit tests precede review. Prepare any actual
worker-loss control as a separate fixed, reviewed one-use job and do not run
it before compliance/craft/architecture clear the actor/ledger boundary and
fresh coordination confirms no conflict. No Docker import/launch follows
even if that first-party Node control passes.

#### Result limitations and causal checks

Every result states exactly what occurred: actual host file/IPC operations,
pending simulated operations, `backend_operations:0`,
`runtime_qualified:false`, `containment_qualified:false`,
`clock_qualified:false`, `live_authority:false`.
Do not label real host journal writes as pure data, or simulated settlements
as daemon responses. Qualified publication of a ledger prefix is a local
file fact only; it does not establish independent durable S lifetime,
OS/guest cleanup, management-operation settlement or whole-helper quiescence.

Write failing tests before implementation for durable intent/ack ordering,
all five lost/failed/late-settlement obligations, sticky uncertainty,
no-retry/case-replacement, separate worker/parent loss, deadline nonrenewal,
channel/nonce/source/frame rejection and zero actual backend dispatch.
Use real owned temporary files and controlled IPC objects for unit tests.
Cover collisions, changed directory identity, symlinks/hardlinks, byte/FD/
inode substitutions, file/directory-fsync uncertainty and partial/visible
publication without acknowledgement. No fault test may make an uncertain
write look committed by reading its visible hash.

Cold imports and backend-dispatch-denial tests must tripwire environment,
network, subprocess, browser and unrelated file reads. Retain inherited
tests; run smallest relevant suites and explicit source lint/syntax without
new dependencies. Independent scoped compliance, craft and architecture
review must close meaningful findings. The existing source-only controller,
old UNKNOWNs, Bug003 and all image/clock/kernel/live gates remain intact.

### Fixed native host-observer prerequisite — 2026-10-23

**Scoped pre-code frame PASS; no actual control queued.** Implement the missing
observer and its fixed outer caller rather than waiting for unreviewed peer source. This is a bounded
first-party prerequisite under the existing preparation/test grant, not a new
SDK, browser, Docker or cleanup capability. The reviewed custody source remains
unchanged. One outer caller owns one observer, which owns **one fixed Node
fixture child**; these are two fixed acquisitions in one logical normal control,
not two fixture cases. It does not
execute the custody host/worker actor flow or qualify that larger flow.
The [independent frame critique](reviews/slice-02-native-host-control-frame-critique.md)
accepts this source contract, not actual native behavior or execution permission.

Deliver one fixed `isolated-qualification-native-control.mjs` and focused
Vitest tests. Reuse strict `parseJson`, original-byte `hash`, `Failure` and the
reviewed protected job-binding reader where useful. No dependency, generic
program/transport broker, caller clock, source-trace evaluator change or old
operator/checkpoint modification is permitted.

#### Original observer fence and one-use custody

The outer caller captures one same-OS `process.hrtime.bigint()` origin **before**
private-plan/source reads and either native child acquisition. Its original end is
origin plus20000000000ns. Never substitute a later ledger-local origin,
handshake time, child entry, output time or retry. This is a local host budget,
not a qualified clock-rate/suspend or guest/VM contract. Both fixed child roles
receive that same original origin/end through closed parent-issued bootstraps
and their actual retained IPC channels. Neither role creates a fresh allowance;
their local entry timestamps are diagnostic only.

Accept only a primitive bounded closed plan Ref. The positively owned private
capsule is canonical UID-owned0700, with0600 regular single-link no-follow
files. Its root is dedicated to one unpredictable native-control nonce, not
the real stock checkpoint or an arbitrary export/program directory.
Retain and fence the **actual directory FD being fsynced**, including device/
inode/path/owner/mode identity. Minimal Ref syntax and root-ownership checks
must precede any write; do not touch an unowned root. Then durably burn the
root's single-use slot **before** fallible plan/hash/schema/source/runtime
validation. A refused or interrupted attempt stays consumed; never repair,
delete, adopt a visible marker or retry that capsule.

The closed plan binds one normal-exit fixture, job/nonce/source/cohort,
the fixed source bundle and the unchanged20000ms ceiling. No caller-selected
command, executable, argv extension, endpoint, failure mode, enable flag or
extra case is accepted. Source code and job bytes are protected and hash-bound;
version/platform/architecture observations are not executable-byte attestation.
Preparation/staging is file-only and does not itself launch the fixture.

#### Fixed child and retained native observations

The outer caller forks only this helper's fixed observer role, once; the observer
forks only its fixed fixture role, once. Use the current fixed Node executable,
empty loader arguments/environment and owned stdio/IPC in both acquisitions.
Retain each native child, both readable streams and channel/send/
disconnect handles before fallible metadata or protocol observers. No
PID/name/group inventory, socket, listener, signal, orphan or parent-loss
injection is added. A missing/uncertain launch handle remains UNKNOWN.

The observer installs the inherited original-end watchdog and actual parent
loss handling before blocking plan/source/job reads, then rechecks the same
parent and original fence before fixture acquisition or publication.
The fixture has no spawn/backend/ledger-writing role. Its bounded bootstrap
binds the original observer origin/end and literal protected job. Retain its
actual parent IPC before parsing; arm its original-end watchdog and loss
handlers before blocking source/job reads. Recheck the original deadline and
same connected parent **after** those reads and immediately before output.
Readiness/output cannot renew the fence. Already-buffered output is not
instantly revoked after loss, and no hard bounded OS-exit promise is made.

It emits only the fixed, nonce/source-bound normal payload, disconnects and
exits naturally. There is no selected failure branch or second control.
The observer attributes input to the retained native streams, not printed
PIDs or serialized self-claims. Separately observe actual exit code/signal,
child close, stdout/stderr EOF and close, and IPC disconnect. A process exit
alone is not stream closure or completed publication.

Bound each output stream to65536 bytes and typed protocol frames to16384 bytes.
Overflow, wrong output, duplicate/unexpected frames, source/identity drift,
missing closure, spawn/stream error or original-fence expiry prevents a normal
result and further work. Keep native custody until actual closure; the only
loss action is closing its exact first-party IPC, not signalling or replacement.
Any late settlement/evidence stays UNKNOWN, without a renewed work window.

#### Publication, independent diagnosis and evidence limits

Persist actual captured raw stdout/stderr and a closed observation record in
the original capsule without replacement. Hash planned/captured bytes before
publication; require their own retained-FD complete byte/metadata baseline,
file fsync, actual retained-directory fsync and unchanged final fences before
a positive publication acknowledgement. Final slots may be partially visible,
but uncertainty never becomes success from matching files. Preserve consumed
and partial evidence on error; no fallback, resume, repair or alternate root.

The observer record distinguishes original outer-issued timing, actual
direct-fixture exit/stream facts and output publication from the observer's
**own future** exit. It cannot attest that future exit. Only after file/
directory durability fences may it emit a bounded positive publication frame
over its retained output/channel. The outer caller must actually observe that
frame from its retained observer child, the observer's native exit code/signal
and complete stdout/stderr/IPC closure, within the same original fence.
Matching files after a missing publication frame cannot reconstruct an ack.

The outer caller independently publishes a closed completion receipt binding
those observed facts and the exact observer/output Refs, under the same
durability and timing fences. It does not attest its **own** future exit.
The app/native caller's actual outer OS completion remains separate evidence;
never serialize a self-issued exit0 as that evidence. This hierarchy qualifies
neither survival after outer-caller loss nor OS-wide/process-tree cleanup.

A separate cold, read-only inspector validates expected job/result/output
Refs, the separate outer completion Ref, closed schemas, complete raw hashes,
nonce/source/cohort and original
timing/closure relationships. It remains **diagnostic-only**, infers neither
actual execution nor an acknowledgement from files, and provides no execution
handle, replay or authority. A forged result Ref cannot enable a backend.
Every observer/fixture/inspection result retains `backend_operations:0`,
`runtime_qualified:false`, `containment_qualified:false`,
`clock_qualified:false`, `live_authority:false`. Label controlled IPC tests
as synthetic; do not label native child observations as a pure model.

#### Causal checks and actual-run admission

Write failing tests first. Use real owned temporary files with controlled
native child/stream/IPC objects; no actual observer or fixture run in unit tests.
Cover original pre-spawn/nonrenewal timing, watchdog-before-blocking-read,
post-read loss/expiry refusal, early one-use burn including invalid plan/hash,
actual fsynced-directory FD substitution, source/job/nonce/frame refusal,
direct-child exit versus complete stream closure, output overflow/errors,
partial writes/file/directory-fsync uncertainty, poisoned retry/no-adoption,
strict independent diagnosis and inert imports. Assertions must establish
that faults reached their intended stage, not silently pass before injection.

Preserve inherited tests and the reviewed custody pins. Required scoped frame,
compliance, craft and architecture passes precede any actual control. Then
stage one private source-pinned capsule, obtain fresh coordination and run
only its one normal fixture within the existing bounded grant. Retain actual
outer OS result separately before independent inspection; stop after that
one attempt, including failure. No automatic negative/failure/loss control,
Docker import, browser/vendor run, old-UNKNOWN clearance, host-wide quiet,
whole-helper closure or full051-02 acceptance follows.

### One pinned base-image import — 2026-10-23

The owner approved importing the already-staged exact public Node image at
2026-10-23T22:47:01.400Z. At23:40:16.643Z the coordinating lane explicitly
handed over its **unissued** import: zero load requests or pending operations.
This lane is now the sole importer until an explicit handback. No container,
build, alternative image, mutable tag, settings change, deletion or vendor
traffic follows from that approval or coordination.

Deliver a fixed private operational importer and focused source tests, not a
generic Docker client. Its only inputs are the protected original approved
archive, owner receipt, capacity receipt and fixed source/readback verifier.
No caller-supplied executable, endpoint, clock, route, archive, image, timeout
or retry option exists. Before any POST, verify the approved exact manifest
`5f6d18c1…`, config `d4c19a76…`, platform linux/arm64/v8 and five compressed
layers inside the closed nine-member81,541,120-byte OCI tar; preserve original
bytes and file identity through upload. Reuse retained hashes and strict
offline JSON/progress/inspection validation, with no dependency installation.

Create one unpredictable-identity-protected private0700 operation directory
at a fixed one-use path; retain its actual directory FD. Files are0600,
exclusive/no-follow/single-link, with complete writes and file/retained-dir
fsync before acknowledging publication. A failed or interrupted attempt is
consumed; do not resume, repair, replace the directory or automatically retry.
Existing marker/files are diagnostic only. Hash-bound originals use retained
FD/stat/complete-byte fences, not path/hash equality alone.

Retain the original monotonic start before validation. A180-second normal
allowance bounds **admission and a qualified result**, not backend execution
or hard OS exit. The supported capacity snapshot at22:20–22:21Z reports777G
guest availability on the verified Docker/containerd backing device; record its
actual age, rounded nature and lack of reservation, and recheck at least2GiB
host backing reserve. Do not invent a fresh timestamp or assert that concurrent
writes cannot occur. If headroom cannot support the one bounded image, stop
before issuing it. Permission alone does not establish sufficient capacity.

Use only the confirmed canonical UID-owned local socket. Bind its current
identity, issue the fixed `POST /v1.51/images/load` once, explicit JSON-object
platform encoding and fixed Content-Length, without pull/network lookup,
redirect, auth helper or retry. Durably publish the original intent and a
pending marker **before** issuing the mutation. Retain the request/connection
and original response. Send only the previously verified archive bytes.

No timeout, closed client, exception or observer exit is backend cancellation.
On the original deadline, record UNKNOWN/pending and deny all new normal work.
If the original request is still capable of settling, continue retaining and
draining that same response; do not issue another request, infer cancellation
or claim a hard bounded helper exit. A socket/HTTP failure leaves the mutation
possibly issued and UNKNOWN. Never refund or erase that obligation.

Retain a bounded256KiB progress prefix. Overflow permanently disqualifies the
result while the original response continues draining without storing further
bytes. Complete native EOF is required for a normal result. Reject HTTP errors,
malformed/duplicate JSON keys, error/errorDetail frames, wrong/duplicate/missing
terminal IDs and stream-reported errors even after a load-success line. Pinned
Moby28.5.1 can report unpack failure and still return success: HTTP200/CLI0 is
not sufficient. A successful content-load response also does not independently
prove snapshot-unpack readiness or actual backend-custodian qualification.

Only after a complete timely response without errors, perform one fixed exact
manifest/platform GET on the same confirmed endpoint. Validate Id/Descriptor
against the **manifest** digest, expected configuration fields, platform and
ordered diff-IDs, without image enumeration or alias/tag fallback. Preserve
response hashes, native elapsed/HTTP facts and the exact result. Independent
outer tool exit remains separate from the producer's future exit. All runtime,
clock, containment and live qualification flags remain false; old UNKNOWNs
and actual supervisor/kernel/cleanup gates remain separate.

Write source tests using owned temporary files and controlled HTTP/socket/clock
objects only: no POST or real daemon access during tests. Cover no side effects
on import, closed originals/permissions/symlink/FD mutation, one-use collision,
pre-intent fsync failure, correct platform wire/body length, timely success,
late response draining without retry, missing response/error, overflow,
HTTP200 with unpack failure, failed readback and pending retention. Establish
fault-stage reachability outside catches. A fresh bounded operational review
must close source/plan issues before the one actual mutation. Do not treat a
source test or review as actual pending-operation custody qualification.

### Closed no-WORK allocation profile — 2026-10-24

**Scoped frame PASS; source preparation only; no allocation or start is admitted.** With the exact
base content imported, define and test the finite container configuration that
a future supervised first-party no-WORK control could request. This supplies
configuration construction and readback predicates, not an external supervisor,
guest clock, kernel witness, execution handle or launch broker. It cannot
advance the disabled actual runner or redeem diagnostic JSON into authority.

Deliver `isolated-qualification-container-profile.mjs` and one focused Vitest
file. Reuse `Failure`, strict `parseJson` and original-byte `hash`; no dependency,
core/connector change, Docker client, daemon socket, subprocess or caller code.
Import is inert. Its builder accepts only one32-lowercase-hex nonce; its
inspection checker accepts only primitive bounded JSON and that nonce. Do not
invoke getters/proxies or accept a caller-selected image, script, command,
clock, endpoint, mount, capability, resource limit or optional enable flag.

The profile pins the imported single-manifest Node image, fixed unprivileged
UID/GID65534, read-only root, no host mounts/volumes/binds/devices/host handles,
no published ports and `NetworkMode:"none"`. Use a private PID namespace
(never host/container PID sharing), private IPC/cgroup namespaces, no privileged
mode, drop ALL capabilities, no added capabilities, default seccomp rather
than unconfined, and `no-new-privileges`. Do not select a host cgroup parent or
delegate cgroup management to the guest.

Fixed ceilings are2 vCPU,4GiB memory with no additional swap,512 tasks and
512MiB `/tmp` tmpfs owned by the unprivileged UID with nodev/nosuid/noexec.
Use no restart policy, no automatic removal and no persistent logging driver.
Keep stdout/stderr attachable, stdin disabled and TTY disabled. No Docker
operation occurs merely by building or validating these bytes.

The only guest code is a fixed small Node script: validate its literal nonce
environment, emit one bounded nonce-bound diagnostic HELLO, and exit naturally
after a short250ms local timer. It never accepts ARM/WORK or input, forks,
reads host/guest process inventories, opens network/files, or calls a backend.
This local timer is merely a fixed self-exit behavior, not a qualified mapping
to the original host20-second budget or hard OS-exit guarantee. The guest
profile is not permission to launch it without a separately reviewed real
outside custodian and supported stop/cleanup path.

The explicit container environment contains only its namespaced nonce; exact
inspection expects that entry first, followed by the verified image PATH,
NODE_VERSION and YARN_VERSION defaults. This checks Docker `Config.Env`,
not a claim about every default variable in the running process environment.
Working directory, entrypoint/Cmd, labels and all listed resource/isolation
fields must match the fixed profile. Reject hostile or unsupported readback;
do not fill absent security controls with permissive defaults. For optional
empty-list/map API representations, permit only documented nil/empty semantic
equivalence, not a nonempty value, and test each such normalization.

Builder and inspection results always say source/profile-only, actual
operations0 and runtime/containment/clock/live/workload qualification false,
even for matching bytes. Do not call config equality containment-ready or
assume defaults prove actual namespace/cgroup membership or recursive cleanup.
Reject nonempty host mounts, devices, namespace sharing, extra capabilities,
unsafe security options, writable root, changed script/image/nonce, reordered
or unexpected environment and raised/missing ceilings.

Use causal tests before implementation: exact normal profile/inspection,
clone/frozen-output behavior, all dangerous field changes, strict duplicate/
oversized JSON, descriptors/accessor/proxy input rejection and cold import/
zero backend effects. Include both compliant and refused cases so an always-
refusing stub cannot pass. Run this focused suite with existing pure custody/
supervisor/stock tests only; never use browser/operator suites. Fresh scoped
frame, compliance, craft and architecture precede considering this profile
for a separately reviewed actual job. Existing supervisor, original-host-fence,
guest-clock, stop/cleanup, old-UNKNOWN and SDK gates remain unchanged.

### Conditional no-WORK management supervisor — 2026-10-24

**Scoped frame PASS; source preparation; no container job is admitted by this section.** Implement
the fixed first-party management/ownership path that would use the reviewed
profile, not a general Docker adapter or a WORK-enabled qualification runner.
Keep the existing actual runtime entry disabled. The first supported control
may only observe that exact diagnostic guest and retain its stopped allocation;
it does not satisfy the full process/clock/disposal qualification gate.

Deliver `isolated-qualification-no-work-supervisor.mjs`, focused Vitest tests
and a scoped witness. Use fixed Node24, the reviewed profile/parser/hash/Failure
and built-in host APIs only. No vendor credentials, arbitrary program/image/
endpoint/command, resource selector, caller clock or transport callback is a
production option. Import is inert. A fixed outer-holder role H acquires one
fixed supervisor S through a retained native child/IPC/stdio relationship.
S alone owns management requests; the guest never sees a Docker socket,
host handle, H/S role or execution capability.

#### Admission and native outside ownership

Before any actual allocation, a separately reviewed one-use job must positively
bind the exact source/profile/image, original first-party grant, nonce and
private ticket, confirmed endpoint and retained native H/S relationship.
The operational launch procedure must establish an outside owner independent
of the calling agent/worker session—for example the supported native detached
execution owner, plus S's separate native process/session—not merely assert a
`detached:true` field in JSON. No accepted outside owner means no allocation.
Source or configuration passes alone never satisfy this condition.

H captures the original same-OS monotonic origin before private validation and
S acquisition; end is exactly origin+20 seconds. Pass that unchanged origin/end
to S only over the actual retained IPC; S checks the protected literal job,
source/cohort and real parent channel. No handshake, operation completion,
worker replacement, retry or timer renews it. Retain the returned child,
channel/send/disconnect and both streams before fallible observers/metadata.
Install loss/watchdog handling before blocking reads; recheck channel and
original time after reads and before requests.

H must observe S READY on its retained native channel, not reconstruct it from
matching files. Only then can H issue one BEGIN for the closed no-WORK job.
S retains pending request/response handles and owns an exact one-use journal
before any effect. Real original responses, late continuations and CID custody
cannot be discarded by failed diagnostic filing, client timeout or H loss.
This increment deliberately injects no H/S loss or orphan behavior.

#### Fixed requests and retained allocation

The only mutation inventory is one fixed create, one start, and stop-only
cleanup for the exact returned CID when necessary. No pull/load/build/tag,
exec, restart, rename, delete/prune, settings change or arbitrary path exists.
A preissued unique case name/nonce and expected profile are bound before
creation; never enumerate unrelated containers or use a replacement case.
Missing/ambiguous create settlement remains UNKNOWN.

Durably publish intent/pending before each request. Strictly parse the bounded
create response and retain its64-hex CID immediately, before fallible metadata
or acknowledgements. Publish its original returned identity and bind it to H's
actual S channel. S may not start it until H has retained that same CID and S
has read back the exact ID/name, reviewed profile and created/nonrunning state.
A JSON claim of a PID, nonce or ID alone is not native creator attribution.

Attach to that CID's stdout/stderr before start, using the supported Engine
attach/upgrade protocol. Retain the native response, socket/head and pending
stream before parsing observers. TTY is false: decode bounded multiplex frames,
retain at most65536 bytes per output stream and reject malformed/oversized/
duplicate/unexpected HELLO or any stderr. No guest stdin or host listener.
Overflow retains bounded evidence and drains without success, rather than
closing the client and claiming backend cancellation.

Only the fixed guest from the reviewed profile runs: one HELLO, no ARM/WORK,
no fork or external access, natural exit after its local250ms timer. The host
fence governs start admission and normal results; it does not guarantee
instant cancellation of an already-issued delayed start. The local guest
timer is not a host/guest rate, suspend or transport contract. Late start or
completion stays unqualified and requires retained stop-only disposition;
no subsequent work/case or fresh clock follows.

Retain the exact wait response, stream EOF/close and post-exit inspect
separately. A normal observation requires the typed matching HELLO, no stderr,
daemon-reported nonsignal exit0/nonrunning PID0, complete owned stream closure
and unchanged ID/name/profile within the original host fence. These are finite
management/guest observations, not recursive cgroup or process-tree proof.
If stop is required, target only the already-attributed CID; no host signals,
PID/group scans or unrelated endpoint/case can be used.

The allocation is **retained stopped**, never automatically removed. Final
records identify the actual CID and `allocation_retained:true`,
`storage_disposed:false`. Exact-ID deletion needs its own owner decision.
Failure to establish stopped state preserves UNKNOWN and pending ownership;
no result may erase or refund a possibly issued create/start/stop.
This retained-allocation milestone cannot pass ADR-0044's disposal requirement.

#### Evidence and execution boundary

Use the existing private-file policy: canonical owned0700 directories,0600
exclusive/no-follow/single-link files, bound original bytes/FD identity and
actual retained-directory fsync. Journal visibility is diagnostic, never
replay, adoption or acknowledgement reconstruction. H retains actual IPC
acknowledgements, S exit/stream closure and independently publishes its observed
completion; neither producer attests its own future exit. Actual outer tool
completion remains separate evidence.

Results distinguish source/mocked transport from actual observations and always
keep runtime/containment/clock/live/workload qualification false. No config
match, HELLO, wait exit0 or retained stopped CID qualifies a real independent
supervisor lifetime, guest clock, full kernel cleanup, old UNKNOWN or SDK gate.
Actual ownership must be accepted on its own supported operational evidence;
missing evidence refuses before allocation, not after a speculative launch.

Tests precede implementation, using controlled native child/IPC/HTTP/socket/
clock objects and owned temporary files only. Cover native READY/BEGIN/CID
handoffs, pending-before-effect, late create/CID continuation after filing or
parent loss, bad profile before start, attach-upgrade/multiplex/overflow/EOF
versus exit, delayed start/wait, exact-CID stop-only disposition, missing stop
settlement, original deadline nonrenewal, no delete/retry/default endpoint,
protected file drift and inert import. Meaningful normal and refusal controls
must establish fault reachability. Preserve existing source/evidence pins.
Required frame/compliance/craft/architecture and exact operational admission
precede any actual job; no container is launched by this source increment.

### Qualified-control completion and approved call budgets — 2026-10-14

Owner message20:58:02.090Z, "I do approve increasing the budgets," approves the
requested **600 normal/40 cleanup** call ceilings, with all spending retained.
Contexts17, SDK64, all byte/safety limits and the eight-active-hour051-03 budget
remain unchanged. No extra context/replay/unlimited retry. The genuine setup
receipt still expiresOct15T16:36:12.449Z; this grant does not renew it.

Unchanged original17 now passes the reviewed qualifier; its raw case is observed,
not a failed browser journey. Preserve the original oracle-failed stage and
genuine case1 failure. Finish only unexecuted2 then3-16, never run spent1/17 again.

**Input:** Optional `controls_completion` is exactly
`{state:Ref,prior_input:Ref,prior_plan:Ref,prior_approval:Ref,qualification:Ref,
budget_grant:Ref,review_sources:Ref,preparation_spending:Ref}`. First four are
immutable current C1 originals. review_sources reuses the existing five-pass
original/retained source manifest bound to prior_approval.
Budget receipt is `kind:"airlock.owner-administrative-budget-approval",
schema_version:1,received_at,owner_statement,request_context,normal_requests:600,
cleanup_requests:40,contexts:17,adobe_requests:64,spending_refunded:false,
qualified_case_replay:false,other_limits_or_authority_extended:false,
source_setup_renewed:false,live_execution_without_fresh_reviews:false`.
Require the actual message/request context, not reminders/unavailability.

Completion preparation receipt is
`kind:"airlock.adobe-stock.completion-spending",schema_version:1,observed_at,
resource_ref:Ref,resource_requests:{count:6,bytes}`, binding six actual fresh
fixture/auth reads and current resource snapshot under existing body limits.
Charge those exactly once. Old Q/preparation/icon spending is already counted;
no new favicon GET or reimport. Input may change only resources/code_pins and
controls_completion; preflight/authority/setup/routing/workspace/original assets/
root/CMS/SDK/fixtures remain identical to C1. Expired setup stops planning; no
source renewal mechanism or copied timestamp is introduced here.

**State/plan:** Optional completion_history is at most one eight-Ref record;
Plan optional completion_attempt is exactly1, source fingerprint prior_completion
binds those Refs. Only a grant-bound completion plan uses600/40 effective limits.
Ordinary/historical512/32 plans stay valid under their own original limits/pins.
No global cap flip/arbitrary CLI ceiling/new export/resume framework.

**Eligibility:** Exclusive lock, exact current raw-state/input/plan/approval
equality. Prior controls failed; exactly one bound original observed17 capture;
contexts exactly[1,17], one original privacy reservation, ordinal2 absent, active
entirely unstarted, all cleanup verified, no completion_history/unknown writer.
Audit old approvals/reviews/source aliases/resources/all earlier histories under
their own old input/digest/time, without treating them as fresh authority.

Qualification Ref binds the parent's recorded
`kind:"airlock.original-control.qualification"` schema1 receipt (original state/
input/plan/case Refs, execution_code_pins, qualification_operator Ref/method,
corrected_case, retained_old_failure, original_byte_refs_checked, operation_exit,
report, state_changed:false, stage_reset:false, sdk_requests_added:0,
contexts_added:0, live_resumption_authorized:false, claims, recorded_at).
Verify original Ref digests equal snapshot/capture digests; read/hash original
network/normal/source/body/trace Refs. The receipt alone never supplies a pass:
rerun the current pure checker on **unchanged original17 with its original
execution plan/pins** and require all gates exit0. qualification_operator records
prior qualification code, not current execution authority; preserve its digest
without requiring a later whole-operator hash to equal that earlier code.
Fabricated pass summaries, diagnostic ablations, missing/corrupt/mismatched/
actually failed/window-incomplete captures, any attempted2/active, extra context/
reservation or unknown cleanup refuse. Read-only qualification adds no traffic.

**Sanitized qualification-receipt types:** The listed top-level keys are closed.
kind is exactly `airlock.original-control.qualification`; schema_version1;
recorded_at canonical UTC ISO; original_state/input/plan/case and qualification_operator
each use the existing `{path:absolute-string,sha256:64-lowerhex}` Ref schema.
execution_code_pins uses exactly the existing nine code-pin keys/digest types.
qualification_method and outer claims are nonempty bounded strings (max4096 bytes),
descriptive only and never authority. corrected_case is exactly
`{label:"no-consent-corrected",status:"passed",reasons:[]}`; retained_old_failure is
`{label:"no-consent",status:"failed",reasons:["case_failed"]}`.
original_byte_refs_checked is a positive safe integer equal to the reconstructed
Ref count: four case/network/normal/trace Refs, one normal source-proof Ref, every
normal body Ref and every trace-part Ref. operation_exit is1 (the full baseline
was incomplete). state_changed/stage_reset/live_resumption_authorized are false;
sdk_requests_added/contexts_added are0.

Nested report uses the already closed seventeen-case public report shape from
this slice, not an arbitrary object: kind `airlock.adobe-stock.report`, schema1,
operation observe, stage null, overall unverified, exit_code1; existing CHECKS/
counts/cases/cleanup/reasons/performance/claims keys and enum/types remain.
Counts are exactly contexts_spent2, contexts_passed1, requests_reserved1,
requests_paired1, requests_denied19 and failed_pairs5. Cases retain fixed label
order, original1 failed/case_failed, corrected17 passed/empty reasons, others
not_executed/empty reasons. cleanup site/activity/schedule verified; reasons
`["missing_evidence"]`. All six claims are false. Performance metrics use the
existing eleven METRICS, each control/stock aggregate `{n:0,median:null,min:null,
max:null}` because no performance pairs ran; pairs1-5 failed with every delta null,
failed_pairs[1,2,3,4,5], and existing six fixed limitations. These report values
describe the original partial baseline; current original-byte requalification is
still mandatory and is not replaced by trusting those booleans/strings.

**Transition:** Append completion_history; preserve prior raw C1 failed-stage
verdict/effects and existing4/3/5-Ref histories. Carry all counters/errors/context/
page/trace/denials exactly; charge only six new reads/bytes. Fresh controls slot
is unstarted/no effects/approval/preflight/verification, with original17 case Ref
carried solely as reused proof. Existing bounded/sealed writers, nonce, old-state/
plan and expected-new-plan CAS/rechecks after sync, admission before rename and
retained-lock exit4 on unknown/partial writes remain. No manual reset or replay.

Current controls plan fixed15min lead/45min serving/5min cleanup contains the
usual required roster17+2-16 but runs **only ordinal2**. Reused17 is requalified
before effects and observed through its original execution plan; new2 and active
3-16 use their own fresh exact current plans. No blanket cross-plan hash waiver.
After actual2 and independent stop pass, current controls can be passed based on
original qualified17 plus fresh2; only then separately reviewed active3-16 proceeds.
Any newly failed case stops traffic, stays spent and cannot retry/complete again.
Reports retain original case1 failure/19 denials and prior stage-verdict history,
show passed17 once, and count every context/request. Full baseline still requires
all sixteen required cases/current five comparable pairs; transition is not proof.

**Cost:** Prior continuation's full fresh7/root/config before every context and
native-body gate remain. Removing the observed17's14 per-case reads gives
no-offer completion77 plus active262 plus propagation6 plus fresh fixture6:
225+77+262+6+6=576 <=600. Successful no-offer stop then failed active requires
20+6+6+7=39 <=40. Reserved Site count ceiling is effective cleanup40 minus seven
Target calls (33); stricter Site1MiB/header-only-root and global byte caps stay.
Actual count/byte/current-source/body/per-context/trace/page/SDK/context feasibility
must precede effects; no refund/transfer/hidden calls. Normal3/cleanup5 config-read
finite propagation and deployment-only duplicate-read removal stay, no warmed
proof or new source-gate shortcut.

Fresh five code/frame/exact operational review bindings, actual twelve READY,
prepare/verify before fixed start, current saved-owned resources/clean disabled
reference/config/head/push/CSP/critical bytes and per-case native original-byte/
consent/identity/response/host/native DISPLAY/INTERACT/safety gates remain. Source
expiry never renewed by budget permission. No reports/403 investigation barrier.

TDD: complete C1-shaped carry-forward+unchanged17 requalification then execute
only2→3-16; original failed verdict and all refs/denials/spending immutable; strict
qualification/approval/source/grant tamper refusal; genuine grant600/40 only with
old512/32 unchanged; six preparation reads once; original/current plan separation;
missing proof/failed window/response cannot borrow a pass summary; parked foreign
edits/post-rename failures retain ownership; no duplicate/18th context; budget/
byte/Site boundary counts and full/partial reports/performance. Existing qualifier/
1588 lifecycle guards stay. Offline frame/TDD evidence does not replace fresh
scoped compliance/craft/arch or actual live gates; this is not full slice/DoD acceptance.

**Completion implementation witness — 2026-10-14:** Official READY→IN_PROGRESS
preceded test edits. The missing closed qualification types initially blocked
implementation; the parent's sanitized structural clarification closed that
blocker without a new authority grant. First completion selection witnessed3
behavioral reds/28 passes before implementation. Supplemental native1/17 and
current/parked C1 approval tests witnessed four behavioral reds; two directory-
failure fixtures initially targeted lock fsync, then were corrected to target
actual post-plan-rename sync/close. Missing-proof reporting and active cleanup
feasibility each had another red before their corrections. A reused transport
spy's call history was cleared rather than treating earlier fixture calls as
planning traffic.

All54 completion tests now pass across the three baseline suites. Synthetic C1
carries225/4366591 normal,20/15921 cleanup, `[1,17]`, one original privacy
reservation, old failed1/19 denials and all4/3/5-Ref histories unchanged; only
six fixture reads/10000 bytes are added once. Tests run only2→3-16 and observe
all sixteen required cases with five pairs, retaining the genuine failed1.
Original17 is checked with distinct past execution code pins and its original
case/normal/source/trace hashes; copied original Ref paths and retained old review
sources work without reading/executing the past qualifier. Twenty-thousand-event
original traces plus fifteen7,000-event new traces total145,000: deduplicating
only the bound original17 avoids165,000 while still counting failed1.

Exact600/601 and cleanup40/41 planning boundaries, global32MiB and strict Site1MiB,
the active remaining stop reserve, foreign/current approval and post-sync source/
grant/qualification/state/input/nonce tamper, settled directory failure, unresolved
writer/late-overwrite refusal, failed new2/no retry and independently retained
partial summaries are covered. Missing original proof stays unverified, not
failed/passed; known failed1/passed2 survive. Existing native requestId-only dispatch,
marketing/share denial, source/root/CSP and ordinary/historical512/32 limits remain.
Normal lint, explicit recommended lint and syntax pass. First full13-suite run
1721 passed/7 existing-summary timeout failures (some ENOTEMPTY teardown); affected
unchanged selection9/9 and complete unchanged confirmation1728/1728 then passed.
No proven timeout root cause or weakened timeout/safety/test is asserted. Two final
contract-check reds removed an invented canonical approval filename and unjustified
preparation-after-budget-receipt ordering. Supplied approval Ref/durable digest and
post-sync reads remain exact; fresh reads under unchanged setup can precede the
grant, without refund or future-grant admission. The final exact requested full
regression passes1730/1730 across13 suites, retaining all1676 earlier cases.
Final normal/explicit recommended lint (zero findings), syntax and whitespace
pass; no Git diff command was run. Actual private
records, bodies, archives, source snapshots, receipts, credentials, reference,
API, pinned SDK execution, Git and commits were not accessed or changed.
IN_PROGRESS, implementation source held unchanged for fresh parent
reviews; no full live AC, review, reconciliation or DoD box is ticked.

**Admission-boundary compliance correction — 2026-10-14:** Same contract, no new
schema, owner permission, clock/lease, budget or actual call. Parent released the
source freeze only after its153-test/three-suite focused runner and lint/diff
completed. Twenty new synthetic/loopback regressions now pass. Six original17
artifact variants changed at parked normal PUT-reservation fsync; served root,
approval PUT, served/context/page journal waits, config intent/pre-commit/pre-push,
native SDK reservation/continuation and browser launch/context boundaries are
covered. Initial16 causal reds/two incomplete browser-mock errors preceded fixing
that stand-in's missing version method; both browser assertions then had genuine
reds before production edits. Eighteen causal reds passed after the minimum fix;
private callback absence and owned restore with unreadable qualification also pass.

A narrow local proof admission rereads the same closed completion/original17
evidence under its old execution plan/pins after the last normal-effect await.
Normal PUT checks follow metadata-reservation fsync; config writes and Git
add/commit/push, context spending/launch and native SDK continuation check their
own boundaries. Private concrete-helper callbacks preserve post-reservation native
original-byte/expiry checks and requestId-only continuation. No additional HTTP or
administrative spending, old-code execution or cached success boolean is used.
Already spent reservations/intents remain; no proof is restored to obtain a pass.

Independent cleanup skips traffic qualification only. Hash-bound historical
state/input/plan/approval, reviews, resources, grants/spending and owned effects
remain audited, while corrupt original17 case/network/normal/source/body/trace/
qualification cannot block Site disable or Target inverse. Foreign config still
refuses; unknown cleanup/writer retains exit4. Existing approved owned restore-apply
is covered without source repair, stage reset, replay or a new recovery option.
Combined focused selection170/170 and unchanged push guards3/3 pass; normal/
explicit recommended lint (zero findings), syntax and whitespace pass. New exact
full13-suite regression passes1750/1750, retaining all1730 preceding tests; that
older1730 pass stays historical rather than being relabeled. Git diff was not run.
Implementation source held unchanged for fresh compliance/craft/architecture;
actual records, receipts, credentials, SDK/API, ledger, source archives/reference,
Git/commits and all acceptance/review/DoD boxes remain untouched. IN_PROGRESS.

**Incomplete offline plan abort — 2026-10-15:** Actual Q1 refused before effects
because parent context metadata omitted two word-separating spaces around600/40.
A separate lineage-bound normalization fixed only those spaces; the original
owner statement/grant remained unchanged. Q2 then renamed the completion plan
but refused state commit: qualification provenance points to the original canonical
plan/state paths, which are legitimately replaced. The loader must instead
verify the equal-digest immutable original snapshot Refs. Synthetic tests must
cover different canonical-versus-snapshot paths through post-rename checks.
Actual old state remains byte-identical, no completion_history or effects applied,
partial plan and lock were retained, and the original writer process has exited.
Six fixture calls remain recorded in their receipt, never refunded or repeated.

One independently reviewed **session-local offline abort**, not a public CLI
recovery flag/framework, may restore the original canonical plan from its
immutable byte Ref. Its finite proof binds prior_state/prior_plan/partial_plan/
retained_lock/failed_input Refs and a current code-bound operational abort verdict.
Require exact current old-state, changed partial-plan and retained-lock hashes,
same baseline/input/previous source/history bindings, no new context/case/
reservation/effect, and the original planning process definitely absent. A PID
alone is insufficient: every byte/digest/nonce/source must match the witnessed
partial attempt. Refuse live/reused-PID/unknown holder, foreign edits, altered
snapshots and any additional native writer; do not infer permission from age.

Use an exclusive separate recovery marker, bounded write/fsync/rename under
retained original lock, and exact checks before/after each boundary. Restore
only original plan bytes; **never write/reset state, captures, approvals,
spending or resources**. Retain failed input/new partial plan/lock/proof/verdict
snapshots and an abort receipt. Only after original plan/state equality and final
sync are proven may the exact original lock be removed; never generic stale-PID
or force unlock. Any unknown/partial writer keeps ownership/markers and reports
exit4. No API, SDK, browser, Git effect or credential access in this helper.

Frame/operational review and hermetic file-boundary regressions precede this
single local repair. Production loader correction still needs fresh code review.
Then normal completion planning may use the same fresh six-call resource receipt
once, within its original freshness and600/40 budget. If receipt expires, stop
and explicitly account any further required reads; don't timestamp-renew it.
The abort neither extends deadlines/ceilings nor approves new live effects.

### Interrupted unstarted completion plan — 2026-10-15

Q3 completion planning succeeded before the session interruption; the exact
operational review did not complete and no approval/prepare/verify/effect/new
context was admitted. State is unstarted with original17 case proof only and
contexts[1,17], normal231/4370072, cleanup20/15921. Fixed03:51:01Z start expired;
never extend that plan or reuse its expired resource receipt.

Permit one explicit `plan --stage controls` replacement of this **unstarted,
unapproved completion plan only**, not another completion or failed-case retry.
Input optional `completion_replan:{state:Ref,input:Ref,plan:Ref}` uses three
immutable original byte snapshots. It requires controls_completion; State optional
`completion_plan_history` has at most one such record; Plan source hash
`completion_replan:H` binds the fingerprint. No new CLI flag/export/generic retry.
Every ordinary input and existing historical plan remains unchanged.

Under the existing exclusive lock, require exact current raw state/input/plan
bindings, completion_history equal to the unchanged controls_completion Ref set,
no completion_plan_history, controls unstarted with null approval/preflight/
verification and empty effects, only the original17 case Ref, active entirely
unstarted, contexts exactly[1,17]/one original reservation and unchanged page
ledger, and all cleanup verified. Prior plan must be completion_attempt1 and
its fixed start past. No context or effect after approval is eligible.
Current input differs from the prior input only by resource Ref, code_pins,
the new completion_replan field, and controls_completion.preparation_spending.
All other eight completion Refs/histories, authority/setup scope and original
proof remain identical. New preparation-spending receipt charges exactly six
fresh bounded owned-fixture reads and their actual bytes; the old six calls stay
spent. No Q/body/qualification reimport, source timestamp renewal or refund.

Append the three Refs as completion_plan_history and change only the current
input/plan binding and fresh unstarted slot; retain its original17 evidence Ref.
Update completion_history to the same completion scope with the new spending Ref;
the old input/plan/state remain immutable in completion_plan_history. The loader
must validate both old and current completion spending against their own resources,
and read retained original17 proof through original execution snapshots, not old
canonical mutable paths. No old effects/approval replay.

Use existing tracked bounded/sealed writes, nonce/old state-plan-input CAS and
expected-new-plan checks after sync. Refuse foreign edits, missing original/
qualification/review/source bytes, any partial/unknown writer, a second replacement
or any changed fixture/scope. Keep ownership/exit4 on partial writes. Before
replacing, refresh current owned resources and calculate cumulative remainder:
231 already spent +6 new fixture +77 no-offer +262 active +6 propagation =582
normal <=600; unchanged worst39 cleanup <=40. Actual byte/Site/SDK/context/trace
bounds and current owner/source deadlines still apply.

New fixed15min lead/45min serving/5min cleanup requires fresh exact five-review
approval and prepare/verify before start; current twelve READY/owned/config/
source/native-byte gates remain. Run only unspent2, then separately reviewed
active3-16; no rerun17 or new18. Past partial/failed stages and call spending remain
visible. This is a zero-effect unstarted-plan retirement under delegated ordinary
framing, not a budget/criterion/safety expansion.

TDD: exact Q3-shaped success with old calls retained/new six once; reject second,
approved/effected/attempted cases, changed immutable refs/history/other grant
fields, stale resources/lease, and parked foreign writes/unknown writer. Prove
prepare/verify/observe/restore and only2→active3-16 use the retired-plan history
without losing original qualification or changing ordinary behavior. Frame and
scoped reviews precede application; full live acceptance remains open.

**Implementation witness — 2026-10-15:** Official helper transitioned the recorded
READY_FOR_IMPLEMENTATION frame to IN_PROGRESS before edits. Reused the closed
three-Ref validator, completion/original17 loaders, cost calculation, exclusive
lock and bounded sealed replacement primitives. Retired input/resources/spending
are audited independently of current resources; the original C1 execution plan/
pins still qualify17. Exactly six new reads/actual bytes are charged once without
reimporting qualification or replaying effects. Old snapshots and earlier
histories remain byte-bound; partial/unknown replacement retains ownership/exit4.
Observe audits retired spending; owned cleanup still skips traffic proof only.

Initial22 test failures preceded implementation. Separate behavioral reds caught
still-fresh aliases of already-spent reads and omitted retired-spending observation.
All26 new synthetic tests pass (25 operator plus one pure schema). Scoped operator
selection37/37 includes twelve existing completion, both-sided abort-marker and
canonical-provenance guards; the complete pure baseline suite247/247 passes.
Normal/explicit recommended lint (zero findings), syntax and whitespace pass.
A synthetic clock was aligned with the existing finite-wait mock, preserving
strict millisecond/rounding assertions and unchanged timeouts. No full1750-suite
rerun or live result is claimed. Source frozen for fresh parent reviews; actual
private records, fixture collection, owner grants/receipts, SDK/API/browser/
reference effects and commits were not accessed or changed. No review/DoD tick.

### Admission audit duplication correction — 2026-10-15

Synthetic diagnosis confirmed excessive serial host work in the current callback,
not the sole cause of the failed live startup:30 native-style admissions with
durable reservation took5598.8ms versus308.0ms with only the diagnostic proof
callback disabled. Both performed60 fsyncs. Current callback opened9690 files,
called lstat84750 times, hashed13860 times and read146512830 bytes; original17
was rechecked30 times. A preceding warm measurement5556/314ms had identical
operation counts. No SDK/vendor/live context executed. Warm synthetic timing
did not cross15s; independent page/network scheduling causes remain unresolved.

Fix only repeated immutable reads **within one admission**. Each admission starts
a fresh isolated read scope after its durable reservation, reads/hashes every
relevant unique evidence Ref with equivalent owner/mode/containment/symlink/file-
identity checks, and reuses that admission's verified bytes/parsed projections
for duplicate same-Ref visits. Discard the scope at admission end. Do not cache
proof success, timestamps or original bytes across admissions. Different expected
digests/security policies/size limits for the same path cannot borrow a cached
result. Mutable current-state/nonce/CAS/deadline reads stay uncached. Concurrent
admissions/controllers may not share verified-byte caches.

Keep original qualification/current pure checker, all old grant/review/history/
body hashes, current scope/deadline/identity/cleanup and native post-reservation
proof gates intact. No file is accepted solely from mtime/inode or a prior pass.
This removes duplicate traversals, not relevant evidence or safety criteria.
Prefer a local reader scope over a persistent evidence graph/cache framework;
no new CLI/public export/config/dependency or execution authority.

Normal GET gate stop and real expiry must remain distinct: stopped admission
with a still-valid TTL refuses as egress/case failure, not stale_evidence;
actual elapsed source deadline still refuses stale_evidence. Preserve the
failure cause and spent reservation, no silent success/default/response rewrite.
All startup/observation/phase/performance/byte/cap bounds remain unchanged.

TDD deterministic per-unique-Ref I/O counts and repeated real synthetic reservation
benchmarks before/after; preserve actual timings/dispersion without inventing
hardware-dependent passing thresholds. Mutation between admissions or during
parked fsync, hash/security/path mismatch and concurrent isolation must still
refuse after a prior pass. Retain ADMISSION/current immutable/CAS/marker guards
and independent cleanup. No source-spending/failed2-state reclassification,
retry/context18 or new approval follows; fresh code review and any future bounded
live decision remain separate. Current failed live14.720s window is never proof
of a qualified no-offer control.

**Implementation witness — 2026-10-15:** A fresh private async read scope exists
only inside one completionAdmission call after durable reservation. Expected-SHA
immutable Ref reads deduplicate by path and compatible security/bound mode;
conflicting hashes refuse. Each subsequent/concurrent admission rereads and
hashes its own evidence. All historical validators and the pure original17
checker still execute. The protected JSON+original-byte audit pair remains;
mutable canonical/unbound reads and nonce checks stay outside the cache. Owned
cleanup remains separate. Stopped normal GET refusal no longer falsely labels
an unexpired proof stale; real expiry remains stale_evidence. No phase, timeout,
cap, clock, source or grant change.

**Scope extension — 2026-10-16:** The later unadmitted-preparation retirement
also uses this same fresh read scope for each of its two sealed replacement
audits. `historicalAdmission` shares construction with controller admission,
not a map or semantic verdict. Each replacement/effect gets a new map; canonical
mutable/unbound reads and final synchronous nonce/digest/deadline checks remain
uncached. The actual private writer with the full retained proof completed
3,067.86ms within the unchanged5s allowance in the recorded local-only
[admission-cache witness](reviews/slice-02-prelaunch-admission-cache-implementation-witness.md).
This example is not a guarantee of future latency or permission for live effects.

Four behavioral reds preceded implementation. Final operator PER-ADMISSION15/15,
existing admission/canonical/abort28/28 in partitioned runs, browser selection
13/13 and pure baseline247/247 pass. The new synthetic waterfall needed a complete
native CSP stand-in and hashes of its synthetic SDK byte stand-ins; corrected
15-test confirmation passes with unchanged assertions/timeouts. Final sink31/31
GET bodies proved in7.84s, with zero SDK execution; this is not actual host/SDK/
live baseline evidence.

Thirty-admission opens9690→7740, lstat84750→70350, hashes13860→12870,
bytes≈146.513→131.900MB; original wire checks30 and fsyncs60 stay unchanged.
Warm timings overlap before/after (before5.556/5.599s, later7.356s; after pairs
5.919/6.002,6.580/6.067,7.164/6.566s; earlier after8.874s). No reliable elapsed
speedup, timing band or sole live-failure causality is claimed. No persistent
cache/architecture extension was attempted. Normal/explicit lint, syntax and
whitespace pass; no full-suite rerun, actual private/effect/authority change,
commit or review/DoD completion. Source frozen; failed original2 is not requalified.

**Read-cache spelling correction — 2026-10-15:** Review identified that raw paths
with the same resolved key can have different physical traversal/private checks.
Two new synthetic reds accepted invalid evidence: a dot-spelled weak-directory
alias before a strict canonical consumer, and a symlink/`..` alias with different
physical bytes after a canonical read. Noncanonical paths now bypass caching,
not the original reader, without rejecting previously supported valid aliases.
Exact canonical deduplication and normalized mutable exclusions remain intact.
Targeted operator7/7 and native stop/expiry2/2, normal/explicit lint, syntax and
whitespace pass. No15-test benchmark/full-suite rerun or live effect; previous
timing claims remain historical. Source frozen; no review/DoD tick.

### Owner-approved failed no-offer recovery — 2026-10-15

**Plain-language scope:** Allow the one additional no-offer attempt the owner
approved, without rerunning a successful control or hiding earlier failures.
The new cumulative limits are18 contexts/700 administrative calls/50 cleanup
calls. This is not permission to retry repeatedly or weaken source/egress checks.

**Authority and observed state:** The actual owner message at
2026-10-15T17:20:06.626Z was "sure, I approve the recovery limit", in direct context
of those three limits and one corrected no-offer attempt. Its owner-only receipt
is retained separately from the genuine17:14:31.818Z unchanged-setup receipt.
The latter expires2026-10-16T17:14:31.818Z, but predates the Google site change
below. Current durable state remains FAILED controls, UNSTARTED active,
contexts[1,17,2], one prior Adobe reservation,310 normal calls/5,204,235 bytes,
and27 cleanup calls/21,508 bytes. All three stop actions are verified. Original2
is a failed14.720s incomplete window, not a qualified performance sample.

**Reviewed bounded offline implementation contract (scoped frame PASS;
no implementation/live acceptance follows from this section):**

1. One optional digest-bound `baseline_recovery` manifest may refer to immutable
   failed-state/input/plan/approval/review-source snapshots, the actual owner
   recovery grant and new preparation-spending receipt. Keep one recovery-history
   entry; reject nesting, repeated attempts, foreign/superseded state, active
   spending, incomplete stops or mismatched original bindings. OriginalQ4 and
   all five exact approval-source digests are now retained before further review
   writes. Recovering an original source is valid only when its original digest
   matches; never replace a missing original with a new verdict.
2. Eligibility is the actual failed no-offer after original contexts[1,17,2],
   with original17 still independently qualifying under its original execution
   plan, code pins and native body/response evidence. Grant neither rerun17 nor
   retroactive passage to failed1/2. Admit only corrected no-offer ordinal18
   (unchanged four-request cap) in controls, followed separately by original
   active3–16. Select by exact roster, never `ordinal > 2`.
3. Apply18/700/50 only to the new grant-bound plan/state. Historical16/512/32,
   17-context and600/40 plans remain interpreted under their own bindings.
   Preserve SDK64, every byte bound, Site reserve, timeouts, source leases,
   consent/identity/native-response/rendering/notification rules and independent
   cleanup. No public retry/force/transport flags or new exports.
4. Carry every original context, call, byte, reservation, failed case, trace,
   body, denial and error forward. Count new preparation reads exactly once,
   including failed reads. Do not reset the baseline, replace old captures,
   double-count reused17, discard failed2 or reuse an old approval. Reporting
   retains both failed attempts visibly while requiring17,18 and3–16 to pass.
5. New current input binds genuine renewed preflight/routing/workspace/setup
   evidence, fresh owned resource reads, current reviewed code and exact source
   qualification. Compare unchanged fixture/permission semantics without
   rewriting historical confirmation times or owner words. Audit historical
   receipts at their own recorded times; require current evidence/approval at
   actual admission. Existing lock/CAS/writer sealing and partial-transition
   behavior remain; there is no manual reset or generic abort facility.
6. Witness targeted red→green tests for absent/wrong grants, attempts beyond18,
   old-plan limits, changed original state or source bytes, spending carry-forward,
   original17 reuse, failed2 visibility, exact active roster and final aggregate.
   Scoped frame/compliance/craft/architecture review precedes any live use.
   Fresh exact operational approval and actual readiness still precede effects.

**Closed recovery artifacts and transition:**

- Input gains only optional `baseline_recovery: Ref`. Its immutable manifest is
  the closed envelope `kind: airlock.adobe-stock.baseline-recovery`,
  `schema_version: 1`, with exactly eight distinct Refs: `state`, `prior_input`,
  `prior_plan`, `prior_approval`, `review_sources`, `owner_grant`,
  `preparation_spending`, `setup_renewal`. None may name a canonical mutable
  state/plan or the replacing input. Historical input must have completion history
  but no `baseline_recovery`; no nesting or second recovery is supported.
  Existing input history fields remain unchanged. Plan gains optional
  `recovery_attempt: 1`, requiring existing control/completion discriminators and
  `source_hashes.baseline_recovery === input.baseline_recovery.sha256`.
  Neither flag nor source hash may exist without the other. Its complete
  effective limits equal inherited limits except contexts18, metadata700,
  cleanup50. Historical flags/limits must still validate exactly as before.
- `owner_grant` is the exact closed owner receipt already retained: `kind`,
  `schema_version`, `received_at`, `owner_statement`, `request_context`,
  `contexts`, `normal_requests`, `cleanup_requests`, `adobe_requests`,
  `corrected_scenario`, `additional_attempts`,
  `previous_failures_and_spending_retained`, `spending_refunded`,
  `qualified_control17_replayed`, `byte_limits_or_other_authority_extended`,
  `source_setup_renewed`, `unlimited_retry_authorized`,
  `live_execution_without_current_readiness`. Require kind
  `airlock.owner-baseline-recovery-approval`, version1, actual statement
  "sure, I approve the recovery limit", no future receipt, nonempty bounded
  request context, respective limits18/700/50/64, scenario `no-offer`, attempts1,
  retained-history true, and all remaining permission/refund/replay booleans false.
  Do not derive permission by parsing incidental whitespace in `request_context`.
- Preparation receipt is a closed
  `airlock.adobe-stock.recovery-spending` version1 envelope with `observed_at`,
  `resource_ref`, `resource_requests: {count, bytes}` and `attempts`.
  `resource_ref` must equal current input resources. Each attempt has exactly
  `ordinal`, `purpose`, `status`, `bytes`, `bytes_upper_bound`; contiguous
  ordinals start1, and the finite purposes are `authentication`, `environment`,
  `property`, `activity`, `offer-1`, `offer-2`. Status is `received` or `failed`;
  nonnegative safe-integer bytes are bounded by16KiB for authentication or64KiB
  otherwise. Unknown/incomplete failed reads must explicitly charge that full
  bound with `bytes_upper_bound: true`; completed received bodies have false.
  Require exactly one received attempt per purpose and at most96 total attempts.
  Count and bytes equal the complete attempt list, including every failed read;
  receipt time is between genuine renewal and current planning time, after the
  resource observation. This records actual preparation, not permission to
  perform96 calls. No source-qualification traffic is hidden in this receipt.
  Nominal six-read costs stay unchanged; additional failed attempts/bytes add
  to both the feasibility bound and cumulative spending exactly once.
- `setup_renewal` binds the existing closed
  `airlock.owner-setup-renewal` version1 lineage: `recorded_at`, `observed_at`,
  `expires_at`, `authority_ref`, `confirmation`, `previous`, `current`,
  `original_sources_preserved`, `fixture_selectors_unchanged`,
  `new_screenshot_or_configuration_api_claim`, `prospective_shared_site_change`,
  `current_resource_and_site_readbacks_pending`,
  `recovery_limit_increase_approved_by_this_receipt`, `sdk_requests`, `mutations`.
  `previous`/`current` are exact three-Ref preflight/input-routing-workspace maps,
  equal respectively to the old/new baseline input's `preflight`.
  `confirmation` equals new `setup_confirmation`. Require the genuine setup
  receipt's exact closed existing schema, `unchanged: true`, actual statement
  "Setup still unchanged, yes, cntinue", observed/expiry times equal its
  received/expiry times and the existing24h/future-deadline gate. Lineage authority
  is unchanged, original-preservation/selector flags true, no new screenshot/API
  claim or recovery permission, current readbacks pending, SDK/mutations zero;
  bounded prose fields are provenance, not readiness.
- Permit renewal changes only to baseline `authority.approved_at/expires_at`,
  `preflight` Refs and `setup_confirmation`, plus fresh `resources`/`code_pins`
  and the new manifest. Baseline authority reference, all reference/source/SDK
  pins and every inherited history/spending Ref remain exact. For actual renewed
  envelope contents, allow only input `approval.approved_at/expires_at`,
  `scope_evidence.observed_at/expires_at/provenance.record_ref`; routing
  `observed_at/assessment_completed_at/expires_at/
  target_environment_pin_confirmed_at/provenance.record_ref`; workspace
  `observed_at/confirmed_at/expires_at/provenance.record_ref`.
  Every new timestamp must equal the genuine receipt's applicable time.
  All other nested fields, especially selectors, authority, permissions,
  original evidence and configuration facts, are deeply equal. Validators
  still run on both old and new artifacts. Do not replace old timestamps,
  broaden legacy confirmation acceptance globally or accept "semantically similar"
  fields outside this enumerated set.
- Exact eligibility binds immutable state/input/plan/approval and retained review
  source bytes under the old input's own schemas and approval time; audits all
  previous histories under their own inputs/times; proves original17 unchanged;
  binds original failed2 capture/plan and retained artifacts without claiming it
  passes. Require FAILED controls with exactly original17 then failed2 case Refs,
  contexts[1,17,2], one reservation belonging to17, UNSTARTED/empty active,
  all stops verified, known control effects verified/reversed, no previous
  recovery and no attempted18. Current canonical state/plan must equal the
  immutable original bytes immediately before both replacement writes.
- One CAS transition retains all fields except new input hash, appends
  `recovery_history: [input.baseline_recovery]`, adds the complete new preparation
  count/bytes once, and replaces controls with the standard UNSTARTED slot:
  new plan hash, null approval/preflight/verification, empty effects and only the
  original17 case Ref. Active and all original histories/counters/page accounting/
  errors/current ownership stay unchanged. Failed2 remains in the immutable
  recovery state, not deleted or reclassified. No generic reset or unapproved
  plan-retirement fallback is introduced.
- Plan's qualified roster is17,18,3–16, with18 label `no-offer-corrected`, scenario
  `no-offer`, cap4 and a fresh run ID. Controls executes18 only; active executes
  exactly3–16. The public report retains indexed original16 slots plus17 and18,
  visibly showing failures1/2 and original17's reused result. Success requires
  all required17/18/3–16 plus both stages; historical failures never become passes
  and their denials/errors/spending remain visible, but are not re-required
  successful samples. Trace/body accounting deduplicates identical bound Refs,
  including reused17, never unrelated records sharing an ordinal. After any
  attempted18, this recovery cannot create another execution slot.

**Changed-site prerequisite:** The coordinating Google session reports owner
selection of site-wide installation with acceptance that Adobe's old baseline
becomes stale. It reports commit
`9b282eb06ae09108979f2c4667eb352f1f6ff8f7`, parent
`8d2059a02fe55ad9d55fdaef1c85b562ac27c54a`, changing only `head.html` by7 lines:
two nonce-authorized Google loader/bootstrap scripts, unconditionally including
Adobe root/query/declined-consent cases. It subsequently reports completed live
verification: one200 official runtime download, owned destination registration,
three native base-tag beacon attempts and no page errors. These are the other
session's observations, not new Adobe byte proof.
No Adobe measurement is in flight. Existing root/import/resource/CSP/performance
proof is stale; an unchanged CSP file is not a qualified new script graph.
Do not remove/bypass the owner-directed Google tag, silently allow Google egress,
pretend the no-martech arm has no Google code, or run against old pins.
The owner's answer to a test-only Google exclusion question was unavailable;
that is not approval. Changed-site isolation/qualification is unresolved, and
this offline recovery contract alone does not authorize live execution.
Offline regression must explicitly reject a synthetic four-script Google root;
the existing root normalizer, source closure and native non-Adobe refusal are
unchanged by this recovery. No source-graph expansion or automatic pin refresh
is part of its implementation.

**Coupled implementation-scope clarification — 2026-10-15:** The orchestrator
clarified its own assignment under the owner's existing18-context grant:
`stock-baseline-browser.mjs` may change only to propagate/
validate `recovery_attempt` and the exact grant-bound controls18/stock/no-offer/
no-offer-corrected/cap4 tuple. Require recovery/control/completion flags1; refuse
missing/wrong flags, altered tuple/stage, controls2, rerun17 or >18 under recovery.
Recovery active remains exactly3–16, with each runner spec bound to the plan;
historical tuples remain unchanged. This is not a new owner grant. Root/source/
resource/URL/byte/consent/native-continuation/history-placement/timeout/cleanup
protections are unchanged.

**Offline implementation handback — 2026-10-15:** Closed recovery validation,
one-shot CAS, cumulative spending/history, indexed reporting and the coupled native
boundary are implemented with witnessed red→green tests. Native receiving sinks
prove exact18 continues once after reservation/current history, and altered
failed2 evidence refuses before sink. The actual runner accepts18 and propagates
its tuple through real native loopback interception, then deliberately stops
without SDK execution or a qualified45s sample. The prior native-contract blocker
is closed. See [exact commands, results and final source freeze](reviews/slice-02-recovery-implementation-witness.md).
No private artifact/live access, independent implementation verdict, DoD tick or
lifecycle promotion follows; full live acceptance and the Adobe goal remain incomplete.

### Query-controlled Google isolation — owner decision 2026-10-15

**Plain-language behavior:** Google stays enabled for normal visitors. Explicit
`google-ads=off` query parameters disable both the Google runtime download and
its data-layer/config initialization for the current page. Adobe stock and
no-martech test URLs use that opt-out; the original comparison criterion stays.
The actual owner message at19:42:27.150Z was: "Ok, let's make this configurable
via query parameters then", in direct reply to the Google/control conflict.
This resolves the loading-isolation permission blocker above, not source
qualification, execution readiness or the previously approved numeric limits.

**Bounded contract:**

1. Absent, unrelated or non-`off` values retain the existing fixed-destination
   Google base initialization. Any exact `google-ads=off` occurrence disables,
   including mixed duplicate values. Use `URLSearchParams`; never accept a
   URL-selected script/destination, evaluate query code or write persistent
   storage. A subsequent ordinary navigation returns to the default.
2. The disabled branch returns before Google script creation/append, Trusted
   Types policy creation, dataLayer mutation, gtag definition, `js` or `config`.
   No parser-inserted unconditional external loader remains. Default loading
   preserves the existing nonce/CSP, async native loader, owned destination
   and initialization order. Because existing CSP requires Trusted Types for
   script, dynamic assignment must use a local policy accepting only the fixed
   owned loader URL when Trusted Types is present, without broadening CSP.
3. Preserve all Adobe config/vendor fixtures and other page behavior. Coordinate
   the owned reference-repository deployment through the Google session's isolated
   clone, not Adobe's evidence-bound reference checkout. No campaigns,
   conversions, paid traffic, customer site or Adobe resource mutations follow.
4. Offline tests execute the actual head bootstrap in a DOM/Trusted-Types stub:
   default/on/off, unrelated query, duplicates, nonce/async/source/order,
   no persistent state and no initialization on disabled URLs. Harness source/
   query proof must pin the exact revised gate and explicit disabled navigation;
   do not broadly admit inline scripts or Google egress.
5. Retain prior source proofs as history. Refresh actual served root/CSP and
   loading conditions within the cumulative approved budgets before another
   Adobe measurement. Original17 remains original-source proof, never relabeled
   as a new Google-containing control. Numeric recovery18/700/50, SDK64, byte
   bounds, required observation windows and all native consent/cleanup gates
   remain unchanged. This change alone is not a live baseline pass.

**Explicit harness navigation contract:** Baseline input and plan may carry
optional `google_ads: "off"` only; no other value or new CLI switch is supported.
The property is copied into the plan and remains bound by the input/plan digests.
Historical inputs/plans without it retain byte-for-byte existing URL shapes and
qualification. One shared probe-side path constructor is used by actual browser
navigation, normal-resource reservations, captured-root qualification and expected
Adobe `page_url` construction. With the property present, append exactly one
`&google-ads=off` after `consent=decline` in both stock and no-martech paths.
Never normalize arbitrary captured queries, accept an alternative URL shape or
alter old captures to fit the new URL. Existing recovery may add only this
page-local opt-out field while all inherited scope/source/SDK fields stay exact.
This navigation change alone does not authorize a changed reference head/root,
inline-code acceptance, Google network exceptions or source-proof migration.
Test current/legacy paths, malformed modes, query tampering and actual runner/
native reservation/capture/Adobe-page-url consistency with synthetic fixtures.

**Exact conditional-root qualification:** The deployed opt-out introduces one
additional inline script before the two existing AEM modules; it does not remove
that inline gate from served HTML. Extend `normalizeStockRoot` only through an
optional third closed argument `{ google_ads: "off" }`. Without that argument,
the existing exact two-module root contract stays unchanged. With it, permit
either the legacy two-module root or exactly the three-script deployed shape:
one inline nonce-only script first, followed by the original ordered external
module tags. The inline body must have SHA-256
`a2a369997055ffeca86fa204e1a39c0c3e6d749898570866f9784e7d68cbac11`
and exactly896 UTF-8 bytes, including its original surrounding whitespace.
That pin is the reviewed deployed bootstrap, not a generalized inline-source
allowlist. The only normalized fields remain the matching script nonce values
and the single corresponding CSP token; do not remove or rewrite inline bytes,
change CSP permissions, accept attributes beyond the exact shape, or admit a
fourth script, unconditional external Google loader or arbitrary extra inline
code. All nonce values must still be canonical18-byte base64 and agree.

Propagate the digest-bound opt-out only from the actual input/plan through all
current served/capture/root normalization calls and the native normal observer.
Require a valid opt-out navigation before using the three-script profile in the
native gate; invalid/missing/repeated query values remain refused by the exact
navigation contract. Historical original17 continues under its own old plan and
two-module profile. Code-only coverage must mutate the inline body/attrs/nonce/
CSP/order/count and prove refusal, preserve old callers, and prove the exact
three-script/off loopback root passes byte qualification while a Google request
still reaches no native sink. Do not import current private source artifacts,
replace old proofs, broaden network transport or reset actual baseline state.
Current source/head/graph migration and cumulative deployment-read import are
separate audited preparation steps; this normalizer refinement does not perform
either or grant a live case. No new operator exports or public retry flags.

**Combined Google/Meta opt-out profile — 2026-10-15:**

The coordinating owner selected default-on Meta Pixel with page-local
`meta-pixel=off`, then a script-only setup with no noscript image bypass.
Candidate commit `92e21bb489e34a120ed1a2dfb5acd3aedb672827`, parent4f09c684,
retains Google body bytes and adds one nonce-only inline Meta gate before the
two original modules. Parent has retained and checked candidate head SHA
`7dfaf348d8d8fe60197bd90c0294369c27644d1bcd42b6ee1f72e15479f7b468`.
Deployment/original served combined source must still be verified.

Add optional input/plan `meta_pixel: "off"` only when `google_ads: "off"` is
also present. The shared path constructor appends exactly
`&google-ads=off&meta-pixel=off` after existing consent parameters in both arms.
Absent Meta mode preserves every old input/plan/path, including original17
and the reviewed Google-only profile. Recovery scope may add this opt-out only,
never remove an inherited one; observe/invocation/capture/reservation/expected
Adobe URL checks bind both modes. No new CLI flag or native transport permission.

The root normalizer's closed third argument may now be exactly
`{google_ads:"off",meta_pixel:"off"}`; preserve all accessor/proxy/extra-key
refusals. This combined profile requires **exactly four** ordered scripts:
the existing pinned896-byte Google gate; a nonce-only Meta inline body of
exactly1,149 UTF-8 bytes with SHA
`e03b5e9d74857249922287bec766943c7705edeb12521f9c6ebfbfc12668c6fb`;
then the two original ordered AEM modules. It does not admit a legacy or
Google-only page under the combined profile. Google-only/absent profiles remain
unchanged and do not admit Meta. Both body hashes/byte lengths are fixed pins;
no generic inline list, semantic script rewrite, external vendor loader,
noscript image or fifth script is allowed. All four nonces agree with the one
existing CSP token; normalize only those values and retain both original bodies.

Propagate both bound modes through current root/source/capture/native observer
sites. Require the exact combined URL before native four-script qualification;
missing/changed/repeated/reordered parameters refuse, without normalizing
captures. Native Google and Meta requests remain denied before reservation/
continuation/sink. Tests use only synthetic destinations/test-module pin
projections; parent separately checks unmodified production pins against original
actual combined source. TDD covers mixed/missing modes, old17 compatibility,
both exact URLs, each inline pin/body/attributes/order, nonce/CSP/extra scripts,
real loopback combined native qualification and zero external vendor traffic.
Source migration, spending import and actual baseline state remain separate.

**One-time reference refresh within the approved recovery:**

**Scoped frame PASS / offline implementation handback:** The previously held Google-only proposal is
updated to the coordinating session's final combined commit92e21bb4 below.
The final combined contract has passed independent frame review; it is not yet
implemented or executed. The session reports
no further root-tag changes planned; parent has independently checked original
served root/head response digests, both exact inline pins, canonical nonce/CSP,
no noscript and zero-effect paired-off branches without additional traffic.
Those handoff captures are not an actual baseline run. Parent has now captured
the one bounded approved-preview combined root:15,170 original bytes plus CSP,
qualified under the unprojected production profile. Immutable current source
artifacts are prepared without changing actual state. Complete the following
source/receipt implementation and scoped reviews before any fixture refresh or
recovery CAS.

The existing immutable `baseline_recovery` manifest may add only optional
`reference_refresh: Ref`; absent preserves every existing recovery rule.
This is not another attempt or a state reset. The referenced closed
`airlock.adobe-stock.reference-refresh` version1 envelope has exactly
`owner_decision`, `prior_head`, `head`, `prior_normal_page`, `normal_page`,
`source_head`, `qualification`, `source_receipts`, `commits`.
The five named evidence fields except heads/arrays are Refs. Heads are40-digit
Git hashes. `source_receipts` is exactly three distinct immutable Refs: the complete
five-call Google deployment journal, the one-call Google-only approved-preview
root journal, then the one-call final combined approved-preview root journal.
All new Refs must avoid mutable state/plan/replacing-input paths.

- Require current input `google_ads: "off", meta_pixel: "off"`. Bind `prior_head` to the immutable
  failed state's `reference_head`, `prior_normal_page` to that state's input
  source Ref, `normal_page` to current input's source Ref, `qualification` to its
  normal-map qualification and `head` to current `reference.base_commit`.
  Current versus prior `reference` may differ only in `base_commit` and
  `normal_page`; directory, config, all assets and content stay deeply equal.
  New normal-map entries stay deeply equal to the original entries; only its
  root, qualification Ref and `reference_head` change. No additional loaded
  resource, vendor asset, source-graph edge or different origin is allowed.
- This exact refresh admits the already deployed finite commit chain only:
  `9b282eb06ae09108979f2c4667eb352f1f6ff8f7` (parent `prior_head`, path
  `head.html`); `4a56d9b7012045985bbf0ef496d3cd7b4af9ca8c` (parent9b282eb,
  paths `README.md`, `head.html`, `tools/tests/google-ads-query.test.mjs`);
  `4f09c6847cedbaca59a5155bac06abc8d1affdc6` (parent4a56d9b, paths
  `README.md`, `test/google-ads-conversion-test.test.mjs`,
  `tools/google-ads/conversion-test-page.js`,
  `tools/google-ads/conversion-test.js`, `tools/google-ads/test-purchase.html`);
  `92e21bb489e34a120ed1a2dfb5acd3aedb672827` (parent4f09c684, paths
  `README.md`, `head.html`, `tools/tests/google-ads-query.test.mjs`,
  `tools/tests/meta-pixel-query.test.mjs`).
  `commits` is the ordered four-element array of closed `{head,parent,paths}`
  records above, with unique sorted paths. Final `head` is92e21bb4. This is a
  concrete immutable reference pin, not a general new-file/path exemption.
  Current reference snapshot still proves clean local/effective origin and
  matching remote HEAD; source assets/current native bytes remain independently
  gated. `source_head` original bytes must have SHA
  `7dfaf348d8d8fe60197bd90c0294369c27644d1bcd42b6ee1f72e15479f7b468`.
  Future/unannounced commits do not inherit this exception.
- `owner_decision` binds the exact retained query-isolation receipt:
  kind `airlock.owner-query-google-isolation`, version1, genuine nonfuture
  `received_at`, actual owner statement ending
  "Ok, let's make this configurable via query parameters then", approved
  behavior text, implementation fields `parameter: "google-ads"`,
  `disabled_value: "off"`, `default: "enabled"`, duplicate-handling text,
  loader/bootstrap-both-disabled true, persistent-storage false and URL-selected
  source/destination false. Its unchanged limits18/700/50/64 and all recorded
  criterion/network/reset/reclassification/renewal booleans stay false.
  Validate the existing closed receipt shape; do not treat it as a setup renewal.
- Audit both original source-spending receipts and every referenced received
  body/header by digest, retaining failures. The deployment kind is
  `airlock.google-query.deployment-spending` version1, with exactly five ordered
  requests: failed Git push178 bytes, successful Git push112 bytes, failed
  source GET charged262,144 bytes as unknown-received upper bound, received
  live-root GET13,966 bytes, received live-head GET1,247 bytes; total277,647.
  The Google-preview kind is `airlock.query-preview.source-spending` version1,
  count1/status received,13,966 bytes, target `/?google-ads=off`; final combined
  preview has the same closed source-spending shape, count1/status received,
  exact target `/?google-ads=off&meta-pixel=off`, nonzero received bytes no more
  than262,144, no upper-bound fallback for its successful response. Both origins
  equal current preflight's approved preview origin and have zero SDK/context/
  state additions. Their prior-deployment-spending Ref equals the complete
  deployment receipt. These seven attempts total291,613 plus the actual final
  preview body bytes, with count/byte sums checked, never estimated or reset.
  Exact received root/head/code bodies
  and headers stay original; test-only synthetic receipts/pins never qualify
  actual operator runs. Unknown accounting or a changed receipt refuses.
- Recovery preparation receipt `attempts` begins with the exact seven normalized
  source attempts derived from those bound receipts, then its ordinary six
  successful fixture purposes plus any actually retained failed fixture reads.
  Add only finite purposes `source.git-push`, `source.get` when this refresh
  exists. Source receipt status maps failed→failed, succeeded/received→received;
  preserve each charged byte amount and upper-bound flag. Source attempts do
  not satisfy or duplicate the six fixture-purpose successes. Without the
  refresh, these purposes remain invalid. `resource_requests` retains its
  historical field name but totals the complete source+fixture attempt list.
  Existing recovery cost/CAS imports that total exactly once, preserving the
  original310/5,204,235 base and all original contexts, errors, traces and cleanup.
  Historical six-read and ordinary recovery contracts remain unchanged.
- Current root qualification uses exact target `/?google-ads=off&meta-pixel=off`,
  final original preview receipt body and CSP, with new normal-map/head pin; do not relabel it
  as a GET of `/`. Preserve old qualification attempts and append this exact
  new attempt. Legacy no-mode maps continue requiring `/`, and a Google-only
  map uses only its exact Google-off target. Reused original17
  is always checked with its old input/map/plan, never this new source.
- Before CAS, validate the new reference using an **in-memory projection** of
  the old state's expected head only after all refresh proofs pass. Do not
  edit durable old state to make a snapshot pass. Both state and plan replacement
  rechecks still require exact immutable prior bytes and the bound refresh
  evidence. The one existing recovery CAS sets `reference_head` to the new
  reviewed plan head while importing complete preparation spending and otherwise
  performing its original transition. Active/future admissions require that
  durable head or owned config-only forward effects; no general head-drift waiver.
  No second recovery, manual retirement/reset, new context or weaker readiness
  follows. Test absent/malformed/foreign refresh, changed source/receipt/head/path/
  selector/map, missing/duplicate spend import, CAS races, legacy compatibility,
  original17 provenance and a complete synthetic plan transition.

### Bootstrap-corrected final control recovery — owner grant 2026-10-16

The owner replied "Sure, go ahead and continue" at14:32:42.923Z to the explicit
pending19-context/800-administrative/60-cleanup request. This authorizes one
corrected no-offer19, then original active3–16, not more retries. Original17 stays
under its original proof; failures1/2/18, all calls/bytes/trace/errors and cleanup
remain counted. SDK64, byte/privacy/window/native/cleanup criteria are unchanged.
The grant does not renew the genuine setup lease expiring17:14:31.818Z.

**Bounded implementation contract:** Add only optional digest-bound input
`bootstrap_recovery: Ref` alongside the existing unchanged `baseline_recovery`.
The closed `airlock.adobe-stock.bootstrap-recovery` version1 manifest contains
exact Refs `state`, `prior_input`, `prior_plan`, `prior_approval`, `owner_grant`,
`historical_assets`, `preparation_spending`, `reference_refresh`. All are distinct
immutable private paths outside canonical replacing state/plans/input. Old input
must contain one baseline recovery and no bootstrap recovery. No recursive or
third final-control retry is supported.

- Eligibility is exactly FAILED controls after[1,17,2,18], cases[17,18],
  one historical reservation belonging17, empty/unstarted active and all three
  stops verified. Effects are known verified/reversed control operations. Bind
  state/input/plan/approval hashes and all immutable review sources; prove
  failed18's original unsettled15.899s case/normal/network/trace/verification
  without requiring it pass. Original1/2/17 proof stays audited through the
  prior input/history. Reject any spent19 or previously committed bootstrap
  history. No manual reset or new baseline.
- Owner grant is the closed existing recovery-grant field set, kind
  `airlock.owner-bootstrap-recovery-approval`, version1, actual statement
  "Sure, go ahead and continue", nonfuture received time, exact19/800/60/64,
  one no-offer attempt, retained-failures true and all refund/replay/other-limit/
  renewal/unlimited-retry/readiness-waiver booleans false.
- `historical_assets` is a closed version1
  `airlock.adobe-stock.historical-assets` envelope with `prior_input: Ref` and
  `assets`, an ordered array of exact `{path,sha256,body:Ref}` matching **all**
 25 prior asset records. Every retained body must hash/size-check under existing
  protected readers; no duplicate/extra/path fallback. Bind the old input Ref.
  Use a fresh call-local historical-read scope only while auditing that exact
  prior input and its older same-digest assets/captures. Never override mutable
  config/state/plan/lock/readiness/current served data or an unknown asset.
  Current source qualification always reads actual current pinned files, not
  historical aliases. No global caching, pin relaxation or permanent rewrite.
- Current `reference_refresh` is a closed
  `airlock.adobe-stock.bootstrap-reference` version1 envelope with
  `prior_head`, `head`, `prior_normal_page:Ref`, `normal_page:Ref`,
  `qualification:Ref`, `source_receipt:Ref`, `commits`, `changed_assets`.
  Prior head is immutable failed state's424f1aac checkpoint. Final head must be
  `3f9258d53d0449a41c5f26c837eea97142d5aeac`, its exact one-child parent424f1aac;
  exact changed paths are README, scripts/scripts.js,
  tools/airlock-stock/stock-site.mjs and
  tools/tests/adobe-stock-query-isolation.test.mjs. `commits` holds the one
  `{head,parent,paths}` record with unique sorted paths. `changed_assets` holds
  exactly `{path,sha256}` for scripts/scripts.js hash
  `019b39a673d29153d36501d0022c0a4938b5116ece860f6fcba01d58d090f13a`
  and tools/airlock-stock/stock-site.mjs hash
  `ad0697e884b9fc9ad409a86189d58acbb9e4784676adcba48aec54e17ad23378`.
  All other assets/order/content/config/directory/SDKs are deeply unchanged.
  Module's new hash equals the current `code_pins.site`. No future-commit/path
  exception or arbitrary code update.
- New normal-map root bytes/CSP are unchanged from the combined prior root,
  qualification attempts retain their exact old prefix, and entries differ
  only in the two changed asset hashes/sizes. Add the exact successful original
  served source receipts to qualification; failed propagation sample remains
  counted, not admitted as source proof. Validate both new bodies via existing
  source-closure/native-byte checks; preserve full current root profile.
- `source_receipt` binds the complete original
  `airlock.stock-query-fix.deployment` version1 journal: original normal
 396/6,355,957, exact fix commit, zero SDK/API/context; four attempts comprising
  one succeeded push plus old main-script GET, current main GET and current
  stock-site GET. Require actual count4/41,392 bytes, all original body/header
  Refs checked, successful reviewed hashes on both new assets, all failed/
  stale-propagation costs retained. The normalized source prefix derives each
  purpose/status/charged-byte/upper-bound value from those four originals.
  Pending counters are not substituted for old durable totals.
- Preparation spending uses the existing closed recovery-spending shape:
  that exact four-attempt source prefix, then six fresh owned fixture successes
  and every real failed fixture read. Reuse existing finite source.get/
  source.git-push purposes but only under this manifest; fixture successes still
  mandatory and not supplied by source reads. Total count/bytes summed exactly;
  once-only import through CAS. Old recovery budgets and historical receipt
  interpretations remain unchanged.
- Current setup/preflight/routing/workspace and authority stay identical to the
  still-current prior recovery input; this is not another semantic renewal.
  Only resources/current code pins, exact two asset/source/map/head pins and
  the new manifest may differ. Both tag opt-outs remain `"off"`. Validate prior
  owned-resource receipt at its own time; current fresh snapshot must be SAVED,
  semantically equal current ownership, within its existing freshness lease.
- Reuse existing lock/sealed writer/CAS: both replacement checks require original
  canonical old state and old plan exact; validate all new proofs before any
  in-memory expected-head projection. Only the one CAS sets durable current head,
  adds full new preparation count/bytes once and appends
  `bootstrap_history:[input.bootstrap_recovery]`, replacing controls with a fresh
  UNSTARTED slot retaining only original17 and null approval/preflight/
  verification/empty effects. All older histories, errors, counters/reservations,
  page data, failed cases and cleanup remain.
- New plan discriminator `bootstrap_attempt:1` requires all prior recovery
  discriminators and `source_hashes.bootstrap_recovery` bound to the input Ref.
  Only such a plan has19/800/60 effective limits; earlier18/700/50 and older
  plans stay exact. Full required roster is17,19,3–16; controls executes19 only,
  active3–16 only. Native runner/gate must carry and narrowly validate exact19/
  stock/no-offer/cap4 tuple and the new discriminator, never relabel it18.
  The indexed report keeps failures1/2/18 visible, original17 reused once and
  required19/3–16 results. Count trace/body by bound Ref, including failed18.
  Attempted19 makes this recovery ineligible forever.
- Witness real red→green tests at actual input/plan/CAS/historical-read/native/
  capture/report surfaces, not only mocks: missing/wrong/future grant,
  changed old body, alias escaping to current data, missing/duplicate spend,
  unannounced source/hash, old-plan compatibility, actual native19 receiving
  sink after durable admission, valid full actual bootstrap/entry with paired
  offs and SDK stubs, negative request/consent/redirect conditions. No short
  window/permissive bands or fresh actual SDK call to debug the test harness.
  Scoped frame and implementation reviews precede fresh live effects, then
  five genuine exact approvals, actual12READY/current served proof and fixed
  preparation-before-start gates apply.
- **Owner-approved planner assembly correction — 2026-10-16:** The actual
  read-only assembly is363,651 bytes because valid historical maps occur in both
  proof envelopes and the current reference. For this bootstrap input only,
  snapshot `resources.recovery`, `resources.bootstrap` and the remaining planner
  framing independently, each under the unchanged262,144-byte/depth16/10,000-node
  descriptor-only bound. Validate the exact root/resource shells before reading
  their data descriptors; refuse proxies, accessors, symbols and unknown keys.
  Every existing proof/schema/binding validator still runs. Legacy inputs retain
  the original aggregate bound. This is an in-memory assembly exception, not a
  source-artifact, plan-file, SDK, network, page, trace, metadata or clock increase.

### Interrupted local config write — 2026-10-16

This is a producing-process defect in the still-unlanded operator owned by this
slice, not another baseline or retry grant. Case19 was never admitted. Before a
Git commit/push, `openConfig` ran four complete historical audits inside its
five-second writer allowance and truncated/wrote the public config in place.
An executed original-code local-only diagnostic measured four callbacks at
1,579/1,416/1,367/1,360ms,5,730ms total, with no failed proof: the writer deadline
can interrupt a valid operation after writing. The owned dirty local file then
prevented normal cleanup's clean-checkout precondition.
Parent retained original interrupted state/config, undid only the exact
unpublished owned write back to its disabled Git-HEAD bytes, and the existing
approved restore operation independently verified remote site DISABLED, Target
SAVED and schedule restored. No new case/SDK was sent. All costs remain.

**Required correction, no timeout or safety relaxation:**

- Treat public config replacement as one atomic owned-file effect, not in-place
  truncate/write. Prepare a unique same-directory temporary file, preserve
  current mode/owner and original bytes until admission, write/check complete
  bytes and fsync, then run the full historical/effect check immediately before
  atomic replacement. Recheck original file identity/bytes and current
  epoch/signal/lock before admitting rename; fsync the parent directory.
  The full historical check still occurs at the actual effect boundary; do not
  replace it with a cached success, skip it or move it after the replacement.
  Keep the existing five-second writer allowance. Harmless temporary-file I/O
  and fast cancellation checks do not each repeat the full historical audit.
- Interrupted/short/failed writes or changed proof before rename must leave
  original config bytes intact and admit no Git add/commit/push. Current-scope/
  cancellation checks after waits must prevent a timed-out writer from applying
  later. Original source/config/ownership drift remains explicit refusal.
  Retain unsettled writer ownership/sealing and exit4 precedence.
- Cleanup must handle the exact owned uncommitted config-only state without
  reverting foreign edits: only if recorded effect, current bytes, unchanged
  HEAD, unstaged config-only diff and disabled HEAD bytes all match the bound
  plan. Undo only that unpublished local effect; preserve an explicit inverse
  evidence record, never rewrite a capture, fake remote success, replay unknown
  config or alter unrelated files. Then normal remote disabled/current-owner
  readback remains mandatory. Unknown/concurrent/local staged or foreign state
  remains unverified/exit4, never a silent clean fallback.
- Regression tests must exercise actual writer/controller paths with deterministic
  parked audits/clock, valid audited operation inside writer budget, short write,
  audit tampering, interrupted fsync/rename, physical-path/inode/foreign edits,
  no late file/Git action after timeout and current cleanup of an owned dirty
  local write. Reuse the existing protected writer/nonce/CAS helpers where their
  modes fit; no new transport, retry flag, source authority, timeout increase or
  mutable-state reset. Old bytes/failures/costs remain immutable.

The provisional uncommitted blank bug002 scaffold was removed during triage
because this unlanded code path is already owned by active051-02. No accepted or
closed bug record was changed. Fresh origin/main does not contain the operator;
the original-WIP reproducer and source digest are retained privately.

### Audited reentry of an unadmitted control — 2026-10-16

The interrupted case19 controller consumed preparation/cleanup calls, but no
case19 context or SDK request. After all three stops are independently verified,
that unadmitted preparation may be retired once without erasing it. This is
needed to resume the same authorized control after the atomic-writer fix; it
does not turn a failed browser sample into a pass or permit reusing a spent19.

Add only optional input `prelaunch_reentry: Ref` alongside the unchanged
`bootstrap_recovery`. Its closed `airlock.adobe-stock.prelaunch-reentry` version1
manifest has exact immutable Refs `state`, `prior_input`, `prior_plan`,
`prior_approval`, `restore_result`, `setup_renewal`, `preparation_spending`,
`operational_budget`. None may name mutable state/plan/config/lock/replacing input.
Old input must have bootstrap recovery and no prelaunch reentry. No recursive or
second prelaunch retirement. The old canonical state must match its immutable
bytes at both replacement boundaries; the old canonical plan must match just
before plan replacement, and the exact newly written plan must match before
state replacement. Continue checking the immutable old plan throughout. A
partial transition keeps the existing refusal/sealing/ownership behavior.

- Eligible state is the actual failed, restored preparation with exactly
  contexts[1,17,2,18], one old17 reservation, controls carrying original17 only,
  empty/unstarted active, no case19 capture/page/request/reservation, and
  site/activity/schedule all verified. Bind prior approval and its five immutable
  source reviews; original restore result must be a successful restore for that
  same input digest/plan, with all three verified. The original wrapper's
  `input.path` is provenance and may differ from an equal-digest immutable copy;
  follow the bound copy after strict hash equality, never overwrite old provenance.
  Preserve failed controller results,
  owned local inverse evidence, and unknown historical effect statuses; do not
  falsely mark the original attempted enable successful.
- `restore_result` binds the existing closed
  `airlock.bootstrap19.operation-result` version1 wrapper with exact fields
  `recorded_at`, `operation`, `stage`, `exit`, `input:Ref`, `stdout`, `stderr`,
  `process_only_https_transport`, `persistent_git_configuration_changed`.
  Require restore/controls/exit0, empty stderr, nonfuture recorded time,
  process-only transport true and persistent config change false. Decode bounded
  stdout with the existing JSON parser and validate the existing complete report
  shape; require report restore/controls/restored/exit0, no reasons and all three
  cleanup states verified. Wrapper input SHA equals `prior_input.sha256`.
  This original wrapper has **no plan-digest field**: do not invent one.
  Bind the one plan for that retired input through the exact state
  `stages.controls.plan_sha256`, prior approval input/plan hashes and
  `prior_plan.sha256`, all immutable and compared with current canonical state.
  The same input cannot have a second bootstrap plan under the existing rules.
  Original wrapper path provenance is not a reason to reread an overwritten
  canonical input instead of its equal-digest retained copy.
- `setup_renewal` is a closed version1 `airlock.adobe-stock.setup-renewal`
  envelope with `confirmation:Ref`, `previous`, `current`; maps each have exact
  input/routing/workspace Refs. Previous equals retired input preflight; current
  equals new input preflight. Confirmation is the existing six-field setup
  receipt shape with genuine nonfuture received time, expiry no more than24h
  later, `unchanged:true` and bounded original owner statement. It must be a
  newly supplied actual owner unchanged-setup confirmation, not this implementation,
  a budget delegation, an unavailable answer or a clock-generated renewal.
  Parent retains actual statement/provenance; independent exact operational review
  must verify it before effects.
- Permit only the existing enumerated setup-envelope timestamp/provenance leaves
  to renew, exactly to that confirmation's received/expiry times; all original
  selectors, scope/permission/routing facts, authority reference and configuration
  facts stay deeply equal. Input authority dates and setup/preflight Refs update
  to those genuine values; resources/current code pins may refresh. All reference/
  normal-map/assets/SDK/opt-out/history fields otherwise remain identical.
  Audit retired input/plan/proof under their original recorded times and original
  source pins, not today's code or renewed statement. Current facts/readiness
  remain current. Do not globally broaden historical confirmation parsing.
- Preparation spending is the existing exact recovery-spending shape, containing
  **only** six new fixture-purpose successes and any new real failed fixture
  attempts. It has no old source prefix and must not reimport any previous13,
 10 or source-only ledger. Fresh resource Ref/time binds this receipt; count and
  charged bytes equal all actual new attempts. Preserve current462/6,962,756
  normal and42/34,475 cleanup base, every old failure and trace.
- Owner's actual15:56:11.731Z "feel free to update the approval limits as needed"
  delegates operational numeric adjustment, not setup renewal or weaker criteria.
  `operational_budget` is a closed
  `airlock.adobe-stock.operational-budget` version1 envelope with
  `authority:Ref`, `recorded_at`, `limits`, `reason`. Authority is the retained
  original closed `airlock.owner-operational-budget-delegation` version1 receipt:
  exact fields `received_at`, `owner_statement`, `context`, `delegated_scope`,
  `costs_and_failed_attempts_retained`, `unbounded_unreviewed_live_execution`,
  `consent_source_payload_rendering_cleanup_or_performance_criteria_changed`,
  `credential_resource_or_production_scope_broadened`,
  `setup_facts_reconfirmed_or_source_timestamps_renewed`,
  `existing_code_may_silently_bypass_bound_approval`,
  `current19_800_60_limits_still_sufficient`. Require actual statement
  "feel free to update the approval limits as needed", nonfuture received time,
  bounded context/delegation text, retained-costs true, the five no-waiver
  booleans false. The last sufficiency boolean stays true as its historical
  statement at receipt time, not a claim about later costs. Operational-budget
  recorded time is nonfuture and no earlier than delegation. Reason is the
  bounded exact string
  `"preserve all historical costs; execute unspent no-offer19 then active3-16"`.
  `limits` must equal the complete existing19/800/60 limit object with only
  `metadata_requests:900` and `cleanup_requests:80` changed, no omitted or extra
  fields. The finite new plan limits
  are19 contexts/900 administrative calls/80 cleanup calls, SDK64 and every other
  old byte/window/privacy limit unchanged. Budget reason binds remaining one
  unspent no-offer19 plus original14 active cases and all historical costs.
  This is one finite budget, not an arbitrary limit editor, new context20,
  source/credential authority, deadline bypass or unlimited live retries.
- New plan `prelaunch_attempt:1` requires all existing bootstrap discriminators,
  new `source_hashes.prelaunch_reentry` and the bound finite budget. Historical
  19/800/60 and earlier plans keep original validation. Native tuple remains
  current19/cap4 with paired opt-outs; no new native authority or URL shape.
- Existing CAS alone appends `prelaunch_history:[input.prelaunch_reentry]`,
  updates input hash, adds only new preparation count/bytes, and makes fresh
  UNSTARTED controls slot with new plan Ref, original17 only, null approval/
  preflight/verification and empty effects. Other histories/context/request/
  page/error/cleanup/trace accounting remain exact; active is untouched.
  Use a distinct prelaunch stage-artifact prefix for new readiness/resource/
  verification files so old bound preflight/verification paths are not overwritten.
  Preserve old plan/approval/effects/receipts immutably. Existing fixed window,
  writer sealing/lock, actual12READY, current served proof, five genuine exact
  approvals and independent cleanup apply anew.
- During runtime/observe/restore audit this retired branch under its own input,
  not the new one; source-only aliases retain their historical-only confinement.
  No inter-effect success cache, reusing old live approval, manual state reset,
  new baseline ID or mislabelled failed sample. Any admitted19 or committed
  prelaunch history makes another such reentry ineligible.
- TDD must exercise actual CLI retirement/CAS, renewed-field tampering, fake/
  missing confirmation, missing/changed restore, source/code separation, byte/
  count substitution or reimport, partial/cancelled writes, old original17
  reuse/failures1/2/18 and full synthetic19→active/observe. Current setup facts
  are not yet renewed: no actual API/SDK effect follows from this code contract.

**DoD:**
- [ ] Exact schemas/oracle reviewed; tests witnessed red/green.
- [ ] Owner-reframed AC1-8 met with real controls, return/host and performance evidence.
- [ ] Compliance/craft/architecture and exact live plan pass; actual cleanup persistent.
- [ ] Reconciliation/051-03 handoff records limits; no goal/release/tag/version invention.

## Assumptions

Pinned response/identity continuity and finite wire/return/host rules can discriminate
the assigned scenarios. Exact source qualification and real measurements remain work,
not proved by older fixtures. Browser producer/interception and temporal observations
must be tested; unsupported paths remain unverified. No existing proof establishes chamber parity.

### Deviation log (after reconciliation)

The owner-approved ADR-0039 reframe preserves historical failures/receipts. Exact operator
framing simplifies derived artifacts to one durable state and actual private source handles;
no reporting gate, generalized forensic framework or renewed owner timestamp is introduced.
No implementation or actual new case is claimed by framing.

**Scoped prelaunch implementation — 2026-10-16:** The one-time unadmitted
preparation reentry has separate compliance/craft/architecture evidence in its
[implementation witness](reviews/slice-02-prelaunch-implementation-witness.md).
The late-audit CAS finding required a non-yielding final state/plan/nonce fence,
not a larger timeout or weaker historical audit. The craft review's optional
coherently rebound retired-bootstrap/current-operator pin-divergence regression
was subsequently implemented, passed and independently reviewed as a test-only
closure; production code did not change. No genuine setup renewal or new live case,
whole-slice review, reconciliation or DoD completion follows from these passes.

**Scoped active-preparation review — 2026-10-20:** Compliance, craft and
architecture passed the dormant handoff after the three recorded corrections.
The added nested original-state proof is explicitly specified above; no other
public interface or limit changed. A nonblocking craft nit remains: non-plan
grant-refusal probes at operator test3993 also lack admissible plan/approval
files, so they do not independently prove that the early grant gate caused
refusal. Do not claim that causality; the planning positive/negative controls
remain meaningful. See scoped `slice-02-active-preparation-*` reviews and the
appended implementation witness. Actual trace authority, current qualification,
five-second audit and live readiness remain open; no whole-slice reconciliation,
DoD completion or real active case follows.

### Reconciliation sweep

Open051 and release/goal guidance follow ADR-0039; DONE records remain history.
Plan/tasks point here. New private operational evidence must be actual, not rewritten
historic sources. The former owner confirmation expired2026-10-13T14:55:35.910Z;
parent now retains the separate genuine2026-10-13 unchanged-setup receipt/current
envelopes above. Prior activity window ended2026-10-12T17:57:33Z and reference config
is disabled; owner renewal alone does not renew either deployment or readiness.

### Close-out (post-DONE)

- [ ] Real comparable stock artifact/conditions and limitations passed to051-03.
- [ ] Downstream follow-up retained without making it a boundary prerequisite.
