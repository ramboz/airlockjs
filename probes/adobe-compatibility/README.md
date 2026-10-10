# Adobe initial-preparation preflight — 051-01 / 051-04

This Node ESM utility checks **initial Analytics/Target preparation only**. It does not deploy,
execute HTML/SDKs, activate activities, provision, publish, inspect browser state, or verify
product outcomes. A ready report does not authorize 051-02. See the
[reviewed v1 contract](../../docs/specs/051-adobe-integration-proving-ground/slice-01-access-preflight.md)
for the complete closed private schemas and official references, and
[R-012](../../docs/research/R-012-adobe-first-compatibility.md) for actual access observations.
Hermetic validation and a real unverified preparation result are recorded below. The orchestrator
owns live runs; the implementation agent does not access private state or credentials.

## Invocation

On the execution host, supply already-approved private path handles through its environment:

```sh
node probes/adobe-compatibility/preflight.mjs \
  --input "$AIRLOCK_PREFLIGHT_INPUT" \
  --routing-evidence "$AIRLOCK_ROUTING_EVIDENCE"
```

`ADOBE_CREDENTIAL_FILE` must point directly to the existing uppercase Adobe export, with
owner-only mode `0400` or `0600`. Do not source, copy, rewrite, or print it. Export fields are exactly
`ORG_ID`, `CLIENT_ID`, `CLIENT_SECRETS`, `SCOPES`, `TECHNICAL_ACCOUNT_ID`,
`TECHNICAL_ACCOUNT_EMAIL`. One secret selects index 0; multiple secrets require the sole
credential-choice flag `--credential-secret-index <integer>`. No attempts against other secrets occur.
`--help` alone prints static usage without reads or requests.
051-04 adds the optional private path handle `--workspace-evidence <path>` described below.

There are no fixture, clock, arbitrary URL, method, header, token, browser, dotenv, or secret-value
flags/environment hooks. Unknown/duplicate flags and positional arguments fail before reads.
The command never writes private state. Only synthetic test files are created by the test harness.

Private input is `airlock.adobe-preflight.input`, version 1, profile `analytics-target-initial`.
It includes read-only approval; exact org/company/suite/Target/datastream/site selectors; scoped
owner-selection evidence; absolute suite-local report window; optional lowered limits.
The site origin must be the exact derived `https://{ref}--{repo}--{owner}.aem.page`.
No name/first-result/org fallback occurs. The full owner binding and actual export identity digest
are compared **before token issuance**. An AEP sandbox is not Analytics/Target scope evidence.

Only `decision_scope` uses `[A-Za-z0-9_.-]`, at most 100 characters, including periods.
It still refuses `.`, `..`, prototype values, `target-global-mbox`, controls/whitespace,
URL/query/userinfo syntax and `@`. Tenant/site alphabets are unchanged. The full owner binding
and fresh activity's case-sensitive literal custom scope must match exactly. This frame-approved
execution-discovered format correction adds no resource, endpoint or mutation authority.

All private JSON files have a 256 KiB byte ceiling, UTF-8 object requirement and depth limit 16.
Unknown keys, duplicate keys (including escaped equivalents), prototype keys, malformed
dates/types/versions, symlinks and nonregular files are refused. Response JSON depth is 32;
unknown additive response fields are ignored, never copied into reports.

### Evidence, freshness and manual boundary

Owner-selection evidence must match every selector and export identity; all dedicated resource
designations must be true. It is an owner's designation, not an audit of customer traffic/grants.
It must be observed within 24 hours, not in the future, and expire after the entire run deadline.
Approval must cover the deadline too. Missing evidence is unverified; structurally invalid evidence
is exit 2; valid mismatched scope is blocked.

The optional routing file is `airlock.adobe-preflight.routing-evidence`, version 1, with basis
`owner-ui-and-saved-pin-confirmation`. It requires all exact bindings, three distinct screenshot
digests, complete service inventory (only Analytics/Target enabled), single selected suite,
saved owner-confirmed environment pin and fresh property token comparison. It never claims API
configuration readback.

`observed_at` is the original screenshot observation; `assessment_completed_at` is the latest
actual event completing the aggregate evidence (including saved-pin acknowledgment).
Observation <= pin <= completion <= run start. Observation **and** completion must each remain
within 24 hours; expiry must cover the deadline. Aggregation/normalization never renews observation
or expiry. Immutable source references retain the original snapshot assessment. Digests/references
are attestations/provenance, not signatures, OCR, fetched artifacts or independent configuration proof.

