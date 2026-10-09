---
status: DRAFT
dependencies: [051-01, 051-04, adr-0031]
last_verified:
kind: feature
frame_review: true
arch_review: true
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
routing timestamps were **not renewed**. 051-04 frame/compliance/craft/architecture reviews passed
and closing reconciliation is in progress, not yet DONE. Leave the first DoR unchecked until
051-04 closes; then assess that actual report's remaining freshness. Ready preparation still
proves neither site writes, current activation nor product receipts.

**Goal:** An integrator can reproduce a synthetic Analytics/Target journey through pinned stock
`aem-martech` in approved test resources, including Adobe-native display reporting and outcome evidence.

**DoR:**
- [ ] 051-01's utility is complete and a recent real report verifies the required access/test scope.
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
commands to run now. Only this DRAFT is refined. 051-04 is being implemented independently;
its reviewed completion and the fresh real ready report remain prerequisites, as do this slice's
own setup, receipt and independent-review gates. The report above now supplies ready preparation,
but do not tick the dependency/readiness DoR until 051-04 closes or tick later gates from it.
The overall grant is strictly fewer than 10,000 credits, parent-tracked (approximately 2,600
already consumed at handoff). Eight active hours applies to **051-03 only**, not this slice.

### 1. Planned CLI, private state and approval binding — AC1, AC2, AC6, AC7

Implement one fixed-scenario Node ES-module entrypoint, `probes/adobe-compatibility/stock-baseline.mjs`,
with leaf contracts in `stock-contract.mjs`, observation parsing in `stock-observation.mjs`
and the existing Playwright dependency used by `stock-browser.mjs`. These are small probe
functions, not a general provisioner, resource registry, plugin/adapter framework or SDK abstraction.
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
# Future operator commands, in order; help alone reads nothing and makes no requests.
node probes/adobe-compatibility/stock-baseline.mjs --help
node probes/adobe-compatibility/stock-baseline.mjs plan \
  --input "$AIRLOCK_STOCK_INPUT" --readiness-report "$AIRLOCK_PREFLIGHT_REPORT" \
  --out "$AIRLOCK_STOCK_PLAN"
node probes/adobe-compatibility/stock-baseline.mjs apply \
  --plan "$AIRLOCK_STOCK_PLAN" --approval "$AIRLOCK_STOCK_APPROVAL" \
  --state "$AIRLOCK_STOCK_STATE"
node probes/adobe-compatibility/stock-baseline.mjs verify \
  --plan "$AIRLOCK_STOCK_PLAN" --state "$AIRLOCK_STOCK_STATE"
# Each run waits for its preplanned stage anchor; observe is bounded report waiting.
# Stop the sequence on any failure. The CLI performs safety restoration on failure.
for stage in no-consent no-offer non-render positives performance; do
  node probes/adobe-compatibility/stock-baseline.mjs run \
    --plan "$AIRLOCK_STOCK_PLAN" --approval "$AIRLOCK_STOCK_APPROVAL" \
    --state "$AIRLOCK_STOCK_STATE" --arm stock --stage "$stage" || break
  node probes/adobe-compatibility/stock-baseline.mjs observe \
    --plan "$AIRLOCK_STOCK_PLAN" --state "$AIRLOCK_STOCK_STATE" \
    --stage "$stage" || break
done
node probes/adobe-compatibility/stock-baseline.mjs restore \
  --plan "$AIRLOCK_STOCK_PLAN" --state "$AIRLOCK_STOCK_STATE" --dry-run
node probes/adobe-compatibility/stock-baseline.mjs restore \
  --plan "$AIRLOCK_STOCK_PLAN" --approval "$AIRLOCK_STOCK_APPROVAL" \
  --state "$AIRLOCK_STOCK_STATE"
