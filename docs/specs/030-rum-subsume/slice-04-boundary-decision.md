---
status: DONE
dependencies: [030-02, 030-03]
last_verified: 2026-09-03
---

## Slice 030-04 — the scoped-replace boundary + the decision landed

**Goal:** Land the MVP4 helix-rum **feed/replace/coexist** decision as **replace (core checkpoints)** and
document the **honest adoption boundary** — what "airlock replaces your RUM tag" covers vs what it does not — so
an integrator (and the release plans) have a clear, honest contract. Closes spec 030.

**DoR:**
- ✅ 030-02 + 030-03 DONE (the governed RUM authority + the demonstrated replace exist).
- ✅ Grounded: the decision home is `docs/decisions/lightweight-decisions.md` (lightweight, per the RUM lineage:
  2026-08-31 governance-class, 2026-09-01 web-vitals-superset + governance-exemplar). The connector has **no**
  README — `connectors/helix-rum/README.md` is the natural adopter-facing doc. The MVP4 item is named in
  `docs/releases/mvp4.md` (cutline + release-check) + `docs/releases/mvp5.md`; the parked precedent is
  `docs/inbox.md` R-007 "airlock-as-RUM-layer".

**Acceptance Criteria:**

1. **The decision is landed** as a new dated entry in `docs/decisions/lightweight-decisions.md`: airlock
   **replaces** the RUM tag for the **core checkpoints** (`top`/`error`/`cwv`) where a deployment wants one
   governed off-thread authority; **feed**/**coexist** remain available options; this resolves the MVP4 open
   feed/replace/coexist item. Builds on (does not supersede) the 2026-09-01 "governance exemplar" decision.
2. **The honest boundary is documented** in a new `connectors/helix-rum/README.md` (adopter-facing): "replace"
   covers `top`/`error`/`cwv`; it does **NOT** reproduce the enhancer's interaction/lifecycle checkpoints
   (`click`/`viewblock`/`enter`/`leave`/`navigate`/`formsubmit`/… → the future worker-dom compat layer or a
   community connector); a deployment needing those keeps `sampleRUM` (coexist) or waits.
3. **The creds-gated live gate is named** in both the decision + the README — a real production cutover must
   first confirm the live `ot.aem.live` collector accepts airlock's `cwv` **superset** shape (the attribution
   build's extra fields — never verified live). Recorded as a hard, named deferral; the in-repo demonstration
   (030-03's rig, `ot.aem.live` network-stubbed) is explicitly distinguished from a real cutover.
4. **The integrator drop-in path** is documented in the README: how to switch a page from inline `sampleRUM` to
   `bootHelixRum` (the `?rum=airlock` / `window.__airlockOwnsRum` neutralization seam 030-03 built, + the
   `bootHelixRum` boot), incl. the sampling-parity note (main-thread-minted `{weight,id,isSelected}`).
5. **Primer hygiene on spec close:** mark the MVP4 feed/replace/coexist item **resolved** in `docs/releases/mvp4.md`
   + `docs/releases/mvp5.md` (point them at the landed decision); mark the `docs/inbox.md` R-007
   "airlock-as-RUM-layer" parked decision resolved; the spec-030 close is reflected on the status board.

**DoD:**
- [x] AC1 decision entry landed; AC2 `connectors/helix-rum/README.md` created (honest boundary + live gate + drop-in).
- [x] AC3 creds-gated live gate named in BOTH the decision + the README; in-repo demo vs real cutover distinguished.
- [x] AC5 primer hygiene applied (mvp4 + mvp5 release plans + inbox R-007 item + status board flipped at close).
- [x] Reviewed by independent reviewer; compliance passes (honesty of the boundary/contract is the gate; PASS — drop-in verified byte-accurate). Implementation review passed.
- [x] Deviation log + Reconciliation sweep produced below; reconciliation review recorded. **Closes spec 030.**

_Docs-only slice: no code/test/build gates (nothing executable). The review gate is the honesty of the contract._

### Deviation log (after reconciliation)

- **The README drop-in snippets deliberately simplify the testbed's real boot.** They show
  `import('./airlock/eds.js')` + `bootHelixRum()` (the production shape), where the testbed uses
  `import('${window.hlx.codeBasePath}/scripts/airlock/eds.js')` + `bootHelixRum({ forceSelect: true })`. This is
  an intentional production-vs-testbed simplification, disclosed in-text (the README's drop-in + sampling-parity
  notes call out `forceSelect` as testbed-only) — not an inaccuracy. The reviewer verified the underlying
  mechanism (the `sendPing` guard, the `window.__airlockOwnsRum` flag, the `bootHelixRum` signature) byte-accurate
  against `aem.js`, `index.html`, and `adapters/eds/index.js`.
- **The "Decisions of record" links target the decisions log at file level (no `#anchors`).** The four pointers in
  the README header land at `lightweight-decisions.md` (the log), not each specific dated entry. Deliberate — the
  log is the canonical destination and its entries are dated + findable; GitHub heading-slug anchors for long dated
  titles are fragile. Low/optional (reviewer-noted).

### Reconciliation sweep

- **All 5 ACs met.** AC1 — the decision is landed in `docs/decisions/lightweight-decisions.md` (2026-09-03
  "helix-rum adoption: replace (core checkpoints)"), **building on, not superseding,** the 2026-09-01 governance
  exemplar. AC2 — `connectors/helix-rum/README.md` created: the honest boundary (replace covers `top`/`error`/`cwv`;
  NOT the interaction/lifecycle set) is a prominent top-level section, not buried. AC3 — the creds-gated live gate
  ("never verified live"; the 030-03 rig network-**stubs** `ot.aem.live`) is named in BOTH the decision and the
  README's "before a real cutover" section, with the in-repo demo explicitly distinguished from a live cutover.
  AC4 — the `sampleRUM` → `bootHelixRum` drop-in path is documented and reviewer-verified byte-accurate. AC5 —
  primer hygiene applied: `docs/releases/mvp5.md` (bullet + JIG row), `docs/releases/mvp4.md` (forward-pointer),
  `docs/inbox.md` (R-007 "airlock-as-RUM-layer" struck through + resolved), and the status board flipped to DONE
  at close (the transient board-lags-release-plans inconsistency the review flagged resolves at the DONE transition).
- **Honesty gate (the review):** independent implementation review **PASS** — the decision lands "replace" without
  overselling ("page-side demonstrated, not live-verified"), the boundary is prominent, the live gate is a hard
  named deferral. The one clarification the review surfaced (distinguish this **core-checkpoint** page-side replace
  from the deferred **full-parity** page-side cutover 022-03/05) is folded into the decision's Scope, so a future
  reader cannot misread "replace" as reactivating the deferred full-parity work.
- **Docs-only slice:** no code / test / build gates (nothing executable). Zero source changes — the unit suite,
  build, and rigs are definitionally unaffected.
- **Spec 030 CLOSED.** All four slices DONE (030-01 unload dispatcher; 030-02 the RUM authority; 030-03 the
  page-side replace; 030-04 the boundary + decision). The MVP4 feed/replace/coexist open item is resolved.

**Anti-horizontal-phasing check:** after this slice an integrator has an honest, bounded "airlock replaces your
RUM tag" contract — the core checkpoints covered, the interaction/lifecycle set + the live wire-shape honestly
deferred. Closes spec 030 / resolves the MVP4 feed-replace-coexist decision.
