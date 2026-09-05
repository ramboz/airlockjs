---
status: DRAFT
dependencies: []
last_verified:
arch_review: true  # freezing the public surface IS an architectural commitment (what adopters may rely on at 1.0).
frame_review: true  # the frozen/experimental boundary + the three open rulings (accepts/reconcile/read-namespacing) are load-bearing 1.0 commitments.
---

<!-- jig self-defining vocabulary (soft, forward-only); jig grounding (064-02/ADR-0020): probe/cite or mark assumptions. -->

## Slice 037-01 — the capstone 1.0-API-pin ADR + contract-stability enforcement

**Goal:** land the 1.0 API pin — a **capstone ADR** recording exactly what is frozen at 1.0 (and what is explicitly
NOT), and **contract-stability guards** enforcing the frozen surfaces that are not yet guarded — so a future edit that
breaks the 1.0 contract fails a test, and an adopter knows precisely what they may rely on. **No release cut** (owner
decision: 037 pins the API; the v1.0.0 version-bump/tag/dist is a separate later step).

**DoR:**
- ✅ Grounded (read 2026-09-05, per the spec's Assumptions): the frozen-five framing (`docs/architecture.md` ~:57-69 +
  the config carve-out); the boot/handle surface (`adapters/eds/index.js` — `boot`/`bootEdsAnalytics`/`installOnWindow`,
  the two window.airlock handle shapes); `push()`→void (`contracts/push-api.md`); what `test/contract-stability.test.js`
  already guards (`capability.d.ts` + `connector.d.ts` text only — `seams.d.ts` + the boot/handle shape are NOT guarded);
  the config schema's PRE-1.0 self-declaration; the three open rulings' sources (refinement-todo:547-549 accepts,
  ~:94 iii reconcile, :462-466 read-namespacing/sampled).

**Design focus (the frame-critique + arch review ratify the 1.0 commitments — NOT asserted here):**
- **`composite.accepts(name)` — INTERNAL (proposed).** Keep it off the frozen 1.0 handle contract. The lean is
  *physical removal* from the installed `window.airlock` (bind the alloy exposure reporter's ref to a local/internal
  predicate over the composite's connectors, not the public handle), so the frozen handle is exactly
  `{ push, pushCritical, setConsent, getState, flushNow, stats, dispose }`. The alternative (keep the method, document
  it "not 1.0, may change") is lower-churn but leaves an unfrozen method reachable on `window.airlock`. Frame-critique
  + arch pick; a 1.0 freeze is the moment to shrink the public surface, so removal is the lean.
- **The 035 `reconcile`/`grantedCookieNames` coupling — reconcile stays HOST-INTERNAL + unfrozen (proposed).**
  `caps.cookies.reconcile` is host-wired, not connector-granted, so the 1.0 pin freezes the *connector-facing* grant
  surface and leaves reconcile (+ its scope coupling, 035 arch #1) host-internal — no fail-open contract ships. Ratify.
- **Composite read-namespacing / `sampled` — NOT frozen (proposed);** rides the experimental config/handle carve-out
  (refinement-todo:462-466). Ratify.
- **Enforcement shape.** `test/contract-stability.test.js` is today a literal-substring guard over `capability.d.ts` +
  `connector.d.ts`. Ratify whether the net-new guards follow that shape (substring-pin `seams.d.ts`; a
  boot/handle-shape assertion — the installed handle's method set — via a runtime shape test or a doc-pin) and where
  the push-api void contract is pinned (it is behaviorally in `test/push-contract.test.js`; the freeze may add a
  handle-shape assertion). Keep it additive (the existing guards unchanged).

**Acceptance Criteria (ratified at the frame-critique + arch review):**

1. **The capstone ADR** (authored + accepted via `adr-workflow`) records the 1.0 contract: the FROZEN surface (the five
   documented contract surfaces — GA4-MP, push-api, `connector.d.ts`, `capability.d.ts`, `seams.d.ts` — plus the adopter
   boot layer: `bootEdsAnalytics()` + `boot(config)` and the installed handle shape), the EXPERIMENTAL carve-out (the
   instrumentation-config schema + the per-connector handle variance + `composite.accepts` + host-internal `reconcile`),
   and the three rulings (accepts internal, reconcile host-internal, read-namespacing/`sampled` unfrozen). References —
   not re-litigates — ADRs 0002/0003/0004/0006/0007/0010/0016.
2. **Contract-stability guards for the net-new frozen surfaces**, added to `test/contract-stability.test.js` (additive;
   the existing `capability.d.ts`/`connector.d.ts` pins unchanged): `seams.d.ts` (the `DecisionSourceDriver`/`EgressDriver`
   + their request/result type text), and the **adopter boot/handle shape** (the two `window.airlock`-installing
   entrypoints and the frozen handle method set). The `push()`/`pushCritical()`→void contract is pinned (behaviorally in
   `test/push-contract.test.js`, + a handle-shape assertion if ratified).
3. **`composite.accepts` resolved per the ruling.** If physical removal: the installed `window.airlock` handle no longer
   exposes `accepts`, the alloy exposure reporter routes through an internal predicate, and a test asserts `accepts` is
   NOT on the installed handle (while the alloy-only-exposure drop+diagnose behavior from 034-03 stays green). If
   document-only: a pin/note records it unfrozen. Either way the frozen handle contract excludes `accepts`.
4. **The experimental config carve-out is explicit + unguarded.** `contracts/instrumentation-config.schema.json` keeps
   its "PRE-1.0, NOT frozen" self-declaration; NO contract-stability guard freezes the config schema; the ADR +
   `docs/architecture.md` name it explicitly not-1.0. (`contracts/validate.mjs`'s data-shape fixture check on the config
   is fine — that is conformance, not a frozen-surface commitment.)
5. **Docs reconciled.** `docs/architecture.md`'s five-surfaces section references the accepted capstone ADR (the frozen
   set is now enforced); `docs/releases/mvp6.md`'s 1.0-pin item is marked shipped (API pinned; release cut deferred);
   `docs/refinement-todo.md` closes the `composite.accepts` flag (:547-549), the 032 read-namespacing/`sampled` deferral
   (:462-466, ruled unfrozen), and the 035 reconcile-coupling input (~:94 iii, ruled host-internal).
6. **No-regression + no release cut.** `npm test` + `node build.mjs` + `contracts/validate.mjs` + `npm run lint` green;
   the existing guarded surfaces + the 034-03 exposure behavior unaffected; NO version bump / git tag / dist publish
   (owner decision — a separate later step).

**DoD:** all ACs pass; the capstone ADR is Accepted (its own `adr-workflow` frame-critique gate cleared); TDD where code
changes (the `accepts` resolution + the new guards red→green); reviewed (compliance + craft + **arch** [`arch_review: true`
— the surface freeze] + **frame-critique** [`frame_review: true`]); deviation log + reconciliation sweep; reconciliation
review; refinement-todo items closed; `docs/specs/README.md` + `docs/decisions/README.md` (ADR index) synced; board
synced. Spec 037 closes → MVP6 fixed core + 1.0 API pin complete.
