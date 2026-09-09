---
slice: 039-01 — core /g/collect page_view beacon
pass: arch
verdict: pass
reviewer: arch-review
reviewed_at: 2026-09-09T01:02:15Z
prompt_source: review.py arch-review <spec> 'core /g/collect' <deliverables> --richer-skill arch-review
substrate: shown
applied_skill: arch-review
shown_candidates: [arch-review:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-pr-review:speculative, scout-scrum-master:speculative, servo:agent-loop:speculative, servo:autonomy-readiness:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:quality-gate:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

Arch verdict: **pass** (arch-review methodology). No blockers. Boundary sound: purely-additive module, frozen MP
surface byte-identical, handle() returns the exact EgressRequest[] shape the pinned Connector contract + generic host
consume, no-api_secret is structural, second GA4 rewire path drops into the 038 harness with zero pipeline change.
Concern / open question (nit [spec], to resolve at/for 039-03): `createGa4GtagConnector` is named/shaped like a
Connector but returns only {handle} (no manifest/init) — 039-03's `_ga_<stream>` read-modify-write needs a caps-holding
closure from init(), so the next slice must decide: grow THIS factory into the full Connector vs. a separate wrapper
file (map.js/connector.js style). RESOLVED INTENT (recorded here + deviation log): 039-03 GROWS this factory into the
full Connector (adds manifest + init(caps), keeps handle) — single factory, because the gtag connector is stateful
(needs caps) unlike the pure MP mapper; the module-doc "separate wrapper" line is corrected in 039-03.
Second nit [spec]: the /g/collect GET wire surface has no pinned contract artifact yet (unlike contracts/ga4-mp*);
descriptor attributionFields is the de-facto contract — defer a pinned artifact until the field set stabilizes across
039-02/03/05, plan stated. Out-of-scope tracking: transport-block omission (transport-report coverage owner); the
redacted fixture omits real `v=2` (038 fixture-completeness).
