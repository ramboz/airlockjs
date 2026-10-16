---
slice: 058-02 - Pinned native attempted-request reference
pass: arch
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-10-16T16:46:39Z
prompt_source: review.py arch-review spec058 058-02 --richer-skill arch-review; fresh resolver socket-denial and same-policy control re-review
substrate: shown
applied_skill: arch-review
shown_candidates: [arch-review:high-confidence, access:speculative, agent-development:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, command-development:speculative, configure:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, hook-development:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-pr-review:speculative, scout-scrum-master:speculative, session-report:speculative, skill-creator:speculative, skill-development:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass

REASONING:
The direct socket-path denials and matched same-policy resolver controls close the recorded pre-execution blocker. Both aliases require successful ordinary connections and EPERM/EACCES under confinement before SDK execution; the bounded helper sends no query payload and uses the existing deadline/abort mechanism. No tightly coupled serious flaw remains within this review's scope. Approval is limited to the pinned local native-attempt architecture; this was a static review, without rerunning tests or inspecting private captures.

SPECIFIC ISSUES:
- [strength][impl] rig/offline-reference-network.sb:3-8; rig/offline-reference-chrome:3 - Direct literal-path rules deny both resolver aliases while retaining necessary Unix IPC and the named Mach denial; Chrome uses the shared policy.
- [strength][impl] rig/native-tag-reference.mjs:292-331,763,787-794 - Resolver controls use that same policy, require both matched positive/denied pairs, retain policy provenance, and fail inconclusive before native cases.
- [strength][impl] rig/native-tag-reference.test.mjs:278-282; rig/native-tag-reference.md:122-125 - The test requires two positive connections, two confined denials and a retained policy hash. Documentation confines the resolver claim to the pinned macOS profile.

RECONCILIATION NOTES:
No further architecture correction is required for this blocker. Record the corrected direct-path policy and distinct resolver prerequisite; preserve the ineffective nested-filter experiment as failed evidence. Keep vendor responses, dispatch/receipt, chamber compatibility, matching, attribution, other consent states and Google qualification unproved; do not generalize this approval into arbitrary helper/OS/SDK privacy coverage.
