---
adr: 0046
pass: frame-critique
verdict: needs-changes
reviewer: gpt-6.1-sol
reviewed_at: 2026-11-05T01:36:15.250Z
prompt_source: coordinator-supplied same-reviewer producer-phase frame clarification
reviewed_checkpoint: 5b57ff8efbde6576391728cee41c3db33ed9c14f
---

<!-- BEGIN VERDICT -->
reviewed_checkpoint: `5b57ff8efbde6576391728cee41c3db33ed9c14f`
parent_checkpoint: `868c4a82766523e459febdab3a86e4ad5aa321d3`
actual_completion_utc: `2026-11-05T01:36:15.250Z`
model: `GPT-6.1 Sol (gpt-6.1-sol)`
scope: Same-task FRAME clarification of the already-read frozen candidate, specifically the START producer's ability to consume STOP after START expiry. No source implementation was inspected. Only the UTC clock was sampled for this clarification.
own_checkout: Last independently verified clean and unchanged at `47c9511500bdb9054a505d4df49430d5b897fb9a` at `2026-11-05T01:26:48Z`. No workspace or Git operations were performed in this clarification; no fresh cleanliness inspection is claimed.

VERDICT: needs-changes

REASONING:
The first-read fix remains valid, but its unconditional START cutoff now conflicts with the required producer-side consumed-case STOP behavior. Contract lines 121–125 enforce START expiry around every controller filesystem step, while lines 395–423 and 476–492 require the live producer to consume a separately recorded stop and close its retained handle after START expiry, before the hard stop. Giving the separate STOP invocation a hard-stop bound does not change the existing START producer's read bound. An explicit consumed-case STOP-only producer phase is needed to restore that already-required capability without reopening START.

SPECIFIC ISSUES:
- **Primary assumption: an expired START producer can still read and consume the fixed stop record under its existing deadline policy.** Under the literal all-steps rule, it cannot read `stop.json` after expiry. The independent invocation can publish a valid marker, but the producer cannot consume it, so promised closure remains unavailable for that interval. This is a framing conflict on the frozen `5b` candidate, not evidence about the writer's WIP implementation.

RECONCILIATION NOTES:
- **Minimal phase boundary:** Define the producer's irreversible transition to consumed-case STOP-only behavior once START admission expires or a valid stop is consumed. Eligibility must rest on the already-validated same owner/job/plan/source/decision and durable consumed intent. Its bound must be the original trusted CLI-supplied hard stop, never a later file value or renewed clock. The phase cannot require first reading an otherwise-forbidden post-expiry marker before its narrowly permitted marker reads become available.
- **Exact allowed work:** Permit only fixed same-case stop/binding reads, the necessary serialized closure coordination, retained-handle verification and bounded STOP observations. Explicitly exclude new reservation, acquisition, context/page creation, SDK work, READY or ordinary START publication, resume and retry. Settlement of the one already-charged unresolved launch may supply its actual handle for the existing late-close path; it must not become permission for another launch.
- **Bounds and publication:** Preserve the original 45+10 limits and monotonic elapsed accounting without resets. No new STOP/browser effect begins at or after the hard stop. If any fixed STOP observation record is permitted, name that narrowly and keep its publication-step guard and job/deadline binding; do not use “observations” to reopen ordinary publication. Keep the existing finite descriptor-only cleanup exception and late/unverified/unfinished UNKNOWN treatment unchanged.
- **Unchanged admission:** Every ordinary START step retains the initial min(expiry, hard-stop) cutoff. This producer-phase exception must neither reapply START freshness to consumed-case STOP nor relax immutable manifest/job checks, source/decision bindings or the two real controls. Producer loss and unobserved closure remain UNKNOWN.
- **History and authority:** The `01:26:48Z` pass remains historical, and the initial first-read omission is still resolved. This new backedge makes current clearance on `5b` needs-changes for the distinct producer-phase conflict. A narrowly stated restoration fits the selected supervised model; this report grants no new privilege, physical/cleanup allocation, source-clock extension, decision acceptance or SourceSafety/native qualification. Exact amended text still needs this same-task clearing review.

No files, tests, cache, network, other worktrees, browsers, SDKs or agents were accessed or changed.
<!-- END VERDICT -->
