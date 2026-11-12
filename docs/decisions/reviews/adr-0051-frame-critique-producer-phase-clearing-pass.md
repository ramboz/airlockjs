---
adr: 0046
pass: frame-critique
verdict: pass
reviewer: gpt-6.1-sol
reviewed_at: 2026-11-05T01:41:06Z
prompt_source: coordinator-supplied same-reviewer producer-phase clearing backedge
reviewed_checkpoint: 8e13c7333ffc8c6f29905a6bc4f187aff8e05c81
---

<!-- BEGIN VERDICT -->
reviewed_checkpoint: `8e13c7333ffc8c6f29905a6bc4f187aff8e05c81`
parent_checkpoint: `cde167abdb450e30e60c60ccd5f203d5188caa7f`
actual_completion_utc: `2026-11-05T01:41:06Z`
model: `GPT-6.1 Sol (gpt-6.1-sol)`
scope: Same-task FRAME clearing backedge. Read the complete amended ADR and native contract plus their exact coupled delta from frozen own Git objects. Both supplied SHA-256 values match. The commit changes only those two proposed documents. The other two previously reviewed frame documents and the publication-guard source/test subset are unchanged from `5b57ff8...`. No implementation or WIP was reviewed.
own_checkout: Clean before and after, unchanged at `47c9511500bdb9054a505d4df49430d5b897fb9a`, parent `27978b45aeee75733ae72163c8105270e4169699`. Reviewed Git object `8e13c733...` was not checked out. No other worktree was inspected.

VERDICT: pass

REASONING:
The expired-START producer conflict is resolved by an explicit same-case STOP-only phase and an explicit exception to the ordinary START filesystem cutoff. Eligibility comes from prior binding, attestation and durable consumption, so the producer can wait for and read STOP without first having to consume the marker that grants eligibility. The phase uses the original hard stop and elapsed limits, permits only fixed closure work and named observations, and cannot restore START authority. This clears the identified frame omission without establishing native closure or granting physical effects.

SPECIFIC ISSUES:
- **Resolved primary assumption: the consumed producer retains narrowly defined authority to consume STOP after START admission expires.** Contract lines 123–128 now select the applicable cutoff explicitly; lines 408–451 define prerequisites independent of marker observation, the permitted same-case reads/coordination, original clocks and limits, and exact observation publications. The permitted settlement is only the one already-started launch, whose returned handle must be verified before closure. No new launch, reservation, context/page, SDK work or ordinary progress publication is admitted. This addresses the actual `2026-11-05T01:36:15.250Z` backedge. No blocking behavioral frame issue remains on this amendment.

RECONCILIATION NOTES:
- **Eligibility and ordering:** The phase requires the original immutable job/plan/timestamp bindings, exact accepted decision, separately approved finite physical/cleanup allocation, required attestation and durable same-case intent. Missing prerequisites are UNKNOWN. It may wait for STOP while the already-started launch is unresolved, without conditioning the first permitted marker read on having read that marker already. The existing serialized stop/admission protocol remains mandatory.
- **Clocks and authority:** Admission expiry alone no longer disables the producer's STOP path. An exhausted original case/observation bound or hard stop still yields UNKNOWN; phase entry cannot create another 45+10 interval. All ordinary START steps retain min(expiry, hard-stop), no file can extend the original bounds, and no fresh invocation can resume or refund the case. This is a narrow restoration of the selected supervised capability, not a new allocation.
- **Exact publications:** Only `stop-observed-pending`, `handle-acquired` for the already-started launch, `stop-observed`, `closure-observed` and the same-case terminal record are permitted. Fixed lock coordination remains bounded and serialized; removal requires the verified lock held by that process before the applicable limit. No stale-lock repair, readiness/launch publication or ordinary progress is reopened. These permissions do not authorize publication after the operation's cutoff.
- **Cleanup and ownership:** The descriptor-only cleanup clause is unchanged, including separately approved finite authority, already-owned/verified eligibility, no retry and UNKNOWN for late or unobserved completion. It adds no post-hard-stop browser cleanup. A pending browser launch settling too late grants no new effect. Producer loss, unconsumed stop and unproved closure remain UNKNOWN; neither a marker nor a close request is closure evidence.
- **Preserved boundaries:** The first-read bootstrap, complete browser-bundle identity, trusted OS/Node baseline, immutable-manifest STOP check without a live-tree rehash, real unresolved-launch control two, positive control-one prerequisite, pre-effect charges and no retry remain intact. The verified publication-guard subset has not changed. R1, old C FAIL/UNKNOWNs, original AC6/7 and public run/retry quarantine remain separate and unchanged.
- **Documentary residual:** The contract opening still cites the `47` initial-deadline adverse record, while the ADR opening describes the subsequent `5b` clearing pass. Those canonical-epoch references should be aligned in later documentary reconciliation and must not erase the actual `01:36:15.250Z` producer-phase backedge. Neither older reference clears this amendment; this report is the new actual behavioral frame pass on `8e13c733...`.
- **Qualification:** ADR-0051 remains Proposed. This review supplies no SourceSafety verdict, exact-decision acceptance, owner readiness or physical/cleanup allocation. Only bounded read-only own-Git/hash/clock inspection occurred. No file edits, tests, cache/probe inspection, checkout/reset, network, browser/SDK execution, agents or lifecycle changes occurred.
<!-- END VERDICT -->
