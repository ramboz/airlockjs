---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-18]
last_verified:
---

## Slice 064-19 — B3: Command coverage and callbacks

**Goal:** All 17 commands (2 core, 15 component) have a row-to-fixture result: worker-native, mediated, or incompatible with a reason. The 6 function-valued options are decided here.

**DoR:**
- ✅ B2 done.

**Acceptance Criteria:**

1. Each row of spec 064 section 2.1 owned by B3 (rows 3 to 9) points to a fixture and compares clean. Rows owned by B4 (10 to 12) and B6 (13 to 17) are checked by those slices. B3 only confirms the 17-row matrix has an owner for every row.
2. Disposition of the 6 function-valued options (`onBeforeEventSend`, `clickCollection.filterClickProperties`, `onBeforeLinkClickSend`, `subscribeRulesetItems.callback`, `createMediaSession.getPlayerDetails`, `sendConversationEvent.onStreamResponse`) is decided and recorded.
3. `appendIdentityToUrl` runs worker-native.
4. Fixtures S3 to S7 compare clean. S6 supplies a consent state matching the recording (ADR-0062 exception: the consent hold stays; it depends on the shared empty-`egressPurposes` and pending hold-and-flush slices on main).

**DoD:**
- `npm test && npm run lint` and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.
