---
status: DRAFT
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 011: MVP2 coherency probe

## Overview

The **gating risk of MVP2**, retired first and model-agnostically (drive-order
step 1; [MVP2 release plan](../../releases/mvp2.md) cutline "Include —
RISK-FIRST"). This is the **precondition spec**: nothing downstream — the
extended capability contract, the alloy connector, the per-connector isolation
upgrade — may freeze until it concludes.

**Question:** when the [chamber](../../memory/glossary.md) sync-cache shim
(proven single-chamber in [R-004](../../research/R-004-alloy-in-worker.md)) is
generalized to **two chambers sharing one identity cookie**, can the runtime
keep a **coherent synchronous view** of that cookie — under both concurrent
in-chamber writes and out-of-band writes — **without SharedArrayBuffer**
([AD-4](../../architecture.md)-forbidden)?

**Time-box:** measurement over polish — build the smallest model-agnostic rig
that produces a discriminating coherency verdict. The appetite is "an answer
the step-5 capability contract can be frozen against," not a production shim.

**What it builds** (a throwaway probe rig under `probes/`, in the lineage of
[probes/alloy-worker](../../../probes/alloy-worker/) — *not* runtime code): a
**model-agnostic two-worker coherency proxy** — a main-thread broker owning the
authoritative cookie jar (the real `document.cookie`) plus two worker
"chambers," each with its own sync-cache + async write-back, both bound to one
shared identity cookie (an `AMCV_*` / `demdex`-shaped value, per R-004's
identity set). The rig exercises the coherency threats [OQ9](../../refinement-todo.md)
names — concurrent two-chamber writes, and three out-of-band write sources (a
credentialed-`fetch` `Set-Cookie`, a main-thread write, a second-tab write) —
and scores the staleness window each opens.

**Scope fixed by [R-006](../../research/R-006-cross-chamber-cookie-coherency-mechanisms.md)
(the mechanism survey — read it first).** The survey settled the architecture
*on paper* before this rig measures it, sharpening the question:

- A dedicated-worker chamber has **no cookie API at all** (no `document`, and
  `cookieStore` is not exposed on `DedicatedWorkerGlobalScope`), so the **main
  thread is the sole cookie authority** — chambers hold *caches*, and the probe
  measures **broker↔cache freshness**, not a shared-memory race. The rig's
  "authoritative jar" therefore lives only on the broker.
- **No AD-4-compatible mechanism gives synchronous cross-agent reads** (the only
  synchronous shared-memory channel is SAB+`Atomics`, forbidden). So
  synchronicity *necessarily* implies a cache and a **non-zero staleness
  window** — a platform boundary, not a shim defect. The probe therefore does
  **not** hunt for zero-staleness coherence (impossible for free); it measures
  **whether the unavoidable async staleness is a *correctness* fault for shared
  identity, and whether broker-push invalidation bounds it acceptably.**
- The resolving ADR (011-03) chooses among R-006's option set: **A** seed +
  async write-back (MVP1 shim, likely insufficient), **B** broker-push
  invalidation on `cookieStore` `change` (leading AD-4-clean candidate), or
  **D** single shared worker for the whole Adobe stack (the no-go fallback that
  drops cross-connector confidentiality). Option C (per-read marshalling) is
  ruled out within AD-4.

**Why model-agnostic (not presupposing ADR-0001 B-vs-C).** The two-worker proxy
is a concrete *instrument*, not a commitment to Option B (worker-per-chamber).
It characterizes the failure mode any **multi-cache-over-one-jar** design faces
— which includes Option C (a WASM sandbox marshalling each read) — so the
findings feed the B-vs-C decision rather than assuming it. [ADR-0001](../../decisions/adr-0001-chamber-isolation-strength.md)
deferred exactly this coupled question (isolation model + sync-host-access
mechanism) to OQ9, to be settled "by a model-agnostic probe before the step-5
contract freezes."

**Outcome:** a recorded go/no-go that resolves [OQ9](../../refinement-todo.md)
via a **dedicated ADR** jointly settling (a) the MVP2 per-connector isolation
model (ADR-0001's deferred B-vs-C) and (b) the synchronous-host-access
mechanism it requires. On a **no-go** (no AD-4-compatible design gives a
coherent synchronous cross-chamber view), the outcome is the honest
stop-and-re-shape signal for MVP2's whole no-SAB-chambers premise
([MVP2 release plan](../../releases/mvp2.md) No-Gos).

**Out of scope:** OQ11/OQ3 (payload governance + event schema — the next
contract-extension step), the alloy wrapped-SDK connector itself, live
end-to-end ECID issuance / cluster routing (R-004 open question), and any
production sync-cache implementation. This spec **measures** the coherency
question and **records the decision**; it builds no runtime.

## Assumptions

> Several premises that were hypotheses in the first draft are now **grounded**
> by [R-006](../../research/R-006-cross-chamber-cookie-coherency-mechanisms.md)
> and moved out of this section: that a non-zero staleness window is
> *unavoidable* within AD-4 (R-006 F2, closed-set enumeration of cross-agent
> channels), that the main thread is the sole cookie authority (F1), and that a
> shared identity cookie is the realistic target (grounded in R-004's
> identity-cookie set). What remains genuinely unverified:

- **The two-worker proxy generalizes to the B-vs-C decision.** The coherency
  failure mode of N caches over one broker authority is a property of the
  *multi-cache* shape, not of the thread/realm mechanism, so a two-worker
  instrument characterizes Option C (WASM-sandbox marshalling) as well as
  Option B. [Design premise — the model-agnostic claim the probe rests on;
  frame-critique should test it. R-006 F1/F2 support it (both models share one
  broker authority and cannot read it synchronously), but the *generalization*
  itself is an argument, not a measurement. If Option C's single-thread shared
  cache makes the concurrent case trivially coherent, that is itself a *finding*
  the scoreboard records, not a rig failure.]
- **The three out-of-band write sources are reproducible in a Playwright/chromium
  harness.** A credentialed-`fetch` `Set-Cookie`, a main-thread `document.cookie`
  write, and a second-tab write can each be driven deterministically against a
  shared cookie, and the broker can *detect* each (R-006 F3/F4 predict
  `cookieStore` `change` + jar re-read; a foreign second-tab write may need
  polling). [To be probe-confirmed in slice 011-01's rig bring-up; the `rig/`
  browser realm already runs Playwright — `rig/isolation.mjs`, `rig/e2e.mjs`.
  If a source cannot be driven or detected deterministically, the method is
  revisited before a verdict — Kill criteria.]
- **The unavoidable async staleness is measurable as a *correctness* outcome,
  not just a latency number.** The go/no-go turns on whether a stale
  ECID/demdex read causes a real fault (duplicate identity, split session) vs
  self-healing; the rig must surface that, not merely a window width. [The
  crux R-006 hands to 011-03; needs the rig to model an identity-consuming
  read, not just a cookie compare.]

## Kill criteria

- **The rig cannot produce a discriminating coherency signal** — it cannot open
  a staleness window on demand, so "coherent" and "incoherent" runs are
  indistinguishable. Then the question cannot be answered by this method;
  revisit the instrument (tighter write interleaving, an injected latency knob
  on write-back) before drawing a go/no-go.
- **No AD-4-compatible design yields a coherent synchronous cross-chamber view.**
  Then MVP2's no-SAB-chambers premise is not retired: record it honestly, and
  the resolving ADR escalates the choice — an explicit AD-4 exception (SAB via
  ADR, per the release plan's conditional), a single-shared-worker fallback
  (one chamber for the whole Adobe stack, dropping per-connector confidentiality
  between Analytics and Target), or re-shaping MVP2's scope. This is a
  stop-and-re-shape trigger, not a slice failure.

## Decomposition

**SPIDR axis: Path.** The spec is a spike (research: does the no-SAB coherency
premise hold?); the *build* splits by **path through the coherency story** —
the simplest in-band threat first (which also stands up the rig), then the
harder out-of-band threats, then the head-to-head answer + the resolving ADR.
Each slice delivers a real, observable coherency verdict, not intermediate
state (mirrors spec 003's baseline-path → worker-path → answer split).

Spike-first ordering is deliberate: the cheapest discriminating test
(concurrent in-chamber writes) runs first and may already move the go/no-go
needle before the costlier out-of-band orchestration is built.

### Slices

1. **[011-01 — coherency rig + concurrent two-chamber writes](slice-01-coherency-rig.md)**
   — the model-agnostic two-worker proxy (broker + authoritative jar + two
   sync-caches on a shared identity cookie), plus the in-band threat: concurrent
   read-modify-write from both chambers. Delivers the rig everything else
   measures against **and** the first verdict — do two caches diverge under
   concurrent writes with async write-back, and how wide is the window?
2. **[011-02 — out-of-band write coherency](slice-02-out-of-band.md)** — extend
   the rig with the three out-of-band mutation sources OQ9 names (credentialed
   `Set-Cookie`, main-thread write, second-tab write), each driven
   deterministically. Delivers the out-of-band verdict + per-source staleness
   characterization.
3. **[011-03 — coherency scoreboard + resolving ADR](slice-03-scoreboard-adr.md)**
   — synthesize the verdicts into the go/no-go on "coherent synchronous
   cross-chamber view without SAB," and record the dedicated ADR that resolves
   OQ9 (ADR-0001 B-vs-C isolation model + the sync-host-access mechanism), or
   the stop-and-re-shape signal on a no-go. Delivers the recorded decision that
   unblocks the step-5 capability-contract freeze.
