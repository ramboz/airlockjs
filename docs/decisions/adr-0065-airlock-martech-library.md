---
status: Proposed
dependencies: [ADR-0007, ADR-0061, ADR-0062, ADR-0063, ADR-0064, 064-21, 064-29, 064-30]
see_also: [064-31]
last_verified: 2026-11-21
frame_review: true
---

# ADR-0065: Airlock martech library

## Status

Proposed (2026-11-21).

The owner decision this implements (2026-11-20). Asked about the page-global `window.alloy` the 064-21 wrapper installed, the owner said: "we don't have to use the aem-martech here, it's fine if we had to create a new version that is tailored towards airlock usage. or maybe airlock with the alloy chamber even becomes the new aem-martech library version somehow". The follow-up answer: "Yes: no shipped global, rig-only shim, new Airlock martech library (ADR + slice) (Recommended)".

## Summary

Adobe's EDS sites run Adobe Experience Platform Web SDK (Alloy) through the `aem-martech` library, which loads Alloy on the main thread and calls a page-global `window.alloy`. Airlock runs Alloy in a chamber and has no such global. This ADR adds a new Airlock-native library, `adapters/eds/martech.js`, with the same exports as `aem-martech` that talk to the `bootAlloy` handle directly. A site swaps one import and keeps its `initMartech` / `martechEager` / `martechLazy` / `martechDelayed` calls. The library never reads or writes `window.alloy` and never loads `alloy.min.js` on the main thread. The main tradeoff: a site that calls `window.alloy` directly gets a loud failure instead of a shim, and the library stays source-compatible with `aem-martech` at the export level only.

## Context

