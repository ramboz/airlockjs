---
status: IN_PROGRESS
skill: jig:spec-workflow
use_cases: [UC-2, UC-7, UC-8, UC-10]
---

# Spec 064: Adobe parity inventory (Alloy 2.31.1)

> Frozen inventory and capture plan. Written 2026-11. Pinned to Alloy 2.31.1.
> Definition of done: [ADR-0061](../../decisions/adr-0061-definition-of-done-vendor-compatibility.md). Not re-opened here.
> Adoption path: [ADR-0038](../../decisions/adr-0038-reframe-onto-adobe-first-compatibility.md). Acceptance boundary: [ADR-0039](../../decisions/adr-0039-airlock-boundary-acceptance.md), partly superseded by ADR-0061.
> Simplified 2026-11-13 against the Alloy 2.31.1 source (tag `@adobe/alloy@2.31.1`, commit a175b806), owner-approved. The source and the pinned bundle were only read, never executed.
> Sister specs: 065 (Google inventory) and 066 (Meta inventory) are reserved. This spec creates no 067+ specs; build work is an ordered slice list (section 8).

## 0. Summary for the owner

This spec turns "Adobe compatibility" into a list we can build against. It pins Alloy 2.31.1, lists every behavior we owe, and plans one capture session that records the real tag so each slice can be proven against recordings.

No captures, live vendor calls or production probes run until you approve it. Two read-only or tooling tasks (T2, B0) may start before.

It also retires the old plan. Specs 052 to 057 were unsliced outlines. Spec 051 carried a stock baseline and an 8-hour spike that ADR-0061 makes unnecessary. Section 7 closes or reframes each one, and section 8 gives two pre-capture tasks, the capture session, and eight slices (B1 to B8), each sized for one fresh session and ordered by bridge surface.

The main tradeoff is front-loading. We spend one capture session before any slice. In exchange, every slice has fixtures, and the pilot (capture session plus slice B1) tells us if the corpus was complete.

The Alloy source made the plan smaller. The command list is closed from source, the field rules are seeded from source (recordings confirm them), and twelve build slices became eight. D1 to D7 were made on 2026-11-12 and D8 on 2026-11-13. All are in section 11.

## 1. Scope and frozen inventory rules

- Pin: Alloy **2.31.1**, SHA-256 `7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8`, 152,336 bytes. ACDL 3.0.1. `aem-martech` at `1aa3dee3c4791636efa9ad2994342f861c8e149b`. The reference trailing-LF difference stays disclosed.
- Frozen per ADR-0061 point 3. A later discovery goes to the next Alloy version unless it breaks a covered row. A missing capture for an inventoried behavior is a gap we fill in this session.
- Class for every row: `worker-native` (runs in the chamber unchanged), `mediated` (needs a capability-bridge call), `host-side` (stays on the main thread), `incompatible` (stated, with reason), `live-only` (cannot be fixture-proven, tagged up front).
- Each row has an owning slice (section 8). A row without an owner is a defect in this spec. An owner is a slice, or task T2 for rows still being closed.

## 2. Inventory

### 2.1 Commands

Read from the Alloy 2.31.1 source and checked against the pinned bundle: **17 commands**, 2 core and 15 from components. The list is closed. Earlier "two identifier-referenced commands" were not commands. They are the registry destructure `{commands, lifecycle}` and the `getLibraryInfo` result key. Only Context, DataCollector, Identity and LibraryInfo are required in custom builds. The other 11 components are optional (`scripts/alloyBuilder.js`), and all 15 command-bearing components are in `alloy.min.js`. Audiences, ActivityCollector, Advertising and Context add no commands.

| # | Command | Component | Initial class | Slice | Notes |
|---|---|---|---|---|---|
| 1 | `configure` | core | mediated | B1 | Unknown option keys throw (`core/buildAndValidateConfig.js:17`). Options subset recorded |
| 2 | `setDebug` | core | worker-native | B1 | Debug flag in sessionStorage (`com.adobe.alloy.instance.<name>.debug`) |
| 3 | `sendEvent` | DataCollector | mediated | B3 | XDM, data, `renderDecisions`, `decisionScopes`, `mergeId`, `edge.hostname` override |
| 4 | `applyResponse` | DataCollector | worker-native | B3 | Consumes a stored response |
| 5 | `getIdentity` | Identity | mediated | B3 | ECID rule in 4.6 |
| 6 | `appendIdentityToUrl` | Identity | worker-native | B3 | Pure function of ECID, URL, org ID and time (`Identity/appendIdentityToUrl/injectAppendIdentityToUrl.js:32`). Not host-side |
| 7 | `getLibraryInfo` | LibraryInfo | worker-native | B3 | Version string equals 2.31.1. S1 calls it as the self-enumeration check |
| 8 | `setConsent` | Consent | mediated | B3 | Endpoint `privacy/set-consent` (`Consent/createConsentRequest.js:20`) |
| 9 | `createEventMergeId` | EventMerge | worker-native | B3 | uuid (`EventMerge/createEventMergeId.js:17`) |
| 10 | `applyPropositions` | Personalization | host-side | B4 | DOM rendering |
| 11 | `evaluateRulesets` | RulesEngine | worker-native | B4 | Reads non-standard window props (see 2.2) |
| 12 | `subscribeRulesetItems` | RulesEngine | worker-native | B4 | Function-valued `callback` (B3 decides) |
| 13 | `createMediaSession` | StreamingMedia | incompatible until proven | B6 | Function-valued `getPlayerDetails` |
| 14 | `sendMediaEvent` | StreamingMedia | incompatible until proven | B6 | |
| 15 | `getMediaAnalyticsTracker` | MediaAnalyticsBridge | incompatible until proven | B6 | |
| 16 | `sendPushSubscription` | PushNotifications | incompatible until proven | B6 | Needs a separate service-worker build, not in `alloy.min.js` |
| 17 | `sendConversationEvent` | BrandConcierge | incompatible until proven | B6 | Streaming fetch; function-valued `onStreamResponse` |

