---
reviewer_model: claude-opus-5.5
reviewed_at: 2026-11-20
round: 1
verdict: changes-requested
---

# Slice 064-20 (B4) reconciliation review, round 1

Commit `7e8464e2`. **Verdict: changes-requested.** The board row and the spec s12 entry agree with each other, and the 064-19
handoffs (M1, M3) are picked up. But several notes claim more than the code and tests show, one carry has the wrong cause,
and DONE is premature until the compliance highs close.

## Findings

**R1 — High — slice notes ("What was built").** The notes say `renderDecisions`, the display notification and the click
notification each have a stock-vs-airlock differential. The code has no `renderDecisions:false` path, the redirect sends no
display, and the click differential is contaminated (compliance C1, C3, C4). Fix: restate each claim to match what is tested,
or close the gaps first.

**R2 — Medium — slice notes (S7 delta) and `test/adobe-b4-personalization.test.js:117`.** The S7 delta is attributed to
"renderDecisions:true attachment". The real cause is the missing SPA view cache (compliance C2). Fix: correct the cause and
add a carry (or build) for the view cache.

**R3 — Medium — slice notes (carries).** The "stock run shows two linkClicks POSTs" carry is wrong. The second POST comes from
airlock, which the rig boots on the stock page too (compliance C4). Fix: replace the carry with the rig fix, or record it as
a rig defect.

**R4 — Medium — spec s2.2 Personalization row and slice notes.** The row lists rendering, display and interact notifications
and Target activity parity. Missing and uncarried: AJO auto-interact collection, `trackingLabel`, merged interact-in-click
event, response `html-content-item` rendering (compliance C5, C6). Fix: add each as an explicit carry in the slice and in
`docs/refinement-todo.md`, or build it.

**R5 — Low — slice notes.** The new `onDecisions` boot option is not in "What was built". Fix: list it.

**R6 — Low — `docs/specs/README.md` board row, spec s12 entry.** Both say DONE and agree with each other. DONE is premature
given R1 to R4. The s12 entry has no review-pass line yet (expected while this review is pending). Fix: move to REVIEW
until round 2 passes, then add the review line to s12.

## Consistent (no finding)

- 064-19 M1 (S4 on the production path) is closed: S4 replays through `push` plus placements.
- 064-19 M3 (`subscribeRulesetItems.callback`) is resolved as "mediated as data": results arrive through `decisions`, and
  the dependency on decisions being wired is carried.
- 064-19 H1 (host command surface) and the storage-persistence carry stay open, correctly. No note claims otherwise.
- No `core/*` change, so the "upstream to main" list is accurate.
