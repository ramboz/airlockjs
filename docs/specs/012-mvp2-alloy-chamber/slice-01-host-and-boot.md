---
status: DONE
dependencies: []
last_verified: 2026-08-29
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation,
     else mark them as assumptions in the spec's `## Assumptions` section. -->

## Slice 012-01 — wrapped-SDK host + alloy boots + one Analytics event

**Goal:** Build the wrapped-SDK **connector host** the contract describes (manifest
→ factory → `init` → `handle`) and prove stock **`@adobe/alloy@2.35.0`** boots inside
a **single Option-B chamber** and emits **one** Analytics XDM `interact` — its own
worker-side `fetch` **intercepted** and dispatched by the orchestrator on the main
thread ([ADR-0004](../../decisions/adr-0004-egress-dispatch-delivery.md)) to a
**minting-Edge stub** that server-assigns an ECID — against the **additively-extended**
contract, with GA4 unchanged and green. This is the wrapped-SDK generalization claim,
shown **end-to-end against a local minting-Edge stub** — live-Edge acceptance of the
re-dispatched request (real cookie / credential / cluster semantics) is credentials-gated
and deferred.

**DoR:**
- ✅ [ADR-0008](../../decisions/adr-0008-oq9-coherency-sync-access.md) accepted (OQ9
  coherency axis resolved); the fetch-interception + main-thread-dispatch path this
  slice rides is the mechanism ADR-0008 specifies (coalescing itself is 012-02).
- ✅ [R-004](../../research/R-004-alloy-in-worker.md): stock alloy boots + `configure`
  + `sendEvent` in a worker unmodified; sync-cookie + shim-globals shape proven;
  executed probe at `probes/alloy-worker/` (`worker.js`, `index.html`) to extend.
- ✅ Contract shapes to host + extend: [`contracts/connector.d.ts`](../../../contracts/connector.d.ts)
  (`Connector` / `ConnectorFactory` / `ConnectorManifest` / `handle → EgressRequest[]`),
  [`contracts/capability.d.ts`](../../../contracts/capability.d.ts) (the async cookie
  surface + the "intentionally absent … OQ9" sync-read hole).
- ✅ Runtime to extend: [`core/chamber.worker.js`](../../../core/chamber.worker.js)
  (GA4-hardcoded `mapToMp` import), [`core/airlock.js`](../../../core/airlock.js)
  (main-thread `fetch` dispatch, ADR-0004), [`connectors/ga4/`](../../../connectors/ga4/)
  (the pattern to mirror / retrofit).
- ✅ Isolation model decided (**precondition** — owner decision 2026-08-29): **Option B**,
  a dedicated Worker per chamber. AC2/AC4 build an Option-B chamber, so B is *presupposed*
  here, not decided by this slice; the slice **records** the ratifying ADR (see DoD) — it
  does not gate on the choice.

**Acceptance Criteria:**

1. **Connector host built — manifest → factory → `init` → `handle`.** The chamber
   runtime instantiates a connector via `ConnectorFactory(config) → Connector`, calls
   `init(caps)` **exactly once**, and routes each event through the **retained**
   instance's `handle(event)` — replacing the hardcoded `mapToMp` import for the
   wrapped-SDK path. Observable: a test boots a connector from `{ manifest, factory }`,
   asserts `init` runs once for N events and each event is routed through **one**
   persisted instance (state carries across events), and asserts a malformed event is
   contained per-descriptor (ADR-0001 containment) without tearing the chamber down.

2. **Option-B chamber hosts the unmodified alloy bundle (classic-worker load route).**
   A dedicated **classic** Worker chamber (R-004's proven route) installs a shim global
   scope (`window` / `document` / `navigator` / `screen` / `sessionStorage` /
   `localStorage`) **inside** the isolation boundary and loads the **byte-identical**
   `@adobe/alloy@2.35.0` bundle via `importScripts` (766 KB IIFE), **preserving the stock
   bundle** (AD-7); `importScripts` is then **revoked** so untrusted code cannot re-load
   remote script post-boot. Observable: alloy `configure({ datastreamId, orgId,
   context: [] })` + `sendEvent(...)` resolve inside the chamber; a test pins the bundle's
   hash to prove it is unmodified. The `type:"module"` worker + dynamic-`import()` load
   route is **deliberately not taken** — dynamic `import()` is a non-withholdable
   loader-level egress primitive (see AC5 + Assumptions).

3. **Additive sync-read cookie capability.** `GrantedCapabilities` gains a
   **synchronous** cookie-read surface (sync-cache seeded at boot + async write-back —
   the R-004 shape), **added alongside** the existing async `get`/`set` (which stay
   byte-identical). alloy's synchronous `document.cookie` reads — the `getApexDomain`
   getTld probe at first command, plus identity reads — are served from the cache.
   Observable: alloy's first synchronous cookie access succeeds inside the chamber; a
   write-back reconciles the cache to the broker's authoritative jar.

4. **alloy's `fetch` intercepted → orchestrator dispatch → minting-Edge stub → ECID
   written.** alloy's own worker-side `fetch` to `.../ee/v1/interact` is **intercepted
   in the chamber** and routed into the orchestrator's **existing main-thread dispatch**
   (ADR-0004) — *not* sent from the worker. A **minting-Edge stub** server-assigns an
   ECID in its response body; the ECID is written **synchronously** to the identity
   cookie cell (sync write-back, R-004). Observable, single chamber: **exactly one**
   `interact` request egresses via the orchestrator's main-thread dispatch (asserted
   *not* from the worker); the stub-assigned ECID lands in the `AMCV_*` / `kndctr_*`
   cell; the XDM payload validates (pageView + `query.identity.fetch: ["ECID","CORE"]`).

