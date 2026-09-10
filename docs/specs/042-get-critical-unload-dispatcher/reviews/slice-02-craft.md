---
slice: 042-02 — generalize the GET-critical unload flush to pixel
pass: craft
verdict: pass
reviewer: general-purpose (pr-review lens, Opus)
reviewed_at: 2026-09-10T20:00:40Z
prompt_source: review.py pr-review --richer-skill pr-review
substrate: shown
applied_skill: pr-review
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass

REASONING:
A faithful, narrow generalization of the already-reviewed 042-01 GET-critical mechanism to pixel:
one import, one requestMapper branch, and an honest retirement of the now-empty
workerMappedGetEgress boolean (wiring collapses to `if (typeof addEventListener === "function")`).
All 23 pixel-seam tests pass; the six new/flipped tests are non-vacuous, and AC5 is a genuine
cross-path parity check against an independently-built worker host. No correctness/security/
robustness blockers: the GET URL is host-constructed by the same connector handle as the worker
path (same trust level by design), and dispose() already removed listeners unconditionally, so
pixel's new wiring is teardown-symmetric with no leak.

SPECIFIC ISSUES:
- [strength][impl] pixel-seam flush test asserts startsWith(META_TR) + method GET + no body; reds
  if requestMapper removed. Two independent force-off passes each redden a distinct subset.
- [strength][impl] AC5 parity builds a fresh createConnectorHost(createPixelConnector, metaConfig)
  and compares against ready[0].url — a true cross-path comparison; the "lead" descriptor also
  exercises paramMap projection.
- [strength][spec] AC4 dead-boolean retirement is clean; a forward-looking INVARIANT comment
  records the contract a future worker-mapped connector must satisfy.
- [nit][impl] createPixelConnector(connectorConfig || {}) carries a speculative || {} guard
  (untested dead branch); consistent with the reviewed 042-01 gtag branch. Log-only.
- [nit][impl] AC5 parity validity depends on value/currency/content_name never being denylisted
  (main path governs before mapping; worker witness doesn't). Disclosed in-test; mirrors 042-01
  AC5. Latent brittle-fixture coupling if a future DEFAULT_DENYLIST covers one. Log-only.

RECONCILIATION NOTES:
- Both nits are log-only, not REVIEWED-blocking.
- ACTIONABLE: adapters/eds/index.js:536-558 (bootGa4Gtag JSDoc) still names the retired
  workerMappedGetEgress + a pixel-drop posture that no longer exists (doubly stale after this
  slice). Outside the slice's declared files, so not a code finding — but ADD an
  adapters/eds/index.js row to the reconciliation sweep + fix the JSDoc at reconciliation.
- Sweep table TODOs (architecture.md OQ16, CLAUDE.md "ring tail dropped" note, refinement-todo
  RESOLVED) still need executing before DONE.
