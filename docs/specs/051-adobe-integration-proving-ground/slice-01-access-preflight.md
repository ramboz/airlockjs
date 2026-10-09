---
status: DONE
dependencies: [adr-0031]
last_verified: 2026-10-08
kind: feature
frame_review: true
arch_review: true
---

## Slice 051-01 — read-only access preflight

**Goal:** An integrator can run a safe preflight and see exactly which permissions/resources
allow an isolated Analytics/Target baseline and which actions an administrator still needs to take.

**DoR:**
- [x] Approved non-secret input contract for target org, test-resource selectors and credential source.
- [x] Current official API/auth references checked for every operation the preflight will use.
- [x] Hermetic success, denied, missing-resource, timeout and malformed-response fixtures prepared.
- [x] Live discovery runs only after the owner supplies approved local credentials and read-only scope.
- [x] Independent review of the v1 contracts below, including required checks, accepted manual
      evidence, source/schema limitations and credential-export handling.

**Readiness evidence (2026-10-08):** Independent frame critique and fresh-eyes follow-up passed
after the aggregate-timestamp clarification. The orchestrator approves the reviewed 24-hour
owner-evidence window under the delegated framing authority; it does not establish performance
bands or renew any source evidence. The synthetic fixtures are prepared, the existing approved
credential handle is available with unchanged contents and owner-only permissions, and exact
private selectors/evidence have been normalized without authenticated requests. Original sources
remain intact. Hermetic CLI implementation/acceptance tests are complete. The later parent-owned
real CLI returned 11 required checks ready and one unverified. Independent implementation reviews
and reconciliation passed; this utility is DONE. No stock readiness or product proof is inferred.

**Acceptance Criteria:**

1. **Useful report.** The CLI produces a redacted machine-readable report and a concise operator
   summary. Each required Analytics/Target/Data Collection permission or resource has a stable
   check name, `ready`, `blocked` or `unverified` state, reason category and next action.
   A versioned report shape and documented invocation are delivered with the tool.
2. **Honest exit status.** Exit 0 means every required baseline check was verified ready.
   Any blocked/unverified required check produces a nonzero exit. Invalid configuration,
   denied access, absent resource and unreachable service are distinguishable in the report;
   transport failures are not mislabeled as confirmed lack of entitlement.
3. **Read-only boundary.** Discovery executes only the explicitly documented read/list operations.
   Tests assert no create/update/delete, activity activation, publication, paid provisioning or
   production/default-resource mutation is attempted. A selected resource must match the approved
   org and product-specific test scope; an AEP sandbox alone never makes Target/Analytics safe.
4. **Secret-safe operation.** Credentials are read from the approved local source, not command-line
   literals or browser configuration. Tokens, authorization headers, raw identities and live
   identifiers are absent from emitted logs and durable reports; synthetic sentinel tests verify
   redaction on success and error paths.
5. **Actionable unknowns.** Unsupported/unverified admin API capabilities identify the exact
   documentation or guided UI/admin step still needed. The tool never probes an undocumented
   internal endpoint merely to avoid a manual step, nor switches org/resource silently.
6. **Deterministic and bounded discovery.** Repeated unchanged fixture input produces the same
   check states/next actions. Pagination and network waits have configured, documented finite
   limits; partial enumeration is `unverified`, not an exhaustive ready result.
7. **Grounded live status.** R-012 records the redacted real preflight result if access is available,
   or explicitly records that only the utility/fixture behavior is proven. Missing credentials
   can block baseline execution without being reported as product access successfully verified.

## DRAFT v1 operator and evidence contract

This command checks **initial Analytics/Target preparation**, not deployment, activity activation,
SDK delivery or product outcomes. The reviewed contract is implemented and validated hermetically;
the parent-owned real unverified result is recorded in R-012. Independent implementation reviews
and reconciliation passed. The utility is DONE; the real stock gate remains blocked.
R-012's ad-hoc successes are starting
evidence, not a run of this CLI (command-line interface), fresh readbacks or completed acceptance
criteria. Review this input/evidence boundary before implementation; do not tick DoR from authoring.

### Invocation and files

Use Node's existing ES module support and built-in `fetch`, filesystem and crypto modules;
use existing Vitest, with no new dependencies. Implemented entry point:

```sh
node probes/adobe-compatibility/preflight.mjs \
  --input "$AIRLOCK_PREFLIGHT_INPUT" \
  --routing-evidence "$AIRLOCK_ROUTING_EVIDENCE"
```

The operator sets `AIRLOCK_PREFLIGHT_INPUT` and `AIRLOCK_ROUTING_EVIDENCE` to approved private
file paths and `ADOBE_CREDENTIAL_FILE` to the **existing approved Adobe export**, through the
execution host's environment. These are path handles, not inline secret values. No copying or
rewriting the credential file, shell sourcing, `.env` auto-loading, browser-token extraction or
credential output. The CLI reads these files only and never writes private state.

Allowed flags are exactly `--input <path>` (required), `--routing-evidence <path>` (optional;
omission leaves routing unverified), `--credential-secret-index <integer>` (only needed to select
one entry when the export contains multiple secrets), and `--help` (static usage, no reads/network).
Reject duplicate/unknown flags, positional arguments, inline credentials, endpoint/header/method
overrides and fixture flags before any request. No API URL, token or secret environment overrides
are supported. Stdout is exactly one public report JSON document plus newline; stderr is a short
summary built only from its enums/counts. Exit 0 = all required checks ready; 1 = at least one
required check blocked/unverified; 2 = invalid input/credential schema or invocation; 3 = internal
failure. Every failure except help emits the same report shape; never print an exception or parser
message. Operators may redirect **only the redacted stdout report** to a chosen public artifact.

### Private input: `airlock.adobe-preflight.input`, `schema_version: 1`

All listed keys are closed: reject unknown keys at every input/evidence level, wrong types,
duplicate JSON object keys, unsupported versions and ambiguous alternatives. JSON files are UTF-8
objects, bounded to 256 KiB each, maximum nesting depth 16. Reject symlinks/non-regular files;
the credential export must be owner-readable only (`0400` or `0600` on this host). No report echoes
file paths, object keys supplied by the operator, values or hashes. Private input is not a
committed fixture; examples/tests use invented identifiers.

