---
adr: 0031
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-10-07T00:51:33Z
prompt_source: review.py frame-critique docs/decisions/adr-0031-reframe-onto-adobe-first-compatibility.md
---

VERDICT: pass

REASONING:
The highest-risk assumption is that full pinned Alloy semantics can survive confinement, particularly callbacks and synchronous page/DOM behavior, not that the SDK can boot. This is an honestly gated investigation: ADR-0031 prohibits treating exclusions as full support and requires owner re-decision if compatibility fails; the release plan withholds the live checkpoint when access is blocked. The ADR explicitly carries ADR-0017's stable core and ADR-0018's surviving constraints. The prioritization frame survives; compatibility and setup remain unproved.

SPECIFIC ISSUES:
- Primary assumption: full compatibility is feasible without weakening the boundary. R-012 identifies page-native callbacks and DOM/editor behavior beyond the existing subset; the release plan acknowledges that arbitrary functions cannot cross structured clone. A callback requiring synchronous live page state cannot simply become worker messaging, and sanitized reserved-placement rendering cannot be presumed equivalent to broader DOM behavior. Restoring fidelity could require forbidden authority; retaining restrictions could force exclusions and invalidate the full-support gate. The first event/HTML journey cannot settle this risk, but the explicit incompatibility checkpoint and owner-approved scope revision prevent it becoming an unconditional promise.
