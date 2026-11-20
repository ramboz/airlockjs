---
round: 1
verdict: changes-requested
reviewed_at: "2026-11-20 (time not recorded)"
prompt_source: "pushed commit 6c672ff2"
---

# Slice 064-23 craft review (round 1)

Opus 5.5 `jig:reviewer`, read-only (the reviewer could not write files; the coordinator saved its text). Fixes for the findings below are in the commit that follows 6c672ff2; they were not re-reviewed.

Verdict: changes-requested. 0 high, 4 medium, 4 low.

- medium: `deliver` rendered the named view on every call without checking `viewHandled`, so ruleset items in the same event could render and notify twice. FIXED (guard added).
- medium: `finishEvent` sent an empty-view display after a failed request on a cold cache. FIXED (requires an initialized cache).
- medium: `scopesSent` was set when the first event was tried, so a failed first interact lost the declared scopes. FIXED (set after success; test added in `test/alloy-connector.test.js`).
- medium: `applyResponse` view propositions do not reach the host view cache. CARRIED (outside 064-23's ACs; refinement-todo, with the 064-26 host-command path).
- low: `track` overwrites `pendingDelivery`. Carried.
- low: view propositions reach `onDecisions` without `renderAttempted`. Carried.
- low: docstring "merged per name" vs replace. Carried (behaviour matches stock).
- low: no tests for held-then-released, failed first interact (now covered at connector level), ruleset+view, applyResponse+view.
