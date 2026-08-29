---
status: CONCLUDED
topic: AD-4-compatible mechanisms for synchronous host-cookie access + cross-chamber coherency
created: 2026-08-28
related:
  - ../decisions/adr-0001-chamber-isolation-strength.md
  - ../research/R-004-alloy-in-worker.md
  - ../refinement-todo.md
  - ../specs/011-mvp2-coherency-probe/spec.md
---

# R-006: Cross-chamber cookie-coherency mechanisms

> This is an **open investigation** (now concluded), not a decision and not
> committed work. It is the *documentation phase* that bounds the mechanism
> space **before** spec 011's rig measures behavior empirically — the same
> two-phase shape [R-004](R-004-alloy-in-worker.md) used (predict from the
> platform spec, then confirm by executed probe). It exists to **de-risk the
> scope** of spec 011 (the OQ9 coherency probe): what mechanisms even exist,
> so the rig models the right problem and the resolving ADR chooses from a
> real option set.

## Question

For MVP2's multi-chamber world, what mechanisms exist — **within AD-4** (no
SharedArrayBuffer / COOP-COEP) — to give a chamber synchronous cookie/storage
reads AND keep two chambers' views of a shared identity cookie coherent, under
concurrent and out-of-band writes? Which are viable enough for spec 011's rig
to measure and the resolving ADR to choose among?

## Sources / findings

Documentation phase (platform-spec facts; the executable confirmations are
handed to [spec 011-01](../specs/011-mvp2-coherency-probe/slice-01-coherency-rig.md)'s
rig bring-up and marked **[probe]** below).

### F1 — A dedicated-worker chamber has *no* direct cookie API at all

Airlock chambers are **dedicated** Web Workers ([AD-4](../architecture.md);
[ADR-0001](../decisions/adr-0001-chamber-isolation-strength.md) Option A/B).
A `DedicatedWorkerGlobalScope`:

- has **no `document`**, so the synchronous `document.cookie` accessor Alloy
  depends on ([R-004](R-004-alloy-in-worker.md)) **does not exist** in-worker;
- is **not** exposed the async **CookieStore API** — `cookieStore` is a
  property of `Window` and `ServiceWorkerGlobalScope` only, **not**
  `DedicatedWorkerGlobalScope` (confirmed via MDN, below).

The cookie-access surface reachable from a dedicated worker is therefore closed
to exactly these two members, and **both are absent**. Consequence: every
chamber cookie read/write is *necessarily* **mediated through the main-thread
broker** — there is no in-worker path to the jar to keep coherent. This is the
central scope fact: the coherency problem is **not** "two threads race on a
shared cookie cell," it is "**N per-chamber caches, each seeded/synced from the
one main-thread authority** that alone can touch the jar." R-004's single-chamber
shim already works this way (sync-cache seeded at boot, async write-back to the
real `document.cookie` on the main thread).

### F2 — No AD-4-compatible mechanism gives *synchronous* cross-agent reads

Cross-agent (main↔worker, worker↔worker) communication on the web platform is a
**closed set** defined by the HTML agent/agent-cluster model: `postMessage`
(structured clone), `MessageChannel`/`MessagePort`, and `BroadcastChannel` are
all **asynchronous** message-passing; the **only** synchronous shared-memory
channel is a `SharedArrayBuffer` read under `Atomics`, which requires the
cross-origin isolation (COOP/COEP) that **AD-4 forbids** (and
[R-003](R-003-partytown-mechanism-check.md) already validated AD-4). The
enumeration is closed because these are the *only* inter-agent channels the
spec defines — a worker cannot reach another agent's memory except through one
of them. So **within AD-4, a chamber's synchronous cookie read can only ever be
served from a local cache**, never from a live cross-thread fetch of the
authority. Synchronicity ⇒ cache ⇒ a staleness window. This is not a shim
limitation to engineer away; it is the platform boundary the probe measures
*inside* of.

### F3 — The main-thread broker CAN stay coherent with out-of-band writes (async)

The authority (main thread) is not blind to out-of-band cookie changes:

- **CookieStore `change` events** — `cookieStore.addEventListener('change', …)`
  fires (asynchronously) when a cookie is set/deleted, including by a network
  `Set-Cookie` or another same-origin context. This is the platform's intended
  cookie-change-notification primitive and is the strongest candidate for the
  broker to learn of out-of-band writes without polling. **[probe]** exact
  fire timing / coverage across the three OOB sources.
