---
status: DONE
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

## Findings

All six ACs are met. Stock was confirmed by the differential against the pinned 2.31.1 bundle (the SHA-checked `/rig/alloy.min.js`), SYNTHETIC responses, 0 captures. No `core/` change (`core/wrapped-sdk-host.js` is untouched); no allowlist change.

- **AC1 (query only when stock sends one).** The host tells the chamber the view cache is warm (a `viewCacheWarm` param the host sets and strips from page input); the connector then treats the configured first-event scopes as spent. A call that passes scopes, surfaces or `defaultPersonalizationEnabled: true` still carries a query (`carriesQuery`). Real Chromium, `test/adobe-b4-personalization.test.js`: "AC1: the first push after applyResponse carries no declared scopes ..." and "AC1: ... that passes decisionScopes still carries them".
- **AC2 (named view missing from the fetch).** The view cache keeps the latest fetched storage apart from the merged views; an applied response merges but is never "latest"; a push that carries a query is never answered from the merged cache and renders from the latest fetch (placeholder when absent). Real Chromium: "AC2: a scoped first push naming a view the fetch answer lacks ...", comparing request bodies and DOM (the notification compare is type, query, scopes and proposition scopes, not the full body).
- **AC3 (`track` waits for the display send).** `redirectDisplay` is tracked as a delivery, bounded by `redirectDisplayTimeoutMs` (default 1500 ms, so the wait is "issued or the bound"); the pump sends a front-queued display itself while it waits, so it cannot deadlock. Hermetic, `test/adobe-apply-response-queue.test.js`: "AC3: an answer that starts a redirect keeps its delivery pending ..." (observed through prehiding, which the pump lifts only after the deliveries settle; no caller awaits `track` directly).
- **AC4 (ring).** The ring drops the oldest held non-display event; with only displays held, the oldest display; a dropped display settles `redirectDisplay` (`sent: false`, "dropped by the consent hold ring"). Hermetic: "AC4: a later enqueue drops the oldest held page event ..." and "AC4: a redirect display the ring drops settles redirectDisplay ...".
- **AC5 (order).** A push takes a gate on the `applyResponse` commands in flight when it is enqueued and computes its cache state after it. Real Chromium: "AC5: a push enqueued before an applyResponse finishes sees the warmed cache ...".
- **AC6 (diagnostic).** `createHostCommandEntry` takes `diagnose`; a store failure is a warn diagnostic (`kind: decisions`, `disposition: view-cache-failed`) and the command still resolves. Hermetic, `test/adobe-h1-host-command.test.js`: "064-29 AC6: ...".
- **Tests.** Real Chromium (existing GATING step in `browser-oracle`): the four differentials in `test/adobe-b4-personalization.test.js`. Hermetic: the rest. Each was run with the production change reverted and FAILED (7 of 7 at the first commit; the two round-1 tests below too). Also changed: the 064-28 differentials pass the scoped first push to both arms explicitly, because an unscoped first push after `applyResponse` now matches stock (no query).
- **Round 1 review fixes** (hermetic, `test/adobe-apply-response-queue.test.js`, each checked to fail without its fix): a page-supplied `viewCacheWarm` is stripped on every event, including a notification-shaped one; a redirect display queued by an in-flight `applyResponse` is sent ahead of the push gated on it (the gate wait drains front displays). **Amended by 064-32 round 5 (owner decision):** pinned stock sends a push called behind an unawaited apply before that apply's redirect display, so this order is reversed. The gate now waits for the apply's cache warm only, and the matching hermetic test was rewritten, not deleted.
- **ADR-0063** gets a consequence line: a push waits for an earlier `applyResponse`.
- **Out-of-AC differences, owned by 064-32:** invalid surfaces treated as a query (AC1); empty or non-string `decisionScopes` entries (AC2); a `decisioning.proposition*` push with scopes sends no query (AC3); placement scopes spent by an earlier `applyResponse` (AC4); a push enqueued before an `applyResponse` that is still waiting when it finishes reads the warmed cache, and the gate drain can let an event pass its own redirect display in a microtask race (AC5; round 2 craft). These were read from memory of stock by the reconciliation reviewer and are to be confirmed against the bundle in 064-32.
- **Reviews:** reviews/slice-29-{compliance,craft,reconciliation}.md (Opus 5.5; rounds 1 and 2, no production-code change after round 1's fix commit; the remaining craft and reconciliation findings are owned by 064-32 or recorded in the reviews).
