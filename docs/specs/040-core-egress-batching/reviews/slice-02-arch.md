---
slice: 040-02 — core coalescing seam (post-verdict, per-cycle, protocol-pluggable)
pass: arch
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T20:12:51Z
prompt_source: review.py arch-review --richer-skill none docs/specs/040-core-egress-batching/spec.md 'core coalescing seam' core/airlock.js test/egress-coalescing.test.js
substrate: shown
applied_skill: none
shown_candidates: [arch-review:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-pr-review:speculative, scout-scrum-master:speculative, servo:agent-loop:speculative, servo:autonomy-readiness:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:quality-gate:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass

## Reasoning

The seam is placed at the correct governance boundary: coalescing runs strictly after the consent seal
(`egressVerdict`) and the endpoint ceiling in a phase-1 survivor-collection loop, and before `fetch` in phase 2, so
denied/held/ceiling-blocked inputs never reach the hook (governance preserved by construction on inputs). Outputs
re-enter the same pure `checkEndpointCeiling` before dispatch, closing the ADR-0021:88 output-ceiling-bypass hazard.
The core group key is the origin+path `originPath` reduction — the same function the ceiling uses, giving the clean
invariant that each group maps to exactly one ceiling-passed endpoint — with finer query-carried splits (GA4 `tid`)
correctly delegated to the connector hook (040-03). The module boundary is right: the hook is a main-thread injected
`createAirlock` config, keeping the in-worker connector a pure mapper (AD-2), and it is correctly kept separate from
`core/coalescing-broker.js` (not imported or wired). The default no-coalesce path is a behavior-preserving restructure.

## Specific issues

- [strength][impl] core/airlock.js:340-345 — grouping key reuses `originPath`, the identical reduction
  `checkEndpointCeiling` applies, so every group is structurally single-endpoint; no separate/divergent key to keep in
  sync.
- [strength][impl] core/airlock.js:349-361 — output re-validation re-runs the *pure* `checkEndpointCeiling` per emitted
  request (defense-in-depth), so a hook emitting an off-endpoint URL is held with an `endpoint-ceiling` diagnostic,
  never egressed; test/egress-coalescing.test.js:146-181 pins this including the split good+bad-output case.
- [strength][impl] core/airlock.js:328-332 — default path (`typeof coalesce !== "function"`) is a straight
  per-survivor fetch in ready-order with no grouping/re-check, byte-identical to the pre-040-02 inline loop; the
  non-function-coalesce guard (test:227-242) makes the "treated as absent" contract explicit.
- [nit][spec] core/airlock.js:355-360 — the output check enforces "output URL is within the *declared set*," but slice
  AC1 states the invariant as "must equal the *group's* ceiling-passed endpoint." With 2+ declared endpoints these
  differ: a group-A hook could emit a request to declared endpoint B and pass. Architecturally sufficient for
  governance (B is declared and shares the cycle-uniform verdict, so no ceiling/consent bypass), but looser than the
  slice's literal wording — worth an author note on whether the tighter equality is intended.
- [nit][impl] core/airlock.js:346-347 — outputs are re-validated against the ceiling but the consent verdict is not
  re-checked on outputs. Correct today because `egressVerdict` is URL-independent and cycle-uniform (the survivor loop
  proves all inputs got "send"), so the output verdict is preserved by construction — but that reasoning is
  load-bearing and only implicit; a one-line comment would prevent a future reader from adding a per-endpoint verdict
  and breaking the assumption.

## Reconciliation notes

- Retry/failure semantics for a merged request are deliberately out of this slice (a failed coalesced `fetch` silently
  drops N events under best-effort keepalive); the seam now makes this reachable for any opt-in connector. Deferred per
  slice Assumptions / ADR-0021 open question — log it.
- The `coalesce` hook runs synchronously in `worker.onmessage` (grouping + hook execution), adding new main-thread work
  that did not exist on the prior fetch-only dispatch. `worker.onmessage` is off the interaction path so this is
  INP-safe per ADR-0021 Assumption 2, but hook-cost is now the connector's responsibility with no budget/guard — note
  for 040-03's GA4 adapter.
- Group-key precision (origin+path only; verdict cycle-uniform, credential/mode a forward-safety placeholder with no
  `EgressRequest` field today) is a documented, leaner-that-still-passes choice — no speculative key dimensions were
  added. Record as an intentional deviation from ADR-0021's fuller "endpoint+verdict+credential" key, reconciled by
  slice AC2.
