---
slice: 041-02 — session-state + Consent-Mode carriage on the live path
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-10T01:54:42Z
prompt_source: review.py craft ... 'session-state' adapters/eds/index.js test/eds-ga4-gtag.test.js
substrate: shown
applied_skill: none
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass (richer-skill: none — jig baseline)

## Reasoning

The 041-02 session-state + Consent-Mode wiring is clean and faithful to `bootGa4Core`'s precedent: the ordering
(sourceGa4Ctx → writeGa4SessionState override → consent fold → createAirlock) places both mutations before
`createAirlock` per AC1/AC2. The sid-override destructuring `const { sessionId, ...sessionState } = sessionWrite` is
correct — `sessionId` lands on `ctx.sessionId`, only `sct/seg/_fv/_ss/_nsi` reach `ctx.sessionState` (exactly what
`appendSessionState` reads; sessionId is never leaked into it). The unconditional `consent`/`consentDefault` keys are
benign (encodeGcs/encodeGcd resolve undefined to pending/denied-all; `toEqual` ignores undefined props). The
new-session-at-boot test is a real inverse (asserts `sid === freshSid`, `!== oldSid` (the GS2-parsed pre-write value),
`sct` incremented from the same transition), failing on revert of the override.

## Specific issues (both folded)

- [nit] `adapters/eds/index.js:623,642` — `createCookieCapability(document)` constructed twice. **[FOLDED: hoisted to a
  single `const cookies = providedCtx ? null : createCookieCapability(document)` reused by both ops; `null` under the
  providedCtx escape hatch so document is touched zero times.]**
- [nit] `adapters/eds/index.js:663-665` — inline comment loosely said an absent `consentDefault` omits `gcd`, but
  `isDeniedAllDefault(undefined)` is true → with a resolved `consent` vector `gcd` IS emitted as the denied-all default
  (the first-visit test asserts `gcd === "13r3r3q3q5l1"` with no `consentDefault` opt). **[FOLDED: comment corrected —
  absent `consent` omits both; absent `consentDefault` still emits `gcd`; only `gcs` depends purely on the vector.]**
- [strength] the new-session test is a genuine sid/sct-consistency inverse (oldSid = the GS2 value sourceGa4Ctx reads,
  distinct from nowSeconds).
- [strength] every 041-02 assertion drives the REAL `createGa4GtagConnector` against the posted init (a `beaconParams`
  helper), not hand-built URLs — same discipline as 041-01 / 039-03.

## Reconciliation notes

- No spec deviations; implementation matches 041-02's scope (initial-boot carriage; seal untouched; providedCtx /
  absent-streamCookieName back-compat skips).
- The unconditional consent-fold divergence from `bootGa4Core`'s conditional fold is inert + deliberate (arch note) —
  recorded in the deviation log; a future consolidation could align the two GA4 boot paths.
