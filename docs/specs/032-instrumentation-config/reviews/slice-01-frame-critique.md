---
slice: 032-01 — the config-driven `boot(config)`: connector dispatch + collapse the pixel-boot duplication
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-04T21:53:35Z
prompt_source: review.py frame-critique docs/specs/032-instrumentation-config/spec.md 032-01 <slice>
---

VERDICT: pass (after one needs-changes → revision cycle)

## Assessment (independent frame-critique, jig:reviewer)

Both load-bearing concerns from the first pass are genuinely and faithfully closed; the frame survives.

## Finding 1 (PRIMARY) — the multi-connector lifecycle / `window.airlock` singleton → FIXED
A reuse-based multi-connector `boot()` would leave `window.airlock` GA4-only → `dispose()`/re-boot leaks the
pixel/rum Worker (regressing 021-01) and `setConsent()` misses the pixel (governance hole). AC4 would have passed
green while shipping this. **Addressed:** the lifecycle is now a hoisted **composition layer** (reuse the per-connector
boot logic, hoist `window.airlock` ownership + a composite `dispose()`/`setConsent()`), not a fork. New AC4: the
composite `dispose()` tears down EVERY connector, a re-boot disposes the entire prior composite (021-01 holds across
the whole config), `setConsent()` fans to every consent-governed connector — with a **seeded red→green regression**
proving the OLD GA4-only ownership leaks the pixel Worker on re-boot. Grounding matches (`index.js:433-436`, 021-01
AC2, mvp6.md).

## Finding 2 (SECONDARY) — helix-rum uniformity → FIXED
`bootHelixRum` is not consent-gated (spec 022, `egressPurposes:[]`), sync, returns `sampled` + a no-op handle when
unselected — uniform governance threading would regress it. **Addressed:** AC3 rewritten per-governance-class —
consent-governed connectors (GA4, pixels) get the gating; helix-rum keeps its spec-022 class (not gated/stripped,
not forced async), witnessed **byte-identical to `bootHelixRum` regardless of the config's consent/denylist**.
Grounded to `index.js:689-747,:723`.

## Reconciliation notes (non-blocking; carry downstream)
1. **Disclosed residual (acceptable):** GA4-from-config byte-equivalence to `bootEdsAnalytics` (async `_ga` sourcing
   + pre-`createAirlock` consent fold + `wireInteractions`/`wireExposure`/`wireBlocks`) is UNPROVEN by design →
   AC1/AC4's proof burden.
2. **For the ARCH pass (not frame):** the composite handle's `push()` **fan-out semantics** across heterogeneous
   connectors (one `push` → all connectors, each connector's own mapper deciding what it emits) are not pinned in
   the ACs — a public-surface design detail the arch reviewer should confirm.
3. **Implementation tension (covered by AC4/AC5):** standalone `bootEdsAnalytics()` must keep setting `window.airlock`
   (021-01 back-compat) while the `boot(config)` ga4 path must NOT — the `window.airlock`-set must be factored out of
   the shared logic into the back-compat wrapper vs the composite.

Reviewer: jig:reviewer (independent). Pre-implementation frame gate; frame_review: true. Recovery: needs-changes →
revision → re-run → pass.
