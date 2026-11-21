---
slice: 064-21 — aem-martech, ACDL and Launch (B5)
pass: craft
round: follow-up 1
verdict: changes-requested
reviewer: independent reviewer (Claude Opus 5.5, Copilot jig:reviewer sub-agent)
reviewed_at: 2026-11-20 (time not recorded)
prompt_source: review prompts for slice 064-21 (commits 3be50885, 1a5058a3, 1f751acd; follow-up round 1 reviewed a15457ec; fixes landed in 7e466871 and the next commit, not re-reviewed)
---

# 064-21 craft

The author saved this text (a summary of the reviewer's reports; fresh reviewers each round). Rounds are capped at 3.

Round 1 changes-requested (medium: a per-call `personalization` without the boolean dropped the `__view__` suppression, and a test locked that output in; low: fixed sleeps, missing diagnostics for a throwing hook, an unmappable consent and both overrides, queue drain ordering, an empty `surfaces` list). Fixed in 1a5058a3 with tests (the suppression test expectation, the explicit-boolean test, the diagnostics test); the wait now polls for the four edge calls. Round 2 changes-requested (medium: `renderDecisions` fell back to the host default, which renders, while stock defaults to false; low: silent `configure` options, a throwing hook resolves instead of rejecting, `__alloyNS` not read, wait loop and CI download notes). Fixed in 1f751acd with the hermetic test "sendEvent never renders unless the page asks"; the rest is accepted or owned by 064-31 AC5, AC6 and AC7. Round 3 approved (low: a page-requested `__view__` on the first call still gets the suppression, owner 064-31 AC7; the `page_view` event name assumes a `bootAlloy` handle, now stated in the bridge header; the AC3 host-count check is weak but the Edge-host check carries it, acceptable for a `live-only` row).

## Follow-up round 1 (owner-directed: no shipped page global)

Fresh Opus 5.5 reviewer on a15457ec; verdict changes-requested (the author saved this text). This reviewer's findings only. Fixes landed in 7e466871 and were not re-reviewed (no extra round):

- `alloy-bridge.js:2-5` header stale and garbled, 'no page global' said twice (medium/low): fixed in 7e466871.
- No-global test caught only a write at creation (medium/low): fixed in 7e466871 (sentinel read/write check, global key snapshot, every command run).
- Queue-shim test never covered the reject path (low): fixed in the follow-up commit after 7e466871 with 'the test-only queue shim routes a sync throw and a rejected command to reject'.
- `toString()` injection fragile under coverage instrumentation (low): fixed in 7e466871 (one-line note in `rig/alloy-queue-shim.mjs`).
