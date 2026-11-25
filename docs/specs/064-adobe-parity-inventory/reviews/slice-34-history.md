# Slice 064-34: rounds 1 and 2 (superseded by round 3; kept for history)

Corrected record of the earlier reviews of the first design (heads a9e52864, cd4fba06, 47fe3f12). Reviewer agent: `jig:reviewer` on claude-opus-5.5; none had Scout, all used unindexed native reads. The reviewers' returned verdict words are given as they came back; the per-finding text below them is the author's saved summary of each report, not a verbatim copy.

| Round | Pass | Agent ID | Read (UTC) | Verdict as returned |
|---|---|---|---|---|
| 1 | craft | cdc0d2eb-220f-4785-96b1-95a455022593 | 2026-11-24T22:10:15.421Z | changes-requested |
| 1 | reconciliation | 94ccfcb9-db2a-4921-beb6-2707debd7d66 | 2026-11-24T22:10:15.448Z | changes-requested |
| 1 | compliance | ddb21947-5b0e-4536-a407-4c3294c362b8 | 2026-11-24T22:10:15.451Z | approved |
| 2 | craft | 29826772-d871-453c-80b4-1e2946651554 | 2026-11-24T22:12:45.884Z | approved |
| 2 | compliance | eda1e065-ca0e-417d-ba3e-f9f05549e85b | 2026-11-24T22:12:45.899Z | approved |
| 2 | reconciliation | none (synchronous task call `toolu_017qGy3bnG2qQMTeH2pR2X9J`; no agent ID was returned) | completed 2026-11-24T22:14:19.237Z | approved |

These approvals were later put on hold by the coordinator: the design let generations accumulate while repeated values stayed matchable.

## Saved summary: compliance

Round 1 (ddb21947-5b0e-4536-a407-4c3294c362b8 (claude-opus-5.5, jig:reviewer), read 2026-11-24T22:10:15Z (exact times in the table above), verdict: approved) was on a9e52864 (the full diff plus the new real-Chromium test).

Round 1 findings and dispositions:
- Medium, `findLastIndex` over-retires on a repeated value (A,B,A): fixed in cd4fba06 (oldest match, `findIndex`) with a test that fails under `findLastIndex`.
- Medium, a compromised chamber can send a superseded page value until a newer generation's request retires it: accepted residual, recorded in the slice Findings and the ADR-0062 clause (values are the page's own and consent must be denied).
- Low, `JSON.stringify` compare is key-order sensitive: fixed (`canon`, key-order-free) with a test that fails without it.
- Low, unbounded generations: accepted residual, recorded.
- Medium (honesty), the real-Chromium overlap test is green on the 064-33 code too: stated in the slice Findings.
- Info, the reordered 064-33 test and the changed 068-03 AC4 expectations: logged as deviations.

Round 2 findings (all low, accepted and recorded): a generation whose values are a subset of an older one's stays until a distinct value arrives; `canon(sent)` sits outside the `try` (a chamber can only break its own request); generations are unbounded while no request leaves; the duplicate-guard line has no test of its own.

## Saved summary: craft

Round 1 (cdc0d2eb-220f-4785-96b1-95a455022593 (claude-opus-5.5, jig:reviewer), read 2026-11-24T22:10:15Z (exact times in the table above), verdict: changes-requested) was on a9e52864 (the full diff plus the new real-Chromium test).

Round 1 findings and dispositions:
- High, `findLastIndex` over-retires on repeated values: fixed (oldest match), tested.
- Medium, key-order-sensitive compare: fixed (`canon`).
- Low/medium, growth from identical consecutive updates: fixed (skip a generation equal to the last); the unbounded-while-no-request residual is recorded.
- Medium, no repeated-value test: added.
- Low, the 064-33 original-order case: the test now asserts the object still forwards.
- Low, AC2 compares the wire to the page's constant, not the registration: stated in the slice Findings.

