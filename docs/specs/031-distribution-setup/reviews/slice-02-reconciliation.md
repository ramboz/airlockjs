---
slice: 031-02 — the update path: versioning marker + `git subtree pull` (generated-release overwrite)
pass: reconciliation
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-04T21:01:17Z
prompt_source: review.py reconciliation docs/specs/031-distribution-setup/spec.md 031-02
---

VERDICT: pass

## Assessment (independent reconciliation review, general-purpose reviewer)

Every Deviation-log claim matches the working-tree reality, corroborated by the craft artifact and a live 28/28
test run (whose output shows the `! [rejected] dist-v9.9.9 (already exists)` immutability behavior directly).

- **AC1/AC2/AC3 as described:** `computeVersion({release})` → `airlockjs vX.Y.Z` (no `+sha`); `releaseTag` →
  `dist-vX.Y.Z`; `publishDist({release,version,forceTag})`; README §3 tagged `--squash` pull + generated-release /
  never-hand-edit posture (add example shifted to a tag; guarded by tests); rig extended IN-PLACE (no
  `rig:subtree-update` script, no `probeBoot` export) with clean/hand-edit/non-squash arms.
- **Post-review craft [blocker] fix truthful + real:** tag created without `-f`, pushed without `--force`
  (immutable); `dist` branch stays force-pushed; `forceTag`/`--force-tag` gates a re-cut; the immutability
  regression test exists and the live run prints the actual `! [rejected]` while the branch force-updates —
  matching the log's non-blocking observation exactly.
- **Two craft nits load-bearing in the rig pass gate:** `hand_edit.is_merge_conflict` (`/(^|\n)UU /`) and
  `no_squash.unrelated_histories` (`/refusing to merge unrelated histories/i`), gated at rig lines 400/401.
- **Leanness:** the three beyond-literal-AC additions are disclosed + defensible — `version` (AC3's hermetic A→B
  rig seam, off-CLI), `forceTag` (the immutability escape hatch the blocker-fix demands), and the 3rd non-squash arm
  (proves the slice's own `--squash` load-bearing assumption). No over-build; no design-principle violation; no new
  TODO/FIXME.
- **Sweep completeness verified:** all six changed paths accounted for; the `docs/refinement-todo.md` `no-op` is
  correct (OQ8 already RESOLVED by ADR-0015; no separate versioning entry existed); the `docs/decisions` `no-op` is
  credible (tag-pin kept in-spec per ADR-0015's delegation, captured in AC1 + guarded by the immutability
  regression); `docs/specs/README.md` `deferred` (status-board regen at close-out) credible.

RECONCILIATION NOTES: Nothing required. (Untracked `reviews/slice-02-*.md` artifacts corroborate the recorded
passes; the absence of `slice-02-arch.md` confirms the "no arch_review" claim — process outputs, correctly outside
the artifact sweep.)

Reviewer: general-purpose (independent). Pass: reconciliation.
