---
slice: 034-03 — composite/exposure refinements: `accepts(name)` + a wired emit hook
pass: frame-critique
verdict: pass
reviewer: general-purpose (independent frame-critique)
reviewed_at: 2026-09-05T17:44:35Z
prompt_source: review.py frame-critique docs/specs/034-alloy-config-followups/spec.md 034-03 <deliverables>
---

VERDICT: pass — frame-critique, slice 034-03 (composite/exposure refinements)

The frame is sound. accepts(name) is the correct scoped replacement for the count===0 overload (distinguishes 'no analytics sink' from 'no connector accepted'). CRITICAL safety check PASSES: the ONLY production reader of the composite push/pushCritical return is the 033-03 exposure sink (index.js:868) — reverting to void causes no runtime regression. AC2 timing verified: bootAlloy runs before createComposite, so a deferred {accepts,emit} ref boot() populates after assembly (bootAlloy's reporter closes over it) is the right shape. The re-boot misroute is GENUINELY REACHABLE (not theoretical): installOnWindow disposes+replaces window.airlock, and a main-thread deliver pending on await handlePromise resumes post-swap → would read the NEW composite; so AC2 is load-bearing.

Four test-scope/interface refinements folded: (1) the :689 window.airlock.push().toBe(1/0) assertion MUST be rewritten (re-express no-loop via captured events + accepts), not kept; (2) the count-return composite MOCKS at :718/:850-858 move to the {accepts,emit} shape; (3) AC4 reworded (no-loop BEHAVIOR preserved; count-return assertions RE-EXPRESSED, not 'stay green'); (4) interface pinned — decisions-exposure.js's reporter keeps its {push} contract, the accepts-gate+emit adaptation lives in wireAlloyDecisions.
