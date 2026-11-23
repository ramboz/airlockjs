---
status: REPORTED
tier:
severity:
claimed_by: bug-006-post-fold-oracle
regression_test:
main_repro_checked_at:
main_repro_ref:
main_repro_result:
red_confirmed_at:
green_confirmed_at:
fix_class:
security_surface: false
escalated_to:
closure_schema: 1
---

# Bug 006: post-fold-oracle-stock-domain

## Symptom

`test/adobe-b5-martech.test.js` (real Chromium, GATING step of the `browser-oracle` job) failed with
`expected ['meta.state.domain'] to deeply equal []` in the library-versus-stock compare (069-03 S10 and AC6),
and the same diff appeared in the b4 064-24 redirect compare. Post-fold, about 3 of 4 CI attempts at times,
then none for hours; never locally (39/39 idle). The 069-05 order diff seen alongside it is a separate
defect: [bug 007](007-martech-event-order-vs-stock.md).

## Repro

CI only. Failures clustered in two time windows on 2026-11-23 (about 18:04-18:46Z and 20:11-20:41Z, and again in a diag run at 22:34Z).

## Evidence

- Runner image, runner version and Chromium were identical for red and green attempts.
- Diag run 45262070431 attempt 2: library `meta.state.domain` was the full page host, stock's was `""`.
- Diag run 45278072531 attempt 2 (cookie tracer): on the stock page, the chamber's `reconcile` wrote
  `com.adobe.alloy.getTld=com.adobe.alloy.getTld; path=/` into the real jar at 136 ms; stock Alloy's own
  apex probe read it back at 151 ms (`t.get(X)` truthy on its first loop test), so it wrote no domain cookie
  and returned `""`; the chamber removed its copy at 153 ms. In the green traces the chamber's write and
  removal finish before Alloy probes, and Alloy writes its own `domain=` probe cookies.
- Pinned Alloy 2.31.1 probe: `for(;o<r.length&&!t.get(X);) ... return t.remove(...), n` with `n` starting `""`.

## Hypotheses

<!-- Anti-anchoring: >=2 candidates, mark the leading one. Any Markdown
     list works (-, *, +, or 1.); the gate counts top-level items only
     (indented sub-bullets are notes, not hypotheses). -->
- [x] H1 (leading, confirmed): the stock page also boots the chamber, which mirrors its own Alloy's probe
  cookie into the jar for ~15 ms; a stock probe inside that window returns `""`. Confirmed by the tracer capture above.
- [ ] H2: the fold's 068-03 no-park path or the extra opt-out registration changed library-side domain writes.
  Falsified: the library side's domain is the full host in every red capture; only stock's differs.
- [ ] H3: cookie or storage shared between the sequential arms. Falsified: `replayFixture` makes a fresh browser
  context per call.
- [ ] H4: stock's domain resolution varies under load by itself (stock-versus-stock). Partly true: the window is
  timing-dependent, but it only opens because of the chamber's mirrored write.

## Root cause

The rig page boots the airlock chamber in every arm, including stock ones. The chamber's Alloy probes
`com.adobe.alloy.getTld` and the adapter's `reconcile` mirrors that write into the real jar. When stock Alloy's
own probe on the main thread lands in the few milliseconds before the chamber's removal, stock sees the cookie,
skips its own `domain=` writes and reports an empty domain. The fold's extra boot work shifted the chamber's
timing so the windows overlapped on loaded runners; the library arm is unaffected. A harness artifact: no
production code path has a stock tag and a chamber sharing a page.

## Repository closure inventory

**Equivalent / convergent logic searched:** `getTld` and `reconcile` across `adapters/eds/index.js`,
`connectors/alloy/sync-cookie-cache.js`, `rig/` and the pinned bundle; `document.cookie` hooks in `rig/`. No
existing rig-side filter for the probe cookie.

**Relevant history inspected:** `git log -S getTld` on the adapter and rig; `probeApexDomain` untouched by the fold.

**Affected call sites:** every `replayFixture` page (all arms); the b5 and b4 stock-arm compares are the ones that read it.

**Reuse decision:** extend the shared `PAGE_SCRIPT` in `rig/adobe-b1-replay.mjs`, no per-test change.

<!-- Spec 091 / ADR-0037: pre-fix repository closure. Standard & gnarly
     bugs gate ROOT_CAUSED -> FIXING on substantive answers below. This
     is an effort-and-protocol standard, NOT a completeness proof: show
     the search you actually ran. A bare "none found" fails; record
     residual uncertainty as an assumption WITH the protocol behind it,
     applying the same enumeration standard as `## Root cause` (ADR-0052).
     Prefer a configured semantic index; the portable floor is targeted
     search + `git log`/`git blame`. -->

**Equivalent / convergent logic searched:**

**Relevant history inspected:**

**Affected call sites:**

**Reuse decision:**

## Fix class

guardrail (test harness)

## Fix

`PAGE_SCRIPT` wraps the `document.cookie` setter and drops a write whose name is the Alloy probe cookie and whose stack passes through `reconcile` (the chamber's mirror). Every other write, including the tag's own probe, goes through. No oracle comparison, library code or production code changes.

## Call-site closure

**Disposition per affected site:** all `replayFixture` pages: changed once, centrally. The b5 and b4 compares: unchanged. `core/`, adapters and connectors: left alone (no production change).

<!-- Spec 091 / ADR-0037: before REVIEWED, account for every site named
     in the inventory above as changed, tested, or intentionally left
     alone. Accounting, not mandatory widening. -->

**Disposition per affected site:**

## Already tried

Diagnostic prints in the b5 compare and the rig (scratch branch, deleted); a bisect was skipped because failures were time-clustered, not code-clustered.

## Regression test

`test/adobe-b5-martech.test.js`: "bug 006: the rig keeps the chamber's mirrored probe cookie out of a stock tag's reach". Fails without the rig change (revert-checked locally: `expected true to be false`), passes with it. The original CI symptom does not reproduce locally, so the CI sample below is the proof for the real compare.

## Proof

## Learning

## Proof (status: fix landed, review and 5-green proof outstanding)

Pre-fix: the `meta.state.domain` mismatch was red in about 3 of 4 attempts during its windows (runs listed under Evidence).
Fix head e02d67f4, 5 scratch runs (45282879295, 45282898307, 45282902969, 45282909765, 45282914321): the domain
mismatch appeared in 0 of 5. Runs 45282879295 and 45282909765 were red only on the 069-05 AC1/AC4 order diff
([bug 007](007-martech-event-order-vs-stock.md)), the other three were fully green. The "5 consecutive green" bar
is not met because bug 007 (owner: coordinator 23) keeps the job red about 2 in 5. The bug-review and craft passes
have not been run (stop rule reached), so this record stays at FIXING.
