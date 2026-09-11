---
status: Accepted
dependencies: []
last_verified: 2026-09-11
frame_review: true
---

# ADR-0022: Pixel advanced-matching hashing: worker-side, main-cached for the unload path

## Status

Accepted (2026-09-11)

## Context

Spec 026-04 adds Meta Pixel **advanced matching** — the hashed user-data fields
(`ud[em]`/`ud[ph]`/`ud[external_id]`/…) a `/tr` beacon carries for match quality.
Because airlock reproduces the `/tr` wire directly (it does not load
`fbevents.js`), it is in the Conversions-API position: it must **normalize +
SHA-256-hash** these fields itself, then emit `ud[<field>]=<hex-hash>`. The
per-field normalization + hashing is a documented, closed spec (Meta's published
Customer Information Parameters — links in `## Assumptions` A4), grounded here in
`test/fixtures/meta-tr-pageview.redacted.json`, a real (redacted) erp.intuit.com
capture.

Three forces collide on **where** the hashing happens:

1. **The airlock thesis** (product-vision): the main thread only captures +
   enqueues; *all* interpretation, mapping, and egress happen behind the airlock.
   Hashing is interpretation → it belongs in the worker.
2. **Native SHA-256 is async.** `crypto.subtle.digest("SHA-256", …)` returns a
   Promise; there is no sync native digest.
3. **The spec-042 unload/critical path is synchronous and main-thread.** 042
   reconstructs the connector's `handle` on the **main thread** and dispatches
   the closing beacon **synchronously** (it cannot `await` at teardown). The
   owner's requirement is that advanced matching **must** ride the unload beacon
   (a closing PageView carries `ud[…]` too, for match quality).

An async, hashing `handle` satisfies (1)+(2) for the steady-state worker path but
**cannot** serve (3). The saving grace: advanced-matching identity is
**session-stable** — `external_id` is set at boot (a first-party cookie/GUID),
`em`/`ph` are set once when the visitor is identified; none are recomputed
per-event. So the hash need only be computed **once per identity**, not per beacon.

`cd[…]` custom data (`cd[value]`/`cd[currency]`/…) is a **separate** concern: it is
per-event and **plaintext** (not hashed), mapped synchronously on both paths as
today. This ADR governs only the hashed `ud[…]` identity.

## Decision Options Considered

### Option A: Host-side (main-thread) hashing
The adapter sources the raw identity (like GA4 sources `client_id`) and SHA-256-
hashes it on the main thread, passing only `ud[…]=<hash>` into the connector.
- **Pros:** trivially sync-available for the 042 unload path (hash sits in the
  main-thread config); no new worker→main channel.
- **Cons:** the **Meta-specific normalization spec leaks into the host adapter**
  (breaks the pixel connector's "no vendor specifics outside the config" design,
  026-01 AC1); cuts against the thesis (hashing on the main thread). Rejected on
  layering.

### Option B: Worker-only hashing; unload omits advanced matching
`handle` is async, hashes in the worker for the steady-state path; the sync
unload path omits `ud[…]`.
- **Pros:** thesis-clean; layering-clean; zero new machinery.
- **Cons:** the **closing/unload beacon carries no advanced matching** — a parity
  gap the owner explicitly ruled out. Rejected on the requirement.

### Option C (chosen): Worker hashes → posts back → main-thread cache → sync unload read
The connector normalizes + SHA-256-hashes identity **in the worker chamber** (its
real job, behind the airlock). It **posts the hashes back** to the main thread on
a new `{ type: "identity", ud: { … } }` message. The orchestrator **caches** them
on the airlock instance. The 042 unload `requestMapper` reads the cache
**synchronously** and merges `ud[…]` into the closing beacon.
- **Pros:** hashing stays behind the airlock (thesis); Meta normalization stays in
  the connector/config (layering); raw identity is confined to the egress-confined
  worker and only the **hash** ever crosses back; advanced matching rides **both**
  the steady-state and the unload beacon.
- **Cons:** a new worker→main protocol message; a **cold-cache teardown race**
  (below); cache invalidation on a mid-session identity change.

## Recommended Decision

**Option C, hashed EAGERLY (owner decision 2026-09-11).** Hash `ud[…]` identity in
the worker chamber; the worker posts the computed hashes back on a dedicated
`identity` channel; the orchestrator caches them; the spec-042 synchronous unload
path reads the cache and merges `ud[…]` into the closing beacon. Each field is
hashed **as early as its raw value exists** — `external_id` on the `init` message
(boot), the PII fields (`em`/`ph`/…) the moment the host sets them — **not** lazily
on first `handle`. Eager hashing warms the cache as close to boot / identification
as possible, minimising the race window with teardown.

**Identity feed channel (frame-critique).** Raw identity reaches the worker on a
**dedicated** channel — the `init` message for `external_id`, a `setIdentity`-style
message for PII fields set later — **not** via `push()`/events. This deliberately
bypasses the host `payloadDenylist` (ADR-0012), which would otherwise strip
`email`/`phone` before the worker could hash them; the ungoverned raw feed is safe
because the worker is egress-confined (A5) — a raw value can only ever leave as the
hash, never on the wire.

`cd[…]` custom data stays per-event, plaintext, mapped synchronously as today.

**Degradation guarantee (load-bearing) — eager first, omit only if still missing.**
Eager hashing is the primary path; the cache is warm well before a normal
teardown. **If a teardown still races an incomplete hash** (the eager digest has
not resolved yet — the narrow residual window), the unload beacon **omits that
`ud[…]` field** and no other. It **never** emits a raw identity value — enforced by
a test, not merely documented: the cache holds only hashes, and the raw identity
never leaves the worker, so "omit" is the only reachable miss behaviour. The merge
is per-field: a field whose eager hash is ready ships; one still in flight is
omitted; no field ships raw.

