---
slice: 040-04 — coalesced-dispatch failure semantics + observability
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T21:48:56Z
prompt_source: review.py pr-review --richer-skill none ... 'failure semantics' core/airlock.js test/egress-coalescing.test.js
substrate: shown
applied_skill: none
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass (richer-skill: none — jig baseline)

## Reasoning

The `dispatch(req)` closure is a genuine DRY extraction mirroring `holdIfOffCeiling` — defined once inside the `if
(ready)` block, called at both dispatch sites so they cannot drift. UTF-8 byte length via
`TextEncoder().encode(body).length` is correct over `.length` (UTF-16 code units); the reported `method` is normalized
through the same `=== "GET"` test `fetchInit` uses (so it matches what was sent — GA4 sets no method, a raw echo would
report `undefined`); `destination: originPath(url)` strips query/fragment and is PII-safe. The two feature tests are
real inverses; the async `.then` is correctly microtask-flushed before asserting. Only nits remain.

## Specific issues (all folded)

- [nit] `bytes` guard keyed off `req.body != null`, not method — comment/code mismatch; a GET with a stray body would
  report bytes. **[FOLDED: guard is now `req.method !== "GET" && req.body != null`; a test pins it.]**
- [nit] `setConsent` held-beacon flush (~:604) still swallows failures — real inconsistency with the slice's principle;
  should be explicitly deferred, not silent. **[FOLDED: recorded in refinement-todo + deviation log with rationale.]**
- [nit] per-failure `new TextEncoder()` — a module-level instance is cleaner. **[FOLDED: hoisted to
  `EGRESS_TEXT_ENCODER`.]**
- [nit] two guards (dispatched-increments, no-retry) pass on old + new code — correct/intentional as no-regression /
  policy pins (DoD requires both); self-classification note, not a defect.
- [strength] normalizing the reported `method` through `fetchInit`'s own `=== "GET"` test is the right call.
- Optional coverage gap: empty-string body (`bytes: 0`) untested. **[FOLDED: added an empty-string-body test.]**

## Reconciliation notes

- Same as compliance: the flush residual is tracked, ADR-0021 OQ#1 is closed, deviation log + sweep written.
