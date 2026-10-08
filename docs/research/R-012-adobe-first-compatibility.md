---
status: OPEN
topic: Adobe-first SDK compatibility and API-led test-environment setup
created: 2026-10-06
related:
  - ../decisions/adr-0031-reframe-onto-adobe-first-compatibility.md
  - ../releases/adobe-compatibility.md
  - ../specs/051-adobe-integration-proving-ground/spec.md
---

# R-012: Adobe-first compatibility and owned test-environment setup

> Keep the official SDK, investigate the whole documented integration surface, and prove one complete
> Adobe journey before broad implementation. This is an open investigation record: source/documentation
> reconnaissance is complete for the points below. Selected authenticated read-only access checks ran
> on 2026-10-07. Subsequent owner-authorized setup created a dedicated Target environment;
> the owner-created Analytics suite and reference EDS site were verified on 2026-10-08.
> The owner-created Target web property and ExperienceEvent schema were subsequently verified.
> Target workspace assignment and datastream routing verification remain pending as recorded below.
> Live instrumentation/product-outcome proof has **not** run. The release is committed in direction,
> not proven in outcome.

## Question

Can the stock Alloy.js SDK support the pinned `aem-martech` integration and Adobe Web SDK-connected
product workflows through Airlock without losing functionality or weakening the boundary? What can
we provision and validate through supported admin APIs, given that the owner has no ready
Target/Analytics environment and little product-setup experience?

## Access status

**Owner-confirmed, 2026-10-06:** an existing organization has Adobe Analytics and Target access.
This removes the unknown-entitlement starting point for those two products, but is not an authenticated
permission check. The test report suite, Target environment/workspace/property, Data Collection rights,
API credential profiles and any AEP/AJO/CJA/RTCDP entitlements were unverified at initial drafting.

### Read-only credential verification — 2026-10-07

The owner supplied an OAuth Server-to-Server export as a local attachment and authorized access
verification. It was parsed locally without displaying credential values. Tokens were used in memory
against documented Adobe HTTPS hosts; no secret/token or raw resource response was persisted.
Only token issuance and read-only discovery requests were made. No product resources were changed.

| Check | Observed result | What this establishes / does not establish |
|---|---|---|
| Adobe IMS OAuth token issuance | HTTP 200; bearer token issued | Credential works for authentication; does not imply every API is authorized. |
| Analytics company discovery | HTTP 200; returned company matches the credential org | Actual Analytics API access, not just a configured Console entry. |
| Analytics report-suite collection | HTTP 200; accessible report suites returned | Existing suite metadata can be read; no approved test suite or write/report-query permission established. |
| Target tenant metadata and environments/properties/offers | Tenant resolved from IMS context for the credential org; all three product reads HTTP 200 | Actual Target administrative read access; test isolation, activity creation/activation and reporting still require separate checks/approval. |
| Customer Journey Analytics data-view collection | HTTP 200; data views returned | Actual CJA data-view read access; underlying AEP ingestion, test connections/data views and reporting are not thereby proven. |
| EDS Admin API profile | HTTP 200; authenticated profile returned | EDS accepts the credential; no selected site/repository preview, publish or configuration permissions tested. |
| Experience Platform sandbox collection | HTTP 403; gateway code `403003` | Application/API-key authorization was rejected for this Platform API. Product entitlement versus API registration/profile permissions is not resolved by this failure. |
| Experience Platform Schema Registry collection | HTTP 403; gateway code `403003` | Same application/API-key rejection on a setup-critical API; schema/dataset/datastream provisioning access is not established. |
| AJO campaign retrieval | HTTP 401 in the default `prod` sandbox context | Required campaign access is not established. The credential's AJO-specific scopes reference suppression services; those scopes do not prove campaign/web-personalization administration. |
| AJO suppression-domain retrieval | HTTP 400 in the default `prod` sandbox context | Inconclusive request/context result, not evidence of absent AJO licensing or successful AJO access. No suppression data or addresses were retained. |

Default-sandbox calls above were read-only authorization probes, not selection of that sandbox
for development or permission to mutate it. Listing/resource checks were bounded snapshots, not
an exhaustive permissions audit. No customer data, activity bodies, offers or resource identifiers
are included in this record.

