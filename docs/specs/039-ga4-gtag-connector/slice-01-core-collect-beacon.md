---
status: DONE
dependencies: [adr-0019]
last_verified: 2026-09-08
frame_review: true
arch_review: true
---

## Slice 039-01 — core /g/collect page_view beacon

**Goal:** Ship `createGa4GtagConnector(config)` — a new module, sibling to the MP connector — that maps a captured event
into a container-shaped **`/g/collect` GET beacon** carrying the core attribution fields, sourcing `cid`/`sid` exactly as
the MP path does today. It returns the beacon as the **`EgressRequest[]` shape the existing generic connector host
(`core/connector-host.js`) dispatches** through the governed GET egress airlock already uses for GET pixels (spec 026) —
i.e. the connector produces the hostable request; the existing generic host performs the off-thread dispatch (no new
egress path). No new session state yet.

**DoR:**
- ✅ Identity sourcing exists — `connectors/ga4/cookies.js` `sourceGa4Ctx` (`cookies.js:146`, reuse).
- ✅ Off-thread GET egress proven — `connectors/pixel/connector.js:149` pattern + `core/airlock.js`.
- ✅ Target field set — R-009(a)'s `/g/collect` `page_view` map, capture-confirmed 2026-09-07.

**Acceptance Criteria:**

1. **`createGa4GtagConnector(config).handle(evt)`** returns `[{ url, method: "GET" }]` — the `EgressRequest[]` array shape
   the `Connector.handle` contract (`contracts/connector.d.ts`) declares and `core/connector-host.js` consumes (iterated
   with `for (const req of requests)`), matching the sibling `connectors/pixel/connector.js` and `connectors/ga4/connector.js`
   return shape. `url` is a `/g/collect` request carrying `v=2`, `tid`, `cid`, `en`, `dl`/`dr`/`dt`, `ep.<k>` (string
   params) / `epn.<k>` (numeric params), and `_et` (engagement time) — the core attribution set. **GET is the
   parity-faithful transport for a single event** (observed live 2026-09-08: gtag sends a lone event as a query-string
   GET; it switches to a batched POST only for ≥2 events, which is slice 039-04's scope — not this slice's).
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
- [x] All ACs pass; full suite green (89 files / 1348 tests, independently re-run).
- [x] Coverage: a happy-path `page_view`, a numeric-vs-string param split (`ep.`/`epn.`), and the no-`api_secret`
      assertion (17 tests in `test/ga4-gtag.test.js`).
- [x] Each new test shown to fail when its feature is removed (implementer demonstrated; AC5 negative control deletes `en`).
- [x] Reviewed by `reviewer` (compliance + craft + arch — all pass; evidence in `reviews/slice-01-*.md`).
- [x] Deviation log + reconciliation sweep produced.

## Assumptions

- **The `page_view` field set is capture-confirmed (R-009 + re-observed live 2026-09-08), but other event names may add
  fields** — each event type is confirmed on a redacted capture before its mapping is trusted. This slice ships only
  `page_view`, so the residual bites future event types, not 039-01. (Why `frame_review: true`.)
- **Single-event transport is GET (observed 2026-09-08).** The core beacon for one captured event rides as a
  query-string GET, matching the container's own single-event send; the batched-POST form gtag uses for ≥2 events is out
  of scope here (slice 039-04). `core/airlock.js` egress already supports method+body, so 039-04 needs no new egress seam.

**Anti-horizontal-phasing check:** After this slice a rewired GA4 `page_view` is produced as the container-shaped
`/g/collect` `EgressRequest[]` the existing generic connector host dispatches off-thread (no new egress path), and it
passes the 038 same-protocol oracle on the core field set — the analytics anchor's rewire path, verified end-to-end by
the parity harness. (Runtime host *registration* of this connector — the `manifest`/`init` wrapper, mirroring how
`connectors/ga4/connector.js` wraps the `map.js` mapper — is the one deferred piece, logged as a deviation; the
`handle()` egress contract this slice ships is what the host consumes.)

### Deviation log (after reconciliation)

- **AC1 return shape corrected mid-implementation (bare object → `EgressRequest[]`).** The slice originally specified
  `handle()` returning `{ url, method: "GET" }`. Compliance review found that shape incompatible with the
  `Connector.handle` contract (`contracts/connector.d.ts` → `EgressRequest[]`) and `core/connector-host.js:75-76`'s
  `for (const req of requests)` consumption (a bare object throws "not iterable"). AC1 and the implementation were both
  corrected to `[{ url, method: "GET" }]`, matching the sibling pixel/ga4 connectors. Compliance re-review: pass.
