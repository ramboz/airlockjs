---
status: FIXING
tier: standard
severity: medium
regression_test: bug 007: the page-view collect and the event interact are matched against stock in either start order
main_repro_checked_at: 2026-11-24
main_repro_ref: origin/vendor-adobe@4e6189f9
main_repro_result: reproduces
red_confirmed_at: 2026-11-24
green_confirmed_at:
fix_class: local_patch
security_surface: false
escalated_to:
closure_schema: 1
claimed_by: martech-event-order-bug-007
---

# Bug 007: martech-event-order-vs-stock

## Symptom

On CI the 069-05 personalization-off AC1/AC4 journey (`test/adobe-b5-martech.test.js`, `sameAsStock`)
failed on request order: the Airlock martech library sent the `interact` request before `collect` and
reversed the `linkClicks` / `pageViews` events, while stock Alloy sent `collect` and then `interact`.
Not reproducible locally on an idle machine (40/40).

## Repro

CI only on the original reports; locally it needs load. Real Chromium, `AIRLOCK_REAL_CHROMIUM=1`, the 069-05
personalization-off journey (`displayJourney`, shared by AC1 and AC4) with eight arm-pairs running at once and 16
busy-loop processes on a 12-CPU machine, 24 runs, instrumented four ways per arm (page-side invocation, route-handler
entry, request start, completion). The scratch generator and the per-run labelled sequences are kept in the assignee's
session files (not committed; no captures, SYNTHETIC answers).