### Retry after AEP and Launch registration — 2026-10-07

The owner added Experience Platform and Launch APIs and updated the attachment. Fresh OAuth
authentication and the previously successful Analytics/Target/CJA/EDS reads still succeed.
The following results supersede the initial API-registration diagnosis where applicable:

| New or repeated check | Observed result | Current interpretation |
|---|---|---|
| Launch/Reactor company and property reads | HTTP 200 on both; company metadata advertises `manage_properties` | Actual Launch read access and advertised company capability; creation/publication not tested or authorized. |
| Platform sandbox administrative collection | HTTP 403; permission/sandbox error categories, rather than the initial gateway code | This operation requires Sandbox Administration; its failure alone does not prove the credential cannot use an existing sandbox. |
| Platform available-sandbox collection | HTTP 200; returned zero accessible sandboxes | Platform accepts this discovery request, but no usable sandbox context was returned for the credential. |
| Schema Registry in default `prod` context | HTTP 403; permission error category | Schema access remains unverified/denied in that context. No development context was returned for a scoped alternative; none was invented. |
| AJO campaign read in default `prod` context | HTTP 401; permission/authorization error categories | Required campaign access still not established; no conclusion that the product license is absent or that all AJO APIs reject Server-to-Server auth. |
| AJO suppression-domain read in default `prod` context | HTTP 400 | Still inconclusive; not a substitute for inbound campaign/personalization access. |

