---
status: DONE
dependencies: [064-19, 064-20]
last_verified: 2026-11-20
---

## Slice 064-26 — H1: Host command entry

**Goal:** A site can call `getIdentity`, `appendIdentityToUrl`, `applyResponse`, `getLibraryInfo` and `createEventMergeId` from the `bootAlloy` handle through one allowlisted, promise-returning method, and each result matches pinned stock Alloy 2.31.1. Contract: [ADR-0063](../../decisions/adr-0063-host-command-entry.md). The ADR is Accepted (2026-11-20) with the five commands; `evaluateRulesets` stays out.

**DoR:**
- ✅ B3 (064-19) and B4 (064-20) done.
- ✅ ADR-0063 Accepted; the owner left `evaluateRulesets` out.

**Acceptance Criteria:**

1. `handle.command(name, options)` exists on the `bootAlloy` handle and returns a promise. Each of the five allowlisted commands runs through the real Alloy chamber in real Chromium from that handle, with no rig command path in the call.
2. Result shape per command compares against pinned stock Alloy 2.31.1 by deep-equal on keys and types, after normalising volatile values (ECID, `TS`, `eventMergeId` UUID, `regionId`). Use the recorded fixture where the corpus has one (`getIdentity` and `appendIdentityToUrl`: S5; `applyResponse`: the S3 recorded response). `getLibraryInfo` and `createEventMergeId` have no fixture, so they use a SYNTHETIC stock-vs-airlock differential on the same page, labelled as such in the slice notes and the test names. A one-chamber check shows concurrent commands share one Alloy instance.
3. A name outside the allowlist, a non-string or empty name, and a call after `dispose()` reject with a plain `Error` (never a `TypeError`) and send no worker message. The chamber worker also refuses an unlisted name if one reaches it.
4. A function, symbol, DOM node or non-plain object in `options` rejects with a plain `Error` on the main thread before anything is posted.
5. Consent: for each command, in each state (pending, denied, granted, no consent input wired, stale `in` cookie with pending page), the outcome is recorded from pinned stock Alloy 2.31.1 on the same page and `handle.command` matches it (resolves, stays pending, or rejects with the same Alloy error). The only allowed difference is the labelled ADR-0062 hold. The no-consent-input case shows a parked `getIdentity` stays pending with the existing warning, and a later `getLibraryInfo` still settles (calls settle independently).
6. `applyResponse`: with `renderDecisions` omitted or false nothing renders and nothing is sent. With `renderDecisions: true` the chamber still runs headless, the host renders the result propositions with the 064-20 renderer, the returned propositions carry the rewritten render fields (`renderAttempted`), and the call resolves after rendering finishes. Any stock difference (for example a display notification) is recorded as a gap in the notes. A boot-level `renderDecisions` does not change this. It works on a boot with no personalization configured.
7. Alloy's own validation errors pass through the `{ name, message, code }` envelope for a bad option on an allowlisted command, as plain `Error`s with the same name, message and `code` stock raises. An Alloy `TypeError` arrives as a plain `Error` with the original name in the envelope.
8. Calls dispatch in call order and settle independently by id. A call made before the chamber is ready waits for boot. Worker `error` or `fatal{phase:"load"}` rejects in-flight and waiting calls with a plain `Error`; a failed `configure` rejects waiting calls naming it; a single failed `sendEvent` `fatal` does not reject commands. The test causes each case explicitly. `getLibraryInfo().libraryInfo.commands` listing refused commands is recorded as a difference.
9. The rig keeps its `rig-command` path for non-allowlisted probes (`evaluateRulesets` if the owner keeps it out, `rig:sendBeacon`, `rig:loadElement`). The new tests use the existing `rig/adobe-b1-replay.mjs` harness, extended, not a new one.
10. The real-Chromium tests are gated on `AIRLOCK_REAL_CHROMIUM=1` and run as a GATING step in the `browser-oracle` CI job. The hermetic job stays browser-free. The gap rows in the B3 results table and spec 064 are updated to say these rows are site-callable.

**DoD:**
- `npm test && npm run lint` and servo gate pass.
- `@returns` JSDoc on `bootAlloy` documents `command`; ADR-0063 status set to Accepted with the owner's answer quoted.
- Three independent review passes (compliance, craft, reconciliation) under `reviews/slice-26-*.md`.

**Anti-horizontal-phasing check:** Vertical: one handle method to the worker message to Alloy to the result, proven against stock for each listed command in real Chromium.

## Notes