## Consequences

**Becomes easier:**
- Advanced matching on the unload/closing beacon (the owner requirement) without
  moving hashing to the main thread.
- Keeping the pixel connector vendor-clean — Meta's normalization + hashing live
  in the connector/config, not the host adapter.
- The full documented `ud[…]` field set (`em`/`ph`/`fn`/`ln`/`db`/`ge`/`ct`/`st`/
  `zp`/`country` + `external_id`) rides one mechanism: the connector normalizes
  each per Meta's spec (A4) then hashes; the host sources whichever raw values it
  has (`external_id` always; the PII fields when the visitor is identified).

**Becomes harder:**
- The worker→main protocol grows a second message type (`identity`) alongside
  `{ ready, dropped }`; both the pixel chamber and `core/airlock.js` must learn it.
- Eager per-field hashing fills the identity cache incrementally (each field when
  its raw value arrives); the unload merge is per-field (ship the ready ones, omit
  any still in flight), and the residual race window — narrowed by eager hashing —
  must still be tested, not just asserted.
- A mid-session identity change must invalidate/refresh the cache (re-hash +
  re-post); the common session-stable case is a no-op.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **A1 — native SHA-256 is async; there is no sync native digest.** `crypto.subtle.digest` returns a Promise in both window and worker realms (WebCrypto). A synchronous JS SHA-256 (a bundled impl) was considered and rejected: it adds unaudited crypto + bundle weight to avoid a cache that session-stability makes cheap anyway.
- **A2 — the spec-042 unload path is synchronous + main-thread.** Grounded: `core/airlock.js`'s `createCriticalDispatcher` dispatches synchronously and 042 wires the pixel `requestMapper` as `createPixelConnector(connectorConfig).handle` reconstructed on the main thread; it cannot `await` (spec 042, committed `be2f4f5`).
- **A3 — advanced-matching identity is session-stable.** `external_id` (a first-party GUID) is readable at boot; `em`/`ph` are set once at identification. Grounded against the real capture (`test/fixtures/meta-tr-pageview.redacted.json`: the same `ud[external_id]` hash across three beacons incl. a SPA route change) and Meta's advanced-matching model (fbevents attaches identity to every subsequent event). If this is false — identity varies per event — the caching premise breaks (see kill criteria).
- **A4 — Meta normalization/hashing spec (docs).** Per-field normalization (email trim+lowercase; phone digits+country-code; SHA-256 → hex; `external_id` hashing optional-but-recommended; `fbp`/`fbc` do-not-hash) is Meta's published [Customer Information Parameters](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters) + [Meta Pixel advanced matching](https://developers.facebook.com/docs/meta-pixel/advanced/advanced-matching/), the source of truth a one-way hash in a capture cannot provide.
- **A5 — the pixel worker is egress-confined.** `withholdFetch` (spec 026-01, `core/confine-pixel-chamber.js`) means raw identity in the chamber cannot reach the network directly; its only output is the mediated `ready` postMessage (which carries the hash) + the new `identity` postMessage (also the hash). Residual: a connector *bug* could place a raw value in a `ud[…]` param the endpoint ceiling would pass (it checks destination, not param values) — mitigated by a test asserting emitted `ud[…]` is a 64-hex hash. First-party code, so test-coverage is the proportionate defense (contrast untrusted alloy).

## Kill criteria

- **Identity is not session-stable** (a `ud[…]` value legitimately varies per
  event) — then a single cached hash is wrong for later beacons, and this design
  must move to per-event worker hashing with the unload beacon omitting the
  varying field. (Watched via A3.)
- **Even eager hashing leaves the race window too wide — especially for
  identification-time PII (frame-critique).** Boot-time `external_id` (hashed on
  `init`) is reliably far from teardown; but **identification-time `em`/`ph`** in a
  submit-then-navigate conversion flow can be **teardown-adjacent** — the exact
  high-value closing PageView. If that window is wide, the omit fallback fires
  routinely on the beacons that matter most, and the hash would have to be computed
  synchronously (a bundled sync SHA-256 — A1's rejected option) or main-thread,
  trading layering/bundle purity for coverage. **The 026-04 teardown-race test MUST
  specifically exercise the identification-then-immediate-navigate PII profile**
  (not just boot-time `external_id`), or it validates the easy profile and misses
  the exposed one.

## Open questions

- **Cache-warm timing / observability.** `external_id` is hashed on `init` (warm
  almost immediately); should the orchestrator also expose the cache/miss state to
  the inspector (028) so a cold-miss omission is diagnosable rather than silent?
  Deferred to 026-04.
- **Grounding split for the in-scope fields (owner decision — ALL fields, 2026-09-11).**
  `external_id` is **capture-grounded** (`ud[external_id]` present, GET, the
  `ud[<key>]` form). The PII fields (`em`/`ph`/`fn`/…) are **doc-grounded**: their
  normalization + SHA-256 comes from Meta's published spec (A4 — the authoritative
  source a one-way hash in a capture cannot provide), and their wire form is the
  same `ud[<key>]` the capture confirms for `external_id`. The one residual: no
  *real* `ud[em]`/`ud[ph]` beacon was captured (the anonymous visit carried no
  PII), so the PII fields' end-to-end wire presence is doc-grounded-by-analogy, not
  capture-witnessed — recorded honestly (a live PII capture would only confirm what
  docs + `external_id` already establish; not a blocker).
