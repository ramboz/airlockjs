---
slice: 026-04 — Meta advanced matching (worker-hashed, eager, unload-cached)
pass: craft
verdict: pass
reviewer: general-purpose (pr-review lens, Opus)
reviewed_at: 2026-09-11T15:24:14Z
prompt_source: review.py pr-review --richer-skill pr-review
substrate: shown
applied_skill: pr-review
shown_candidates: [pr-review:high-confidence, scout-pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, adobe-security-antipatterns:speculative, adobe-security-audit:speculative, adobe-security-client:speculative, adobe-security-cloud:speculative, adobe-security-foundations:speculative, adobe-security-lang:speculative, adobe-security-services:speculative, agent-development:speculative, arch-review:speculative, audit-migrator:speculative, block-kit:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, command-development:speculative, configure:speculative, content-fidelity:speculative, create-slack-app:speculative, cutline:speculative, debug-workflow:speculative, design-eval:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, frontend-design:speculative, get-content-scrape:speculative, hook-development:speculative, investigate-alert:speculative, local-dev:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, morning-ai-radar:speculative, morning-assistant:speculative, morning-confluence:speculative, morning-github:speculative, morning-jira:speculative, morning-outlook:speculative, morning-slack:speculative, morning-spike:speculative, mysticat-debug:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, query-audits:speculative, query-opportunities:speculative, query-scrapes:speculative, query-sites:speculative, receipts:speculative, release-check:speculative, release-slate:speculative, run-preflight:speculative, scope-audit:speculative, scout-autotune:speculative, scout-bench-create:speculative, scout-memory-init:speculative, scout-scrum-master:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, silence-alert:speculative, skill-creator:speculative, skill-development:speculative, slack-api:speculative, slack-cli:speculative, slack-docs:speculative, slack-messaging:speculative, slack-search:speculative, spacecat-configuration:speculative, steward:speculative, test-pr-in-dev:speculative, webpage-replica:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass

REASONING:
High-craft, security-forward work. SHA-256 hashing correct (independently re-derived via node:crypto
in tests, not the module's own path); Meta per-field normalization matches the documented spec; the
raw-never-egresses guarantee is enforced STRUCTURALLY (worker retains/posts only hashes; the
main-side cache is hash-only, null-proto) and witnessed end-to-end; error paths degrade-to-omit
without surfacing raw. No correctness/security/robustness blocker.

SPECIFIC ISSUES:
- [strength][impl] the e2e test pumps the REAL chamber's real-WebCrypto identity output into the
  REAL airlock and asserts the closing GET carries ud[...] with no raw / no normalized-but-unhashed
  value, even under a payloadDenylist — a genuine round-trip, the strongest raw-never-egresses witness.
- [strength][impl] normalization witnesses are non-vacuous (assert the trim/lowercase hash AND
  .not.toBe the un-normalized digest, expected hashes via node:crypto).
- [strength][impl] the payloadDenylist bypass is proven BY CONTRAST (raw crosses on the identity
  channel; a push() of the same field IS stripped).
- [strength][impl] least-privilege: advancedMatching stripped before both connectors; handle never
  receives raw boot identity.
- [strength][spec] the teardown-race test exercises the correct ADR-0022 kill-criterion #2 profile
  (identify em/ph then navigate before hash resolves): per-field omit, warm external_id ships, no raw.
- [nit][impl] brittle `not.toContain("415")` phone-fragment guard (chamber:96, e2e:100) — 4/1/5 are
  hex digits, could appear in a hash by chance; the sibling not.toContain("4155550100")/"user@example.com"
  carry the real weight. Assert a longer non-hex-colliding fragment. (fix at reconciliation)
- [nit][impl] near-vacuous "invents nothing" test (test:116-121) — not.toContain("11111111-1111")
  can't fail (that GUID is never passed in). Feed a raw-looking value + assert not invented, or drop it.
- [nit][impl] doc-sync: setIdentity is a new write-surface verb but contracts/push-api.md doesn't
  mention it, and push-api.md is absent from the sweep table. Add it + a sweep row. (reconciliation)
- [nit][impl] observability: worker :92-95 `.catch(()=>{})` swallows the deliberately-loud
  "WebCrypto unavailable" throw → in a no-WebCrypto realm hashing silently no-ops. Near-unreachable
  (HTTPS/Node18+ expose crypto.subtle); optional value-free diagnostic ({type:"identity-error",field}).

RECONCILIATION NOTES:
- Fold the two test nits + the observability nit into the deviation log (non-blocking).
- Act on the doc-sync: add setIdentity to contracts/push-api.md "The write surface" + a push-api.md
  sweep row (ties to arch's contract-stability question). Deviation-log items #1/#2/#4/#5 verified sound.