```

`apply` prepares/deploys only; each `run` owns its pre-checkpoint, bounded activation, synthetic
traffic and immediate saved-state/original-schedule restoration in a `finally` path.
`observe` never starts a browser, activates or resends events. A subsequent run refuses until
its predecessor's 120-minute observation completes; control results remain provisional until
the positives establish sensitivity. Exact stage names/order are fixed as shown.
Restoration is also an explicit recovery command after interruption. There is no chamber,
dual-send, create/delete, reset, force, arbitrary endpoint/method/header, shell or raw-log flag.
Unknown/duplicate flags, extra positional arguments, unsafe paths and `--arm` other than `stock`
fail before credential access. Do not run shell command strings supplied by JSON.

All six artifact kinds use `schema_version: 1` and reject unknown/duplicate/prototype
keys, invalid types/dates/enums, symlinks/nonregular files and wrong permissions. JSON is UTF-8,
at most 256 KiB/depth 16; private evidence bodies at most 1 MiB/depth 32. Files are owner-only
0600 (existing read-only seeds may be 0400), under the approved directory; the parent is the
sole private-state writer. Use an exclusive run lock and atomic journal replacement; never
overwrite a different run, seed, snapshot or another operator's state. Implementation/test
seams receive synthetic inputs and injected transport/clock/browser, not private handles.

| Private artifact `kind` | Required contract |
|---|---|
| `airlock.adobe-stock.input` | Profile `analytics-target-stock`; exact existing org/company/suite, tenant/workspace/property/environment/datastream, activity/two-offer selectors; known ownership provenance; approved reference repository/ref/origin/path and checkout handle; original credential-identity binding; fresh preflight/routing/workspace evidence references; exact requested mutation/restore scope; scenario/correlation/observation/measurement policy below. |
| `airlock.adobe-stock.plan` | Immutable input and evidence digests; generated/expiry timestamps; exact selectors **private**; stock pins; old/desired writable projections and hashes; original saved state, future schedule, targeting, metrics and offer contents; repository base commit, allowed files and intended deploy/restore commits; resolved receipt adapter/version/semantics and exact request templates/windows; traffic/request ceilings; ordered effects, no paid provisioning, ownership/collision findings, guided steps and `required_stop` reasons. |
| `airlock.adobe-stock.approval` | Owner/grant provenance and independent contract-review references; exact plan digest, credential/scope binding, validity interval and approved operations (`prepare`, `deploy-test`, `activate-test`, `observe`, `restore`). Generic `approved:true`, an old approval, readiness or a budget grant cannot approve another plan. |
| `airlock.adobe-stock.state` | Plan/run binding, completed-operation journal, pre-write snapshots, returned readback hashes, deployment verification, monotonic attempt counters, stage/run markers, observation progress and restore status. No tokens; SDK-generated identity values only in separate private captures. |
| `airlock.adobe-stock.capture` | Bounded private synthetic request/proposition/render/notification evidence, timing and product rows with exact correlation; allowlisted data only, no authentication headers/cookies/credential responses, no unrelated rows or console/HAR dump. |
| `airlock.adobe-stock.report` | Allowlisted **redacted public output**, not a private selector export; shape below. |

Closed top-level key sets (all listed keys required unless explicitly optional):

- Input: `kind`, `schema_version`, `profile`, `selectors`, `ownership_evidence_ref`,
  `credential_identity_sha256`, `credential_secret_index`, `evidence_refs`, `site`,
  `scenario`, `observation`, `measurement`, `limits`. `selectors` reuses the existing
  preflight selector shape/validation, not new name-based selection. `evidence_refs`
  contains exactly `preflight`, `routing`, `workspace`, `review`; each is a private
  `{path,sha256}` binding. `site` contains `checkout_handle`, `test_path`, `deployment_ref`.
  `scenario`, `observation`, `measurement`, `limits` are closed typed records of the
  fixed choices/ceilings in §3–6, not arbitrary SDK options or endpoint overrides.
- Plan: `kind`, `schema_version`, `profile`, `generated_at`, `expires_at`, `input_sha256`,
  `evidence_sha256`, `credential_identity_sha256`, `selectors`, `ownership`, `pins`,
  `site`, `operations`, `restore_operations`, `stages`, `observation`, `measurement`,
  `limits`, `guided_steps`, `required_stops`. `operations`/`restore_operations` are ordered
  records `{id,type,selector_ref,before_sha256,after_sha256,body,readback}`; fixed operation
  enums/templates only, no caller-chosen URLs or arbitrary executable steps.
- Approval: `kind`, `schema_version`, `profile`, `plan_sha256`, `credential_identity_sha256`,
  `scope_sha256`, `approved_at`, `expires_at`, `authority_ref`, `review_refs`, `operations`.
- State: `kind`, `schema_version`, `profile`, `plan_sha256`, `run_marker`, `journal`,
  `snapshots`, `deployment`, `attempt_counts`, `stages`, `observations`, `restoration`.
- Capture: `kind`, `schema_version`, `profile`, `plan_sha256`, `stage`, `case`, `visit_index`,
  `observed_at`, `source`, `correlation`, `data`. `source` is one of `sdk_payload`,
  `qualified_proposition`, `render`, `analytics_report`, `target_receipt`, `target_outcome`,
  `performance`.
  Each has a closed allowlisted data schema, never unrestricted raw objects.

Digests use SHA-256 over the exact immutable UTF-8 artifact bytes (no self-digest field);
timestamps are UTC RFC3339; selector/ref grammars and credential-file parsing/secret-index
selection reuse 051-01's reviewed rules. Paths are handles validated before use, not printable
provenance. Exported test seam `runStockCli({argv,env,stdout,stderr,transport,now,browser,git})`
uses synthetic adapters only in tests; production fixes these adapters itself. Operator JSON
cannot inject them. No change to closed 051-01 is needed.

Before any Adobe/site operation, validate exact approved bindings and scope. Before any mutation
or traffic, require 051-04 DONE with required reviews, a real preflight exit 0, original source
evidence freshness under that utility's 24-hour rules, and this plan's resolved setup/receipt gates.
Revalidate the required scope and activity immediately before activation; a report file is not
self-authenticating or authority to skip current checks. Plan/approval expire in at most 24 hours;
activation must fit inside that interval. Scope/credential/routing/code drift invalidates the
plan, not its timestamps. Restoration remains authorized for the already journaled run after
expiry, but only its exact inverse operations; never renewed traffic or broad repair.

`plan` is inspection only: future approved exact reads, token issuance and bounded report-query
POSTs are non-mutating; no Git ref, site/resource write or browser/SDK execution. Local plan
output is explicit, exclusive and private. It may return a blocked proposal listing missing
gates, never an applyable plan with required unknowns. `apply` refuses required unknowns,
expired/unbound approval, changed before-hashes, unsaved activity or broader selectors.
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
public GitHub raw bootstrap read returned 404 in this refinement; no current bootstrap contents
or public repository readability are inferred. The later authorized parent must inspect the
exact repository/served code and validate this additive deployment before applying.

Choose a self-contained, opt-in code-served test page **`/tools/airlock-stock/index.html`**,
with sibling `stock-page.mjs`, `stock-page.css`, `runtime-config.json`, and pinned plugin assets
under `/tools/airlock-stock/vendor/aem-martech/`. Do not modify the normal site's head,
bootstrap, DA content or default paths. Use the pinned plugin's source/ACDL unchanged and replace
only its Alloy dependency file with the exact official bytes above. Record that LF-only
distribution difference, retain license/notice files and a public build manifest of public-source
hashes. This is an additive test installation, not redistribution in Airlock `dist`.
Code-served HTML/path behavior is an explicit verification gate; if EDS cannot serve the page
without DA/site-config writes, stop for the exact supported alternative and its authorization.

The test page loads SDK assets **only** on the exact approved preview origin/path with
`?airlock-stock=v1&case=<fixed-case>&run=<synthetic-run-marker>`. Valid cases are `positive`,
`no-consent`, `no-offer`, `non-render`, `stock-perf`, `no-martech`; invalid/missing markers and
ordinary-site paths must load no Adobe test code or preload it. Mark the page noindex; make
opt-in consent explicit, never infer consent from merely opening the public page. A runner-
initiated synthetic consent action is recorded. A public marker is **not authentication** or
proof that nobody else can send data.

The public runtime config has exactly `schema_version`, `profile`, `orgId`, `datastreamId`,
`decisionScope`, `allowedOrigin`, `allowedPath`, and immutable public vendor pins. Org/datastream/
custom scope are intentionally browser-visible routing selectors, not bearer authorization;
owner approval must acknowledge this disclosure. Derive them from the approved private plan;
do not commit real selectors to Airlock docs/fixtures. No company/suite/activity/offer/workspace/
environment IDs, property token, API key, secret, IMS credential, private path, report capture or
approval is bundled. Target environment/property routing remains the managed datastream pin;
no client override, at.js `targetPageParams` or diagnostic routing discovery.

`apply` uses an approved isolated checkout of **that reference repo**, never Airlock's shared
main checkout. Recheck its remote/ref/base SHA, clean tree and exact additive path allowlist;
no clone, fetch or push is performed by this refinement. The future deploy is one reviewed
non-force push of the planned commit to that reference repo's `refs/heads/main`, only if the
remote still equals the recorded base. No release/tag, `.aem.live` publication, new branch
cleanup or assumed EDS-admin write. Verify public HTTP 200, content type and deployed HTML,
plugin/config/SDK hashes before browser traffic, plus no-test-code behavior without opt-in.
Wrong bytes/ref/CSP/path or unproved serving/deploy permission stops; do not bypass CSP.

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
`target`. Preserve originals for restoration. Their mapping to Web SDK notifications and
report units remains a required semantic gate, not assumed from those enum names.

Required targeting is an AND of **Current Page Domain equals the exact test hostname**,
**Current Page Path equals `/tools/airlock-stock/index.html`**, and the activity's requested
custom scope plus **Custom `pageName` equals `airlock-stock-v1`**. Supply the Target marker as
`xdm.web.webPageDetails.name` on the fetch; do not invent an untyped Target `data` parameter,
use a persistent `profile.*` marker, enable Platform ingestion or mutate the base schema.
Analytics correlation is separately set through the Analytics data mapping below.

The public Admin schema models audience rules as opaque objects and the A/B activity references
audience IDs; it does not establish a safe domain/marker rule-writing contract. Therefore **no
guessed audience JSON or audience creation endpoint** is authorized. A supported UI step may
edit an already verified owned **activity-local** targeting definition while saved: exact
activity → Edit → Targeting → inspect its current definition → apply the above Site Pages/
Custom equality rules with AND → Save, then retain bounded selector-bound before/after evidence.
Do not reuse an unknown/library/customer audience or click “Create Audience” to work around
missing ownership. If no safely editable owned activity-local definition exists, or restoring
it would require deletion, `required_stop: target_targeting_contract` requests a separately
reviewed exact plan/owner decision. This draft does not claim such a definition or UI access exists.

Closed future Target mutations use `https://mc.adobe.io/{privateTenant}/target`:
PUT `/offers/content/{privateOffer}` (v2), PUT `/activities/ab/{privateActivity}` (v3),
PUT `/activities/ab/{privateActivity}/schedule` (v1), PUT the same activity's `/state`
(v1, exactly `{"state":"approved"}` or `{"state":"saved"}`). GET the corresponding known
objects before/after; exact readback of writable projections is mandatory. Include the exact
workspace in offer/activity update bodies; omit read-only fields, never fall back to a default
workspace. The approved private plan freezes complete bodies before mutation.

