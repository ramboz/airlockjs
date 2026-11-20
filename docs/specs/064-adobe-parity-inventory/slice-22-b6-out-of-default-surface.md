---
status: DONE
dependencies: [064-18]
last_verified: 2026-11-20
---

## Slice 064-22 — B6: Out-of-default-surface disposition

**Goal:** Media, push, conversation, Advertising and Assurance each get a disposition: implement, or incompatible or live-only with a reason.

**DoR:**
- ✅ B2 done.

**Acceptance Criteria:**

1. Push is noted as needing a separate service-worker build that `alloy.min.js` does not contain.
2. The Assurance request side (`adb_validation_sessionid` in `location.search` plus localStorage `validation.clientId`) is fixtured; only the session itself is live-only.
3. BrandConcierge streaming fetch and its `bc_session_id` cookie are dispositioned.
4. The 7 datastream gap rows of spec 064 6.5 (DS-17 to DS-20, DS-22, DS-24, DS-34) are known gaps owned here (D11). Their client-side handling is derived from the pinned 2.31.1 source and labeled source-derived, not capture-verified; their server responses stay unverified and outside the v1.0 claim until owned resources exist.
5. Each result is recorded in this slice and in the B7 compatibility report. Spec 064 section 2 stays frozen.

**DoD:**
- `npm test && npm run lint` and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.

## Notes (2026-11-20)

**Done.** Every row below has a disposition. Evidence is real: `test/adobe-b6-surface.test.js` runs the pinned Alloy 2.31.1 bundle in the unmodified chamber (real Chromium, `browser-oracle` job). All of it is **source-derived or synthetic, not capture-verified** (D11): the frozen corpus has no Media, push, BrandConcierge, Advertising or Assurance request. Source paths are relative to `packages/core/src` of tag `@adobe/alloy@2.31.1`.

**For 064-15 (B7):** the table below is written to be lifted unchanged into the compatibility report.

