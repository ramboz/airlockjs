---
slice: 026-04 — Meta advanced matching (worker-hashed, eager, unload-cached)
pass: arch
verdict: pass
reviewer: general-purpose (arch-review lens, Opus)
reviewed_at: 2026-09-11T15:22:21Z
prompt_source: review.py arch-review --richer-skill arch-review
substrate: shown
applied_skill: arch-review
shown_candidates: [arch-review:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-pr-review:speculative, scout-scrum-master:speculative, servo:agent-loop:speculative, servo:autonomy-readiness:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:quality-gate:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass

REASONING:
The change extends the worker→main protocol with a single new `identity` message, adds a hash-only
main-side cache, and merges ud[...] into both the steady-state and the spec-042 sync unload beacon,
matching ADR-0022 Option C. The raw-identity feed that bypasses governParams holds as a safe
boundary: identity is stripped before `handle` on both the worker AND the main-thread unload
connector; both the worker map and the main cache are hash-only by construction; the consent seal
covers both egress paths; the load-bearing guards (64-hex-only, denylist bypass with a push()
contrast, the identification-then-navigate teardown race, consent drop at teardown) are all tested.
Module boundaries preserved; the seam split is coherent.

STRENGTHS:
- Degrade-to-omit is a STRUCTURAL invariant, not a runtime check — the cache/worker-map only ever
  hold hashes and raw never crosses back, so "omit" is the only reachable miss.
- One pure crypto-free `mergeAdvancedMatching` serves both merge sites (worker steady-state, main
  sync unload) without pulling WebCrypto onto the unload critical path.
- `handle` genuinely identity-agnostic — `advancedMatching` stripped at worker init AND the
  main-thread unload connector; the stripped unload connector is real defense-in-depth.

SPECIFIC ISSUES:
- [nit][spec] mid-session identity invalidation (logout/clear) is unbuilt — setIdentity only
  adds/overwrites, a null value is skipped (no clear); a logged-out visitor's hashed em can still
  ride the closing beacon within the same SPA page instance (narrow: SPA logout w/o navigation).
  ADR-0022 names invalidation as future work; record the deferral in refinement-todo.
- [nit][spec] architecture.md not updated — the new identity message + main-side hash cache +
  setIdentity method are a real protocol seam; the contract-surface doc still says {ready,dropped}
  only. REQUIRED before DONE (reconciliation sweep already lists it).
- [nit][impl] protocol tagging inconsistent — {ready,dropped} untagged while {type:"identity"}
  tagged + checked first; the `identity` discriminant reused both directions with different keys
  (raw inbound, ud outbound). Back-compat + correct; logging-only.

OPEN QUESTIONS (reconciliation):
- Should a null/absent setIdentity field CLEAR the cached hash (logout)? If out of scope, name it
  in refinement-todo (deferral, not silent gap).
- Is setIdentity an additive extension of the ADR-0017 frozen stable core? If so, pin its
  additive-ness in test/contract-stability.test.js.
