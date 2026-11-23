---
status: IN_PROGRESS
dependencies: [ADR-0065]
last_verified: 2026-11-23
---

## Slice 069-05 — Real-Chromium display flows of the martech library (required for 069-03 AC6)

**Goal:** Required by the owner (2026-11-23, "Reject: prove them before 069-03 counts as DONE") for 069-03 AC6. 069-03 and 069-05 stay IN_PROGRESS until the three saved reviews exist (DoD); both flip to DONE in one commit, once the owner has signed off AC8 (`trackPageView: true`: the page view carries the offer, no separate display). The library arm already matches the stock run's requests for the default path (`martechEager`, `martechLazy`, `martechDelayed`), `trackPageView` on and off, `performanceOptimized: false` with the body style changes, and the `martechConfig.airlock` boot path (069-03). This slice adds the flows that needed a new rig scenario: personalization off, a late display after the timeout, and a synthetic offer answer that renders and sends `propositionDisplay` (also `trackPageView: false` with an offer, AC3), and it owns the differences from stock those flows exposed (AC6 to AC10).

**Definition of Ready:**
- ✅ The library code is built and reviewed (069-03, IN_PROGRESS until this slice's reviews are saved). No dependency on 069-03 DONE, which avoids a cycle.

**Definition of Done:**
- The three fresh Opus 5.5 `jig:reviewer` reviews saved in `reviews/`.
- Owner sign-off on AC8 (`trackPageView: true`: the page view carries the offer, no separate display).
- `npm test && npm run lint` pass; spec lint exit 0 for 069; the real-Chromium file runs green with `AIRLOCK_REAL_CHROMIUM=1`.

**Acceptance Criteria:**

1. Personalization off in real Chromium: a journey that calls `martechLazy` before awaiting `sendEvent` (the 069-03 journey awaits `sendEvent` first, which cannot settle while personalization is off, in the stock run too) sends the stock run's requests. Test: "AC1 (069-05)".
2. A late display after `personalizationTimeout` sends the stock run's `decisioning.propositionDisplay` requests. Test: "AC2 (069-05)".
3. A SYNTHETIC offer answer (the 064-20 sense, no new live capture) renders with `renderDecisions: true` and reports the same displays as the stock run, including with `trackPageView: false` (the display event is sent with an offer). Test: "AC3 (069-05)".
4. With personalization off, the order of the event versus the page view equals the stock run's. Test: "AC4 (069-05)".
5. No `core/` change; the 064-21 and 069-03 tests stay green.

**Differences from stock** (recorded, none judged a library bug; each has an owning AC and a test that pins both arms):

6. Fetch scopes: the library's proposition fetch carries only its declared scopes (`decisionScopes` equal to the configured list, no `__view__` when the declared set is non-empty (an empty set leaves Alloy's `__view__` default), `surfaces: []`, no dom-action schema); stock's carries the configured scopes plus `__view__`, the page surface and the dom-action schema among its schemas (the test asserts the dom-action schema, not a count). Test: "AC6 (069-05)" (real Chromium); the AC2, AC3 and AC11 tests also assert both fetch queries through `sameAsStock`.
7. Rendering needs a declared placement: with no `placements[]` entry for the scope the library renders nothing and sends no display, where stock renders any selector. Test: "AC7 (069-05)" (real Chromium; it also shows the same journey renders once the placement is declared).
8. `trackPageView: true` with an offer: stock sends the page view, then a separate `decisioning.propositionDisplay`; the library renders at response time, so its page view already carries the proposition and no separate display follows. The offer is reported once in both. Test: "AC8 (069-05)" (real Chromium). Owner sign-off on this difference is pending (carried to the coordinator) and is a gate for the DONE flip.
9. An event sent before `martechLazy` with personalization off: stock rejects it ("must be configured first"); the library queues it and sends it after boot. Test: "AC9 (069-05)" (real Chromium).
10. A failed boot: only an invalid `edgeDomain` makes the library's `martechLazy` rethrow (stock's resolves); with a script that throws at load both `martechLazy` resolve. In all four variants no request is sent and the page stays visible. Test: "AC10 (069-05)" (real Chromium, four variants: two triggers, each the same in both arms, times `performanceOptimized` on and off. Trigger A, a script that throws at load (the stock Alloy file, the library's bundle URL): stock's `initMartech` rejects with the script error, the library's resolves (the chamber never boots); `martechLazy` resolves and the consent call stays unsettled in both. Trigger B, an invalid `edgeDomain`: stock's `martechLazy` resolves and the consent call stays unsettled, the library's `martechLazy` and consent call reject with the config error. The real check in all four is that no request is sent and the page stays visible). Owner of the 069-03 deviation-log item "failed boot rethrows".
11. An answer that arrives after `personalizationTimeout` is not applied and not reported, as in stock (the fetch is asserted to have been answered, the hero stays `default`, no display in either arm). Test: "AC11 (069-05)". Added during the build; it was not in the original AC2.

## Findings

All tests are real Chromium (pinned Alloy 2.31.1, SYNTHETIC answers, stock `aem-martech` arm versus the library arm) in the "spec 069-05" describe of `test/adobe-b5-martech.test.js`, a gating step of browser-oracle. The rig's `respond` hook can now be async (`rig/adobe-b1-replay.mjs`). Hermetic coverage stays in `test/adobe-069-03-martech.test.js`; no 069-05 test is hermetic (the failed-boot and personalization-off differences need the real stock arm for the other side).

Tests by AC: AC1 "AC1 (069-05)"; AC2 "AC2 (069-05)"; AC3 "AC3 (069-05)"; AC4 "AC4 (069-05)" (AC1 and AC4 share one run of the personalization-off journey); AC5 no `core/` change; AC6 to AC11 as listed above.

**Basis of difference 6.** Not the `unsupported-option` warning in `adapters/eds/martech.js` (that warns about a page `__view__` next to named scopes and decides nothing). What decides it: the library's fetch hands `config.decisionScopes` to `handle.push` as `personalization.decisionScopes` with `renderDecisions: false` (`applyPropositions` in `adapters/eds/martech.js`), and the scopes the chamber's Alloy requests are the declared scope set (spec 034-02: `deriveDecisionScopes` in `adapters/eds/index.js` derives them from `placements[].scope`, the connector carries them on the interact), with no page-wide default added; `__view__` is in the fetch only when a placement or `decisionScopes` declares it, with one exception: when the derived scope set is empty (`deriveDecisionScopes` in `adapters/eds/index.js` returns nothing), `bootAlloy` omits `decisionScopes` and Alloy keeps its own `__view__` default (the AC4a test declares a `__view__` placement for that reason). Stock `aem-martech` calls the same fetch on stock Alloy, which adds `__view__`, the page surface and the dom-action schema itself. ADR-0065 does not state this difference; its 2026-11-23 amendment records it. A real edge might not return a page-surface dom-action to the library arm; the synthetic answer is served regardless.

**Owner sign-off still needed:** the AC8 difference (listed as 8 here; the ADR amendment numbers it 3) (AC8, the library's page view carries the proposition and no separate display follows). Not invented here; the coordinator carries it.

**Revert-checks** (mutate `adapters/eds/martech.js`, confirm red, restore; see the commit message for the results of the new tests): dropping `ensureBooted()` in the personalization-off `martechLazy` fails AC1, AC4 and AC9; dropping the personalization-off page view fails AC1 and AC4; dropping `reportLateDisplayedPropositions` fails AC2; dropping `renderedPropositionIds.add` fails both AC3 and AC8; keeping the timeout flag from being set fails AC11. (Removing only the early `if (personalizationTimedOut) return` is not detected: the later guard in `run` covers it.) The new tests' own checks are listed under "Revert-checks, review round" below.

**Revert-checks, review round** (mutate, run the 069-05 tests, confirm red, restore): AC6: adding `__view__` to the library's fetch scopes fails AC6, AC3, AC2 and AC11 (the fetch assertions in `sameAsStock`). AC8: dropping `renderedPropositionIds.add` fails AC8, AC3 and AC6. AC9: dropping `ensureBooted()` in the personalization-off `martechLazy` fails AC9, AC1 and AC4 (they time out). AC10: not rethrowing the boot error in `martechLazy` fails the two invalid-`edgeDomain` variants (of four). AC11: never setting `personalizationTimedOut` fails AC11. AC7 (the placement requirement lives in the chamber host, not in the library): forcing the library arm to always declare the placement fails AC7, which shows the test depends on the placement being absent.

Rounds 1 and 2 of the three fresh `jig:reviewer` reviews are saved in `reviews/slice-05-library-display-flows-*.md` (all changes-requested; round-1 findings were fixed in 6b00eab5 and their files saved later, round-2 findings were fixed in the commit that saved them; no finding was carried). Round 3 (changes-requested on compliance and reconciliation, approved on craft) is saved too; its findings are fixed in the commit that lands it, except one carried nit. The AC8 sign-off is still open.

**Deviation log (round 2):** the rig's `respond` hook can now be async (`rig/adobe-b1-replay.mjs`, to delay a synthetic answer); this is a test-rig change only, with no production code (`adapters/`, `connectors/`, `core/`) touched. The late-answer waits count edge requests on the Node side (Playwright sees the chamber Worker's traffic), not from the main window's performance entries, which cannot see the Worker.

## Notes

Raised by 069-03's Findings; the owner made it required. The hermetic tests of 069-03 already cover the personalization-off, timeout and late-display logic with the fake worker.
