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
shared **first-party** identity cookie (an `AMCV_*` / `kndctr_*`-shaped value —
per R-004, these are first-party, JS-written via synchronous `document.cookie`
from the Edge response body, *not* network `Set-Cookie`). The rig exercises the
coherency threats [OQ9](../../refinement-todo.md) names — concurrent two-chamber
(in-band) writes, and the out-of-band writes from *outside* any chamber (a
main-thread write by another first-party script, a second-tab write, and a
same-origin server `Set-Cookie`; the cross-site demdex-style `Set-Cookie` enters
only as a negative boundary) — and scores the staleness window each opens.

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

**What the probe settles — the coupling, dissolved (not re-deferred).**
OQ9 records the sync-access **mechanism** and the isolation **model** (ADR-0001
Option **B** worker-per-chamber vs **C** WASM-sandbox-in-one-Worker) as *one
coupled decision*, because the mechanism was thought to depend on the model
(separate-thread caches need cross-thread invalidation; a shared-realm sandbox
might not). The probe's substantive result is to **break that coupling** — and
that is how it honours OQ9's "settle by a model-agnostic probe … that does not
presuppose the B-vs-C model" trigger, rather than presupposing or re-deferring it:

- **Option B is the worst-case coherency topology.** Its N separate,
  cross-thread caches maximize both the write-propagation window (chamber→broker
  write-back, then broker→chamber push) and the read-staleness window. Option C
  (sandboxes sharing one host-side cache in one realm) is *strictly easier* —
  fewer caches, no cross-thread hop; at best trivially coherent in-band.
- **So proving the mechanism for B proves it model-independently.** If
  broker-push invalidation bounds staleness acceptably for B's two-cache
  topology (what the rig measures), it bounds it *a fortiori* for C. The
  broker→worker push targets the worker/cache layer *below* the isolation
  boundary, so it is realizable whether a chamber is a full Worker (B) or a WASM
  sandbox in a Worker (C). [Residual assumption — see `## Assumptions`: that the
  push is realizable across the isolation boundary in whichever model MVP2 picks;
  grounded in that it targets the cache layer, not the sandbox.]
- **Therefore the capability contract (step 5) can freeze on the *mechanism*
  alone.** The isolation model is runtime-internal plumbing with an identical
  capability surface (mediated sync cookie get/set backed by a broker-push-kept
  cache), so **B-vs-C no longer gates the contract.**

**What the probe does NOT decide: B-vs-C itself.** Coherency does not
discriminate B from C (both are multi-cache-over-one-broker; C is only easier),
and ADR-0001 deliberately **declined** to weigh the real drivers — fault
isolation, **confidentiality/containment of untrusted vendor code** (Option C's
pro, squarely relevant to alloy), per-thread overhead, capability-bridge
maturity — making "no forward reservation" and handing them to OQ9. This spec
does **not** re-attribute a decision to ADR-0001 it never made, and the probe
gives no evidence on those drivers. So B-vs-C **spins out as an explicit,
now-decoupled and non-blocking deferred decision** (a fresh refinement-todo item
/ a decision inside the alloy-connector spec), to be made on isolation-strength
grounds at connector-build time. The probe's only contribution to the isolation
axis is the **viability floor**: on a **go**, *some* per-connector isolation (B
or C) is viable; on a **no-go**, MVP2 retreats to a single shared worker —
foreclosing the model question, and dropping cross-connector confidentiality.

**Outcome:** a recorded go/no-go that resolves [OQ9](../../refinement-todo.md)
via a **dedicated ADR**. Per the decoupling above, the ADR records: (a) the
**synchronous-host-access mechanism** — probe-grounded (proven for the worst-case
Option-B topology, hence model-independent); (b) the finding that the
mechanism↔model **coupling is dissolved**, so the step-5 capability contract can
freeze on the mechanism alone; and (c) the **per-connector isolation viability**
floor — probe-gated. It **explicitly does not decide B-vs-C**, which it spins out
as a decoupled, non-blocking deferred decision (naming the isolation-strength
drivers ADR-0001 left open) — amending OQ9's "one coupled decision" premise with
the probe's finding that the two axes are *separable*. On a **no-go** (no
AD-4-compatible mechanism bounds the staleness acceptably for shared identity),
the outcome is the honest stop-and-re-shape signal for MVP2's whole
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

- **Option B is the worst-case coherency topology, so proving the mechanism for
  B proves it model-independently.** (The load-bearing premise of the decoupling
  above, reframed twice under frame-critique.) B's N separate cross-thread caches
  maximize the write-propagation and read-staleness windows; Option C (sandboxes
  sharing one realm/cache) is strictly easier. So a broker-push mechanism that
  bounds staleness acceptably for B bounds it for C too. [Residual risk: the
  broker→worker push must be *realizable across the isolation boundary* in
  whichever model MVP2 picks — a WASM sandbox (C) receiving the pushed value into
  the cache it reads. Grounded in that the push targets the worker/cache layer
  *below* the sandbox boundary (the capability bridge mediates the read either
  way), so it does not depend on the sandbox internals; but it is an argument,
  not a measurement — the rig builds only the Worker (B) case. Note this does
  **not** route the B-vs-C *choice* anywhere — that is spun out as a decoupled
  deferred decision; this assumption only underwrites that the *mechanism* is
  model-independent.]
- **The genuine out-of-band sources for the shared first-party identity cookie
  are reproducible and detectable in a Playwright/chromium harness.** Per R-004,
  the shared identity cookies (`AMCV_*`, `kndctr_*`) are **first-party**, written
  by Alloy's synchronous `document.cookie` JS from the Edge *response body* — not
  by a network `Set-Cookie`. So the load-bearing out-of-band writes (from
  *outside* any chamber) are a **main-thread write** by another first-party
  script and a **second-tab write**; a **same-origin server `Set-Cookie`** is the
  real network case that lands in the jar, while a **cross-site** demdex-style
  `Set-Cookie` is a *negative-boundary* case (it writes Adobe's domain or is
  CHIPS-partitioned, provably not the customer jar). Each realistic source can be
  driven deterministically and detected by broker jar re-read (`cookieStore`
  `change` + `document.cookie`; R-006 F3/F4). [To be probe-confirmed in 011-01's
  rig bring-up (`rig/` runs Playwright — `rig/isolation.mjs`, `rig/e2e.mjs`); a
  source that cannot be driven or detected is recorded as such — Kill criteria.]
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
