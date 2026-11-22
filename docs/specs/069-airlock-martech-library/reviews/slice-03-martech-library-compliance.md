---
round: 1
verdict: changes-requested
reviewer: Opus 5.5 jig:reviewer (fresh, read-only)
reviewed_at: 2026-11-22T19:13:14Z
prompt_source: "the 069-03 build commit (2801d9cc; pushed with the round-1 fix commit)"
scope: spec compliance of slice 069-03 (adapters/eds/martech.js, THIRD_PARTY_NOTICES.md, its tests) against its acceptance criteria, Definition of Done and ADR-0065
---

# Slice 069-03 compliance review (round 1)

The author saved this text from the reviewer's output. The reviewer returned `changes-requested`. "This commit" is the round-1 fix commit that carries this file.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | High | With `defaultConsent: "out"`, `updateUserConsent({collect:true}); sendEvent(...)` unawaited (live, or both queued pre-boot) drops the event. | Fixed in this commit: a pending grant is set synchronously and each call snapshots it. Three H tests with no awaits; revert-checked. |
| 2 | Med | AC3(g) and the ADR claim a hold-until-grant differential, but the journey grants at once. | Fixed in this commit: a real-Chromium test with a grant delayed after `martechEager` equals the stock run. |
| 3 | Med | AC6's default path, `trackPageView: false`, body hide/restore are not shown: the journey never calls `martechEager`. | Fixed in this commit: a Chromium journey runs `martechEager`, `martechLazy`, `martechDelayed` for three variants and compares requests and body style changes with stock. Carried: personalization off, late display and synthetic-offer render, and `propositionDisplay` need an offer scenario (owner: 069-05, AC6 reworded). |
| 4 | Med | The `martechConfig.airlock` boot path is not run in a browser. | Fixed in this commit: one real-Chromium test boots the chamber through it with no pre-booted handle. |
| 5 | Med | A throwing page `onBeforeEventSend` rejects `sendEvent`; the pinned aem-martech catches it and drops the event. | Fixed in this commit: caught at library level (`hook-threw`, dropped, resolves); AC4(d), header and deviation log reworded; the bridge wrapper still rejects. Revert-checked. |
| 6 | Med | A boot failure leaves queued and later calls hanging. | Fixed in this commit: all queued calls reject and later calls reject at once. Revert-checked. |
| 7 | Med | The attach happens at boot when a pre-boot call was queued, against 069-02 AC4. | Fixed in this commit: the data layer attaches at `martechLazy`; pre-boot calls replay at boot (`flushCalls`). AC4 reworded. |
| 8 | Low | `THIRD_PARTY_NOTICES.md` lacks the license text; the header understates how close the file is to upstream. | Fixed in this commit: full Apache-2.0 text, no-NOTICE-file note, inferred copyright holder marked as such; the header says it closely follows aem-martech. |
| 9 | Low | The cross-slice `onDrop` edit to 069-02's file is not recorded. | Fixed in this commit: Findings name `onDrop` and `flushCalls` as cross-slice changes. |
| 10 | Low | 069-02's `uninstallAdobeDataLayerProxy` question is still open. | Carried with an owner: 069-04 (no spec needs it). |
| 11 | Info | The Findings said the reviews had not run. | Fixed in this commit: removed. |
