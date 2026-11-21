---
status: Proposed
dependencies: [ADR-0007, ADR-0061, ADR-0062, ADR-0063, ADR-0064, 064-21, 064-29, 064-30]
see_also: [064-31]
last_verified: 2026-11-21
frame_review: true
---

# ADR-0065: Airlock martech library

## Status

Proposed (2026-11-21), revised the same day after the owner's direction on the data layer. The owner has not accepted the first draft, which kept ACDL.

The owner decision this implements (2026-11-20). Asked about the page-global `window.alloy` the 064-21 wrapper installed, the owner said: "we don't have to use the aem-martech here, it's fine if we had to create a new version that is tailored towards airlock usage. or maybe airlock with the alloy chamber even becomes the new aem-martech library version somehow". The follow-up answer: "Yes: no shipped global, rig-only shim, new Airlock martech library (ADR + slice) (Recommended)".

The owner's direction on the data layer (2026-11-21), verbatim: "I'm not sure that ADR is necessarily good. The overall idea is to move all we can on the worker and have narrow bridges on the window object. not sure what's best here and what fit the vision while maintaining the performance first approach". After a narrow `adobeDataLayer` capture bridge was proposed: "do we even need the ACDL at all? I thought we had a thin event capture layer with airlock and we could store the behavior in a chamber, no? kinda feels that data layer should either be somehow core to the library, or designed through a chamber, but not taking ACDL as is".

## Summary

Adobe's EDS sites run Adobe Experience Platform Web SDK (Alloy) through the `aem-martech` library, which loads Alloy on the main thread and calls a page-global `window.alloy`. Airlock runs Alloy in a chamber and has no such global. This ADR adds a new Airlock-native library, `adapters/eds/martech.js`, with the same exports as `aem-martech` that talk to the `bootAlloy` handle directly. A site swaps one import and keeps its `initMartech` / `martechEager` / `martechLazy` / `martechDelayed` calls. The library never reads or writes `window.alloy` and never loads `alloy.min.js` on the main thread. It also loads no ACDL: `window.adobeDataLayer` becomes a narrow capture bridge on Airlock's own thin capture layer (object pushes, O(1)), and the data-layer behavior is Airlock's own, not ACDL as is. The main tradeoff: a site that calls `window.alloy` directly gets a loud failure instead of a shim, a site that relied on ACDL's function pushes or listeners gets a diagnostic, and the library stays source-compatible with `aem-martech` at the export level only.

## Context

- Today's product path is the 064-21 wrapper (`adapters/eds/alloy-bridge.js`, `createAlloyCommandBridge`): an `alloy(command, options)` function that maps stock commands onto the handle. The stock `aem-martech` can only use it through a test-only shim (`rig/alloy-queue-shim.mjs`) that installs `window.alloy`, because `aem-martech` hard-codes `await import('./alloy.min.js')` and calls `window[instanceName]`. The shipped adapter has no global, by design (ADR-0063; 064-21 Findings).
- `aem-martech` is pinned at `adobe-rnd/aem-martech` 1aa3dee3, `src/index.js` (Apache-2.0). Its 14 exports: `DEFAULT_CONFIG`, `sendEvent`, `sendAnalyticsEvent`, `pushToDataLayer`, `pushEventToDataLayer`, `updateUserConsent`, `initMartech`, `initRumTracking`, `isPersonalizationEnabled`, `getPersonalizationForView`, `applyPersonalization`, `martechEager`, `martechLazy`, `martechDelayed`. It also loads ACDL (the Adobe Client Data Layer, `acdl.min.js`) on the main thread, registers an `adobeDataLayer:event` listener, reads `getState()` for `includeDataLayerState`, and pushes `data-block-data-layer` blocks. ACDL runs page callbacks inside the push, which is what Airlock's capture layer (`contracts/push-api.md`, AD-2, AD-3) exists to avoid: the main thread captures, enqueues and folds a cheap projection, and interpretation happens elsewhere.
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

### Where the data-layer behavior lives (the owner picks at acceptance)

The behavior in question: the state merge behind `includeDataLayerState`, the mapping of data-layer events to `sendAnalyticsEvent` arguments, and the `data-block-data-layer` blocks. In every option the page-facing surface is a narrow bridge: `window.adobeDataLayer` (or `dataLayerInstanceName`) accepts object pushes in O(1) and nothing else. Page functions (`shouldProcessEvent`, `onBeforeEventSend`) cannot cross the airlock in any option, so a main-thread drain step stays in all of them.

