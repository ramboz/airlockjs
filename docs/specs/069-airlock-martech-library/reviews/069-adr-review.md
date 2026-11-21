---
round: 1
verdict: changes-requested
reviewer: Opus 5.5 jig:reviewer (fresh, read-only)
reviewed_at: 2026-11-21T16:35:00Z
prompt_source: ADR-0065, spec 069 slices 01 and 02 and re-scoped slice 064-31 as drafted before the commit that adds this file (squashed into the docs(adobe) ADR-0065 commit on vendor-adobe)
scope: ADR-0065, slices 069-01 and 069-02, 064-31 re-scope
---

# ADR-0065 and slice review (round 1)

The author saved this text from the reviewer's output. The reviewer returned `changes-requested`. The author fixed every finding in the same docs commit; no re-review has run, so the verdict above stays the reviewer's. A fresh round is run if the owner asks for one before acceptance.

Every finding below is marked fixed (in the docs commit that carries this file) or carried.

## High

1. **069-01 AC1 resolved `{}` for a push held at the seal.** Stock's eager phase waits up to 1000 ms, and the adapter keeps a held entry pending until the vector releases it. Fixed: a held push stays pending and settles with its result; `{}` only on ring drop or dispose; a test grants consent inside the timeout and propositions render; the hold test is revert-checked.
2. **`martechConfig.airlock` could carry `consent` or `consentHold`.** The first grants before any consent call; the second leaves the consent reference unset, so `updateUserConsent` does nothing. Fixed: ADR point 2 allowlists `bundleUrl` and `workerUrl` only and rejects the rest; 069-02 AC3(f) tests it.

## Medium

3. **`idMigrationEnabled` "passed to `bootAlloy`" was false.** Fixed: diagnosed `unsupported-option`; 064-31 AC1 corrected; 069-02 AC4 and the third arm show the requests still match.
4. **`defaultConsent: "out"` mapped to a denied boot vector** (extra set-consent request; ring-held events released by a later grant). Fixed: honoured as the library discarding events and never booting a denied vector; 069-02 AC3(g) is a real-Chromium differential.
5. **`martechLazy` row misstated stock** (page view comes from `martechEager`'s `finally` by default; `performanceOptimized: false`, `trackPageView: false` and late displays were missing). Fixed in the ADR row; 069-02 AC6 lists each flow.
6. **No pre-boot queue, and `getAirlockHandle` timing unclear.** Fixed: the library queues `sendEvent`, `getPersonalizationForView`, `applyPersonalization` and `updateUserConsent` before boot and replays them in order; `getAirlockHandle` is defined as "once it exists"; 069-02 AC4 tests both.
7. **069-01 AC2 and AC3 had no hook runner** (the handle never runs hooks; the library comes later). Fixed: a shared main-thread helper in 069-01 with the wrapper as the airlock arm; context-merge survival added to AC2 and to the ADR Assumptions.
8. **064-31 AC6 and AC7 dropped items silently** (`renderDecisions: true` check, `datasetId`, `type` versus `xdm.eventType`). Fixed: carried into 069-02 AC6 and AC7, and named in 064-31.
9. **`dataLayerInstanceName: "alloy"` would write a forbidden global.** Fixed: rejected with a plain Error; 069-02 AC2 tests it.
10. **`dataLayerUrl` was a new page-configurable script load, not listed as a key, and sat uneasily beside refusing `launchUrls`.** Fixed: same-origin only, listed as a library-only key, and the ACDL-versus-Launch distinction is stated; 069-02 AC4 tests the cross-origin rejection.
11. **`getAirlockHandle` "adds no capability" was too strong.** Fixed: the threat model is stated (module export, not a global; ambient globals are the concern).
12. **069-01 AC5 settling was unbounded and the outcome comes from an untrusted chamber.** Fixed: timeout, dispose settlement, the two defined edge cases, and a revert-checked forged-outcome test.

## Low

13. `context` default and the `onBeforeEventSend` strip before `bootAlloy` were omitted. Fixed in the `initMartech` row and 069-02 AC4.
14. 069-02 AC7 `__view__` check had no pass condition. Fixed: the scopes live Alloy sends, or a diagnostic.
15. The third-party notice file did not exist. Fixed: 069-02 AC9 creates `THIRD_PARTY_NOTICES.md` at the repository root.
16. 069-01 AC7 "resolves nothing" was ambiguous. Fixed: resolves `{}` (`setAdobeConsent` rejects).
17. Dependencies omitted 064-29, and 064-31 omitted 069-01 and 069-02. Fixed. Slice status stays READY_FOR_IMPLEMENTATION, with the ADR-acceptance box in each DoR as the gate; 064-31 closes when both 069 slices are DONE (carried: owner is the 069-02 builder).
