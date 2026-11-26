# Slice 064-32: review history (rounds 1 to 7)

Reviewer agent: `jig:reviewer` on claude-opus-5.5, fresh agents each round. None had Scout or a shell, so all read the source natively and unindexed and none ran `git diff`. Verdict words are as returned. Per-finding text is the author's summary of each report. Read times: round 1 was read before 2026-11-25T02:06:27Z (measured right after reading all three), round 2 between 2026-11-25T02:22Z (launch) and 02:29Z (the fix commit), round 3 between 2026-11-25T02:29:43Z and 02:30:56Z. Individual per-agent read times were not captured.

| Round | Pass | Agent ID | Source span | Verdict as returned |
|---|---|---|---|---|
| 1 | compliance | f0812667-7fc1-4412-9925-47ed5abbe6bb | 06fcee01..794c7c67 | changes-requested |
| 1 | craft | 3ffa694d-e198-402a-b758-8addadf704ea | 06fcee01..794c7c67 | needs-changes |
| 1 | reconciliation | 2330fe0c-c625-40f6-a6d7-2890e1420914 | 06fcee01..794c7c67 | changes-requested |
| 2 | compliance | e5fd114d-7f0d-4c8b-af6f-0098ab2aadf7 | 06fcee01..22e22c54 | pass |
| 2 | craft | fb7e8c62-6330-4453-9e17-bea2d779ccdd | 06fcee01..22e22c54 | changes-requested |
| 2 | reconciliation | 46582768-71ba-4142-b808-5d9805646c5b | 06fcee01..22e22c54 | changes-requested |
| 3 | compliance | 13f51503-5265-4d61-8b7c-5436bf1fb287 | 06fcee01..77041b6f | changes-requested |
| 3 | craft | 15bf5b9e-ec93-428b-b556-8a9d7adeebcc | 06fcee01..77041b6f | pass (approved) |
| 3 | reconciliation | acb899c8-1e0d-477b-874e-8a84a593717b | 06fcee01..77041b6f | pass (approved) |

Rounds improved: 3 changes-requested, then 1 pass and 2 changes-requested, then 2 passes and 1 changes-requested.

## Round 1 findings and dispositions (fixed in 22e22c54 unless noted)

- Medium (compliance), AC5 b had no differential: not fixed. See round 3.
- Medium (compliance), a malformed top-level `decisionScopes` dropped a well-formed `personalization.decisionScopes`: fixed, differential case added.
- Medium (craft), cold means only the host cache, so a boot with no placement scopes sends no `__view__` query where stock does: carried in round 1; fixed in round 4, see below; recorded in the Findings, refinement-todo, spec and CHANGELOG.
- Low (craft), `calledWarm` is a boolean, so a failed apply then a successful one can warm a push stock runs cold: carried in round 1, fixed in round 4.
- Low (craft), a notification-shaped query push was not held behind an in-flight apply: fixed.
- Low (craft), a bare `null` counted as a query: fixed in round 2 (null is absent). A related stock difference (a bare `decisionScopes: null` renders the cached view where stock does not) is carried.
- Low, dead `slowFirst` option, duplicate hermetic test, test title, comment indent, stale 064-29 title: fixed.
- Low, spec.md 064-15 "edge cases owned by 064-32" text and CHANGELOG null wording: fixed.
- Low (craft), `wire()` hides every root surface: carried.
- Low (compliance, recon), the drain could leave with a display at the front: fixed with a final front check in round 1; that check was removed in round 4 (no test showed it reachable).

## Round 2 findings and dispositions (fixed in 77041b6f)

- Medium (craft), `decisionScopes: null` took the raw path, dropped the boot scopes and marked them spent: fixed (`null` is absent in `clean` and the raw branch), connector test added.
- Medium (recon), carried call-order gaps were only in the slice file: now in refinement-todo, spec.md and the CHANGELOG and ADR-0063 caveat.
- Low (craft), the final drain also runs in `settleDeliveries`, order unpinned: accepted, harmless.

## Round 3 findings