While still saved, narrow targeting/metrics/offers, verify, then schedule each of the five
preplanned stage windows: stage anchors `T`, `T+3h`, `T+6h`, `T+9h`, `T+12h` for no-consent,
no-offer, non-render, positives and performance respectively. `T` is an absolute UTC time chosen
in the reviewed private plan, after deployment/setup verification; each window starts at
`anchor - 60 seconds` and ends at `anchor + 60 minutes`. All windows, report intervals and
restoration actions are frozen before the first mutation; the complete run must fit approval/
evidence expiry. Approve only after all gates and snapshots pass. Allow at most 20 minutes for
configuration propagation, using bounded exact state/readbacks, **not exploratory SDK traffic**.
Finish that stage's browser traffic by `anchor+30 minutes`, then immediately restore saved state
and original schedule while reports become visible. Keep only the approved narrow targeting,
metrics and harmless offer definitions until reporting completes, so removing a metric cannot
destroy its observation surface. Reapply only the next exact approved schedule from matching
journal hashes. If ready traffic cannot finish inside
its declared window, restore and stop; no automatic
schedule extension. Past-ended, wrong-date, wrong-targeting or not-yet-verified activity cannot
be treated as eligible. Permission demonstrated by future-only approval is not current delivery.

Stop traffic before restoration. First PUT state saved and read it back; restore original schedule
after each stage. After the final bounded observation (or immediately on any failure/interruption),
restore exact original targeting, metrics, offer content and other touched writable fields, and
re-read saved/inactive and every original hash. Restore the page's runtime switch to disabled
with a planned forward commit after testing (retain reusable assets; no file/resource deletion).
Keep restore authority and bounded inverse operations in the original approval/journal;
repeat recovery is idempotent. If a concurrent change conflicts, still stop traffic/attempt
the authorized exact owned saved-state operation, refuse overwriting foreign content, and
report `restore_incomplete` for owner recovery. Never label an unverified restore complete.

