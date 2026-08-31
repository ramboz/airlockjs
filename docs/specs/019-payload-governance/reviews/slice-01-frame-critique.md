---
slice: 019-01 — input-side payload denylist governance (all crossings, GA4 E2E)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T06:38:25Z
prompt_source: review.py frame-critique (nested-mutation-trap tailored)
---

# Frame-critique — 019-01 (input-side payload denylist governance). VERDICT: pass.
All four load-bearing GA4 bets survived direct source-checking: (1) two-point completeness — the only
{type:"events"} GA4-chamber posts are drain()+flushNow() (→ one sendBatch), and pushCritical+unloadFlush
funnel through the single criticalDispatchGated→mapToMp; init is ctx-only, held-beacon re-fetches replay
already-mapped bodies. No fourth GA4 crossing. (2) non-mutating nested strip is achievable via copy-on-write
along the denied path (not a full deep clone, not a shared-subobject-mutating shallow copy); AC1's
non-mutation observable catches a wrong impl. (3) GA4 input≈egress (mapToMp spreads params + synthesizes only
from host ctx). (4) empty-denylist identity is trivially non-mutation-consistent.
Three reconciliation notes FOLDED IN before implementation:
- Alloy "input governed for free / one seam" was OVER-STATED (inherited from ADR-0012). The primitive is
  vendor-neutral, but placement this slice is GA4-host-only (core/airlock.js); alloy's input crosses at the
  SEPARATE core/wrapped-sdk-host.js:265, untouched here (airlock.js:107 hardcodes the GA4 worker). Corrected
  spec + slice: alloy input NOT governed here; binding governPayload at the wrapped-SDK host is a deferred
  second placement (named residual); no shipped regression (wrapped-sdk-host is rig/test-only).
- AC7 vs purity: governPayload now returns {governed, stripped} so the impure caller emits the diagnostic
  without polluting the pure primitive.
- AC6 zero-alloc: sendBatch now has an explicit empty-denylist short-circuit (post the original batch as-is).
Reviewer: jig:reviewer (independent, read-only). Prompt: review.py frame-critique + tailored (nested-mutation trap).
