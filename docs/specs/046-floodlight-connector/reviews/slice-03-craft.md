---
slice: 046-03 — DC opts into hold-until-granted, both forms (ad_storage-denied parity)
pass: craft
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-13T18:59:08Z
prompt_source: review.py pr-review ... 046-03 --richer-skill pr-review
substrate: shown
applied_skill: pr-review
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass (craft pass — no blockers; two log-only nits)

REASONING:
The three load-bearing craft concerns hold. createFloodlightRemap's whole-rebuild try/catch is a genuine superset of the spec's "non-throwing per form" guard: the seal invokes remap once per held beacon (airlock.js:762-766), so one invocation = one form, and wrapping the whole rebuild also contains a shared ctx-sourcing throw (readCookieString/sourceGoogleAdsCtx) to a single-beacon drop instead of aborting the flush loop + taking out the already-spliced sibling. The seal tests are non-vacuous (poison-cat throw is real via appendMatrixParam's String(value); each removal traced to a failing assertion); re-sourced-not-stale assertions are rigorous. 13/13 pass; eslint clean. core/airlock.js/consent.js + g-ads untouched.

SPECIFIC ISSUES:
- [strength][impl] connector.js:331-345 — whole-rebuild try/catch is right (per-invocation catch IS per-form since the seal calls remap once per beacon; also protects the shared readCookieString/sourceGoogleAdsCtx step). Strict superset of the spec's robustness note, no downside.
- [strength][impl] test/floodlight-seal.test.js:293-367 — re-sourced-not-stale proof airtight (boot ctx has no auid; flush-time cookie is the sole EXPECTED_AUID source; asserts gcs G100→G111 / npa 1→0 AND stale values gone). A verbatim re-send would fail these.
- [strength][impl] test:303,322-324 — remap spy checks the 3rd arg (remapKey) is threaded per beacon (calledKeys ["activity","ccm"]) + one-of-each-shape fetch assertions.
- [nit][impl] connector.js:340-344 — catch {} discards the caught error; failure surfaces only as "produced no beacon" (terminal dropped, tested), no cause. Mitigated by connector purity (no diagnose seam). Tradeoff, not a defect — log-only.
- [nit][impl] test:396-461 — robustness coverage tests only the per-form failure (poisoned cat); the shared-step failure (readCookieString throw → both drop) rides the same try but isn't exercised directly. Low value to add.

RECONCILIATION NOTES:
- Both nits log-only, non-blocking. (1) error-detail loss in catch is a purity-vs-observability tradeoff (already made elsewhere in the connector; if a diagnose seam is threaded into remap connectors, capture the cause). (2) intentional divergence from createGoogleAdsRemap (no try/catch, 1:1 blast-radius-1) is documented in the fn doc + the slice Robustness section; reusing sourceGoogleAdsCtx per §A4 rather than forking a DC reader is a clean reuse choice.

Reviewer: general-purpose subagent, craft pass (pr-review baseline + error-handling/test-quality refs), read-only, no implementation context; ran the seal tests + eslint.
