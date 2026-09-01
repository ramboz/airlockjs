---
slice: 022-01 — governed page-view RUM beacon (+ A/B grounding)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (independent)
reviewed_at: 2026-09-01T15:16:23Z
prompt_source: review.py frame-critique + re-verify
---

Frame-critique — 022-01 (governed page-view RUM beacon). VERDICT: pass (after must-fix resolution).
Independent reviewer (jig:reviewer). Initial verdict FAIL — not on premise but on artifact inconsistency:
the load-bearing premise (mechanism B — reproduce the small `top` beacon natively, NOT consent-gated) was
VERIFIED SOUND against ground truth (aem.js:101-124 top payload/timing fires before the enhancer; the
not-consent-gated class drops onto core/airlock.js's existing seam FREE — ceiling on `ceiling.length`:194,
consent skipped on empty `egressPurposes`:163). B′ (govern the page sampleRUM in place) genuinely does NOT
survive (replace removes the page beacon; main-thread interception is off-model). The FAIL was two artifact
defects: (1) three STALE consent-gate refs (Decomposition, DoD test, anti-phasing) contradicting the
maintainer's "RUM NOT consent-gated" decision + the slice's own AC2/DoR — would have misdirected the
implementer into building the forbidden control; (2) a 022-01 scope contradiction (page-view vs page-view+
errors). BOTH RESOLVED + re-verified pass by the same reviewer: all consent mentions now describe
exclusion/skipping (grep-clean), 022-01 is `top`-only everywhere (errors → 022-02). Should-consider folded:
B′ named+dismissed; seam grounding recorded; payload-hygiene guard concretized (by-construction under B — a
test assertion that only {weight,id,referer,checkpoint,t} ship); verticality tempered ("a confined path
exists", redundant with the page until 022-03); mechanism-A `denySendBeacon`-throws re-plumb noted; the loose
"fed by airlock's CWV capture" dropped from the top-only framing. Framing is honest + implementable as written.
