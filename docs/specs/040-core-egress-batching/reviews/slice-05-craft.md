---
slice: 040-05 — payload-ceiling split (per-adapter)
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T22:06:24Z
prompt_source: review.py pr-review --richer-skill none ... 'payload-ceiling' connectors/ga4/coalesce.js test/ga4-coalesce.test.js
substrate: shown
applied_skill: none
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass (richer-skill: none — jig baseline)

## Reasoning

`splitIntoPostGroups` is correct and clean: greedy in-order packing with no backfill; the unsplittable-single-event
branch fires exactly when a lone line exceeds the byte ceiling; the fits-check is off-by-one-safe (`<=` both ceilings,
verified by the 26-event `[25,1]` split). The candidate body is built with the same `buildBodyLine` + `\r\n` join as
`buildBatchPost`, so the measured size equals the emitted size (a real strength — the ceiling can never disagree with
the shipped body). Tests are non-vacuous inverses sized RELATIVE to the exported constants (0.4×bytes, count+1), so they
survive a retune. Traced small/huge-alone/small, first-item-huge, two-huge-in-a-row — all clean.

## Specific issues (folded / accepted)

- [nit][impl] the byte fits-check re-encodes the whole candidate body per item (O(n²) over ≤25 lines) + a second encode
  for the AC4 single-line check. Negligible; a running total + hoisted `lineBytes` would make it O(n). **[Kept
  deliberately — the re-join guarantees measured==emitted; clarity/exactness over a micro-opt on a rare path; recorded
  in the deviation log.]**
- [nit][impl] stale `buildBatchPost` docstring (">=2" while it now builds ">=1" chunks). **[FOLDED: opening reworded to
  ">=1 chunk", noting a single-item chunk is a split remainder / unsplittable event.]**
- [strength][impl] measuring via the identical `buildBodyLine` + join used by the emitter eliminates drift between
  checked size and shipped size.
- [strength][test] fixtures sized off the exported constants, not hardcoded bytes; each split test states its
  fails-if-reverted pivot.

## Reconciliation notes

- Post-split singleton → single-line POST (not GET): per AC1/AC4, reasonable; a single event can leave as a POST on the
  rare split path (gtag would GET it) — same class as the `_ss`/`_fv`-repeat non-parity residual. **[FOLDED: recorded in
  the deviation log.]**
- Byte ceiling measured on body only. **[FOLDED: recorded; consistent with "combined body size", 60000 << ~130KB.]**
