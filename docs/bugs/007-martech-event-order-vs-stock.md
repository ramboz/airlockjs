---
status: FIXING
tier: standard
severity: medium
regression_test: bug 007: the bridge posts calls in the order the tag made them
main_repro_checked_at: 2026-11-24
main_repro_ref: origin/vendor-adobe@f38ce3b9
main_repro_result: reproduces
red_confirmed_at: 2026-11-24
green_confirmed_at:
review_reopened_at: 2026-11-24T20:36:00Z
fix_class: structural_fix
security_surface: true
escalated_to:
closure_schema: 1
claimed_by: martech-event-order-bug-007
---

# Bug 007: martech-event-order-vs-stock

> **Acceptance ON HOLD (2026-11-24, coordinator 24).** The status was DONE at 7c427008 and is reopened to DIAGNOSING. `bug.py` has no
> `DONE` back-edge, so the frontmatter status was edited by hand (disclosed here). Why: (1) the oracle change relaxes 069-05 AC4's
> wording (event/page-view order equals stock's) instead of stopping on that conflict, so it must not stand as accepted; (2) the
> library's 2/24 egress-dispatch inversions against 0/24 stock SDK invocations are an unresolved behaviour difference that the
> multiset hides; (3) craft was recorded on 3441eeb5 and not on the final source (b1f7b889 and the 38e3b07a test rename), and the
> review files lack agent identities, round frontmatter and read times. The oracle change at 7c427008 stays on vendor-adobe only as
> an interim; nothing below is a closure claim.

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

- H1: the library reordered its own sends. **Confirmed in part** (see Root cause): the chamber shim posted a Blob-bodied `sendBeacon` to the bridge only after an async `Blob.text()` read, so a later `fetch` overtook it. The 068-03 no-park change is not the cause.
- H2: the recorder in `rig/adobe-b1-replay.mjs` (headers awaited before the push) mis-orders near-simultaneous requests. Falsified: push order equals the browser's request-start order in 48/48 arms.
- [x] H3 (leading, two causes): (a) the request-start order of the independent `collect`/`interact` pair is not fixed even for stock (stock SDK invocation 24/24 collect first, request start 14/24 inverted), so a strict start-order compare was unsound; (b) separately, a real library defect inverted the bridge-post order (the shim, H1).

## Root cause

Two findings, kept apart.

1. **Oracle (stock-vs-stock).** Stock Alloy alone starts the page-view `collect` and the `linkClicks` `interact` in either order under load (SDK invocation fixed 24/24, request start inverted 14/24). The layer between the SDK call and request start is not named (Chromium scheduling versus Playwright interception is not separated by the evidence). Comparing the arms index by index was unsound; the request-start multiset match at 76eac8d7 addresses only this.
2. **Library shim defect (witnessed).** `connectors/alloy/alloy-chamber.worker.js` `navigator.sendBeacon` posts to the bridge only after `data.text().then(send)` when the body is a Blob (Alloy 2.31.1 sends `new Blob([body])`; page view goes to `collect` by `documentUnloading` beacon), while `fetch` posted synchronously. A beacon issued before a fetch therefore reached the bridge, and main egress, after it. Witnessed in real Chromium with a synthetic chamber scenario (`sendBeacon(url, new Blob(...))` then `fetch` in one tick: bridge order `fetch, beacon` 3/3 red before the fix). Loaded b5 correlation (24 runs, 8 parallel pairs, 16 CPU hogs, bridge post order observed at the chamber tee): pre-fix 1/24 runs posted `interact` before `collect`, post-fix 0/24; stock SDK invocation was collect-first 24/24 in both samples. So the shim defect is shown to produce a library-only inversion at the bridge. The earlier 2/24 count was measured at main-thread egress and was not the same boundary; this sample measures the bridge post and is the comparable one. Not claimed: that the Blob read is the only source of every inversion ever seen.

Residual uncertainty: request-start order in the library arm still varies under load (post-fix 2/24 interact first, same as stock's 14/24), because it is decided after the bridge (main dispatch, Playwright, Chromium). The ordering fix does not and cannot control it.

Enumeration closing the set of order-affecting shim paths: within the worker shim every bridge post for `intercepted-fetch` goes through `post("intercepted-fetch", ...)`; `grep -n 'post("intercepted-fetch"' connectors/alloy/alloy-chamber.worker.js` returns the two sites (the `fetch` shim and the beacon `send`), both now through `postInOrder` or the reserved slot. `XMLHttpRequest` and `Image` paths are separate surfaces, left alone (see Call-site closure).

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

`structural_fix` for the shim ordering (a shim-local dispatch queue that preserves invocation order at the bridge-post boundary); the oracle change at 76eac8d7 stays `local_patch` for the stock-vs-stock request-start variation.

## Fix

`connectors/alloy/alloy-chamber.worker.js`: a shim-local ordered bridge queue. A Blob-bodied `sendBeacon` reserves its slot at call time and fills it when `Blob.text()` resolves; later `fetch` and beacon posts wait behind a still-pending slot and are posted in call order. With nothing pending the post is synchronous as before. A rejected read posts the beacon with an empty body, as before, and releases later calls; an exception in a queued post is rethrown (not swallowed) and never blocks the queue. No wait on network responses; consent and egress policy are untouched (main-side seal decides at dispatch, so a delay cannot bypass it).

`rig/b1-chamber-entry.js`: `rig:calls`, a rig command that makes ordered `fetch`/Blob/string-beacon calls inside the chamber.

`test/adobe-b2-egress.test.js`: the regression describe (real Chromium, synthetic chamber scenario). `test/adobe-b5-martech.test.js`: `expectInvocationOrder` adds a causal comparison to AC1 and AC4 (stock SDK `fetch`/`sendBeacon` invocation order versus the library's bridge-post order, collect then interact) while the request-start comparison stays permissive for the witnessed pair. The concurrent journey is unchanged. 069-05 AC1 and AC4 are not edited.

AC4 boundary: AC4 says the event/page-view order equals stock's. That is now asserted at the invocation boundary (stock: SDK call; library: bridge post) strictly, and at request start only as the witnessed multiset. Residual: the library's observation point is the worker's post, not the SDK call inside the chamber (the shim posts fetch synchronously and beacons in call order, so they coincide by construction and by the b2 regressions).

## Call-site closure

- `fetch` shim, Blob-bodied beacon, string/other-bodied beacon (`navigator.sendBeacon`): changed (all go through the ordered queue).
- `XMLHttpRequest` and `Image` shims: left alone (not in the witnessed path; Alloy 2.31.1 uses fetch/sendBeacon for edge calls).
- 069-05 AC1 and AC4: oracle keeps the request-start multiset for the witnessed pair and adds `expectInvocationOrder`; AC2, AC3, AC6, AC11, personalization-on callers and 069-03 loops stay strict. Spec ACs not edited.
- b2 egress consent seal: re-checked at main dispatch; the revocation-during-Blob-read test asserts the beacon is held at the seal.
- Concurrent journey: unchanged by decision.
- b4 064-24 redirect flake: out of scope, owned by the coordinator.

## Already tried

- Recorder push-order race in `rig/adobe-b1-replay.mjs` (falsified: push order equals request order).
- Serializing the journey (rejected: stops testing the concurrency).

## Regression test

`bug 007: the bridge posts calls in the order the tag made them` (real Chromium, synthetic chamber scenario, `test/adobe-b2-egress.test.js`): slow Blob beacon then fetch then fetch; slow Blob then fast Blob then fetch; slow Blob, fetch, string beacon; rejected Blob read then fetch; no-pending synchronous order; consent revoked during a Blob read (held at the seal). Revert-check: with the worker change stashed, the four ordering/error tests are red (4 failed, 2 passed: the no-pending path and the seal test hold on the old code by design); restored, all 29 b2 tests are green. The b5 AC1/AC4 `expectInvocationOrder` catches the pre-fix loaded inversion (1/24, invFail=1) and is 0/24 post-fix.

## Proof

Pending: exact-head CI and the reviews are recorded below when complete.

## Learning

A comparison oracle must only assert orders the reference itself keeps, and an ordering claim has to be measured at the same causal boundary in both arms; a measured library-vs-stock difference at a different boundary is not evidence either way.

## Release log

- 2026-11-24 - released claim from Building phase coordinator 23: coordinator 23 handed bug 007 to the bug-007 assignee (dispatched by coordinator 24)

## Main recheck

- 2026-11-24 - `origin/vendor-adobe@4e6189f9` -> reproduces: 069-05 personalization-off AC1/AC4 compare request order index by index; stock-vs-stock under load (16 CPU hogs, 8 arm-pairs, 24 runs, real Chromium) starts interact before collect in 14/24 runs, so the strict order assertion fails on a stock run alone. origin/main (67daba40) has no rig/ or b5 test; the oracle exists only on vendor-adobe.

## Reopened diagnosis (acceptance hold)

Status history: DONE at 7c427008, reopened by hand (bug.py has no DONE back-edge) to DIAGNOSING; diagnosis then proved a real shim defect and the bounded production fix was authorized by coordinator 24. The first static hypothesis is now witnessed (see Root cause). The old oracle-only reviews (3441eeb5 craft, b1f7b889 bug-review) do not cover the production fix and are superseded by the reviews recorded for the final source.
- 2026-11-24 - `origin/vendor-adobe@f38ce3b9` -> reproduces: real Chromium synthetic chamber scenario: sendBeacon(url, new Blob([body])) then fetch in one tick; bridge post order is fetch,beacon (3/3 red) on vendor-adobe f38ce3b9; main has no bridge-beacon shim
