---
status: RECONCILED
dependencies: [004-01]
last_verified: 2026-08-26
arch_review: true
frame_review: true
claimed_by: claude/airlock-build-continue-f9ad85
---

## Slice 004-02 — bundle + lazy-phase boot + `push()` contract

**Goal:** the airlock GA4 runtime, **bundled into one module** (esbuild) and booted
in `scripts.js#loadLazy` (AD-8: analytics is lazy), runs on the real testbed page
after `body.appear`, and a `push({ event, ...params })` call in the **pinned
contract shape** flows an event through to the worker.

## Assumptions

- **esbuild bundles the runtime as a single entry + a co-located worker chunk (two
  entry points), NOT a self-resolving single file.** esbuild 0.21.5 is available
  (`npx esbuild --version` → `0.21.5`; `require("esbuild")` resolves — a transitive
  dep, pinned as a direct devDep by this slice). esbuild has **no automatic
  Web-Worker bundling** (that is a Vite/Rollup-plugin behavior, not esbuild's — frame
  critique 004-02), so the **primary** plan is two entry points (`core/airlock.js` +
  `core/chamber.worker.js`) emitted into one `outdir`; the `new Worker(new
  URL("./chamber.worker.js", import.meta.url))` reference resolves to its **sibling
  file** in that dir. **Hard constraint:** the emitted worker MUST stay a
  **same-origin file URL** — never a `blob:`/`data:` URL — because 004-01 validated
  only a same-origin module worker under the boilerplate CSP (its `worker-src 'self'
  blob:` escalation is untested). Verified-by-building at AC4's smoke test. [Kill
  criterion: if the sibling-worker layout cannot be made to resolve under the testbed
  serve, revisit — but not via a blob worker, which leaves the retired-risk envelope.]
- **Reconciling `push()` to `{ event, ...params }` aligns the runtime with the
  already-pinned [push-api.md](../../../contracts/push-api.md) contract — it does
  not change that contract.** The spike deviated to `{ type, params }`; this slice
  brings the code to the contract. [If implementation reveals the pinned contract is
  underspecified (reserved keys, the `event`-name extraction), that is a contract
  change → arch-review + an amendment, not a silent reinterpretation.]

**DoR:**
- ✅ 004-01 done (worker runs under the EDS CSP, or its accommodation is applied).

**Acceptance Criteria:**

1. **Bundled.** A build step (esbuild, two entry points) emits a single-entry runtime
   bundle + a co-located worker chunk from `core/` + `connectors/ga4/` (no multi-module
   load chain); `new Worker` resolves the worker as a **same-origin file URL** under
   the 004-01 CSP verdict (never a `blob:`/`data:` URL — that would leave the retired
   envelope).
2. **Lazy-phase boot.** The runtime is initialized from `loadLazy` (after `appear`),
   not eager — verified by ordering against the `window.__flicker` marks
   (`body:appear` precedes runtime init).
3. **`push()` reconciled to the contract.** The public write surface accepts
   `push({ event: "name", ...params })` (pinned [push-api.md](../../../contracts/push-api.md)),
   synchronous, O(1), folding the projection so a synchronous `getState()` after a
   push reflects it (AD-3). The spike's `{ type, params }` shape is migrated or
   adapted; the golden `mapToMp` still receives `{ type, params }` internally.
4. **Event reaches the worker.** A `push` on the real page results in a cycle to the
   worker (observable via the returned mapped request or a per-stage counter).

**DoD:**
- [x] ACs 1–4 pass; unit tests cover the `push()` contract-shape adaptation
      (event-name key → internal type; params pass-through) and its synchronous
      read-after-push (AD-3). 20/20 vitest; `npm run build` + `npm run rig:bundle`
      (real `index.html`, boilerplate CSP header) + `npm run rig:csp` all green.
- [x] Each new test shown capable of failing (red-first at implementation; the
      compliance reviewer additionally confirmed each analytically non-vacuous).
- [x] Reviewed by `reviewer` subagent; implementation review passed.
      (Frame-critique PASS pre-implementation; compliance PASS; craft PASS; arch
      PASS — round 2, after one blocker each from craft/arch round 1, see
      Deviation log. Evidence in `reviews/slice-02-*.md`.)
- [x] Deviation log + reconciliation sweep (below); refinement-todo updated with
      the push-surface contract questions the reviews surfaced (OQ12).

**Anti-horizontal-phasing check:** after this slice, a developer can call the
drop-in `push({ event, ... })` on a real EDS page and the event is captured and
cycled off-thread, bundled and lazy-loaded — the real capture path, end to end
minus identity + egress (the next two slices).

### Deviation log

