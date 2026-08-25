---
status: CONCLUDED
topic: hosting Adobe Alloy (AEP Web SDK) in a no-DOM Web Worker chamber
created: 2026-08-25
related:
  - ../decisions/adr-0001-chamber-isolation-strength.md
  - ../reviews/2026-08-25-mvp1-architecture-review.md
  - ../../probes/alloy-worker/
---

# R-004: Alloy in a Web Worker

## Question

Can the stock Adobe Experience Platform Web SDK (Alloy) run inside a Web
Worker with no real DOM, and does a synchronous in-worker cookie cache with
async write-back satisfy its synchronous `document.cookie` dependency? This
decides whether the MVP1 capability contract can be pinned before MVP2
without freezing the wrong shape (arch-review R3).

## Sources / findings

Two phases: a documentation fact-check (Adobe Experience League, adobe/alloy
repo; arch-review Verification appendix D), then an **executed probe**
([probes/alloy-worker](../../probes/alloy-worker/)) that runtime-validated it
on 2026-08-25.

### Documentation phase (predicted)

- Alloy auto-collects ambient context (`document`/`window`/`screen`/
  `navigator`/`Intl`) but collection is disableable via `context: []` with
  host-supplied XDM; only `timestamp`/`implementationDetails` are
  non-removable (and need no browser globals).
- Identity is persisted in first-party cookies (`kndctr_*`, `AMCV_*`,
  `demdex`, `s_ecid`, `com.adobe.alloy.getTld` probe cookie) via a
  js-cookie-style **synchronous `document.cookie`** wrapper; `sessionStorage`
  is also used and does not exist in worker scope.
- Personalization has an official headless mode: `renderDecisions: false`
  returns propositions as data; the host applies. The prehiding snippet is
  inherently main-thread.
- No public prior art runs Alloy in a real DOM-less worker; Partytown (the
  only OMT-martech prior art) *fakes* a synchronous DOM instead (see
  [R-003](R-003-partytown-mechanism-check.md)).

### Executed probe (confirmed)

`@adobe/alloy@2.35.0`, unmodified `dist/alloy.js` (766 KB standalone IIFE),
loaded via `importScripts` in a classic Worker against instrumented shim
globals; `fetch` stubbed with a minimal Edge response so the identity
round-trip completes offline. Method and reproduction in the probe README.

- **Alloy boots, configures, and sends an event entirely in the worker** —
  bundle evaluated without throwing; `configure` and `sendEvent` both
  fulfilled. No source modification.
- **Egress is one `fetch`** to `https://adobedc.demdex.net/ee/v1/interact?...`
  with a well-formed XDM interact payload (pageView + `implementationDetails`
  2.35.0 + personalization query with `__view__` scope +
  `query.identity.fetch: ["ECID","CORE"]` + `meta.state`).
- **Synchronous `document.cookie` is the one hard dependency, fully satisfied
  by the sync-cache + async-write-back shim** (33 reads / 5 writes for one
  page + one event):
  - First access is the **getTld apex-domain probe** (`getApexDomain`,
    `alloy.js:1223`): write `com.adobe.alloy.getTld=...`, read it back,
    remove it — synchronously, at the very first command.
  - Identity/consent writes: `kndctr_SPIKE_AdobeOrg_consent`,
    `kndctr_SPIKE_identity`, `AMCV_*=MCMID|<ECID>` — including persisting the
    ECID from the (faked) Edge response synchronously, each mirrored async to
    the real `document.cookie`.
- Storage use is light: `sessionStorage` (debug flag) + `localStorage`
  (validation clientId), covered by an in-memory shim.
- Only benign unstubbed globals were touched (`window.scrollY`/`scrollX`,
  `window.Visitor`, `window.__alloyMonitors`) — all returned `undefined`
  without breaking.
- Side discovery: Alloy ships an official `./serviceWorker.js` build
  (`dist/alloyServiceWorker.js`) but it is **push-notification-only**, not a
  general off-main-thread runtime.

## Open questions

- Live end-to-end (real datastream, real ECID issuance, cluster routing,
  third-party `demdex` sync) — the probe faked the Edge response.
- Multi-page identity continuity (seed-from-main-thread is in place but was
  seeded empty).
- Sync-cache correctness under two chambers writing the same cookie —
  deferred with the MVP2 isolation decision (MVP1 is single-connector).

## Conclusion

**FEASIBLE-WITH-SHIMS, runtime-confirmed.** The strict literal "no DOM, no
ambient globals, async-only" contract is infeasible for stock Alloy; a
shimmed global scope plus a **sync-cache-with-async-write-back** cookie/storage
capability hosts it unmodified, with no SharedArrayBuffer (AD-4 preserved).
The MVP1 capability contract must therefore make first-class: (a) mediated
cookie/storage get+set with synchronous read semantics served by the cache,
(b) async context/identity injection (`context:[]` + host XDM), and
(c) decisions-as-data personalization (`renderDecisions:false`).

Promoted to: [ADR-0001](../decisions/adr-0001-chamber-isolation-strength.md)
(assumption grounding); capability-contract requirements for `/jig:contracts`
(drive-order step 5); arch-review finding R3.
