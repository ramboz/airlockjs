---
slice: 058-04 - Owned Google conversion attempted-reference
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-10-16T17:06:17Z
prompt_source: review.py frame-critique spec058 058-04 rig/native-tag-reference.mjs
---

VERDICT: pass

REASONING:
The strongest attack is that current Google resources may require a browser
surface the existing boundary forbids before producing the owned conversion
attempt. The frame survives: unsupported surfaces and missing dependencies
explicitly yield inconclusive evidence and leave the slice unfinished. This
respects ADR-0033 without confusing a pre-response native_attempt with complete
Google wire behavior.

SPECIFIC ISSUES:
- Primary assumption challenged: pinned Google resources can emit the conversion
  inside the existing boundary. A plausible alternative is destination
  initialization requiring an iframe, which the runner CSP forbids. Baseline
  and value positives would then be unobtainable. AC3 and AC8 explicitly preserve
  that blocked terminal, so this is an acknowledged feasibility risk.