#### Option A: core to the library (recommended)
`adapters/eds/martech-datalayer.js`, a pure, dependency-free module the library owns: capture on the main thread (validate a plain data object and append it: O(1) in the state size), then fold the state lazily and map events in a drain step in a separate task after `push` returns.
- **Pros:** No `core/` change and no new chamber-to-chamber path. `push` is O(1) (validate and append); the fold is lazy. The synchronous `getState()` read stays correct. The reducer is pure, so it can move into a chamber later (the main-thread `getState()` would then need a projection kept in sync, a contained cost). One module to prove against real ACDL 3.0.1 in the differential.
- **Cons:** The fold and the event mapping run on the main thread (in a separate task, and at read or send time), and each state-carrying send costs O(state size). That is a step short of "all interpretation behind the airlock".

#### Option B: designed through a chamber
A data-layer chamber receives every captured push, holds the state and maps events, and feeds the Alloy chamber.
- **Pros:** The closest fit to the vision: the main thread only captures and enqueues, and the state and the mapping live off-thread.
- **Cons:** No chamber-to-chamber path exists, so it needs a `core/` change (vendor-neutral, and named in a later ADR) or it puts a generic data layer inside the vendor Alloy chamber, which breaks the one-connector-per-chamber rule. The synchronous `getState()` read and the page functions still need a main-thread projection and drain step, so the main thread keeps most of the work. It also splits one logical Alloy send across two chambers, and the state would still have to reach the Alloy chamber in `xdm`.

#### Option C: keep ACDL, loaded as `aem-martech` does (rejected)
- **Cons:** The owner declined it: "not taking ACDL as is". ACDL runs page callbacks inside the push (INP risk on the interaction path), adds a main-thread file, and its listener model is the thing the capture layer replaced.

The recommendation is Option A now, with the reducer kept pure so Option B stays open: it needs no `core/` change, keeps the main-thread cost bounded and measured, and moving the reducer into a chamber later is a contained change.

## Recommended Decision

Adopt Option A in the first two tables, and Option A of the data-layer table pending the owner's choice. The mechanics:

1. **Shape.** `adapters/eds/martech.js` exports a factory, `createMartech(handle?, opts?)`, and the 14 `aem-martech` names plus one extra, `getAirlockHandle`, as functions bound to a default instance (module state, as in `aem-martech`: `initMartech` may run once and the other calls assert it ran). The factory exists so tests and sites can run several isolated instances without module state. The default instance is created by `initMartech`. The library is written against the pinned API surface and its observable behavior; where a small piece is a structural re-expression of `aem-martech` source (the consent-object build, the proposition-apply loop, the data-layer state merge), the file keeps the Apache-2.0 notice for `adobe-rnd/aem-martech` and the repository's third-party notice names it, as the license requires.

