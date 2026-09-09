---
status: Accepted
dependencies: [ADR-0001, ADR-0002, ADR-0012, ADR-0019]
last_verified: 2026-09-09
frame_review: true
---

# ADR-0021: Core-egress batching — cross-connector coalescing

## Status

Accepted (2026-09-09)

## Context

Airlock's value proposition is a **performance best-practice** martech runtime: the main thread only captures +
enqueues; mapping runs off-thread in the worker; egress is a prebuilt keepalive `fetch` dispatched on the main thread
(cheap, INP-safe — grounded: `core/airlock.js:11-13`). Today each governed `EgressRequest` is dispatched as **its own**
`fetch`: the drain loop is `for (const r of ready) … fetch(r.url, fetchInit(r.method, r.body))`
(`core/airlock.js:248,300`), where `ready` accumulates one-or-more requests per event across all connectors
(`core/connector-host.js:75-76`). So a lock-through cycle (one ring-buffer drain — `core/airlock.js:6-7,337,346`) that
produces N beacons issues **N separate requests**.

Real vendors coalesce. Spec 039's live capture (2026-09-08) confirmed GA4's own `gtag.js` sends a **single** `/g/collect`
POST for ≥2 events in one dispatch (multi-line `en=` body), and a GET for a single event. Spec 039 deferred a
gtag-specific "batched POST" slice (039-04) here on the finding that **batching is not a parity concern** — under the 038
same-protocol oracle (a field-level semantic diff, "never raw URL equality"), N GETs and one batched POST classify
identically — but it **is** a first-class efficiency capability the runtime should own at the core, for **every**
connector (Meta, LinkedIn, generic pixels, Alloy), not just GA4.

The egress path already supports both wire forms: `fetchInit` (`core/airlock.js:48-49`) emits `{method:"GET",
keepalive:true}` (no body) or `{method:"POST", body, keepalive:true}`. Two distinct governance seams sit on the path and
must not be conflated: **(a)** the ADR-0012 **inbound payload denylist** at `sendBatch` (`core/airlock.js:330-344`,
`worker.postMessage({type:"events", batch})`) governs descriptor params main-thread→worker *before* mapping; **(b)** the
per-request **egress consent seal** `egressVerdict` (`core/airlock.js:254-286`, ADR-0007 point ③ — the literal "held at
the seal"), immediately followed by the **endpoint-ceiling check** (`:287-299`, ADR-0006 / 016-01), which together
govern each already-mapped `EgressRequest` just before the `fetch` at `:300`. Coalescing is an **egress** concern, so it
belongs after seam (b): any batching must run **after** the per-request egress verdict *and* the endpoint-ceiling check,
and **before** the `fetch`, so neither a denied event nor a ceiling-blocked one can be smuggled into a coalesced request.
(Coalescing at `sendBatch` — seam (a), inbound, pre-verdict — would be exactly that smuggling path, and is wrong.)

The question this ADR settles: **where does batch/coalesced egress live, and what is the coalescing policy?**

## Decision Options Considered

### Option A: No batching (status quo — one `fetch` per `EgressRequest`)
- **Pros:** simplest; already shipped; each beacon independently governed and retried.
- **Cons:** leaves the library's performance promise partly unmet under event bursts — redundant requests, headers, and
  downstream ingest units (not connections — HTTP/2 already multiplexes those); diverges from the request cadence the
  container's own tags emit (a request-count difference, not a parity one). Weight is contingent on the 040 measurement.

### Option B: Per-connector batching (each connector coalesces its own beacons)
- **Pros:** the connector knows its vendor's batch protocol (e.g. GA4's multi-`en` POST) precisely.
- **Cons:** **misplaced** — this is exactly what spec 039-04's frame-critique rejected: it duplicates the coalescing
  machinery per connector, can't serve connectors that don't reimplement it, and shapes requests **inside the connector
  (a pure mapper), upstream of the per-request egress seal** (`egressVerdict`, `:254-286`) — so each connector would have
  to re-derive the egress consent verdict to coalesce safely. Connectors are pure mappers
  (`handle(evt) -> EgressRequest[]`); making each also a transport-batcher breaks that boundary.

