---
slice: 044-01 — core AW page-load beacon off-thread (Consent-Mode + auid, parity-confirmed)
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-09-12T02:34:40Z
prompt_source: review.py pr-review --richer-skill pr-review
substrate: shown
applied_skill: pr-review
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass

REASONING:
Craft is clean and the implementation matches the slice's stated scope: a new connectors/google-ads/ ccm-collect GET beacon, granted-path only, reusing the 039 gcs/gcd encoders via a verbatim behavior-preserving extraction, with host-sourced read-only-never-mint auid and click-id forwarding, parity-confirmed by the 038 oracle on a redacted all-zeros fixture. The extraction was verified against git diff (encoders/appendParam moved out unchanged), every importer repoints, the pixel connector is untouched, and the GA4 golden-hash frozen surface does not cover gtag.js so it stays green. Only minor nits remain; all belong in the reconciliation/deviation log, none block REVIEWED.

SPECIFIC ISSUES:
- [strength][impl] connectors/consent-mode.js — gcs/gcd + appendParam extraction is verbatim (bodies moved unchanged; resolveConsent import correctly handled). AC2 "reuse, not re-author" is real, machine-guarded by test/google-ads.test.js (both connectors import from the one shared home).
- [strength][impl] connectors/google-ads/cookies.js — the _gcl_au read-only / omit-when-absent / never-mint discipline is correctly divergent from sourceGa4Ctx's mint-when-absent _ga path, and the read is ad_storage-gated exactly like sourceGa4Ctx. AC3 met, well-tested (present/absent/gated edges).
- [strength][impl] rig/parity/google-ads-replay.js + test/parity-google-ads.test.js — the parity test is non-vacuous: auid is sourced from the fixture's _gcl_au cookie (carrying the 1.1. prefix the beacon field lacks), so a broken parseGclAuId diverges; en-dropped -> fail and en=purchase -> CLI exit 1 prove the oracle bites.
- [strength][impl] test/parity-google-ads.test.js — security-MUST verified on the committed fixture directly (all-zeros regex scan over the whole file, covering both beacon fields and the _gcl_au cookie).
- [strength][impl] connectors/google-ads/connector.js — npa derived from the two data-use purposes independently of the ad_storage egress gate, so a mixed vector yields correct gcs/gcd/npa=1 carriage.
- [nit][impl] test/google-ads.test.js — the pending-vector test asserts gcs/gcd omitted but not that npa is still emitted; encodeNpa's pending/mixed path has unit coverage but no integration assertion.
- [nit][impl] rig/parity/redact-google-ads.js — redactAwBeacon scrubs beacon fields only; the paired _gcl_au cookie in the fixture must be redacted separately by a future fixture-regenerator. The committed-fixture regex is the safety net (process/doc gap, not a leak).
- [nit][impl] connectors/google-ads/cookies.js — readClickIds treats an empty-value param (?gclid=) as absent, but only no-param and empty-URL cases are unit-tested; the empty-value edge is untested.

RECONCILIATION NOTES:
- Fold nits N1-N3 (npa pending assertion, redactor cookie-scrub doc, readClickIds empty-value edge) into the deviation log as follow-ups; none gate REVIEWED.
- DoD close-out items open (expected pre-reconciliation): docs/architecture.md must name connectors/google-ads/ + connectors/consent-mode.js; register the airlock/google-ads namespace.

Reviewer substrate: general-purpose subagent applying the installed pr-review skill rubric; read-only; no implementation context.
