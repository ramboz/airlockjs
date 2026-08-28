---
status: DRAFT
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 011: MVP2 coherency probe

## Overview

The **gating risk of MVP2**, retired first and risk-first (drive-order
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

**Time-box:** measurement over polish — build the smallest rig that produces a
discriminating coherency verdict. The appetite is "an answer the step-5
capability contract can be frozen against," not a production shim.

**What it builds** (a throwaway probe rig under `probes/`, in the lineage of
[probes/alloy-worker](../../../probes/alloy-worker/) — *not* runtime code): a
**two-worker coherency proxy** — a main-thread broker owning the
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
- The resolving ADR (011-03) chooses among R-006's **sync-access mechanism**
  options — named here, *not* lettered, to avoid colliding with ADR-0001's
  isolation-model letters (see the disambiguation below): **seed + async
  write-back** (the MVP1 shim, likely insufficient across chambers),
  **broker-push invalidation** on `cookieStore` `change` (the leading AD-4-clean
  candidate), or **single-shared-worker** for the whole Adobe stack (the no-go
  fallback that drops cross-connector confidentiality). Per-read marshalling is
  ruled out within AD-4 (it needs a synchronous worker→main round-trip, i.e.
  SAB).

**What the probe settles — and what rides on already-recorded tradeoffs.**
OQ9 couples **two distinct axes**, and — corrected after the frame-critique pass
— the probe does *not* empirically settle both. Be precise about which is which:

- **Sync-access mechanism** (R-006's *named* options: seed+write-back /
  broker-push / single-shared-worker) — **probe-grounded.** The rig measures
  whether an AD-4-compatible mechanism bounds the unavoidable staleness (R-006
  F2) to an *acceptable* level for shared identity. This is the axis the rig can
  actually discriminate.
- **Isolation model** (ADR-0001's *lettered* options: **B** worker-per-chamber /
  **C** WASM-sandbox-in-one-Worker) — **mostly decided on paper, not by the
  probe.** Coherency behavior does **not** discriminate B from C: both are
  multi-cache-over-one-broker for the out-of-band threats (identical), and where
  they *could* differ — the concurrent in-band case — the two-worker rig models
  only **B's two-cache topology**. ADR-0001 Option C (two WASM sandboxes inside
  *one* Worker/realm) would most naturally share *one* host-side cache, making
  the in-band case trivially coherent — a paper consequence R-006 F1/F2 imply,
  **not** something this rig measures. The real B-vs-C drivers (fault isolation,
  confidentiality, per-thread overhead, and R-004's unmodified-stock-bundle
  property — which ADR-0001 already reads as favouring B over C's per-read
  marshalling) sit **outside** the coherency surface.

So the honest claim is narrower than the first draft's "model-agnostic": **the
rig characterizes Option B directly (the live per-connector-isolation candidate)
and grounds the sync-access mechanism + the go/no-go.** On a **go**, the B-vs-C
choice follows ADR-0001's recorded non-coherency tradeoffs (unmodified-bundle →
B), *not* probe evidence; the probe's contribution to the isolation axis is the
**viability gate** — whether *any* per-connector isolation (B or C) survives, or
MVP2 must retreat to a single shared worker (which is simultaneously the
mechanism fallback **and** the isolation retreat: one chamber ⇒ one cache ⇒
trivially coherent, but no per-connector confidentiality). [ADR-0001](../../decisions/adr-0001-chamber-isolation-strength.md)
deferred this coupled question to OQ9 "to be settled by a model-agnostic probe";
this spec honours that intent by settling the half a coherency probe *can* settle
and explicitly routing the other half to the recorded tradeoffs — rather than
overclaiming a probe-grounded isolation verdict the instrument cannot support.

**Outcome:** a recorded go/no-go that resolves [OQ9](../../refinement-todo.md)
via a **dedicated ADR**. Per the division of labor above, the ADR settles: (a)
the **synchronous-host-access mechanism** — probe-grounded; (b) the
**per-connector isolation viability** — probe-gated (does per-connector
isolation survive, or retreat to a single shared worker); and (c) on a go, the
**isolation model B-vs-C** — resolved on ADR-0001's already-recorded
non-coherency tradeoffs (unmodified-stock-bundle → B), which the probe does not
re-litigate. On a **no-go** (no AD-4-compatible mechanism bounds the staleness
acceptably), the outcome is the honest stop-and-re-shape signal for MVP2's whole
no-SAB-chambers premise ([MVP2 release plan](../../releases/mvp2.md) No-Gos) —
the retreat to a single shared worker, dropping cross-connector confidentiality.

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

- **The two-worker rig characterizes Option B, and Option C is handled on
  paper — not measured.** (Reframed after the frame-critique pass, which flagged
  the original "model-agnostic" claim as overclaimed.) The rig's two-cache
  topology directly models ADR-0001 Option B. Its **out-of-band** verdicts
  (broker↔cache freshness) transfer to Option C unchanged; its **in-band**
  concurrent verdict is Option-B-specific, because Option C's single-realm shared
  cache makes that case trivially coherent — a paper consequence, not a rig
  measurement. [The residual risk this leaves: if Option C's real implementation
  turned out to keep *per-sandbox* caches (not one shared cache), the in-band
  verdict would transfer after all; the probe does not test that topology.
  Judged acceptable because ADR-0001 already reads C as dominated by B on the
  unmodified-stock-bundle tradeoff regardless of coherency, so the go-path
  isolation choice does not hinge on this. Frame-critique should confirm that
  routing the B-vs-C choice to recorded tradeoffs (not probe evidence) is sound.]
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
- **No AD-4-compatible mechanism bounds the staleness to an acceptable level for
  shared identity.** (A *zero*-staleness synchronous cross-chamber view is
  already known impossible without SAB — R-006 F2 — so "coherent" here means
  "staleness bounded tightly enough that shared identity stays correct," not
  "zero window.") Then MVP2's no-SAB-chambers premise is not retired: record it
  honestly, and the resolving ADR escalates the choice — an explicit AD-4
  exception (SAB via ADR, per the release plan's conditional), a
  single-shared-worker fallback (one chamber for the whole Adobe stack, dropping
  per-connector confidentiality between Analytics and Target), or re-shaping
  MVP2's scope. This is a stop-and-re-shape trigger, not a slice failure.

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