The 6 function-valued options (`onBeforeEventSend`, `clickCollection.filterClickProperties`, `onBeforeLinkClickSend`, `subscribeRulesetItems.callback`, `createMediaSession.getPlayerDetails`, `sendConversationEvent.onStreamResponse`) are decided inside B3, not here. Note: the `onBeforeLinkClickSend` deprecation message names `filterClickDetails`, but the validator key is `filterClickProperties`. We use the validator key.

### 2.2 Other rows

| Area | Rows | Initial class | Slice |
|---|---|---|---|
| Network | Endpoints `interact`, `collect`, `privacy/set-consent`, `identity/acquire`. Default `edgeDomain` is `edge.adobedc.net`; demdex is used only for the first identity call when third-party cookies are on and the UA is Chrome. Location-hint path segment, `configId` override, Assurance `adobeAepValidationToken` query, request body shape, query string, headers. Each request gets a request-level class: `always`, `conditional` (with its rule), or `volatile`. Endpoint presence, multiplicity and redirects are classed too | mediated | B2 |
| Transport | The fetch init (`credentials: include`, `cache: no-cache`, `referrerPolicy`) is dropped by the bridge today. `sendBeacon` is denied. ID-sync and URL-destination pixels and script or iframe loads are inert | mediated | B2 |
| Response handling | The SDK consumes 8 handle types: `state:store`, `identity:result`, `identity:exchange`, `personalization:decisions`, `activation:push`, `activation:pull`, `media-analytics:new-session`, `brand-concierge:conversation`. Any other type is ignored by the SDK. The Edge also returns types the SDK ignores, so the "unknown handle" rule (section 6) uses the 8 consumed types plus the ignored types observed in capture. `redirect` is a proposition item schema, not a handle type. The response exposes payloads, errors, warnings and the `x-adobe-edge` header | worker-native | B2 |
| Storage | `kndctr_<org>_{identity,consent,cluster,bc_session_id,advertising}` cookies, `AMCV_<org>`, `s_ecid`, `mboxEdgeCluster`, probe cookie `com.adobe.alloy.getTld`. localStorage and sessionStorage under `com.adobe.alloy.` (`validation.clientId`, `<org>.consentHashes.*`, `instance.<name>.debug`, and the optional `decisioning.events`, `clickData`, `pushNotifications.*`). Before-state is seeded by replay (D8, ADR-0061 point 1) | mediated | B1 |
| Identity | ECID mint, `identityMap`, CORE namespace, `idMigrationEnabled`, third-party ID sync, `?adobe_mc` | mixed | B3 |
| Consent | `defaultConsent`, `in`/`out`/`pending`, IAB TCF 2.0 and `adobe`/`gpc` standards. Airlock's hold is a deliberate exception (D8); fixtures supply the recorded consent state | mediated | B3 |
| Context | `context` option. Default is stock `[web, device, environment, placeContext]` (D8), fed by real host values. The shim values (`airlock.example`, 1280x800, `en-US`) go away. A reduced `context` is a site opt-in. Mediated, shim-fed today, not worker-native. RulesEngine reads `window.title/url/referrer/height/width`, which are undefined on a real Window, so the shim must not define them | mediated | B1 |
| Personalization | Proposition types: HTML content, JSON content, DOM action set, redirect, rule set, Target activity. Rendering, `renderDecisions`, `prehidingStyle`, click and display notifications | host-side | B4 |
| Lifecycle | Page view, SPA view change (`viewStart`), link-click collection (capture-phase document listener) | mixed | B3, B4 |
| Errors | Failed network, non-200, malformed response, consent pending queue | worker-native | B2, B3 |
| Launch and `aem-martech` | `aem-martech` plugin API, ACDL 3.0.1 data-layer events, Launch extension bridge | host-side | B5 |
| Components outside the default surface | Audiences (activation pixels), Advertising (iframe, `message` listener, ID5 script), ActivityCollector config, BrandConcierge (streaming fetch, `bc_session_id` cookie), Media, Push | live-only or incompatible, decided in B6 | B6 |
| Debug | Adobe Assurance. The request side is page input (`adb_validation_sessionid` in `location.search` plus localStorage `validation.clientId`), so it can be fixtured. Only the session itself is live-only | mixed | B6 |

The chamber header comment names `@adobe/alloy@2.35.0` and "766 KB". The pinned bundle is 2.31.1 and 152,336 bytes. B1 fixes the comment.

Every row gets a one-line fixture reference once the capture session finishes. Unknown rows found during capture are added to this table before the freeze commit. After that commit the table is frozen.

### 2.3 Field-rule table (seeded from source)