| Required field | Exact contract |
|---|---|
| `kind`, `schema_version`, `profile` | Literals `airlock.adobe-preflight.input`, `1`, `analytics-target-initial`. No AJO/CJA/RTCDP probing or automatic alternate profile. |
| `approval` | `{mode:"read-only", approved_at, expires_at, authority_ref}`. UTC RFC3339 timestamps; approved time not in the future, expiry after approval and run start. `authority_ref` is a private bounded reference to the owner's scoped authorization, not authority to mutate. |
| `selectors.ims_org_id`, `.global_company_id`, `.report_suite_id` | Nonempty exact identifiers, compared case-sensitively; never select the first discovery result or match by name. RSID at most 40 UTF-8 bytes. |
| `selectors.target` | `{tenant, workspace_id, property_id, environment_id, activity_id, decision_scope, offers}`. `offers` is exactly two distinct `{id, content_sha256}` records for the owned HTML offers. Target resource IDs are canonical positive decimal strings, within JavaScript's safe integer range; returned integers are converted only after a safe-integer check. Workspace ID remains a string. |
| `selectors.datastream` | `{id, configuration_context}`. Exact owner-selected managed datastream and its Data Collection context; no assumption that a context named `prod` routes to production Analytics/Target. |
| `selectors.site` | `{github_owner, github_repo, ref, preview_origin}`. Explicit approved site/ref; `preview_origin` must equal the derived `https://{ref}--{github_repo}--{github_owner}.aem.page`, with no port/path/query/fragment. No domain fallback, redirect or arbitrary site URL. |
| `scope_evidence` | The versioned owner-selection envelope below, required even when API reads succeed. |
| `report_window` | `{start,end}`: absolute suite-local timestamps in `YYYY-MM-DDTHH:mm:ss` format, valid dates, end after start, at most 24 hours, both before run start in the suite's returned timezone. No date formula, arbitrary filters or report body. |

Selector strings are bounded to 250 characters (tenant 64; decision scope 100); reject control
characters, whitespace padding, URL/userinfo/query syntax, slashes, backslashes, percent escapes,
`.`/`..` segments and prototype keys. Org/company/RSID/workspace/context/datastream identifiers
allow only ASCII letters, digits, `_`, `-`, `.`, `@`; tenant and site components allow letters,
digits, `_`, `-` only and must be valid single DNS/path components. SHA-256 fields are exactly 64
lowercase hex characters. `decision_scope` alone allows `[A-Za-z0-9_.-]` within 100 characters
(including periods), is dedicated to this test,
and cannot be `target-global-mbox`. Encode individual path components; do not interpolate URLs.
This scope-only alphabet correction was approved by the frame reviewer under delegated framing
on 2026-10-08 after local execution found the owned literal scope contains periods. It is not an
authority expansion: `.`/`..`, prototype values, controls/whitespace, URL/query/userinfo syntax
and `@` remain refused; tenant/site alphabets are unchanged. The complete owner binding and the
fresh activity's exact case-sensitive literal scope name must still match.

`scope_evidence` has exactly `{kind, schema_version, observed_at, expires_at, provenance,
bindings, credential_identity_sha256, dedicated_resources}`:

- `kind:"airlock.adobe-preflight.owner-selection"`, version `1`; `bindings` is an exact copy of
  the complete `selectors` object, including both offer content hashes and site/ref.
- `provenance:{basis:"owner-scoped-configuration", authority_ref, record_ref}` refers to the
  owner's resource designation and org/Target-tenant/workspace/application-profile association.
  References are private nonempty strings bounded to 250 characters, never output or fetched.
- `credential_identity_sha256` is SHA-256 of UTF-8
  `JSON.stringify([ORG_ID, CLIENT_ID, TECHNICAL_ACCOUNT_ID])`, without a trailing newline.
  Compare in memory with the actual export; never hash secrets or decode a token as identity proof.
- `dedicated_resources:{analytics_suite:true,target_property:true,target_environment:true,
  target_workspace:true,target_activity:true,target_offers:true,site:true}` records the scope
  **designated by this owner**, not an independent audit of absent customer traffic or all grants.
  False, missing or mismatched designation cannot pass. Fresh API checks below are still required.
- Owner-selection evidence must be at most 24 hours old, unexpired and not future-dated at run start.
  Re-normalizing an old snapshot does not change its observation time. A reference/digest is
  provenance, not a signature or proof that the CLI inspected the source artifact.

An optional `limits` object may contain only the limits listed below, each a positive integer no
greater than its fixed ceiling. No environment override increases them. Omitted limits use ceilings.
Missing evidence is `unverified`; structurally invalid evidence is configuration exit 2; valid
evidence for different selectors is `blocked/scope_mismatch`. This distinction also applies to
the separate routing file.

### Credential export adapter (private, unversioned Adobe file)

The owner-supplied format was identified on 2026-10-08: exactly uppercase `ORG_ID`, `CLIENT_ID`,
`CLIENT_SECRETS` (nonempty array of nonempty strings), `SCOPES` (nonempty array of distinct scope
strings), `TECHNICAL_ACCOUNT_ID`, `TECHNICAL_ACCOUNT_EMAIL` (nonempty strings). Support these
directly through `ADOBE_CREDENTIAL_FILE`; do not demand a lower-case copied secret config.
Reject unknown fields, legacy JWT/private-key/token formats and malformed arrays without echoing
their content. This adapter is an owner-confirmed export format, not a claim that the OAuth
documentation standardizes export files.
Reject control characters in scalar fields and array entries; bound IDs to 250 characters, email
to 320, individual secrets to 8 KiB, secret entries to 16 and scope entries to 256. Array limits
are local safety ceilings, not Adobe licensing or credential-count claims.

If there is one secret, use index 0; otherwise require an explicit valid
`--credential-secret-index`. Never try every secret. Exact `ORG_ID` and the identity digest must
match the approved input before token issuance. Use the export's approved `SCOPES`, comma-joined
in the documented form body, without adding scopes or persisting them. Scope strings may not
contain commas, whitespace or control characters. The email/account ID are private and never
logged. Missing/unreadable credentials leave authentication unverified, not entitled or denied.
Hold the single issued token in memory for this invocation only; no refresh, cache file, secret
rotation or extra token introspection/profile operation.

### Managed routing evidence: separate file, version 1

Required when automatic configuration readback is unavailable. The exact keys are:

