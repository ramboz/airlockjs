---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-20]
last_verified:
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
