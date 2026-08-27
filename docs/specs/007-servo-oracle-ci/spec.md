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
servo-unattended gate. **Frame-critique (2026-08-27) reclassified two of the
three routings** — see the evidence in `reviews/slice-0{1,2,3}-frame-critique.md`:

| Component | Oracle strength | Route | Basis |
|-----------|-----------------|-------|-------|
| `ga4_mp_conformance` | **Strong** — deterministic, hermetic (schema + goldens) | **servo-unattended** (the only one) | [contracts/validate.mjs](../../../contracts/validate.mjs) READY; add live `/debug/mp/collect` as a non-blocking complement (R-002) |
| `isolation_invariant` | **Structural** — a *faithful* assert needs a real Worker realm, not Node | **browser CI (gating)** — reclassified from hermetic/servo-unattended | [chamber.worker.js:12](../../../core/chamber.worker.js) (ADR-0001) documents the property, but Node has no `document` regardless of the chamber (07-02 frame-critique); built as a real-Worker rig, run in browser CI (07-05) |
| `cwv_budget` | **Weak** — statistical + rIC-protected; widest proxy-gap | **jig-supervised** | rigs exist ([rig/measure.mjs](../../../rig/measure.mjs), [rig/teardown.mjs](../../../rig/teardown.mjs), [rig/lh-eds.mjs](../../../rig/lh-eds.mjs)); pin thresholds from the spike **as deltas** (07-03 frame-critique) |

So MVP1 has **one** servo-unattended-strong+hermetic component (`ga4_mp_conformance`);
isolation moves to the browser realm (its runtime guarantee is a browser-Worker
property), and CWV stays supervised. This is an honest narrowing the release
plan's "two servo-unattended-strong components" framing should absorb.

**The servo-unattended gate is an AND of binary hermetic checks (`THRESHOLD=1.0`).**
The scaffolded [oracle.sh](../../../oracle.sh) is a *weighted mean*, which
dilutes a hard MUST-pass check (a broken component scoring 0.0 beside a passing
one averages above the default 0.5 — it would not fail). 07-01 frame-critique
caught this. Decision (resolving the servo `refinement-todo` **Threshold**
deferral): gating components are **binary** (1.0/0.0) and the gate runs at
`THRESHOLD=1.0`, so the weighted mean equals 1.0 **iff every component passes** —
any single 0.0 fails the composite (a logical AND). `cwv_budget` stays out of
`COMPONENTS` entirely (advisory, separate invocation), so it never feeds this
gate.

**OQ6 (flicker oracle)** is resolved inside the `cwv_budget` slice: the
structural no-flicker invariant is already automated ([rig/uc1.mjs](../../../rig/uc1.mjs)
asserts exp-applied before `body:appear`, both arms); the **perceptual** half
stays human-reviewed (screenshot, not servo-unattended). That recorded decision
is the "proxy-gap" the release plan flags. **The OQ6 ADR also records the two
gate-construction decisions above** (the `THRESHOLD=1.0` AND-gate and the
isolation reclassification) — both are load-bearing oracle-design choices with
rejected alternatives, so they belong in one "servo oracle design" ADR authored
during 07-03.

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

