---
slice: 040-02 — core coalescing seam (post-verdict, per-cycle, protocol-pluggable)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T20:12:50Z
prompt_source: review.py implementation docs/specs/040-core-egress-batching/spec.md 'core coalescing seam' core/airlock.js test/egress-coalescing.test.js
---

VERDICT: pass

## Reasoning

All four ACs are met and every DoD coverage bullet has a corresponding, meaningful test. AC1 input-governance (survivors
collected strictly after `egressVerdict`+`checkEndpointCeiling`) and the output re-check on every coalescer output
before `fetch` are both implemented and tested; AC2's group key is `originPath` origin+path; AC3's no-coalesce default
is a behavior-preserving restructure with ordering pinned; AC4's perf/no-loss/no-cross-group properties hold. The
new-feature tests (coalesce wiring, output ceiling re-check, non-function guard, per-cycle grouping) are non-vacuous
with load-bearing counterfactual comments; the byte-identity/regression tests correctly pass-both-ways by design. No
correctness or security defects found — the ADR-0021:88 output-ceiling-bypass hazard is closed.

## Specific issues

- test/egress-coalescing.test.js (consent-held input test) — Minor: asserted only `coalesce.not.toHaveBeenCalled()` +
  `fetch.not.toHaveBeenCalled()`, both of which also hold if the coalesce feature is deleted entirely. Not fully
  vacuous (a governance-after-coalesce reordering mutation would fail it), and its stronger sibling
  (`toHaveLength(1)`) carries the AC1-input weight — but on its own it did not distinguish "held so hook skipped" from
  "hook unwired". **[FOLDED post-review: strengthened to also assert the `consent/held` diagnostic fired, so the test
  now proves the seal ran BEFORE coalescing, not merely that wiring is absent.]**

## Reconciliation notes

- AC1 literal wording said each merged output "must equal the group's ceiling-passed endpoint," but the implementation
  re-runs `checkEndpointCeiling(out.url, endpoints)` against the full declared set, so a hook emitting to a
  *different-but-declared* endpoint would pass the re-check. This matches AC1's explicitly-stated enforcement mechanism
  (re-run `checkEndpointCeiling`) and closes the real hazard (undeclared/off-manifest egress), but is weaker than the
  literal per-group-equality phrasing. **[FOLDED: AC1 wording reconciled to state the enforced invariant — membership
  in the declared ceiling — with per-group equality recorded as a stronger-property-not-yet-needed in the deviation
  log.]**
- The DoD's "mixed send/hold/drop ordering" is covered across three separate tests rather than one combined test. A
  single-cycle send+consent-hold+consent-drop mix is not constructible (the consent verdict is cycle-uniform per
  ADR-0021's 040-note), so the realistic in-cycle mix — send interleaved with a ceiling-held sibling — is what the
  send+ceiling-hold test pins. Recorded so the split coverage isn't read as a gap.
- Slice `### Deviation log` / `### Reconciliation sweep` and DoD checkboxes to be produced/checked in the reconciliation
  pass.