Missing/stale/incomplete routing remains unverified; unsafe destination, binding/token mismatch or
unsaved pin blocks. Reinspect after credential/resource/routing changes, before any SDK traffic.
`datastream.configuration_api` stays separately unverified even when manual routing passes.

### Scoped workspace confirmation — 051-04

The [051-04 contract](../../docs/specs/051-adobe-integration-proving-ground/slice-04-workspace-confirmation.md)
adds an optional owner Admin Console confirmation, not an API default or force-ready flag:

```sh
node probes/adobe-compatibility/preflight.mjs \
  --input "$AIRLOCK_PREFLIGHT_INPUT" \
  --routing-evidence "$AIRLOCK_ROUTING_EVIDENCE" \
  --workspace-evidence "$AIRLOCK_WORKSPACE_EVIDENCE"
```

The parent/operator alone prepares this private file from the actual approved source. Inspect
**Admin Console > Products > Adobe Target > the selected profile > property permissions**.
Confirm the saved selected profile includes only the dedicated selected property, that its
permission inventory is complete, and that automatic assignment is disabled. Keep screenshots,
selectors, private references and file paths private; the utility does not read screenshots.
This proves only the named profile's included properties, **not exclusive application-wide
permissions**, unrelated profiles or delivery-environment routing.

The closed workspace envelope is schema version 1 with exactly these fields:

- `kind:"airlock.adobe-preflight.workspace-evidence"`,
  `basis:"owner-admin-console-confirmation"`, `schema_version:1`;
- `observed_at`, `confirmed_at`, `expires_at`: original UTC RFC3339 timestamps, retaining all
  source fractional digits. Observation <= confirmation <= run start; observation at most
  24 hours old; expiry strictly beyond the full run deadline. Confirmation/aggregation does
  not renew observation or expiry.
- `provenance:{authority_ref,record_ref,screenshot_sha256}`: nonempty, control-free private
  references (at most 250 characters); authority matches the approved input; screenshot digest
  is lowercase 64-hex SHA-256. Provenance is an attestation, not a signature or API readback.
- `bindings`: exact full copy of the input's `selectors`, including offers and site.
- `credential_identity_sha256`: SHA-256 of UTF-8
  `JSON.stringify([ORG_ID, CLIENT_ID, TECHNICAL_ACCOUNT_ID])`, matching the current export and
  approved owner-selection evidence. No token decoding or new credential source.
- `included_property_ids`: exactly one canonical decimal string ID, the selected property.
- `permission_inventory_complete`, `automatic_assignment_disabled`,
  `owner_confirmed_saved_configuration`: all must be `true` for readiness.

The existing bounded private-file parser applies. Unknown/duplicate keys, invalid types or
timestamps, noncanonical IDs, invalid versions, oversized/deep JSON, symlinks and nonregular files
are configuration exit 2 before requests. Structural boolean `false` is accepted but unverified.
Valid binding/identity/authority/included-property mismatches block; stale/future/expired or
incomplete confirmations remain unverified. An unavailable optional file supplies no evidence
and leaves the API-only path unchanged. Errors remain fixed enums without private text.

The same property collection is always read when the fresh exact selected-property prerequisite
passes. Only omitted `workspaces` on **non-selected** properties of an otherwise valid complete
list can use this confirmation. No omission becomes `[]`. Known additional assignment to the
selected workspace blocks, independently of row order. Missing selected assignments, malformed
present values, duplicates/count mismatches, truncation/page hints, failed HTTP reads and limits
cannot be repaired. A successful manual row is `owner_ui_confirmation`,
`accepted_owner_window`, `http_status:null`; fully known API assignments retain `api_read`,
`current_run`, status 200. Supplied evidence is always validated: a fully known API list cannot
hide stale or contradictory confirmation. Explicit API scope conflicts prevail.

Input and routing schemas remain v1. Reports are now **v2** with the same closed keys, rows,
enums, exits and redaction; only this declared evidence policy extends their semantics.
Workspace confirmation does not renew routing/selection evidence or clear other required unknowns,
product, activation, write or deployment gates. After independent reviews the parent runs the
real CLI and records its actual result in R-012. Hermetic readiness is not a real readiness claim.

## Closed request inventory

Requests are sequential, HTTPS only, with `redirect:"manual"`. All redirects, userinfo, alternate
ports, endpoint/query/header/body/method variants are refused. No `Link`/`next` is followed,
no guessed pagination, retry, token refresh/introspection or undocumented management endpoint.

