---
slice: 041-01 — gtag connector boots + egresses (Connector wrapper + chamber + createAirlock branch + minimal boot)
pass: arch
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-10T01:29:02Z
prompt_source: review.py arch-review --richer-skill none ... 'connector boots' <deliverables>
substrate: shown
applied_skill: none
shown_candidates: [arch-review:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-pr-review:speculative, scout-scrum-master:speculative, servo:agent-loop:speculative, servo:autonomy-readiness:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:quality-gate:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass

## Reasoning

The architecture is sound and faithfully applies the established connector-hosting pattern. The new gtag chamber is
correctly egress-confined (`withholdFetch: true` in a first-import side-effect module, mirroring pixel, regression-pinned
in `test/egress-confinement.test.js`); the connector-selection branch uses a static-literal worker URL and posts
`connectorConfig` verbatim, consistent with the pixel/dom/helix-rum precedent; the `workerMappedGetEgress` generalization
is a lean, correctly-scoped boolean over exactly its two current callers (no premature abstraction), and its "drop the
ring tail at teardown, defer GET-critical-flush" tradeoff matches pixel exactly. The manifest's `analytics_storage`-only
egress purpose with an explicit own-rationale comment is correct per ADR-0007 (gcs/gcd are consent-state carriage, not a
second egress purpose); the connector stays a pure mapper closing over a boot-snapshot ctx (the tracked 017-01 residual,
lossless to re-inject); nothing duplicates or conflicts with coalescing-broker.js or the MP path. The only defects are
documentation drift, not architecture.

## Specific issues (doc-drift, fold before REVIEWED)

- [nit] `adapters/eds/index.js:523-531` — the `bootGa4Gtag` "KNOWN RESIDUAL" paragraph contradicts the shipped code: it
  claims the unload gate is `connector !== "pixel"` only and a buffered gtag event at `pagehide` "would still route
  through the MP-mapper mis-map." But `airlock.js:505` generalized the gate to `workerMappedGetEgress`, so ga4-gtag does
  NOT wire the unload listeners — the buffered event is DROPPED (unload-loss), NOT mis-mapped. It describes the
  pre-generalization design; correct it to match `airlock.js:508-510`.
- [nit] `core/airlock.js:181` — stale parenthetical still says "The unload WIRING gate (`connector !== "pixel"`, below)";
  the gate is now `!workerMappedGetEgress`. Substance holds (helix-rum still wires); the literal reference is imprecise.
- [strength] `connectors/ga4/gtag.js` manifest records gtag's OWN analytics-only rationale (gcs/gcd as consent-state
  carriage) rather than borrowing MP's wording — exactly as the frame-critique demanded.
- [strength] `core/airlock.js:495-515` — `workerMappedGetEgress` names the real invariant at BOTH mis-map entry points
  (unload wiring + pushCritical), symmetric neutralization, leaving main-thread-mapped connectors untouched.

## Reconciliation notes

- Spec AC3 referenced adding to `EXPECTED_WORKER_SPECIFIERS` at `build.mjs:118`, but that set is auto-derived from
  `WORKER_ENTRIES` (`build.mjs:121`) — adding to `WORKER_ENTRIES` alone is sufficient and correct. A spec-frame
  inaccuracy, not an implementation defect; note in the deviation log.
- `egressPurposes` uses the shared `GA4_EGRESS_PURPOSES` const (`["analytics_storage"]`) rather than the AC's literal —
  semantically identical, correct reuse; note in the deviation log.
