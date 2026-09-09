---
status: DRAFT
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 040: Core-egress batching (cross-connector)

> **FRAME-STUB (2026-09-08).** Opened from spec 039's deferred 039-04. Batch/coalesced egress is a first-class,
> cross-cutting **performance** capability the runtime should offer out-of-the-box across all connectors — not a
> gtag-specific parity detail. This spec is reserved and framed at a high level; **it needs its own ADR before slicing**
> (the batching *policy* and its *home* are a load-bearing architectural decision with real alternatives — see
> Decomposition). Its full ceremony has not yet run.

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

- **The efficiency win is real off-thread.** Egress is already off the main thread (keepalive `fetch`), so batching does
  **not** obviously improve main-thread CWV/INP; the win is request-count / connection / battery / downstream-load, and
  possibly matching a vendor's own request cadence. This rationale must be **grounded (measured)** before the spec is
  accepted — a batching feature with no demonstrated benefit is over-engineering. (This is the ADR's central question.)
- **Vendor batch protocols vary.** GA4 `/g/collect` accepts a multi-`en`-line POST body (observed 2026-09-08); other
  vendors batch differently or not at all. A core batching seam must be **protocol-pluggable** (a connector declares how
  its beacons coalesce), not assume one wire shape.
- **Per-event governance must survive coalescing** — the seal decides per event; a batch may only carry events that
  share a governing verdict, endpoint, and credential context.

## Decomposition

_TBD — needs an ADR first (see below), then SPIDR slicing._ Likely axes once the ADR settles the policy:
- **Rules** — the coalescing policy: what may merge (same endpoint + same governing verdict + same cycle) and what may
  never (cross-endpoint, cross-verdict, cross-credential).
- **Interface** — a core egress-batching seam + a per-connector "how do my beacons coalesce" declaration (protocol-
  pluggable), with GA4's multi-`en` POST as the first adapter and a generic same-URL-batch as the baseline.
- **Data** — batch-size / payload-ceiling handling (split when a vendor's limit is hit).

**ADR needed (before slicing):** *Where does batching live, and what is the coalescing policy?* Alternatives include
core-egress coalescing (proposed) vs. per-connector batching vs. no batching (status quo); the decision is load-bearing
(it touches the shared egress path + the seal) and has rejected alternatives → an ADR, per the spec-workflow ADR
trigger. Route via `/jig:adr-workflow` when this spec's ceremony begins.

## Slices

- [040-01 — tbd](slice-01-tbd.md) _(placeholder — real slices follow the ADR)_
