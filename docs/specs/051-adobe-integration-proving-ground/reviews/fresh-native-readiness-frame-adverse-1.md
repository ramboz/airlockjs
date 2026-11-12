---
adr: 0046
pass: frame-critique
verdict: needs-changes
reviewer: gpt-6.1-sol
reviewed_at: 2026-11-04T21:58:48Z
prompt_source: coordinator-supplied first independent native readiness frame critique
reviewed_checkpoint: cfaa72ddd4295c0a3e721c7eae8143ecb5e3396e
---

<!-- BEGIN VERDICT -->
reviewed_checkpoint: cfaa72ddd4295c0a3e721c7eae8143ecb5e3396e
actual_completion_utc: 2026-11-04T21:58:48Z
model: GPT-6.1 Sol (gpt-6.1-sol)
scope: One independent pre-implementation native FRAME critique of the complete Proposed ADR-0051 and fresh native readiness contract. Read both explicit handoff artifacts, Accepted ADR-0045/0045, original 051-09 constraints, the cited operator acquisition/close seams and the exact three-file delta. Own checkout was clean at the exact checkpoint before and after review. No writes, tests, agents, browser/native/probe/network effects, credentials, historical originals, other worktrees, lifecycle changes or ADR acceptance.

VERDICT: needs-changes

REASONING:
The load-bearing premise is that the separate command remains usable to stop an already-admitted native case. The contract rejects expired input for the shared job, but its launch-time fit check only names the outer hard stop, so an admitted browser can remain live after its job expires and lose the independent stop path. The existing bounded-close seam does not supply a separate consumed-case authority rule, and recording UNKNOWN does not restore stop access.

SPECIFIC ISSUES:
- [High confidence] Independent stop inherits an admission-expiry refusal. docs/specs/051-adobe-integration-proving-ground/slice-09-fresh-native-readiness-contract.md:94-98,144-146,183-185,198-203 permit expires_at earlier than hard_stop_at, reject expired input without a stop-only exception, and check full-case time against hard_stop_at alone. A job can be valid when start reserves and launches, expire during acquisition or after ready, then have the owner's separate stop invocation refused while the owned browser remains live. Specify distinct start and consumed-case stop authority before implementation: require new admission's full time budget to fit the earlier expiry/hard-stop boundary, and permit authenticated stop-only revocation/closure of that already-consumed case after admission expiry, within the approved hard stop. Preserve exact owner/job/source/handle verification and refusal of new work; this must not extend the allocation or authorize effects beyond its hard stop.

RECONCILIATION NOTES:
- ADR-0045's conditional supervised exception and ADR-0050 do not settle this new expiry/stop conflict. Preserve their historical refusals, C FAIL, UNKNOWNs, consumed reservations and source-only claim limits unchanged.
- ADR-0051 remains Proposed. Plan approval is work allocation only. Exact reviewed decision acceptance, source safety reviews and actual external-native-terminal operator readiness remain separate gates; no operational implementation follows from this needs-changes result.
- Preserve the distinct SDK-free native-control purpose, two named charged attempts, no retries, 45-second case plus at most ten-second observation limits and the existing 2026-11-04T23:10:25.228Z hard stop. No SDK job promotion, historical root/flag bypass, new session/time authority, generic custody platform or change to original 051-09 obligations follows.
- No physical qualification was performed. Full 051-09 remains IN_PROGRESS; SDK, actual stock/chamber, EDS and release acceptance remain open. The sole writer should preserve this complete actual body and checkpoint in the new native-specific record.

END OF VERDICT BODY
<!-- END VERDICT -->
