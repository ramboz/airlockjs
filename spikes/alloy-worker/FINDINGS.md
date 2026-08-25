# Spike: Alloy in a Web Worker — findings

Date: 2026-08-25. Throwaway feasibility probe. Grounds
[ADR-0001](../../docs/decisions/adr-0001-chamber-isolation-strength.md) and the
capability-contract shape (drive-order step 5). See the
[MVP1 architecture review](../../docs/reviews/2026-08-25-mvp1-architecture-review.md)
R3 / Verification D.

## Question

Can the stock Adobe Experience Platform Web SDK (Alloy) run inside a Web Worker with no
real DOM, and does a synchronous in-worker cookie cache with async write-back satisfy its
synchronous `document.cookie` dependency? This decides whether the MVP1 capability
contract can be pinned before MVP2 without freezing the wrong shape.

## Method

- `@adobe/alloy@2.35.0`, unmodified `dist/alloy.js` (766 KB standalone IIFE), loaded via
  `importScripts` in a classic Web Worker.
- Instrumented shim globals installed before load: `window` / `document` / `navigator` /
  `screen` (logging Proxies), an in-memory `sessionStorage` / `localStorage`, and a
  `document.cookie` backed by a **synchronous in-worker string cache** seeded from the main
  thread, with every set mirrored asynchronously to the real `document.cookie` (the
  "sync-cache + async write-back" shim under test).
- `fetch` stubbed to log the egress and return a minimal Edge Network response
  (`identity:result` + `state:store`) so the identity round-trip completes offline.
- Boot sequence: base-code queue snippet → load bundle →
  `configure({datastreamId, orgId, context:[], debugEnabled:true})` →
  `sendEvent({renderDecisions:false, xdm:{pageView}})`.
- Harness: `spikes/alloy-worker/` (`server.mjs`, `index.html`, `worker.js`). Reproduce with
  `npm install` then `node server.mjs` and open `http://localhost:8117/`.

## Result: FEASIBLE-WITH-SHIMS, confirmed at runtime

- **Alloy boots and runs entirely in the worker.** The unmodified bundle evaluated without
  throwing; `configure` fulfilled; `sendEvent` fulfilled. No source changes.
- **Egress is one `fetch`** to `https://adobedc.demdex.net/ee/v1/interact?...` carrying a
  well-formed XDM interact payload: `events[].xdm` with `implementationDetails`
  (alloy 2.35.0, `environment:"browser"`), the pageView, a personalization query with
  `decisionScopes:["__view__"]`, `query.identity.fetch:["ECID","CORE"]`, and `meta.state`.
  This is exactly what a wrapped-SDK connector would emit.
- **Synchronous `document.cookie` is the one hard dependency, and the sync-cache shim
  satisfied all of it** (33 reads, 5 writes for one page + one event):
  - First access is the **getTld apex-domain probe** (`getApexDomain`, `alloy.js:1223`):
    write `com.adobe.alloy.getTld=...`, read it back, remove it — synchronously, at the very
    first command.
  - Identity + consent: it wrote `kndctr_SPIKE_AdobeOrg_consent`, `kndctr_SPIKE_identity`,
    and `AMCV_SPIKE%40AdobeOrg=MCMID|<ECID>`. It read existing identity, sent the request,
    and **persisted the ECID from the (faked) Edge response back into cookies
    synchronously**, with the write-back mirrored to the main thread.
- **Storage is light**: `sessionStorage` (debug flag) and `localStorage` (validation
  clientId), covered by the in-memory shim.
- **No DOM rendering needed**: with `renderDecisions:false` the decisions come back as data
  for the host to apply (the "decisions as data" model). The only unstubbed globals Alloy
  touched were benign and returned `undefined` without breaking it: `window.scrollY` /
  `scrollX` (activity context, silent under `context:[]`), `window.Visitor` (legacy
  visitor.js check), `window.__alloyMonitors`.

## Implications

- **ADR-0001's assumption is runtime-validated.** Alloy needs synchronous cookie/storage; a
  plain no-DOM worker cannot host it unmodified; a shimmed global plus a
  sync-cache-with-async-write-back does. The MVP2 isolation choice stays coupled to this
  sync-access mechanism, and the sync-cache path preserves AD-4 (no SharedArrayBuffer needed
  for this probe).
- **The MVP1 capability contract (step 5) must expose, as first-class capabilities:**
  (a) mediated cookie get/set with synchronous read semantics served by the cache,
  (b) async context/identity injection so `context:[]` plus host XDM replaces ambient
  collection, and (c) decisions-as-data personalization. These are exactly the three
  provisions the review's R3 named; this probe shows they are sufficient to host a real
  wrapped SDK.
- A separate discovery: Alloy ships an official `./serviceWorker.js` build
  (`dist/alloyServiceWorker.js`), but it is **push-notification only**
  (`push` / `notificationclick` handlers), not a general off-main-thread runtime. It does
  not change the feasibility question, but it is the natural home for the push-notification
  capability if that ever enters scope.

## Caveats (what this probe does NOT prove)

- Offline only: a **faked** Edge response and a dummy datastream. Not a live end-to-end flow,
  real ECID issuance, cluster routing, or third-party `demdex` sync.
- One page + one event. Not multi-page identity continuity (the seed-from-main-thread
  mechanism is in place but was seeded empty here), not personalization application, not the
  prehiding/flicker path (which is inherently main-thread).
- `renderDecisions:false` headless path only.
- Correctness of the sync-cache under adversarial timing (two chambers writing the same
  cookie) is untested; MVP1 is single-connector, so this is deferred with the MVP2 isolation
  decision.