- Compliance, medium: AC5 b is shown only by the unchanged 064-29 hermetic test, with no real-Chromium differential and no red-to-green for the drain re-check. Not fixed. A redirect apply navigates the page, which ends the evaluate context that both stock and ours run in, so the differential cannot be written in this harness. Disposition: carried to the coordinator and owner as an explicit evidence deviation for AC5 b only. The Findings no longer say "all five met".
- Craft, low: the `clean` predicate is written twice in connector.js. Carried (not blocking).
- Recon, low: stale `perCallPersonalization` JSDoc, "four call-order gaps" wording, CHANGELOG null phrasing: fixed after round 3, docs and a comment only (no behavior change).

## Round 4 (owner-approved, one bounded repair)

Owner answer: "Allow one bounded repair and final review". Changes: a real AC5 b differential (awaited apply, navigation intercepted with `route.abort("aborted")`), the cold-with-no-scopes gap fixed, the failed-then-later-success apply gap fixed, both with red-to-green differentials, and the drain's extra front check removed because no test showed it reachable. A new finding is recorded: an unawaited apply followed by a push sends the push before the redirect display in stock, and after it in ours (064-29 gate). It is reported for an owner decision.

### Round 4 reviews (source head e612d73b, diff 06fcee01..e612d73b read in full by each)

| Pass | Agent ID | Verdict as returned |
|---|---|---|
| compliance | 382d3dfc-4495-4b70-b87b-939cd841b3b1 | changes-requested |
| craft | 019031f8-5182-463a-8bfa-4db797c22379 | needs-changes (changes-requested) |
| reconciliation | a90706ec-cdb3-42a2-8be2-f19766cc9bb7 | changes-requested |

Provenance: the three agents ran in parallel in one background launch and finished in the order reconciliation (about 76 s), compliance (about 116 s), craft (about 141 s) by the runtime's elapsed counters. No per-read timestamps were captured here; none are claimed. All read natively (no Scout, no shell, no tests run).

Round 4 open findings (all addressed in round 5, see below): (1) unawaited apply then push: stock sends the push before the redirect display, ours after (064-29 gate); an awaited apply also differs on navigation timing. (2) The cold hint uses the host cache `isInitialized()`, which depends on when the apply result reaches the host, so the round 4 differentials may be timing dependent (fix: decide cold from call history). (3) The cold hint is dropped when a push carries its own scopes (unchecked against stock). (4) Hermetic AC5 test does not assert `viewCacheCold`; dead boolean branch in `cacheWarmFor`. The slice, spec and decomposition stay IN_PROGRESS.

## Round 5 (owner: "Match stock and authorize one bounded corrective round (Recommended)")

Source head `b850dae1cccdb6a6236b4c81bbe70fc1fc425327`; reviewers were given the full `06fcee01..b850dae1` diff file (924 lines) and all three read it completely, plus native source ranges. Full test suite green twice (3446 passed, 5 skipped), lint clean.

| Pass | Agent ID | Verdict as returned |
|---|---|---|
| compliance | 8e0049fa-8d8f-4a90-bb2e-5b5440d1383f | needs-changes |
| craft | 85d9fa22-2809-49ee-8d13-9f4a825cce31 | needs-changes |
| reconciliation | aa7f6796-617a-4109-bd3e-9eb1a7a935f8 | needs-changes |

Provenance: launched in parallel; runtime elapsed counters about 108 s (compliance), 142 s (craft), 112 s (reconciliation). Per-read timestamps could not be recovered: `get_copilot_session_events` for these local subagent IDs answered "Session events are unavailable: the session may be missing, inaccessible, not yet available, or deleted". No timestamps are claimed.

Findings that stand (not waived, no round 6): (1) craft: `navigationGate` only holds while events sit in `waiting`; a push the pump already took, whose request is not yet issued, gets no hold, so the push-loss risk after an awaited apply with a real navigation is not closed. (2) The gate has no deterministic test and no red-to-green. (3) The unawaited push-before-display order depends on microtask ordering (`warmed` hook, drain) and is pinned only by result. (4) `appliesIssued` also counts an apply rejected synchronously; `warmed` is set even if the store threw (no hint, no test). (5) A warm gated push now runs before the apply's render finishes; DOM render order against stock is not pinned. (6) The differential uses fixed sleeps and asserts stock's exact unawaited order, which could race under load. (7) Docs: stale lines in refinement-todo, ADR-0063 line 108, spec.md rows and slice-29 AC5 (fixed in the docs-only follow-up commit); navigation hold missing from the deviation log and CHANGELOG (left to the owner decision).