Each rule cites its source `path:line` (Alloy 2.31.1 source, `packages/core/src/`) and the byte offset of the matching literal in the SHA-pinned bundle (first occurrence). Recordings confirm the rules, and the held-out check (4.7) stays. B0 loads this table into the comparator.

| Field | Class | Rule | Source | Bundle offset |
|---|---|---|---|---|
| URL template, action | fixed | `https://<edgeDomain>/<edgeBasePath>/v1/<action>?configId=<id>&requestId=<uuid>`; action is `interact` or `collect` | `core/edgeNetwork/injectSendEdgeNetworkRequest.js:70-93` | `edge.adobedc.net` 43458, `edgeBasePath` 43477 |
| `interact` vs `collect` | input-derived | Chosen by whether the request expects a response | `utils/request/createDataCollectionRequest.js:55-65` | `interact` 26761, `collect` 26751 |
| `requestId` | generated | uuid | `utils/request/createRequest.js:54` | `requestId` 25290 |
| Fetch init | fixed | `credentials`, `cache: no-cache`, `referrerPolicy` | `core/network/requestMethods/injectSendFetchRequest.js:15-22` | `"no-cache"` 43913, `credentials` 43924, `referrerPolicy` 43999 |
| `Content-Type` | fixed | `text/plain; charset=UTF-8` | `core/network/requestMethods/injectSendFetchRequest.js:20` | 43971 |
| `implementationDetails` | fixed | name `https://ns.adobe.com/experience/alloy`, version, environment `browser` | `components/Context/implementationDetails.js` | name 32155, `implementationDetails` 32126, `"2.31.1"` 29496 |
| `timestamp` | generated | ISO time | `components/Context/index.js:46` (required contexts) | `timestamp` 29478 |
| `meta.state.cookiesEnabled` | fixed | `true` | `core/createCookieTransfer.js:33` | `cookiesEnabled` 45827 |
| `meta.state.entries` | input-derived | Transferable cookies; present only when the edge is not first-party | `core/createCookieTransfer.js:20-56` | `meta` 20723 |
| `meta.queueTimeMillis` | generated | Time spent queued | `core/edgeNetwork/injectSendEdgeNetworkRequest.js:128` | 49380 |
| `query.identity.fetch` | fixed | `[ECID]`, plus `CORE` when third-party cookies are on and the UA is Chrome | `components/Identity/injectAddEcidQueryToPayload.js:22-26` | `identity:result` 35947 |
| ECID | server-context-derived on fresh, input-derived on returning | Minted by the first response | `components/Identity/` | `identity:result` 35947 |
| `web.webPageDetails.URL` | input-derived | `location.href` | `components/Context/injectWeb.js` | `webPageDetails` 21441 |
| `web.webReferrer.URL` | input-derived | `document.referrer` | `components/Context/injectWeb.js:20` | 29826 |
| `environment.browserDetails.viewportWidth/Height` | input-derived | `documentElement.clientWidth/Height` | `components/Context/injectEnvironment.js:25` | 30580, 30674 |
| `device.screenWidth/Height`, orientation | input-derived | `screen` | `components/Context/injectDevice.js:62` | 29984, 30026 |
| Client hints | input-derived | `navigator.userAgentData` | `components/Context/` | 31390 |
| `placeContext.localTime`, `localTimezoneOffset` | generated, input-derived | Local time and `getTimezoneOffset()` | `components/Context/injectPlaceContext.js:20` | 31246, 30815 |
| `Accept-Language` | browser-set | Alloy never reads `navigator.language` | not in source; absent from bundle | none |
| `eventMergeId` | generated | uuid | `components/EventMerge/createEventMergeId.js:17` | 33556 |
| `adobe_mc` | input-derived | Query-string identity param | `constants/queryStringIdentityParam.js:13` | 38166 |
| `adobeAepValidationToken` | input-derived | From `adb_validation_sessionid` in `location.search` and localStorage `validation.clientId` | `utils/request/createGetAssuranceValidationTokenParams.js:40` | 44761, 44590 |
| Consent endpoint | fixed | `privacy/set-consent` | `components/Consent/createConsentRequest.js:20` | 65286 |
| Identity endpoint | fixed | `identity/acquire` | `components/Identity/getIdentity/createIdentityRequest.js:20` | 36138 |
| Apex probe cookie | generated | `com.adobe.alloy.getTld` | `utils/getApexDomain.js:16` | 6301 |
| Caller-supplied | caller-supplied | `xdm`, `data`, `type`, `mergeId`, `decisionScopes`, `renderDecisions`, overrides | `components/DataCollector/index.js:53` | `decisionScopes` 32861 |
| `x-adobe-edge` header | server-context-derived | Region id | `core/injectCreateResponse.js:58` | 48404 |

Offsets for `edgeDomain`, `kndctr_`, and `AMCV_` are in the pinned bundle at 43458, 18013 and 36787. A literal that is absent from the bundle (`navigator.language`, `Accept-Language`) is itself a rule: Alloy does not set or read it.

## 3. Adoption path (ADR-0038)

1. Investigate an Airlock-backed `aem-martech` adoption path. Slice B5 owns this. The decision output is one of: drop-in, wrapper, or not viable, with the evidence.
2. Reach full pinned Alloy.js compatibility, row by row, with the fixtures from section 5.
3. Validate Adobe workflows (spec 056 outline). Under ADR-0039 downstream reporting stays a nonblocking follow-up.
4. SDK boot alone is never product proof.