- Today's product path is the 064-21 wrapper (`adapters/eds/alloy-bridge.js`, `createAlloyCommandBridge`): an `alloy(command, options)` function that maps stock commands onto the handle. The stock `aem-martech` can only use it through a test-only shim (`rig/alloy-queue-shim.mjs`) that installs `window.alloy`, because `aem-martech` hard-codes `await import('./alloy.min.js')` and calls `window[instanceName]`. The shipped adapter has no global, by design (ADR-0063; 064-21 Findings).
- `aem-martech` is pinned at `adobe-rnd/aem-martech` 1aa3dee3, `src/index.js` (Apache-2.0). Its 14 exports: `DEFAULT_CONFIG`, `sendEvent`, `sendAnalyticsEvent`, `pushToDataLayer`, `pushEventToDataLayer`, `updateUserConsent`, `initMartech`, `initRumTracking`, `isPersonalizationEnabled`, `getPersonalizationForView`, `applyPersonalization`, `martechEager`, `martechLazy`, `martechDelayed`. It also loads ACDL (the Adobe Client Data Layer, `acdl.min.js`) on the main thread and uses the site's `window.adobeDataLayer`.
- The handle already has what the library needs for most calls: `push` (every stock `sendEvent`, with per-call `decisionScopes` and `personalization`), `setAdobeConsent` (ADR-0064), `applyPropositions` (064-20), `command` (ADR-0063's five commands), the first-push-after-`applyResponse` path (064-29), and `bootAlloy` boot options including `thirdPartyCookiesEnabled` (064-30).
- Three things the handle does not give today, found by the 064-21 differential and parked in slice 064-31: `push` returns nothing, while `aem-martech`'s eager phase reads `propositions` from what `sendEvent` resolves with; `handle.applyPropositions` takes propositions but not a `viewName`, which stock Alloy 2.31.1 accepts (`createApplyPropositions`: `({ propositions = [], metadata = {}, viewName })` returns `viewCache.getView(viewName)`; read from the pinned tag source); and `setAdobeConsent` does not settle with Alloy's outcome (ADR-0064 point 9).
- The seal decides egress from the live consent vector (ADR-0007, ADR-0062). The chamber is untrusted.

## Decision Options Considered

### Where the library lives

#### Option A: a module in `adapters/eds/` (recommended)
`adapters/eds/martech.js`, built into the same `AirlockEds` bundle and distributed by the same git subtree (ADR-0015) as the rest of the adapter.
- **Pros:** The library's only dependency is the `bootAlloy` handle, which lives in the same adapter. One distribution path, one version, one test setup. A site that already takes `adapters/eds/` gets it with no extra package.
- **Cons:** It grows the EDS adapter surface. The ADR-0017 frozen API contract does not list it, so it ships as experimental until a later ADR freezes it.

#### Option B: a separate package
- **Pros:** Its own version and release cadence, and a name sites could install in place of `aem-martech`.
- **Cons:** A second distribution channel for a library that cannot work without the adapter's private handle shape. ADR-0015 chose git subtree for EDS on purpose (no npm install in a buildless site). A package would have to track the adapter version one to one anyway. Rejected for now; nothing in Option A prevents extracting it later.

### How the library reaches Alloy

#### Option A: call the `bootAlloy` handle directly (recommended)
The library's `sendEvent` runs the page's hook on the main thread, then calls the handle. No `alloy(command, options)` function exists in it.
- **Pros:** No global and no command-name switch. Each export maps to a typed handle entry point the seal already governs.
- **Cons:** It needs the three handle additions in the Context (they are slice 069-01).

#### Option B: keep the wrapper and install it as `window.alloy`
- **Pros:** `aem-martech` itself would run unchanged.
- **Cons:** A shipped global that any page script can call is a capability leak the owner declined on 2026-11-20. Rejected.

## Recommended Decision

Adopt Option A in both tables. The mechanics:

1. **Shape.** `adapters/eds/martech.js` exports a factory, `createMartech(handle?, opts?)`, and the 14 `aem-martech` names plus one extra, `getAirlockHandle`, as functions bound to a default instance (module state, as in `aem-martech`: `initMartech` may run once and the other calls assert it ran). The factory exists so tests and sites can run several isolated instances without module state. The default instance is created by `initMartech`. The library is written against the pinned API surface and its observable behavior; where a small piece is a structural re-expression of `aem-martech` source (the consent-object build, the proposition-apply loop, the data-layer state merge), the file keeps the Apache-2.0 notice for `adobe-rnd/aem-martech` and the repository's third-party notice names it, as the license requires.

2. **The export map.** Each of the 14 exports, plus the extra:

   | `aem-martech` export | In the Airlock library |
   |---|---|
   | `DEFAULT_CONFIG` | Kept, same keys and values. `alloyInstanceName` stays in the object for shape but is inert (point 3). |
   | `initMartech(webSDKConfig, martechConfig)` | Kept. Same validation and errors (`datastreamId` or `edgeConfigId`, `orgId`, already initialized). It boots the chamber with `bootAlloy`, from the boot options in `martechConfig.airlock`, an allowlist of `bundleUrl` and `workerUrl` only (any other key, notably `consent` and `consentHold`, is rejected with a plain Error at `initMartech`: the first would grant before the page's consent call, the second would leave the consent reference unset so `updateUserConsent` silently does nothing), or reuses a handle passed as `martechConfig.handle`. `dataLayerUrl`, `airlock` and `handle` are library-only `martechConfig` keys, beyond `DEFAULT_CONFIG`. `webSDKConfig` maps to boot options as follows: `orgId`, `datastreamId`, `edgeConfigId`, `edgeDomain`, `context`, `thirdPartyCookiesEnabled` and `clickCollectionEnabled` are passed to `bootAlloy`; `idMigrationEnabled` is not a `bootAlloy` option today, so it is diagnosed `unsupported-option` (stock's S10 value `false` sends `query.identity.fetch` of `["ECID"]`, which 064-30's `thirdPartyCookiesEnabled: false` already produced, so the difference is closed and 069-02 shows the third arm matches without it); `context` defaults to stock's `['web','device','environment']` (the library passes it explicitly, since `bootAlloy`'s own default adds `placeContext`); `defaultConsent: "pending"` (the default) holds events until a consent call; `"out"` is honoured as the library discarding events and sending nothing until `updateUserConsent` grants (the library never boots a denied vector, because that makes the chamber send a set-consent request stock's "out" never sends and lets a later grant release ring-held events stock discards; 069-02 AC4 proves it with a differential); `"in"` is not honoured (it would grant before any consent call, which ADR-0062's consent hold forbids), the boot stays pending and a `defaultConsent-in-not-honoured` diagnostic says so; `onBeforeEventSend` stays on the main thread (point 4) and is stripped from the options before `bootAlloy` (else it would emit `unsupported-callback`). Any other option the page passes is diagnosed `unsupported-option` and not carried. Timing is stock's: boot at `initMartech` when `personalization` is on, at `martechLazy` when it is off. Like stock's `window.alloy` stub queue, the library queues `sendEvent`, `getPersonalizationForView`, `applyPersonalization` and `updateUserConsent` calls made before the handle exists and replays them in order at boot; the queue is module state, never a global. |
   | `sendEvent(payload)` | Kept. A push held at the seal stays pending until the consent vector releases it, then settles with its result (stock's `martechEager` waits up to the timeout, so a grant inside the window still applies propositions); it resolves `{}` only when the ring drops it or the handle is disposed. Runs `onBeforeEventSend` (the library's own hook, which merges the data-layer state and prunes empty `__adobe` keys, then the page's) on the main thread, then `handle.sendEvent` (a new, adapter-owned handle method that rides the same queue as `push` and resolves with the interact result's `propositions` and `decisions`, as stock's promise does). 064-31 AC2, AC3 and AC5 move here (slice 069-01). |
   | `sendAnalyticsEvent(xdm, data, overrides)` | Kept. Same body as `aem-martech`: `documentUnloading: true`, `eventType` in `xdm`. Non-empty `edgeConfigOverrides` are not carried (config-pin rule, ADR-0062) and say so with an `unsupported-option` diagnostic; the empty `{}` default is dropped silently. |
   | `pushToDataLayer(payload)` | Kept (point 5). Throws the same error when the data layer is disabled. |
   | `pushEventToDataLayer(event, xdm, data, overrides)` | Kept, same wrapper over `pushToDataLayer`. |
   | `updateUserConsent(consent)` | Kept. Builds the same Adobe 2.0 object as `aem-martech` (`collect`, `marketing` with `preferred`, `personalize.content`, `share`), queues it until configured, then calls `handle.setAdobeConsent(object)` (ADR-0064). It resolves with Alloy's outcome (064-31 AC8 moves to 069-01). The seal decides from the vector `setAdobeConsent` derives; the library never hands the seal a vector of its own (point 6). |
   | `initRumTracking(sampleRUM, options)` | Kept as the pure main-thread `track(event, cb)` helper (it never touches Alloy). `withRumEnhancer: true` is dropped with an `unsupported-option` diagnostic: the enhancer is a main-thread third-party script, and Airlock's own `bootHelixRum` replaces it. |
   | `isPersonalizationEnabled()` | Kept, pure. |
   | `getPersonalizationForView(viewName)` | Kept. `handle.sendEvent({ renderDecisions: true, xdm: { web: { webPageDetails: { viewName } } } })`, which uses the host view cache (064-23, 064-28, 064-29). Same error when `viewName` is missing. |
   | `applyPersonalization(viewName)` | Kept. `handle.applyPropositions({ viewName })`; the handle gains the `viewName` form, which renders the view cache's propositions for that view as stock Alloy 2.31.1 does (069-01). |
   | `martechEager()` | Kept. The proposition fetch (`sendEvent` with `renderDecisions: false`), the 1000 ms (configurable) timeout, the DOM-action apply loop on decorated elements, and the page-view/display report (see `martechLazy` for who sends it), all through `handle.sendEvent` and `handle.applyPropositions`. The first push after the fetch follows the 064-29 path in the adapter; the library adds nothing. |
   | `martechLazy()` | Kept. Loads the data layer (point 5) and boots Alloy when personalization is off. With `personalization` and `performanceOptimized` both on (the default) the page view was already sent from `martechEager`'s `finally`, as stock does, and `martechLazy` sends none. With personalization off or `performanceOptimized: false` it sends the page view: for `performanceOptimized: false` that is stock's single `sendEvent({ renderDecisions: true, decisionScopes: ['__view__', ...] })` with a timeout, the body hidden in `martechEager` and restored afterwards. `trackPageView: false` sends `decisioning.propositionDisplay` instead of a page view, and late displays (propositions arriving after the timeout) are reported when they arrive; 069-02 AC6 covers each. |
   | `martechDelayed()` | Differs. With the default `launchUrls: []` it resolves with no request, as stock. A non-empty `launchUrls` is not loaded (a Launch container is a main-thread script that would run outside the airlock; 064-21 tagged the Launch bridge live-only) and a `launch-not-loaded` diagnostic names each URL. A Launch bridge is a separate decision. |
   | extra: `getAirlockHandle()` | New, library-only. Returns the `bootAlloy` handle once it exists (`initMartech` with personalization on; `martechLazy` with it off), or throws before. A site that needs `getIdentity`, `appendIdentityToUrl`, `applyResponse` and the other ADR-0063 commands uses `getAirlockHandle().command(name, options)`. It adds no ambient capability: it is a module export, not a global, and page scripts are same-privilege with the site's own code (they could import `bootAlloy` and boot their own chamber). When the library boots the chamber itself, the export does hand a same-origin importer `setConsent` and `dispose`; the threat model here is ambient globals, not a hostile importer, and the library's own code never uses the handle beyond the map above. |

3. **No page global.** The library never reads or writes `window.alloy`, `window.__alloyNS` or any `window[alloyInstanceName]`, and never imports `alloy.min.js` on the main thread (Alloy runs in the chamber, loaded from the adapter's `bundleUrl`). `alloyInstanceName` is inert; setting it to anything but `"alloy"` is diagnosed `unsupported-option`. `dataLayerInstanceName` is rejected with a plain Error when it equals `alloy`, `__alloyNS` or the `alloyInstanceName` value, since the library would then write a forbidden global. A site that today calls `window.alloy(...)` directly fails loudly (the global does not exist, so the call throws): no shim and no detection, since detecting it would mean reading the global. It is told in three places: the library's header, `docs/architecture.md`, and a migration note in the slice Findings that maps each stock `alloy("command")` call to `getAirlockHandle()` (`sendEvent` to `sendEvent`/`sendAnalyticsEvent`, `setConsent` to `updateUserConsent`, `applyPropositions`, `getIdentity` and the rest to `command`). Calls with no handle counterpart are out of scope and listed there.

4. **The hook runs on the main thread.** `onBeforeEventSend` (the library's own and the page's) is a function, so it cannot cross the airlock; it runs where the page's code is, before the event is enqueued, exactly as the wrapper does today. The event the chamber sees is the hook's output. A throwing page hook drops the event, as stock does (064-31 AC5 moves to 069-01).

5. **The data layer.** The library keeps ACDL. `aem-martech`'s `window.adobeDataLayer` (or the name in `dataLayerInstanceName`) is the site's own data surface, not an Adobe egress path: ACDL makes no network request, and everything the library reads from it (the state merged into `xdm`, the `adobeDataLayer:event` payloads) is handed to the handle and passes the seal. The "no shipped global" rule is about `alloy` because a page-callable `alloy` would be a capability into the chamber. The rule does not extend to the site's data layer, which holds data the site already owns. ACDL stays a site-served main-thread file (`dataLayerUrl`, default `./acdl.min.js` beside the library, the stock location); the library neither bundles nor rewrites it. Why ACDL is acceptable and a Launch container is not: ACDL is a passive local data store with no network code and no Adobe capability, while a Launch container is a main-thread script that fires its own Adobe requests outside the airlock. `dataLayerUrl` is limited to a same-origin path or URL (a cross-origin value is rejected with a plain Error) and is a library-only `martechConfig` key (point 2). A site that sets `dataLayer: false` gets no ACDL, as stock. This is the one owner question below.

6. **Consent.** `updateUserConsent` goes through `handle.setAdobeConsent` and nothing else. The library never calls `handle.setConsent(vector)`, never derives a vector, and never reads Alloy's consent state: the seal's decision stays the vector `setAdobeConsent` derives from the same object (ADR-0064 point 1), so the object is data the chamber may send and never a signal the seal believes. A handle without `setAdobeConsent` (a composite or other handle) is rejected at creation with a plain Error, since silently falling back to the vector would drop `marketing` and `share` without the page knowing.

7. **The wrapper.** `createAlloyCommandBridge` stays as a lower-level, stock-shaped API for a site that has its own `alloy(command, options)` code and wants to own the global itself. It is not the `aem-martech` path any more. It receives no new parity work: it picks up the 069-01 handle additions only where they are free (its `sendEvent` resolves with the result when the handle offers `sendEvent`). Slice 064-31 is re-scoped against this.

8. **No `core/` change and no ADR-0063 allowlist change.** The three handle additions (`sendEvent`, `applyPropositions({ viewName })`, a settling `setAdobeConsent`) live in `adapters/eds/index.js` and, for the consent acknowledgement, the Alloy chamber's message handling under `connectors/alloy/`. They are not ADR-0063 commands (`handle.command` and its five-command allowlist are unchanged). If the slice finds it needs a `core/` change, it must be vendor-neutral and named in its Findings.

9. **The proof.** A third arm in the S10 B5 differential (`test/adobe-b5-martech.test.js`: real Chromium, pinned Alloy 2.31.1, the recorded S10 corpus, and the stock `aem-martech` run). The library's requests (order, paths, methods, hosts, bodies) equal the recording and the stock run, and `window.alloy` stays `undefined` in the page for the whole run. Hermetic tests cover each export in the map and the security-relevant rules (no global, consent only through `setAdobeConsent`, the seal deciding from the vector). The recording and the frozen corpus are the only inputs; no new live capture.

### Relation to the other ADRs

- ADR-0063: unchanged. The library reaches the five commands only through `handle.command` (via `getAirlockHandle`).
- ADR-0064: `updateUserConsent` is the first product caller of `setAdobeConsent`.
- ADR-0062: the consent hold, the endpoint ceiling and the config pin are untouched. `defaultConsent: "in"` is not honoured so the library cannot grant before the page's consent call.
- ADR-0017: the library ships experimental; freezing it is a later ADR.

## Consequences

**Becomes easier:**
- An Adobe EDS site moves off the main-thread Alloy by changing one import and adding one boot option block. No page global exists.
- The proof is one differential against the real stock library, not a description of it.

**Becomes harder:**
- A second surface to keep in step with `aem-martech` releases. The pin (1aa3dee3) and the third arm of the differential catch drift only when the pin is moved on purpose.
- Sites that call `window.alloy` directly must change those calls. This is deliberate.
- `martechDelayed` does not load Launch containers; a site that needs one stays on its own loader until a Launch decision exists.
- The handle gains three adapter methods the wrapper and the library share.

**Not changed:**
- `core/`, the ADR-0063 allowlist, the endpoint ceiling, the consent hold and the 068 opt-out.
- The wrapper's existing behavior.

## Assumptions

- `aem-martech` 1aa3dee3 `src/index.js` exports exactly the 14 names above (read from the pinned file on 2026-11-21).
- Alloy 2.31.1's `applyPropositions` accepts `viewName` (read from the `@adobe/alloy@2.31.1` tag: `createApplyPropositions.js`).
- The interact response's `propositions` and `decisions` can be collected per event inside the adapter from the deliveries the event produces. The adapter already tracks them per event (`noteAttempts`, `settleDeliveries`, the view cache). Slice 069-01 proves this against the recorded S10 interact; if it cannot, the slice reports `blocked` and the ADR is revisited.
- `onBeforeEventSend` can be given the same `xdm` stock passes it (context merged in) on the main thread, and hook edits to context fields survive the chamber's own Alloy context merge. This is 064-31 AC3's open question and is proven in 069-01.
- A silent chamber must not leave `updateUserConsent` pending forever: the settling `setAdobeConsent` is bounded by a timeout and settles on dispose (069-01 AC5).

## Kill criteria

- The S10 differential's third arm cannot match the stock run without a `core/` change or an allowlist change: stop and bring it back.
- Per-event interact results cannot be built in the adapter without trusting the chamber's own word about what egress happened.

## Open questions

One for the owner. Does the "no shipped global" rule stop at `alloy`, so the library keeps the site's own `window.adobeDataLayer` and loads ACDL on the main thread as `aem-martech` does? Recommendation: yes. ACDL does no network request, the data it holds is the site's own, and the library only forwards what it reads through the seal. The alternative (an Airlock-owned data layer) would break every site that already pushes to `adobeDataLayer`.
