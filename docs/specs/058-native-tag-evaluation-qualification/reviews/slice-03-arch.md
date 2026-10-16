---
slice: 058-03 - Value-preserving comparison controls
pass: arch
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-10-16T19:12:08Z
prompt_source: review.py arch-review spec058 058-03 --richer-skill arch-review initial missing cleanup evidence
substrate: shown
applied_skill: arch-review
shown_candidates: [arch-review:high-confidence, access:speculative, agent-development:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, command-development:speculative, configure:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, hook-development:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-pr-review:speculative, scout-scrum-master:speculative, session-report:speculative, skill-creator:speculative, skill-development:speculative, writing-hookify-rules:speculative]
---

VERDICT: needs-changes

REASONING:
The rig-local consumer preserves runtime/frozen boundaries and keeps local
source layers from becoming whole-wire evidence. One validation omission
still admits incomplete native cleanup evidence.

SPECIFIC ISSUES:
- [blocker][impl] A nonempty cleanup object with only existing true values
  can omit process exit, server closure and listener detachment. Require all
  four native cleanup booleans explicitly, and test omissions in both profiles.
- [strength][impl] Local synthetic source and requested layer must consistently
  remain local_control; relabeling the request cannot promote vendor evidence.

RECONCILIATION NOTES:
Preserve exact-only native policy, trusted owner completion attestations,
fixed exclusions and synthetic response/edge scope. No new product architecture
decision or capability is warranted; repair the missing evidence rather than
waiving it.
