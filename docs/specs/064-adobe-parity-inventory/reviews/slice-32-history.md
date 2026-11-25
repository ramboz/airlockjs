# Slice 064-32: review history (rounds 1 to 3)

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
- Medium (craft), cold means only the host cache, so a boot with no placement scopes sends no `__view__` query where stock does: carried (owner: a follow-up slice), recorded in the Findings, refinement-todo, spec and CHANGELOG.
- Low (craft), `calledWarm` is a boolean, so a failed apply then a successful one can warm a push stock runs cold: carried, same places.
- Low (craft), a notification-shaped query push was not held behind an in-flight apply: fixed.
- Low (craft), a bare `null` counted as a query: fixed in round 2 (null is absent). A related stock difference (a bare `decisionScopes: null` renders the cached view where stock does not) is carried.
- Low, dead `slowFirst` option, duplicate hermetic test, test title, comment indent, stale 064-29 title: fixed.
- Low, spec.md 064-15 "edge cases owned by 064-32" text and CHANGELOG null wording: fixed.
- Low (craft), `wire()` hides every root surface: carried.
- Low (compliance, recon), the drain could leave with a display at the front: fixed with a final front check, recorded.

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
