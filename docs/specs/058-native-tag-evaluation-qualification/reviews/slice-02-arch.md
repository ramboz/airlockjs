---
slice: 058-02 - Pinned native attempted-request reference
pass: arch
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-10-16T16:39:30Z
prompt_source: review.py arch-review spec058 058-02 --richer-skill arch-review; initial resolver IPC blocker
substrate: shown
applied_skill: arch-review
shown_candidates: [arch-review:high-confidence, access:speculative, agent-development:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, command-development:speculative, configure:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, hook-development:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-pr-review:speculative, scout-scrum-master:speculative, session-report:speculative, skill-creator:speculative, skill-development:speculative, writing-hookify-rules:speculative]
---

VERDICT: needs-changes

REASONING:
The fixed-profile runner preserves product/chamber boundaries and correctly separates native attempts, local fulfillment, generated fixtures and vendor dispatch evidence. Exact resource matching, linked consent/value controls and live-set draining are sound architectural choices. One pre-execution safety condition remains unresolved: the Unix-socket exception leaves resolver IPC unqualified, and literal-IP HTTP controls cannot establish DNS denial. This was a static review; no tests were rerun or private captures inspected.

SPECIFIC ISSUES:
- [blocker][impl] rig/offline-reference-chrome:2 - The blanket Unix-socket allowance permits resolver IPC such as /var/run/mDNSResponder; denying the named Mach lookup does not deny that socket route. The literal-loopback process control cannot establish DNS denial, yet native execution proceeds. Close or specifically qualify the resolver channel while preserving required Chrome IPC, and remain inconclusive until that condition is established. The guide's non-HTTP/speculative-network protection claim currently exceeds this evidence.

RECONCILIATION NOTES:
No additional scope deviation identified. Preserve the boundary-only not-executed-or-fulfilled provenance correction and fixed native-attempt evidence limits. Do not log HTTP-tripwire success as DNS/non-HTTP qualification; Google, other consent states, dispatch/receipt and chamber compatibility remain unqualified.
