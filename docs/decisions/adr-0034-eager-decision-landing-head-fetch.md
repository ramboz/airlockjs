---
status: Proposed
dependencies: [adr-0016, adr-0031, adr-0032, adr-0033]
last_verified: 2026-09-18
frame_review: true
---

# ADR-0034: Landing the remote decision in eager: inline head fetch + `applyResponse` handoff vs eager Worker boot

## Status

Proposed (2026-09-18) — **accept only after the head-fetch probe** (race win-rate + identity-cookie readability) records
its findings; see Assumptions and Kill criteria.

## Context

Hero personalization needs the Target/AJO decision **in hand when the eager phase runs**, and airlock's only remote
decision path today cannot be: the alloy chamber boots in the lazy phase (`bootAlloy`, `adapters/eds/index.js:1591`), the
eager chunk is build-asserted to construct no `Worker` (`build.mjs:273-281`), and R-005 established that a worker round
trip inside eager delays `body.appear`. So under [ADR-0032](./adr-0032-eager-paint-policy-and-flag.md) every hero decision
would engage the skeleton/blocking hold, every time. The question is how to fire the decision request early enough that,
on a warm connection, it **beats eager** — without reimplementing alloy's identity, cookie and notification machinery.

The Web SDK research in [R-012](../research/R-012-personalization-experimentation-runtime.md) §4 gives two facts that make
an option space. The `/ee/v2/interact` request shape is documented (Edge Network Server API): `events[].query.personalization
{schemas, decisionScopes, surfaces}`, `query.identity.fetch:["ECID"]`, and `meta.state.entries` carrying the first-party
`kndctr_<ORG>_AdobeOrg_identity` / `_cluster` cookies. And alloy exposes **`applyResponse`** — the hybrid-personalization
command that ingests a server-fetched interact response, replays the full lifecycle, writes `state:store` cookies and
returns propositions exactly as `sendEvent` would. `@adobe/alloy-node` (alpha) already does "fetch-only Personalization"
against the same endpoint.

## Decision Options Considered

### Option A (lean): inline `<head>` fetch, handed to the worker alloy via `applyResponse`
- A tiny inline script in `<head>` (after `preconnect` to the edge domain) reads the identity cookie, POSTs one interact
  with `__view__` + the declared scopes/surfaces, and parks the response promise. The eager applier awaits it under the
  ADR-0032 budget; when the alloy chamber boots, the host feeds the same response into `alloy('applyResponse', …)` so
  identity, cookies, view cache and notifications stay alloy's. **One interact per page** serves hero, below-fold and identity.
- **Pros:** fastest possible first byte (parallel with CSS/fonts); near-zero main-thread JS; no identity re-implementation
  — only the request shape, pinned in `contracts/`.
- **Cons:** re-implements the request shape (drift risk vs the SDK's `createQueryDetails`, e.g. the `dom-action` schema only
  when `__view__` is requested); depends on the identity cookie being **readable by JS** or ridable with `credentials`
  under both third-party edge domain and first-party CNAME setups; consent stripping must be mirrored (`personalization`
  purpose pending → no `query.personalization`) since the request precedes the trusted seam.

### Option B: boot the alloy Worker in eager
- Relax the build assertion; the chamber `importScripts` alloy and sends the interact from the worker during eager.
- **Pros:** zero re-implementation; identical to lazy behaviour.
- **Cons:** bundle download + parse + `configure` before the request even fires (tens to hundreds of ms behind Option A);
  main-thread Worker construction cost in the eager window; breaks a load-bearing invariant of the eager chunk.

### Option C: status quo (worker in lazy) + cache/prefetch only
- **Pros:** nothing new on the critical path.
- **Cons:** first visits always hold; "land in eager" becomes a warm-cache-only property.

### Option D: edge-injected decisions (tier 0)
- A CDN worker calls the Server API and inlines the propositions into the HTML.
- **Pros:** zero LCP cost, zero flicker, no client fetch.
- **Cons:** requires customer edge compute; per-user cache bypass; out of this release's appetite. Kept as an **adapter**:
  the applier accepts an inline JSON source from day one.

## Recommended Decision

**Option A, conditional on the probe**, with Option D kept as an adapter and Option C's cache/prefetch as the
complement (ADR-0035). Rules:

1. The head fetch is emitted whenever a placement is declared for the page, **regardless of ADR-0032's paint mode**
   (including `off`) — mode is a paint policy, not a fetch policy (ADR-0032 rule 1). No declared placement → no head
   fetch (the lazy worker interact remains). The head fetch *replaces* the lazy interact, so per-page server calls are
   unchanged.
2. Its request shape is a pinned contract derived from alloy's `createQueryDetails` for the requested scopes/surfaces, with
   a drift test against the pinned alloy version (ADR-0016) — if alloy changes the shape, the test fails before a customer
   does.
3. Consent is mirrored client-side: pending/denied `personalization` → the fetch omits `query.personalization` (or is
   skipped) exactly as the seam strips it; identity-only interacts are still allowed under analytics consent.
4. The response is handed to alloy via `applyResponse` once the chamber boots; airlock never writes identity cookies itself.
5. The eager applier consumes propositions from the response under ADR-0031/0032.

## Consequences

**Becomes easier:**
- On **declared** pages (ADR-0032 `async`/`blocking`), warm-connection hero decisions land before the hero reveals
  with no hold engaged; cold ones engage a *measured* hold. On undeclared pages the head fetch still fires (identity,
  below-fold placements, diagnostics) but no `initialViewport` placement is written (ADR-0031 rule 3 — the declaration, not latency, is the
  gate; `Undeclared` suppression).
- A single interact per page keeps Target server-call volume unchanged vs today.

**Becomes harder:**
- A second, contract-pinned copy of the request shape to keep in step with alloy.
- Consent logic exists in two places (inline head + trusted seam) and must agree — a test target.

## Assumptions (to be retired by the probe before acceptance)

- **The `kndctr_*_identity` cookie is readable by page JS** (set via `document.cookie` by alloy under a third-party edge
  domain) **or rides automatically** with `credentials: "include"` under a first-party CNAME. Documented behaviour; **not
  probed**.
- **`applyResponse` accepts a response fetched outside the SDK and replays cookies/notifications** — from
  `injectApplyResponse.js` + alloy-samples hybrid READMEs (R-012 §4); **not executed** in the chamber.
- **On a warm connection the interact response beats eager often enough to matter** — plausible from RTT ranges;
  **unmeasured**. The probe measures the decision-arrival-vs-eager delta on the EDS testbed under throttling.

## Kill criteria

- The identity cookie is `HttpOnly`/unreadable and cannot ride the fetch under a common setup → Option B (eager Worker)
  becomes the recommendation; supersede.
- The race win-rate on realistic mobile profiles is negligible even warm → Option A is not worth the contract; keep
  Option C + ADR-0035 and supersede.
- `applyResponse` rejects an externally fetched response in the chamber → fall back to Option B.

## Open questions

- Where the inline head script lives on an EDS site (`head.html` snippet vs an eager `modulepreload`d module).
- Default budget values for ADR-0032 — set from the probe's distribution.
