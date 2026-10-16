---
slice: 058-03 - Value-preserving comparison controls
pass: compliance
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-10-16T18:58:15Z
prompt_source: review.py implementation spec058 058-03 initial protected-field and drop-link findings
---

VERDICT: needs-changes

REASONING:
The deliverables and 34-case CLI evidence correctly distinguish attempt
controls from whole-wire, chamber and vendor qualification. Two supported
paths still violate the bounded contract and block closure.

SPECIFIC ISSUES:
- Identity rules accept arbitrary query selectors. Repeated distinct
  conversion-value groups with changed same-length candidate values can
  satisfy reuse/distinctness and become equal internal symbols, laundering a
  protected value change. Protect local relationship targets as well as native
  policies.
- Drop removes the final request without reconciling incoming redirect/fanout
  links. A valid sequence pointing to the removed tail fails invalid_edges
  before intended sequence comparison, without the required linked mutation
  evidence. Reconcile dependent links without relaxing validation.

RECONCILIATION NOTES:
Neither defect is waived by passing fixtures. Preserve exact native-copy,
local-only relationships and owner-attested completion boundaries; fix and
prove the previously missing cases before closure.
