---
slice: 046-01 — core DC ccm/collect beacon off-thread (query-delimited, reuse-complete)
pass: craft
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-13T16:41:15Z
prompt_source: review.py pr-review docs/specs/046-floodlight-connector/spec.md 046-01 --richer-skill pr-review
substrate: shown
applied_skill: pr-review
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass (craft pass — no blockers; REVIEWED not gated by this pass)

REASONING:
Slice 046-01 lands a clean, reuse-complete DC `ccm/collect` connector mirroring the ratified AW connector (044) with documented, deliberate divergences (no inbound click-ids; `auid`-only ctx), correctly extracts `encodeNpa` into shared `connectors/consent-mode.js`, and reuses `sourceGoogleAdsCtx` verbatim. Tests are meaningful with real negative/regression guards + a committed-fixture safety scan; full suite + `npm run parity:floodlight-ccm` green. No correctness, security, or scope problems — findings are nits only.

SPECIFIC ISSUES:
- [nit][impl] rig/parity/redact-floodlight-ccm.js:19-23,43,46-52 — `scrubUrlIdentifiers` is now the THIRD byte-identical copy (rig/parity/redact.js:47-53 Meta; rig/parity/redact-google-ads.js:40-46 AW), and CLICK_ID_PARAMS (:43) matches AW's (:37), yet the doc comment claims "two near-identical redactors is not yet a rule-of-three trigger" — internally inconsistent with the slice extracting encodeNpa on its 2nd caller. In-slice fix: correct the stale claim. Full extraction of scrubUrlIdentifiers touches 038/044 → reconciliation follow-up.
- [nit][impl] test/floodlight.test.js:132-142,169-173 + test/google-ads.test.js:149-156 — reuse/extraction ACs verified via readFileSync+regex over source text (brittle to benign refactors; test/floodlight.test.js:137 partially duplicates test/google-ads.test.js:152). Established repo pattern; brittleness, not a defect.
- [strength][impl] test/parity-floodlight-ccm.test.js:126-136,147-171 — real negative guards (delete `en` → fail+dropped bucket; CLI mutate `en:purchase` → non-zero exit) prove the oracle/CLI fail on divergence.
- [strength][impl] test/parity-floodlight-ccm.test.js:61-78 — committed-fixture safety scan (all-zeros regexes for DC-<digits> + auid shape; _gcl_au parses to synthetic auid) guards live-identifier leakage (security-MUST/R5).
- [strength][impl] connectors/floodlight/connector.js:36-37,69,158 — disciplined reuse (appendParam undefined-omit gives correct omit-when-absent; DC divergences from AW explicit + documented).

RECONCILIATION NOTES:
- Out-of-slice cleanup: extract shared `scrubUrlIdentifiers` now it has 3 identical copies (edits rig/parity/redact.js (038) + redact-google-ads.js (044)) → follow-up, not this slice. In-slice action: fix the stale "two … not yet a rule-of-three" claim in redact-floodlight-ccm.js.
- Source-grep reuse tests consistent with existing 044 pattern; behavior-first tests are a broader test-style decision, not a 046-01 blocker.

Reviewer: general-purpose subagent, craft pass (pr-review baseline + repo sibling comparison), read-only, no implementation context.
