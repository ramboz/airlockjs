---
slice: 058-02 - Pinned native attempted-request reference
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-10-16T16:35:32Z
prompt_source: review.py pr-review spec058 058-02 --richer-skill pr-review; internal bounded craft pass
substrate: shown
applied_skill: pr-review
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, access:speculative, agent-development:speculative, arch-review:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, command-development:speculative, configure:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, hook-development:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, session-report:speculative, skill-creator:speculative, skill-development:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass

REASONING:
The change stays within the fixed saved-Meta native-attempt profile, with separate process denial and exact-fulfill-or-abort interception. The inspected tripwire assertions, native revoke mutation, and headless state checks are meaningful controls rather than test-count evidence. No blocking craft defect was found; this was static, read-only review, not a test rerun or broader vendor qualification.

SPECIFIC ISSUES:
- [nit][impl] rig/native-tag-reference.mjs:711 - Provenance always says unmodified_retained_official_bytes_locally_fulfilled, including boundary-only runs that permit synthetic resources and never execute or fulfill them. Distinguish supplied resources from observed fulfillment, or set this label only after native fulfillment. The explicit inconclusive result keeps this nonblocking.
- [strength][impl] rig/native-tag-reference.test.mjs:357 - Removing the actual native revoke call must produce a measurement, load configuration, and invalidate dependency closure. This makes the consent-negative control falsifiable rather than relying on an empty request set.

RECONCILIATION NOTES:
Record the provenance-label nit and retain the falsifiable consent control as a strength. No broader scope deviation observed; Google, other consent transitions, dispatch, matching, attribution, and full vendor support remain outside this qualification.

Author follow-up: witnessed a failing exact-label assertion, then distinguished
boundary-only supplied-but-unexecuted resources in provenance. No native script
or configuration bytes or event behavior changed for this correction.
