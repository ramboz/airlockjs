---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-21, 064-29, 064-30, ADR-0065]
last_verified: 2026-11-21
---

## Slice 069-01 — the handle returns what stock returns (`sendEvent` result, hook argument, `viewName`, consent outcome)

**Goal:** The library (and the wrapper, where free) can call the `bootAlloy` handle and get back the same values stock Alloy gives its caller, so `aem-martech`'s eager personalization and consent flow work without a page global.

**DoR:**
- ✅ 064-21, 064-29 and 064-30 done.
- ⬜ ADR-0065 Accepted by the owner (this slice is not built before).

**Acceptance Criteria:**

1. `handle.sendEvent(options)` (adapter-owned, same queue and ordering as `push`, same seal and consent hold) resolves with the interact result's `propositions` and `decisions` as stock's `sendEvent` promise does, shown against the recorded S10 interact answer and a differential that reads the resolved value in both arms (real Chromium). A push held at the seal stays pending and settles with its result once the consent vector releases it (a grant inside stock's 1000 ms eager timeout still applies the propositions; a test grants consent inside the timeout and the propositions render); it resolves `{}` only when the ring drops it or the handle is disposed. A rejected command rejects with a plain `Error` carrying stock's message. (Moved from 064-31 AC2.)
2. A shared main-thread helper in `adapters/eds/` (used by the wrapper here and by the library in 069-02) runs `onBeforeEventSend` before the event is enqueued; the handle itself never runs hooks (`bootAlloy` diagnoses the option). The hook sees the same `xdm` stock passes it (context merged in), shown by a differential that records the hook argument in the stock arm and the wrapper arm, which is the airlock arm here (real Chromium); edits the hook makes to context fields survive the chamber's own Alloy context merge (same differential). If the context cannot be built on the main thread as plain data, stop and report `blocked`. (Moved from 064-31 AC3.)
3. An `onBeforeEventSend` that throws drops the event with a `hook-threw` diagnostic, as stock does; the differential records stock's behavior for a throwing hook and the helper's path through `handle.sendEvent` matches it (resolves `{}` or rejects as stock does). (Moved from 064-31 AC5.)
4. `handle.applyPropositions({ viewName })` renders the view cache's propositions for that view, as Alloy 2.31.1 `applyPropositions({ viewName })` does and resolves with `{ propositions }` (hermetic, plus the real-Chromium differential in 069-02). An unknown view resolves with no propositions and no request.
5. `handle.setAdobeConsent(object)` returns a promise that settles with Alloy's own outcome: it resolves when stock `setConsent` resolves and rejects with a plain `Error` carrying stock's message when stock rejects (differential, real Chromium). The wait is bounded: a silent chamber rejects after a timeout, a dispose settles it, and the `consentRef === null` case (resolves, no Alloy call) and ADR-0064 point 5's pending-drop case (rejects) each settle (hermetic). A forged resolve or reject from the chamber never changes the vector (hermetic, revert-checked). The seal still decides from the vector derived in the same call, and the vector path is unchanged: `handle.setConsent(vector)` and the 064-30 tests stay green. (Moved from 064-31 AC8, refining ADR-0064 point 9.)
6. No `core/` change; `handle.command` and the ADR-0063 allowlist tests stay green. The wrapper's `sendEvent` resolves with the `handle.sendEvent` result when the handle has it, and `{}` otherwise (hermetic).
7. Each new handle method resolves `{}` (`setAdobeConsent` rejects) and sends nothing when the handle is disposed, and none reads or writes a page global (hermetic).

**DoD:**
- `npm test && npm run lint` and servo gate pass; spec lint exit 0 for 064 and 069.
- Real-browser tests run under `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job.
- Each AC names a test that fails without the change; the seal-related tests (AC1 hold, AC5 forged outcome) are revert-checked.
- 3 fresh Opus 5.5 `jig:reviewer` reviews saved in `reviews/`.

**Anti-horizontal-phasing check:** Vertical: each AC is a value the page awaits, from the call down to the chamber's answer and back, shown in a browser. It does not build a layer without a caller; 069-02 is the caller.

## Notes

Re-grounded from slice 064-31 under ADR-0065. The `aem-martech` eager phase reads `propositions` from the `sendEvent` result, so AC1 is the load-bearing one: without it the library cannot apply personalization.