## Round 6 (owner: "Authorize one bounded round 6 (Recommended)")

Cause found by read-only diagnosis: the navigation gate checked only the `waiting` queue, so a push the pump had already dequeued but not yet issued let the redirect leave and the push was lost. Stock only guarantees redirect display invoked before navigation intent; push versus navigation order is not a stock invariant and is not asserted.

Changes: an event-driven seam test (gate check held until the push is dequeued, push egress held until the gate callback ran) was written first and was red on the round 5 head (push lost). The navigation now waits for each pending entry's own issued promise (cap 250 ms). A validation-rejected apply is no longer counted or awaited. `warmed` is set only when the response store succeeded. Fixed sleeps in the redirect, AC5 b and round 6 tests were replaced by polling for the expected events plus a 300 ms grace. A DOM and wire differential covers a warm push behind a rendering apply, awaited or not. Mutation M0 (gate always resolved) is red. Suite 3451 passed, 5 skipped; lint clean.

Final review rows and provenance are recorded below once the three fresh passes return.

### Round 6 final reviews (source head `425012c6989434198f14711fb57a924e39a4f9a3`, full `06fcee01..425012c6` diff of 1140 lines)

| Pass | Agent ID | Verdict as returned | Runtime elapsed |
|---|---|---|---|
| compliance | 1205cf0d-39e3-4d1c-a436-8fb4dc086f3c | needs-changes | about 100 s |
| craft | 586282af-1bae-4cfc-a157-6b6ff4b2a377 | needs-changes | about 144 s |
| reconciliation | 7709b872-d902-4496-8b85-1309b313d77a | needs-changes | about 66 s |

Per-read timestamps were not recovered when this round was recorded (session events unavailable for local subagents, as in round 5). None were claimed then. Later recovery (disposition added in round 7, verdicts above unchanged): the original source-read tool returns and clocks are in the parent session `events.jsonl`, keyed by the top-level `agentId` on `tool.execution_start` and `tool.execution_complete`. Coordinator27 preserved them (39 reads) under its `files/064-32-round6/original-reviewer-source-read-{events.jsonl,clocks.json}`. Compliance: 13 reads, 18:32:17.645Z to 18:33:33.977Z. Craft: 17 reads, 18:32:18.993Z to 18:33:49.378Z. Reconciliation: 9 reads, 18:32:16.810Z to 18:33:00.576Z. These were native file reads, not Scout-indexed reads. This recovery read events only; no review ran again. The same recovery may apply to round 5, which was not re-checked here.

Findings that stand (no round 7, not waived): (1) craft, medium: `notifyFetchIssued` marks whichever entry is `runningEntry` when any egress request goes out, so another request (for example the redirect display's own request) can release the gate before the push itself is issued. A fix would tag each entry's request; no test covers a display request arriving after the push is dequeued. (2) The `accepted` (rejected apply not counted) and `warmed(stored)` fixes have no test. (3) The differential `run()` helper still has a fixed 1500 ms wait. (4) Docs lag: slice Findings and deviation 2a still describe the round 5 gate, the carried "navigation before push" gap may be stale, AC5 text is not amended. (5) Minor: the `redirectWaitMs` timeout path skips the gate, consent-held pushes make the gate wait its 250 ms cap, `dispose` does not clear `pendingIssue`. The slice, spec and decomposition stay IN_PROGRESS.

## Round 7 (owner: "Authorize one bounded round 7")

Scope: request attribution, tests and docs only. No waiver, no live capture, no PR, no round 8. Final reviews are launched by the coordinator after this candidate is handed over, not by the implementer.

Changes at the candidate: `notifyFetchIssued` credits a request to the running entry only when it is that entry's own (`ownsRequest`: an events request whose first event has the entry's declared `eventType`). Identity or consent requests, events requests of another type and the redirect display's own request no longer release the navigation. `runEntry` no longer marks a documentUnloading entry issued in its `finally`, and `dispose` releases every pending entry. The keepalive comment no longer claims a started plain request survives navigation. The fixed 1500 ms wait in the differential `run()` is replaced by an observed settle (edge request count still for 500 ms, 8 s bound that fails explicitly).