The distinction between the administrative `/sandboxes` collection and the
[available-sandbox endpoint](https://experienceleague.adobe.com/en/docs/experience-platform/sandbox/api/available)
is now explicit: preflight should discover contexts through the least-privilege endpoint first,
and require sandbox-administration rights only if approved provisioning needs them.

**Next action at that checkpoint:** assign the **API credential**, not just the human account,
to a Platform permission role and development sandbox, then retry. Adobe documents the role's
[API credentials assignment](https://experienceleague.adobe.com/en/docs/experience-platform/access-control/abac/permissions-ui/permissions).
The owner subsequently added roles; the following check records the result rather than leaving
this earlier diagnosis as current.

### Retry after Platform role assignment — 2026-10-07

Fresh OAuth authentication succeeded. Available-sandbox discovery returned five contexts:
four active development sandboxes and one active production sandbox. One discovered development
context was used only for read-only authorization probes, not approved as the implementation
environment.

| Check | Observed result | What is established |
|---|---|---|
| Available-sandbox collection | HTTP 200; development contexts returned | The credential now has usable development-context discovery. |
| Sandbox administrative collection | HTTP 200 | Administrative listing is accessible; creating/resetting/deleting sandboxes was not tested or authorized. |
| Schema Registry in a discovered development context | HTTP 200; schema metadata returned | Actual schema read access in that context. |
| Catalog dataset collection in that development context | HTTP 200 | Actual dataset metadata read access in that context. |
| AJO campaign collection with the minimal documented read request | HTTP 200 in development and the discovered default context | Campaign read access is now established; campaign creation/publication, inbound delivery and reporting remain separate checks. |
| AJO suppression-domain collection | HTTP 400 in both contexts | This request remains inconclusive but is not required for the initial inbound Analytics/Target/AJO investigation. |

The earlier campaign request containing `page=0` returned 400 after role assignment. A follow-up
using `count=1` without that pagination argument and JSON request headers returned 200.
This was a request-shape adjustment, not evidence that another entitlement had been granted between
those calls; the exact pagination/header contract still needs validation in the tested preflight.
The suppression request's failure must not negate the demonstrated campaign access or be silently
classified as successful.

**Current remaining prerequisites:** choose/approve the actual development sandbox and product-specific
test resources, verify datastream configuration access and the required product observation methods,
and confirm EDS site deployment rights. Read successes do not prove mutation/publication permission.
RTCDP workflow access and outcomes are still unverified. No product writes, resource provisioning,
activity publication or production setup were performed; tokens and resource responses stayed out
of persisted output.

These ad-hoc checks inform 051-01 but do not implement its tested operator utility or satisfy its
review/readiness gates. Specs 051-057 remain DRAFT.

## Analytics and Target test-resource candidates — 2026-10-07

The owner requested resource identification while preparing a disposable EDS boilerplate site.
Discovery was read-only: no suite/property/workspace/activity creation, host move, test-event
submission, publication or global-default change.

### Observed metadata

- **Analytics:** the accessible report-suite collection was paginated to completion; 529 unique
  suites matched the API's reported total. Several names/IDs suggest test, development, sandbox
  or EDS use, but none in this accessible snapshot is labelled Airlock. Name patterns establish
  neither ownership nor absence of traffic; no customer traffic reports were queried.
- **Target:** three environments and three web properties were returned. The non-default
  **Development** environment has zero currently listed hosts and `serveInactiveActivities:false`.
  Staging also has zero listed hosts; Production is the default and has existing host mappings.
  Environment host counts are metadata observations, not a guarantee that no API/override traffic
  reaches them.
- Target enterprise permissions are enabled. Two web properties have workspace assignments;
  the test-labelled property has no workspace assignment in the returned metadata. No property
  was established as Airlock-owned, and IMS context hints are not a verified complete workspace
  membership/permission audit.

Exact candidate selectors and limited metadata are retained only in a session-local `0600`
manifest, `adobe-test-resource-candidates.local.json`. OAuth secrets/access tokens and Target
property routing-token values are excluded. The committed note uses no live resource identifiers.

### Recommended resource plan — approval and creation still pending

| Product | Recommendation | Why / required safeguards |
|---|---|---|
| Analytics | Prefer a new dedicated **Airlock Adobe Compatibility - Test** report suite. Existing sandbox/EDS suites are fallback candidates only after their owner confirms reuse. | A clean suite avoids shared reporting/processing assumptions and contamination. New RSID must follow the company's required prefix; decide timezone/currency and test volume with the approved setup plan. |
| Target environment | Reuse the existing **Development** environment, subject to owner approval, without changing its default or inactive-serving settings. | It is non-production and currently has no listed hosts; scope test activities to the approved domain/decision scopes rather than assuming the environment alone isolates activities. |
| Target property/workspace | Prefer a dedicated Airlock web property assigned to an approved test workspace/product profile. Do not automatically reuse the unassigned test-labelled property. | Property/workspace ownership and API credential privileges must be confirmed; test activity publication needs explicit approval and narrow targeting. |
| Test datastream | Route only to the approved Analytics suite and Target environment/property; use the chosen AEP development context independently. | Pin **Target Environment ID** and **Property Token** before the first stock/chamber SDK request. Never rely on a new preview domain being automatically classified as Development. |

[Target environment/host documentation](https://experienceleague.adobe.com/en/docs/target/using/administer/environments)
states that new hosts default to Production. The
[datastream configuration](https://experienceleague.adobe.com/en/docs/experience-platform/datastreams/configure)
provides explicit Target Environment ID and Property Token settings. Together with dedicated
activity targeting/workspace scoping, those form the isolation plan; none was configured by this discovery.

The [current official Analytics report-suite OpenAPI](https://github.com/AdobeDocs/analytics-2.0-apis/blob/main/static/report-suites.json)
documents `POST /{globalCompanyId}/reportsuites/reportsuites/{rsid}` for standard suite creation
and requires the owning-company prefix. This corrects the earlier uncertainty about availability
of a 2.0 creation API; the credential's ability to execute it, quotas/cost and the resource plan
remain untested/unapproved. Workspace assignment may require an administrator's supported UI path.

**At the discovery checkpoint:** creation still required owner authorization; a site's repository/
preview domain was not yet available. The owner subsequently requested new Airlock-specific
Analytics and Target resources. The following section records that limited authorization and actual
outcomes; no existing datastream may be repointed merely because intended resource names are recorded.

## Dedicated resource creation — owner-authorized 2026-10-07

The owner explicitly requested new resources rather than reusing shared Analytics/Target test
areas. Authorized scope was limited to an Airlock report suite, Target environment and web property:
no existing production resource edits, activity publication, host moves, datastream changes or
synthetic event submissions. The owner was unavailable to choose an existing Target workspace,
so none was selected or modified; the proposed property remains pending an Airlock-only profile.

| Resource | Actual result | Verification / remaining blocker |
|---|---|---|
| **Airlock - Development** Target environment | **Created**, HTTP 201 | Re-read confirms non-default and `serveInactiveActivities:false`. Prior environment names/settings, new-host/reporting defaults and existing property/workspace assignments are unchanged. |
| **Airlock Adobe Compatibility - Test** Analytics suite | **Not created** | The documented 2.0 creation endpoint returned HTTP 400, `invalid_parameters`, with `Invalid rsid prefix`. Accessible suites have mixed namespaces; the verified company/current-user metadata did not establish the required owning-company prefix. No successful receipt and no Airlock identifier in the final visible suite collection. |
| **Airlock - Adobe Compatibility (Test)** Target web property | **Not created** | HTTP 400, `NonUpdatableToken.propertyDTO.token`, including with the minimal documented `name`/`channel` payload. Token omission, empty and explicit-null request variants did not clear validation. Final property listing contains no matching Airlock property. No guessed routing token or workspace permission widening. |

Exact created selectors and per-operation state are stored in a session-local `0600` manifest,
`airlock-adobe-resources.local.json`; the plan is in `airlock-adobe-resource-plan.local.json`.
Neither contains OAuth secrets/access tokens or Target routing-token values. Failed requests are
recorded as failures, not resources to reuse; the successfully created environment is retained.
Deletion/cleanup was not authorized.

The Target create API rejects a supplied `default` field as read-only; omitting it allowed
environment creation, and a subsequent read established non-default behavior. Analytics RSIDs
have a documented maximum of 40 bytes, and the owning-company prefix is mandatory; a global
company identifier or a guessed common prefix from imported suites is not a safe substitute.

**Unblockers at the 2026-10-07 checkpoint (Analytics/site subsequently resolved below):**

- Obtain the Analytics report-suite company prefix from **Analytics > Admin > Report Suites >
  Add Report Suite** (the prefilled RSID prefix), or an authoritative supported metadata source.
  Then retry the dedicated suite in that namespace with neutral GMT/USD settings. Existing suite
  settings/data must not be copied or overwritten automatically.
- Resolve the Target property-create validation through the supported UI or current API-contract
  clarification. **Target > Administration > Properties > Create Property** is the documented UI
  route. Create/assign an Airlock-only workspace/product profile before treating property permission
  isolation as ready; no existing workspace should be selected by default.
- Once the reference site's domain is known, provision the separately approved test datastream
  and activities with the actual Target environment/property pins. The new environment alone
  is not a fully configured Target sandbox or a completed stock baseline.

This is a **partial setup**, not completion of spec 051-02 or the end-to-end release.
No lifecycle/review state was advanced. Source references:
[Analytics suite creation and length constraint](https://experienceleague.adobe.com/en/docs/analytics/admin/admin-tools/manage-report-suites/c-new-report-suite/t-create-a-report-suite),
[Target properties/workspaces](https://experienceleague.adobe.com/en/docs/target/using/administer/manage-users/enterprise/properties-overview),
and the official API schemas linked above.

## Owner-created suite and reference site — verified 2026-10-08

The owner supplied a newly created dedicated Analytics report suite and an EDS boilerplate site:

- Repository: [`adobe-rnd/aem-eds-airlock-poc`](https://github.com/adobe-rnd/aem-eds-airlock-poc).
- Preview: [main EDS reference site](https://main--aem-eds-airlock-poc--adobe-rnd.aem.page/).
- Authoring: [DA reference site](https://da.live/#/adobe-rnd/aem-eds-airlock-poc).

The exact report-suite identifier and other Adobe integration selectors remain only in the private
resource manifest. The owner's designation replaces the earlier failed API-created suite candidate;
no second suite was created and no existing suite settings were changed.

| Verification | Observed result | Boundary |
|---|---|---|
| Designated Analytics suite | HTTP 200; returned suite matches the owner's exact selection; USD and US/Pacific metadata | The owner selected these settings; the earlier proposed GMT setting was not applied. |
| Metric metadata for that suite | HTTP 200; metric definitions returned | Metadata/reporting components are accessible; no report query, SDK event, ingestion or product outcome verified. |
| EDS preview page | HTTP 200; HTML, bootstrap reference and CSP header present | Preview reachability verified, not browser/worker-CSP or application compatibility proof. |
| GitHub reference repository | Read succeeds; token permissions advertise push and admin | Repository access is available; no push, branch creation or code change performed. |
| Reference bootstrap source | Eager/lazy/delayed hooks present; inspected bootstrap contains no Airlock/Alloy/`aem-martech` integration markers | Source-based starting point, not an exhaustive deployed-network audit or a configured Adobe baseline. |
| EDS resource status for this site | HTTP 200; preview/live/code permission metadata advertises read/write | Existing page preview/live statuses are 200; the queried root's code-resource status is 404. Advertised write rights were not tested by mutation. |
| EDS site-configuration read | HTTP 403 | This credential is not verified for site configuration. Code/preview permission does not imply config administration. |
| Dedicated Target environment | Re-read confirms non-default and active-only | Previously created environment remains safe; no settings modified. |
| Target property collection | HTTP 200; no Airlock-labelled property returned | The property/workspace blocker remains; earlier creation failures were not retried blindly. |

An initial Analytics broad-discovery read returned 429. Verification used the already verified
credential-org company context for the exact suite instead of repeatedly listing companies;
the exact suite and metric reads then succeeded. Probes use bounded reads and do not forward
credentials through redirects.

The session-local `airlock-adobe-resources.local.json` now records the owner-created suite,
designated site and sanitized permission results with `0600` permissions. OAuth credentials/tokens,
Target property routing tokens and raw responses are not persisted. The earlier Analytics creation
blocker is cleared for the actual selected fixture; the prior failed requests remain historical evidence.

**Setup boundary at that checkpoint:** the Analytics fixture and reference site were established enough to
continue the access/setup investigation. A dedicated Target property with an approved workspace,
datastream configuration pins, approved test activities and their receipt/report observations remain
unresolved. DA authoring permissions were not tested, and EDS site-config changes would need separate
access if the baseline requires them. The AEP development context has not yet been chosen/approved
for actual setup.

No deployment, content edit, suite mutation, SDK event or activity publication occurred.
Specs 051-057 remain DRAFT; this verification is not the tested preflight utility, the stock baseline,
or permission to start the full autonomous release.

## Target property and initial sandbox scope — 2026-10-08

The owner created the Target property, schema and datastream, then requested clearer workspace
instructions and whether AEP development isolation is necessary for the first Analytics/Target tests.
Read-only verification found one Airlock-labelled web property with a routing token and **zero
workspace assignments**. Its metadata is now recorded in private setup state; no token value is
copied into source or committed documentation. This resolves the earlier property-creation blocker,
not the remaining permission assignment or activity-delivery proof.

The owner-selected schema is readable in `prod`, uses the XDM ExperienceEvent class and has no
Profile union tag. This verifies the class/metadata, not every required field-group or payload.
The owner supplied a datastream in the same `prod` context; its service destinations were **not**
verified by API. Exact schema/datastream IDs remain in local-only state.

### Correction: a new AEP sandbox is not an initial Analytics/Target prerequisite

For the initial baseline, a dedicated Data Collection datastream can route to the isolated
Analytics report suite and Target environment/property without enabling the **Adobe Experience
Platform** destination service. The `prod` label in the supplied links identifies the Platform/
Data Collection configuration context; it does not force routing into Target Production or an
Analytics production suite. Actual service settings determine those destinations.

Keep Platform ingestion, dataset/Profile configuration, AJO and event forwarding disabled for
the first Analytics/Target baseline. No new sandbox, dataset, custom customer identity or Profile
enablement is needed to finish this setup. Keep the created schema/datastream rather than asking
the owner to recreate them now. Before AJO/CJA/RTCDP ingestion/profile/audience experiments, select
and approve a development sandbox and create appropriate separate resources there.

This clarifies earlier setup guidance; it does not authorize modifying shared production objects,
sending test events, or narrowing the later release product matrix. Adobe's
[Web SDK datastream tutorial](https://experienceleague.adobe.com/en/docs/platform-learn/implement-web-sdk/initial-configuration/configure-datastream)
distinguishes the Platform-native development-sandbox recommendation from Analytics/Target-only
Data Collection use.

### Target workspace meaning and setup

A Target **workspace is an Admin Console product profile** governing users/API credentials and
the properties they can manage. The dedicated Target **environment** controls delivery/reporting
context; it is not the permissions workspace. A separate workspace is recommended for this
owner-requested isolated test setup, not an additional licensed tenant or a prerequisite for all
possible Target implementations.

Create an Airlock-only profile in Admin Console under the correct organization's Adobe Target
product; configure its property permissions to include only the newly created Airlock property.
Add the owner's user with the necessary Target role and associate the existing Server-to-Server
API credential with that profile. Creating a profile or assigning the human alone does not add
the application. Editor permits draft activity work; Approver permits activation, which still
requires the separate test-only operational approval.

The property's returned workspace list should include the new profile after configuration.
Do not automatically select one of the application's existing workspace assignments, enable
all properties, or alter other teams' profile membership.
Sources: [Target enterprise permissions and roles](https://experienceleague.adobe.com/en/docs/target/using/administer/manage-users/enterprise/properties-overview)
and [API credential/product-profile association](https://helpx.adobe.com/business/enterprise/users/users-and-groups/manage-api-credentials.html).

### Remaining initial datastream checks

- Analytics destination points only to the owner-designated Airlock suite.
- Target destination explicitly pins **Airlock - Development** and the new property token.
- Platform/AJO/Audience Manager/event-forwarding destinations are disabled for this first baseline.
- No SDK calls occur before destination settings and test activity/host targeting are approved.

The supplied `targetPageParams` snippet belongs to the at.js integration style. For this stock
Alloy/Web SDK baseline, configure the Target property token in the datastream's Target service;
do not install an at.js global just to use the property. No script, schema, service configuration,
workspace assignment or API permission was changed by this verification.

## Sources / findings

### Inspected source: compatibility gaps, not newly executed probes

Reference:
[`aem-martech` at 1aa3dee3c4791636efa9ad2994342f861c8e149b](https://github.com/adobe-rnd/aem-martech/tree/1aa3dee3c4791636efa9ad2994342f861c8e149b).
The public README and `src/index.js` were inspected on 2026-10-06; this pins the comparison
input, not an endorsement or support promise.

| Surface | Current Airlock evidence | Investigation needed |
|---|---|---|
| Events | `ALLOY_EVENTS = ["page_view"]`; `toXdm` maps URL/title to a page-view XDM. | General custom/commerce XDM, `data`, identity maps and per-event options; preserve the event's actual type. |
| Command bridge | `bootAlloy` queues `driveEvent`; it is not the page-native command function. | Documented command/options/result/events inventory; clone-safe callbacks, errors, ordering, config overrides and lifecycle. |
| Personalization | `renderDecisions:false`; `htmlOfDecision` supports HTML content in declared reserved placements. | DOM-action, JSON, redirect, scope/view and editor/preview compatibility; no unrestricted page access. |
| Reporting | `wireAlloyDecisions` emits `proposition_display` into a wildcard analytics sink; Alloy accepts only `page_view`. | Adobe-native display/interaction notifications and receipt; GA4 exposure is not Target/AJO notification. |
| Consent | Trusted seam gating/stripping and SDK delegation exist. | Product-purpose mapping, revoked/re-granted state and queued/cached identity effects. |
| Identity/egress | Scoped cookie grant, tenant pin and an interact endpoint floor exist. | Necessary SDK endpoints, cookie lifecycle, permitted syncs and safe custom edge domains. |
| Lifetime | Alloy `pushCritical` uses the queued SDK round-trip, not a true synchronous unload path. | Navigation/unload/offline/crash semantics and observable event-loss bounds. |
| Performance | Stock `aem-martech` already phases loading. | Compare phased stock versus chamber, including eager network wait, rendering, startup and clone cost. |

Code references: [Alloy connector](../../connectors/alloy/connector.js),
[decision extraction](../../connectors/alloy/decisions.js),
[EDS boot/reporting bridge](../../adapters/eds/index.js),
[wrapped-SDK trusted host](../../core/wrapped-sdk-host.js).
Existing spec 013 live results are reusable evidence, not a complete product setup.

### Official setup documentation: confirmed versus still to verify

| Resource / task | What is source-backed now | Remaining uncertainty / human dependency |
|---|---|---|
| Product access | [Developer Console](https://developer.adobe.com/developer-console/docs/guides/apis-and-services) says unavailable API services can mean missing license or permission. | Owner/admin must identify an entitled organization and grant profiles; creating a Console project is not product provisioning. |
| Authentication | [OAuth Server-to-Server](https://developer.adobe.com/developer-console/docs/guides/authentication/ServerToServerAuthentication/implementation) supports programmatic tokens; product profiles constrain access. | Determine each API's supported auth/scopes; use current OAuth, not copied legacy JWT instructions. |
| AEP sandbox | [Sandbox API](https://experienceleague.adobe.com/en/docs/experience-platform/sandbox/api/sandboxes) documents listing, lookup and development-sandbox creation. | Entitlement, quota and role not checked; do not assume a Platform product license is needed merely to use basic Web SDK. |
| XDM schemas | [Schema Registry API](https://experienceleague.adobe.com/en/docs/experience-platform/xdm/api/schemas) documents programmatic schema management. | Select field groups/identity requirements for synthetic scenarios; production/default schema mutation is not authorized. |
| Datasets | [Catalog API](https://experienceleague.adobe.com/en/docs/experience-platform/catalog/api/create-dataset) documents dataset creation from a schema ID. | Ingestion/profile enablement and product-specific data paths still need validation. |
| Datastreams | [Official overview](https://experienceleague.adobe.com/en/docs/experience-platform/datastreams/overview) documents service routing and UI management. | Supported administrative API and org permissions **not verified**; do not confuse Edge event-delivery API with datastream provisioning. Use guided UI if necessary. |
| Target | [Admin API overview](https://experienceleague.adobe.com/en/docs/target-dev/developer/api/admin-api/admin-api-overview) describes authenticated admin operations, versions and batch dependencies. | Confirm exact offer/activity/environment/property operations in current reference and permitted workspace before writing; activation requires test-only targeting/approval. |
| Analytics | [2.0 API reference](https://developer.adobe.com/analytics-apis/docs/2.0/apis/) and its [current report-suite schema](https://github.com/AdobeDocs/analytics-2.0-apis/blob/main/static/report-suites.json) document metadata reads and standard suite creation. | Creation permission, quotas/cost, approved RSID prefix/settings and product-specific test isolation are not established by listing existing suites. |
| AJO | [Current API index](https://developer.adobe.com/journey-optimizer-apis/) lists retrieval, execution, previews and selected management operations. | General web/code-based campaign creation/publishing is not established; UI/admin work may be required. AJO license and permissions are separate. |
| CJA / RTCDP | [Web SDK tutorial prerequisites](https://experienceleague.adobe.com/en/docs/platform-learn/implement-web-sdk/overview) distinguish basic Web SDK from Platform-product access. | Need product-specific schemas, connections/data views or profiles/audiences and outcome access; shared transport does not prove product behavior. |
| Validation | The same tutorial uses Adobe Debugger and Assurance. [Manual proposition rendering](https://experienceleague.adobe.com/en/docs/experience-platform/collection/use-cases/personalization/render-manual-propositions) requires display notifications. | Verify automated receipt/report/session access; interactive Assurance can supplement, not replace reproducible product outcome assertions. |

The table above records **documentation-backed capabilities**, not a provisioning guarantee.
Selected read-only successes/failures are separately recorded in Access status. Search summaries
contained stale/overbroad automation claims; only the directly checked sources above ground this note.
No current conclusion that every admin UI step has an API equivalent.

### Access request the agent will prepare, not secrets the owner must paste

- An entitled organization and owner-approved test deployment/domain.
- API/product profiles with least privilege for Data Collection, Analytics and Target; request
  AEP/AJO/CJA/RTCDP permissions only for the scenarios requiring them.
- A dedicated Analytics test suite and a restricted Target test environment/workspace/property.
  AEP sandbox scoping does not substitute for these product-specific isolation controls.
- OAuth application credentials supplied through an approved local environment or secret manager,
  never pasted into chat output or a committed config. A credential attachment was inspected locally
  during the read-only check; the long-running execution host and approved durable credential source
  still need to be established.

## Investigation sequence and stop conditions

1. **Offline inventory.** Pin SDK version/hash and reference commit; enumerate public SDK and
   `aem-martech` surfaces, classify commands/dependencies and draft a stock-versus-chamber scenario matrix.
   Use local stubs to test bridge mechanics, clearly labeled as not live product proof.
2. **Read-only access discovery.** With approved credentials, verify allowed org/product/resource
   access and current API operations. Produce a redacted capability report and the exact admin actions
   still needed. Stop on missing entitlement; do not silently change the org or production resource.
3. **Plan/apply setup.** Propose resource names/IDs, target scope, side effects and quota/cost before
   mutation. Reuse owned fixtures; make provisioners idempotent. Persist identifiers in local-only
   state and sanitize output. Product publication/paid provisioning requires explicit approval.
4. **One live vertical proof.** On isolated stock and Airlock arms, send a synthetic page/custom
   event, receive an Analytics outcome, fetch a Target HTML offer, render safely and record the
   Adobe-native display notification. Verify count/identity/routing and negative consent cases.
   No uncontrolled dual-send to customer production properties.
5. **Feasibility checkpoint.** Return the evidence matrix, blocked/incompatible commands, measured
   baseline/noise and proposed numeric budgets; name the next vertical build slices. The owner
   approves any revision from the full-compatibility ambition before a narrower release gate is used.

Provisioning/probe scripts belong under `probes/` with a bounded investigation spec before execution.
[Spec 051](../specs/051-adobe-integration-proving-ground/spec.md) now carries those DRAFT contracts:
read-only preflight, stock test baseline and a bounded compatibility spike. Its plan/tasks are pending,
and the proposed time-box needs approval before readiness. Specs 052-057 are unsliced outlines.
This note remains OPEN. The supplied credential was not created here; selected reads are verified
and the owner-authorized dedicated Target environment exists. The owner-created Analytics suite and
reference EDS site, Target property and ExperienceEvent schema are verified. Target workspace
assignment, datastream destination verification, the tested preflight utility and the stock/live
comparison remain pending, not completed by these setup checks.

## Options / pros & cons

- **Stock SDK in the chamber + safe host bridges:** best fidelity and update story; DOM commands,
  callbacks and page state need explicit mediation.
- **Hybrid SDK modules on the page:** may preserve DOM/editor behavior; weakens the performance/
  isolation scope and must be measured and named, not smuggled in as full off-thread support.
- **Direct Edge/server-side APIs:** potentially useful for specific data-only scenarios; do not
  establish stock Alloy compatibility or replace required browser/identity/rendering behavior.

## Open questions

- Can we obtain test access without depending on a customer's production setup?
- Which exact SDK version/API inventory is the release contract, and what browser cohort is supported?
- Does the Launch self-hosted instance/event contract survive a command bridge without DOM escape?
- Can complete Analytics/Target/AJO display/interaction and CJA/RTCDP outcomes be inspected reproducibly?
- Which setup steps require UI, and what minimal guided actions remain after API automation?
- Do official vendor server-side integrations reduce the later third-party replacement burden?
- What retention, revocation, SDK update/support and end-of-page delivery guarantees are acceptable?

## Conclusion

**Open.** The Adobe-first route is worth investigating, not proven compatible. Start with the
offline inventory and read-only access preflight; broad implementation waits for their evidence.

Promoted to: release direction in [ADR-0031](../decisions/adr-0031-reframe-onto-adobe-first-compatibility.md)
and [Adobe Compatibility & Adoption](../releases/adobe-compatibility.md), with execution scoped by
[spec 051](../specs/051-adobe-integration-proving-ground/spec.md); investigation remains OPEN.
