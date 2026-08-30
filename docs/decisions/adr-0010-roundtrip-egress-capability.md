---
status: Accepted
dependencies: []
last_verified: 2026-08-30
frame_review: true
---

# ADR-0010: Wrapped-SDK round-trip egress as a declared-and-gated capability

## Status

Accepted (2026-08-30)

## Context

MVP1's egress is **fire-and-forget**: a connector's `handle(event)` returns
`EgressRequest[]`, and the orchestrator `fetch`-dispatches each on the main thread
(ADR-0004) without reading the response. That surface is modelled in
[`contracts/`](../../contracts/connector.d.ts) (`handle → EgressRequest[]`).

MVP2 generalized the runtime to a **wrapped-SDK** archetype (alloy). Its egress is
**not** fire-and-forget: alloy issues its own worker-side `fetch`; the chamber
**intercepts** it, hands it to the orchestrator's main-thread dispatch, and the
orchestrator must post the **response back** into the chamber — the server-assigned
ECID must round-trip so alloy can persist it (specs 012-01, 013-01). This
request/**response** round-trip has **no home in `contracts/`**: it lives only as an
undocumented `intercepted-fetch` ↔ `intercepted-fetch-response` protocol inside the
rig harnesses, parallel to `core/`.

Spec 014 (wrapped-SDK core integration) must give this surface a home in `core/`.
The 014-01 frame-critique found the initial framing — "model it in `contracts/`
**xor** keep it chamber-internal and seal-gate it" — to be a **false binary**: it
conflates two orthogonal axes, *declaration home* (is the surface documented?) and
*enforcement point* (where does the seal gate?). Both MVP3 enforcement specs
(endpoint-ceiling, config-integrity, purpose-vector consent) **bind to this surface**,
so it must be settled before they are drafted, and it must be both documented **and**
gate-able — not one at the expense of the other.

## Decision Options Considered

### Option A: A first-class `caps.egress.dispatch` capability — declared AND gated (chosen)
The round-trip egress is a **capability the chamber requests and the orchestrator
provides**: `caps.egress.dispatch(req) → Promise<{ status, statusText?, headers?, body }>`
— a **serialized** response shape, **not** a full WHATWG `Response` (the chamber's
fetch-shim already reconstructs a `Response` from exactly those fields). It has a
**documented contract home** in [`contracts/capability.d.ts`](../../contracts/capability.d.ts)
(additive, alongside `cookies.sync` / `decisions.deliver`), **and** the orchestrator's
implementation is the point the seal gates — it can check `req.url` against the manifest's
declared `endpoints` / `purposes` before doing the real `fetch`.
- **Scope (honest — 014-01 frame-critique).** The gate sees the **fetch hops the chamber
  intercepts** (a multi-hop chain is N dispatches — the chamber already keys `pendingFetches`
  per-`id`, so N hops = N gate-able dispatches). It does **not** see **browser-followed
  redirects** (a main-thread `fetch` default-follows a 302 to an endpoint the gate never
  checked) or **fire-and-forget DOM pixels** (not fetches at all) — those are a **separate
  confinement residual** (013-02 found the pixel path *shim-swallowed* and the fan-out a
  *lower bound*; both are unmeasured against a redirect-/pixel-firing org). So the
  endpoint-ceiling enforcement binds to this **honestly-scoped fetch-dispatch gate**, not an
  unqualified "all egress."
- **Pros:** documented (enforcement specs bind to a named surface, not a protocol);
  gate-able at one place for the fetch hops it sees (the orchestrator dispatch, ADR-0004);
  composes with the existing capability model (chamber declares need → orchestrator grants);
  separates the surface (this ADR) from the teeth (later enforcement specs).
- **Cons:** a new capability surface to design + version; the chamber↔orchestrator
  message protocol (`intercepted-fetch`) still exists underneath as the transport.

### Option B: Keep it chamber-internal; seal-gate only
Leave the round-trip an undocumented `intercepted-fetch` protocol; the seal gates the
dispatched fetch.
- **Pros:** no new contract surface; least code.
- **Cons:** an **undocumented parallel** to the fire-and-forget model — the enforcement
  specs have no declared surface to bind to; the frame-critique flagged that this
  contradicts the very goal (a documented home). Rejected.

### Option C: Unify into the fire-and-forget `EgressRequest` model
Force the round-trip into `handle → EgressRequest[]`.
- **Pros:** one egress surface.
- **Cons:** the mismatch is **control-flow, not a missing field**: `handle →
  EgressRequest[]` is a **completed batch return** with no continuation to deliver a
  response to, whereas the round-trip is an **inline await inside the running SDK** —
  extending `EgressRequest` with a response channel cannot bridge that. And GA4's
  `EgressRequest[]` (plain, re-mappable data) is **load-bearing for ADR-0004's unload
  fast path** (mapped synchronously at teardown), which an inline worker-side `dispatch`
  await cannot serve. The two surfaces must coexist. Rejected.

## Recommended Decision

**Option A.** The wrapped-SDK round-trip egress is a first-class, **declared-and-gated**
capability: `caps.egress.dispatch(req) → Promise<{ status, statusText?, headers?, body }>`,
documented in `contracts/capability.d.ts` and gate-able — **for the fetch hops the chamber
intercepts** (not browser-followed redirects or DOM pixels, a separate confinement residual
per 013-02) — at the orchestrator's main-thread dispatch against the manifest's declared
`endpoints` / `purposes`. It is distinct from — and coexists with — the fire-and-forget
`handle → EgressRequest[]` surface. This ADR settles the **surface**; the seal that gates it
is deferred to the MVP3 enforcement specs (this spec lands the *gate-able* surface, not the
teeth).

## Consequences

**Becomes easier:**
- The MVP3 enforcement specs (endpoint-ceiling, config-integrity per ADR-0006 / spec
  013-03, purpose-vector consent per ADR-0007) bind to **one named capability** at one
  seam, for both request shapes (`EgressRequest` and the `dispatch` round-trip).
- The wrapped-SDK egress moves out of the rig into `core/` with a documented contract,
  killing the rig-mirror-vs-core drift.

**Becomes harder:**
- The capability surface must be versioned + contract-pinned (`contract-stability`);
  a future third egress archetype needs to fit `dispatch` or justify a third surface.
- The orchestrator now hosts two dispatch shapes; the 014-03 convergence must fold both
  into one seam without regressing GA4's fire-and-forget path.

## Assumptions

- **`contracts/capability.d.ts` is the right home** — it already carries orchestrator-
  provided capabilities (`cookies.sync`, `decisions.deliver`) the chamber requests;
  `egress.dispatch` is the same shape (additive). Grounded ([`contracts/capability.d.ts`](../../contracts/capability.d.ts)).
- **The seal does not yet exist** — gating is declared-not-enforced until an MVP3
  enforcement spec builds it; this ADR only requires the surface be *gate-able* (the
  dispatch is a single chokepoint), not gated. Grounded (mvp3.md; the seal is unbuilt).

## Kill criteria

- If a real connector's round-trip egress cannot be expressed as `dispatch(req) →
  Response` (e.g. it needs streaming, multiplexed, or push responses the single
  request/response shape can't carry), the capability shape is wrong and must be
  revisited before the enforcement specs bind to it.
- If in-chamber egress **follows redirects** (a `fetch` 302 chain reaching an endpoint the
  gate never saw) or fires **DOM pixels** that bypass `dispatch`, the "gate-able at the
  dispatch" property is **partial** — the endpoint-ceiling enforcement must additionally
  handle redirects (e.g. `redirect: "manual"` + re-gate each hop) and confine pixels. This
  must be validated against a **redirect-/pixel-firing org** (the 013-02 lower-bound
  follow-up) **before** the enforcement spec relies on the gate as complete.

## Open questions

- The exact `req` shape (a WHATWG `Request`, or a plain `{ url, method, headers, body }`
  descriptor) — resolved during 014-01 implementation against what the chamber's
  interception actually hands over.
- Whether `dispatch` should use `redirect: "manual"` and serialize `url` / `redirected`
  into the postback so the gate can **detect + re-check** a redirect hop — needed **before**
  the endpoint-ceiling enforcement binds, **not** for 014-01's single-hop stub scenario (the
  chamber's current 4-field postback suffices there).
- How a connector **declares** it needs `egress.dispatch` (a manifest field vs implicit
  from the archetype) — resolved with the 014-03 convergence, when both archetypes are
  hosted one way.
- **Sequencing (load-bearing — 014-01 frame-critique).** These surface details close
  **inside spec 014** — the `req` shape at 014-01, redirect-visibility + the declaration at
  014-03 — **before** any MVP3 enforcement spec binds to the capability. That ordering is
  what makes "settle now" churn-reducing rather than premature; if an enforcement spec must
  bind before they close, revisit this ADR first.
