---
slice: 031-01 — the distributable build target + subtree-install proof (boots on a clean EDS checkout, CWV preserved)
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-04T19:29:25Z
prompt_source: review.py implementation docs/specs/031-distribution-setup/spec.md 031-01 <deliverables>
---

VERDICT: pass

## Assessment (independent compliance review, general-purpose reviewer)

All six ACs met and **observably verified by re-running the deliverables**, not by trusting claims:
- `npm run lint` — clean.
- `npx vitest run test/dist-build-publish.test.js` — 11/11 pass (AC1/AC2/AC3).
- `npm run build:dist` — emits `eds.js` + all four `*.worker.js` siblings into `dist/`; every worker reference a
  same-origin `./` specifier, zero `blob:`/`data:` (AC1/AC3).
- `npm run rig:subtree` — exits 0: happy path boots + beacons; **BOTH seeded breaks go red** (missing-sibling → no
  beacon/chamber-error; add-from-`main` → boot-fail 404 on eds.js) (AC5). Non-vacuous: the shared happy-path arm is
  a working positive control, so each red is genuinely caused by its seeded fault.
- AC2 — the dist-rooted ref carries exactly the artifacts + VERSION (`airlockjs v0.5.0+fac1ef1`, matching
  package.json + HEAD), airlock's source absent.
- AC4 — README command matches the rig, no drift.
- AC6 — opt-in CWV arm faithfully reuses `lh-eds.mjs`'s OFF/ON method + tolerance band; honestly met.

## Non-blocking findings (low)
1. **AC6 CWV arm is opt-in** (`WITH_CWV=1`); default `rig:subtree` reports `cwv_within_band: "not run"`. Honestly
   met + documented, but the standing AC6 proof is opt-in, not continuous.
2. **publish-dist.mjs:90** `git push --force … HEAD:refs/heads/<ref>` to `<target>` — intentional for the
   documented generated-release overwrite (ADR-0015 "overwrite wholesale"); the required-explicit-`--target` guard
   prevents accidental `origin` pushes, but `--force` to a real remote is a mild footgun if mispointed.
3. **rig/subtree-install.mjs:232-238** — the add-from-`main` fixture stages only `build.mjs`/`package.json`/`core/`
   rather than the full repo root; the load-bearing property (no `eds.js` at `main`'s served root) still holds, so
   the reduction is acceptable for a mechanism proof.

## Reconciliation
Deviation log + reconciliation sweep already present under the slice heading, complete and honest (AC1 emit
decision; AC2 rejected alternatives + `--target` safety; AC3 witnessed throws; AC5 both-breaks-red witness; AC6
opt-in packaging; the pre-existing non-regression `dom-chamber-host-prism` prismjs env failure, independently
corroborated). The three unchecked DoD boxes are the review passes themselves.

Reviewer: general-purpose (independent). Pass: compliance (always-on).
