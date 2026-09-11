---
slice: 026-06 — Meta custom-data `cd[...]` wire-fidelity fix
pass: craft
verdict: pass
reviewer: general-purpose (pr-review lens, Opus)
reviewed_at: 2026-09-11T03:38:42Z
prompt_source: review.py pr-review --richer-skill pr-review
substrate: shown
applied_skill: pr-review
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass

REASONING:
A tight, config-only wire-fidelity fix. meta.js projects the four standard-event params under
cd[...] output keys; the parity descriptor removes the four cd[...] gapMap entries so they
reclassify as real `maps`; tests updated across three files. Traced the oracle chain end to end
(container fixture carries the four cd[...] fields; deriveLogicalEvent reverse-projects unchanged;
oracle compares like-named fields) and the revert-guards genuinely red on a bare-name regression.
No connector-core change, no new PII surface (only the wire OUTPUT key moved; source event.params
keys stay bare), no stale bare-key references survive.

SPECIFIC ISSUES:
- [strength][impl] pixel-connector.test.js AC3 witness asserts on the RAW undecoded req.url
  (cd%5Bvalue%5D=25) + a negative bare-name match — proves on-the-wire percent-encoding, reds on revert.
- [strength][impl] the four cd[...] entries are REMOVED from gapMap (bucket → maps), not left as
  gap-closed flags; AC4(a) asserts bucket==="maps" — guards "matched, not gapped".
- [strength][impl] clean source-key/output-key separation in meta.js; JSDoc + descriptor comments
  updated (not left stale).
- [nit][spec] AC2 left the flip mechanism implicit (maps-via-removal vs gap-closed-via-retention);
  a sharper AC would have named the target bucket. Resolved correctly; already in the deviation log.
- [nit][impl] parity-meta.test.js SUPPLIED-path test hand-builds the cd[...] fields, so it is
  insensitive to a meta.js revert (an oracle-contract test, not a wire witness); revert-protection
  lives in the AC3 witness / AC2 loop / seam AC5 / REPLAY path. Informational.

RECONCILIATION NOTES:
- Both nits are low-severity → deviation-log items, not REVIEWED-blockers. Add a line noting the
  SUPPLIED-path test is an oracle-contract test, not a wire witness.
- The 026-04 grounding fixture (test/fixtures/meta-tr-pageview.redacted.json) is privacy-clean
  (pixel id all-zero; external_id/fbp/client-hints redacted; cd[region]/erp.intuit.com not PII) and
  belongs to 026-04's landing, NOT this slice's 5-file deliverable set.
