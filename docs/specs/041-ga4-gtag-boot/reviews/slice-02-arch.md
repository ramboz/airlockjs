---
slice: 041-02 — session-state + Consent-Mode carriage on the live path
pass: arch
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-10T01:54:42Z
prompt_source: review.py arch ... 'session-state' adapters/eds/index.js test/eds-ga4-gtag.test.js
substrate: shown
applied_skill: none
shown_candidates: [arch-review:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-pr-review:speculative, scout-scrum-master:speculative, servo:agent-loop:speculative, servo:autonomy-readiness:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:quality-gate:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass

## Reasoning

The slice applies 039-03's already-sanctioned boundary (cookies are a host/orchestrator concern, the same place
`sourceGa4Ctx`'s read lives) rather than introducing a new one: the `_ga_<stream>` write is main-thread, placed BEFORE
`createAirlock` (`index.js:640` vs `:668`), and the ADR-0007 gate lives in exactly one place — `writeGa4SessionState`'s
own `null` return on `!storageGranted` (`cookies.js:320-324`, before any read/write), which the host honors via
`if (sessionWrite)` (`:645`) rather than re-implementing. The `sessionId` override (`:646,653`) is the architecturally
correct reconciliation of the coupled session transition (the write is authoritative; the pre-write `sourceGa4Ctx` sid a
stale snapshot), unconditional on the granted path. The raw-vector consent fold (`:666`) is a genuinely distinct
mechanism from the MP `shapeMpConsent` path — no conflation (gtag's encodeGcs/encodeGcd read ad_storage/analytics_storage
directly, fields the MP shape never carries). Stays entirely within the connector/host boundary: no connector edit, no
worker capability wiring (init stays no-op), cookie write purely host-side; composes cleanly with the
verbatim-`connectorConfig` ga4-gtag branch; no conflict with the MP path or coalescing.

## Specific issues

- [strength] `index.js:645` — the ADR-0007 analytics gate is a single source of truth (host passes `storageGranted`,
  honors the null return; the denied path provably performs no cookie read/write).
- [strength] `index.js:646-653` — the unconditional sid override on the granted path resolves the sid/sct coupled-
  transition hazard; the test exercises all three writer branches (first-visit/new-session/continuation).
- [nit] `index.js:666` — unlike `bootGa4Core`'s conditional fold (`:420-421`, ctx byte-identical when no consent), this
  unconditionally spreads `consent`/`consentDefault` even when both are undefined → the worker's structured-clone ctx
  carries two extra undefined-valued keys vs the 041-01 shape. Inert (beacon identical; undefined = no signal),
  documented — a small divergence from the precedent's back-compat discipline.
- [nit] `index.js:623,642` — `createCookieCapability(document)` instantiated twice over the same document; a hoisted
  const reads cleaner.

## Reconciliation notes

- No new ADR (executes 039-03's decision, confirmed no new host/worker boundary).
- Record the unconditional-vs-conditional consent-fold divergence from `bootGa4Core` in the deviation log (deliberate,
  net-neutral; a future consolidation could align the two GA4 boot paths' ctx-fold conventions).
- Cleanup candidate: hoist the duplicated `createCookieCapability(document)`.
