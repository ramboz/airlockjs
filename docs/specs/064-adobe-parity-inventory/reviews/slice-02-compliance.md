---
slice: 064-02 — T2: datastream setting list and completeness table
pass: compliance
verdict: pass
reviewer: general-purpose claude-opus-5.5 round 2
reviewed_at: 2026-11-14T17:43:24Z
prompt_source: round 2 review prompt, slice 064-02
---

# 064-02 compliance — round 2

Scope: spec 064 sections 4.2, 5, 6.1-6.5, 9, 10, 11 (D9), 12; slice-02 file.

## AC results

| AC | Status | Evidence |
|---|---|---|
| 1. Every setting has trigger + disposition | Met | 6.1: 36 rows, each with trigger and disposition; DS-36 now explicitly counted as covered by the S1 edge-domain variant (6.5 definition) |
| 2. Public list reconciled against 17 source commands | Met | 6.4: 14 public + 3 source-only = 17; explicit non-rows for the other directions |
| 3. Out-of-inventory rate vs 10% | Met | 6.5 and section 10: 7/36 = 19.4%, kill criterion 6 trips, scope unchanged |
| DoD: table in section 6, no production probe | Met | No probe run; section 9 now holds the owner-stated POC site and the allowed datastream ID |
| D1-D8 untouched; D9 recorded | Met | Diff adds D9 only; 4.2 restated to match D9 |
| D9: only org ID 908936ED5D35CC220A495CD4@AdobeOrg and datastream ID 23190fa7-9e6b-4250-b87b-abcdc8ebc297 | Met in working tree and index | Scan of docs/ (UUIDs, @AdobeOrg, and the withheld values) finds no other tenant ID in the working tree or the staged index, including the round 1 review files |

## Round 1 findings and resolution

- C1 (blocking, Target changes persisting into S9-10/S9-11): resolved. S9-03 restores the Target environment and property token, paired with the Audience Manager change (one wait, so 13 waits and 61 recordings are unchanged).
- C2 (blocking, S9-11 owner inputs missing): resolved. 6.2 lists the window-start inputs (second Target environment, second report suite, test identity namespace, AEP dataset and schema, Launch property) and a fallback (missing input leaves the row unverified and listed in the manifest).
- C3/C4 (DS-36 disposition and rate definition): resolved by the 6.5 definition that counts DS-36 as covered.
- C5 (5.1 step 1 omits S9-00; "for each S9 setting"): not changed. Non-blocking, carried.
- C6 (coordinator read the summary as D6): still logged in the deviation log; D9 now records the owner decision on IDs. Owner confirmation of the D6 reading still recommended. Non-blocking.

## New findings

- N1 — non-blocking — 6.2 owner-inputs paragraph says the inputs are "kept out of the repo unless the owner confirms they are test-owned". D9 allows no exception for report suite or Target IDs. Reword to "kept out of the repo (D9)".
- N2 — non-blocking (hygiene, outside docs/) — a local Copilot checkpoint ref (refs/copilot/checkpoints/...) still holds the pre-D9 version of the spec and round 1 review with the withheld values. It is not on any branch and was not found on the remote. Do not push refs/copilot/*; delete that ref and prune before any push of all refs.

## Not verified

Alloy source line refs in 6.4 and the 35-minute propagation figure (no local Alloy/docs checkout, no web calls).
