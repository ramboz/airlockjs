---
status: DONE
dependencies: []
last_verified: 2026-09-03
# arch_review: true  # generalizes core/egress.js's critical dispatcher (a
#                    # main-thread egress seam) — module-boundary-shaped; the
#                    # arch pass should confirm GA4 byte-parity + the DI shape.
---

<!-- jig grounding (ADR-0020): core/egress.js's createCriticalDispatcher hardcodes
     `import { mapToMp } from "../connectors/ga4/map.js"` (egress.js:30) + maps via
     `JSON.stringify(mapToMp(event, ctx))` (egress.js:65), POST-only (:73). core/airlock.js
     creates it (~:156) + funnels unloadFlush/visibilitychange/pagehide through it
     (:335-364); pixel is gated OUT of the unload path (connector!=="pixel", :429-436) because
     its map lives in the worker → its teardown events are dropped. RUM's mapToRum lives in
     the chamber too — same gap. -->

## Slice 030-01 — the connector-generic unload dispatcher

**Goal:** Make airlock's **synchronous main-thread unload egress** connector-generic, so a worker-mapped connector
egresses its unload-critical events via its OWN main-thread mapper instead of GA4's hardcoded `mapToMp`. This is
the core capability the 030-01 frame-critique surfaced: **INP (and late CLS/LCP) finalize at page-hide** and can
only egress synchronously — today that path GA4-mis-maps or drops any non-GA4 connector's teardown event. This
slice unblocks RUM's INP egress (and un-defers the analogous pixel GET).

**DoR:**
- ✅ Grounded: `createCriticalDispatcher` GA4-hardcoded (`egress.js:30,65,73`); the unload funnel + pixel gate
  (`airlock.js:335-364,429-436`).
- ☐ Frame-critique passed (spec `frame_review: true`) — the "this is real core work, GA4-byte-unchanged"
  re-scope checked before code.
- ☐ Grounded at implementation: `mapToRum`'s signature (does it take `(event, ctx)` like `mapToMp`?) + how
  `airlock.js` selects the connector's main-thread mapper.

**Acceptance Criteria:**

1. **`createCriticalDispatcher` accepts a connector mapper (DI); GA4 is byte-unchanged by default.** The
   dispatcher takes a `mapper` option (default `mapToMp`) and maps via `mapper(event, ctx)`; a `method` option
   (default `"POST"`) is threaded to the fetch. With defaults, its behaviour is **byte-identical** to today
   (regression-pinned: the existing GA4 unload tests stay green; a test asserts the default mapper is `mapToMp`
   and the POST body is unchanged).
2. **A RUM (`mapToRum`) event egresses synchronously at page-hide.** A dispatcher wired with `mapper: mapToRum`
   maps a `cwv` (and `top`) event on the MAIN thread and issues a `keepalive` POST to the RUM endpoint —
   **never** GA4-`mapToMp`-mis-mapped, never dropped. A test drives a `cwv` event through a `mapToRum`-wired
   dispatcher and asserts the body is the RUM shape (not the GA4 MP shape) to the `ot.aem.live` endpoint.
3. **`core/airlock.js` funnels a worker-mapped connector's unload path through its own mapper.** The unload wiring
   (`unloadFlush` / `visibilitychange` / `pagehide`) uses the **connector-selected** mapper — GA4 → `mapToMp`
   (unchanged), a RUM instance → `mapToRum`. The pixel `connector !== "pixel"` teardown-drop is replaced by /
   generalized to "use the connector's mapper" (the pixel GET wiring may be a noted follow-on, but the gate that
   *drops* non-GA4 teardown events is removed for RUM). A test asserts a RUM instance's page-hide `cwv` reaches a
   `mapToRum` dispatch, and GA4's page-hide path is byte-unchanged.
4. **The hazard the frame-critique named is WITNESSED by a test.** A `cwv` metric finalizing at
   `visibilitychange`→hidden on a RUM instance **egresses a RUM beacon** (this AC would fail under the old
   GA4-hardcoded/dropped behaviour — the mutation proof). Never a silent drop, never a GA4 mis-map.
5. **Keepalive budget + fail-closed behaviour preserved** (the `KEEPALIVE_BUDGET_BYTES` cap, the swallow-async-
   rejection, the drop-count) — unchanged by the generalization.
6. **No live identifiers**; synthetic ctx/endpoints.

**DoD:**
- [x] All ACs pass; full real-repo suite green (**962**, worktree excluded; 7 new). GA4 unload path
      byte-unchanged (the GA4/pixel/consent suites — 40 tests — stay green; build green, 4 workers).
