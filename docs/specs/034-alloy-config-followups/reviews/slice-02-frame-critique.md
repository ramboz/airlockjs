---
slice: 034-02 — multi-scope personalization: `decisionScopes` + N placements
pass: frame-critique
verdict: pass
reviewer: general-purpose (independent frame-critique, alloy-source-grounded)
reviewed_at: 2026-09-05T16:55:00Z
prompt_source: review.py frame-critique docs/specs/034-alloy-config-followups/spec.md 034-02 <deliverables>
---

VERDICT: pass — frame-critique, slice 034-02 (multi-scope personalization)

Independent frame-critique, alloy-2.35.0-source-grounded. The decisionScopes feasibility is fully grounded, NO probe: sendEvent accepts a top-level decisionScopes:[] (createComponent.js:49) and/or personalization.decisionScopes, merged+deduped into the query (createPersonalizationDetails.js:82-113); renderDecisions:false does NOT gate the fetch (shouldFetchData keys off hasScopes); PAGE_WIDE_SCOPE===__view__ so today's no-decisionScopes default fetches __view__ (back-compat holds). The host-side scope->placement map + the opts.placements seam ALREADY EXIST (wireAlloyDecisions.deliver index.js:853-877, keyed by scope with drop+diagnose; bootAlloy reads opts.placements), so the new work is bounded: remove the connector single-scope filter (connector.js:178 scope:decisionScope -> scope:null) + open the reserve (N boxes) + schema + validation.

Four AC refinements folded in: (1) tightened the over-reach — the REQUEST carrying all scopes is source-grounded, but per-scope RESPONSE is server/Target (rig-proven + live-deferred, not client-groundable); (2) set defaultPersonalizationEnabled:false when no __view__ placement (real alloy auto-adds __view__ on a cache-uninitialized event → a benign extra proposition drop+diagnose) — documented as a live-Alloy caveat, the analogue of 034-01's defaultPersonalizationEnabled; (3) the existing single-__view__ case now sends explicit decisionScopes:[__view__] (test-update heads-up); (4) duplicate scopes rejected at validation (both maps keyed by scope would silently collapse last-wins).
