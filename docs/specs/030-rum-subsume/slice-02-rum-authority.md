---
status: DONE
dependencies: [030-01]
last_verified: 2026-09-03
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
- ✅ Frame-critique passed (spec-level; the scoped-replace honesty).
- ✅ Grounded at implementation: `createHelixRumConnector` (id/isSelected overrides), `cwv-capture.js`'s
  `startCwvCapture` DI seam (real `web-vitals/attribution`), `bootMetaPixel`'s `(opts)` shape, `resolveWeight`.

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
- [x] All ACs pass; full real-repo suite green (GA4/pixel/dom selection + init byte-unchanged).
- [x] Coverage exercises each AC (chamber-select + build entry; bootHelixRum construction + ceiling coupling; the
      three-checkpoint capture incl. the page-hide INP egress; the confined/not-consent-gated seam test).
- [x] Each new test shown to fail when its feature is removed (mutate → red → restore).
- [x] `npm run build` emits all FIVE worker siblings (eds/chamber/pixel-chamber/dom-chamber/helix-rum-chamber).
- [x] Reviewed by independent reviewer; compliance + craft passes (NEEDS-CHANGES → coverage gaps closed, re-passed).
- [x] Implementation review passed.
- [x] Deviation log + Reconciliation sweep produced below; reconciliation review recorded.

**Anti-horizontal-phasing check:** after this slice a page CAN boot airlock as a COMPLETE governed RUM authority
(`bootHelixRum` — top/error/cwv incl. INP at page-hide, confined, not-consent-gated) — end-to-end value.

### Deviation log (after reconciliation)

- **Adapter signature — `bootHelixRum(opts)`, not AC2's `bootHelixRum(doc, opts)`.** Implemented as
  `bootHelixRum(opts = {})` (no positional `doc`), matching **every** sibling boot adapter —
  `bootMetaPixel(opts = {})`, `bootLinkedInInsight(opts = {})`, `bootEdsAnalytics(opts = {})` are all
  opts-only. `referer` is sourced from `document.referrer` with an `opts.referer` override; the error
  listeners use the global `addEventListener` (guarded by `typeof addEventListener === "function"`).
  Codebase-consistency was chosen over the spec's loose `(doc, opts)` phrasing. (Reviewer-flagged
  footgun — a caller passing `bootHelixRum(document, opts)` would treat `document` as `opts` — is
  mitigated by the established sibling convention; no caller in the tree uses a positional doc.)
- **bootHelixRum-level coverage lives in `test/eds-helix-rum.test.js`,** not a new
  `test/helix-rum-seam.test.js` (AC4's phrasing). One file covers ACs 1–5 at the adapter boundary; the
  connector/core seam properties stay owned by the DONE 022 `test/helix-rum-seam.test.js` (see sweep).

### Reconciliation sweep

- **All 5 ACs met; 82/82 regression green** (`eds-helix-rum` + `rum-unload-dispatcher` + `eds-boot` +
  `eds-meta-pixel` + `pixel-seam` + `helix-rum-seam` + `egress-confinement`); `npm run build` emits all
  **five** same-origin worker siblings (`all_workers_are_same_origin_file_urls: true`). GA4/pixel/dom
  selection + init verified byte-unchanged (additive-only shared-file diffs).
- **Each new test shown non-vacuous (mutate → red → restore):** chamber-selection string
  (`helix-rum-chamber` → `chamber`) reddens AC1; `egressPurposes:[]` → `["analytics"]` reddens AC3/AC4;
  ceiling decoupling (`.rum/100` → `.rum/999`) reddens the AC2 coupling test.
- **Implementation review: NEEDS-CHANGES → addressed.** The reviewer confirmed the implementation
  correct and additive but flagged that AC2's ceiling-coupling and AC4's held-if-re-pointed were
  asserted only structurally, never driven through the `bootHelixRum` instance. Closed by two new
  steady-state tests that post a real `{ready}` envelope into the airlock: the connector's own
  `rumUrl(base,weight)` endpoint is **admitted** by the host ceiling (coupling holds — no self-inflicted
  hold; and, sent with no `setConsent`, this doubles as the `egressPurposes:[]` proof), and a re-pointed
  beacon is **held at the seal** (the chamber cannot self-widen egress).
- **Coverage boundary (disclosed, bounded).** AC4's remaining clauses — body carries no field outside
  the whitelists, no cookie capability — are **inherited structurally** from the DONE 022
  `test/helix-rum-seam.test.js`, which proves them field-by-field against the identical
  `createHelixRumConnector`. `bootHelixRum` adds **no** payload shaping and wires **no** capability, so
  those properties transfer by construction rather than being re-exercised through the adapter.
- **Design fact — the unload/critical path bypasses the endpoint ceiling (intentional).** 030-01's
  `createCriticalDispatcher` (`core/egress.js`) POSTs to the host-declared `endpoints[t]` directly; it
  does **not** run `checkEndpointCeiling`. So RUM's **page-hide** beacon confinement rests on
  `bootHelixRum`'s host-declared `endpoints:[endpoint]` being correct (it is — byte-matched to the
  connector's `rumUrl(base,weight)`), **not** on a seal check. The seal/ceiling governs only the
  steady-state worker-mapped path (the new AC2/AC4 tests). This matches GA4's existing critical path;
  noted so a future reader does not assume the unload beacon is ceiling-checked.
- **Follow-on (→ inbox): no boot adapter forwards `onDiagnostic`.** GA4/pixel/linkedin/helix-rum all
  omit an `opts.onDiagnostic` pass-through to `createAirlock`, so the spec-028 inspector cannot observe
  held/stripped beacons from a **production-booted** instance. Cross-cutting across all adapters — logged
  to `docs/inbox.md` as a follow-on, not a 030-02 fix.