Round 2 findings: medium, the key-reorder half of the repeated-value test did not pin `canon` (fixed after the review with a dedicated test that fails when `canon` is reverted to `JSON.stringify`); low, no test for the duplicate-skip line (accepted: it only limits growth); low, `canon` and `jsonEqual` differ on `undefined` keys and NaN (accepted: it can only retire, never widen); low, a long comment line (re-wrapped).

## Saved summary: reconciliation

Round 1 (94ccfcb9-db2a-4921-beb6-2707debd7d66 (claude-opus-5.5, jig:reviewer), read 2026-11-24T22:10:15Z (exact times in the table above), verdict: changes-requested (docs not yet written)) was on a9e52864 (the full diff plus the new real-Chromium test).

Round 1 listed the docs that had to change. All are written: slice Findings and status (design, AC-to-test map, hermetic vs real-Chromium honesty, deviations, residuals), the 064-33 annotations, spec.md, the board, CHANGELOG and the ADR-0062 clause. Landing rule: adapter-only, no `core/` change, vendor-adobe.

Round 2 findings: low, the slice and spec cite these review files, which are now saved; low, the mutation counts were checked by tracing, not run by the reviewer (the author ran them).

## Round 3 read times and process notes

Final round-3 outputs were read at: reconciliation 22:49:41.825Z, craft 22:49:43.425Z, compliance 22:49:50.650Z (2026-11-24). The first needs-changes returns are preserved in the round-3 review files. Process omission, recorded without rewriting history: commit abc501da lacked the required Co-authored-by trailer; later commits carry it.


## Rounds 4 and 5: needs-changes returns (preserved; not recorded as pass)

Times are the parent's read of each reviewer's output (`tool.execution_complete`), on 2026-11-25; reviewers had no clock and Scout was unavailable. All six were `claude-opus-5.5`, `jig:reviewer`, fresh agents given the complete diff from bcaccab7 and the mission constraint (no ever-growing replay allowlist, no arbitrary expiry).

### Round 4 (head 69cec798): needs-changes x3
- reconciliation ea948372-35fc-4811-89ff-873889b113d0, read 00:20:44.457Z; compliance fbdc5eb9-ca3f-4832-882d-6dc432472c90, read 00:20:44.485Z; craft 921fe70f-2966-4244-91ed-a09b88b282e9, read 00:20:44.488Z.
- Findings: stale slice prose (an old fix-assessment paragraph, a "safe side" sentence, "third and last round", residual 2); a Deviation log without the round-4 repair; CHANGELOG and ADR-0062 Corrections missing restore-on-failure. Craft found one real gap: the host `timeoutMs` answers the chamber with status 0 while the fetch is still pending, so Alloy's resend is held because the generation is already consumed. Docs fixed in 9a8d8a9b; the gap became core slice 068-04 and round 5.

### Round 5 (head a0c01999): needs-changes x3
- reconciliation 1987bdff-8b52-4352-ad53-4996aadb2113, read 00:28:23.302Z; compliance be91ec14-f931-415e-a797-4bfae4f46e8a, read 00:28:23.328Z; craft 03d0dbb7-6580-4346-82af-e128f1629158, read 00:28:23.330Z.
- Compliance: code meets the ACs and the host-timeout gap is closed; the Design/Reconciliation sweep/spec.md prose still said "no core/ change"; round 4 and 5 reviews not recorded.
- Craft: "`restoreOnce()` only runs when `fetch` rejects or `res.ok === false`. ... If one of them throws on an ok response ... the generation stays consumed" (fixed in round 6, adapter-only); stale docs; the `dispatched` guard and the "resolves" late variant are weaker proofs (accepted, disclosed).
- Reconciliation: stale "no core/ change" in the sweep, Design and spec.md row; stale mutation and test counts; review records stop at round 3; two Residuals paragraphs; inconsistent owner quote; 068-04 needs a review record and an explicit status note; unrelated board-row churn from regeneration. All addressed in round 6 except the board churn, which comes from `status-board` regenerating from slice frontmatter.
