# Slice 064-34: review history (rounds 1 to 5; kept for history)

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

## Round 3 pass records as they stood before round 6 (preserved verbatim)

### compliance

---
slice: 064-34 — an opt-out in flight for a superseded consent update still forwards
pass: compliance
verdict: pass
reviewer: jig:reviewer (claude-opus-5.5)
reviewed_at: 2026-11-24T22:50:38Z
prompt_source: round 3: complete final diff bcaccab7..HEAD plus the mission constraint (no ever-growing replay allowlist), Scout unavailable
--

Round 3 (agent 735263e3-aacb-4677-b109-674bfbdcc355, claude-opus-5.5, jig:reviewer, no Scout; final output read 2026-11-24T22:49:50.650Z on HEAD c258caed; the frontmatter reviewed_at is the record-write time, not the read time, full diff bcaccab7..c258caed).

First return: "needs-changes — lifecycle is request-correlated with no timer, cap or growing allowlist, core/ is untouched, AC1/AC2 met; but the identical-update skip compares against the last live generation instead of Alloy's last stored/sent consent, so a value repeated after settlement is re-registered without a request and a replay of it forwards (bounded at one generation)". Fixed in c258caed (`lastUpdateKey`, hermetic test).

Final return: "pass — the identical-update skip now keys on a last-update value that survives consumption (`lastUpdateKey`), pinned by a hermetic test that fails without it; lifecycle is request-correlated with no timer, cap or post-settlement growth, core/ untouched, AC1/AC2 met, residual edges (no-dispatch growth by page-given distinct updates, rejected-object vector retry lingering one generation, late vector retry held) honestly disclosed; low: refresh the mutation counts after the new test." Mutation counts refreshed (6 / 4 / 1) in abc501da.


### craft

---
slice: 064-34 — an opt-out in flight for a superseded consent update still forwards
pass: craft
verdict: pass
reviewer: jig:reviewer (claude-opus-5.5)
reviewed_at: 2026-11-24T22:50:39Z
prompt_source: round 3: complete final diff bcaccab7..HEAD plus the mission constraint (no ever-growing replay allowlist), Scout unavailable
substrate: not-shown
applied_skill: none
--

Round 3 (agent e28d4f1c-f514-408a-aa2b-a931a098a158, claude-opus-5.5, jig:reviewer, no Scout; final output read 2026-11-24T22:49:43.425Z on HEAD c258caed; the frontmatter reviewed_at is the record-write time, not the read time, full diff bcaccab7..c258caed).

First return: "needs-changes" (medium: the duplicate-update comment and skip held only while the previous generation was live). Fixed in c258caed.

Final return: "pass — `lastUpdateKey` is set on every distinct update and never cleared when a generation is consumed ... no timer or cap, consumption is tied to requests ... Core is untouched." Low: whether Alloy stores a consent whose request failed on the network was not checked (recorded in the slice Residuals as unchecked and on the safe side); nits: slice-33 wording aligned, long comment line re-wrapped (abc501da).


### reconciliation

---
slice: 064-34 — an opt-out in flight for a superseded consent update still forwards
pass: reconciliation
verdict: pass
reviewer: jig:reviewer (claude-opus-5.5)
reviewed_at: 2026-11-24T22:50:39Z
prompt_source: round 3: complete final diff bcaccab7..HEAD plus the mission constraint (no ever-growing replay allowlist), Scout unavailable
--

Round 3 (agent 8d6a8829-e221-40e3-ba42-a5e5c12d34db, claude-opus-5.5, jig:reviewer, no Scout; final output read 2026-11-24T22:49:41.825Z on HEAD c258caed; the frontmatter reviewed_at is the record-write time, not the read time, full diff bcaccab7..c258caed).

First return: "needs-changes — the code matches the request-correlated design and the ADR stays append-only, but the slice Findings and the index.js comment overstate that an already-sent value is held when replayed (false when the page re-sends the value Alloy already stored); correct that, name it in Residuals with a test, and fix the low-severity leftover wording." Fixed in c258caed.

Final return: "pass — the identical-update skip now survives consumption (`lastUpdateKey`) and a test pins it; lifetime is request-correlated with no timer, no cap and no growth after settlement; the docs, comments, ADR Corrections entry and slice-33 note match the final code. Before closing, correct the AC1 mutation counts, which look stale by one test (traced at 6 and 4)." Counts re-run: 6 / 4 / 1 (abc501da).