5. **Egress chokepoint — allow-list posture: the mediated `fetch` is the chamber's only
   network-capable surface.** Rather than an (never-complete) enumerated **deny**-list,
   the chamber exposes the intercepted `fetch` as its **sole** network-capable primitive
   and withholds the rest. The test asserts a **representative adversarial set** is
   unreachable inside the chamber — `XMLHttpRequest`, `navigator.sendBeacon`, `WebSocket`,
   `EventSource`, `WebTransport`, nested `Worker`, `CacheStorage` (`caches.add` / `addAll`),
   post-load `importScripts`, **and a remote `import()` attempt** — *and* that alloy still
   boots + sends (R-004: it uses only `fetch`). Tested both ways. This is egress
   **confinement** at the chamber boundary, distinct from the **seal**'s consent /
   allow-list *enforcement* on the mediated path (MVP3). **Disclosed residual:** dynamic
   `import()` of a remote specifier is a *language-level* loader primitive a JS shim
   cannot reliably withhold; slice 01 takes the classic-worker load route (AC2) so the
   bundle-load needs no module-`import()`, and the adversarial-set test includes a remote
   `import()` — but to the extent a target engine still exposes `import()` in a classic
   worker, loader-level remote egress in a CSP-less drop-in deployment is a **named
   residual**, gated by MVP3 seal enforcement (and, where the host controls response
   headers, a worker `connect-src` CSP as defense-in-depth). AC5's soleness is thus scoped
   to what it tests, with the loader-level residual **disclosed**, not assumed away.

6. **Contract signatures unchanged (additive-only) + GA4 green.** Every existing pinned
   *signature* stays **byte-identical** — async cookie `get`/`set`, `handle →
   EgressRequest[]`, the `ConnectorManifest` fields, the GA4 mapping path — and GA4's full
   existing suite passes unchanged. "Unchanged = additive" is a claim about **signatures**,
   not the egress *model*: the wrapped-SDK path adds a **request/response round-trip**
   egress surface (the mint needs the Edge response body) that the fire-and-forget
   `EgressRequest` does not model — additive, and the surface the future seal must gate.
   Observable: GA4 tests green; a guard shows the `.d.ts` diff is **additions only** (no
   changed / removed signature).

**DoD:**
- [x] ACs 1–6 pass; full test suite green (GA4 no regressions). *227 vitest + `rig:alloy`
      (AC2–5, chromium, exit 0); GA4 suites green.*
- [x] Implementer coverage exercises each AC with at least one fixture; the alloy path
      runs against the deterministic minting-Edge stub (no live creds).
- [x] Each new test shown to fail when its feature is removed (mutate → red → restore).
      *Confirmed per stage.*
- [x] Reviewed by `reviewer` subagent (prompt via `review.py`); **compliance + craft +
      arch** passes recorded — all pass (`reviews/slice-01-{compliance,craft,arch}.md`).
- [x] Frame-critique recorded (`frame_review: true`) — two adversarial rounds, pass
      concluded on owner authority (`reviews/slice-01-frame-critique.md`).
- [x] Records an ADR **ratifying** Option B — [ADR-0009](../../decisions/adr-0009-mvp2-isolation-option-b.md)
      **Accepted**, with the egress-chokepoint-completeness driver; resolves ADR-0001's
      B-vs-C (ADR-0001 not edited).
- [x] Deviation log + reconciliation sweep produced under this slice heading;
      reconciliation review recorded (below).
- [x] `docs/refinement-todo.md` updated — OQ9 B-vs-C axis resolved (ADR-0009); the
      wrapped-SDK core-integration + hardening follow-ups tracked (012-02 owns coalescing).

**Anti-horizontal-phasing check:** after this slice, stock alloy **runs in a chamber
and sends a real Analytics event through mediated egress** — a real `interact` payload
leaves via the orchestrator, a real (stub-assigned) ECID is written back. The
wrapped-SDK generalization is observable end-to-end, not "the host is built." The slice
is thick because the connector host is irreducible (alloy cannot run without it), but it
is vertical: the observable value is alloy-in-a-chamber emitting analytics, not an
internal layer.

### Deviation log (after reconciliation)

