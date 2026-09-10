---
status: DRAFT
dependencies: []
last_verified:
arch_review: true  # changes core/egress.js's createCriticalDispatcher module
                   # seam (a main-thread egress seam) — arch pass confirms the
                   # requestMapper DI shape + POST byte-parity, mirroring 030-01.
---

<!-- jig grounding (spec 064-02 / ADR-0020): the load-bearing claims below are
     grounded by reading core/egress.js, core/airlock.js, connectors/ga4/gtag.js,
     core/ga4-gtag-chamber.worker.js, and core/connector-host.js on 2026-09-10;
     see the parent spec's `## Assumptions` A1/A2 for the two marked residuals. -->

## Slice 042-01 — GET-critical dispatcher + ga4-gtag unload flush

**Goal:** Extend `createCriticalDispatcher` (`core/egress.js`) with a
connector-generic GET `requestMapper` path, and wire it for `ga4-gtag`, so a
gtag event still ring-resident at page-hide (or handed to `pushCritical`)
flushes as a correct `/g/collect` **GET** beacon instead of being dropped —
while the existing POST unload path (GA4-MP, helix-rum) stays byte-identical.

**DoR:**
- ✅ Grounded (parent spec § Current state): the POST-only dispatcher
  (`core/egress.js:70-88`), the steady-state GET `fetchInit`
  (`core/airlock.js:53-55,305-324`), the `workerMappedGetEgress` unload gate +
  `pushCritical` drop (`core/airlock.js:506,513-516,583-590`), the existing
  `connector === "helix-rum"` mapper-selection branch (`:188-200`), gtag's pure
  `handle` (`connectors/ga4/gtag.js`), and the chamber config threading
  (`core/ga4-gtag-chamber.worker.js`, `core/connector-host.js:70-76`).
- ☐ Frame-critique passed (`arch_review: true`) — the "the GET path is
  additive; the POST path is byte-unchanged; the unload path stays
  ceiling-bypassing by design" re-scope checked before code.
- ☐ Grounded at implementation: re-verify A1 (no chamber-side transform sits
  between the init message and `handle` for gtag); decide `fetchInit` sharing
  (move it to `core/egress.js`, imported by `core/airlock.js` — no cycle, since
  `egress.js` is imported *by* `airlock.js`) vs. a duplicated helper, preferring
  the shared, can't-drift shape.

**Acceptance Criteria:**

1. **`createCriticalDispatcher` accepts a `requestMapper` (EgressRequest[]) path;
   the POST path is byte-unchanged by default.** With no `requestMapper`, the
   dispatcher is byte-identical to today — the existing GA4/RUM unload tests
   stay green, and a regression test asserts the default POST per-tracker path
   (`mapper(event, ctx)` → `JSON.stringify` → `fetch(endpoints[t], {method:"POST",
   body, keepalive:true})`) is unchanged, including the keepalive budget +
   swallow-async-rejection + drop-count. With a `requestMapper` present,
   `dispatch(event)` calls `requestMapper(event) → EgressRequest[]` and issues
   one `fetch(req.url, initFor(req.method, req.body))` per request, reusing the
   **same** GET/POST init shape the steady-state seam uses (shared, not
   duplicated): GET → `{method:"GET", keepalive:true}` with **no** `body`; POST
   → `{method:"POST", body, keepalive:true}`. `stats()` counts
   `fastDispatched`/`fastDropped` on this path too.
2. **A GET request carries no body and consumes no keepalive body budget (A2);
   an empty result is a clean no-op.** A `requestMapper` returning
   `{url, method:"GET"}` dispatches a bodyless GET and leaves the aggregate
   keepalive counter (`bytesUsed()`) unchanged. A `requestMapper` returning `[]`
   (the pixel unmapped-event case the dispatcher must tolerate even though gtag
   never returns it) is a no-op — no fetch, no `fastDropped++`, no throw.
3. **`core/airlock.js` wires the ga4-gtag GET critical mapper and removes its
   unload gate-out.** For `connector === "ga4-gtag"` the critical dispatcher is
   constructed with `requestMapper: createGa4GtagConnector(connectorConfig).handle`
   (mirroring the `helix-rum` branch), and `ga4-gtag` is removed from the
   `workerMappedGetEgress` unload gate so it wires `visibilitychange`/`pagehide`.
   A gtag event still ring-resident at page-hide flushes via `unloadFlush` → the
   GET dispatcher → a `keepalive` GET to `/g/collect` carrying the mapped params
   (`v`/`tid`/`cid`/`sid`/`en`/…), **never** a GA4-MP POST, never dropped.
   (`workerMappedGetEgress` still gates `pixel` until 042-02.)
