---
status: DEFERRED
dependencies: [039-01]
last_verified:
frame_review: true
arch_review: true
---

## Slice 039-04 — batched POST transport (per-cycle event coalescing)

> **DEFERRED (2026-09-08).** Frame-critique found this framing does not hold as a *parity* slice: the 038 same-protocol
> oracle is a field-level semantic diff (normalizes ordering/sequence, "never raw URL equality"), so N GETs and one
> batched POST classify identically — batched POST buys no parity the harness can verify, the lock-through cycle
> boundary ≠ gtag's flush boundary, and cross-page `dl` in one cycle risks mis-attribution. **But batch/coalesced egress
> is a first-class, cross-cutting performance capability the library should offer out-of-the-box** — not a gtag-specific
> parity detail. It is therefore lifted OUT of spec 039 (a parity spec) and INTO a dedicated cross-connector
> egress-batching effort (see the batching spec + its ADR). This slice is parked here for provenance only.
>
> **Resolution trigger:** Superseded by [ADR-0021](../../decisions/adr-0021-core-egress-batching.md) (Accepted) + spec
> [040-core-egress-batching](../040-core-egress-batching/spec.md) — batching as a core OOTB perf feature across all
> connectors. The GA4 multi-`en` POST specifically is revived as **slice 040-03** (on the shared core seam, 040-02),
> gated on 040-01's measurement. Re-open a gtag-specific slice here only if a GA4-specific batching need survives that spec.

**Goal:** When a single **lock-through cycle** (one ring-buffer drain crossing the airlock) carries **≥2 events for the
same GA4 stream**, coalesce them into **one** `/g/collect` **POST** — shared/context params on the query string, one
`en=…` line per event in the request body — instead of emitting N separate GET beacons. A single-event cycle stays the
039-01 GET. This matches the container's own gtag batching byte-for-byte (observed live 2026-09-08: a 2-event dispatch
went out as one POST with body `en=page_view&_ee=1\r\nen=airlock_probe&_ee=1&_et=1`).

**DoR:**
- ✅ 039-01 done — the single-event GET beacon + field mapping exist.
- ✅ Off-thread egress supports method + body — `core/airlock.js` egress sets method/body/keepalive (038-03 frame-critique
  grounded `core/airlock.js:48-50`), so no new egress seam is needed; this slice adds a batch-aware connector entry point.
- ✅ Events already arrive batched — a lock-through cycle drains a batch per ring-buffer drain (glossary: **cycle** /
  **lock-through**), so same-stream coalescing has a natural boundary.

**Acceptance Criteria:**

1. **Batch entry point.** The connector exposes a batch-aware dispatch (e.g. `handleBatch(evts)`) that, given ≥2 events
   for the same stream in one cycle, returns a **single** `{ url, method: "POST", body }` where `url` carries the
   shared/context params (`v`/`tid`/`cid`/`sid`/session-state/`gcs`/`gcd`/…) and `body` carries one `en=…&…` line per
   event, `\r\n`-separated, in cycle order.
2. **Single-event cycles are unchanged.** A cycle with exactly one event still returns the 039-01 `{ url, method: "GET" }`
   — the batched POST is used **only** for ≥2 events (no behavior change for the common single-event case).
3. **Only same-stream, same-cycle events coalesce.** Events for different streams (different `tid`) are never merged into
   one POST; events from different cycles are never merged (coalescing is bounded to one lock-through drain).
4. **Shared-vs-per-event field partition matches the observed beacon.** Context/session/consent params ride the query
   string once; per-event params (`en`, `ep.`/`epn.`, `_et`, `_ee`) ride the body per line — asserted against the
   observed batch shape (redacted fixture / unit assertion).
5. **Additive — MP untouched** (`connectors/ga4/map.js` + `contracts/ga4-mp*` unchanged) and 039-01's GET path
   unmodified for single events.

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Coverage: a 2-event same-stream cycle (one POST, 2 body lines), a 1-event cycle (still GET), a mixed-stream cycle
      (no cross-stream merge), and the query-vs-body field partition.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` (compliance + craft; `arch_review: true` — a batch-coalescing transport boundary).
- [ ] Deviation log + reconciliation sweep produced.

## Assumptions

- **The batch trigger is event-count, and the coalescing boundary is one lock-through cycle.** Observed live: gtag sends
  ≥2 events as one POST and a lone event as a GET. The exact count/size threshold gtag uses internally (and any payload
  ceiling forcing a split) is documented/inferred, not exhaustively measured; airlock's rule — coalesce all same-stream
  events in one cycle — is a faithful, bounded approximation, not a claim to reproduce gtag's internal flush heuristic
  event-for-event. (Why `frame_review: true`.)
- **Body encoding** mirrors the observed `en=…&_ee=1[&_et=…]` per-line shape; `_ee`/`_et` per-event semantics are carried
  as observed, not re-derived.

**Anti-horizontal-phasing check:** After this slice a burst of same-stream events on a rewired page reaches `/g/collect`
as the one batched POST the container's own tag would send — transport parity under event bursts, end-to-end and
verifiable by the parity harness, not an internal-only optimization.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