### 3. Stock-only first journey and pinned integration choice — AC3, AC4

Use fresh `browser.newContext()` per declared visit with the existing Playwright Chromium:
no persistent context, Adobe login profile, prior storage state, imported customer identity,
at.js, AppMeasurement, Launch URL, Airlock boot/chamber or GA4 sink. Retain SDK-generated identity
correlation only privately; the baseline does not prove cross-session identity continuity.

**Chosen mode: phased stock plugin + site-owned manual custom-HTML renderer**, not the current
Airlock adapter and not the plugin's eager auto-report helper. Initialize the pinned module
once in the test page's eager phase:

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
   click-goal receipt semantics must be cleared in §5 before any live attempt.

The SDK API-result promise, request payload, observed DOM, native display/interaction send,
independent Analytics report rows and independently qualified Target receipt/outcome are
**separate evidence columns**. Preserve real transport retries/duplicate payloads/counts.
No application resends; compare expected vs actual without asserting vendor exactly-once.

### 4. Finite traffic and non-vacuous controls — AC3, AC4, AC5, AC8

Freeze this sequence before activation: one fresh visit each for `no-consent`, `no-offer`,
`non-render`, then **three** positive visits and **five** `stock-perf` visits. Five `no-martech`
visits have no SDK and are interleaved with the five stock-perf visits after functional positives.
Maximum **16 fresh contexts**, only **11** with a stock installation, **10** with consent.
No retries/warmup SDK traffic, statistical power claim or automatic extra volume.

