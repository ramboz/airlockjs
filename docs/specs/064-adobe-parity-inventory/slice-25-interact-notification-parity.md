---
status: DONE
dependencies: [064-20, 064-23, 064-24, 064-26]
last_verified: 2026-11-20
---

## Slice 064-25 — Interact notification parity

**Goal:** Click-driven proposition interact notifications match stock Alloy's full request body.

**DoR:**
- ✅ 064-20 done (renderer, `wireAlloyDecisions`, link-click collector, harness extension).
- ✅ Stock behavior is readable in the pinned bundle; the harness runs stock and Airlock on one synthetic page.

**Acceptance Criteria:**

1. The `propositionInteract` data is merged into the click event itself, as stock does, not sent as a separate event.
2. `viewName`, and `trackingLabel` read from item characteristics (not `data-aep-click-label`), are sent as stock does; the token uses `tokens:[token]`.
3. AJO auto-collect of click interactions is implemented or dispositioned with a reason.
4. Full request bodies compare clean against stock (meta stripped), not `decisioning` only.
5. Click-type items are left out of the display notification, as stock does (carried from 064-23; the renderer counts them today).
6. When one event renders page-wide and view propositions, their display notifications go in one display event, as stock Alloy 2.31.1 does (carried from 064-23).

**DoD:**
- `npm test && npm run lint` and servo gate pass.
- Real-browser tests run under `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.

## Notes

From 064-24: the redirect display stays its own keepalive collect, as stock does, so the AC6 fold (page-wide plus view in one display event) does not cover it.

Origin: 064-20 carry C5. Before this slice the interact was a separate event, `viewName` was dropped, and the test compared `decisioning` only.

## Findings (2026-11-20)

- **AC1, AC2, AC4 met.** `collectInteraction` in `adapters/eds/personalization-render.js` mirrors stock's `collectClicks` and `collectInteractions`; `adapters/eds/link-click.js` builds ONE event per click: the link click's `web.webInteraction` and `data`, merged with `decisioning.propositionInteract`, `propositionEventType.interact`, `viewName` and `propositionAction` (`label`, `tokens:[token]`). The event type is the interact's, as stock. A click on a non-link sends the interact alone. The label of a click item comes from the item's `characteristics.trackingLabel`; `data-aep-click-label` is read only as stock reads it, on AJO-decorated elements. The real-Chromium test compares the full POST bodies against pinned stock 2.31.1 (meta stripped) on synthetic answers.
- **AC3 built, not dispositioned.** The renderer decorates elements per action type as stock does (`data-aep-interact-id`, `data-aep-click-label` from item characteristics) and collects clicks inside them, honoring `autoCollectPropositionInteractions` (default AJO `always`, TGT `never`; `decoratedElementsOnly` and `never` tested against stock, DOM and bodies). The option is read on the main thread and is not forwarded to the chamber.
- **AC5 met.** A click item still counts as render-attempted but is left out of the display notification; a click-only proposition is not in it.
- **AC6 met.** The page-wide and view propositions of one event already shared one display event; the gap was that the display carried no `viewName`. It now does, as stock. The redirect display stays its own keepalive collect and is untouched.
- Each AC has a real-Chromium test that fails without the change, in the existing `browser-oracle` GATING step for `test/adobe-b4-personalization.test.js`.
- **Known, by design (not a gap in this slice):** the sanitizer strips `onclick` and similar attributes from rendered HTML (spec 064 s2.2), so a DOM compare of such content differs from stock; the new tests keep that out of the compared HTML.
- **Gate:** `npm test` and `npm run lint` clean; servo quality-gate composite 1.0 pass; no `core/` change (the consent hold file is untouched).
