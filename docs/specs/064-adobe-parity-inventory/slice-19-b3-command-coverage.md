---
status: IN_PROGRESS
dependencies: [064-18, 067-03]
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
4. Fixtures S3 to S7 compare clean. S6 supplies a consent state matching the recording (ADR-0062 exception: the consent hold stays; it depends on the shared empty-`egressPurposes` and pending hold-and-flush slices on main; 067-03, spec 067 s8 check 11).

**DoD:**
- `npm test && npm run lint` and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.

## Notes (2026-11-20)

### AC2: the 6 function-valued options (decided)

Why this is a design call: a function cannot cross the airlock (structured clone), and the chamber has no DOM and no site code. The connector configures Alloy from a fixed, data-only option set, so none of these options can be forwarded. Rule used for each option: where could the function legitimately run, and is there a data form of the same effect?

| Option | Disposition | Reason and the supported equivalent |
|---|---|---|
| `onBeforeEventSend` | **incompatible as a function** | Event content is built on the main thread. The site shapes `params.xdm` (or does not push, to cancel) before `push`; `payloadDenylist` covers declarative stripping. Not forwarded; the connector emits an `unsupported-callback` diagnostic if one is passed, so it never vanishes silently. |
| `clickCollection.filterClickProperties` | **incompatible as a function** | Clicks happen on the main thread and the chamber configures `clickCollectionEnabled:false`. The site decides which click properties go into the pushed link event. Validator key is `filterClickProperties` (not the deprecation text's `filterClickDetails`). |
| `onBeforeLinkClickSend` | **incompatible as a function** (deprecated by Adobe) | Same reason and same equivalent as `filterClickProperties`. |
| `subscribeRulesetItems.callback` | **mediated as data, no function** | Rulesets and their results are Alloy-side data. The chamber delivers results through the granted `decisions` capability (already how propositions leave); the host maps them. The site subscribes by command and receives data, not by passing a function. 064-20 (B4) checks the delivery. |
| `createMediaSession.getPlayerDetails` | **incompatible as a function** | Alloy calls it repeatedly to read live player state, which is a main-thread DOM read. A cross-thread async round trip changes the cadence Alloy relies on. 064-22 (B6) may propose a main-thread player adapter that pushes details as data; it is out of the default surface. |
| `sendConversationEvent.onStreamResponse` | **incompatible as a function** | A function fed by a streaming fetch. The seal bridges whole responses (067-06), not incremental chunks. 064-22 (B6) may propose chunked data delivery; out of the default surface. |

Consequence for 064-20 (B4): only `subscribeRulesetItems.callback` is B4's to verify, and the check is that results arrive as data through `decisions`, not that a function runs.
Consequence for 064-22 (B6): cite this table for `getPlayerDetails` and `onStreamResponse`.
