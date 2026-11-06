---
slice: 059-15 - Exact native policy and one-shot stock capture
pass: craft
verdict: needs-changes
reviewer: jig:reviewer (explicit gpt-6.1-sol; bounded coverage craft)
reviewed_at: 2026-11-06T05:56:30Z
prompt_source: review.py pr-review spec.md 059-15; google-retained-guard-coverage-craft-prompt.txt; exact test/plan snapshot 60baedde
substrate: shown
applied_skill: pr-review
shown_candidates: [independent-review:high-confidence, pr-review:high-confidence, scout-pr-review:high-confidence, access:speculative, adr-workflow:speculative, agent-development:speculative, analyze:speculative, arch-review:speculative, bug-fix:speculative, build-dashboard:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, clarify:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, code-health:speculative, command-development:speculative, configure:speculative, contracts:speculative, cowork-plugin-customizer:speculative, create-cowork-plugin:speculative, create-viz:speculative, data-context-extractor:speculative, data-visualization:speculative, example-command:speculative, example-skill:speculative, explain:speculative, explore-data:speculative, frontend-design:speculative, hook-development:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, memory-sync:speculative, migrate:speculative, orient:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, reframe:speculative, scaffold-init:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, security-review:speculative, session-report:speculative, skill-creator:speculative, skill-development:speculative, slice-land:speculative, spec-workflow:speculative, sql-queries:speculative, statistical-analysis:speculative, tdd-loop:speculative, validate-data:speculative, vision-elicitation:speculative, write-query:speculative, writing-hookify-rules:speculative]
---

Actual reviewer: jig:reviewer, explicitly pinned gpt-6.1-sol.
Prompt: google-retained-guard-coverage-craft-prompt.txt.
Snapshot: google-retained-guard-coverage-reviewed.patch,
SHA256 60baedde07a1d7043ec3d6eda1e452acb31d6d8b4bc1d575c4ae44ff34dc3f4d.
Test hashes: google-retained-guard-coverage-test-sha256.txt.

VERDICT: needs-changes

REASONING:
No packet-local craft blocker was found in the three-test-file change and factual plan update. Both named coverage nits are addressed within the documented limits: the later-client test is falsifiable, and receipt tests exercise real writers and pending-state checks. Supplied logs show the deliberate private mutant failing, ordinary tests passing, and the parent regression passing 65 tests; nothing was executed during this review. Full 059-15 remains unfinished and needs-changes, 059-01 remains READY_FOR_REVIEW, and native admission stays closed.

SPECIFIC ISSUES:
- [strength][impl] rig/inspected-google-guard-descriptor-fixture.c:182 — Real socket/pipe synchronization gates client creation on an empty kernel wait, observes rejection and unchanged flags, and reaps the child, including failure cleanup.
- [strength][impl] rig/inspected-google-guard-evidence.test.mjs:130 — Isolated synthetic cases verify pre-pending refusal, exact outcome schemas, unknown readiness, private receipt modes and absence of opposite-outcome files without executing a command.

RECONCILIATION NOTES:
Record packet-local nit closure only. Preserve the plan’s limitation that instrumentation does not prove the uninstrumented infinite poll was blocked before connection. The private mutation demonstrates falsifiability, not a historical runtime defect; synthetic `command_invoked: true` remains test data. No production change or new runtime qualification is established. Bootstrap status 5 remains undiagnosed, lost original bytes remain unrecoverable, and existing activation, lifetime, Chrome and native gates remain unchanged.
