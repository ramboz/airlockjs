---
slice: 031-02 — the update path: versioning marker + `git subtree pull` (generated-release overwrite)
pass: craft
verdict: pass
reviewer: general-purpose (richer: pr-review)
reviewed_at: 2026-09-04T20:50:41Z
prompt_source: review.py pr-review docs/specs/031-distribution-setup/spec.md 031-02 <deliverables> --richer-skill pr-review
substrate: non-interactive
---

VERDICT: pass (after one needs-changes → fix → re-review cycle)

## Assessment (independent craft review, general-purpose reviewer, richer skill: pr-review)

The update-path plumbing is well-built and the proof is genuinely non-vacuous (byte-observable A→B via an injected
worker marker; the red arms share the clean arm's pull machinery so an env failure can't false-green them; marker
== tag by construction). The one blocker is now fixed, verified in code.

## The [blocker] (first pass) and how it was fixed
**Blocker:** the release tag was force-created + force-pushed (`git tag -f` + `git push --force refs/tags/…`), the
same as the floating `dist` branch — so re-running `--release` on an un-bumped version silently relocated a
published `dist-vX.Y.Z`, contradicting the "authoritative/immutable pin" contract (AC1 / README / ADR-0015). Two
consumers pulling the "same" release would get different bytes; the rig never caught it (fresh bare repo + distinct
versions per run).

**Fixed + re-verified (pass):**
- `publish-dist.mjs`: the release tag is created without `-f` and pushed **WITHOUT --force** (immutable pin) — an
  un-bumped re-release is rejected loudly (`! [rejected] … already exists`). A `forceTag`/`--force-tag` opt gates a
  deliberate re-cut. The `dist` BRANCH stays force-pushed (correctly — the floating "latest").
- README maintainer section documents the immutability, the loud-fail, "bump package.json per release," and
  `--force-tag`.
- Regression test (test/dist-build-publish.test.js): re-publishing the same version with DIFFERENT bytes throws
  (deterministic — bytes mutated so the second commit differs, not clock-dependent); `forceTag: true` re-cut
  resolves. A genuine red→green guard — fails on the old force-push code.

## The two nits — both fixed and now load-bearing in the rig's pass gate
- Non-squash arm asserts `no_squash.unrelated_histories` (`/refusing to merge unrelated histories/i` on stderr) —
  pins WHY `--squash` is load-bearing, not just "threw".
- Hand-edit arm asserts `hand_edit.is_merge_conflict` (`/(^|\n)UU /` on the porcelain) — proves a real merge
  conflict, not any throw.

## Strengths (preserve if revisited)
- Clean split between the mutable `dist` branch (force-pushed) and the immutable `dist-vX.Y.Z` tag (non-force).
- The immutability regression is a true red→green witness (byte mutation → deterministic rejection).
- The rig's two red arms now prove the specific failure mechanism.
- One `semver` feeds both `computeVersion` and `releaseTag` → marker and tag cannot drift.
- B's tree carries a distinguishing `B_WORKER_MARK` so `workers_replaced` is byte-observable + the clean arm
  re-boots through that worker (so "boot-safe mark" is itself tested).

## Non-blocking reconciliation observation
- In release mode the `dist` branch is force-pushed BEFORE the tag push, so a botched un-bumped re-release advances
  the floating `dist` branch to the new untagged bytes while the tag correctly refuses. Consistent with the design
  (docs steer consumers to pin a TAG; the branch is the mutable "latest"); the loud tag rejection is the operator's
  signal to bump. Worth awareness only if a future change lets consumers track the branch as a pin. No action.

Reviewer: general-purpose (independent), richer skill pr-review. Recovery: needs-changes → fix → re-run → pass.
