---
slice: 031-02 — the update path: versioning marker + `git subtree pull` (generated-release overwrite)
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-04T20:41:15Z
prompt_source: review.py implementation docs/specs/031-distribution-setup/spec.md 031-02 <deliverables>
---

VERDICT: pass

## Assessment (independent compliance review, general-purpose reviewer)

All three ACs met and independently observable (re-run, not trusted):
- **Lint** clean; `test/dist-build-publish.test.js` → 26 pass (14 from 031-01 + 12 new).
- **AC1 (hermetic, throwaway bare repo):** `node publish-dist.mjs --target <bare.git> --release` → tag `dist-v0.5.0`;
  `git show dist-v0.5.0:VERSION` = `airlockjs v0.5.0` (no `+sha`); tagged root = exactly the 5 artifacts + VERSION
  (no source leak); the tag commit == the dist-branch commit (marker == tag by construction).
- **AC2:** README §3 documents `git subtree pull --prefix scripts/airlock airlock dist-vX.Y.Z --squash` + the
  generated-release / overwrite-wholesale / never-hand-edit posture; §1 add example points at a `dist-vX.Y.Z` tag;
  served-path + command shape match the rig (no drift).
- **AC3:** `npm run rig:subtree` exits 0 — clean A→B (`v9.9.9`→`v9.9.10`, workers replaced, no conflict, re-boots +
  beacon); hand-edit conflict RED (`UU chamber.worker.js`); non-squash rejection RED. New tests non-vacuous.
- Full suite: 988 pass; only the pre-existing, out-of-scope `dom-chamber-host-prism` prismjs load failure fails
  (slice touches no prism/dom-chamber file — not a regression). No principle violations; no new TODOs.

## Non-blocking finding (by-design; pre-1.0 residual)
- **publish-dist.mjs (~line 145-146):** release mode uses `git tag -f` + `push --force` for `dist-vX.Y.Z`, so
  re-running `--release` on an already-published `package.json` version silently **moves a published release tag**
  to a new commit (a consumer re-pulling the same tag would get a different tree). Consistent with 031-01's branch
  `--force` pattern and acceptable for pre-1.0 maintainer-run tooling; **outside AC1's scope** (AC requires only
  that the tag exists and marker==tag, both proven). **Worth a guard (refuse to move an existing release tag) or a
  maintainer-README note before the 1.0 pin.**

## Reconciliation notes (for the orchestrator's reconciliation step)
- The slice's Deviation log + Reconciliation sweep still hold `_TODO_` placeholders (correctly left to
  reconciliation) — fill before RECONCILED/DONE.
- `docs/refinement-todo.md`: record that ADR-0015's versioning-marker / "no semver" open question is now RESOLVED
  by this slice's `dist-vX.Y.Z` release-tag pin.
- Close-out: regen `docs/specs/README.md`; spec-025-01 primer hygiene for spec 031's close.
- Consider capturing the force-tag semantics as a lightweight-decision or a maintainer-README note.

Reviewer: general-purpose (independent). Pass: compliance (always-on).
