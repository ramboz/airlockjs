---
slice: 045-03 — seal N-beacon fan-out re-map (per-beacon `remapKey`)
pass: craft
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-13T17:21:10Z
prompt_source: review.py pr-review ... 045-03 --richer-skill pr-review
substrate: shown
applied_skill: pr-review
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass (craft pass — no blockers; safe to move to REVIEWED)

REASONING:
045-03 is a clean, well-scoped additive extension: EgressRequest.remapKey? on the contract, preserved hold→flush, threaded as remap's third arg. Correct, backward-compatible by construction, lint-clean; fan-out tests non-vacuous (the not-swapped/not-duplicated + declined-key assertions genuinely fail if key-threading is removed). On the conditional-arity question: empirically confirmed (vitest 3.2.7) that always-passing a trailing undefined breaks a 2-arg toHaveBeenCalledWith, so the unconditional form would require editing an existing assertion (AC3 forbids). No blockers.

SPECIFIC ISSUES:
- [strength][impl] core/airlock.js:762-766 — 1:1 path byte-identical (2-arg shape preserved); every prior seal/g-ads test passes unmodified. Careful frozen-core (ADR-0017) backward-compat.
- [strength][impl] test/consent-seal.test.js:619-644 — fan-out flush test is the load-bearing, non-vacuous proof (makeFanoutRemap dispatches only on the 3rd arg; deleting key-threading → both decline → fails).
- [strength][spec] contracts/connector.d.ts:104-124 / adr-0024 — fan-out seam named in the contract (not smuggled through event); coordinated-fan-out limit documented; "fan-out not supported" note correctly flipped.
- [strength][impl] core/airlock.js:790 — per-flush endpoint-ceiling re-check runs per rebuilt URL, so each fan-out form is ceiling-checked independently; no ceiling-widening via fan-out flush.
- [nit][spec] core/airlock.js:762-766 — nested ternary encodes a test-arity constraint into production code (for any real remap, remap(e,c,undefined) is runtime-identical to remap(e,c)). Defensible (AC3 "unmodified tests"); cleaner shape = unconditional remap(b.event, consentVector, b.remapKey) + relax the single over-strict assertion (consent-seal.test.js:361). Root cause: AC3's "unmodified" wording. Not blocking.
- [nit][impl] core/airlock.js:760-761 — comment claims "(this file + the g-ads seal test)" pin the 2-arg shape, but test/google-ads.test.js has NO remap/arity assertion (grep-confirmed); only consent-seal.test.js:361 pins it. Comment overstates external blast radius.
- [nit][impl] test/consent-seal.test.js:552 — expect(remap.mock.calls[0][2]).toBeUndefined() is non-discriminating (undefined either way); real weight is the auid/gcs URL assertions. Fine as intent doc.

RECONCILIATION NOTES:
- Design choice (conditional 3rd-arg threading): accepted as AC3-driven + empirically justified; if AC3's "unmodified tests" is relaxed, prefer unconditional + adjust the one arity assertion.
- Two precision nits (airlock.js:760-761 overstates g-ads pinning; consent-seal.test.js:552 non-discriminating) — log; optional tidy.
- Colliding-key footgun already tracked in ADR-0024 "Becomes harder", deferred to the 046-03 consumer — nothing owed by 045-03.
- Tests green (seal 30/30, 52 with g-ads); eslint clean; isolation via afterEach(vi.unstubAllGlobals()).

Reviewer: general-purpose subagent, craft pass (pr-review baseline), read-only, no implementation context; empirically verified the arity claim in vitest 3.2.7.
