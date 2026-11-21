---
status: DONE
dependencies: [064-23, 064-24, 064-26]
last_verified: 2026-11-20
---

## Slice 064-28 — applyResponse warms the host view cache

**Goal:** A push naming a SPA view after `applyResponse` renders and notifies that view from cached propositions, as stock Alloy 2.31.1 does, instead of being treated as a cold cache.

**DoR:**
- ✅ 064-23 done (host view cache, per-event view context).
- ✅ 064-24 done (redirect display, a separate keepalive event).
- ✅ 064-26 done (`applyResponse` host command).

**Acceptance Criteria:**

1. View-scoped propositions in an `applyResponse` response body are stored in the host view cache, so a later push naming the view renders them and sends their display notification once (differential test against pinned stock).
2. `track` waits for every pending delivery, not only the last one, and the redirect display's keepalive send (a separate event, from 064-24) goes out ahead of every waiting page event, and view propositions that reach `onDecisions` carry `renderAttempted` consistently with stock, except `track` itself waiting on the redirect display's send (met by queue order only; closed by 064-29 AC3, 2026-11-20).
3. A warmed view-scoped redirect proposition behaves as pinned stock Alloy 2.31.1 does (navigates or not), shown by a differential test.

**DoD:**
- `npm test && npm run lint` and servo gate pass.
- Real-browser tests run under `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job.

**Anti-horizontal-phasing check:** Vertical: host command to view cache to rendered view and display notification.

## Notes

From 064-24: the redirect display is a separate keepalive event; AC2 and AC3 own the `track` wait and the warmed view-scoped redirect (064-24 only renders a redirect on the delivering path).

Raised by the 064-23 round-2 craft and reconciliation reviews. No core change: the host view cache lives in `adapters/eds/index.js`. Stock's `applyResponse` runs the same personalization `onBeforeEvent` as a normal event; confirm against the pinned bundle before building.

## Findings

- **Stock confirmed** in the pinned 2.31.1 source: `applyResponse` runs the personalization `onBeforeEvent` with the page-wide scope, so `cacheUpdate.update()` stores the view propositions and initializes the cache even when none are view-scoped. The cache merges per view name.
- **AC1:** `createHostCommandEntry` takes an `onApplyResponse` hook; the host stores the applied body's view propositions (`viewPropositionsOf`, shared with the relayed-egress path) when personalization is configured. No `core/` change; `core/wrapped-sdk-host.js` is untouched.
- **AC2:** `createDeliveryTracker` (a set of in-flight deliveries; `settled()` waits for all, including ones tracked while waiting) replaces the last-delivery-only `pendingDelivery`. The redirect display is a separate keepalive event, queued at the FRONT of the pump queue, so it is sent before any waiting page event; the pump is serial and awaiting it inside the delivering event would deadlock, and a round-1 review showed a separate wait gate before the next event was a no-op that could deadlock, so it was removed. The ordering is covered by test (1) in `test/adobe-apply-response-queue.test.js` (listed under review fixes below); the AC3 differential asserts the display carries decisioning and the navigation follows, as stock. `onDecisions` copies of view propositions carry `renderAttempted` from the renderer's own result for the named, rendered view (others keep the chamber's value, `false`), matching stock.
- **AC3:** differential showed one difference: a warmed view-scoped redirect still sent the page event that named the view, where stock sends only the redirect's display and navigates. The warm path now drops that event when rendering the cached view started a redirect (deliberate behavior change, fixed in this slice). Display and navigation order match stock (the keepalive flag itself is covered by the 064-24 test, not re-asserted here).
- **Out-of-AC differences, owned by 064-29 (closed in 064-29, 2026-11-20)** (found because a first push after `applyResponse` carries the declared scopes in ours): the scopes ride the first interact where a no-scope stock call sends none (AC1), and stock's scoped fetch replaces the named view with the placeholder (AC2). The 064-28 differentials give both arms the same scoped, view-less first push and then name the view.
- **Tests.** Hermetic: `createDeliveryTracker` (3 cases). Real Chromium (pinned stock bundle, SYNTHETIC responses, 0 captures; the file is an existing GATING step in `browser-oracle`): applied view renders and notifies once; empty applied body initializes the cache; a second `applyResponse` keeps earlier views and replaces the named one; `renderAttempted` on `onDecisions` with `renderDecisions` true and false; the warmed redirect sequence. Checked to fail without the change: the AC1 applied-view test, `renderAttempted`, and the redirect compare (four POSTs against stock's three). Not checked: the empty-body, second-`applyResponse` and hermetic tracker cases. All 064-28 tests live in `test/adobe-b4-personalization.test.js` (an existing GATING step); the `onApplyResponse` hook has no separate unit test and the `track` wait is covered only by the hermetic tracker cases. Review fixes and their tests. Hermetic, in `test/adobe-apply-response-queue.test.js` (each checked to FAIL with its fix reverted): (1) a redirect display queued while a page event waits goes out before it (fails without `{ front: true }`); (2) the consent ring keeps a front-queued display when its own enqueue overflows it and drops the oldest held event (fails without the `splice(1, 1)` branch); (3) a push naming a cached view that does not redirect is still sent while an earlier redirect is under way (fails with the renderer-wide `isRedirecting()` check instead of `out.redirected`). Not tested: a failure inside `onApplyResponse` is swallowed without a diagnostic; no wire input can make the store throw, so it is carried to 064-29 AC6. Reverted attempt: clearing the watch timer when the display's event settles (the request is issued after its event settles; the 064-24 tests failed).
