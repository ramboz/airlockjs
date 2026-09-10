---
slice: 042-01 — GET-critical dispatcher + ga4-gtag unload flush
pass: craft
verdict: pass
reviewer: general-purpose (pr-review lens, Opus)
reviewed_at: 2026-09-10T19:04:26Z
prompt_source: review.py pr-review --richer-skill pr-review
substrate: shown
applied_skill: pr-review
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass

REASONING:
The change is tightly scoped to the four declared files (core/egress.js, core/airlock.js,
and the two named tests) with no stray edits. The POST path is byte-identical (the legacy
per-tracker loop + budget/swallow/drop logic untouched); the additive GET requestMapper path
is correct (bodyless GET, keepalive, no budget consumption per A2, [] tolerated); the gtag
wiring mirrors the existing helix-rum branch. Tests are strong and non-vacuous — each new test
reds when the feature is removed, and the AC5 parity test genuinely compares against an
independently constructed worker (routeBatch) path. No blockers.

SPECIFIC ISSUES:
- [nit][spec] core/egress.js requestMapper path is method-aware; a POST EgressRequest (AC1
  permits it) would bypass the aggregate keepalive budget/`used` accounting the legacy POST
  loop enforces. Unreachable today (gtag/pixel handle() return only {method:"GET"}). →
  Reconciliation: add a one-line clarification that the requestMapper path is GET-shaped by
  current design and a POST would bypass the budget (documented boundary), or assert GET.
- [nit][impl] core/egress.js `n` (trackers/endpoints.length) still computed on every
  construction even when requestMapper is present and the per-tracker loop is dead for that
  path. Harmless (the requestMapper branch returns first). Defer.
- [strength] fetchInit relocated to egress.js and shared (byte-identical) so the steady-state
  seam and unload fast path can't drift; POST connectors unchanged.
- [strength] the "[] no-op" test also supplies endpoints/trackers → a real discriminator, not
  a coincidental zero-call.
- [strength] the AC5 parity test compares against an independently-constructed worker
  routeBatch path, not a self-comparison (matches the frame-critique steer).
- [strength] passing unbound `.handle` as requestMapper verified safe (closure over
  measurementId/ctx/endpoint, no `this`), constructed once.

RECONCILIATION NOTES:
- rig/parity/transport-report.js:12,52 still attribute fetchInit to core/airlock.js; it now
  lives in core/egress.js (behavior byte-identical, home file moved). Belongs in the
  reconciliation sweep (already flagged in the deviation log), not a blocker.
- Both nits are defer-friendly; neither blocks the REVIEWED transition.
