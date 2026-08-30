---
status: DRAFT
dependencies: [014-01]
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 014-03 — converge connector-hosting (GA4 retrofit)

**Goal:** Retrofit **GA4** onto the generic `core/connector-host.js` so both connectors — the
wrapped-SDK alloy (014-01) and the wire-protocol GA4 (MVP1) — are hosted **one** way, and converge /
retire the GA4-hardcoded `core/chamber.worker.js` path (`core/airlock.js` hardcodes
`new Worker(new URL("./chamber.worker.js", …))` importing GA4's `mapToMp` directly). After it there is
**one connector-HOSTING path** in core, not two that calcify — closing the MVP2 arch flag 3 debt.

**Honest scope (014-01 arch-4).** This converges the *hosting*, **not** the egress paths — THREE
legitimately coexist and are **not** folded into one: (i) GA4 **fire-and-forget** `ready` dispatch,
(ii) the wrapped-SDK **round-trip** dispatch (014-01), and (iii) `core/egress.js`'s **synchronous
unload fast path** (GA4-only, which an async `dispatch(req) → Promise` structurally **cannot** serve,
and which needs `keepalive` that `EgressDispatchRequest` lacks). The MVP3 enforcement seam binds to the
**steady-state dispatch** (i + ii); the unload fast path stays a **separate synchronous path** a later
enforcement spec handles on its own terms (unload-time — no interaction to protect — reusing the
byte-identical `mapToMp`). So the deliverable is "one hosting path + a clearly-bounded set of egress
paths," not the over-claim "all egress at one seam."

**DoR:**
- ✅ [014-01] DONE — `core/airlock.js` can host a connector via `createConnectorHost` in a real
  chamber (the generic path is wired into core, proven with alloy).
- ✅ GA4 exists to retrofit: [`connectors/ga4/map.js`](../../connectors/ga4/map.js) (`mapToMp`),
  [`core/chamber.worker.js`](../../core/chamber.worker.js) (the hardcoded host), and the GA4 test
  suite (`test/ga4-*.test.js`, `test/egress-fastpath.test.js`, `test/oracle-ga4.test.js`).

**Acceptance Criteria:**

1. **GA4 hosted via the generic host.** GA4 is expressed as a `ConnectorFactory` (manifest → factory
   → init → `handle`) and hosted through `createConnectorHost` — **not** the hardcoded `mapToMp`
   import in `core/chamber.worker.js`. Observable: GA4 events route through `routeBatch` →
   `ready: EgressRequest[]`, the same host alloy uses.
2. **Fire-and-forget egress intact.** GA4's `ready` requests are dispatched by `core/airlock.js` on
   the main thread via `fetch(..., {keepalive})` (ADR-0004) — the wire-protocol model is unchanged;
   the round-trip surface (014-01) is used only by wrapped-SDK connectors. Observable: GA4 egress is
   byte-identical to MVP1 (`mapToMp` output unchanged).
3. **OQ10 unload fast path preserved AS A SEPARATE synchronous path (arch-4).** The synchronous
   main-thread `pushCritical` + the `visibilitychange`/`pagehide` ring-tail flush still map via the
   pure `mapToMp` (byte-identical), never entering the worker — and are **explicitly NOT** folded into
   the async `caps.egress.dispatch` seam (it can't serve a synchronous keepalive path). Observable:
   `test/egress-fastpath.test.js` green; no double-send; the unload path remains synchronous.
4. **One hosting path.** The GA4-hardcoded `core/chamber.worker.js` path is **retired or converged**
   onto the generic host — no two divergent hosting mechanisms remain. Observable: `core/airlock.js`
   hosts both connectors through `core/connector-host.js`; any residual GA4-specific worker glue is
   the generic chamber's, not a parallel hardcode.
5. **No GA4 regression (UC-2).** Every GA4 test — mapping, cookies, purchase, conformance, the oracle
   gate — stays green; the MVP1/MVP2 connector/capability contract is unbroken (mvp3.md No-Gos).
   Observable: the full GA4 suite + `test/oracle-ga4.test.js` pass.

**DoD:**
- [ ] ACs 1–5 pass — GA4 (UC-2) runs through the generic host, full suite + oracle green.
- [ ] Reviews: compliance + craft + **arch** (connector-hosting convergence is an architecture
      change) + reconciliation, recorded pass.
- [ ] Deviation log + reconciliation sweep; `docs/refinement-todo.md` (c) updated (two hosting paths
      converged); `architecture.md` module-boundary note reconciled if the hosting boundary moved.
- [ ] **No breaking change** to the MVP1/MVP2 connector/capability contracts — `contracts/` diffs are
      additive; `test/contract-stability.test.js` green.
- [ ] **Retire the duplicate 012-02 rig broker (arch-2 follow-up).** `rig/alloy-coalescing-broker.js`
      is a verbatim copy of `core/coalescing-broker.js` (the drift hazard spec 014 exists to kill) —
      redirect its test/harness at `core/coalescing-broker.js` (injecting the alloy recognizer) or
      delete it, so exactly one broker remains. _(Bundled here as the "retire duplicates" theme; the
      frame-critique may split it out if it doesn't belong.)_

**Anti-horizontal-phasing check:** after this slice, GA4 (UC-2) runs through the same generic host as
alloy — one connector-hosting path in core, not two. Observable value: the GA4 analytics scenario,
re-hosted, all tests green.
