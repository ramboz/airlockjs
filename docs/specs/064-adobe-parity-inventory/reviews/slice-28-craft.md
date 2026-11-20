---
slice: 064-28 — applyResponse warms the host view cache
pass: craft
round: 3
verdict: changes-requested
reviewer: independent reviewer (Claude Opus 5.5, Copilot jig:reviewer sub-agent)
reviewed_at: 2026-11-20 (time not recorded)
prompt_source: review prompts for slice 064-28 (commits 7da926c2, b017a98b, 5428ee36, d3ba30ed and the pushed docs commits)
---

# 064-28 craft

The author saved this text (a summary of the reviewer's reports; fresh reviewers each round). Rounds are capped at 3.

Round 1 changes-requested (medium: a redirectDisplays gate before each event was a no-op that could deadlock; medium: withViewDisplay used renderer-wide isRedirecting instead of the render result; low: timer leak, consent-ring drop of the front display, duplicated test helpers, fixed sleeps, DBG log). Round 2 changes-requested (medium: clearing the watch timer on event settle leaks the watch, reverted because the request is issued after the event settles; low: consent ring overflow drops the front display, stale comment). Round 3 changes-requested at the round cap (medium: a later normal enqueue can still shift a front-queued display out of a full consent ring and its promise never settles; low: cache warmed only after applyResponse returns; error in onApplyResponse undiagnosed). No deadlock found. Owner: 064-29 AC4 and AC5; the `onApplyResponse` diagnostic is carried to 064-29 AC6 (no wire input can make the store throw, so no test is possible without fault injection). After round 3 the coordinator asked for tests of the round-1/2 fixes (no round 4): added in test/adobe-apply-response-queue.test.js, and the consent-ring front-display case is covered by the splice-branch test.
