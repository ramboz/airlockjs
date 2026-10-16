---
slice: 058-01 - Local recorder and no-send qualification
pass: arch
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-10-16T01:46:08Z
prompt_source: review.py arch-review spec058 058-01 --richer-skill arch-review; initial bounded architecture pass
substrate: shown
applied_skill: arch-review
shown_candidates: [arch-review:high-confidence, access:speculative, agent-development:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, command-development:speculative, configure:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, hook-development:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-pr-review:speculative, scout-scrum-master:speculative, session-report:speculative, skill-creator:speculative, skill-development:speculative, writing-hookify-rules:speculative]
---

VERDICT: needs-changes

REASONING:
The fixed local qualifier keeps observation, enforcement, sink witnessing and grading distinct, without implying vendor or production protection. Matched controls, per-leg branch checks, owned-browser cleanup and dedicated test routing are architecturally coherent. One resource-acquisition step remains outside the absolute deadline, weakening the bounded-command guarantee. This was a static, read-only review; validation was not rerun.

SPECIFIC ISSUES:
- [blocker][impl] rig/native-tag-qualification.mjs:579 — Output-directory creation is awaited before the elapsed clock starts at line 589 or the watchdog exists at line 638. A slow or stalled filesystem can therefore exceed the advertised command bound without timeout classification, and that time disappears from `run_elapsed_ms`. Establish the shared deadline before directory acquisition, cover this await, prevent execution after expiry, and add a narrowly scoped stalled-acquisition control.
- [strength][impl] rig/native-tag-qualification.mjs:505-562 — Grading uses independent receiver witnesses, matched transport-specific legs and redirect/fan-out relationships in every leg. Attempt callbacks alone cannot establish successful delivery or enforcement.
- [strength][impl] rig/native-tag-qualification.mjs:423-453 — Cutoff stops new admission while retaining accepted-request response/terminal listeners through bounded settlement. Late reads are quarantined from the completed snapshot.
- [strength][impl] vitest.config.js:35; vitest.native-qualification.config.js:5 — The default exclusion and dedicated inclusion target only the new Chrome qualification test. The guide explicitly distinguishes owned BrowserServer RPC from unqualified page WebSockets at rig/native-tag-qualification.md:16-19.

RECONCILIATION NOTES:
Record the initial directory-acquisition deadline gap until corrected. Preserve the documented Chrome cohort separation and pre-publication report/command-completion distinction. No broader vendor, chamber, frozen-core or oracle-policy claim was observed in the reviewed deliverables.
