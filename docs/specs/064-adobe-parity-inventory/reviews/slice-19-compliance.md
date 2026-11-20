---
slice: 064-19 — B3: Command coverage and callbacks
pass: compliance
round: 1
verdict: changes-requested
reviewer: independent reviewer (Claude Opus 5.5, Copilot general-purpose sub-agent)
reviewed_at: 2026-11-20T16:52:00Z
prompt_source: review prompt, slice 064-19 (commits 6141cc57, dd909633)
---

# 064-19 compliance — Round 1

**Verdict: changes requested. 1 high, 3 medium, 4 low.**

Evidence I ran: `npx vitest run test/adobe-b3-commands.test.js` (2 passed, 17 skipped, hermetic)
and the same with `AIRLOCK_REAL_CHROMIUM=1` (19 passed, 17.7 s). `eslint` on the three changed
code files is clean. I did not run the full `npm test`, `npm run lint` or the servo gate.

## AC-by-AC

| AC | Verdict | Evidence |
|---|---|---|
| 1. Rows 3-9 point to a fixture and compare clean; the 17-row matrix has an owner per row | **Partial** | Owner check holds (`test/adobe-b3-commands.test.js:45-55`). Rows 4, 5, 6, 7, 9 (and the S4/S7 `sendEvent` options) only run through a rig-only command path (H1). Rows 7 and 9 say "live", not a fixture (L1). |
| 2. The 6 function-valued options decided and recorded | **Met, one weak row** | Table at `slice-19-b3-command-coverage.md:32-39`, mirrored at `spec.md:62`. `subscribeRulesetItems.callback` is "mediated as data" with no mechanism yet (M3). |
| 3. `appendIdentityToUrl` runs worker-native | **Met in the chamber, not reachable by a site** | `test/adobe-b3-commands.test.js:114-120` proves Alloy computes it in the chamber with no network. A site cannot call it (H1). |
| 4. S3-S7 compare clean; S6 supplies the recorded consent state | **Partial** | S3 and S7 compare clean (S7 with a justified URL ignore). S4 only checks the first POST, through the rig path, with `renderDecisions:true` the production path never sends (M1). `s6-out` does not compare clean, and the delta is not covered by the ADR-0062 exception it cites (M2). |
| DoD: `npm test && npm run lint` and servo gate pass | **Unverified** | No gate output is recorded in the slice (L4). |

## Findings

- **H1 — High — `rig/b1-chamber-entry.js:29`, `adapters/eds/index.js:1643`, `slice-19-b3-command-coverage.md:50-56`.**
  Every "worker-native" command result except `sendEvent`-via-`push` and `setConsent` goes through
  the rig-only `rig-command` message, which calls `self.alloy(command, options)` inside the rig's
  chamber wrapper. The production `bootAlloy` handle exposes only `push`, `pushCritical`,
  `setConsent`, `getState`, `stats`, `dispose`. So `applyResponse`, `getIdentity`,
  `appendIdentityToUrl`, `getLibraryInfo` and `createEventMergeId` work in the chamber, but no
  adopter can call them. The results table reads as "row done, worker-native" and the slice never
  says the host surface is missing. Under the Adobe-first v1.0 gate (full pinned Alloy
  compatibility), that overstates parity. Fix: add a "host surface" column (rig-only today) and
  either add a mediated command entry point on the handle (with its own allowlist of commands),
  or record the missing surface as an owned gap in the spec and the refinement todo.
- **M1 — Medium — `slice-19-b3-command-coverage.md:60`, `test/adobe-b3-commands.test.js:94`.**
  S4 is replayed with `sendEvent({renderDecisions:true, decisionScopes})` through the rig path.
  The production path hardcodes `renderDecisions:false` (`connectors/alloy/connector.js:313`) and
  takes scopes from `placements`/`reservedPlacements`. The claim "the request body is identical,
  so no connector change is needed" is not tested on the production path. Same for S7's SPA view
  (`test:174`), which a site can only send through `push`. Add one S4 replay through `push` plus
  `reservedPlacements`, or drop the claim.
- **M2 — Medium — `slice-19-b3-command-coverage.md:62`, `test/adobe-b3-commands.test.js:157-165`.**
  `s6-out` is called "the ADR-0062 consent-hold exception working as designed". ADR-0062 point 5
  (`adr-0062-stock-default-parity.md:51`) only excuses the *pre-consent* hold. After an explicit
  refusal, the held request is Alloy's opt-out `set-consent`, a consent signal, not an event
  waiting for consent. So this is a parity failure the exception does not cover, and the AC4
  "compare clean" bar is not met for S6. See reconciliation R2 for the tracking gap.
- **M3 — Medium — `slice-19-b3-command-coverage.md:37`, `spec.md:62`.**
  `subscribeRulesetItems.callback` is recorded as decided ("mediated as data through
  `decisions`"). No such path exists: `connectors/alloy/decisions.js` maps `sendEvent`
  propositions, not ruleset-subscription callbacks, and (per H1) a site has no way to issue
  `subscribeRulesetItems` at all. This is a proposal handed to 064-20, not a disposition. Record
  it as "mediated as data, unbuilt, 064-20 proves or reclassifies as incompatible".
- **L1 — Low — `slice-19-b3-command-coverage.md:54,56`.** Rows 7 and 9 list the fixture as
  "live". The test runs them on the `s3-base` replay (`test:71-79`). Name the fixture; "live"
  contradicts AC1 and the no-live-network replay rule.
- **L2 — Low — `test/adobe-b3-commands.test.js:81-88` vs `slice:51`.** Row 4 claims "runs, no
  send". The test does not assert the network count, and `result` is only checked to be an
  object. Add the same `network` length check used at `test:78`.
- **L3 — Low — `test/adobe-b3-commands.test.js:151-155`.** `s6-pending-in` checks paths only; the
  slice says it "behaves like s6-in" (bodies clean). Call `expectRecorded` as `s6-in` does.
- **L4 — Low — slice DoD.** No record of `npm test && npm run lint` or the servo gate. Fine while
  `IN_PROGRESS`, required before `DONE`.
