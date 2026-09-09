---
slice: 040-02 — core coalescing seam (post-verdict, per-cycle, protocol-pluggable)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T19:49:47Z
prompt_source: review.py frame-critique docs/specs/040-core-egress-batching/slice-02-core-coalescing-seam.md (round 2)
---

VERDICT: pass (round 2)

## Reasoning

The single load-bearing assumption — that per-event governance is preserved through coalescing — is now guarded on
both sides: inputs are filtered post-`egressVerdict`+`checkEndpointCeiling`, and the coalescer output is re-validated
via the confirmed-**pure** `checkEndpointCeiling`. Each mechanism the slice names was verified to exist and behave as
claimed in source. The other two corrected assumptions (origin+path key with a vacuous credential/mode dimension and a
cycle-uniform verdict; a behavior-preserving loop restructure) are both grounded against `core/airlock.js:248-302`,
`contracts/connector.d.ts:73-87`, and `fetchInit` at `:48-49`. The strongest structural attack — that a coalescing
group (origin+path) can't reliably map to a single connector's `coalesce` hook because `EgressRequest` carries no
connector identity — collapses because the runtime is **single-connector-per-airlock** (`core/airlock.js:7`; each
`createAirlock` posts to one Web Worker chamber, `connector-host.js:67-89` wraps exactly one connector), so one
`ready` set is single-connector and "the connector's hook" is unambiguous.

## Round-1 findings — all three verified genuinely closed

1. **Output re-check (AC1).** `checkEndpointCeiling` (`core/endpoint-ceiling.js:73-96`) is genuinely pure: builds a
   Set, parses URLs, returns a verdict object — no side effects, no arg mutation, no I/O. Signature `(url,
   declaredEndpoints)`; `endpoints` is already in scope at the dispatch point (`airlock.js:294`). So "re-run the pure
   `checkEndpointCeiling` on each output request before fetch" is a real, available operation. The merged body needs no
   separate re-check because consent is purpose-based and cycle-uniform (not content-based), and the inbound
   ADR-0012 denylist already ran pre-mapping.
2. **Group key (AC2).** `EgressRequest` (`contracts/connector.d.ts:73-87`) carries only
   `url/method?/headers?/body?/unloadCritical?` — no credential/mode field, so that dimension is vacuous today.
   `fetchInit` (`airlock.js:48-49`) consumes only method+body and **drops headers entirely**, reinforcing that
   credential/mode isn't on the wire. Verdict cycle-uniformity is grounded: `egressVerdict(consentVector,
   egressPurposes, {strict})` (`airlock.js:255`) reads only closure-level constants in a synchronous for-loop, so every
   request in one cycle gets the same verdict.
3. **Restructure (AC3).** `airlock.js:248-302` confirms one inline `for` fusing verdict→ceiling→fetch, with
   `beaconSeq += 1` / `heldBeacons.push` / `diagnose` interleaved. Splitting into collect-survivors→group+dispatch
   preserves observable order: all `diagnose` emissions come from drop/hold/ceiling branches processed in ready-order
   (fetches emit no synchronous diagnose, only an async `dispatched++`), so the diagnose stream and `beaconSeq` order
   are byte-identical.

## Residuals (notes, non-blocking)

- **AC1 wording (RESOLVED at authoring).** Round 2 noted AC1 described the hook output as a singular "merged
  `EgressRequest`" while the declared signature is `coalesce(requests) -> EgressRequest[]`. Tightened before dispatch:
  AC1 now says every returned request is re-checked; the payload-ceiling split case is explicitly deferred (ADR-0021
  open question).
- **Coarse origin+path key correctly delegated.** The core key relies on the connector `coalesce` hook to perform any
  query-identity split (GA4 `tid`). AC2 states this honestly and routes it to 040-03; the default no-coalesce path
  cannot mis-merge, so 040-02's frame is sound and tid-splitting correctness is 040-03's owned risk.

No reconciliation notes — pre-implementation frame-critique; nothing to reconcile.

---

## Orchestrator addendum — 2026-09-09 (post-pass prior-art reconciliation)

Recorded by the orchestrator after the pass, at authoring time. The frame-critique above did not examine an adjacent
existing module that a pre-dispatch sweep surfaced: **`core/coalescing-broker.js`** (spec 014-02 / ADR-0008). Assessed
and dispositioned as a **note, not a re-block** — the frame survives:

- It is a **different mechanism on a different path**: Alloy's identity-mint deduper on `core/wrapped-sdk-host.js`'s
  round-trip dispatch (suppress duplicate ECID first-mints per *identity*; correctness), whereas 040-02 is
  request-count batching on the connector-host `{ready}`→`core/airlock.js` keepalive-`fetch` dispatch (perf, keyed by
  endpoint). Its docstring states `core/airlock.js` is "UNTOUCHED — a new, parallel module" (`:5-7`), and it has **no
  production wiring** today (`createCoalescingBroker`/`handleInterceptedFetch` in no production module — nothing under
  core/connectors/eds/src outside the module's own file — only in its tests + rig harnesses:
  `test/coalescing-broker-core.test.js`, `test/alloy-coalescing-broker.test.js`, `rig/alloy-coalescing-*`; grepped
  2026-09-09). None of 040-02's load-bearing assumptions are falsified by it.
- **Dispositioned durably** so the implementer cannot trip on it: slice-02 Assumptions now carries an explicit
  "do NOT extend or wire into `createCoalescingBroker`; name to disambiguate; build inline in `core/airlock.js`
  dispatch" constraint, and ADR-0021 gained a dated Amendment citing the broker as prior-art precedent for the
  injected-per-connector-strategy shape (decision unchanged).
