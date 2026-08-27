---
status: DRAFT
skill:
use_cases: [UC-1, UC-2, UC-3]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 007: Servo oracle components + CI

> Drive-order steps 8–9 — the last MVP1 precondition. Authored 2026-08-27.

## Overview

MVP1's demo trio (UC-1/2/3) is built, tested, and merged (specs 004/005/006
DONE). What remains is the **release precondition** the MVP1 plan flags as
"a precondition, not a nicety" ([mvp1.md:67](../../releases/mvp1.md),
Release-Check §): the runnable **oracle** that judges whether the runtime is
correct, plus the **CI** pipeline that runs it. Until both exist, no
servo-unattended loop can run (review G4), and the release cannot be marked
shippable ([mvp1.md:125](../../releases/mvp1.md)).

This spec designs and wires the **three servo oracle components** named in
[architecture.md:65](../../architecture.md) and the MVP1 JIG Handoff
([mvp1.md:112](../../releases/mvp1.md)), then stands up **GitHub Actions CI**
to run them.

**Routing by oracle strength** (product-vision § How new work enters) is the
spine of the decomposition — each component is routed to the discipline its
oracle can support, and the spec never promotes a statistical oracle to a
servo-unattended gate:

| Component | Oracle strength | Route | Basis |
|-----------|-----------------|-------|-------|
| `ga4_mp_conformance` | **Strong** — deterministic, hermetic (schema + goldens) | servo-unattended | [contracts/validate.mjs](../../../contracts/validate.mjs) READY; add live `/debug/mp/collect` as a non-blocking complement (R-002) |
| `isolation_invariant` | **Strong** — structural (the worker has no `document`) | servo-unattended | [chamber.worker.js:12](../../../core/chamber.worker.js) (ADR-0001); test **needs building** |
| `cwv_budget` | **Weak** — statistical + rIC-protected; widest proxy-gap | **jig-supervised** | rigs exist ([rig/measure.mjs], [rig/teardown.mjs], [rig/lh-eds.mjs]); pin thresholds from the spike |

**OQ6 (flicker oracle)** is resolved inside the `cwv_budget` slice: the
structural no-flicker invariant is already automated ([rig/uc1.mjs] asserts
exp-applied before `body:appear`, both arms); the **perceptual** half stays
human-reviewed (screenshot, not servo-unattended). That recorded decision is
the "proxy-gap" the release plan flags — it is a boundary/routing decision, so
it produces an ADR.

**Precondition (the user's step 2, run between authoring and implementation):**
`/servo:scaffold-init` probes the repo's signals and drops a tailored
`oracle.sh` + `.servo/` (servo is not scaffolded today — no `oracle.sh`, no
`.servo/`). The three slices below **tune the components** into that scaffolded
`oracle.sh`; they do not hand-roll the harness. `/servo:edd-suitability` is
expected to confirm only the GA4 route is EDD-suitable, and
`/servo:spec-oracle` classifies these ACs into check-families — both consume
this spec.

## Assumptions

Load-bearing claims that are **not yet probe-verified** (servo is unscaffolded
and CI does not exist, so these surfaces cannot be run today). Each is marked
so the frame-critique pass fires where it should; each slice re-grounds its own
before implementation.

- **A1 — `/servo:scaffold-init` emits a wireable `oracle.sh`.** The three
  component slices assume the scaffolder produces an `oracle.sh` with a
  component-append convention (a place to register `ga4_mp_conformance` /
  `isolation_invariant` / `cwv_budget` and a per-component pass/fail verdict).
  Unverifiable until step 2 runs. If the emitted shape differs, the slices
  adapt to it rather than the reverse.
- **A2 — GitHub Actions can install chromium for the browser rigs.** The
  browser-CI slice assumes Actions can install Playwright/chromium and run the
  Lighthouse rigs headless. Standard, but unproven in this repo (only
  `jig-governance.yml` exists today) — the MVP1 plan explicitly calls browser
  automation the rabbit hole ([mvp1.md:69](../../releases/mvp1.md)).
- **A3 — the live `/debug/mp/collect` check runs credential-free.** The GA4
  live complement assumes the MP validation endpoint can be exercised without a
  real `measurement_id`/`api_secret` (the repo pins a placeholder; CI must not
  require real credentials — security MUST). If it cannot, the live check stays
  a local/manual complement and only the hermetic half gates CI.
- **A4 — the spike's numbers are the pinning basis, not re-measured here.**
  `cwv_budget` thresholds are pinned from spec 003's recorded measurements
  (worker INP p75 8ms, 300/300 delivery under storm, TBT 0 / CLS 0). The slice
  re-runs the rigs to confirm the numbers still hold on the current tree before
  pinning; if they have drifted, the pinned budget is re-derived, not assumed.

## Decomposition

**SPIDR — split by Rules (oracle strength), then Path (CI depth).** The
dominant axis is the *business rule* each oracle encodes and the discipline it
is routed to; each component is an independently-runnable check that produces a
verdict a human or servo can act on (vertical, not horizontal — no slice stops
at "wired but un-runnable"). CI then splits on Path: the hermetic, fast core
pipeline first (happy path), the heavier browser pipeline (chromium — the
rabbit hole) second.

- **Rules axis** → one slice per oracle component (07-01 strong/hermetic,
  07-02 strong/structural, 07-03 weak/statistical), because their oracle
  strength — and therefore their servo-vs-jig routing — is exactly what
  differs.
- **Path axis** → CI split into hermetic-core (07-04) and browser (07-05),
  because the browser pipeline carries the install-chromium risk the release
  plan flags and deserves its own vertical slice so the cheap gate lands first.
- **Spike?** No — the mechanism is known for all five; nothing needs a
  timeboxed investigation. (The unknowns are A1–A4, which resolve by *running*
  the scaffolder/CI, not by a research spike.)

**Ordering / dependencies:** 07-01 and 07-02 are the two servo-unattended-strong
components and land first (they are what makes the GA4 route EDD-suitable);
07-03 pins the supervised budget + resolves OQ6; 07-04 (core CI) runs the two
hermetic components; 07-05 (browser CI) runs the statistical rigs and extends
07-04's pipeline.

## Slices

- [007-01 — `ga4_mp_conformance` oracle component (hermetic + live complement)](slice-01-ga4-mp-conformance.md)
- [007-02 — `isolation_invariant` oracle component (build the structural assert)](slice-02-isolation-invariant.md)
- [007-03 — `cwv_budget` oracle component + resolve OQ6 (flicker routing)](slice-03-cwv-budget-oq6.md)
- [007-04 — hermetic CI on GitHub Actions (vitest + contracts)](slice-04-ci-core.md)
- [007-05 — browser CI (Playwright rigs + Lighthouse CI)](slice-05-ci-browser.md)
