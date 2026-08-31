---
slice: 018-02 — reserveSpace hardening (overflow-clip + shared accessor + contract loudness)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T06:23:21Z
prompt_source: review.py compliance (richer-skill none); needs-changes→fix→verify
---

# Compliance review — 018-02. VERDICT: pass (independent jig:reviewer; needs-changes → fixed → verified).
Original verdict: **needs-changes.** All four ACs substantively met (clip-by-default + grow opt-out; the shared
contentOf with behavior preserved; loud decisions.fetch with no consumer on the old []; no sanitizer/lifecycle
regression), tests non-vacuous. Two issues raised: (1) BLOCKER — reserveSpace sets maxHeight+overflow that
release() never cleared → an abandoned reservation stays height-capped + clipping (violates AC4 "release
unchanged"; release() untested). (2) the item-i divergence rationale mis-cited its example.
**Both FIXED + verified:** release() now clears minHeight+maxHeight+overflow unconditionally (harmless no-op in
grow mode) + a NEW non-vacuous release() test (asserts all three blanked + marker removed + revealed — would
fail the old code that left maxHeight="300px"); the item-i rationale corrected in both source comments + the
refinement-todo note (the predicates agree on all contract shapes; diverge only on a non-contract chimera
{scope,id,content:{…no scope/id}}, so the gate is kept for strict byte-identity, divergence prose-only).
Sweep 105/105 green. Accepted-minor (recorded, non-blocking): reservedBoxStyle() dead-helper docstring drift;
module-docstring nuance; contract-stability source-text pin vs runtime call; light re-affirmation duplication.
