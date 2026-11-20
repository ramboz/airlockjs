---
status: DONE
dependencies: [064-20]
last_verified: 2026-11-20
---

## Slice 064-23 — SPA view cache and first-event-only decisionScopes

**Goal:** A SPA view change renders and notifies cached view-scoped propositions as stock Alloy does, and `decisionScopes` go on the first event only, so S7 compares clean with stock's POST count.

**DoR:**
- ✅ 064-20 done (renderer, `wireAlloyDecisions`, link-click collector, harness extension).
- ✅ Fixtures `s7-base` and `s7-repeat` are in the frozen corpus; no new capture needed.

**Acceptance Criteria:**

1. The main-thread renderer caches view-scoped propositions from responses and, on a push that names the view, renders them and sends their display notification once, as stock Alloy 2.31.1 does (differential test).
2. The Alloy connector sends the declared `decisionScopes` on the first event only, as stock does; a later event carries none.
3. S7 (`s7-base`, `s7-repeat`) compares clean on the production path with the same POST count as stock and no filter except `webPageDetails.URL`.

**DoD:**
- `npm test && npm run lint` and servo gate pass.
- Real-browser tests run under `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.

## Notes

Origin: 064-20 carries C2 and the "decisionScopes on every event" delta. Today `connectors/alloy/connector.js` sends the scopes on every event and S7 passes only with one extra POST and three filters (see 064-20 notes). Stock behavior is in the pinned bundle `rig/out/b1/alloy-2.31.1.min.js`. Do not touch the consent hold path in `core/wrapped-sdk-host.js`.

### Results (2026-11-20)

- **AC1 met.** `createViewCache` in `adapters/eds/personalization-render.js` keeps view-scoped propositions by lower-cased view name, merged per name, initialized by the first personalization response. The main thread reads them off the Edge response it already relays (`caps.egress.dispatch`), because the chamber's Alloy returns only the page-wide and current-view propositions. A push naming a view with a warm cache renders it and folds its display notification into that same event (no extra POST, no `query`); the first response renders only the named view, and only when that event passes `renderDecisions:true` (per-event, default from the boot option). An unknown view sends stock's empty-view display. View-scoped items are marked and skipped through `data-adobe-proposition-ids`, as stock does. Differentials against pinned stock 2.31.1 on synthetic responses (no capture) are in `test/adobe-b4-personalization.test.js`.
- **AC2 met.** `connectors/alloy/connector.js` sends `decisionScopes` (and the `defaultPersonalizationEnabled:false` suppression) on the first non-notification event only; hermetic test in `test/alloy-connector.test.js`, plus the differential.
- **AC3 met.** S7 (`s7-base`, `s7-repeat`) compares clean with the same 3 POSTs as stock and only the `webPageDetails.URL` filter on the first two. The S7 test now pushes per-event `renderDecisions` like the capture driver.
- The new real-Chromium tests live in the existing `browser-oracle` GATING step for `test/adobe-b4-personalization.test.js`.

### Deviations and carries

- Per-event `renderDecisions` on `push` is read by the host (the connector still sends `renderDecisions:false` to Alloy). Not a core change.
- **Carry (no AC) -> 064-25:** the renderer counts click-type items as rendered in the display notification; stock excludes them. Tracked in refinement-todo "Personalization follow-ups".
- The servo gate is not set up in this checkout (no `.servo/` oracle), so DoD was run as `npm test && npm run lint`. `test/dom-chamber-host-prism.test.js` fails here only because `node_modules/prismjs` is absent in this worktree (unrelated).