| Field | Required meaning |
|---|---|
| `kind`, `schema_version`, `basis` | `airlock.adobe-preflight.routing-evidence`, `1`, `owner-ui-and-saved-pin-confirmation`. |
| `observed_at`, `assessment_completed_at`, `expires_at` | Screenshot observation <= aggregate assessment completion <= run start; both events at most 24 hours old; expiry after completion and run start. Keep the original screenshot observation time. Aggregate completion is the latest actual event completing all required evidence, including the saved-pin acknowledgment. |
| `provenance` | `{authority_ref, record_ref, screenshot_source:"owner-supplied", screenshot_sha256}` with exactly three distinct screenshot digests. Private source references, never URLs to fetch. |
| `bindings` | Exact `{ims_org_id, global_company_id, report_suite_id, target_tenant, target_workspace_id, target_property_id, target_environment_id, datastream_id, configuration_context, site}` matching the input. `site` is its complete site selector object. |
| `selected_datastream_id`, `analytics_report_suite_ids` | Exact selected datastream; array containing only the selected suite. |
| `visible_enabled_services`, `service_inventory_complete`, `disabled_or_absent_services` | Enabled set exactly `["analytics","target"]` (order ignored); complete overview inspection explicitly recorded; disabled/absent set exactly `["aep","ajo","audience-manager","event-forwarding"]`. No inference from a cropped single-service screenshot. |
| `analytics_single_suite_matches_selected_suite` | Literal `true`, plus independent equality of the bound suite and single-suite array. Not sufficient alone. |
| `property_token_api_sha256` | Hash of the token comparison in the owner evidence. Compare to SHA-256 of the **fresh** exact property's API `token`, in memory. Never accept the historical digest as a new API read or persist/print the live token/hash. |
| `required_target_environment_id` | Exact selected environment ID, rechecked against the fresh environment read. |
| `target_environment_pin_saved_owner_confirmed`, `target_environment_pin_confirmation_source`, `target_environment_pin_confirmed_at` | Literal `true`, private nonempty source reference, and timestamp between observation and assessment completion. Explicit scoped acknowledgement that this exact environment pin was entered **and saved** on this datastream after the initially empty field. Not a screenshot of a populated field or an API readback. |
| `configuration_api_read_verified` | Literal `false`. V1 cannot accept `true` or change evidence basis to `api_read`. |

Require all bindings, provenance, service assertions, freshness and current resource comparisons.
Stale/missing/incomplete evidence is unverified; explicit mismatch, unsafe destination or unsaved
pin is blocked. A screenshot digest proves no configuration semantics by itself. The CLI validates
the scoped owner's attestation and fresh token/resource comparisons; it does not do OCR or inspect
browser state. Historical fields listed in R-012 can be normalized by the parent with their original
timestamps and extra selector/provenance bindings; never invent an observation or renew freshness.
If the saved-pin acknowledgment follows the original screenshot snapshot's assessment, its actual
recorded timestamp completes the combined assessment. Preserve the original snapshot's assessment
timestamp in the immutable source referenced by `record_ref`; do not present the aggregate as that
source's original assessment. Neither aggregation nor normalization extends the screenshot's
24-hour freshness window or its expiry.

The unavailable management API remains an **unverified separate check**. Routing accepted under
this narrow manual policy is not an API success, proof of write permission or permanent approval.
Any credential/resource/routing change invalidates the binding; re-inspect before SDK traffic.
No undocumented metadata service, UI application key or user token may bypass this manual step.

### Closed operation inventory and response checks

These are the complete network operations for v1. Official sources were inspected on 2026-10-08.
The request gate owns method, origin, exact path, query keys, headers and body template; config
cannot add an operation. No SDK/Edge delivery, write-authorization trial or product provisioning.

| Operation | Request/auth | Required response/readback |
|---|---|---|
| `ims.token` | **POST** `https://ims-na1.adobelogin.com/ims/token/v3`; form body exactly `client_id`, `client_secret`, `grant_type=client_credentials`, `scope`; no bearer header. | 200 object with nonempty `access_token`, case-insensitive `token_type=bearer`, finite positive integer `expires_in` seconds. Token must remain valid through the run deadline. This is the authentication-only POST exception. |
| `analytics.discovery` | GET `https://analytics.adobe.io/discovery/me`; bearer and `x-api-key=CLIENT_ID`. | `imsOrgs[]`, each `imsOrgId`, `companies[].globalCompanyId`; exact org/company pair uniquely present. Ignore private `imsUserId`/friendly names. No first-company fallback. |
| `analytics.suite` | GET `https://analytics.adobe.io/api/{company}/reportsuites/collections/suites/{rsid}?expansion=currency,timezoneZoneinfo`; same auth. | `Suite.rsid` exactly selected; `currency` and valid `timezoneZoneinfo` present. Owner-approved suite designation is separate. Direct lookup avoids the collection schema's incomplete pagination description. |
| `analytics.reporting` | **POST** `https://analytics.adobe.io/api/{company}/reports`; bearer/API key; JSON body exactly `{rsid,globalFilters:[{type:"dateRange",dateRange:"{start}/{end}"}],metricContainer:{metrics:[{columnId:"0",id:"metrics/pageviews"}]},settings:{limit:1,page:0,reflectRequest:false}}`. | Documented **nonmutating totals report**, no dimension/segments/search/customer identities. Require 200, `summaryData.totals` of length 1 with finite nonnegative number, rows absent/empty, no `columns.columnErrors`. 206/column errors/nonempty rows are not ready. Discard totals, reflected request, report ID and all contents. Establishes query permission only, not synthetic-event receipt. |
| `target.environment` | GET `https://mc.adobe.io/{tenant}/target/environments/{id}`; bearer/API key; `Accept: application/vnd.adobe.target.v1+json`. | `Environment.id` exact; `default:false`, `serveInactiveActivities:false`. Missing booleans unverified; unsafe flags blocked. No host moves/default changes. |
| `target.property` | GET same origin `/{tenant}/target/properties/{id}`; v1 Accept. | `Property.id` exact, `channel:"web"`, `workspaces` exactly the selected workspace, nonempty `token`. Token kept only for routing hash comparison. |
| `target.properties` | GET same origin `/{tenant}/target/properties`; v1 Accept, **no invented pagination parameters**. | `PropertyList.total` nonnegative integer equals unique `properties[].id` count; selected property occurs once, and only it is assigned to the selected workspace in this accessible snapshot. Partial/inconsistent/bounded-away listing is unverified. Does not audit hidden grants or establish exclusive application-wide permissions. |
| `target.activity` | GET same origin `/{tenant}/target/activities/ab/{id}`; **v3** Accept. | `ABActivity.id`, `workspace`, `propertyIds` exactly match; `state:"saved"`; valid future `startsAt < endsAt`; `locations.mboxes` contains only the selected custom scope; `options[].offerId` set exactly both selected offers; experience `optionLocations` resolve to those options/locations. No approval/state/schedule call. |
| `target.offer` (twice) | GET same origin `/{tenant}/target/offers/content/{id}`; **v2** Accept. | `ContentOffer.id`, `workspace` exact; `content` string matches approved content hash. No body/name/content output or HTML execution. |
| `site.status` | GET `https://admin.hlx.page/status/{owner}/{repo}/{ref}/`, no `edit=auto` or bulk request, **no credentials**. | Documented public status: root `webPath`, `preview.status:200`, `preview.url` exactly selected origin plus `/`; validate any live URL against derived same-site `.aem.live` origin. Ignore author/source/permission metadata for readiness. A root `code.status:404` is not a deployment-right denial. |
| `site.preview` | GET selected derived preview origin plus `/`, **no credentials**. | 200 `text/html`, bounded body, discarded without running scripts. Reachability only, not deployed instrumentation, browser CSP or worker compatibility. |

