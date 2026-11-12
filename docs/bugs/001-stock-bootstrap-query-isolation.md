---
status: DONE
tier: standard
severity: high
claimed_by: adobe-adoption-goal
regression_test: test/adobe-stock-site.test.js::BOOTSTRAP-QUERY
main_repro_checked_at: 2026-10-15
main_repro_ref: origin/main@a4008d5ddb8f10b459500921bf974a064de2beca
main_repro_result: reproduces
red_confirmed_at: 2026-10-15
green_confirmed_at: 2026-10-15
fix_class: structural_fix
security_surface: false
escalated_to:
closure_schema: 1
---

# Bug 001: stock-bootstrap-query-isolation

## Symptom

Corrected controls18 loaded31 original normal resources without any denied
request, but never fetched runtime configuration or imported the stock entry.
It ended after15.899s with no settlement and no new Adobe request. Cleanup
verified the site disabled, Target SAVED and its prior schedule restored.
The failed attempt is retained; it is not a performance regression measurement.

Implementation is linked to active [051-02](../specs/051-adobe-integration-proving-ground/slice-02-test-baseline.md).
This defect record owns the query-guard correction, not another live attempt
or the broader slice's acceptance.

## Repro

Run the existing `isOptIn` predicate and the deployed pre-import `stockOptIn`
expression with the same valid owned-origin/four-key stock URL, then append
`&google-ads=off&meta-pixel=off`. Legacy accepts; both guards reject the paired
URL before any config/module request. This reproduces offline without SDK or
external traffic. The actual failed request had that exact new query form.

## Evidence

- Private `case18-bootstrap-diagnosis.20261016.local.json`: executed original
  module and deployed guard; legacy true, Google-only false, paired-off false.
- Actual case18:15,899ms, `settled_at:null`, entry null, no new SDK reservation/
  request, zero denied requests,31 loaded resources each proved.
- `control18-failure-originals.20261016.local.json` preserves exact state/input/
  plan/approval/case/normal/network/trace/verification/readiness and all25 old
  pinned source asset bodies before source edits.
- Actual state after cleanup: contexts[1,17,2,18], normal396/6,355,957 bytes,
  cleanup34/27,096 bytes, one historical SDK reservation. No context19 is granted.

## Hypotheses

<!-- Anti-anchoring: >=2 candidates, mark the leading one. Any Markdown
     list works (-, *, +, or 1.); the gate counts top-level items only
     (indented sub-bullets are notes, not hypotheses). -->
- [x] H1 (leading): both four-key-only guards reject the new isolation keys.
  Confirmed by executing both original predicates against legacy/new URLs.
- [ ] H2: static resource admission stalls or refuses the entry.
  Not supported:31 loaded resources all proved, no denied request, and the
  pre-import predicate is false before a config/module request could occur.
- [ ] H3: approved-origin mismatch prevents bootstrap.
  Falsified for this pair: identical origin succeeds with the legacy query.

## Root cause

Before the fix, the query-isolation work updated tag loading, operator paths and root byte
qualification but omitted both stock eligibility guards. The deployed
`scripts/scripts.js` bootstrap required exactly four unique keys before config
fetch/import. The module's `isOptIn` independently required the same four.
Thus the new five-/six-key URLs are ineligible and the runner waits for an entry
that cannot be created. Changing timeouts, oracle results or the failed sample
would not fix the producing process.

Synthetic operator/browser tests deliberately stopped before real stock entry
and the module tests used legacy URLs, so they did not close this bootstrap seam.

## Repository closure inventory

<!-- Spec 091 / ADR-0037: pre-fix repository closure. Standard & gnarly
     bugs gate ROOT_CAUSED -> FIXING on substantive answers below. This
     is an effort-and-protocol standard, NOT a completeness proof: show
     the search you actually ran. A bare "none found" fails; record
     residual uncertainty as an assumption WITH the protocol behind it,
     applying the same enumeration standard as `## Root cause` (ADR-0052).
     Prefer a configured semantic index; the portable floor is targeted
     search + `git log`/`git blame`. -->

**Equivalent / convergent logic searched:**

Targeted `isOptIn`, `stockOptIn`, `parts.length !== 4`, `stockQuery.length === 4`
and opt-in URL searches across `probes/adobe-compatibility/*.{mjs,md}`, tests and
the explicit deployed `reference/scripts/scripts.js`. This finds the module,
the pre-import guard and the README mirror. The claimed closure is these known
entry surfaces, not an assertion about unrelated customer/tag-manager code.

**Relevant history inspected:**

`git log -- probes/adobe-compatibility/stock-site.mjs`:4358d85 introduced the
bounded stock smoke. Fresh origin/main is a4008d5; the original predicate there
still accepts legacy and rejects paired-off. Recent query-isolation/combined
changes are worktree-only and did not change this older entry module.

**Affected call sites:**

