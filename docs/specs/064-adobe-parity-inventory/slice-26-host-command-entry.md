---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-19, 064-20]
last_verified:
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
