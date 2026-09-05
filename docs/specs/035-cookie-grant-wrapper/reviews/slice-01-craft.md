---
slice: 035-01 — name-scope + name-validate the live alloy cookie grant
pass: craft
verdict: pass
reviewer: jig:reviewer (--richer-skill none)
reviewed_at: 2026-09-05T20:30:58Z
prompt_source: review.py pr-review docs/specs/035-cookie-grant-wrapper/spec.md 035-01 --richer-skill none <deliverables>
substrate: shown
applied_skill: none
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass

REASONING:
The two-seam hardening is implemented cleanly, sharing one source of truth (ALLOY_COOKIE_NAMES, wired
by same-array reference). The three security-critical primitives in core/cookie-scope.js are correct:
the token regex is exactly the RFC 7230 tchar set (positive whitelist, anchored, JS $-without-m
correctly rejects a trailing \n); the exact-vs-prefix rule is sound (demdex_evil not granted); and the
write-back gate is fail-closed with value-redacting diagnostics and true null/omitted back-compat.
Tests are thorough and non-vacuous. The deviation log is honest and grounded against
rig/alloy-live-reprobe.mjs:189-190.

STRENGTHS: positive-whitelist token grammar (fails closed on anything outside the set, not just
enumerated separators); same-reference SSOT pinned with toBe; held diagnostic carries the cookie name
only, never the value (test-proven).

NIT DECLINED (with reason): the "redundant .trim()" at core/cookie-scope.js:110 is NOT redundant — the
pair-level trim (:108) does not remove whitespace between the name and "=" (e.g. "foo = bar" → name
slice "foo "), so the inner trim is load-bearing for that defensive case. Left as-is.

RECONCILIATION NOTE (no action): the read=scope / write=scope+validate asymmetry is safe by design —
the seed is never written back unvalidated; every write-back is independently token-validated.