| Operation | Fixed request |
|---|---|
| IMS token | POST `https://ims-na1.adobelogin.com/ims/token/v3`; form exactly client ID, selected secret, `client_credentials`, export's comma-joined scopes |
| Analytics discovery | GET `https://analytics.adobe.io/discovery/me` |
| Analytics suite | GET `/api/{company}/reportsuites/collections/suites/{rsid}?expansion=currency,timezoneZoneinfo` on `analytics.adobe.io` |
| Analytics reporting | POST `/api/{company}/reports`; fixed pageviews totals, absolute approved date range, limit 1/page 0/reflectRequest false; no dimension/segments/customer identities |
| Target environment | GET `https://mc.adobe.io/{tenant}/target/environments/{id}` (v1 Accept) |
| Target property | GET same Target origin `/properties/{id}` (v1) |
| Target properties | GET same Target origin `/properties` (v1); complete visible snapshot only |
| Target activity | GET same Target origin `/activities/ab/{id}` (v3) |
| Target offers (2) | GET same Target origin `/offers/content/{id}` (v2) |
| Site status | GET `https://admin.hlx.page/status/{owner}/{repo}/{ref}/` |
| Site preview | GET approved exact preview origin plus `/`; bounded HTML discarded without execution |

Analytics uses JSON Accept; reporting adds JSON Content-Type. Product reads use bearer and export
client ID API key. Token issuance has no bearer. Site requests have **no credentials**.
Token issuance and the nonmutating totals query are the only POSTs; neither is a generic mutation
exception. The suite timezone must validate the historical window before the query is sent.
An invalid suite-local window ends the invocation with exit 2/unverified overall, without the
reporting POST or subsequent Target/site requests.
Totals/report IDs/content/response metadata are discarded.

Input scope precedes OAuth, which precedes org/company discovery and all product reads.
Suite precedes reporting. Exact property/workspace precedes enumeration/activity/offers.
Tenant binding is owner evidence corroborated by property access, not an API tenant-to-org claim.
Routing needs fresh property/environment. Parent failures skip dependents. Independent reporting
failure does not suppress Target/site checks. Site needs approved input/site scope only.
Property 404 stays unverified without current parent tenant corroboration. Environment 404 is
confirmed absence only after the exact property's successful workspace/tenant corroboration;
a failed property check leaves environment absence unverified. No fallback reads are made.
Composite rows preserve the earliest failure: only an explicit unsafe/scope mismatch may outrank
an unknown, never a later denial/404 alone or an already-blocked first failure.

### Hard ceilings (optional input `limits` may only lower them)

| Key | Default/ceiling |
|---|---:|
| `request_timeout_ms` | 10,000 (headers and streaming body together) |
| `run_timeout_ms` | 120,000 (entire invocation) |
| `max_response_bytes` | 1,048,576 decoded streamed bytes/body, including token |
| `max_total_response_bytes` | 8,388,608 all bodies |
| `max_requests` | 24; ordinary full run 12 |
| `max_pages` | 1; inventory contains no paginated operation |
| `max_items` | 1,000/collection, including nested org + company count |

Byte ceilings do not trust Content-Length; chunked/slow/hanging streams are bounded, aborted and
canceled. Timers are cleared. The shorter request/run deadline wins. Property total/count mismatch,
duplicates, extra-page hints or truncation is unverified, never exhaustive absence/readiness.
Once the aggregate byte ceiling is exhausted, cancel the current stream and stop all further
transports/body reads, including independent site checks. New requests cannot replenish it.

## Public output and exit codes

Except static help, stdout is exactly one newline-terminated
`airlock.adobe-preflight.report` JSON document, schema version 2. Stderr is a single line built
only from overall/exit enums and summary counts. No parser/exception/server messages, private
paths, keys, selectors, credentials, identities, tokens, hashes or offer contents are emitted.
Reports are built only from allowlisted primitives and deeply frozen.
Operators may redirect **only this redacted stdout** to a public artifact.

| Exit | Meaning |
|---|---|
| 0 | All 12 required checks ready; four optional diagnostics remain unverified |
| 1 | At least one required blocked/unverified; blocked wins overall |
| 2 | Invalid invocation or private input/evidence/credential schema |
| 3 | Internal failure; report internal failure, never an exception |

Top-level keys: `kind`, `schema_version`, `profile`, `generated_at`, `overall`, `exit_code`,
`checks`, `summary`, `claims`. All 16 fixed rows appear, including early failure.
Each row contains `id`, `required`, `state`, `evidence_basis`, `reason`, `next_action`,
`http_status`, `freshness`. Summary counts required ready/blocked/unverified, optional
unverified and actual API requests. Claims always deny deployment, outcomes and mutation authority.
The exact row order/schema/enums are pinned in the slice and tests.

