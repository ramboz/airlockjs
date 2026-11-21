---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-29]
last_verified: 2026-11-20
---

## Slice 064-32 — first push query edge cases match stock

**Goal:** The decision of whether a push carries a personalization query, and what it carries, matches pinned stock Alloy 2.31.1 for the odd inputs 064-29 left out: invalid surfaces and scopes, placement scopes spent by `applyResponse`, and a notification-shaped push that passes scopes.

**DoR:**
- ✅ 064-29 done (the host tells the chamber the view cache is warm; `carriesQuery` follows stock for well-formed scopes and surfaces).

**Acceptance Criteria:**

1. A push whose `personalization.surfaces` holds only entries stock drops as invalid (not `web://...` or `#...`), on a warm cache with a named view, ends in the state stock reaches (stock answers from the cache without a fetch), shown by a differential test on the request bodies and the DOM. Today the host treats any non-empty surface string as a query, so the view never renders.
2. A push whose `decisionScopes` holds an empty string or a non-string entry behaves as stock for the same call (a query, or the validation error stock raises), shown by a differential test on the request bodies and the settled result.
3. A push whose XDM names a `decisioning.proposition*` event type and passes `decisionScopes` sends the personalization query as stock does (today the connector sends none, 064-20), shown by a differential test on the request body.
4. A boot with `placements` naming scopes other than `__view__`, then `applyResponse`, then a first push that passes no scopes: the placements' scopes are not fetched (stock declares none and sends no query on a warm cache), shown by a differential test on the request bodies; the adopter docs say an earlier `applyResponse` spends the declared placement scopes.

**DoD:**
- `npm test && npm run lint` and servo gate pass.
- Real-browser tests run under `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job.

**Anti-horizontal-phasing check:** Vertical: host `carriesQuery` and connector scope handling to request body and rendered view.

## Notes

Found by the 064-29 reconciliation review (M1, M2, L1 to L3). Use SYNTHETIC responses only; if a new live capture is needed, stop and report `blocked`. Confirm each stock behavior in the pinned 2.31.1 bundle before building the AC (the review read stock from memory).
