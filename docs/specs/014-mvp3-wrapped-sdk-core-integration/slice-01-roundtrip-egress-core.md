---
status: DONE
dependencies: []
last_verified: 2026-08-30
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 014-01 — round-trip egress + generic hosting in core (alloy driver)

**Goal:** Bring the wrapped-SDK **request/RESPONSE round-trip** egress into `core/` — in a **new
sibling core module** (e.g. `core/wrapped-sdk-host.js`) that hosts the alloy connector through
`core/connector-host.js` in a real Worker chamber, **leaving `core/airlock.js` + its hardcoded GA4
worker untouched** (convergence is 014-03) — so the 012-01 single-chamber scenario (alloy's
`interact` intercepted in the chamber → **core's** main-thread dispatch (ADR-0004) → Edge →
server-assigned ECID → `AMCV_*`/`kndctr_*` jar) runs through **`core/`, not the rig harness**. The
round-trip egress is implemented as the **declared-AND-gated `caps.egress.dispatch(req) → Response`
capability** (spec Assumptions / the ADR): a documented contract surface that is also seal-gate-able.
This is the missing egress model in core (today `core/airlock.js` dispatches only fire-and-forget
`ready` requests); it is the first of the two dispatch sites the **014-03 convergence** later folds
into one seam.

**DoR:**
- ✅ [012-01](../012-mvp2-alloy-chamber/slice-01-host-and-boot.md) DONE — the chamber (importScripts
  bundle-load, fetch-interception → main dispatch, sync-cookie capability, jar write-back) + the
  egress-confinement posture (AC5) exist in the rig to port.
- ✅ [013-01](../013-mvp3-live-alloy-reprobe/slice-01-edge-roundtrip.md) DONE — the round-trip is
  validated live; the core port can be proven against the 012 minting-Edge **stub** (deterministic)
  and, optionally, real Edge (spec 013 `.env`).
- ✅ [`core/connector-host.js`](../../core/connector-host.js) (generic host) + the alloy connector /
  chamber exist to wire into a **new** sibling core module; [`core/airlock.js`](../../core/airlock.js)
  + `core/chamber.worker.js` (GA4) are **read-only** for this slice (convergence is 014-03). The
  round-trip surface is confirmed absent from core (Assumptions).

**Acceptance Criteria:**

1. **A sibling core module hosts a wrapped-SDK connector via the generic host.** A **new `core/`
   module** (not `core/airlock.js`, not the GA4-hardcoded `core/chamber.worker.js`) instantiates the
   alloy connector through `createConnectorHost(factory, config)` in a **real Worker chamber** (the
   012-01 `alloy-chamber.worker.js` route: importScripts the stock bundle, shim globals, sync-cookie
   cache). Observable: alloy boots in a core-hosted chamber and sends one `interact`; `core/airlock.js`
   + `core/chamber.worker.js` are **unchanged** by this slice.
2. **Round-trip egress dispatch in the sibling module.** The new module handles the chamber's
   `intercepted-fetch`: it runs the **real** fetch on the main thread (ADR-0004) and posts the
   **response back** into the chamber, via the `caps.egress.dispatch(req) → Response` capability.
   Observable: the worker does **no** real network fetch (`workerRealFetchCalls === 0`); exactly one
   interact is dispatched by **core**; the response round-trips to the chamber. _(This is the second
   request shape — a raw intercepted fetch — the future single seam (014-03) must gate, alongside the
   wire-protocol `EgressRequest`.)_
3. **ECID round-trips into the jar through core.** The server-assigned ECID (stub or live) lands in
   the `AMCV_*`/`kndctr_*` jar via **core's** dispatch + write-back reconciliation. Observable: a
   real (non-stub-constant) ECID in the broker jar, written by the core path.