| Case | Deliberate stimulus and required local evidence | Product observation |
|---|---|---|
| No consent | Initialize pending, explicitly deny collection/personalization before attempted fetch/page/custom; keep default DOM. Instrument actual blocked/queued attempts and rejection/timeout, not an omitted action. Observe 10 seconds then close context without granting. Consent preferences/cookie and documented consent-only traffic are not “zero network.” | Exact reserved P/C rows absent; no decision/display/interact submission or qualified Target receipt. A successful positive later establishes observation sensitivity. |
| No offer | Grant consent; request the **same** owned scope on the same site but set fetch XDM page name to `airlock-stock-unqualified`. Targeting must fail; record the actual response without the owned offer. Send one ordinary P page and C custom link using a default-page button, with no proposition fields. | P page and C custom are received; no Target display/interact count increment for this case. Failure to obtain the positive later cannot pass this empty case. |
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
queries below before mutation/traffic; denied metadata/dimension queries or unknown processing/
exclusion rules stop. Generic totals-query access is **not** proof of these queries. No new eVar,
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

**Target candidate API, deliberately not yet a receipt adapter:** GET
`https://mc.adobe.io/{privateTenant}/target/activities/ab/{privateActivity}/report/performance`
with Accept `application/vnd.adobe.target.v1+json`, no body/query variants. The current official
OpenAPI defines only path `id`; response `AbstractActivityPerformanceReport` includes
`reportParameters` and `activity`. Reachable report parameter definitions include activity,
environment, interval, metric-local IDs and resolution, while the activity definition includes
metric descriptors. Those inspected definitions **do not define numeric experience counts,
notification receipts, a synthetic correlation field, or environment/date query parameters**.
This is a limitation of the inspected contract, **not** a claim that the live API cannot return
additive data. Do not invent `impressions`, a response path, guessed query arguments or permission.
R-012 has not exercised this report read.

Consequently **`required_stop: target_report_contract` remains open**. Before an applyable plan,
choose and review one supported, scope-bound method with:

- Exact reportable display/interaction metric selectors and unit/counting semantics; activity,
  experience, property/workspace and selected development environment bindings; exact time
  windows and granularity; a way to distinguish eligible fetch vs actual display/interaction.
