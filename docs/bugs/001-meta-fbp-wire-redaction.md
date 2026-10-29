---
status: DONE
tier: gnarly
severity: medium
claimed_by: google-and-meta-feasibility
regression_test: test/parity-meta-fbp.test.js
main_repro_checked_at: 2026-10-29
main_repro_ref: origin/main@a4008d5ddb8f10b459500921bf974a064de2beca
main_repro_result: reproduces
red_confirmed_at: 2026-10-29
green_confirmed_at: 2026-10-29
fix_class: structural_fix
security_surface: true
escalated_to:
closure_schema: 1
---

# Bug 001: meta-fbp-wire-redaction

## Symptom

The Meta reference redactor leaves a real wire `fbp` value intact, and the
curated comparison skips that field. The transport ledger names the cookie
rather than its observed wire field. The same retained reference documents
`aud`, `cud` and `ncud` identity variants that the redactor also passes through.
This is a privacy and reporting defect in offline tooling, not a finding of
production transmission or a claim that the connector supports identity.

## Repro

Run the dedicated synthetic-data regression test. A real-capture-derived
fixture also exercises the existing report without exposing live values.

## Evidence

- `test/fixtures/meta-tr-pageview.redacted.json` records `fbp` and the three
  identity variants; the current local no-send reference also observes `fbp`.
- `rig/parity/redact.js` checks `_fbp` and `ud[` but passes other keys through.
- `rig/parity/descriptors/meta.js` curates `_fbp`, not `fbp`.
- On the unchanged source shared with freshly fetched `origin/main`, a
  synthetic `fbp` value remained unredacted and its oracle field was absent.

## Hypotheses

<!-- Anti-anchoring: >=2 candidates, mark the leading one. Any Markdown
     list works (-, *, +, or 1.); the gate counts top-level items only
     (indented sub-bullets are notes, not hypotheses). -->
- [ ] H1: The generic comparison engine changes or strips the real wire key.
  Falsified: it examines exactly the descriptor's listed names.
- [x] H2 (leading): The vendor descriptor and redactor use synthetic fixture
  vocabulary instead of all observed identity keys. Confirmed by the source
  branches, historical fixture and synthetic reproduction.

## Root cause

The vendor-specific identity vocabulary is incomplete: `_fbp` is a cookie
name in the synthetic fixture, while the observed request uses `fbp`. The
redactor also recognizes only one of the recorded matching-identity namespaces.
The comparator consumes the descriptor's explicit field list, so an omitted
wire key is never classified.

## Repository closure inventory

<!-- Spec 091 / ADR-0037: pre-fix repository closure. Standard & gnarly
     bugs gate ROOT_CAUSED -> FIXING on substantive answers below. This
     is an effort-and-protocol standard, NOT a completeness proof: show
     the search you actually ran. A bare "none found" fails; record
     residual uncertainty as an assumption WITH the protocol behind it,
     applying the same enumeration standard as `## Root cause` (ADR-0052).
     Prefer a configured semantic index; the portable floor is targeted
     search + `git log`/`git blame`. -->

**Equivalent / convergent logic searched:** `fbp`, `_fbp`, `aud[`, `cud[`,
`ncud[`, `redactMetaBeacon`, `metaParityDescriptor`, and `firstPartyIdentity`
under `rig` and `test`. The generic oracle and transport ledger consume the
shared descriptor; the existing Meta redactor is the applicable helper.

**Relevant history inspected:** `git log -- rig/parity/redact.js
rig/parity/descriptors/meta.js` and the 038-04 criteria show the synthetic
`_fbp` case was retained deliberately while the real `fbp` follow-up was
left open. The freshly fetched main sources match the affected files.

**Affected call sites:** the Meta parity CLI, advanced-matching tests and
transport CLI read the same descriptor or redactor. The generic oracle and
transport report consume descriptors for multiple vendors and must preserve
their shared contracts. Follow-up review found the separate
`rig/meta-pageview-prototype-report.mjs` comparator, called by the offline
`rig/meta-pageview-prototype.mjs` example; it also compares cookie placeholders.

