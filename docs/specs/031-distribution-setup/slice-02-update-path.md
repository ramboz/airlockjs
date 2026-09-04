---
status: DONE
dependencies: [031-01, adr-0015]
last_verified: 2026-09-04
frame_review: true  # bet: `git subtree pull` overwrites the generated tree cleanly (generated-release posture).
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon). -->

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions below — never assert an unverified claim as fact. -->

## Slice 031-02 — the update path: versioning marker + `git subtree pull` (generated-release overwrite)

**Goal:** an EDS site already running airlock can **update** to a newer release via `git subtree pull`, **cleanly
overwriting** the generated tree. 031-01 already stamps a `VERSION` marker and publishes the `dist` branch, but
that marker is a floating "latest" (publish-time short-SHA). 031-02 adds the **authoritative version pin** —
per-release **`dist-vX.Y.Z` tags** on the dist ref, with the tree's `VERSION` reconciled to equal the tag — plus
the documented pull-update and the proof that a disciplined pull re-lands cleanly. Closes ADR-0015's "no semver"
gap and answers the frame-critique's merge-hostility residual (treat the tree as a generated release, not a
mergeable source tree).

**DoR:**
- ✅ 031-01 DONE — the distributable build target, the dist-rooted-ref publish (`publish-dist.mjs`, incl. the
  `VERSION` marker), and the `git subtree add` install exist and boot on a clean checkout.
- ✅ [ADR-0015](../../decisions/adr-0015-distribution-git-subtree.md) accepted — its "Open questions" name the
  version-pinning convention this slice defines; its arch review named 031-02 as the owner of the tag-based pin.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **031-01 already ships the marker + dist branch (grounded — landed this session):** `publish-dist.mjs` writes a
  `VERSION` marker (`airlockjs v<pkg>+<sha>`) at the dist-rooted `dist` branch root. So this slice does **not**
  re-add a marker — it adds the tag-based **pin** on top and reconciles the marker to the tag at release time.
- **The load-bearing bet this slice proves:** `git subtree pull` **overwrites** the generated distributable tree
  wholesale — no per-file merge conflict a buildless consumer would have to resolve — *when the consumer treats it
  as a generated release* (pulls a tagged ref with `--squash`, never hand-edits the vendored tree). ADR-0015 flags
  the *opposite* risk (a hand-edited or drifted vendored copy is merge-hostile); AC3 proves the disciplined path is
  clean, and AC2 documents the discipline that keeps it so.

**Acceptance Criteria:**

1. **The release-tag pin (the semver substitute) + the marker reconciled to it.** A release step (a `publish:dist`
   option/flag, or a documented `release` step) tags the **dist-rooted ref** 031-01 publishes — a `dist-vX.Y.Z`
   tag whose root is the servable tree — AND stamps the tree's `VERSION` to **equal the tag** (`airlockjs vX.Y.Z`,
   not the floating `+<sha>` "latest" marker), so a consumer `git subtree add`/`pull`s a **specific tagged dist
   ref** and the marker inside it matches the tag. This is the authoritative version pin ADR-0015 said subtree
   lacks, and resolves the 031-01 arch-review note that the `dist`-branch marker was only "latest". (The tag is on
   the **dist-rooted** tree, NEVER a source tag on `main` — a source tag pulls the whole project, the 031-01
   correction.) Observable: after the release step, `git show dist-vX.Y.Z:VERSION` equals the tag, and the tagged
   ref's root is exactly the servable artifacts.
2. **Documented `git subtree pull` update, generated-release posture.** The doc gives the exact
   `git subtree pull --prefix <served-path> <airlock-remote> dist-vX.Y.Z --squash` command (pulling a **tagged dist
   ref**) and states plainly that the tree is a **generated release overwritten wholesale** — consumers must not
   hand-edit the vendored tree (that is what makes pull merge-hostile). Observable: the doc exists and states the
   no-hand-edit / overwrite posture, pointing at a tagged dist ref.
3. **The update-path proof.** A rig (extend `rig:subtree`, or `rig/subtree-update.mjs` / `npm run rig:subtree-update`)
   starts from a checkout at airlock version **A** (a `git subtree add` of a `dist-vA` tag), `git subtree pull`s
   **`dist-vB`**, and asserts: the served tree now matches **B** (the `VERSION` marker flips A→B; the worker
   bundles are replaced), the pull applied **without a merge conflict**, and airlock **re-boots** cleanly (boot +
   beacon, as in 031-01, reusing its probe). Observable: the rig exits 0; a seeded break (a hand-edit to the
   vendored tree before pulling) surfaces the conflict the doc warns against, proving the rig detects the
   un-disciplined path (red→green witnessed).