Governing acceptance: 069-05 AC1 ("sends the stock run's requests") and AC4 ("the order of the event versus the page
view equals the stock run's"), `docs/specs/069-airlock-martech-library/slice-05-library-display-flows.md` lines 21 and 24.
Both are defined relative to the stock run; neither asks for a stable order beyond matching stock.

## Evidence

- CI run 45262070431, attempt 2, and run 45260673545, attempt 1 (no `meta.state.domain` diff in the latter,
  so it is independent of [bug 006](006-post-fold-oracle-stock-domain.md)). Earlier CI run 45238356339 attempts 1 and 2
  also showed the :450 order diff.
- 24 loaded runs, 48 arms. Order of the two independent sends (`collect` = page view, `interact` = `linkClicks`),
  `set-consent` always first:

  | view | stock c→i | stock i→c | library c→i | library i→c |
  |---|---|---|---|---|
  | SDK invocation (stock: the SDK's fetch/beacon call; library: the main-thread egress dispatch) | 24 | 0 | 22 | 2 |
  | route-handler entry = request start (identical in 48/48 arms) | 10 | 14 | 18 | 6 |
  | completion (`requestfinished`) | 9 | 15 | 16 | 8 |

- Representative stock permutations (both occurred in the stock arm of the same loaded run set):
  `set-consent > collect|pageViews > interact|linkClicks` (10 of 24) and
  `set-consent > interact|linkClicks > collect|pageViews` (14 of 24). The library arm produced the same two.
- Idle machine: every view collect→interact in both arms (4/4 here, 40/40 earlier).
- The test's recorder is not the source: its `network[]` order equals Playwright's own request-start order in 48/48 arms.

## Hypotheses

- H1: the 068-03 no-park change reordered the library's queued sends. Falsified: stock alone shows both orders, with no
  library code involved, and the library's serial queue changed nothing for the stock arm.
- H2: the recorder in `rig/adobe-b1-replay.mjs` (headers awaited before the push) mis-orders near-simultaneous requests.
  Falsified: push order equals the browser's request-start order in 48/48 arms.
- [x] H3 (leading): the two sends have no defined relative start order, so a strict order compare of the two arms is
  an unsound oracle under load. Confirmed by the stock-vs-stock counts above: stock's invocation order is fixed (24/24) but
  its request-start order varies (14/24 inverted).

## Root cause

The oracle asserts an order the system under test does not guarantee. In the personalization-off journey the page-view
`collect` and the `linkClicks` `interact` are issued by independent paths, and under load stock Alloy alone starts them in
either order: its SDK invokes them in a fixed order (24/24) but the requests start inverted in 14/24 runs. The variation
therefore enters between the page-visible SDK call and the request start. The evidence cannot separate Chromium's own
scheduling from Playwright's route interception, so the layer is not named further. The library arm shows the same two
orders (6/24 inverted at request start, 2/24 already at its egress dispatch). `sameAsStock` compared the arms index by
index, so a stock run that happened to start inverted, or a library run that did, failed AC1/AC4 without any behavioural
difference. Enumeration closing the set: the only assertions that compare the arms' request order are `sameAsStock`'s
URL-list `toEqual` and per-index body loop (one definition in this file, called from the 069-05 tests) and AC4's
`eventTypes` `toEqual`; `grep -n "sameAsStock\|eventTypes(l)" test/adobe-b5-martech.test.js` returns the complete set
because both helpers are file-local.

## Repository closure inventory

<!-- Spec 091 / ADR-0037: pre-fix repository closure. Standard & gnarly
     bugs gate ROOT_CAUSED -> FIXING on substantive answers below. This
     is an effort-and-protocol standard, NOT a completeness proof: show
     the search you actually ran. A bare "none found" fails; record
     residual uncertainty as an assumption WITH the protocol behind it,
     applying the same enumeration standard as `## Root cause` (ADR-0052).
     Prefer a configured semantic index; the portable floor is targeted
     search + `git log`/`git blame`. -->

**Equivalent / convergent logic searched:** terms `sameAsStock`, `eventTypes(`, `splitRequestUrl`, `diffBodies`, `network[]`, `.stable`, `toEqual(order`
over `test/` and `rig/` (`git grep`). Existing order-tolerant compares: none for requests (`normalised` only sorts cookie
entries inside a body, "not part of the contract"; that is the precedent for tolerating an undefined order, and it keeps the
body otherwise exact). No equivalent multiset matcher exists in `rig/adobe-b1-replay.mjs`.

**Relevant history inspected:** `git log -S"sameAsStock"` and `-S"eventTypes(l)).toEqual(order)"` on the b5 test: both arrived
with 069-05 (5166c066, 6b00eab5), when the journeys were only run idle (40/40). `git log -- docs/bugs/006-...` for the sibling
oracle bug: 006 made the stock arm a pure stock page and did not touch order.

**Affected call sites:** `sameAsStock` (b5 test, one definition) and its callers: personalization-off AC1 (order-sensitive,
sampled), AC2, AC3, AC6, AC11 and the other display flows (personalization on, display follows the fetch response, not sampled);
AC4's own `eventTypes(l)` `toEqual`; the per-index body loops in the 069-03 describe (default journey, not sampled);
`test/adobe-b4-personalization.test.js` 064-24 redirect order (separate flake, coordinator 24 owns it).
Residual assumption: the 24-run sample covers only the personalization-off journey, so other journeys are not shown to
share the variation; protocol: they stay strict until a permutation is witnessed there.

**Reuse decision:** reuse `splitRequestUrl`, `diffBodies` and the file's `normalised`; add one file-local matcher
(`alignIndependentSends`) rather than loosening `sameAsStock` for every caller. Rejected: serializing the journey (stops
testing the concurrency), sorting requests or normalising bodies (would hide a changed body or event).

## Fix class

`local_patch`: the oracle compared an order that stock itself does not keep; the fix is confined to the test's comparison helper.

## Fix

`test/adobe-b5-martech.test.js`: `alignIndependentSends` matches the page-view `collect` and the `linkClicks` `interact` (the two independent sends) as a multiset of complete normalized request records (stable URL plus body, event identity and in-request event order untouched); `compareRequests` then compares URLs and bodies index by index as before. Set-consent must still be first in both arms, and call-name multiplicity must be equal. AC1 and AC4 (personalization off) use it; nothing else does. Serializing the journey was rejected so the concurrency under test is kept.

## Call-site closure

<!-- Spec 091 / ADR-0037: before REVIEWED, account for every site named
     in the inventory above as changed, tested, or intentionally left
     alone. Accounting, not mandatory widening. -->

**Disposition per affected site:**

- 069-05 AC1 (personalization off): changed, uses `independent`.
- 069-05 AC4: changed, event order is read from the aligned list and compared with stock's.
- AC2, AC3, AC6, AC11, the personalization-on callers and the 069-03 loops: left strict (not observed varying; stock-order dependent by design).
- Concurrent journey: unchanged by decision.
- b4 064-24 redirect flake: out of scope, owned by the coordinator.

## Already tried

- Recorder push-order race in `rig/adobe-b1-replay.mjs` (falsified: push order equals request order).
- Serializing the journey (rejected: stops testing the concurrency).

## Regression test

`bug 007: the page-view collect and the event interact are matched against stock in either start order` (hermetic, in `test/adobe-b5-martech.test.js`). It accepts both stock permutations; sibling tests reject a changed event, body or in-request event order, a missing or duplicate request, and consent ordering violations. Revert-check: with alignment disabled the accepting test is red (1 failed, 3 passed).

## Proof

Loaded 24-run sample (16 hogs, 8 arm-pairs, real Chromium): the strict oracle fails 6/24 on stock alone, the aligned oracle 0/24, AC4 0/24. Red witnessed 2026-11-24 via `bug.py`; real-Chromium b5 file 17 passed; `npm test` and `npm run lint` green. Observation, not root cause: the library's main-thread dispatch inverted in 2/24 runs (stock SDK invocation 0/24).

## Learning

A comparison oracle must only assert orders the reference itself keeps; measure reference-vs-reference variance under load before asserting a sequence.

## Release log

- 2026-11-24 - released claim from Building phase coordinator 23: coordinator 23 handed bug 007 to the bug-007 assignee (dispatched by coordinator 24)

## Main recheck

- 2026-11-24 - `origin/vendor-adobe@4e6189f9` -> reproduces: 069-05 personalization-off AC1/AC4 compare request order index by index; stock-vs-stock under load (16 CPU hogs, 8 arm-pairs, 24 runs, real Chromium) starts interact before collect in 14/24 runs, so the strict order assertion fails on a stock run alone. origin/main (67daba40) has no rig/ or b5 test; the oracle exists only on vendor-adobe.
