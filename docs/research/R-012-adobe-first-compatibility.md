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
> Target workspace assignment and credential association were subsequently verified for reads.
> Analytics report queries and selected AEP/AJO effective permissions are now verified.
> Scoped Target creation, editing and a future-only approval/restoration check pass; the latest
> owner-permitted activity is API-approved with its bounded serving window ended.
> Initial Analytics/Target routing is verified through owner-provided UI evidence,
> exact selector checks and the owner's saved development-environment pin confirmation.
> Programmatic datastream management remains unavailable to this application/tool surface.
> A real deployed stock smoke now qualified/rendered the owned offer and submitted native
> display/interaction plus page/custom events. The new headed page/custom each have one ordinary
> Analytics receipt; a native seven-day Target export shows two cumulative Scoped display counts,
> with the approved Development environment owner-confirmed; per-run attribution remains unverified. The full baseline/chamber/product
> portfolio is not complete. The release is committed in direction.

**Current acceptance authority — owner decision 2026-10-12T21:08:41.261Z:**
[ADR-0032](../decisions/adr-0032-airlock-boundary-acceptance.md) requires actual
stock/chamber serialized wire, governed egress and real result/response/rendering behavior.
Further Adobe ingestion/report counters/attribution are a nonblocking
[follow-up goal](../releases/adobe-reporting-follow-up.md) under 056.
All dated reporting uncertainty and measurements below remain true at their stated scope;
their missing counters/operator availability are no longer implementation/release blockers.
Actual protocol errors, unsafe/blocked required behavior and malformed dispatch still block.
This changes no SDK, resource, privilege or release-publication authority.

## Question

Can the stock Alloy.js SDK support the pinned `aem-martech` integration and Adobe Web SDK-connected
product workflows through Airlock without losing functionality or weakening the boundary? What can
we provision and validate through supported admin APIs while the owner establishes dedicated
Target/Analytics resources with limited product-setup experience?

## Access status

### 051-01 CLI validation: hermetic and real unverified result

