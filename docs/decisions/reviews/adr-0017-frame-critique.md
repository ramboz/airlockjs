---
adr: 0017
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-06T00:39:52Z
prompt_source: review.py frame-critique docs/decisions/adr-0017-airlock-1-0-api-contract.md
---

VERDICT: pass

REASONING:
ADR-0017 faithfully + soundly records a well-framed 1.0-pin decision. The highest-risk assumption — that
the frozen surfaces are stable enough to pin though proven only on the synthetic testbed/rigs, not a real
production site — is not hidden: Assumptions bullet 2 names spec 036's creds-gated operator run, and Kill
criteria commits to a major-break + superseding ADR if real-site validation shows a frozen surface wrong.
Every load-bearing factual claim grounds in source: architecture.md's five-surfaces framing + PRE-1.0
config carve-out; push-api.md's void return (034-03 revert); refinement-todo's OQ statuses (OQ3 open;
OQ7/10/11 resolved; OQ9 single-chamber-sync proven, cross-chamber coherence carried forward); the
per-connector handle variance in adapters/eds/index.js. The two honest hedges (seams proven-for-one;
boot's config arg unfrozen) sit correctly in the carve-out + Kill criteria. The decisions were themselves
pressure-tested by the implementing slice's 6-round frame-critique.

NON-BLOCKING precision note (APPLIED): the composite.accepts carve-out clause read as present-tense
("kept OFF the installed handle") though the physical removal is 037-01's action (the composite currently
installs verbatim). Reworded to state it as the contract (EXCLUDED from the frozen handle) + the
implementing action (037-01 removes it), so the doc doesn't overstate current runtime.
