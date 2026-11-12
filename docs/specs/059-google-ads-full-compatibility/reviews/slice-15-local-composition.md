---
scope: synthetic local inspected-wire composition only
verdict: pass
reviewer: jig:reviewer
reviewed_on: 2026-10-20
---

# Scoped interim review: composed local safeguards

This is not a full-slice compliance, craft, architecture or frame verdict.
It grants no native execution or lifecycle advancement.

VERDICT: pass

REASONING:
LOCAL-ONLY pass on the two corrections. The source now distinguishes clean EOF
from transport failure, rejects incomplete response prefixes, and resets
Chrome's underlying TCP peer. Referenced H1 200/redirect and H2 reset originals
show failed browser outcomes, inconclusive responses and no admitted redirect
edge, alongside a successful clean-close control. Close/output failures now
preserve nonempty receiver, guard and original-wire evidence after cleanup in
separately indexed exclusive artifacts, leave the collision unchanged, and
retain independently witnessed blocked exits. No tightly coupled
high-confidence regression was found.

RECONCILIATION NOTES:
Both scoped blockers below are corrected. Preserve historical failed and
intermediate receipts, including the intermediate producer success that failed
renderer assertions. Clean EOF is the documented socket observation, not
additional TLS close-notify proof. This review grants no full-slice, lifecycle,
native or execution authority.

## Initial review and findings (preserved)

Initial verdict: needs-changes

REASONING:
The receiving controls, bounded decoder tests and independent exit witnesses
provide meaningful synthetic evidence, while native authority remains
explicitly denied. However, supported H1 close-delimited responses can be
falsely finalized after an upstream transport error, and the close/output
failure paths discard available case originals.

SPECIFIC ISSUES:
- `rig/reference-inspection.mjs:318-329` and
  `rig/inspected-http-wire.mjs:473` — [blocker], high confidence:
  upstream close invokes the clean-EOF finalizer while socket errors are
  swallowed. A reset after a partial close-delimited body can mark the
  prefix complete and send clean EOF to Chrome, potentially authorizing a
  redirect from incomplete response evidence. Distinguish clean termination
  from error-close and add a receiver-backed reset control.
- `rig/reference-inspection.mjs:553-557,622-644` — [blocker], high confidence:
  close failure escapes before recording the active case; output collision
  similarly omits available originals from the capture index. Existing
  close/output failure witnesses verify zero originals despite HTTP
  execution. Preserve bounded failed-case evidence after cleanup, using a
  separate exclusive failure artifact without overwriting the collision.

INITIAL RECONCILIATION NOTES:
Preserve the witnessed passing controls and original failed traces. Their
existence does not resolve these newly exposed completeness/evidence gaps.
The fixed synthetic GET-only, literal-loopback, exact-cohort limitations,
disabled stock execution, unspent canonical slots and remaining full-slice
review/source/setup/window gates remain unchanged.
