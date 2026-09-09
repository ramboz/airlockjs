---
slice: 039-03 — session-state reproduction + `_ga_<stream>` writer (closes OQ13-2)
pass: arch
verdict: pass
reviewer: arch-review
reviewed_at: 2026-09-09T02:07:02Z
prompt_source: review.py arch-review <spec> 'session-state' <deliverables> --richer-skill arch-review
substrate: shown
applied_skill: arch-review
shown_candidates: [arch-review:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-pr-review:speculative, scout-scrum-master:speculative, servo:agent-loop:speculative, servo:autonomy-readiness:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:quality-gate:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

Arch verdict: **pass** (arch-review methodology). Host-called-writer-in-cookies.js is the RIGHT boundary for the new
cookie-write governance surface — arguably BETTER than 039-01's recorded "grow into init(caps) Connector" intent: cookies
are a main-thread/orchestrator concern (architecture.md OQ5); sourceGa4Ctx already lives host-side and is host-called from
adapters/eds/index.js:392; the writer reuses the identical capability.d.ts:74-77 cookie accessor + the identical 017-02
storageGranted gate. A caps-holding connector would have pushed cookie mutation into the chamber layer + duplicated consent
resolution. gtag.js stays pure; the seal is not weakened (no-read/no-write/return-null under denial); the writer/mapper
split correctly positions per-CYCLE (not per-event) advancement for 039-04/spec-040 batching. No blockers.
Nits (reconciliation): (1) [impl] gtag.js:169 reads ctx.sessionId — the future host-wiring MUST override it with the
writer's returned sessionId (as the test does), else per-page sessions silently return and defeat OQ13-2 (contract-by-doc
only; no composing helper pins it); (2) [impl] the "separate wrapper mirroring connector.js" module-doc line + the
Connector-implying factory name — 039-01's deviation promised the correction "in 039-03"; still open (FIX at reconciliation);
(3) [impl] storageGranted defaults true (fail-open) on a cookie-write gate that bypasses the egress seal — acceptable
(inherited 004-03 back-compat, host resolves it) but the new surface warrants an explicit note.
Open questions for the host-wiring slice / spec 040: writeGa4SessionState needs a known streamCookieName (config, not
scanned) — on a first visit the host must derive it from the measurement id; that + the sessionId-override is the untested
composite seam this slice defers; a single host-side composing helper is worth it when wiring lands. architecture.md
close-out should account for writeGa4SessionState's host-called governance surface.