- **Full `Connector` wrapper (`manifest`/`init`) deferred; resolved intent recorded.** `gtag.js` ships as the pure
  mapper exposing `{ handle }` — it is NOT yet host-registerable (`core/connector-host.js` needs `manifest`/`init`).
  Arch review flagged that the factory name (`createGa4GtagConnector`) implies a full Connector. **Resolved intent:**
  slice **039-03** grows this factory into the full Connector (adds `manifest` + `init(caps)` — the caps-holding closure
  the `_ga_<stream>` read-modify-write needs — keeping `handle`), a SINGLE factory (not a separate wrapper file), because
  the gtag connector is stateful (needs caps) unlike the pure MP `map.js` mapper. The module-doc "separate wrapper
  mirroring connector.js" line is corrected in 039-03.
- **AC5 wired into the REAL 038 oracle, not the unit fallback.** 038 is DONE, so instead of the AC5 "unit assertion
  stands in" fallback, a genuine same-protocol descriptor `rig/parity/descriptors/ga4-gtag.js` was added and run through
  the real `diffParity` engine (reusing the 038 fixture + primitives unmodified). Strengthens AC5 and sets up
  039-02/03/05 to shrink their own gap-map rows.
- **Transport GET/POST split.** Single-event GET confirmed the parity-faithful transport (live 2026-09-08); the batched
  POST form gtag uses for ≥2 events was lifted to spec 040 (via DEFERRED 039-04) — not built here.
- **Craft/arch nits logged (non-blocking, no code churn post-review):** (1) `deriveLogicalEvent`/`EP_STRING`/`EP_NUMBER`
  are an inline mirror of `rig/parity/descriptors/ga4.js` — 2 callers, within the ADR-0002 extract-on-3rd-caller budget;
  extract a shared `deriveGa4CollectEvent` when a 3rd `/g/collect` descriptor appears. (2) `gtag.js:102`
  `query.length ? … : endpoint` ternary is unreachable (`v`+`_et` always present) — dead defensive code copied from
  pixel; safe to simplify on next touch. (3) `v=2` is not in the descriptor's `attributionFields`/denylist — benign now
  (the reused MP fixture omits `v`), add on a real `/g/collect` re-capture. (4) the AC4 golden-sha256 guard gives an
  opaque diff on a future `map.js` whitespace/comment edit (intended, but low signal to the next maintainer). (5) [arch]
  the `/g/collect` GET wire surface has no pinned contract artifact yet (unlike `contracts/ga4-mp*`); the descriptor's
  `attributionFields` is the de-facto contract — defer a pinned artifact until the field set stabilizes across
  039-02/03/05. None gate this slice.

### Reconciliation sweep

- **Frozen MP surface** (`connectors/ga4/map.js`, `contracts/ga4-mp*`): **no-op** — byte-identical, guarded by the AC4
  golden-sha256 test + a no-import grep; `git diff` confirms zero change.
- **038 parity harness** (`rig/parity/`): **updated** — added `descriptors/ga4-gtag.js` (a new same-protocol descriptor),
  reusing `diffParity` + `test/fixtures/parity-ga4-collect.redacted.json` unmodified; per-slice gap-map owners
  (039-02/03/05) — an intentional refinement over `ga4.js`'s coarse "spec 039" bucket, not drift.
- **`docs/architecture.md`** (module inventory): **deferred** to spec close-out — `connectors/ga4/gtag.js` is a new
  module, but 039 is mid-flight (039-02/03 pending); the boundary write lands when the spec closes (primer-hygiene rule).
- **ADR-0019 doc-consistency** (its open-question "field-for-field confirmation of the `/g/collect` map" is now closed by
  R-009 + the 2026-09-08 live capture): **deferred — needs owner approval.** Amending an Accepted ADR record requires a
  separate grant (skill reconciliation rule / issue #125). Surfaced to the owner as a proposed dated `## Amendments`
  entry; not applied unilaterally.
- **038 fixture inconsistency** (`test/fixtures/parity-ga4-collect.redacted.json` has cookie `o3` but beacon `sct=1`/
  `_ss=1`/`_nsi=1` — a session-start shape real gtag never emits at `o3`): **deferred — needs owner approval** (DONE-spec
  038 artifact). Flagged for a follow-up; the new `parity-ga4-collect-multipage.redacted.json` (039-03) is internally
  consistent with observed rules.
- **`docs/refinement-todo.md` OQ13-2**: **no-op** here — closed by 039-03, not this slice.
- **Glossary / CLAUDE.md primer**: **no-op** — spec not yet closed; no new always-loaded term this slice.
