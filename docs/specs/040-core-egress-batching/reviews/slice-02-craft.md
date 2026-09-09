---
slice: 040-02 — core coalescing seam (post-verdict, per-cycle, protocol-pluggable)
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T20:12:50Z
prompt_source: review.py pr-review --richer-skill none docs/specs/040-core-egress-batching/spec.md 'core coalescing seam' core/airlock.js test/egress-coalescing.test.js
substrate: shown
applied_skill: none
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass (richer-skill: none — jig baseline)

## Reasoning

The restructure is a genuine behavior-preserving split: phase 1 collects survivors with the consent seal then endpoint
ceiling running in unchanged order and side effects (heldBeacons push, beaconSeq/beaconId mint, diagnose), and phase 2
moves only the terminal fetch out — the default path (`typeof coalesce !== "function"`) is byte-identical, and
`dispatched`/keepalive semantics are unchanged. The documented edge cases are handled: `coalesce` returning
undefined/`[]` (`|| []` guard), hook split/off-endpoint outputs re-validated per-output via `checkEndpointCeiling`, and
both input and output checks gated on `ceiling.length`. Tests are mostly real inverses that pin observable order (not
just counts), and the Map-per-cycle grouping is O(n) main-thread work that is INP-negligible and structurally prevents
cross-cycle merge. Only nits remain; no blockers.

## Specific issues

- [strength][impl] output re-check closes the ADR-0021:88 output-ceiling-bypass hazard; the paired tests (off-endpoint
  output held, and split good+bad) are strong failing-without-feature inverses that also prove per-output granularity.
- [strength][impl] the behavior-preservation regression tests pin observable order genuinely (mixed send/hold/drop
  fetch order; consent-hold beaconId `#1`/`#2` sequence) — exactly what the phase-1/phase-2 split must not perturb.
- [nit][spec] AC1 prose says each output "must equal the group's ceiling-passed endpoint," but the implemented (and
  AC-prescribed) mechanism re-runs `checkEndpointCeiling(out.url, endpoints)` against the FULL declared set. Prose-vs-
  mechanism drift, not a hazard. **[FOLDED: AC1 wording reconciled.]**
- [nit][impl] "a consent-held input never reaches the coalescer" was a weak inverse (both assertions still pass if the
  whole 040-02 wiring is deleted). **[FOLDED: strengthened with a `consent/held` diagnostic assertion.]**
- [nit][impl] `coalesce(groupRequests) || []` (hook returning undefined/`[]`) handled but had no dedicated test; the
  empty-`ready` path likewise. **[FOLDED: added undefined-return and []-return edge tests.]**
- [nit][impl] AC2 test pinned hook-call order + fetch count but not cross-group fetch order. **[FOLDED: added
  first-seen (A before B) fetch-order assertions.]**
- [nit][impl] the ceiling-check-then-diagnose block was duplicated verbatim on the input and output sides; a small
  helper would DRY it and keep the two sides from drifting. **[FOLDED: extracted `holdIfOffCeiling(url)`, shared by both
  phases, hosting the arch-review note on why consent is not re-checked on outputs.]**

## Reconciliation notes

- Honest deviation to log: the phase split changes the *relative* interleaving of `fetch` calls vs. `diagnose`
  emissions on a mixed cycle (all diagnostics now emit in phase 1, before any fetch). NOT observable through the pinned
  surfaces — diagnose-relative-to-diagnose order and heldBeacons/beaconSeq order are preserved exactly, and
  fetch/diagnose are observed via independent mocks — so AC3's "preserving diagnose emission order exactly" holds.
- The output re-check validates against the full declared `endpoints` set rather than the specific group's endpoint;
  deviation log notes "equal the group's endpoint" is enforced as "within the declared ceiling," consistent with the
  AC's prescribed `checkEndpointCeiling` mechanism.
- `dispatched` (via `stats()`) counts *output* fetches on the coalesce path, so a coalesced burst reports a lower
  `dispatched` than survivor count — intended (the perf win), not a regression on the default path.
