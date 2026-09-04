---
slice: 031-02 — the update path: versioning marker + `git subtree pull` (generated-release overwrite)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-04T20:07:28Z
prompt_source: review.py frame-critique docs/specs/031-distribution-setup/spec.md 031-02 <slice>
---

VERDICT: pass

## Assessment (independent frame-critique, jig:reviewer)

The central bet — `git subtree pull --squash` of a tagged dist ref cleanly overwrites an un-hand-edited vendored
tree with no conflict — **survives its strongest attack.** Attacked on the sharpest angle: `publish-dist.mjs` mints
each release as an **orphan root commit** (fresh `git init` per call + force-push), so `dist-vA` and `dist-vB`
share NO ancestry. `--squash` specifically does not require remote ancestry (it synthesizes local squash-commit
lineage and merges with base == the prior squash commit, so an un-hand-edited `ours` == base resolves wholesale to
`theirs`). The slice uses `--squash` consistently; 031-01's landed rig already proves add+prefix+squash places
content and boots in this environment; and AC3 is a red→green proof that will surface any git-subtree surprise
during implementation. The merge-hostility ADR-0015 flags is explicitly scoped to the hand-edited path (which
ADR-0015 owns and AC3's seeded break proves-detects). Frame survives.

## Implementation notes to carry (non-blocking — fold into the implementer brief)
1. **`--squash` is load-bearing, not stylistic.** Because each release is an unrelated orphan root commit, a
   NON-squash `git subtree pull` of `dist-vB` after adding `dist-vA` would fail ("refusing to merge unrelated
   histories" / whole-tree conflict). The documented pull AND the rig MUST keep `--squash`, or the "clean re-land"
   claim collapses.
2. **AC1 marker reconciliation needs a code change to `computeVersion` (publish-dist.mjs).** It currently always
   appends `+${sha}`; a release mode must emit `airlockjs vX.Y.Z` (no `+sha`) and derive the `dist-vX.Y.Z` tag from
   the same `pkg.version` so marker == tag by construction. Net-new code + tag-push plumbing on the staging repo
   (anticipated by the "031-02 extends to per-release tags" comment). Not a config toggle.
3. **AC3 probe reuse:** `probeBoot` in `rig/subtree-install.mjs` is NOT exported. The "extend `rig:subtree`" path
   reaches it in-file; a new `rig/subtree-update.mjs` would need to export/refactor `probeBoot` (or duplicate it).
   Prefer extend-in-place, or do the trivial export.
4. **README consistency:** AC2 shifts the documented ref to a `dist-vX.Y.Z` **tag**; ensure BOTH the add example
   and the new pull example point at the tag, not the floating `dist` branch, so the authoritative-pin story is
   consistent.

Reviewer: jig:reviewer (independent). Pre-implementation frame gate; frame_review: true.
