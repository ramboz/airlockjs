---
slice: 007-01 — `ga4_mp_conformance` oracle component (hermetic + live complement)
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-08-27T20:46:49Z
prompt_source: review.py pr-review --richer-skill pr-review
substrate: non-interactive
---

Craft pass — VERDICT PASS (no blockers; nits only). The gate is correct and provable; the recursion guard (as originally submitted) reliably bounded re-entry. STRENGTHS: the non-vacuous fixture choice (custom-event golden read only by validate.mjs), the binary-convention comment at the COMPONENTS array, the advisory-only live check (every path exit(0), credential-free). NITS (all now ADDRESSED by the blocker-fix round): (1) [nit] the original test spawned bash oracle.sh whose score_vitest re-ran the whole suite -> ~5x suite executions per npm test + hidden env-var coupling; RESOLVED by moving the meta-test out of the default suite (vitest.config.js exclude + npm run test:oracle) and removing the guard. (2) [nit] live-check test inherited process.env so a dev with GA4_MEASUREMENT_ID/GA4_API_SECRET exported would POST to the real endpoint and fail the skip assertion; RESOLVED by deleting those vars from the child env. (3) [nit] oracle.sh subshell cd swallows a missing contracts/ dir as 0.0 not rc=2 — minor, consistent with score_vitest's cwd assumption. (4) [nit][spec] AC3 wording ("credential-free against the placeholder endpoint, or self-skips") vs impl (skip when no creds, else POST to real endpoint) — reconcile in the deviation log. RECONCILIATION: log the two reasonable deviations (env-var names GA4_MEASUREMENT_ID/GA4_API_SECRET; mp-live-check script colocated in contracts/package.json); reconcile the AC3 wording.
