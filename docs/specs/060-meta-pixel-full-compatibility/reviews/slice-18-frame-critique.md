---
slice: 060-18 - Govern persisted first-PageView referrer state
pass: frame-critique
verdict: pass
reviewer: jig:reviewer@gpt-6.1-sol
reviewed_at: 2026-11-06T22:12:25Z
prompt_source: review.py frame-critique docs/specs/060-meta-pixel-full-compatibility/spec.md 060-18 docs/decisions/adr-0055-meta-local-referrer-storage.md
---

VERDICT: pass

REASONING:
The highest-risk assumption is that sampling raw document referrer at the first successful replacement init provides a useful persisted-referrer construction point. The strongest alternative is that native plugin installation samples later, potentially across an expiry boundary or through an SDK referrer manager, producing different cached attribution. The frame survives because it expressly leaves those relationships unqualified while requiring a governed local worker-to-receiver result; neither native parity nor ADR-0055 acceptance follows from this pass.

SPECIFIC ISSUES:
- docs/specs/060-meta-pixel-full-compatibility/slice-18-governed-referrer-storage.md:66-81,119-126,167-169: Non-blocking primary attack. Successful init-time persistence could yield locally correct ler yet disagree with native installation-time state. Treating green synthetic controls as attribution evidence would misdirect subsequent compatibility work. The explicit sampling/manager limitations contain that inference, consistent with docs/decisions/adr-0055-meta-local-referrer-storage.md:171-173; final numbered owner acceptance remains required before runtime implementation.

RECONCILIATION NOTES:
No additional deviations identified; strict invalid-state and regrant differences are already declared as local choices.
