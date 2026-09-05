---
slice: 035-01 — name-scope + name-validate the live alloy cookie grant
pass: arch
verdict: pass
reviewer: jig:reviewer (--richer-skill none; 2 rounds: needs-changes r1, pass r2 post-fix)
reviewed_at: 2026-09-05T20:35:28Z
prompt_source: review.py arch-review docs/specs/035-cookie-grant-wrapper/spec.md 035-01 --richer-skill none <deliverables>
substrate: shown
applied_skill: none
shown_candidates: [arch-review:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-pr-review:speculative, scout-scrum-master:speculative, servo:agent-loop:speculative, servo:autonomy-readiness:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:quality-gate:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass (re-run, after fixes)

REASONING:
Round 1 returned needs-changes (one blocker + one nit + two named follow-ons). This re-run confirms
both are genuinely resolved and the core security architecture still holds.

- (blocker) RESOLVED: the exact-vs-prefix match semantic + RFC-token write-validation are now
  documented at the contract DECLARATION site (contracts/capability.d.ts, the CapabilityRequest.cookies
  field), including the trailing-`_` convention's sharp edge; the type (readonly string[]) is unchanged.
- (nit) RESOLVED: core/cookie-scope.js is in the import-free machine-guard (test/core-boundary.test.js's
  it.each) and the module is genuinely import-free.

Core architecture holds: trusted-side enforcement on BOTH seams (READ filter before host.init;
WRITE validate+scope in the cookie-writeback handler off a construction-closure grantedCookieNames,
NEVER threaded through host.init into the untrusted chamber — 034-01 upheld); default-deny/fail-closed
throughout; single source of truth (ALLOY_COOKIE_NAMES, same array reference into the manifest, pinned
toBe). The fixes were doc-only + test-only; no new arch-scoped defect.

STRENGTHS: SSOT enforced by identity not convention (toBe same-ref); scope set captured host-side in
the construction closure (correct trusted-seam placement); import-free vendor-neutral primitive now
machine-guarded; redacted (name-only) fail-closed drop diagnostic.

DEFERRED FOLLOW-ONS (appropriately recorded in refinement-todo OQ13-4, not re-raised): (iii)
fail-open-by-omission → a 037 1.0-pin input; (iv) NAME-only value-side residual on the reconcile path
→ a candidate hardening follow-on. Both are honest characterizations of real residual gaps, out of
this slice's scope.
