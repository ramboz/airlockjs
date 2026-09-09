---
slice: 040-03 — GA4 multi-`en` POST coalesce adapter (revives 039-04)
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T20:57:58Z
prompt_source: review.py pr-review --richer-skill none docs/specs/040-core-egress-batching/spec.md 'GA4 multi' <deliverables>
substrate: shown
applied_skill: none
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass (richer-skill: none — jig baseline)

## Reasoning

`coalesceGa4` is a clean, well-documented pure function. The byte-faithfulness design is sound: `splitUrl`/
`parseParamPairs` preserve raw `key=value` tokens and never round-trip through decode/re-encode, so percent-encoding
matches gtag's `encodeURIComponent`; the key is decoded for classification only. The order-insensitive shared signature
(sorted join of raw shared pairs) is a correct, conservative full-context equality, and because `classifyKey` defaults
every non-per-event key to SHARED, gcs/gcd/session-state stay shared structurally — the "differing consent never merges"
governance invariant is enforced by construction, not special-cased. Tests are real inverses that pin observable
structure (byte-for-byte fixture, query/body partition, `_et` relocation, `_ee` injection, integration through the real
seam), each non-vacuous. Body-line order (en, `_ee=1`, ep/epn, `_et`) is correct and pinned. Edge cases (value with `=`,
empty query, param with no `=`, duplicate keys) all handled within the closed input domain.

## Specific issues

- [strength][impl] connectors/ga4/coalesce.js:54-74 — `splitUrl`/`parseParamPairs` keep the original `key=value` token
  verbatim (decode only for the classification key), avoiding the space-as-`+` vs `%20` divergence a decode/re-encode
  would risk; naturally handles values containing `=`, params with no `=`, and duplicate keys.
- [strength][impl] connectors/ga4/coalesce.js:38-43,84-95 — `classifyKey` defaults all non-per-event keys to SHARED and
  the signature is the sorted join of raw shared pairs, so gcs/gcd/session-state ride the query once and any difference
  forbids merging — governance invariant as a consequence of the uniform taxonomy, not a bespoke guard.
- [strength][impl] test/ga4-coalesce.test.js (mixed-`gcs`) — genuinely isolates gcs: `ad_user_data`/`ad_personalization`
  are pending (core/consent.js:59-66) → `encodeGcd` returns undefined (gtag.js:193) → gcd omitted from both GETs, so gcs
  is the sole differing shared param and the test truly fails if gcs were misclassified per-event.
- [nit][impl] fixture `ctx` carries only clientId/sessionId, so the byte-for-byte assertion never exercised
  gcs/gcd/session-state landing on the merged query. **[FOLDED: added a test where two identical-context events (all four
  consent purposes decided → gcd emits; session-state present) merge into one POST, asserting gcs/gcd/sct/seg land once
  on the merged query and never in the body.]**
- [nit][impl] connectors/ga4/coalesce.js — `.map(...).slice().sort()`: the `.slice()` is redundant (map returns a fresh
  array). **[FOLDED: removed.]**

## Reconciliation notes

- The gcs/gcd/session-state fixture-coverage limitation is now closed by the added merged-shared-params test (was:
  acceptable subset).
- The n=1 batch-marker residual (`_ee=1` per line; per-event `_et` value divergence from the sole 2026-09-08 capture) +
  the deferred GA4 DebugView live-accept re-validation are correctly recorded in docs/refinement-todo.md; the fixture is
  honestly labeled code-matches-spec-structure, not a raw capture.
- The slice's Deviation log + Reconciliation sweep are still `_TBD` — reconciliation-phase artifacts, to fill next.
