---
slice: 041-01 — gtag connector boots + egresses (Connector wrapper + chamber + createAirlock branch + minimal boot)
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-10T01:29:02Z
prompt_source: review.py pr-review --richer-skill none ... 'connector boots' <deliverables>
substrate: shown
applied_skill: none
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass (richer-skill: none — jig baseline)

## Reasoning

The chamber worker + confinement are faithful byte-for-byte mirrors of the pixel precedent (intentional sibling
duplication, already disclosed as deferred to a future shared `confine-chamber.js`, 026-02); the `workerMappedGetEgress`
predicate is the correct factoring (one named class used at both the unload-wiring and pushCritical gates, correct
diagnose message for the two-connector set); the manifest is well-formed and states gtag's OWN analytics-only rationale
per AC1's frame note; `bootGa4Gtag` faithfully mirrors `bootGa4Core`'s ctx sourcing and `bootPixelConnector`'s clean
omission of pushCritical/capture-wiring, with the `/g/collect` ceiling correct. Tests are non-vacuous and pin observable
behavior (GET params, verbatim init shape, no-fetch-on-pagehide, held-beacon flush). Only a stale doc comment — a nit,
not a correctness/security/test blocker.

## Specific issues (folded)

- [nit] `adapters/eds/index.js:523-531` — stale "KNOWN RESIDUAL" comment describing the mis-map as still-open when the
  `workerMappedGetEgress` fix closed it (drops, not mis-maps). **[FOLDED: rewritten to state the mis-map is CLOSED for
  ga4-gtag (both gates), the event is DROPPED at teardown, and the residual is the deferred GET-shaped critical
  dispatcher — same as pixel.]**
- [nit] `core/airlock.js:181` — stale `connector !== "pixel"` parenthetical. **[FOLDED: updated to `!workerMappedGetEgress`
  (041-01 generalized it).]**
- [strength] `core/airlock.js:505` — the single `workerMappedGetEgress` predicate (used at both gates) is the right
  factoring; the two gates cannot drift.
- [strength] `connectors/ga4/gtag.js` manifest states gtag's own analytics-only rationale.
- [strength] `test/eds-ga4-gtag.test.js` — the ctx-override test omits the document stub so a stray `document.cookie`
  access throws (a real negative assertion); the setConsent flush test pins held-GET-beacon flush with method preserved.

## Reconciliation notes

- Disclosed deferral (log-only): unload-critical GET dispatch for gtag is out of scope — a ring-resident event at
  teardown is DROPPED (no GET-shaped critical dispatcher yet), the tracked follow-up; record as "dropped at teardown,"
  NOT the MP-mis-map the (now-fixed) stale comment described.
- Boot-snapshot ctx residual: `bootGa4Gtag` exposes `setConsent` (releases held beacons at the main-thread seal) but
  does not reshape the worker connector's frozen ctx (gcs/gcd carriage is 041-02 anyway) — the already-accepted
  boot-snapshot residual, not a fresh bet.
- Intentional divergence: `core/confine-ga4-gtag-chamber.js` + `core/ga4-gtag-chamber.worker.js` are near-verbatim pixel
  duplicates; the pixel confine comment already flags folding all `confine-*-chamber.js` into one shared module as a
  later (026-02) item — this third copy extends that disclosed duplication, not new divergence.
