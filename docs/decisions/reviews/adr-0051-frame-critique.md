---
adr: 0046
pass: frame-critique
verdict: pass
reviewer: gpt-6.1-sol
reviewed_at: 2026-11-05T01:59:57Z
prompt_source: coordinator-supplied same-reviewer qualification-versus-safety frame clearing
reviewed_checkpoint: b3fba2770ad11a1889477cdd60ccff24cf1f7906
---

<!-- BEGIN VERDICT -->
reviewed_checkpoint: `b3fba2770ad11a1889477cdd60ccff24cf1f7906`
parent_checkpoint: `db57c9a1ef93dc8df37fba57af6c937ee5661c2c`
actual_completion_utc: `2026-11-05T01:59:57Z`
model: `GPT-6.1 Sol (gpt-6.1-sol)`
scope: Same-task FRAME clearing backedge. Read the complete proposed ADR and native contract plus their coupled delta from frozen own Git objects. Both supplied SHA-256 values match. The candidate commit changes only those two documents. Earlier frame context was reconciled against the already-read documents; the other two frame documents and the reviewed publication-guard source/test subset are unchanged from `8e13c733...`. No implementation or WIP was reviewed.
own_checkout: Clean before and after, unchanged at `47c9511500bdb9054a505d4df49430d5b897fb9a`, parent `27978b45aeee75733ae72163c8105270e4169699`. Reviewed Git object `b3fba277...` was not checked out. No other worktree was inspected.

VERDICT: pass

REASONING:
The qualification-window conflict is resolved by distinct, explicitly bound qualification and safety-only authorities. The original qualification interval still ends at `Q_end <= expires_at`; a separately accepted and approved same-consumed-case safety scope may permit fixed STOP consumption and one retained browser-server close before the original hard stop. This makes post-expiry safety work reachable without restarting 45+10 or improving an unfinished qualification result. The scope is concrete enough for source implementation, but supplies no current physical authority or evidence of native closure.

SPECIFIC ISSUES:
- **Resolved primary assumption: post-expiry STOP need not fit inside an already-exhausted qualification interval.** Contract lines 426–445 now distinguish those bounds explicitly. A case with `Q_end <= expires_at < now < hard_stop_at` can perform only the separately authorized safety work, provided the same producer already obtained and verified its browser-server handle before `Q_end` and has not attempted close. Qualification remains permanently UNKNOWN if unfinished at `Q_end`, the case stays charged, and continuation remains blocked. This addresses the actual `2026-11-05T01:51:27.335Z` backedge. No blocking frame issue remains on this amendment.

RECONCILIATION NOTES:
- **Exact scope binding:** The closed physical plan adds `stop_safety_scope` with exactly `"same-consumed-case-to-hard-stop"`; the job binds it through the plan digest. The owner must accept the exact reviewed decision and separately approve the exact future plan containing that scope. A field, source approval, initial timestamp or descriptor exception is not approval. If expiry equals the hard stop, there is no post-expiry safety interval; no later value or command can create one.
- **Fixed ownership and operations:** Post-`Q_end` authority is limited to the original live producer, validated same owner/job/plan/decision/attestation/intent, fixed STOP/binding reads and serialized closure coordination. It permits at most one browser-server close if none was previously attempted, bounded by min(ten seconds, remaining original hard-stop time). It admits no new context-close call, producer, acquisition, late/unverified launch handle, case, SDK operation, resume or retry. Actual root-process exit must be observed within the close bound for the safety-closed disposition; context/descendant closure is not claimed.
- **Disjoint records and permanent qualification:** Only the two fixed no-clobber safety records are permitted after `Q_end`, with closed schemas and original job/intent/STOP digests. They cannot create or amend a late qualification terminal, upgrade UNKNOWN, or satisfy the positive first-case prerequisite. A marker or safety record is not qualification evidence. Completed earlier evidence stays historical.
- **Operation cutoffs and cleanup:** Safety publications and lock operations still require their applicable deadlines and original bindings. A close crossing its own bound cannot trigger later record/write/sync/lock-removal cleanup merely because hard-stop time remains. No new STOP/browser effect starts at or after the hard stop. The separately approved finite descriptor-only exception remains unchanged, including already-owned/verified eligibility, no retry and honest UNKNOWN for late/unobserved completion. It grants no browser cleanup.
- **Preserved prior frame:** Filesystem-free initial timestamp parsing and fixed bounded bootstrap, ordinary START expiry gates, effective no-resumption after expiry/durable STOP, original monotonic tracking, full 45+10 fit, complete browser-bundle identity, trusted OS/Node baseline and no live-tree rehash as a STOP condition remain intact. Real unresolved-launch control two must settle and close inside qualification; it cannot be rescued by later safety work. The reviewed publication-guard subset is unchanged. R1, old C FAIL/UNKNOWNs, original AC6/7 and public run/retry quarantine remain separate and unchanged.
- **History and qualification:** Both amended documents now identify the qualification-window adverse result as the current prior verdict and preserve earlier reviews as history. This new pass applies to `b3fba277...`; it does not rewrite the adverse verdict on `8e`. ADR-0051 remains Proposed. Exact acceptance, actual owner readiness, source safety reviews and separately approved physical/cleanup allocations remain mandatory. This is no SourceSafety or native qualification verdict.

Only bounded read-only own-Git/hash/clock inspection occurred. No file edits, tests, checkout/reset, WIP or cache/probe inspection, network, browser/SDK effects, agents, lifecycle acceptance or allocation occurred.
<!-- END VERDICT -->