Analytics GETs send `Accept: application/json`; reporting additionally uses JSON Content-Type.
Target requests send the per-operation vendor Accept above, never an implicit default.
Only the token body and fixed reporting body may be sent. No Target batch, authentication/debug
token, profile/IMS-context introspection, Launch, AEP/AJO/CJA/RTCDP, GitHub permission, EDS config,
publish/code/preview write or datastream-configuration endpoint is in this inventory.

Upstream responses are **not** closed input schemas: validate required consumed fields/types,
ignore unknown optional fields without copying them to output (Adobe documents additive fields).
Missing/ambiguous/wrong-version fields are unverified schema failures, not guessed defaults.
Target schemas specify media types and fields but have inconsistent operation summaries
(`/activities/ab/{id}` is labelled XT); bind the path and `ABActivity` response schema, not that
summary. The report schema leaves `summaryData` open; its `totals` semantics are grounded in the
official reporting guide and need the explicit fixtures below, not a generic report example.

### Bounds, transport failures and refusal

| Limit key | Default/hard ceiling |
|---|---|
| `request_timeout_ms` | 10,000, covering headers **and** streaming body |
| `run_timeout_ms` | 120,000, covering the entire invocation |
| `max_response_bytes` | 1,048,576 decoded bytes per body (token body included) |
| `max_total_response_bytes` | 8,388,608 across all bodies |
| `max_requests` | 24 (ordinary run uses 12); no retry or token refresh |
| `max_pages` | 1 per collection; current inventory has no paginated operation, so never a guessed next-page call |
| `max_items` | 1,000 per collection, including discovery's nested org/company count and properties |

Sequential bounded requests; cancel streams/timers on completion or limit, with abort enforcing
the shorter request/run deadline. JSON parsing depth is bounded to 32 for responses. Refuse all
redirects (`redirect:"manual"`, including same-host redirects), non-HTTPS, URL credentials, alternate
ports, mutated body/query/header templates and method/path variants **before sending credentials**.
Require authorization/evidence expiry to cover the run deadline, not merely its start; otherwise
leave affected required checks unverified and do not start their requests.
Never follow response `next`/`Link` URLs or use `total` to increase limits. Property listing is one
documented request: count/total mismatch, duplicate IDs, extra-page hints or truncation is partial,
never absence or an exhaustive permission claim.
Aggregate byte exhaustion is invocation-wide: cancel the current stream and stop all subsequent
transports and body reads, including otherwise independent site reads. No new per-request budget
can replenish the aggregate ceiling.

HTTP 401/403 means blocked `authentication_rejected`/`access_denied`, not confirmed absent license.
404 is blocked `resource_not_found` only for an exact resource after its parent scope was verified;
otherwise unverified. 400/406/407 are unverified `request_contract_error`; 429 is unverified
`rate_limited`; 5xx/DNS/TLS/reset are unverified `transport_failure`; deadline is unverified
`timeout`; 206 is unverified `partial_response`. Parse valid Analytics `errorCode`/Target
`errors[].errorCode` solely into fixed categories; never emit messages, IDs, metadata, headers,
`Location`, body snippets or library stacks. Malformed/HTML/echoed-error responses remain safely
unverified. No automatic entitlement inference, retry storm, org switch or broader-scope fallback.
On a parent check failure, skip dependent requests and leave their checks unverified.
Target property 404 cannot establish its own missing parent tenant corroboration and remains
unverified. An environment 404 becomes confirmed absence only after the current exact property/
workspace read corroborates tenant binding; if that property check fails, environment absence
also remains unverified. No broader lookup or fallback is authorized.
Dependency order is explicit: `input.scope` precedes token issuance; OAuth precedes discovery;
org/company discovery precedes Analytics and Target reads. Suite readback precedes reporting;
exact property/workspace readback precedes workspace enumeration and activity/offer reads.
Routing requires current property **and** environment reads plus accepted owner evidence.
Tenant binding requires owner-selection evidence, org discovery and a successful exact-property
read, without claiming the property response contains an org/profile mapping. Public site
reads depend only on valid approved site/input scope and can still run when Adobe auth fails.
An independent report-query failure does not suppress safe Target/site checks.
A suite-local invalid report window is invalid configuration: exit 2 with unverified overall,
and stop the run without a reporting POST or further Target/site work.

### Public report: `airlock.adobe-preflight.report`, `schema_version: 1`

Every run produces exactly these top-level keys:
`kind`, `schema_version`, `profile`, `generated_at`, `overall`, `exit_code`, `checks`, `summary`,
`claims`. `kind` and `profile` match the constants above with `report` replacing `input`.
`generated_at` is UTC RFC3339; `overall` is `ready|blocked|unverified` (blocked wins when any required
check is blocked). Invalid-input/internal runs use unverified overall and exit 2/3.
`summary` is exactly `{required_ready, required_blocked, required_unverified, optional_unverified,
api_requests}` with nonnegative integer counts.
`claims` is always `{scope:"initial-preparation-only", deployment_verified:false,
product_outcomes_verified:false, mutation_authority_verified:false}`.

`checks` always contains the following fixed rows in this order, even on early failure; no dynamic
check names, resource hashes or selectors:

| Check ID | Required | Ready evidence basis |
|---|---|---|
| `input.scope` | yes | `owner_scoped_configuration` plus export identity equality |
| `auth.oauth` | yes | `api_read` (authentication exception only) |
| `analytics.org_company` | yes | `api_read` |
| `analytics.suite` | yes | `api_read` plus scope designation already checked |
| `analytics.reporting` | yes | `api_read` (fixed query, not receipt) |
| `target.tenant_binding` | yes | `owner_scoped_configuration`; supported Target reads corroborate access, **not** a tenant-to-org/API-profile readback |
| `target.environment` | yes | `api_read` |
| `target.property_workspace` | yes | `api_read` |
| `target.workspace_snapshot` | yes | `api_read`, complete visible listing only |
| `target.activity_offers` | yes | `api_read`, activity and both offers must pass |
| `datastream.routing` | yes | `owner_ui_confirmation`, including fresh property/environment comparison |
| `site.scope_readability` | yes | `api_read` plus approved exact site binding |
| `datastream.configuration_api` | no | Always `unverified/unavailable_automation`, basis `none` |
| `target.write_authority` | no | Always `unverified/not_exercised`, basis `none` |
| `site.deployment_authority` | no | Always `unverified/not_exercised`, basis `none` |
| `products.deferred` | no | Always `unverified/deferred_scope`, basis `none` |

Each row has exactly `{id,required,state,evidence_basis,reason,next_action,http_status,freshness}`.
`state` is `ready|blocked|unverified`; `evidence_basis` is
`api_read|owner_scoped_configuration|owner_ui_confirmation|none`; `http_status` is a safe integer
or null (null for composite/non-API checks); `freshness` is `current_run|accepted_owner_window|
stale|not_observed`. Preserve the attempted basis on a stale/mismatched evidence row; missing
evidence uses `none`. Never turn an unverified required check optional at runtime.

`reason` is a closed enum: `verified`, `invalid_configuration`, `credentials_unavailable`,
`authentication_rejected`, `access_denied`, `resource_not_found`, `scope_mismatch`,
`unsafe_configuration`, `missing_evidence`, `stale_evidence`, `schema_error`, `partial_response`,
`partial_enumeration`, `request_contract_error`, `rate_limited`, `transport_failure`, `timeout`,
`limit_exceeded`, `endpoint_refused`, `dependency_unverified`, `unavailable_automation`,
`not_exercised`, `deferred_scope`, `internal_failure`.
`next_action` is a closed enum: `none`, `correct_input`, `supply_credentials`,
`verify_credential_profile`, `verify_resource_selector`, `renew_scoped_evidence`,
`inspect_datastream_ui`, `save_environment_pin`, `restore_inactive_fixture`,
`review_api_contract`, `retry_later`, `review_read_limits`, `resolve_parent_check`,
`retain_manual_routing`, `complete_051_02_plan`, `defer_later_products`, `report_internal_failure`.
The README supplies fixed plain-language explanations; no server/operator text is interpolated.

Use these fixed reason-to-action defaults (no error-message interpretation):

| Reason | Action |
|---|---|
| `verified` | `none` |
| `invalid_configuration` | `correct_input` |
| `credentials_unavailable` | `supply_credentials` |
| `authentication_rejected`, `access_denied` | `verify_credential_profile` |
| `resource_not_found`, `scope_mismatch`, `unsafe_configuration` | `verify_resource_selector` |
| `missing_evidence`, `stale_evidence` | `renew_scoped_evidence` |
| `schema_error`, `partial_response`, `request_contract_error`, `endpoint_refused` | `review_api_contract` |
| `partial_enumeration`, `limit_exceeded` | `review_read_limits` |
| `rate_limited`, `transport_failure`, `timeout` | `retry_later` |
| `dependency_unverified` | `resolve_parent_check` |
| `unavailable_automation` | `retain_manual_routing` |
| `not_exercised` | `complete_051_02_plan` |
| `deferred_scope` | `defer_later_products` |
| `internal_failure` | `report_internal_failure` |

Only these row-specific overrides are allowed: missing/stale routing -> `inspect_datastream_ui`;
explicit unsaved environment pin -> `save_environment_pin`; unsafe activity state/schedule ->
`restore_inactive_fixture`; input/credential identity mismatch -> `correct_input`. These are
operator instructions, not operations the preflight performs. On multiple failures in one
composite row, choose the first failing constituent in the operation order above, except an
explicit unsafe/scope mismatch outranks an unknown; preserve all other fixed rows.
A later denial/404 alone does not replace an earlier unknown, and an already-blocked first
constituent remains the reported failure.

Build reports from allowlisted primitives only; do not redact a spread/copied response after the
fact. Freeze the report and nested objects after construction. Sentinel tests must scan stdout,
stderr and the report for secrets, token, email/account IDs, selectors, content, paths and hashes,
including unknown-field keys, malformed JSON and thrown objects that echo them.
Timestamps/counts may vary; identical fixtures with a fixed injected clock yield byte-identical
JSON, ordering, check dispositions and actions.

Optional diagnostics above **do not satisfy** unavailable automation or external write gates.
051-02 still requires a separate reviewed plan, actual scoped write/deployment verification when
needed, activity targeting/publication authorization and product-observation methods. A v1 ready
report accepts precisely this initial-preparation contract; it is never a full-run readiness grant.
If any such capability is required for a future profile, it must be required and unverified until
properly established, not silently moved to diagnostics.

### Grounded sources and proposed executable tests

