---
status: ABANDONED
kind: spike
dependencies: [011-02]
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 011-04 — async-mint coalescing needs broker-proxied egress (the OQ9 mechanism + its condition)

**Abandonment reason (2026-08-29, owner decision).** The seven-round ADR-0008
frame-critique process established the mechanism + its condition **analytically** —
broker-side async mint coalescing, conditional (for the wrapped-SDK archetype) on
chamber-side vendor-`fetch` interception into the orchestrator's *existing* main-thread
dispatch (ADR-0004) plus XDM mint-recognition. The deterministic op-model **cannot
measure** this (the single-threaded broker serializes the requests — there is no timing
race), so a demonstration rig would only restate the analysis. ADR-0008 records the
converged result; this measurement slice is abandoned as superseded by it. (Its job —
surfacing the real mechanism — was done by the critique process itself.)

**Goal:** Model identity minting as it *actually* happens — an **async Edge
round-trip** returning a server-assigned ECID (R-004) — and **demonstrate** the
mechanism that retires the concurrent first-mint fault (broker-side async request
coalescing) **together with the egress condition it requires**. The load-bearing
correction (011-04 design frame-critique): in airlock's **default** egress model the
mint `fetch` is **worker-issued** (AD-2 "direct keepalive"; R-004 shows Alloy
fetching from *inside* the worker), so the broker sees **only the write-back** — and
write-back coalescing is exactly the value-push ADR-0008 already found **cannot
un-mint**. Broker-side coalescing therefore **requires routing the mint request
through the broker** — an **edge-proxied / service-worker-chokepoint egress-seam
driver** (present in AD-1's seam list, but *not* the default). This slice demonstrates
both halves: (a) default worker-issued egress → fault, broker cannot coalesce; (b)
broker-proxied egress → broker coalesces → no fault; for **B and C/D alike**, **no
SAB**. So OQ9's coherency-axis GO is **conditional on adopting broker-proxied egress
for identity mints** — the evidence + condition ADR-0008 (011-03) records.

**Question:** Does broker-side async request coalescing retire the concurrent
first-mint fault, and does it **require** broker-proxied egress (routing the mint
`fetch` through the single-threaded broker) rather than airlock's default
worker-issued `fetch` — under which the broker sees only the write-back and cannot
un-mint two already-issued Edge requests?

**Time-box:** ~1 day. Reuse the 011-01/02 rig + deterministic op-model; model the mint
`fetch` under two egress drivers (worker-issued vs broker-proxied) and add the
broker's in-flight-mint table + coalescing rule for the proxied case.

**DoR:**
- ✅ [R-004](../../research/R-004-alloy-in-worker.md): the ECID is server-assigned,
  JS-written from the Edge *response* body; Alloy issues its Edge `fetch` **from the
  worker** (the mint is a worker-issued async round-trip by default).
- ✅ `docs/architecture.md` AD-2 / Tech stack: default egress is `fetch(...,
  {keepalive})` from the worker; AD-1's egress seam lists a **service-worker
  chokepoint** and **edge-proxied** driver as alternatives (broker-mediated egress is
  *available*, not default).
- ✅ [R-006](../../research/R-006-cross-chamber-cookie-coherency-mechanisms.md) F1 —
  the broker is the sole *cookie* write-back authority (it does **not** by itself
  mediate network egress; that is the correction this slice grounds).
- ✅ [ADR-0008](../../decisions/adr-0008-oq9-coherency-sync-access.md) (Proposed) is
  blocked on this demonstration.

**Acceptance Criteria:**

1. **Async-mint model under two egress drivers.** A mint = read cached identity; if
   empty, issue an async "Edge" request (stub returns a unique server-assigned ECID
   after an explicit, reproducible gap); write the returned ECID. Model **both**
   egress drivers: **(default) worker-issued** — the request does *not* pass through
   the broker (broker sees only the async write-back); **(proxied)** — the request is
   routed *through* the broker.
2. **Default worker-issued egress → fault, not retirable at write-back.** Two chambers
   both read empty and both issue their own Edge requests → **two distinct ECIDs**;
   the broker, seeing only the write-backs, can at most value-push — which **cannot
   un-mint** an already-emitted ECID → **split identity**. Demonstrate in both B and
   C/D (the fault is at the fetch level, model-independent).
3. **Broker-proxied egress → coalescing retires it.** With the mint request routed
   through the broker, give the broker an **in-flight-mint table**: a second
   identity-mint request arriving while one is in flight is **coalesced** (no second
   Edge request; on the first response, the one ECID is returned to *both*).
   Demonstrate: **one** Edge request, both chambers attach the **same** ECID → **no
   fault**, in both B and C/D.
4. **No SAB / async-only / model-independent — given proxied egress.** The coalescing
   uses only the broker's single-threaded serialization + an async hold. No
   SharedArrayBuffer, no synchronous cross-thread signal. It does **not** discriminate
   B-vs-C (the coalescing point is the broker). Its **necessary condition** is
   broker-proxied egress (AC2 shows the default cannot host it).
5. **Verdict + reconciliation.** Report per (egress-driver × topology) fault vs
   no-fault, retrievable programmatically. Conclude: broker-side async request
   coalescing retires the concurrent first-mint **model-independently, no SAB**,
   **conditional on broker-proxied egress** for identity mints (a required egress-seam
   driver — edge-proxied / service-worker chokepoint, AD-1 — *not* the default
   worker-issued `fetch`). This is the GO-with-condition ADR-0008 needs. Reconcile
   with 011-01: its `concurrent-async-writeback` fault modeled a *synchronous* local
   mint (a different, less-realistic case); surface that clarification **and** the
   broker-proxied-egress requirement for **owner input** (issue #125) — do not rewrite
   011-01 unilaterally.

**DoD:**
- [ ] ACs 1–5 pass; each scenario is deterministic + reproducible; the detector
      fails both ways (default → fault; proxied+coalescing → no-fault).
- [ ] Spike-light review: compliance + craft recorded pass.
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] `docs/refinement-todo.md` OQ9 annotated with the verdict + the
      broker-proxied-egress condition; any 011-01 clarification **surfaced for owner
      approval**, not applied unilaterally.

**Findings:** _Filled during IN_PROGRESS._

**Outcome:** _Set at DONE — e.g. `ADR-0008 unblocked; broker async-coalescing retires
the first-mint (no SAB) IFF egress is broker-proxied`._

**Anti-horizontal-phasing check:** after this slice, the rig demonstrates the concrete
mechanism (broker-side async coalescing) *and* its necessary condition (broker-proxied
egress), the artifact ADR-0008's conditional GO stands on. Observable value: the
mechanism + condition, shown, not argued.

### Deviation log (after reconciliation)

_TODO._

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `docs/refinement-todo.md` | `updated` | _TODO: OQ9 annotated with the coalescing verdict + broker-proxied-egress condition._ |
| `docs/specs/011-mvp2-coherency-probe/slice-01-coherency-rig.md` | `deferred` | _TODO: surface the sync-mint-vs-async clarification for owner approval (issue #125) — do not apply here._ |
| `docs/specs/README.md` | `updated` | _TODO: regenerated by `workflow.py status-board`._ |
| `docs/architecture.md` | `no-op` | _TODO: probe rig; the egress-seam-driver requirement is recorded by ADR-0008 in 011-03, not here._ |
| `docs/decisions/README.md` / ADR index | `no-op` | _TODO: ADR-0008 concluded in 011-03, not here._ |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | _TODO: checked._ |
| `docs/memory/**` | `no-op` | _TODO: memory-sync result._ |
