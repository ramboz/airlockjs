---
status: DONE
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 040: Core-egress batching (cross-connector)

> **DONE (2026-09-09) — all five slices complete + landed; [ADR-0021](../../decisions/adr-0021-core-egress-batching.md)
> fully discharged (no open questions left).** Opened from spec 039's deferred 039-04. Batch/coalesced egress is a
> first-class, cross-cutting **performance** capability the runtime now offers out-of-the-box across all connectors —
> not a gtag-specific parity detail. The gating decision was settled by ADR-0021 (Accepted 2026-09-09, Option C —
> core-egress coalescing at the shared dispatch, after the per-request egress seal + endpoint ceiling and before the
> `fetch`, protocol-pluggable per connector, per lock-through cycle, justified on request-count efficiency **not**
> parity). Slices:
> - **040-01** (spike — measurement gate): **GO** — a material request-count benefit on realistic bursts cleared
>   ADR-0021 kill-criterion #1, so the core seam was built (no dead surface).
> - **040-02** (core coalescing seam): the two-phase dispatch restructure in `core/airlock.js` + the optional
>   per-connector `coalesce(requests) -> EgressRequest[]` hook, governance-safe on inputs AND outputs, default
>   no-coalesce (every existing connector byte-identical until it opts in).
> - **040-03** (GA4 adapter): `connectors/ga4/coalesce.js` — the first real strategy, synthesizing gtag's observed
>   multi-`en` batched POST (revives 039-04 on the shared seam).
> - **040-04** (failure semantics + observability, ADR-0021 OQ#1): the shared `dispatch` closure surfaces an
>   `egress-failure` diagnostic (previously swallowed) at both dispatch sites; NO retry (best-effort keepalive stays
>   uniform; retry risks duplicate ingestion).
> - **040-05** (payload-ceiling split, ADR-0021 OQ#2): a conservative self-imposed byte-OR-count ceiling with a
>   lossless, order-preserving, adapter-side split into multiple bounded POSTs.
>
> Tracked fidelity residuals (all on the rare backstop path, same class, closed together by ONE deferred live-accept GA4
> DebugView re-check needing a GA4 test property we control): the n=1 batch-marker grounding (040-03), `_ss`/`_fv`
> repeated per split POST, and a post-split singleton emitted as a single-line POST (both 040-05). See
> `docs/refinement-todo.md`.

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
- **040-04 (Rules — failure semantics + observability):** define what happens when a coalesced dispatch FAILS. Today's
  egress is best-effort keepalive with NO retry and NO failure diagnostic for ANY beacon (`core/airlock.js` dispatch
  `.then(ok, err)` both `dispatched++`); coalescing does not change that contract but CONCENTRATES the loss (one failed
  POST = N events, not 1). The hardening (ADR-0021 open question #1): surface batch failures + bound the blast radius,
  without inventing per-request retry the rest of the runtime doesn't have.
- **040-05 (Data — payload-ceiling split):** when a coalesced body would exceed a conservative size ceiling, the adapter
  splits the same-context group into multiple POSTs each under the ceiling (ADR-0021 open question #2). Per-adapter (the
  GA4 `coalesce` hook already returns `EgressRequest[]`, so a split is natural); the exact gtag `/g/collect` internal
  ceiling is unobserved, so airlock picks a documented conservative bound.

## Slices

- [040-01 — request-count measurement gate (spike)](slice-01-measurement-gate.md)
- [040-02 — core coalescing seam (post-verdict, per-cycle, protocol-pluggable)](slice-02-core-coalescing-seam.md)
- [040-03 — GA4 multi-`en` POST coalesce adapter (revives 039-04)](slice-03-ga4-batch-adapter.md)
- [040-04 — coalesced-dispatch failure semantics + observability](slice-04-failure-semantics.md)
- [040-05 — payload-ceiling split (per-adapter)](slice-05-payload-ceiling-split.md)
