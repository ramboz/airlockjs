---
status: DONE
dependencies: [064-21, ADR-0064]
last_verified: 2026-11-21
---

## Slice 064-30 — stock Adobe consent path (set-consent body and host match stock)

**Goal:** A page that calls stock `setConsent` with an Adobe 2.0 object sends the set-consent request stock sends, while the seal still decides egress from the vector derived in the same call (ADR-0064).

**DoR:**
- ✅ 064-21 done (the wrapper and the S10 differential exist).
- ✅ ADR-0064 Accepted by the owner (2026-11-20).

**Acceptance Criteria:**

1. The full Adobe 2.0 consent object a stock `setConsent` passes (`collect`, `marketing` with `preferred`, `personalize.content`, `share`) reaches Alloy's `setConsent` in the chamber and the set-consent request body as stock sends it, shown by the S10 recorded `set-consent` body (`recordedBody("set-consent")`) and the stock-vs-airlock differential.
2. The seal decides egress from the vector derived from the same object, and the object is never a seal signal, shown by hermetic tests: (a) the handle method takes the object only (an extra vector argument is ignored), and an object whose `collect.val` is not `"y"` never yields a granted `analytics_storage`; (b) the object message alone (a chamber-side or test-posted `adobeConsent`) neither changes the consent ref nor releases a parked request; (c) a held event is released only by the vector message: an object granting what the vector denies leaves the event held; (d) in one `setAdobeConsent` call the object message is posted first and then the vector message, and by the time the call returns the live ref holds the new vector and the parked requests have been re-run, so a set-consent request the chamber makes right afterwards is judged against the new vector.
3. The set-consent body and host match stock in the S10 B5 differential (`test/adobe-b5-martech.test.js`): the `CONSENT_BODY` exceptions and the set-consent host exception are removed. A new boolean `thirdPartyCookiesEnabled` boot option reaches Alloy's `configure` unchanged (a non-boolean is rejected with a plain `Error`), and `AIRLOCK_BOOT` sets it to mirror the S10 page. A hermetic test shows the option does not change which hosts the seal allows (a request to a host outside the ceiling is still held with it on or off).
4. The 068 opt-out and the default boot are unchanged: a refusal (`collect.val: "n"`) through `setAdobeConsent` forwards only the `consent` and `meta` keys of the set-consent request, with the full object inside `consent` (the 068-02 tests stay green plus one test for the full-object body); a boot with no `setConsent` call sends what it sends today (the 064-21 and 068 boot tests stay green).
5. Objects the adapter cannot read with certainty take the vector-shaped fallback (no `adobeConsent` message is posted) with a `consent-object-fallback` diagnostic on the boot's `onDiagnostic`: a first entry that is not the Adobe 2.0 entry (for example `[TCF, Adobe{collect:"n"}]`, where the 068 opt-out must still forward), two Adobe entries, an Adobe entry whose version is not `"2.0"` (the vector still derives from it), an object with no `collect`, a `collect` or `personalize.content` `val` other than `"y"` or `"n"`, and an object holding a function (the plain-data check runs before any post). A Proxy whose traps throw, or a revoked one, never throws out of the call: nothing is posted and the `unsupported-consent` diagnostic is emitted. A transparent Proxy is copied to plain JSON and sent, because the guarantee comes from the copy, not from detecting Proxies. An array with no Adobe entry carrying `collect` or `personalize.content` (TCF alone, an empty array, a non-array) posts nothing, leaves the ref and parked requests untouched and emits the existing `unsupported-consent` diagnostic on the bridge's `onDiagnostic`. An Adobe entry first followed by other entries sends the whole array. A handle without `setAdobeConsent` makes the bridge fall back to `handle.setConsent(vector)`. When `consentRef` is null (a `consentHold:false` boot with no consent) `setAdobeConsent` does nothing, as `handle.setConsent` does today.
6. A direct `handle.setConsent(vector)` call and a CMP `onChange` (no object) behave as today: the chamber drives Alloy's `setConsent` from the vector-shaped options and no object message is posted. `handle.command` and its five-command allowlist are unchanged (the ADR-0063 allowlist tests stay green), and `git diff <base>.. -- core/wrapped-sdk-host.js` is empty.
7. The chamber drives Alloy's `setConsent` exactly once per page call, with the object (twice only when the object call is rejected and retried): a hermetic chamber test counts the calls and reads the argument. A waiting object is used only by the very next vector message and then dropped (a vector message with no object never picks up an older one). Under a still-pending `analytics_storage` the object is dropped and Alloy's held queue is not discarded. A partial object (`collect` only) after a full one keeps the earlier purposes in the vector and sends only what the page sent to Alloy. If a stub Alloy rejects the object call, the chamber retries once with the vector-shaped options and posts a `consent-object-rejected` phase record, visible in `getState().phases` (hermetic test).

**DoD:**
- `npm test && npm run lint` and servo gate pass.
- Real-browser tests run under `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job.
- ADR-0064 Accepted; the 064-21 AC2 and Findings, 064-31 AC4, the spec 064 s12 line and the board row point to this slice.

**Anti-horizontal-phasing check:** Vertical: the page's `updateUserConsent` call through the wrapper and the handle to the chamber's Alloy, the seal's decision and the recorded set-consent request on the wire.

## Notes

Found by the 064-21 stock-versus-airlock differential. The owner chose the stock consent path (2026-11-20). The host difference turned out to be the `thirdPartyCookiesEnabled` boot option (Alloy sends set-consent and identity requests to `adobedc.demdex.net` while it is on), not the consent path (ADR-0064 point 7). `idMigrationEnabled` stays with 064-31 AC1; the `configure` diagnostics stay with 064-31 AC6; the `setConsent` promise settling with Alloy's own outcome is 064-31 AC8.

## Findings (DONE 2026-11-21)

- Real Chromium (`test/adobe-b5-martech.test.js`, 13 tests, `AIRLOCK_REAL_CHROMIUM=1`): the set-consent body and host equal stock's; the `CONSENT_BODY` and host exceptions are removed (AC3). With `thirdPartyCookiesEnabled: false` in the boot, the interact `query.identity.fetch` list is also equal to stock's (`["ECID"]`), so the difference 064-31 AC1 attributes to `idMigrationEnabled` is closed by this slice's boot option. 064-31 AC1 needs re-pointing (reported to the coordinator).
- Hermetic (`test/alloy-adobe-consent.test.js`, 40 tests): classification and fallbacks (AC5, including throwing and revoked Proxies), bridge routing, object-then-vector order and parked-request release (AC2d), the chamber-originated object message changing nothing (AC2b, c), the full-object opt-out forward (AC4), the boot option and unchanged hosts (AC3), direct `setConsent` posts no object (AC6), and the chamber's single object call, one-shot use, pending drop, partial object and retry on rejection (AC7, real worker file with a stub `self.alloy`). All 28 non-vacuous tests fail with the adapter and connector changes stashed.
- Deviations: the rejection signal is a `phase` record, not an `onDiagnostic` record (AC7 reworded). The adapter posts a plain JSON copy of the object, not the page's reference.
- Unchanged: `core/wrapped-sdk-host.js` (empty diff), the ADR-0063 allowlist, the 064-29 and 064-32 files. The unchecked opt-out subtree stays with 064-33.
