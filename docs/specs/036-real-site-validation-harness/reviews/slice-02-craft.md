---
slice: 036-02 — supported-subset live smoke (GA4 + alloy) + residuals checklist + run-procedure
pass: craft
verdict: pass
reviewer: jig:reviewer (--richer-skill none; 2 rounds: robustness r1, pass r2 post-fix)
reviewed_at: 2026-09-05T23:16:43Z
prompt_source: review.py pr-review docs/specs/036-real-site-validation-harness/spec.md 036-02 --richer-skill none <deliverables>
substrate: shown
applied_skill: none
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass (re-run, after fixes)

REASONING:
The two round-1 robustness blockers + the RUM flakiness are genuinely fixed and sound. Boot-health's
positive signal is the PRODUCTION window.airlock/installOnWindow (verified adapters/eds/index.js:310-315,
returned by bootEdsAnalytics + the boot composite; the partial-boot path leaves it uninstalled) — NOT
the testbed-only __flicker mark — so a silent hang is caught on a real adopter page. The RUM
sampled/guaranteed split makes a live sampled-out load informational while keeping a force-selected miss
(local) and any thrown RUM boot a fail (the latter via the separate rum_boot_health check). The
top-checkpoint selection makes the shape-check deterministic (local dry-run stably green across repeated
runs). New tests non-vacuous; honest-labeling ("never accepted") still asserted; no new load-bearing
defect; e2e.mjs's imports (the 3 shared primitives) are untouched by the installed param / rename.

ROUND 1 (needs-changes): boot-health gated only on __airlockBootFailed (silent-hang false-green on AC3's
alloy chamber proof); the live RUM SENT-shape check false-FAILED a healthy sampled page.

NON-BLOCKING NOTES (applied): stale JSDoc param name locallyExercisable→networkExercisable (smoke-core.mjs:164)
corrected; the pre-existing ~20s live-wait latency (no __flicker mark on a real page → full timeout before
the positive read) documented as an operator note in docs/real-site-validation.md (verdict correct, just
latency).
