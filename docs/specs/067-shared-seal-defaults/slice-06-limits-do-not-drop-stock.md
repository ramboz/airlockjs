---
status: READY_FOR_IMPLEMENTATION
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
