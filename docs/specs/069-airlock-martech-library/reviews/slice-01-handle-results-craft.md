---
round: 1
verdict: changes-requested
reviewer: Opus 5.5 jig:reviewer (fresh, read-only)
reviewed_at: 2026-11-22T17:38:28Z
prompt_source: "the full diff 2dcd83fa..7032a6a3 (pushed in the commit that carries these files, squashed into it) saved at a scratch path and read by the reviewer from disk"
scope: code craft of slice 069-01 (handle results, hook helper, chamber consent outcome, tests)
---

# Slice 069-01 craft review (round 1)

The author saved this text from the reviewer's output. The reviewer returned `needs-changes`, recorded here as `changes-requested`. Dispositions below refer to the round-1 fix commit that carries this file ("this commit"). No round-2 re-review has run.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | Med | `onSettled` is last in `runEntry`'s `finally`; a throw from settling, finishing or `sendResult` leaves the `sendEvent` promise pending. | Fixed in this commit: settle always runs (inner try/catch/finally; a `settle-failed` diagnostic; the queue keeps going). Test: "a failure while finishing the event rejects the promise instead of hanging it, and the queue keeps going"; revert-checked (hangs and fails without the fix). |
| 2 | Med | No hermetic AC4 hit test. | Fixed in this commit: "the bare { viewName } on a warm view cache renders that view and resolves { propositions } without a request". |
| 3 | Low | `${ran.error && ran.error.message}` prints `undefined` for a non-Error throw. | Fixed in this commit in `alloy-bridge.js` and `before-event-send.js`. Test: a hook throwing a plain string rejects with "Caused by: plain string". |
| 4 | Low | The chamber's outcome error conflates "consent pending" and "Alloy not loaded". | Fixed in this commit. Test: "says Alloy is not loaded (not that consent is pending)...". |
| 5 | Low | When the object is rejected and the vector retry also fails, the retry's error is reported. | Fixed in this commit: the object's error is reported. Test: "reports the object's own rejection, not the retry's". |
| 6 | Low | Duplicate `renderAttempted` lookup in `deliver`. | Fixed in this commit: derived from `marked`. Covered by the existing AC1 `renderAttempted` tests. |
| 7 | Low | `changed()` is more complex than needed; `ALLOY_VERSION` is hard-coded. | Fixed in this commit: simple compare; `ALLOY_VERSION` kept with a comment pointing at the pin (no exported constant exists to derive it from). |
| 8 | Low | The consent-outcome listener is not removed on dispose. | Fixed in this commit. Test: the dispose test counts handlers; revert-checked. |
| 9 | Low | Magic number 205 in the ring-drop test; the dispose test does not check the entry is removed. | Fixed in this commit: `MAX_HELD_BEACONS` imported; the dispose test now checks the entry is gone (late outcome does not throw, a further call rejects). |
| 10 | Low | The AC5 real-Chromium success arm only checks defined. | Fixed in this commit: `toEqual({})` in both arms. |