**DoD:**
- [x] All ACs pass; full test suite green (no regressions — modulo the pre-existing, out-of-scope prism load failure).
- [x] Implementer test coverage exercises each AC with at least one fixture; edge cases covered explicitly.
- [x] Each new test shown to fail when its feature is removed (red→green witnessed) — AC3's A→B marker flip, the
      seeded hand-edit conflict, and the immutability regression (fails on the pre-fix force-push code).
- [x] Reviewed by `reviewer` subagent (compliance + craft; **frame-critique**, since `frame_review: true`; no arch pass — no new public boundary).
- [x] Implementation review passed.
- [x] Deviation log produced under this slice heading.
- [x] Reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.
- [x] `docs/refinement-todo.md` updated if any decisions were deferred during implementation (none deferred — see sweep row).

### Close-out (post-DONE)

- [x] `docs/specs/README.md` regenerated by `workflow.py status-board`.
- [x] Primer hygiene (spec 025-01): this slice closes spec 031. CLAUDE.md's Active-specs never carried a 031 entry
      (only the 001 worked example), so nothing to compress there; the distribution/versioning invariants were
      migrated to the status-board Notes column (031-02 row), and the release-tag + subtree add/pull convention is
      documented in `README.md` + `docs/architecture.md` OQ8.

**Anti-horizontal-phasing check:** after this slice lands, an integrator already running airlock can update it with
one documented `git subtree pull` of a tagged release and see the version marker flip while airlock re-boots — a
complete update story, not intermediate state.

### Deviation log (after reconciliation)

The original spec is preserved above. Implementation notes:

- **Re-scoped 4 ACs → 3 before implementation.** 031-01 already ships the `VERSION` marker + `dist` branch
  (`publish-dist.mjs`), so this slice does not re-add a marker — it adds the authoritative **tag pin** on top. The
  standalone "add a version marker" AC was folded into AC1 (the release-tag pin + marker reconciled to the tag),
  resolving 031-01's arch-review "the `dist`-branch marker is only 'latest'" note.
- **AC1 (release-tag pin).** `computeVersion({release})` gains a release variant (`airlockjs vX.Y.Z`, no `+sha`);
  new `releaseTag(version)` → `dist-vX.Y.Z`; `publishDist({release})` tags the SAME dist-rooted commit and pushes
  the tag. Tag + marker derive from one `semver`, so marker == tag by construction. Release mode pushes **both**
  the `dist` branch (force — the floating "latest") and the `dist-vX.Y.Z` tag.
- **AC2 (documented pull).** README §3 gives `git subtree pull --prefix scripts/airlock airlock dist-vX.Y.Z
  --squash` + the generated-release / overwrite-wholesale / never-hand-edit posture; the add example was shifted to
  a `dist-vX.Y.Z` tag so the pin story is consistent. AC2 doc-consistency is guarded by tests.