## 4. Capture session plan (ADR-0061)

One session, run by agents on the owner's standing approval for test-only scripted captures (ADR-0061 point 6). Owner sessions are only for settings changes and the normal-browser capture. Production sites and real-user data keep the old gates (section 9).

### 4.1 Positive control first (point 8)

The session starts by recording at least one complete native beacon with the exact capture setup:

- fresh profile (section 4.2), desktop Chromium, **headed or headless stated per run in the manifest**;
- full request and response fan-out: every request the tag makes (edge `interact`, `collect`, any identity sync, any Analytics receipt), with headers, body, status and response body;
- Adobe's prior finding (R-014 ~1132-1183): HeadlessChrome was classed as bot traffic and returned no Analytics receipt, while headed returned the ordinary one. So the positive control runs headed first, then headless. If they differ, headed is the capture mode and the difference is a recorded row.
- Capture mode rule: the mode whose control shows the full fan-out (including the Analytics receipt) is the capture mode. If both do, headed is used. The escalation ladder (ADR-0061 point 8: headless, headed, owner's normal browser, then `blocked`, never synthetic) applies only when a run produces no traffic or no receipt.
- If the control cannot be recorded, nothing else is captured.

Served-script drift probe (ADR-0061 point 10): not applicable to the script, because the Alloy bundle is SHA-pinned (section 1). The same-day noise floor is taken as three same-day loads of S1 (base plus two repeats) before any other state counts, then the day-2 loads in S11.

### 4.2 Test identities and profile (point 5)

- Owned test-account IDs may be committed: Adobe org ID, datastream ID, Target property, Analytics report suite, Launch property. Only IDs the owner confirms as test-owned. Nothing from a customer or production tenant.
- Reference site: the owned EDS test site and local harness only.
- Fresh Chromium profile created for this session, never logged in to any vendor, separate from the owner's console session. One new profile per "fresh" recording; one reused profile per "returning" recording.
- Pre-commit check, added before the first capture is stored: it rejects vendor login or session cookies, bearer and API tokens, Adobe IMS tokens, and VPN or proxy credentials in any staged fixture. It is a test in the repo, runs in `npm test`, and has its own positive and negative cases. It scans request headers, response headers, bodies, and stored cookie and storage dumps.
- The Edge `kndctr_*` and ECID values are test-profile values. They may be committed. Everything else in the cookie jar is checked by name against an allow-list.

### 4.3 Recording set per state (point 1)

Every state is recorded as base plus same-setup repeat. The one-factor-at-a-time (OFAT) variants are recorded for S1 only, because the factors (viewport, locale, referrer, profile kind, edge domain kind) are context or transport fields that do not depend on the command. Each variant has an exact expected difference from base (the table after the factor list). Any other difference is a finding. Consent and datastream variants are their own states (S6, S9). Section 5 is the authoritative per-state matrix. Each recording is:

1. base;
2. same-setup repeat (same profile kind, same inputs; gives the noise floor);
3. one-factor-at-a-time variants:

| Factor | Applies to Adobe? | Why |
|---|---|---|
| Viewport | Yes | Context block carries viewport; Target decisions can key on it |
| Locale and timezone | Yes | Context block and `Accept-Language` |
| Referrer | Yes | Context block and Target audience rules |
| Fresh vs returning profile | Yes | ECID and `kndctr_*` state; see 4.6 |
| Egress region | **Probe once, expected No** | See 4.4 |
| Edge domain kind (first-party CNAME vs Adobe) | Yes (Adobe-specific) | `meta.state.entries` appears only when the edge is not first-party. Record whichever form the adoption site uses |
| Consent state (`in`/`out`/`pending`) | Yes (Adobe-specific) | Changes whether and what is sent |
| Datastream config state | Yes (Adobe-specific) | Section 6 |

Exact expected differences from the S1 base, from source:

| Variant | Expected differing fields | Must not differ |
|---|---|---|
| Viewport | `environment.browserDetails.viewportWidth/Height` and `device.screenWidth/Height` (`injectEnvironment.js:25`, `injectDevice.js:62`) | everything else except the generated fields |
| Referrer | `web.webReferrer.URL` (`injectWeb.js:20`) | everything else except the generated fields |
| Locale | only the browser-set `Accept-Language` header. Alloy never reads `navigator.language` | any body field |
| Timezone | only `placeContext.localTime` and `localTimezoneOffset` (`injectPlaceContext.js:20`) | everything else except the generated fields |
| Fresh vs returning | ECID source (minted vs sent), `query.identity.fetch` and the stored cookies | context fields |

The generated fields (`requestId`, `eventMergeId`, `timestamp`, `queueTimeMillis`) always differ and are compared by shape.

### 4.4 Egress region

ADR-0061 point 1 makes egress region a factor only for Google and Meta, because `dma` is geo-derived. It was never an ADR requirement for Adobe. S13 is an owner-approved extra check (D2), not an ADR obligation. Adobe has no client-side geo-derived field. The Edge Network chooses a region by anycast and `locationHint`, and the SDK stores the hint in `kndctr_*` state. So egress region is **not a recording factor** for Adobe request fields.

It might still change response fields (`locationHint:result`, Target geo audiences, Edge cluster in a response header). One check covers it: a single pair of test captures of the same state, one from the default egress and one from a second region, compared on response fields only. If any response field differs in a way the chamber would need to handle, egress region becomes a factor in the base set. This uses a VPN, so the VPN credential check (4.2) applies and the pair needs the owner to provide the second egress. The owner decided yes (D2, 2026-11-12) and provides the second egress, so S13 runs. If it later becomes unavailable, the row is tagged `live-only: geo` and the gap is stated in the freeze note.

### 4.5 Full stored input state (point 1)

Every fixture stores, in its manifest: URL and referrer, viewport, locale, timezone, egress region, browser name and version, headed or headless, profile kind (fresh or returning), and cookies, localStorage and sessionStorage **before and after** the run. A fixture without that block is rejected by the recorded wire checker (051-07 extension, slice B0).

### 4.6 ECID fresh-vs-returning rule

- A fresh profile has no ECID. The first response mints one. The fixture records the minted ECID as `server-context-derived`, not `fixed`.
- A returning profile reuses a stored ECID from a prior fixture in the same session. Its manifest names the source fixture.
- Never compare a fresh recording with a returning one except as the declared one-factor variant. The comparator treats ECID fields as `server-context-derived` on fresh and `input-derived` on returning.
- The held-out check (4.7) must include one returning-profile recording whose ECID was not used to derive the rule.

### 4.7 Held-out check of derived rules (point 7)

Every field rule we derive (for example "ECID is a 38-digit minted value", "`eventId` is a UUID", "timestamp is within N seconds") is checked against recordings not used to derive it. The held-out set is the second-day drift-probe loads plus at least one extra setup (a different viewport and locale on a fresh profile). A rule that fails the held-out set is rewritten or the field is tagged `volatile` and compared as shape only.

### 4.8 Owner's normal-browser reference capture

The owner does one capture in a normal browser of a state the agents also record. We compare it field by field with the agent recording. Any difference in a fixed or generated field goes to the owner before the freeze commit. The expected explanation is the capture setup, but it is checked, not assumed. A state is never marked `blocked` before a normal-browser try.

### 4.9 Live-only tags

Rows that need something fixtures cannot hold are tagged `live-only` now, with the reason, before capture. Initial list: downstream Analytics reporting (spec 056 follow-up), Target activity serving window (the owned activity is currently inactive; reactivating is an owner settings change), Assurance debug sessions, any geo-dependent response (4.4 if the owner declines the second egress). Live-only rows are checked once at the release check (ADR-0061 point 1).

### 4.10 Browser scope (point 9)

Desktop Chromium only for v1.0. Firefox, Safari, mobile and WebView are out and listed as out in the freeze note.

### 4.11 Pilot definition (point 7)

The pilot is the capture session plus slice B1. We report how many captures B1 needed beyond the corpus. The number is written into this spec at pilot close. If B1 needs more than three extra captures, that is a kill criterion trigger (section 10), not a quiet top-up.

The ADR's Google/Meta clean-room risk is **not** tested by this pilot, because Adobe runs the pinned open-source SDK in the chamber.

## 5. Capture corpus (what gets recorded)

| ID | State | Variants |
|---|---|---|
| S0 | Positive control, native beacon | headed, headless |
| S1 | Page view, no consent restriction, fresh. Also calls `getLibraryInfo` (self-enumeration check: version 2.31.1) | base, repeat, viewport, locale, timezone, referrer, edge domain kind |
| S2 | Page view, returning | base, repeat |
| S3 | `sendEvent` with custom XDM and `mergeId` | base, repeat |
| S4 | `sendEvent` with `decisionScopes` and `renderDecisions` | base, repeat; Target activity response (inactive: records the no-decision shape; active: owner reactivates it) |
| S5 | `getIdentity`, `appendIdentityToUrl` | fresh, returning |
| S6 | `setConsent` out, in, pending then in | each with queued events |
| S7 | Link click and SPA view change | base, repeat |
| S8 | Error shapes (blocked network, non-200) | one each, scripted |
| S9 | Datastream config states (section 6) | one per setting, plus one combined-settings state |
| S10 | Launch + `aem-martech` + ACDL page | base, repeat |
| S11 | Second-day drift probe | repeat of S1, S3 on day 2 |
| S12 | Normal-browser reference (owner) | repeat of S1 |
| S13 | Egress response-field pair (only if D2 = yes) | default egress vs second region, response fields only |

Estimated size: about 45 recordings. Kill criterion 4 fires if the session needs more than 60 recordings or more than one owner settings window.

### 5.1 Capture run order

1. Agent-only states, in this order: S0, three same-day S1 loads, S2, S3, S4 (no-decision shape), S5, S6, S7, S8, S10.
2. One owner settings window: for each S9 setting the owner changes it and says so; the agent waits the propagation time (10 minutes), records, and logs the change and time in the manifest. D3 (Target reactivation) happens in the same window. S12 is done by the owner in the same window.
3. Restore step: the owner restores the datastream to its original settings and the agent records one S1 load to confirm it matches the step 1 recordings.
4. S11 and S13 follow on day 2.
5. Every manifest records the SHA-256 of the Alloy bundle actually loaded. The session aborts on a mismatch with the pin in section 1.

## 6. Datastream and edge configuration (ADR-0061 points 10, 11 analogue)

For Google and Meta the "config" is in the page (`gtag/js?id=`, `signals/config`). For Adobe the page only carries `datastreamId` and `orgId`. The datastream is server-side. It changes responses without changing the SDK or the page.

Datastream settings that change served behavior, to be recorded as states in S9:

- Adobe Analytics enabled or not, report suite;
- Target enabled or not, property token;
- Adobe Audience Manager, Experience Platform enabled or not;
- first-party ID cookie enabled;
- request and response overrides at the datastream level (for example, forwarded fields);
- consent handling in the datastream;
- geo-lookup and device-lookup enrichment;
- Edge domain (first-party vs `edge.adobedc.net`).

Each setting is listed with its triggering page input (for example Target needs a `decisionScopes` or page-load request; consent handling needs a consent state). A setting is dispositioned "no effect" only if: (a) the check came after a stated propagation wait (default 10 minutes after the owner's change, recorded in the manifest); (b) the Adobe analogue of served config bytes was checked, meaning the full response body and the `handle` set; and (c) the triggering input was present in the request.

Rules:

- **Settings-state list.** S9 records one state per setting above that the owner can change on the owned test datastream. The owner changes settings (owner session, ADR-0061 point 6); agents record.
- **Completeness analogue.** The Google/Meta check compares our inventory against real configs. For Adobe, we compare against the datastream configuration *schema* and the set of `handle` types seen. Task T2 (which also reconciles Adobe's public command list against the 17 source commands) lists every datastream setting from Adobe's public docs and schema only (the agent has no console access; see D6 for an optional owner export of the owned datastream config) and marks each "covered by S9", "affects no wire field we send or receive", or "gap". A gap is filled now or tagged `live-only`.
- **Production probes.** Comparing against real production datastreams needs production-site or tenant access. Production sites stay unapproved, with one exception: the owner's dedicated POC site and datastream (section 9, D4).
- **Point 11 analogue.** Point 11 has no design yet even for Google and Meta. For Adobe the analogue is a visible diagnostic when a response contains a `handle` type or datastream-driven behavior outside the inventory (for example, an unknown `handle.type`). The design is deferred to the same place as Google/Meta and is a listed pilot check: B2 must surface a `handle` type outside the known list as a loud, visible error, never silent. The known list is the 8 types the SDK consumes (2.2) plus the ignored types observed in capture, because the Edge returns types the SDK ignores and a consumed-only list would fire on every response. Design of the user-facing form is left to the point 11 decision; this spec only requires "not silent".

## 7. Disposition of specs 051 to 057

History is kept. Each spec gets a dated rescope note and its slices get new statuses. No record is rewritten.

| Spec / slice | Today | Disposition |
|---|---|---|
| 051-01 access preflight | DONE | Stays DONE |
| 051-02 stock baseline (live reporting and process gates) | IN_PROGRESS | **Reframed.** The local stock harness and page setup are reused; S1 to S3 are re-recorded under section 4 (old recordings lack the stored-input manifest) Live reporting gates move to the live-only list. Remaining ACs closed as "superseded by ADR-0061, spec 064" |
| 051-03 SDK compatibility spike (8 hours) | DRAFT | **Abandoned.** Replaced by the capture session and the B1 pilot |
| 051-04 workspace confirmation | DONE | Stays DONE |
| 051-05 local stock harness | DONE | Reused by B0 and the capture session |
| 051-06 deployed stock smoke | DONE | Reused for the owner's normal-browser capture (S12) |
| 051-07 recorded wire checker | DONE | Extended in B0 |
| 051-08 browser wire recorder | DONE | Reused as the capture driver |
| 051-09 focused chamber journey | IN_PROGRESS | **Reframed** as new B1 plus the part of B2 that is already built. Its ~25 witness files stay as evidence |
| 051 spec | IN_PROGRESS | Closes when 051-02/03/09 are dispositioned. Goal is carried by 064 |
| 052 events and commands bridge | DRAFT outline | **Superseded** by B1, B2, B3, B6 |
| 053 personalization and reporting | DRAFT outline | **Superseded** by B4. Reporting goes to 056 follow-up |
| 054 `aem-martech` and Launch migration | DRAFT outline | **Superseded** by B5 |
| 055 consent, identity, delivery | DRAFT outline | **Superseded** by B1, B3 |
| 056 product workflow validation | DRAFT outline | Kept as the nonblocking follow-up (ADR-0039) |
| 057 adoption, perf, release qualification | DRAFT outline | **Reframed** as B7 and B8 (ADR-0061) |

## 8. Ordered slice list (Adobe first)

Counting rule: T2 and B0 are pre-capture preparation tasks with their own completion checks (no fixture comparison, because the corpus does not exist yet, per ADR-0061 point 7). CAP is the capture session. B1 to B8 are slices, ordered by bridge surface. T2 is read-only (public docs, source, owned datastream export) and may start before D1. B0 writes tooling only. CAP and anything after it wait for D1 (approved). T1 was dropped on 2026-11-13: the command list is closed from source, and its docs reconcile moved to T2. Each slice is sized for one fresh session and ends with a recorded-fixture comparison through real chamber dispatch (ADR-0061 point 1).

Slice files in this directory: T2 = 064-02, B0 = 064-03, CAP = 064-04, B1 to B6 = 064-17 to 064-22, B7 = 064-15, B8 = 064-16. Abandoned on 2026-11-13: 064-01 (T1) and 064-05 to 064-14 (the old B1 to B10), each with a note naming its replacement. Spec numbers 067+ were not used.

| Slice | Goal | Depends on |
|---|---|---|
| T2 (task, 064-02) | Datastream setting list and completeness table; reconcile Adobe's public command list against the 17 source commands | none |
| B0 (task, 064-03) | Capture tooling: manifest schema, stored-input-state check, pre-commit secrets check, extension of the 051-07 checker, the field-rule table of 2.3, and native field-rule evaluation in the comparator (today `native_normalization_unsupported`, rig/native-tag-comparison.md lines 186-194; ADR-0061 Consequences). B1 is blocked until this lands. The comparator field-rule part is shared toolkit work that lands on main and is merged into the vendor branches; B0 consumes it and does not fork it | none |
| CAP (064-04) | **Capture session** (section 4). One session, owner approval first | B0, T2 |
| B1 (064-17) | Environment snapshot and storage seeding: location, referrer, viewport, screen, UA and client hints, apex probe, `context` option (stock default, D8), cookie, localStorage and sessionStorage before-state. **Pilot slice** | CAP |
| B2 (064-18) | Egress bridge: fetch init, `interact` / `collect` and `sendBeacon`, edge domain vs demdex, location-hint path, `x-adobe-edge`, error shapes, ID-sync and URL-destination pixels, unknown-handle diagnostic | B1 |
| B3 (064-19) | Command coverage and callbacks: the 17-command matrix, each row to a fixture; disposition of the 6 function-valued options | B2 |
| B4 (064-20) | Personalization and host DOM: `applyPropositions`, rendering, prehiding, redirects, click collection, rulesets context | B3 |
| B5 (064-21) | `aem-martech`, ACDL, Launch bridge. Adoption path decision (ADR-0038 step 1) | B3, B4 |
| B6 (064-22) | Out-of-default-surface disposition: media, push (separate service-worker build), conversation, Advertising, Assurance | B2 |
| B7 (064-15) | Compatibility report and perf budget (spec 057 content) | B1 to B6 |
| B8 (064-16) | Release check wiring: fixtures against live, live-only rows (ADR-0061 point 1) | B7 |

Dependency order: B1, then B2, then B3 and B4, then B5. B6 follows B2. B7 then B8.

Each slice carries its own DoR and acceptance in its file. The existing connector is the starting point for B1. It sends `context: []` (`connectors/alloy/connector.js:104`) and uses shim values in `alloy-chamber.worker.js:258-268,354`. Under D8 both go.

## 9. Production-site probes

No probe touching a production site, tenant or real-user data runs without the owner's written approval in this section, naming the site and the probe. 

**Approved (D4, 2026-11-12):** the owner's dedicated POC site and dedicated POC datastream only, for the datastream completeness comparison and read-only probes. In the owner's words: "I have a dedicated site and dedicated datastream for the POC, so yes we can use it if it helps". Before the probe runs the owner fills in:

- POC site URL: `<OWNER TO FILL IN>`
- POC datastream ID: `<OWNER TO FILL IN>`

The probe does not run while either value is a placeholder. Nothing else in production is approved.

## 10. Applicability of ADR-0061 carried checks and kill criteria

| Check | Applies to Adobe? | Why |
|---|---|---|
| Inventory completeness against real configs (`gtag/js?id=`, `signals/config`) | Yes, as the datastream analogue | The config is server-side. Section 6 and T2. No production probes without D4 |
| Point 11, visible diagnostic on out-of-inventory config | Yes, as an unknown-`handle` rule | Design is open for all three vendors. Adobe requires "not silent" in B2 |
| Meta owner-only capture route time-box | No | Meta-specific. Adobe's capture route is agent scripted plus one owner normal-browser capture |
| Egress region factor | Probed once (S13) if D2 = yes, expected No; otherwise `live-only: geo` | Section 4.4 |
| Clean-room risk | No | The pinned open-source SDK runs unchanged |
| Pre-commit credential check | Yes | Section 4.2 |
| Held-out rule check | Yes | Section 4.7 |
| Drift and field classes (point 10) | Yes, adapted | Alloy is versioned. Field classes are `fixed`, `generated`, `input-derived`, `server-context-derived` (a source field is named, for example the edge region or datastream), `volatile`. Request classes are in section 2.2. A field that differs across setups or days without an explanation makes the state `unstable` and goes to the owner |

Completeness metric: out-of-inventory rate = (datastream settings and observed `handle` types not covered by S9) divided by (all listed). Threshold: above 10% is a kill criterion (item 6). Value so far: not measured.

Kill criteria, from ADR-0061 plus the completeness metric:

1. The capture set cannot be acquired (including the positive control).
2. Fixed fields move across most states.
3. Derived rules fail the held-out recordings.
4. The inventory needs more states than one session can cover.
5. The release check finds fixtures drifting from live behavior.
6. The out-of-inventory rate exceeds 10%.

## 11. Decisions for the owner

Decided by the owner on 2026-11-12:

- **D1. Approved.** Spec and slice order as written.
- **D2. Yes.** The owner provides a second egress region, so S13 runs. The VPN credential check (4.2) applies.
- **D3. Yes.** The owner reactivates the Target activity in the settings window (5.1).
- **D4. Yes, for the dedicated POC site and datastream only** (section 9). The site URL and datastream ID are placeholders the owner fills in before the probe runs.
- **D5. One state** for the normal-browser capture (S12).
- **D6. Yes.** The owner exports the test datastream config into the repo before T2 (test IDs only).
- **D7. Yes.** One settings window of about 3 hours (5.1).

Decided by the owner on 2026-11-13:

- **D8. Match stock by default, always, for all tracks.** In the owner's words: "we want full parity, just with better controls, so we should match stock by default, always, for all tracks". For Adobe this means `context` defaults to stock (`[web, device, environment, placeContext]`) and is fed by real host values, not the hard-coded `airlock.example`, 1280x800 and `en-US` shims. A reduced `context` is a site opt-in. The rule is [ADR-0062](../../decisions/adr-0062-stock-default-parity.md) (Accepted). B1 owns the change.
- **D8 exception (a): the consent hold stays.** Asked whether the seal should also default to stock, the owner chose: "No, keep the consent hold as the one exception to the rule". Stock Alloy sends right away (`defaultConsent: "in"`). Airlock holds events until consent is explicitly given (ADR-0062 point 4, Accepted). A site with no consent setup holds and sends nothing, and Airlock logs a diagnostic warning. Alloy today sends when `egressPurposes` is empty and drops while pending. ADR-0062's follow-up slices fix both (empty-`egressPurposes` hold-and-warn, pending hold-and-flush, spec 045-02). That is shared seal work on main. 064 depends on it and does not build it.
- **D8 exception (b): the credentials denylist stays.** The ADR-0012 denylist (`password`, `cvv`, `ssn`, card fields) stays on by default (ADR-0062 point 4b). A field it removes from a stock recording is a documented, deliberate difference, not a parity failure.
- **Fixture comparisons** supply the recorded consent state (S6 and every consent row), so the hold never counts as a parity failure (ADR-0062 point 5). The default egress allowlist covers every destination Alloy contacts in the inventory, including `privacy/set-consent`, `identity/acquire`, the location-hint path and the Assurance query. B2 checks this.
- Also approved the same day: drop T1 (P1), seed the field-rule table from source (P2), regroup the build slices into eight (P3), and give each one-factor variant an exact expected difference (P5). S13 and D2 stand.

## 12. Review log and carried findings

Review rounds are capped at three before owner review (owner decision). Findings left after round 3 are carried into the pilot as listed checks, as ADR-0061 did with round 10.

- Round 1 (independent review): 4 findings. Pre-capture items relabeled as tasks; counts fixed; B9 split into B9, B10, B11, B12. All fixed.
- Round 2 (fresh Opus reviewer): 10 findings (4 blocking). Fixed: comparator field-rule work added to B0; OFAT matrix made consistent; request-level classes and the unstable-state rule added; datastream no-effect conditions added; completeness metric, kill criterion and combined state added; normal-browser difference escalation restored; drift probe sequencing stated; ladder order unified; setDebug single owner; T1/T2 approval stated.
- Round 3 (fresh Opus reviewer): 8 findings (3 blocking). Fixed: T2 input source (docs only, optional owner export D6); capture run order, restore step and owner window added (5.1, D7); 051-02 recordings are re-taken, not reused; ECID class naming; S13 added; summary wording; kill criterion 4 bounded; bundle SHA recorded per manifest. Nothing carried open.
- Owner decisions D1 to D7 recorded 2026-11-12; slice files 064-01 to 064-16 created and moved to READY_FOR_IMPLEMENTATION through jig's transition helper (the spec-level status is the jig rollup of its slices).
- Jig consistency check (`/jig:analyze`) run 2026-11-13 on spec 064 and its slice files after the simplification: 8 findings (0 CRITICAL, 3 HIGH, 3 MEDIUM, 2 LOW; the ADR-0062 citation MEDIUM was closed on 2026-11-13 when ADR-0062 was accepted). The 3 HIGH are fixed (B3 AC covered rows owned by B4 and B6; S6 owned by both B2 and B3; B6 wrote results into the frozen section 2). Carried into the slices: MEDIUM, slice file names 064-15 and 064-16 still say b11 and b12 (B7 and B8, names kept to preserve history); MEDIUM, B4 owns `applyPropositions` while B5 consumes it, so B5 must not re-test rendering. LOW, the 064-17..22 file names use the new B numbers while 064-05..14 keep the old ones; LOW, section 12 lists D1 to D7 in one entry and D8 in section 11 only.
- Alloy-source simplification pass, 2026-11-13 (owner-approved, one jig consistency check instead of new rounds): T1 dropped; field-rule table added (2.3); B1 to B12 regrouped into B1 to B8; exact expected OFAT differences added; 13 source-review errors fixed (row 18, `appendIdentityToUrl` class, Context class, handle list, unknown-handle rule, network and transport inventory, missing components, push build, RulesEngine globals, Assurance request side, edge domain kind factor, stale chamber comment and deprecation note); D8 recorded.
- Anything still open after round 3 goes to the pilot as a listed check.
- Pilot count of extra captures: _to be filled at pilot close_.

## 13. Clarifications

None open.
