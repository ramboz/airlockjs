---
slice: 046-02 — core DC activity beacon off-thread (;-delimited, Floodlight-native identity)
pass: arch
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-13T18:30:10Z
prompt_source: review.py arch-review ... 046-02 --richer-skill arch-review
substrate: shown
applied_skill: arch-review
shown_candidates: [arch-review:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-pr-review:speculative, scout-scrum-master:speculative, servo:agent-loop:speculative, servo:autonomy-readiness:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:quality-gate:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass (arch re-review — the missing-ADR blocker is discharged)

REASONING:
ADR-0025 records the endpoint-ceiling match-semantics change as Accepted, extends ADR-0006 (not supersede), resolves ADR-0006's named declaration-granularity open question, records both rejected alternatives with real rationale (Option B strip-cachebuster-then-exact = fragile denylist; Option C origin-only = too permissive), and names the src-only-anchor + arbitrary-trailing-;-segment append residual as the matrix analogue of ADR-0006 residual (i) — tracked in refinement-todo + indexed in decisions/README. The two prior nits are fixed: joinMatrixUrl is a single shared home used by both the emitted activity URL and the declared ceiling prefix (structural lockstep), and the append residual is named in the ADR. Design sound + lean: path-matrix.js mirrors query-params.js; the ceiling change is vendor-neutral + opt-in by declared path shape; fail-closed ceiling provably unweakened for every existing connector (no shipped endpoint has a ;, regression-pinned).

SPECIFIC ISSUES:
- [strength][impl] core/path-matrix.js joinMatrixUrl used by BOTH the emitted activity URL and the declared ceiling prefix — lockstep structural, not two drifting copies.
- [strength][impl] core/endpoint-ceiling.js ;-boundary anchor (startsWith(prefix + ";")) holds src value-extension (src=00000001 vs src=0000000); value-extension/wrong-path/wrong-origin/query-exact all regression-pinned.
- [nit][impl] core/path-matrix.js:20 docstring claimed core-boundary.test.js machine-enforces the import-free property but path-matrix.js was not in its it.each list. FIXED post-review: added "path-matrix.js" to test/core-boundary.test.js's it.each (the docstring is now true + the leaf's import-free property is structurally pinned).

RECONCILIATION NOTES:
- The matrix-tail append residual is honestly named in ADR-0025, opens no new-destination escape (destination pinned to ad.doubleclick.net — parallel to ADR-0006 residual (i)), tracked in refinement-todo with a trigger. Correctly-scoped accepted deferral.

Reviewer: general-purpose subagent, arch re-review, read-only, no implementation context; verified ADR-0025 + joinMatrixUrl + the ceiling regression pins.
