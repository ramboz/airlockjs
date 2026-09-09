---
status: IN_PROGRESS
dependencies: [040-01, adr-0021]
last_verified:
frame_review: true
arch_review: true
claimed_by: claude/spec-039-jigceremony-d53c78
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

1. **Governance-safe on BOTH inputs AND output (frame-critique correction).** Coalescing runs strictly after
   `egressVerdict` (`:254-286`) AND `checkEndpointCeiling` (`:287-299`), over only the `ready` requests that passed both,
   before the `fetch` (`:300`) — so denied/ceiling-blocked *inputs* never reach the coalescer (tested). **AND** the
   coalescer's *output* — an `EgressRequest[]` (the hook may split, per the payload-ceiling open question) — has **every**
   returned request re-validated before dispatch: each merged request's endpoint (origin+path) must equal the group's
   ceiling-passed endpoint, enforced by **re-running the pure `checkEndpointCeiling` on each output request** before
   `fetch` (defense-in-depth) — because the output re-enters `:300` and would otherwise egress un-re-checked (the
   ADR-0021:88 ceiling-bypass hazard, closed here for outputs too, not just inputs). A test proves a hook that emits an
   off-endpoint URL is caught (that output dropped/held), never egressed.
2. **Coalescing group key — origin+path today; the rest is forward-safety / adapter-refined.** The core key is the
   endpoint **origin+path** (+ the governing verdict, which is cycle-uniform today per ADR-0021's 040-note, so it does
   not separate anything yet). "credential/mode" is a **forward-safety placeholder only** — no `EgressRequest` field
   carries it today (`contracts/connector.d.ts`: url/method?/headers?/body?/unloadCritical?; `fetchInit` consumes only
   method+body), so it currently collapses to a constant; the slice states this rather than implying a real dimension.
   **The core key deliberately ignores query**, so it is NOT by itself a safe-to-merge guarantee for a connector whose
   identity lives in the query (GA4's `tid`): the core hands the connector's `coalesce` hook a same-origin+path group and
   the **hook** is responsible for any finer split (GA4 same-`tid`, OQ#3 → 040-03). Only within one drain cycle; never
   across cycles.
3. **Protocol-pluggable hook + safe default — a behavior-preserving RESTRUCTURE, not a bolt-on.** The current dispatch
   loop (`core/airlock.js:248-302`) verifies + fetches each request **inline** in one `for`; there is no materialized
   post-verdict "ready set." 040-02 **splits** it into *collect survivors* (events that passed verdict+ceiling) → *group
   + coalesce + dispatch*, preserving the existing `heldBeacons` push order, `beaconSeq`/`beaconId` increments, and
   `diagnose` emission order exactly. A connector may declare `coalesce(requests) -> EgressRequest[]`; **absent a
   declaration, each request dispatches as its own `fetch` byte-unchanged from today** (the default path is
   behavior-identical — a regression test pins Meta/LinkedIn/pixel/Alloy/GA4-single-event egress + a **mixed
   send/hold/drop ordering** as identical).
4. **Perf/behavior ACs, not parity.** On a same-group burst the coalesced path issues fewer requests; **no event is
   lost**; the hook runs on the (INP-safe) dispatch path per ADR-0021. No 038 beacon-diff AC (the oracle can't score
   transport).

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Coverage: a same-group 2+ burst coalesces; a cross-endpoint pair does NOT merge; a denied/ceiling-blocked *input*
      is absent from the merge; a hook that emits an **off-endpoint output** is caught (not egressed); a no-declaration
      connector is byte-identical to today (incl. a **mixed send/hold/drop ordering** pinning `heldBeacons`/`beaconSeq`/
      `diagnose` order across the loop restructure); cross-cycle never merges.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` (compliance + craft; `arch_review: true` — a new core egress seam + a dispatch-loop restructure).
- [ ] Deviation log + reconciliation sweep produced.

## Assumptions

- **Governance holds on the OUTPUT, not just inputs (frame-critique correction).** Guarding the coalescer's inputs
  (insert after `egressVerdict`+`checkEndpointCeiling`) is necessary but NOT sufficient: the merged output re-enters
  `fetch` at `:300`, so it is re-validated against the pure `checkEndpointCeiling` before dispatch (AC1). Without that, a
  hook emitting an off-endpoint URL bypasses the declared-endpoint ceiling — the ADR-0021:88 hazard, closed here for the
  output.
- **The core group key is origin+path only, today.** The "credential/mode" dimension is a forward-safety placeholder —
  no `EgressRequest` field carries it (`fetchInit` uses only method+body), so it collapses to a constant; the core key
  also ignores query, so it does NOT by itself separate a query-carried identity (GA4 `tid`). Finer splits are the
  connector `coalesce` hook's job (GA4 same-`tid`, OQ#3 → 040-03). Confirmed against the real connector set at
  implementation. (Why `frame_review: true`.)
- **This is a behavior-preserving restructure of the dispatch loop, not an addition.** `core/airlock.js:248-302` fuses
  verify+fetch inline; 040-02 splits it (collect survivors → group+dispatch) while pinning `heldBeacons`/`beaconSeq`/
  `diagnose` order byte-identically on the no-coalesce default path (AC3).
- **Retry/failure semantics for a merged request are out of this slice** — a failed coalesced request drops N events;
  ADR-0021 open question, deferred to its own slice. This slice must not regress the current per-request keepalive
  best-effort behavior for the no-coalesce default.
- **Prior art / non-overlap — `core/coalescing-broker.js` is a DIFFERENT mechanism; do NOT extend or wire into it.**
  A module named "coalescing broker" already exists (`core/coalescing-broker.js`, spec 014-02 / ADR-0008). It is
  **not** this seam and **must not** be conflated with it. It is Adobe Alloy's **identity-mint deduper**: it wraps
  `core/wrapped-sdk-host.js`'s **round-trip** egress `dispatch` (a `Promise<{status,body,…}>`, because ECID minting
  needs the server response) and suppresses concurrent/late duplicate `interact` first-mints so exactly ONE `interact`
  egresses per *identity* — keyed by identity mint, a **correctness** concern. Its own docstring states
  "`core/airlock.js` and `core/chamber.worker.js` are UNTOUCHED — this is a new, parallel module" (`:5-7`), and it has
  **no production wiring** today (grepped 2026-09-09: `createCoalescingBroker`/`handleInterceptedFetch` referenced only
  in `test/coalescing-broker-core.test.js`). 040-02 targets the **other** path entirely: the connector-host
  `{ready}`→`core/airlock.js` `worker.onmessage` **fire-and-forget keepalive `fetch`** dispatch (`:244-312`), keyed by
  **endpoint** (origin+path), a **request-count** (perf) concern. The implementer builds the 040 seam **inline in
  `core/airlock.js`'s dispatch** (or a small pure helper it calls) — NOT by importing, extending, or routing through
  `createCoalescingBroker`. **Name to disambiguate** (e.g. "egress batch-coalesce" / `coalesce` hook), never reuse the
  "broker" name. *(The broker is, however, a useful **precedent** for the injected-per-connector-strategy shape — its
  `recognize`/`extractIdentity` injection from `connectors/alloy/xdm-mint.js` mirrors ADR-0021's
  `coalesce(requests)->EgressRequest[]` hook. Cited in ADR-0021 Amendments 2026-09-09.)*

## Anti-horizontal-phasing check

After this slice, a connector that opts in (starting with 040-03's GA4 adapter) emits fewer requests on a same-group
burst end-to-end through the real governed egress path — a measurable, user-facing (perf) behavior, not an internal
layer. The default-no-coalesce path keeps every existing connector byte-identical.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
