---
slice: 064-21 — aem-martech, ACDL and Launch (B5)
pass: reconciliation
round: follow-up 1
verdict: changes-requested
reviewer: independent reviewer (Claude Opus 5.5, Copilot jig:reviewer sub-agent)
reviewed_at: 2026-11-20 (time not recorded)
prompt_source: review prompts for slice 064-21 (commits 3be50885, 1a5058a3, 1f751acd; follow-up round 1 reviewed a15457ec; fixes landed in 7e466871 and the next commit, not re-reviewed)
---

# 064-21 reconciliation

The author saved this text (a summary of the reviewer's reports; fresh reviewers each round). Rounds are capped at 3.

Round 1 changes-requested (high: the 064-30 / ADR-0064 owner did not exist; medium: slice status READY_FOR_IMPLEMENTATION versus DONE on the board; low: call-map rows, spec s8 list, adopter docs). Fixed: owner moved to 064-31 AC4, status DONE, `docs/architecture.md` entry, call map completed. Round 2 changes-requested (medium: the "2 of 3 fail without the fix" count was wrong; low: a throwing-hook test cited wrongly, empty-overrides claim, `applyPropositions` missing from architecture.md, board title). Fixed. Round 3 changes-requested at the round cap (medium: the "which connector tests fail without the fix" sentence miscounted; low: stray punctuation, 064-31 filed under "B4 follow-ups", spec s12 said `configure` maps to boot options, board title versus slice heading). All fixed after round 3 in docs only: three of the four connector tests fail without the fix (propositionFetch, scope merge, explicit page boolean); the notification-only test also passes without it. Deviation log: wrapper (not drop-in); connector no longer treats `propositionFetch` as a notification and carries per-call `decisionScopes` and plain `personalization` (a shared-component change, not `core/`); collect bodies are proven by a SYNTHETIC differential, not a recording; the out-of-AC differences are owned by 064-31 AC1 to AC7.

## Follow-up round 1 (owner-directed: no shipped page global)

Fresh Opus 5.5 reviewer on a15457ec; verdict changes-requested (the author saved this text). This reviewer's findings only. Fixes landed in 7e466871 and were not re-reviewed (no extra round):

- `alloy-bridge.js:3-5` header sentence broken, 'of its own making' contradicted 'neither reads nor writes' (medium): fixed in 7e466871.
- Slice line 30 cited an ADR number with no file and no tracked owner (low): fixed in 7e466871 (the number is dropped; the ADR and slice are created separately by the owner decision, not by 064-21).
- `test/adobe-b5-martech.test.js:50` comment said the site serves the shim (low): fixed in 7e466871.
- Spec s12 parenthetical ran the command mapping into the product-path clause (low): fixed in 7e466871.
