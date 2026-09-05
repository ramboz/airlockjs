---
slice: 034-01 — coarse-consent split: analytics flows when only personalization is denied
pass: craft
verdict: pass
reviewer: general-purpose (independent craft review)
reviewed_at: 2026-09-05T16:39:46Z
prompt_source: review.py craft docs/specs/034-alloy-config-followups/spec.md 034-01 <deliverables>
substrate: non-interactive
---

VERDICT: pass (after one needs-changes round) — craft, slice 034-01

Feature code clean: the split gate computes effective purposes from the live consentRef (all 4 combos right; analytics-denied fail-closed-holds; both-granted byte-unchanged); stripInterceptedPersonalizationQuery is a faithful per-event sibling of stripInterceptedXdmBody; shapeAlloyConsent relaxation is a named constant with an accurate docstring; tests are discriminating (strip-removed→fills→fails; delegate-reverted→fired-assertion fails).

Round-1 BLOCKER (portability): the AC6 differential hard-imported @adobe/alloy from the gitignored probe-local node_modules → broke the hermetic npm test on fresh CI. FIXED: moved to rig/alloy-consent-diff.mjs (deps-gated, fail-loud), @adobe/alloy NOT added as a root dep (ADR-0016); re-verified npm test GREEN with probe deps moved aside; the shape-only coverage stays hermetic via AC2/AC5. Nit (comment path) fixed. Re-verify: pass.
