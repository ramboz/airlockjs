---
status: DONE
dependencies: [064-21, 064-29, 064-30, ADR-0065]
last_verified: 2026-11-22
---

## Slice 069-01 — the handle returns what stock returns (`sendEvent` result, hook argument, `viewName`, consent outcome)

**Goal:** The library (and the wrapper, where free) can call the `bootAlloy` handle and get back the same values stock Alloy gives its caller, so `aem-martech`'s eager personalization and consent flow work without a page global.

**DoR:**
- ✅ 064-21, 064-29 and 064-30 done.
- ✅ ADR-0065 Accepted by the owner (2026-11-22).

**Acceptance Criteria:**

1. `handle.sendEvent(options)` (adapter-owned, same queue and ordering as `push`, same seal and consent hold) resolves with the interact result's `propositions` and `decisions` as stock's `sendEvent` promise does, shown against the recorded S10 interact answer and a differential that reads the resolved value in both arms (real Chromium). A push held at the seal stays pending and settles with its result once the consent vector releases it (a grant inside stock's 1000 ms eager timeout still applies the propositions; a test grants consent inside the timeout and the propositions render); it resolves `{}` only when the ring drops it or the handle is disposed. A rejected command rejects with a plain `Error` carrying stock's message. (Moved from 064-31 AC2.)
2. A shared main-thread helper in `adapters/eds/` (used by the wrapper here and by the library in 069-03) runs `onBeforeEventSend` before the event is enqueued; the handle itself never runs hooks (`bootAlloy` diagnoses the option). The hook sees the same `xdm` stock passes it (context merged in), shown by a differential that records the hook argument in the stock arm and the wrapper arm, which is the airlock arm here (real Chromium); edits the hook makes to context fields survive the chamber's own Alloy context merge (same differential). If the context cannot be built on the main thread as plain data, stop and report `blocked`. (Moved from 064-31 AC3.)
3. An `onBeforeEventSend` that throws drops the event with a `hook-threw` diagnostic, as stock does; the differential records stock's behavior for a throwing hook and the helper's path through `handle.sendEvent` matches it (resolves `{}` or rejects as stock does). (Moved from 064-31 AC5.)
4. `handle.applyPropositions({ viewName })` renders the view cache's propositions for that view, (Alloy 2.31.1 only does this when `propositions` is also given: stock's `applyPropositions({ viewName })` alone is rejected by its validator and renders nothing, see Findings; the handle renders the view cache for the bare form and keeps stock's combined form) and resolves with `{ propositions }` (hermetic, plus the real-Chromium differential in 069-03). An unknown view resolves with no propositions and no request.
5. `handle.setAdobeConsent(object)` returns a promise that settles with Alloy's own outcome: it resolves when stock `setConsent` resolves and rejects with a plain `Error` carrying stock's message when stock rejects (differential, real Chromium). The wait is bounded: a silent chamber rejects after a timeout, a dispose settles it, and the `consentRef === null` case (resolves, no Alloy call) and ADR-0064 point 5's pending-drop case (rejects) each settle (hermetic). A forged resolve or reject from the chamber never changes the vector (hermetic, revert-checked). The seal still decides from the vector derived in the same call, and the vector path is unchanged: `handle.setConsent(vector)` and the 064-30 tests stay green. (Moved from 064-31 AC8, refining ADR-0064 point 9.)
6. No `core/` change; `handle.command` and the ADR-0063 allowlist tests stay green. The wrapper's `sendEvent` resolves with the `handle.sendEvent` result when the handle has it, and `{}` otherwise (hermetic).
7. Each new handle method resolves `{}` (`setAdobeConsent` rejects) and sends nothing when the handle is disposed, and none reads or writes a page global (hermetic).

**DoD:**
- `npm test && npm run lint` and servo gate pass; spec lint exit 0 for 064 and 069.
- Real-browser tests run under `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job.
- Each AC names a test that fails without the change; the seal-related tests (AC1 hold, AC5 forged outcome) are revert-checked.
- 3 fresh Opus 5.5 `jig:reviewer` reviews saved in `reviews/`.

**Anti-horizontal-phasing check:** Vertical: each AC is a value the page awaits, from the call down to the chamber's answer and back, shown in a browser. It does not build a layer without a caller; 069-03 is the caller.

## Notes

Re-grounded from slice 064-31 under ADR-0065. The `aem-martech` eager phase reads `propositions` from the `sendEvent` result, so AC1 is the load-bearing one: without it the library cannot apply personalization.

## Findings

Built 2026-11-22. `H` = hermetic (`test/adobe-069-01-handle-results.test.js`, fake worker, no browser); `C` = real Chromium against the pinned stock tag with SYNTHETIC answers (`test/adobe-069-01-handle-results-chromium.test.js`, gated in the `browser-oracle` job). No new live capture.

**Tests per AC** (each fails without the change):
- AC1: `H` "resolves { propositions, decisions } from the event's own deliveries..." (renderAttempted marks), "is built from the main thread's deliveries, not from the chamber's result summary", "uses the same queue as push", "a push held at the seal stays pending... settles once consent releases it", "an event the ring drops resolves {} and a dispose settles every pending send with {}", "rejects with a plain Error...". `C` "AC1" differential (stock vs handle: three steps, same `propositions` and `decisions`, including the page-wide `__view__` proposition stock returns with `renderDecisions`) and "a rejected command rejects with a plain Error carrying stock's message" (400 interact, same text after the instance name).
- AC2: `H` "the hook sees the page's xdm with the context merged in...", "an edit to a context field survives...", "the wrapper sends the event with the hook's edits...". `C` "AC2" records the hook argument in both arms and checks the edit reaches the wire.
- AC3: `C` "AC3": stock rejects a throwing hook with `... An error occurred while executing the sendEvent command.\nCaused by: <message>` and sends nothing; a `false` verdict resolves and sends nothing; the wrapper matches both. `H` "a hook returning false drops the event; a throwing hook drops it with a hook-threw diagnostic". The 064-21 test "reports both overrides, a throwing hook..." now expects the rejection.
- AC4: `H` "an unknown view resolves no propositions and sends no request", "keeps the { propositions, metadata } form working"; `C` "AC4" (propositions plus view) and an AC4 finding test pinning stock's bare-`viewName` no-op.
- AC5: `H` "resolves when the chamber reports Alloy's setConsent resolved and rejects with its message", "a forged outcome ... never changes the consent vector or the seal", "is bounded", "a dispose settles it", "with no consent ref ... resolves", "the vector-shaped fallback settles on return", "handle.setConsent(vector) is unchanged", plus the real worker file: ok, Alloy's own message, ADR-0064 point 5 pending-drop rejects, vector-only reports nothing. `C` "AC5" (resolves `{}` as stock; a 400 set-consent rejects with stock's text).
- AC6: `git diff 2dcd83fa..HEAD -- core adapters/eds/host-command.js connectors/alloy/host-commands.js` is empty; `H` "resolves {} and pushes when the handle has no sendEvent", "its setConsent settles with the handle's setAdobeConsent outcome"; handle.command tests unchanged and green.
- AC7: `H` "resolves {} (setAdobeConsent rejects) and sends nothing", "none of the new methods reads or writes a page global" (global proxy).

**Revert-checks** (break, see red, restore): forged outcome applying a vector -> forged-outcome test fails; page-global read/write added to `setAdobeConsent` -> page-global test fails; `sendOne` resolving at once -> the hold test fails; `sendResult` emptied -> AC1 tests fail; helper not keeping context edits -> AC2 edit tests fail; dispose not settling pending sends -> the dispose test fails (5 s timeout).

**Findings and limits:**
- Stock 2.31.1 `applyPropositions({ viewName })` WITHOUT `propositions` is rejected by stock's validator (`propositions` must be non-empty) and resolves `{ propositions: [] }`, even with a warmed view cache. Only `{ propositions, viewName }` also renders the cached view. ADR-0065's assumption that the bare form renders the cache does not hold for stock; the handle renders it as this slice states and also supports the combined form. 069-03 must not claim a stock differential for the bare form.
- `propositions` in the result need personalization configured (`placements`, `reservedPlacements` or `onDecisions`), because `caps.decisions` is wired only then; otherwise `sendEvent` resolves `{ propositions: [], decisions: [] }` and analytics-only boots' diagnostics are unchanged.
- Propositions without an `id` (stock's synthesized empty view default) are left out, as stock does. A partly rendered proposition is marked as a whole.
- The seal holds the request, not the event's entry to the chamber. The hold-then-release path is proven hermetically with a simulated seal; in real Chromium a pending-consent boot parks Alloy's own queue (no request), so the real-browser hold case is not asserted.
- A hook that deletes a context field gets it refilled by Alloy. `timestamp` and `placeContext.localTime` are sampled on the main thread.
- Fallback-kind `setAdobeConsent` (object not postable) settles at once with `{}`: there is no Alloy outcome for the vector-shaped call. A kind-"none" object rejects with Airlock's own message.
- `setAdobeConsent` and `sendEvent` resolve `{}` where stock resolves its own object; the `decisions` and `propositions` fields are what stock returns.
- The three `jig:reviewer` reviews of the DoD are not run in this slice's build session.
