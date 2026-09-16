---
slice: 049-02 — direct-beacon-transport suppression (egress-parity completeness)
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-09-15T20:59:48Z
prompt_source: review.py pr-review --richer-skill pr-review
substrate: shown
applied_skill: pr-review
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

Craft pass (pr-review richer skill, opus). **VERDICT: pass**, no blockers.

The transport-of-emission carve-out is implemented cleanly: the `fetch`+`keepalive` short-circuit is separated from
the additive URL allow-set; allow-beats-suppress precedence preserved; every drop path fails open (unparseable URL,
no-DOM substrate). Test coverage is well-matched to the substrate constraints: the pure predicate is unit-tested with a
mutation-verified load-bearing exemption test, and the DOM interception (Node/vitest-ineligible) is proven in the
real-browser rig driving every beacon transport plus the sole-emitter collision (`collide_exactly_one_network_request`,
red in BOTH mutation directions). The prior 4/6-methods vacuous-coverage gap stayed closed.

Three nits, all folded during this slice's review-fix:
1. [nit][impl] `setAttribute("srcset", …)` had no red witness — added a rig fixture closing the last unexercised
   `isImgSrcAttr` branch (mutation-red on removing the `srcset` branch).
2. [nit][impl] the test-file header still said "Spec 049-01" — refreshed to cover the 049-02 beacon predicates.
3. [nit][impl] the CI gating-step label omitted 049-01 AC1 — added.

Both A-residuals (beacon escape vectors; the same-URL keepalive-fetch collision) are honestly logged with resolution
triggers; the docstring/spec are candid that the keepalive exemption is unconditional and fails toward keeping
airlock's arm.
