---
status: DONE
dependencies: [064-20]
last_verified: 2026-11-20
---

## Slice 064-24 — Redirect display notification

**Goal:** A redirect proposition sends its display notification before the page navigates, as stock Alloy does.

**DoR:**
- ✅ 064-20 done (renderer, `wireAlloyDecisions`, link-click collector, harness extension).
- ✅ The seam keepalive path exists: 064-18 routes `sendBeacon` and `init.keepalive` through the seal and `createKeepaliveTracker` (`core/egress.js`).

**Acceptance Criteria:**

1. A redirect proposition prehides the body, sends the display notification with keepalive (the `documentUnloading` hint on the pushed event) through the seam, then calls `location.replace`.
2. The display request body compares clean against pinned stock Alloy 2.31.1 on the same synthetic page (differential), including the keepalive flag.
3. A held or failed display does not block navigation indefinitely; the outcome is diagnosed.

**DoD:**
- `npm test && npm run lint` and servo gate pass.
- Real-browser tests run under `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.

## Notes

Origin: 064-20 carry C3. The earlier note "needs a keepalive path through the seam" was wrong: the path exists from 064-18; what is missing is the `documentUnloading` hint and the ordering before `location.replace`.

## Findings (2026-11-20)

All three ACs met; no `core/` change (the consent hold is untouched).

- **AC1/AC2**: a redirect prehides BODY, pushes the display with `documentUnloading: true`, and navigates after the request is issued. Stock only uses `sendBeacon` (keepalive) when the identity cookie exists, so the differential's synthetic answer sets one (`state:store`, fixture placeholder org). Body and keepalive flags compare equal to stock.
- **AC3**: a display that is held (seal ceiling) or failed navigates after a bounded wait (`redirectDisplayTimeoutMs`, default 1500 ms), diagnosed as `redirect-display-held` or `redirect-display-failed`. Stock does not navigate when the display fails; this is the deliberate AC3 deviation. A throwing diagnostic sink never blocks navigation.
- **Hint-less collect (closes 064-18 F3)**: `https://edge.adobedc.net/ee/v1/collect` (and the first-party host variant) added to the endpoint ceiling. Source-derived, not captured; found because the seal held the display.
- **Only the redirect renders** (stock `onlyRenderThis`, verified in the pinned bundle); other propositions and later redirects are skipped.
- **Left to siblings**: the redirect's display stays a separate keepalive event; whether `track` waits for it and whether a warmed view-scoped redirect navigates are owned by 064-28 (AC2 `track` wait; warmed view-scoped redirect) and 064-25 (display stays a separate event), each noted in its slice. **Closed by 064-28 (2026-11-20):** the redirect display is queued ahead of waiting page events; a warmed view-scoped redirect navigates with only its display sent, as stock.
- **Same-document redirect** (target differs only by `#hash`): no unload, BODY stays hidden, as in stock; not addressed.
