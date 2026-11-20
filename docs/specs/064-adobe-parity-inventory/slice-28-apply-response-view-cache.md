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
2. `track` waits for every pending delivery, not only the last one, including the redirect display's keepalive send (a separate event, from 064-24), and view propositions that reach `onDecisions` carry `renderAttempted` consistently with stock.
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
- **AC2:** `createDeliveryTracker` (a set of in-flight deliveries; `settled()` waits for all, including ones tracked while waiting) replaces the last-delivery-only `pendingDelivery`. The redirect display is a separate event queued behind the event that rendered it, so awaiting it there would deadlock: it is tracked separately, queued ahead of waiting page events, and the next page event waits for it (until its keepalive send is issued or its event settles). `onDecisions` copies of view propositions carry `renderAttempted` from the renderer's own result (true for the named, rendered view; false otherwise), matching stock's returned propositions. JSDoc for `onDecisions` otherwise unchanged.
- **AC3:** differential showed one difference: a warmed view-scoped redirect still sent the page event that named the view, where stock sends only the redirect's display and navigates. The warm path now drops that event when the cached view started a redirect. Display, keepalive and navigation order match stock.
- **Out-of-AC differences, owned by 064-29** (found because a first push after `applyResponse` carries the declared scopes in ours): the scopes ride the first interact where a no-scope stock call sends none (AC1), and stock's scoped fetch replaces the named view with the placeholder (AC2). The 064-28 differentials give both arms the same scoped, view-less first push and then name the view.
- **Tests.** Hermetic: `createDeliveryTracker` (3 cases). Real Chromium (pinned stock bundle, SYNTHETIC responses, 0 captures; both files are existing GATING steps in `browser-oracle`): applied view renders and notifies once; empty applied body initializes the cache; a second `applyResponse` keeps earlier views and replaces the named one; `renderAttempted` on `onDecisions` with `renderDecisions` true and false; the warmed redirect sequence. Each fails without its change (checked: AC1 and `renderAttempted` fail on the old code, the redirect compare saw four POSTs against stock's three).
