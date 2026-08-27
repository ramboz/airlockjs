---
status: IN_PROGRESS
skill:
use_cases: [UC-1]
---

# Spec 005: UC-1 — above-the-fold PZN exposure, without flicker

> The second MVP1 demo item ([mvp1 release plan](../../releases/mvp1.md)). Builds on
> the UC-2 runtime (spec 004: bundled + lazy boot, `push()`, GA4 mapping, cookie
> ctx). **jig-supervised** — the flicker oracle has the widest proxy-gap, so a human
> visual review is part of the DoD (product-vision § Use cases; OQ6).

## Overview

**Goal:** on the [EDS testbed](../../../probes/eds-testbed/), an above-the-fold
experiment/personalization is **applied before paint with no flicker** (already true
via `aem-experimentation` — R-005), and its **exposure is reported through the airlock
runtime** as an MP-conformant GA4 event. The decisioning/swap is in-house
(`aem-experimentation`, the local decision-source driver — Clarification Q4); the
airlock's job is the **exposure report** + proving the no-flicker invariant holds.

**What it builds** (on the UC-2 adapter + ADR-0004 egress):
- an `adapters/eds/` **exposure capture** — at lazy-boot, read the applied
  `body[data-experiment]` / `body[data-variant]` (durable state set in the eager
  window), and also listen for the `aem:experimentation` CustomEvent for experiments
  applied after boot — and `push()` a GA4 exposure event;
- a GA4 **exposure event mapping** (`experiment_impression` with `experiment_id` /
  `variant_id` params; conformance-checked);
- the **no-flicker structural invariant** oracle (OQ6, structural half): the variant
  content is in the DOM *at* `body:appear` and `first-paint` never precedes `appear`
  — read from the testbed's `window.__flicker` marks — plus a **human visual review**
  (the perceptual half).

**Why exposure is read from the body dataset, not the event:** the exposure
`aem:experimentation` event fires in the **eager** window (before `appear`), but the
airlock runtime boots **lazy** (after `appear`, AD-8) — so a lazy event listener would
**miss** the eager exposure. `aem-experimentation` records the applied state durably on
`body[data-experiment]` / `body[data-variant]` (R-005), which the airlock reads at boot;
the live listener covers only the post-boot (dynamic) case.

**Out of scope:** the decisioning/allocation engine (owned by `aem-experimentation`);
edge decisioning (seam only, MVP1); UC-3 (block-decoration); the live GA4 endpoint +
`aem up` Lighthouse (as UC-2 — rigs stub egress); consent gating (OQ13).

**Oracle routing (jig-supervised + human visual review).** `ga4_mp_conformance` is
servo-able for the exposure payload. The **no-flicker property is jig-supervised**: the
structural invariant (DOM-at-appear + paint ordering) is machine-checkable, but the
perceptual "no flash" half is a **human visual review** (OQ6's proxy-gap — the release
plan keeps PZN human-reviewed, never servo-unattended).

## Assumptions

- **The applied experiment/variant is durably readable at lazy-boot from
  `body[data-experiment]` / `body[data-variant]`** (R-005: "Applied state:
  `body[data-experiment]` / `body[data-variant]`"; the testbed sets them in the eager
  swap before `appear`). [Grounded in R-005 + the testbed drive instructions; to be
  probe-confirmed on the real page in the slice.]
- **The `aem:experimentation` CustomEvent carries `detail.experiment` +
  `detail.variant`** (testbed `scripts.js` listens for exactly these). It is the
  post-boot (dynamic) source; the eager exposure is caught via the body dataset above.
  [Grounded in `probes/eds-testbed/scripts/scripts.js`.]
- **Reporting exposure in the lazy phase is correct** — AD-8 puts analytics lazy;
  the exposure *happened* pre-paint (no-flicker), reporting it a few ms later is the
  analytics-is-lazy contract, not a correctness gap. [Design choice per AD-8.]
- **No standard GA4 experiment event exists**, so a **custom** `experiment_impression`
  event (with `experiment_id` / `variant_id` string params) is used — GA4 accepts
  custom event names by design (ga4-mp.md). [Grounded in ga4-mp.md § oracle.]
