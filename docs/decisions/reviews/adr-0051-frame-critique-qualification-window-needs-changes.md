---
adr: 0046
pass: frame-critique
verdict: needs-changes
reviewer: gpt-6.1-sol
reviewed_at: 2026-11-05T01:51:27.335Z
prompt_source: coordinator-supplied same-reviewer qualification-window frame clarification
reviewed_checkpoint: 8e13c7333ffc8c6f29905a6bc4f187aff8e05c81
---

<!-- BEGIN VERDICT -->
reviewed_checkpoint: `8e13c7333ffc8c6f29905a6bc4f187aff8e05c81`
parent_checkpoint: `cde167abdb450e30e60c60ccd5f203d5188caa7f`
actual_completion_utc: `2026-11-05T01:51:27.335Z`
model: `GPT-6.1 Sol (gpt-6.1-sol)`
scope: Same-task FRAME clarification of the already-read frozen candidate's qualification interval versus consumed-case safety STOP authority. No source implementation or TDD result was inspected or treated as physical evidence. Only the UTC clock was sampled.
own_checkout: Last independently verified clean at unchanged `47c9511500bdb9054a505d4df49430d5b897fb9a` at `2026-11-05T01:41:06Z`. No files or Git operations were performed in this clarification; no fresh cleanliness inspection is claimed.

VERDICT: needs-changes

REASONING:
The literal bounds conflict. The full qualification interval must fit before START expiry, but the producer phase forbids every later operation once that original case/observation interval is exhausted, apart from descriptor close. Consequently, permitting a hard-stop-based phase does not by itself make positive post-expiry producer STOP consumption or browser closure reachable. I missed this interaction in the previous clearing pass; the qualification interval and the separately stated consumed-case safety STOP authority need an explicit distinction.

SPECIFIC ISSUES:
- **Primary assumption: the original 45+10 qualification budget can remain the ceiling for every producer operation while still allowing positive STOP consumption after START expiry.** Let `Q_end` be the end of the original qualification interval. The required fit gives `Q_end <= expires_at`; a strictly post-expiry invocation has `now > expires_at >= Q_end`. Contract lines 420–427 then make the result UNKNOWN and forbid another producer operation except eligible descriptor close. The independent STOP invocation can still record its marker before the hard stop, but that cannot make the expired producer read or close its browser. The conflict is between lines 388–395 and 420–427 and the consumed-case STOP promise, not a reason to fake an interval or reset a clock.

RECONCILIATION NOTES:
- **Required narrow distinction:** Keep 45+10 as the qualification interval. If the required control/observations are unfinished at its deadline, freeze qualification as UNKNOWN, retain the charge and block continuation. A later safety stop must never repair that qualification, start another observation interval or upgrade the result. Earlier genuinely completed evidence remains historical; no new qualification follows from the safety path.
- **Named safety-only authority:** The proposed amendment may separately define the original live producer's same-consumed-case STOP-only safety scope up to the original trusted `hard_stop_at`. Require the original validated immutable job/plan/decision/attestation/intent and an actual retained handle whose ownership was already verified under valid authority. Permit only fixed STOP/binding reads, necessary serialized closure coordination and the already-authorized bounded close, capped by the lesser of ten seconds and remaining hard-stop time. No renewed case, acquisition, context/page, SDK work, resume or retry follows.
- **No hidden widening:** Do not use this distinction to admit a new producer, a new close attempt on a previously attempted handle, or late/unverified launch settlement that the existing rule disqualifies. Name any permitted safety-only records explicitly; completion information must not become a new qualification observation or ordinary success publication. Keep initial bindings, monotonic tracking, no file-extended deadlines, original spending and the publication guards.
- **Hard boundary:** No new browser/STOP effect starts at or after the original hard stop. Unfinished or unproved safety closure remains UNKNOWN. The separate finite descriptor-only cleanup exception is unchanged and cannot supply browser cleanup authority.
- **Scope and approval:** This is a source-framing restoration of the already-stated same-consumed-case STOP capability, not a new source work allocation or a new service. The temporal distinction is material policy text: the exact amended decision and future physical plan must expressly authorize and bind that named safety-only scope before operation. It cannot be inferred from direction approval, trusted timestamp arguments, an expired allocation or the descriptor exception. This report chooses no physical allowance for the owner and grants none.
- **History:** Preserve the actual `01:41:06Z` pass and `01:42:21.572Z` semantic clarification as prior records. Current clearance on frozen `8e` is now needs-changes for this newly reconciled time-bound conflict. The first-read and effective no-resumption findings remain resolved. No SourceSafety or native qualification follows.

No files, tests, other worktrees, cache, network, browser/SDK or other physical effects were accessed or initiated.
<!-- END VERDICT -->
