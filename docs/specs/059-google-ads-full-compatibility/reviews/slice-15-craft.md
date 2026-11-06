---
slice: 059-15 - Exact native policy and one-shot stock capture
pass: craft
verdict: pass
reviewer: jig:reviewer (explicit gpt-6.1-sol; source pass and narrow cleanup follow-up)
reviewed_at: 2026-11-06T05:08:25Z
prompt_source: review.py pr-review spec.md 059-15; google-retained-guard-source-craft-prompt.txt plus google-retained-guard-cleanup-craft-prompt.txt; source af78a764 then exact 8caec20e delta
substrate: shown
applied_skill: pr-review
shown_candidates: [independent-review:high-confidence, pr-review:high-confidence, scout-pr-review:high-confidence, access:speculative, adr-workflow:speculative, agent-development:speculative, analyze:speculative, arch-review:speculative, bug-fix:speculative, build-dashboard:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, clarify:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, code-health:speculative, command-development:speculative, configure:speculative, contracts:speculative, cowork-plugin-customizer:speculative, create-cowork-plugin:speculative, create-viz:speculative, data-context-extractor:speculative, data-visualization:speculative, example-command:speculative, example-skill:speculative, explain:speculative, explore-data:speculative, frontend-design:speculative, hook-development:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, memory-sync:speculative, migrate:speculative, orient:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, reframe:speculative, scaffold-init:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, security-review:speculative, session-report:speculative, skill-creator:speculative, skill-development:speculative, slice-land:speculative, spec-workflow:speculative, sql-queries:speculative, statistical-analysis:speculative, tdd-loop:speculative, validate-data:speculative, vision-elicitation:speculative, write-query:speculative, writing-hookify-rules:speculative]
---

Actual reviewers: jig:reviewer, explicitly pinned gpt-6.1-sol.
Initial prompt/body: google-retained-guard-source-craft-{prompt,first}.txt.
Initial nine-file snapshot: google-retained-guard-reviewed-source.patch,
SHA256 af78a764d8b7c26c20c5afdf19eb1eadbf485b60558e8478db265dbd9cf3f178.
Final follow-up prompt/body: google-retained-guard-cleanup-craft-{prompt,review}.txt.
Final test hash: 5fa125b089c826dbc4996651cb01796ba727d24435cfd610d78b1defd61ff247.
Five other source files unchanged, per google-retained-guard-cleanup-manifest.log.

## Initial actual source pass

VERDICT: pass

REASONING:
The nine-file patch stays within the SDK-free diagnostic scope, with no packet-local landing blocker found in the bootstrap, rejection or error paths. Evidence distinguishes failed acquisition, the passing negative control and option-policy red/green; full 059-15 remains needs-changes and native admission stays closed. This was read-only source/evidence review with no execution or platform retry.

SPECIFIC ISSUES:
- [nit][impl] rig/inspected-google-retained-guard.test.mjs:28 — N1. If the collision server unexpectedly binds, the following assertion throws, but `finally` cannot close this block-scoped server. Hoist it into cleanup scope and close it when listening so the failure path does not leave an owned listener open.
- [strength][impl] rig/inspected-google-guard-descriptor-fixture.c:25 — Real sockets exercise the sharing policy called by the service. Separate zero/nonzero assertions prevent the full validator’s unrelated `ENOPROTOOPT` refusal from supplying a vacuous green.
- [strength][impl] rig/native-stock-capture.md:114 — The operator guidance preserves bootstrap error 5 without diagnosing its cause, labels process-listener replacement as unsafe, and explicitly denies activation/current-browser qualification.

RECONCILIATION NOTES:
N1 is nonblocking test-cleanup hardening. Preserve the unavailable diagnostic outcome, undiagnosed bootstrap failure and unqualified custody/release/helper-cleanup gates; this craft pass does not clear them. For deeper dedicated security review, consider `/adobe-security-foundations` followed by `/adobe-security-lang`.

## Actual cleanup/docs follow-up

VERDICT: pass

REASONING:
No packet-local blocker or nit found in this narrow cleanup/docs delta. Finally-owned cleanup covers both collision and receiver servers after unexpected bind/assertion failure, while preserving the independent connection and marker assertions. The supplied cleanup red/green and 55-test regression logs support the correction; the docs accurately retain error 5 as undiagnosed and distinguish reconstruction from original evidence.

SPECIFIC ISSUES:
- [strength][impl] rig/inspected-google-retained-guard.test.mjs:66 — The regression exercises real listener acquisition and assertion failure, checks closure before fallback cleanup, and would fail without the cleanup.

RECONCILIATION NOTES:
This pass covers only the cleanup/docs delta. Preserve the missing original plist/binary evidence and unavailable launchd diagnosis in the deviation record. Full 059-15 remains needs-changes; no working guard, runtime-custody qualification or native admission follows.
