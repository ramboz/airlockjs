---
status: DONE
dependencies: [064-18, 067-03]
last_verified: 2026-11-20
---

## Slice 064-19 — B3: Command coverage and callbacks

**Goal:** All 17 commands (2 core, 15 component) have a row-to-fixture result: worker-native, mediated, or incompatible with a reason. The 6 function-valued options are decided here.

**DoR:**
- ✅ B2 done.

**Acceptance Criteria:**

1. Each row of spec 064 section 2.1 owned by B3 (rows 3 to 9) points to a fixture and compares clean. Rows owned by B4 (10 to 12) and B6 (13 to 17) are checked by those slices. B3 only confirms the 17-row matrix has an owner for every row.
2. Disposition of the 6 function-valued options (`onBeforeEventSend`, `clickCollection.filterClickProperties`, `onBeforeLinkClickSend`, `subscribeRulesetItems.callback`, `createMediaSession.getPlayerDetails`, `sendConversationEvent.onStreamResponse`) is decided and recorded.
3. `appendIdentityToUrl` runs worker-native.
4. Fixtures S3 to S7 compare clean. S6 supplies a consent state matching the recording (ADR-0062 exception: the consent hold stays; it depends on the shared empty-`egressPurposes` and pending hold-and-flush slices on main; 067-03, spec 067 s8 check 2, Alloy pending today).

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

### Results (rows 3 to 9, S3 to S7)

Tests: `test/adobe-b3-commands.test.js` (hermetic matrix-owner and callback-diagnostic checks, plus real-Chromium replays gated in `browser-oracle`). Harness change: `replayFixture` gets `run(page)` and `event: null` (rig only, no shared seam changed).

| Row | Command | Class | Fixture | Result |
|---|---|---|---|---|
| 3 | `sendEvent` | worker-native | S3 (`s3-base`, `s3-repeat`, `s11-s3`), S7 | clean |
| 4 | `applyResponse` | worker-native | S3 recorded response | runs, no send, no unknown handle |
| 5 | `getIdentity` | worker-native (one acquire on fresh) | S5 | clean (shape, ECID, `edge` as recorded; returning sends nothing) |
| 6 | `appendIdentityToUrl` | **worker-native (AC3)** | S5 | `adobe_mc` with `TS`, `MCMID` = the ECID, `MCORGID`; no network after the acquire |
| 7 | `getLibraryInfo` | worker-native | `s3-base` replay (no own fixture) | reports 2.31.1 |
| 8 | `setConsent` | worker-native + seam hold | S6 | see below |
| 9 | `createEventMergeId` | worker-native | `s3-base` replay (no own fixture) | UUID, no send |

Rows 4 to 7 and 9 are chamber facts here (rig path). Since 064-26 they are also site-callable through `handle.command`; see slice 064-26 for that proof.

Rows 1 and 2 (`configure`, `setDebug`) are B1's (spec 2.1); rows 10 to 12 are B4's, 13 to 17 are B6's. A hermetic test asserts the matrix has 17 rows, each with an owner, and that B3 owns exactly rows 3 to 9.

- **S4** (request side): the first interact carries `decisionScopes` `[scope, "__view__"]` and compares clean for all four fixtures. Rendering and the `propositionDisplay` second POST are B4's. The chamber's `sendEvent` hardcodes `renderDecisions:false`; the replay sends `renderDecisions:true` through the rig command (stock option), and the request body is identical, so no connector change is needed for the request side.
- **S7**: page, link and SPA view compare clean. One expected difference on the first two interacts (page, link): the capture sent them from its own run URL (with `run=` id) before `pushState`; the replay page starts at the manifest URL. The link event is a manual `sendEvent` (the capture ran `clickCollectionEnabled:false`), so no `documentUnloading` path is exercised and **F3 stays carried** (hint-less `/ee/v1/collect` not on the allowlist; not in the corpus).
- **S6** (hold on, page consent `pending`, two queued page views): nothing leaves while pending. `s6-in` and `s6-pending-in` (3 s wait): the grant sends the set-consent then both interacts, same paths and order as recorded, bodies clean (cookie-jar order of `meta.state.entries` compared as a set; it is incidental). **One documented delta, `s6-out`:** the recording shows the opt-out `set-consent` (`collect:n`) reaching demdex. Here the strict consent gate holds it (visible `kind:"consent"` diagnostic), so the refusal is not forwarded to Adobe; the queued events are dropped either way. This is a parity gap, not working as designed: ADR-0062 point 5 covers the hold before consent, not a refusal signal. Carried for the owner: carried for the owner (forwarding it would need a shared seam exemption for `privacy/set-consent` without `query.identity.fetch`, which main would have to adopt).
- **Lifecycle, Identity, Consent rows of s2.2**: covered above; ID-sync pixels stay with 064-22.

### 067-03 residual: carried (behavior pinned)

