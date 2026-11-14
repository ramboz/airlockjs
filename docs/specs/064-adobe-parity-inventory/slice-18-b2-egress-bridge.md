---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-17, 067-03, 067-06]
last_verified:
---

## Slice 064-18 — B2: Egress bridge

**Goal:** Every request the tag makes leaves through the capability bridge with the recorded shape: fetch init, interact versus collect, edge domain versus demdex, location-hint path, response headers and error shapes.

**DoR:**
- ✅ B1 done.

**Acceptance Criteria:**

1. The fetch init (`credentials: include`, `cache: no-cache`, `referrerPolicy`) is carried through the bridge, not dropped.
2. `sendBeacon` is routed or denied with a visible diagnostic; ID-sync and URL-destination pixels and script or iframe loads are either bridged or tagged with a reason.
3. Edge domain kind (first-party versus Adobe) is honored and `x-adobe-edge` is read.
4. An unknown handle type raises a visible error, using the known-types list in spec 064 section 2.2.
5. The default egress allowlist covers every destination in spec 064 section 2.2 (ADR-0062 exceptions: the consent hold and the credentials denylist stay; fixtures supply the recorded consent state). The hold-and-flush behavior comes from 067-03 and the no-drop limits from 067-06 (spec 067 s8 check 11).
6. Fixtures S0, S3, S6 (request and transport shape only; consent command behavior is B3), S8 and S11 compare clean through real chamber dispatch.

**DoD:**
- `npm test && npm run lint` and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.