1. **Review-driven relayout (craft round-1 blocker).** As first built, `scripts.js`
   imported `${codeBasePath}/adapters/eds/index.js`, which does not resolve when the
   testbed is served with `probes/eds-testbed/` as root — the boot silently no-op'd
   on the real page, masked by a synthetic smoke rig. Fixed by inverting the build:
   `adapters/eds/index.js` imports `../../core/airlock.js` (source→source) and IS the
   esbuild entry; output emitted into the served tree
   (`probes/eds-testbed/scripts/airlock/{eds.js,chamber.worker.js}`, gitignored);
   `dist/` removed. Boot failure is now visible (`window.__airlockBootFailed`), and
   the rig loads the REAL `index.html` from a static serve of the real root.
2. **`getState("a.b")` path-read implemented (arch round-1 blocker).** The pinned
   push-api.md row was diverged (whole projection returned for any arg); the dotted
   walk landed red-first (whole / path / missing-path tests).
3. **Malformed-push guard added (both reviews).** Missing/empty/non-string `event`
   → drop + `console.warn`, never throw (mirrors `push-event.schema.json`); the
   behavior is a runtime-side clarification push-api.md is silent on → OQ12.
4. **Two round-2 nits folded during reconciliation:** projection is now
   `Object.create(null)` (an event named `__proto__` lands as an own key —
   red-first test, 20/20) and the build's blob:/data: scan covers both emitted
   outputs (comment and code agree). Unfolded nits (bundle-smoke
   `waitForTimeout(800)` vs `waitForRequest`; rig `pass` not gating the path-read
   field; `listen(0)` binds all interfaces; worker-specifier assert checks first
   match only) are recorded here as accepted for a later rig-hygiene pass.
5. **Out-of-deliverable ripple:** `rig/harness.html`, `rig/csp-probe.html`,
   `rig/teardown.mjs` migrated to the contract shape (required by AC3's caller
   sweep); `rig/bundle-smoke.html` deleted (replaced by the real-page rig).
6. **Live `aem up` + Lighthouse verification deferred to 004-04** (both reviewers
   pre-accepted): the rig proves the wiring on a static serve of the exact aem-up
   root; the live-proxy run + CWV scoreboard are 004-04's scope.
7. **Adapter ships a REAL MP endpoint with placeholder static ctx** — deliberate
   for this slice (rigs stub `**/collect*`; boot itself sends nothing); 004-03
   wires real cookie ctx, 004-04 the real endpoint flow. Stated so nobody mistakes
   a manual live push for real analytics.
8. **Accepted risks, recorded:** double-boot would leak a Worker + unload listeners
   and overwrite `window.airlock` (once-per-page on EDS; dispose/idempotent-boot
   guard parked with an OQ8 trigger — OQ12). `pushCritical` bypasses log/projection
   (sent but unrecorded — couples to ADR-0004's parked idempotency guard; OQ12).
   `getState()` returns the live projection by reference (contract-consistent per
   its 🟡 row; write-through hazard noted for a one-line contract sentence — OQ12).
9. **esbuild pinned exact (`0.21.5`, no caret)** — deliberate, matching the probed
   version; recorded in `lightweight-decisions.md` so a dep-bump pass doesn't
   "fix" it.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `docs/specs/README.md` | `deferred` | Regen is the DONE-transition landing step (`workflow.py status-board` runs then; the board is derived, never hand-edited). |
| `docs/product-vision.md` | `no-op` | No behavior/scope drift — the slice implements the pinned surfaces. |
| `docs/architecture.md` | `no-op` | Module boundaries honored (adapter → core; capture layer O(1)); no public-contract change — push-api.md was implemented, not amended. Pre-existing core→GA4 hardwiring noted by arch review as MVP2 registry work, not this slice's drift. |
| `contracts/push-api.md` | `deferred` | pushCritical's caller shape + the push-XOR-pushCritical rule + the getState live-reference sentence must be pinned **no later than 004-04** (arch review deadline) — tracked as OQ12. |
| Primer surfaces (`CLAUDE.md`) | `no-op` | Spec 004 still in flight (004-03/04 DRAFT); no close-out compression due. |
| `docs/inbox.md` | `no-op` | Nothing resolved by this slice parked there. |
| `docs/refinement-todo.md` | `updated` | OQ12 added (push-surface contract completion + dispose guard + workFactor prune). |
| `docs/decisions/lightweight-decisions.md` | `updated` | esbuild exact-pin entry recorded. |
| `docs/memory/**` | `no-op` | The esbuild-no-auto-worker-bundling learning is captured in this slice + the frame-critique record; no separate glossary term warranted. |
| ADR index | `no-op` | No new ADR — no load-bearing choice with rejected alternatives beyond what ADR-0004 and the slice record already carry. |
