---
status: REPORTED
tier:
severity:
claimed_by: Building phase coordinator 23
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

# Bug 007: martech-event-order-vs-stock

## Symptom

On CI the 069-05 personalization-off AC1/AC4 journey (`test/adobe-b5-martech.test.js`, `sameAsStock`)
failed on request order: the Airlock martech library sent the `interact` request before `collect` and
reversed the `linkClicks` / `pageViews` events, while stock Alloy sent `collect` and then `interact`.
Not reproducible locally on an idle machine (40/40).

## Repro

CI only so far; no local repro. Owner: coordinator 23 (opened REPORTED, not investigated).

## Evidence

- CI run 45262070431, attempt 2, and run 45260673545, attempt 1 (no `meta.state.domain` diff in the latter,
  so it is independent of [bug 006](006-post-fold-oracle-stock-domain.md)).
- Earlier CI run 45238356339 attempts 1 and 2 also showed the :450 order diff.

## Hypotheses

<!-- Anti-anchoring: >=2 candidates, mark the leading one. Any Markdown
     list works (-, *, +, or 1.); the gate counts top-level items only
     (indented sub-bullets are notes, not hypotheses). -->
- [ ] H1: the 068-03 no-park change (refusal-shaped requests are no longer parked at both gates) changed
  the order in which the library's queued sends reach the edge, falsify by running the journey at the
  pre-fold head under load.
- [ ] H2: a harness-side timing race in the stock arm, falsify by a stock-vs-stock order sample on CI.
Not investigated; the lifecycle stays at REPORTED.

## Root cause

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

**Relevant history inspected:**

**Affected call sites:**

**Reuse decision:**

## Fix class

## Fix

## Call-site closure

<!-- Spec 091 / ADR-0037: before REVIEWED, account for every site named
     in the inventory above as changed, tested, or intentionally left
     alone. Accounting, not mandatory widening. -->

**Disposition per affected site:**

## Already tried

## Regression test

## Proof

## Learning
