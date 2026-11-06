---
slice: 059-15 - Exact native policy and one-shot stock capture
pass: arch
verdict: pass
reviewer: jig:reviewer (explicit gpt-6.1-sol; unavailable-diagnostic source snapshot only)
reviewed_at: 2026-11-06T05:08:25Z
prompt_source: review.py arch-review spec.md 059-15; google-retained-guard-source-arch-prompt.txt; snapshot af78a764d8b7c26c20c5afdf19eb1eadbf485b60558e8478db265dbd9cf3f178; later test-only delta not regraded by this arch pass
substrate: shown
applied_skill: arch-review
shown_candidates: [arch-review:high-confidence, access:speculative, adr-workflow:speculative, agent-development:speculative, analyze:speculative, bug-fix:speculative, build-dashboard:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, clarify:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, code-health:speculative, command-development:speculative, configure:speculative, contracts:speculative, cowork-plugin-customizer:speculative, create-cowork-plugin:speculative, create-viz:speculative, data-context-extractor:speculative, data-visualization:speculative, example-command:speculative, example-skill:speculative, explain:speculative, explore-data:speculative, frontend-design:speculative, hook-development:speculative, independent-review:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, memory-sync:speculative, migrate:speculative, orient:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, reframe:speculative, scaffold-init:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-pr-review:speculative, scout-scrum-master:speculative, security-review:speculative, session-report:speculative, skill-creator:speculative, skill-development:speculative, slice-land:speculative, spec-workflow:speculative, sql-queries:speculative, statistical-analysis:speculative, tdd-loop:speculative, validate-data:speculative, vision-elicitation:speculative, write-query:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass

REASONING:
The pinned patch has no packet-local architectural blocker as a bounded negative/unavailable diagnostic. The reject-only candidate stays under `rig/`, platform acquisition requires explicit opt-in, and ordinary tests cannot activate a job or admit native traffic. Retained evidence supports the single bootstrap failure, unsafe process-listener replacement and narrower sharing-option correction; it supplies no working retained guard. This read-only architecture pass does not clear full059-15 compliance, which remains `needs-changes` and IN_PROGRESS;059-01 remains READY_FOR_REVIEW.

SPECIFIC ISSUES:
- [strength][impl] rig/inspected-google-reject-guard.c:18 — Readiness requires the exact IPv4 loopback endpoint, stream type, zero `SO_REUSEPORT` and readable listener state. The accept loop only closes clients; it has no upstream, fallback or grant-rearm path.
- [strength][impl] rig/inspected-google-guard-bootstrap.mjs:41 — Private exact-job recovery identity is recorded before bootstrap. Acquisition failure preserves that identity without automatically releasing resources or substituting another listener.
- [strength][impl] docs/specs/059-google-ads-full-compatibility/plan.md:495 — Documentation separates option-policy red/green from full-validator success and preserves the matched nonsharing listener’s `ENOPROTOOPT` refusal.
- [strength][impl] docs/specs/059-google-ads-full-compatibility/plan.md:390 — Authority provenance identifies the later direct answer, disclaims the interrupted prompt as approval and labels the creator transcription as non-independent.

RECONCILIATION NOTES:
No additional architectural deviation found. Preserve error 5 as undiagnosed, the passing process-loss test as negative-control evidence, and the 54-test regression as source evidence only. Activation/custody, restart, logout/unload, endpoint-route coverage, Chrome, native lease and authenticated execution authority remain unqualified. ADR-0048’s reject-only lifetime exception changes none of those gates.