`stock-site.mjs:isOptIn`, its `createStockEntry` recheck, the deployed
`scripts/scripts.js:loadPage` pre-config guard and README bootstrap recipe.
Existing operator path/capture/wire constructors already use the exact paired
URL and are left unchanged, not loosened.

**Reuse decision:**

Keep two deliberately mirrored pure predicates: the pre-import guard must not
load the entry/config before eligibility. Do not introduce a new eager shared
HTTP dependency merely to remove the mirror. Exercise both actual guards and
the complete actual bootstrap with a synthetic disabled/SDK-stub setup; update
the documented mirror too.

## Fix class

`structural_fix`: close URL eligibility at both producer boundaries while
preserving all required keys, unique-key checks, literal off values, origin,
path, case/run, runner consent and no-early-load protections.

## Fix

Implemented: accept legacy four keys, optional exact Google-off, or exact paired
Google-/Meta-off. Meta-only, duplicates, encoded aliases, unknown/on values,
missing required keys and foreign/path/fragment variants remain ineligible.
No live retry or numeric cap extension follows from the correction. Head/tag
bootstrap bytes, runtime-config and vendor SDKs are unchanged.

## Call-site closure

<!-- Spec 091 / ADR-0037: before REVIEWED, account for every site named
     in the inventory above as changed, tested, or intentionally left
     alone. Accounting, not mandatory widening. -->

**Disposition per affected site:**

- Canonical module `isOptIn` and the `createStockEntry` recheck: changed and
  covered by three new BOOTSTRAP-QUERY regressions plus all73 entry tests.
- README pre-import recipe: changed; the new regression executes it and compares
  required/optional/malformed variants with the actual module predicate.
- Actual `scripts/scripts.js` pre-config predicate and deployed module copy:
  changed in the isolated source clone, not the evidence-bound old checkout.
  Actual-source Node tests witnessed two failures then15 passes.
- Complete actual bootstrap/entry: four local CDP-fulfilled browser scenarios.
  Paired-off reaches config, actual entry import and eager/lazy/trusted-click/
  delayed completion with SDK-export stubs; disabled config or missing run/
  runner consent never initializes. Both vendor globals absent, no page errors
  and no request continued to an external transport.
- Existing operator exact URL/profile/native wire checks: intentionally unchanged;
  they already use paired flags. The failed sample and budget gate are unchanged.

## Already tried

The failed live sample is retained and cannot be repaired by extending its
window or changing its expected result. No further live attempt was made.
Owner was asked once about19 contexts/800 normal/60 cleanup to accommodate one
future correction plus remaining cases; unavailable is not approval.

## Regression test

`test/adobe-stock-site.test.js::BOOTSTRAP-QUERY` was written and machine-witnessed
red before the canonical fix; all three cases now pass. Owned-site
`tools/tests/adobe-stock-query-isolation.test.mjs` separately executes the
actual pre-import predicate and deployed module, with two witnessed reds then
15 passes. Private `stock-query-bootstrap-closure.20261016.local.json` records
four complete actual-bootstrap/entry scenarios with inert responses and SDK
export stubs; it is not real SDK or performance evidence.

## Proof

Original diagnostic is read-only, no API/SDK/context added. Fresh-main recheck
reproduces. `bug.py transition 001 FIXING` witnessed the new regression red before
the canonical code change. Targeted three new tests and full73 pass; actual-site
Node predicate tests15 pass; combined tag/stock guard Node tests61 pass.
The full-bootstrap qualifier initially correctly stopped at the real lazy
phase's trusted-click wait; the fixture then supplied the required real click
and the data-layer stub's required void return, without weakening product code
or timeouts. All four full-bootstrap scenarios pass. This is source/SDK-stub
closure, not real SDK transport or a repaired live case18.
Independent bug-review/craft both pass. Owned-site fix commit
`3f9258d53d0449a41c5f26c837eea97142d5aeac`, parent424f1aac, is pushed and both
served changed sources match reviewed bytes. Main-script propagation initially
returned its old body; that source GET is retained before the successful repeat.
Total deployment/source verification: four requests/41,392 bytes, no SDK or
Adobe API/context added. Head and disabled runtime config are unchanged.
Actual controlled state remains396 normal/6,355,957 bytes and34 cleanup/27,096;
all-in normal including pending source-fix receipt is400/6,397,349.
The failed sample is not reclassified. No future live retry is approved.

## Learning

Test the real pre-config bootstrap and entry eligibility whenever adding URL
controls; correct harness URLs alone do not prove reachability. Retain the real
trusted-click/return contracts in the fixture rather than weakening those guards.

## Main recheck

- 2026-10-15 - `origin/main@a4008d5ddb8f10b459500921bf974a064de2beca` -> reproduces: Fresh origin/main actual isOptIn executes legacy=true and paired-off=false at identical origin; original deployed pre-import expression also rejects paired-off before any config/module request. Offline, no vendor/API traffic.
