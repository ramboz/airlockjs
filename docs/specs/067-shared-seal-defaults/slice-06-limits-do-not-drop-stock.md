---
status: DONE
dependencies: [067-01]
last_verified: 2026-11-13
---

## Slice 067-06: Limits never drop or delay stock output by default

**Goal:** No cap, queue limit, retention limit, ring size or byte budget drops or delays what the stock tag sends by default. Tighter limits are opt-in. The consent-hold ring's oldest-dropped cap stays (067-02 owns it, as part of the consent exception).

**DoR:**
- ✅ ADR-0062 point 6. ADR-0004:114-117 is the budget it amends.
- Ground first (spec 067 section 8, check 3). Grep every cap, drop, budget and retention limit in `core/`, `connectors/` and `adapters/` and list each with what it can drop. Known: `KEEPALIVE_BUDGET_BYTES = 64 * 1024` and the drop in `createCriticalDispatcher` (`core/egress.js:33,137`), and the unload flush order (`core/airlock.js:639-643`). The descriptor `ring` and the 50-event drain chunk (`:628`) show no cap: confirm by test before changing anything.

**Acceptance Criteria:**

1. The grounding list is written into the slice notes. Each limit is labelled "drops or delays stock output by default" or "does not".
2. For each limit that drops stock output by default, the default is lifted. For the keepalive budget, nothing is dropped that stock would deliver under the same browser limit (the 64 KiB keepalive limit is shared by all in-flight keepalive requests, so splitting adds no capacity). Any remaining loss is recorded as a browser limit, and a test proves the budget drop no longer discards events stock would send.
3. A site opts into a tighter limit with explicit config (for example a lower budget or ring cap). Over-limit behavior (drop, with a diagnostic) is its own tested state.
4. A burst larger than any former cap reaches the wire in order, with nothing dropped, on the default path (a rig test).
5. Any limit that remains by default is a safety limit that does not change stock output, and the slice names it and why (for example the drain chunk size is batching, not dropping).
6. The consent-hold ring cap is not touched here. A test confirms it is unchanged from 067-02.
7. Tests cover the stock-default path and each opt-in limit as separate states.

**DoD:**
- `npm test && npm run lint` and the servo quality-gate pass.
- architecture.md Q3 (the ~64 KiB split) is reworded to match.

**Consumers:** Adobe 064-18 onward (vendor-adobe); Google G12; Meta M9 and the D1 row.

**Anti-horizontal-phasing check:** Vertical: the limit, the lifted default and the opt-in proven with one over-limit burst in the rig.

### Grounding list (AC1, AC5)

Grepped `core/`, `connectors/`, `adapters/` for caps, drops, budgets, rings, retention.

| Limit | Where | Drops or delays stock output by default? |
|---|---|---|
| `KEEPALIVE_BUDGET_BYTES` 64 KiB, drop in `createCriticalDispatcher` POST path | `core/egress.js` | **Dropped** (unload fast path, POST connectors). Lifted: over the browser limit now sends non-keepalive; an explicit `budgetBytes` / `keepaliveBudgetBytes` is the opt-in drop. GET connectors (`requestMapper`) never consumed it. |
| Unload flush order (critical types first) | `core/airlock.js` `unloadFlush` | Does not drop. Reorders critical types first; every event is still sent. Kept: with the browser limit as the only loss, ordering decides who wins a keepalive slot. |
| 50-event drain chunk | `core/airlock.js` `drain`, `flushNow` | Does not. Batching; the loop reschedules until the ring is empty (test: 600-event burst, order kept). Kept as a safety limit (bounds one worker message and the INP cost of one drain). |
| Capture `ring` / `log` | `core/airlock.js` | Does not: unbounded arrays, no cap (confirmed by test before the change). |
| Worker reply `ready[]` dispatch | `core/airlock.js` `worker.onmessage` | Does not: one fetch per survivor, no limit (test: 600). |
| `MAX_HELD_BEACONS` 200 | `core/airlock.js` | Drops oldest, but it is the consent-hold exception (067-02). Untouched; test pins it. |
| `GA4_BATCH_MAX_BYTES` 60000 / `GA4_BATCH_MAX_EVENTS` 25 | `connectors/ga4/coalesce.js` | Does not: protocol limits; overflow starts a new chunk (and an oversize single item is its own chunk). Nothing dropped. |
| `requestIdleCallback(drain, { timeout: 50 })` | `core/airlock.js` `schedule` | Delays by up to 50 ms: the ADR-0002 batching delay, not a drop and not a stock-output change; kept. |
| Intercepted-fetch `timeoutMs` | `core/wrapped-sdk-host.js` | Does not: answers the SDK early; the send still goes out. |
| 150 ms stock-context throttle | `core/airlock.js` | Does not: context channel, not event output (067-07). |
| Inspector collector `capacity` | `core/inspector/collector.js` | Does not: diagnostics retention, not stock output. |
| `GA_COOKIE_MAX_AGE_S`, `slice(0, n)` string trims (pixel advanced matching, EDS label) | connectors, adapters | Do not: protocol or stock formatting, not queue limits. |
| `mirror.js` `__queue.splice` | `core/worker-dom/mirror.js` | Does not: drains the whole queue. |

Remaining browser limit (AC2): a send beyond the browser's shared 64 KiB keepalive quota goes out non-keepalive, so it survives only if the page does. Stock `sendBeacon` hits the same quota.

Steady-state worker-mapped dispatch and the consent-grant flush share one in-flight keepalive tracker with the unload path (`createKeepaliveTracker`, `sendTracked`): a send that would push in-flight keepalive bytes past 64 KiB goes out as a plain fetch and releases on settle. Still exactly one fetch per request, no retry (ADR-0021/040-04 AC2).

### Opt-in (AC3)

`createAirlock({ keepaliveBudgetBytes })` -> `createCriticalDispatcher({ budgetBytes, onBudgetDrop })`. Over it: drop, count in `stats().fastDropped`, `kind: "keepalive-budget"` diagnostic. No ring cap was added: no ring cap exists today and ADR-0062 only requires lifting drops.

### Reconciliation sweep

- Spec 067 check 3: matched (grounding list above; the ring never capped, the keepalive drop is lifted, hold ring untouched).
- ADR-0062 point 6 and ADR-0004:114-117: no change needed (status lines landed in 067-01).
- Docs updated: `docs/architecture.md` Q3, `docs/memory/glossary.md`.

### Deviation log

- AC3's "ring cap" example is not built: the ring never dropped, so there is nothing to make opt-in.
- AC4 is proven twice: a vitest integration test with a fake worker (`test/limits-stock-default.test.js`) and a real-Chromium rig (`npm run rig:limits-burst`, 600-event burst, in order, 453 plain fetches, nothing dropped). The rig asserts order on the fetch calls the seal issues, since the browser may reorder wire arrival between keepalive and plain requests.
- Scope note: the plain-fetch fallback also covers steady-state dispatch and the consent-grant flush (not only unload), per ADR-0062 point 6; Q3 reflects it.
