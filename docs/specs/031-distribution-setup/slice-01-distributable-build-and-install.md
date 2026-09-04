---
status: DRAFT
dependencies: [adr-0015]
last_verified:
arch_review: true  # defines the distribution layout + served-path convention — a public consumption contract.
frame_review: true  # core bet: subtree-add → serve → boot on a clean EDS checkout is asserted, not yet probed.
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon). -->

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions below — never assert an unverified claim as fact. -->

## Slice 031-01 — the distributable build target + subtree-install proof (boots on a clean EDS checkout, CWV preserved)

**Goal:** airlock builds to a **first-class, ready-to-serve distributable tree** (decoupled from
`probes/eds-testbed/`), and an EDS site that `git subtree add`s it **boots airlock same-origin with no build
step** — proven end-to-end on a **clean EDS checkout** (not the testbed's direct-emit path) with CWV preserved.
This is the ADR-0015 mechanism the frame-critique flagged as asserted-not-probed.

**DoR:**
- ✅ [ADR-0015](../../decisions/adr-0015-distribution-git-subtree.md) accepted (git-subtree of ready-to-serve
  built artifacts; npm deferred).
- ✅ The current build's N+1 sibling-worker emit + same-origin-file-worker assertions are understood
  ([`build.mjs`](../../../build.mjs), read this session) — the distributable target reuses this machinery.
- ✅ A clean EDS-boilerplate fixture (aem-boilerplate-shaped) is available or can be prepared by the rig — it must
  be **distinct** from `probes/eds-testbed/` (which gets airlock by direct build-emit, not subtree).

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **The core, load-bearing bet this slice exists to prove:** a clean EDS checkout can `git subtree add` a
  ready-to-serve tree, serve those files **same-origin with no build step**, and airlock **boots** from them — the
  runtime's `new Worker(new URL('./<x>.worker.js', import.meta.url), { type: "module" })` resolving to a
  same-origin **file** URL under the 004-01 CSP envelope. Grounded *negatively* today (the testbed boots from a
  direct build-emit of the same tree — [`build.mjs`](../../../build.mjs) + `scripts.js`), but the **subtree-install
  path** (add → serve → boot on a checkout that never ran airlock's build) is unproven; AC4 is its probe.
- **CWV parity is a property of the served bytes, not the delivery path.** The bundles a subtree delivers are
  byte-identical to what the testbed serves, so CWV should be preserved — but "should" is an assumption until AC5
  measures it on the subtree-installed page.

**Acceptance Criteria:**

1. **A first-class distributable build target.** The build emits the adapter entry (`eds.js`) + **every** sibling
   chamber worker (`chamber.worker.js`, `pixel-chamber.worker.js`, `dom-chamber.worker.js`,
   `helix-rum-chamber.worker.js`) into a **first-class distributable directory** (e.g. `dist/`), **decoupled from
   `probes/eds-testbed/`**. Observable: after `npm run build` (or a `build:dist` target), the distributable tree
   contains `eds.js` + all four `*.worker.js` siblings; the testbed's own boot path still works (it consumes the
   distributable, or keeps its emit — state which in the deviation log).
2. **The same-origin-file-worker invariant is enforced on the distributable.** build.mjs's existing assertions —
   no `blob:`/`data:` in any emitted chunk, and every `new Worker(new URL(...))` specifier resolves to an emitted
   sibling — run against the **distributable** target. Observable: a seeded regression (rename/drop a worker
   entry) fails the **build**, not just a downstream smoke check.
3. **A documented `git subtree add` install.** An install doc (e.g. `README.md` / `docs/`) gives the exact
   `git subtree add --prefix <served-path> <airlock-remote> <ref> --squash` command, the **served-path
   convention** (where the tree must land so an EDS site serves it same-origin), and the **two boot lines**
   (`import` + `await bootEdsAnalytics()`). Observable: the documented command + boot snippet exist and match the
   steps AC4's rig actually performs (no drift between doc and proof).
4. **The risk-first proof — subtree-install onto a clean EDS checkout → boot.** A rig (`rig/subtree-install.mjs`,
   `npm run rig:subtree`) prepares a **clean EDS checkout** (aem-boilerplate-shaped, NOT `probes/eds-testbed/`'s
   emit path), `git subtree add`s the built distributable at the documented served path, serves it, and asserts
   airlock **boots**: `window.airlock` present, **no** `window.__airlockBootFailed`, and a beacon fires. Observable:
   the rig exits 0 with boot+beacon observed; a seeded break (omit one worker sibling from the added tree) makes it
   **fail** (a 404 on the missing worker → boot failure), proving the rig can go red.
5. **CWV preserved on the subtree-installed page.** Reusing the MVP5 scoreboard / Lighthouse machinery (spec 029),
   the subtree-installed fixture page's CWV is asserted **within tolerance** against a no-airlock baseline — the
   ADR-0015 / MVP6 release-check "runs airlock with CWV preserved." Observable: the CWV arm reports within the
   scoreboard's tolerance band on the subtree-installed page. (Reuse, not new scoreboard construction — if the arm
   proves heavy, note the split in the deviation log.)

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Implementer test coverage exercises each AC with at least one fixture; edge cases covered explicitly.
- [ ] Each new test shown to fail when its feature is removed (red→green witnessed) — notably AC4's seeded
      missing-worker break and AC2's seeded rename.
- [ ] Reviewed by `reviewer` subagent (compliance + craft; **arch** pass, since `arch_review: true`; **frame-critique**, since `frame_review: true`).
- [ ] Implementation review passed.
- [ ] Deviation log produced under this slice heading.
- [ ] Reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated if any decisions were deferred during implementation.

### Close-out (post-DONE)

- [ ] `docs/specs/README.md` regenerated by `workflow.py status-board`; load-bearing invariants → Notes column.
- [ ] Primer hygiene (spec 025-01): if this slice closes the spec, compress the Active-specs entry. If it adds a
      new `npm run` target (`rig:subtree`, `build:dist`), note it where the build/rig targets are documented.

**Anti-horizontal-phasing check:** after this slice lands, an EDS integrator can run one documented `git subtree
add` on a clean site and airlock boots and emits a beacon with CWV preserved — end-to-end adoption value, not
intermediate state.

### Deviation log (after reconciliation)

The original spec is preserved above. Implementation notes:

_TODO (implementer): deviations, reviewer findings folded back, doc updates, plan adherence. State explicitly
whether the testbed now consumes the distributable or keeps its own emit (AC1)._

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `updated` | _TODO: the `git subtree add` install + boot snippet (AC3) lands here or in docs/._ |
| `docs/specs/README.md` | `updated` | _TODO: regenerated by `workflow.py status-board`._ |
| `docs/product-vision.md` | `no-op` | _TODO: checked for behavior/scope drift (distribution is enablement, not a new UC)._ |
| `docs/architecture.md` | `no-op` | _TODO: checked for module-boundary / distribution-layout drift; update if the served-artifact layout is architecture-worthy._ |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | _TODO: primer hygiene checked._ |
| `docs/inbox.md` | `no-op` | _TODO._ |
| `docs/refinement-todo.md` | `no-op` | _TODO: checked for resolved items / new deferrals._ |
| `docs/memory/**` | `no-op` | _TODO: memory-sync result._ |
| `docs/decisions/README.md` / ADR index | `no-op` | _TODO: ADR-0015 already accepted; note if a new build/distribution ADR was warranted._ |
| `build.mjs` / `package.json` scripts | `updated` | _TODO: the distributable target + `rig:subtree` / `build:dist` scripts._ |
