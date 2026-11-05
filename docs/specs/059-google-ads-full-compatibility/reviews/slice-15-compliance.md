---
slice: 059-15 - Exact native policy and one-shot stock capture
pass: compliance
verdict: needs-changes
reviewer: jig:reviewer (gpt-6.1-sol)
reviewed_at: 2026-11-05T19:56:50Z
prompt_source: review.py implementation; full checkpoint through a7b414ec; fresh corrective verification of 2ba919a4
---

VERDICT: needs-changes

REASONING:
Both local correctness blockers are resolved by 2ba919a42b9692ec71e7a20d9402d1357cd5563c. The transport guard remains until observed owned-browser-root exit, and independent exit/close evidence is durably recorded before producer validation. Failure tests cover failed close/kill, unavailable ownership, absent reports, missing originals and invalid digests. Static corrective review found no new tightly coupled defect. This clears those two defects only. Full 059-15 remains incomplete.

SPECIFIC ISSUES:
- docs/specs/059-google-ads-full-compatibility/slice-15-native-stock-capture.md:411-418: Native Google transport/controller, private-input and review bindings, original-slot admission and complete qualification remain unfinished. Root-exit observation does not establish descendant cleanup.
- The original compliance pass also identified missing output-failure, failed-cleanup, unsupported-resource and 64-observation-boundary qualification. The new Node-only failure tests do not supply a current-browser qualification or complete this required set.

RECONCILIATION NOTES:
The prior 84 browser witnesses are marked historical after the source corrections in slice-15-native-stock-capture.md:385-392. plan.md's checkpoint explicitly disclaims current qualification and closure of 059-15. Preserve the non-clearing full-slice result. Native admission remains blocked, and no stock slot was consumed.

REVIEW PROVENANCE:
The initial fresh Sol implementation review examined the Google checkpoint through a7b414ec4a475dc80667ef81525ea629a1c2400f and returned needs-changes. A separate fresh jig:reviewer on gpt-6.1-sol verified the surgical 2ba919a corrective packet and inspected its failure tests without executing them. That review found the two local defects resolved and retained needs-changes for the unfinished full criteria. No craft, architecture or reconciliation pass has been substituted for the missing compliance result.

The later e16e68328d19d8f94706e6e8f19cd315a6dd4350 changes only the browser-confinement suite's explicit opt-in and its operator command. It adds no native execution or qualification authority.
