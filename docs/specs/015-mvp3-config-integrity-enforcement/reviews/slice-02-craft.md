---
slice: 015-02 — override availability option
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-30T23:22:49Z
prompt_source: independent jig:reviewer read of the 015-02 override branch (found 1 blocker → fixed)
substrate: non-interactive
---

## Craft review — 015-02 (override option) — PASS (after one blocking finding was fixed)

Independent jig:reviewer pass on the orchestrator-authored override branch (the orchestrator is the
un-reviewed top of the stack, so this small enforcement-adjacent change got a genuine second read).

**Blocking finding (FIXED before DONE): contradictory alert under override.** The detector's `reason`
strings baked in hold-language ("held at the seal" / "fail closed (hold)"), and the override branch
reused `check.reason` verbatim — so an *overridden* dispatch emitted
`{ disposition: "overridden", reason: "…held at the seal" }`. Since override is corrected-and-SENT and
its entire safety rests on AC3 ("the correction is observed, never silent"), an alert that reads "held"
would tell an operator egress was blocked when it was actually sent (with the attacker-shaped body).
The override tests asserted only `disposition`, never `reason`, so nothing caught it.
**Fix applied:** `reason` is now disposition-neutral (names only the deviation; the `disposition` field
carries the verb held/overridden); a header note pins the intent; the override tests now assert the
`reason` contains the deviation, excludes the raw identifier value, and does NOT match /held|hold/.
Re-run green (35/35).

**Verified correct (load-bearing security properties):** override re-derives BOTH host and tenant
(not tenant-only — the frame-critique [5] point), still alerts before sending, falls back to HOLD on
an incomplete pin (`pinComplete` guard, tested), leaves the honest/allow path untouched (no re-derive
when verdict=allow, tested), redaction intact (only `reason` crosses the sink, never the `check`
object), and is inert unless `disposition==="override"` (back-compat, tested). The
`m = {...m, url: pinnedDispatchUrl(...)}` reassignment correctly records the corrected URL in
mainDispatch.requests.

No remaining craft blockers.
