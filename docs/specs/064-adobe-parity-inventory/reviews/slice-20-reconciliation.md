---
model: claude-opus-5.5
reviewed_at: 2026-11-20T18:08Z
round: 3
verdict: needs-changes (all findings fixed in 63f84b92, see Round 3)
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

## Round 2 (2026-11-20, fixes in `git diff 7e8464e2 HEAD`)

**Verdict: pass.** The notes now match the code for every medium+ item, the carries are mirrored in
`docs/refinement-todo.md` ("Personalization follow-ups"), and the board row is back at REVIEW. The suite count claim
(24 tests, 22 Chromium, 2 hermetic) checks out: 24/24 passed in real Chromium.

| Finding | Status | Evidence |
|---|---|---|
| R1 High overclaimed differentials | Fixed | `renderDecisions:false` now built and tested; redirect display and interact shape are explicit carries. Residual wording, see R8. |
| R2 Medium S7 delta cause | Fixed in notes | Notes name the missing view cache (C2), not `renderDecisions`. Residual stale comment in the test, see R7. |
| R3 Medium two-linkClicks carry | Fixed | Carry rewritten to the rig cause; stock arm boots with click collection off and asserts exactly one POST. |
| R4 Medium uncarried interact/AJO/`html-content-item` | Fixed / carried | `html-content-item` rendering built and tested; merged interact, `viewName`, `trackingLabel`, AJO auto-collect carried in notes and refinement-todo. |

New findings (all Low):

- **R7 — Low — `test/adobe-b4-personalization.test.js:117-119`.** The S7 comment still attributes the missing view-cache
  display to "renderDecisions:true ... production sends renderDecisions:false", which disagrees with the corrected notes
  (view cache, not `renderDecisions`). Reword it to point at the C2 carry.
- **R8 — Low — slice notes.** "`onDecisions` is a documented option" is not true (no JSDoc; see compliance C10). The s2.2
  line "display and click notifications each have a stock-vs-airlock differential" should cross-reference the redirect
  and interact carries.
- **R9 — Low — slice notes, Activity-map persistence carry.** It points to "the host-command/storage item" but has no
  entry in the new refinement-todo section. Add one line.
- R6: board row is REVIEW. Add the review-pass line to spec s12 when the slice moves to DONE.

## Round 3 (2026-11-20T18:08Z, jig:reviewer, claude-opus-5.5, cutline commit 283e8b8f)

The reviewer had read-only tools; this section was transcribed by the implementer from its reply. **Verdict: needs-changes.** Checked out: the 064-24 keepalive correction (`createKeepaliveTracker` in `core/egress.js`; beacons and `init.keepalive` go through the tracker and `caps.egress`; the connector has no `documentUnloading` hint), the S7 comment (R7), and the new slices 064-23/24/25 (frontmatter, DoR, testable ACs, board rows, deps `[064-20]`; 064-26/27 not used as slices).

- **R10 High, fixed.** AC1 and the notes claimed stock differentials for JSON content and rule set items. Added a JSON-content stock differential; reworded AC1 so rule set items are "evaluated by stock Alloy in the chamber, delivered as data (M3 test, no stock-page arm)".
- **R11 Medium, fixed.** `renderDecisions:false` still fills reserved boxes and emits `proposition_display`. Documented in the `bootAlloy` JSDoc and slice notes (the 033-03 flicker invariant is unchanged); not gated.
- **R12 Medium, fixed.** Test name no longer says "(stock parity)".
- **R13 Low, fixed.** 064-26/064-27 worded as reserved numbers.
- **R14 Low, fixed.** Slice 064-24 names `documentUnloading` consistently.
- **R15 Low, fixed.** AC3 says "two filters, plus the 064-19 URL filter that stays".

Fixes verified: 25/25 B4 tests in Chromium, lint clean.
