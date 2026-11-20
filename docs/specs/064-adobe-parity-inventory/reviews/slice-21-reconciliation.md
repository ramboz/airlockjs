---
slice: 064-21 — aem-martech, ACDL and Launch (B5)
pass: reconciliation
round: 3
verdict: changes-requested
reviewer: independent reviewer (Claude Opus 5.5, Copilot jig:reviewer sub-agent)
reviewed_at: 2026-11-20 (time not recorded)
prompt_source: review prompts for slice 064-21 (commits 3be50885, 1a5058a3, 1f751acd; round 3 reviewed 1f751acd)
---

# 064-21 reconciliation

The author saved this text (a summary of the reviewer's reports; fresh reviewers each round). Rounds are capped at 3.

Round 1 changes-requested (high: the 064-30 / ADR-0064 owner did not exist; medium: slice status READY_FOR_IMPLEMENTATION versus DONE on the board; low: call-map rows, spec s8 list, adopter docs). Fixed: owner moved to 064-31 AC4, status DONE, `docs/architecture.md` entry, call map completed. Round 2 changes-requested (medium: the "2 of 3 fail without the fix" count was wrong; low: a throwing-hook test cited wrongly, empty-overrides claim, `applyPropositions` missing from architecture.md, board title). Fixed. Round 3 changes-requested at the round cap (medium: the "which connector tests fail without the fix" sentence miscounted; low: stray punctuation, 064-31 filed under "B4 follow-ups", spec s12 said `configure` maps to boot options, board title versus slice heading). All fixed after round 3 in docs only: three of the four connector tests fail without the fix (propositionFetch, scope merge, explicit page boolean); the notification-only test also passes without it. Deviation log: wrapper (not drop-in); connector no longer treats `propositionFetch` as a notification and carries per-call `decisionScopes` and plain `personalization` (a shared-component change, not `core/`); collect bodies are proven by a SYNTHETIC differential, not a recording; the out-of-AC differences are owned by 064-31 AC1 to AC7.
