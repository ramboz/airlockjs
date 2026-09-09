---
slice: 039-01 — core /g/collect page_view beacon
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-09-09T01:02:15Z
prompt_source: review.py pr-review <spec> 'core /g/collect' <deliverables> --richer-skill pr-review
substrate: shown
applied_skill: pr-review
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

Craft verdict: **pass** (pr-review methodology). No blockers — nits + reconciliation items only.
Strengths: negative-control test (delete `en` → fail) makes AC5 non-vacuous; CORE_PAYLOAD_KEYS guard stops
page_location/referrer/title double-landing; `_et` denylist prevents a false-divergent on 3841-vs-100.
Nits (reconciliation-log items, non-blocking): (1) [impl] EP_STRING/EP_NUMBER + deriveLogicalEvent byte-identical to
rig/parity/descriptors/ga4.js — inline mirror, 2 callers (within ADR-0002 extract-on-3rd-caller budget), watch for a
3rd; (2) [impl] connectors/ga4/gtag.js:102 `query.length ? … : endpoint` ternary is unreachable (v + _et always
present) — dead defensive code copied from pixel; (3) [impl] `v=2` not in the descriptor's attributionFields/denylist —
silently unexamined on a real re-capture; (4) [impl] golden-sha256 gives an opaque diff on future map.js whitespace edits.
Reconciliation notes: manifest/init deferral must be logged; transport-block omission is a 038-03 concern (confirm out
of scope); per-slice gapMap owner granularity is an intentional refinement, not drift.
