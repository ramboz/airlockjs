---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-03, 064-04, 067-05, 067-07, 067-08, 067-10]
last_verified:
---

## Slice 064-17 — B1: Environment snapshot and storage seeding (pilot)

**Goal:** Location, referrer, viewport, screen, UA and client hints, the apex (getTld) probe, the `context` option, and cookie, localStorage and sessionStorage before-state reach the chamber as real host values and match the recorded corpus.

**DoR:**
- ✅ CAP done; B0 field-rule comparison landed. D8 recorded (spec 064 section 11; ADR-0062 Accepted).
- ✅ The Alloy-source rule table (B0) is available.

**Acceptance Criteria:**

1. `context` defaults to stock `[web, device, environment, placeContext]` and is fed by real host values. The hard-coded `airlock.example`, 1280x800 and `en-US` shims are gone. A reduced `context` is a site opt-in (D8, ADR-0062). The credentials denylist stays on; a field it removes is a documented difference, not a parity failure.
2. Replay feeds each fixture's recorded before-state (cookies, localStorage, sessionStorage) before the page loads (ADR-0061 point 1).
3. Fixtures S1 (with its one-factor variants), S2 and S5 compare clean through the chamber, including the exact expected differences of each variant (spec 064 section 4.3).
4. RulesEngine globals: the shim does not define `window.title/url/referrer/height/width`.
5. The count of captures needed beyond the corpus is written into spec 064 (more than 3 triggers a kill criterion).

**DoD:**
- `npm test && npm run lint` and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.

> 2026-11-13: depends on shared seal defaults (spec 067)
