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
byte-identical `mapToMp`). **⚠ Named for that enforcement spec (frame-critique [4]):** "no interaction
to protect" justifies sync *mapping* (INP) but says nothing about *gating* — the sync unload egress
(`core/egress.js`'s `fetch(endpoints[t])`) **bypasses the manifest + the seal**, and being synchronous
**cannot call an async seal-gate**. So MVP3's endpoint/consent enforcement inherits a genuinely hard
**synchronous-gating** sub-problem here — flagged now so it isn't discovered late. So the deliverable
is "one hosting path + a clearly-bounded set of egress paths," not the over-claim "all egress at one
seam."

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
   `ready: EgressRequest[]`, the same host alloy uses. **Impedances to bridge (frame-critique):**
   (a) author a **GA4 manifest** (`connectors/ga4/` is only `map.js` + `cookies.js` today — no
   manifest exists); (b) `mapToMp` reads `event.params`, but the contract's `AirlockEvent` is
   `{payload, snapshot}` — so the generic GA4 worker feeds `handle` the legacy `{type, params}`
   descriptor (the same `event.params || event.payload` bridge alloy already uses), leaving `mapToMp`
   **untouched** (AC2 byte-identity); (c) the per-tracker `busy(workFactor)` loop is re-homed into
   `handle` (no byte impact).
2. **Fire-and-forget egress intact.** GA4's `ready` requests are dispatched by `core/airlock.js` on
   the main thread via `fetch(..., {keepalive})` (ADR-0004) — the wire-protocol model is unchanged;
   the round-trip surface (014-01) is used only by wrapped-SDK connectors. Observable: GA4 egress is
   byte-identical to MVP1 (`mapToMp` output unchanged). **Note (frame-critique):** `routeBatch` / the
   host's `init` are async (vs `mapBatch`'s sync path) — the generic worker glue must sequence
   **init-before-events** (trivial for GA4's sync `mapToMp`, which resolves in a microtask before the
   next message macrotask; the `{ready, dropped}` return shape is identical to `mapBatch`, so
   `airlock.js`'s `onmessage`/`drain`/`ring`/`projection` stay **untouched** — only the Worker URL +
   init payload change).
3. **OQ10 unload fast path preserved AS A SEPARATE synchronous path (arch-4).** The synchronous
   main-thread `pushCritical` + the `visibilitychange`/`pagehide` ring-tail flush still map via the
   pure `mapToMp` (byte-identical), never entering the worker — and are **explicitly NOT** folded into
   the async `caps.egress.dispatch` seam (it can't serve a synchronous keepalive path). Observable:
   `test/egress-fastpath.test.js` green; no double-send; the unload path remains synchronous.
4. **One hosting MECHANISM (not one orchestrator).** The GA4-hardcoded `core/chamber.worker.js`
   mapping path is **retired** — GA4's chamber now hosts its connector via `createConnectorHost`, the
   **same mechanism** alloy's chamber uses, so no two divergent hosting mechanisms remain. Observable:
   **both connectors' chambers** host via `createConnectorHost`. **Frame-critique [1] — do NOT
   over-read:** `core/airlock.js` **stays the GA4 orchestrator** (egress path (i): the fire-and-forget
   `onmessage` fetch + `unloadFlush`), and alloy stays orchestrated by the **separate**
   `core/wrapped-sdk-host.js` (014-01). "One hosting path" = one hosting *mechanism inside the
   chambers*, **not** one orchestrator — alloy is **not** routed through `airlock.js`.
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
      delete it, so exactly one broker remains. **Gate (frame-critique [5]):** this is an ALLOY
      artifact orthogonal to GA4 hosting — keep it ONLY as a **mechanical** verbatim-copy delete +
      test/harness redirect. **Split it into its own cleanup the moment the redirect proves
      non-mechanical** — an unrelated alloy test-rewire must not block a GA4-green slice.

**Anti-horizontal-phasing check:** after this slice, GA4 (UC-2) runs through the same generic host as
alloy — one connector-hosting path in core, not two. Observable value: the GA4 analytics scenario,
re-hosted, all tests green.
