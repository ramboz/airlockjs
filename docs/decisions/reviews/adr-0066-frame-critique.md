---
adr: 0066
pass: frame-critique
verdict: pass
reviewer: Claude Opus 5.5 (claude-opus-5.5), round 2 re-critique, exact head eb97316e
reviewed_at: 2026-11-25T23:20:18Z
prompt_source: review.py frame-critique docs/decisions/adr-0066-chamber-result-bridge-order.md (corrected-frame ADR prompt, run at eb97316e)
---

# Frame critique (round 2): ADR-0066 Chamber result bridge order (Proposed)

Round 2 (same-task re-critique). Separate from the first-pass reports (ADR pass, slice needs-changes), kept in git history at eb97316e and unchanged there and not relabelled.
- Head eb97316e5f9b73aedf04299eb03ec05041d6747f, tree 6649b011094dfcf2a3e80066f82c3721285084ee (detached in the reviewer worktree, clean).
- Model: Claude Opus 5.5 (claude-opus-5.5), default tier.
- Prompts: corrected-frame-adr.prompt.txt sha256 027dfe5c… and corrected-frame-slice.prompt.txt sha256 379fb9dc…. Both are byte-identical to the first-pass prompts.
- Scout preflight: ensure_fresh since=eb97316e returned verified / verified_current. indexed_through eb97316e, source_state_id 0dd4baf8d814f50c8ea5303ef3ea79d5ddad76a097444e485aa7748758d3020f, source_revision 7354900905596606387, gap_files_reindexed 0, derived_views_verified false. Later queries reported freshness "unverified (watcher_running_not_verified)".
- Lanes, in the opening turn:
  - a task-worded scout-search on the parked fetch that never settles and the gate releasing at the cap (resume_bundle core-consent-parked-5accfd954e080a5aeef08af0)
  - literal keyword lanes: adr-0063, bug-007, NAVIGATION_GATE_MS, parkPending, MAX_HELD_BEACONS, markIssued, pendingIssue, "counts as settled"
- Then a resumed investigation in phase_two, then batched expansion of known ranges.
- Read in full: the corrected ADR-0066 (1-91), slice 32 (1-98), ADR-0063 (1-111) and bug 007 (1-173).
- Read in part: spec 064 lines 1-200, covering the summary, scope and inventory, including the 064-32 rows at 51, 64 and 79. Lines past 200 were not read.
- Source ranges:
  - core/wrapped-sdk-host.js 322-385, 505-600, 625-670
  - adapters/eds/index.js 1934-1985, 2205-2395
  - adapters/eds/personalization-render.js 355-395
- Limits: static review only. The Alloy 2.31.1 bundle was not read. There is no browser witness and no suites were run. Tool-call spans are not reading durations.

```
VERDICT: pass

REASONING:
The corrected line 58 now matches the code and the accepted canon.
- A no-request completion (a ring drop, an Alloy rejection or a fatal) settles before the cap.
- A fetch parked at the core consent seam stays pending. See core/wrapped-sdk-host.js 352-356 and 589-594, and 632-639, where a pending, non-denied, flushOnGrant, non-opt-out hold calls park(). This is what ADR-0063 line 60 accepts ("the command stays pending until grant. There is no host-side timeout").
- So the 250 ms cap (adapters/eds/index.js 1959-1966) releases navigation with no request on the wire.

The frame still rests on A1. That is the assumption that the chamber-local ordered bridge from bug 007 keeps the tag's call order through result delivery. It is unverified against the unread bundle, but T4 and the kill criteria at lines 82-86 gate it, so it is not a defect in the frame.

SPECIFIC ISSUES:
- A1 (primary): the chamber bridge order equals the tag's call order through result delivery. Not falsified by the reachable source. It depends on the unread Alloy 2.31.1 bundle and is kill-gated by T4. Its residual matches bug 007's accepted residual, where a Blob text() that never settles holds later posts. It is a known risk, not a blocker.
- Note (non-blocking): ADR-0063 implementation note line 109 still describes the round 8 mechanism (the cap-250 gate crediting the oldest matching pending entry). ADR-0066 keeps ADR-0063 byte-unchanged, so once it is accepted that accepted note describes a superseded mechanism. Open question line 90 (an optional append-only pointer) already covers this. Recommend resolving it at acceptance.
- Note (non-blocking): line 58 names the park, but the same hold() path rejects instead of parking when consent is denied, flushOnGrant is off, the push is an opt-out, or the host is disposed (589-592, 634-635). Those cases fall under "completes without a request", so the claim stays consistent.
- First-pass line-58 note: resolved by this correction.
```


## Closure addendum (section 8 canon check)

# Round-2 closure addendum: spec 064, section 8, for slice 064-32

This addendum is separate. The round-2 reports and evidence in ../064-32-frame-critique-round2/ are unchanged.

- Head eb97316e5f9b73aedf04299eb03ec05041d6747f, tree 6649b011094dfcf2a3e80066f82c3721285084ee, clean (see head.txt). Model: Claude Opus 5.5 (claude-opus-5.5).
- Scoped lookup: one scout-regex_search, pattern `064-32|^## 8\.|slice-32`, limited to docs/specs/064-adobe-parity-inventory/spec.md. It found 6 matches: lines 49-53, 62-66, 77-81, 437-445, 552-557 and 561-563.
- Ranges read with scout-investigate_expand:
  - spec.md 439-470: all of section 8 up to section 9
  - spec.md 545-565: the status list containing the 064-32 row, through section 13
- No referenced selector needed reading. Section 8 has no 064-32 row, criteria or acceptance block. Line 462 says each slice carries its own acceptance in its file.
- Findings:
  - Line 443 ("064-32 covers its edge cases") is consistent with the slice scope.
  - Line 555 says 064-32 is IN_PROGRESS and round 9 is "framing only". It says Proposed ADR-0066 "would order the chamber result behind bridge requests and make the gate settlement-only", with nothing implemented and an owner decision pending. That is consistent with a Proposed, unimplemented ADR.
  - The phrase "settlement-only" is a short summary that doesn't mention the 250 ms cap, which still applies to a parked fetch (corrected ADR line 58, slice T5). It doesn't deny the cap, so this is not a canon conflict. It is a non-blocking wording note to settle at acceptance.
  - Line 563's status note still names round 8. It is consistent: the slice stays IN_PROGRESS pending the owner.
- Verdicts: unchanged. ADR-0066 pass, slice 064-32 pass. No real canon conflict was found.
- Evidence:
  - events.snapshot.jsonl: a byte copy of the session event log, timed in snapshot-clock.txt
  - tool-events.jsonl: the tool events from this closure turn, up to the snapshot
