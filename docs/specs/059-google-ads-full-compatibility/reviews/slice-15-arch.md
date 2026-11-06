---
slice: 059-15 - Exact native policy and one-shot stock capture
pass: arch
verdict: pass
reviewer: jig:reviewer (fresh explicit gpt-6.1-sol)
reviewed_at: 2026-11-06T01:01:21Z
prompt_source: review.py arch-review spec.md 059-15 --richer-skill arch-review; google-tls-broker-tuple-arch-prompt.txt; patch 081f6f205a4c340638c233f2d3390c48f9cfce9554f520ce1b604d81f489e772
substrate: shown
applied_skill: arch-review
shown_candidates: [arch-review:high-confidence, access:speculative, adr-workflow:speculative, agent-development:speculative, analyze:speculative, bug-fix:speculative, build-dashboard:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, clarify:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, code-health:speculative, command-development:speculative, configure:speculative, contracts:speculative, cowork-plugin-customizer:speculative, create-cowork-plugin:speculative, create-viz:speculative, data-context-extractor:speculative, data-visualization:speculative, example-command:speculative, example-skill:speculative, explain:speculative, explore-data:speculative, frontend-design:speculative, hook-development:speculative, independent-review:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, memory-sync:speculative, migrate:speculative, orient:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, reframe:speculative, scaffold-init:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-pr-review:speculative, scout-scrum-master:speculative, security-review:speculative, session-report:speculative, skill-creator:speculative, skill-development:speculative, slice-land:speculative, spec-workflow:speculative, sql-queries:speculative, statistical-analysis:speculative, tdd-loop:speculative, validate-data:speculative, vision-elicitation:speculative, write-query:speculative, writing-hookify-rules:speculative]
---

Reviewer: jig:reviewer, fresh explicitly pinned gpt-6.1-sol
Prompt: google-tls-broker-tuple-arch-prompt.txt
Patch: 081f6f205a4c340638c233f2d3390c48f9cfce9554f520ce1b604d81f489e772

VERDICT: pass

REASONING:
Summary: The supplied two-file packet against baseline 353510b2 is architecturally fit to land as an unselected SDK-free experiment, with no packet-local blockers or nits found. Technical soundness, ownership, failure semantics, trust boundaries and compatibility are addressed through the existing rig composition without changing frozen contracts, production policy, dependencies, admission or Accepted decisions. This disposition does not select the mechanism or clear full-slice/native qualification.

SPECIFIC ISSUES:
- [strength][impl] rig/inspected-transport.mjs:195-223: The additive local entry generates its broker name internally and fixes upstream connections to literal loopback, while retaining Google authority checks, peer authentication, physical observation and inner H1/H2 relay.
- [strength][impl] rig/inspected-transport.mjs:228-278: Acquisition and lookup share the complete accepted TCP tuple; removal checks object identity, and CONNECT captures the raw peer before awaits. This preserves ownership across collisions and asynchronous teardown.
- [strength][impl] rig/inspected-transport.mjs:136-148: Abnormal TLS closure resets the owned raw TCP peer without private-handle access or manufactured clean EOF. Plain-client reset behavior remains unchanged.
- [strength][impl] rig/inspected-google-transport.test.mjs:428-472: Independent replacement-receiver assertions explicitly retain normally trusted, same-name/different-key CONNECT delivery as a counterexample to exclusive identity.

RECONCILIATION NOTES:
Concerns: Exclusive endpoint identity remains unsatisfied. Node's supplied test CA does not establish Chrome trust behavior. Browser routes, reconnect/resumption, surviving helpers and safe guard release remain unqualified; all native authority, provenance, lease, original-slot, setup/source/review/coordination/window gates stay open. Descendant cleanup remains unknown/manual under ADR-0047.

Open questions: Which case-exclusive endpoint binding or independently revoked TCP route can satisfy the replacement and reconnect controls before future selection?

Evidence: Retain the failed green-2 attempt and the teardown-order attribution correction. The inspected final artifact reports 433 passed/26 skipped; it is regression evidence, not browser qualification. The operator guide honestly records the collision test's configured-source prerequisite and loopback-only-host limitation. No additional architectural deviation found. Review was read-only; nothing was executed.
