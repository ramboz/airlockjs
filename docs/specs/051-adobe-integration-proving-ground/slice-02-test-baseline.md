---
status: READY_FOR_REVIEW
dependencies: [051-01, 051-04, adr-0031]
last_verified:
kind: feature
frame_review: true
arch_review: true
claimed_by: adobe-adoption-goal
---

## Slice 051-02 — reproducible test setup and stock baseline

**Prior readiness blocker (2026-10-08):** The real 051-01 preparation report was unverified:
the required workspace snapshot lacked one non-selected property's optional association field.
Owner confirmation of the exact profile's property permissions was unavailable at that checkpoint.
The ready-report prerequisite remained unchecked; no empty assignment, SDK traffic, deployment
or activity activation was inferred. R-012 records that history and unchanged scope.

**Owner follow-up (2026-10-09):** The owner explicitly confirmed that the selected Admin Console
profile includes only the owned property. The parent subsequently reports a **schema-v2 real
preflight at 2026-10-09T15:39:14.468Z: exit 0 / ready, 12 required ready, four optional unknown,
12 requests**. Workspace evidence is explicitly `owner_ui_confirmation` with null HTTP status;
fresh selected-property/Analytics/Target activity/offer/site reads passed. Original selection/
routing timestamps were **not renewed**. The parent now confirms 051-04 **DONE**, with all
required reviews/reconciliation closed. This and the recent real ready report satisfy the
first preparation DoR only; later operations must still respect original evidence expiry.
Ready preparation proves neither site writes, current activation nor product receipts.

**Separate observation-access fact (2026-10-09, parent-executed):** A bounded documented Target
A/B performance-report GET with v1 Accept returned **HTTP 200, a JSON object and no error envelope**,
after fresh v3 readback verified the exact owned activity/workspace/property and saved state.
Three requests (token, activity read, report read); no mutations, SDK traffic, raw captures or
IDs logged. This establishes that exact report read's access, not numeric outcome fields,
notification semantics, report-environment selection or wider permissions. See §5.

**Goal:** An integrator can reproduce a synthetic Analytics/Target journey through pinned stock
`aem-martech` in approved test resources, including Adobe-native display reporting and outcome evidence.

**DoR:**
- [x] 051-01's utility is complete and a recent real report verifies the required access/test scope.
- [ ] Owner approves the setup plan's org, product resources, domain, mutations and cleanup scope.
- [ ] Pin the reference commit, stock Alloy version/hash and relevant SDK configuration.
- [ ] Define product receipt/report observation methods, correlation and finite waiting windows.
- [ ] Verify supported setup APIs; prepare precise guided steps for any API-unavailable operations.

## Current setup boundary

R-012, not this DRAFT, records verified owned Analytics/Target fixtures, report-query access and
scoped Target create/edit/future-only approval followed by restoration to saved/inactive.
Initial routing uses owner screenshots and a saved-environment-pin acknowledgement, not a supported
management API readback. Reuse those exact fixtures only after fresh selector/configuration checks;
an approved resource name, historical observation or normalization is not current proof.

The preparation preflight's `ready` (including 051-04's schema-v2 result) means initial
preparation under its explicitly scoped API/manual evidence policy. Before this slice's live
phase, separately clear the reviewed mutation/deployment plan,
any needed actual site-write/Target-state operation, narrowly scoped activity schedule/targeting,
receipt correlation and waiting windows. Do not turn its optional `not_exercised` diagnostics
into verified permissions. The successful push dry-run is not actual deployment. Platform
ingestion stays disabled; AJO/CJA/RTCDP are deferred for this run, not the release.

## Stock-input provenance — offline only

Parent's executed public-source comparison, 2026-10-08 (no SDK execution):