4. **Confinement regression re-run (cheap, chamber-side).** Confinement is chamber-side
   (`applyEgressConfinement` runs in the worker's own scope), so it is **location-independent** — this
   AC is a **regression re-run**, not a live risk: the 012-01 AC5 adversarial probe passes against the
   **core-hosted** chamber (the mediated `fetch` stays the sole network surface; XHR / sendBeacon /
   WebSocket / EventSource / WebTransport / nested Worker / CacheStorage / post-load importScripts
   unreachable; alloy still boots + sends), guarding only against an incidental disturbance if the
   port touched chamber source. Observable: the AC5 probe passes against the core-hosted chamber.
5. **The round-trip surface is the declared-AND-gated capability (per the ADR).** Implement the
   settled design (spec Assumptions / ADR): `caps.egress.dispatch(req) → Response` has a **documented
   contract home** in `contracts/*.d.ts` **and** is routed so the seal can gate it on the manifest's
   declared `endpoints` / `purposes` — this slice lands the **gate-able** surface, **not** the teeth
   (the gate is a later enforcement spec). The surface is pinned in `test/contract-stability.test.js`.
   Observable: the round-trip egress is a documented, contract-declared capability — not an
   undocumented parallel to the fire-and-forget model.
6. **Hardening.** A **fetch-shim timeout** — a never-answered main-thread response **rejects**
   `sendEvent` within a bounded time instead of hanging it — and the **dead-man real-fetch guard** is
   confined. Observable: a dropped/never-answered dispatch settles (rejects) within the timeout,
   tested with a bounded assertion (a regression hangs the test, not the suite).

**DoD:**
- [x] ACs 1–6 pass — the 012-01 single-chamber scenario runs through `core/` (a `test/` +/or a
      `rig/` harness that drives **core**, not the parallel mirror), green against the stub.
- [x] **No GA4 regression** — the MVP1 fire-and-forget path + the OQ10 unload fast path + every GA4
      test stay green (GA4 convergence is 014-03; this slice must not break it).
- [x] Reviews: compliance + craft + **arch** (this slice adds a core egress model + decides a
      contract surface — arch-review warranted) + reconciliation, recorded pass.
- [x] Deviation log + reconciliation sweep under this slice heading; `docs/refinement-todo.md` (a)+(b)
      updated (round-trip egress in core + its contract home resolved for the single-chamber case).
- [x] **No live identifiers committed** — if validated against real Edge, redact (deny-by-default,
      per 013-01); the stub path commits no ids by construction.

### Deviation log

_2026-08-30._
- **Public API shape.** `createWrappedSdkHost` returns `{init, driveEvent, getState}` (not a
  monolithic "drive") — cleaner mapping onto "boot, then one page event." `createConnectorHost` runs
  **worker-side** inside the chamber (unchanged); this host is the **main-thread** side.
- **AC4 probe rig-wired.** The 012-01 AC5 egress self-probe (`probe-egress`/`egress-probe-result`) is
  driven by the rig harness's own listener, not the host — the host is transport-agnostic and owns the
  production round-trip protocol only. Deliberate, disclosed in the host docstring.
- **Contract-home fixes (arch-review [1], blocker).** Both orchestrator-provided main-thread sinks got
  a documented, pinned contract home: `egress.dispatch` (AC5) **and** `cookies.reconcile` (the async
  cookie write-back sink) — the latter was an undocumented parallel in the first cut; now in
  `contracts/capability.d.ts` + `contract-stability`.
- **Craft hardening (all nits applied).** `driveEvent` re-entry now REJECTS (silent-hang footgun +
  regression test); the `caps.cookies.reconcile` sink call is try/catch-guarded; the near-timeout test
  asserts exactly-one-post past `timeoutMs`; the rejecting-dispatch test is bounded. The error-path
  `statusText` (`String(err.message||err)`) was kept (cleaner; the test expects it).

### Reconciliation sweep

Parallel-and-minimal holds — `core/airlock.js`, `core/chamber.worker.js`, and
`connectors/alloy/alloy-chamber.worker.js` are **read-only, confirmed unchanged** (git diff empty);
only a new `core/wrapped-sdk-host.js` + rig + tests + **additive** `contracts/` changes. Full suite
green (481); the chromium rig (`rig:alloy-core`) green (26 assertions — AC1–4). `docs/refinement-todo.md`
(a)+(b) resolved for the single-chamber case (round-trip egress in core + its contract home =
[ADR-0010](../../decisions/adr-0010-roundtrip-egress-capability.md)). **New follow-ups logged** (arch
concerns, not gates): (arch-2) `reconcileForBrokerJar` strips `Secure` for the localhost rig — a
production **https** host must preserve it; (arch-3) `GrantedCapabilities` now mixes chamber-facing +
host-side capabilities; (arch-4) **014-03's "one seam" must reconcile THREE fetch sites** — the async
`dispatch` cannot host `core/egress.js`'s **synchronous unload fast path**, and `EgressDispatchRequest`
carries no `keepalive` (ADR-0004); (arch-5) `CapabilityRequest.egress:boolean` can't distinguish the
two egress models (both 4/5 deferred to 014-03 by ADR-0010's open question). No `architecture.md` drift
(the new module is the main-thread sibling of the worker-side `connector-host.js`). No live identifiers.

**Anti-horizontal-phasing check:** after this slice, the **shippable runtime gains wrapped-SDK
round-trip egress + hosting for the first time** — a capability `core/` never had (the rig proof was
throwaway, never a product surface). Observable value: the product can run an alloy connector
end-to-end (interact → ECID → jar), not just a rig.
