---
slice: 046-02 — core DC activity beacon off-thread (;-delimited, Floodlight-native identity)
pass: craft
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-13T18:15:49Z
prompt_source: review.py pr-review ... 046-02 --richer-skill pr-review
substrate: shown
applied_skill: pr-review
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass (craft pass — no blockers; nits become reconciliation/deviation items)

REASONING:
High-craft slice. The path-matrix encoder/flattener are a correct symmetric pair with adversarially-tested delimiter-injection safety; the endpoint-ceiling prefix match is tightly bounded + opt-in with a query-delimited regression guard; the descriptor field split is honest + machine-verified (un-owned src drop → red). Full suite (1670), floodlight-activity parity CLI, and lint all green. No blockers.

SPECIFIC ISSUES:
- [nit][impl] connectors/floodlight/connector.js:216-227 — handle() emits the activity beacon on every page_view even when Floodlight identity `src` is unconfigured; the src-less beacon carries auiddc + Consent Mode but no src/type/cat, saved from egress only by the ceiling collapsing to /activity exact. Fail-safe but relies on a 2nd control + the src-absent path is untested. Gate activity emission on src presence (mirror omit-when-absent identity discipline). [ADDRESSING: guard handle() + manifest on src]
- [nit][impl] connectors/floodlight/connector.js:1,12-16,133 — stale file-header docstring frames the file as "spec 046-01" and says the ;-delimited activity form "is 046-02 (out of scope here)", but mapToDcActivity is now in this file. handle()'s JSDoc (line 209) is correct; only the header drifted. [ADDRESSING: fix header]
- [nit][spec] slice-02 AC1 — the emitted-field list + "length-1 EgressRequest[]" contradict ADR-0020 + the shipped code (7 emitted, not 13; handle returns length-2). [ADDRESSING: align AC1 + deviation log]
- [strength][impl] core/path-matrix.js:32-35 — encodeURIComponent on key+value; fieldsFromMatrixUrl is the exact inverse; adversarial test (cat:"a;src=evil;b") proves no literal ;src=evil; reaches the wire.
- [strength][impl] core/endpoint-ceiling.js:120-128 — segment-anchored prefix admission opt-in only for ;-bearing declared paths, matched at a ; boundary (src=00000001 held); query-delimited regression test confirms exact match preserved.
- [strength][impl] rig/parity/floodlight-activity-replay.js:71-74 — auiddc sourced from the fixture's _gcl_au cookie, never back-fed from the beacon; a test guards the tautological false-green.
- [strength][impl] descriptors/floodlight-activity.js + test:144-154 — gap-owned vs normalised split honest + machine-checked (delete src → dropped → fail); every expected-dropped field has a named owner.

RECONCILIATION NOTES:
- 7 reproduced / 7 gap-owned (named owners) / 5 normalised-out; all 19 fixture fields accounted for; oracle reports normalised-out, not silent omission. dma classified normalised-out (regulatory/geo, no encodeDma, matches ccm) — defensible.
- The two doc/spec nits + the src-guard belong in the deviation log / are being fixed pre-REVIEWED.

Reviewer: general-purpose subagent, craft pass (pr-review baseline + nodejs/test-quality refs), read-only, no implementation context; ran the full suite + parity CLI + eslint.