- An official numeric response/export column mapping or a supported product diagnostic
  notification-receipt mapping; actual authorized read verification before traffic. No arbitrary
  additive-field guessing. Verify that the marker/qualified proposition/private activity/
  experience and isolated stage window can correlate the result; aggregation alone does not
  prove a particular notification. An unchanged empty report is not a negative-control pass.
- Two layers if needed: a vendor-native diagnostic correlating the specific notification, plus
  the scoped Target report count/outcome. A transport debug entry is not that diagnostic.
  Preserve vendor metric units; Visitors/Visits/Activity Impressions are not interchangeable or
  automatically equal DOM display count/native notification count.

**Credible product-outcome route to review:** official Target UI **Reports → Report Settings**
documents choosing environment, dates,
Visitors/Visits/Activity Impressions and metrics; **Download Reports → Export Report to CSV**
is a supported manual product-count source. The proposed observation is the exact owned activity,
reporting source Target, exact development environment, that stage's frozen date window and all
owned experiences; select **Activity Impressions** and the planned display/click goals. Read
goal **conversion counts**, not lift, confidence or conversion-rate percentages. Capture a
pre-stage export and each scheduled post-stage export, preserving both experiences even if
random assignment chooses only one. Compare per-experience deltas to the privately observed
render/click ledger using the reviewed “count once” goal semantics and fresh-context identity
boundaries, not an exactly-once transport guarantee.

Use private `airlock.adobe-stock.capture` records with `source:"target_outcome"` and data exactly
`basis`, `artifact_sha256`, `source_ref`, `bindings`, `rows`, `column_mapping_ref`, `observer_ref`.
Basis is `target-native-report-export`; bindings pin activity/environment/workspace/property,
reporting source, metric-local selectors, interval and counting method. Rows contain only the
known private experience selector and `display_goal_count`/`interaction_goal_count` as observed
non-negative integers. The raw export stays private, bounded and unchanged. The parent records
the real source/observation time and reviewed column mapping, not a success boolean or guessed
counts. `observe` consumes only this prebound private evidence, never an authenticated UI browser.

This is a **specific proposed downstream count method**, not an established permission or
notification receipt method. The inspected UI documentation does not promise an exact CSV schema,
synthetic marker/event-token columns or that these goals map to the chosen Web SDK notifications.
Before traffic, verify the actual export columns/filter binding and officially supported goal/
notification semantics. If per-stage causal correlation through the activity/experience and
native goal counters satisfies AC4, record that exact evidence basis and its limits in the reviewed
plan; otherwise a supported per-notification diagnostic is additionally required. Either unresolved
case remains `required_stop: target_report_contract`; an impression/visitor total alone cannot
clear it. Owner availability for exports is also an explicit blocker, not assumed automation.

Do not automate an authenticated Adobe browser profile or scrape screenshots. Do not change
reporting presets, reset or delete report data, assume Assurance access, or silently fall back
to UI. A plan choosing this manual route
must bind its evidence handle/column mapping and be reviewed before mutation; the API candidate
cannot be made green by swapping in an unreviewed CSV or a “Target 200.”

**Waiting policy (chosen before traffic, not a vendor latency guarantee):** at each isolated
stage, take a pre-traffic checkpoint, then observe at offsets 0, 5, 15, 30, 60 and 120 minutes
after its last event. A positive needs matching receipt/count evidence stable at two scheduled
observations; controls require complete zero corresponding increment at both 60 and 120 minutes
and demonstrated positive sensitivity in the same run. Wait externally with the activity
saved/inactive between the five preplanned stage windows; no activity needs to stay live for
report polling. If the report granularity cannot distinguish those windows or lateness contaminates
a subsequent checkpoint, stop and retain unknowns — no silent activation extension.
No server-error retry; a later scheduled report read is not an SDK resend. A finite two-hour
timeout is `unverified: receipt_not_observed`, not loss, success or permission to send again.

