---
status: DONE
dependencies: [064-17, 064-20]
last_verified: 2026-11-20
---

## Slice 064-27 — Alloy storage grant

**Goal:** The default host policy grants the stock tag's own storage set (ADR-0062 point 7), so stock `com.adobe.alloy.*` keys persist and are reused across page loads instead of being regenerated.

**DoR:**
- ✅ B1 (064-17) storage seeding and twin; B4 (064-20) cutline.

**Acceptance Criteria:**

1. `ALLOY_STORAGE_NAMES` and `ALLOY_STORAGE_PURPOSES` are one frozen source of truth in `connectors/alloy/connector.js`, with `ALLOY_STORAGE_PURPOSES` shaped `{ [area]: { [entry]: purposes } }`, and equal what pinned Alloy 2.31.1 writes by default. Nothing stock does not write is granted.
2. The org-scoped consent-hash keys come from `alloyStorageGrant(orgId)`; `bootAlloy` uses it for the grant, purposes and narrowing. `core/` is unchanged.
3. Real Chromium, two page loads, stock vs airlock: the consent hash persists with the same value and no second set-consent is sent; the Assurance `validation.clientId` is generated once and reused.
4. A narrowed grant drops the consent-hash write visibly (`storage-scope`); a foreign page key is untouched.
5. The activity-map persistence carry from 064-20 has a recorded disposition.
6. The refinement-todo entry "Alloy chamber storage persistence" is resolved.

**DoD:**
- `npm test && npm run lint` and servo gate pass; the new test is a GATING step in `browser-oracle`.

**Anti-horizontal-phasing check:** Vertical: grant to chamber write to page storage to the next load's reuse.

## Notes (2026-11-20)

### Granted set (source-derived, pinned 2.31.1)

Paths relative to `libEs6` of `@adobe/alloy@2.31.1`. Keys are `com.adobe.alloy.` + name (`constants/namespace.js`, `utils/injectStorage.js`).

| Area | Key | Evidence | Label |
|---|---|---|---|
| localStorage | `<org with @ as _>.consentHashes.Adobe.2.0` | CAP corpus after-state; `components/Consent/index.js` | capture-verified |
| localStorage | `validation.clientId` | Assurance, written only with `adb_validation_sessionid` | source-derived |
| sessionStorage | `instance.alloy.debug` | `alloy_debug` URL parameter (`core/createLogController.js`), default instance name; not exercised in the browser test | source-derived |

All purposes are `functional`, so the consent write denial (`*_storage` purposes only) never blocks them. Purpose denial stays covered by the unit tests with a vendor mock; the real-browser denial is the host narrowing.

`IAB TCF.2.0` consent hashes are not granted: the chamber's consent driver sends only `Adobe 2.0`, so stock code in the chamber never writes them. Add them when a TCF consent path exists.

**Not granted (stock default never writes them in the chamber):** `<org>.decisioning.events` needs `personalizationStorageEnabled` (default false, not exposed by `bootAlloy`; stock only `clear()`s it at init, removal-only, a minor difference); `<org>clickData` needs `clickCollection.sessionStorageEnabled` (default false, and clicks are collected on the main thread); `<org>.pushNotifications.*` is incompatible (064-22). `fonts-loaded` (sessionStorage, seen in the corpus) is page-owned, not written by Alloy, and stays outside the grant.

### Evidence

`test/adobe-storage-grant.test.js` (real Chromium, `browser-oracle`). Stock Alloy runs on the main thread as the reference. Fixture `s1-base` supplies the page; the second-load state is **SYNTHETIC** (fake identity and consent cookies, fake Assurance session `FAKE_SESSION`, synthetic responder), because no corpus fixture has a storage before-state. Stock clears its consent hashes at startup unless both the identity and consent cookies exist, so the cookies are seeded. Stock stores the hash as a hex string. The airlock consent arm sends `setConsent` through the rig command channel, not `bootAlloy`'s `consent` boot option; the grant, write-back and reseed chain is the same. Extra captures needed: **0**.

### Activity-map persistence (064-20 carry): not ported

Stock `eventGroupingEnabled` and `sessionStorageEnabled` store `{pageName, pageIDType}` in sessionStorage `com.adobe.alloy.<org>clickData` and merge it into the next page view. The airlock collector is main-thread (`adapters/eds/link-click.js`, last page name in `adapters/eds/index.js`) and never reads the chamber grant. Porting is a collector feature that rewrites page-view events, not a grant, so no key is added. The refinement-todo entry stays open with this disposition.

### Compatibility

ADR-0062 point 6 (caps do not drop what stock keeps) and point 7 hold. Spec 067 check 8 holds for the mechanism: a caller declaring nothing keeps the unchanged behavior (`test/eds-boot-alloy-storage-default.test.js`, with a mocked connector). **Behavior change:** the real `bootAlloy` default now always seeds the chamber with the granted stock keys and writes them back to page storage (ADR-0062 point 7, intended). Spec 064 section 2 stays frozen; its storage row names the families this slice grounds.

### Review and gate

Opus 5.5, three passes (`reviews/slice-27-*.md`): compliance 2 rounds, craft 3 rounds, reconciliation 2 rounds; all pass. Round-1 medium findings fixed: the `IAB TCF.2.0` key is not granted, fixed sleeps replaced by request polling, stale docs reconciled. Carried low items: the stock reference arm still boots airlock on the same page (harmless, sends nothing); the foreign-key check seeds a page key but never attempts a denied write (the denial is covered by the narrowing test); the no-org fallback wrapper object is unfrozen (inner values are frozen). Gate: servo quality-gate composite 1.0 pass, `npm test` 2937 passed, `npm run lint` clean, `test/adobe-storage-grant.test.js` 6 of 6 in real Chromium and a GATING `browser-oracle` step.
