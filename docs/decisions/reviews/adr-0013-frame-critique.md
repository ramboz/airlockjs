---
adr: 0013
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (2 rounds)
reviewed_at: 2026-08-31T17:48:21Z
prompt_source: review.py frame-critique + re-review
---

# Frame-critique — ADR-0013 (alloy consent enforcement). VERDICT: pass (re-review after wording fix).
Round 1 → needs-changes: the design (trusted seam-drop + setConsent delegate) survived, but the Consequences
over-claimed the trust thesis as UNCONDITIONAL ("a compromised chamber cannot exfiltrate... the single
chokepoint"), contradicting the ADR's own Kill criteria — a fully compromised chamber retains the disclosed
dynamic-import() escape hatch (016/012-01 AC5) that bypasses ALL seam controls, mitigated only by a worker
connect-src CSP airlock does not ship; and the machine-verified test proves DELEGATE-independence (a chamber
forging its own setConsent is held), not that a seam-bypassing chamber is held.
Fix applied (the reviewer's exact prescription): Consequences conditioned to an honest-but-untrusted chamber
(egress crosses the mediated seam), naming the dynamic-import bypass + the unshipped host CSP + "held given
egress confinement, not unconditional"; Pros tightened to delegate-independence with an explicit disclaimer +
a Kill-criteria pointer; the Assumptions grounding note aligned to "delegate-independent".
Round 2 → pass: both load-bearing spots now match the Kill criteria; no residual unconditional over-claim; no
new inconsistency. Reviewer: jig:reviewer (independent, 2 rounds).