Pretraffic contract/access inspections have a ceiling of 40 requests. Observation has at most
180 report requests overall. Freeze combined MATCH-OR clauses for the positive/performance
stages: `MATCH '<P1>' OR MATCH '<P2>' ...` and the distinct corresponding C clause, with
limit `2 × numberOfTokens`, exact per-token row validation and no pagination. Single-visit
controls use the exact single-token bodies above. Five stages × (one pre + six post checkpoints)
× (two Analytics queries + one resolved Target observation) is **105 observations**: 70 Analytics
API reads plus 35 Target reads or private export checkpoints according to the reviewed method. Any
additional diagnostic reads must fit the same 180-request ceiling and be frozen in the plan.
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
fixed method/version/body/redirect refusal; deploy ref race and wrong served bytes; no opt-in/
no-martech imports; original future-date validation against clock; exact targeting/schedule/state
readbacks; interrupted writes/re-run lock/journal/restore ordering and conflicts; no deletion/
creation/default edits; supported stock exports/single instance/ACDL custom event; safe HTML,
actual render vs renderAttempted/late rendering; no-consent attempted events and consent-only
exception; no-offer and **real qualified-but-not-rendered** stimulus; no premature native display/
interact or extra page/link hit; staged observation/metadata/error/206/truncation/correlation/
duplicate/timeout/count-unit failures; report zero without a positive; redaction with malicious
private/response/exception strings; all request/byte/browser ceilings. Hermetic SDK/browser stubs
prove harness behavior only; fixture “receipts” must never pass the live acceptance path.

## Public grounding and unresolved decisions

Inspected public sources on 2026-10-09; no authenticated call, private input/image/credential
access, resource write, deploy or SDK execution in this refinement:

