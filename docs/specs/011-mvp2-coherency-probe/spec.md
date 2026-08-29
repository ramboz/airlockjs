---
status: IN_PROGRESS
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
(in-band) writes, and the out-of-band writes from *outside* any chamber. Because
the identity cookie is only ever JS-written (R-004), the load-bearing out-of-band
writers are **other JS actors**: a main-thread write by another first-party
script (e.g. a co-resident legacy Adobe Visitor/ECID lib) and a second-tab write.
Network `Set-Cookie` enters only as a **negative boundary** — neither the
cross-site demdex variant (writes Adobe's domain / CHIPS-partitioned) nor a
same-origin server `Set-Cookie` (writes a *different* cell) mutates the cached
identity cookie. The rig scores the staleness window each opens.

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

**What the probe measures — and what it hands to the 011-03 ADR to interpret.**
OQ9 couples *two* axes: cross-thread **coherency** (can a cache be kept fresh
enough without SAB) and, for ADR-0001 Option **C** (WASM-sandbox-in-one-Worker),
**read-semantics** (ADR-0001 records C "must marshal each read across the
boundary, losing the unmodified-stock-bundle property"). **This probe is scoped
to the coherency axis only** — the rig measures cross-chamber cookie coherency
for the worst-case topology and reports whether broker-push invalidation bounds
staleness acceptably. Mapping that result onto OQ9's resolution (the B-vs-C model,
the contract freeze) is the **011-03 resolving ADR's** job, which weighs the
measurement against ADR-0001 and gets its own frame-critique. The spec states
only the interpretive facts the measurement genuinely grounds:

- **Option B is the worst-case *coherency* topology** (its N separate
  cross-thread caches force every cross-chamber propagation through an *async*
  hop — the only cross-agent channel without SAB, R-006 F2 — maximizing the
  write-propagation and read-staleness windows). The single-thread models are
  strictly easier on that channel: **Option C**'s per-connector sandboxes reach
  one host-side authority by *synchronous in-thread* mediation (the capability
  bridge — WASM→host imports are same-thread sync calls), and **Option D**
  literally shares one cache. So a **go** — staleness bounded acceptably for B —
  **transfers to them on the coherency axis** (a fortiori). This transfer is
  **directional**: a *positive* result generalizes down to the easier model; a
  *negative* result does not (see the no-go split below).
- **The no-go splits by axis, and the split is load-bearing:**
  - An **out-of-band no-go** (the broker cannot detect/propagate a foreign write
    fast enough) is **model-independent** — every model (B, C, *and* the single
    shared worker D) caches and so has the same broker↔cache staleness. This
    threatens the whole no-SAB-chambers premise → genuine **stop-and-re-shape**.
  - An **in-band no-go** (B's concurrent two-chamber RMW loses updates) is
    **B-specific** — the single-thread models are structurally immune (C's
    in-thread synchronous host mediation and D's one shared cache both
    event-loop-serialize the reads). So it does **not** kill the premise; it is
    evidence **discriminating C/D over B**, and thus a real *input* to the
    deferred model choice — coherency is not model-neutral in this branch.

**What the probe does NOT settle (explicitly handed to the 011-03 ADR):**

- **OQ9's read-semantics axis for Option C** — whether a WASM sandbox can honor a
  synchronous-by-reference cookie surface with an *unmodified* stock alloy bundle,
  or must marshal each read (ADR-0001) / place the cache to avoid it. The rig
  builds only the Worker (B) case, so this is **out of the probe's scope**;
  ADR-0001 says it is costly, R-006's addendum argues it need not be — an
  **unreconciled, unmeasured tension** the ADR must resolve, not the spec assert.
- **The B-vs-C model choice**, which ADR-0001 deliberately deferred (weighing
  fault isolation, **confidentiality/containment of untrusted vendor code** — C's
  pro, squarely relevant to alloy — overhead, and bundle-maturity). The probe
  gives no evidence on those drivers; it contributes only the coherency inputs
  above (the go/no-go and the in-band discriminator). Critically, **freezing the
  step-5 contract on a synchronous-by-reference cookie surface is itself a
  *constraint* on this deferred choice** (it tilts against a C that cannot honor
  sync-reads unmodified) — so B-vs-C is deferred but **pre-constrained**, not
  cleanly independent. The ADR records the freeze as an explicit input to it.

**Outcome:** the measured coherency scoreboard + a go/no-go on the coherency
axis, feeding a **dedicated 011-03 ADR** that resolves [OQ9](../../refinement-todo.md).
The **probe** grounds: the sync-access **coherency mechanism** (broker-push
invalidation, proven for the worst-case B topology so a go transfers to C on the
coherency axis); the **out-of-band vs in-band no-go split** (out-of-band =
premise-threatening/all-models; in-band = B-specific discriminator). The **ADR**
then interprets that onto OQ9: it may freeze the step-5 contract on the sync-read
capability shape (recording that freeze as an explicit *constraint* on the
deferred B-vs-C choice), it reconciles the still-open **read-semantics** tension
for C (ADR-0001's marshal-each-read vs R-006's counter), and it carries B-vs-C
forward as a **pre-constrained deferred decision** — not attributing to ADR-0001
a choice it declined. On an **out-of-band no-go**, the outcome is the honest
stop-and-re-shape signal for MVP2's whole no-SAB-chambers premise
([MVP2 release plan](../../releases/mvp2.md) No-Gos); on an **in-band-only
no-go**, it points the model choice toward a single-thread model (C or D) rather
than killing the premise.

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

- **Option B is the worst-case *coherency* topology, so a go transfers to C on
  the coherency axis — directionally.** (Load-bearing premise, narrowed three
  times under frame-critique.) B's N separate cross-thread caches force an *async*
  cross-chamber hop and so maximize the propagation/staleness windows; Option C
  (per-connector sandboxes reaching one host authority by *synchronous in-thread*
  capability-bridge mediation) is strictly easier on that channel. So a *positive*
  result (staleness bounded for B) generalizes down to C **on coherency**; a
  *negative* result does **not** (an in-band no-go is B-specific — see Kill
  criteria). [Two things this assumption deliberately
  does **not** claim, because both were over-reached in earlier drafts and are
  handed to the 011-03 ADR instead: (1) it does **not** claim C's *read-semantics*
  match B's — whether a WASM sandbox honors a sync-by-reference cookie read with
  an unmodified bundle (ADR-0001's marshal-each-read concern) is unmeasured here;
  the rig builds only the Worker (B) case. (2) It does **not** route the B-vs-C
  *choice* anywhere. It underwrites only that the *coherency mechanism* proven for
  B is not made worse by a shift to C.]
- **The genuine out-of-band sources are the two *JS* writers, and both are
  reproducible/detectable in a Playwright/chromium harness.** Per R-004 the shared
  identity cookies (`AMCV_*`, `kndctr_*`) are **first-party, JS-written** via
  synchronous `document.cookie` from the Edge *response body* — so the cookie the
  chambers cache is only ever mutated by JS. The load-bearing out-of-band writes
  (from *outside* any chamber) are therefore a **foreign main-thread script**
  write (e.g. a co-resident legacy Adobe Visitor/ECID lib mid-migration) and a
  **second-tab** write. Network `Set-Cookie` is **not** a positive source for this
  cell: a **same-origin** server `Set-Cookie` writes a *different* cookie
  (session/consent), and a **cross-site** demdex-style one writes Adobe's domain /
  is CHIPS-partitioned — both are *negative boundaries* the rig records (the
  finding: the network does not mutate the cached identity cookie in the
  client-side deployment R-004 probed). [The server-side/first-party-CNAME
  deployment that *would* `Set-Cookie` `kndctr_*` is a different mode R-004 never
  probed — explicitly out of scope, noted in 011-02.] Each realistic source is
  driven deterministically and detected by broker jar re-read (`cookieStore`
  `change` + `document.cookie`; R-006 F3/F4). [To be probe-confirmed in 011-01's
  rig bring-up (`rig/` runs Playwright); a source that cannot be driven or
  detected is recorded as such — Kill criteria.]
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
- **No AD-4-compatible mechanism bounds the staleness acceptably — split by
  axis, because the two branches escalate differently.** (A *zero*-staleness
  cross-chamber view is already known impossible without SAB — R-006 F2 — so
  "acceptable" means "bounded tightly enough that shared identity stays correct,"
  not "zero window.")
  - **Out-of-band branch** (the broker cannot detect/propagate a foreign write
    fast enough): **model-independent** — B, C, and the single-shared-worker D
    all cache, so none escapes it. MVP2's no-SAB-chambers premise is not retired:
    record it honestly; the 011-03 ADR escalates to an explicit AD-4 exception
    (SAB via ADR, per the release plan's conditional) or re-shaping MVP2's scope.
    This is the genuine **stop-and-re-shape** trigger.
  - **In-band branch** (B's concurrent two-chamber RMW loses updates): **B-specific**
    — the single-thread models are structurally immune (C's in-thread synchronous
    host mediation, or D's one shared cache, event-loop-serializes the reads).
    This does **not** kill the premise; it is a coherency *input that discriminates
    the model toward a single-thread model (C or D)*, recorded for the deferred
    B-vs-C decision. Not a
    stop-and-re-shape.
  Neither branch is a slice failure — each is a real, recorded finding.

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
   — the two-worker proxy (broker + authoritative jar + two sync-caches on a
   shared identity cookie) modelling the worst-case Option-B topology, plus the
   in-band threat: concurrent
   read-modify-write from both chambers. Delivers the rig everything else
   measures against **and** the first verdict — do two caches diverge under
   concurrent writes with async write-back, and how wide is the window?
2. **[011-02 — out-of-band write coherency](slice-02-out-of-band.md)** — extend
   the rig with the out-of-band writes from *outside* any chamber: the two
   **positive** JS sources (a foreign main-thread script, a second tab), each
   driven deterministically, plus network `Set-Cookie` as a **negative boundary**
   (it does not mutate the cached identity cell — R-004). Delivers the out-of-band
   verdict + per-source staleness characterization.
3. **[011-03 — coherency scoreboard + resolving ADR](slice-03-scoreboard-adr.md)**
   — synthesize the verdicts into the go/no-go on "coherent synchronous
   cross-chamber view without SAB," and record the dedicated ADR that resolves
   OQ9 (ADR-0001 B-vs-C isolation model + the sync-host-access mechanism), or
   the stop-and-re-shape signal on a no-go. Delivers the recorded decision that
   unblocks the step-5 capability-contract freeze.
