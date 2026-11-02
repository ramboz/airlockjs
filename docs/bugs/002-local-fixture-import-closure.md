---
status: ROOT_CAUSED
tier: gnarly
severity: medium
claimed_by: local-fixture-import-closure
regression_test:
main_repro_checked_at:
main_repro_ref:
main_repro_result:
red_confirmed_at:
green_confirmed_at:
fix_class:
security_surface: true
escalated_to:
closure_schema: 1
---

# Bug 002: local-fixture-import-closure

## Symptom

The SDK-free local fixture returns 404 for a module imported by the Meta
adapter. Its independent source-graph test fails before it can check the
complete graph. This is local fixture evidence, not a native SDK or browser
qualification. Existing owner: [060-14](../specs/060-meta-pixel-full-compatibility/slice-14-local-browser-pageview.md).
The full product-readiness scope of 060-01 is unchanged.

## Repro

At integration baseline `201413a036be3e2e5d7565d30efcc4abf2cbec34`,
run `npm test -- --reporter=dot test/local-browser-journeys.test.js -t 'source'`.
Observed: exit 1, 1 failed and 11 passed. The independent graph traversal
expected 200 for `/connectors/meta-pixel/pageview-data.js` and received 404.

## Evidence

- `adapters/meta-pixel-prototype.js:2` imports the path. Git tracks
  `connectors/meta-pixel/pageview-data.js`. The fixed `SOURCE_PATHS` in
  `rig/local-browser-journeys.mjs` omits it, and the request handler serves
  only the preloaded fixed map or the fixed pages.
- `test/local-browser-journeys.test.js:98-134` independently follows served
  imports and worker URLs. It reaches the missing path and checks HTTP status
  before comparing the graph with the manifest.
- Other Meta and Google imports also appear in the adapter and worker source
  but not in the original fixture catalogue. The first 404 stops the test;
  the complete corrected closure and its byte/request budget remain unverified.
- `rig/local-browser-foreground.mjs:430-437` separately checks a fixed
  per-vendor loaded-source set. The controlled-event test has its own lists
  in `test/local-browser-foreground.test.js:127-140`.
- Fresh `origin/main` was fetched by the coordinator at
  `a4008d5ddb8f10b459500921bf974a064de2beca`. On this worktree,
  `git cat-file -e origin/main:rig/local-browser-journeys.mjs` and the same
  check for `test/local-browser-journeys.test.js` each exited 128. Neither
  file exists at that ref. No trunk repro was run and absence is not evidence
  that the defect was resolved on main.
- The foreground pin is Chrome `156.0.8078.48`; the coordinator reported
  installed `.76`. This is metadata only; no browser was acquired here.

## Hypotheses

- [x] H1 (leading): the fixed catalogue did not follow changes to actual
  adapter imports. Confirmed for `pageview-data.js` by the import, tracked
  file, missing catalogue entry, and 404; additional imports need a complete
  closure check after a permissible fix.
- [ ] H2: a URL resolution or HTTP handler error rejects a catalogued source.
  The missing path is not catalogued, while the handler uses the exact request
  URL to look up that catalogue. This does not explain the observed 404.

## Root cause

The checked-in Meta adapter imports a tracked module omitted from the fixture's
literal source catalogue. The handler therefore has no entry to serve at that
URL. Subsequent adapter changes and separately maintained foreground source
expectations create further closure drift risk. The first failed request does
not establish the entire missing set.

## Repository closure inventory

<!-- Spec 091 / ADR-0037: pre-fix repository closure. Standard & gnarly
     bugs gate ROOT_CAUSED -> FIXING on substantive answers below. This
     is an effort-and-protocol standard, NOT a completeness proof: show
     the search you actually ran. A bare "none found" fails; record
     residual uncertainty as an assumption WITH the protocol behind it,
     applying the same enumeration standard as `## Root cause` (ADR-0052).
     Prefer a configured semantic index; the portable floor is targeted
     search + `git log`/`git blame`. -->

**Equivalent / convergent logic searched:** Searched `SOURCE_PATHS`,
`sourceManifest`, `COMMON`, `loaded-source-closure`, `mainSources`,
`workerSources` and `startLocalBrowserJourneys` in the local-browser rig and
tests, and import/worker URL declarations in adapters, connectors, core and
rig. This targeted search identifies the closely coupled fixture surfaces;
it does not prove that differently named consumers do not exist.

**Relevant history inspected:** `git log -S 'SOURCE_PATHS'` and
`git log -S 'loaded-source-closure'` identify `0a09462` as the fixture and
foreground introduction. `git log --ancestry-path 0a09462..HEAD` on the
adapter and prototype files shows later vendor changes, including `259d600`
and `53fe6e8`. `git log -S 'snapshotPageViewData'` and
`git log -S 'snapshotDestinationSelectors'` identify later import history.

**Affected call sites:** The fixed server reads `SOURCE_PATHS` and exposes
`sourceManifest`; the foreground request admission and response identity
checks consume that manifest, and `negatives` checks the per-vendor loaded
set. The independent HTTP graph test follows actual imports, and controlled
foreground tests synthesize `mainSources` and `workerSources`. The two rig
operator documents describe the fixture and its evidence boundaries.

**Reuse decision:** Preserve the existing fixed catalogue, separate
foreground expectations, and independent traversal. Do not add a dynamic
static root or runtime import discovery. Exact additions are not yet
determined and require a permitted correction and independent graph check.

## Fix class

## Fix

## Call-site closure

<!-- Spec 091 / ADR-0037: before REVIEWED, account for every site named
     in the inventory above as changed, tested, or intentionally left
     alone. Accounting, not mandatory widening. -->

**Disposition per affected site:** No source, tests, or rig documentation
changed. Server, foreground expectations and controlled-event lists remain
pending a permitted fix; preserve the independent graph oracle. Historical
slice and product-readiness records remain unchanged.

## Already tried

The reported first 404 was reproduced with the smaller selector above.
The workflow's main check only records `reproduces` or `resolved_on_main` in
fields explicitly named for main, and FIXING requires a reproducing main
check. Its arbitrary ref string does not make an integration-baseline result
a fresh-main result. No check was recorded, no gate was bypassed, and no
source fix was started. `bug.py transition 002 FIXING` exited 1, reporting
missing `main_repro_checked_at`, `main_repro_ref`, and `main_repro_result`.

## Regression test

The existing graph traversal in `test/local-browser-journeys.test.js` is the
red regression. The helper has not witnessed a red transition because the
main gate is unmet.

## Proof

No fix or green proof. No source catalogue count change, budget qualification,
lint, real browser, native SDK, vendor request or product qualification.

## Learning
