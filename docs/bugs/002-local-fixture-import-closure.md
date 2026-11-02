---
status: DONE
tier: gnarly
severity: medium
claimed_by: local-fixture-import-closure
regression_test: "test/local-browser-journeys.test.js::serves two fixed pages and the entire actual adapter/module-worker import closure"
main_repro_checked_at:
main_repro_ref:
main_repro_result:
red_confirmed_at: 2026-11-02
green_confirmed_at: 2026-11-02
fix_class: local_patch
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
  the initial failure does not enumerate the complete closure.
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
static root or runtime import discovery. The first provisional correction
was removed after the controlled foreground sequence exceeded its request
limit. Its experimental patch remains in the session artifact
`bug-002-provisional.patch`, not as a qualified fix.

## Fix class

`local_patch`: update the fixed fixture and its exact foreground expectations
to match current imports. Separate transport-only preflight from product
loading without introducing discovery or broadening policy.

## Fix

The first exploratory patch added the 11 missing fixed source entries and
adjusted foreground expectations, but failed the existing global request
limit in controlled events. The coordinator then directed a fixed inert
`/preflight` page for transport controls. Product and failure phases still
load their vendor page, controller and full main/worker source multiset.
Preflight admits its control page and canonical control request only. It
rejects product assets, other documents and workers. Every observed request
still counts and served bytes remain hash-checked. Limits remain unchanged.

## Call-site closure

<!-- Spec 091 / ADR-0037: before REVIEWED, account for every site named
     in the inventory above as changed, tested, or intentionally left
     alone. Accounting, not mandatory widening. -->

**Disposition per affected site:** The server catalogue now includes all 29
actual graph modules and an inert page whose bytes are included in the page
manifest. Foreground admission and navigation are phase-specific, its hash
checks remain in place, and its exact product/worker source multiset is
updated. Controlled-event lists match independent disk import traversal for
each realm; tests reject preflight product activity, missing/extra source
events and a 65th request in the admitted product phase. The independent HTTP
graph traversal is preserved and also checks the inert page. Both operator
docs describe the changed source and evidence limits. Historical slice and
product-readiness records remain unchanged.

## Already tried

The reported first 404 was reproduced with the smaller selector above.
The workflow's main check only records `reproduces` or `resolved_on_main` in
fields explicitly named for main, and FIXING requires a reproducing main
check. Its arbitrary ref string does not make an integration-baseline result
a fresh-main result. No check was recorded, no gate was bypassed, and no
source fix was started. `bug.py transition 002 FIXING` exited 1, reporting
missing `main_repro_checked_at`, `main_repro_ref`, and `main_repro_result`.

On 2026-11-02 the owner replied "yes, approved" to the coordinator's explicit
request for a Bug-002-only fresh-main-gate exception using integration baseline
`201413a036be3e2e5d7565d30efcc4abf2cbec34`. The exception applies only to
the `ROOT_CAUSED -> FIXING` invocation for this bug, using command-local
`JIG_BUG_MAIN_CHECK_GATE=0`. It does not assert a main result, authorize
other gate exceptions, or change the requirement for red/green evidence and
later bug, craft and security reviews.

The Sol coordinator subsequently directed the bounded inert-page correction.
No second main-gate exception or other gate bypass was used.

## Regression test

The existing graph traversal in `test/local-browser-journeys.test.js` is the
regression. The authorized command-local exception was used once on
`bug.py transition 002 FIXING`; the helper witnessed red and stamped
`red_confirmed_at`. With the experimental patch applied,
`python3 /Users/ramboz/.copilot/installed-plugins/jig/jig/.github/skills/tdd-loop/tdd.py run . --test 'test/local-browser-journeys.test.js::serves two fixed pages and the entire actual adapter/module-worker import closure'`
exited 0, with 1 passed and 11 skipped. That patch was then removed. The same
helper command passed again on the current correction, 1 passed and
11 skipped. The green review-transition stamp remains empty because
independent reviews and `REVIEWED` have not been performed.

## Proof

