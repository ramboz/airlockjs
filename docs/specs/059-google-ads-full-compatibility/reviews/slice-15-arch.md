---
slice: 059-15 - Exact native policy and one-shot stock capture
pass: arch
verdict: pass
reviewer: jig:reviewer (explicit gpt-6.1-sol)
reviewed_at: 2026-11-05T23:55:41Z
prompt_source: review.py arch-review spec 059 059-15; five-file Google stop correction based on b972ca7e --richer-skill arch-review; final exact patch and hardened tests
substrate: shown
applied_skill: arch-review
shown_candidates: [arch-review:high-confidence, access:speculative, adr-workflow:speculative, agent-development:speculative, analyze:speculative, bug-fix:speculative, build-dashboard:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, clarify:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, code-health:speculative, command-development:speculative, configure:speculative, contracts:speculative, cowork-plugin-customizer:speculative, create-cowork-plugin:speculative, create-viz:speculative, data-context-extractor:speculative, data-visualization:speculative, example-command:speculative, example-skill:speculative, explain:speculative, explore-data:speculative, frontend-design:speculative, hook-development:speculative, independent-review:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, memory-sync:speculative, migrate:speculative, orient:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, reframe:speculative, scaffold-init:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-pr-review:speculative, scout-scrum-master:speculative, security-review:speculative, session-report:speculative, skill-creator:speculative, skill-development:speculative, slice-land:speculative, spec-workflow:speculative, sql-queries:speculative, statistical-analysis:speculative, tdd-loop:speculative, validate-data:speculative, vision-elicitation:speculative, write-query:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass

REASONING:
Packet-local disposition: pass; the five current deliverables agree with the supplied b972ca7e-based patch. Technical-soundness, reliability, trust-boundary, compatibility and leanness lenses found no blocking architectural regression: the correction reuses existing ownership boundaries, preserves the raw relay and fixed destinations, and leaves Meta behavior unchanged. Full-slice readiness: not ready; 059-15 remains IN_PROGRESS with native admission closed and all non-excepted ADR-0047 gates intact. This was static, read-only review; no controls or native execution were rerun.

SPECIFIC ISSUES:
- [strength][impl] rig/inspected-transport.mjs:377 - Google admission stop closes the flag before synchronously destroying owned sockets while retaining listeners; direct close establishes the same barrier before awaiting cleanup at line 391.
- [strength][impl] rig/inspected-transport.mjs:287 - Socket closure now rejects pending Google TLS setup. Existing post-authentication/setup admission checks prevent late tunnel creation, and the stopped-admission catch avoids misreporting cancellation as certificate failure.
- [strength][impl] rig/inspected-google-transport.test.mjs:397 - Matched H1/H2 partial-response controls preserve unexpected-close/inconclusive semantics without manufacturing clean EOF or successful originals. Adjacent controls cover pending authentication/setup, active tunnels, direct close and expiry.

RECONCILIATION NOTES:
No new architectural scope deviation found. Record the stronger Google stop contract and source-cohort invalidation, without promoting Node controls to browser qualification. The authentication pause does not independently isolate the admission recheck. Current-source/browser confinement, residual helpers, safe guard release and port reuse, native permission/review provenance and transport/lease composition remain unqualified; actual native/reference/product evidence remains outstanding. ADR-0047 permits unknown/manual descendant cleanup only, with no authority, slot, final-egress, finite-limit or evidence waiver.

## Review scope and coordinator verification

Fresh read-only Jig reviewer, explicitly pinned `gpt-6.1-sol`. The supplied
patch compares the five-file Google stop packet against integrated
`b972ca7e5cadb2f2972aee3e4b58a5512f5a5f76`. It includes the final
test-hardening revision. Earlier Meta review scopes remain historical in
Git and are not extended by this pass.

Runtime SHA-256:
`4ae818c6e7cab6f083d83d4a35402dd263067ea79cd7473c310388ddc35b8a2e`.
Transport-test SHA-256:
`6c7afc241aed131a2732e66de17e4acc6d4fbaf6ce22194f047944901e22280e`.
These files stayed unchanged during later documentation/result
reconciliation. The separate coordinator regression passed 395 tests in
twelve files, with 15 opt-in skips; scoped ESLint passed.

The producer's `admission_open` snapshot is observed local state. It is not
independent stop evidence or authority. This pass does not select or qualify
a later broker-identity proposal. No browser/SDK/vendor run, original-slot
reservation, native admission or lifecycle transition follows.