### Fixed reasons and next actions

| Reasons | Action | Operator instruction |
|---|---|---|
| `verified` | `none` | No action for this preparation check. |
| `invalid_configuration` | `correct_input` | Correct the reviewed input/export/flags without widening scope. |
| `credentials_unavailable` | `supply_credentials` | Supply the approved existing export path handle. |
| `authentication_rejected`, `access_denied` | `verify_credential_profile` | Ask the administrator to verify org/application/product grants; this is not absent-license proof. |
| `resource_not_found`, `scope_mismatch`, `unsafe_configuration` | `verify_resource_selector` | Recheck exact owned resource/designation and safety; never choose another silently. |
| `missing_evidence`, `stale_evidence` | `renew_scoped_evidence` | Obtain a genuinely fresh scoped owner observation. |
| `schema_error`, `partial_response`, `request_contract_error`, `endpoint_refused` | `review_api_contract` | Compare the supported official API schema/template; never try an internal endpoint. |
| `partial_enumeration`, `limit_exceeded` | `review_read_limits` | Review bounded completeness/limits; do not infer exhaustive access. |
| `rate_limited`, `transport_failure`, `timeout` | `retry_later` | Stop and arrange a later approved run; no automatic retry. |
| `dependency_unverified` | `resolve_parent_check` | Resolve the failed prerequisite before dependent reads. |
| `unavailable_automation` | `retain_manual_routing` | Inspect Data Collection's selected datastream overview, Analytics single suite and Target property/environment pins; retain scoped UI/saved-pin evidence. |
| `not_exercised` | `complete_051_02_plan` | Obtain the separate reviewed scoped write/deployment plan. |
| `deferred_scope` | `defer_later_products` | Leave AJO/CJA/RTCDP to the later release work. |
| `internal_failure` | `report_internal_failure` | Report the enum-only failure and command version; never include private sources. |

Only these overrides occur: missing/stale routing → `inspect_datastream_ui` (guided Data Collection
steps above); unsaved pin → `save_environment_pin` (owner saves the exact scoped environment);
unsafe activity → `restore_inactive_fixture` (separate owner-authorized procedure, not this CLI);
credential identity mismatch → `correct_input`.

## Hermetic validation and test seam

```sh
npm test -- test/adobe-preflight-cli.test.js \
  test/adobe-preflight-transport.test.js test/adobe-preflight-evidence.test.js \
  test/adobe-workspace-evidence.test.js test/contract-stability.test.js
```

`runCli({argv, env, stdout, stderr, transport, now})` is the exported ESM test seam.
Production invokes it with process streams/environment, built-in fetch and real time only.
Tests supply temporary invented files, captured streams, synthetic fetch Responses and clock.
Injected transport still receives validated, frozen production request templates.
`assertRequest(candidate, expected)` is exported for exact-template refusal assertions; the runner
owns `expected`, never accepts it from operator input. The fixture wrapper is test-only, not an
operator input, live evidence or network source.
The committed JSON is a template: its null routing-token digest is derived once from the invented
property reply by the harness before cloning or mutations. Do not extract its raw routing object
directly as operator evidence. This preparation changes neither production validation nor token
mutation negatives; it avoids storing a computed test digest that the commit scanner misclassifies.
No scanner bypass or allowlist exception is used.
The workspace test template is also invented: tests hydrate its full bindings, identity digest
and selected ID once from a pristine baseline copy before mutations. No private screenshots,
real selectors or auto-repaired negative fixtures are used. 051-04 witnessed 85 failures before
implementation; all 141 new regressions then passed alongside 278 existing preflight and 36
contract-stability tests. The full default suite passed 2,337 tests. The implementer made no live
calls; the parent-owned real report is recorded separately below.

### Known filesystem limitation

The private-file timeout bounds the caller's wait and prevents further validation/network work,
but it cannot cancel an already pending filesystem read. That operation can retain its handle
and finish reading/parsing after the timeout report before closing. Use approved local files;
complete operating-system-level filesystem cancellation is not claimed. Craft/architecture N1
records this non-blocking residual; it does not change required readiness or network limits.

## Observed initial-preparation result — 2026-10-08