2. **The export map.** Each of the 14 exports, plus the extra:

   | `aem-martech` export | In the Airlock library |
   |---|---|
   | `DEFAULT_CONFIG` | Kept, same keys and values. `alloyInstanceName` stays in the object for shape but is inert (point 3). |
   | `initMartech(webSDKConfig, martechConfig)` | Kept. Same validation and errors (`datastreamId` or `edgeConfigId`, `orgId`, already initialized). It boots the chamber with `bootAlloy`, from the boot options in `martechConfig.airlock`, an allowlist of `bundleUrl` and `workerUrl` only (any other key, notably `consent` and `consentHold`, is rejected with a plain Error at `initMartech`: the first would grant before the page's consent call, the second would leave the consent reference unset so `updateUserConsent` silently does nothing), or reuses a handle passed as `martechConfig.handle`. `airlock` and `handle` are library-only `martechConfig` keys, beyond `DEFAULT_CONFIG`. There is no `dataLayerUrl` key: no ACDL file is loaded (point 5). `webSDKConfig` maps to boot options as follows: `orgId`, `datastreamId`, `edgeConfigId`, `edgeDomain`, `context`, `thirdPartyCookiesEnabled` and `clickCollectionEnabled` are passed to `bootAlloy`; `idMigrationEnabled` is not a `bootAlloy` option today, so it is diagnosed `unsupported-option` (stock's S10 value `false` sends `query.identity.fetch` of `["ECID"]`, which 064-30's `thirdPartyCookiesEnabled: false` already produced, so the difference is closed and 069-03 shows the third arm matches without it); `context` defaults to stock's `['web','device','environment']` (the library passes it explicitly, since `bootAlloy`'s own default adds `placeContext`); `defaultConsent: "pending"` (the default) holds events until a consent call; `"out"` is honoured as the library discarding events and sending nothing until `updateUserConsent` grants (the library never boots a denied vector, because that makes the chamber send a set-consent request stock's "out" never sends and lets a later grant release ring-held events stock discards; 069-03 AC3(g) proves it with a differential); `"in"` is not honoured (it would grant before any consent call, which ADR-0062's consent hold forbids), the boot stays pending and a `defaultConsent-in-not-honoured` diagnostic says so; `onBeforeEventSend` stays on the main thread (point 4) and is stripped from the options before `bootAlloy` (else it would emit `unsupported-callback`). Any other option the page passes is diagnosed `unsupported-option` and not carried. Timing is stock's: boot at `initMartech` when `personalization` is on, at `martechLazy` when it is off. Like stock's `window.alloy` stub queue, the library queues `sendEvent`, `getPersonalizationForView`, `applyPersonalization` and `updateUserConsent` calls made before the handle exists and replays them in order at boot; the queue is module state, never a global. |
   | `sendEvent(payload)` | Kept. A push held at the seal stays pending until the consent vector releases it, then settles with its result (stock's `martechEager` waits up to the timeout, so a grant inside the window still applies propositions); it resolves `{}` only when the ring drops it or the handle is disposed. Runs `onBeforeEventSend` (the library's own hook, which merges the data-layer state and prunes empty `__adobe` keys, then the page's) on the main thread, then `handle.sendEvent` (a new, adapter-owned handle method that rides the same queue as `push` and resolves with the interact result's `propositions` and `decisions`, as stock's promise does). 064-31 AC2, AC3 and AC5 move here (slice 069-01). |
   | `sendAnalyticsEvent(xdm, data, overrides)` | Kept. Same body as `aem-martech`: `documentUnloading: true`, `eventType` in `xdm`. Non-empty `edgeConfigOverrides` are not carried (config-pin rule, ADR-0062) and say so with an `unsupported-option` diagnostic; the empty `{}` default is dropped silently. |
   | `pushToDataLayer(payload)` | Kept (point 5). Pushes an object through the capture bridge. Throws the same error when the data layer is disabled. A function payload is not executed and gets a `datalayer-function-push-dropped` diagnostic. |
   | `pushEventToDataLayer(event, xdm, data, overrides)` | Kept, same object wrapper over `pushToDataLayer`. |
   | `updateUserConsent(consent)` | Kept. Builds the same Adobe 2.0 object as `aem-martech` (`collect`, `marketing` with `preferred`, `personalize.content`, `share`), queues it until configured, then calls `handle.setAdobeConsent(object)` (ADR-0064). It resolves with Alloy's outcome (064-31 AC8 moves to 069-01). The seal decides from the vector `setAdobeConsent` derives; the library never hands the seal a vector of its own (point 6). |
   | `initRumTracking(sampleRUM, options)` | Kept as the pure main-thread `track(event, cb)` helper (it never touches Alloy). `withRumEnhancer: true` is dropped with an `unsupported-option` diagnostic: the enhancer is a main-thread third-party script, and Airlock's own `bootHelixRum` replaces it. |
   | `isPersonalizationEnabled()` | Kept, pure. |
   | `getPersonalizationForView(viewName)` | Kept. `handle.sendEvent({ renderDecisions: true, xdm: { web: { webPageDetails: { viewName } } } })`, which uses the host view cache (064-23, 064-28, 064-29). Same error when `viewName` is missing. |
   | `applyPersonalization(viewName)` | Kept. `handle.applyPropositions({ viewName })`; the handle gains the `viewName` form, which renders the view cache's propositions for that view as stock Alloy 2.31.1 does (069-01). |
   | `martechEager()` | Kept. The proposition fetch (`sendEvent` with `renderDecisions: false`), the 1000 ms (configurable) timeout, the DOM-action apply loop on decorated elements, and the page-view/display report (see `martechLazy` for who sends it), all through `handle.sendEvent` and `handle.applyPropositions`. The first push after the fetch follows the 064-29 path in the adapter; the library adds nothing. |
   | `martechLazy()` | Kept. Scans `data-block-data-layer` blocks into the bridge (point 5) and boots Alloy when personalization is off. With `personalization` and `performanceOptimized` both on (the default) the page view was already sent from `martechEager`'s `finally`, as stock does, and `martechLazy` sends none. With personalization off or `performanceOptimized: false` it sends the page view: for `performanceOptimized: false` that is stock's single `sendEvent({ renderDecisions: true, decisionScopes: ['__view__', ...] })` with a timeout, the body hidden in `martechEager` and restored afterwards. `trackPageView: false` sends `decisioning.propositionDisplay` instead of a page view, and late displays (propositions arriving after the timeout) are reported when they arrive; 069-03 AC6 covers each. |
   | `martechDelayed()` | Differs. With the default `launchUrls: []` it resolves with no request, as stock. A non-empty `launchUrls` is not loaded (a Launch container is a main-thread script that would run outside the airlock; 064-21 tagged the Launch bridge live-only) and a `launch-not-loaded` diagnostic names each URL. A Launch bridge is a separate decision. |
   | extra: `getAirlockHandle()` | New, library-only. Returns the `bootAlloy` handle once it exists (`initMartech` with personalization on; `martechLazy` with it off), or throws before. A site that needs `getIdentity`, `appendIdentityToUrl`, `applyResponse` and the other ADR-0063 commands uses `getAirlockHandle().command(name, options)`. It adds no ambient capability: it is a module export, not a global, and page scripts are same-privilege with the site's own code (they could import `bootAlloy` and boot their own chamber). When the library boots the chamber itself, the export does hand a same-origin importer `setConsent` and `dispose`; the threat model here is ambient globals, not a hostile importer, and the library's own code never uses the handle beyond the map above. |

3. **No page global.** The library never reads or writes `window.alloy`, `window.__alloyNS` or any `window[alloyInstanceName]`, and never imports `alloy.min.js` on the main thread (Alloy runs in the chamber, loaded from the adapter's `bundleUrl`). `alloyInstanceName` is inert; setting it to anything but `"alloy"` is diagnosed `unsupported-option`. `dataLayerInstanceName` is rejected with a plain Error when it equals `alloy`, `__alloyNS` or the `alloyInstanceName` value, since the library would then write a forbidden global. A site that today calls `window.alloy(...)` directly fails loudly (the global does not exist, so the call throws): no shim and no detection, since detecting it would mean reading the global. It is told in three places: the library's header, `docs/architecture.md`, and a migration note in the slice Findings that maps each stock `alloy("command")` call to `getAirlockHandle()` (`sendEvent` to `sendEvent`/`sendAnalyticsEvent`, `setConsent` to `updateUserConsent`, `applyPropositions`, `getIdentity` and the rest to `command`). Calls with no handle counterpart are out of scope and listed there.

4. **The hook runs on the main thread.** `onBeforeEventSend` (the library's own and the page's) is a function, so it cannot cross the airlock; it runs where the page's code is, before the event is enqueued, exactly as the wrapper does today. The event the chamber sees is the hook's output. A throwing page hook drops the event, as stock does (064-31 AC5 moves to 069-01). `shouldProcessEvent` is the same kind of function and stays on the main thread too, but it runs in the data-layer bridge's drain step after the push returns, not inside the push (point 5).

5. **The data layer.** The library loads no ACDL (no `dataLayerUrl`, no `acdl.min.js` request) and takes no ACDL behavior as is. `window.adobeDataLayer` (and the `dataLayerInstanceName` alias, as stock aliases it) becomes a narrow capture bridge on Airlock's thin capture layer, built in slice 069-02 as `adapters/eds/martech-datalayer.js` (Option A above, pending the owner's choice):
   - **The bridge.** The library patches `push` on the existing array instance (after draining the entries already there), so references the page took earlier keep working. `push(object)` validates a plain data object (no accessors, no `Proxy`, bounded depth, so no page code runs and no cycle overflows) and appends it to a queue: O(1) in the state size, with no merge on the push path. The state is folded lazily, from the queue, when `getState()` is called, when `includeDataLayerState` needs it at send, or when the drain runs, and is cached until the next push (own keys only, `__proto__`, `constructor` and `prototype` skipped, values copied). It returns nothing meaningful, as `contracts/push-api.md` pins. The bridge is an adapter module with its own queue, not core's `airlock.push` log: that log is keyed by event type for connectors and cannot carry arbitrary page state or the `event` mapping, and widening `core/` for it is Option B's cost. It keeps the contract's shape (validate, append, no interpretation). The bridge holds no reference to the handle or a chamber, so a page push can only produce the analytics events the mapping below allows.
   - **Airlock's own behavior.** The state merge (`includeDataLayerState`, merged into `xdm` at send as stock does) is the library's reducer, proven equal to real ACDL 3.0.1's `getState()` on a corpus (069-02 AC3). A push with an `event` key maps, in a drain that runs in a separate task (so the page's handler returns first), to `sendAnalyticsEvent({ eventType, ...xdm }, data, configOverrides)` as `aem-martech`'s listener builds it, taking only those four keys from the push. The consumer attaches in the lazy phase and only when `analytics` is true, as stock registers its listener; earlier events are held and replayed in order. The send-time state merge hands the hook a copy, as ACDL's cloning `getState()` does, and costs O(state size) on the main thread per send; `push` itself stays O(1). `data-block-data-layer` blocks are scanned once in `martechLazy` and pushed through the bridge with stock's id assignment (a one-time DOM read, kept on the main thread).
   - **What is lost against ACDL, and what happens to each:**

     | ACDL feature | Disposition |
     |---|---|
     | Function pushes (`push(function (dl) {...})`) | Dropped, never executed: `datalayer-function-push-dropped`. Page code in the capture path is what AD-2 forbids. |
     | `addEventListener`, `removeEventListener`, `on`, `off` | Present but register nothing, do not throw: `datalayer-listener-not-supported`. The listener `aem-martech` registers is replaced by the bridge's own event mapping. |
     | `adobeDataLayer:event` and `adobeDataLayer:change` notifications | Not emitted. |
     | `getState` returning a deep clone | Kept as a synchronous main-thread read (the vision's cheap projection), but it returns the live state by reference, per `contracts/push-api.md` (the send-time merge copies, so hooks cannot mutate it). A stock difference, with a test. |
     | `shouldProcessEvent(payload)`, `onBeforeEventSend` | Kept on the main thread, because a function cannot cross the airlock. They run in the drain step after the push returns, never inside `push`. A throwing one drops the event with `hook-threw`. |
     | A foreign ACDL already on the array | Not replaced: `datalayer-foreign-implementation`, nothing is captured. |
     | The eager-phase fallback in stock (a shallow merge of non-event entries before ACDL loads) | Not reproduced. The bridge folds as ACDL's `getState()` does at every phase. A stock difference owned by 069-02 AC5, shown against the stock run in real Chromium. |

     Every row has an owning AC in 069-02 (AC1 foreign and late ACDL, AC2 capture cost and drain, AC3 state and the hook copy, AC4 events and timing, AC5 the rest including the eager fallback) and none is a note alone.
   - **Does the "no shipped global" rule extend to the data layer?** The rule is about `alloy`, because a page-callable `alloy` is a capability into the chamber. `window.adobeDataLayer` is the site's own data surface, and the bridge is a write-only capture surface with no capability: it reaches the chamber only through the library's fixed mapping. The library reads and writes no other global (a global-proxy test in 069-02 AC7). A site that sets `dataLayer: false` gets no bridge, as stock gets no ACDL.
   - **The stock arm keeps real ACDL.** The differential's stock arm still loads real ACDL 3.0.1; the library arm loads none, and the requests must still equal the recording and the stock run (069-03 AC1).

6. **Consent.** `updateUserConsent` goes through `handle.setAdobeConsent` and nothing else. The library never calls `handle.setConsent(vector)`, never derives a vector, and never reads Alloy's consent state: the seal's decision stays the vector `setAdobeConsent` derives from the same object (ADR-0064 point 1), so the object is data the chamber may send and never a signal the seal believes. A handle without `setAdobeConsent` (a composite or other handle) is rejected at creation with a plain Error, since silently falling back to the vector would drop `marketing` and `share` without the page knowing.

7. **The wrapper.** `createAlloyCommandBridge` stays as a lower-level, stock-shaped API for a site that has its own `alloy(command, options)` code and wants to own the global itself. It is not the `aem-martech` path any more. It receives no new parity work: it picks up the 069-01 handle additions only where they are free (its `sendEvent` resolves with the result when the handle offers `sendEvent`). Slice 064-31 is re-scoped against this.

8. **No `core/` change and no ADR-0063 allowlist change.** The three handle additions (`sendEvent`, `applyPropositions({ viewName })`, a settling `setAdobeConsent`) live in `adapters/eds/index.js` and, for the consent acknowledgement, the Alloy chamber's message handling under `connectors/alloy/`. They are not ADR-0063 commands (`handle.command` and its five-command allowlist are unchanged). If the slice finds it needs a `core/` change, it must be vendor-neutral and named in its Findings.

9. **The proof.** A third arm in the S10 B5 differential (`test/adobe-b5-martech.test.js`: real Chromium, pinned Alloy 2.31.1, the recorded S10 corpus, and the stock `aem-martech` run). The library's requests (order, paths, methods, hosts, bodies) equal the recording and the stock run, and `window.alloy` stays `undefined` in the page for the whole run. Hermetic tests cover each export in the map and the security-relevant rules (no global, consent only through `setAdobeConsent`, the seal deciding from the vector). The recording and the frozen corpus are the only inputs; no new live capture.

### Relation to the other ADRs

- ADR-0063: unchanged. The library reaches the five commands only through `handle.command` (via `getAirlockHandle`).
- ADR-0064: `updateUserConsent` is the first product caller of `setAdobeConsent`.
- ADR-0062: the consent hold, the endpoint ceiling and the config pin are untouched. `defaultConsent: "in"` is not honoured so the library cannot grant before the page's consent call.
- ADR-0017: the library ships experimental; freezing it is a later ADR.
- ADR-0002 and AD-2, AD-3 (`contracts/push-api.md`): the data layer is the thin capture layer. The bridge's push is O(1) in the state size (validate and append, no merge), the state is Airlock's reducer folded lazily, and no page function runs inside `push`.

## Consequences

**Becomes easier:**
- An Adobe EDS site moves off the main-thread Alloy and off ACDL by changing one import and adding one boot option block. No `alloy` global exists, and the data layer is Airlock's capture layer.
- The proof is one differential against the real stock library, not a description of it.

**Becomes harder:**
- A second surface to keep in step with `aem-martech` releases. The pin (1aa3dee3) and the third arm of the differential catch drift only when the pin is moved on purpose.
- Sites that call `window.alloy` directly must change those calls. This is deliberate.
- Sites that use ACDL function pushes or listeners get diagnostics and lose those behaviors (point 5's table). A site that loads its own ACDL is not replaced.
- We own a data-layer reducer that must keep matching ACDL's `getState()` for the pushes `aem-martech` sites make.
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

- ACDL 3.0.1's `getState()` on the corpus of pushes `aem-martech` sites make can be matched by a small deep-merge reducer. Slice 069-02 AC3 proves it in real Chromium with both side by side; a difference that cannot be matched is dropped with a diagnostic and a test, never left as a note.
- Validate-and-append is cheap enough for the interaction path, and the lazy fold plus the per-send O(state) copy are acceptable in a separate task. 069-02 AC2 and AC3 pin the push cost with a visit counter and record the send cost on the S10 state.

## Kill criteria

- The S10 differential's third arm cannot match the stock run without a `core/` change or an allowlist change: stop and bring it back.
- Per-event interact results cannot be built in the adapter without trusting the chamber's own word about what egress happened.
- The reducer cannot match ACDL's `getState()` on the corpus without running page callbacks in `push`: stop and bring it back.

## Open questions

One for the owner. Where does the data-layer behavior (state merge, event mapping, blocks) live: Option A, core to the library as a pure module with the main thread doing capture plus a bounded merge, or Option B, designed through a chamber? Recommendation: Option A now, with the reducer kept pure so it can move into a chamber later. Option B needs a vendor-neutral `core/` change for a chamber-to-chamber path (or a generic data layer inside the Alloy chamber), and still needs the main-thread projection for synchronous `getState()` and the drain step for page functions, so it moves little work off the main thread for the cost.
