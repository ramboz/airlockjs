---
status: DRAFT
dependencies: [030-01]
last_verified:
# arch_review: consider — adds a connector-selection branch + a chamber worker +
#              a build entry (module-boundary-shaped); the pattern is proven (026/025).
---

<!-- jig grounding (ADR-0020): mirrors 026 core/pixel-chamber.worker.js + core/confine-pixel-chamber.js
     + the core/airlock.js connector-selection branch + build.mjs WORKER_ENTRIES; 025 dom-chamber.
     The helix-rum connector (connectors/helix-rum/) + its main-thread web-vitals capture
     (cwv-capture.js, web-vitals@^6.2.1 — a RUNTIME dependency) are DONE (spec 022). 030-01 makes
     the unload path connector-generic (mapToRum egress at page-hide). Exact signatures grounded at
     implementation (createHelixRumConnector, startCwvCapture DI seam, bootMetaPixel shape). -->

## Slice 030-02 — the production RUM authority

**Goal:** Make airlock **bootable as a COMPLETE governed RUM authority in production** — a `bootHelixRum` adapter
that emits `top`/`error`/`cwv` (all three CWV, incl. INP at page-hide via 030-01's connector-generic dispatcher),
confined to `ot.aem.live`, **not consent-gated**, off-thread-mapped. The patterned chamber-worker + adapter
addition (mirroring 026 pixel / 025 dom) plus the main-thread capture wiring.

**DoR:**
- ✅ 030-01 DONE (the connector-generic unload dispatcher — so RUM's INP egresses at page-hide).
- ✅ Spec 022 DONE (the helix-rum connector + web-vitals capture); pattern grounded (026 pixel-chamber, 025 dom).
- ☐ Frame-critique passed (spec-level; the scoped-replace honesty).
- ☐ Grounded at implementation: `createHelixRumConnector`, `cwv-capture.js`'s `startCwvCapture` DI seam (for the
  real `web-vitals/attribution`), `bootMetaPixel`'s shape, the connector's resolved `weight`.

**Acceptance Criteria:**

1. **A `helix-rum-chamber.worker.js` hosts the RUM connector, confined + build-emitted.** New
   `core/helix-rum-chamber.worker.js` first-imports `core/confine-helix-rum-chamber.js`
   (`applyEgressConfinement(self, { withholdFetch: true })`) + hosts `createHelixRumConnector`.
   `core/airlock.js`'s selection seam gains a `connector: "helix-rum"` branch; `build.mjs`'s `WORKER_ENTRIES`
   adds it (the **5th** same-origin sibling — N-worker assertion covers it). **GA4/pixel/dom byte-unchanged.**
2. **A `bootHelixRum` adapter boots the governed RUM instance, ceiling-coupled.** `adapters/eds/index.js` exports
   `bootHelixRum(doc, opts)` = `createAirlock({ connector: "helix-rum", egressPurposes: [], endpoints: [<the
   ot.aem.live/.rum/${weight} ceiling>], … })`. **Endpoint-ceiling coupling:** the main-thread ceiling MUST match
   the worker-constructed connector's resolved endpoint (incl. the resolved sampling `weight`), or every beacon
   is ceiling-held. A test asserts it constructs the RUM chamber worker with `egressPurposes: []` and a ceiling
   that matches the connector's endpoint (no self-inflicted hold).
3. **The main-thread capture is wired: `top` on load, `error` listeners, `cwv` via the REAL web-vitals — INP
   included.** `bootHelixRum` (a) `push({event:"top"})` on load; (b) error listeners → `push({event:"error",…})`;
   (c) `startCwvCapture` importing the **real** `web-vitals/attribution` (via the DONE DI seam) →
   `push({event:"cwv",…})`; a `cwv` metric finalizing at page-hide egresses via 030-01's dispatcher (RUM shape,
   not GA4). Tested via a fake metric emitter (steady-state) + a page-hide path assertion (INP egress).
4. **Governed by construction — confined + not-consent-gated + payload-hygienic.** A seam test (mirroring
   `test/helix-rum-seam.test.js` on the `bootHelixRum` instance): dispatches to `ot.aem.live` only (held if
   re-pointed), fires regardless of consent (`egressPurposes: []`), body carries no field outside the whitelists,
   no cookie capability.
5. **No live identifiers**; synthetic ids/endpoints; ephemeral per-page id; `web-vitals` is a runtime lib.

**DoD:**
- [ ] All ACs pass; full real-repo suite green (GA4/pixel/dom selection + init byte-unchanged).
- [ ] Coverage exercises each AC (chamber-select + build entry; bootHelixRum construction + ceiling coupling; the
      three-checkpoint capture incl. the page-hide INP egress; the confined/not-consent-gated seam test).
- [ ] Each new test shown to fail when its feature is removed (mutate → red → restore).
- [ ] `npm run build` emits all FIVE worker siblings (eds/chamber/pixel-chamber/dom-chamber/helix-rum-chamber).
- [ ] Reviewed by independent reviewer; compliance + craft passes.
- [ ] Implementation review passed.
- [ ] Deviation log + Reconciliation sweep produced below; reconciliation review recorded.

**Anti-horizontal-phasing check:** after this slice a page CAN boot airlock as a COMPLETE governed RUM authority
(`bootHelixRum` — top/error/cwv incl. INP at page-hide, confined, not-consent-gated) — end-to-end value.

### Deviation log (after reconciliation)

_TODO during IN_PROGRESS._

### Reconciliation sweep

_TODO during reconciliation._