Stale Alloy consent cookie "in" with page consent pending: the seam holds the interact once, visibly, no other-host retry (064-18). On a later grant the held request is **dropped, not flushed**: only Alloy's own `set-consent` goes out. The behavior is pinned by test, but ADR-0062 point 4 says "hold means hold and flush on grant", so the drop is **not accepted as final: carried for the owner** (`docs/refinement-todo.md`). With the 067-03 default Alloy's own pending queue holds events, so the seam drop is a backstop for a narrow case; a seam hold-and-flush for Alloy needs a replay decouple that does not exist for the wrapped-SDK path: the held-request path in `core/wrapped-sdk-host.js` (strict consent gate) drops instead of queueing (`docs/refinement-todo.md`, updated). Test: `067-03 residual` in the B3 test file.

**Resolved by 068-01 (2026-11-20):** the seam now flushes the held request once on grant; the test was updated to match.

### AC2 code

`bootAlloy` now reports a function-valued `onBeforeEventSend`, `clickCollection.filterClickProperties` or `onBeforeLinkClickSend` with a `kind:"unsupported-callback"` diagnostic (additive, adapter-only). Upstream to main with the Alloy connector.

### For 064-20 (B4)

- `subscribeRulesetItems.callback` is mediated as data (see AC2 table): check results arrive through `decisions`, not a function.
- The S4 request side is checked here; B4 owns rendering and the `propositionDisplay` POST. Replay S4 with a rig `sendEvent` command (`renderDecisions:true`, `decisionScopes`), `event: null`.
- Use `run(page)` in `replayFixture` for multi-step scenarios.

### Shared-file changes to upstream to main

None to `core/*`. Adapter/harness only: `adapters/eds/index.js` (`unsupported-callback` diagnostic), `rig/adobe-b1-replay.mjs` (`run`, `event:null`).

### Extra captures needed

0 new (the CNAME edge domain from 064-18 stays the one known gap).

### Review round 1 (Opus 5.5 general-purpose sub-agent, `reviews/slice-19-*.md`): findings and disposition

Fixed: R5 (spec 067 check reference), R6 (rows 1 and 2 are B1's), R7 (blocking code named), L2 (`applyResponse` network assertion), L3 (`s6-pending-in` compares bodies), C1 reason now names `payloadDenylist`, L1 (rows 7 and 9 name `s3-base`), R1 (067-03 now carried, not resolved).

Carried explicitly (each needs an owner or another slice, not this one):
- **H1 / R4, host command surface (RESOLVED by 064-26, 2026-11-20: `handle.command`, ADR-0063).** Rows 4 to 7 and 9 are proven worker-native through the rig-only `rig-command` path. `bootAlloy`'s handle exposes only `push`, `pushCritical`, `setConsent`, `getState`, `stats`, `dispose`, so a site cannot call `getIdentity`, `appendIdentityToUrl`, `applyResponse`, `getLibraryInfo` or `createEventMergeId` today. The classes in the table are chamber facts, not adopter-visible parity. A mediated command entry point (an allowlisted command set on the handle) is a new shared capability contract: owner decision; 064-21 (aem-martech adoption) and the B8 report must not cite rows 4 to 7 and 9 as site-callable.
- **M1, S4/S7 on the production path.** Replays use stock `sendEvent({renderDecisions:true, decisionScopes})` via the rig. The connector sends `renderDecisions:false` with scopes from `placements`/`reservedPlacements`; request-body identity on that path is not re-proven here. 064-20 (B4) should replay S4 through `push` plus `reservedPlacements`.
- **M2 / R2, `s6-out` opt-out not forwarded.** The `privacy/set-consent` `collect:n` is held at the seal after an explicit refusal. ADR-0062 point 5 covers the hold before consent, not a refusal signal, so S6 `out` does not compare clean and this is a parity gap, not "working as designed". Owner decision: forward through a seam exemption (needs main) or amend ADR-0062. Logged in `docs/refinement-todo.md`.

  **Resolved by 068-02 (2026-11-20):** owner chose the narrow seam exemption; the opt-out is forwarded without the identity fetch and `s6-out` now compares clean.
- **M3, `subscribeRulesetItems.callback`.** Disposition is "mediated as data, unbuilt": 064-20 proves it through `decisions` or reclassifies it as incompatible. No delivery path exists today.
- **C1, warn only.** The diagnostic is a warning, not a throw: failing boot would break sites that never relied on the callback for privacy, and ADR-0061 prefers visible parity gaps to new boot errors. Revisit if the owner wants fail-loud.
- **R3, row classes.** Rows 3, 5, 8 classes differ from the frozen 2.1 table (`mediated` there; chamber-native here, with the seam still mediating egress) and row 12 is `mediated as data`. Amendment line added to spec 064 under 2.1.

Round 1 only; no round 2 needed (no code defect found; carries recorded above).
