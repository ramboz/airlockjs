---
slice: 004-02 — bundle + lazy-phase boot + `push()` contract
pass: craft
verdict: pass
reviewer: general-purpose + pr-review skill (independent, round 2)
reviewed_at: 2026-08-27T02:12:15Z
prompt_source: review.py pr-review docs/specs/004-uc2-ga4-eds/spec.md bundle <final deliverables> --richer-skill pr-review
substrate: non-interactive
---

# 004-02 craft — VERDICT: pass (round 2, final tree)

Round 1 was needs-changes with one [blocker]: the loadLazy import
(`${codeBasePath}/adapters/eds/index.js`) did not resolve under the real testbed root and
the synthetic smoke rig masked it. Round 2 judged the fix on merits: genuinely fixed, not
papered over — the build emits into the served tree
(probes/eds-testbed/scripts/airlock/eds.js + chamber.worker.js sibling), scripts.js imports
`${codeBasePath}/scripts/airlock/eds.js`, and the rig now serves the REAL testbed root and
loads the REAL index.html with the boilerplate CSP as an HTTP header, "so that failure
class cannot hide again". Capable-of-failing shown (old path reintroduced → loud failure).

Remaining findings all [nit]: __proto__ projection hazard (→ Object.create(null) — FOLDED
during reconciliation, red-first test added, 20/20); build.mjs comment/code drift on the
blob scan (→ scan now covers both outputs — FOLDED); bundle-smoke waitForTimeout(800)
flake risk vs waitForRequest; rig pass not gating on getState_path_read (unit-covered);
listen(0) binds all interfaces. Unfolded nits recorded in the deviation log.
[strength]s: bidirectional build-time layout enforcement; real-root rig with CSP
negative control; visible-failure boot; single-seam contract normalization;
non-vacuous tests asserting both sides of the airlock; complete caller migration sweep.