The orchestrator executed the real CLI against the approved isolated fixtures after correcting
the source-timestamp and dotted-scope format mismatches. It made 12 bounded requests and returned
**exit 1 / overall unverified**: 11 required checks ready, one required check unverified.
Authentication, selected Analytics reporting access, the exact owned Target resources, accepted
manual routing evidence and public site readability were verified. This is not SDK event receipt,
deployment or stock/chamber product proof.

`target.workspace_snapshot` could not verify complete workspace associations: one non-selected
property in the accessible collection omitted `workspaces`. The official API schema makes that
field optional and supplies no default. **Do not infer an empty array, claim absent assignments,
make the check optional or override the nonzero exit.** No workspace endpoint or collection
filter exists in the inspected Target Admin schema.

The precise guided step is to inspect the Airlock Target product profile in **Admin Console >
Products > Adobe Target > the selected profile > property permissions**, and confirm its
relationship to only the dedicated Airlock property. Keep selectors and any screenshots private.
If scoped owner confirmation is supplied, review and implement an explicit evidence contract
before using it; the historical v1 utility had no force-ready or unreviewed manual fallback.
Do not change other properties or profile grants to make the report pass.
The owner was unavailable to provide that confirmation. The stock baseline remains gated on a
ready real report; no test activity was activated and no SDK events were sent.

**2026-10-09 follow-up:** the owner supplied scoped confirmation privately. The implemented
extension passed independent frame, compliance, craft, architecture and reconciliation reviews;
051-04 is DONE. The real CLI returned schema-v2 **ready / exit 0**, with **12 required ready,
four optional unverified and 12 requests**. Workspace attribution is `owner_ui_confirmation`
with null HTTP status, not invented API proof. Original routing timestamps were not renewed.
The historical v1 unknown report remains preserved. This clears initial preparation only;
stock deployment, owned activity schedule/targeting and downstream product observation still
require their separate reviewed 051-02 plan.

## Local stock journey operator — 051-05

The current real readiness rerun refuses expired source evidence (`stale_evidence`, exit 1,
zero API requests). A fresh unchanged-routing confirmation is required before live work.
This local operator remains usable without credentials or network; its passing cases do not
renew those observations or authorize the activity. The owner permits a successful test to
finish with the owned activity active; control/error pauses and actual reported state remain
separate from this local-only command.

This separate command runs **invented local fixtures only**. It cannot load Alloy, read
credentials/configuration/files, use a transport or activate/deploy anything. It does not
renew expired routing evidence or satisfy any 051-02 live gate.

```sh
node probes/adobe-compatibility/stock-dry-run.mjs --help
node probes/adobe-compatibility/stock-dry-run.mjs --case positive
node probes/adobe-compatibility/stock-dry-run.mjs --case no-consent
node probes/adobe-compatibility/stock-dry-run.mjs --case no-offer
node probes/adobe-compatibility/stock-dry-run.mjs --case non-render
```

Only exactly `--case <one fixed case>` or `--help` is accepted, with no environment hooks.
Case stdout is one schema-v1 `airlock.adobe-stock.local-report` JSON line. Fixed keys are
`kind`, `schema_version`, `case`, `overall`, `exit_code`, `phases`, `counts`, `claims`.
Reports contain only fixed enums, booleans and nonnegative integer counts; no URL, run label,
config, proposition, HTML, selector, path or exception is printed. Help is static text.
Exit 0 means the assigned **local** journey passed; 1 means a journey failure, 2 an invalid
input/invocation, 3 an internal failure. Failures print only the fixed `overall` category to stderr.

| Case | Attempted / blocked collection | Fetch / page / custom | Qualified | Display / interact | Host render / click confirmed |
|---|---:|---:|---:|---:|---:|
| positive | 4 / 0 | 1 / 1 / 1 | 1 | 1 / 1 | 1 / 1 |
| no-consent | 4 / 4 | 0 / 0 / 0 | 0 | 0 / 0 | 0 / 0 |
| no-offer | 3 / 0 | 1 / 1 / 1 | 0 | 0 / 0 | 0 / 1 |
| non-render | 3 / 0 | 1 / 1 / 1 | 1 | 0 / 0 | 0 / 1 |

Display is bundled into the page submission, not another collection call. All cases initialize
once, update explicit simulated consent once, and execute lazy/delayed phases; denied eager
collection is marked blocked. Denial exercises the local guard for fetch/page/custom/interaction
and blocks host rendering/clicking. The stub records consent denial, not SDK-native enforcement.
No-offer actually fetches an empty list; non-render actually qualifies the expected proposition
but uses the ordinary host control button instead of applying it. Positive waits for host fixture
visible-render acknowledgement, page DISPLAY, lazy initialization, bound click, void ACDL custom
submission, native INTERACT and empty delayed phase, in that order.

