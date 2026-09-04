---
status: RECONCILED
dependencies: [adr-0015]
last_verified: 2026-09-04
arch_review: true  # defines the distribution layout + served-path convention — a public consumption contract.
frame_review: true  # core bet: subtree-add → serve → boot on a clean EDS checkout is asserted, not yet probed.
claimed_by: claude/mvp6-e4550f
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon). -->

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions below — never assert an unverified claim as fact. -->

## Slice 031-01 — the distributable build target + subtree-install proof (boots on a clean EDS checkout, CWV preserved)

**Goal:** airlock builds a **first-class, ready-to-serve distributable tree** and **publishes it to a dist-rooted
git ref** (a `dist` branch/tag whose *root* is the servable artifacts), so an EDS site can `git subtree add` **the
artifacts** — not airlock's source project — and **boot airlock same-origin with no build step**, proven
end-to-end on a **clean EDS checkout** (not the testbed's direct-emit path) with CWV preserved. This pins the
served-artifact layout ADR-0015 delegated to this spec, and proves the mechanism it flagged as asserted-not-probed.

**DoR:**
- ✅ [ADR-0015](../../decisions/adr-0015-distribution-git-subtree.md) accepted (git-subtree of ready-to-serve
  built artifacts; npm deferred).
- ✅ The current build's N+1 sibling-worker emit + same-origin-file-worker assertions are understood
  ([`build.mjs`](../../../build.mjs), read this session) — the distributable target reuses this machinery.
- ✅ A clean EDS-boilerplate fixture (aem-boilerplate-shaped) is available or can be prepared by the rig — it must
  be **distinct** from `probes/eds-testbed/` (which gets airlock by direct build-emit, not subtree).

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **The core, load-bearing mechanism this slice pins and proves.** `git subtree add --prefix <path> <remote> <ref>`
  imports the **entire root tree of `<ref>`** — `--prefix` is the *local* landing path, **not** a remote
  subdirectory selector. airlock's servable tree is **generated, git-ignored** (`.gitignore` untracks the emit dir
  `probes/eds-testbed/scripts/airlock/` as build output) **and emitted to a subdirectory** (AC1's `dist/`), so —
  unlike aem-martech/aem-experimentation, whose *hand-authored source lives at the repo root* — a plain
  `git subtree add <airlock-remote> main` would pull airlock's **whole source project** (`build.mjs`, `core/`,
  tests, docs), not `eds.js` + the workers. Therefore the servable tree MUST be **published to a dist-rooted
  committed ref** (AC2) whose root *is* the artifacts, and the consumer adds THAT ref. ADR-0015 explicitly delegated
  "the exact served-artifact layout and where the build emits it" to this spec (its Open questions) — so this is
  **unsettled here, not a resolved residual**. Grounded: `git subtree` semantics (`--prefix` = local path); the
  emit dir is git-ignored; no `git subtree split` exists in the repo yet (grep, this session).