| Input | Exact pin / observation |
|---|---|
| Reference | `aem-martech` commit `1aa3dee3c4791636efa9ad2994342f861c8e149b`; README declares Alloy **2.31.1**, ACDL **3.0.1**. |
| Reference `src/alloy.min.js` | Git blob `465adc543ae11c7cfa78b0811f30652f32b27c31`; 152,335 bytes; SHA-256 `e77362b59c6124f1ab14621fcf508f482ac4b25da49902a731677eea72ec4251`. |
| [Official Alloy 2.31.1 artifact](https://cdn1.adoberesources.net/alloy/2.31.1/alloy.min.js) | 152,336 bytes; SHA-256 `7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8`. |
| Exact comparison | Reference plus one trailing LF equals official; executable bytes match. The two artifacts are **not byte-identical**. |

Use the exact unmodified official artifact with that hash in this stock arm and, later, the chamber arm.
Do not substitute historic Airlock Alloy 2.35.0 or label the reference file byte-identical.
Public-byte inspection on 2026-10-09 additionally found the pinned reference's `src/acdl.min.js`
contains version **3.0.1**, is 6,281 bytes and has SHA-256
`c8d3a94761576569086cdc65e2bd9bbcfa6ccbf73fe1adf0709f815c684b778c`.
Use that exact reference ACDL artifact; this verifies reference bytes/version, not an independent
comparison with the npm distribution. Keep the reference license/attribution with test-site assets.
The reference version/provenance is established offline only; deployed dependency/config pins
and end-to-end behavior still need verification. These facts do not satisfy any live
Analytics/Target baseline or SDK execution criterion.

**Acceptance Criteria:**

1. **Plan before apply.** Setup supports an inspection/plan mode that performs no mutations and
   lists resource reuse/creation, side effects, required approvals, quota/cost concerns and local
   state location. Apply refuses a plan outside the explicitly approved org/test scope.
2. **Repeatable scoped resources.** Re-running the approved setup reuses the same owned fixtures
   rather than duplicating them. Existing resources are not overwritten on a name collision;
   ownership/configuration conflicts are reported. Store live resource IDs only in local state.
   API-unavailable steps are documented and confirmed, not silently skipped.
3. **Pinned stock Analytics journey.** A synthetic page-view and distinct custom event traverse
   the pinned stock integration to the designated Analytics test suite. Record their relevant
   payload/routing/identity and independently observed product outcomes within the documented
   window; a sent request or HTTP response alone does not satisfy this criterion.
4. **Pinned stock Target journey.** The declared test activity returns the expected HTML offer;
   the intended placement displays it, and a native Adobe display notification referencing that
   proposition is observed in the agreed product diagnostic/report surface. Record correlation,
   actual display count and any retries/duplicates; do not assert exactly-once semantics without evidence.
5. **Negative controls.** The baseline's defined no-consent/no-offer/non-rendered cases show the
   corresponding absence or vendor-specified alternative behavior. A display notification is not
   reported for an offer that was never rendered. Controls make the receipt assertions non-vacuous.
6. **Separate product isolation.** The resource manifest verifies Analytics suite and Target
   environment/workspace/property isolation independently of AEP sandbox selection. Test activity
   activation/publication runs only within the approved test targeting; no production publication.
7. **Safe local evidence and cleanup.** Raw captures/identifiers remain local; committed fixtures
   and R-012 evidence are synthetic/redacted. Cleanup has a dry-run list of exact owned resources
   and requires explicit approval; unrelated/shared resources and sandbox resets are excluded.
8. **Measured baseline.** Collect initial performance observations under recorded browser/device/
   throttling/content conditions, preserving eager-network/rendering and main-thread cost.
   These observations establish noise and candidate budgets, not a claim that Airlock improved them.

## DRAFT v1 stock-baseline execution contract

This section makes AC1–8 specific; it does **not** replace them, satisfy DoR, transition a state,
approve a live plan or implement a tool. All paths/commands below are **planned**, not available
commands to run now. Only this DRAFT is refined. The parent confirms 051-04's reviewed completion
and the fresh real ready report. Those preparation prerequisites are met; this slice's own setup,
receipt and independent-review gates remain open. Do not tick later gates from preparation or
the separate report-access success, and do not renew source evidence timestamps.
The overall grant is strictly fewer than 10,000 credits, parent-tracked (approximately 2,600
already consumed at handoff). Eight active hours applies to **051-03 only**, not this slice.

### 1. Planned CLI, private state and approval binding — AC1, AC2, AC6, AC7

Implement one fixed-scenario Node ES-module entrypoint, `probes/adobe-compatibility/stock-baseline.mjs`,
using the existing Playwright dependency. Keep the plan/refusal, synthetic journey, observation
and restore path together unless an actual implementation need justifies a small leaf function;
this contract does not prescribe a multi-module or six-artifact framework.
No general provisioner, resource registry, plugin/adapter framework, writer service or SDK abstraction.
No new dependency, SDK
fork, full SDK bridge, Airlock core/connector change, Launch container, suite, property,
environment, datastream, schema, dataset or standalone audience creation belongs here.
Reuse **only the two known owned offers and known owned A/B activity**, by private exact selectors.

The parent supplies these **path handles**, not values pasted into commands/docs:
`AIRLOCK_STOCK_INPUT`, `AIRLOCK_STOCK_PLAN`, `AIRLOCK_STOCK_APPROVAL`, `AIRLOCK_STOCK_STATE`,
`AIRLOCK_PREFLIGHT_REPORT`, and `AIRLOCK_REFERENCE_CHECKOUT`. Resolve approved inputs only
under `AIRLOCK_ADOBE_PRIVATE_INPUTS_DIR`; credentials remain solely in the existing
`ADOBE_CREDENTIAL_FILE`/explicitly approved secret source. Never search for them, copy an export,
extract browser credentials, accept a token flag, or authenticate the synthetic browser.

```sh
# Future operator commands; none exists yet. Help alone reads nothing/makes no requests.
node probes/adobe-compatibility/stock-baseline.mjs --help
node probes/adobe-compatibility/stock-baseline.mjs plan --stage prepare \
  --input "$AIRLOCK_STOCK_INPUT" --readiness-report "$AIRLOCK_PREFLIGHT_REPORT" \
  --out "$AIRLOCK_STOCK_PLAN"
# The parent obtains approval bound to this exact no-traffic preparation plan.
node probes/adobe-compatibility/stock-baseline.mjs apply \
  --plan "$AIRLOCK_STOCK_PLAN" --approval "$AIRLOCK_STOCK_APPROVAL" \
  --state "$AIRLOCK_STOCK_STATE"
node probes/adobe-compatibility/stock-baseline.mjs verify \
  --plan "$AIRLOCK_STOCK_PLAN" --state "$AIRLOCK_STOCK_STATE"
# Separately, after the traffic gates clear, plan only the next fixed stage.
node probes/adobe-compatibility/stock-baseline.mjs plan --stage no-consent \
  --input "$AIRLOCK_STOCK_INPUT" --readiness-report "$AIRLOCK_PREFLIGHT_REPORT" \
  --state "$AIRLOCK_STOCK_STATE" --out "$AIRLOCK_STOCK_PLAN"
# Use new exclusive plan/approval handles; never overwrite the preparation approval.
node probes/adobe-compatibility/stock-baseline.mjs run \
  --plan "$AIRLOCK_STOCK_PLAN" --approval "$AIRLOCK_STOCK_APPROVAL" \
  --state "$AIRLOCK_STOCK_STATE" --arm stock --stage no-consent
# Only if run succeeds: bounded report waiting, no SDK resend.
node probes/adobe-compatibility/stock-baseline.mjs observe \
  --plan "$AIRLOCK_STOCK_PLAN" --state "$AIRLOCK_STOCK_STATE" --stage no-consent
# Later stages get separate plans/approvals, not an unattended five-stage loop.
node probes/adobe-compatibility/stock-baseline.mjs restore \
  --plan "$AIRLOCK_STOCK_PLAN" --state "$AIRLOCK_STOCK_STATE" --dry-run
node probes/adobe-compatibility/stock-baseline.mjs restore \
  --plan "$AIRLOCK_STOCK_PLAN" --approval "$AIRLOCK_STOCK_APPROVAL" \
  --state "$AIRLOCK_STOCK_STATE"
```

`apply` accepts only `stage:prepare`: reviewed saved-state edits and SDK-disabled deployment.
Each `run` accepts one reviewed traffic-stage plan and owns its pre-checkpoint, bounded activation
(except the `no-offer` control, which deliberately keeps the activity saved/inactive),
test switch enablement, synthetic traffic and immediate switch-disable/saved-state/original-schedule
restoration in a `finally` path.
`observe` never starts a browser, activates or resends events. A subsequent run refuses until
its predecessor's 120-minute observation completes; control results remain provisional until
the positives establish sensitivity. Fixed traffic-stage order is `no-consent`, `no-offer`,
`non-render`, `positives`, `performance`; preparation is not a traffic stage.
Restoration is also an explicit recovery command after interruption. There is no chamber,
dual-send, create/delete, reset, force, arbitrary endpoint/method/header, shell or raw-log flag.
Unknown/duplicate flags, extra positional arguments, unsafe paths and `--arm` other than `stock`
fail before credential access. Do not run shell command strings supplied by JSON.

Keep only the fixed input, immutable plan/approval and run state needed by this CLI; bounded
captures can be records in that run state, not a mandatory separate artifact subsystem.
Use profile `analytics-target-stock` and versioned, closed typed records rejecting unknown/
duplicate/prototype keys, invalid types/dates/enums, symlinks/nonregular files and wrong permissions.
JSON is UTF-8, at most 256 KiB/depth 16; separate private evidence bodies at most 1 MiB/depth 32.
Required bindings are:

- Input: existing exact preflight selectors/credential identity and ownership provenance;
  approved reference checkout/ref/origin/root path; immutable preparation/routing/workspace/
  review evidence references; fixed scenario, observation, measurement and lowered limits.
- Plan: exact input/evidence SHA-256 digests; `stage` and preparation/predecessor bindings;
  generation, operation deadlines and earliest actual expiry; old/desired writable projections
  and hashes; original saved state, schedule, targeting, metrics and offer contents; repository
  base SHA, exact file/diff allowlist, deploy/forward-restore effects; bounded request templates,
  traffic/observation windows, selected checkpoints/operator availability and required stops.
  Operations are closed enums for the exact objects/methods below, not executable JSON steps.
- Approval: exact plan digest, scope/credential binding, authority and independent review
  references, validity interval and exact approved prepare/deploy/activate/observe/restore
  operations. An old approval, generic `approved:true`, readiness or budget grant is insufficient.
- State: preparation/stage-plan chain and one synthetic run marker; exclusive lock, operation
  journal, pre-write snapshots/readback hashes, monotonic attempts, deployment/observation
  progress and restoration. No tokens. Captures bind stage/case/visit/time, proposition and
  scoped product outcome; allowlisted fields only, no authentication headers/cookies/credential
  responses, unrelated rows or console/HAR dump. SDK identity correlation remains private.

Private files are 0600 (existing read-only seeds may be 0400) under the approved directory.
The parent remains input/approval owner and sole orchestrating writer: its explicitly invoked
CLI may write **only exact approved run-artifact paths**, including its lock, journal, snapshots
and bounded captures. No seed/input/approval/credential rewrite, other-run overwrite or
implementation/reviewer-agent private write/access is permitted. Use exclusive creation/locking
and atomic journal replacement. This narrow execution authority needs no writer service.
Tests receive synthetic inputs and injected transport/clock/browser/Git seams, never private
handles; production fixes those seams, and operator JSON cannot supply code/adapters.

Digests bind exact immutable UTF-8 bytes; timestamps retain source RFC3339 precision.
Selector/ref grammars and credential parsing/secret-index choice reuse 051-01's reviewed rules.
Do not change closed 051-01/04 or treat the preflight, which writes no private state, as the
stock CLI's writer authority. Paths are validated handles, not printable provenance.

Before any Adobe/site operation validate exact approved bindings/scope. **Preparation gates**
are 051-04 DONE with required reviews, a real ready preflight, source freshness through the
bounded preparation deadline, owned saved/future fixtures, and a reviewed exact no-traffic
mutation/deploy/inverse plan. These permit saved-only offer/goal edits and disabled deployment;
receipt contracts remain explicit traffic stops. The owner's dedicated-site relaxation below
removes the additional audience/URL/test-marker eligibility prerequisite for this run only.
Served bytes/CSP are verified *after* disabled deployment, not demanded before any deployment.
**Activation gates** require unchanged approved suite/property/workspace/development routing,
preservation of the owner's current Page Delivery configuration, verified disabled
deployment/pins/CSP and exact planned enable/disable operations, supported receipt/count/window
contracts, available observers and
fresh original evidence through that whole stage's traffic, observation and restoration deadline.
Revalidate scope/activity immediately before activation. No report file authenticates itself.
Plan/approval expire in at most 24 hours, capped by the actual source-evidence expiry/age rules;
fresh generated timestamps do not renew sources. Scope/credential/routing/code drift invalidates
the plan. Restoration of an already journaled run remains authorized after expiry, only for
exact inverse operations, never renewed traffic or broad repair.

`plan` is inspection only: future approved exact reads, token issuance and bounded report-query
POSTs are non-mutating; no Git ref, site/resource write or browser/SDK execution. Local plan
output is explicit, exclusive and private. It may return a blocked proposal listing missing
gates, never a traffic-ready plan with required unknowns. A preparation plan can be applyable
with unresolved **traffic-only** stops recorded, provided every preparation operation/inverse
is supported/reviewed and keeps SDKs disabled and the activity saved/future-dated.
`apply` refuses preparation unknowns, expired/unbound approval, changed before-hashes,
unsaved activity or broader selectors; `run` refuses every unresolved activation gate.
Fresh reads establish ownership/configuration, not a name prefix. A missing known fixture
stops; do not create a replacement. A same-name different object, same-ID wrong workspace/
property/offer link, drifted content or foreign state is an ownership collision.

On repetition, an already journaled and exactly readback-verified desired operation is `reused`;
an unknown result is re-read before considering another write. Never blindly retry activation,
deployment or an SDK event after timeout. Distinguish `planned`, `applied`, `reused`, `refused`,
`unverified` and `restored`. Failed partial setup restores only journaled owned changes.
Deletion of any resource, audience, branch, content or report data is excluded.

### 2. Exact setup/deployment and restoration plan — AC1, AC2, AC6, AC7

**Approved designation, not a deployment fact:** dedicated reference repository
[`adobe-rnd/aem-eds-airlock-poc`](https://github.com/adobe-rnd/aem-eds-airlock-poc), code ref `main`,
test origin `https://main--aem-eds-airlock-poc--adobe-rnd.aem.page`.
R-012's metadata and authenticated push **dry run** do not prove an actual write. A credential-free
raw-bootstrap 404 was an earlier access-path result, not proof the repo is unreadable.
The subsequent read-only GitHub contents read verifies `scripts/scripts.js` git blob
**`06188f5d33d470b535773e3d7628a61c622e87c4`**, **6,274 bytes**: `loadPage()` awaits
`loadEager(document)`, awaits `loadLazy(document)`, then calls `loadDelayed()`.
This blob is a file pin, **not the repository's base commit SHA**; capture/check the latter
separately in the actual preparation plan.

Choose the existing root page **`/`** with one precisely bounded conditional bootstrap diff
in `scripts/scripts.js`, not an unverified code-served HTML route. Add same-origin
`stock-page.mjs`, `stock-page.css`, `runtime-config.json` and pinned plugin assets solely under
`/tools/airlock-stock/`. No new HTML/DA content, head/site-config change or ordinary consent edit.
The former no-bootstrap-change restriction was a DRAFT design preference, not an owner
authority limit; this reviewed opt-in seam stays within the dedicated test-code grant.
Use the pinned plugin's source/ACDL unchanged and replace
only its Alloy dependency file with the exact official bytes above. Record that LF-only
distribution difference, retain license/notice files and a public build manifest of public-source
hashes. This is an additive test installation, not redistribution in Airlock `dist`.
Actual same-origin asset serving, deployed bootstrap bytes and CSP still require verification;
if these require DA/site-configuration writes, stop for a supported separately authorized plan.

The bootstrap's single predicate must match exact preview **origin**, pathname **`/`**, no
fragment, and exactly one of each query key:
`?airlock-stock=v1&case=<fixed-case>&run=<synthetic-run-marker>&consent=decline`.
Valid cases are `positive`, `no-consent`, `no-offer`, `non-render`, `stock-perf`, `no-martech`;
the run marker uses §3's closed grammar. Reject missing/duplicate/extra keys and other values
before any test import/asset fetch. No suffix-host, prefix-path or substring matching.
No static test import, SDK preload or slot on ordinary/invalid URLs. Only a valid opt-in
creates the reserved slot, test styles and noindex marker. `no-martech` uses the same slot/
instrumentation but imports no plugin, Alloy or ACDL. SDK-enabled cases also require the
reviewed runtime switch and current approved stage window; disabled/expired configuration
must not initialize/send. Public opt-in is **not authentication**, an SDK consent grant, or
proof that nobody else can submit to public routing selectors.

**Existing consent stays unchanged:** `scripts/consent-check.js` (blob
`5af3f4090a19ba5d8ceda66027d84875edc6e368`, 1,259 bytes) defaults to decline, accepts query
`accept`/`true`/`1`/`yes`, dispatches `consent.update` with `{consented}`, and imports
`./consented.js` once on grant. The read `scripts/consented.js` is currently only an 80-byte
placeholder comment (blob `73d10a7e6345f5fa240c0a0553bc0cc8a8ab0fb5`), not an installed second SDK.
Recheck both pins/served behavior for drift; do not suppress that event, bypass the normal
delayed import, alter ordinary consent or assume future consented code is harmless.
Every synthetic URL fixes `consent=decline`, leaving that ordinary import ungranted.
Only this opt-in fixture makes/records an explicit stock `updateUserConsent` grant before
its own positive/control events; the no-consent branch explicitly denies. Do not translate
the site's delayed decline event into another grant or an unplanned revoke/resend.
This is a documented synthetic-fixture override, not ordinary-site consent policy.

The public runtime config has exactly `schema_version`, `profile`, `enabled`, `stageWindow`,
`orgId`, `datastreamId`,
`decisionScope`, `allowedOrigin`, `allowedPath`, and immutable public vendor pins. Org/datastream/
custom scope are intentionally browser-visible routing selectors, not bearer authorization;
owner approval must acknowledge this disclosure. Derive them from the approved private plan;
do not commit real selectors to Airlock docs/fixtures. No company/suite/activity/offer/workspace/
environment IDs, property token, API key, secret, IMS credential, private path, report capture or
approval is bundled. Target environment/property routing remains the managed datastream pin;
no client override, at.js `targetPageParams` or diagnostic routing discovery.
`enabled` is false on preparation and restoration; `stageWindow` is only the approved absolute
test interval, not authority to extend it.

`apply` uses an approved isolated checkout of **that reference repo**, never Airlock's shared
main checkout. Recheck its remote/ref/base SHA, clean tree and exact allowlist:
additions under `/tools/airlock-stock/` plus the single reviewed `scripts/scripts.js` diff.
That diff contains only the closed predicate, conditional phase hooks and their fixture handle;
preserve all unrelated bootstrap code and the existing eager/lazy/delayed await order.
no clone, fetch or push is performed by this refinement. The future deploy is one reviewed
non-force push of the planned commit to that reference repo's `refs/heads/main`, only if the
remote still equals the recorded base; a race refuses, never force-pushes or overwrites it.
No release/tag, `.aem.live` publication, new branch cleanup or assumed EDS-admin write.
First deploy SDK-disabled code, then verify public HTTP 200/content types and served root,
bootstrap, plugin/config/SDK hashes and CSP. Verify ordinary/invalid URL no-test-import/preload/
slot behavior and unchanged consent behavior. These deployment checks are not a stock journey.
Before any enabled journey reverify those bytes/CSP/window and all activation gates.
Wrong bytes/ref/CSP/path or unproved serving/deploy permission stops; do not bypass CSP.
Prepare forward restoration of the original bootstrap bytes and disabled runtime config;
check the current ref and touched-file hashes before every deploy/disable/restore commit.
Never reset history or revert a foreign concurrent change.

The Target plan must first re-read the **known owned** activity and two offers and capture:
workspace/property/mbox/offer bindings; saved/inactive state; original future start/end **relative
to today's clock**, not the historic “>300 days” claim; original targeting, metrics and contents.
Any currently live/shared/default resource is refused. No environment host moves, inactive-
serving switch, default/property/workspace grant edit or report reset is allowed.

Plan a harmless HTML variant in each existing offer (static text and a non-navigating button
in the reserved `#airlock-stock-slot`; no script, handler, URL, iframe or unknown markup).
Record old/new content hashes and only those exact owned-offer updates. Keep distinct offers/
experience links; do not relabel the comparison offer as a receipt-negative control. Plan the
known activity's **own** display/click metrics using supported `Metric.mboxes.successEvent`
values `mbox_shown` and `mbox_clicked`, with the exact private custom scope and distinct
private metric-local selectors greater than 2, `action.type: "count_once"`, reporting source
`target`. The existing owned display goal is freshly API-confirmed; no click goal exists yet.
Any added goal is an exact reviewed edit inside this owned activity, not authority to create
a new activity/audience/resource. Preserve originals and their exact inverse.
Official DISPLAY/INTERACT-to-goal mapping is now grounded in §5/R-012; installed click-goal
readback, actual report columns/units and downstream outcomes remain separate gates.

**Owner-directed dedicated-site relaxation — 2026-10-09:** The owner explicitly said extra
request restrictions are unnecessary for this disposable, dedicated test site and reporting
fixtures, then reported configuring a Page Delivery URL rule anyway. Preserve that owner change.
No additional audience, URL/query eligibility rule or SDK eligibility marker is required by this
run. All Visitors and the A/B split may remain unchanged. This supersedes the draft's mandatory
domain/path/pageName AND gate, not the original consent, ownership, product-isolation or outcome ACs.

Keep the exact approved Analytics suite, Target property/workspace/development environment,
known activity/offers and custom decision scope. The harness still originates bounded synthetic
requests only from the dedicated reference site; it does not send to customer fixtures, production
destinations or arbitrary endpoints. Synthetic run/event markers remain correlation identifiers,
not audience gates or authentication. Do not mint persistent profile markers, enable Platform
ingestion, add roles or alter service routing. No new audience resource is authorized or needed.

Before preparing any owned goal/offer change, re-read the current fixture and preserve the
owner's Page Delivery configuration. The latest saved state, not an older seed, is the baseline
for the plan and restoration. The current API corroborates owned scope, original future schedule,
inactive state, original custom scope and offer links; it does **not** expose the newly configured
page-delivery rule. Therefore no unsupported whole-activity round-trip, old snapshot restore or
guessed rule JSON may overwrite it. Any update must establish preservation of that owner setting
before applying. Exact rule semantics are not asserted as API-proven or required for acceptance.

**Owner editor evidence, 2026-10-09:** The Targeting view explicitly shows All Visitors,
100% traffic and equal experience allocation. This corroborates the unrestricted qualification
response; it does not establish a supported domain/path/marker editor flow. That additional
eligibility requirement and audience-panel request are superseded by the owner's relaxation.
Goals & Settings also shows unselected primary/additional goal choices and disabled Save & Close,
while a fresh exact API read retains the owned count-once display conversion. The UI discrepancy
and safe edit/restore round-trip remain unverified. Do not guess form choices or overwrite
the saved metric definition to make the editor pass validation.

Do not reuse or edit shared audiences, create an audience to satisfy a retired gate, or reset
report data. The prior `target_targeting_contract` eligibility stop is removed for this isolated
run. Preservation of owner edits during any actually planned resource update remains mandatory.

Closed future Target mutations use `https://mc.adobe.io/{privateTenant}/target`:
PUT `/offers/content/{privateOffer}` (v2), PUT `/activities/ab/{privateActivity}` (v3),
PUT `/activities/ab/{privateActivity}/schedule` (v1), PUT the same activity's `/state`
(v1, exactly `{"state":"approved"}` or `{"state":"saved"}`). GET the corresponding known
objects before/after; exact readback of writable projections is mandatory. Include the exact
workspace in offer/activity update bodies; omit read-only fields, never fall back to a default
workspace. The approved private plan freezes complete bodies before mutation.

**Preparation is separate from traffic:** while saved/future-dated, an exact reviewed plan may
prepare harmless owned offers/goals and the disabled deployment, then verify them without
requiring a receipt from traffic not yet sent. The owner's targeting/page-delivery settings are not edited by preparation.
No preparation operation approves current delivery or enables an SDK.

**Timing correction:** five anchors `T`, `T+3h`, `T+6h`, `T+9h`, `T+12h` plus the last 120-minute
observation require **at least 14 hours**, before traffic/propagation/restoration allowances.
They cannot fit the roughly four hours remaining on the **original selection/routing sources
at the recorded handoff**. That duration is not current freshness; the parent must compute
the actual earliest deadline from immutable observation/assessment/expiry records and 051-01/04's
24-hour rules. A ready report, CSV, new plan or applied report settings never renews those sources.

Freeze **one stage** per traffic plan: absolute UTC anchor, activity window
`anchor - 60 seconds` to `anchor + 60 minutes`, report intervals/checkpoints and exact inverse.
Its full deadline includes propagation, last traffic by `anchor+30 minutes`, 120-minute
observation and restoration margins, strictly before the earliest source/approval expiry.
Allow at most 20 minutes for configuration propagation using bounded exact readbacks, not
exploratory SDK traffic. Require all activation gates before approval/current delivery and
before runtime enablement. Disable the SDK switch and restore saved state/original schedule
immediately after that stage's traffic; keep reviewed goal/offer definitions only while needed
for its reports. Recheck matching journal hashes before any later approved operation.

A later stage needs a separately bound plan/approval and completed predecessor observations;
its anchor is no earlier than three hours after the predecessor anchor and later if report
granularity/late arrivals require. Do not compress the existing 120-minute waits or traffic
cases to make the old evidence pass. Completing the whole sequence requires genuinely renewed
scoped source evidence and fresh preparation checks, or bounded staged sessions each with valid
evidence and a reviewed non-contaminating report/ledger chain. Carry control sensitivity as
provisional until the positives; partial setup/stage proof is **not AC completion**.
If any chosen stage cannot fit, do only safe no-traffic work or stop, restore and retain unknowns.
No automatic schedule/approval/evidence extension. Past-ended, wrong-date, wrong-targeting or
not-yet-verified activity cannot be treated as eligible. Future-only approval proves permission,
not current delivery.

Stop runner traffic on every stage exit. Independently attempt the exact owned PUT state saved
and switch-disable forward commit/readbacks; a deployment/ref conflict must not prevent the
saved-state kill attempt, or vice versa. Restore original schedule
after each stage. After the last observation authorized by the current bounded stage plan, whether final or a
partial stop (or immediately on failure/interruption),
restore exact original targeting, metrics, offer content and other touched writable fields, and
re-read saved/inactive and every original hash. Restore the root bootstrap to its captured original bytes and the runtime switch to disabled
with a planned forward commit after testing (retain reusable assets; no file/resource deletion).
Keep restore authority and bounded inverse operations in the original approval/journal;
repeat recovery is idempotent. If a concurrent change conflicts, still stop traffic/attempt
the authorized exact owned saved-state operation, refuse overwriting foreign content, and
report `restore_incomplete` for owner recovery. Never label an unverified restore complete.
Later staged work must freshly plan any needed saved-only preparation/redeployment and bind
the actual metric definitions/report context to retained captures. If changing/restoring goals
prevents sound cross-stage correlation, that is a reporting stop, not permission to leave
activation or a public SDK switch unbounded.

### 3. Stock-only first journey and pinned integration choice — AC3, AC4

Use fresh `browser.newContext()` per declared visit with the existing Playwright Chromium:
no persistent context, Adobe login profile, prior storage state, imported customer identity,
at.js, AppMeasurement, Launch URL, Airlock boot/chamber or GA4 sink. Retain SDK-generated identity
correlation only privately; the baseline does not prove cross-session identity continuity.

**Chosen mode: phased stock plugin + site-owned manual custom-HTML renderer**, not the current
Airlock adapter and not the plugin's eager auto-report helper. Initialize the pinned module
once in the test page's eager phase:

**Exact root-seam mapping (planned, not deployed):**

| Existing bootstrap point | Only inside the exact opt-in branch |
|---|---|
| `loadEager(doc)`, immediately after `decorateMain(main)`, before `body.appear`/the existing `loadSection` first-image wait | Create the reserved slot/default content; conditionally import the same-origin fixture and await `initMartech`, explicit fixture consent and the bounded manual fetch/qualify/render/page-display path. Retain the 1,000 ms eager personalization deadline and original first-image wait. No `martechEager` call. |
| `loadLazy(doc)`, immediately after its existing `await loadSections(main)` | Await the same fixture's `martechLazy()`/ACDL initialization before recording lazy-ready; the runner waits for this before its one real button interaction. Keep original header/footer/hash/style/font behavior. |
| `loadDelayed()`, after the unchanged `import('./consent-check.js')` | Invoke the fixture's `martechDelayed()` with `launchUrls:[]`, track completion privately. `loadPage` calls, **does not await**, this original delayed function; awaiting the fixture's own completion does not justify claiming an awaited site-delayed phase. |

No-martech executes the same fixture marks/slot/instrumentation but no plugin phase calls.
Invalid/ordinary URLs take only the original site path. Fixture failure records refusal and
blocks further probe events without suppressing ordinary page loading/consent or auto-granting.
Verify the actual patch/served phase order and one SDK instance; source pins alone are not
deployment or performance evidence.

- Web SDK: exact `orgId`/`datastreamId`, `edgeDomain:"edge.adobedc.net"`,
  `defaultConsent:"pending"`, `debugEnabled:false`, `thirdPartyCookiesEnabled:false`,
  `idMigrationEnabled:false`, `targetMigrationEnabled:false`, `clickCollectionEnabled:false`,
  `autoCollectPropositionInteractions:{AJO:"never",TGT:"never"}`. No config overrides.
- Plugin: `analytics:true`, `personalization:true`, `performanceOptimized:true`,
  `personalizationTimeout:1000`, `trackPageView:false`, `dataLayer:true`,
  `includeDataLayerState:false`, `launchUrls:[]`, one exact known custom decision scope;
  default instance names `alloy`/`adobeDataLayer`. Filter ACDL to this probe's one custom
  event type. Never merge arbitrary page/data-layer state into a synthetic payload.
- Retain eager/lazy/delayed phase marks and eager network waiting. `initMartech` loads/configures
  the stock SDK eagerly; `martechLazy()` loads the exact ACDL; `martechDelayed()` has no containers.
  The eager HTML-fetch/render step uses the plugin's exported `sendEvent`, not `martechEager`.

**Why this explicit site glue:** inspected pinned `src/index.js`'s eager `applyPropositions`
filters to DOM-action items; its `martechEager` finalizer reports non-DOM-action propositions
as displayed even though their rendering belongs to project code. `trackPageView:false`
changes the event type, not that behavior. Calling it unchanged for this custom HTML scenario
can report an unrendered offer. Do not patch the pinned module/SDK or hide that limitation;
test the choice and carry this helper-fidelity gap to 051-03/054. This is a competent phased
**custom-HTML** stock baseline, not proof that every default/VEC helper is compatible.

Before traffic freeze an invented lower-case marker
`airlock05102-<32-lowercase-hex>` (no email, tenant/resource ID or reused run value). Each visit has
case plus index suffix. The **distinct** Analytics values are
`P = <marker>-<case>-<index>-page` and `C = <marker>-<case>-<index>-custom`.
Their grammar forbids quotes, wildcard, backslash, controls or arbitrary user strings.
Never use one suite-wide aggregate as receipt for both events.

For each positive visit:

1. Await `initMartech`; perform/await the synthetic grant through `updateUserConsent`
   (`collect/personalize:true`, `marketing/share:false`). Record pending→granted before events.
2. In eager phase call exported `sendEvent` with `type:"decisioning.propositionFetch"`,
   `renderDecisions:false`, `personalization:{decisionScopes:[privateScope],
   defaultPersonalizationEnabled:false,sendDisplayEvent:false}`,
   `xdm.web.webPageDetails:{name:"airlock-stock-v1",URL:exactSyntheticPageURL}`.
   Do not supply Analytics page/link mapping on the fetch. Official Analytics documentation
   says propositionFetch is dropped by Analytics; verify the resulting counts, not just the rule.
3. Require the expected custom scope, Target decision provider, original `id/scope/scopeDetails`,
   expected owned experience/offer metadata and exact harmless HTML content hash. An arbitrary
   offer at the same scope, `__view__`, unexpected type/provider/activity, redirect, JSON or
   DOM-action cannot pass. Use only demonstrably available activity/experience correlation in
   the real response; missing metadata is a required stop, not inferred ownership from scope.
4. Complete content/hash/strict-markup validation **before** giving the proposition to
   `alloy("applyPropositions",{propositions:[qualified],metadata:{
   [privateScope]:{selector:"#airlock-stock-slot",actionType:"setHtml"}}})`.
   Validate the result, actual connected/visible DOM and expected text/button after a paint.
   A `renderAttempted` flag alone is not successful display. The slot is pre-reserved at
   320×180 CSS pixels; no arbitrary selector, executable content or unbounded DOM permission.
   If the eager 1,000 ms deadline is exceeded, show default content, never render/report late.
   Record a failed positive/timeout; do not turn late receipt into a successful eager placement.
5. Only after visible rendering send one page hit through `sendAnalyticsEvent`:
   XDM `eventType:"web.webpagedetails.pageViews"`,
   `web.webPageDetails.pageViews.value:1`, and `_experience.decisioning:{
   propositions:[{id,scope,scopeDetails}],propositionEventType:{display:1}}`;
   data `__adobe.analytics:{pageName:P,pageURL:exactSyntheticPageURL}`.
   This is the native display bundled with the Analytics page event, not a second page view.
6. After lazy ACDL initialization, a real Playwright click on the rendered button sends exactly
   one `pushEventToDataLayer("web.webinteraction.linkClicks", xdm, data, {})` with XDM
   `web.webInteraction:{name:C,type:"other",linkClicks:{value:1}}`;
   data `__adobe.analytics:{linkType:"o",linkName:C}`.
   No pageName/pageURL in the **Analytics data** for this custom link; no purchase/commerce/
   custom success-event allocation needed. The **same actual rendered-button click** separately
   calls stock exported `sendEvent` with `type:"decisioning.propositionInteract"`,
   `renderDecisions:false`, `personalization:{defaultPersonalizationEnabled:false,
   sendDisplayEvent:false}`, and XDM `_experience.decisioning:{
   propositions:[{id,scope,scopeDetails}],propositionEventType:{interact:1}}`.
   No Analytics data mapping on that native interaction. Keep SDK-native interaction fields,
   not GA4 exposure. Wire shape/type is grounded in the exact Alloy artifact; its Target
   DISPLAY/INTERACT conversion mapping is officially documented in §5; installed owned goals,
   export/count/window interpretation and receipt evidence must still clear before any live attempt.

The SDK API-result promise, request payload, observed DOM, native display/interaction send,
independent Analytics report rows and independently qualified Target receipt/outcome are
**separate evidence columns**. Preserve real transport retries/duplicate payloads/counts.
No application resends; compare expected vs actual without asserting vendor exactly-once.

### 4. Finite traffic and non-vacuous controls — AC3, AC4, AC5, AC8

Freeze the scenario counts/order before activation, with separate bounded stage plans:
one fresh visit each for `no-consent`, `no-offer`,
`non-render`, then **three** positive visits and **five** `stock-perf` visits. Five `no-martech`
visits have no SDK and are interleaved with the five stock-perf visits after functional positives.
Maximum **16 fresh contexts**, only **11** with a stock installation, **10** with consent.
No retries/warmup SDK traffic, statistical power claim or automatic extra volume.

| Case | Deliberate stimulus and required local evidence | Product observation |
|---|---|---|
| No consent | Initialize pending, explicitly deny collection/personalization before attempted fetch/page/custom; keep default DOM. Instrument actual blocked/queued attempts and rejection/timeout, not an omitted action. Observe 10 seconds then close context without granting. Consent preferences/cookie and documented consent-only traffic are not “zero network.” | Exact reserved P/C rows absent; no decision/display/interact submission or qualified Target receipt. A successful positive later establishes observation sensitivity. |
| No offer | Grant consent; keep the exact owned activity saved/inactive in the verified active-only development environment. Request the **same** approved scope on the reference site and record the actual response without the owned offer. Never enable inactive serving. Send one ordinary P page and C custom link using a default-page button, with no proposition fields. | P page and C custom are received; no Target display/interact count increment. This deliberately unavailable-offer stimulus is separate from the later active positives and cannot pass without positive observation sensitivity. |
| Non-render | Grant; obtain/hash-qualify the same real HTML proposition, but deliberately do not call applyPropositions or insert it. Send the ordinary P/C events without proposition fields, using only a default-page button. | Analytics P/C are received; no native display/interact notification and no downstream corresponding increment despite eligible decision receipt. This distinguishes fetch from display. |
| Positive / stock-perf | Qualified real offer → visible reserved DOM → native display/page → actual button click/custom/native interact; fresh context each. | Both distinct Analytics receipts plus Target display/interaction receipt/outcome. |

Expected application submissions: 10 fetches, 10 page hits, 10 custom link hits, with eight
display notifications bundled into page hits and eight separate native interaction events;
one denied attempted
journey produces none of these submissions. Up to one consent exchange per stock context is
accounted separately. Ceiling **64 Adobe browser requests**, including SDK retries/consent,
and **8 KiB per synthetic event** (also below SDK's 64 KiB limit). Count SDK transport requests,
not only application calls. Unexpected duplication, routing, auto-display/click, request-budget
overflow, foreign offer, consent leak or late render stops further traffic and triggers restore.
Do not block/alter vendor requests to manufacture a passing receipt or low performance number.

Each control must have its own pre/post observation checkpoint; do not batch them into a
mixed Target aggregate where one positive could mask a negative. Require the report method's
time/count granularity to distinguish stages and late arrivals **before traffic**. If it cannot,
stop and revise/review the observation contract rather than loosen the assertion.

### 5. Real downstream observation and required semantic stops — AC3, AC4, AC5

**Analytics method chosen:** ordinary Analytics 2.0 ranked reports, not realtime, Assurance,
Data Warehouse, a browser beacon or preflight totals. Future exact HTTPS requests are GET
`/api/{privateCompany}/dimensions?rsid={privateSuite}&expansion=allowedForReporting`,
GET `/api/{privateCompany}/metrics?rsid={privateSuite}&expansion=allowedForReporting`, and POST
`/api/{privateCompany}/reports` on `analytics.adobe.io`. Existing OAuth/client-ID headers remain
server-side/in memory. Read dedicated suite timezone first; use its actual IANA zone
(R-012 observed US/Pacific), not guessed GMT.

Verify reportable `variables/page`, `variables/customlink`, `metrics/pageviews`,
`metrics/occurrences` for the exact suite. Execute the bounded zero-traffic reserved-marker
queries below before traffic; denied metadata/dimension queries or unknown processing/exclusion
rules block the traffic plan, not an otherwise reviewed saved-only/disabled preparation operation.
Generic totals-query access is **not** proof of these queries. No new eVar,
prop, suite rule, metric, realtime configuration or customer segment creation is permitted.

Freeze each stage's `windowStart`/`windowEnd` in the private plan as absolute suite-local ISO
timestamps derived from its approved UTC traffic interval, padded five minutes on either side; retain
the timezone and UTC equivalents. Refuse ambiguous DST conversion. A window may include
planned near-future traffic but must not change after it starts. Exact bodies for each P/C:

```json
{
  "rsid": "<privateSuite>",
  "globalFilters": [
    {"type": "dateRange", "dateRange": "<windowStart>/<windowEnd>"}
  ],
  "dimension": "variables/page",
  "search": {"clause": "MATCH '<P>'"},
  "metricContainer": {
    "metrics": [{"columnId": "0", "id": "metrics/pageviews"}]
  },
  "settings": {"limit": 2, "page": 0, "reflectRequest": false}
}
```

Custom body is identical except `dimension:"variables/customlink"`,
`search.clause:"MATCH '<C>'"` and metric `metrics/occurrences`. Clause matching is
case-insensitive per official docs; markers are lower-case and the response value must
equal the intended token. Require HTTP 200 with complete valid column/row/page metadata,
no per-column errors, no truncation/duplicates/other values; 206 or missing columns is
unverified. Match **row.data**, never `summaryData.totals` (which can be suite-wide).
Before traffic the reserved tokens must be absent. After traffic each expected P page/
C custom row must have the observed count recorded against intended count 1; missing,
cross-classified or >1 counts leave the criterion incomplete. No-consent absence is bounded
to its reserved tokens/window, not an assertion that Adobe retained no data anywhere.

**Target API access verified, outcome contract still unresolved:** GET
`https://mc.adobe.io/{privateTenant}/target/activities/ab/{privateActivity}/report/performance`
with Accept `application/vnd.adobe.target.v1+json`, no body/query variants. The current official
OpenAPI defines only path `id`; response `AbstractActivityPerformanceReport` includes
`reportParameters` and `activity`. Reachable report parameter definitions include activity,
environment, interval, metric-local IDs and resolution, while the activity definition includes
metric descriptors. Those inspected definitions **do not define numeric experience counts,
notification receipts, a synthetic correlation field, or environment/date query parameters**.
This is a limitation of the inspected contract, **not** a claim that the live API cannot return
additive data. Do not invent `impressions`, a response path or guessed query arguments.
The parent-executed scoped HTTP 200/readback fact above clears uncertainty about access to this
exact GET, **not** those outcome semantics. Only object/no-error shape was reported; actual
`reportParameters`, metric fields, count values and environment/interval bindings are not
claimed inspected in this refinement. No new permission or private-response access is inferred.

The public success-response reference closure was enumerated on 2026-10-09, starting at that
operation's 200 schema and following **every** component `$ref`: `AbstractActivityPerformanceReport`,
`ActivityPerformanceReportParameters`, `AbstractActivity`, `MetricDTO`, `ReportingAudience`,
`Interval`, `Chronology`, `DateTimeZone`. This closes the declared schema graph, not the set of
possible additive live fields. Root properties are `reportParameters`/`activity`; `MetricDTO`
defines only `name`, `metricLocalId`, `deletedAt`. None of this graph defines a result count,
experience-result row or processed-notification record. Its properties are not marked required,
so a JSON-object success alone establishes no useful report payload.

**Native signal mapping: known submission versus missing observation**

**2026-10-09 direct-source and owned-read update:** The owner Reports screenshot shows the
`Scoped display` goal and download/settings controls, but no environment filter. Fresh exact
activity read confirms one conversion goal with `count_once` and `mbox_shown` bound to the owned
custom scope, zero click selectors and no interaction goal. The official
[Target/Web SDK display-mbox section](https://experienceleague.adobe.com/en/docs/target-dev/developer/client-side/aep/target-overview#display-mbox-conversion-metrics)
documents scope-bound DISPLAY conversion recording. The
[Track events migration guide](https://experienceleague.adobe.com/en/docs/platform-learn/migrate-target-to-websdk/track-events)
explicitly maps INTERACT to click conversion for an mbox, retaining returned
`id/scope/scopeDetails`. These are verified source semantics, not tested downstream results.
The exact existing display metric binding is private; an additional owned interaction goal
must be included as an exact activity-local edit in the reviewed prepare/restore plan rather
than assumed already present or treated as a grant to create another resource.

| Signal | Officially grounded behavior | Still required before traffic |
|---|---|---|
| Stock Web SDK DISPLAY | After actual manual rendering, preserve `id/scope/scopeDetails` and `propositionEventType.display:1`. The direct Target display-mbox example documents scope-bound success conversion; display docs distinguish requested from shown content. | Supported numeric Target goal outcome and reviewed causal correlation to the local proposition/render ledger, activity/experience and exact environment/window; additional processed-notification diagnostics only if needed for AC4. Its Admin numeric field is still undocumented. |
| Stock Web SDK INTERACT | The official migration guide explicitly maps `decisioning.propositionInteract` to click conversion for an mbox, preserving returned proposition fields. | Confirm/create the exact owned click goal through the reviewed plan and verify its numeric/processed outcome. A generic Analytics link receipt or captured SDK payload is insufficient. |
| Target goal metrics | Official viewed-mbox/click conversions and count-once semantics are documented; the existing owned display goal is now freshly corroborated. | Install/read back the exact reviewed interaction goal while saved; establish both private metric bindings, actual export/count fields, environment and window before traffic. |
| Target A/B performance results | The exact GET is now access-verified; its public report parameter schema describes environment/interval/metric selectors and its metric schema describes metadata. | Official numeric result path/type/unit, experience/metric correlation, and supported environment/window selection for this GET. No parameter or result field may be guessed from a UI control. |

Adobe's separate [Target Delivery API Notifications contract](https://experienceleague.adobe.com/en/docs/target-dev/developer/api/delivery-api/notifications)
does document `click`/`display`, the corresponding prefetched `eventToken`, notification ID/
timestamp, and returned `notifications[].id` for successfully processed notifications. That is
a **different request/response API**. The inspected Web SDK/Admin-report docs do not establish
that this Delivery response appears in Alloy's Edge response or the performance report. Do not
import that receipt shape into this probe, add a direct Delivery send/endpoint, invent notification
IDs/tokens, or substitute a server-side/A4T journey for pinned stock behavior. It is a possible example of explicit vendor receipt semantics, not a mandatory AC4 API shape
or an authorized shortcut. AC4 does not demand an exactly-once per-notification acknowledgment.

Consequently **`required_stop: target_report_contract` remains open**. Before a traffic-ready plan,
choose and review one supported, scope-bound method with:

- Exact reportable display/interaction metric selectors and unit/counting semantics; activity,
  experience, property/workspace and selected development environment bindings; exact time
  windows and granularity; a way to distinguish eligible fetch vs actual display/interaction.
- A supported numeric response/export column mapping or product diagnostic mapping, with
  authorized context/schema verification before traffic. No arbitrary additive-field guessing.
  Review whether the native goal outcomes, officially documented DISPLAY/INTERACT mechanism,
  qualified proposition/render/click ledger and isolated activity/experience/stage deltas
  provide the causal evidence AC4 requires. Do not claim per-notification attribution from a
  mixed aggregate; an unchanged empty report is not a negative-control pass.
- If that reviewed evidence basis is insufficient, require a supported vendor-native diagnostic
  correlating the notification **in addition to** scoped product counts. A transport debug entry
  is not that diagnostic. No per-notification/exactly-once requirement is silently added to AC4.
  Preserve vendor metric units; Visitors/Visits/Activity Impressions are not interchangeable or
  automatically equal DOM display count/native notification count.

**Remaining unresolved signal needed:** the actual supported numeric result field/export column
for the mapped display/click goals and activity/experience/environment/interval/count-unit
correlation — or a documented
Edge-compatible processed-notification diagnostic plus those scoped product counts.
The official Admin report's declared metadata and a successful access check supply neither.
Do not request broader reporting permissions merely to explain this schema gap, and do not
send exploratory traffic to discover what an undocumented field might mean.

**Optional product-outcome candidate, not the only route:** the native **Reports → Report Settings**
view and CSV export can supply a scoped product-count observation if their actual semantics
and filters are established.

**2026-10-09 original CSV inspection:** The supplied native export has metadata and the header
`Experience,Experience Description,Segment,Visitor,Scoped display,Conversions,Total Sales,
Sum of Sales Squared,Mean Conversion Time,Sum of Conversion Time Squared,Engagement,
Sum of Engagement Time Squared`, with no data rows. Its timezone is `US/Pacific`;
`Conversion Counter: undefined` is unusable for counting semantics. No environment or report
date bounds are present. Keep original bytes privately; do not synthesize zero-experience rows,
guess metric-column equivalence or treat the empty export as a negative control.

The fresh owned unfiltered Admin report's environment parameter differs from the approved
development routing, despite matching activity/metric selectors. This does not establish the
UI export's environment. Before traffic, inspect the native report gear's environment and
counting methodology and bind its visible date range separately. Do not guess API filters or
change shared presets, resource routing or activity state to fill the missing evidence.
The confirmed header can seed invented parser tests later; populated numeric/count/experience
semantics still require the reviewed observation contract.

**Owner settings evidence, 2026-10-09:** The supplied panel now confirms Production/Visitors
selected, with Airlock - Development and Activity Impressions available. Keep that original
visitor-based export as historical evidence. The planned report context must select the owned
development environment and Activity Impressions before its next capture/export; applying
report-view settings does not activate the activity or change service routing. Do not create or
save a shared preset, reset data or infer a selected development filter before confirmation.
Preserve count-once goal semantics separately from the reporting denominator.

**Subsequent applied-view evidence (owner's 17:21:33 “Done”, 2026-10-09):** The owner supplied the changed
Airlock - Development / Activity Impressions panel plus a separate native CSV. Its denominator
header is `Impression`, not the historical `Visitor`; no experience rows are present. This clears
report filter/counting selection only. The prior report-date image showing **Oct 2–Oct 10**
is not a precise future stage-interval binding; neither CSV contains report window fields.
Record this as current evidence without asking for more already-provided screenshots.
Bind the actual chosen report interval and checkpoint times at execution; no date bounds,
zero counts or processed events are fabricated from the panel/header-only CSV/undefined counter.

The official Target settings documentation
documents choosing environment, dates,
Visitors/Visits/Activity Impressions and metrics; **Download Reports → Export Report to CSV**
is a supported manual product-count source. The proposed observation is the exact owned activity,
reporting source Target, exact development environment, a supported frozen report date interval
capable of separating the chosen stages and all owned experiences. **Airlock - Development /
Activity Impressions is already confirmed applied**, not an outstanding selection request;
retain/check that context at the actual checkpoint and select the reviewed display/click goals.
Read
goal **conversion counts**, not lift, confidence or conversion-rate percentages. Capture a
pre-stage export and each **chosen manual** post-stage export, preserving both experiences even if
random assignment chooses only one. Compare per-experience deltas to the privately observed
render/click ledger using the reviewed “count once” goal semantics and fresh-context identity
boundaries, not an exactly-once transport guarantee.

Use bounded private run capture records with `source:"target_outcome"` and data exactly
`basis`, `artifact_sha256`, `source_ref`, `bindings`, `rows`, `column_mapping_ref`, `observer_ref`.
Basis is `target-native-report-export`; bindings pin activity/environment/workspace/property,
reporting source, metric-local selectors, the actual supported report interval, source timezone,
UTC pre/post checkpoint timestamps and counting method. Rows contain only the
known private experience selector and `display_goal_count`/`interaction_goal_count` as observed
non-negative integers. The raw export stays private, bounded and unchanged. The parent records
the real source/observation time and reviewed column mapping, not a success boolean or guessed
counts. `observe` consumes only this prebound private evidence, never an authenticated UI browser.

This is a **specific optional downstream count method**, not a newly observed receipt.
The supplied evidence establishes the applied development/impression view, scoped display goal
and header-only `Impression` CSV layout. It does **not** establish populated goal counts, their
column equivalence or stage windows. Direct official sources ground notification-to-goal
mapping; the actual export still needs its supported goal-column/unit/experience/window contract.
Before traffic, verify the actual export columns/filter binding and officially supported goal/
notification semantics. If per-stage causal correlation through the activity/experience and
native goal counters satisfies AC4, record that exact evidence basis and its limits in the reviewed
plan; otherwise a supported per-notification diagnostic is additionally required. Either unresolved
case remains `required_stop: target_report_contract`; an impression/visitor total alone cannot
clear it. Owner availability for **each actual chosen checkpoint** is also an explicit blocker,
not assumed unattended export automation.

Do not automate an authenticated Adobe browser profile or scrape screenshots. Do not change
reporting presets, reset or delete report data, assume Assurance access, or silently fall back
to UI. A traffic plan choosing this manual route
must bind its evidence handle/column mapping, actual operator times/availability and be reviewed
before activation; the API candidate
cannot be made green by swapping in an unreviewed CSV or a “Target 200.”

**Waiting policy (chosen before traffic, not a vendor latency guarantee):** at each isolated
stage, take a pre-traffic checkpoint. Analytics/API-capable observation has post-event offsets
0, 5, 15, 30, 60 and 120 minutes. If Target uses manual CSVs, freeze its actual checkpoints:
at minimum pre-traffic, 60 and 120 minutes; earlier additional exports require explicitly
available operator slots in that plan, not an unattended polling promise.
A positive needs matching receipt/count evidence stable at two selected scheduled observations;
controls require complete zero corresponding increment at both 60 and 120 minutes
and demonstrated positive sensitivity in the same run. Wait externally with the activity
saved/inactive and SDK switch disabled between separately planned stages; no activity stays live for
report polling. If the report granularity cannot distinguish those windows or lateness contaminates
a subsequent checkpoint, stop and retain unknowns — no silent activation extension.
If the operator is unavailable, a checkpoint is missing, or window/granularity/counting context
is unknown, stop that stage as unverified; do not fill in counts or renew sources from the CSV.
Use the vendor's actual supported report-date/time format and measured availability/latency,
not a guessed CSV field or an invented processing guarantee.
No server-error retry; a later scheduled report read is not an SDK resend. A finite two-hour
timeout is `unverified: receipt_not_observed`, not loss, success or permission to send again.

Pretraffic contract/access inspections have a ceiling of 40 requests. Observation has at most
180 report requests overall. Freeze combined MATCH-OR clauses for the positive/performance
stages: `MATCH '<P1>' OR MATCH '<P2>' ...` and the distinct corresponding C clause, with
limit `2 × numberOfTokens`, exact per-token row validation and no pagination. Single-visit
controls use the exact single-token bodies above. Completing all five stages would use
**70 Analytics queries** (five × seven checkpoints × two queries). A fully API-capable Target
method could add 35 reads; a manual route's minimum is **15 operator exports**, not 35 automatic
exports. None is presumed staffed or outcome-verified. Freeze the selected method/checkpoints/
request counts **per stage**, and retain the 180-request whole-sequence ceiling in the journal
across plans. Additional diagnostic reads/exports require planned bounds and operator availability.
Request timeout 10 seconds; response 1 MiB; total decoded
observation data 16 MiB. Byte/request ceilings may be lowered, not raised without plan review.
OAuth is in memory; refresh only at an explicit approved observation invocation, never on a
401. HTTPS exact endpoints, no redirects, credentials to site URLs, broad enumeration or
hidden/internal service routes.

### 6. Lab performance, reports and validation — AC7, AC8

Record OS/Chromium/Playwright versions, content/deployed/config hashes, 1365×768 viewport,
device scale 1, fresh contexts/cold browser cache, no service workers/extensions/prerender,
four-fold CPU slowdown and network emulation (1.6 Mbps down, 750 Kbps up, 150 ms latency).
Collect five interleaved no-martech/stock-perf pairs using the **same page/slot/content**;
no-martech retains default static content, SDK disabled. Each trace covers navigation,
eager decision wait/1,000 ms deadline, actual host rendering, ACDL lazy loading and the same
one synthetic button interaction through ten seconds after it. Keep failed/time-out runs,
not favorable replacements. Timing instrumentation must run in both arms equally.

Report all samples, median/range and differences for navigation/LCP/CLS, long-task count/time,
main-thread scripting, decision wait, actual render duration and scripted interaction latency/
Event Timing where available; preserve unavailable readings as unavailable. Any TBT is explicitly
labelled its trace interval/definition, not silently equated to Lighthouse TBT. This is **LAB**
evidence, not field Core Web Vitals, population INP, release performance bands, A/B significance
or Airlock improvement. Functional receipt is required for the stock-perf journeys too;
fast failure is not product-qualified performance. Chamber/worker/clone costs are 051-03's
later separate measurements, not zero-valued columns here.

Stdout is one `airlock.adobe-stock.report` v1 JSON document:
`kind`, `schema_version`, `profile`, `operation`, `generated_at`, `overall`, `exit_code`,
`checks`, `counts`, `claims`. Fixed check IDs cover `preparation`, `approval`, `ownership`,
`targeting`, `deployment`, `pins`, `analytics_receipt`, `target_receipt`, `controls`,
`measurement`, `restoration`. States are `passed|blocked|unverified|not_exercised`;
reasons/next actions are closed enums including the named required stops, `scope_mismatch`,
`collision`, `stale_plan`, `drift`, `access_denied`, `contract_unknown`, `receipt_not_observed`,
`duplicate_observed`, `budget_exhausted`, `restore_incomplete`. Stderr contains enum/count
summary only. Never include arbitrary server/parser/exception/console strings, URLs/paths,
selectors, hashes derived from private resources, synthetic markers, identity values, offer
contents, report IDs or raw rows. Publish aggregates of **synthetic** results only after this
allowlist projection; no copied object/spread of private evidence. Claims explicitly deny
full SDK/product-stack compatibility, field CWV, production/release authority and dual-send.

Exit 0 requires all checks applicable to that operation satisfied (plan success is only
plan readiness, never baseline acceptance); exit 1 is blocked/unverified, exit 2 invalid
invocation/schema, exit 3 internal failure. Every operation reports whether restoration is
not exercised, complete or incomplete; an incomplete restore cannot disappear behind a
receipt pass. Final baseline acceptance requires AC1–8 evidence and independent reviews,
not an operation's exit code alone.

Planned smallest hermetic validation command:

```sh
npm test -- test/adobe-stock-plan.test.js test/adobe-stock-cli.test.js \
  test/adobe-stock-observation.test.js test/adobe-stock-browser.test.js \
  test/contract-stability.test.js
```

Write witnessed failing tests first, then implementation. Cover exact pins including official
Alloy's LF/hash; version/flag/path/schema refusals; zero mutations in plan; stale/unbound approval/
preflight/workspace/routing; exact owned reuse/missing/name collision/foreign-state/config drift;
fixed method/version/body/redirect refusal; base commit vs bootstrap-blob pin, exact bootstrap
diff/phase mapping, non-force deploy/ref race and wrong served bytes/CSP; ordinary/invalid query
no import/preload/slot, fixed `consent=decline`, unchanged consent event/import and explicit
fixture-only grant/deny; no-martech plugin/SDK/ACDL absence; disabled prepare vs enabled traffic
gates without a deploy-verification cycle; original future-date validation against clock;
exact targeting/schedule/state
readbacks; interrupted writes/re-run lock/journal/restore ordering and conflicts; no deletion/
creation/default edits; supported stock exports/single instance/ACDL custom event; safe HTML,
actual render vs renderAttempted/late rendering; no-consent attempted events and consent-only
exception; no-offer and **real qualified-but-not-rendered** stimulus; no premature native display/
interact or extra page/link hit; parent-invoked exact run-artifact writes without seed/input/
approval/credential writes; per-stage actual expiry, predecessor/partial-sensitivity binding and
full 120-minute waits; operator checkpoint unavailability; staged observation/metadata/error/206/truncation/correlation/
duplicate/timeout/count-unit failures; access-verified HTTP 200 with `{}`/metadata-only report
remaining outcome-unverified; no borrowed Delivery receipt shape or compulsory manual fallback;
report zero without a positive; redaction with malicious
private/response/exception strings; all request/byte/browser ceilings. Hermetic SDK/browser stubs
prove harness behavior only; fixture “receipts” must never pass the live acceptance path.

## Public grounding and unresolved decisions

Inspected public sources on 2026-10-09; no authenticated call, private input/image/credential
access, resource write, deploy or SDK execution in this refinement:

| Source | Load-bearing use |
|---|---|
| [Reference bootstrap contents](https://api.github.com/repos/adobe-rnd/aem-eds-airlock-poc/contents/scripts/scripts.js?ref=main), [consent check](https://api.github.com/repos/adobe-rnd/aem-eds-airlock-poc/contents/scripts/consent-check.js?ref=main), [consented placeholder](https://api.github.com/repos/adobe-rnd/aem-eds-airlock-poc/contents/scripts/consented.js?ref=main) | Executed read-only contents reads establish the exact file blobs/byte lengths in §2, eager→lazy awaits then unawaited delayed call, ordinary consent query/event/one-time import and currently comment-only consented source. Mutable main links are not a deployment/base-commit pin; bind those separately. |
| [Pinned `aem-martech` README](https://github.com/adobe-rnd/aem-martech/blob/1aa3dee3c4791636efa9ad2994342f861c8e149b/README.md), [`src/index.js`](https://github.com/adobe-rnd/aem-martech/blob/1aa3dee3c4791636efa9ad2994342f861c8e149b/src/index.js), [`src/acdl.min.js`](https://github.com/adobe-rnd/aem-martech/blob/1aa3dee3c4791636efa9ad2994342f861c8e149b/src/acdl.min.js) | Exact exports/defaults, eager non-DOM-action display assumption, lazy ACDL mapping, no automatic page hit when trackPageView is false. ACDL pin/hash above is an executed read/hash, not SDK execution. |
| [Official Alloy 2.31.1 bytes](https://cdn1.adoberesources.net/alloy/2.31.1/alloy.min.js) | Executed public hash agrees with the required pin; inspected options validator/native propositionInteract/propositionEventType and auto-interaction configuration. No execution. Current docs' additional options cannot be assumed present in this old pin. |
| [Official sendEvent](https://experienceleague.adobe.com/en/docs/experience-platform/collection/js/commands/sendevent/overview), [HTML applyPropositions](https://experienceleague.adobe.com/en/docs/experience-platform/collection/use-cases/personalization/render-html-offers), [manual display events](https://experienceleague.adobe.com/en/docs/experience-platform/collection/use-cases/personalization/display-events), [top/bottom events](https://experienceleague.adobe.com/en/docs/experience-platform/collection/use-cases/personalization/top-bottom-page-events) | Custom scope fetch, metadata-based HTML rendering, explicit display only after rendering; propositionFetch is not an Analytics page hit. |
| [Consent](https://experienceleague.adobe.com/en/docs/experience-platform/collection/js/commands/setconsent), [click collection](https://experienceleague.adobe.com/en/docs/experience-platform/collection/js/commands/configure/clickcollectionenabled), [proposition interactions](https://experienceleague.adobe.com/en/docs/experience-platform/collection/js/commands/configure/autocollectpropositioninteractions) | Collection opt-in/out, consent cookie/exchanges, explicit prevention of duplicate automatic link/interaction sends. |
| [Analytics data mapping](https://experienceleague.adobe.com/en/docs/analytics/implementation/aep-edge/data-var-mapping), [hit types](https://experienceleague.adobe.com/en/docs/analytics/implementation/aep-edge/hit-types), [official OpenAPI](https://github.com/AdobeDocs/analytics-2.0-apis/blob/main/static/swagger.json), [report examples](https://github.com/AdobeDocs/analytics-2.0-apis/blob/main/src/pages/guides/endpoints/reports/examples.md), [MATCH search grammar](https://github.com/AdobeDocs/analytics-2.0-apis/blob/main/src/pages/guides/endpoints/reports/search-filters.md) | Separate pageName vs custom linkName/linkType and downstream dimension/metric/row queries; page/link classification and avoidance of suite totals. |
| [Target Admin OpenAPI](https://github.com/AdobeDocs/target-developers/blob/main/src/admin-api.json), [official Reports reference](https://developer.adobe.com/target/administer/admin-api/#tag/Reports), [report settings](https://experienceleague.adobe.com/en/docs/target/using/reports/settings/report-settings), [report view/export](https://experienceleague.adobe.com/en/docs/target/using/reports/reports) | Exact mutation/report versions; complete declared 200-schema reference graph, metadata rather than defined result counts; UI environment/counting-method choices. Parent verified access to the scoped report GET; receipt/result mapping remains unknown. |
| [Target/Web SDK display-mbox conversion](https://experienceleague.adobe.com/en/docs/target-dev/developer/client-side/aep/target-overview#display-mbox-conversion-metrics), [Track events migration](https://experienceleague.adobe.com/en/docs/platform-learn/migrate-target-to-websdk/track-events), [Target success metrics](https://experienceleague.adobe.com/en/docs/target/using/activities/success-metrics/success-metrics), [Delivery API Notifications](https://experienceleague.adobe.com/en/docs/target-dev/developer/api/delivery-api/notifications) | R-012's direct official reads ground DISPLAY/INTERACT mbox goal conversions and count-once behavior; distinct Delivery notification-ID acknowledgment is not Alloy's report contract. Actual Admin/export numeric fields, stage/experience/count units and outcomes remain unresolved; no Delivery endpoint substitution. |
| [Target Site Pages](https://github.com/AdobeDocs/target.en/blob/main/help/main/c-target/c-audiences/c-target-rules/site-pages.md), [Custom parameter rules](https://github.com/AdobeDocs/target.en/blob/main/help/main/c-target/c-audiences/c-target-rules/custom-parameters.md), [Web SDK parameter mapping](https://experienceleague.adobe.com/en/docs/platform-learn/migrate-target-to-websdk/send-parameters) | Historical investigation of extra qualification rules; owner waived that added dedicated-site gate. API rule objects remain opaque and owner Page Delivery settings must be preserved. |

**Preparation still needs** an exact reviewed no-traffic saved-offer/goal/disabled-deploy plan
and inverse, current ownership/before hashes, real relevant write/serving checks and evidence
freshness through its own deadline. **Traffic still requires** exact owned scope/routing and
preservation of the owner's Page Delivery setting, actual deployed
bytes/CSP/switch/window readback; dedicated-suite dimension/processing contract; installed
owned click-goal readback; supported Target goal-column/count-unit/experience/window correlation;
actual operator availability where manual; and separately bounded schedule/observations compatible
with source freshness and full two-hour waits. The applied development/impression view and
official DISPLAY/INTERACT mapping are established facts, not unresolved selection/mechanism gates.
Implementation architecture/setup review and the unchecked DoR remain open; the separate
owner-decision frame verdict is recorded below. Record a required stop for each applicable
unknown. No bare receipt flag, permissive proxy,
new entitlement, guessed API or GA4 substitute clears them. AJO/CJA/RTCDP remain deferred for
this proving ground with their broader requirements unchanged.

**Subsequent owner-decision frame review:** Independent critique passed after the dedicated-site
eligibility relaxation and recorded plan corrections. Status is READY_FOR_REVIEW; the source/
mutation/deployment/observation DoR items remain open. This frame pass establishes a sound proposed
approach, not an implemented tool, safe whole-activity update, renewed routing or live outcome.

**Next execution step:** review the revised isolated-test frame and implement the bounded
no-traffic plan/refusal path with TDD once its actual prerequisites clear. Do not request more
targeting screenshots or add an audience/marker requirement retired by the owner. Re-read
current owned settings, and never replace the owner's Page Delivery edit with an older seed.
Actual update preservation, fresh routing evidence and stock receipt/restore gates still govern.
Hermetic work and independently reviewed disabled preparation can proceed only under their
separate applicable gates; neither clears AC3–8.

**DoD:**
- [ ] Setup plan/apply/reuse/refusal and redaction behavior have hermetic tests with witnessed failures.
- [ ] Stock Analytics/Target positive and negative live evidence is recorded using the approved methods.
- [ ] Product latency/visibility blockers leave baseline acceptance incomplete; no stub passes as live evidence.
- [ ] Compliance/craft and reconciliation evidence recorded; deviation log and sweep completed.
- [ ] Operator instructions and R-012 contain a reproducible scenario and explicit remaining constraints.

**Anti-horizontal-phasing check:** This slice delivers a usable stock reference installation and
observed product journey, not merely schemas/datastreams that might enable a future test.

## Assumptions

- The chosen root-only conditional phase hook and same-origin assets can be deployed without
  DA/site-administration changes. Exact bootstrap/consent source blobs are now readable and
  grounded in §2; actual writes, served hashes and browser/CSP remain unverified.
- Any planned owned goal/offer update can preserve the owner's current Page Delivery setting
  despite it not appearing in the inspected activity response. Establish supported update
  preservation before applying; never guess or overwrite it. Extra eligibility rules are not
  a required assumption after the owner's dedicated-site relaxation.
- The dedicated suite exposes the selected page/custom dimensions and metrics without rules
  suppressing/rewriting synthetic hits. Existing totals-query permission is not that verification.
- A supported Target report/diagnostic can establish display/interaction receipt and product
  counts with environment/experience/stage correlation inside the finite windows. Current public
  performance definitions do not establish these semantics; §5 is a required pretraffic stop.
  The exact report GET's access is now verified separately, not assumed absent.
- The stock custom-HTML project-renderer path, fixture-only explicit consent, base-schema routing
  with Platform disabled, documented native goal signals and eager deadline can produce the journey.
  Official mapping is known; no SDK or live
  outcome has verified this; unknowns must not be converted into passing fixture evidence.

### Deviation log (after reconciliation)

Not implemented; no resources or stock outcomes have been observed by this draft.

### Reconciliation sweep

Pending implementation: update R-012, setup/probe instructions, local-state/redaction contract,
release handoff, status board and any approved architecture/decision changes.

### Close-out (post-DONE)

- [ ] Regenerate the status board and identify the exact stock baseline available to 051-03.
- [ ] Preserve unresolved product/API limits and targeted cleanup ownership.