- **Stated limits (frame-critique 005-01, grounded in the vendored plugin source):**
  (a) **fast-bounce hole** — the exposure is `push()`ed only after the async lazy boot
  completes, so a bounce faster than lazy boot loses it (the accepted AD-8
  analytics-is-lazy tradeoff; exposure is the count experiment-lift depends on, so the
  limit is stated, not hidden). **The loss can be *differential*, not just volume**
  (arch review 005-01): bounce rate is itself an experiment outcome, so a worse variant
  that bounces faster loses proportionally more exposures — biasing measured lift, not
  merely shrinking the sample. Acceptable for a human-reviewed MVP1 demo; a
  production-grade exposure would need an eager-phase capture path (out of scope). (b) **page-level only** — the body-dataset read
  captures the single **page-level** experiment; `aem-experimentation` writes a
  **section-level** experiment's dataset on the section element, not `body`
  (`plugins/experimentation/src/index.js` main→body remap is page-level), so an eager
  section-level experiment is out of scope for MVP1's single-experiment testbed.

## Decomposition

**SPIDR axis: single vertical slice.** The mechanism is known (R-005) and the runtime
foundation exists (spec 004), so UC-1's airlock deliverable is one vertical: capture
the exposure → map → report, with the no-flicker invariant as its oracle. No P/I/D/R
split earns its keep here (there is one path, one event, one rule); a second slice
would be horizontal phasing.

### Slices

1. **[005-01 — exposure capture → GA4 + no-flicker invariant](slice-01-exposure.md)**
   — read the applied variant at lazy-boot (+ live `aem:experimentation` listener),
   `push()` an MP-conformant `experiment_impression`, and verify the no-flicker
   structural invariant on the real testbed page (+ human visual review).

## Findings

- **Exposure reported through the airlock, no-flicker proven.** On the real testbed,
  the applied experiment is read from the durable `body[data-experiment]` /
  `[data-variant]` at lazy boot and reported as a single MP-conformant
  `experiment_impression` (experiment_id + variant_id). The no-flicker structural
  invariant holds on both arms (`npm run rig:uc1`): the `exp-applied:hero-cta:<variant>`
  mark precedes `body:appear` (challenger 66.1 < 69.3 ms; control likewise) — variant
  applied before paint — while the exposure `push()` rides the lazy worker cycle
  (`airlock:init` after `appear`). The forced-challenger screenshot shows pure variant
  content, no control flash (OQ6 perceptual half, human-reviewed).
- **The airlock reports, it does not decide** (Clarification Q4): decisioning/allocation
  stay `aem-experimentation`'s local decision-source driver; `core/` and
  `connectors/ga4/map.js` are untouched; `experiment_impression` rides the generic
  `push` → `mapToMp` custom-event path (golden-pinned, `ga4_mp_conformance`).
- **Stated limits (grounded):** exposure is lazy so a bounce faster than boot loses it
  — and the loss is *differential* (a worse variant bounces faster, biasing lift, not
  just volume); the body-dataset read is page-level only (section-level experiments
  write the dataset on the section, not `body`). Both acceptable for a human-reviewed
  MVP1 demo; a production exposure path would capture eager.

## Outcome

**UC-1 lands: above-the-fold personalization with no flicker, exposure reported through
the airlock.** The airlock adds exposure reporting to the existing `aem-experimentation`
no-flicker swap without re-implementing decisioning — a single MP-conformant
`experiment_impression` per applied experiment, off-thread, with the no-flicker
structural invariant machine-verified and the perceptual half human-reviewed.

`Outcome: UC-1 graduated — above-the-fold experiment exposure reported through the
airlock as an MP-conformant experiment_impression, no-flicker structural invariant
proven (exp-applied before body:appear, both arms) + clean-challenger screenshot;
decisioning stays aem-experimentation's (Clarification Q4). ga4_mp_conformance green.
Reproducible: npm run rig:uc1. Limits: lazy/page-level exposure (differential-bias
note). Remaining MVP1: UC-3 (in flight, spec 006), servo oracle + CI.`