| Row | Disposition | Evidence | Label | Reason |
|---|---|---|---|---|
| s2.1 `createMediaSession` | incompatible (v1.0) | test "createMediaSession also rejects as unconfigured"; `components/StreamingMedia/` | source-derived | `bootAlloy` has no host option for `streamingMedia`, so Alloy rejects "Streaming media is not configured". Function form of `getPlayerDetails`: incompatible as a function, per 064-19 AC2 (decided, see slice 19 notes). A main-thread adapter that pushes player details as data is a future option. |
| s2.1 `sendMediaEvent` | incompatible (v1.0) | test "rejects each command" | source-derived | Same unconfigured rejection; the request would go to `/va` (`createMediaRequest.js`), which is not on the allowlist and would be held. |
| s2.1 `getMediaAnalyticsTracker` | incompatible (v1.0) | same test; `components/MediaAnalyticsBridge/` | source-derived | Legacy bridge over the same `streamingMedia` config: "Streaming media is not configured". |
| s2.1 `sendPushSubscription` | incompatible (v1.0) | same test; `components/PushNotifications/index.js` | source-derived | Needs config `vapidPublicKey`/`appId`/`trackingDatasetId` (not exposed), `navigator.serviceWorker`, `PushManager`, granted notification permission and a page-registered service worker; a worker chamber has no permission prompt and no page registration. |
| s2.1 `sendConversationEvent` | incompatible (v1.0) | test "the conversation request is not on the allowlist"; `components/BrandConcierge/` | source-derived | POSTs `/brand-concierge/conversations`, which is not on the allowlist: held at the seal (`endpoint-ceiling`), Alloy makes 4 attempts (3 retries, 2/3/5 s) then rejects. `onStreamResponse`: incompatible as a function, per 064-19 AC2; the "B6 may propose chunked data delivery" option is not taken for v1.0 (post-v1.0). |
| s2.2 Media | incompatible (v1.0) | as the three Media rows | source-derived | See above; `/va` is held. |
| s2.2 Push (AC1) | incompatible (v1.0) | as `sendPushSubscription` | source-derived | Push needs a **separate service-worker build** (`serviceWorker.js`, rollup variant `SERVICE_WORKER`, output `dist/alloyServiceWorker[.min].js`) that `alloy.min.js` does not contain, registered by the site on the main thread. |
| s2.2 BrandConcierge streaming fetch | incompatible (v1.0) | as `sendConversationEvent` | source-derived | The seal bridges whole responses, not incremental SSE chunks, so streaming would be non-incremental even if allowed. Not allowlisted on purpose. |
| s2.2 BrandConcierge `bc_session_id` cookie | covered by the cookie scope, unused | `connectors/alloy/connector.js` (`kndctr_` prefix) | source-derived | `kndctr_<org>_bc_session_id` falls under the `kndctr_` prefix. Alloy removes it at startup unless `conversation.stickyConversationSession` is true; no request is sent, so it is never set. |
| s2.2 Advertising (iframe, `message` listener, ID5 script) | incompatible (v1.0) | 064-18 tags `iframe-not-bridged` and `script-not-bridged`; `components/Advertising/` | source-derived | Needs a hidden (0x0, `display:none`) DOM iframe on `pixel.everesttech.net`, a `window` `message` listener (origin `www.everestjs.net`), third-party cookies and a script load. Config is not exposed by `bootAlloy`. Tagged, never silent. |
| s2.2 Audiences activation pixels | live-only (effect is server-side) | test "a URL destination does not leave the chamber"; probe: `activation:push` cookie destinations are dropped as un-granted names unless `kndctr_` prefixed | source-derived | URL destinations and ID-sync fire an IMG; tagged `pixel-not-bridged`, no network. The effect is on the vendor ID graph, which needs a live check. `hideReferrer:true` destinations (and ID-syncs that use them) go through `fireInIframe`, which waits for a page `BODY` the chamber never has: it times out after 5 s, creates no element and emits no tag, so nothing leaves but it is not tagged (test: no network). Corpus only has `hideReferrer:false`. |
| s2.2 ActivityCollector config | incompatible as configured | `components/ActivityCollector/configValidators.js` | source-derived | The chamber sets `clickCollectionEnabled:false`; clicks are a main-thread concern. `filterClickProperties` and `onBeforeLinkClickSend`: incompatible as functions, per 064-19 AC2. |
| s2.2 Debug / Assurance, request side (AC2) | **fixtured**, source-derived | tests under "AC2: Assurance" (synthetic page inputs built in memory from `s1-base`, fake values) | source-derived, synthetic | `adb_validation_sessionid` in `location.search` plus localStorage `com.adobe.alloy.validation.clientId` add `adobeAepValidationToken=<session>\|<clientId>` (`utils/request/createGetAssuranceValidationTokenParams.js`); the query crosses the seal. The `clientId` is **not** persisted across page loads (new uuid per load, storage persistence open, see Carried). |
| s2.2 Debug / Assurance, session | live-only | n/a | n/a | The Assurance session lives in Adobe's tooling. |
| DS-17 Decision Management | known gap, owned here | test "AC4: DS-17 to DS-20"; `components/Audiences/injectProcessResponse.js` (`activation:push`/`activation:pull`) | source-derived | Client side is `decisionScopes` in the interact body (reaches the wire). Server decisions unverified, outside v1.0 (D11). |
| DS-18 Edge Segmentation | known gap, owned here | same | source-derived | Server-config toggle; client side is the same request, response handle `activation:pull`. Unverified, outside v1.0. |
| DS-19 Personalization Destinations | known gap, owned here | same | source-derived | Client side: `activation:push` handling (cookie and pixel, see Audiences row). Unverified, outside v1.0. |
| DS-20 AJO | known gap, owned here | same | source-derived | Client side: `personalization.surfaces` in the interact body (reaches the wire). Unverified, outside v1.0. |
| DS-22 Advertising | known gap, owned here | Advertising row | source-derived | Incompatible client side (above); server unverified, outside v1.0. |
| DS-24 Media Analytics | known gap, owned here | Media rows | source-derived | Trigger is `createMediaSession` and `/va`; incompatible client side; server unverified, outside v1.0. |
| DS-34 Dynamic datastream rules | known gap, owned here | `core/edgeNetwork/` | source-derived | Evaluated Edge-side with no client effect beyond request fields; unverified, outside v1.0. |

**Legend (slice vocabulary to B7 class):** incompatible = incompatible; live-only = live-only; fixtured = implemented for the request side; known gap, owned here = outside the v1.0 claim (D11); covered by the cookie scope, unused = incompatible (never exercised); incompatible as configured = incompatible with the stock config the chamber sets.

**Function-valued options:** cited from 064-19 AC2 (slice 19 notes, spec 064 note under s2.1): `getPlayerDetails` and `onStreamResponse` are incompatible as functions.

**Extra captures needed: 0 new.** The first-party CNAME gap (DS-29 / S9-06) is the existing CAP freeze gap, not owned here.

**Carried:**
- The Assurance `clientId` is not persisted: chamber storage is in-memory (`ALLOY_STORAGE_NAMES = null`), so the seeded localStorage value is not read and a fresh uuid is generated per page load. The request shape is right; no live owner yet: recorded in `docs/refinement-todo.md` ("Alloy chamber storage persistence") for a storage-grant decision.
- C4 (SCRIPT/IFRAME tagged on `src` assignment, may over-report) is untouched; no chamber code changed.
- 064-15 AC1 does not yet name this table: 064-15 should lift it.
- Stale test nit: chamber comments at `alloy-chamber.worker.js` (~193, `LOAD_REASONS`) still say "bridge is 064-22"; wording only, no code change.
- A hint-less custom host option for Media, push or BrandConcierge config is not offered; adding one is a product decision after v1.0.

**Upstream to main later:** nothing. The only code change is `replayFixture` accepting a fixture object (rig only).

**Review rounds:** 1 (`reviews/slice-22-*.md`), verdict pass on all three; the 3 medium findings (F1, C1, R1) are fixed, lows fixed or carried above.