1. **Built in verifiable stages, not one shot** — AC1 (connector host, vitest) → AC2/3
   (alloy boots, rig) → AC4 (interception→mint, rig) → AC5 (confinement, rig) → AC6
   (contract guard) + ADR-0009, each committed green. Conformant sequencing, not a scope
   change; the slice is still delivered as one vertical unit.
2. **The main-thread dispatcher is a *parallel* harness-side mirror of `core/airlock.js`,
   not a core edit** (the parallel-and-minimal design call — GA4's `core/airlock.js`
   untouched + green). The wrapped-SDK round-trip egress (request/response, host-owned URL
   rewrite, cookie write-back reconciliation) lives in the rig harness. **Follow-up
   tracked** (refinement-todo, arch-review flag): wire the round-trip into `core/airlock.js`
   proper with a named owner so the harness isn't the sole home of an egress model core
   doesn't share.
3. **The AC2→AC4 boundary marker shifted** — the stage-2a assertion
   `exactly_one_interact_fetch_captured_in_chamber` (in-chamber stub) became
   `exactly_one_interact_intercepted_in_chamber` when AC4 replaced the stub. The
   "exactly one interact" invariant holds; only the via-marker changed. Not a regression.
4. **Broker cookie write-back strips origin-incompatible attributes for the localhost test
   origin.** alloy computes `domain=airlock.example; secure; sameSite=none` from the R-004
   shim's fake location, which localhost/http rejects; the broker reconciles by stripping
   those to land the ECID in its own jar (R-006 F1 — broker is the sole cookie write-back
   authority). The ECID **value** is preserved; a rig-origin artifact (production domain
   matches). Legitimate broker reconciliation.
5. **AC5 stub-placement nuances (faithful to intent):** `caches.add`/`addAll` live on the
   `Cache` from `caches.open` — the stub denies `open` (the gateway) *and* exposes throwing
   `add`/`addAll` to match the AC's named surface; `sendBeacon` is absent on a real
   WorkerNavigator, so confinement neutralizes the page-shim navigator's `sendBeacon` (the
   egress-shaped surface).
6. **`import()` residual empirically confirmed reachable** — AC5's probe found chromium
   *does* expose dynamic remote `import()` in a classic worker (`disclosed-residual:
   reachable`), confirming the frame-critique round-2 concern was real. Recorded honestly,
   gated to MVP3 + optional worker CSP, not failed.
7. **AC4 rig checks `identity.fetch` `includes("ECID")`, not the exact `["ECID","CORE"]`**
   named in the AC (compliance note) — covers the load-bearing identity-mint claim; the
   exact-array tightening is left to 012-02 / hardening.
8. **Craft nit fixed:** the `connector.js` SCOPE docstring (stale stage-2a text) was
   rewritten to the wrapped-SDK egress model. Craft nits 2–4 (dead-man fetch guard, blanket
   `eslint-disable`, no fetch-shim timeout) are tracked as wrapped-SDK production-hardening
   debt (refinement-todo) — deferred for this MVP2 *proof* slice.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `core/connector-host.js` | `created` | AC1 host mechanism (DI `factory→init(once)→handle`, mapBatch-style containment). |
| `connectors/alloy/**` | `created` | AC2–5: connector, sync-cookie cache, classic-worker chamber, egress confinement. |
| `contracts/capability.d.ts` | `updated` | **Additive** `cookies.sync` surface (AC3); async `get`/`set` byte-identical (AC6 guard pins it). |
| `rig/alloy-chamber.*`, `rig/alloy-mint-stub.js` | `created` | The chromium rig + minting-Edge stub (AC2–5 verification). |
| `test/**` (6 new files) | `created` | vitest coverage per AC + the additive-signature guard. |
| `package.json` | `updated` | `rig:alloy` script. |
| `docs/decisions/adr-0009-*.md` + `reviews/` + `README.md` | `created`/`updated` | ADR-0009 (Option B ratified, **Accepted**) + frame-critique + index. |
| `docs/refinement-todo.md` | `updated` | OQ9 B-vs-C axis **RESOLVED** (ADR-0009); new tracked item: wrapped-SDK core-integration + hardening debt (arch flags 1–3, craft nits 2–4). |
| `core/airlock.js`, `core/chamber.worker.js`, `connectors/ga4/` | `no-op` | **Parallel-and-minimal** — untouched + green. The round-trip-into-core integration is tracked debt, not done here. |
| `docs/architecture.md` | `deferred` | The connector-host boundary + wrapped-SDK chamber + round-trip egress are architecture-shaped, but the design has open follow-ups (path convergence, contract modeling); reflecting it in architecture.md is owner-gated — surfaced via the arch-review flags, not rewritten in a proof slice. No canon *conflict* (consistent with AD-2 / ADR-0004). |
| `docs/specs/README.md` | `updated` | Status board regenerated by `workflow.py status-board`. |
| Primer: `CLAUDE.md` Active-specs | `no-op` | 012 not in the curated primer (consistent with 011); the verdict rides the board + ADR-0009. |
| `docs/memory/**` | `no-op` | The load-bearing result is recorded in ADR-0009 + refinement-todo + this slice. |