The versioned preflight utility is implemented and validated with 278 hermetic tests using
synthetic private files and an injected test transport/clock; all 36 unchanged contract-stability
tests also pass. The implementation agent performed no live/private-state operations.
The orchestrator subsequently ran the real approved-input CLI: exit 1 after 12 bounded requests,
with 11 required checks ready and `target.workspace_snapshot` unverified. One non-selected
property omits optional workspace metadata; no empty assignment is inferred.
The [executed-result section](#executed-preflight-result-and-remaining-workspace-evidence--2026-10-08)
records the precise Admin Console confirmation needed. Owner confirmation is unavailable and
051-02 remains blocked. No SDK traffic, deployment or provisioning ran. Independent implementation
and reconciliation reviews separately passed; 051-01 utility is DONE, not a ready stock baseline.

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

## Target workspace assignment — verified 2026-10-08

After the owner reported completing workspace setup, fresh OAuth authentication and read-only
metadata checks established:

- The selected Airlock web property's exact ID returns HTTP 200 and has **one workspace assignment**.
- That workspace ID appears in the API credential's fresh IMS product context for the same
  organization and Target tenant. Property assignment and application profile association are
  both observed; this is not inferred from the human user's permissions.
- The accessible property collection reports a complete snapshot. Only the selected
  Airlock property is assigned to this workspace in that snapshot. The product-context display
  label was not used to infer that the profile is named Airlock.

This clears the missing workspace-assignment/credential-association checkpoint **for reads**.
It does not establish an exclusive application-wide permission boundary: the integration's other
product-profile grants were not removed, hidden access was not audited, and activity creation,
editing, approval or activation rights were not exercised.

Exact workspace selectors and these verification flags are retained in the private `0600`
resource manifest. No OAuth token or property routing-token value was persisted, no permission
assignment was changed, and no activity or test event was created.

**Remaining initial setup checks:** verify the dedicated datastream's Analytics suite and Target
environment/property destinations, with Platform/AJO/event-forwarding ingestion disabled for the
initial baseline. Test-only activity operations still need scoped authorization and executable
verification. The stock baseline and spec 051 readiness/review gates remain outstanding.

## Autonomous-run access/readiness validation — 2026-10-08

The owner requested the remaining access checks before an autonomous 051-057 run.
Fresh OAuth tokens stayed in memory. All product checks were non-mutating: the two POST
operations were an Analytics report query and the documented AEP effective-permission query,
not event submission or permission updates. No Adobe resources, activities, site content,
datastream routing or product-profile assignments were changed.

| Check | Observed result | Readiness boundary |
|---|---|---|
| Dedicated Analytics suite summary report | HTTP 200 on the reporting POST; requested only a bounded aggregate | Reporting access is verified; synthetic-event receipt, latency and stock/chamber parity are not. Counts were withheld. |
| AEP permission reference and effective policies | HTTP 200 in the discovered development context; schema/dataset/segment management, campaign/journey management and publication/reporting permissions are advertised | Stronger than collection reads, but not exercised creation/publication or approval to mutate that context. No isolated later-product fixtures are selected yet. |
| Datastream-context effective policies | HTTP 200 in the owner-selected datastream/schema context; View Datastreams, Manage Datastreams and resource read/write policies returned | Additional datastream role assignment is not the demonstrated blocker. This is a policy query, not a successful datastream configuration request. |
| Exact owner-selected datastream configuration | HTTP 403, `EXEG-3036-403`; error category refers to API-key/subscription acceptance | The owner's application key is rejected by this configuration service. Analytics/Target destinations and disabled services cannot yet be verified; successful Schema Registry reads do not prove routing. |
| AJO campaign, CJA connection and RTCDP-related segment-definition reads | HTTP 200 on each bounded read | Product-specific metadata access, not delivery, CJA reporting, full RTCDP licensing/activation or selected isolated scenario resources. |
| Target property/workspace credential association | Fresh property and IMS-context reads HTTP 200; workspace still matches | No explicit Approver/Editor role enum was exposed. Activity create/edit/approve/activate authority remains unexercised; no validation-only creation endpoint was found in the checked official reference. |
| EDS site status | HTTP 200; preview/live/code read/write advertised | Earlier GitHub push/admin metadata remains recorded. Actual repository/preview/publish writes, DA authoring and necessary site-configuration administration remain unexercised; the configuration read previously returned 403. |
| Owner ExperienceEvent schema, resolved fields | HTTP 200 with the documented expanded-schema Accept header | Base `_id`, timestamp, event type and identity-map fields exist; `web`, `commerce`, `productListItems` and `_experience` field families are absent. Schema existence is not scenario-ready field coverage. |

Playwright, Vitest and esbuild resolve locally; headless Chromium successfully launched and
closed on a synthetic in-memory page. This establishes local execution-tool availability,
not reference-site instrumentation or authenticated access to Adobe's management UI.

### Datastream blocker and safe alternatives

The read path was established from Adobe's public Alloy extension source, rather than guessed:
[`fetchConfig.js`](https://github.com/adobe/alloy/blob/af22d05072ee8141645ad6dfc9a604b3a0a316a6/packages/reactor-extension/src/view/configuration/utils/fetchConfig.js),
[`fetchFromEdge.js`](https://github.com/adobe/alloy/blob/af22d05072ee8141645ad6dfc9a604b3a0a316a6/packages/reactor-extension/src/view/utils/fetchFromEdge.js)
and its
[`request headers`](https://github.com/adobe/alloy/blob/af22d05072ee8141645ad6dfc9a604b3a0a316a6/packages/reactor-extension/src/view/utils/getBaseRequestHeaders.js).
It uses `GET /metadata/namespaces/edge/datasets/datastreams/records/{datastreamId}`.
Public UI source does not establish a supported Server-to-Server administration contract.
Only the owner's application key was used; Adobe's UI application identity was not substituted
to get around the rejection, and no internal write route or diagnostic Edge event was attempted.

The browser side panel opened the owner's datastream URL but displayed **Sign in**, not service
settings. A request for owner sign-in/screenshots could not be answered because the owner was
unavailable. No login, user-token substitution or authorization bypass was attempted.
Safe next evidence is an owner-authenticated configuration inspection, supplied service-settings
screenshots, or confirmation of a supported configuration API accepting the owner's application.
The initial routing contract remains: dedicated Analytics suite and explicit Airlock Target
environment/property, with Platform/AJO/Audience Manager/event forwarding disabled.

The [effective-policy API](https://experienceleague.adobe.com/en/docs/experience-platform/access-control/api/effective-policies)
queries permissions discovered through the
[reference API](https://experienceleague.adobe.com/en/docs/experience-platform/access-control/api/permissions-and-resource-types).
Advertised delete/reset rights are not owner authorization: the autonomous resource allowlist
must still prevent shared-resource changes and sandbox resets. Expanded schema inspection used
the [documented Schema Registry lookup format](https://experienceleague.adobe.com/en/docs/experience-platform/xdm/api/schemas).
Later mapped web/commerce/personalization ingestion needs deliberate field-group selection;
missing field families alone do not prove the initial Analytics/Target-only path fails with
Platform ingestion disabled. No event was sent to test that hypothesis.

**Assessment at the read-only checkpoint:** credentials and local tools support continued read-only preparation and local
work, but uninterrupted live qualification is **not yet established**. Routing inspection,
scoped Target/site write checks and isolated later-product fixtures remain open. The proposed
051-03 eight-active-hour budget, whole-run ceiling, autonomous refinement/checkpoint delegation
and test publication/release authority still require owner decisions. These checks neither
start `/goal` nor advance any DRAFT spec or satisfy 051-01's reviewed preflight acceptance criteria.
A redacted outcome is recorded here; exact selectors and the bounded permission snapshot remain
in private `0600` session state with no credentials or OAuth tokens.

## Focused Alloy/Target/Analytics follow-up — 2026-10-08

The owner explicitly authorized Target write checks, confirmed the datastream is open in the
embedded browser, and deferred AJO/CJA/RTCDP work **for now**. This narrows the immediate proving
ground to Alloy, Target and Analytics; it does not remove later product requirements from
ADR-0031 or the broader release portfolio, approve `/goal`, or advance the DRAFT specs.

### Target write authorization — exercised, not inferred

The [official Target API schema](https://github.com/AdobeDocs/target-developers/blob/main/src/admin-api.json)
was inspected before mutation. Fresh OAuth authentication reverified the exact property workspace
and its association with the credential. Only new Airlock-owned fixtures were created or edited:

| Operation | Observed result |
|---|---|
| Create a harmless HTML content offer in the exact workspace | HTTP 201 |
| Read, rename and re-read that offer | HTTP 200 on each; workspace/content/name assertions pass |
| Create/read a distinct comparison offer in the same workspace | HTTP 201 / 200 |
| Create a saved A/B activity referencing these offers and the exact Airlock property | HTTP 201 |
| Read, rename and re-read the activity | HTTP 200 on each; saved state, workspace, property and custom decision-scope assertions pass |

The activity remains **saved/inactive**, with future dates and a dedicated custom mbox scope.
No approval/activation, global-mbox delivery, host moves, environment/default changes,
customer-resource edits, SDK requests or events occurred. The two offers and inactive activity
are retained as owned fixtures for a later isolated proof, not deleted or claimed as live evidence.
Exact IDs, request receipts and the owner authorization are private `0600` state.

Initial HTTP 400 responses were **payload validation**, not a failed authorization check.
The checked schema omitted constraints that the server enforces: custom `metricLocalId` values
must exceed 2; A/B options must reference distinct offers; `applicationContext` is invalid
without views. Those exact server-reported errors were corrected, reusing the first offer
rather than duplicating it. The subsequent create/edit/readback succeeded. Generic web-search
examples with string metric IDs or undocumented metric fields were not used.

This establishes actual content-offer and activity creation/editing access in the selected
workspace/property. It does not prove activity activation, Alloy delivery/rendering, Adobe-native
notifications, Analytics receipt or a stock-versus-chamber comparison.

### Datastream UI and deployment observations

The owner's browser is now **authenticated** and on the selected datastream. The native
`read_page` and JavaScript actions expose the Experience Cloud shell only: the configuration
application is a cross-origin iframe. The screenshot action returned a confirmation but no
agent-readable image/file; no image artifact was available in this session's attachment/state
areas. No authorized iframe-aware debugger was advertised by this tool process's app ancestry.
No browser profiles, cookies, user access tokens or unrelated browsers were inspected.
The settings screenshot/text request could not be answered while the owner was unavailable.

This is now a **browser-tool visibility limitation**, not a request for the owner to sign in again.
The owner-key configuration API rejection remains separately recorded. The dedicated Analytics
suite and Target environment/property pins, plus disabled non-target services, are still unread.
No routing values were guessed and no Edge event was sent to discover the destinations.

An authenticated Git push **dry run** to the exact reference repository succeeded; the probe
branch was absent before and after. No commit/ref was written, and the temporary bare checkout
was removed. This is stronger than viewer-permission metadata but does not exercise branch
protection, actual code deployment, EDS publication or DA authoring.

**At the pre-screenshot checkpoint:** Analytics reporting and scoped Target creation/editing
are verified. Routing inspection remains the immediate prerequisite to safe Alloy test traffic;
Target activation and deployment/live outcomes remain separate checks. AJO/CJA/RTCDP fixture
work is deferred by the owner and is not a blocker for this initial proving ground.

## Initial routing and approval checks — 2026-10-08

The owner supplied three configuration screenshots after the browser-tool limitation was reported:

- The selected datastream's overview lists **only Analytics and Target**, both enabled; no
  Platform, AJO, Audience Manager or event-forwarding service is listed.
- Analytics has **one report suite**, exactly matching the approved dedicated suite.
- The Target property token matches the owned property's live API value. On-device OCR and
  hash comparison established this without printing or persisting the token or recognized text.
  Initial OCR passes did not recognize a valid UUID; this was not treated as a token mismatch.
  UUID-constrained glyph recognition subsequently matched the API hash from both the full image
  and a token-field crop, without guessing valid hex digits.
- The first screenshot showed **Target Environment ID empty**. A fresh exact environment read
  confirmed the Airlock development environment is non-default and active-only. The owner
  confirmed its ID, was instructed to enter it and Save, and then acknowledged completion.

Initial routing is therefore verified through **owner UI evidence and saved-setting confirmation**,
not misrepresented as a successful configuration API readback. Exact selectors and screenshot
hashes remain private. The managed fixture can be used for the initial Analytics/Target proof;
later routing changes need fresh verification. No datastream setting was changed by the agent.

### Approval permission, without current live delivery

The owner-authorized Target write check was extended to the activity state endpoint. Before any
state change, the exact owned workspace/property/custom scope and a start date **more than 300 days
in the future**, with a bounded end date, were asserted from a fresh activity read. Approval then
returned HTTP 200; readback confirmed approved state and unchanged future dates. The activity
could not serve current traffic under that schedule.

The activity was immediately restored to **saved/inactive**, and exact scoped readback returned
HTTP 200. This proves approval/state-change permission as well as the earlier creation/editing
checks, without activating a currently live activity. No SDK request, test event, host/default
change or customer-resource operation occurred.

The reference repository's default branch is unprotected and its branch-rules read returned an
empty list. Together with the successful authenticated push dry run and advertised EDS rights,
no access-policy blocker was identified for the baseline deployment path. Actual deployment,
DA authoring, any necessary site-administration changes and live product outcomes remain
implementation/validation work, not retroactively claimed by these access checks.

**Historical pre-launch assessment (superseded by the executed preflight below):**
access and initial setup were assessed as sufficient to begin the scoped
**Alloy/Target/Analytics proving ground on this local host**. The stock/chamber live proof has not
run; runtime remains v0.8.0, all seven specs remain DRAFT, and `/goal` has not started. AJO/CJA/RTCDP
are deferred for the immediate focus, not declared complete or removed from the release gate.
The reviewed Jig execution plan, spike/whole-run budget, durable execution-host credential setup
and publication/release authority remain separate launch decisions.

The [portable clean-session goal brief](../releases/adobe-compatibility-goal.md) preserves the
scope, bootstrap, review and safety contract in Git. Private fixture state, credential handles
and raw captures are supplied separately at launch; the brief contains neither machine-specific
paths nor live values. Its presence alone does not start a run, approve a budget or change the gate.

## Goal execution launch — 2026-10-08

The owner invoked the local execution grant, then explicitly approved proceeding below **10,000
AI credits overall**. No overall elapsed-time limit was requested. The separate 051-03 allowance
remains **eight active engineering hours**, excluding external access/report waiting; that spike
has not started. Routine framing and proceed decisions remain delegated after independent reviews.
Production publication, resource deletion, release cuts, safety weakening and stable-core breaks
remain outside the grant.

The session checkout now includes verification commit `cbae9a5`; the original private evidence
snapshots were copied into isolated `0600` run state without copying credentials. Original
snapshots remain unchanged. Spec 051-01's versioned input/report, managed-routing evidence and
read-only operation contract received an independent frame-critique **pass**. This is a contract
review, not implementation, acceptance of the preflight utility or a ready live baseline.
The three authored 051 slices and unsliced 052-057 portfolio still require their applicable
lifecycle gates; no product outcome or deployment is inferred from this launch.

### Executed stock-artifact provenance check

The pinned `aem-martech` reference declares **Alloy 2.31.1** and **ACDL 3.0.1** in its README.
Its `src/alloy.min.js` has git blob `465adc543ae11c7cfa78b0811f30652f32b27c31`,
152,335 bytes and SHA-256
`e77362b59c6124f1ab14621fcf508f482ac4b25da49902a731677eea72ec4251`.
The [official versioned Alloy 2.31.1 artifact](https://cdn1.adoberesources.net/alloy/2.31.1/alloy.min.js)
has 152,336 bytes and SHA-256
`7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8`.
An executed byte comparison established the entire difference: the reference file omits the
official artifact's single trailing LF byte. The files are **not byte-identical**.
Use the exact unmodified official artifact consistently when refining the future test arms;
the historic Airlock 2.35.0 pin is not automatically this run's stock target.
No SDK was executed by this provenance check.

A credential-free, redirect-refusing read of the exact approved EDS root status returned HTTP 200.
Its root `webPath`, preview status and exact approved preview URL matched the proposed preflight
read contract. This grounds public metadata readability only: no authenticated deployment,
site mutation, SDK event or Adobe product receipt was exercised.

The original saved-pin acknowledgment was located in the prior session's history. Its actual
timestamp follows the screenshot snapshot's initial assessment timestamp; normalization must
retain both source records and distinguish a combined assessment's completion from the original
snapshot. It must not invent a new observation or renew the screenshots' freshness.

### Executed preflight result and remaining workspace evidence — 2026-10-08

The versioned 051-01 CLI is implemented with witnessed red-to-green tests. The current targeted
suite contains 278 preflight cases plus 36 unchanged frozen-core cases, all passing.
Independent compliance identified additional refusal/bounds/failure-disposition defects; those
were corrected with failing regressions first. Required implementation review and reconciliation
remain separate lifecycle gates.

The first approved-input attempt stopped at **exit 2 with zero requests**. It exposed two local
format mismatches rather than missing Adobe access: valid six-digit UTC RFC3339 observations and
periods in the unchanged owned decision scope. Timestamp parsing was corrected without rewriting
source evidence; an independently approved scope-specific grammar correction retained exact
bindings, literal activity matching and all endpoint/safety exclusions.

The corrected real CLI made **12 bounded requests** and returned **exit 1 / overall unverified**:
**11 required checks ready, one required check unverified**, with four unchanged optional
diagnostics unverified. Authentication, the selected Analytics org/suite/report query, exact
owned Target environment/property/activity/offers, accepted owner-based routing and site
readability all passed. No raw report totals, identifiers, credentials or tokens are recorded here.
HTTP/report-query success remains distinct from synthetic event receipt.

`target.workspace_snapshot` lacked complete association evidence. A bounded diagnostic of that
same documented collection found one non-selected property's `workspaces` field omitted.
The inspected official schema makes `Property.workspaces` optional and supplies no default;
there are no workspace paths or collection query filters in that schema. Omission is **unknown**,
not proof of no association. The required check remains unverified; no missing array was guessed,
no criterion made optional and no unsupported endpoint or browser token used.

The owner was asked to inspect the exact Airlock Target product profile's property permissions
in Admin Console and confirm only the dedicated Airlock property. The owner was unavailable.
Any accepted owner-evidence alternative requires explicit contract review and implementation,
not a force-ready flag or a claim that the API supplied the missing information.
No other property/profile edit is authorized to manufacture a passing snapshot.

The utility can report this blocker honestly, but **051-02 has no ready real preparation report**.
No stock/chamber SDK journey, activity activation, deployment or product receipt was attempted.
Fresh reads still confirm the owned activity saved/inactive with its future schedule.
The broader release gate and AJO/CJA/RTCDP deferrals remain unchanged.

### Scoped owner profile confirmation — 2026-10-09

The owner supplied an Admin Console screenshot and explicitly confirmed that only the dedicated
Airlock property is included in the selected Airlock Target product profile. The view contains
one included property, three other available/excluded properties and no automatic assignment rule.
The screenshot's digest and exact pre-existing selector bindings are retained only in private
`0600` evidence; no image, live IDs or credentials are committed.

This supplies the previously missing **profile property-permission** fact. It does not identify
Target delivery environments, prove exclusive application-wide credential grants, renew old
datastream routing evidence or authorize editing the other properties. In particular, the
excluded property labels are not evidence of Analytics or Target environment routing.

New [051-04](../specs/051-adobe-integration-proving-ground/slice-04-workspace-confirmation.md)
introduces the explicit versioned evidence path, preserving closed 051-01 and its real exit-1
history. Its independent frame review passed. Implementation and subsequent independent reviews
must preserve strict fresh selected-property checks, complete collection validation and API
conflict precedence; missing data is still not an empty assignment. The real preflight must rerun
before claiming readiness. No stock/chamber event, activation, deployment or product outcome is
established by the screenshot or this note.

### Workspace-confirmation preflight rerun — 2026-10-09

The new versioned operator path passed independent frame, implementation-compliance, craft and
architecture reviews. Witnessed TDD added 141 cases; all 455 targeted cases, including the existing
preflight and frozen-core tests, pass. Closed 051-01 and its original report remain unchanged.
Independent reconciliation subsequently passed and 051-04 is DONE.

The parent ran the real CLI with the exact private screenshot confirmation, existing credential
handle and unchanged original selection/routing observation times. Schema-v2 preflight returned
**exit 0 / ready**, with **12 required checks ready, four optional checks unverified and 12 requests**.
The workspace row explicitly uses `owner_ui_confirmation`, null HTTP status and accepted-owner
freshness; no absent API assignment was invented or called an API readback.
Fresh selected Target/Analytics resources, report-query access and site readability also passed.

This clears the initial-preparation report prerequisite only. Actual site deployment, the
reviewed stock fixture plan/schedule/targeting, notification/report observation and SDK product
outcomes remain separate 051-02 gates. No activity activation, SDK event, deployment or product
receipt has run. The owned activity remains saved with its future schedule.

A subsequent nonmutating access check re-read the exact owned activity/workspace/property and
saved state, then called the documented native A/B performance-report GET with its v1 media type.
It returned HTTP 200 and a JSON object without an error envelope. No query filters, alternate
workspace, traffic or mutation were used. This establishes report access, **not** display/
interaction receipt semantics, event correlation or live product outcomes. Those reporting
contracts still need verification before the stock plan can authorize traffic.

The pinned official schema's `AbstractActivityPerformanceReport` documents `reportParameters`
and `activity` metadata, including metric identifiers, but no numeric display/interaction
outcome fields or Web SDK notification-to-goal mapping. This is a documentation/evidence gap,
not proof that the accessible API can never supply numeric results. Delivery API notification
acknowledgments belong to another integration contract and are not substituted for Alloy proof.

The owner was asked for the dedicated inactive activity's native Reports metric/download view,
as a read-only next observation step; the owner was unavailable. Manual exports are optional,
not a proven exclusive route. The stock DRAFT retains `required_stop: target_report_contract`
until supported receipt/count semantics are bound to activity, experience, environment and
finite observation windows. No HTTP 200, qualification request or client display assertion
is accepted as downstream product receipt. Stock implementation/traffic remains stopped at this
required observation contract; the preparation/workspace gate itself is resolved.

### Native report view and notification-metric grounding — 2026-10-09

The owner supplied the inactive owned activity's Reports screenshot. It shows the native
`Scoped display` metric, Visitors, two experience rows, zero current display values, a metric
selector and download/settings controls. Screenshot provenance is private. The image establishes
view availability, not successful CSV export, a selected development-environment filter, or
processed test notifications; no SDK traffic has run.

A fresh exact owned activity read corroborated the displayed goal's definition: it is a conversion
metric, `count_once`, with one `mbox_shown` trigger bound to the approved custom scope and no
click selectors. There is currently **one goal**, not a proven display-and-interaction pair.
No activity setting or schedule was changed.

Direct official-source inspection now grounds the previously unresolved submission-to-goal
relationship:

- [Target/Web SDK overview, Display mbox conversion metrics](https://experienceleague.adobe.com/en/docs/target-dev/developer/client-side/aep/target-overview#display-mbox-conversion-metrics):
  a `decisioning.propositionDisplay` XDM event with the scope records the associated Target
  success metric; this is separate from qualification.
- [Adobe's at.js-to-Web SDK Track events guide](https://experienceleague.adobe.com/en/docs/platform-learn/migrate-target-to-websdk/track-events):
  `decisioning.propositionInteract` replaces click notifications for an mbox location, and
  returned `{id,scope,scopeDetails}` identify the proposition. DISPLAY signals rendering;
  INTERACT signals an actual interaction.
- [Success metrics](https://experienceleague.adobe.com/en/docs/target/using/activities/success-metrics/success-metrics):
  goal count/deduplication settings are explicit; once per entrant differs from every impression.
- [Manual display events](https://experienceleague.adobe.com/en/docs/experience-platform/collection/use-cases/personalization/display-events):
  `applyPropositions` does not send display events automatically; send only after actual rendering
  and retain `scopeDetails`.

Search summaries were not treated as source evidence. These directly fetched sections ground
the mechanism, not a newly observed downstream outcome. 051-02 can now refine this mapping
without guessing from the `Scoped display` label. A reviewed plan must explicitly add/reuse the
owned interaction goal and preserve restore behavior before activation; the owner need not
change it manually. The actual export columns, environment/window binding and finite count
observation contract still need verification. The visible download icon is not an exported file.
The next owner input is the native CSV download from this inactive report; no activation or
settings change is required to obtain an empty schema sample.

### Native CSV structure and report-environment check — 2026-10-09

The owner supplied the original native CSV download. Its immutable bytes and digest remain in
private `0600` state. It contains six CSV records: an activity/two-experience label, blank lines,
download date and `US/Pacific` timezone, `Conversion Counter: undefined`, and one header row.
There are **no experience data rows**. Absence of rows is not zero conversions or a completed
negative control; the undefined counter is not a usable counting-method assertion.

The header is `Experience`, `Experience Description`, `Segment`, `Visitor`, `Scoped display`,
`Conversions`, `Total Sales`, `Sum of Sales Squared`, `Mean Conversion Time`,
`Sum of Conversion Time Squared`, `Engagement`, `Sum of Engagement Time Squared`.
This establishes the actual empty-export layout, not the populated values' types/count units
or whether the selected metric column and `Conversions` are equivalent. No per-event marker,
environment selector or report start/end dates occur in these records. The filename's timezone
and download date do not establish the report's traffic window.

A fresh exact owned activity/saved-state check and the documented unfiltered performance-report
GET established that its `reportParameters.activityId` and conversion metric selector match the
owned fixture, but its **default environment parameter does not match the approved development
environment**. The response contains activity/report metadata and empty statistics; additive live
fields were inspected as structure only, not guessed into documented count semantics.
This API request is not assumed to reproduce the owner's UI selection or CSV.
No undocumented query parameter, datastream setting or report preset was changed.

The next read-only owner check is the gear's Report Settings view: establish the environment
and counting methodology selected in the UI. Reporting must use the same approved development
environment as the datastream. There is no need to activate the activity or reset data, and
the owner should not save/change a shared default preset. Stock traffic remains stopped until
the observation plan binds environment, interval and counting semantics; the CSV resolved
header discovery, not all of those gates.

### Native report settings confirmed — 2026-10-09

The owner's four settings screenshots explicitly show the current report filter as
**Production**, counting methodology **Visitors**, and the first owned experience as control.
The environment menu includes the exact owned **Airlock - Development** option; counting choices
are Visits, Visitors and Activity Impressions. Original screenshot digests and selector bindings
remain private. This resolves discovery of the selected UI settings and available choices.

The current report environment does not match the approved development datastream pin.
This is a **report-view mismatch**, not evidence of Production delivery or permission to change
datastream routing. No filter save, resource mutation, SDK event or activation is observed.
The current visitor-based export is historical; do not relabel it as development/impression data.

For the planned stock observation, select the report-only environment **Airlock - Development**
and **Activity Impressions**, keeping the owned control and report date range explicit. Applying
the report Settings dialog is distinct from activating/editing the activity or creating/saving
a shared default preset. Do not reset report data. Capture the applied report context privately
alongside its new native CSV. Goal conversion counts still use the actual configured count-once
semantics; Activity Impressions is not interchangeable with conversions or DOM displays.
Until the applied context is observed, this reporting prerequisite remains unverified.

### Applied development report context received — 2026-10-09

The owner applied the requested report-only settings and supplied a new screenshot/CSV with
explicit “Done” confirmation. The view now shows **Airlock - Development / Activity Impressions**
and the unchanged owned control. Original and new artifacts remain separate private evidence.
The new header uses **Impression**, replacing the prior **Visitor** column; it is still a
header-only export with no experience rows and an undefined conversion-counter metadata field.
The changed denominator corroborates the counting-view change, not processed events.

This resolves the UI report-environment/counting-selection prerequisite without activating the
activity, changing datastream routing or saving a shared preset. The screenshot panel/CSV do
not contain report date bounds; the plan must bind its chosen observation interval explicitly
at execution. Missing rows remain unknown, not fabricated zeros.

Read-only stock preparation additionally inspected the exact owned saved activity:
its sole custom-scope location and both experiences have empty audience-ID lists, and the
returned activity has no inline rule/targeting fields. That establishes the **current response
shape**, not a claim that the UI cannot author an activity-local targeting definition.
The required server-side domain/path/marker restriction is not yet verified; do not substitute
client-side opt-in or a public custom scope for that restriction.

The authorized reference repository is readable through GitHub and contains an actual phased
`scripts/scripts.js` bootstrap: eager, lazy, then delayed. It has no existing `tools/` page in
the inspected complete tree. A conditional stock hook on the existing reference page is a
candidate avoiding unverified code-served HTML/DA behavior, not a deployed change.
Ordinary visitors must retain the original SDK-free behavior; any bootstrap change and its
exact restoration need review before deployment.

The current DRAFT's five three-hour stage anchors span 13 hours, beyond roughly four hours
remaining on the preserved selection/routing evidence at inspection. The new report screenshot
does not renew those older observations. These execution-contract assumptions are under
independent frame review before implementation/live apply; no activation or SDK event occurred.

### Targeting and editor warnings corroborated — 2026-10-09

The owner's Targeting screenshot shows **All Visitors**, 100% traffic allocation and equal
experience allocation. No test-site domain/path/marker restriction is visible. A fresh exact
owned activity read corroborates empty audience-ID lists on the custom location and both
experiences. The activity is still saved/inactive with its original future schedule.
This confirms the delivery gate is not yet restricted; profile/property isolation is not
a substitute for restricting activity qualification to the reference test site.

The supplied Goals & Settings screenshots show unselected required choices for the primary
goal and additional Scoped display goal, validation warnings and disabled Save & Close.
The current API still returns one scope-bound display conversion with count-once semantics
and no click selectors. Neither the cause of the editor/API discrepancy nor a safe UI save/
round-trip has been established. Do not claim the saved goal disappeared or repair the form
by guessing options. No settings were saved or changed by the agent.

The next supported read-only step is to open the **All Visitors** card and inspect the audience
panel, including any Edit/Create controls, without saving or creating an audience. This is
needed to identify an owned, reversible domain/path/marker rule flow. The owner was unavailable
when that follow-up was requested. Any separate audience resource requires its exact authority/
ownership plan; no shared audience is borrowed and no undocumented rule JSON is invented.

The stock DRAFT now separates parent-controlled no-traffic preparation from activation, uses
the verified root-page opt-in seam as a proposed alternative to unverified standalone HTML,
and binds each stage to actual evidence expiry rather than a fixed 14-hour unattended run.
Those are DRAFT corrections, not implementation or a passing frame verdict. The existing
frame evidence remains needs-changes until the applicable contract review clears.
At the fresh editor check, original selection/routing evidence had roughly 30/40 minutes left;
the new editor screenshots do not renew either. Stock activation, deployment and SDK traffic
remain unexecuted.

### Owner simplifies dedicated-site eligibility — 2026-10-09

The owner explicitly relaxed the additional request/URL/test-marker eligibility requirement
because this is a dedicated test site with isolated product fixtures, then reported configuring
a Page Delivery rule anyway. Treat that as a scoped execution decision: no additional audience
or eligibility marker is needed for this run, and no more targeting-panel screenshots are
requested to establish the retired rule requirement.

Preserve the owner's Page Delivery change. A fresh exact owned activity read confirms saved/
inactive state, original future schedule, custom scope and owned offer links still present.
The response does not expose the configured Page Delivery rule; neither its semantics nor
its preservation through a proposed whole-activity update is claimed verified. Base any later
reviewed mutation/restoration on current owner-edited state, not historical snapshots.

The unchanged boundaries are exact dedicated Analytics suite, Target property/workspace/
development routing, approved reference-site synthetic traffic, scoped known activity/offers,
consent, endpoint controls, bounded activation and inactive restoration. No customer/default
resource edits, Platform ingestion, broad runtime authority or changed release gate are authorized.
Run/event labels remain useful receipt correlation, not customer identity or mandatory eligibility.

The no-offer control can use the same owned scope while the exact activity deliberately remains
saved/inactive in the active-only test environment. It must send the declared stimulus and
observe actual absence, not silently omit an action; positive observation sensitivity remains
mandatory. No extra marker rule or unapproved audience is needed to create that control.
The revised execution frame requires review, and old source observations still cannot be renewed
by this flexibility decision. No activity state, Page Delivery setting, goal or routing was changed
by the agent and no SDK traffic was sent.

Independent re-review passed the simplified frame against the original eight ACs. 051-02 is
READY_FOR_REVIEW, not implemented or live-ready. Extra eligibility/targeting authoring is no
longer a blocker; a current owner-edit-preserving resource plan, source freshness, deployment
and downstream observation gates still require their actual evidence. Existing Page Delivery,
scope, metrics and inactive future schedule were not changed by the agent.

### Stock Analytics observation prechecks — 2026-10-09

Read-only calls against the exact approved suite returned its page/custom-link dimensions
(`variables/page`, `variables/customlink`) and pageview/occurrence metrics
(`metrics/pageviews`, `metrics/occurrences`), uniquely present and explicitly reportable.
The current suite timezone was reverified. Two separate bounded ranked report queries using
fresh invented reserved markers returned HTTP 200, array rows and column metadata without
column/error envelopes; neither reserved marker was present.

This verifies access to the intended page and custom-link observation queries rather than
only a suite-wide totals report. It is not product receipt, a successful negative control,
proof of future processing rules or an SDK execution. No SDK events were sent and no suite,
Target or site resource was changed. Private markers, suite selectors and raw report data
remain outside committed output.

The next implementation milestone remains the reviewed bounded stock setup/journey harness,
with current-owner-edit-preserving updates, exact pins, refusal tests and restoration before
live use. Native outcome exports are needed after real traffic, not more targeting configuration
screenshots. Source evidence must still be valid for each actually approved live stage.

### Harness implementation and active-finish permission — 2026-10-09

The owner explicitly requested running the setup/test steps and permitted leaving the activity
active unless stopping has a strong reason. Preserve that decision for the reviewed successful
finish; a temporary pause is still needed to stimulate the no-offer control, and errors or lost
scope/consent stop traffic. An approved active finish must state the actual bounded schedule
and retained test configuration rather than claiming the original inactive state was restored.
No activation has occurred.

The original selection/routing evidence reached its 24-hour limit. Fresh unchanged-routing
confirmation was requested without asking for another screenshot; the owner was unavailable.
Neither this execution grant nor previous report/filter screenshots are new routing evidence.
Live mutations/SDK traffic remain gated rather than backdating or extending those observations.

New 051-05's independently frame-reviewed local harness is being implemented with failing tests
first. It drives the same fixed stock call sequence through invented integrations and validates
positive, no-consent, no-offer and non-render behavior. This is useful tested operator code,
not stock SDK execution, deployed code or Adobe receipt. Pinned export signatures and the
void ACDL submission limitation were checked directly; closed 051-01/04 records remain intact.

The subsequent local implementation passed independent compliance and craft. The parent ran
all four actual operator cases and 588 combined tests (133 local-harness, 455 existing preflight/
frozen-core); the implementation's full run passed 2,470 tests. Reports always state local
fixtures only and deny SDK execution, product receipt, deployment and activity activation.
The site wrapper and real vendor-response qualification still belong to 051-02.
Independent reconciliation subsequently passed and the local 051-05 milestone is DONE.

The actual current preflight was rerun and returned **exit 1 / stale_evidence / zero requests**:
original scope/routing observations were not extended. It neither minted a token nor sent SDK
traffic. A fresh unchanged-routing confirmation was requested and remains unavailable.
Local implementation is real code progress, not evidence that the requested live steps ran.

### Fresh unchanged-routing confirmation and smoke preparation — 2026-10-09

The owner explicitly confirmed the requested dedicated datastream routing unchanged at
2026-10-09T23:00:50.457Z: the same approved suite, Target property/development environment,
with Platform ingestion disabled. Original screenshots/envelopes and their expired observation
times remain immutable. New 051-06's independently reviewed stage policy treats this as a new
manual configuration confirmation, not a newly captured screenshot or configuration API read.
New private stage assessment envelopes reference that confirmation and the historical sources;
their deadline is 24 hours from confirmation, while workspace evidence retains its own original
freshness and binding. No normalization-time extension or new picture is claimed.

The real stage preflight subsequently passed all **12 required checks**, four optional unknowns,
12 bounded requests. Exact fresh readbacks corroborated Analytics/Target fixture selectors and
current property token; routing/profile rows remain explicitly owner-based. This reopens the
initial live-preparation gate without establishing a deployment, SDK request or vendor receipt.

An authorized isolated reference checkout was created inside the session workspace at commit
`da299947f310fc84998b5b1684e9a5fc6877e7bc`. Exact stock source/license/ACDL files and the
unmodified official Alloy bytes were prepared with their pinned hashes; none has been pushed or
executed as stock yet. A fresh ordinary-page browser visit returned HTTP 200 with a main element,
no test slot and **zero observed Adobe requests**. That is default behavior, not stock evidence.
The current owned saved activity and unchanged known offers were reread privately; no whole-
activity, metric or offer replay is planned, preserving the owner's Page Delivery edit.

The exact redacted smoke operation plan passed independent review after adding all applicable
source/credit deadlines, fresh compare-controlled state/schedule snapshots, independent
disable/pause cleanup and readbacks, and explicit separate Analytics page/custom observation.
Passing compliance/craft/architecture of the deployable code remains mandatory before any
deployment, activity mutation or SDK traffic. New 051-06 is a partial real smoke attempt;
051-02 retains the complete stock, negative, performance and Target native-outcome obligations.

### Disabled deployment verified and first runtime defect observed — 2026-10-09

After independent compliance/craft/architecture code passes and exact stage-plan review,
the scoped disabled stock integration was actually deployed to the authorized reference repo
at `09e5a8f`. Decoded gzip response bytes for the bootstrap, site entry/config and pinned vendor
assets match the committed source hashes; raw compressed response hashes were not mistaken
for source equality. Real default, invalid-query and disabled-opt-in browser visits showed
zero vendor/Adobe requests, no stock slot/entry and no observed CSP errors.

The code was briefly enabled for the reviewed one-hour window at `f6c8354`, then the first
real no-offer attempt stopped with internal/bootstrap failure before SDK initialization.
One stock integration module loaded; initialization, consent, fetch, page/custom and Adobe
request counts were **zero**. No Target activity state/schedule, offer, metric or owner Page
Delivery setting was touched. This is a genuine attempted live integration failure, not a
successful stock journey or downstream receipt.

Fail-safe stop was actually applied at reference commit `f905a0f`: public test config disabled
and its served bytes verified. The owned activity was never activated. A no-vendor stub
reproduction on the real page throws TypeError before initialization; the default browser clock
receiver is being investigated rather than assigning this failure to Adobe reporting/access.
The correction needs witnessed regression and fresh code review before any retry.

### Actual stock execution begins after native-clock correction — 2026-10-09

The production browser defect was proved independently: native timers stored as methods on
a custom clock object throw `Illegal invocation`; lexical Window-bound wrappers succeed.
A genuine default-clock/real ModuleNamespace browser regression reproduced it before correction.
Independent compliance/craft/architecture supplements passed the narrow fix; 656 targeted cases
pass and the full suite subsequently passes 2,538 tests across 127 files. Earlier visibility/
clipping, strict-fragment and bounded-bootstrap corrections are also retained.

The corrected module and new bounded enabled config were deployed at reference commit `605e539`,
with actual decoded served-byte pins verified. The one real **no-offer** journey then loaded the
official stock integration, Alloy and ACDL and completed SDK initialization, explicit consent,
one custom-scope fetch, one distinct page submission, one actual host click and one custom-link
submission. **Four Adobe requests** were observed; no offer qualified/rendered and no DISPLAY
or INTERACT was submitted. The activity was still saved/inactive for that control.

This is actual stock execution/submission evidence, not fixture proof. Separate exact-suite
page/custom report checks so far return no matched rows; their counts remain **unobserved**,
not zero, receipt or proven loss. No events were resent. The finite scheduled observation
continues separately and the no-offer negative cannot be fully accepted without sensitivity.

Only after those pre-live gates did the orchestrator apply the exact owned schedule/state
operations, read back `approved`, and record a bounded serving end of
2026-10-10T00:54:03Z. No whole-activity/metric/offer update occurred, preserving owner Page
Delivery settings. The positive attempt is waiting the documented propagation allowance
before one real visit. This current activity activation is genuine, not a future-only approval
probe; positive delivery/render/notifications and downstream outcome are not yet claimed.

### Real Target decision arrives; render qualification stops safely — 2026-10-09

After the scheduled propagation allowance, the positive visit initialized the real stock SDK,
sent consent and fetched **one actual Target HTML proposition** matching the exact owned scope,
TGT provider and current approved offer hash. Two Adobe requests were observed. The proposition
was not rendered because its approved harmless markup is a `span` with the inert
`data-airlock-readiness` annotation, outside the first parser's div/p/button-only allowlist.
The IDs/provider/field lengths were not the failure; no event tokens or contents are printed.

This is a real decision-qualification/parser mismatch, not missing Target access or a claimed
successful personalized display. Rendering, page/custom positive events, DISPLAY and INTERACT
counts were all zero. The parser did not execute or report rejected content. A narrowly scoped
synthetic regression/correction is in progress for known-hash inert span markup, stripping only
the readiness annotation while retaining all active-tag/URL/handler/style rejection.

On that failed run, the exact owned activity was paused and its captured original future
schedule restored via narrow endpoints, with fresh readback. Site test config was independently
disabled and its actual served bytes verified at reference commit `800598c`. Owner Page Delivery,
offers and goal settings remain untouched. This is a strong error/measurement-integrity reason
for stopping despite permission to leave a successful activity active. Actual downstream
Analytics rows for the earlier no-offer page/custom submissions remain unobserved at current
scheduled checks; they were not resent or reported as received.

The controlled-host parser correction now permits only inert `span` markup with the one
bounded readiness annotation after the original approved hash check, and strips that annotation
before DOM import. Active/unknown attributes and tags remain refused; vendor identity and
`scopeDetails` are not altered. A genuine synthetic regression preceded the correction;
70 browser cases and 658 targeted cases pass, with the parent's full run at 2,540 tests.
Independent compliance/craft/architecture supplements passed before deploying `449f8dc`.

The owned activity was then re-approved only on an exact new bounded schedule ending
2026-10-10T01:19:24Z; no whole-activity, goal, offer or Page Delivery replay occurred.
One corrected positive visit is waiting for propagation. Its runner subtracts the actual
earlier four no-offer plus two failed-positive Adobe requests from the aggregate 16-request
ceiling. Earlier failed attempts and their captures remain distinct; no page/custom/display
conversion was resent. Site disable will run independently after this case; error pause and
compare-controlled inverse remain available. Current activation is not a delivery/outcome claim.

### Corrected positive stock journey and actual stop — 2026-10-09

The corrected positive visit completed the **real pinned stock SDK** sequence: one initialization,
consent update, owned-scope fetch, hash-qualified TGT HTML proposition, visible sanitized host
render, page submission carrying native DISPLAY, trusted host-button click, distinct ACDL
custom link and native INTERACT. Five Adobe requests had HTTP statuses 200/200/204/204/200.
The original offer annotation was stripped before DOM import, preserving original proposition
identity/scopeDetails for notifications. No fixture output is substituted for this browser evidence.

The cumulative observed Adobe request count is **11 of the 16-request ceiling**, including four
no-offer requests, two failed-positive requests and five corrected-positive requests. Failed
attempts are retained; no page/custom/display conversions were resent. Client render/submission
and HTTP success do **not** establish downstream receipt. The first exact page/custom reports
return no matched rows; counts remain unobserved, not zero or proven loss. Finite scheduled
report observations continue without SDK resending. A refreshed native Target export for the
actual test window was requested; owner availability is unresolved.

Actual site stop independently disabled the public config in reference commit
`c3aa3ca0fcddaa4beb70637fad6ed5f6f70bf8a8`; decoded served bytes verified disabled.
As authorized after success, the activity remains approved on its bounded schedule ending
2026-10-10T01:19:24Z, with fresh state/schedule readback. This is retained approval, not
restoration to its original inactive schedule; its UI becomes ended after that boundary.
No whole-activity, metric, offer, Page Delivery or production-routing edit occurred.
The isolated reference clone was cleaned after all work was verified pushed; private source
pins/captures and comparison baseline remain retained. No shared main checkout was touched.

Full 051-02 acceptance, downstream Analytics/Target outcomes, remaining negative/performance
cases and 051-03 chamber compatibility remain open. New 051-06 records this deliberately
partial real smoke rather than claiming broad portfolio, reliable exactly-once or v1.0 readiness.

### Finite stock receipt window completed; budget stop — 2026-10-09

The scheduled observation process completed both no-offer and positive cases through their
**120-minute** report checkpoints. Exact approved-suite page and custom-link queries remained
HTTP 200 with valid report structure but **no matched rows** at the final checkpoints.
Classify both receipts as **not observed within the chosen window**. This is not proof of
event loss, zero processed events or missing entitlement; no application events were resent.
The actual Target decision/render/native notification submissions remain separately established,
but downstream Target counts are still unverified without the refreshed native report.

The successful positive run, disabled site configuration and retained bounded activity approval
remain as recorded above. That serving schedule ended at 2026-10-10T01:19:24Z; retained API
`approved` state is not a currently live serving window. No additional SDK traffic or activity
change followed. All bounded observation work has exited; no temporary observation helper remains.

The latest recorded session usage at 2026-10-10T02:38:11.571Z is approximately **10,123 credits**,
including bootstrap and recorded agent activity. The requested 10,000-credit ceiling has been
exceeded in the delayed usage accounting. Execution stops here: no further agents, diagnosis,
traffic or chamber implementation are authorized by the existing budget. Do not label this goal
successful or mark 051-06/051-02 DONE; downstream receipt, final reconciliation and the wider
portfolio remain incomplete. Resume only with a new budget decision and the actual observation
evidence, diagnosing reporting/collection without manufacturing receipt or resending conversions.

### Receipt diagnosis: original pages classified as bots — 2026-10-10

The owner authorized continuing after the prior credit stop. Diagnosis used **only read-only
report queries for the existing events**; no SDK events were resent, activity activated,
bot rule changed or browser identity spoofed.

Both original exact synthetic page labels are present with **one bot page view each**, including
when queried in their original unchanged padded traffic intervals. The same labels remain absent
from ordinary `metrics/pageviews` reports. This establishes downstream receipt of those pages
in Analytics' **bot reporting**, not ordinary visitor reporting. The wider full-day queries were
diagnostic comparisons, not retroactively substituted acceptance windows.

The dedicated suite's bot totals for the test day are two bot page views and four bot occurrences,
with ordinary pageview/occurrence totals empty. The totals are consistent with the two page and
two custom-link submissions, but do **not** identify or prove receipt of either custom-link label.
The prior headless runner's default user agent explicitly contains `HeadlessChrome`.
Together these observations support bot classification as the reason normal page reports were
empty. They do not establish which particular enabled IAB/custom rule matched or when the rows
became available; no bot report was captured during the original two-hour waiting window.

Direct official references:

- [Bot rules](https://experienceleague.adobe.com/en/docs/analytics/admin/admin-tools/manage-report-suites/edit-report-suite/report-suite-general/bot-removal/bot-rules):
  matching hits are excluded from normal traffic metrics and retained for separate bot reporting.
- [Bot page views](https://experienceleague.adobe.com/en/docs/analytics/components/metrics/bot-page-views)
  and [Bot occurrences](https://experienceleague.adobe.com/en/docs/analytics/components/metrics/bot-occurrences):
  page counts exclude link hits, while occurrences include both.
- [Bot name](https://experienceleague.adobe.com/en/docs/analytics/components/dimensions/bot-name):
  supported bot reporting uses Page/time/Bot dimensions and bot metrics, not the ordinary
  custom-link dimension. An empty incompatible dimension query is not evidence of loss.
- The pinned Analytics search reference was re-read: the exact `MATCH` clause is documented.
  A full-day search-free comparison also found ordinary reports empty, so the narrow search
  clause or original time-window selection alone does not explain the missing page rows.

The original two-hour result remains historically accurate: **ordinary** page/custom reports
did not show receipts. The stronger negative interpretation—no Analytics ingestion—must not be
carried forward. The current page evidence is bot-classified receipt; normal custom-link receipt
and downstream Target counts remain open.

A normal **headed Chromium** local launch was verified without navigating or sending traffic:
its real user agent lacks `HeadlessChrome`, while automation remains disclosed by the browser.
That is a candidate for a separately reviewed, newly correlated test run, not a covert user-agent
override or re-send of old events. Do not disable suite bot rules, pretend bot counts are normal
conversion receipt or quietly reuse old labels. Fresh applicable input/permission/routing evidence,
an explicit small traffic plan and unchanged consent/fixture boundaries still precede a new run.

A refreshed native Target CSV for the actual test interval was requested; the owner was unavailable.
No Target outcome is inferred from Analytics bot receipt, HTML rendering or notification HTTP
status. The broader baseline, chamber comparison, final smoke reconciliation and release gate
remain incomplete. Continued credit approval is recorded separately from a full release decision.

### Headed comparison readiness: live traffic blocked — 2026-10-11

The owner authorized the proposed new headed comparison. Read-only checks found the reference
repository still at `c3aa3ca0fcddaa4beb70637fad6ed5f6f70bf8a8`, public test configuration disabled,
and the known activity still API-approved with an **expired** serving end of
2026-10-10T01:19:24Z. No activity or deployment mutation occurred.

At 2026-10-11T17:25:55.393Z a fresh isolated **headed** Chromium context visited the ordinary
reference homepage without the stock opt-in query. The page returned HTTP 200; its default user
agent lacked `HeadlessChrome`, automation remained disclosed, and the visit loaded no stock
vendor assets and sent **zero Adobe requests**. This checks browser/default-page readiness,
not a page/custom stock journey or downstream product receipt.

The prior approval, routing and profile evidence envelopes are expired. A fresh unchanged
dedicated-routing/profile confirmation was requested, but the owner was unavailable. The new
action grant is not a configuration observation: no renewal envelope, enabled deployment,
Target schedule/state write or new SDK test event was manufactured.

A separate private one-visit/eight-dispatched-request plan passed bounded independent review.
Its 45-second outer runner watchdog explicitly preserves the unchanged module's 30-second
journey deadline and enabled-window cap. The plan requires fresh owner evidence, a real ready
preflight, freshly compared owned baselines, and reviewed new runner/private manifest before
execution; **plan review is not execution readiness or runner review**. New labels, default
headed identity, unchanged bot rules and independent disable/error recovery remain required.
Actual new traffic and ordinary Analytics/Target outcomes are still unexecuted/unverified.
This is a blocked continuation, not completion of 051-06, 051-02 or the broader goal.

### Headed runner prepared offline — 2026-10-11

The new parent-controlled private runner and tests are implemented; no automatic executable
CLI, deployment authority, credential loading or general provisioner was added. Each future
attempt reserves a new exclusive owner-only capture and new run/page/custom labels. Browser
identity is checked before navigation; fresh isolated headed Chromium retains its actual user
agent and disclosed automation. Only one navigation and trusted control click are permitted.
The independent comparison limit is **eight dispatched Adobe requests**, with attempts counted
separately and the ninth refused before dispatch; the original 11/16 history is not reused.

An initial supplemental compliance review identified redirect and timeout gaps. These were
corrected before live use: Chromium request-stage interception through the **Chrome DevTools
Protocol (CDP)** checks each paused URL, including foreign redirect hops, before continuing the
original native request. The runner does not proxy through an API client, alter headers/body/
identity, fabricate production responses or change bot rules. The installed protocol describes
redirect requests; foreign-URL validation remains effective when the optional redirect identifier
is absent. The 45-second watchdog now includes browser setup and journey; context and browser
closure each have separate five-second limits, so stalled context closure cannot suppress the
browser-close attempt. Pending late setup/unknown cleanup is retained honestly in private evidence,
not called fully closed. Existing module deadlines remain unchanged.

Focused corrective compliance, craft and architecture supplements passed. Craft's nonblocking
short-write and correlation-test findings were also corrected: private persistence completes
every byte or explicitly fails, and wrong page/custom labels are separately rejected.
Final focused validation: **44 passing tests**, including actual headed Chromium with networking
disabled and synthetic HTTP fulfillment, foreign redirects, the request ceiling, setup/cleanup
stalls, late resource closure and byte-complete capture. Syntax/recommended lint passed.
These are **runner/stub observations**, not Alloy execution, real Adobe requests or product receipts.
The existing disabled/expired private inputs were also exercised: `stage-refused` before browser
launch, with zero SDK events or live mutations.

Private code/test/plan fingerprints and genuine supplemental verdicts are retained in the session
handoff. They do not overwrite the slice's recorded pre-live module reviews, complete its lifecycle
or authorize a new deployment. The actual fresh owner routing/profile confirmation, real ready
preflight, freshly compared fixture/served bytes and newly bound private stage-manifest review
remain required. No SDK comparison was run, and the site/activity disposition is unchanged.

**Current read-only alternative recheck, 2026-10-11T17:55:46.511Z:** The documented datastream
configuration GET was retried with only the owner's application identity; it still returned
HTTP 403. No UI application key or user credential was substituted. The Target property collection
returned HTTP 200, but two entries still lacked explicit workspace assignments; API access alone
does not establish the complete profile designation. Three bounded authentication/metadata reads,
zero SDK events or mutations. A fresh unchanged-routing/profile confirmation was requested again;
the owner remained unavailable. Neither access result renews expired manual evidence or removes
the live gate. Private redacted results are retained; no additional autonomous traffic is justified.

### Routing API diagnosis and fresh owner confirmation — 2026-10-12

At **2026-10-12T14:55:35.910Z**, the owner stated that no configuration had been touched and the
dedicated setup should remain unchanged, then requested help investigating and removing the
403. This supplies a **new manual unchanged-settings observation** in the existing routing/
profile confirmation exchange, valid until 2026-10-13T14:55:35.910Z under the reviewed 24-hour
policy. It is not new screenshots or an API readback; original evidence remains immutable.
Stage-specific input reassessment, current real preflight, fixture/served-byte comparisons and
the exact traffic/mutation manifest are still required. The expired-confirmation blocker is
no longer the current owner-input blocker; API access is a separate investigation.

The current diagnostic reads establish a narrower failure:

| Observation | Established boundary |
|---|---|
| Fresh OAuth token request returns HTTP 200. | The supplied client can authenticate; no token or secret is retained in diagnostics. |
| Configuration service returns HTTP 403, `EXEG-3036-403`, title `Access Denied`, detail **`Api key is invalid.`** | The service rejects the supplied application key. This is not a VPN connection error; it does not establish which registration or permission change would resolve it. |
| The same fresh token and `x-api-key` successfully read the exact owned Target activity with HTTP 200. | The credential is not globally unusable. Target acceptance does not imply configuration-service acceptance. |
| The inspected export requests `read_pc.acp`, `read_pc.dma_tartan` and `target_sdk`, among other scopes. | Scope names alone do not prove which APIs are registered or which scope this UI-derived configuration route accepts. A missing `edge` substring is not evidence of a missing entitlement. |

**Hypotheses and disposition:** service-specific application registration/acceptance is the leading
hypothesis, supported by the exact key error and same-credential comparison. An unsupported or
different server-to-server contract for the UI-derived route remains possible. Insufficient
effective permissions remain a distinct hypothesis; the earlier View/Manage Datastreams policy
read is historical evidence, not a new role query, and no broad profile grant is justified.
A global credential failure or current VPN outage does not explain the successful authentication
and exact Target comparison. The **underlying registration/contract cause is not yet established**.

The current public Alloy extension still uses a UI application identity for this metadata route.
That identity was inspected as source evidence only, never substituted into authenticated calls.
The official Data Collection API references inspected here describe `interact`/`collect`
**event delivery**, not a management contract for this configuration GET. Do not infer that
adding a similarly named API service will authorize this route, or claim that no management API
exists from a bounded documentation search.

Sources checked directly:

- [Adobe's API-key troubleshooting](https://experienceleague.adobe.com/en/docs/experience-platform/landing/troubleshooting#api-key-is-invalid)
  distinguishes invalid API keys from token/profile errors; its example is a different error
  namespace and is guidance, not an exact `EXEG-3036-403` remediation contract.
- [Developer Console APIs and services](https://developer.adobe.com/developer-console/docs/guides/apis-and-services)
  describes service availability/licensing/permissions.
- [OAuth Server-to-Server implementation](https://developer.adobe.com/developer-console/docs/guides/authentication/ServerToServerAuthentication/implementation)
  separates API addition, credential scopes and product-profile assignments.
- [Data Collection API endpoint scope](https://github.com/AdobeDocs/data-collection-apis/blob/1968dcf70e406879fa6b019ef6f8ce7bdc709938/src/pages/endpoints/index.md)
  and [authentication](https://github.com/AdobeDocs/data-collection-apis/blob/1968dcf70e406879fa6b019ef6f8ce7bdc709938/src/pages/getting-started/authentication.md).
- [Current Alloy UI request headers](https://github.com/adobe/alloy/blob/4ad7dd01ccb6951de0bf48cb7e41e7814c3253a0/packages/reactor-extension/src/view/utils/getBaseRequestHeaders.js).

Next evidence requested is **only the existing Developer Console project's API/service names**,
not secrets, a new screenshot of Target eligibility, permission changes or new resources.
The owner was unavailable to supply that inventory through the question tool. If the service
inventory does not identify a supported configuration API, request Adobe's supported
server-to-server endpoint and application-registration requirements with the redacted error
and timestamp; do not substitute UI credentials. The reviewed manual routing path can continue
once its current preflight/stage gates pass without pretending this 403 is fixed.

Five bounded authentication/metadata requests were made across the two diagnostic probes.
No SDK events, activity/routing/profile mutations, user login or credential changes occurred.
Private redacted captures and the new owner observation are retained. API access remains
unverified; the existing disabled site and expired approved activity schedule are unchanged.

### Enabled-service inventory and current permission comparison — 2026-10-12

The owner supplied the existing Developer Console project overview at
2026-10-12T15:16:46.973Z. It visibly lists Adobe Analytics, Experience Platform API,
Adobe Journey Optimizer, Edge Delivery Services, Adobe Target, Customer Journey Analytics
and **Experience Platform Launch API**, with an OAuth Server-to-Server credential. The two
attachments are byte-identical copies of this overview, not an available-services catalog.
The image is preserved privately with its hash; no account/credential identifiers or image
are committed. This resolves the requested enabled-service inventory; do not keep reporting
that it is missing. It does not prove every service is bound to the exported client or that the
metadata configuration service accepts it.

A bounded comparison at 2026-10-12T15:19:06.679Z used one fresh token, the same owner client ID
and selected organization:

| Read-only check | Result | Interpretation |
|---|---|---|
| OAuth client-credentials token | HTTP 200 | Authentication succeeded. |
| Reactor `/profile` | HTTP 200; active organization matches selection | The supplied credential can access the Launch API in the selected organization. |
| Platform `/acl/reference` | HTTP 200; documented datastream permission names present | The credential can access the Platform reference service. |
| Platform `/acl/effective-policies` in the selected context | HTTP 200; **View Datastreams and Manage Datastreams active** | Missing these current effective permissions is not supported as the explanation for this failure. The POST is a policy query, not a permission change. |
| Exact UI-derived datastream metadata GET | HTTP 403 again | Configuration-service access remains rejected, despite working Platform/Launch access and effective datastream permissions. |

Five bounded authentication/metadata requests, zero SDK events or resource/permission mutations.
The documented [Reactor profile](https://experienceleague.adobe.com/en/docs/experience-platform/tags/api/endpoints/profile),
[permission reference](https://experienceleague.adobe.com/en/docs/experience-platform/access-control/api/permissions-and-resource-types)
and [effective-policy](https://experienceleague.adobe.com/en/docs/experience-platform/access-control/api/effective-policies)
contracts were checked before execution. No UI application identity, user token or alternative
credential was substituted.

There is **no evidence-based API or role addition to recommend from these results**. The remaining
failure is specific to this configuration service's acceptance of the customer application and/or
its supported server-to-server contract. The exact remedy is not established; do not call the
403 fixed, declare the endpoint universally UI-only, or invent a Console service name.
A redacted local support handoff requests Adobe confirmation of endpoint support and the exact
service/application-registration requirements. It includes the reproducible template and these
controls, but no secrets or selectors, and has **not** been sent externally.

The previously reviewed owner-UI/manual routing path remains available for the stock run after
fresh stage-bound reassessment, real preflight and exact manifest gates. Optional configuration
automation being unavailable must not be mistaken for missing manual confirmation or a mandatory
new product-profile grant. The broader live comparison is not executed by these access checks;
the disabled site and expired approved activity schedule remain unchanged.

**Owner-directed disposition:** The owner subsequently offered to perform any necessary
configuration manually and explicitly requested no more time be spent on this API issue.
Stop further configuration-service diagnosis or speculative API/role additions. Retain the
403 as **unresolved optional automation**, not a fixed endpoint or a missing mandatory API grant.
Use the existing reviewed manual-routing policy and the actual renewed unchanged-settings
observation. Current stage reassessment, real preflight, exact owned activity schedule/served
bytes and traffic-manifest checks still precede live execution; request only a specific manual
action if those checks establish a need. The redacted support handoff remains local and unsent.

### Manual-path preflight: one concrete fixture prerequisite — 2026-10-12

The existing unmodified preflight CLI was actually rerun at
**2026-10-12T15:25:13.230Z** with separately created stage-bound input, routing and workspace
assessments. Their manual observation is the owner's actual 14:55:35.910Z unchanged-setup
message, with expiry 2026-10-13T14:55:35.910Z; the 15:22:35.791Z read-only continuation binds
the new input authority. Original selectors/credential identity and original screenshot hashes
were retained, original source files were hashed and checked unchanged, and no new screenshots
or configuration API readback were claimed.

Actual result: **11 required ready, one required blocked, four optional unverified, 12 bounded
requests; overall blocked / exit 1**. Both `datastream.routing` and
`target.workspace_snapshot` are ready with explicit `owner_ui_confirmation` and null HTTP status.
The optional configuration API remains unavailable and is **not** the required failure.

The sole required failure is `target.activity_offers`, reason `unsafe_configuration`, action
`restore_inactive_fixture`. The retained activity is API-approved with its former serving
interval ended. The unchanged initial-preparation contract requires **saved/inactive status
and a future start with a valid later end**, even for this ended fixture
(`probes/adobe-compatibility/responses.mjs`, `target.activity` validation).
Do not forge a ready report, hide this failure behind HTTP 200 or rewrite its response.

The owner was asked to change only the known activity's status and schedule to inactive with
future dates, leaving offers, goals and Page Delivery untouched; no screenshot is needed.
The owner was unavailable through the question tool. This is the concrete manual action now
needed, not more API investigation or a request to reconfirm the already accepted routing.
After the change, re-read the exact owned fixture and rerun real preflight before the separately
reviewed bounded serving schedule/deployment and new headed traffic.
No SDK events, vendor mutations, permissions changes or new serving interval occurred.

**Prepared runner correction while awaiting the manual action:** Inspection of the exact
unmodified deployed Alloy 2.31.1 bytes showed that its request builder inserts a returned
EdgeNetwork location hint between the base path and `v1`. The private runner's original
root-path-only allowlist would reject those legitimate subsequent routes.
The [official location-hint reference](https://github.com/AdobeDocs/data-collection-apis/blob/1968dcf70e406879fa6b019ef6f8ce7bdc709938/src/pages/getting-started/location-hints.md)
lists exactly seven regions; the [pinned SDK](https://github.com/adobe-rnd/aem-eds-airlock-poc/blob/c3aa3ca0fcddaa4beb70637fad6ed5f6f70bf8a8/tools/airlock-stock/vendor/aem-martech/alloy.min.js)
establishes this comparison's actual `v1` construction, not the newer reference's `v2` example.
Only those seven optional regional path segments were added to the private runner's existing
fixed action grammar. Host, method, datastream/query binding, redirects, request cap and expiry
checks are unchanged; no SDK/core/credential or vendor-resource change.
Twenty-one positive region/action assertions genuinely failed before correction; all **73**
final offline runner tests passed, including wrong datastreams, unknown/encoded/extra paths
and actual networking-disabled headed Chromium with a hinted synthetic request.
A bounded independent correction review passed. Original reviewed runner bytes and new
fingerprints/verdict are retained privately; these remain stub/runner evidence, not Alloy
execution or downstream receipt. The requested manual fixture action is still pending.

### Actual headed stock comparison and stop — 2026-10-12

The owner inactivated the fixture and explicitly delegated date changes at
2026-10-12T15:42:52.549Z. A separately reviewed date-only preparation operation kept it saved,
set a future one-hour interval and verified unchanged owned content. The unmodified real
preflight then passed **all twelve required checks**; the latest pre-live pass is
2026-10-12T16:44:58.891Z. The configuration API remains optional/unverified; no further
investigation, API addition or permission change was made.

Before enabling, the exact operational plan and code passed independent review. Review caught
and correction tests proved two cleanup gaps: activation readback failure had escaped enclosing
cleanup, and final verification failure arose after deciding whether to pause. The corrected
single-execution launcher encloses config-only deployment, activation and browser execution,
checks current readiness before enable, and independently attempts disable and journal-bound
pause/inverse on failure. New private request-body/last-dispatch evidence additions also have
red/green witnesses; **74 final offline runner tests pass**. These remain preparation evidence,
separate from the subsequent actual case.

Actual reference enable commit **`48f2ec6`** changed only public config enabled/window fields.
Known activity schedule/state readback verified approved with bounded end
**2026-10-12T17:57:33Z**. Offers, goals, Page Delivery and product routing were not rewritten.
After fifteen minutes from verified approval, fresh exact activity/content and served-config
checks preceded **one** newly correlated positive visit in default headed Chromium.

At approximately **2026-10-12T17:18Z (10:18 AM Pacific)**:

| Actual evidence | Observed result |
|---|---|
| Browser identity | Default user agent lacks `HeadlessChrome`; automation remains disclosed. No override or stealth. |
| Pinned vendor assets | Three actual integration/SDK assets loaded; source/vendor bytes unchanged. |
| Actual Adobe requests | **Five attempted and dispatched**, below the independent eight-request ceiling; statuses 200/204. No application resend or second visit. |
| SDK/journey | One init, consent update and approved-scope fetch; one owned hash-qualified TGT offer visibly rendered; one trusted control click. |
| Actual page/custom mapping | One mapped page and one distinct ordinary custom-link event on the captured wire, matching this run's new private labels. Custom data contains no page mapping. |
| Native notifications | One DISPLAY bundled with the mapped page, one separate INTERACT; actual wire preserves the returned id/scope/scopeDetails. |
| Downstream receipt | Not established by these client/wire results; observed independently below. |

Actual last recorded Adobe dispatch is **2026-10-12T17:18:15.894Z**, with browser capture finished
at 17:18:21.181Z. Exclusive owner-only captures include bounded synthetic request JSON/routing,
not request/auth headers, owner login state or a broad cookie/HAR inventory.
The case and cleanup completed without error categories. The independent forward stop commit
**`c1438e3`** disabled test code and verified the exact decoded served disabled bytes.
The owner-permitted activity remains API-approved with the explicit bounded end above; do not
call it currently serving after that end. No activity/goals/offers/Page Delivery replay occurred.

The initial readonly observer exited unverified without producing a window/observation artifact;
its precise cause is not established. A readonly retry used the **same immutable actual capture**,
not new SDK traffic, and froze its original padded UTC interval in the exact suite's freshly
read IANA timezone. Its earliest ordinary page/custom checks still have no matched rows.
The nominal zero-minute checkpoint was actually taken several minutes after dispatch; actual
observation times are preserved, not relabelled as on-time samples. The finite observer continues
the reviewed checkpoints, with no SDK resend, no invented zero and no current loss claim.

A fresh native Target CSV for today's actual interval in **Airlock - Development / Activity
Impressions**, including the Scoped display goal, was requested after traffic; the owner was
unavailable through the question tool. Native wire proof is not a Target outcome count.
The current activity has no click goal, so INTERACT is still not downstream click-goal proof.
Ordinary Analytics receipts, native Target counts and final reconciliation remain open;
this executed partial comparison does not complete 051-02, the chamber or the release portfolio.

### Headed ordinary Analytics receipt confirmed — 2026-10-12

Both new exact synthetic labels now have independently observed **ordinary Analytics receipt**
in their original frozen padded traffic interval and exact approved suite:

| Outcome | Actual observation |
|---|---|
| Page, `variables/page` / `metrics/pageviews` | Exact matched row with count **1** at 2026-10-12T18:18:17.486958Z, the 60-minute checkpoint. |
| Custom link, `variables/customlink` / `metrics/occurrences` | Exact matched row with count **1** at 2026-10-12T18:19:48.778641Z, a bounded same-window readonly recovery. |

Valid earlier checks through the 30-minute checkpoint returned no matched rows. The custom
report request at the 60-minute checkpoint returned **HTTP 502**, so it was invalid evidence,
not a zero or negative receipt. The observer correctly stopped rather than treating that
failure as a valid empty report. One bounded readonly recovery returned HTTP 200 and the exact
custom row above. It reused the actual immutable capture, original window and unchanged suite
timezone; **no SDK event was resent, label reused for a second visit or interval widened**.
The observation helper has exited; no polling/helper remains running.

The finite observation goal is met for these two ordinary rows, with the actual checkpoint
times retained. Counts are observations, **not a claim of vendor exactly-once semantics** or
an exact processing-latency measurement. The headed test demonstrates an ordinary-reporting
path without disabling filters, spoofing identity or changing SDK bytes. It does not identify
the exact historical bot rule or prove that user-agent differences alone caused the old
headless classification; timing/network/context also differ.

Final read-only safety verification at **2026-10-12T18:21:59.051178Z** confirms exact disabled
served config bytes and the known approved activity's **ended** serving interval
(end 17:57:33Z). API-approved is not currently serving. The clean isolated reference clone
was removed only after verifying its commits remotely persisted, with private final source
copies/hash evidence retained.

**Still unverified:** native Target display/conversion count for this run; no click goal exists.
The requested native Development / Activity Impressions CSV remains an owner handoff.
Actual Target decision, safe render and native notification wire evidence are separately
verified, not promoted into those product counts. Final 051-06 reconciliation, complete
051-02 controls/performance/operator acceptance, chamber comparison and the Adobe release
portfolio remain open. Recorded cumulative usage at 18:21:57Z is approximately **13,913 credits**;
the owner-authorized continuation beyond the original credit stop remains distinct from
release acceptance.

**Supported Target read after the completed run, 2026-10-12T18:30:10.172476Z:** Fresh exact
owned-activity verification and the documented performance-report GET returned HTTP 200.
The returned activity binding matches, but its report environment **does not match the
approved Development environment**, and experience/option statistics arrays are empty.
This is neither a bound Target outcome nor evidence of zero conversions. Three bounded
authentication/metadata reads, zero mutations or SDK resends; raw response remains private.
Do not invent undocumented environment-query parameters or use the metadata as notification
receipt. The native Development / Activity Impressions CSV remains the required evidence handoff.

### Populated native Target export received — 2026-10-12

At 2026-10-12T18:44:50.813Z the owner supplied the activity's native CSV, describing its report
range as **the last seven days**. The original attachment bytes were parsed with a CSV parser,
hashed and preserved unchanged in owner-only private state. Unlike the earlier header-only
exports, this file has nine records: metadata, a twelve-column header, campaign totals and
both experience data rows. The activity name matches the owned fixture.

| Native report row | Visitor | Scoped display |
|---|---:|---:|
| Campaign Totals | 2 | 2 |
| Access check A | 1 | 1 |
| Access check B | 1 | 1 |

Both experience sums match the campaign totals. These are **actual populated Target report
counts**, not client assertions or inferred zeros. They establish that the supplied activity
report shows two cumulative Scoped display counts, one per experience. They do not by
themselves identify which visit contributed each count or establish the latest headed run's
increment: the owner's seven-day range includes prior attempts, and no matching pre-run
snapshot for that report context was captured.

The denominator header is **`Visitor`**, not the earlier `Impression` header. The metadata still
contains `Conversion Counter: undefined`; the `Conversions` cells are currency-formatted
`$2` / `$1` / `$1`, so they are preserved as raw text, not reinterpreted as event counts or
revenue. The separately named `Scoped display` column supplies the numeric counts above.
No click goal/outcome is established by this export.

The file records download date and `US/Pacific`, but **does not encode the report environment
or selected date range**. The seven-day range is attributed to the owner's message, not to
file metadata. Because the counting header differs from the previously selected report view,
the earlier Development / Activity Impressions screenshot is not silently applied to this
new download. The owner was asked whether **Airlock - Development** was selected for this
export; the question tool returned owner unavailable. No repeat export or settings change
was requested at this step.

Disposition: native cumulative display counts are observed; approved-environment binding
and headed-run-specific count remain unverified. Do not continue reporting the CSV as missing,
claim it is empty, convert its seven-day total into a single-run result, or treat `Visitor`
as Activity Impressions. Ordinary exact Analytics page/custom receipt and actual native
notification wire evidence remain independently verified. The site stays disabled and its
bounded activity interval ended; no SDK resend, API diagnosis, resource mutation or lifecycle
completion follows from inspecting this file.

## Sources / findings

**Browser transport observation pickup — 2026-10-12:** New051-08 supplies a caller-owned
Page observation interface rather than launching a browser, importing an SDK or changing
requests. The inspected installed Playwright APIs support Request object identity,
`postDataBuffer()`, selected header access, Response body/status and service-worker origin.
Frame review caught lossy `postData()` decoding: the contract now requires original bytes,
length-first fatal UTF8 and exact re-encoding. Malformed UTF8 must fail even if a replacement
character could make parsed JSON look valid. Byte limits bound retained accepted recording
data, not browser network allocations; pending reads are time-bounded and late data quarantined.
Real loopback receiving-sink tests are required, separately classified from Adobe/SDK proof.
Full051-02 operator/control/performance and051-03 actual chamber qualification remain open.

**Transport recorder implemented — 2026-10-12:** 051-08 now exports
`startStockWireRecorder(page, options)` for an explicit caller-owned Page.
Original107 behavioral tests failed before production; eight body-budget/scalar failures
and five DNS-alias failures witnessed their corrections. Current133 recorder cases,
197 checker cases and36 frozen-core tests pass (**366 total**); syntax and parent
recommended lint pass. Independent implementation compliance and craft clear this
observation scope; final reconciliation passed and 051-08 is DONE through its gated
lifecycle. This is a usable recording API, not full baseline/SDK/chamber acceptance.
Actual Chromium/local HTTP tests verify receiving-sink request/response bytes, including
strict malformed-UTF8 rejection. No route fulfillment/proxy, SDK import or Adobe event was
used for that proof. Browser wire callbacks and paired response data stay private;
public enums/counts remain redacted and all SDK/DOM/chamber/product/full-wire claims false.
A DNS terminal dot is normalized only to classify unexpected Adobe traffic, never to
approve the destination. Body limits do not assert control of browser network allocation.
No original SDK traffic was replayed or historical missing fields reconstructed.

**Pinned SDK command-source discovery — 2026-10-12:** A separate offline AST traversal
parsed the **exact official152336-byte Alloy2.31.1 artifact**, SHA-256 equal to the established
`7dd09409...` pin, without executing vendor code. Twelve literal `commands` objects yield
fifteen distinct static names: `sendEvent`, `applyResponse`, `getIdentity`,
`appendIdentityToUrl`, `getLibraryInfo`, `setConsent`, `createEventMergeId`,
`getMediaAnalyticsTracker`, `applyPropositions`, `evaluateRulesets`, `subscribeRulesetItems`,
`createMediaSession`, `sendMediaEvent`, `sendPushSubscription`, `sendConversationEvent`.
Their payload/options/results, worker suitability and core commands are **not** yet qualified.
Two further `commands` properties reference identifiers rather than literal object declarations;
the component registration graph, special core dispatch and documented public surfaces must
be reconciled before claiming a closed inventory. This is stronger byte-bound source evidence
than the earlier npm archive inspection, not source/package equivalence or chamber execution.
The private discovery ledger retains source URL/hash/offsets and explicit incomplete status;
no SDK installation, live event, resource mutation or prototype compatibility experiment ran.

**Current adapter gap, source-backed only:** The shipping Alloy connector declares
`ALLOY_EVENTS=["page_view"]` (`connectors/alloy/connector.js:47`) and maps that path to
`web.webpagedetails.pageViews` (`:290-300`). Its SDK handling delivers decision data and
returns an empty egress list because transport is intercepted (`:225-256`), not a general
public command/result facade. The host's `driveEvent` settles with `{summary,ready}`
(`core/wrapped-sdk-host.js:553-584`), and `bootAlloy` builds the real guarded host fetch
(`adapters/eds/index.js:1563-1618`).
These cited surfaces are reusable foundations, not evidence that arbitrary custom XDM or
all fifteen discovered SDK commands already work through the chamber. The complete
registration/options/callback inventory and executed stock/chamber comparisons remain
051-03/052 work. No runtime source was altered or full-repository absence claim made.

**Recorded-wire checker implementation pickup — 2026-10-12:** New vertical slice 051-07
defines an end-to-end local operator for checking supplied final SDK payload records.
Its closed contract and exact selector correction passed frame review before TDD work.
The actual stock capture's fetch query has the approved single decision scope, seven
pinned schema URIs and no surfaces; page/custom/INTERACT have no event-level query.
Extra selectors are not harmless additive fields and must be rejected even with correct
event counts. The checker introduces no SDK/network/browser or vendor-resource operation.

The existing positive capture was privately projected without altering recorded bodies,
paths/config fields, proposition identity or host observations. Full URL/method/headers
are absent from that historical capture and were **not reconstructed**. Therefore the
checker can establish supplied-record predicate results, not independent dispatch/SDK/
DOM provenance, full wire conformance or chamber parity. Those claims are explicitly false
in every checker report. Full 051-02 collector/operator and 051-03 worker work remain required.

Separately, the public npm 2.31.1 archive was fetched in memory and checked against its
registry SHA-512 integrity, without installation, extraction to the checkout or execution.
It contains 440 ES6 source files and component entrypoints, but no inspected minified
bundle candidate to compare to the live official pin. Git lookups for the two obvious
version-tag spellings did not resolve; no source/bundle equivalence or complete command
inventory was inferred. Public source discovery remains preliminary evidence for a future
pinned inventory, not a charged chamber runtime experiment or completed spike finding.
No original private capture, supplier byte pin, frozen-core file or closed record was changed.

**Recorded checker implemented — 2026-10-12:** 051-07 now provides
`stock-wire-check.mjs --input <owner-only recorded JSON>` using the existing bounded private
reader/parser. Valid TDD witnesses are 180 defined assertions red before production,
then15 edge assertions red before their fixes. Final197 new checker cases plus36 frozen-core
and133 harness tests pass (**366 total**); syntax/recommended lint pass with no new tools.
Independent original-criteria compliance, craft and reconciliation passed; 051-07 is DONE
through gated lifecycle transitions, not a proxy close-out of the full wire baseline.
The parent exercised the CLI on the actual existing positive projection: five request
records, one consent/fetch/page/custom/display/interact each, all predicate checks pass.
All six network/SDK/DOM/chamber/product/full-wire provenance claims remain **false**.
No resource changes, browser/SDK sends or broader baseline/lifecycle acceptance are inferred.

**Owner-approved reporting disposition — 2026-10-12:** The owner explicitly confirmed
the proposed boundary gate and asked to handle further reporting as follow-up when needed.
The earlier fifteen-export manual plan and suggested ten-export refinement are both retired;
no mandatory staffing schedule, report-driven three-hour spacing or click-goal provisioning
is needed for the revised open 051-02 wire baseline. Its five scenario groups, native
notifications, negative controls, real SDK/response behavior, isolated traffic/cleanup and
performance scope remain mandatory. 051-03 still requires that baseline and its reviewed,
eight-active-hour bounded experiment. No chamber parity or full implementation is proved here.
The accepted ADR and revised frame reviews carry the assurance change; all closed records,
original captures and actual initial Analytics/Target receipt observations remain untouched.
Per-run Target attribution, product reports and later AJO/CJA/RTCDP outcomes remain unknown
until the nonblocking follow-up is exercised; they are not retroactively declared passed.

**Full-baseline pickup after environment confirmation — 2026-10-12:** The 051-02 frame is
reviewed but its remaining DoR is not automatically cleared by 051-06. The existing manual
report protocol needs at least fifteen pre/60/120-minute exports across five separated stages
and at least fourteen hours. Operator availability was requested; the owner was unavailable
through the question tool. No new traffic or report checkpoints are fabricated.
The public Target Admin contract's complete declared path inventory was checked at commit
`63e9ea6c1e80e7568f2cd4b39cc1acad98d941fe`: no metric/goal-specific write path is declared;
narrow activity state/schedule and whole-activity PUT are declared. This does not prove an
API can never exist. Preserve the Page Delivery edit rather than attempting an unverified
whole-activity goal update. The remaining interaction-goal/observation/performance/operator
work is recorded in the open 051-02 slice, with the cumulative Development counts accepted
and configuration API investigation still stopped.

**Export environment bound by owner — 2026-10-12T19:08:06.598Z:** The owner explicitly
confirmed that the uploaded seven-day CSV was exported for **Airlock - Development**.
The new confirmation is bound to the unchanged original export hash and previously selected
environment; its initial inspection and earlier uncertainty remain immutable historical evidence.
This establishes **two cumulative Scoped display counts in the approved Development environment**,
one per owned experience, alongside two Visitors. It is manual report-context evidence, not an
environment field discovered in the CSV, configuration API readback or renewed routing evidence.
No additional export, settings change or SDK traffic is needed to establish that cumulative result.

The seven-day window and `Visitor` denominator are retained as supplied; they do not become
the previously requested single-day/Activity Impressions context. Per-headed-run increment
and click-goal outcome remain unverified, and full 051-02 controls/performance/operator acceptance
and 051-03 chamber work remain open. This new evidence resolves the environment-confirmation
handoff; do not keep describing the environment as unknown or the report as missing.
The closed partial-smoke 051-06 record is left unchanged: it faithfully reflects what was known
at its close-out, while this open research note records the subsequent confirmation.

**Partial-smoke lifecycle close-out — 2026-10-12:** 051-06 is DONE after a fresh final
compliance pass against its original five partial-smoke criteria and a passing reconciliation
review. Corrections to stale current summaries were independently verified; failed attempts,
credit overrun and subsequent continuation, report failures and cumulative-context limitations
remain preserved as dated evidence. Current targeted browser/frozen-core validation passes
106 tests, without claiming the historical full suite was rerun.
This closes deployable smoke/operator-attempt evidence, **not** complete stock-baseline or
chamber/release acceptance. At that close-out, native Target environment confirmation, per-run counting, click
goal/outcome and 051-02 controls/performance/operator work were still open. The research stays OPEN.

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
| AEP sandbox | [Sandbox API](https://experienceleague.adobe.com/en/docs/experience-platform/sandbox/api/sandboxes) documents listing, lookup and development-sandbox creation. | Available-context reads and selected effective permissions are now verified; quota and resource creation remain untested/unapproved. A new sandbox is not needed for the initial Analytics/Target-only baseline with Platform ingestion disabled. |
| XDM schemas | [Schema Registry API](https://experienceleague.adobe.com/en/docs/experience-platform/xdm/api/schemas) documents programmatic schema management. | Select field groups/identity requirements for synthetic scenarios; production/default schema mutation is not authorized. |
| Datasets | [Catalog API](https://experienceleague.adobe.com/en/docs/experience-platform/catalog/api/create-dataset) documents dataset creation from a schema ID. | Ingestion/profile enablement and product-specific data paths still need validation. |
| Datastreams | [Official overview](https://experienceleague.adobe.com/en/docs/experience-platform/datastreams/overview) documents service routing and UI management. | Initial destinations are verified via owner UI evidence/confirmation; the owner-key configuration GET still returns 403. Supported Server-to-Server administration remains unverified; recheck future routing changes before traffic. |
| Target | [Admin API overview](https://experienceleague.adobe.com/en/docs/target-dev/developer/api/admin-api/admin-api-overview) describes authenticated admin operations, versions and batch dependencies. | Scoped create/edit/approval and actual owned-offer delivery, safe rendering and native notification wire are verified. Latest approved serving interval has ended. Native cumulative Scoped display counts are observed in the owner-confirmed approved Development environment; per-run attribution and click-goal outcome remain unverified. |
| Analytics | [2.0 API reference](https://developer.adobe.com/analytics-apis/docs/2.0/apis/) and its [current report-suite schema](https://github.com/AdobeDocs/analytics-2.0-apis/blob/main/static/report-suites.json) document metadata reads and standard suite creation. | Creation permission, quotas/cost, approved RSID prefix/settings and product-specific test isolation are not established by listing existing suites. |
| AJO | [Current API index](https://developer.adobe.com/journey-optimizer-apis/) lists retrieval, execution, previews and selected management operations. | Campaign reads and selected manage/publish/report policies are verified, not an exercised general web/code-based campaign creation/publishing path. Supported UI/admin work and isolated outcome fixtures may still be required. |
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
[Spec 051](../specs/051-adobe-integration-proving-ground/spec.md) carries the implementation contracts:
the preflight is implemented; its historical v1 report was unverified, and the subsequent v2
preparation report passed with explicit owner evidence. A reviewed partial stock smoke has executed
with ordinary Analytics receipt; complete stock-baseline acceptance and chamber compatibility
remain open. A previous ready report does not renew source evidence or clear future live gates.
The owner approved the eight-active-hour spike and later continuation beyond the original
credit stop. Fresh preparation gates cleared for the executed smoke, not for every later stage.
Specs 052-057 remain unsliced outlines.
This note remains OPEN. The supplied credential was not created here; selected reads are verified
and the owner-authorized dedicated Target environment exists. The owner-created Analytics suite and
reference EDS site, Target property and ExperienceEvent schema are verified. Target workspace
assignment and credential association are verified for reads. Analytics report queries and selected
AEP/AJO effective permissions are verified. Initial datastream destinations are now verified through
owner screenshots, exact selector comparisons and saved-environment-pin confirmation; automatic
configuration management remains unavailable. Scoped Target create/edit and future-only approval
pass; later reviewed preview-site deployment and stock smoke are verified, with test code disabled
and the retained approved activity's serving interval ended. Native Target report context, full
stock/chamber comparison and production publication remain unverified/not authorized as applicable.
051-01 preflight utility is DONE after final review/reconciliation.
AJO/CJA/RTCDP fixtures are deferred for the
initial proving ground, not removed from the release gate.

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
