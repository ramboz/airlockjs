---
status: OPEN
topic: Adobe-first SDK compatibility and API-led test-environment setup
created: 2026-10-06
related:
  - ../decisions/adr-0031-reframe-onto-adobe-first-compatibility.md
  - ../releases/adobe-compatibility.md
---

# R-012: Adobe-first compatibility and owned test-environment setup

> Keep the official SDK, investigate the whole documented integration surface, and prove one complete
> Adobe journey before broad implementation. This is an open investigation record: source/documentation
> reconnaissance is complete for the points below; authenticated provisioning and live product proof
> have **not** run. The release is committed in direction, not proven in outcome.

## Question

Can the stock Alloy.js SDK support the pinned `aem-martech` integration and Adobe Web SDK-connected
product workflows through Airlock without losing functionality or weakening the boundary? What can
we provision and validate through supported admin APIs, given that the owner has no ready
Target/Analytics environment and little product-setup experience?

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
| Analytics | [2.0 API reference](https://developer.adobe.com/analytics-apis/docs/2.0/apis/) is the current entry point. | Report-suite provisioning/configuration capabilities were **not established** from its dynamic reference; do not promise creation or fall back to legacy 1.4 without current support verification. |
| AJO | [Current API index](https://developer.adobe.com/journey-optimizer-apis/) lists retrieval, execution, previews and selected management operations. | General web/code-based campaign creation/publishing is not established; UI/admin work may be required. AJO license and permissions are separate. |
| CJA / RTCDP | [Web SDK tutorial prerequisites](https://experienceleague.adobe.com/en/docs/platform-learn/implement-web-sdk/overview) distinguish basic Web SDK from Platform-product access. | Need product-specific schemas, connections/data views or profiles/audiences and outcome access; shared transport does not prove product behavior. |
| Validation | The same tutorial uses Adobe Debugger and Assurance. [Manual proposition rendering](https://experienceleague.adobe.com/en/docs/experience-platform/collection/use-cases/personalization/render-manual-propositions) requires display notifications. | Verify automated receipt/report/session access; interactive Assurance can supplement, not replace reproducible product outcome assertions. |

These are **documentation-backed capabilities**, not authenticated API successes. Search summaries
contained stale/overbroad automation claims; only the directly checked sources above ground this note.
No current conclusion that every admin UI step has an API equivalent.

### Access request the agent will prepare, not secrets the owner must paste

- An entitled organization and owner-approved test deployment/domain.
- API/product profiles with least privilege for Data Collection, Analytics and Target; request
  AEP/AJO/CJA/RTCDP permissions only for the scenarios requiring them.
- A dedicated Analytics test suite and a restricted Target test environment/workspace/property.
  AEP sandbox scoping does not substitute for these product-specific isolation controls.
- OAuth application credentials supplied through an approved local environment or secret manager,
  never chat or a committed config. No credentials available or inspected in this pass.

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
This note does not reserve a build spec, create credentials or activate product resources.

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
and [Adobe Compatibility & Adoption](../releases/adobe-compatibility.md); investigation remains OPEN.