| Source | Load-bearing use |
|---|---|
| [Pinned `aem-martech` README](https://github.com/adobe-rnd/aem-martech/blob/1aa3dee3c4791636efa9ad2994342f861c8e149b/README.md), [`src/index.js`](https://github.com/adobe-rnd/aem-martech/blob/1aa3dee3c4791636efa9ad2994342f861c8e149b/src/index.js), [`src/acdl.min.js`](https://github.com/adobe-rnd/aem-martech/blob/1aa3dee3c4791636efa9ad2994342f861c8e149b/src/acdl.min.js) | Exact exports/defaults, eager non-DOM-action display assumption, lazy ACDL mapping, no automatic page hit when trackPageView is false. ACDL pin/hash above is an executed read/hash, not SDK execution. |
| [Official Alloy 2.31.1 bytes](https://cdn1.adoberesources.net/alloy/2.31.1/alloy.min.js) | Executed public hash agrees with the required pin; inspected options validator/native propositionInteract/propositionEventType and auto-interaction configuration. No execution. Current docs' additional options cannot be assumed present in this old pin. |
| [Official sendEvent](https://experienceleague.adobe.com/en/docs/experience-platform/collection/js/commands/sendevent/overview), [HTML applyPropositions](https://experienceleague.adobe.com/en/docs/experience-platform/collection/use-cases/personalization/render-html-offers), [manual display events](https://experienceleague.adobe.com/en/docs/experience-platform/collection/use-cases/personalization/display-events), [top/bottom events](https://experienceleague.adobe.com/en/docs/experience-platform/collection/use-cases/personalization/top-bottom-page-events) | Custom scope fetch, metadata-based HTML rendering, explicit display only after rendering; propositionFetch is not an Analytics page hit. |
| [Consent](https://experienceleague.adobe.com/en/docs/experience-platform/collection/js/commands/setconsent), [click collection](https://experienceleague.adobe.com/en/docs/experience-platform/collection/js/commands/configure/clickcollectionenabled), [proposition interactions](https://experienceleague.adobe.com/en/docs/experience-platform/collection/js/commands/configure/autocollectpropositioninteractions) | Collection opt-in/out, consent cookie/exchanges, explicit prevention of duplicate automatic link/interaction sends. |
| [Analytics data mapping](https://experienceleague.adobe.com/en/docs/analytics/implementation/aep-edge/data-var-mapping), [hit types](https://experienceleague.adobe.com/en/docs/analytics/implementation/aep-edge/hit-types), [official OpenAPI](https://github.com/AdobeDocs/analytics-2.0-apis/blob/main/static/swagger.json), [report examples](https://github.com/AdobeDocs/analytics-2.0-apis/blob/main/src/pages/guides/endpoints/reports/examples.md), [MATCH search grammar](https://github.com/AdobeDocs/analytics-2.0-apis/blob/main/src/pages/guides/endpoints/reports/search-filters.md) | Separate pageName vs custom linkName/linkType and downstream dimension/metric/row queries; page/link classification and avoidance of suite totals. |
| [Target Admin OpenAPI](https://github.com/AdobeDocs/target-developers/blob/main/src/admin-api.json), [official Reports reference](https://developer.adobe.com/target/administer/admin-api/#tag/Reports), [report settings](https://experienceleague.adobe.com/en/docs/target/using/reports/settings/report-settings), [report view/export](https://experienceleague.adobe.com/en/docs/target/using/reports/reports) | Exact mutation/report versions; activity state/schedule, metric enums, workspace requirement; report schema gaps, UI environment/counting-method choices. No proven report permission/receipt schema. |
| [Target Site Pages](https://github.com/AdobeDocs/target.en/blob/main/help/main/c-target/c-audiences/c-target-rules/site-pages.md), [Custom parameter rules](https://github.com/AdobeDocs/target.en/blob/main/help/main/c-target/c-audiences/c-target-rules/custom-parameters.md), [Web SDK parameter mapping](https://experienceleague.adobe.com/en/docs/platform-learn/migrate-target-to-websdk/send-parameters) | Exact domain/path plus marker qualification; XDM name mapping, no at.js property token or invented arbitrary data mbox marker. API rule objects remain opaque. |

Required unresolved decisions before **any live apply/traffic**: 051-04 closure and continuing
freshness of the now-ready schema-v2 preflight/source evidence; safely editable/restorable owned
activity-local targeting; actual reference
write/code-serving/CSP verification; dedicated-suite dimension queries and processing semantics;
Target reporting permission, count/window/notification correlation adapter and native display/
interaction metric mapping; staged schedule compatible with report granularity and two-hour
observations. Record a required stop for each unknown. No bare receipt flag, permissive proxy,
new entitlement, guessed API or GA4 substitute clears them. AJO/CJA/RTCDP remain deferred for
this proving ground with their broader requirements unchanged.

**DoD:**
- [ ] Setup plan/apply/reuse/refusal and redaction behavior have hermetic tests with witnessed failures.
- [ ] Stock Analytics/Target positive and negative live evidence is recorded using the approved methods.
- [ ] Product latency/visibility blockers leave baseline acceptance incomplete; no stub passes as live evidence.
- [ ] Compliance/craft and reconciliation evidence recorded; deviation log and sweep completed.
- [ ] Operator instructions and R-012 contain a reproducible scenario and explicit remaining constraints.

**Anti-horizontal-phasing check:** This slice delivers a usable stock reference installation and
observed product journey, not merely schemas/datastreams that might enable a future test.

## Assumptions

- The chosen code-served additive page can be deployed on the designated preview without DA/
  site-administration changes. Only metadata/dry-run evidence exists; current public raw source
  access was unavailable. Actual writes, served hashes and browser/CSP remain unverified.
- Current owned activity targeting can enforce exact domain/path/XDM marker and be restored
  without changing/creating/deleting unrelated audiences. The public rule schema does not prove
  this path, and no private targeting definition was inspected here.
- The dedicated suite exposes the selected page/custom dimensions and metrics without rules
  suppressing/rewriting synthetic hits. Existing totals-query permission is not that verification.
- A supported Target report/diagnostic can establish display/interaction receipt and product
  counts with environment/experience/stage correlation inside the finite windows. Current public
  performance definitions do not establish these semantics; §5 is a required pretraffic stop.
- The stock custom-HTML project-renderer path, base-schema routing with Platform disabled,
  native interaction metric mapping and eager deadline can produce the journey. No SDK or live
  outcome has verified this; unknowns must not be converted into passing fixture evidence.

### Deviation log (after reconciliation)

Not implemented; no resources or stock outcomes have been observed by this draft.

### Reconciliation sweep

Pending implementation: update R-012, setup/probe instructions, local-state/redaction contract,
release handoff, status board and any approved architecture/decision changes.

### Close-out (post-DONE)

- [ ] Regenerate the status board and identify the exact stock baseline available to 051-03.
- [ ] Preserve unresolved product/API limits and targeted cleanup ownership.
