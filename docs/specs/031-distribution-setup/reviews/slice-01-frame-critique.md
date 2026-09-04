---
slice: 031-01 — the distributable build target + subtree-install proof (boots on a clean EDS checkout, CWV preserved)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-04T18:49:06Z
prompt_source: review.py frame-critique docs/specs/031-distribution-setup/spec.md 031-01 <slice>
---

VERDICT: pass (after one needs-changes → revision cycle)

## Reviewer assessment (independent, jig:reviewer)

The frame survives its strongest attack. The load-bearing mechanism — how a generated, git-ignored,
subdirectory servable tree reaches a consumer via `git subtree` — is now pinned and self-proving.

## The needs-changes finding (first pass) and how it was addressed

**Finding:** `git subtree add --prefix <path> <remote> <ref>` imports the **entire root tree** of `<ref>` —
`--prefix` is the *local* landing path, NOT a remote-subdirectory selector. airlock's servable tree is generated,
git-ignored (the emit dir is untracked build output), and in a subdirectory — so a naive `git subtree add <remote>
main` would pull airlock's whole **source project** (build.mjs, core/, tests, docs), not `eds.js` + the workers.
Unlike aem-martech/aem-experimentation, whose hand-authored source *is* the repo root. ADR-0015 explicitly
delegated "the exact served-artifact layout" to this spec, so it was unsettled — and the rig could have papered
over it with a scratch root.

**Addressed (revision):**
- Assumptions state the `git subtree`-pulls-a-ref's-root mechanism plainly, cite the grounding (git-ignored emit
  dir; no `git subtree split` in the repo), and distinguish airlock (generated subdir) from aem-martech (root source).
- **AC2** pins a first-class publish step that commits the servable tree to a **dist-rooted ref** (a `dist` branch
  whose root IS the artifacts + VERSION, not the source project), with rejected alternatives named (`git subtree
  split` alone; a separate release repo).
- **AC4** pins the documented install to `git subtree add ... <airlock-remote> dist --squash` — the dist ref,
  never `main`.
- **AC5** forces the rig to consume the publish step's real output (not a scratch root) and adds a **second seeded
  red break** — add-from-`main` → servable files absent → boot fail — the decisive anti-paper-over witness: a
  scratch-root shortcut cannot simultaneously satisfy "consume publish output" AND "add-from-`main` goes red".
- spec.md Overview + core-bet Assumption updated consistently; slice 031-02's tag convention aligned to the
  dist-rooted ref.

**Remaining residuals (legitimate, self-probing):** "boots same-origin under the 004-01 CSP envelope" (grounded
positively for direct-emit; AC5-proven for the subtree path) and "CWV parity is a property of the served bytes"
(byte-identity argument; AC6-measured) — the ADR-0015-settled residuals this slice exists to prove.

Reviewer: jig:reviewer (independent, no access to authoring conversation). Recovery: needs-changes → revision →
re-run same pass → pass (ADR-0014 §4, overwrites in place).
