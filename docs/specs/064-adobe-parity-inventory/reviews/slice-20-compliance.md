---
reviewer_model: claude-opus-5.5
reviewed_at: 2026-11-20
round: 1
verdict: changes-requested
---

# Slice 064-20 (B4) compliance review, round 1

Commit `7e8464e2`. **Verdict: changes-requested.** The fences hold, and S4 and the M3 ruleset delivery are real. But the slice
claims rendering, display and click parity, and three stock behaviors the claims depend on are missing or measured with a
contaminated differential: `renderDecisions:false`, the SPA view cache, and the redirect display notification.

## Evidence run

- `npx eslint` on the changed JS files: clean.
- `npx vitest run test/adobe-b4-personalization.test.js` (hermetic only, no browser per brief): 2 passed, 18 skipped.
- Real-Chromium tests were **not** run (brief). Their claims are judged by reading the test code.
- Stock behavior checked against the pinned bundle `rig/out/b1/alloy-2.31.1.min.js` (personalization action map, redirect,
  click storage, view cache).

## Acceptance criteria

| AC | Status | Note |
|---|---|---|
| AC1 rendering parity (dom-action, html, redirect, prehiding) | Partial | Action set present. No `renderDecisions:false`, no view cache, response `html-content-item` not rendered (C1, C2, C6). |
| AC2 display and click notifications compared stock vs airlock | Partial | Redirect sends no display (C3). Click differential contaminated (C4). Interact compared on `decisioning` only (C5). |
| AC3 S4/S7 replay and M3 ruleset delivery | Met with deltas | S4 replays through `push` plus placements (closes M1). M3 results arrive as data. One S7 delta has the wrong cause (C2). |

## Fences

- **No storage grant.** `ALLOY_STORAGE_NAMES` is still `null` (`connectors/alloy/connector.js:132`). The refinement-todo
  storage entry stays open. Respected.
- **No host command entry.** `applyPropositions` and `subscribeRulesetItems` are explicit host-side handle methods (ADR-0060
  adapter style), not a generic allowlisted command channel. `evaluateRulesets` stays rig-only. Respected. The 064-19 H1
  carry stays open, correctly.
- **`core/wrapped-sdk-host.js` untouched.** Not in the diff. Respected.
- **ADR-0014 (no DOM in chamber).** Rendering runs in the adapter on the main thread from data the chamber hands over
  through `decisions`. The chamber gains no DOM. Respected.

## Findings

**C1 — High — `adapters/eds/index.js:1526-1572`, `adapters/eds/personalization-render.js:211`.** There is no
`renderDecisions:false` equivalent. When decisions are wired at all (`placements`, `reservedPlacements` or `onDecisions`),
every delivered proposition is auto-rendered and a display notification is sent. Stock with `renderDecisions:false`
renders nothing and sends no display; the site renders through `applyPropositions` and reports the display itself. The
headless flow (`onDecisions`, then `applyPropositions`) therefore renders twice, and the propositions handed to
`onDecisions` lack `renderAttempted`, so `applyPropositions` re-applies the append and insert actions. The tests use a
dummy `__view__` placement on `#v` as the "render on" switch (`test/adobe-b4-personalization.test.js:26,58,109`), which
hides the gap. Fix: add a `renderDecisions` boot and push option. When off, skip the renderer and the display. Pass
`renderAttempted` to `onDecisions`. Add a differential for `renderDecisions:false` plus `applyPropositions` against stock.

**C2 — High — `adapters/eds/personalization-render.js:211-237`.** There is no SPA view cache. Stock caches view-scoped
propositions (`viewCache`, `createCacheUpdate`, `getView` in the bundle) and renders them, with their display, only when a
`sendEvent` carries a matching `web.webPageDetails.viewName`. Ours renders every delivered proposition at response time and
reports a display for views the visitor never saw. The S7 delta attributed to "renderDecisions:true attachment"
(`test/adobe-b4-personalization.test.js:117`) is a symptom of this missing cache, not an option difference. Fix: cache
view-scope propositions by view name, render and notify on a push whose XDM names that view, attach the display to the view
event the way stock does, then re-run S7 without the `VIEW_DISPLAY` ignore and correct the delta note.

**C3 — High — `adapters/eds/personalization-render.js:228-234`.** A redirect sends no display notification. Stock's redirect
handler prehides the body, collects a display with `documentMayUnload`, then calls `location.replace`. Ours excludes redirect
propositions from `displayed`, so Target redirect activities lose their impressions. The redirect test
(`test/adobe-b4-personalization.test.js:162-178`) asserts only the navigation URL. Fix: enqueue the display through the
mediated path with keepalive before redirecting, prehide the body, and assert both the display POST and the navigation
against stock.

**C4 — Medium — `test/adobe-b4-personalization.test.js:174,225-228`; `rig/adobe-b1-replay.mjs:~86`.** The click differential
is contaminated. `replayFixture` always boots `AirlockEds.bootAlloy` with click collection on, including on the stock page,
so the stock run carries airlock's own `linkClicks` POST as well. That is the "unexplained second linkClicks POST" the notes
carry. `toBeGreaterThanOrEqual(1)` and the order-dependent `stock[0]` hide it. Fix: boot the stock arm with
`clickCollectionEnabled:false` (or add a no-boot option to the rig), assert exactly one stock POST, pick it by content not
index, and rewrite the carry.

**C5 — Medium — `adapters/eds/link-click.js:94-96`, `adapters/eds/index.js:1994`, `test/adobe-b4-personalization.test.js:242`.**
Interact notifications don't match stock. Stock merges `propositionInteract` into the click event itself (one event, with
`web.webPageDetails.viewName` for view scope and `propositionAction {label, tokens:[token]}`). Ours sends two events
(interact, then `linkClicks`), drops `viewName`, reads the label from `data-aep-click-label` instead of the proposition's
`trackingLabel`, and never sends a token. AJO auto-interact collection (`data-aep-interact-id`,
`autoCollectPropositionInteractions`) is absent and not carried. The differential compares only `_experience.decisioning`,
so the event-count and shape difference passes. Fix: merge interact into the click event, add `viewName`, use `tokens`
from `trackingLabel` metadata, implement or explicitly carry AJO auto-collect, and compare full bodies.

**C6 — Medium — `adapters/eds/personalization-render.js:191`.** A response `html-content-item` with `data.selector` and
`data.type` is not rendered. Stock renders it as a DOM action with no metadata needed. Ours renders it only via
`applyPropositions` metadata. Fix: treat an `html-content-item` carrying `data.selector` and `data.type` as a DOM action, and
add a differential case.

**C7 — Low — slice notes, DoD.** `npm test`, lint and servo gate output are claimed but no output or counts are recorded.
"20 tests in real Chromium" is 18 Chromium plus 2 hermetic. Fix: record the actual run lines and correct the count.

**C8 — Low — `adapters/eds/index.js` (bootAlloy).** The new `onDecisions` boot option is not listed in "What was built" and
has no JSDoc on the boot options. Fix: list it in the notes and document it next to `placements`.