Tests: hermetic cases for an identity request and for another event type arriving while the push is posted but unissued (the navigation must not leave until the push's own request), a rejected apply not marking an earlier queued push cold, and a failed view-cache store not warming the next push. Each has a raw red mutation receipt in the secured round 7 artifacts. The suite was 3455 passed, 5 skipped, lint clean.

Findings disposition: (1) attribution fixed and tested hermetically. (2) `accepted` and `warmed(stored)` now have tests. (3) fixed wait replaced in the differential `run()`; other fixed waits in the file are outside the findings and unchanged. (4) docs reconciled here; the "ours navigates before push" gap is restated as "push versus navigation order is not asserted" because it is not a stock invariant. (5) `dispose` fixed; the `redirectWaitMs` timeout path skipping the gate and the 250 ms cap for consent-held pushes stay accepted limits.

Honest limits: the redirect display's own request arriving while the push is unissued could not be realized through the pump (a display result needs its egress, and the pump runs entries serially, so a held display or push deadlocks). That case is protected by excluding the display request from attribution and has no dedicated test. A request with no declared `eventType` is accepted for any events request. An event that makes several fetches counts as issued at its first own fetch. A plain non-keepalive request can still be cancelled by navigation (stock has the same exposure). The raw red and M0 outputs of rounds 5 and 6 were never saved and remain missing. The slice stays IN_PROGRESS until the final reviews pass.

### Round 7 final reviews (source head `f18f648bfa8af8a15554ca73c73808a4f00eb40c`, full 1329-line `06fcee01..f18f648b` diff)

| Pass | Agent ID | Verdict as returned |
|---|---|---|
| compliance | 1883f256-ea58-4f6e-a918-0c8a990f3531 | needs-changes |
| craft | 405e4348-d5c6-4fbb-842a-f91d803c01f9 | needs-changes |
| reconciliation | fffc90e1-74e8-4b23-a107-79dfaab5f3b9 | needs-changes |

Provenance: three fresh Opus 5.5 native passes, launched by the coordinator. All three received the full diff (coverage verified afterwards) and made Scout lookups; derived views were not verified. The craft pass completed 16 initially truncated lines within the same pass. Verdicts are unchanged. Tool clocks are held in secured coordinator artifacts.

Findings that stand (no round 8, not waived): (1) the originating request's identity is still not established by `runningEntry` plus `eventType`, so a same-type or untyped request can still be credited to the wrong entry. (2) Unloading entries can stay pending, grow the set and force later 250 ms waits. (3) Missing tests for same-type, no-type and unloading cases, and one release assertion is weak. (4) Some docs are stale and some closure claims are unsupported. (5) The board gate fails: the baseline is clean and only the 064-32 status mismatches.

Uncertainty kept: the craft pass notes that stale pending entries usually mask early release. No new real-browser loss below 250 ms was reproduced, and none is claimed.

Final-review status: failed, pending owner decision. The slice stays IN_PROGRESS. Nothing landed on vendor-adobe. The round 7 closure claims above ("Findings disposition") are superseded by these findings.

## Round 8 (owner: "i authorize it"; one bounded round)

Start head `b1135f56`. Accepted vendor baseline `06fcee01`. No final reviewers were launched by the implementer; the coordinator owns the final set.

Disposition of the round 7 findings:

| Finding | Disposition |
|---|---|
| Attribution by `runningEntry` and `eventType` | Replaced. `notifyFetchIssued` credits the oldest pending entry the request could belong to. `runningEntry` is removed. |
| Unloading entry's own late request credited to a newer entry | Fixed. The settled entry stays pending and its own request releases it. |
| Unloading entry that issues no request grows the pending set and forces later 250 ms waits | Fixed. It is retired after the cap. |
| Weak release assertion and missing tests | Added three hermetic cases: release before the cap (120 ms bound), an untyped push, and an unloading push whose request is late. The unloading case fails on `b1135f56` and passes now. |
| Stale docs and board | Reconciled. The review stubs are marked superseded. The board is regenerated. |

Honest limits: bodies carry no originating-event tag, so an unrelated same-type request still releases an equal-typed push. A tag needs a core or chamber contract change, which this slice does not take. The retirement timer is a bound, not an event. No browser loss below 250 ms was witnessed in rounds 7 or 8. The slice stays IN_PROGRESS until the coordinator's final set passes.

## Round 8 final reviews: failed

Three fresh Opus 5.5 native passes on `e808b4b1` all returned needs-changes.

| Pass | Agent | Verdict |
|---|---|---|
| compliance | 384f62ab | needs-changes |
| craft | a537253b | needs-changes |
| reconciliation | f6adb7d1 | needs-changes |

Provenance: the coordinator launched all three. Each received the full patch (1420 of 1420 lines, verified afterwards). Complete reports and original clocks are kept by the coordinator.

Shared blocker: the request's real origin identity is still not established. Oldest eventType matching, where an untyped entry matches any events body, can credit another entry, including overlapping settled unloading pushes. This is a static counterexample. No browser loss was witnessed.

Craft read the retirement, cap, controls and warm/cold code as correct. Same-type and untyped overlap tests and real-serialization tests are still missing.

Reconciliation also flagged: closure, met and navigation-order claims that are not supported (spec.md line 79, slice Findings and reconciliation text), `verdict: superseded` frontmatter in the craft and reconciliation stubs that does not match the allowed schema, a stale decomposition line, and own-request overclaims.

These claims and the stubs stay as they are. They are recorded as failed-review findings, not repaired. Round 8 is exhausted. No ninth repair, waiver, contract change, PR, live capture or landing is authorized.

Status: IN_PROGRESS, pending owner decision. Nothing landed on vendor-adobe. The round 8 disposition table above is superseded by this section.

## Round 9: framing (docs only)

After the round 8 failure the owner asked to reshape. Round 9 so far is documents only: Proposed ADR-0066 (chamber result follows bridge requests, settlement-only gate), assumptions A1 to A3 and a regression contract in the slice. Nothing is implemented and no review has passed. The slice stays IN_PROGRESS.

## Round 10: implementation of ADR-0066 (candidate, not reviewed)

The chamber now posts `result` and `fatal` through `postInOrder`, so they follow the bridge requests the event reserved. The adapter no longer credits requests to entries. An entry retires on its own settlement, a consent-ring drop, or dispose. The 250 ms cap, the gate snapshot, display draining, the `redirectWaitMs` path and every seal, consent and allowlist check are unchanged. Core is unchanged.

Tests T1 to T9 are in `test/adobe-apply-response-queue.test.js` (hermetic: T2, T3, T5, T6, T9) and `test/adobe-b4-personalization.test.js` (real Chromium with pinned Alloy 2.31.1: T1, T4, T8). T7 is the existing bug 007 test in `test/adobe-b2-egress.test.js`, still green. On the unchanged `dc7f54eb` source, T2, T3 and T9 fail and the three T4/T8 variants fail. A1 and A2 were witnessed: the beacon's `intercepted-fetch` reaches the host after the old `result`, and the Blob read settles whether it is fulfilled or rejected.

Mutations: M1 (`result` outside `postInOrder`) turns T4/T8 red (3 tests). M3 (an entry credited on a fetch) turns 2 hermetic tests red. M4 (retirement left to the cap alone) turns 5 hermetic tests red; it uses completed cases, not the parked fetch. M2 (`fatal` outside `postInOrder`) turns nothing red. `routeBatch` records a failing event as a drop and does not throw, so the `fatal` branch has no reachable path I could drive. That ordering is kept for consistency and is not proved by a test.

Residuals, stated plainly:
- A parked fetch has no egress and no settlement. The 250 ms cap releases it. This is by design in ADR-0066.
- The ring-drop release is not tested on its own. One drop leaves other pending entries, so it is not observable.
- The hermetic cap test models a held push with no result and no egress. It does not drive a real core-parked fetch.
- A vendor retry after settlement is outside the bounded guarantee (T9).
- The `-t navigationGate` selector from the dispatch matches no test name in the b4 file (84 skipped). The real runs use `-t ADR-0066`.
- The browser-oracle job failed once on the accepted docs commit in an unrelated test (064-21 B5). It was not diagnosed.

Raw receipts are kept outside the repository. Nothing here is accepted. No final review has run. The slice stays IN_PROGRESS.
