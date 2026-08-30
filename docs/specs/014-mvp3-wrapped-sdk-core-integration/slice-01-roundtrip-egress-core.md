---
status: DRAFT
dependencies: []
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 014-01 — round-trip egress + generic hosting in core (alloy driver)

**Goal:** Bring the wrapped-SDK **request/RESPONSE round-trip** egress into `core/airlock.js` and
host the alloy connector through `core/connector-host.js` in a real Worker chamber — so the 012-01
single-chamber scenario (alloy's `interact` intercepted in the chamber → **core's** main-thread
dispatch (ADR-0004) → Edge → server-assigned ECID → `AMCV_*`/`kndctr_*` jar) runs through **`core/`,
not the rig harness** — with the chamber's egress-confinement preserved and the round-trip surface's
**contract home decided**. This is the missing egress model (`core/airlock.js` today dispatches only
fire-and-forget `ready` requests); landing it makes ADR-0004's dispatch a single core seam the MVP3
enforcement specs extend.

**DoR:**
- ✅ [012-01](../012-mvp2-alloy-chamber/slice-01-host-and-boot.md) DONE — the chamber (importScripts
  bundle-load, fetch-interception → main dispatch, sync-cookie capability, jar write-back) + the
  egress-confinement posture (AC5) exist in the rig to port.
- ✅ [013-01](../013-mvp3-live-alloy-reprobe/slice-01-edge-roundtrip.md) DONE — the round-trip is
  validated live; the core port can be proven against the 012 minting-Edge **stub** (deterministic)
  and, optionally, real Edge (spec 013 `.env`).
- ✅ [`core/airlock.js`](../../core/airlock.js) + [`core/connector-host.js`](../../core/connector-host.js)
  exist to modify; the round-trip surface is confirmed absent from core (Assumptions).

**Acceptance Criteria:**

1. **Core hosts a wrapped-SDK connector via the generic host.** `core/` instantiates the alloy
   connector through `createConnectorHost(factory, config)` in a **real Worker chamber** (the
   012-01 `alloy-chamber.worker.js` route: importScripts the stock bundle, shim globals, sync-cookie
   cache) — **not** the GA4-hardcoded `core/chamber.worker.js`. Observable: alloy boots in a
   core-hosted chamber and sends one `interact`.
2. **Round-trip egress dispatch in core.** `core/airlock.js` (or a core module it owns) handles the
   chamber's `intercepted-fetch`: it runs the **real** fetch on the main thread (ADR-0004) and posts
   the **response back** into the chamber. Observable: the worker does **no** real network fetch
   (`workerRealFetchCalls === 0`); exactly one interact is dispatched by **core**; the response
   round-trips to the chamber.
3. **ECID round-trips into the jar through core.** The server-assigned ECID (stub or live) lands in
   the `AMCV_*`/`kndctr_*` jar via **core's** dispatch + write-back reconciliation. Observable: a
   real (non-stub-constant) ECID in the broker jar, written by the core path.
4. **Confinement preserved (no second egress path).** Moving the dispatch into `core/` keeps the
   chamber's mediated `fetch` its **sole** network-capable surface (012-01 AC5) — the adversarial
   egress set (XHR / sendBeacon / WebSocket / EventSource / WebTransport / nested Worker /
   CacheStorage / post-load importScripts) stays unreachable, and alloy still boots + sends.
   Observable: the AC5 adversarial probe passes against the **core-hosted** chamber.
5. **Round-trip surface's contract home DECIDED + justified.** The request/response round-trip egress
   is either (a) modelled in `contracts/*.d.ts` as a first-class capability **or** (b) kept
   chamber-internal and governed at the seal — **one** is chosen, the trade-off recorded (tracked
   debt (b) / arch flag 2: `handle → EgressRequest[]` models only fire-and-forget), and the choice is
   pinned in `test/contract-stability.test.js`. Observable: the surface has a documented home, not an
   undocumented parallel to the fire-and-forget model.
6. **Hardening.** A **fetch-shim timeout** — a never-answered main-thread response **rejects**
   `sendEvent` within a bounded time instead of hanging it — and the **dead-man real-fetch guard** is
   confined. Observable: a dropped/never-answered dispatch settles (rejects) within the timeout,
   tested with a bounded assertion (a regression hangs the test, not the suite).

**DoD:**
- [ ] ACs 1–6 pass — the 012-01 single-chamber scenario runs through `core/` (a `test/` +/or a
      `rig/` harness that drives **core**, not the parallel mirror), green against the stub.
- [ ] **No GA4 regression** — the MVP1 fire-and-forget path + the OQ10 unload fast path + every GA4
      test stay green (GA4 convergence is 014-03; this slice must not break it).
- [ ] Reviews: compliance + craft + **arch** (this slice adds a core egress model + decides a
      contract surface — arch-review warranted) + reconciliation, recorded pass.
- [ ] Deviation log + reconciliation sweep under this slice heading; `docs/refinement-todo.md` (a)+(b)
      updated (round-trip egress in core + its contract home resolved for the single-chamber case).
- [ ] **No live identifiers committed** — if validated against real Edge, redact (deny-by-default,
      per 013-01); the stub path commits no ids by construction.

**Anti-horizontal-phasing check:** after this slice, alloy's single-chamber egress runs through
`core/` — the round-trip seam lives in core, not a rig mirror. Observable value: the 012-01 scenario,
core-hosted, with confinement intact.
