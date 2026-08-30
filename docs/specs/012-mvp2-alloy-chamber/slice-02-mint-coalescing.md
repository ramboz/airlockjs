---
status: DONE
dependencies: [012-01]
last_verified: 2026-08-29
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 012-02 — concurrent-chamber mint coalescing (lift ADR-0008's hold)

**Goal:** With the wrapped-SDK host + intercepted egress from 012-01, drive **two
concurrent chambers** both first-minting identity, and build
[ADR-0008](../../decisions/adr-0008-oq9-coherency-sync-access.md)'s **broker-side async
request coalescing + XDM mint-recognition** so both chambers attach **one** ECID, not
two — retiring the concurrent-first-mint **split-identity fault** for the async mint,
demonstrated against the minting-Edge stub. This turns ADR-0008's *analytical* GO into
a *demonstrated* one and **lifts the freeze _hold_** on the wrapped-SDK identity path.
(Distinct from *freezing* the contract: ADR-0008's kill-criterion still requires a
creds-gated **live-Alloy** mint-recognition re-probe before the step-5 freeze — 012-02
demonstrates the mechanism, it does **not** authorize the freeze.) 012-02 builds the
**intercept-and-coalesce** path, **choosing it over** ADR-0008's flagged
host-seeded-identity alternative (host supplies the ECID pre-boot so the vendor never
mints) — consistent with the ADR's recommended decision; the alternative is noted, not
built.

**DoR:**
- ✅ 012-01 DONE — the wrapped-SDK host, the chamber, the additive sync-cookie
  capability, and alloy's `fetch` intercepted into the orchestrator's main-thread
  dispatch all exist and are proven for a single chamber.
- ✅ ADR-0008 records the mechanism to build: broker-side async request coalescing
  (single-threaded broker holds the second concurrent mint, returns the first's ECID),
  conditional on (i) fetch-interception into the orchestrator's dispatch — delivered by
  012-01 — and (ii) XDM mint-recognizability — built here. Kill-criteria (ADR-0008):
  the XDM must be reliably parseable to recognize the mint.
- ✅ [spec 011](../011-mvp2-coherency-probe/spec.md) rig/model as the measurement
  reference (`rig/coherency-model.mjs`, `rig/coherency.mjs`) — the abstract mint
  model this slice makes concrete for real alloy chambers.

**Acceptance Criteria:**

1. **Baseline fault reproduced (no coalescing).** Two chambers both read an empty
   identity and both first-mint → **two** intercepted `interact` requests → **two**
   distinct ECIDs → split identity. Observable, deterministic: the detector reports the
   fault for the two-chamber concurrent case with coalescing off.

2. **Broker-side async request coalescing built.** The broker registers a mint
   **synchronously** in an in-flight-mint table — inside the `intercepted-fetch` handler,
   **before** awaiting the real dispatch (the load-bearing invariant: main is
   single-threaded, so a concurrently-arriving second handler always sees the first
   already registered). A second identity-mint `interact` is then suppressed in **both**
   windows: (a) arriving **while the first is in flight** → **held**, and on the first's
   response receives the **one** server-assigned ECID; (b) arriving **after the first
   completes but before the second chamber has minted** (a late B) → **suppressed** via a
   retained **completed-mint association**, not re-dispatched. Either way: **no** second
   Edge request. Observable: **exactly one** `interact` egresses for two concurrent
   chambers; both attach the **same** ECID; the detector reports **no** fault.

3. **XDM mint-recognition.** The broker parses the vendor XDM `interact` to recognize an
   **identity mint** (`query.identity.fetch` of ECID) as coalescable, distinguishing it
   from a non-mint `interact`. Observable: a non-mint `interact` is **not** coalesced
   (passes straight through); two concurrent **mints** are coalesced to one.

4. **No SAB / async-only.** The coalescing uses only the broker's single-threaded
   serialization + an async hold — **no SharedArrayBuffer, no COOP/COEP** (AD-4). It
   rides the Option-B two-Worker topology from 012-01 and is model-independent (the
   coalescing point is the broker), per ADR-0008. Observable: no `SharedArrayBuffer`
   reference on the path; the mechanism works with two independent dedicated-Worker
   chambers.

5. **Detector fails both ways, reproducibly.** Coalescing **off** → split-identity
   fault; coalescing **on** → one ECID, no fault. Determinism comes from
   **response-timing control** — the minting-Edge stub is **gate-able**, holding the
   first mint's response until the second chamber's mint has arrived at the broker, so
   the in-flight window is **constructed**, not raced-for. This is *deterministic
   construction* of the fault + fix (what a real two-Worker chromium rig can do and 011's
   op-model could not), not measuring a flaky emergent race. Both outcomes are retrievable
   programmatically (stub — no live creds).

6. **Freeze _hold_ lifted (not the freeze itself); kill-criteria checked.** Record that
   ADR-0008's mechanism is now **built + demonstrated**, lifting the *hold* on the
   wrapped-SDK identity path — but **not** authorizing the step-5 contract freeze, which
   still awaits the creds-gated **live-Alloy** mint-recognition re-probe (ADR-0008
   kill-criterion). Explicitly check ADR-0008's kill-criteria against the *stub* XDM and
   flag the residual: the **live-Alloy** XDM shape is not re-verified here (creds-gated),
   so mint-recognizability against real Alloy is a carried-forward validation, not a
   closed one. Update `docs/refinement-todo.md` OQ9 accordingly.

**DoD:**
- [x] ACs 1–6 pass; full suite green (012-01 path + GA4 no regressions). *250 vitest +
      `rig:alloy-coalescing` (AC1–6, chromium, deterministic ×3); `rig:alloy` (012-01)
      still green.*
- [x] Each new test shown to fail when its feature is removed *(register-after-await →
      red; coalescing off → fault; reject-path removed → held awaiter times out).*
- [x] Reviewed by `reviewer` subagent; **compliance + craft + arch** recorded — all pass
      (`reviews/slice-02-{compliance,craft,arch}.md`). *Compliance + craft first-pass
      needs-changes both addressed (OQ9 update; reject-path fix).*
- [x] Frame-critique recorded (1 round + four tightenings applied)
      (`reviews/slice-02-frame-critique.md`).
- [x] Deviation log + reconciliation sweep produced (below); reconciliation review
      recorded.
- [x] `docs/refinement-todo.md` OQ9 updated: mechanism **demonstrated** → wrapped-SDK
      freeze **hold** lifted (not the freeze); live-Alloy mint-recognition carried forward.

**Anti-horizontal-phasing check:** after this slice, **two alloy chambers share one
identity** — the split-identity fault ADR-0008 identified is demonstrably retired by the
built mechanism, and the contract-freeze hold is lifted on evidence, not argument.
Observable value: coherent identity across chambers, shown.

### Deviation log (after reconciliation)

1. **A new rig (`rig/alloy-coalescing.*`), not an extension of 012-01's `rig:alloy`** —
   keeps 012-01's single-chamber rig green + separate; **reuses**
   `connectors/alloy/alloy-chamber.worker.js` for both chambers. Conformant.
2. **`extractEcidFromInteractResponse` relocated** into the browser-safe
   `rig/alloy-xdm-mint.js`, **re-exported** from `rig/alloy-mint-stub.js` (the in-browser
   broker cannot import `node:crypto`). 012-01's rig + `test/alloy-mint-stub.test.js` stay
   green via the re-export.
3. **Mint accounting counts identity-mint interacts** (broker `mintKey` + `recognizeInteract`
   on the stub request body), not raw stub calls — because AC3's non-mint probe also hits
   the always-minting stub. Documented in the rig.
4. **Both suppression windows covered:** window (a) in-flight-hold is constructed in the
   browser rig via the gate-able stub; window (b) late-suppression (completed-mint
   association) is demonstrated hermetically in the broker unit test.
5. **Reject-path fix applied during review (craft + arch blocker/flag):** the in-flight
   hold was resolve-only, so a first-mint dispatch **rejection** (real Edge 5xx/network)
   would strand held awaiters. Fixed — the in-flight promise now carries `reject`; a `catch`
   settles held awaiters and re-throws to the first caller; `completed` populated only on
   success (self-heal). Tested with a bounded timeout (a regression hangs the test, not the
   suite). Not a scope change — a liveness fix. **Core-port carry-forward** tracked
   (refinement-todo (e)).
6. **Craft deviation-log nits (non-blocking):** `extractEcidFromInteractResponse` can return
   `undefined` rather than the documented `null` on an ECID entry lacking `id`;
   `releaseAll()` / `pendingReleaseCount()` are unused by rig/tests; `ecidOf` re-parses the
   response body per call. Minor cleanup, not blocking a proof rig.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `rig/alloy-coalescing-broker.js`, `rig/alloy-xdm-mint.js` | `created` | The pure coalescing broker (in-flight table + completed-mint association, sync-register invariant, reject path) + XDM mint-recognition. |
| `rig/alloy-coalescing.mjs`, `rig/alloy-coalescing-harness.html` | `created` | The two-chamber chromium rig (22 assertions, deterministic ×3) + gate coordination. |
| `rig/alloy-mint-stub.js` | `updated` | `createGatedMintStub` (AC5 response-timing control) + re-export the relocated ECID parse (keeps 012-01 green). |
| `test/alloy-{coalescing-broker,xdm-mint,gated-mint-stub}.test.js` | `created` | Pure-unit coverage (incl. the sync-register invariant + the reject-path failure-mode test). |
| `package.json` | `updated` | `rig:alloy-coalescing` script. |
| `docs/refinement-todo.md` | `updated` | OQ9: 012-02 **demonstrated** the coalescing → freeze **hold** lifted (not the freeze); live-Alloy re-probe carried forward; tracked-debt (e) reject-path fixed-in-rig + core-port carry-forward. |
| `core/**`, `connectors/ga4/`, `connectors/alloy/*` (worker/connector/cache/confinement) | `no-op` | **Parallel-and-minimal** — untouched + green (`rig:alloy` (012-01) + GA4 still pass). The broker lives in the rig harness/host, parallel to core. |
| `docs/architecture.md` | `deferred` | Same as 012-01 — the coalescing broker seam is arch-shaped, but tracked (refinement-todo (a)) not applied in a proof slice; no canon conflict. |
| `docs/specs/README.md` | `updated` | Status board regenerated. |
| Primer: `CLAUDE.md` Active-specs | `no-op` | Consistent with 011 / 012-01. |
| `docs/memory/**` | `no-op` | Recorded in OQ9 + this slice + the commit. |