- **A1 — RESOLVED 2026-08-27.** `/servo:scaffold-init` was run; the emitted
  [oracle.sh](../../../oracle.sh) is a **weighted-composite** Tier-0 template:
  each component is a `score_<name>()` shell function returning a score in
  `[0.0, 1.0]`, registered as a `"<name>:<weight>"` entry in the `COMPONENTS`
  array, inside `# SEED:start/end <name>` splice blocks; the composite is a
  weighted average gated on `THRESHOLD` (exit 0 ≥, 1 <, 2 env-error). **Key
  consequence for routing** (07-01 frame-critique): every entry in `COMPONENTS`
  feeds the *gating* composite, there is no built-in non-gating tier, **and the
  weighted mean dilutes a hard gate**. Resolution: the one hermetic
  servo-unattended component (`ga4_mp_conformance`, 07-01) registers as a binary
  `score_*` component and the gate runs at **`THRESHOLD=1.0`** so any 0.0 fails
  (AND-gate, see Overview). `cwv_budget` (07-03, jig-supervised) is **not** a
  `COMPONENTS` entry — it runs as a **separate advisory invocation**, never
  feeding the composite (07-03 AC2). `isolation_invariant` is **not** a hermetic
  `COMPONENTS` entry either — it was reclassified to a real-Worker browser-CI
  check (07-02 frame-critique; folded into 07-05).
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
- **A4 — the spike's numbers are the pinning basis, pinned as DELTAS not
  absolutes** (revised per 07-03 frame-critique). `cwv_budget` thresholds are
  pinned from spec 003's recorded measurements (worker INP p75 8ms vs the
  naive/rIC baselines on the same page, 300/300 drain-stage delivery, TBT 0 /
  CLS 0). Spec 003 itself declares absolute INP machine-dependent and only the
  *delta between two runtimes on the same page* load-bearing (003/spec.md:56-57,
  R-005). So INP is budgeted as a **same-run delta vs a control**
  ([rig/measure.mjs](../../../rig/measure.mjs) already runs baseline+worker on
  one page), never an absolute threshold checked on a different (CI-runner)
  machine. The slice re-runs the rigs to confirm the delta still holds on the
  current tree before pinning; if drifted, it is re-derived, not assumed.

## Decomposition

**SPIDR — split by Rules (oracle strength), then Path (CI depth).** The
dominant axis is the *business rule* each oracle encodes and the discipline it
is routed to; each component is an independently-runnable check that produces a
verdict a human or servo can act on (vertical, not horizontal — no slice stops
at "wired but un-runnable"). CI then splits on Path: the hermetic, fast core
pipeline first (happy path), the heavier browser pipeline (chromium — the
rabbit hole) second.

- **Rules axis** → one slice per oracle component (07-01 hermetic/servo-unattended,
  07-02 structural/real-Worker, 07-03 statistical/supervised), because their
  oracle strength — and therefore their routing — is exactly what differs.
  Frame-critique reclassified 07-02 from hermetic to browser-realm, but it
  remains its own slice: building the real-Worker isolation assert (a runnable
  browser rig) is distinct vertical work from wiring it into CI (07-05),
  mirroring how 07-01 *builds* the GA4 component and 07-04 *runs* it.
- **Path axis** → CI split into hermetic-core (07-04) and browser (07-05),
  because the browser pipeline carries the install-chromium risk the release
  plan flags and deserves its own vertical slice so the cheap gate lands first.
- **Spike?** No — the mechanism is known for all five; nothing needs a
  timeboxed investigation. (The unknowns are A1–A4, which resolve by *running*
  the scaffolder/CI, not by a research spike.)

**Ordering / dependencies:** 07-01 (`ga4_mp_conformance`) is the sole
servo-unattended-strong+hermetic component and lands first — it is what makes
the GA4 route EDD-suitable. 07-02 builds the real-Worker isolation assert.
07-03 pins the supervised budget (as deltas) + resolves OQ6 + authors the
oracle-design ADR. 07-04 (hermetic core CI) runs 07-01 + the vitest suite
(no longer depends on 07-02). 07-05 (browser CI) runs the 07-02 isolation
rig, the 07-03 rigs, and extends 07-04's pipeline.

## Slices

- [007-01 — `ga4_mp_conformance` oracle component (hermetic + live complement)](slice-01-ga4-mp-conformance.md)
- [007-02 — `isolation_invariant` real-Worker assert (browser realm; run in CI by 07-05)](slice-02-isolation-invariant.md)
- [007-03 — `cwv_budget` oracle component (delta budgets) + resolve OQ6 + oracle-design ADR](slice-03-cwv-budget-oq6.md)
- [007-04 — hermetic CI on GitHub Actions (vitest + contracts)](slice-04-ci-core.md)
- [007-05 — browser CI (Playwright rigs + Lighthouse CI)](slice-05-ci-browser.md)
