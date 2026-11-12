---
status: DONE
tier: standard
severity: high
claimed_by: routing-continuity-implementation
regression_test: ^ledger capacity admits the fourth finite reservation after 38 resources without increasing its cap$
main_repro_checked_at:
main_repro_ref:
main_repro_result:
red_confirmed_at: 2026-11-10
green_confirmed_at: 2026-11-10
fix_class: structural_fix
security_surface: false
escalated_to:
closure_schema: 1
---

# Bug 002: admission-ledger-capacity

## Symptom

The fourth stock Adobe reservation can fail with
`fresh-pair-binding-invalid` while the existing per-arm request and resource
caps still permit it. This blocks capture completion before its shape checker.
The repair belongs to [051-09](../specs/051-adobe-integration-proving-ground/tasks.md#current-work-queue--051-09-only).

## Repro

Use a new synthetic finite no-offer binding in the existing control unit test.
Admit one context, one page, 38 resources and three detailed Adobe reservations.
The ledger has 43 records and exceeds 16384 bytes. `startEffect` still succeeds
and `isStopped()` remains false. The fourth reservation then throws
`fresh-pair-binding-invalid`, although its fixed request cap is four.
No browser, SDK, network or original run is needed.

## Evidence

- Writer base: `b7ce9f20d343642a6f2a3a345baf7ee659e75dce`.
- Original control SHA-256:
  `09a49100e9e9f250dbed0b331e981b98fb2c778bbfae0e3acec8123515fdde32`.
- `fresh-pair-execution-control.mjs` rejects a pre-append ledger size over
  16384 in `appendAdmission`, separately from its per-arm admission caps.
- The exact local regression failed on the fourth reservation in shell 2571.
  The preceding 43 records, valid binding effect and non-stopped state passed.
  This is a witnessed unit-test failure, not a `bug.py` red attestation.
- The approved one-command main-gate exception then allowed `bug.py` to
  witness the same failing regression and enter `FIXING` in shell 2594.
  The helper stamped `red_confirmed_at`; no other gate was bypassed.
- The coordinator's safe diagnosis ties the a113/b7 failure to a 16627-byte,
  43-record original ledger. Its spent root and original hashes remain
  immutable. This diagnosis makes no claim about historical 7a6.

## Hypotheses

- [x] H1 (leading): The storage ceiling is smaller than the ledger produced by
  the allowed admission budget. Confirm with a valid synthetic binding whose
  ledger exceeds 16384 before its fourth reservation.
- [ ] H2: The fourth request is over budget, stopped, expired or has invalid
  binding details. Falsify with three prior request records, remaining resource
  budget, successful guarded effects and a valid detailed fourth reservation.
- [ ] H3: All requests complete and only a downstream no-offer shape validator
  rejects capture. Falsified as this failure's primary cause by refusal inside
  the control primitive before the fourth reservation completes.

## Root cause

The fixed pre-append size check rejects legitimate ledger growth before the
existing finite-control budget is exhausted. Repeated fixed binding fields
make the complete resource and request history larger than 16384 bytes.
The local synthetic reproduction and safe original diagnosis agree on this
edge. This claim is limited to the reported a113/b7 failure, not every capture
failure or every writer in the repository.

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

Scoped Scout lookups for `appendAdmission` and the existing fixed-arm budget
test identified the writer and its caller in `consumeFreshPairRun`. The marker
file's separate 4096-byte check is not the admission ledger. No new writer or
log format is proposed.

**Relevant history inspected:**

The latest local owning commit for the control module is `e2727e00`; its bytes
still match the control hash bound by the coordinator. No main, remote ref,
other live worktree or archived transcript was inspected.

**Affected call sites:**

`consumeFreshPairRun().admit()` constructs and appends the ledger record under
the existing lock. `startEffect()` and `isStopped()` do not append it. Finite
no-offer and non-render bindings use four requests per arm; the original path
uses five. Each path still has one context, one page and 96 resources per arm.

**Reuse decision:**

Keep the existing locked, FD-checked, append-only, fsynced writer. Align its
bounded storage check with the complete existing budgets; do not truncate,
drop records, relax request/resource caps or add a replacement platform.

## Fix class

`structural_fix`: repair ledger storage capacity, not capture acceptance.

## Fix

Initially paused before `FIXING`: the standard fresh-main gate conflicted
with the explicit no-main restriction. Through the coordinator's `ask_user`,
the personal Owner selected exactly
"Approve the fresh-main-check exception for this repair only (Recommended)".
The question covered this exact pinned b7/051-09 admission-log repair.
No approval timestamp was supplied or inferred.

Apply `JIG_BUG_MAIN_CHECK_GATE=0` to that single
`ROOT_CAUSED -> FIXING` command only. All other diagnosis, closure, regression
and review gates remain enabled. The main-check fields stay empty because no
main, remote ref or other live worktree was inspected.
The single-command exception was used in shell 2594 before production edits.
Main remains uninspected, and all other gates stay enabled.

`appendAdmission` now limits the resulting ledger to 128 KiB, checking the
current file size plus the serialized UTF-8 line and newline before writing.
Its existing locked append, file-descriptor custody checks, record format and
fsync remain unchanged. No request, resource, context or page cap changed.
No record is truncated or dropped.

Complete two-arm synthetic histories with canonical 24-byte producer dates
contain 206 default records (19178 bytes), 204 no-offer records (77428 bytes)
and 204 non-render records (77836 bytes). Those measured producer histories
fit the storage bound; 64 KiB would not. Accepted date inputs can be longer,
so the resulting-byte guard remains necessary and is not justified by a
universal per-record size assumption.

## Call-site closure

<!-- Spec 091 / ADR-0037: before REVIEWED, account for every site named
     in the inventory above as changed, tested, or intentionally left
     alone. Accounting, not mandatory widening. -->

**Disposition per affected site:**

- `appendAdmission`: changed only its storage ceiling and resulting-byte
  calculation. File type/owner/mode/link/inode checks and fsync remain.
- `admit`: unchanged. Tests fill both arms and reject the next context,
  page, resource and Adobe admission at their original caps.
- `startEffect`, `isStopped`, consumed markers and STOP: unchanged. Tests
  retain same-run/non-reuse, deadline, original inventory identity, STOP
  substitution and post-STOP effect refusal.
- Capture acceptance, recorder, SDK, profile/grants and deployed assets:
  intentionally unchanged. This fix addresses admission-log capacity.

## Already tried

No replay of the consumed root or loosening of capture validation. The external
coordinator regression was read as a recipe only and adapted into this writer's
own exact test/import.
The initial oversized-date test used padded ISO text rejected by `Date.parse`
before the storage path. It was corrected to a parseable padded RFC date.
Shell 2600 then witnessed the original writer accepting an oversized record.

## Regression test

`test/adobe-fresh-pair-execution-control.test.js`:
`ledger capacity admits the fourth finite reservation after 38 resources without increasing its cap`.
The runner was the existing physical Vitest dependency with that exact anchored
selector, under sanitized HOME/TMPDIR and PATH. It exited 1 in shell 2571.
The test harness removes its exact synthetic directory in `afterEach`.
For the lifecycle's red/green attestations, use Jig's supported temporary
`.jig/test-command` override with the same fixed file and `{test}` selector.
It invokes the approved Node/Vitest directly, with no `npx` or installation.
Remove that task-local override after lifecycle validation.
Additional cases cover complete default/no-offer/non-render occupancy, rejection
of each next admission, preservation of every original record, finite resulting
storage, an exact 131072-byte UTF-8/newline boundary, and symlink/hardlink/mode
refusals without byte changes. No independent-process or browser case is selected.

## Proof

The reported regression and complete-budget cases failed before production
edits (shells 2571, 2594 and 2598). The valid oversized-record counterexample
failed in shell 2600. After the fix, all eight then-current ledger cases passed
in shell 2602.

The final exact control selection passed 23 tests in shell 2604, with one
independent-process test excluded. It includes all nine new ledger cases and
the original in-process custody/STOP/budget/deadline guards. Exact source/test
lint, syntax and whitespace passed; all 26 retained browser-source input hashes
are unchanged. No compile, installation or live sample occurred.
Independent [bug-review](reviews/bug-005-bug-review.md) and
[craft](reviews/bug-005-craft.md) passed after reading the complete five-file
candidate patch and relevant source context. Both were static reviews; they
did not claim independent test execution.

With every remaining gate enabled, `bug.py transition 002 REVIEWED` ran the
named regression green and stamped `green_confirmed_at` in shell 2618.
The task-local `.jig/test-command` override was then removed. No `npx` or
dependency installation was used.

## Learning

Recorded in [project memory](../memory/learnings.md):
"Bug 002: admission ledger capacity is not admission authority".
Keep storage bounds compatible with complete permitted histories and check
the resulting UTF-8 bytes. All spent runs, UNKNOWNs and old STOP residuals
remain unchanged.
