---
adr: 0003
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-26T00:47:06Z
prompt_source: review.py frame-critique docs/decisions/adr-0003-projection-snapshot-privacy.md
---

# Frame-critique verdict — ADR-0003 (value-scoped)

**Verdict: pass** (fresh-eyes adversarial re-critique after the value-governance
scoping).

The default-deny decision for the projection-snapshot channel survives adversarial
attack. The confidentiality claim is honestly scoped to field-set control *plus*
value governance (not field-name allowlisting alone), and the `isolation_invariant`
oracle is required to cover both. The broad-need CDP case (kill criterion),
cross-chamber confidentiality (the ADR-0001 isolation-upgrade dependency), and the
open event-payload channel (OQ11) are each grounded for the narrow GA4 scope or
conceded with a named resolution trigger. The frame holds.

## Residual notes (exposed, to probe — not blocking)

1. **Value-governance oracle feasibility is unprobed.** The requirement is stated
   as a firm "must," but no R-004-equivalent shows a value-level
   `isolation_invariant` is feasible/oracle-checkable. `page_path` PII is not
   confined to the query string (path segments like `/users/jane@example.com/…`,
   fragments, per-site URL shapes), so "sanitize `page_path`" is a per-site
   problem, not a constant rule. Warrants R-004-style probe treatment before the
   confidentiality claim is relied on — a note for the step-5 contract and the
   oracle design. Risk if ignored: a hermetic field-name-only oracle green-lights
   a confidentiality property the system lacks.
2. **Direction is durable; mechanism is coupled.** The "decide now to avoid a
   breaking retrofit" justification is coupled to OQ11/OQ3 at step 5, so only the
   default-deny *direction* is durable — the field-list *mechanism* may be
   reworked when the payload/CDP decision lands. Step 5 should co-design the
   snapshot and payload boundaries together rather than freezing the snapshot
   mechanism ahead of its coupled decision.

Reviewer: general-purpose (jig frame-critique prompt). Pass recorded 2026-08-25.
