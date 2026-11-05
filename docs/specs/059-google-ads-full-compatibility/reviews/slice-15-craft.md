---
slice: 059-15 - Exact native policy and one-shot stock capture
pass: craft
verdict: pass
reviewer: jig:reviewer (explicit gpt-6.1-sol)
reviewed_at: 2026-11-05T23:55:40Z
prompt_source: review.py pr-review spec 059 059-15; five-file Google stop correction based on b972ca7e --richer-skill pr-review; before test-only hardening
substrate: shown
applied_skill: pr-review
shown_candidates: [independent-review:high-confidence, pr-review:high-confidence, scout-pr-review:high-confidence, access:speculative, adr-workflow:speculative, agent-development:speculative, analyze:speculative, arch-review:speculative, bug-fix:speculative, build-dashboard:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, clarify:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, code-health:speculative, command-development:speculative, configure:speculative, contracts:speculative, cowork-plugin-customizer:speculative, create-cowork-plugin:speculative, create-viz:speculative, data-context-extractor:speculative, data-visualization:speculative, example-command:speculative, example-skill:speculative, explain:speculative, explore-data:speculative, frontend-design:speculative, hook-development:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, memory-sync:speculative, migrate:speculative, orient:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, reframe:speculative, scaffold-init:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, security-review:speculative, session-report:speculative, skill-creator:speculative, skill-development:speculative, slice-land:speculative, spec-workflow:speculative, sql-queries:speculative, statistical-analysis:speculative, tdd-loop:speculative, validate-data:speculative, vision-elicitation:speculative, write-query:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass

REASONING:
Architecture, reliability/security, QA and documentation lenses found no blocker in the bounded source checkpoint. The Google stop barrier preserves the raw relay's error/incomplete handling, and receiver-backed controls plus retained red/green logs support the local claims. This was read-only review without execution; the available tools did not expose the Git diff against b972ca7e, so the exact baseline comparison remains unverified. This verdict does not clear full-slice compliance, native admission, current-browser stop or safe listener/port reuse.

SPECIFIC ISSUES:
- [nit][impl] rig/inspected-google-transport.test.mjs:201-203,233-235 - The pause waits are unbounded and do not observe opening failure. If lsof/TLS fails before the pause, open() rejects while the test waits indefinitely; a Vitest timeout does not unwind that body's finally. Race the pause against opening failure and ensure teardown remains reachable.
- [nit][impl] rig/inspected-google-transport.test.mjs:55-59,310-331 - Active-stop controls use immediately completed responses. A held partial H1/H2 response would directly guard stop-to-relay error propagation and verify that an interrupted original never becomes complete. Existing decoder tests cover those semantics separately.
- [strength][impl] rig/inspected-transport.mjs:283-309,377,391-400 - Google admission closes synchronously before socket destruction or awaits. Pending TLS closure now settles, the post-setup recheck prevents tunnel construction, and admission-only stop retains listeners without adding a destination or response substitute.
- [strength][impl] rig/inspected-google-transport.test.mjs:199-254,310-332 - Matched positives reach actual receivers before enforcement, and active controls require independently observed upstream closure. These checks are non-vacuous when socket cancellation is removed.
- [strength][impl] docs/specs/059-google-ads-full-compatibility/plan.md:84-105 - Claims distinguish witnessed failures, passing local controls, authentication-identity confounding, skipped browser coverage and invalidated source cohorts.

RECONCILIATION NOTES:
Retain the two test-hardening nits as non-blocking follow-ups. Preserve the disclosed authentication-control limitation, temporary fixture-permission adjustment and unrun full browser-witness coverage. No additional substantive deviation was identified within the inspected source; helper cleanup remains unknown/manual and native/current-browser gates remain open.

## Coordinator follow-up after this review

This pass covers only the bounded Google stop source packet. Earlier Meta
review scopes remain historical in Git; this pass does not extend them.
The baseline-diff gap and unrun witness fixtures above describe review-time
evidence, not the final checkpoint.

Pinned Terra addressed both nits without changing the runtime patch:
pause waits now race actual opening failure and a bounded timeout, with
failure-path teardown controls. Matched held partial H1/H2 responses test
admission stop and direct close. Interrupted originals remain inconclusive.
The post-stop H2 catch accepts only the expected closed-session error.

The final pinned Sol architecture reviewer examined the exact baseline patch
and hardened tests. The coordinator's final twelve-file browser-free run
passed 395 tests, with 15 opt-in skips, including successful execution of
all seven Node-mocked browser-witness tests. Scoped ESLint passed. This is
the recorded disposition of the nits, not a claim that the craft reviewer
reran tests or saw the later revision.

The peer-authentication caveat still applies. Current-browser confinement,
independent stop and safe guard/listener release remain unqualified.
Full-slice compliance stays `needs-changes`.