- **`document.cookie` polling** — the fallback if change events are
  insufficient; coarse and costs main-thread work.
- **`BroadcastChannel`** — for the *second-tab* source specifically, tabs can
  cooperatively broadcast their own writes (only works for writes airlock
  itself makes; a foreign script's write is invisible to it and falls back to
  change events / polling).

So the broker can approach coherence **asynchronously**; what it cannot do is
push that freshness into a chamber's *synchronous* cache without a lag (F2).

### F4 — A network `Set-Cookie` is observable only by re-reading the jar

`Set-Cookie` is a **forbidden response-header name**: JS cannot read it off a
`fetch()` `Response.headers`. A credentialed-fetch cookie write is therefore
observable to airlock only *after the fact*, by re-reading `document.cookie` /
`cookieStore.get()` / receiving a `change` event — never by inspecting the
response. Consequence for [spec 011-02](../specs/011-mvp2-coherency-probe/slice-02-out-of-band.md):
the rig must measure the `Set-Cookie` source by **jar re-read on the broker**,
not header inspection, and the chamber-visible staleness = (broker-detects-lag)
+ (broker→chamber sync-lag).

### Sources

- [DedicatedWorkerGlobalScope — MDN](https://developer.mozilla.org/en-US/docs/Web/API/DedicatedWorkerGlobalScope)
- [ServiceWorkerGlobalScope: cookieStore — MDN](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/cookieStore)
  (cookieStore is a Window / ServiceWorker property — absent on dedicated workers)
- [Cookie Store API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Cookie_Store_API)
  (async; `change` events; "does not rely on Document … available to service workers")
- [R-004](R-004-alloy-in-worker.md) (the single-chamber sync-cache shim this generalizes);
  [ADR-0001](../decisions/adr-0001-chamber-isolation-strength.md) (the B-vs-C + sync-access coupling handed to OQ9)

## Options / pros & cons

The mechanism space for **broker→chamber freshness** (given F1/F2 fix the
architecture as broker-authority + per-chamber cache):

- **A. Seed-once + async write-back** (R-004's MVP1 shim, generalized). *Pros:*
  proven single-chamber; simplest. *Cons:* no invalidation — a chamber's cache
  goes stale on *any* write it didn't make (the other chamber, or any OOB
  source) and never reconciles within a page. Almost certainly insufficient for
  two chambers sharing identity.
- **B. Broker-push invalidation on change** (CookieStore `change` → broker
  broadcasts new value to all chambers via `postMessage`). *Pros:* AD-4-clean;
  bounded staleness ≈ change-event latency + postMessage hop; covers all OOB
  sources F3 lists. *Cons:* the window is **non-zero and async** — a chamber can
  still read stale between the write and the push; ordering under concurrent
  two-chamber writes needs a broker-serialized last-writer rule.
- **C. Per-read marshalling** (chamber blocks on a synchronous request to the
  broker for every read). *Pros:* always fresh. *Cons:* **impossible within
  AD-4** — a synchronous worker→main request needs `SharedArrayBuffer`+`Atomics.wait`
  (forbidden), so this collapses to B or to SAB. Also the ADR-0001 Option-C
  (WASM-sandbox) "marshal each read" path loses R-004's unmodified-stock-bundle
  property.
- **D. Single shared worker for the whole Adobe stack** (one chamber hosts both
  Analytics + Target; they share *one* cache, so cross-chamber coherency is
  moot). *Pros:* trivially coherent (back to R-004's single-realm case). *Cons:*
  drops per-connector confidentiality *between* Analytics and Target — a
  retreat on the isolation half of OQ9, acceptable only if B/SAB are rejected.
  This is the natural **no-go fallback** the resolving ADR would land on.

## Open questions

Handed to spec 011's rig as the empirical measurements this survey can't settle
on paper:

- **[→ 011-01]** Under Option A (seed + async write-back), how wide is the
  concurrent-write divergence window between two chamber caches, and does it
  ever reconcile within a page?
- **[→ 011-02]** For each OOB source, what is the broker-detection latency
  (CookieStore `change` timing vs polling) and the resulting chamber-visible
  staleness? Is a foreign second-tab write ever detected at all without polling?
- **[→ 011-03]** Is Option B's bounded-but-async window *acceptable* for
  identity coherence (does a stale ECID/demdex read cause a real correctness
  fault — duplicate identity, split session — or is it self-healing)? This is
  the crux the go/no-go turns on.

## Conclusion

**The MVP2 coherency question is architecturally bounded before any code runs.**
Three findings fix the shape:

1. A dedicated-worker chamber has **no cookie API** (F1) → the main thread is
   the sole cookie authority; chambers hold **caches**, and the probe measures
   *cache freshness*, not a shared-memory race.
2. **No AD-4-compatible mechanism gives synchronous cross-agent reads** (F2) →
   synchronicity necessarily implies a local cache and therefore a **non-zero
   staleness window**. The probe's job is to measure that window's width and
   whether it causes a *correctness* fault — not to hunt for a zero-staleness
   design, which the platform forbids without SAB.
3. The broker **can** learn of out-of-band writes asynchronously (F3/F4) →
   Option **B** (broker-push invalidation on CookieStore `change`) is the
   leading AD-4-clean candidate; Option **D** (single shared worker, dropping
   cross-connector confidentiality) is the honest no-go fallback.

**Scope impact on spec 011** (folded into the spec's framing): the rig's
"authoritative jar" lives **only** on the broker (not reachable from workers);
the two-worker proxy measures **broker↔cache freshness**, and the resolving ADR
chooses among options A/B/D above (C is out within AD-4). The probe is thus
reframed from "can we achieve synchronous coherence" (F2 says no, for free) to
"**is the unavoidable async staleness window a correctness problem for shared
identity, and does Option B bound it acceptably**" — a sharper, measurable
question.

Promoted to: [spec 011](../specs/011-mvp2-coherency-probe/spec.md) (scope +
`## Assumptions` grounding; option set for the 011-03 resolving ADR). Remains
the documentation phase; empirical confirmation is spec 011's rig.

## Addendum (2026-08-28) — mechanism is model-independent; naming

Spec 011's frame-critique sharpened two points worth recording here so this note
and the spec stay consistent:

- **Letter collision.** This note's mechanism options are lettered **A/B/D**;
  [ADR-0001](../decisions/adr-0001-chamber-isolation-strength.md)'s *isolation
  models* are lettered **B/C**. They are different axes. Spec 011 refers to the
  mechanisms by **name** (seed+write-back / broker-push / single-shared-worker)
  to avoid the collision; prefer that here too when citing across the two docs.
- **The *coherency* mechanism is isolation-model-independent; the *read-semantics*
  are not settled here.** F1/F2 fix the broker as sole authority reachable only
  asynchronously, for *both* ADR-0001 Option B (worker-per-chamber) and Option C
  (WASM-sandbox-in-one-Worker). Because **Option B is the worst-case coherency
  topology** (N separate cross-thread caches), a broker-push mechanism proven to
  bound staleness for B bounds it for C *a fortiori* — so the **coherency** axis
  of OQ9 is model-independent, and a *go* transfers from B to C.
  - **Directional, not symmetric** (sharpened by spec 011's frame-critique): that
    transfer holds for a *positive* result only. A *negative* in-band result is
    B-specific — the single-thread models are structurally immune (C's per-connector
    sandboxes reach one host authority by synchronous in-thread mediation; D shares
    one cache) — so an in-band no-go discriminates *toward* C/D rather than transferring.
  - **Read-semantics is a separate, open axis.** OQ9 also couples C's
    "marshal each read, losing the unmodified-stock-bundle property"
    ([ADR-0001](../decisions/adr-0001-chamber-isolation-strength.md):88–90) —
    a *read-side capability-surface* question, not a coherency one. An earlier
    draft of this addendum asserted C "can use broker-push + a local cache like B,
    no marshalling"; that is an **unmeasured documentation-phase argument in
    unreconciled tension with ADR-0001:89**, and it is **withdrawn as a settled
    claim**. Whether C honors a sync-by-reference read with an unmodified bundle
    (cache inside the sandbox vs host-side, and its stock-bundle cost) is left
    **open for spec 011's resolving ADR** to reconcile — this note does not settle
    it. The coherency finding above stands regardless.