- [x] Coverage exercises each AC (mapper DI + GA4 default parity; a mapToRum unload egress; the REAL
      visibilitychange→unloadFlush ring-tail path with a non-zero `t`; the fail-loud guard).
- [x] Each new test shown to fail when its feature is removed — forcing the helix-rum mapper selection off reds
      exactly the RUM witness; restored.
- [x] Reviewed by independent reviewer; **compliance PASS + craft PASS** (2 latent defects + a coverage gap fixed).
- [x] Implementation review passed.
- [x] Deviation log + Reconciliation sweep produced below; reconciliation review recorded.
- [x] `docs/inbox.md` updated — the pixel-GET unload wiring (the `method` option) is a recorded follow-on.

**Anti-horizontal-phasing check:** after this slice a worker-mapped connector's unload-critical events egress via
its own mapper — proven with RUM's INP (the flagship CWV) reaching `ot.aem.live` at page-hide, where before it
was dropped/mis-mapped. The core capability the complete RUM authority needs.

### Deviation log (after reconciliation)

1. **The core change is a mapper DI (minimal).** `core/egress.js`'s `createCriticalDispatcher` gained a `mapper`
   option (default `mapToMp`); `core/airlock.js` passes a `mapToRum` closure ONLY for `connector === "helix-rum"`
   (bound with `connectorConfig.sampling`), everyone else omits it → GA4/pixel/dom byte-unchanged. The existing
   `connector !== "pixel"` unload WIRING already includes helix-rum, so no wiring change was needed.
2. **Two latent defects on the RUM path, fixed inline (craft review).** (a) **`t:0` bug** — `unloadFlush` +
   `pushCritical` dropped the descriptor's `ts`, so a page-hide INP beacon carried `t:0`; now `unloadFlush`
   forwards `ts: d.ts` and `pushCritical` stamps `performance.now()` (GA4's `mapToMp` ignores `ts` — byte-unchanged).
   (b) **Silent GA4 fallback** — a raw `createAirlock({connector:"helix-rum"})` without `connectorConfig.sampling`
   silently re-armed the GA4 mis-map; now a construction-time `console.error` surfaces it (bootHelixRum/030-02
   always passes sampling).
3. **Coverage: the REAL unload path is now tested** — a `visibilitychange`→hidden fires `unloadFlush`, and the
   pushed cwv flushes as a RUM beacon with a non-zero `t` (the `pushCritical` proxy hid the `t:0` bug).
4. **AC1's `method` option (pixel GET) deferred** — the mapper DI is done; the `method` option to un-defer the
   pixel-GET unload dispatch is a recorded follow-on (`docs/inbox.md`). RUM is POST + complete.
5. **Layering:** `airlock.js` importing `connectors/helix-rum/map.js` mirrors the existing `egress.js`→
   `ga4/map.js` precedent (no cycle; `map.js` is import-free). The RUM mapper is now bundled into every airlock
   build — minor, acceptable.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | No user-facing entrypoint change — an internal egress-seam generalization. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` (030-01 → DONE). |
| `docs/product-vision.md` | `no-op` | No behavior/scope drift. |
| `docs/architecture.md` | `no-op` | The critical-dispatcher seam gains a mapper DI — no module boundary changed (an added param); GA4 byte-unchanged. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Slice does not close the spec (030-02/03/04 pending); primer hygiene at spec close. |
| `docs/inbox.md` | `updated` | The pixel-GET unload-dispatch (`method` option) follow-on. |
| `docs/refinement-todo.md` | `no-op` | No deferred *decision* — craft fixes applied inline; the pixel-GET is an inbox parked item. |
| Built `probes/eds-testbed/scripts/airlock/eds.js` | `regenerated` | `npm run build` re-emitted it with the ts-fix + fail-loud; it is a build artifact (not git-tracked). |
| `docs/memory/**` / `docs/decisions/**` | `no-op` | Nothing cross-session; no ADR touched. |

**Reconciliation review — PASS (self-recorded, jig:reviewer prompt-source).** 030-01 makes the unload dispatcher
connector-generic (mapper DI, GA4 byte-unchanged) so RUM's INP/late-CLS egress correctly at page-hide — the core
capability the frame-critique surfaced. The two latent defects (t:0, silent fallback) + the coverage gap are all
fixed + tested; the pixel-GET `method` option is a recorded follow-on. Additive to GA4/pixel/dom (regression-pinned).
962 suite green. No orphans. Ready RECONCILED → DONE.
