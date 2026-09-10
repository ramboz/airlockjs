---
slice: 041-04 — declarative instrumentation-config selection
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-10T17:41:32Z
prompt_source: review.py pr-review --richer-skill none ... 'declarative' (re-run)
substrate: shown
applied_skill: none
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass (richer-skill: none — jig baseline)

## Reasoning
`case "ga4-gtag":` faithfully mirrors `case "ga4":` (identical `{...rest, ...governance}` threading + `{handle, events}`
shape, own `GA4_GTAG_MANIFEST_EVENTS`). The schema `ga4GtagConnector` $def is well-formed (additionalProperties:false,
required [type, measurementId] with minLength:1, optional fields) and correctly in the closed oneOf. The runtime
validateConnectorEntry gtag check mirrors the alloy/pixel per-type checks + fails loud+actionable; the endpoint override
threads into both connectorConfig + the endpoints:[endpoint] ceiling. Tests are real inverses (byte-equal createAirlock
equivalence, consent-hold-then-grant, missing-measurementId rejection, ceiling-widens-for-override) — none vacuous.

## Specific issues (folded)
- [nit] the override test proved the ceiling side but not connectorConfig.endpoint under override. [FOLDED: added
  `expect(initMsg().endpoint).toBe(CUSTOM_ENDPOINT)`.]
- [nit] the runtime non-string measurementId guard was untested. [FOLDED: added a `measurementId: 12345` rejection test.]
- [strength] the byte-equal config-vs-standalone equivalence test (governance engaged) is the strongest "faithful mirror"
  proof; the endpoint gap-fix ceiling-widening is a genuine defensive catch with a real inverse.

## Reconciliation notes (folded)
- Record the endpoint ceiling-widening gap-fix in the deviation log; note GA4_GTAG_MANIFEST_EVENTS is an intentional
  separate const (future-divergence hedge), not accidental duplication.
