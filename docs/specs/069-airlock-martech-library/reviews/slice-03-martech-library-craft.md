---
round: 1
verdict: changes-requested
reviewer: Opus 5.5 jig:reviewer (fresh, read-only)
reviewed_at: 2026-11-22T19:02:17Z
prompt_source: "the 069-03 build commit (2801d9cc; pushed with the round-1 fix commit)"
scope: code craft of slice 069-03 (adapters/eds/martech.js, its hermetic and real-Chromium tests, the rig)
---

# Slice 069-03 craft review (round 1)

The author saved this text from the reviewer's output. The reviewer returned `changes-requested`. "This commit" is the round-1 fix commit that carries this file. Round 2 ran (see `slice-03-martech-library-craft-round-2.md`).

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | High | Consent race under `"out"` (unawaited grant then send). | Fixed in this commit (see the compliance review, item 1). |
| 2 | Med | Unhandled rejections from the `applyPropositions` MutationObserver callback and the trailing run. | Fixed in this commit: caught and diagnosed (`apply-propositions-failed`); H test watches `unhandledRejection`. |
| 3 | Med | The `__view__` plus named scopes diagnostic is said on every call. | Fixed in this commit: first call only; H test. |
| 4 | Med | Ignored boot options and `airlock` with a handle, a non-function `onBeforeEventSend`, and events dropped under `"out"` are silent. | Fixed in this commit: `unsupported-option` and `consent-out-event-dropped` diagnostics; H tests. |
| 5 | Med | The raw `diagnose` passed to `bootAlloy` can throw into the library. | Fixed in this commit: wrapped like the others; H test with a throwing sink. |
| 6 | Med | The `direct` queue (`dataLayer: false`) is uncapped. | Fixed in this commit: the same 200 cap, eviction and `onDrop` rejection; H test; revert-checked. |
| 7 | Med | Tests use fixed `tick()` sleeps. | Fixed in this commit: fake timers and `vi.waitFor`. |
| 8 | Med | Vacuous or circular tests: "resolves handle's result unchanged" never asserts `sendEvent`; AC4(e) mock returns the expected answer; AC4(g) title overstates. | Fixed in this commit: assertions on `sendEvent`, a partial-state mock with a whole-proposition mark, a `{}` pin for other fields, the AC4(g) title says what is shown. |
| 9 | Low | No test of `dataLayerInstanceName` for the three forbidden names; no pre-boot replay under `"out"`; no `type` versus `xdm.eventType` test. | Fixed in this commit: added. |
| 10 | Low | 069-02's API-key-list tests would not see `flushCalls`. | Fixed in this commit: both lists updated. |