### Option C: Core-egress coalescing at the shared dispatch, protocol-pluggable (RECOMMENDED)
- The **core** egress path coalesces the `ready` requests of one lock-through cycle before dispatch, keyed by a
  **coalescing group** (endpoint + governing verdict + credential/mode context). A connector optionally declares **how**
  its same-group requests merge (a small `coalesce(requests) -> EgressRequest[]` hook, e.g. GA4's "shared params on the
  query string, one `en=` line per event in the body"); connectors that declare nothing keep today's one-request-each
  behavior (no regression).
- **Pros:** one implementation serves every connector; runs **after the per-request egress seal** (`egressVerdict`,
  `:254-286`) and the endpoint-ceiling check (`:287-299`), before the `fetch` (`:300`), so per-event governance is
  preserved by construction (a denied or ceiling-blocked event never reaches the coalescer); protocol-pluggable so GA4's
  multi-`en` POST is just the first adapter and a generic "same-URL params-merge" (or "no-coalesce") is the baseline;
  keeps connectors pure mappers.
- **Cons:** a new core seam + a connector-declared merge contract to design and test; the coalescing key must be chosen
  carefully (a wrong key merges events that must stay separate).

### Option D: Defer indefinitely (leave 039-04 parked, revisit only on a demonstrated need)
- **Pros:** zero cost now.
- **Cons:** the owner has stated the need is present (batching is core to the perf pitch); deferring the *decision*
  (not just the build) leaves 039-04 and any future connector's batching homeless.

## Recommended Decision

**Option C — core-egress coalescing at the shared dispatch, protocol-pluggable, per lock-through cycle.**

- Coalescing is **new logic inserted after the full per-request egress governance — the consent seal (`egressVerdict`,
  `core/airlock.js:254-286`) AND the endpoint-ceiling check (`:287-299`) — and before the `fetch` (`:300`)** — over the
  `ready` requests of **one** drain cycle only (never across cycles). It is NOT a reuse of `sendBatch` (the inbound
  ADR-0012 denylist seam, which runs pre-verdict); inserting it after the verdict + ceiling is what makes
  governance-preservation structural. (040 must insert at `:300`, not `:287` — a merged request that skipped the ceiling
  check could bypass the declared-endpoint ceiling; the coalescer sees only already-governed requests.)
- Requests coalesce **only** within one **coalescing group**: same endpoint URL (origin+path, ignoring per-event query),
  same governing consent verdict, same credential/mode context. Cross-group requests are never merged.
- A connector may declare a `coalesce` strategy for its group (GA4: multi-`en` POST body; generic: same-URL merge or
  none). Absent a declaration, requests dispatch one-per-`fetch` exactly as today (strictly additive — no behavior
  change for Meta/LinkedIn/pixel/Alloy until each opts in).
- Justified on **performance/efficiency** (request-count, downstream ingest, matching vendor cadence — *not* connections;
  HTTP/2 multiplexes those, per Assumption 2), **explicitly not parity** — acceptance criteria are perf/behavior (fewer
  requests, no event loss, no cross-group merge), never a beacon-diff (the 038 oracle can't score it).
- **This ADR is the gate; the implementation is spec 040** (SPIDR-sliced after this ADR is Accepted). GA4's deferred
  039-04 becomes 040's first `coalesce` adapter.

## Consequences

**Becomes easier:**
- Every connector gets request-count reduction under bursts for free (declare a strategy, or take the safe default).
- GA4 gains the byte-shaped batched POST the container emits, as a core adapter rather than a gtag-specific fork.
- One place to reason about egress efficiency, retries, and payload ceilings.

**Becomes harder:**
- The core egress seam grows a coalescing step + a connector-declared merge contract — more core surface to test and
  keep INP-safe.
- Retry/failure semantics must be defined for a coalesced request (a merged POST that fails drops N events, not one) —
  a 040 slice concern.

## Assumptions

- **Egress already supports both wire forms (grounded); no new transport is needed.** `core/airlock.js:48-49`
  `fetchInit` emits GET (no body) or POST (body). Coalescing is **new logic** placed after the per-request egress
  verdict (`egressVerdict`, `:254-286`, ADR-0007) and before the `fetch` (`:300`) — NOT at `sendBatch` (`:330-344`),
  which is the *inbound* ADR-0012 payload-denylist seam (main→worker, pre-mapping, pre-verdict). Inserting the buffer
  after the verdict is what preserves governance by construction; it is genuinely new core surface, not a free reuse of
  an existing exit.
- **The efficiency win is off-interaction-path (grounded) — so it is request-count, not INP, and NOT obviously
  connections.** Mapping is already off-thread and egress is keepalive `fetch` (`core/airlock.js:11-13`); batching does
  **not** improve main-thread CWV/INP. Nor does it clearly cut *connections*: N requests to one vendor origin already
  share a single HTTP/2 connection (multiplexed), so the "fewer connections" benefit is weak on modern transports. The
  defensible benefit is **request-count** (fewer round-trips / headers / server-side ingest units) and **matching the
  container's request cadence**. **This ADR does not claim a CWV or connection win**; spec 040's **first** slice must
  ground the actual request-count benefit on a realistic event burst — see kill-criterion #1 — before the core seam is
  built. A batching feature with no demonstrated benefit is over-engineering (the frame-critique risk this ADR takes
  seriously).
- **Per-event governance must survive coalescing.** The seal decides per event (ADR-0012); a coalesced request may
  carry only events sharing a governing verdict, endpoint, and credential context. The coalescing key enforces this.
- **Vendor batch protocols vary and are connector-declared.** GA4's multi-`en` POST is live-observed (spec 039); other
  vendors differ or don't batch. The core provides the seam; the connector provides the (probe-grounded) merge strategy.

## Kill criteria

- **No demonstrated efficiency benefit → the core seam is never built.** Spec 040's **first** slice is a
  measurement/grounding step (request-count under a realistic event burst), and it **gates the core-seam build itself**,
  not merely "broad scope": if batching yields no material request-count / downstream-ingest reduction (because bursts
  are rare, or HTTP/2 multiplexing already makes N requests cheap), the feature is shelved with **no dead core surface**
  left behind — the perf pitch does not survive contact with measurement.
- **Governance cannot be preserved cleanly.** If a correct coalescing key (same verdict+endpoint+credential) proves to
  merge events that must stay separate, or forces the egress-seal logic (`egressVerdict`, `:254-286`) to be re-derived
  inside the coalescer, Option C is void → fall back to A (status quo) or a narrower per-vendor exception.

## Open questions

- **Retry/failure semantics for a coalesced request** — a failed merged POST drops N events; does the runtime retry the
  batch, split-and-retry, or accept the loss (keepalive is already best-effort)? → a 040 slice.
- **Payload ceiling** — when a coalesced body would exceed a vendor's size limit, split into multiple requests; the
  threshold and split policy are per-adapter. → a 040 slice.
- **Coalescing key precision** — is endpoint+verdict+credential sufficient, or do some vendors need finer keys (e.g.
  per-`tid`)? GA4 needs same-`tid`; confirm per adapter. → 040.