**Reuse decision:** extend the existing redactor and descriptor; preserve the
legacy `_fbp` key as a distinct field, without equating it to `fbp`. Generic
oracle and report hooks consume optional vendor-supplied policies; other
descriptors retain their prior behavior. Text searches do not establish that
no external consumer exists; public ledger names change from `_fbp` to `fbp`.
The prototype comparator and parity descriptor share the same Meta-specific
cookie-placeholder predicate; the separate native comparison uses a broader
structural sentinel check and is not changed.

## Fix class

Structural fix to observed-key redaction and field classification.

## Fix

Redact observed `fbp` and matching-identity namespaces while preserving their
original keys. Classify `fbp` separately from legacy `_fbp`; report the `fbp`
wire gap in both transport cohorts. Compare original values and redact Meta
report fields after comparison. Known cookie placeholders yield an
`unverifiable` field and a nonzero, inconclusive result, not a closed gap.
The owner approved an amendment to the historical spec; unknown fields still
require inspection.

## Call-site closure

<!-- Spec 091 / ADR-0037: before REVIEWED, account for every site named
     in the inventory above as changed, tested, or intentionally left
     alone. Accounting, not mandatory widening. -->

**Disposition per affected site:** The existing Meta redactor, descriptor,
generic oracle and report, and transport declaration changed. The Meta CLI
and advanced-matching, transport and generic oracle consumers were tested.
The added matching-identity namespaces are redacted; the existing 038-04
descriptor exclusions and presence-only hashed-field comparison are unchanged.
The legacy `_fbp` fixture and its distinct gap entry are retained, not
translated into `fbp`; the generic transport ledger logic is unchanged. The
release baseline identifies the remaining continuity gap, not the fixed
spelling. The offline PageView prototype comparator uses the shared predicate
and its report tests cover placeholders on either side as well as real values;
its example and worker tests remain local and do not claim vendor parity.

## Already tried

The earlier descriptor explicitly scoped `_fbp` checking to a synthetic
fixture; it did not cover the observed `fbp` wire key.

## Regression test

`test/parity-meta-fbp.test.js` checks redaction of both identity spellings and
the recorded matching variants, real-fixture classification without a
wire-name alias, both transport cohorts, placeholder ambiguity and sanitized
reporting without suppressing original-value differences. A follow-up test
covers the native comparator's known redaction markers on either side of
each cookie identity field. `test/meta-pageview-prototype-report.test.js`
independently exercises the second comparator and real-value controls,
including real-shaped values containing the word `redacted`.

## Proof

The fresh-main reproduction failed before the patch; `bug.py` witnessed the
new regression file red before `FIXING`. A second red run exposed the report
and placeholder review findings. A third red run exposed `[REDACTED]`
being mistaken for a real identity; the marker matrix passed after the
correction. Nine parity test files passed 110 tests and the changed JavaScript
files passed lint at that stage. Later tests witnessed the prototype false
`literal-match`, a hyphenated redaction marker and overbroad marker matching
before correction. The complete parity and Meta prototype selection passed
149 tests across 14 files; the changed JavaScript passed lint.
The original reported repro was rerun and returned `redacted=true, tracked=true`.
The lifecycle green gate independently ran the regression test at REVIEWED.

## Original repro verification

The original synthetic `fbp` reproduction was rerun on the corrected worktree:
`redactMetaBeacon` replaced the synthetic input and `diffParity` included its
`fbp` field, returning `redacted=true, tracked=true`. Before the fix on
`origin/main`, both checks returned false. This attests the reported tooling
defect, not native identity continuity or attribution.

## Learning

The cookie name is not necessarily the wire-field name. Redaction and
comparison must retain the observed name and never use matching synthetic
placeholders as proof of same-user identity.

## Main recheck

- 2026-10-29 - `origin/main@a4008d5ddb8f10b459500921bf974a064de2beca` -> reproduces: Synthetic fbp redaction and oracle reproduction returned redacted=false, tracked=false; git diff against fetched origin/main for both modules and reference fixture is empty.