The current static source graph has 29 unique modules versus 18 in the
original fixed catalogue. The missing entries were five Meta and six Google modules. Each
vendor has 19 unique modules including the worker graph. Meta has 12 main
and 11 worker modules with four shared paths; Google has 14 main and 11 worker
modules with six shared paths. The combined module bytes are 276,517, with a
48,560-byte maximum module, below the existing 8 MiB retained-source and
2 MiB per-response limits before page and receipt accounting.

The controlled foreground model requests main and worker imports separately.
It uses three page loads, two worker graphs and seven control/measurement
requests per vendor. Counting repeated shared paths gives Meta
`3 + 3*12 + 2*11 + 7 = 68` and Google
`3 + 3*14 + 2*11 + 7 = 74` observed requests. The existing per-vendor
foreground limit is 64. Against the provisional patch, the controlled Meta
run stopped at the 65th request with `request-count-limit`; its retained
counter was 1,532,591 bytes at that point. Google was not reached. These are
controlled-event counts, not a claim about actual Chrome's request behavior.

`npm test -- --reporter=dot test/local-browser-foreground.test.js test/local-browser-journeys.test.js`
against the provisional patch exited 1: 49 passed, 2 failed. Both failures
were foreground success-path tests; the first exposed `request-count-limit`.
On the current correction the same command exited 0: 58 passed in 2 files.
The controlled model now counts 56 Meta and 60 Google requests, including
all three documents and seven measurement attempts per vendor. The fixture
manifest has 29 source and three page hashes. The request, byte, time and
socket limits remain unchanged; retained bytes are checked against 8 MiB.
The 65th-request mutation remains a failure in the product phase.

`./node_modules/.bin/eslint rig/local-browser-journeys.mjs rig/local-browser-foreground.mjs test/local-browser-foreground.test.js`
originally exited 127 because the local executable was missing. The three
locked direct lint packages and their dependencies were installed in an
isolated session directory with npm `--ignore-scripts`; all 70 installed
package versions match versions in the repository lockfile. Lint ran from
the project cwd on both rig modules and both tests, using a byte-identical
copy of `eslint.config.js` (SHA-256
`7ce029fcdae14afe0de4795ef21895b22fd44a9177dc86e553d587841b6ecfff`),
and exited 0. No project manifest, lockfile or shared install was changed.
The lint command below uses `<ISOLATED_LINT_TOOLS>` for the private
session-scoped tool location. The exact command/path receipt is retained
privately by the coordinator, not committed:

```sh
<ISOLATED_LINT_TOOLS>/node_modules/.bin/eslint --config <ISOLATED_LINT_TOOLS>/eslint.config.mjs rig/local-browser-journeys.mjs rig/local-browser-foreground.mjs test/local-browser-journeys.test.js test/local-browser-foreground.test.js
```

The original reported repro was rerun on integrated review checkpoint
`41f2abe40e297068215c718bad9bb7b0604f8e70`:
`npm test -- --reporter=dot test/local-browser-journeys.test.js -t source`
exited 0, with 12 passed and zero failures (runner duration 2.43s).
The coordinator also independently ran both complete fixture files: 58 passed,
exit 0, and targeted lint passed with the byte-identical isolated config.

Fresh independent Sol bug, craft and security reviews all returned pass at
that checkpoint. The security review was heuristic static inspection with no
scanner run and no reportable findings. Actual verdicts are recorded through
Jig before the normal REVIEWED, VERIFIED and DONE transitions.

No limit, browser pin, transport policy, runtime mapping or frozen interface
was changed. The controlled model is not a measurement of Chrome's loading
or caching behavior. No browser, native SDK, vendor request or product
qualification was performed.

## Learning

Keep fixed fixture catalogues checked against actual served imports and retain
main/worker multiplicities. Transport-only preflight should use its inert
control page instead of loading the product graph and exhausting the same
request budget. Keep independent product/error observations and all resource
bounds. See [the recorded learning](../memory/learnings.md#transport-only-preflight-should-not-load-product-modules).
