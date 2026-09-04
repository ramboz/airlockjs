---
status: DRAFT
dependencies: [031-01, adr-0015]
last_verified:
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
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Implementer test coverage exercises each AC with at least one fixture; edge cases covered explicitly.
- [ ] Each new test shown to fail when its feature is removed (red→green witnessed) — notably AC3's A→B marker flip
      and the seeded hand-edit conflict.
- [ ] Reviewed by `reviewer` subagent (compliance + craft; **frame-critique**, since `frame_review: true`).
- [ ] Implementation review passed.
- [ ] Deviation log produced under this slice heading.
- [ ] Reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated if any decisions were deferred during implementation.

### Close-out (post-DONE)

- [ ] `docs/specs/README.md` regenerated by `workflow.py status-board`.
- [ ] Primer hygiene (spec 025-01): this slice closes spec 031 — compress the Active-specs entry, migrate the
      distribution/versioning invariants to the status-board Notes column, and note the release-tag +
      subtree-update convention where distribution is documented.

**Anti-horizontal-phasing check:** after this slice lands, an integrator already running airlock can update it with
one documented `git subtree pull` of a tagged release and see the version marker flip while airlock re-boots — a
complete update story, not intermediate state.

### Deviation log (after reconciliation)

The original spec is preserved above. Implementation notes:

_TODO (implementer): deviations, reviewer findings folded back, doc updates, plan adherence._

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `updated` | _TODO: the `git subtree pull` update + release-tag/version-pin convention (AC2/AC3)._ |
| `docs/specs/README.md` | `updated` | _TODO: regenerated by `workflow.py status-board`._ |
| `docs/product-vision.md` | `no-op` | _TODO: checked for scope drift._ |
| `docs/architecture.md` | `no-op` | _TODO: checked for distribution-layout / versioning-contract drift._ |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | _TODO: primer hygiene; spec-close compression._ |
| `docs/inbox.md` | `no-op` | _TODO._ |
| `docs/refinement-todo.md` | `updated` | _TODO: ADR-0015's versioning-marker open question is now resolved by this slice — note it._ |
| `docs/memory/**` | `no-op` | _TODO: memory-sync result._ |
| `docs/decisions/README.md` / ADR index | `no-op` | _TODO: note if the versioning convention warranted an ADR amendment._ |
| `build.mjs` / `package.json` scripts | `updated` | _TODO: the VERSION-marker stamping + `rig:subtree-update` script._ |
