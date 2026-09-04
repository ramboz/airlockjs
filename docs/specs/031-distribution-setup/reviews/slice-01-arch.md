---
slice: 031-01 — the distributable build target + subtree-install proof (boots on a clean EDS checkout, CWV preserved)
pass: arch
verdict: pass
reviewer: general-purpose (richer: arch-review)
reviewed_at: 2026-09-04T19:29:25Z
prompt_source: review.py arch-review docs/specs/031-distribution-setup/spec.md 031-01 <deliverables> --richer-skill arch-review
substrate: non-interactive
---

VERDICT: pass

## Assessment (independent arch review, general-purpose reviewer, richer skill: arch-review)

The dist-rooted-ref boundary is the correct one. `git subtree add --prefix` pulls a ref's root, so publishing the
servable tree to a `dist` branch whose root IS `eds.js` + the sibling workers is what makes the consumer add the
artifacts, not airlock's source. The `build.mjs` refactor keeps one build function feeding two byte-identical
targets, so the testbed's direct-emit path and the load-bearing same-origin-file-worker invariant (004-01) are
preserved by construction, and the rig re-proves it end-to-end under the real boilerplate CSP. The ADR-0015-delegated
alternatives (subtree-split-alone; separate release repo) are fairly weighed; `--target` required (no `origin`
default) is sound; the architecture.md OQ8 edit is faithful and correctly scoped. **No blockers.**

## Strengths
- `publish-dist.mjs` requires explicit `--target`, refuses to guess `origin` — prevents accidental force-push.
- `DIST_ARTIFACTS` derived from `build.mjs`'s `ENTRY_OUT` + `WORKER_ENTRIES` — published root can't drift from the build.
- The rig consumes `publishDist`'s output, never a scratch root (honors the frame-critique correction); the
  add-from-`main` break proves the `--prefix`-is-local semantics the mechanism turns on.
- Same-origin-file-worker assertions made basename-keyed — enforce on `dist/`, temp dir, or testbed alike.

## Non-blocking findings → reconciliation-log items
1. **[nit] docs/architecture.md:92** — OQ8 attributes "CWV preserved" to `npm run rig:subtree`, but the CWV arm is
   opt-in (`WITH_CWV=1`). Claim is true but the bare command doesn't exercise it → name the `WITH_CWV=1` form or
   soften. (Orchestrator will fix in reconciliation.)
2. **[nit] build.mjs:72-76** — `workerEntries`/`outNameFor` are exposed on the production `buildAirlock` API
   primarily as AC3 test seams (drop/rename regressions). Defensible (tests the real build path); add a one-line
   note that they exist for regression-seeding.
3. **[moderate] VERSION sha provenance** — `computeVersion` stamps `pkg.version` + airlock HEAD short-sha at publish
   time, while bytes come from a prior `build:dist`. Build-then-move-HEAD-then-publish could stamp a mismatched sha.
   Safe in the rig (back-to-back); 031-02 owns the authoritative tag-based pin. Fold into deviation log as a known
   pre-1.0 property.
4. **[moderate] consumption-contract placement** — the served-path convention + two boot lines (a "public
   consumption contract") live only in the resolved-OQ8 log, not the enumerated "Contract surfaces" section that
   feeds `/jig:contracts`. Placement question (implementer followed the OQ7 strike-and-RESOLVED precedent), not a
   defect. Open question for the team; surfaces stay pre-1.0.

Reviewer: general-purpose (independent), richer skill arch-review. arch_review: true (public consumption contract).
