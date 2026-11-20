---
status: DONE
dependencies: [064-19, 064-20, 064-26]
last_verified: 2026-11-20
---

## Slice 064-21 — B5: aem-martech, ACDL and Launch

**Goal:** `aem-martech`, ACDL 3.0.1 and the Launch bridge work through the airlock; the ADR-0038 adoption decision is recorded.

**DoR:**
- ✅ B3 and B4 done.
- ✅ 064-26 done: rows 4 to 7 and 9 are site-callable through `handle.command`.

**Acceptance Criteria:**

1. Decision is one of drop-in, wrapper or not viable, with evidence. **Met: wrapper** (inside ADR-0063; Findings).
2. Fixture S10 (POC site, `aem-martech` + ACDL + Alloy 2.31.1, no Launch, D10) compares clean, except the set-consent request (body and host) -> 064-31 AC4 and the identity fetch list `["ECID","CORE"]` vs `["ECID"]` -> 064-31.
3. The Launch bridge is a gap row owned here (D10): tagged `live-only` (no Launch property exists; the journey loads none).

**DoD:**
- `npm test && npm run lint` and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.

## Findings

### Verdict: wrapper (ADR-0038 adoption decision, AC1)

Not drop-in: `aem-martech` hard-codes `await import('./alloy.min.js')` and then calls a main-thread `window.alloy`. The airlock itself exposes no page-global `alloy` (ADR-0063); the global the bridge installs is the site's own explicit call to `attachAlloyBridge`, which reaches only `handle.push`, `setConsent`, `applyPropositions` and `command` (ADR-0063 line 49: "a site ... can map it ... in its own code"). Not "not viable": every call the POC journey makes maps onto `push`, `handle.setConsent`, `handle.command` and boot options, which is the shape ADR-0063 line 49 anticipates. The site serves its own `./alloy.min.js` (one line that calls the page's attach function) and the adapter's `attachAlloyBridge` (new `adapters/eds/alloy-bridge.js`) drains aem-martech's queue stub into `createAlloyCommandBridge`. No new capability grant, allowlist change or `core/` change; `core/wrapped-sdk-host.js` is untouched.

Pinned inputs (downloaded at test time into the gitignored `rig/out/b5/`, SHA-256 checked, `rig/adobe-b5-martech.mjs`): `aem-martech` 1aa3dee3c4791636efa9ad2994342f861c8e149b `src/index.js` `e26eeb5ff4b54355e7170c4d7556bfc5d6198a2bbbf32525b62301367c2a032f`; ACDL 3.0.1 `src/acdl.min.js` `c8d3a94761576569086cdc65e2bd9bbcfa6ccbf73fe1adf0709f815c684b778c`; Alloy 2.31.1 `7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8` (the B1 pin). `aem-martech` is Apache-2.0 (its LICENSE hash `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4`).

### Call map (AC1, AC2)

All in `test/adobe-b5-martech.test.js`. "Real" = real Chromium (`AIRLOCK_REAL_CHROMIUM=1`, GATING step in `browser-oracle`); "hermetic" = no browser.

| POC call | Through the airlock | Covered by |
|---|---|---|
| `initMartech(webSDKConfig, martechConfig)` | `alloy("configure", {onBeforeEventSend})`: only the function-valued hook is taken, other callbacks diagnose `unsupported-callback`; the rest is boot options (`orgId`, `datastreamId`, `edgeDomain`, `context`) | real: "AC2 (recorded S10) ... in the recorded order"; hermetic: "diagnoses a callback it cannot carry" and "sendEvent maps to push, carries the per-call options, and lets onBeforeEventSend edit or drop the event" ; hermetic "reports both overrides, a throwing hook (event dropped) and a consent value it cannot map" (a throwing hook drops the event with a `hook-threw` diagnostic) |
| `updateUserConsent({collect, personalize, marketing:false, share:false})` | `alloy("setConsent")` -> `consentToVector` -> `handle.setConsent` (`collect`, `personalize.content`; `marketing` and `share` are not carried) | hermetic: "setConsent maps Adobe 2.0 ..."; real: set-consent body test |
| `sendEvent({type:"decisioning.propositionFetch", decisionScopes, personalization, ...})` | `push` with the per-call `decisionScopes` and plain `personalization` options (new, connector + adapter); the connector no longer classifies `propositionFetch` as a notification | hermetic: `test/alloy-connector.test.js` "explicit propositionFetch and per-call personalization options" (the propositionFetch, scope-merge and `__view__`-suppression tests fail without the fix (the notification-only and explicit-boolean tests also pass without it)); real: "the interact body is the recorded one ..." and "SYNTHETIC ..." (fail without the fix) |
| `sendAnalyticsEvent(xdm, data, {})` | `sendEvent({documentUnloading:true, xdm, data, edgeConfigOverrides:{}})` -> `push` with `documentUnloading`; empty overrides are dropped, non-empty overrides diagnose `unsupported-option` | real: SYNTHETIC differential (collect 1); hermetic: "diagnoses ... per-event config overrides" |
| `martechLazy()` (ACDL 3.0.1 load, `adobeDataLayer:event` listener) | ACDL runs on the page unchanged (not an Alloy call) | real: SYNTHETIC differential (collect 2) |
| `pushEventToDataLayer(LINK, xdm, data)` -> `sendAnalyticsEvent` | as above | real: SYNTHETIC differential, `link.data.__adobe.analytics.linkName` check |
| `martechDelayed` with `launchUrls: []` | no request | real: "AC3 ... no Launch property" |

The `alloy(cmd, opts)` queue drain (`stub.q`) is covered by the hermetic "attachAlloyBridge drains the loader's queue stub in order".

### AC2: what is compared with what

- **Recorded S10 (real):** the airlock run's POST order is set-consent, interact, collect, collect (paths and methods equal the recording). The interact URL equals the recorded one; the interact body differs only at `query.identity.fetch[1]`.
- **SYNTHETIC (real):** the collect bodies were not captured. Stock aem-martech on stock Alloy 2.31.1 (main thread) and aem-martech on the wrapper run the same journey against the same Edge answers; all four requests' paths and bodies are compared (cookie entries sorted, generated fields normalised). This is a differential, not a capture, and is labelled so in the test names.
- Differences found, each with an owner: the set-consent body (`marketing`, `share`, `personalize.content`) and its host (the airlock sends `adobedc.demdex.net`, stock with `edgeDomain` sends `edge.adobedc.net`) -> 064-31 AC4; `query.identity.fetch` `["ECID","CORE"]` vs `["ECID"]` (stock `idMigrationEnabled:false` is not a boot option), the wrapper resolving `{}` instead of the interact result, and `onBeforeEventSend` seeing the site's `xdm` without the context merged in -> 064-31 (new slice, READY_FOR_IMPLEMENTATION).

### Launch bridge (AC3, D10)

Tagged **live-only**. The POC page has `launchUrls: []`; no Launch property exists and the S10 recording and both runs show no request to a Launch host. If a property appears, it is a new gap row then.

### Core and consent

No `core/` change. The consent surface is unchanged; `consentToVector` is the wrapper's own mapping onto the existing vector.
