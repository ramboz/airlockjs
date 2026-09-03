---
status: DRAFT
dependencies: []
last_verified:
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
- [ ] All ACs pass; full real-repo suite green (**GA4 unload path byte-unchanged** — the existing
      `test/egress*`/teardown/critical tests stay green).
- [ ] Coverage exercises each AC (the mapper DI + GA4 default parity; a mapToRum unload egress; the airlock
      unload-funnel selecting the mapper; the page-hide-cwv-egresses witness).
- [ ] Each new test shown to fail when its feature is removed (mutate → red → restore) — incl. AC4 going red
      under the old GA4-hardcoded mapper.
- [ ] Reviewed by independent reviewer; compliance + craft passes.
- [ ] Implementation review passed.
- [ ] Deviation log + Reconciliation sweep produced below; reconciliation review recorded.
- [ ] `docs/refinement-todo.md`/`inbox` updated (e.g. the pixel-GET unload wiring, if left a follow-on).

**Anti-horizontal-phasing check:** after this slice a worker-mapped connector's unload-critical events egress via
its own mapper — proven with RUM's INP (the flagship CWV) reaching `ot.aem.live` at page-hide, where before it
was dropped/mis-mapped. The core capability the complete RUM authority needs.

### Deviation log (after reconciliation)

_TODO during IN_PROGRESS._

### Reconciliation sweep

_TODO during reconciliation._