### Module contract and test-only clock

`stock-harness.mjs` is pure browser-compatible ESM with no imports or DOM access. Its sole export,
`runStockJourney(options)`, returns a deeply frozen report on success **or** failure. The closed
options/renderer contract is documented in
[051-05's pre-test note](../../docs/specs/051-adobe-integration-proving-ground/slice-05-local-stock-harness.md#open-051-05-implementation-contract--before-tests):

- Exactly the seven selected pinned integration functions, fixed case, synthetic `runId`,
  integer `eventIndex`, canonical HTTPS origin/root `pageUrl`, bounded literal `decisionScope`,
  `{orgId,datastreamId}` config, `{render,click}` renderer, required `timeoutMs` (1–10000).
- Optional module-only `{setTimeout,clearTimeout}` clock for deterministic deadlines. There is
  no CLI flag or environment seam for clocks, files, modules, SDK configuration or transports.
- Known static HTML/item/schema, exact scope and TGT provider qualification; one proposition and
  one item. Renderer acknowledgement is a trusted host fixture observation, never SDK
  `renderAttempted` proof. No arbitrary markup or selector execution is implemented.
- Exact pinned signatures: `initMartech(webSDKConfig,martechConfig)`,
  `updateUserConsent({collect,personalize,marketing,share})`, `sendEvent(payload)`,
  `sendAnalyticsEvent(xdm,data,overrides)`, `pushEventToDataLayer(event,xdm,data,overrides)`,
  `martechLazy()`, `martechDelayed()`. Fetch scopes are top-level for Alloy 2.31.1. Eager is
  the harness's manual fetch/render/page phase, **not `martechEager()`**, whose known non-DOM
  auto-display gap is deliberately avoided. Automatic clicks/display/page tracking and
  data-layer state merging are disabled; delayed has no Launch URLs.

Failures are fixed `invalid_input`, `invalid_invocation`, `invalid_proposition`,
`render_unconfirmed`, `click_unconfirmed`, `integration_rejected`, `renderer_rejected`,
`click_rejected`, `timeout`, `invalid_contract`, or `internal_failure` categories.
Invalid inputs/functions fail before invocation. Failure or per-invocation timeout stops every
subsequent harness side effect; already dispatched SDK/host work is **not cancelled**.
Void ACDL submission cannot expose its listener's later asynchronous SDK rejection. Counts are
application submissions, including dispatched calls that reject, not HTTP attempts, vendor
completion, receipt, retries or exactly-once delivery. The public claims are always:
`local_fixture_only:true`, `sdk_execution_verified:false`, `product_receipt_verified:false`,
`deployment_verified:false`, `activity_activation_performed:false`.

```sh
npm test -- test/adobe-stock-harness.test.js \
  test/adobe-preflight-cli.test.js test/adobe-preflight-transport.test.js \
  test/adobe-preflight-evidence.test.js test/adobe-workspace-evidence.test.js \
  test/contract-stability.test.js
```

The tests spawn the real CLI with read/network/SDK/credential tripwires (permitting only Node's
two fixed public module-source reads), record actual function calls/arguments and exercise
refusals, false host acknowledgements, malformed/foreign/ambiguous propositions, rejections,
late settlement after timeout, deep freeze and redaction. All runs are dry simulations, not
executions of the real pinned integration or Alloy.

## Deployable stock smoke entry — 051-06 (code tested; live gates open)

`stock-site.mjs` is browser ESM, **not another dry-run CLI**. Its default supplier is the real
same-origin `./vendor/aem-martech/index.js`. Nothing imports that supplier until eligible eager
execution. The parent must vendor the unmodified pinned plugin and its dependencies/license,
official Alloy **2.31.1** and reference ACDL **3.0.1** into the reviewed test-site paths.
The module neither deploys assets nor verifies served hashes/CSP. Current tests use real isolated
Chromium DOM/crypto and stub exports; **no Adobe SDK or Adobe traffic ran in those tests**.

Exports:

- `isOptIn(url, allowedOrigin)`: pure boolean URL predicate; root-only canonical HTTPS and
  exactly `airlock-stock=v1`, one fixed `case`, `run=airlock05102-<32 lowercase hex>`,
  `consent=decline`. Order is immaterial; duplicates, extra/encoded keys, unknown values,
  fragments (including a bare trailing `#`) and foreign origins fail.
- `validateConfig(config, nowMs = Date.now())`: pure boolean enabled-window/schema predicate.
  Exact primitive fixture fields are retained (see `test/fixtures/adobe-stock-site.json`).
  Require one or two unique SHA-256 hashes of the **current approved offer UTF-8 HTML bytes**;
  the fixture's disabled/empty-hash template is intentionally ineligible. Real public-safe
  hashes/runtime org/datastream/custom scope come only from parent-approved readbacks.
  UTC timestamps use millisecond ISO form. Optional `publicAssetPins` accepts only the exact
  `{aemMartech,alloy,acdl}` values documented in 051-06; it is not a served-byte attestation.
  No SDK/module URL, activity/offer/environment/property/suite IDs or credentials belong here.
- `createStockEntry({config,runnerConsent,slot?,loadIntegration?,clock?})`: synchronous entry.
  Actual `location.href` is rechecked. Consent must be explicitly `"grant"` for collection or
  `"deny"` for no-consent; URL `decline` never grants SDK consent. A supplied slot must be an
  empty connected DIV. The optional loader and `{now,setTimeout,clearTimeout}` clock are
  **module-only test seams**, never JSON/URL/operator flags. Deployment uses the default loader.

Entry exposes `eager()`, `lazy()`, `delayed()`, boolean `ready`, frozen sanitized `result`
snapshots, and **private-only** `getObservation()`. Result starts `pending`, ends
`sdk_submission_observed` or `locally_guarded`, or a fixed refusal/failure category. Ineligible
entries explicitly return `notEligible`, not success. No raw exception is logged or echoed.
`getObservation()` exposes the exact synthetic `pageName`/`customName`, raw response, original
identity and qualified/rendered HTML **in browser memory only** for the private Playwright
runner's exact report queries. Never serialize that object to console/stdout/public artifacts.

### Root bootstrap / phase mapping (parent applies after reviews)

No edit to head, normal page loading or original consent-check is required. Keep a small pure
pre-import/pre-config-fetch guard in `scripts/scripts.js`; the approved public origin is an
exact parent-supplied constant, not a query/config override. This example mirrors `isOptIn` for
that already canonical constant:

```js
function stockOptIn(href, approvedOrigin) {
  const u = new URL(href);
  const parts = u.search.slice(1).split('&');
  return u.origin === approvedOrigin && href.startsWith(`${approvedOrigin}/?`)
    && u.pathname === '/' && !href.includes('#') && !u.username && !u.password
    && parts.length === 4 && new Set(parts.map(p => p.split('=')[0])).size === 4
    && parts.every(p => p === 'airlock-stock=v1' || p === 'consent=decline'
      || /^case=(positive|no-offer|non-render|no-consent)$/.test(p)
      || /^run=airlock05102-[a-f0-9]{32}$/.test(p));
}

```

The exact reference patch applies this guard **after the original `loadEager(document)`**,
when the page has appeared. It additionally requires the isolated runner's explicit
`window.__airlockStockConsent` to be `grant` or `deny` before any config/module load.
Preparation has one **5,000 ms deadline covering config headers, streaming body and module
import**, not separate unbounded awaits. Fetch `/tools/airlock-stock/runtime-config.json` with
credentials omitted, redirects refused and no cache; cap decoded bytes at **65,536** and cancel
the stream. Race preparation against the aborting deadline and check cancellation/expiry after
every await, before creating any entry or DOM. A late import cannot start stock operations.
Catch failures as fixed `window.__airlockStockFailure = 'bootstrap-failure'`, clear timers,
and continue the site's original lazy/delayed loading. No raw error or head mutation.

After validated enabled config, prepend an owned slot to `main`, call `createStockEntry`,
and store the returned handle as **`window.__airlockStockEntry`**:

```js
// These phase calls follow the fully bounded preparation described above.
if (stockEntry) await stockEntry.eager(); // after original loadEager, visible placement
await loadLazy(document); // unchanged normal site loader
if (stockEntry) await stockEntry.lazy();
loadDelayed(); // unchanged function imports consent-check.js
if (stockEntry) await stockEntry.delayed();
```

These are integration snippets, **not a deployed patch or a new site framework**. Verify the
exact host seam against its current code: a body still hidden before original `body.appear`
cannot earn DISPLAY. Do not loosen visibility to accommodate a hidden eager slot. The parent's
disabled deployment checks must establish compatible placement/CSP/phase order before enabling.
The original site does not await its delayed loader; the entry's delayed completion is separate.

Eager imports/selects the seven pinned exports, initializes pending consent once, updates actual
stock consent, fetches top-level `decisionScopes`, qualifies one TGT HTML item by scope/hash,
validates strict div/p/button/span DOM, imports safe nodes into the 320×180 slot, waits for paint and
connected/visible content (including every offer descendant's computed visibility, opacity,
display and hidden flag, plus rectangle intersection with the viewport, reserved slot and
applicable overflow-clipping ancestors), then submits one page with native DISPLAY. Partial
visibility suffices; this is not a claim of pixel-perfect visibility or occlusion detection. No `martechEager`,
`applyPropositions`, SDK element helper, arbitrary selector or unvalidated HTML sink is used.
DOMParser can use the site's existing default Trusted Types policy; absent required policy
fails closed. Active tags/attributes/URLs are rejected **before parsing**, even with known hashes.
Only spans may carry `data-airlock-readiness`, double-quoted with 1–100 ASCII alphanumeric,
underscore or hyphen characters. Exact original HTML must hash-match an approved offer first;
the inert attribute is stripped from parsed nodes before DOM import. No other span attributes
are accepted, and private original-HTML evidence is not a sanitized DOM serialization.

Lazy initializes ACDL, sets `ready`, then awaits a **trusted real browser click** on
`#airlock-stock-control` (accessible name `Airlock synthetic control`), independent of vendor
HTML. The isolated runner waits for `ready` then clicks once; DOM `.click()`/dispatch does not
qualify. One void `pushEventToDataLayer(LINK,xdm,data,{})` and a separate native INTERACT follow.
No-offer requires explicit `propositions:[]`; non-render requires full qualification but inserts
nothing. Their ordinary page/custom submissions contain no notifications. No-consent performs
actual `updateUserConsent` denial and guards four attempted collection operations locally:
**not vendor-native denial proof**. ACDL's asynchronous listener cannot acknowledge transmission.

Phases are single-use/ordered, at most 10 seconds each, with a 30-second journey deadline capped
by the enabled window. Late settlement cannot resume later module calls/rendering. Counts include
rejecting submissions, not HTTP attempts, vendor acknowledgements, retries or exactly-once proof.
The parent must count actual Adobe requests (including consent/SDK retries), enforce **16 overall**,
close/stop on errors/duplicates/routing drift, and disable public config through its reviewed stop
plan. Already dispatched SDK work cannot be recalled. All downstream/deployment/vendor-enforcement
claims remain false. No application retries, credentials, private CLI or resource mutations exist.

Remaining LIVE gates: independent compliance/craft/architecture plus exact private plan reviews;
fresh real preflight; disabled deployment and exact served bytes/CSP; owned state/schedule readbacks
preserving Page Delivery; one approved attempt and finite separate Analytics/Target observation;
actual stop/activity disposition. 051-06 stays IN_PROGRESS and broad 051-02 remains unfinished.

### Actual deployed smoke status — 2026-10-09

The approved reference site actually loaded the pinned stock SDK and completed no-offer and
corrected positive attempts. The positive qualified the owned offer, visibly rendered sanitized
HTML, and submitted one page/DISPLAY, one trusted-click custom event and one native INTERACT.
Actual Adobe requests total 11, including two failed-positive requests; no conversion was
resent. HTTP/DOM/submission status is **not** downstream Analytics or Target receipt.
Exact-suite report rows are still unobserved during finite scheduled waiting; native Target
counts need an actual refreshed report, not the earlier empty export.

Test-site code is actually disabled and its served bytes verified at reference commit
`c3aa3ca0fcddaa4beb70637fad6ed5f6f70bf8a8`. Owner-authorized retained activity approval has
a bounded end of 2026-10-10T01:19:24Z; no whole-activity or Page Delivery changes were applied.
Before future live runs, use current approved evidence and state, never silently reuse this
expired window. The complete 051-02 negative/performance/receipt and chamber criteria remain open.

The finite 120-minute Analytics observation subsequently completed with no exact page/custom
rows observed. Neither HTTP success nor those absent rows are receipt or proven loss.
No events were resent; downstream Target counts remain unverified. The current run is stopped
after recorded credit usage exceeded the requested ceiling; no broader compatibility success
or completed smoke/baseline lifecycle is claimed.

```sh
npm test -- test/adobe-stock-site.test.js test/adobe-stock-harness.test.js \
  test/adobe-preflight-cli.test.js test/adobe-preflight-transport.test.js \
  test/adobe-preflight-evidence.test.js test/adobe-workspace-evidence.test.js \
  test/contract-stability.test.js
```
