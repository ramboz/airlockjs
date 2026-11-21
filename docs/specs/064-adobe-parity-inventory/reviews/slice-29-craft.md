---
slice: 064-29 — first push after applyResponse matches stock
pass: craft
round: 2
verdict: changes-requested
reviewer: independent reviewer (Claude Opus 5.5, Copilot jig:reviewer sub-agent)
reviewed_at: 2026-11-20 (time not recorded)
prompt_source: review prompts for slice 064-29 (round 1: commit 9f0cb8f5; round 2: commits 9f0cb8f5 and ec4779f5, pushed). The author saved its text.
---

# 064-29 craft

## Round 1 (9f0cb8f5) — changes-requested

No hard deadlock or leak. Medium: the `applyInFlight` gate held up the redirect display that `applyResponse` itself queues (the display waited out the renderer timeout). Low: a page-supplied `viewCacheWarm` got past the host's strip when the page classed the event as a notification and `minimalXdm` was on. Low: the AC5 differential relies on sleeps; no hermetic gate test. Nit: `store` docstring said it returns the propositions.

Disposition (fix commit ec4779f5): the gate wait now drains front-queued displays (`drainDisplaysUntil`); `withCacheHint` strips the flag on every event. Tests, hermetic in `test/adobe-apply-response-queue.test.js`, each checked to fail without its fix: "round 1: a page-supplied viewCacheWarm never reaches the chamber ..." and "round 1: the redirect display an in-flight applyResponse queues is sent ahead of the push waiting on that applyResponse".

## Round 2 (9f0cb8f5 and ec4779f5) — changes-requested

Both round-1 fixes verified; no deadlock, no nested drain, no `currentEvent` corruption.

- **Medium.** Cache warmth is read when an event runs, not when it was enqueued: a push enqueued before an `applyResponse` call, still waiting when it finishes, gets the warm hint (stock runs the push first, cold). Owned by 064-32 AC5.
- **Low.** `drainDisplaysUntil` can exit with a display still at the queue front if the gate resolves in the same microtask burst as the display's enqueue; the display then leaves at that event's `settleDeliveries`. Owned by 064-32 AC5.
- **Low, pre-existing.** If `renderer.render` throws inside `finishEvent`, `pump` has no try/finally and `running` stays true. Not introduced by this slice; not fixed here.
- **Low.** In the settle drain a held display's `driveEvent` is not raced against the bounded delivery promise, so under a consent hold the finishing event waits for consent; the renderer navigates on its own timer and prehiding has a 3 s backstop. Accepted; consent-path work is 064-30.
- **Info.** Each redirect's 60 s watch timer is not cleared; bounded.

verdict: changes-requested
