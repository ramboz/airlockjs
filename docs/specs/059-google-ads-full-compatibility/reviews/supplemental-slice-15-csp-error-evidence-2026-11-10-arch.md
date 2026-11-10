---
slice: 059-15 - Exact native policy and one-shot stock capture
pass: arch
verdict: pass
reviewer: jig:reviewer gpt-6.1-sol/default 3eac2ef1-42ed-403e-a862-502c510be716
reviewed_at: 2026-11-10T04:54:58Z
prompt_source: review.py arch-review spec.md 059-15; private google-csp-arch-prompt.txt; retained actual final-revision followups
substrate: not-shown
applied_skill: none
---

# Supplemental CSP error-evidence architecture, 2026-11-10

Actual agent `3eac2ef1-42ed-403e-a862-502c510be716` was dispatched as
`jig:reviewer`, `gpt-6.1-sol`/`default`. The coordinator's `read_agent`
metadata reported model `gpt-6.1-sol`, elapsed134s, idle state and one turn. Runtime context
was NOT_EXPOSED. Selected rubric: `arch-review`; generated prompt:
`google-csp-arch-prompt.txt`. This is a bounded source supplement, not
full059 acceptance.

## Initial review

VERDICT: needs-changes

REASONING:
The packet reuses the existing Google-operation recorder and preserves the
private tooling boundary, finite retention and default dispatch. One
evidence/decision split remains: the CSP console subcheck can complete while
its retained witness is UNKNOWN. This is a local architecture finding, not a
re-review of full059 acceptance criteria or browser behavior.

SPECIFIC ISSUES:
- [blocker][impl] `rig/local-browser-foreground.mjs:435` sets
  `cspDenialObserved` before stricter retained-witness validation at451-459.
  The acceptance gate at1146 consumes only that boolean. Foreign/prefix-bearing
  text can satisfy the CSP console subcheck while `cspConsoleWitness` stays
  UNKNOWN. Require accepted retained console evidence or keep the case
  inconclusive. The controls at
  `test/local-browser-foreground.test.js:1331` inject an independent unexpected
  failure, so they do not isolate this acceptance path.
- [strength][impl] At601, unexpected failure is recorded before diagnostic
  getters. Identity uses the existing fixed manifest validator; unavailable
  details remain bounded UNKNOWN fields.
- [strength][impl] At210, timeline exhaustion is fatal; failure-code
  deduplication bounds recursion. Dispatch1494-1546 confines observations to
  Google operations without a new selector or public contract.

RECONCILIATION NOTES:
The reviewer applied technical-soundness, failure-mode, compatibility and
trust/evidence-boundary perspectives, not a broader redesign. Scout/schema
discovery was unavailable; narrow read-only UNINDEXED fallback inspected
supplied patch/binding, focused source/test edges, slice criteria/DoD and dated
documentation. No hash/base-custody authentication, dependency access,
commands/tests/browser/network execution or file writes occurred.

Supplied29-test/lint results are attributed documentary evidence, not execution
by the reviewer. The blocker was sent to the retained generic Terra implementer
for isolated RED/GREEN and the smallest source correction. It remains OPEN
pending actual same-reviewer closure.

Terra then corrected the gate and added isolated foreign, prefix, unbound,
location, oversized and missing-witness controls without an independently
injected unexpected request failure, plus accepted-known coverage. The gate
RED has three failures and three passes. Foreign/prefix/unbound evidence
advanced to the later fake case and failed `readable-outcome`, not an overall
journey PASS. Coordinator shell2349 independently passed36 Google-only tests
(105 skipped,141 total) and scoped lint, with stable source hashes. Actual
final source compliance/craft/architecture followups remain pending.

## Permanent provenance limitations

Terra read/copied MAIN dependencies after `MODULE_NOT_FOUND`; earlier broad
selectors and the coordinator127-test run also executed controlled Meta fakes
outside Google-only scope. No actual Chrome/Meta SDK/vendor traffic was
reported for those runs. Clean custody and dynamic/earlier indirect-write
absence remain NOT_ATTESTED. The own-copy lexical-link audit and prospective
Node22/direct-local validation permission do not retroactively approve them.

Both parent157 checkpoints and consumed grants remain historical. Full059
stays needs-changes,059-15 IN_PROGRESS,059-01 READY_FOR_REVIEW and
Accepted0050/51/52 unchanged. The later finite plan remains NOT_ADMITTED;
the original06:07:43.859757Z ceiling is unchanged.

## Same-reviewer final source closure

The same reviewer returned local PASS on the final source. `read_agent`
reported model `gpt-6.1-sol`, elapsed775s, idle state and two turns. Runtime
context was NOT_EXPOSED.

The console-evidence gate blocker is closed. Successful retention, validated
text and known location now precede the denial flag at foreground457.
Acceptance1146-1148 additionally requires the retained loaded-frame record
with expected URL, produced after body and policy verification. Six isolated
rejection controls at test1398 require exactly
`csp-console-observation-deadline`; accepted-known evidence reaches the later
fake case while keeping the journey FAILED. Original-error-first handling,
fatal recorder exhaustion, guarded frame diagnostics and budget/error/getter
controls remain intact.

Supplied final coordinator artifacts report36 Google-only passes/105 skipped,
lint0 and matching before/after hashes consistent with the final binding.
This is supplied-artifact consistency, not independent hash/base/custody
authentication or reviewer execution. The initial needs-changes review above
is retained as historical evidence.

The followup was narrow read-only UNINDEXED because Scout/schema discovery was
unavailable. No commands, tests, writes, dependency execution, main checkout,
Chrome or network were accessed. All permanent provenance, correlation and
inherited nonclearance limitations remain.