- **AC3 (update-path proof).** `rig:subtree` was **extended in-place** (the frame-critique's preferred option, which
  reaches the in-module `probeBoot`) rather than adding a `rig/subtree-update.mjs` — so there is **no
  `rig:subtree-update` script and no `probeBoot` export** (the tentative reconciliation-table TODO assumed the
  separate-file route). Arms: clean `dist-vA`→`dist-vB` pull (VERSION flips, workers replaced, no conflict,
  re-boots + beacon), hand-edit → conflict, and a **third** arm (non-squash → unrelated-histories rejection) added
  beyond AC3's two, honoring the frame note that `--squash` is load-bearing. "Workers replaced" is byte-observable
  (a trailing `//__airlock_dist_vB__`-style boot-safe comment on B's worker). Added `-c core.editor=true` to the
  rig git helper (defensive — a subtree-pull merge never blocks on an interactive editor in CI).
- **`publishDist` seams:** an optional `version` param (test/rig seam to simulate releases A/B; NOT on the CLI —
  production uses `package.json`), and `forceTag` (below).
- **Reviewer findings folded in (post-review).** Passes recorded under `reviews/` (frame-critique → pass;
  compliance → pass; craft → pass after one needs-changes fix). 031-02 declares no `arch_review` (no new public
  boundary beyond 031-01's), so no arch pass.
  - **Craft [blocker], FIXED — release-tag immutability.** The tag was force-created + force-pushed like the `dist`
    branch, so re-running `--release` on an un-bumped version silently relocated a published `dist-vX.Y.Z` (two
    consumers pulling the "same" pin get different bytes) — contradicting AC1 / README / ADR-0015's "authoritative
    pin". **Fix:** the tag is created without `-f` and pushed **without --force**, so an un-bumped re-release is
    **rejected loudly** (`! [rejected] … already exists`); bump `package.json` per release. A `forceTag` /
    `--force-tag` opt gates a deliberate re-cut. The `dist` BRANCH stays force-pushed (the mutable "latest"). Added
    an immutability regression test (same-version, different-bytes re-publish throws; `forceTag` re-cut resolves) —
    a genuine red→green guard (it fails on the pre-fix force-push code). README maintainer section documents the
    immutability + `--force-tag`.
  - **Craft nits, FIXED (now load-bearing in the rig pass gate):** the non-squash arm asserts
    `no_squash.unrelated_histories` (`/refusing to merge unrelated histories/i` on stderr); the hand-edit arm
    asserts `hand_edit.is_merge_conflict` (`/(^|\n)UU /` on the porcelain) — the arms now pin the *specific* failure
    mechanism, not just "threw".
  - **Non-blocking observation (by design, no action):** in release mode the `dist` branch is force-pushed before
    the tag push, so a botched un-bumped re-release advances the floating branch to the new untagged bytes while the
    tag correctly refuses. Docs steer consumers to pin a TAG (the branch is the mutable "latest"); the loud tag
    rejection is the operator's signal to bump. Worth awareness only if a future change lets consumers track the
    branch as a pin.
  - **Pre-existing, out-of-scope (not a regression):** `test/dom-chamber-host-prism.test.js` fails to load
    (missing `node_modules/prismjs/prism.js`); untouched by this slice, flagged as a separate task.
- **Plan adherence.** ACs 1–3 implemented as (re-)specified; no scope creep. Full suite green modulo the
  pre-existing prism failure; `test/dist-build-publish.test.js` 28/28; lint clean; `rig:subtree` PASS (6 arms).

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `updated` | §3 `git subtree pull … dist-vX.Y.Z --squash` update + generated-release/never-hand-edit posture; add example shifted to a tag; maintainer immutability + `--force-tag` note (craft fix). AC2 doc-consistency guarded by tests. |
| `publish-dist.mjs` | `updated` | release variant `computeVersion` + `releaseTag` + `publishDist({release, forceTag, version})`; the immutable non-force tag push (craft-blocker fix). |
| `rig/subtree-install.mjs` | `updated` | update arms extended IN-PLACE (clean / hand-edit / non-squash) with mechanism-pinning assertions (`is_merge_conflict`, `unrelated_histories`). No new `rig:subtree-update` script / `probeBoot` export (deviation log). |
| `test/dist-build-publish.test.js` | `updated` | AC1 (release-tag pin + reconciled marker) + AC2 doc-consistency + the immutability regression (same-version/different-bytes throws; `forceTag` re-cut resolves). |
| `docs/architecture.md` | `updated` | OQ8 extended to name the per-release `dist-vX.Y.Z` tag pin + the `--squash` update path (031-02). |
| `docs/specs/README.md` | `deferred` | status-board regen is close-out (orchestrator `workflow.py status-board`), not hand-edited here. |
| `docs/product-vision.md` | `no-op` | checked — distribution/update is enablement, no new UC or behavior/scope drift. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | new `--release`/`--force-tag` documented in README; no Hot-Cache term warranted. Spec-close primer compression is close-out (this slice closes spec 031). |
| `docs/inbox.md` | `no-op` | nothing to park. |
| `docs/refinement-todo.md` | `no-op` | OQ8 already RESOLVED by ADR-0015; the versioning-marker question lived in ADR-0015's Open Questions (now addressed by this slice's tag pin), NOT a refinement-todo entry — nothing to strike. (Corrects the pre-implementation TODO's assumption of an `updated` row.) |
| `docs/memory/**` | `no-op` | captured in spec 031 + architecture OQ8 + ADR-0015; no new reusable domain term. |
| `docs/decisions/README.md` / ADR index | `no-op` | ADR-0015 covers the channel + delegated the layout to this spec; the tag-pin/immutability is a delegated implementation captured in AC1 + guarded by the immutability regression test — no new/amended ADR (consistent with 031-01's in-spec decision). |
