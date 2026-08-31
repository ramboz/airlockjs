---
slice: 016-01 — GA4: confine the chamber + wire-protocol endpoint ceiling (the EXACT archetype)
pass: craft
verdict: pass
reviewer: orchestrator-opus
reviewed_at: 2026-08-31T00:42:41Z
prompt_source: independent Opus review of Sonnet implementer diffs (016-01)
substrate: non-interactive
---

## Craft review — 016-01 — PASS
- checkEndpointCeiling fail-closed order (empty declared → hold; unparseable → hold; in-set → allow;
  else hold) is correct; origin+pathname reduction drops query+fragment (Kill #4 + no api_secret).
- The confine module's header is an exemplary explanation of the post-order ordering rationale (why a
  first-import module, not a body call) — matches the frame-critique finding precisely.
- Tests genuinely assert: the captured-before case demonstrates the ordering necessity (not smoke); the
  seam test uses the established FakeWorker pattern (no real-worker hang); the withholdFetch test asserts
  fetch throws + the inverted invariant. 40/40 targeted, 181/181 neighborhood.
- Honest test-boundary note: full real-module-worker ordering E2E deferred to a rig; the unit contract
  (capture-before + source-order + withhold) stands in, stated in the test.
- Minor (non-blocking): airlock.js recomputes the ceiling reduction per dispatch (passes raw `endpoints`
  to the checker) rather than reusing the pre-reduced `ceiling` const — a negligible redundancy, correct.
No craft blockers.
