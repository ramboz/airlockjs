---
status: DRAFT
dependencies: [040-01, adr-0021]
last_verified:
frame_review: true
arch_review: true
---

## Slice 040-02 — core coalescing seam (post-verdict, per-cycle, protocol-pluggable)

**Goal:** Add the core-egress coalescing step ADR-0021 specifies: in `core/airlock.js`, **after** the per-request egress
consent seal (`egressVerdict`, `:254-286`) and the endpoint-ceiling check (`:287-299`), and **before** the `fetch`
(`:300`), coalesce the cycle's already-governed `ready` requests within a **coalescing group** via an optional
per-connector hook, defaulting to today's one-`fetch`-each behavior.

**Blocked-on:** 040-01's GO outcome (ADR-0021 kill-criterion #1). Do not build if 040-01 SHELVEs.

**DoR:**
- ✅ 040-01 GO — a measured, material request-count benefit on realistic streams.
- ✅ ADR-0021 Accepted — insertion point (post-verdict + ceiling, pre-fetch), group key, default-no-coalesce, and the
  perf-not-parity framing are settled.

**Acceptance Criteria:**

1. **Insertion point is governance-safe.** Coalescing runs strictly after `egressVerdict` (`:254-286`) AND
   `checkEndpointCeiling` (`:287-299`), over only the `ready` requests that passed both, before the `fetch` (`:300`). A
   test proves a denied event and a ceiling-blocked event are absent from any merged request (never smuggled).
2. **Coalescing group key.** Requests merge only within one group — same endpoint URL (origin+path), same governing
   consent verdict, same credential/mode context — and only within one drain cycle (never across cycles). Cross-group
   requests dispatch separately. (Per ADR-0021's 040-note, the verdict is cycle-uniform today, so the real separating
   dimension is endpoint/URL — but the key encodes all three for forward-safety.)
3. **Protocol-pluggable hook + safe default.** A connector may declare `coalesce(requests) -> EgressRequest[]`; absent a
   declaration, each request dispatches as its own `fetch` **byte-unchanged from today** (strictly additive — a
   regression test pins that Meta/LinkedIn/pixel/Alloy/GA4-single-event egress is identical).
4. **Perf/behavior ACs, not parity.** On a same-group burst the coalesced path issues fewer requests; **no event is
   lost**; the hook runs on the (INP-safe) dispatch path per ADR-0021. No 038 beacon-diff AC (the oracle can't score
   transport).

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Coverage: a same-group 2+ burst coalesces; a cross-endpoint pair does NOT merge; a denied/ceiling-blocked event is
      absent from the merge; a no-declaration connector is byte-identical to today; cross-cycle never merges.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` (compliance + craft; `arch_review: true` — a new core egress seam).
- [ ] Deviation log + reconciliation sweep produced.

## Assumptions

- **The coalescing group key (endpoint+verdict+credential) is sufficient to never mis-merge.** ADR-0021 kill-criterion
  #2: if a correct key proves to merge events that must stay separate, or forces the egress-seal logic to be re-derived
  inside the coalescer, Option C is void. To be confirmed against the real connector set during implementation. (Why
  `frame_review: true`.)
- **Retry/failure semantics for a merged request are out of this slice** — a failed coalesced request drops N events;
  ADR-0021 open question, deferred to its own slice. This slice must not regress the current per-request keepalive
  best-effort behavior for the no-coalesce default.

## Anti-horizontal-phasing check

After this slice, a connector that opts in (starting with 040-03's GA4 adapter) emits fewer requests on a same-group
burst end-to-end through the real governed egress path — a measurable, user-facing (perf) behavior, not an internal
layer. The default-no-coalesce path keeps every existing connector byte-identical.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
