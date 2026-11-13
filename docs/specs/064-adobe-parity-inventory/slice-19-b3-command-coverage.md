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

1. Each row of spec 064 section 2.1 points to a fixture and compares clean, or is marked incompatible with a reason.
2. Disposition of the 6 function-valued options (`onBeforeEventSend`, `clickCollection.filterClickProperties`, `onBeforeLinkClickSend`, `subscribeRulesetItems.callback`, `createMediaSession.getPlayerDetails`, `sendConversationEvent.onStreamResponse`) is decided and recorded.
3. `appendIdentityToUrl` runs worker-native.
4. Fixtures S3 to S7 compare clean.

**DoD:**
- `npm test && npm run lint` and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.
