---
round: 2
verdict: changes-requested
reviewed_at: "2026-11-20 (time not recorded)"
prompt_source: "round 1: pushed commit 6c672ff2; round 2: pushed commit a1a772a8 (after 3373faca)"
---

# Slice 064-23 craft review

## Round 1 (commit 6c672ff2)

Opus 5.5 `jig:reviewer`, read-only (the reviewer could not write files; the author saved its text). Fixes for the findings below went into commit 3373faca and were re-reviewed in round 2.

Verdict: changes-requested. 0 high, 4 medium, 4 low.

- medium: `deliver` rendered the named view on every call without checking `viewHandled`, so ruleset items in the same event could render and notify twice. FIXED (guard added).
- medium: `finishEvent` sent an empty-view display after a failed request on a cold cache. FIXED (requires an initialized cache).
- medium: `scopesSent` was set when the first event was tried, so a failed first interact lost the declared scopes. FIXED (set after success; test added in `test/alloy-connector.test.js`).
- medium: `applyResponse` view propositions do not reach the host view cache. CARRIED (outside 064-23's ACs; refinement-todo, with the 064-26 host-command path).
- low: `track` overwrites `pendingDelivery`. Carried.
- low: view propositions reach `onDecisions` without `renderAttempted`. Carried.
- low: docstring "merged per name" vs replace. Carried (behaviour matches stock).
- low: no tests for held-then-released, failed first interact (now covered at connector level), ruleset+view, applyResponse+view.

## Round 2 (commit a1a772a8)

Opus 5.5 `jig:reviewer`, read-only (the reviewer could not write files; the author saved its text). Reviewed head a1a772a8. The round-1 fixes hold.

Verdict: changes-requested. 0 high, 1 medium, 4 low.

Medium:
- `applyResponse` never fills the host view cache, so a push naming a view afterwards renders nothing and sends no display. Disposition: carried to slice 064-28 AC1 (new slice with a board row); outside 064-23's ACs, and already a refinement-todo item.

Low:
- A swallowed parse failure in `cacheViewPropositions` renders the empty placeholder without a diagnostic. Accepted carry (slice notes).
- The test title mentions `renderDecisions` off but only exercises on; cold-cache `renderDecisions:false` is untested. Accepted carry.
- `withViewDisplay` throwing would reject the event; the renderer guards itself. Accepted.
- The failed-first-interact connector test does not assert `sends[0]` carried the scopes. Accepted.