- **The boot itself.** Once the artifacts are served same-origin, airlock boots — the runtime's `new Worker(new
  URL('./<x>.worker.js', import.meta.url), { type: "module" })` resolves to a same-origin **file** URL under the
  004-01 CSP envelope. Grounded *positively* for the direct-emit path (the testbed boots from the same bytes —
  [`build.mjs`](../../../build.mjs) + `scripts.js`); the **subtree-installed** path (a checkout that never ran
  airlock's build) is what AC5 proves.
- **CWV parity is a property of the served bytes, not the delivery path.** The bundles a subtree delivers are
  byte-identical to what the testbed serves, so CWV should be preserved — but "should" is an assumption until AC6
  measures it on the subtree-installed page.

**Acceptance Criteria:**

1. **A first-class distributable build target.** The build emits the adapter entry (`eds.js`) + **every** sibling
   chamber worker (`chamber.worker.js`, `pixel-chamber.worker.js`, `dom-chamber.worker.js`,
   `helix-rum-chamber.worker.js`) into a **first-class distributable directory** (e.g. `dist/`), **decoupled from
   `probes/eds-testbed/`**. Observable: after `npm run build` (or a `build:dist` target), the distributable tree
   contains `eds.js` + all four `*.worker.js` siblings; the testbed's own boot path still works (it consumes the
   distributable, or keeps its emit — state which in the deviation log).
2. **Publish the servable tree to a dist-rooted ref (the mechanism ADR-0015 delegated here).** A publish step
   (`npm run publish:dist`, or a documented release step) takes the built distributable and commits it to a
   **dist-rooted ref** — a `dist` branch (per-release tags land in 031-02) whose **root** is exactly the servable
   artifacts (`eds.js` + the four `*.worker.js` siblings + a VERSION marker), **NOT** airlock's source project.
   *Why:* `git subtree add` pulls a ref's **root** (`--prefix` is local-only), so the artifacts must themselves BE
   a ref's root — a dist-rooted branch is what makes `git subtree add <remote> dist` deliver `eds.js`+workers
   rather than `build.mjs`/`core/`/tests. *Chosen over* a `git subtree split --prefix dist` alone (split still
   needs the tree committed first; a durable `dist` branch is the simpler home) *and over* a separate release repo
   (same-repo keeps it one clone, matches ADR-0015's generated-release posture) — record the rejected alternatives
   in the deviation log. Observable: after publish, the `dist` ref checks out to a **root** containing exactly the
   servable tree; airlock's source (`build.mjs`/`core/`/tests) is **absent** from it.
3. **The same-origin-file-worker invariant is enforced on the published tree.** build.mjs's existing assertions —
   no `blob:`/`data:` in any emitted chunk, and every `new Worker(new URL(...))` specifier resolves to an emitted
   sibling — run against the **distributable** target (and hold in the published `dist` tree). Observable: a seeded
   regression (rename/drop a worker entry) fails the **build**, not just a downstream smoke check.
4. **A documented `git subtree add` install that pins the dist ref.** An install doc (`README.md` / `docs/`) gives
   the exact `git subtree add --prefix <served-path> <airlock-remote> dist --squash` command — pointing at the
   **dist-rooted ref** (the `dist` branch, or a `dist-vX.Y.Z` tag from 031-02), **never `main`** — the **served-path
   convention** (where the tree must land so an EDS site serves it same-origin), and the **two boot lines**
   (`import` + `await bootEdsAnalytics()`). Observable: the documented command references the dist ref and matches
   the steps AC5's rig actually performs (no drift between doc and proof).
5. **The risk-first proof — publish → subtree-add onto a clean EDS checkout → boot.** A rig
   (`rig/subtree-install.mjs`, `npm run rig:subtree`) exercises the **real** path end-to-end: (a) run the AC2
   publish step to produce the **dist-rooted ref** in a local bare/clone repo (**NOT** a hand-built scratch root),
   (b) `git subtree add --prefix <served-path> <that-repo> <dist-ref> --squash` into a **clean EDS checkout**
   (aem-boilerplate-shaped, NOT `probes/eds-testbed/`), (c) serve + assert airlock **boots**: `window.airlock`
   present, **no** `window.__airlockBootFailed`, a beacon fires. Observable: the rig exits 0 with boot+beacon; TWO
   seeded breaks go red — (i) omit a worker sibling from the published tree → 404 → boot fail, and (ii) point the
   add at `main` instead of the dist ref → the servable files are absent → boot fail. The rig MUST consume the
   publish step's output, never a scratch root, so it cannot paper over the mechanism (the frame-critique's
   load-bearing correction).
6. **CWV preserved on the subtree-installed page.** Reusing the MVP5 scoreboard / Lighthouse machinery (spec 029),
   the subtree-installed fixture page's CWV is asserted **within tolerance** against a no-airlock baseline — the
   ADR-0015 / MVP6 release-check "runs airlock with CWV preserved." Observable: the CWV arm reports within the
   scoreboard's tolerance band on the subtree-installed page. (Reuse, not new scoreboard construction — if the arm
   proves heavy, note the split in the deviation log.)

**DoD:**
- [x] All ACs pass; full test suite green (no regressions). _973 tests pass; the one red suite
      (`dom-chamber-host-prism` — missing `node_modules/prismjs/prism.js`) is a pre-existing env issue
      unrelated to this slice (see deviation log), not a regression. `npm run lint` clean._
- [x] Implementer test coverage exercises each AC with at least one fixture; edge cases covered explicitly.
      _AC1/AC2/AC3 → `test/dist-build-publish.test.js`; AC5 (happy + 2 breaks) + AC6 → `rig/subtree-install.mjs`._
- [x] Each new test shown to fail when its feature is removed (red→green witnessed) — notably AC5's two seeded
      breaks (missing worker sibling; add-from-`main` instead of the dist ref) and AC3's seeded rename.
- [x] Reviewed by `reviewer` subagent (compliance + craft; **arch** pass, since `arch_review: true`; **frame-critique**, since `frame_review: true`).
- [x] Implementation review passed.
- [x] Deviation log produced under this slice heading.
- [x] Reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.
- [x] `docs/refinement-todo.md` updated if any decisions were deferred during implementation. _No new
      decision deferred by this slice (the update path is already owned by 031-02); nothing to add._

### Close-out (post-DONE)

- [ ] `docs/specs/README.md` regenerated by `workflow.py status-board`; load-bearing invariants → Notes column.
- [ ] Primer hygiene (spec 025-01): if this slice closes the spec, compress the Active-specs entry. If it adds a
      new `npm run` target (`rig:subtree`, `build:dist`), note it where the build/rig targets are documented.

**Anti-horizontal-phasing check:** after this slice lands, an EDS integrator can run one documented `git subtree
add` on a clean site and airlock boots and emits a beacon with CWV preserved — end-to-end adoption value, not
intermediate state.

### Deviation log (after reconciliation)

The original spec is preserved above. Implementation notes:

- **AC1 decision — the testbed KEEPS its own emit; `dist/` is a NEW first-class target.** `npm run
  build` still emits into `probes/eds-testbed/scripts/airlock/` (unchanged), so every existing rig
  (`rig:e2e`, `rig:bundle`, `lh-eds`) and the testbed direct-emit boot path stay green with zero
  edits. `build.mjs` was refactored to a parameterized, exported `buildAirlock({ outdir, workerEntries,
  outNameFor })` with a guarded script entry; `npm run build:dist` (`node build.mjs --outdir dist`)
  emits the same eds.js + four sibling `*.worker.js` into `dist/`. *Rejected* having the testbed consume
  `dist/`: it would churn every rig's build/serve wiring for no adoption value in this slice. The
  same-origin-file-worker assertions run against **whichever** outdir (AC3), and were made
  basename-keyed so they hold for an absolute or repo-relative dist dir (not just the testbed path).
- **AC2 rejected alternatives (recorded per the spec).** Chose a dist-rooted **`dist` branch** built by
  git plumbing in a throwaway staging repo and pushed to the target. *Rejected* (a) `git subtree split
  --prefix dist` **alone** — split still needs the tree committed to a branch first, so a durable `dist`
  branch is the simpler, direct home; (b) a **separate release repo** — a same-repo `dist` branch keeps
  it one clone and matches ADR-0015's generated-release posture. `publish:dist` **requires an explicit
  `--target`** (no `origin` default) so re-running the command can never push to the real remote by
  accident; the documented production form passes `--target origin` (a remote **name** is resolved to
  its URL — see the post-review fix below). The real-remote push is **documented, not executed** by
  this slice (orchestrator controls pushes).
- **AC3.** Build-time enforcement now runs against the distributable target too. Seeded **drop** (remove
  a worker entry) and **rename** (`outNameFor` renames the emitted GA4 sibling) both throw from the
  build — witnessed: the throw is the layout assertion (`… is not a known sibling worker …`), not an
  esbuild resolution error (`test/dist-build-publish.test.js`).
- **AC5.** `rig/subtree-install.mjs` **consumes the publish step's output** (never a scratch root): it
  runs `build:dist` → `publishDist` into a local **bare** repo → `git subtree add --prefix scripts/airlock
  <bare> dist --squash` into a **clean, temp-dir EDS checkout** (distinct from `probes/eds-testbed/`) →
  serves under the boilerplate CSP → asserts boot (`window.airlock`, no `__airlockBootFailed`) + a
  worker-path beacon. Both seeded breaks go **red** and were witnessed non-vacuous (feeding each break
  its *good* input flips its `*_red` flag false and fails the rig): (i) a **missing sibling** in the
  published tree → `chamber.worker.js` 404 → `chamber-error` → **no beacon**; (ii) **add-from-`main`**
  (airlock's source-project root) → no `eds.js` at the served path → boot import 404 → `__airlockBootFailed`
  set. Break (ii) is the frame-critique's crux, demonstrated: `--prefix` is the local path and the add
  pulls the ref's **root**, so only the dist-rooted ref delivers the artifacts.
- **AC6 — implemented as an OPT-IN arm, not a split.** `WITH_CWV=1 npm run rig:subtree` runs the MVP5
  `lh-eds.mjs` OFF/ON Lighthouse method (server-substituted no-op eds.js vs the subtree-installed
  bundle) on the subtree-installed page and asserts the same tolerance band (TBT delta ≤ 50 ms,
  |CLS delta| ≤ 0.01). Ran once: TBT delta **0 ms**, CLS delta **0**, **within band**. Kept opt-in
  (not the default arm) so the default `rig:subtree` proof stays fast/non-flaky — the arm genuinely
  exists and is observable, so this is a packaging choice, **not** the deferral the slice permits.
- **Additional (in-scope):** added `dist/` to `.gitignore` (generated build output, mirroring the
  existing testbed-emit ignore — AC1's "first-class distributable, generated not tracked");
  `eslint.config.js` already ignored `dist/**` (no change needed). The `build.mjs` / `publish-dist.mjs`
  script-entry guards use `fileURLToPath(import.meta.url) === process.argv[1]` (matching
  `rig/cwv-scoreboard.mjs`) so importing them for tests never triggers a build/push.
- **Pre-existing failure (NOT a regression):** `test/dom-chamber-host-prism.test.js` fails to *load*
  (`ENOENT node_modules/prismjs/prism.js` — prismjs ships `components/`, not a built root `prism.js`).
  It is unrelated to this slice (last touched by 025-03; this slice touches no prismjs/dom-chamber
  code). Full suite otherwise: **973 tests pass, 0 failures**; `npm run lint` clean.
- **Plan adherence.** ACs 1–6 implemented as specified; no scope creep.
- **Reviewer findings folded in (post-review).** Four passes recorded under `reviews/` (frame-critique →
  pass after one needs-changes revision; compliance → pass; arch → pass; craft → pass after one
  needs-changes fix).
  - **Craft [blocker], FIXED:** the documented `npm run publish:dist -- --target origin` could not work —
    `publishDist` pushes from a throwaway `git init` staging repo with no `origin` remote, so a remote
    **name** errored (`fatal: 'origin' does not appear to be a git repository`); the rig/tests only ever
    passed bare-repo **paths**, so the broken form was never exercised. **Fix:** a new exported
    `resolveTarget()` resolves a bare remote name to its URL via `git -C ROOT remote get-url` in the
    airlock repo (paths/URLs short-circuit verbatim; unknown name → literal for git to reject);
    `publishDist` pushes the resolved `pushTarget`. README + JSDoc + comments aligned; a regression test
    added (`resolveTarget("origin")` resolves; path/URL pass through) — `test/dist-build-publish.test.js`
    now 14/14 green, lint clean.
  - **Arch [nit], FIXED:** `docs/architecture.md` OQ8 attributed "CWV preserved" to the bare
    `npm run rig:subtree`, but the CWV arm is opt-in — reworded to name the `WITH_CWV=1` form.
  - **Non-blocking nits logged as hardening (not fixed here):** (craft) rig break-(i) red condition at
    `rig/subtree-install.mjs:287` should also assert `hasAirlock===true && bootFailed===null` so "no
    beacon" is provably the missing sibling, not a total boot fail; the fixed `page.waitForTimeout(1200)`
    at `:187` should await `**/collect*` for determinism; `parseOutdir` at `build.mjs:170` silently falls
    back to the testbed default on a value-less `--outdir`. (arch) `workerEntries`/`outNameFor` on
    `buildAirlock` are AC3 test seams on a production API — worth a one-line note.
  - **Deferred/accepted, by design:** (arch/compliance) the `VERSION` short-SHA is stamped at publish
    time from airlock HEAD while the bytes come from a prior `build:dist` — a build-then-move-HEAD-then-
    publish could mismatch; safe in the back-to-back rig, and **031-02 owns the authoritative tag-based
    pin**, so `dist`-branch VERSION is a "latest" marker (accepted pre-1.0). (compliance) `publish:dist`
    force-pushes to `<target>` — intentional for ADR-0015's generated-release overwrite, guarded by the
    required-explicit-`--target`. (compliance) the add-from-`main` fixture stages a reduced source root —
    acceptable for the mechanism proof (the load-bearing property, no `eds.js` at the served root, holds).
  - **ADR-trigger considered:** the dist-rooted-ref publication mechanism is load-bearing with rejected
    alternatives (separate release repo; `git subtree split` alone), but ADR-0015 explicitly **delegated
    the served-artifact layout to this spec**, and it is captured in AC2 + guarded mechanically by AC5's
    add-from-`main` regression test — so it is kept in-spec (no standalone ADR), consistent with the
    `docs/decisions` `no-op` sweep row. (Elevation to ADR-0016 remains an option if broader
    discoverability is wanted.)

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `updated` | Created (no root README existed): the `git subtree add --prefix scripts/airlock airlock dist --squash` install (dist ref, never `main`), the served-path convention, the two boot lines (AC4), and a maintainer `build:dist`/`publish:dist` section. Matches the rig's actual steps (no drift). |
| `docs/architecture.md` | `updated` | **OQ8 (Distribution)** marked RESOLVED (ADR-0015 + this slice's layout pin) — the served-path convention `scripts/airlock/` + dist-rooted-ref mechanism are a public consumption contract (`arch_review: true`). Followed the OQ7 strike+RESOLVED convention. |
| `build.mjs` / `package.json` scripts | `updated` | `build.mjs` refactored to exported `buildAirlock({ outdir, … })` + guarded entry; added `build:dist`, `publish:dist`, `rig:subtree` scripts. New files: `publish-dist.mjs` (AC2), `rig/subtree-install.mjs` (AC5/AC6), `test/dist-build-publish.test.js` (AC1/AC2/AC3). |
| `.gitignore` | `updated` | Added `dist/` (generated build output, mirroring the existing `probes/eds-testbed/scripts/airlock/` ignore) — AC1's generated-not-tracked distributable. |
| `docs/specs/README.md` | `deferred` | Status-board regen is close-out, run by `workflow.py status-board` (orchestrator-driven lifecycle) — not hand-edited here. |
| `docs/product-vision.md` | `no-op` | Checked: distribution is enablement of an existing UC (buildless EDS adoption), not a new UC or behavior/scope change. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Checked. New `npm run` targets (`build:dist`, `rig:subtree`) are documented in `README.md` (Development + Maintaining sections); no primer Hot-Cache term is warranted for a build/rig target. Primer-hygiene close-out (compress Active-specs entry) is orchestrator-driven when the spec closes. |
| `docs/inbox.md` | `no-op` | No out-of-scope idea to park; the AC6-arm packaging is captured in the deviation log, not deferred. |
| `docs/refinement-todo.md` | `no-op` | Checked: no new decision deferred by this slice; the update path (`git subtree pull` + version-marker convention) is already owned by slice 031-02, not a new deferral. |
| `docs/memory/**` | `no-op` | Not written by the implementer (memory-sync skill's job). |
| `docs/decisions/README.md` / ADR index | `no-op` | ADR-0015 already Accepted and covers the channel decision; this slice pins the delegated layout (its Open questions) — no new ADR warranted. |
