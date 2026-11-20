---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-23, 064-28]
last_verified: 2026-11-20
---

## Slice 064-29 — first push after applyResponse matches stock

**Goal:** The first push after `applyResponse` sends the personalization query, and answers a named view, the way pinned stock Alloy 2.31.1 does for the same call.

**DoR:**
- ✅ 064-23 done (first-event-only `decisionScopes`, host view cache).
- ✅ 064-28 done (`applyResponse` warms the host view cache).

**Acceptance Criteria:**

1. After `applyResponse`, the first push carries the declared decision scopes only when a stock `sendEvent` for the same call does (stock sends no personalization query when the call passes no `decisionScopes` and the cache is warm), shown by a differential test on the request bodies.
2. A first push that carries scopes and names a view an earlier `applyResponse` cached, where the fetch answer lacks that view, ends in the state stock reaches (stock's fetch replaces the named view with the empty-view placeholder and sends its display), shown by a differential test on the DOM and the notification.
3. `track` (and so a caller awaiting it) waits for a redirect display's keepalive send to be issued, not only for its queue position, shown by a test that holds the display and observes `track` pending until it leaves.
4. Under a consent hold, a redirect display queued at the front of the ring is not dropped by a later enqueue before older held events, and a dropped display settles `redirectDisplay` (not only the renderer timer), shown by a hermetic test.
5. A push queued before an `applyResponse` finishes sees the warmed cache, as stock runs its commands in order, shown by a differential test.
6. A failure while `applyResponse` stores its view propositions is reported as a warn diagnostic (today it is swallowed in `host-command.js`), shown by a fault-injection test. Carried from the 064-28 craft review: no wire input can make the store throw (`viewPropositionsOf` keeps only string-scoped objects), so 064-28 could not test it without injecting a fault.

**DoD:**
- `npm test && npm run lint` and servo gate pass.
- Real-browser tests run under `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job.

**Anti-horizontal-phasing check:** Vertical: connector first-interact scopes to request body and rendered view.

## Notes

Found by the 064-28 differential (AC1, AC2) and its round-3 review (AC3 to AC5). Its tests give both arms a scoped, view-less first push (so the request matches) and then name the view; these two differences are what that shape avoids. Stock source: `createViewCacheManager.createCacheUpdate().update()` returns the named view of the NEW storage only, while a later merge keeps the old views for later pushes.
