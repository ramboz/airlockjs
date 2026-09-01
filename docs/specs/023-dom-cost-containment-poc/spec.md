---
status: DRAFT
skill: jig:spec-workflow
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 023: DOM-cost containment POC (the performance thesis)

> **POC-A** of the performance thesis ([R-008](../../research/R-008-costly-dom-martech-containment.md)) —
> proving **Lever 1** (capability-mediated + *scheduled* DOM) contains a costly-DOM tag's INP hit, as a
> **number**. The follow-on **POC-B** (worker-dom compat, the *unmodified*-tag path) is deferred + tracked
> ([refinement-todo](../../refinement-todo.md) → Performance thesis). Sibling to the RUM connector (022), which
> proved the *governance* half; this proves the *performance* half.

## Overview

Prove, with a **before/after INP scoreboard**, that airlock **contains** a costly-DOM martech tag: the same
heavy DOM work that tanks INP when run naively in a click handler stays **INP-flat** when routed through
airlock's **scheduled DOM capability** (chunk + `yieldToMain`, defer to idle/pre-paint). This is airlock's
CWV-first thesis made measurable — *the one payoff a governance runtime must actually demonstrate.*

**The honest boundary (load-bearing — see Assumptions):** scheduling only helps **chunkable** work. A tag's
expensive DOM work must be expressible as *yieldable units* (a loop over N elements, batched) for airlock to
interleave it with interactions. A single monolithic synchronous browser call can't be yielded mid-flight —
that case is Lever 2 (worker-dom, POC-B) or is simply slow. So POC-A proves containment for the **common**
shape (heavy per-element processing) and **names** the monolithic-sync boundary rather than overclaiming.

## Current state (grounded, 2026-09-01)

- **No scheduling taxonomy yet.** airlock's only main-thread scheduling hook is
  `requestIdleCallback(drain, {timeout:50})` for the ring→worker drain (`core/airlock.js:255`). The
  `yieldToMain`/`runWhenIdle`/`runBeforePaint` primitives the vision cites (from `ramboz/aem-cwv-helper`) are
  **aspirational** — `aem-cwv-helper` is **not** a dependency and not vendored (named only in `START_PROMPT.md`).
  So POC-A **builds** a minimal scheduler.
- **DOM capability is injection-only.** `adapters/eds/dom.js` ships `reserveSpace`/`insertAfterInteraction`
  (CWV-safe *writes*, spec 012-03/018) + the `setContent` sanitizer hook. There is **no** general
  "run this DOM work, scheduled" capability, and no batched-*read* capability (R-008's open question). POC-A
  **builds** the scheduled-DOM-op capability.
- **Measurement is oracle-time.** `rig/cwv-budget.mjs` (Lighthouse + an INP delta) is a CI budget check, not a
  focused naive-vs-scheduled INP contrast. POC-A **builds** a Playwright INP before/after harness.

## Assumptions

- **[LOAD-BEARING — the POC's whole point] A chunk-and-yield scheduler genuinely contains INP** for chunkable
  DOM work: interleaving `yieldToMain` between batches keeps the longest task (and thus INP) small while the
  total work still completes (across frames). If the measured INP contrast is not decisive, the POC has
  falsified its own thesis — that is a valid, publishable outcome, not a failure to paper over.
- **[LOAD-BEARING] The nasty-tag work must be CHUNKABLE.** The fixture does heavy *per-element* processing (a
  loop over many nodes), which is yieldable. A monolithic sync op (one giant browser call) is out of Lever 1's
  reach by construction — named as the boundary (→ Lever 2 / POC-B), not smuggled past.
- **[to confirm at implementation] The INP measurement is valid + reproducible** — a Playwright harness firing
  N scripted interactions and reading INP (via `web-vitals` `onINP`, already a dep) yields a stable p75
  contrast between the naive and scheduled runs on the same fixture page.
- **`scheduler.yield()` availability** — prefer the platform `scheduler.yield()`/`postTask` where present;
  fall back to a `MessageChannel`/`isInputPending` yield. Ground the fallback at implementation.

## Decomposition

SPIDR — **Path**-first: the vertical is *one costly tag, contained + measured*. The scheduler + the capability
+ the fixture + the harness are the machinery that one Path slice needs; they are not separate horizontal
layers (a scheduler with no measured payoff would be exactly the horizontal-phasing trap to avoid).

- **023-01 (Path — the proof):** a minimal main-thread **scheduler** (`chunk` + `yieldToMain`, `runWhenIdle`,
  `runBeforePaint`), a **scheduled-DOM-op capability** a connector expresses heavy DOM work through, a
  **synthetic nasty-tag fixture** (a click handler doing heavy chunkable DOM work), a **naive baseline** (the
  same work run synchronously), and a **Playwright INP before/after harness**. Delivers the scoreboard:
  naive INP p75 (tanked) vs airlock-scheduled INP p75 (flat), same work, same page.
- _(Later, if 023-01 proves it) 023-02 — generalize: the batched-**read** capability (R-008 open question) +
  wire the scheduler as the drain scheduler airlock already gestures at. Not committed until 023-01 lands._

## Slices

- [023-01 — costly tag contained + measured (the INP scoreboard)](slice-01-inp-scoreboard.md)
