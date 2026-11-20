---
status: DONE
dependencies: [067-03]
last_verified: 2026-11-20
---

## Slice 068-01: A pending seam hold flushes on grant

**Goal:** ADR-0062 point 4: "'Hold' means hold and flush on grant." Close the 067-03 residual: a stale Alloy consent cookie says "in" while page consent is pending, the seam holds the interact, and a later grant now sends it once instead of dropping it.

**DoR:**
- ✅ ADR-0062 point 4 (Accepted); 067-03 residual note; 064-19 finding that the chamber's fetch rejects on hold, so a replay has no consumer.
- Ground first: `dispatchInterceptedFetch` and `applyConsent` in `core/wrapped-sdk-host.js`, the chamber's `pendingFetches` (no chamber-side timeout), and the adapter's `setConsent` (mutates the live ref, then calls `host.setConsent`).

**Acceptance Criteria:**

1. With the host option `flushOnGrant` on (the Alloy adapter sets it), a request held because a governing purpose is pending keeps the chamber's fetch pending (no response) and is parked in the host. The `consentHeld` count and the redacted `held` diagnostic still fire once.
2. On `host.setConsent`, parked requests are re-run through every gate in order. On a grant each is sent exactly once; a repeat grant sends nothing more. A still-pending update keeps them parked.
3. A denial or revocation rejects each parked fetch with the existing held shape (`status:0`, `held at the seal: consent`) and sends nothing, including on a later grant.
4. An explicit denial at the time of the request is rejected at once (not parked).
5. Teardown (`host.dispose()`, called from the adapter's `dispose`) drops parked requests and a later grant sends nothing.
6. The parked set is bounded by `MAX_HELD_BEACONS`; the oldest is rejected with a diagnostic (ADR-0062 point 6).
7. The 064-18 contract is unchanged: hold and timeout reject with a plain Error (status 0 from the host), never a network error.

**DoD:**
- `npm test && npm run lint` and the servo quality-gate pass.

**Consumers:** Adobe 064-18 onward and the real-Chromium `067-03 residual` test on vendor-adobe.

**Anti-horizontal-phasing check:** Vertical: seam park and flush, adapter teardown, and tests through both the host and `bootAlloy`.

## Notes

**What shipped.** `createWrappedSdkHost` parks the original intercepted request when the verdict is pending (not denied) and posts no response; `setConsent` re-dispatches the parked batch through every gate (endpoint ceiling, config integrity, consent, denylist) against the live ref, so the grant path equals a fresh request and a denial rejects. `dispose()` rejects and clears. The in-flight timer is cleared when a request parks from the deferred continuation. The `bootAlloy` handle's `dispose` calls `host.dispose()` before terminating the worker. Tests: `test/wrapped-sdk-host.test.js` (park, order, deny, teardown, ring) and `test/alloy-consent-hold.test.js` (stale-cookie interact, deny, teardown through `bootAlloy`). The two older "pending holds" tests now assert the fetch stays pending instead of expecting a rejection.

**Design call: opt-in.** The wrapped-SDK host is shared: Google's adapter uses it with its own contract (pending is rejected, "never replays on grant", pinned by its tests on `vendor-google-ads`). `flushOnGrant` defaults to false, so only Alloy changes; the default tests keep their old pending-rejects shape. Found while merging main into `vendor-google-ads` (5 failing Google tests), fixed before the merge landed.

**Design call: re-run through the gates, not replay.** A replay would skip the checks that must see the new consent state (personalization strip on a partial grant). Re-running gives the same result as a fresh request.

**Consequence.** While a request is parked, Alloy's `sendEvent` has not settled, so the adapter's `driveEvent` is in flight and later events wait in the adapter's own queue (already bounded by the same ring). A denial settles it (rejected), as before.

### Reconciliation sweep

Review (Opus 5.5, round 1, `reviews/slice-01-*.md`): one MEDIUM, four LOW.

- **MEDIUM, fixed:** a parked request re-run by `setConsent` was counted and reported as held again on every re-run. A `WeakSet` now counts and reports each request once; tests assert `consentHeld` stays 1 per request across a still-pending update and a denial.
- **LOW, carried:** the config-integrity `overridden` counter can re-fire on a re-run when an override is on. The override is a rare explicit opt-out and the count is diagnostic only.
- **LOW, carried:** the through-`bootAlloy` deny and teardown tests check that nothing was fetched, not the worker's rejection; the host-level tests assert the `status:0` response shape.
- **LOW, noted:** a parked request that is denied on re-run is rejected, except a parked opt-out signal, which 068-02 forwards. That is the intended refusal path.
- **LOW, noted:** the rejection text has two added suffixes, `(hold ring full)` and `(teardown)`. Both still begin with `held at the seal: consent` and stay a plain Error in the chamber (status 0), so the 064-18 shape is unchanged.
