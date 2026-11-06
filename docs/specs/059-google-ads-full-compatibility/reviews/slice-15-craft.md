---
slice: 059-15 - Exact native policy and one-shot stock capture
pass: craft
verdict: needs-changes
reviewer: jig:reviewer (explicit gpt-6.1-sol; final coupled-source craft)
reviewed_at: 2026-11-06T05:40:07Z
prompt_source: review.py pr-review spec.md 059-15; google-retained-guard-parent-final-craft-prompt.txt; exact snapshot b608925e
substrate: shown
applied_skill: pr-review
shown_candidates: [independent-review:high-confidence, pr-review:high-confidence, scout-pr-review:high-confidence, access:speculative, adr-workflow:speculative, agent-development:speculative, analyze:speculative, arch-review:speculative, bug-fix:speculative, build-dashboard:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, clarify:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, code-health:speculative, command-development:speculative, configure:speculative, contracts:speculative, cowork-plugin-customizer:speculative, create-cowork-plugin:speculative, create-viz:speculative, data-context-extractor:speculative, data-visualization:speculative, example-command:speculative, example-skill:speculative, explain:speculative, explore-data:speculative, frontend-design:speculative, hook-development:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, memory-sync:speculative, migrate:speculative, orient:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, reframe:speculative, scaffold-init:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, security-review:speculative, session-report:speculative, skill-creator:speculative, skill-development:speculative, slice-land:speculative, spec-workflow:speculative, sql-queries:speculative, statistical-analysis:speculative, tdd-loop:speculative, validate-data:speculative, vision-elicitation:speculative, write-query:speculative, writing-hookify-rules:speculative]
---

Actual reviewer: jig:reviewer, explicitly pinned gpt-6.1-sol.
Prompt: google-retained-guard-parent-final-craft-prompt.txt.
Reviewed snapshot: google-retained-guard-parent-safety-reviewed.patch,
SHA256 b608925efad5f1a08e48a0901a51ae7e2969fce3086089dee8f323e0387a16b6.
Final source hashes: google-retained-guard-parent-safety-manifest.log.

VERDICT: needs-changes

REASONING:
The bounded corrections have no packet-local craft blocker: exact-descriptor validation preserves endpoint/type/port/nonsharing checks without production flag mutation, and evidence retention precedes invocation with explicit unknown readiness. Real-descriptor/filesystem assertions and the retained 64-test parent regression support this source checkpoint, with two nonblocking coverage gaps below. Documentation honestly preserves the undiagnosed bootstrap failure, lost historical originals and unqualified activation/concurrency boundaries. Full 059-15 remains needs-changes; 059-01 remains READY_FOR_REVIEW.

SPECIFIC ISSUES:
- [nit][impl] rig/inspected-google-guard-descriptor-fixture.c:126-135 — `service-reject` waits for `POLLIN` before entering `reject_next`. It therefore cannot catch removal of polling in favor of immediate nonblocking `accept`; the empty-queue-to-later-client behavior lacks a regression assertion.
- [nit][impl] rig/inspected-google-guard-evidence.test.mjs:115-124 — Receipt coverage reaches pending state but does not exercise command-failure/returned writers or synthetic-failure refusal after pending. Regressions in those state distinctions would escape the suite; these are source-only coverage opportunities, not requests for another platform attempt.
- [strength][impl] rig/inspected-google-reject-guard.c:16-37 — The supported accept predicate operates on the supplied descriptor, closes an accepted client immediately and refuses blocking descriptors while comparing observed flags.
- [strength][impl] rig/inspected-google-guard-evidence.test.mjs:77-147 — Unchanged-module copies isolate real unsafe-parent, missing-parent and symlink controls without altering shared `rig/out`; assertions verify refusal and unchanged existing permissions.

RECONCILIATION NOTES:
Record the nits as nonblocking coverage limitations and reconcile the final review/parent regression status without closing native gates. Preserve `9ab4c2bc` as historical evidence; future retained originals do not repair its missing bytes or explain bootstrap status 5. No commands, edits, external posting or new runtime qualification were performed during this review.