- [OAuth implementation guide](https://developer.adobe.com/developer-console/docs/guides/authentication/ServerToServerAuthentication/implementation)
  and [IMS token reference](https://developer.adobe.com/developer-console/docs/guides/authentication/ServerToServerAuthentication/ims):
  token host/form and `access_token`/`token_type`/`expires_in`; no legacy JWT setup.
- [Analytics discovery](https://developer.adobe.com/analytics-apis/docs/2.0/guides/endpoints/discovery):
  org/company nesting, API-key/bearer headers and additive optional fields.
- Official Analytics schemas at inspected commit
  [`2fe476d331afac8cc2d180170b2111c2aa181592`](https://github.com/AdobeDocs/analytics-2.0-apis/tree/2fe476d331afac8cc2d180170b2111c2aa181592/static):
  `report-suites.json` `getSuite_1`/`Suite`; `swagger.json` `runReport`, `RankedRequest`,
  `RankedReportData`, `RankedColumnError`. [Reporting guide](https://developer.adobe.com/analytics-apis/docs/2.0/guides/endpoints/reports/)
  documents totals with no dimension. The reporting POST is explicitly inventoried here and must
  be covered by request/response/error fixtures before use.
- [Target versioning](https://experienceleague.adobe.com/en/docs/target-dev/developer/api/admin-api/admin-api-overview)
  and official [`admin-api.json` at 63e9ea6c1e80e7568f2cd4b39cc1acad98d941fe](https://github.com/AdobeDocs/target-developers/blob/63e9ea6c1e80e7568f2cd4b39cc1acad98d941fe/src/admin-api.json):
  exact paths, vendor media types, `Environment`, `Property`, `PropertyList`, `ABActivity`,
  `ContentOffer`, `ErrorResponse`. Token issuance follows current OAuth docs rather than legacy
  examples on the Target authentication page.
- [EDS Admin reference](https://www.aem.live/docs/admin.html), GET
  `/status/{org}/{site}/{ref}/{path}` operation `status`: public read option, `webPath`,
  preview/live/code metadata. No Adobe bearer is sent to the public site/status requests.
- [R-012 current routing and approval evidence](../../research/R-012-adobe-first-compatibility.md#initial-routing-and-approval-checks--2026-10-08):
  owned saved fixture, UI routing basis and actual-deployment/outcome limitations; [datastream
  settings](https://experienceleague.adobe.com/en/docs/experience-platform/datastreams/configure)
  document explicit Target environment/property pins. No supported S2S configuration read is
  claimed by this contract.

Implemented tests are `test/adobe-preflight-cli.test.js` (invocation, private inputs, immutable public
shape/exits/determinism), `test/adobe-preflight-transport.test.js` (all operation templates,
media types, bounded reads and failure dispositions), and `test/adobe-preflight-evidence.test.js`
(selector binding, freshness, manual/API separation and dependent readiness).

Synthetic starting data is prepared in
[`test/fixtures/adobe-preflight.json`](../../../test/fixtures/adobe-preflight.json): frozen UTC
clock, separate exact-v1 input/routing/uppercase-export objects, all 12 declared replies, expected
public report and focused failure variants. The wrapper is test-only, not an accepted operator
input or live evidence. Its screenshot digests hash invented labels, not real screenshots.
No test execution, contract approval or DoR checkbox is implied by fixture preparation.

Run the planned suites together:

```sh
npm test -- test/adobe-preflight-cli.test.js \
  test/adobe-preflight-transport.test.js test/adobe-preflight-evidence.test.js
```

Tests invoke the same CLI parser/runner with captured streams, synthetic files and an injected
transport/clock **from a test harness only**. Also spawn the real executable for help and
invalid-input/no-network cases. Do not expose fixture URLs, transport modules, arbitrary hosts
or clock overrides through flags/env; a fixture transport still passes through the production
request allowlist. Cover every operation's minimal official shape and optional unknown response
members; no live fixture or Adobe credentials in test data.

Witness red-to-green for complete ready with manual routing; each required unknown/denial/missing
resource; missing/rotated/multiple/malformed uppercase credentials; unknown/deep/oversized/duplicate
input; unsafe origin/query/method/body/redirect; all byte/item/request/time limits including
slow/chunked/lying Content-Length bodies; partial/duplicate property enumeration with no guessed
pagination; wrong org/company/tenant mapping/workspace/property/environment/activity/offer/site;
changed token/content hashes; stale/future/selector-mismatched routing or unsaved environment pin;
200 malformed bodies, 206/column errors, 400/401/403/404/406/429/5xx and thrown transport errors.
Assert report totals/IDs/echoed secrets never escape, even via unknown keys/parser/throw paths,
and no token or report POST becomes a generic mutation exception.

**DoD:**
- [x] ACs are exercised through the operator CLI with hermetic fixtures and named error cases.
- [x] Redaction, mutation refusal and partial-enumeration tests witnessed red-to-green.
- [x] Required compliance/craft review evidence recorded; no status advance from documentation alone.
- [x] Required frame/input-contract and architecture reviews cover the new CLI/report boundary;
      implementation architecture review evidence is recorded before REVIEWED.
- [x] Deviation log/reconciliation sweep and reconciliation review completed.
- [x] R-012 and operator instructions distinguish real access from fixture-only results.

**Anti-horizontal-phasing check:** The preflight is independently useful: an operator gets an
actionable readiness/access report even if no test resources can yet be created.

## Assumptions

- The parent can supply fresh, scoped version-1 owner-selection/routing evidence from the approved
  sources without inventing observations. Historical snapshots alone may be stale; required
  missing/stale bindings stay unverified.
- The official schemas' incomplete totals semantics and inconsistent Target operation summaries
  can be covered by grounded fixtures and independently reviewed parsers. A live shape that
  differs must fail safely and prompt contract review, not be guessed into readiness.
- The dedicated site exposes public status matching its exact preview URL. If this optional
  anonymous-access mode is denied or differs, required site readability stays unverified/blocked;
  do not substitute browser cookies or another credential source.

### Deviation log (after reconciliation)

The original ACs are preserved. Two Node leaf helpers separate private schemas and API readbacks
from CLI orchestration; one shared test harness avoids three copies of synthetic file/transport
setup. The test wrapper's routing digest is now derived once from its own invented response before
mutations, retaining negative binding checks without a scanner exception.
An independently approved scope-specific alphabet correction permits periods in the unchanged
owned fixture name; timestamp parsing preserves original precision and exact freshness/order.
Neither correction expands authority, weakens bindings, renews observations or changes the stable core.

Actual validation remains distinct: 278 hermetic preflight cases plus 36 frozen-core cases pass;
the full suite passes 2,196 tests after restoring a missing locked Prism dependency, without a
manifest change. The real CLI returned exit 1/12 requests with one required workspace unknown,
and no SDK, deployment, activation or product proof followed.

Craft/architecture N1 is retained as a non-blocking resource residual: the private-file timeout
bounds the caller wait, not pending operating-system reads/parsing. The operator guide describes
that limitation; no full filesystem-cancellation guarantee or readiness waiver is claimed.

### Reconciliation sweep

Checked R-012, the overview/slice/plan/tasks, operator README and release/primer surfaces:
updated current status and precise Admin Console guidance; preserved historical setup/TDD evidence
and broader Adobe/third-party obligations. Accepted ADRs, runtime architecture, conventions,
frozen contracts and dependency manifests are no-op: their interfaces/rules did not change.
Restored the locked local dependency only after the full suite failed for its missing file.
The upstream portable-goal handoff is integrated without dropping either evidence set.

Memory helper persisted the missing-workspace evidence rule and file-per-slice implementer entry
gotcha; team check honored the existing opt-out. No unrelated inbox item was resolved. Leanness:
no provisioner, generic request client, new dependencies or speculative SDK implementation was added.
The derived board is regenerated and its audit is clean. Use-case coverage reports zero gaps,
zero dangling links and nine pre-existing unanchored specs, intentionally not given invented
trace links. The independent reconciliation verdict passed and the utility lifecycle is closed.

#### Changed-path dispositions

The helper's `main...HEAD` list includes older work because local `main` is stale; it is not an
ownership ledger. This sweep uses integrated `origin/main` at `865bfaa` plus current workspace
changes. No shared-main checkout was read or rewritten.

| Disposition | Paths and scope |
|---|---|
| `updated` | `CLAUDE.md`, `docs/releases/adobe-compatibility.md`, `docs/research/R-012-adobe-first-compatibility.md`: current operator/status/evidence guidance, with historical context and release obligations preserved. |
| `updated` | `docs/specs/051-adobe-integration-proving-ground/{spec.md,plan.md,tasks.md,slice-01-access-preflight.md}`: exact contracts, witnessed implementation, reviews, deviations and real result. |
| `updated` | `docs/specs/051-adobe-integration-proving-ground/{slice-02-test-baseline.md,slice-03-compatibility-investigation.md}`: live blocker/approved scope and time-box facts only; neither was implemented. |
| `updated` | `docs/specs/051-adobe-integration-proving-ground/reviews/slice-01-{frame-critique,compliance,craft,arch}.md`: actual independent evidence, including final test-template supplements. |
| `updated` | `probes/adobe-compatibility/{preflight.mjs,contract.mjs,responses.mjs,README.md}`: the standalone utility and operator contract/limitations, outside browser runtime/frozen surfaces. |
| `updated` | `test/adobe-preflight-{cli.test.js,transport.test.js,evidence.test.js,harness.js}`, `test/fixtures/adobe-preflight.json`: hermetic CLI boundary cases and prepared synthetic template; no private data. |
| `updated` | `docs/specs/README.md`: derived board regenerated/audited and current introduction refreshed. `docs/memory/learnings.md`: bounded source-backed learnings via helper. |
| `preserved upstream` | `docs/releases/{README.md,adobe-compatibility-goal.md}` and their links in primer/release/R-012: portable handoff from `865bfaa`, not authored as this slice or treated as budget/product proof. |
| `excluded inherited` | `README.md`, `contracts/README.md`, `docs/adoption/rewire-a-container.md`, `docs/architecture.md`, `docs/decisions/{README.md,adr-0018-reframe-onto-adoptable-one-point-oh.md,adr-0031-reframe-onto-adobe-first-compatibility.md,reviews/adr-0031-frame-critique.md}`: earlier reframe/accepted history already on integrated main, not modified or re-accepted here. |
| `excluded inherited` | `docs/{inbox.md,product-vision.md,real-site-validation.md,refinement-todo.md}`, `docs/memory/glossary.md`, `docs/releases/{granular-chamber-policy.md,mvp9.md,vendor-parity-assurance.md}`, `docs/research/README.md`: inherited front-door/index/ledger history retained; no prior residual or accepted gate erased. |
| `excluded inherited` | `docs/specs/{015,016,017,019,020,022,026,028,029,030,031,032,033,034,035,036,037,038,039,041,044,045,046,047,048,049,050}-*/spec.md`: earlier amendment/reframe paths in the helper list, not this slice's edits. No closed-record rewriting. |
| `no-op/deferred` | Runtime `core/`, `adapters/`, `connectors/`, `drivers/`, frozen contracts, conventions and dependency manifests unchanged. Specs 052-057 and wider Adobe/third-party evidence remain deferred to their actual prerequisites, not marked complete. |

### Implementation/TDD witness — 2026-10-08

Confirmed this standalone target was `READY_FOR_IMPLEMENTATION`, then ran
`workflow.py transition docs/specs/051-adobe-integration-proving-ground/spec.md 051-01 IN_PROGRESS`
before creating tests or implementation files. The overview rollup was not manually authored.
No commits, live/private-state access, or review verdict writes were performed.

- **Initial real red:** `npm test -- test/adobe-preflight-cli.test.js
  test/adobe-preflight-transport.test.js test/adobe-preflight-evidence.test.js --reporter=dot`
  (captured through `2>&1 | tail -30`): **172 failed / 0 passed**, three failed suites.
  Load-bearing failures: absent `probes/adobe-compatibility/preflight.mjs` at
  `test/adobe-preflight-harness.js:49`, real help/invalid-input process assertions, and missing
  fixture-only R-012 documentation. This was observed before implementation, not inferred.
- **First green:** same three-suite command: **172 passed / 0 failed** after implementing.
  Two test defects were corrected without relaxing the contract: Vitest's array argument
  expansion required wrapping each argv list, and a scope-mismatch test needed a structurally
  valid alternate site origin rather than a contradictory site/ref.
- **Added boundary red:** same three-suite command: **197 passed / 9 failed** (206 total).
  Failures witnessed malformed status sentinel leakage/noninteger/BigInt serialization,
  rejected/late-body cancellation, invalid clock serialization, and unsafe/mismatched
  evidence precedence. Implemented corrections, then **206 passed**, plus 36 regression tests.
- **Whole-invocation red:** `npm test -- test/adobe-preflight-cli.test.js --reporter=dot`:
  **63 passed / 1 failed**; `input.scope` was incorrectly ready after the private-file
  preparation budget expired. Bounded private-file waits and pre-network deadline checks
  made this test pass.
- **Independent inventory-policy red:** `npm test -- test/adobe-preflight-transport.test.js
  --reporter=dot`: **77 passed / 6 failed**. Accidentally broadened templates were equal
  to themselves but not in the fixed operation inventory. Added a separate origin/path/query/
  method policy gate in addition to exact immutable template equality; all six now pass.
- **Final combined green:** `npm test -- test/adobe-preflight-cli.test.js
  test/adobe-preflight-transport.test.js test/adobe-preflight-evidence.test.js
  test/contract-stability.test.js`: **249 passed / 0 failed**, four suites
  (213 new preflight tests + 36 unchanged frozen-core tests).
- Targeted existing ESLint for the four test files passes. Probes are ignored by the repository
  config, so they were additionally checked with the existing ESLint recommended rules and
  Node globals via the Node API; intentional control-character rejection uses two line-local
  documented suppressions. Node ESM syntax checks also pass. No installation was needed.

Deliverables: the Node CLI and minimal closed-contract/typed-response helpers under
`probes/adobe-compatibility/`, operator README, three named suites, and one shared
`test/adobe-preflight-harness.js` for their synthetic private files/transport/captured streams.
The test seam is `runCli({argv, env, stdout, stderr, transport, now})`; production exposes none of
the injection options through flags/environment. `assertRequest(candidate, expected)` is exported
for refusal tests; the runner owns and freezes its fixed expected templates.

The supplied synthetic fixture needed no schema changes. No ACs, performance bands, runtime
modules, frozen contracts or ADRs changed. No live access/outcome success is claimed. DoD/review
boxes remain untouched; this slice remains `IN_PROGRESS` for compliance/craft/architecture review,
reconciliation and the separately authorized parent-owned live gate. 051-02 has not started.

### Same-slice RFC3339 correction — 2026-10-08

The parent reported an approved-input CLI attempt ending at configuration exit 2 with zero
requests. Original immutable source observations used valid six-digit UTC RFC3339 fractions;
the implementation's invented 1–3 digit restriction contradicted this reviewed contract.
This corrective pass read no private sources and made no live/token requests.

- Tests first: `npm test -- test/adobe-preflight-cli.test.js test/adobe-preflight-evidence.test.js
  --reporter=dot` witnessed **12 failed / 137 passed** before the correction (149 tests).
- Corrected the parser to accept RFC3339's one-or-more fractional digits, bounded by the existing
  private-file byte ceiling. Calendar/syntax validation remains intact. Exact string-based UTC
  evidence comparisons retain sub-millisecond precision for future observations, aggregate/pin
  order, the 24-hour window and expiry through the run deadline. No input/source strings,
  observations or expiry are rewritten, truncated or renewed.
- The added 19 CLI/evidence regressions exercise six-digit source timestamps, 1–512 digit valid
  fractions, nanosecond future/expiry/pin-order boundaries, original-string preservation and
  malformed dates/fractions. Existing fixture and decision-scope pattern are unchanged.
- Green: `npm test -- test/adobe-preflight-cli.test.js test/adobe-preflight-transport.test.js
  test/adobe-preflight-evidence.test.js test/contract-stability.test.js`: **268 passed / 0 failed**
  (232 preflight + 36 unchanged frozen-core tests). Targeted test/contract recommended lint,
  syntax and whitespace checks pass.

This corrected an implementation defect, not the authored evidence policy. At the time of this
timestamp correction, the period-containing scope correction was still pending frame approval;
no scope pattern or operator-contract changes were made in that pass. The later approval and
implementation are recorded below. Slice remains `IN_PROGRESS`; no
live/review/DoD completion is claimed by this correction.

### Same-slice approved scope/compliance corrections — 2026-10-08

The parent relayed delegated frame approval for the exact scope-specific `[A-Za-z0-9_.-]`
alphabet within 100 characters after independently inspecting the actual owned scope. No private
value was supplied to or read by this implementation pass. All prohibited syntax, shared tenant/
site alphabets, exact owner binding and fresh literal activity-scope matching remain enforced.
This is a local execution-discovered contract correction, not an authority expansion.

The independent compliance NEEDS-CHANGES findings were reproduced with tests before code edits:

1. Inherited `constructor`/`toString`/other positional names after valid flags must fail before
   reads/network. The parser now requires own-property membership in its closed flag table.
2. Aggregate byte exhaustion now stops later transports and body reads invocation-wide, not only
   the current request. Exact/exceeded and multi-response tests assert request/read/cancel counts.
3. Target property 404 remains unknown before current tenant corroboration. Environment 404 is
   confirmed absent only after successful exact property/workspace corroboration; property failure
   leaves environment absence unverified, with no fallback or dependent enumeration.
4. Composite rows retain the earliest failure unless it is unknown and a later explicit unsafe/
   scope mismatch outranks it. A later access denial/404 alone is not that exception.
5. A suite-local invalid report window propagates to configuration exit 2/unverified overall and
   stops the run after suite readback, without reporting/Target/site requests.

**Witnessed red:** `npm test -- test/adobe-preflight-cli.test.js
test/adobe-preflight-transport.test.js test/adobe-preflight-evidence.test.js --reporter=dot`:
**20 failed / 257 passed** (277 tests), before implementation changes.
The 45 added regressions also cover matching/mismatching/prohibited dotted scopes without using
private data or changing the supplied fixture.

**Green:** `npm test -- test/adobe-preflight-cli.test.js test/adobe-preflight-transport.test.js
test/adobe-preflight-evidence.test.js test/contract-stability.test.js`:
**313 passed / 0 failed** (277 preflight + 36 unchanged frozen-core tests).
Original fractional timestamp strings and exact evidence ordering/freshness/expiry remain covered.
No live/token calls, private-state access, commits, review verdict writes or review/DoD ticks.
The parent must rerun approved live validation and independent compliance; lifecycle stays
`IN_PROGRESS`.

### Parent-owned real result and observed-shape coverage — 2026-10-08

The orchestrator's real approved-input CLI made 12 bounded requests and returned exit 1:
11 required checks ready, `target.workspace_snapshot` unverified, four optional diagnostics
unverified. R-012 and the operator README record the missing optional workspace association
metadata and precise Admin Console confirmation needed. Owner confirmation was unavailable.
No missing field was assumed empty, required check relaxed or product receipt fabricated.
051-02 has no ready real report; no SDK traffic, deployment or activity activation occurred.

The implementer added one invented non-selected-property omission regression. It verifies
the observed exit/state/counts and absence of raw identifier/name sentinels from all outputs.
Existing runtime already failed safely, so the new test passed without code changes and **no
new red witness is claimed**. Combined suite: 314 passed, zero failed
(278 preflight cases plus 36 unchanged frozen-core cases). Targeted lint and whitespace pass.
Implementation review/reconciliation gates remain separate from these observations.

### Commit-protection fixture preparation — 2026-10-08

The commit hook flagged the computed routing-token digest in the synthetic JSON as a generic
API key. Local verification established it was the SHA-256 of the fixture's own invented token,
not a secret or private resource value. No scanner bypass, configuration exception or allowlist
change was used. The template now stores null, and the harness derives the digest once with Node
crypto before cloning/mutations. Generated synthetic evidence files remain schema-valid; rotated
token negatives keep the original expected binding. Raw template extraction is not supported.

The preparation change first produced 13 failed / 56 passed CLI cases. Correct harness preparation
restored all 314 targeted cases; the full suite then passed 2,196 tests across 124 files.
Staged gitleaks and targeted lint passed. Independent compliance and craft supplements passed.
Production schemas, code, authority, unknown workspace state and source observations are unchanged.

### Close-out (post-DONE)

- [x] Regenerate the status board through Jig and retain the live-access caveat in its notes.
- [x] Record any unresolved permission/API limitation without making 051-02 ready.
