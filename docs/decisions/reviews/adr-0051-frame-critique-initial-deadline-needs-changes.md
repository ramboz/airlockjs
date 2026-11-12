---
adr: 0046
pass: frame-critique
verdict: needs-changes
reviewer: gpt-6.1-sol
reviewed_at: 2026-11-05T01:17:44.118Z
prompt_source: coordinator-supplied same-reviewer initial-deadline frame clarification
reviewed_checkpoint: 47c9511500bdb9054a505d4df49430d5b897fb9a
---

<!-- BEGIN VERDICT -->
reviewed_checkpoint: `47c9511500bdb9054a505d4df49430d5b897fb9a`
actual_completion_utc: `2026-11-05T01:17:44.118Z`
model: `GPT-6.1 Sol (gpt-6.1-sol)`
scope: Same-task FRAME clarification of the frozen four-document candidate, using its already-read text. This is not a source implementation review. Only the UTC clock was sampled; no files, Git, tests, cache, CLI, network, browser or agents were accessed.
checkout_status: Last independently verified clean at the same HEAD and parent at `2026-11-05T01:08:23Z`. This clarification made no workspace changes and does not claim a fresh Git inspection.

VERDICT: needs-changes

REASONING:
An explicit initial-deadline/bootstrap boundary is missing. The contract does not exclude initial metadata/job reads from its prohibition on starting an “other operation” at or after `hard_stop_at`, yet the command must read the job to discover that bound. The trusted owner/coordinator and OS/Node baseline do not themselves supply that missing initial authority. Calling those reads outside operational admission would add a framing exception that the frozen text has not stated.

SPECIFIC ISSUES:
- **Primary assumption: the command can establish its deadline before performing the filesystem operations governed by that deadline.** With only the proposed `--job` input, the first open/read can begin or complete after the job's unknown hard stop. Discovering the timestamp afterward cannot prove timely admission or retroactively make an unverified late handle eligible for descriptor cleanup. This follows from the contract's “Proposed fixed commands and private binding,” “START and consumed-case STOP authority,” and “Separately bounded descriptor cleanup” sections. It blocks treating the current frame as a complete first-read boundary, not the feasibility of the narrow supervised approach.

**Minimal framing clarification:** The author must explicitly define how the first read is admitted. Either propose a fixed, read-only bootstrap stage with a predetermined private case path, exact small input/operation limits and its own finite initial bound, or propose trusted initial deadlines supplied with the reviewed invocation, enforced before the first filesystem operation and then bound back to the immutable job and physical plan. For the latter, later file contents must not extend the initial bounds. The chosen proposal must also state which already-owned, verified bootstrap descriptors are eligible for cleanup and what happens on late or unverified acquisition. Neither option is accepted or authorized by this clarification.

RECONCILIATION NOTES:
- The original `pass`, completed at `2026-11-05T01:08:23Z`, remains an actual historical review. This same-task backedge identifies a newly exposed omission and makes the current frozen-frame verdict `needs-changes`; do not present the earlier pass as current clearance for this boundary.
- Read-only intent does not by itself exempt an operation from an explicitly stated deadline. The fix needs an explicit bootstrap rule, not a broader filesystem platform, issuer, new privilege or universal lifetime guarantee.
- No bootstrap exception may silently authorize arbitrary/private historical reads, browser-cache inspection, publication, reservation, lock mutation or browser/SDK effects. Late/unverified handles and unobserved completion remain UNKNOWN unless the exact amended frame establishes narrower eligibility in advance.
- Preserve the existing publication cutoff and lock/job deadline binding, consumed-case STOP rules, finite descriptor-only cleanup, charges and all native/live gates. No physical or cleanup allocation follows from this report.
<!-- END VERDICT -->
