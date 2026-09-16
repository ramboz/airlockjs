---
slice: 049-02 — direct-beacon-transport suppression (egress-parity completeness)
pass: arch
verdict: pass
reviewer: arch-review
reviewed_at: 2026-09-15T20:59:49Z
prompt_source: review.py arch-review --richer-skill arch-review
substrate: shown
applied_skill: arch-review
shown_candidates: [arch-review:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-pr-review:speculative, scout-scrum-master:speculative, servo:agent-loop:speculative, servo:autonomy-readiness:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:quality-gate:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

Arch pass (arch-review richer skill, opus; `arch_review: true` — the transport-of-emission carve-out contract).
**VERDICT: pass**, no blockers.

The load-bearing decision (exempt `fetch`+`{keepalive:true}` unconditionally, suppress every other transport at the
same URL) is grounded in a verified invariant — core/egress.js's `fetchInit` always sets `keepalive:true` (egress.js:
52-53), so airlock's own arm never false-drops — and the rig proves it against airlock's REAL egress shape (`fetchInit`
imported raw, not a hand-mirror). Module boundaries hold: a zero-import, DOM-coupled leaf in `adapters/eds/`, with
machine-enforced vendor-neutrality; architecture.md already documents the home and the 049-02 extension. The spec-028
diagnostic stays flat (collector.js:53-60 flat-record invariant); the new `transport` field is additive and primitive.
Structural limits are honestly logged with resolution triggers rather than hidden.

Three accepted trade-offs LOGGED (refinement-todo), not fixed — none gating:
1. Page-global keepalive exemption — exempts EVERY `fetch({keepalive:true})` on the page, so the discriminator is
   really "keepalive-fetch is unsuppressable," coarser than "airlock's egress is exempt." Fails safe.
2. Two-loaded-copies install/uninstall interaction (silent config drop + cross-copy native restore) — latent, avoided
   by the single-import dist-sibling model.
3. Micro-perf — the `fetch` wrapper resolves the input URL before the keepalive short-circuit.

`arch_review` was flipped false→true by the frame-critique (a pure URL matcher cannot reconcile suppressing the
container's `/tr` with emitting airlock's byte-identical `/tr`); recorded against ADR-0030 in the deviation log — the
airlock-egress carve-out is now realized as (URL/path/query allow-set) ∪ (fetch+keepalive signature exemption).
