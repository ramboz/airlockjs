---
slice: 036-01 — live CWV before/after harness (two-URL) + procedure
pass: craft
verdict: pass
reviewer: jig:reviewer (--richer-skill none)
reviewed_at: 2026-09-05T22:03:05Z
prompt_source: review.py pr-review docs/specs/036-real-site-validation-harness/spec.md 036-01 --richer-skill none <deliverables>
substrate: shown
applied_skill: none
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass

REASONING:
The engine extraction is genuine, not cosmetic: rig/lh-core.mjs holds all median/band math + a DI'd
runLighthouseOnce (no lighthouse/chrome/playwright import at module load), and both rigs import it — no
parallel re-implementation. The profile→band logic is correct (the subtle, correct split: ga4 keeps
lh-eds's symmetric band; only alloy/personalization treat a CLS improvement as a pass), its unit tests
are non-vacuous, two-deployment correctly withholds the band, and no correctness bug in mode/arm/URL
construction. The procedure doc is accurate against scripts.js (:184/:196/:246/:270+) and the cache-parity
pre-check genuinely defends the query-string confound. Strengths: DI'd engine reuse, query-string-derived
local gate (fork B faithful analog), correct ga4-vs-alloy band asymmetry, the cache-parity defense.

NITS (all non-blocking, dispositioned in the deviation log + inbox): shared local-server plumbing
duplicated lh-eds/lh-live (→ inbox follow-on); lh-live mode/URL-construction lacks CI coverage though the
logic is already correct (→ inbox follow-on: extract a pure resolveRunPlan + test); the alloy band field
{tbtMs:50} under-describes the CLS gate the cls_* flags carry (intentional, logged); index-alloy.html
canonical hardcodes localhost:3111 (cosmetic, matches index.html convention).