- Decision context: H1 carry from 064-19; `evaluateRulesets` rig-only note from 064-20.
- 064-21 depends on this slice: it must not cite rows 4 to 7 and 9 as site-callable until this is DONE.

## Results and deviations (2026-11-20)

Tests: `test/adobe-h1-host-command.test.js` (hermetic entry and envelope tests, plus real-Chromium tests gated on `AIRLOCK_REAL_CHROMIUM=1` and a GATING `browser-oracle` step). Harness change: `replayFixture` gets `skipSteps`, so a test can drive the recorded identity steps through `window.__handle.command` instead of the rig `window.__command`. The rig `rig-command` path stays for non-allowlisted probes.

| Command | Proof | Label |
|---|---|---|
| `getIdentity` | S5 fresh and returning: shape, `edge`, ECID and the one acquire as recorded | recorded |
| `appendIdentityToUrl` | S5: `adobe_mc` carries the ECID; Alloy validation error (`url: 5`) has stock's message, a plain `Error` | recorded + stock differential |
| `applyResponse` | S3 recorded body: headless result; SYNTHETIC dom-action body: `renderDecisions:true` renders through the 064-20 renderer and sets `renderAttempted`, omitted or false leaves the DOM untouched | recorded + SYNTHETIC |
| `getLibraryInfo`, `createEventMergeId` | key-for-key shape against pinned stock 2.31.1 on the same page | SYNTHETIC differential |

- **Consent (AC5):** a parametrized real-Chromium differential records stock 2.31.1 and `handle.command` on the same page for all five commands in each state, with edge answers replayed from the recordings. Pending, denied, granted and a stale `in` cookie on a pending page match stock command for command. Pending and the stale-cookie page park only `getIdentity` and send nothing. Denied and granted resolve all five and send one request (the consent forward). The no-consent-input case is the labelled ADR-0062 hold difference: stock (`defaultConsent: "in"`) resolves everything and fetches the identity, while the handle parks only `getIdentity`, sends nothing, raises one `consent`/`held` diagnostic, and the other four commands settle. A parked `getIdentity` also resolves after `setConsent` grants. To make the warning true for a command-only page, `warnNoConsentInput()` now also runs when `command("getIdentity")` is called (it used to fire only on `push`).
- **Worker allowlist (AC3):** a real-Chromium test posts raw `command` messages for `sendEvent`, `evaluateRulesets` and an unknown name to the production worker. Each answers with an error, and a rig spy on the worker's `self.alloy` records no call. A raw `getLibraryInfo` is the positive control and is the only recorded call. The spy is rig-only (`rig/b1-chamber-entry.js`); no production seam was added.
- **Chamber loss (AC8):** the hermetic fake-worker tests cause `error`, `fatal{phase:"load"}` both while a call waits for boot and after it was posted (in flight), a `sendEvent` fatal that does not reject, configure failure and dispose. The fake worker posts the same message set the real worker does; loss is not provoked in the real chamber.
- **applyResponse result (AC2):** a SYNTHETIC differential runs stock `applyResponse` and the handle on the same page with the recorded S3 body and deep-equals keys and types of the whole result (`destinations`, `propositions`, `decisions`) and `renderAttempted`, with no request sent on either side.
- **Boot-level `renderDecisions` (AC6):** a test boots with `renderDecisions: true` and calls `applyResponse` without the option on a SYNTHETIC dom-action body: the DOM is untouched, `renderAttempted` is false, nothing is sent, as stock does with the option omitted.
- **Gaps against stock for `applyResponse({renderDecisions: true})` (AC6):** (1) stock sends a `decisioning.propositionDisplay` notification after rendering; the handle renders with the 064-20 renderer and sends none. (2) Stock returns the rendered proposition out of `decisions` (empty array), while the handle keeps it. `propositions` match in keys and types. Both are asserted in the test so a change shows up.
- **Flake risk:** the pending-consent checks race a 1000/1500 ms timer; widened once, carried, reason: a parked command has no resolution event to await.
- **Deliberate differences from stock:** no `window.alloy` global; `getLibraryInfo().libraryInfo.commands` lists commands the entry refuses; the ADR-0062 consent hold; `post-load` fatals count as chamber loss; results are JSON-normalised; an Alloy `TypeError` arrives as a plain `Error` with `alloyName`.
- **Review fixes:** option validation now accepts `undefined` values and non-finite numbers (structured clone carries them); a render failure rejects with a plain `Error`; envelope `code` is only copied when a string or number.
