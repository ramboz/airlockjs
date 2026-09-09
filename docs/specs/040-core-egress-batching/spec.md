---
status: IN_PROGRESS
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 040: Core-egress batching (cross-connector)

> **FRAMED (2026-09-09).** Opened from spec 039's deferred 039-04. Batch/coalesced egress is a first-class,
> cross-cutting **performance** capability the runtime should offer out-of-the-box across all connectors — not a
> gtag-specific parity detail. **The gating decision is settled: [ADR-0021](../../decisions/adr-0021-core-egress-batching.md)
> (Accepted 2026-09-09)** chose Option C — core-egress coalescing at the shared dispatch, inserted after the per-request
> egress seal (`egressVerdict`, `core/airlock.js:254-286`) + endpoint-ceiling (`:287-299`) and before the `fetch`
> (`:300`), protocol-pluggable per connector, per lock-through cycle, justified on request-count efficiency **not**
> parity. Slices are framed below; **the build is gated on 040-01's measurement** (ADR-0021 kill-criterion #1 — no
> demonstrated benefit → shelve, no dead core surface).

## Overview

Airlock's value proposition is a performance best-practice martech runtime: the main thread only captures + enqueues,
and egress happens off-thread behind the airlock. A natural extension of that promise is **batching egress**: when a
lock-through cycle (one ring-buffer drain) produces multiple beacons — to the same endpoint, or coalescible under a
vendor's own batch protocol — the runtime should be able to send **one** batched request instead of N, reducing request
count, connection overhead, and downstream load, **without changing what the field-level parity oracle sees**.

This is deliberately a **core / cross-connector** concern, not a per-connector one:
- The **coalescing point** is the shared egress path (`core/airlock.js`), where all connectors' beacons already funnel
  through the seal + governed dispatch. Putting batching in one connector (as the deferred 039-04 tried) both misplaces
  it and can't serve the other vendors (Meta, LinkedIn, generic pixels, Alloy) that would benefit equally.
- The **governance interaction** is core: a batched request must still pass the seal per-event (consent/allowlist), must
  not merge events whose governing verdict differs, and must not merge across different endpoints/credentials.

**Not a parity mechanism.** Under the 038 same-protocol oracle (a field-level semantic diff, "never raw URL equality"),
a batched request and N single requests carrying the same attribution fields classify identically — so batching is
justified on **performance/efficiency**, never on parity. Its acceptance criteria must be perf/behavior criteria
(request-count reduction, no event loss, no cross-verdict/endpoint merge), not beacon-diff parity.

## Assumptions

<!-- Frame-stub — assumptions to be probe-grounded when this spec's ceremony runs. -->

- **The efficiency win is off-thread — so it is request-count, not INP, and NOT connections.** Egress is already off the
  main thread (keepalive `fetch`), so batching does **not** improve main-thread CWV/INP, and HTTP/2 multiplexing means it
  does not obviously cut connections either (per ADR-0021 Assumption 2). The defensible win is request-count / downstream
  ingest / matching a vendor's request cadence, and it must be **grounded (measured) in 040-01 before the core seam
  (040-02) is built** — ADR-0021 kill-criterion #1: no demonstrated benefit → shelve. A batching feature with no measured
  benefit is over-engineering.
- **Vendor batch protocols vary.** GA4 `/g/collect` accepts a multi-`en`-line POST body (observed 2026-09-08); other
  vendors batch differently or not at all. A core batching seam must be **protocol-pluggable** (a connector declares how
  its beacons coalesce), not assume one wire shape.
- **Per-event governance must survive coalescing** — the seal decides per event; a batch may only carry events that
  share a governing verdict, endpoint, and credential context.

## Decomposition

**SPIDR — Spike first here (deliberately), because ADR-0021's kill-criterion #1 gates the build on a measured benefit.**
Once 040-01 clears the gate, Interface then Data.

- **040-01 (Spike — measurement gate):** ground the request-count benefit. On a realistic event burst (multiple
  same-stream events in one lock-through cycle), how many requests does the status-quo one-`fetch`-per-`EgressRequest`
  path issue vs. a coalesced path, and how often do such bursts actually occur? Outcome: GO (material reduction → build
  040-02) or SHELVE (ADR-0021 kill-criterion #1 — no dead core surface). This is the honest first step the ADR mandates.
- **040-02 (Interface — the core coalescing seam):** add the coalescing step in `core/airlock.js` **after** the
  per-request egress verdict (`:254-286`) + endpoint-ceiling (`:287-299`) and **before** the `fetch` (`:300`), keyed by
  the coalescing group (endpoint + governing verdict + credential/mode), over one cycle's `ready` set. A per-connector
  `coalesce(requests) -> EgressRequest[]` hook; **default = no-coalesce** (strictly additive — Meta/LinkedIn/pixel/Alloy
  unchanged until they opt in). ACs are perf/behavior: fewer requests on a same-group burst, **no event loss**, **no
  cross-group merge** (a denied/ceiling-blocked/other-endpoint event never enters a merged request).
- **040-03 (Interface — GA4 adapter):** the GA4 `coalesce` strategy (shared context params on the query string, one
  `en=…` line per event in the POST body) — reviving spec 039's deferred 039-04 as the first real adapter, grounded on
  the 2026-09-08 batched-POST capture. Same-`tid` keying (Open Question #3).
- **Later (Data / Rules — deferred to their own slices):** retry/failure semantics for a merged request (a failed batch
  drops N events); payload-ceiling split (ADR-0021 open questions).

## Slices

- [040-01 — request-count measurement gate (spike)](slice-01-measurement-gate.md)
- [040-02 — core coalescing seam (post-verdict, per-cycle, protocol-pluggable)](slice-02-core-coalescing-seam.md)
- [040-03 — GA4 multi-`en` POST coalesce adapter (revives 039-04)](slice-03-ga4-batch-adapter.md)