4. **`pushCritical` on a ga4-gtag instance maps + GETs (no longer drops).** A
   `pushCritical({event:"page_view", …})` call maps via the same GET
   `requestMapper` and issues one `/g/collect` GET — the `workerMappedGetEgress`
   `pushCritical` drop (`core/airlock.js:583-590`) is removed for gtag.
5. **The witnessed hazard (mutation proof).** A `page_view` pushed then flushed
   at a real `visibilitychange`→hidden egresses a `/g/collect` GET; this AC
   FAILS under today's gate-out (dropped, `fetch` never called) — forcing the
   gtag `requestMapper` wiring back off reds exactly this witness. Byte-parity:
   the GET URL equals the worker chamber's `handle` output for the same governed
   descriptor (A1) — asserted against `createGa4GtagConnector(cfg).handle`.
6. **Governance + consent preserved on the GET path.** `governParams` still
   strips denylisted params before the GET mapper (the shared
   `criticalDispatchGated` path); the live consent **verdict** still DROPs an
   un-granted `analytics_storage` at teardown (no hold at teardown — 017-03 AC4).
   The GA4-MP POST unload path, helix-rum's POST unload path, and the pixel
   drop-gate are all byte-unchanged (regression-pinned).
7. **No live identifiers** — synthetic `measurementId`/`ctx`/`endpoint`.

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions). The GA4-MP POST
      unload path + helix-rum POST path stay byte-unchanged.
- [ ] Coverage exercises each AC: the `requestMapper` GET dispatch + empty-result
      no-op (`egress-fastpath` unit level); the real `visibilitychange`→
      `unloadFlush` gtag ring-tail GET; the `pushCritical` GET; the consent-drop
      + governance paths; the POST default-parity regression.
- [ ] `test/ga4-gtag-seam.test.js`'s AC10 drop assertions (`registers NO
      visibilitychange/pagehide`, `dropped, not GA4-mis-mapped`, `pushCritical
      DROPS`) are FLIPPED to the GET-flush assertions; the GA4 POST regressions
      in that file stay green.
- [ ] Each new test shown to fail when its feature is removed (force the gtag
      `requestMapper` off → the witness reds; restore).
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Arch pass (`arch_review: true`) — confirms the `requestMapper` DI shape,
      POST byte-parity, and the ceiling-bypass-by-design stance.
- [ ] Implementation review passed.
- [ ] Deviation log produced under this slice heading.
- [ ] Reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated — the deferred item struck through /
      marked resolved (or narrowed to the pixel half pending 042-02); the inbox
      follow-on triaged.

### Close-out (post-DONE)

- [ ] `docs/specs/README.md` regenerated by `workflow.py status-board`.
- [ ] Primer hygiene per spec 025-01 rule: this slice does NOT close the spec
      (042-02 pending), so leave the active-spec entry; check `CLAUDE.md` /
      `AGENTS.md` for no needed change.

**Anti-horizontal-phasing check:** after this slice a gtag closing-pageview /
ring-tail event actually reaches `/g/collect` at page teardown (before: silently
dropped) — the analytics "last beacon" teardown fidelity UC-2 needs, proven with
a real `visibilitychange`→hidden flush.

### Deviation log (after reconciliation)

The original spec is preserved above. Implementation notes:

_TODO (implementer): deviations, reviewer findings folded in, doc updates._

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | _TODO: internal egress-seam generalization; no user-facing entrypoint change (confirm)._ |
| `docs/specs/README.md` | `updated` | _TODO: regenerated by `workflow.py status-board`._ |
| `docs/product-vision.md` | `no-op` | _TODO: no scope drift (UC-2 teardown fidelity, already in scope)._ |
| `docs/architecture.md` | `updated` | _TODO: the OQ16 / critical-dispatcher line — the unload path now has a GET wire shape for ga4-gtag; reconcile the "POST-only" framing._ |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | _TODO: slice does not close the spec; primer hygiene at spec close._ |
| `docs/inbox.md` | `updated` | _TODO: the 030-01 `method`-option follow-on is resolved (gtag half)._ |
| `docs/refinement-todo.md` | `updated` | _TODO: the deferred GET-critical item narrowed to pixel-only pending 042-02._ |
| `docs/memory/**` | `no-op` | _TODO: memory-sync result._ |
| `docs/decisions/README.md` / ADR index | `no-op` | _TODO: no ADR — additive DI within a resolved decision (ADR-0004 two-path model), no rejected-alternative load-bearing choice._ |
| Additional live prose / generated templates touched by this slice | `no-op` | _TODO: built adapter artifacts are regenerated by `npm run build`, not git-tracked._ |
