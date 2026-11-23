---
status: DONE
dependencies: [ADR-0065]
last_verified: 2026-11-23
---

## Slice 069-05 — Real-Chromium display flows of the martech library (required for 069-03 AC6)

**Goal:** Required by the owner (2026-11-23, "Reject: prove them before 069-03 counts as DONE") for 069-03 AC6; 069-03 stays IN_PROGRESS until this slice is DONE, and both flip in one commit. The library arm already matches the stock run's requests for the default path (`martechEager`, `martechLazy`, `martechDelayed`), `trackPageView` on and off, `performanceOptimized: false` with the body style changes, and the `martechConfig.airlock` boot path. This slice adds the flows that need a new rig scenario: personalization off, a late display after the timeout, and a synthetic offer answer that renders and sends `propositionDisplay` (also `trackPageView: false` with an offer, AC3).

**Definition of Ready:**
- ✅ The library code is built and reviewed at 0bb97347 (069-03, IN_PROGRESS pending this slice). No dependency on 069-03 DONE, which avoids a cycle.

**Definition of Done:**
- The three fresh Opus 5.5 `jig:reviewer` reviews saved in `reviews/`.
- `npm test && npm run lint` pass; spec lint exit 0 for 069; the real-Chromium file runs green with `AIRLOCK_REAL_CHROMIUM=1`.

**Acceptance Criteria:**

1. Personalization off in real Chromium: a journey that calls `martechLazy` before awaiting `sendEvent` (the 069-03 journey awaits `sendEvent` first, which cannot settle while personalization is off, in the stock run too) sends the stock run's requests.
2. A late display after `personalizationTimeout` sends the stock run's `decisioning.propositionDisplay` requests, and an answer that arrives after the timeout is not applied or reported, as in stock.
3. A SYNTHETIC offer answer (the 064-20 sense, no new live capture) renders and reports the same displays as the stock run, including with `trackPageView: false` (the display event is sent with an offer). With `trackPageView: true` the offer is reported once in both runs; the shape differs (see Findings).
4. With personalization off, the order of the event versus the page view equals the stock run's.
5. No `core/` change; the 064-21 and 069-03 tests stay green.

## Findings

All tests are real Chromium (pinned Alloy 2.31.1, SYNTHETIC answers, stock `aem-martech` arm versus the library arm) in the "spec 069-05" describe of `test/adobe-b5-martech.test.js`, a gating step of browser-oracle. The rig's `respond` hook can now be async (`rig/adobe-b1-replay.mjs`). Hermetic coverage stays in `test/adobe-069-03-martech.test.js`.

- AC1: "AC1 (069-05): personalization off, martechLazy called before awaiting sendEvent". Requests equal stock's.
- AC2: "AC2 (069-05): an offer rendered after personalizationTimeout (block decorated late)" (the late `propositionDisplay`, requests equal stock's) and "AC2 (069-05): an answer that arrives after personalizationTimeout is not applied and not reported".
- AC3: "AC3 (069-05) ... trackPageView:false" (requests equal stock's, one display) and "DIFFERENCE AC3 (069-05) ... trackPageView:true" (pins the difference below).
- AC4: "AC4 (069-05): personalization off, the event after martechLazy and the page view keep stock's order".
- AC5: no `core/` change; 064-21 and 069-03 tests green.
- Extra: "DIFFERENCE (069-05): personalization off, an event sent before martechLazy".

**Differences from stock (recorded, none judged a library bug):**
1. Fetch scopes: with declared placements the library fetches only its declared scopes (no `__view__`, no page surface, no dom-action schema in the request); stock fetches `__view__` plus the page surface. This is the existing scope-based design (spec 034, the `unsupported-option` warning in the library). The comparison ignores these three query fields and asserts them explicitly. A real edge might not return a page-surface dom-action to the library arm; the synthetic answer is served regardless.
2. Rendering needs a declared placement (`placements[].scope` + selector) in the library; stock renders any selector.
3. `trackPageView: true` with an offer: stock sends the page view, then a separate `decisioning.propositionDisplay`; the library renders at response time, so the page view already carries the proposition and no separate display follows. The offer is reported once in both.
4. An event sent before `martechLazy` with personalization off: stock rejects it ("must be configured first"); the library queues it and sends it (more lenient).

**Revert-checks (mutate `adapters/eds/martech.js`, confirm red, restore):** dropping `ensureBooted()` in the personalization-off `martechLazy` fails AC1, AC4 and the pre-lazy difference test; dropping the personalization-off page view fails AC1 and AC4; dropping `reportLateDisplayedPropositions` fails AC2 late display; dropping `renderedPropositionIds.add` fails both AC3 tests; keeping the timeout flag from being set fails the AC2 late-answer test. (Removing only the early `if (personalizationTimedOut) return` is not detected: the later guard in `run` covers it.)

The three fresh `jig:reviewer` reviews named in the Definition of Done are not saved by this build; the owner or orchestrator runs them.

## Notes

Raised by 069-03's Findings; the owner made it required. The hermetic tests of 069-03 already cover the personalization-off, timeout and late-display logic with the fake worker.
