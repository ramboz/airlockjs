---
status: DRAFT
dependencies: []
last_verified:
# arch_review: consider — adds a connector-selection branch + a chamber worker +
#              a build entry (module-boundary-shaped). Flip on if the review wants
#              the arch pass; the pattern is proven (026 pixel, 025 dom).
---

<!-- jig grounding (ADR-0020): mirrors the PROVEN pattern — 026's core/pixel-chamber.worker.js
     + core/confine-pixel-chamber.js + the core/airlock.js connector-selection branch +
     build.mjs WORKER_ENTRIES; 025's core/dom-chamber.worker.js. The helix-rum connector
     (connectors/helix-rum/) + its main-thread web-vitals capture (cwv-capture.js) are DONE
     (spec 022). Exact signatures grounded at implementation (createHelixRumConnector,
     startCwvCapture's DI seam, bootMetaPixel's shape). -->

## Slice 030-01 — the production RUM authority

**Goal:** Make airlock **bootable as a governed RUM emitter in production** — a `bootHelixRum` adapter instance
that emits the core `top`/`error`/`cwv` checkpoints (already reproduced + governed by spec 022), confined to
`ot.aem.live`, **not consent-gated**, off-thread-mapped. This is the patterned chamber-worker addition (mirroring
026's pixel-chamber / 025's dom-chamber), plus the main-thread capture wiring the DONE 022 slices left as
one-call-site changes.

**DoR:**
- ✅ Spec 022 DONE (the helix-rum connector emits `top`/`error`/`cwv`, governed + tested at the seam).
- ✅ Pattern grounded: 026 pixel-chamber + connector-selection + build entry; 025 dom-chamber; the
  `confine-*-chamber.js` first-import; `bootMetaPixel`/`bootBingUet` adapter shape.
- ☐ Frame-critique passed (spec `frame_review: true`) — the scoped-replace honesty checked before code.
- ☐ Exact signatures grounded at implementation: `createHelixRumConnector` (what the chamber hosts),
  `cwv-capture.js`'s `startCwvCapture` DI seam (for the real `web-vitals/attribution`), `bootMetaPixel`'s shape.

**Acceptance Criteria:**

1. **A `helix-rum-chamber.worker.js` hosts the RUM connector, confined + build-emitted.** A new
   `core/helix-rum-chamber.worker.js` first-imports `core/confine-helix-rum-chamber.js`
   (`applyEgressConfinement(self, { withholdFetch: true })`, mirroring `confine-pixel-chamber.js`) and hosts
   `createHelixRumConnector`. `core/airlock.js`'s connector-selection seam gains a `connector: "helix-rum"` branch
   (constructs `./helix-rum-chamber.worker.js`); `build.mjs`'s `WORKER_ENTRIES` adds it (the 5th same-origin
   sibling — the N-worker assertion covers it). **GA4 / pixel / dom byte-unchanged** (regression-pinned: worker
   URL + init message + selection).
2. **A `bootHelixRum` adapter boots the governed RUM instance.** `adapters/eds/index.js` exports
   `bootHelixRum(doc, opts)` = `createAirlock({ connector: "helix-rum", egressPurposes: [], endpoints: [<ot.aem.live
   ceiling>], … })` (mirroring `bootMetaPixel`); returns the handle. A test asserts it constructs the RUM chamber
   worker (not GA4/pixel/dom) with `egressPurposes: []`.
3. **The main-thread capture is wired: `top` on load, `error` listeners, `cwv` via the REAL web-vitals.**
   `bootHelixRum` (a) `push({ event: "top" })` on load; (b) registers the error listeners → `push({ event:
   "error", … })`; (c) wires `startCwvCapture` importing the **real** `web-vitals/attribution` (via the DONE DI
   seam) → `push({ event: "cwv", … })` per finalized metric. Tested with a **fake metric emitter** through the DI
   seam (no browser) — asserting each checkpoint reaches the airlock's push surface.
4. **Governed by construction — confined + not-consent-gated + payload-hygienic.** A seam test (mirroring
   `test/helix-rum-seam.test.js` against the `bootHelixRum` instance / connector): a beacon dispatches to
   `ot.aem.live` only (held if re-pointed off it), **fires regardless of consent** (`egressPurposes: []`), and the
   body carries no field outside the whitelists. No cookie capability requested.
5. **No live identifiers.** Synthetic ids/endpoints in tests; the ephemeral per-page id is `crypto.randomUUID`-based
   (no persistent/cross-site id); the real `web-vitals` import is a devDep/runtime lib, not an identifier.

**DoD:**
- [ ] All ACs pass; full real-repo suite green (no regression — GA4/pixel/dom selection + init byte-unchanged).
- [ ] Coverage exercises each AC (chamber-select + build entry; bootHelixRum construction; the three-checkpoint
      capture via the DI seam; the confined/not-consent-gated seam test).
- [ ] Each new test shown to fail when its feature is removed (mutate → red → restore).
- [ ] `npm run build` emits all FIVE worker siblings (eds/chamber/pixel-chamber/dom-chamber/helix-rum-chamber).
- [ ] Reviewed by independent reviewer; compliance + craft passes.
- [ ] Implementation review passed.
- [ ] Deviation log + Reconciliation sweep produced below; reconciliation review recorded.
- [ ] `docs/refinement-todo.md`/`inbox` updated if any decisions were deferred.

**Anti-horizontal-phasing check:** after this slice a page CAN boot airlock as its governed RUM authority
(`bootHelixRum` — top/error/cwv, confined, not-consent-gated) — end-to-end value, not internal plumbing.

### Deviation log (after reconciliation)

_TODO during IN_PROGRESS._

### Reconciliation sweep

_TODO during reconciliation._
