---
adr: 0050
pass: frame-critique
verdict: pass
reviewer: jig:reviewer gpt-6.1-sol default
reviewed_at: 2026-11-09T17:08:27Z
prompt_source: review.py frame-critique docs/decisions/adr-0050-google-browser-operations.md
---

VERDICT: pass

REASONING:
The highest-risk premise is that parent-invoked, captured iframe-realm Fetch applies the transport document's CSP throughout redirects. The supplied Fetch/Request clauses support that construction, but do not demonstrate browser enforcement. ADR-0050 survives this attack as a bounded experiment because it explicitly withholds enforcement claims pending positive and disallowed-recipient controls, and requires abandoning the path if they fail. Evidence was bounded UNINDEXED file reads, the owner receipt and retrieved standards excerpts; no browser execution, native CORS verification or indexed impact coverage occurred.

SPECIFIC ISSUES:
- docs/decisions/adr-0050-google-browser-operations.md:178-196 - **Residual assumption: the transport document's CSP governs host-initiated cross-realm Fetch and its redirects.** If the browser instead selects the parent's broader policy, a hidden redirect could reach an unapproved recipient despite passing the host's initial checks. That would invalidate the selected iframe transport's central authority guarantee. This remains nonblocking for the stated experiment because A1 and the kill criterion expose it explicitly; the linked plan's disallowed-recipient control requires zero arrivals attributable to realm CSP, rather than harness cancellation (`docs/specs/059-google-ads-full-compatibility/plan.md:326-331`).

RECONCILIATION NOTES:
No additional deviations identified. Browser enforcement remains an unverified stop gate, not an observed result.

Reviewer: jig:reviewer, explicitly pinned gpt-6.1-sol, default context.
Materialized proposal SHA-256: c0cb5d7b4461105e1591d691e570a93911d479cc8bcb8dee3d73185c859f1988.
Prompt: review.py frame-critique docs/decisions/adr-0050-google-browser-operations.md.
This is the actual ADR frame pass, not the earlier design-readiness review.
