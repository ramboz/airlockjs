---
slice: 042-01 — GET-critical dispatcher + ga4-gtag unload flush
pass: arch
verdict: pass
reviewer: general-purpose (arch-review lens, Opus)
reviewed_at: 2026-09-10T19:07:34Z
prompt_source: review.py arch-review --richer-skill arch-review
substrate: shown
applied_skill: arch-review
shown_candidates: [arch-review:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-pr-review:speculative, scout-scrum-master:speculative, servo:agent-loop:speculative, servo:autonomy-readiness:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:quality-gate:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass

REASONING:
The three arch-item concerns hold. The `requestMapper` path is a clean additive DI: when
present it fully bypasses the legacy per-tracker POST path, which stays byte-unchanged and
regression-pinned. The ceiling-bypass-on-unload stance is preserved and not newly widened (the
GET URL comes from the host-constructed `handle`, same trust level as the existing mapToMp/
mapToRum on this path). The one real weakness is documentation, not design.

SPECIFIC ISSUES:
- [strength][impl] fetchInit move to egress.js is acyclic + single definition; all three
  dispatch paths share one GET/POST init shape (can't drift).
- [strength][impl] handle is a pure closure (no `this`); passed directly as requestMapper,
  constructed once (mirrors helix-rum).
- [strength][impl] AC5 parity test compares against a fresh independent routeBatch (worker
  path), not a self-comparison.
- [strength][impl] governParams + live consent verdict still run ahead of the GET mapper; gate
  narrowed to pixel-only, clean 042-02 deferral.
- [nit][spec] docs/architecture.md:18 AND :61 are stale — line 18 still says ga4-gtag shares
  pixel's dropped-ring-tail posture (false now); line 61's OQ16 "reusing mapToMp directly" is
  connector-stale. The slice's reconciliation sweep names only line 61 and MISSES line 18 →
  reconciliation as scoped would leave line 18 wrong. FIX BOTH at reconciliation.
- [nit][spec] core/egress.js requestMapper path is GET/POST-aware but skips the keepalive
  budget; correct for every current caller (GET-only), justified by A2. Open question: assert
  GET-only or document a POST-via-requestMapper as out-of-scope (avoid prophylactic expansion).
- [nit][impl] the connector is reconstructed twice (main-thread live ref vs worker structured-
  clone); parity holds only while ctx is a frozen boot snapshot (AC5 residual). Open question:
  when 017-01 ctx-resend lands, what beyond prose catches a main/worker consent divergence?

RECONCILIATION NOTES:
- architecture.md edit must cover BOTH line 18 and line 61 (generalize :61 from "mapToMp
  directly" to "the connector's own main-thread mapper/requestMapper"; correct :18 to scope the
  dropped-ring-tail posture to pixel only). The sweep currently names just line 61.
- Both open questions are non-blocking, tracked in the deviation log (AC5 residual already
  records the 017-01 one; the POST-without-budget one is new).
- Pre-existing (NOT introduced here): the unload path has no per-event try/catch like
  routeBatch — a throwing handle would abort the unloadFlush tail loop. This is the existing
  POST path's behavior (OQ16 by design); gtag's handle doesn't throw, so inert for this
  consumer. Noting so it isn't mistaken as a regression.
