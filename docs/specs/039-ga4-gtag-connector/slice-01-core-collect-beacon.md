---
status: DRAFT
dependencies: [adr-0019]
last_verified:
frame_review: true
arch_review: true
---

## Slice 039-01 — core /g/collect page_view beacon

**Goal:** Ship `createGa4GtagConnector(config)` — a new module, sibling to the MP connector — that maps a captured event
into a container-shaped **`/g/collect` GET beacon** carrying the core attribution fields, sourcing `cid`/`sid` exactly as
the MP path does today, and emits it off-thread through the governed GET egress. No new session state yet.

**DoR:**
- ✅ Identity sourcing exists — `connectors/ga4/cookies.js` `sourceGa4Ctx` (`cookies.js:146`, reuse).
- ✅ Off-thread GET egress proven — `connectors/pixel/connector.js:149` pattern + `core/airlock.js`.
- ✅ Target field set — R-009(a)'s `/g/collect` `page_view` map, capture-confirmed 2026-09-07.

**Acceptance Criteria:**

1. **`createGa4GtagConnector(config).handle(evt)`** returns `{ url, method: "GET" }` where `url` is a `/g/collect` request
   carrying `v=2`, `tid`, `cid`, `en`, `dl`/`dr`/`dt`, `ep.<k>` (string params) / `epn.<k>` (numeric params), and `_et`
   (engagement time) — the core attribution set. **GET is the parity-faithful transport for a single event** (observed
   live 2026-09-08: gtag sends a lone event as a query-string GET; it switches to a batched POST only for ≥2 events,
   which is slice 039-04's scope — not this slice's).
2. **`cid`/`sid` via reuse.** `cid` comes from `sourceGa4Ctx` (`_ga`), `sid` from `_ga_<stream>` or the per-page fallback
   (byte-for-byte the MP path's sourcing — no new cookie behavior in this slice).
3. **No `api_secret`.** The URL carries `tid` + origin only; a test asserts no `api_secret`/secret param is present
   (the ADR-0019 adoption fix).
4. **Additive — MP untouched.** `connectors/ga4/map.js` and `contracts/ga4-mp*` are unchanged (a test/grep asserts the
   frozen MP surface is not modified by this slice).
5. **Same-protocol oracle passes.** The emitted beacon passes the [038](../038-parity-harness/spec.md) same-protocol
   oracle against a redacted `/g/collect` `page_view` fixture on the core field set (until 038-01 lands, a unit assertion
   of the exact query field set stands in).

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Coverage: a happy-path `page_view`, a numeric-vs-string param split (`ep.`/`epn.`), and the no-`api_secret`
      assertion.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` (compliance + craft; `arch_review: true` — a new connector module boundary).
- [ ] Deviation log + reconciliation sweep produced.

## Assumptions

- **The `page_view` field set is capture-confirmed (R-009 + re-observed live 2026-09-08), but other event names may add
  fields** — each event type is confirmed on a redacted capture before its mapping is trusted. This slice ships only
  `page_view`, so the residual bites future event types, not 039-01. (Why `frame_review: true`.)
- **Single-event transport is GET (observed 2026-09-08).** The core beacon for one captured event rides as a
  query-string GET, matching the container's own single-event send; the batched-POST form gtag uses for ≥2 events is out
  of scope here (slice 039-04). `core/airlock.js` egress already supports method+body, so 039-04 needs no new egress seam.

**Anti-horizontal-phasing check:** After this slice a rewired GA4 `page_view` reaches `/g/collect` off-thread with the
core attribution fields, verifiable by the parity harness — the analytics anchor's rewire path, working end-to-end.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
